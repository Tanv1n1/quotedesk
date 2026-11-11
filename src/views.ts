import { CATEGORIES, UOMS, todayIST } from './domain.js';
import type { Actor, ItemRow, PRDetail, PRListRow, PRRow, ProductRow, QuoteView, VendorRow } from './domain.js';

export const esc = (v: unknown): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const inr = (n: number | null | undefined): string =>
  n == null ? '' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

export function fdate(d: string | null | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const CSS = `
:root{--bg:#f6f7fb;--card:#fff;--head:#fbfbfd;--ink:#1b1f2a;--muted:#667085;--line:#e4e7ec;--field:#fff;--field-line:#d0d5dd;
--accent:#4338ca;--accent-soft:#eef0ff;--note-ink:#312e81;--btn:#4338ca;--btn-hover:#3730a3;--chip-ink:#475467;
--green:#067647;--green-soft:#ecfdf3;--green-line:#abefc6;--amber:#b54708;--amber-soft:#fffaeb;--blue:#175cd3;--blue-soft:#eff8ff;
--red:#b42318;--red-soft:#fef3f2;--red-line:#fecdca;--grey-soft:#f2f4f7}
[data-theme=dark]{color-scheme:dark;--bg:#0e1117;--card:#161b24;--head:#1a202b;--ink:#e7eaf0;--muted:#98a2b3;--line:#2a313e;--field:#0f141c;--field-line:#394252;
--accent:#a5b4fc;--accent-soft:#23284d;--note-ink:#c7d2fe;--btn:#5b5bd6;--btn-hover:#6e6ee6;--chip-ink:#c3cad6;
--green:#4ade80;--green-soft:#11291d;--green-line:#1f5136;--amber:#fbbf24;--amber-soft:#2d230f;--blue:#7cb7ff;--blue-soft:#11243c;
--red:#f97066;--red-soft:#33171a;--red-line:#5c2428;--grey-soft:#222935}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header.top{background:var(--card);border-bottom:1px solid var(--line)}
.bar{max-width:1120px;margin:0 auto;padding:0 20px;display:flex;align-items:center;gap:20px;height:60px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;color:var(--ink)}
.brand:hover{text-decoration:none}
.mark{width:28px;height:28px;border-radius:8px;background:var(--btn);color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px}
nav.main{display:flex;gap:4px;flex:1;flex-wrap:wrap}
nav.main a{padding:7px 12px;border-radius:8px;color:var(--muted);font-weight:500;white-space:nowrap}
nav.main a:hover{background:var(--grey-soft);text-decoration:none}
nav.main a.on{background:var(--accent-soft);color:var(--accent)}
.who{display:flex;align-items:center;gap:10px;font-size:14px}
.who small{display:block;color:var(--muted);font-size:12px;line-height:1.2}
.who form{margin:0}
main{max-width:1120px;margin:0 auto;padding:28px 20px 60px}
h1{font-size:24px;margin:0 0 4px;letter-spacing:-.01em}h2{font-size:17px;margin:0 0 12px}h3{font-size:15px;margin:0 0 8px}
.sub{color:var(--muted);margin:0 0 20px}
.row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:18px}
.card.flush{padding:0;overflow:hidden}
.card h2:first-child{margin-top:0}
table{width:100%;border-collapse:collapse}
th,td{padding:12px 16px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600;background:var(--head)}
tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.chip{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12.5px;font-weight:600;white-space:nowrap}
.chip.draft{background:var(--grey-soft);color:var(--chip-ink)}.chip.open{background:var(--blue-soft);color:var(--blue)}
.chip.awarded,.chip.won,.chip.good{background:var(--green-soft);color:var(--green)}
.chip.warn{background:var(--amber-soft);color:var(--amber)}.chip.bad,.chip.lost{background:var(--red-soft);color:var(--red)}
.chip.plain{background:var(--grey-soft);color:var(--chip-ink)}.chip.claude{background:var(--accent-soft);color:var(--accent)}
.btn{display:inline-block;padding:9px 16px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
.btn:hover{background:var(--grey-soft);text-decoration:none}
.btn.primary{background:var(--btn);border-color:var(--btn);color:#fff}.btn.primary:hover{background:var(--btn-hover)}
.btn.small{padding:6px 12px;font-size:14px}
.btn[disabled]{opacity:.5;cursor:not-allowed}
.btn.lg{padding:13px 22px;font-size:16px}
label{display:block;font-weight:600;font-size:14px;margin-bottom:5px}
.req{color:var(--red);font-weight:700}
input,select,textarea{width:100%;padding:9px 11px;border:1px solid var(--field-line);border-radius:9px;font:inherit;background:var(--field);color:var(--ink)}
input:focus,select:focus,textarea:focus{outline:2px solid var(--accent-soft);border-color:var(--accent)}
input:disabled,select:disabled{opacity:.6}
textarea{min-height:72px;resize:vertical}
.hint{color:var(--muted);font-size:13px;margin-top:4px}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.grid.two{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.meta{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.meta dt{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600}
.meta dd{margin:2px 0 0;font-weight:600}
.banner{padding:12px 16px;border-radius:10px;margin-bottom:18px;font-weight:500}
.banner.error{background:var(--red-soft);color:var(--red);border:1px solid var(--red-line)}
.banner.notice{background:var(--green-soft);color:var(--green);border:1px solid var(--green-line)}
.note{background:var(--accent-soft);border-radius:10px;padding:12px 16px;color:var(--note-ink);font-size:14px}
.empty{text-align:center;padding:48px 20px;color:var(--muted)}
.empty h3{color:var(--ink)}
.muted{color:var(--muted)}.small{font-size:13px}.right{text-align:right}.nowrap{white-space:nowrap}
.winner-col{background:var(--green-soft)}
.cmp th.vendor{min-width:190px;text-transform:none;letter-spacing:0;font-size:14px;color:var(--ink)}
.cmp td{font-variant-numeric:tabular-nums}
.cmp .total td{font-weight:700;font-size:16px}
.tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
details.award summary{list-style:none;display:inline-block}details.award summary::-webkit-details-marker{display:none}
details.award[open] summary{display:none}
.hero{padding:44px 0 28px;text-align:center}.hero h1{font-size:34px;max-width:700px;margin:0 auto 12px}
.hero p{max-width:600px;margin:0 auto;color:var(--muted);font-size:17px}
.steps{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));margin:8px 0 26px}
.step{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.step b{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--accent-soft);color:var(--accent);margin-bottom:8px}
.cta{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));max-width:760px;margin:0 auto}
.cta .card{margin:0;display:flex;flex-direction:column}.cta .card p{flex:1}.cta .btn{width:100%}
.item-row{display:grid;grid-template-columns:2fr 1.3fr 2fr 84px 104px 36px;gap:10px;margin-bottom:10px;align-items:start}
.item-head{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600;margin-bottom:6px}
.item-row .x{padding:8px 0;color:var(--muted);background:none;border:0;font-size:20px;cursor:pointer}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
.urlbox{display:flex;gap:8px}.urlbox input{font-family:ui-monospace,Menlo,monospace;font-size:13px}
ol.steps-list{padding-left:20px;margin:0}ol.steps-list li{margin-bottom:8px}
.stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:18px}
.stat{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;color:var(--ink)}
.stat:hover{text-decoration:none;border-color:var(--accent)}
.stat b{display:block;font-size:24px;line-height:1.1}.stat span{color:var(--muted);font-size:13px;font-weight:600}
.stat.on{border-color:var(--btn);box-shadow:inset 0 0 0 1px var(--btn)}
.track{display:inline-flex;font-size:12px;font-weight:600;white-space:nowrap}
.track span{padding:3px 10px;border:1px solid var(--line);color:var(--muted);background:var(--card);margin-left:-1px}
.track span:first-child{border-radius:999px 0 0 999px;margin-left:0}.track span:last-child{border-radius:0 999px 999px 0;border-style:dashed}
.track .done{background:var(--green-soft);color:var(--green)}
.track .now{background:var(--btn);border-color:var(--btn);color:#fff}
@media(max-width:820px){.bar{height:auto;flex-wrap:wrap;padding:10px 20px;gap:8px}nav.main{order:3;width:100%}
.item-row{grid-template-columns:1fr 1fr}.item-head{display:none}.item-row .x{grid-column:2}th,td{padding:10px 12px}.card.flush{overflow-x:auto}}
`;

export interface Page {
  user: Actor | null;
  title: string;
  body: string;
  active?: string;
  flash?: { error?: string; notice?: string };
}

export function layout(p: Page): string {
  const u = p.user;
  const nav = u
    ? u.role === 'manager'
      ? [['/prs', 'Purchase requests', 'prs'], ['/vendors', 'Vendors', 'vendors'], ['/products', 'Products', 'products'], ['/connect', 'Connect to Claude', 'connect'], ['/about', 'About', 'about']]
      : [['/requests', 'Open requests', 'requests'], ['/about', 'About', 'about']]
    : [['/about', 'About', 'about']];
  const links = nav.map(([h, t, k]) => `<a href="${h}" class="${p.active === k ? 'on' : ''}">${t}</a>`).join('');
  const who = u
    ? `<div class="who"><div><strong>${esc(u.name)}</strong><small>${u.role === 'manager' ? 'Procurement Manager' : 'Vendor'}</small></div>
       <form method="post" action="/logout"><button class="btn small">Exit</button></form></div>`
    : '';
  const flash = p.flash?.error
    ? `<div class="banner error" role="alert">${esc(p.flash.error)}</div>`
    : p.flash?.notice
      ? `<div class="banner notice" role="status">${esc(p.flash.notice)}</div>`
      : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)} | QuoteDesk</title><style>${CSS}</style>
<script>(function(){var t;try{t=localStorage.getItem('qd_theme')}catch(e){}document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')})();
function qdTheme(){var d=document.documentElement,n=d.getAttribute('data-theme')==='dark'?'light':'dark';d.setAttribute('data-theme',n);try{localStorage.setItem('qd_theme',n)}catch(e){}qdLabel()}
function qdLabel(){var b=document.getElementById('theme');if(b)b.textContent=document.documentElement.getAttribute('data-theme')==='dark'?'Light mode':'Dark mode'}</script></head><body>
<header class="top"><div class="bar"><a class="brand" href="/"><span class="mark">Q</span>QuoteDesk</a><nav class="main">${links}</nav>
<button class="btn small" id="theme" type="button" onclick="qdTheme()">Light mode</button>${who}</div></header><script>qdLabel()</script>
<main>${flash}${p.body}</main></body></html>`;
}

// ---------- shared bits ----------

export const statusChip = (s: string): string =>
  `<span class="chip ${esc(s)}">${s === 'open' ? 'Open for quotes' : s === 'awarded' ? 'Awarded' : 'Draft'}</span>`;

const sourceChip = (via: string): string =>
  via === 'claude' ? '<span class="chip claude">Created from Claude</span>' : '';

const chip = (kind: string, label: string): string => `<span class="chip ${kind}">${esc(label)}</span>`;
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
const req = '<span class="req" title="Required">*</span>';

// Whole days from today (IST) to a YYYY-MM-DD date. Negative when the date has passed.
function daysUntil(d: string): number {
  return Math.round((Date.parse(d) - Date.parse(todayIST())) / 86_400_000);
}

// Stage tracker: Draft, Quotes, Awarded, PO. The PO stage is shown as the next step and is not built.
export function stageTrack(status: string): string {
  const at = status === 'draft' ? 0 : status === 'open' ? 1 : 2;
  return `<div class="track" title="Stage">${['Draft', 'Quotes', 'Awarded', 'PO']
    .map((s, i) => `<span class="${i < at ? 'done' : i === at ? 'now' : ''}"${i === 3 ? ' title="Purchase order: not built in this prototype"' : ''}>${s}</span>`)
    .join('')}</div>`;
}

const options = (list: readonly string[], selected: string | null | undefined, blank?: string): string =>
  `${blank !== undefined ? `<option value="">${esc(blank)}</option>` : ''}${list
    .map((x) => `<option${selected && x.toLowerCase() === selected.toLowerCase() ? ' selected' : ''}>${esc(x)}</option>`)
    .join('')}`;

// ---------- landing ----------

export function landingPage(): string {
  return `<section class="hero"><h1>From a request in Claude to a winning vendor.</h1>
<p>Tell Claude what you need. QuoteDesk keeps the purchase request, collects vendor quotes and records who wins. Claude does the thinking, so the app has no AI inside.</p></section>
<div class="steps">
<div class="step"><b>1</b><h3>Ask in Claude</h3><span class="muted small">"I need 40 laptops for Pune by 30 Nov." A purchase request appears here.</span></div>
<div class="step"><b>2</b><h3>Review and edit</h3><span class="muted small">The manager checks the request in the app and opens it for quotes.</span></div>
<div class="step"><b>3</b><h3>Vendors quote</h3><span class="muted small">Vendors log in and quote, or the manager enters a quote on their behalf.</span></div>
<div class="step"><b>4</b><h3>Compare and award</h3><span class="muted small">Claude compares the quotes. The manager names the winner.</span></div></div>
<div class="cta">
<form class="card" method="post" action="/demo/manager"><h2>Procurement Manager</h2><p class="muted">Create and edit purchase requests, review quotes, mark the winner. Claude connects as this user.</p><button class="btn primary lg">Enter as Procurement Manager</button></form>
<form class="card" method="post" action="/demo/vendor"><h2>Vendor</h2><p class="muted">See requests open for quotes and submit a price, delivery time and notes.</p><button class="btn primary lg">Enter as Vendor</button></form></div>
<p class="muted small" style="text-align:center;margin-top:22px">Prototype with demo data. Sign-in is a one-click demo login, so there are no passwords to share. <a href="/about">What is real and what is simulated</a></p>`;
}

// ---------- manager: list and form ----------

// Flags tell the manager where each request stands and what needs attention, without opening it.
function stageFlags(r: PRListRow, vendorCount: number): string {
  const f: string[] = [];
  if (r.created_via === 'claude') f.push(sourceChip(r.created_via));
  if (r.status === 'draft') {
    f.push(!r.delivery_city || !r.needed_by ? chip('warn', 'Details missing') : chip('plain', 'Next: open for quotes'));
  }
  if (r.status === 'open') {
    f.push(chip('open', `${r.quote_count} of ${vendorCount} quoted`));
    const left = r.quote_deadline ? daysUntil(r.quote_deadline) : null;
    if (left !== null) {
      f.push(left < 0 ? chip('bad', 'Quote deadline passed') : left === 0 ? chip('warn', 'Quotes close today') : chip('plain', `Quotes close in ${plural(left, 'day')}`));
    }
    if (r.quote_count > 0 && (r.quote_count >= vendorCount || (left !== null && left < 0))) f.push(chip('good', 'Ready to award'));
    if (r.lowest_total != null && r.budget_inr != null) {
      f.push(r.lowest_total <= r.budget_inr ? chip('good', 'Lowest quote within budget') : chip('warn', 'Lowest quote over budget'));
    }
  }
  if (r.status === 'awarded') {
    if (r.winner_total != null && r.budget_inr != null) {
      const diff = r.budget_inr - r.winner_total;
      f.push(diff >= 0 ? chip('good', `${inr(diff)} under budget`) : chip('warn', `${inr(-diff)} over budget`));
    }
    f.push(chip('plain', 'PO pending'));
  }
  if (r.status !== 'awarded' && r.needed_by) {
    const d = daysUntil(r.needed_by);
    if (d < 0) f.push(chip('bad', 'Needed-by date passed'));
    else if (d <= 7) f.push(chip('warn', d === 0 ? 'Needed today' : `Needed in ${plural(d, 'day')}`));
  }
  return f.join('');
}

export function prListPage(all: PRListRow[], stage: string | undefined, vendorCount: number): string {
  const count = (s: string) => all.filter((r) => r.status === s).length;
  const rows = stage ? all.filter((r) => r.status === stage) : all;
  const stat = (key: string | undefined, n: number, label: string) =>
    `<a class="stat ${stage === key ? 'on' : ''}" href="/prs${key ? `?stage=${key}` : ''}"><b>${n}</b><span>${label}</span></a>`;
  const stats = `<div class="stats">${stat(undefined, all.length, 'All requests')}${stat('draft', count('draft'), 'Draft')}${stat('open', count('open'), 'Open for quotes')}${stat('awarded', count('awarded'), 'Awarded')}</div>`;
  const quotesCell = (r: PRListRow): string =>
    r.status === 'awarded' && r.winner_name
      ? `<strong>${esc(r.winner_name)}</strong><div class="muted small">Won at ${inr(r.winner_total)}</div>`
      : r.status === 'draft'
        ? '<span class="muted">Not open yet</span>'
        : `${plural(r.quote_count, 'quote')}${r.lowest_total != null ? `<div class="muted small">Lowest ${inr(r.lowest_total)}</div>` : ''}`;
  const body = rows.length
    ? `<div class="card flush"><table><thead><tr><th>Request</th><th>Stage</th><th>Items</th><th class="num">Budget</th><th>Quotes</th><th>Dates</th></tr></thead><tbody>${rows
        .map(
          (r) => `<tr><td><a href="/prs/${r.id}"><strong>${esc(r.pr_number)}</strong> ${esc(r.title)}</a>
            <div class="tags">${stageFlags(r, vendorCount)}</div></td>
            <td>${stageTrack(r.status)}</td>
            <td class="nowrap">${plural(r.item_count, 'line')}<div class="muted small">${r.total_units} units</div></td>
            <td class="num">${inr(r.budget_inr) || '<span class="muted">Not set</span>'}</td>
            <td>${quotesCell(r)}</td>
            <td class="nowrap">${r.needed_by ? `Needed ${fdate(r.needed_by)}` : '<span class="muted">Needed-by not set</span>'}${r.quote_deadline ? `<div class="muted small">Quotes by ${fdate(r.quote_deadline)}</div>` : ''}</td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : all.length
      ? `<div class="card empty"><h3>Nothing at this stage</h3><p>No purchase request is at this stage right now.</p><a class="btn" href="/prs">Show all</a></div>`
      : `<div class="card empty"><h3>No purchase requests yet</h3><p>Ask Claude for something you need, or create one here.</p><a class="btn primary" href="/prs/new">New purchase request</a></div>`;
  return `<div class="row"><div><h1>Purchase requests</h1><p class="sub" style="margin:0">Everything raised from Claude or from this screen, with its stage and what needs attention.</p></div><a class="btn primary" href="/prs/new">New purchase request</a></div>${stats}${body}`;
}

function itemRow(i?: Partial<ItemRow>): string {
  return `<div class="item-row">
<div><input name="item_name" list="catalogue" placeholder="Item, e.g. Laptop 14 inch" value="${esc(i?.name)}" onchange="fillRow(this)" required></div>
<div><select name="item_category" aria-label="Category">${options(CATEGORIES, i?.category, 'Category')}</select></div>
<div><input name="item_spec" placeholder="Specification (optional)" value="${esc(i?.spec)}"></div>
<div><input name="item_qty" type="number" min="1" step="1" placeholder="Qty" value="${esc(i?.quantity)}" required></div>
<div><select name="item_unit" aria-label="Unit of measure" required>${options(UOMS, i?.unit ?? 'Nos')}</select></div>
<button type="button" class="x" title="Remove" onclick="rmRow(this)">×</button></div>`;
}

export function prFormPage(pr: PRRow | null, items: ItemRow[], products: ProductRow[]): string {
  const open = pr?.status === 'open';
  const action = pr ? `/prs/${pr.id}/edit` : '/prs';
  const v = (x: unknown) => esc(x);
  const lock = open ? 'disabled' : '';
  const catalogue = Object.fromEntries(products.map((p) => [p.name.toLowerCase(), { c: p.category, u: p.uom, s: p.spec ?? '' }]));
  const itemsHtml = open
    ? `<p class="muted">Items are locked while the request is open for quotes, so every quote matches what was asked.</p>`
    : `<div class="item-row item-head"><div>Item ${req}</div><div>Category</div><div>Specification</div><div>Qty ${req}</div><div>UoM ${req}</div><div></div></div>
       <div id="items">${(items.length ? items : [undefined]).map((i) => itemRow(i)).join('')}</div>
       <datalist id="catalogue">${products.map((p) => `<option value="${esc(p.name)}">${esc(p.category)}, ${esc(p.uom)}</option>`).join('')}</datalist>
       <button type="button" class="btn small" onclick="addRow()">Add item</button>
       <p class="hint">Pick an item from the <a href="/products">product catalogue</a> to fill its category, unit and specification, or type a new one.</p>`;
  return `<div class="row"><div><h1>${pr ? `Edit ${esc(pr.pr_number)}` : 'New purchase request'}</h1>
<p class="sub" style="margin:0">${open ? 'Open for quotes: only the quote deadline and notes can change.' : 'Saved as a draft. Nothing goes to vendors until you open it for quotes.'} Fields marked ${req} are required.</p></div></div>
<form method="post" action="${action}" class="card">
<div class="grid two"><div><label>Title ${req}</label><input name="title" value="${v(pr?.title)}" required maxlength="200" ${lock}></div>
<div><label>Department</label><input name="department" value="${v(pr?.department)}" ${lock}></div>
<div><label>Delivery city ${req}</label><input name="delivery_city" value="${v(pr?.delivery_city)}" required ${lock}></div>
<div><label>Needed by ${req}</label><input name="needed_by" type="date" value="${v(pr?.needed_by)}" required ${lock}></div>
<div><label>Budget (₹, total)</label><input name="budget_inr" type="number" min="0" step="1" value="${v(pr?.budget_inr)}" ${lock}>
<div class="hint">Only the manager sees this. Vendors never do.</div></div>
${open ? `<div><label>Quote deadline ${req}</label><input name="quote_deadline" type="date" value="${v(pr?.quote_deadline)}" required></div>` : ''}</div>
<div style="margin-top:14px"><label>Notes${open ? '' : ' / justification'}</label><textarea name="justification" maxlength="1000">${v(pr?.justification)}</textarea></div>
<h2 style="margin-top:22px">Items</h2>${itemsHtml}
<div style="margin-top:22px;display:flex;gap:10px"><button class="btn primary">${pr ? 'Save changes' : 'Create draft'}</button>
<a class="btn" href="${pr ? `/prs/${pr.id}` : '/prs'}">Cancel</a></div></form>
<script>
var QD_CAT=${JSON.stringify(catalogue).replace(/</g, '\\u003c')};
function fillRow(inp){var p=QD_CAT[inp.value.trim().toLowerCase()];if(!p)return;var r=inp.closest('.item-row');
r.querySelector('[name=item_category]').value=p.c;r.querySelector('[name=item_unit]').value=p.u;var s=r.querySelector('[name=item_spec]');if(!s.value&&p.s)s.value=p.s}
function addRow(){var d=document.createElement('div');d.innerHTML=${JSON.stringify(itemRow()).replace(/</g, '\\u003c')};document.getElementById('items').appendChild(d.firstElementChild)}
function rmRow(b){var r=b.closest('.item-row'),w=document.getElementById('items');if(w.children.length>1)r.remove()}
</script>`;
}

// ---------- manager: detail with comparison ----------

function quoteForm(opts: {
  action: string; items: ItemRow[]; vendors?: VendorRow[]; selectedVendor?: number; q?: QuoteView; manager: boolean; label: string;
}): string {
  const { items, q } = opts;
  const priceOf = (id: number) => q?.lines.find((l) => l.itemId === id)?.unitPriceInr;
  return `<form method="post" action="${opts.action}" id="quote-form" class="card">
${opts.manager
    ? `<div style="max-width:380px;margin-bottom:14px"><label>Vendor</label><select name="vendor_id" required>
       <option value="">Choose the vendor...</option>${(opts.vendors ?? [])
         .map((v) => `<option value="${v.id}" ${v.id === opts.selectedVendor ? 'selected' : ''}>${esc(v.name)}, ${esc(v.city)}${v.category ? ` (${esc(v.category)})` : ''}</option>`)
         .join('')}</select><div class="hint">Use this when a vendor sent a quote by phone, WhatsApp or email.</div></div>`
    : ''}
<div class="card flush" style="margin-bottom:14px"><table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num" style="width:190px">Unit price (₹)</th><th class="num">Line total</th></tr></thead><tbody>
${items
  .map(
    (i) => `<tr><td><strong>${esc(i.name)}</strong>${i.spec ? `<div class="muted small">${esc(i.spec)}</div>` : ''}</td>
<td class="num">${i.quantity} ${esc(i.unit)}</td>
<td class="num"><input name="price_${i.id}" data-qty="${i.quantity}" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(priceOf(i.id))}" required style="text-align:right"></td>
<td class="num" data-line="${i.id}">-</td></tr>`,
  )
  .join('')}
<tr><td colspan="3" class="right"><strong>Quote total</strong></td><td class="num"><strong id="grand">-</strong></td></tr></tbody></table></div>
<div class="grid"><div><label>Delivery time (days)</label><input name="delivery_days" type="number" min="0" max="365" step="1" value="${esc(q?.deliveryDays)}" required></div>
<div><label>Quote valid for (days)</label><input name="validity_days" type="number" min="0" max="365" step="1" value="${esc(q?.validityDays)}"></div></div>
<div style="margin-top:14px"><label>Notes</label><textarea name="notes" maxlength="1000" placeholder="Warranty, installation, payment terms...">${esc(q?.notes)}</textarea></div>
<div style="margin-top:16px"><button class="btn primary">${esc(opts.label)}</button></div></form>
<script>
(function(){var f=document.getElementById('quote-form');if(!f)return;var fmt=new Intl.NumberFormat('en-IN',{maximumFractionDigits:2});
function calc(){var t=0;f.querySelectorAll('input[data-qty]').forEach(function(i){var v=parseFloat(i.value),q=Number(i.dataset.qty),c=f.querySelector('[data-line="'+i.name.slice(6)+'"]');
if(isFinite(v)){t+=v*q;c.textContent='₹'+fmt.format(v*q)}else c.textContent='-'});document.getElementById('grand').textContent=t?'₹'+fmt.format(t):'-'}
f.addEventListener('input',calc);calc()})();
</script>`;
}

export function prDetailPage(d: PRDetail, vendors: VendorRow[], prefillVendor?: number): string {
  const { pr, items, quotes, pendingVendors } = d;
  const winner = quotes.find((q) => q.isWinner);
  const cols = quotes;
  const cmp = cols.length
    ? `<div class="card flush"><table class="cmp"><thead><tr><th>Item</th>${cols
        .map(
          (q) => `<th class="vendor ${q.isWinner ? 'winner-col' : ''}">${esc(q.vendorName)}<div class="muted small" style="font-weight:400">${esc(q.vendorCity)}${q.vendorCategory ? `, ${esc(q.vendorCategory)}` : ''}</div>
          <div class="tags">${q.isWinner ? '<span class="chip won">Winner</span>' : ''}${q.isLowest ? '<span class="chip good">Lowest total</span>' : ''}${q.isFastest ? '<span class="chip open">Fastest</span>' : ''}</div></th>`,
        )
        .join('')}</tr></thead><tbody>
${items
  .map(
    (i) => `<tr><td><strong>${esc(i.name)}</strong><div class="muted small">${i.quantity} ${esc(i.unit)}</div></td>${cols
      .map((q) => {
        const l = q.lines.find((x) => x.itemId === i.id);
        return `<td class="${q.isWinner ? 'winner-col' : ''}">${l ? `${inr(l.unitPriceInr)}<div class="muted small">${inr(l.lineTotalInr)} total</div>` : ''}</td>`;
      })
      .join('')}</tr>`,
  )
  .join('')}
<tr class="total"><td>Quote total</td>${cols.map((q) => `<td class="${q.isWinner ? 'winner-col' : ''}">${inr(q.totalInr)}</td>`).join('')}</tr>
<tr><td>Delivery</td>${cols.map((q) => `<td class="${q.isWinner ? 'winner-col' : ''}">${q.deliveryDays} days</td>`).join('')}</tr>
<tr><td>Valid for</td>${cols.map((q) => `<td class="${q.isWinner ? 'winner-col' : ''}">${q.validityDays != null ? `${q.validityDays} days` : '<span class="muted">Not stated</span>'}</td>`).join('')}</tr>
<tr><td>Budget</td>${cols.map((q) => `<td class="${q.isWinner ? 'winner-col' : ''}">${q.withinBudget == null ? '<span class="muted">No budget set</span>' : q.withinBudget ? '<span class="chip good">Within budget</span>' : '<span class="chip warn">Over budget</span>'}</td>`).join('')}</tr>
<tr><td>Notes</td>${cols.map((q) => `<td class="small ${q.isWinner ? 'winner-col' : ''}">${esc(q.notes) || '<span class="muted">None</span>'}</td>`).join('')}</tr>
<tr><td>Entered by</td>${cols.map((q) => `<td class="small ${q.isWinner ? 'winner-col' : ''}">${q.onBehalf ? 'Manager, on behalf of vendor' : 'Vendor'}<div class="muted">${q.updatedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</div></td>`).join('')}</tr>
${pr.status === 'open'
  ? `<tr><td></td>${cols
      .map(
        (q) => `<td><details class="award"><summary class="btn small">Mark as winner</summary>
        <form method="post" action="/prs/${pr.id}/award"><input type="hidden" name="quote_id" value="${q.id}">
        <p class="small muted" style="margin:0 0 8px">Award to ${esc(q.vendorName)} at ${inr(q.totalInr)}? This closes the request to new quotes.</p>
        <button class="btn primary small">Confirm award</button></form></details></td>`,
      )
      .join('')}</tr>`
  : ''}
</tbody></table></div>`
    : pr.status === 'open'
      ? `<div class="card empty"><h3>No quotes yet</h3><p>Vendors can log in and quote, or you can enter a quote below.</p></div>`
      : '';

  const pending = pr.status === 'open' && pendingVendors.length
    ? `<p class="muted small" style="margin:-6px 0 18px">Still to quote: ${pendingVendors
        .map((v) => `<a href="/prs/${pr.id}?vendor=${v.id}#add-quote">${esc(v.name)}</a>`)
        .join(', ')}</p>`
    : '';

  const actions =
    pr.status === 'draft'
      ? `<a class="btn" href="/prs/${pr.id}/edit">Edit</a>
         <form method="post" action="/prs/${pr.id}/open" style="display:flex;gap:8px;align-items:center;margin:0">
         <label for="qd" class="small muted" style="margin:0;font-weight:500">Quotes by ${req}</label>
         <input id="qd" type="date" name="quote_deadline" style="width:auto" title="Last date for vendors to quote" value="${esc(pr.quote_deadline)}" required>
         <button class="btn primary">Open for quotes</button></form>`
      : pr.status === 'open'
        ? `<a class="btn" href="/prs/${pr.id}/edit">Edit deadline and notes</a>`
        : '';

  const awarded = pr.status === 'awarded' && winner
    ? `<div class="card" style="border-color:var(--green-line)"><div class="row" style="margin:0"><div><span class="chip won">Awarded</span>
       <h2 style="margin:8px 0 2px">${esc(winner.vendorName)} won at ${inr(winner.totalInr)}</h2>
       <div class="muted">Delivery in ${winner.deliveryDays} days${winner.validityDays != null ? `, quote valid ${winner.validityDays} days` : ''}.</div></div>
       <div style="text-align:right"><button class="btn primary" disabled title="Not built in this prototype">Create PO</button>
       <div class="muted small" style="margin-top:6px;max-width:300px">Next step: hand the winner to procurement to raise a purchase order. Not built in this prototype.</div></div></div></div>`
    : '';

  const quoteSection = pr.status === 'open'
    ? `<h2 id="add-quote" style="margin-top:26px">Enter a quote on a vendor's behalf</h2>${quoteForm({
        action: `/prs/${pr.id}/quote`, items, vendors, manager: true, label: 'Save quote',
        selectedVendor: prefillVendor, q: quotes.find((x) => x.vendorId === prefillVendor),
      })}`
    : '';

  return `<p class="small" style="margin:0 0 10px"><a href="/prs">All purchase requests</a></p>
<div class="row"><div><h1>${esc(pr.pr_number)} ${esc(pr.title)}</h1><div class="tags" style="margin:8px 0 0;align-items:center">${stageTrack(pr.status)}${sourceChip(pr.created_via)}</div></div>
<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">${actions}</div></div>
<div class="card"><dl class="meta" style="margin:0">
<div><dt>Requested by</dt><dd>${esc(pr.requester_name)}</dd></div><div><dt>Department</dt><dd>${esc(pr.department) || '-'}</dd></div>
<div><dt>Delivery city</dt><dd>${esc(pr.delivery_city) || '-'}</dd></div><div><dt>Needed by</dt><dd>${fdate(pr.needed_by) || '-'}</dd></div>
<div><dt>Budget</dt><dd>${inr(pr.budget_inr) || '-'}</dd></div><div><dt>Quote deadline</dt><dd>${fdate(pr.quote_deadline) || '-'}</dd></div></dl>
${pr.justification ? `<p class="muted" style="margin:16px 0 0">${esc(pr.justification)}</p>` : ''}</div>
<div class="card flush"><table><thead><tr><th>Item</th><th>Category</th><th>Specification</th><th class="num">Quantity</th><th>UoM</th></tr></thead><tbody>${items
    .map((i) => `<tr><td><strong>${esc(i.name)}</strong></td><td>${i.category ? chip('plain', i.category) : '<span class="muted">-</span>'}</td><td class="muted">${esc(i.spec) || '-'}</td><td class="num">${i.quantity}</td><td>${esc(i.unit)}</td></tr>`)
    .join('')}</tbody></table></div>
${awarded}
${pr.status !== 'draft' ? `<h2>Quotes</h2>${pending}${cmp}` : ''}${quoteSection}`;
}

// ---------- vendor ----------

export function vendorListPage(rows: PRListRow[]): string {
  const state = (r: PRListRow): string =>
    r.status === 'awarded'
      ? r.i_won ? '<span class="chip won">You won</span>' : '<span class="chip lost">Not selected</span>'
      : r.my_quote_id ? `<span class="chip open">Quoted ${inr(r.my_quote_total)}</span>` : '<span class="chip warn">Quote needed</span>';
  const body = rows.length
    ? `<div class="card flush"><table><thead><tr><th>Request</th><th>Delivery to</th><th>Needed by</th><th>Quote by</th><th>Your quote</th><th></th></tr></thead><tbody>${rows
        .map(
          (r) => `<tr><td><strong>${esc(r.pr_number)}</strong> ${esc(r.title)}<div class="muted small">${r.item_count} line${r.item_count === 1 ? '' : 's'}, ${r.total_units} units</div></td>
          <td>${esc(r.delivery_city) || '-'}</td><td class="nowrap">${fdate(r.needed_by) || '-'}</td><td class="nowrap">${fdate(r.quote_deadline) || 'Open'}</td>
          <td>${state(r)}</td><td class="right"><a class="btn small ${r.status === 'open' ? 'primary' : ''}" href="/requests/${r.id}">${r.status !== 'open' ? 'View' : r.my_quote_id ? 'Update quote' : 'Submit quote'}</a></td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : `<div class="card empty"><h3>Nothing open for quotes</h3><p>New requests from the procurement manager appear here.</p></div>`;
  return `<h1>Requests open for quotes</h1><p class="sub">Submit a unit price for every item, a delivery time and any notes. You can update your quote until the request closes.</p>${body}`;
}

export function vendorDetailPage(d: PRDetail): string {
  const { pr, items, quotes } = d;
  const mine = quotes[0];
  const outcome = pr.status === 'awarded'
    ? mine?.isWinner
      ? '<div class="banner notice">Your quote won this request.</div>'
      : '<div class="banner error">This request was awarded to another vendor.</div>'
    : '';
  const form = pr.status === 'open'
    ? `<h2>${mine ? 'Update your quote' : 'Your quote'}</h2>${quoteForm({ action: `/requests/${pr.id}/quote`, items, manager: false, q: mine, label: mine ? 'Update quote' : 'Submit quote' })}`
    : mine
      ? `<h2>Your quote</h2><div class="card"><strong>${inr(mine.totalInr)}</strong>, delivery in ${mine.deliveryDays} days.</div>`
      : '';
  return `<p class="small" style="margin:0 0 10px"><a href="/requests">All open requests</a></p>
<div class="row"><div><h1>${esc(pr.pr_number)} ${esc(pr.title)}</h1><div class="tags" style="margin:6px 0 0">${statusChip(pr.status)}</div></div></div>${outcome}
<div class="card"><dl class="meta" style="margin:0"><div><dt>Delivery city</dt><dd>${esc(pr.delivery_city) || '-'}</dd></div>
<div><dt>Needed by</dt><dd>${fdate(pr.needed_by) || '-'}</dd></div><div><dt>Quote deadline</dt><dd>${fdate(pr.quote_deadline) || 'Open'}</dd></div></dl>
${pr.justification ? `<p class="muted" style="margin:16px 0 0">${esc(pr.justification)}</p>` : ''}</div>${form}`;
}

// ---------- manager: vendors ----------

export function vendorsPage(rows: VendorRow[]): string {
  const body = rows.length
    ? `<div class="card flush"><table><thead><tr><th>Vendor</th><th>Category</th><th>City</th><th>Contact</th><th class="num">Quotes</th><th class="num">Won</th><th></th></tr></thead><tbody>${rows
        .map(
          (v) => `<tr><td><strong>${esc(v.name)}</strong></td><td>${v.category ? chip('plain', v.category) : '<span class="muted">-</span>'}</td><td>${esc(v.city)}</td>
          <td>${esc(v.contact_name) || '<span class="muted">-</span>'}${v.email ? `<div class="muted small">${esc(v.email)}</div>` : ''}${v.phone ? `<div class="muted small">${esc(v.phone)}</div>` : ''}</td>
          <td class="num">${v.quote_count}</td><td class="num">${v.won_count}</td>
          <td class="right"><a class="btn small" href="/vendors/${v.id}/edit">Edit</a></td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : `<div class="card empty"><h3>No vendors yet</h3><p>Add the vendors you ask for quotes.</p></div>`;
  return `<div class="row"><div><h1>Vendors</h1><p class="sub" style="margin:0">The vendors you collect quotes from, what they supply and how they have done so far.</p></div><a class="btn primary" href="/vendors/new">Add vendor</a></div>${body}`;
}

export function vendorFormPage(v: VendorRow | null): string {
  return `<p class="small" style="margin:0 0 10px"><a href="/vendors">All vendors</a></p>
<h1>${v ? `Edit ${esc(v.name)}` : 'Add vendor'}</h1><p class="sub">Fields marked ${req} are required.</p>
<form method="post" action="${v ? `/vendors/${v.id}` : '/vendors'}" class="card">
<div class="grid two"><div><label>Vendor name ${req}</label><input name="name" value="${esc(v?.name)}" required maxlength="150"></div>
<div><label>Category ${req}</label><select name="category" required>${options(CATEGORIES, v?.category, 'Choose a category...')}</select><div class="hint">What this vendor mainly supplies.</div></div>
<div><label>City ${req}</label><input name="city" value="${esc(v?.city)}" required maxlength="100"></div>
<div><label>Contact person</label><input name="contact_name" value="${esc(v?.contact_name)}" maxlength="100"></div>
<div><label>Email</label><input name="email" type="email" value="${esc(v?.email)}" maxlength="150"></div>
<div><label>Phone</label><input name="phone" value="${esc(v?.phone)}" maxlength="20"></div></div>
<div style="margin-top:22px;display:flex;gap:10px"><button class="btn primary">${v ? 'Save changes' : 'Add vendor'}</button><a class="btn" href="/vendors">Cancel</a></div></form>
${v ? '' : '<p class="note">A vendor added here can receive quotes entered on their behalf. Vendor invites and self sign-up are not built in this prototype.</p>'}`;
}

// ---------- manager: products ----------

export function productsPage(rows: ProductRow[]): string {
  const body = rows.length
    ? `<div class="card flush"><table><thead><tr><th>Product</th><th>Category</th><th>UoM</th><th>Standard specification</th><th class="num">Used in</th><th></th></tr></thead><tbody>${rows
        .map(
          (p) => `<tr><td><strong>${esc(p.name)}</strong></td><td>${chip('plain', p.category)}</td><td>${esc(p.uom)}</td>
          <td class="muted">${esc(p.spec) || '-'}</td><td class="num">${plural(p.used_count, 'request')}</td>
          <td class="right"><a class="btn small" href="/products/${p.id}/edit">Edit</a></td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : `<div class="card empty"><h3>No products yet</h3><p>Add the things you buy often.</p></div>`;
  return `<div class="row"><div><h1>Products</h1><p class="sub" style="margin:0">The catalogue of things you buy. It supplies the category and unit of measure when a request is raised, from Claude or from the app.</p></div><a class="btn primary" href="/products/new">Add product</a></div>${body}`;
}

export function productFormPage(p: ProductRow | null): string {
  return `<p class="small" style="margin:0 0 10px"><a href="/products">All products</a></p>
<h1>${p ? `Edit ${esc(p.name)}` : 'Add product'}</h1><p class="sub">Fields marked ${req} are required.</p>
<form method="post" action="${p ? `/products/${p.id}` : '/products'}" class="card">
<div class="grid two"><div><label>Product name ${req}</label><input name="name" value="${esc(p?.name)}" required maxlength="200"></div>
<div><label>Category ${req}</label><select name="category" required>${options(CATEGORIES, p?.category, 'Choose a category...')}</select></div>
<div><label>Unit of measure (UoM) ${req}</label><select name="uom" required>${options(UOMS, p?.uom ?? 'Nos')}</select><div class="hint">How it is counted on a request and priced on a quote.</div></div>
<div><label>Standard specification</label><input name="spec" value="${esc(p?.spec)}" maxlength="500"></div></div>
<div style="margin-top:22px;display:flex;gap:10px"><button class="btn primary">${p ? 'Save changes' : 'Add product'}</button><a class="btn" href="/products">Cancel</a></div></form>`;
}

// ---------- about and connect ----------

export function aboutPage(): string {
  return `<h1>About this prototype</h1><p class="sub">Built to show a business that runs on the customer's own Claude plan, with no AI inside the app.</p>
<div class="grid two">
<div class="card"><h2>What is real</h2><ul style="margin:0;padding-left:18px"><li>Claude connects through MCP and creates, edits, reads and awards purchase requests.</li><li>Required details are enforced by the app. If the city, date, quantity or unit is missing, nothing is saved and Claude is told to ask.</li><li>Procurement Manager and Vendor logins with separate screens and access rules.</li><li>Vendor list and product catalogue with category and unit of measure, editable in the app.</li><li>Purchase requests, quotes, comparison and winner stored in a live database.</li><li>Vendors can only see requests open for quotes and their own quote.</li></ul></div>
<div class="card"><h2>What is simulated or not built</h2><ul style="margin:0;padding-left:18px"><li>Create PO and the handoff to Volopay: shown as a disabled button and a dashed PO stage.</li><li>Vendor emails and notifications: none are sent.</li><li>Vendor verification, invites, approvals and payments.</li><li>Sign-in is a one-click demo login. A real build would use proper accounts and OAuth for the Claude connector.</li><li>All names and data are fictional demo data.</li></ul></div></div>
<div class="card"><h2>Who does what</h2><div class="grid two"><div><h3>QuoteDesk (this app)</h3><p class="muted" style="margin:0">Request capture, vendor quoting, comparison, winner. Stays live after the chat ends and serves vendors who never use Claude.</p></div>
<div><h3>Volopay (proposed handoff)</h3><p class="muted" style="margin:0">Purchase order, invoice matching, payment and accounting sync. This is a proposal, not something built here.</p></div></div></div>
<div class="card"><h2>Claude does the thinking</h2><p class="muted" style="margin:0">Understanding the request, writing the items, comparing quotes and recommending a vendor all happen in the customer's own Claude plan. The app only stores and serves records. It contains no AI keys and makes no AI calls.</p></div>`;
}

export function connectPage(mcpUrl: string): string {
  return `<h1>Connect Claude</h1><p class="sub">Add this app to Claude as a custom connector. Claude then acts as the Procurement Manager.</p>
<div class="card"><h2>Your MCP link</h2><div class="urlbox"><input id="mcp" readonly value="${esc(mcpUrl)}" onclick="this.select()"><button class="btn" type="button" onclick="navigator.clipboard.writeText(document.getElementById('mcp').value);this.textContent='Copied'">Copy</button></div>
<p class="hint">The link contains a secret. Anyone who has it can act as the demo manager, so share it only with the people who should try this.</p></div>
<div class="card"><h2>Steps</h2><ol class="steps-list">
<li>In Claude, open <strong>Settings</strong>, then <strong>Connectors</strong>.</li><li>Choose <strong>Add custom connector</strong>.</li>
<li>Name it <strong>QuoteDesk</strong>, paste the link above as the URL, and add it. Leave any OAuth fields empty.</li>
<li>Start a new chat and make sure QuoteDesk is switched on for it.</li></ol></div>
<div class="card"><h2>Try these in Claude</h2><ol class="steps-list">
<li><em>"I need 40 laptops. Raise a purchase request."</em> The delivery city and needed-by date are missing, so Claude asks for them instead of guessing.</li>
<li><em>"Deliver to Pune in three weeks. Budget is 28 lakh."</em> The draft appears in the app.</li>
<li>Edit the draft here in the app, then: <em>"Open it for quotes."</em> Claude asks for the quote deadline.</li>
<li>Quote as the vendor, and enter other quotes from the manager screen. Then: <em>"Show me the quotes and recommend one."</em></li>
<li><em>"Mark Bharat Business Supplies as the winner."</em></li></ol></div>`;
}
