import type { PoolClient } from 'pg';
import { pool } from './db.js';

// One logic layer. The web screens and the MCP tools both call these functions,
// so access rules and status rules live in exactly one place.

export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type Role = 'manager' | 'vendor';
export type PRStatus = 'draft' | 'open' | 'awarded';

export interface Actor {
  id: number;
  name: string;
  role: Role;
  vendorId: number | null;
}

export interface ItemInput {
  name: string;
  quantity: number;
  spec?: string | null;
  unit?: string | null;
}

export interface PRInput {
  title: string;
  department?: string | null;
  deliveryCity?: string | null;
  neededBy?: string | null;
  budgetInr?: number | null;
  justification?: string | null;
  items: ItemInput[];
}

export type PRPatch = Partial<Omit<PRInput, 'items'>> & {
  items?: ItemInput[];
  quoteDeadline?: string | null;
};

export interface QuoteInput {
  vendorId?: number;
  deliveryDays: number;
  validityDays?: number | null;
  notes?: string | null;
  prices: Record<number, number>; // pr_item_id -> unit price in INR
}

// ---------- small helpers ----------

export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function text(v: unknown, max: number, label: string, required = false): string | null {
  if (v === undefined || v === null || String(v).trim() === '') {
    if (required) throw new AppError(`${label} is required.`);
    return null;
  }
  const s = String(v).trim();
  if (s.length > max) throw new AppError(`${label} is too long (max ${max} characters).`);
  return s;
}

function dateStr(v: unknown, label: string): string | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
    throw new AppError(`${label} must be a date in YYYY-MM-DD format.`);
  }
  return s;
}

function money(v: unknown, label: string): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new AppError(`${label} must be a valid amount.`);
  return Math.round(n * 100) / 100;
}

function cleanItems(items: ItemInput[] | undefined): Required<ItemInput>[] {
  if (!items || items.length === 0) throw new AppError('Add at least one item.');
  if (items.length > 50) throw new AppError('A purchase request can have at most 50 items.');
  return items.map((it, i) => {
    const q = Number(it.quantity);
    if (!Number.isInteger(q) || q <= 0 || q > 1_000_000) {
      throw new AppError(`Item ${i + 1}: quantity must be a whole number greater than zero.`);
    }
    return {
      name: text(it.name, 200, `Item ${i + 1} name`, true)!,
      quantity: q,
      spec: text(it.spec, 500, `Item ${i + 1} specification`),
      unit: text(it.unit, 20, `Item ${i + 1} unit`) ?? 'nos',
    };
  });
}

function requireManager(actor: Actor): void {
  if (actor.role !== 'manager') throw new AppError('Only the procurement manager can do this.', 403);
}

async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}

// ---------- row types ----------

export interface PRRow {
  id: number;
  pr_number: string;
  title: string;
  requester_id: number;
  requester_name: string;
  department: string | null;
  delivery_city: string | null;
  needed_by: string | null;
  budget_inr: number | null;
  justification: string | null;
  status: PRStatus;
  quote_deadline: string | null;
  winner_quote_id: number | null;
  created_via: string;
  created_at: Date;
  updated_at: Date;
}

export interface ItemRow {
  id: number;
  position: number;
  name: string;
  spec: string | null;
  quantity: number;
  unit: string;
}

const PR_SELECT = `select p.*, u.name as requester_name
  from purchase_requests p join users u on u.id = p.requester_id`;

async function loadPR(c: PoolClient | typeof pool, ref: string | number, lock = false): Promise<PRRow> {
  const s = String(ref).trim();
  let where: string;
  let val: string | number;
  if (/^pr-\d+$/i.test(s)) {
    where = 'p.pr_number = $1';
    val = s.toUpperCase();
  } else if (/^\d+$/.test(s)) {
    where = 'p.id = $1';
    val = Number(s);
  } else {
    throw new AppError(`"${s}" is not a valid purchase request number. Use a number like PR-0003.`, 404);
  }
  const r = await c.query(`${PR_SELECT} where ${where}${lock ? ' for update of p' : ''}`, [val]);
  if (r.rowCount === 0) throw new AppError(`Purchase request ${s} was not found.`, 404);
  return r.rows[0] as PRRow;
}

async function loadItems(c: PoolClient | typeof pool, prId: number): Promise<ItemRow[]> {
  const r = await c.query('select id, position, name, spec, quantity, unit from pr_items where pr_id = $1 order by position', [prId]);
  return r.rows as ItemRow[];
}

// ---------- users and vendors ----------

export async function getActorByEmail(email: string): Promise<Actor | null> {
  const r = await pool.query('select id, name, role, vendor_id from users where email = $1', [email]);
  if (r.rowCount === 0) return null;
  const u = r.rows[0];
  return { id: u.id, name: u.name, role: u.role, vendorId: u.vendor_id };
}

export async function getActorById(id: number): Promise<Actor | null> {
  const r = await pool.query('select id, name, role, vendor_id from users where id = $1', [id]);
  if (r.rowCount === 0) return null;
  const u = r.rows[0];
  return { id: u.id, name: u.name, role: u.role, vendorId: u.vendor_id };
}

export interface VendorRow {
  id: number;
  name: string;
  city: string;
}

export async function listVendors(): Promise<VendorRow[]> {
  const r = await pool.query('select id, name, city from vendors order by name');
  return r.rows as VendorRow[];
}

// ---------- purchase requests ----------

export async function createPR(actor: Actor, input: PRInput, via: 'app' | 'claude'): Promise<PRRow> {
  requireManager(actor);
  const title = text(input.title, 200, 'Title', true)!;
  const items = cleanItems(input.items);
  const neededBy = dateStr(input.neededBy, 'Needed-by date');
  const budget = money(input.budgetInr, 'Budget');
  return tx(async (c) => {
    const n = await c.query(`select 'PR-' || lpad(nextval('pr_number_seq')::text, 4, '0') as n`);
    const ins = await c.query(
      `insert into purchase_requests
        (pr_number, title, requester_id, department, delivery_city, needed_by, budget_inr, justification, created_via)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        n.rows[0].n, title, actor.id,
        text(input.department, 100, 'Department'),
        text(input.deliveryCity, 100, 'Delivery city'),
        neededBy, budget,
        text(input.justification, 1000, 'Justification'),
        via,
      ],
    );
    const id = ins.rows[0].id as number;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await c.query(
        'insert into pr_items (pr_id, position, name, spec, quantity, unit) values ($1,$2,$3,$4,$5,$6)',
        [id, i + 1, it.name, it.spec, it.quantity, it.unit],
      );
    }
    return loadPR(c, id);
  });
}

export async function updatePR(actor: Actor, ref: string | number, patch: PRPatch): Promise<PRRow> {
  requireManager(actor);
  return tx(async (c) => {
    const pr = await loadPR(c, ref, true);
    if (pr.status === 'awarded') throw new AppError(`${pr.pr_number} is awarded and can no longer be edited.`, 409);

    if (pr.status === 'open') {
      const locked = ['title', 'department', 'deliveryCity', 'neededBy', 'budgetInr', 'items'] as const;
      if (locked.some((k) => patch[k] !== undefined)) {
        throw new AppError(
          `${pr.pr_number} is open for quotes, so items and details are locked. Only the quote deadline and the notes can change.`,
          409,
        );
      }
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    const add = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (patch.title !== undefined) add('title', text(patch.title, 200, 'Title', true));
    if (patch.department !== undefined) add('department', text(patch.department, 100, 'Department'));
    if (patch.deliveryCity !== undefined) add('delivery_city', text(patch.deliveryCity, 100, 'Delivery city'));
    if (patch.neededBy !== undefined) add('needed_by', dateStr(patch.neededBy, 'Needed-by date'));
    if (patch.budgetInr !== undefined) add('budget_inr', money(patch.budgetInr, 'Budget'));
    if (patch.justification !== undefined) add('justification', text(patch.justification, 1000, 'Justification'));
    if (patch.quoteDeadline !== undefined) add('quote_deadline', dateStr(patch.quoteDeadline, 'Quote deadline'));

    if (patch.items !== undefined) {
      const items = cleanItems(patch.items);
      await c.query('delete from pr_items where pr_id = $1', [pr.id]);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await c.query(
          'insert into pr_items (pr_id, position, name, spec, quantity, unit) values ($1,$2,$3,$4,$5,$6)',
          [pr.id, i + 1, it.name, it.spec, it.quantity, it.unit],
        );
      }
    }
    if (sets.length > 0 || patch.items !== undefined) {
      vals.push(pr.id);
      await c.query(`update purchase_requests set ${sets.concat('updated_at = now()').join(', ')} where id = $${vals.length}`, vals);
    }
    return loadPR(c, pr.id);
  });
}

export async function openForQuotes(actor: Actor, ref: string | number, deadline?: string | null): Promise<PRRow> {
  requireManager(actor);
  const dl = dateStr(deadline, 'Quote deadline');
  if (dl && dl < todayIST()) throw new AppError('The quote deadline cannot be in the past.');
  return tx(async (c) => {
    const pr = await loadPR(c, ref, true);
    if (pr.status !== 'draft') throw new AppError(`${pr.pr_number} is already ${pr.status}.`, 409);
    const items = await loadItems(c, pr.id);
    if (items.length === 0) throw new AppError('Add at least one item before opening for quotes.');
    await c.query(
      `update purchase_requests set status = 'open', quote_deadline = coalesce($2, quote_deadline), updated_at = now() where id = $1`,
      [pr.id, dl],
    );
    return loadPR(c, pr.id);
  });
}

// ---------- listing ----------

export interface PRListRow extends PRRow {
  item_count: number;
  total_units: number;
  quote_count: number;
  lowest_total: number | null;
  my_quote_total: number | null;
  my_quote_id: number | null;
  i_won: boolean;
}

export async function listPRs(actor: Actor): Promise<PRListRow[]> {
  const base = `select p.*, u.name as requester_name,
      (select count(*) from pr_items i where i.pr_id = p.id)::int as item_count,
      (select coalesce(sum(i.quantity),0) from pr_items i where i.pr_id = p.id)::int as total_units,
      (select count(*) from quotes q where q.pr_id = p.id)::int as quote_count,
      (select min(q.total_inr) from quotes q where q.pr_id = p.id) as lowest_total`;
  if (actor.role === 'manager') {
    const r = await pool.query(
      `${base}, null::numeric as my_quote_total, null::int as my_quote_id, false as i_won
       from purchase_requests p join users u on u.id = p.requester_id order by p.id desc`,
    );
    return r.rows as PRListRow[];
  }
  if (!actor.vendorId) return [];
  const r = await pool.query(
    `${base}, mq.total_inr as my_quote_total, mq.id as my_quote_id, (p.winner_quote_id is not null and p.winner_quote_id = mq.id) as i_won
     from purchase_requests p join users u on u.id = p.requester_id
     left join quotes mq on mq.pr_id = p.id and mq.vendor_id = $1
     where p.status = 'open' or mq.id is not null
     order by p.id desc`,
    [actor.vendorId],
  );
  // Vendors must not see the lowest competing total.
  return (r.rows as PRListRow[]).map((row) => ({ ...row, lowest_total: null, quote_count: 0 }));
}

// ---------- detail and comparison ----------

export interface QuoteLineView {
  itemId: number;
  unitPriceInr: number;
  lineTotalInr: number;
}

export interface QuoteView {
  id: number;
  vendorId: number;
  vendorName: string;
  vendorCity: string;
  totalInr: number;
  deliveryDays: number;
  validityDays: number | null;
  notes: string | null;
  onBehalf: boolean;
  updatedAt: Date;
  lines: QuoteLineView[];
  isLowest: boolean;
  isFastest: boolean;
  withinBudget: boolean | null;
  isWinner: boolean;
}

async function loadQuotes(c: PoolClient | typeof pool, pr: PRRow, items: ItemRow[], onlyVendorId?: number): Promise<QuoteView[]> {
  const qs = await c.query(
    `select q.*, v.name as vendor_name, v.city as vendor_city
       from quotes q join vendors v on v.id = q.vendor_id
      where q.pr_id = $1 ${onlyVendorId ? 'and q.vendor_id = $2' : ''}
      order by q.total_inr, q.id`,
    onlyVendorId ? [pr.id, onlyVendorId] : [pr.id],
  );
  const ids = qs.rows.map((q) => q.id as number);
  const lines = ids.length
    ? (await c.query('select quote_id, pr_item_id, unit_price_inr from quote_lines where quote_id = any($1)', [ids])).rows
    : [];
  const qty = new Map(items.map((i) => [i.id, i.quantity]));
  const minTotal = qs.rows.length ? Math.min(...qs.rows.map((q) => q.total_inr as number)) : 0;
  const minDays = qs.rows.length ? Math.min(...qs.rows.map((q) => q.delivery_days as number)) : 0;
  return qs.rows.map((q) => ({
    id: q.id,
    vendorId: q.vendor_id,
    vendorName: q.vendor_name,
    vendorCity: q.vendor_city,
    totalInr: q.total_inr,
    deliveryDays: q.delivery_days,
    validityDays: q.validity_days,
    notes: q.notes,
    onBehalf: q.on_behalf,
    updatedAt: q.updated_at,
    lines: lines
      .filter((l) => l.quote_id === q.id)
      .map((l) => ({
        itemId: l.pr_item_id as number,
        unitPriceInr: l.unit_price_inr as number,
        lineTotalInr: Math.round((l.unit_price_inr as number) * (qty.get(l.pr_item_id) ?? 0) * 100) / 100,
      })),
    isLowest: qs.rows.length > 1 && q.total_inr === minTotal,
    isFastest: qs.rows.length > 1 && q.delivery_days === minDays,
    withinBudget: pr.budget_inr == null ? null : q.total_inr <= pr.budget_inr,
    isWinner: pr.winner_quote_id === q.id,
  }));
}

export interface PRDetail {
  pr: PRRow;
  items: ItemRow[];
  quotes: QuoteView[];
  pendingVendors: VendorRow[]; // manager only
}

export async function getPRDetail(actor: Actor, ref: string | number): Promise<PRDetail> {
  const pr = await loadPR(pool, ref);
  if (actor.role === 'vendor') {
    if (!actor.vendorId) throw new AppError('Your login is not linked to a vendor.', 403);
    const mine = await loadQuotes(pool, pr, await loadItems(pool, pr.id), actor.vendorId);
    // Vendors see a PR only while it is open for quotes, or if they quoted on it.
    if (pr.status !== 'open' && mine.length === 0) throw new AppError('Request not found.', 404);
    if (pr.status === 'draft') throw new AppError('Request not found.', 404);
    const items = await loadItems(pool, pr.id);
    return { pr: { ...pr, budget_inr: null }, items, quotes: mine, pendingVendors: [] };
  }
  const items = await loadItems(pool, pr.id);
  const quotes = await loadQuotes(pool, pr, items);
  const quoted = new Set(quotes.map((q) => q.vendorId));
  const pendingVendors = (await listVendors()).filter((v) => !quoted.has(v.id));
  return { pr, items, quotes, pendingVendors };
}

// ---------- quotes ----------

export async function submitQuote(actor: Actor, ref: string | number, input: QuoteInput): Promise<QuoteView> {
  let vendorId: number;
  let onBehalf = false;
  if (actor.role === 'vendor') {
    if (!actor.vendorId) throw new AppError('Your login is not linked to a vendor.', 403);
    vendorId = actor.vendorId;
  } else {
    if (!input.vendorId) throw new AppError('Choose the vendor this quote is for.');
    vendorId = input.vendorId;
    onBehalf = true;
  }
  const days = Number(input.deliveryDays);
  if (!Number.isInteger(days) || days < 0 || days > 365) throw new AppError('Delivery days must be a whole number between 0 and 365.');
  let validity: number | null = null;
  if (input.validityDays !== undefined && input.validityDays !== null && String(input.validityDays) !== '') {
    validity = Number(input.validityDays);
    if (!Number.isInteger(validity) || validity < 0 || validity > 365) throw new AppError('Validity must be a whole number of days.');
  }
  const notes = text(input.notes, 1000, 'Notes');

  return tx(async (c) => {
    const pr = await loadPR(c, ref, true);
    if (pr.status === 'draft') throw new AppError(`${pr.pr_number} is not open for quotes yet.`, 409);
    if (pr.status === 'awarded') throw new AppError(`${pr.pr_number} has already been awarded.`, 409);
    if (pr.quote_deadline && pr.quote_deadline < todayIST()) {
      throw new AppError(`The quote deadline for ${pr.pr_number} (${pr.quote_deadline}) has passed.`, 409);
    }
    const v = await c.query('select id from vendors where id = $1', [vendorId]);
    if (v.rowCount === 0) throw new AppError('Vendor not found.', 404);

    const items = await loadItems(c, pr.id);
    let total = 0;
    const priced: { itemId: number; price: number }[] = [];
    for (const it of items) {
      const raw = input.prices[it.id];
      const p = Number(raw);
      if (raw === undefined || raw === null || String(raw).trim() === '' || !Number.isFinite(p) || p < 0 || p > 1e10) {
        throw new AppError(`Enter a unit price for "${it.name}".`);
      }
      const price = Math.round(p * 100) / 100;
      priced.push({ itemId: it.id, price });
      total += price * it.quantity;
    }
    total = Math.round(total * 100) / 100;

    const up = await c.query(
      `insert into quotes (pr_id, vendor_id, submitted_by, on_behalf, delivery_days, validity_days, notes, total_inr)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (pr_id, vendor_id) do update set
         submitted_by = excluded.submitted_by, on_behalf = excluded.on_behalf,
         delivery_days = excluded.delivery_days, validity_days = excluded.validity_days,
         notes = excluded.notes, total_inr = excluded.total_inr, updated_at = now()
       returning id`,
      [pr.id, vendorId, actor.id, onBehalf, days, validity, notes, total],
    );
    const quoteId = up.rows[0].id as number;
    await c.query('delete from quote_lines where quote_id = $1', [quoteId]);
    for (const p of priced) {
      await c.query('insert into quote_lines (quote_id, pr_item_id, unit_price_inr) values ($1,$2,$3)', [quoteId, p.itemId, p.price]);
    }
    const all = await loadQuotes(c, pr, items);
    return all.find((q) => q.id === quoteId)!;
  });
}

export async function getQuotes(actor: Actor, ref: string | number): Promise<PRDetail> {
  requireManager(actor);
  return getPRDetail(actor, ref);
}

// ---------- award ----------

export interface WinnerTarget {
  quoteId?: number;
  vendorId?: number;
  vendorName?: string;
}

export async function markWinner(actor: Actor, ref: string | number, target: WinnerTarget): Promise<PRDetail> {
  requireManager(actor);
  await tx(async (c) => {
    const pr = await loadPR(c, ref, true);
    if (pr.status === 'draft') throw new AppError(`${pr.pr_number} is not open for quotes, so there is nothing to award.`, 409);
    if (pr.status === 'awarded') throw new AppError(`${pr.pr_number} has already been awarded.`, 409);

    const r = await c.query(
      `select q.id, v.name as vendor_name, q.vendor_id from quotes q join vendors v on v.id = q.vendor_id where q.pr_id = $1`,
      [pr.id],
    );
    let match = r.rows;
    if (target.quoteId) match = match.filter((q) => q.id === target.quoteId);
    else if (target.vendorId) match = match.filter((q) => q.vendor_id === target.vendorId);
    else if (target.vendorName) {
      const n = target.vendorName.trim().toLowerCase();
      const exact = match.filter((q) => String(q.vendor_name).toLowerCase() === n);
      match = exact.length ? exact : match.filter((q) => String(q.vendor_name).toLowerCase().includes(n));
    } else throw new AppError('Say which vendor won.');

    if (match.length === 0) {
      const names = r.rows.map((q) => q.vendor_name).join(', ') || 'none yet';
      throw new AppError(`No matching quote on ${pr.pr_number}. Vendors with quotes: ${names}.`, 404);
    }
    if (match.length > 1) {
      throw new AppError(`More than one vendor matches: ${match.map((q) => q.vendor_name).join(', ')}. Use the full name.`);
    }
    await c.query(
      `update purchase_requests set status = 'awarded', winner_quote_id = $2, updated_at = now() where id = $1`,
      [pr.id, match[0].id],
    );
  });
  return getPRDetail(actor, ref);
}
