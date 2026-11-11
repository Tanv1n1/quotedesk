import express, { NextFunction, Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { MCP_TOKEN, PROD, SESSION_SECRET, baseUrlOf } from './config.js';
import {
  Actor, AppError, createPR, getActorByEmail, getActorById, getPRDetail, listPRs, listVendors, markWinner, openForQuotes,
  submitQuote, updatePR, ItemInput,
} from './domain.js';
import { DEMO_MANAGER_EMAIL, DEMO_VENDOR_EMAIL } from './seed.js';
import {
  aboutPage, connectPage, landingPage, layout, prDetailPage, prFormPage, prListPage, vendorDetailPage, vendorListPage,
} from './views.js';

const COOKIE = 'qd_session';

// Empty or missing form field -> null, otherwise a number (validated in the domain layer).
const optNum = (v: unknown): number | null => (v === undefined || v === null || String(v).trim() === '' ? null : Number(v));

function sign(v: string): string {
  return createHmac('sha256', SESSION_SECRET).update(v).digest('base64url');
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.get('cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

async function sessionUser(req: Request): Promise<Actor | null> {
  const c = readCookie(req, COOKIE);
  if (!c) return null;
  const [id, sig] = c.split('.');
  if (!id || !sig || !/^\d+$/.test(id)) return null;
  const want = Buffer.from(sign(id));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return getActorById(Number(id));
}

function setSession(res: Response, userId: number): void {
  const v = `${userId}.${sign(String(userId))}`;
  res.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${PROD ? '; Secure' : ''}`);
}

function flashOf(req: Request) {
  const e = typeof req.query.e === 'string' ? req.query.e : undefined;
  const n = typeof req.query.n === 'string' ? req.query.n : undefined;
  return e ? { error: e } : n ? { notice: n } : undefined;
}

function go(res: Response, url: string, msg?: { e?: string; n?: string }): void {
  if (!msg) return void res.redirect(303, url);
  const [path, hash] = url.split('#');
  const sep = path.includes('?') ? '&' : '?';
  const q = msg.e ? `e=${encodeURIComponent(msg.e)}` : `n=${encodeURIComponent(msg.n ?? '')}`;
  res.redirect(303, `${path}${sep}${q}${hash ? '#' + hash : ''}`);
}

type Handler = (req: Request, res: Response, user: Actor) => Promise<void>;

export function webRoutes(app: express.Express): void {
  const form = express.urlencoded({ extended: false, limit: '200kb' });

  const home = (u: Actor) => (u.role === 'manager' ? '/prs' : '/requests');

  // Guarded route: loads the session, enforces the role, turns AppErrors into flash messages or error pages.
  const route =
    (role: 'manager' | 'vendor' | 'any', h: Handler, failTo?: (req: Request) => string) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = await sessionUser(req);
        if (!user) return void res.redirect(303, '/');
        if (role !== 'any' && user.role !== role) return void res.redirect(303, home(user));
        await h(req, res, user);
      } catch (e) {
        if (e instanceof AppError) {
          if (req.method === 'POST' && failTo) return go(res, failTo(req), { e: e.message });
          const user = await sessionUser(req).catch(() => null);
          return void res
            .status(e.status)
            .send(layout({ user, title: 'Not available', body: `<div class="card empty"><h3>${e.status === 404 ? 'Not found' : 'Not allowed'}</h3><p>${e.message.replace(/</g, '&lt;')}</p><a class="btn" href="${user ? home(user) : '/'}">Go back</a></div>` }));
        }
        next(e);
      }
    };

  // ----- public -----
  app.get('/', async (req, res, next) => {
    try {
      const u = await sessionUser(req);
      if (u) return void res.redirect(303, home(u));
      res.send(layout({ user: null, title: 'Home', body: landingPage() }));
    } catch (e) { next(e); }
  });

  app.post('/demo/:role', async (req, res, next) => {
    try {
      const email = req.params.role === 'manager' ? DEMO_MANAGER_EMAIL : req.params.role === 'vendor' ? DEMO_VENDOR_EMAIL : null;
      const u = email ? await getActorByEmail(email) : null;
      if (!u) return void res.redirect(303, '/');
      setSession(res, u.id);
      res.redirect(303, home(u));
    } catch (e) { next(e); }
  });

  app.post('/logout', (_req, res) => {
    res.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.redirect(303, '/');
  });

  app.get('/about', async (req, res, next) => {
    try {
      res.send(layout({ user: await sessionUser(req), title: 'About', active: 'about', body: aboutPage() }));
    } catch (e) { next(e); }
  });

  // ----- manager -----
  app.get('/prs', route('manager', async (req, res, u) => {
    res.send(layout({ user: u, title: 'Purchase requests', active: 'prs', flash: flashOf(req), body: prListPage(await listPRs(u)) }));
  }));

  app.get('/prs/new', route('manager', async (req, res, u) => {
    res.send(layout({ user: u, title: 'New purchase request', active: 'prs', flash: flashOf(req), body: prFormPage(null, []) }));
  }));

  const itemsFrom = (b: Record<string, unknown>): ItemInput[] => {
    const arr = (k: string): string[] => (Array.isArray(b[k]) ? (b[k] as string[]) : b[k] === undefined ? [] : [String(b[k])]);
    const names = arr('item_name'), specs = arr('item_spec'), qtys = arr('item_qty'), units = arr('item_unit');
    const out: ItemInput[] = [];
    names.forEach((name, i) => {
      if (!name.trim() && !(qtys[i] ?? '').trim()) return; // skip fully blank rows
      out.push({ name, spec: specs[i], unit: units[i], quantity: Number(qtys[i]) });
    });
    return out;
  };

  app.post('/prs', form, route('manager', async (req, res, u) => {
    const b = req.body;
    const pr = await createPR(u, {
      title: b.title, department: b.department, deliveryCity: b.delivery_city, neededBy: b.needed_by,
      budgetInr: b.budget_inr === '' ? null : Number(b.budget_inr), justification: b.justification, items: itemsFrom(b),
    }, 'app');
    go(res, `/prs/${pr.id}`, { n: `${pr.pr_number} created as a draft.` });
  }, () => '/prs/new'));

  app.get('/prs/:id', route('manager', async (req, res, u) => {
    const d = await getPRDetail(u, req.params.id);
    const v = Number(req.query.vendor);
    res.send(layout({ user: u, title: d.pr.pr_number, active: 'prs', flash: flashOf(req), body: prDetailPage(d, await listVendors(), Number.isInteger(v) && v > 0 ? v : undefined) }));
  }));

  app.get('/prs/:id/edit', route('manager', async (req, res, u) => {
    const d = await getPRDetail(u, req.params.id);
    if (d.pr.status === 'awarded') throw new AppError(`${d.pr.pr_number} is awarded and can no longer be edited.`, 409);
    res.send(layout({ user: u, title: `Edit ${d.pr.pr_number}`, active: 'prs', flash: flashOf(req), body: prFormPage(d.pr, d.items) }));
  }));

  app.post('/prs/:id/edit', form, route('manager', async (req, res, u) => {
    const b = req.body;
    const d = await getPRDetail(u, req.params.id);
    if (d.pr.status === 'open') {
      await updatePR(u, d.pr.id, { quoteDeadline: b.quote_deadline, justification: b.justification });
    } else {
      await updatePR(u, d.pr.id, {
        title: b.title, department: b.department, deliveryCity: b.delivery_city, neededBy: b.needed_by,
        budgetInr: b.budget_inr === '' ? null : Number(b.budget_inr), justification: b.justification, items: itemsFrom(b),
      });
    }
    go(res, `/prs/${d.pr.id}`, { n: 'Changes saved.' });
  }, (req) => `/prs/${req.params.id}/edit`));

  app.post('/prs/:id/open', form, route('manager', async (req, res, u) => {
    const pr = await openForQuotes(u, req.params.id, req.body.quote_deadline || null);
    go(res, `/prs/${pr.id}`, { n: `${pr.pr_number} is open for quotes. Vendors can now submit prices.` });
  }, (req) => `/prs/${req.params.id}`));

  const pricesFrom = (b: Record<string, unknown>): Record<number, number> => {
    const p: Record<number, number> = {};
    for (const [k, v] of Object.entries(b)) {
      const m = /^price_(\d+)$/.exec(k);
      if (m) p[Number(m[1])] = v === '' ? NaN : Number(v);
    }
    return p;
  };

  app.post('/prs/:id/quote', form, route('manager', async (req, res, u) => {
    const b = req.body;
    const q = await submitQuote(u, req.params.id, {
      vendorId: Number(b.vendor_id) || undefined, deliveryDays: b.delivery_days === '' ? NaN : Number(b.delivery_days),
      validityDays: optNum(b.validity_days), notes: b.notes, prices: pricesFrom(b),
    });
    go(res, `/prs/${req.params.id}`, { n: `Quote from ${q.vendorName} saved.` });
  }, (req) => `/prs/${req.params.id}#add-quote`));

  app.post('/prs/:id/award', form, route('manager', async (req, res, u) => {
    const d = await markWinner(u, req.params.id, { quoteId: Number(req.body.quote_id) });
    const w = d.quotes.find((q) => q.isWinner);
    go(res, `/prs/${d.pr.id}`, { n: `${w?.vendorName ?? 'Vendor'} marked as the winner.` });
  }, (req) => `/prs/${req.params.id}`));

  app.get('/connect', route('manager', async (req, res, u) => {
    res.send(layout({ user: u, title: 'Connect to Claude', active: 'connect', body: connectPage(`${baseUrlOf(req)}/mcp/${MCP_TOKEN}`) }));
  }));

  // ----- vendor -----
  app.get('/requests', route('vendor', async (req, res, u) => {
    res.send(layout({ user: u, title: 'Open requests', active: 'requests', flash: flashOf(req), body: vendorListPage(await listPRs(u)) }));
  }));

  app.get('/requests/:id', route('vendor', async (req, res, u) => {
    const d = await getPRDetail(u, req.params.id);
    res.send(layout({ user: u, title: d.pr.pr_number, active: 'requests', flash: flashOf(req), body: vendorDetailPage(d) }));
  }));

  app.post('/requests/:id/quote', form, route('vendor', async (req, res, u) => {
    const b = req.body;
    await submitQuote(u, req.params.id, {
      deliveryDays: b.delivery_days === '' ? NaN : Number(b.delivery_days),
      validityDays: optNum(b.validity_days), notes: b.notes, prices: pricesFrom(b),
    });
    go(res, '/requests', { n: 'Your quote was saved. You can update it until the request closes.' });
  }, (req) => `/requests/${req.params.id}`));

  app.use((_req, res) => {
    res.status(404).send(layout({ user: null, title: 'Not found', body: '<div class="card empty"><h3>Page not found</h3><a class="btn" href="/">Home</a></div>' }));
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).send(layout({ user: null, title: 'Error', body: '<div class="card empty"><h3>Something went wrong</h3><p>Please try again.</p><a class="btn" href="/">Home</a></div>' }));
  });
}
