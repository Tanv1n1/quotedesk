// Run against a fresh database (the seeded one): node scripts/e2e.mjs http://localhost:3100
// End-to-end check of both roles against a running server. Usage: node scripts/e2e.mjs http://localhost:3100
const base = process.argv[2] ?? 'http://localhost:3100';
let pass = 0, failN = 0;
const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FAIL:', m); } };

class Sess {
  cookie = '';
  async req(path, opts = {}) {
    const r = await fetch(base + path, { redirect: 'manual', ...opts, headers: { cookie: this.cookie, ...(opts.headers ?? {}) } });
    const sc = r.headers.getSetCookie?.() ?? [];
    for (const c of sc) { const kv = c.split(';')[0]; if (kv.endsWith('=')) this.cookie = ''; else this.cookie = kv; }
    return { status: r.status, loc: r.headers.get('location'), text: await r.text() };
  }
  get(p) { return this.req(p); }
  post(p, body = {}) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) (Array.isArray(v) ? v : [v]).forEach((x) => sp.append(k, x));
    return this.req(p, { method: 'POST', body: sp, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  }
}
const day = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const NEEDED = day(20), DEADLINE = day(5);
const flash = (loc) => decodeURIComponent((loc ?? '').match(/[?&][en]=([^&#]*)/)?.[1] ?? '');

const anon = new Sess();
let r = await anon.get('/');
ok(r.status === 200 && r.text.includes('Enter as Procurement Manager') && r.text.includes('Enter as Vendor'), 'landing page has both demo buttons');
r = await anon.get('/prs'); ok(r.status === 303 && r.loc === '/', 'anonymous /prs redirects to landing');
r = await anon.get('/healthz'); ok(r.status === 200, 'healthz');

const mgr = new Sess(), ven = new Sess();
r = await mgr.post('/demo/manager'); ok(r.status === 303 && r.loc === '/prs', 'manager demo login');
r = await ven.post('/demo/vendor'); ok(r.status === 303 && r.loc === '/requests', 'vendor demo login');

r = await mgr.get('/prs'); ok(r.text.includes('PR-0001') && r.text.includes('Ergonomic office chairs'), 'manager sees seeded PR');
ok(r.text.includes('class="track"') && r.text.includes('PO pending') && r.text.includes('under budget') && r.text.includes('Won at'), 'list shows stage tracker and flags for the awarded PR');
ok(r.text.includes('data-theme') && r.text.includes('id="theme"'), 'dark mode toggle present');
r = await mgr.get('/prs?stage=draft'); ok(r.text.includes('Nothing at this stage') && !r.text.includes('Ergonomic office chairs'), 'stage filter works');
r = await mgr.get('/prs/1');
ok(r.text.includes('Bharat Business Supplies') && r.text.includes('Winner') && r.text.includes('Create PO') && r.text.includes('disabled'), 'seeded PR shows winner and disabled Create PO');
r = await mgr.get('/connect'); ok(/\/mcp\/[A-Za-z0-9_-]+/.test(r.text), 'connect page shows MCP link to manager');
r = await ven.get('/connect'); ok(r.status === 303 && r.loc === '/requests', 'vendor cannot open manager connect page');
r = await ven.get('/prs'); ok(r.status === 303 && r.loc === '/requests', 'vendor cannot open manager PR list');
r = await ven.get('/prs/1'); ok(r.status === 303, 'vendor cannot open manager PR detail');

// create (empty items must fail with a message)
r = await mgr.post('/prs', { title: 'No items', item_name: [''], item_spec: [''], item_qty: [''], item_unit: [''] });
ok(r.status === 303 && r.loc.startsWith('/prs/new') && flash(r.loc).includes('at least one item'), 'empty PR rejected: ' + flash(r.loc));

// required details: city, needed-by date and unit of measure
r = await mgr.post('/prs', { title: 'Missing bits', item_name: ['Mystery widget'], item_spec: [''], item_qty: ['5'], item_unit: [''], item_category: [''] });
ok(flash(r.loc).includes('delivery city') && flash(r.loc).includes('needed-by date') && flash(r.loc).includes('unit of measure'), 'missing city, date and unit rejected: ' + flash(r.loc));
r = await mgr.post('/prs', { title: 'Old date', delivery_city: 'Pune', needed_by: '2020-01-01', item_name: ['Laptop bag'], item_qty: ['1'], item_unit: ['Nos'], item_category: [''], item_spec: [''] });
ok(flash(r.loc).includes('cannot be in the past'), 'past needed-by date rejected');
r = await mgr.post('/prs', { title: 'Bad unit', delivery_city: 'Pune', needed_by: NEEDED, item_name: ['Laptop bag'], item_qty: ['1'], item_unit: ['bucketful'], item_category: [''], item_spec: [''] });
ok(flash(r.loc).includes('must be one of'), 'unknown unit rejected');

r = await mgr.post('/prs', {
  title: 'Laptops for new joiners', department: 'Engineering', delivery_city: 'Pune', needed_by: NEEDED, budget_inr: '2800000',
  justification: 'Batch of 40 joiners', item_name: ['Laptop 14 inch', 'Laptop bag'], item_spec: ['16 GB RAM, 512 GB SSD', ''], item_qty: ['40', '40'], item_unit: ['', ''], item_category: ['', ''],
});
ok(r.status === 303 && /^\/prs\/\d+/.test(r.loc), 'PR created: ' + r.loc);
const id = r.loc.match(/^\/prs\/(\d+)/)[1];
r = await mgr.get(`/prs/${id}`); ok(r.text.includes('Draft') && r.text.includes('Laptop bag') && r.text.includes('Open for quotes'), 'draft detail');
ok(r.text.includes('IT hardware') && r.text.includes('<td>Nos</td>'), 'unit and category filled from the catalogue');
r = await mgr.get('/prs'); ok(r.text.includes('Next: open for quotes'), 'draft flag on list');

r = await ven.get(`/requests/${id}`); ok(r.status === 404, 'vendor cannot see a draft PR');
r = await ven.get('/requests'); ok(!r.text.includes('Laptops for new joiners'), 'draft not in vendor list');

r = await mgr.post(`/prs/${id}/edit`, { title: 'Laptops and bags for new joiners', department: 'Engineering', delivery_city: 'Pune', needed_by: NEEDED, budget_inr: '3000000', justification: 'Batch of 40 joiners', item_name: ['Laptop 14 inch', 'Laptop bag'], item_spec: ['16 GB RAM, 512 GB SSD', ''], item_qty: ['40', '40'], item_unit: ['Nos', 'Nos'], item_category: ['IT hardware', 'IT hardware'] });
ok(r.status === 303 && flash(r.loc) === 'Changes saved.', 'draft edited');

r = await mgr.post(`/prs/${id}/open`, { quote_deadline: '2020-01-01' });
ok(flash(r.loc).includes('past'), 'past deadline rejected: ' + flash(r.loc));
r = await mgr.post(`/prs/${id}/open`, { quote_deadline: '' }); ok(flash(r.loc).includes('quote deadline'), 'deadline required to open: ' + flash(r.loc));
r = await mgr.post(`/prs/${id}/open`, { quote_deadline: day(25) }); ok(flash(r.loc).includes('on or before the needed-by date'), 'deadline after needed-by rejected');
r = await mgr.post(`/prs/${id}/open`, { quote_deadline: DEADLINE }); ok(flash(r.loc).includes('open for quotes'), 'opened');
r = await mgr.get('/prs'); ok(r.text.includes('0 of 3 quoted') && r.text.includes('Quotes close in 5 days'), 'open flags on list');
r = await mgr.post(`/prs/${id}/open`, {}); ok(flash(r.loc).includes('already open'), 'cannot open twice');
r = await mgr.post(`/prs/${id}/edit`, { title: 'hacked', quote_deadline: '2099-01-01', justification: 'ok' });
ok(flash(r.loc).includes('on or before the needed-by date'), 'deadline rule also applies when editing');
r = await mgr.post(`/prs/${id}/edit`, { title: 'hacked', quote_deadline: day(6), justification: 'ok' });
ok(r.status === 303 && flash(r.loc) === 'Changes saved.', 'deadline/notes editable when open');
r = await mgr.get(`/prs/${id}`); ok(r.text.includes('Laptops and bags for new joiners') && !r.text.includes('hacked'), 'title not changed once open');

// vendor
r = await ven.get('/requests'); ok(r.text.includes('Laptops and bags') && r.text.includes('Quote needed'), 'vendor sees open PR');
r = await ven.get(`/requests/${id}`); ok(r.status === 200 && !r.text.includes('30,00,000') && !r.text.includes('Budget'), 'vendor detail hides budget');
const items = [...(await mgr.get(`/prs/${id}`)).text.matchAll(/name="price_(\d+)"/g)].map((m) => m[1]);
ok(items.length === 2, 'two price inputs on manager form');
r = await ven.post(`/requests/${id}/quote`, { delivery_days: '10', [`price_${items[0]}`]: '65000' });
ok(r.status === 303 && flash(r.loc).includes('unit price'), 'missing price rejected: ' + flash(r.loc));
r = await ven.post(`/requests/${id}/quote`, { delivery_days: '10', validity_days: '30', notes: 'Free setup', [`price_${items[0]}`]: '65000', [`price_${items[1]}`]: '800' });
ok(r.status === 303 && flash(r.loc).includes('saved'), 'vendor quote saved');
r = await ven.post(`/requests/${id}/quote`, { delivery_days: '9', validity_days: '30', notes: 'Updated', [`price_${items[0]}`]: '64000', [`price_${items[1]}`]: '800' });
ok(flash(r.loc).includes('saved'), 'vendor resubmit');
r = await ven.get('/requests'); ok(r.text.includes('Quoted ₹25,92,000'), 'resubmit replaced quote (total 25,92,000): ' + (r.text.match(/Quoted[^<]*/)?.[0]));

// manager on behalf
r = await mgr.get(`/prs/${id}`); ok(r.text.includes('Still to quote') && r.text.includes('Bharat Business Supplies'), 'pending vendors listed');
r = await mgr.post(`/prs/${id}/quote`, { vendor_id: '2', delivery_days: '14', validity_days: '20', notes: 'By phone', [`price_${items[0]}`]: '62000', [`price_${items[1]}`]: '900' });
ok(flash(r.loc).includes('Bharat Business Supplies'), 'on-behalf quote saved: ' + flash(r.loc));
r = await mgr.post(`/prs/${id}/quote`, { delivery_days: '14', [`price_${items[0]}`]: '1', [`price_${items[1]}`]: '1' });
ok(flash(r.loc).includes('Choose the vendor'), 'on-behalf needs vendor');
r = await mgr.post(`/prs/${id}/quote`, { vendor_id: '3', delivery_days: '5', [`price_${items[0]}`]: '99999999', [`price_${items[1]}`]: '1' });
ok(flash(r.loc).includes('Deccan'), 'third quote');
r = await mgr.get('/prs'); ok(r.text.includes('3 of 3 quoted') && r.text.includes('Ready to award') && r.text.includes('Lowest quote within budget'), 'ready-to-award flags on list');
r = await mgr.get(`/prs/${id}`);
ok(r.text.includes('Lowest total') && r.text.includes('Fastest') && r.text.includes('Over budget') && r.text.includes('Manager, on behalf of vendor'), 'comparison shows flags');
ok(r.text.includes('Mark as winner'), 'award buttons visible while open');

// award
const qid = r.text.match(/name="quote_id" value="(\d+)"/)[1];
r = await ven.post(`/prs/${id}/award`, { quote_id: qid }); ok(r.status === 303 && r.loc === '/requests', 'vendor cannot award');
r = await mgr.post(`/prs/${id}/award`, { quote_id: qid }); ok(flash(r.loc).includes('winner'), 'award: ' + flash(r.loc));
r = await mgr.post(`/prs/${id}/award`, { quote_id: qid }); ok(flash(r.loc).includes('already been awarded'), 'cannot award twice');
r = await mgr.post(`/prs/${id}/quote`, { vendor_id: '2', delivery_days: '1', [`price_${items[0]}`]: '1', [`price_${items[1]}`]: '1' });
ok(flash(r.loc).includes('already been awarded'), 'no quotes after award');
r = await mgr.get(`/prs/${id}`); ok(r.text.includes('Winner') && r.text.includes('Create PO'), 'awarded detail shows winner and Create PO');
r = await mgr.get(`/prs/${id}/edit`); ok(r.status === 409, 'awarded PR cannot be edited');
r = await ven.get(`/requests/${id}`); ok(r.text.includes('Your quote won') || r.text.includes('awarded to another vendor'), 'vendor sees outcome');
ok(!r.text.includes('62,000') && !r.text.includes('Bharat'), 'vendor never sees competitors');

// vendors and products sections
r = await mgr.get('/vendors'); ok(r.status === 200 && r.text.includes('Sahyadri IT Distributors') && r.text.includes('IT hardware') && r.text.includes('Add vendor'), 'vendors page');
r = await ven.get('/vendors'); ok(r.status === 303 && r.loc === '/requests', 'vendor role cannot open vendors section');
r = await ven.get('/products'); ok(r.status === 303 && r.loc === '/requests', 'vendor role cannot open products section');
r = await ven.post('/products', { name: 'x', category: 'Other', uom: 'Nos' }); ok(r.status === 303 && r.loc === '/requests', 'vendor role cannot add products');
r = await mgr.post('/vendors', { name: 'Konkan Electricals', city: 'Pune' }); ok(flash(r.loc).includes('category'), 'vendor category required: ' + flash(r.loc));
r = await mgr.post('/vendors', { name: 'Konkan Electricals', city: 'Pune', category: 'Electrical', contact_name: 'Rohan Naik', email: 'not-an-email' }); ok(flash(r.loc).includes('valid email'), 'vendor email validated');
r = await mgr.post('/vendors', { name: 'Konkan Electricals', city: 'Pune', category: 'Electrical', contact_name: 'Rohan Naik', email: 'sales@konkan-electricals.example' }); ok(flash(r.loc).includes('added'), 'vendor added');
r = await mgr.post('/vendors', { name: 'Konkan Electricals', city: 'Pune', category: 'Electrical' }); ok(flash(r.loc).includes('already exists'), 'duplicate vendor rejected');
r = await mgr.get('/vendors'); const vid = r.text.match(/Konkan Electricals[\s\S]*?\/vendors\/(\d+)\/edit/)[1];
r = await mgr.post(`/vendors/${vid}`, { name: 'Konkan Electricals', city: 'Nashik', category: 'Electrical' }); ok(flash(r.loc).includes('saved'), 'vendor edited');
r = await mgr.get('/vendors'); ok(r.text.includes('Nashik'), 'vendor edit shows on list');
r = await mgr.get('/products'); ok(r.status === 200 && r.text.includes('Laptop 14 inch') && r.text.includes('Ream') && r.text.includes('1 request'), 'products page with usage');
r = await mgr.post('/products', { name: 'Printer toner', category: 'Office supplies' }); ok(flash(r.loc).includes('unit of measure'), 'product unit required: ' + flash(r.loc));
r = await mgr.post('/products', { name: 'Printer toner', category: 'Office supplies', uom: 'Nos', spec: 'Black' }); ok(flash(r.loc).includes('added'), 'product added');
r = await mgr.post('/products', { name: 'printer toner', category: 'Office supplies', uom: 'Box' }); ok(flash(r.loc).includes('already exists'), 'duplicate product rejected, ignoring case');
r = await mgr.get('/prs/new'); ok(r.text.includes('Printer toner') && r.text.includes('QD_CAT'), 'new product offered on the request form');
r = await mgr.get('/products'); const pid = r.text.match(/Printer toner[\s\S]*?\/products\/(\d+)\/edit/)[1];
r = await mgr.post(`/products/${pid}`, { name: 'Printer toner', category: 'Office supplies', uom: 'Box', spec: 'Black' }); ok(flash(r.loc).includes('saved'), 'product edited');
r = await mgr.get('/products/99999/edit'); ok(r.status === 404, 'unknown product is 404');

r = await mgr.post('/logout'); ok(r.status === 303, 'logout');
r = await mgr.get('/prs'); ok(r.status === 303 && r.loc === '/', 'logged out');
const bad = new Sess(); bad.cookie = 'qd_session=1.forged'; r = await bad.get('/prs'); ok(r.status === 303 && r.loc === '/', 'forged cookie rejected');
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
