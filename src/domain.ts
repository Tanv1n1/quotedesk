import type { PoolClient } from 'pg';
import { pool } from './db.js';

// One logic layer. The web screens and the MCP tools both call these functions,
// so access rules and status rules live in exactly one place.

export class AppError extends Error {
  // "missing" lists required details that were not supplied, so Claude can ask for them.
  missing?: string[];
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const UOMS = ['Nos', 'Pcs', 'Box', 'Pack', 'Set', 'Pair', 'Dozen', 'Kg', 'Litre', 'Metre', 'Ream', 'Roll'] as const;
export const CATEGORIES = [
  'IT hardware', 'Office furniture', 'Office supplies', 'Electrical', 'Housekeeping', 'Packaging', 'Raw material', 'Services', 'Other',
] as const;

export type Role = 'manager' | 'vendor';
export type PRStatus = 'draft' | 'open' | 'awarded';

export interface Actor {
  id: number;
  name: string;
  role: Role;
  vendorId: number | null;
}

export interface ItemInput {
  name?: string | null;
  quantity?: number | string | null;
  spec?: string | null;
  unit?: string | null; // unit of measure, one of UOMS
  category?: string | null; // one of CATEGORIES
}

export interface PRInput {
  title?: string | null;
  department?: string | null;
  deliveryCity?: string | null;
  neededBy?: string | null;
  budgetInr?: number | null;
  justification?: string | null;
  items?: ItemInput[];
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

// Match a value against a fixed list, ignoring case. Unknown values are rejected, empty ones return null.
function pick(v: unknown, list: readonly string[], label: string): string | null {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const s = String(v).trim().toLowerCase();
  const hit = list.find((x) => x.toLowerCase() === s);
  if (!hit) throw new AppError(`${label} must be one of: ${list.join(', ')}.`);
  return hit;
}

function missingError(missing: string[]): AppError {
  const e = new AppError(`Add the missing details: ${missing.join(', ')}.`);
  e.missing = missing;
  return e;
}

interface CleanItem { name: string; quantity: number; spec: string | null; unit: string; category: string | null }
type Catalogue = Map<string, { category: string; uom: string }>;

async function loadCatalogue(c: PoolClient | typeof pool): Promise<Catalogue> {
  const r = await c.query('select name, category, uom from products');
  return new Map(r.rows.map((p) => [String(p.name).toLowerCase(), { category: p.category as string, uom: p.uom as string }]));
}

// Validates items. Anything required but absent is added to "missing" instead of being guessed.
// Unit of measure and category fall back to the product catalogue when the item name matches a product.
function cleanItems(items: ItemInput[] | undefined, cat: Catalogue, missing: string[]): CleanItem[] {
  if (!items || items.length === 0) {
    missing.push('at least one item');
    return [];
  }
  if (items.length > 50) throw new AppError('A purchase request can have at most 50 items.');
  const out: CleanItem[] = [];
  items.forEach((it, i) => {
    const n = i + 1;
    const name = text(it.name, 200, `Item ${n} name`);
    const label = name ? `"${name}"` : `item ${n}`;
    if (!name) missing.push(`name of item ${n}`);
    const known = name ? cat.get(name.toLowerCase()) : undefined;

    let q = 0;
    if (it.quantity === undefined || it.quantity === null || String(it.quantity).trim() === '') {
      missing.push(`quantity for ${label}`);
    } else {
      q = Number(it.quantity);
      if (!Number.isInteger(q) || q <= 0 || q > 1_000_000) {
        throw new AppError(`Item ${n}: quantity must be a whole number greater than zero.`);
      }
    }
    const unit = pick(it.unit, UOMS, `Item ${n} unit of measure`) ?? known?.uom ?? null;
    if (!unit) missing.push(`unit of measure for ${label}`);
    const category = pick(it.category, CATEGORIES, `Item ${n} category`) ?? known?.category ?? null;
    out.push({ name: name ?? '', quantity: q, spec: text(it.spec, 500, `Item ${n} specification`), unit: unit ?? '', category });
  });
  return out;
}

async function insertItems(c: PoolClient, prId: number, items: CleanItem[]): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    await c.query(
      'insert into pr_items (pr_id, position, name, spec, quantity, unit, category) values ($1,$2,$3,$4,$5,$6,$7)',
      [prId, i + 1, it.name, it.spec, it.quantity, it.unit, it.category],
    );
  }
}

function checkDeadline(dl: string, neededBy: string | null): void {
  if (dl < todayIST()) throw new AppError('The quote deadline cannot be in the past.');
  if (neededBy && dl > neededBy) {
    throw new AppError(`The quote deadline must be on or before the needed-by date (${neededBy}).`);
  }
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
  category: string | null;
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
  const r = await c.query('select id, position, name, spec, quantity, unit, category from pr_items where pr_id = $1 order by position', [prId]);
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
  category: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  quote_count: number;
  won_count: number;
}

const VENDOR_SELECT = `select v.id, v.name, v.city, v.category, v.contact_name, v.email, v.phone,
    (select count(*) from quotes q where q.vendor_id = v.id)::int as quote_count,
    (select count(*) from purchase_requests p join quotes q on q.id = p.winner_quote_id where q.vendor_id = v.id)::int as won_count
  from vendors v`;

export async function listVendors(): Promise<VendorRow[]> {
  const r = await pool.query(`${VENDOR_SELECT} order by v.name`);
  return r.rows as VendorRow[];
}

export async function getVendor(actor: Actor, id: number): Promise<VendorRow> {
  requireManager(actor);
  const r = await pool.query(`${VENDOR_SELECT} where v.id = $1`, [Number.isInteger(id) ? id : 0]);
  if (r.rowCount === 0) throw new AppError('Vendor not found.', 404);
  return r.rows[0] as VendorRow;
}

export interface VendorInput {
  name?: string | null;
  city?: string | null;
  category?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
}

function cleanVendor(input: VendorInput) {
  const missing: string[] = [];
  const name = text(input.name, 150, 'Vendor name');
  if (!name) missing.push('vendor name');
  const city = text(input.city, 100, 'City');
  if (!city) missing.push('city');
  const category = pick(input.category, CATEGORIES, 'Category');
  if (!category) missing.push('category');
  if (missing.length) throw missingError(missing);
  const email = text(input.email, 150, 'Email');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Enter a valid email address.');
  const phone = text(input.phone, 20, 'Phone');
  if (phone && !/^[0-9+() -]{6,20}$/.test(phone)) throw new AppError('Enter a valid phone number.');
  return [name, city, category, text(input.contactName, 100, 'Contact person'), email, phone];
}

const isDuplicate = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505';

// Names are unique ignoring case, so "Printer toner" and "printer toner" cannot both exist.
async function nameTaken(table: 'vendors' | 'products', name: unknown, exceptId = 0): Promise<boolean> {
  const r = await pool.query(`select 1 from ${table} where lower(name) = lower($1) and id <> $2`, [name, exceptId]);
  return (r.rowCount ?? 0) > 0;
}

export async function createVendor(actor: Actor, input: VendorInput): Promise<VendorRow> {
  requireManager(actor);
  const vals = cleanVendor(input);
  if (await nameTaken('vendors', vals[0])) throw new AppError('A vendor with this name already exists.', 409);
  try {
    const r = await pool.query(
      'insert into vendors (name, city, category, contact_name, email, phone) values ($1,$2,$3,$4,$5,$6) returning id', vals);
    return getVendor(actor, r.rows[0].id);
  } catch (e) {
    if (isDuplicate(e)) throw new AppError('A vendor with this name already exists.', 409);
    throw e;
  }
}

export async function updateVendor(actor: Actor, id: number, input: VendorInput): Promise<VendorRow> {
  const v = await getVendor(actor, id);
  const vals = cleanVendor(input);
  if (await nameTaken('vendors', vals[0], v.id)) throw new AppError('A vendor with this name already exists.', 409);
  try {
    await pool.query('update vendors set name=$1, city=$2, category=$3, contact_name=$4, email=$5, phone=$6 where id=$7', [...vals, v.id]);
    return getVendor(actor, v.id);
  } catch (e) {
    if (isDuplicate(e)) throw new AppError('A vendor with this name already exists.', 409);
    throw e;
  }
}

// ---------- product catalogue ----------

export interface ProductRow {
  id: number;
  name: string;
  category: string;
  uom: string;
  spec: string | null;
  used_count: number;
}

const PRODUCT_SELECT = `select p.id, p.name, p.category, p.uom, p.spec,
    (select count(distinct i.pr_id) from pr_items i where lower(i.name) = lower(p.name))::int as used_count
  from products p`;

export async function listProducts(actor: Actor): Promise<ProductRow[]> {
  requireManager(actor);
  const r = await pool.query(`${PRODUCT_SELECT} order by p.category, p.name`);
  return r.rows as ProductRow[];
}

export async function getProduct(actor: Actor, id: number): Promise<ProductRow> {
  requireManager(actor);
  const r = await pool.query(`${PRODUCT_SELECT} where p.id = $1`, [Number.isInteger(id) ? id : 0]);
  if (r.rowCount === 0) throw new AppError('Product not found.', 404);
  return r.rows[0] as ProductRow;
}

export interface ProductInput {
  name?: string | null;
  category?: string | null;
  uom?: string | null;
  spec?: string | null;
}

function cleanProduct(input: ProductInput) {
  const missing: string[] = [];
  const name = text(input.name, 200, 'Product name');
  if (!name) missing.push('product name');
  const category = pick(input.category, CATEGORIES, 'Category');
  if (!category) missing.push('category');
  const uom = pick(input.uom, UOMS, 'Unit of measure');
  if (!uom) missing.push('unit of measure');
  if (missing.length) throw missingError(missing);
  return [name, category, uom, text(input.spec, 500, 'Specification')];
}

export async function createProduct(actor: Actor, input: ProductInput): Promise<ProductRow> {
  requireManager(actor);
  const vals = cleanProduct(input);
  if (await nameTaken('products', vals[0])) throw new AppError('A product with this name already exists.', 409);
  try {
    const r = await pool.query('insert into products (name, category, uom, spec) values ($1,$2,$3,$4) returning id', vals);
    return getProduct(actor, r.rows[0].id);
  } catch (e) {
    if (isDuplicate(e)) throw new AppError('A product with this name already exists.', 409);
    throw e;
  }
}

export async function updateProduct(actor: Actor, id: number, input: ProductInput): Promise<ProductRow> {
  const p = await getProduct(actor, id);
  const vals = cleanProduct(input);
  if (await nameTaken('products', vals[0], p.id)) throw new AppError('A product with this name already exists.', 409);
  try {
    await pool.query('update products set name=$1, category=$2, uom=$3, spec=$4 where id=$5', [...vals, p.id]);
    return getProduct(actor, p.id);
  } catch (e) {
    if (isDuplicate(e)) throw new AppError('A product with this name already exists.', 409);
    throw e;
  }
}

// ---------- purchase requests ----------

export async function createPR(actor: Actor, input: PRInput, via: 'app' | 'claude'): Promise<PRRow> {
  requireManager(actor);
  // Required before a request can exist: title, delivery city, needed-by date, and for every item a name, quantity and unit.
  const missing: string[] = [];
  const title = text(input.title, 200, 'Title');
  if (!title) missing.push('title');
  const city = text(input.deliveryCity, 100, 'Delivery city');
  if (!city) missing.push('delivery city');
  const neededBy = dateStr(input.neededBy, 'Needed-by date');
  if (!neededBy) missing.push('needed-by date');
  else if (neededBy < todayIST()) throw new AppError('The needed-by date cannot be in the past.');
  const items = cleanItems(input.items, await loadCatalogue(pool), missing);
  if (missing.length) throw missingError(missing);
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
        city,
        neededBy, budget,
        text(input.justification, 1000, 'Justification'),
        via,
      ],
    );
    const id = ins.rows[0].id as number;
    await insertItems(c, id, items);
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
    if (patch.deliveryCity !== undefined) add('delivery_city', text(patch.deliveryCity, 100, 'Delivery city', true));
    let neededBy = pr.needed_by;
    if (patch.neededBy !== undefined) {
      neededBy = dateStr(patch.neededBy, 'Needed-by date');
      if (!neededBy) throw new AppError('Needed-by date is required.');
      if (neededBy !== pr.needed_by && neededBy < todayIST()) throw new AppError('The needed-by date cannot be in the past.');
      add('needed_by', neededBy);
    }
    if (patch.budgetInr !== undefined) add('budget_inr', money(patch.budgetInr, 'Budget'));
    if (patch.justification !== undefined) add('justification', text(patch.justification, 1000, 'Justification'));
    if (patch.quoteDeadline !== undefined) {
      const dl = dateStr(patch.quoteDeadline, 'Quote deadline');
      if (!dl && pr.status === 'open') throw new AppError('A request that is open for quotes needs a quote deadline.');
      if (dl && dl !== pr.quote_deadline) checkDeadline(dl, neededBy);
      add('quote_deadline', dl);
    }

    if (patch.items !== undefined) {
      const missing: string[] = [];
      const items = cleanItems(patch.items, await loadCatalogue(c), missing);
      if (missing.length) throw missingError(missing);
      await c.query('delete from pr_items where pr_id = $1', [pr.id]);
      await insertItems(c, pr.id, items);
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
  const given = dateStr(deadline, 'Quote deadline');
  return tx(async (c) => {
    const pr = await loadPR(c, ref, true);
    if (pr.status !== 'draft') throw new AppError(`${pr.pr_number} is already ${pr.status}.`, 409);
    // Vendors need to know where, by when and until when they can quote.
    const missing: string[] = [];
    if (!pr.delivery_city) missing.push('delivery city');
    if (!pr.needed_by) missing.push('needed-by date');
    const items = await loadItems(c, pr.id);
    if (items.length === 0) missing.push('at least one item');
    const dl = given ?? pr.quote_deadline;
    if (!dl) missing.push('quote deadline');
    if (missing.length) throw missingError(missing);
    checkDeadline(dl!, pr.needed_by);
    await c.query(
      `update purchase_requests set status = 'open', quote_deadline = $2, updated_at = now() where id = $1`,
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
  winner_name: string | null;
  winner_total: number | null;
}

export async function listPRs(actor: Actor): Promise<PRListRow[]> {
  const base = `select p.*, u.name as requester_name,
      (select count(*) from pr_items i where i.pr_id = p.id)::int as item_count,
      (select coalesce(sum(i.quantity),0) from pr_items i where i.pr_id = p.id)::int as total_units,
      (select count(*) from quotes q where q.pr_id = p.id)::int as quote_count,
      (select min(q.total_inr) from quotes q where q.pr_id = p.id) as lowest_total,
      (select v.name from quotes q join vendors v on v.id = q.vendor_id where q.id = p.winner_quote_id) as winner_name,
      (select q.total_inr from quotes q where q.id = p.winner_quote_id) as winner_total`;
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
  // Vendors must not see the budget, the lowest competing total or who won.
  return (r.rows as PRListRow[]).map((row) => ({
    ...row, budget_inr: null, lowest_total: null, quote_count: 0, winner_name: null, winner_total: null,
  }));
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
  vendorCategory: string | null;
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
    `select q.*, v.name as vendor_name, v.city as vendor_city, v.category as vendor_category
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
    vendorCategory: q.vendor_category,
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
