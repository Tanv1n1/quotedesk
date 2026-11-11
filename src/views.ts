import type { Actor, ItemRow, PRDetail, PRListRow, PRRow, QuoteView, VendorRow } from './domain.js';

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
:root{--bg:#f6f7fb;--card:#fff;--ink:#1b1f2a;--muted:#667085;--line:#e4e7ec;--accent:#4338ca;--accent-soft:#eef0ff;
--green:#067647;--green-soft:#ecfdf3;--amber:#b54708;--amber-soft:#fffaeb;--blue:#175cd3;--blue-soft:#eff8ff;--red:#b42318;--red-soft:#fef3f2;--grey-soft:#f2f4f7}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header.top{background:#fff;border-bottom:1px solid var(--line)}
.bar{max-width:1080px;margin:0 auto;padding:0 20px;display:flex;align-items:center;gap:20px;height:60px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;color:var(--ink)}
.brand:hover{text-decoration:none}
.mark{width:28px;height:28px;border-radius:8px;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px}
nav.main{display:flex;gap:4px;flex:1}
nav.main a{padding:7px 12px;border-radius:8px;color:var(--muted);font-weight:500}
nav.main a:hover{background:var(--grey-soft);text-decoration:none}
nav.main a.on{background:var(--accent-soft);color:var(--accent)}
.who{display:flex;align-items:center;gap:10px;font-size:14px}
.who small{display:block;color:var(--muted);font-size:12px;line-height:1.2}
.who form{margin:0}
main{max-width:1080px;margin:0 auto;padding:28px 20px 60px}
h1{font-size:24px;margin:0 0 4px;letter-spacing:-.01em}h2{font-size:17px;margin:0 0 12px}h3{font-size:15px;margin:0 0 8px}
.sub{color:var(--muted);margin:0 0 20px}
.row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:18px}
.card.flush{padding:0;overflow:hidden}
.card h2:first-child{margin-top:0}
table{width:100%;border-collapse:collapse}
th,td{padding:12px 16px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600;background:#fbfbfd}
tr:last-child td{border-bottom:0}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.chip{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12.5px;font-weight:600;white-space:nowrap}
.chip.draft{background:var(--grey-soft);color:#475467}.chip.open{background:var(--blue-soft);color:var(--blue)}
.chip.awarded,.chip.won,.chip.good{background:var(--green-soft);color:var(--green)}
.chip.warn{background:var(--amber-soft);color:var(--amber)}.chip.bad,.chip.lost{background:var(--red-soft);color:var(--red)}
.chip.plain{background:var(--grey-soft);color:#475467}.chip.claude{background:var(--accent-soft);color:var(--accent)}
.btn{display:inline-block;padding:9px 16px;border-radius:9px;border:1px solid var(--line);background:#fff;color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
.btn:hover{background:var(--grey-soft);text-decoration:none}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.btn.primary:hover{background:#3730a3}
.btn.small{padding:6px 12px;font-size:14px}
.btn[disabled]{opacity:.5;cursor:not-allowed}
.btn.lg{padding:13px 22px;font-size:16px}
label{display:block;font-weight:600;font-size:14px;margin-bottom:5px}
input,select,textarea{width:100%;padding:9px 11px;border:1px solid #d0d5dd;border-radius:9px;font:inherit;background:#fff;color:var(--ink)}
input:focus,select:focus,textarea:focus{outline:2px solid var(--accent-soft);border-color:var(--accent)}
textarea{min-height:72px;resize:vertical}
.hint{color:var(--muted);font-size:13px;margin-top:4px}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}
.grid.two{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.meta{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.meta dt{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600}
.meta dd{margin:2px 0 0;font-weight:600}
.banner{padding:12px 16px;border-radius:10px;margin-bottom:18px;font-weight:500}
.banner.error{background:var(--red-soft);color:var(--red);border:1px solid #fecdca}
.banner.notice{background:var(--green-soft);color:var(--green);border:1px solid #abefc6}
.note{background:var(--accent-soft);border-radius:10px;padding:12px 16px;color:#312e81;font-size:14px}
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
.step{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}
.step b{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--accent-soft);color:var(--accent);margin-bottom:8px}
.cta{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));max-width:760px;margin:0 auto}
.cta .card{margin:0}
.item-row{display:grid;grid-template-columns:2fr 2fr 90px 90px 36px;gap:10px;margin-bottom:10px;align-items:start}
.item-row .x{padding:8px 0;color:var(--muted);background:none;border:0;font-size:20px;cursor:pointer}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}
.urlbox{display:flex;gap:8px}.urlbox input{font-family:ui-monospace,Menlo,monospace;font-size:13px}
ol.steps-list{padding-left:20px;margin:0}ol.steps-list li{margin-bottom:8px}
@media(max-width:720px){.bar{height:auto;flex-wrap:wrap;padding:10px 20px;gap:8px}nav.main{order:3;width:100%}
.item-row{grid-template-columns:1fr 1fr}.item-row .x{grid-column:2}th,td{padding:10px 12px}.card.flush{overflow-x:auto}}
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
      ? [['/prs', 'Purchase requests', 'prs'], ['/connect', 'Connect to Claude', 'connect'], ['/about', 'About', 'about']]
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
<title>${esc(p.title)} · QuoteDesk</title><style>${CSS}</style></head><body>
<header class="top"><div class="bar"><a class="brand" href="/"><span class="mark">Q</span>QuoteDesk</a><nav class="main">${links}</nav>${who}</div></header>
<main>${flash}${p.body}</main></body></html>`;
}

// ---------- shared bits ----------

export const statusChip = (s: string): string =>
  `<span class="chip ${esc(s)}">${s === 'open' ? 'Open for quotes' : s === 'awarded' ? 'Awarded' : 'Draft'}</span>`;

const sourceChip = (via: string): string =>
  via === 'claude' ? '<span class="chip claude">Created from Claude</span>' : '';

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
<form class="card" method="post" action="/demo/vendor"><h2>Vendor</h2><p class="muted">See requests open for quotes and submit a price, delivery time and notes.</p><button class="btn lg">Enter as Vendor</button></form></div>
<p class="muted small" style="text-align:center;margin-top:22px">Prototype with demo data. Sign-in is a one-click demo login, so there are no passwords to share. <a href="/about">What is real and what is simulated</a></p>`;
}

// ---------- manager: list and form ----------

export function prListPage(rows: PRListRow[]): string {
  const body = rows.length
    ? `<div class="card flush"><table><thead><tr><th>Request</th><th>Status</th><th>Items</th><th class="num">Budget</th><th class="num">Quotes</th><th>Needed by</th></tr></thead><tbody>${rows
        .map(
          (r) => `<tr><td><a href="/prs/${r.id}"><strong>${esc(r.pr_number)}</strong> ${esc(r.title)}</a>
            <div class="tags">${sourceChip(r.created_via)}</div></td>
            <td>${statusChip(r.status)}</td>
            <td>${r.item_count} line${r.item_count === 1 ? '' : 's'}, ${r.total_units} units</td>
            <td class="num">${inr(r.budget_inr) || '<span class="muted">Not set</span>'}</td>
            <td class="num">${r.quote_count}${r.lowest_total != null ? `<div class="muted small">Lowest ${inr(r.lowest_total)}</div>` : ''}</td>
            <td class="nowrap">${fdate(r.needed_by) || '<span class="muted">Not set</span>'}</td></tr>`,
        )
        .join('')}</tbody></table></div>`
    : `<div class="card empty"><h3>No purchase requests yet</h3><p>Ask Claude for something you need, or create one here.</p><a class="btn primary" href="/prs/new">New purchase request</a></div>`;
  return `<div class="row"><div><h1>Purchase requests</h1><p class="sub" style="margin:0">Everything raised from Claude or from this screen.</p></div><a class="btn primary" href="/prs/new">New purchase request</a></div>${body}`;
}

function itemRow(i?: Partial<ItemRow>): string {
  return `<div class="item-row">
<div><input name="item_name" placeholder="Item, e.g. Laptop 14 inch" value="${esc(i?.name)}" required></div>
<div><input name="item_spec" placeholder="Specification (optional)" value="${esc(i?.spec)}"></div>
<div><input name="item_qty" type="number" min="1" step="1" placeholder="Qty" value="${esc(i?.quantity)}" required></div>
<div><input name="item_unit" placeholder="nos" value="${esc(i?.unit && i.unit !== 'nos' ? i.unit : '')}"></div>
<button type="button" class="x" title="Remove" onclick="rmRow(this)">×</button></div>`;
}

export function prFormPage(pr: PRRow | null, items: ItemRow[]): string {
  const open = pr?.status === 'open';
  const action = pr ? `/prs/${pr.id}/edit` : '/prs';
  const v = (x: unknown) => esc(x);
  const lock = open ? 'disabled' : '';
  const itemsHtml = open
    ? `<p class="muted">Items are locked while the request is open for quotes, so every quote matches what was asked.</p>`
    : `<div id="items">${(items.length ? items : [undefined]).map((i) => itemRow(i)).join('')}</div>
       <button type="button" class="btn small" onclick="addRow()">Add item</button>`;
  return `<div class="row"><div><h1>${pr ? `Edit ${esc(pr.pr_number)}` : 'New purchase request'}</h1>
<p class="sub" style="margin:0">${open ? 'Open for quotes: only the quote deadline and notes can change.' : 'Saved as a draft. Nothing goes to vendors until you open it for quotes.'}</p></div></div>
<form method="post" action="${action}" class="card">
<div class="grid two"><div><label>Title</label><input name="title" value="${v(pr?.title)}" required maxlength="200" ${lock}></div>
<div><label>Department</label><input name="department" value="${v(pr?.department)}" ${lock}></div>
<div><label>Delivery city</label><input name="delivery_city" value="${v(pr?.delivery_city)}" ${lock}></div>
<div><label>Needed by</label><input name="needed_by" type="date" value="${v(pr?.needed_by)}" ${lock}></div>
<div><label>Budget (₹, total)</label><input name="budget_inr" type="number" min="0" step="1" value="${v(pr?.budget_inr)}" ${lock}>
<div class="hint">Only the manager sees this. Vendors never do.</div></div>
${open ? `<div><label>Quote deadline</label><input name="quote_deadline" type="date" value="${v(pr?.quote_deadline)}"></div>` : ''}</div>
<div style="margin-top:14px"><label>Notes${open ? '' : ' / justification'}</label><textarea name="justification" maxlength="1000">${v(pr?.justification)}</textarea></div>
<h2 style="margin-top:22px">Items</h2>${itemsHtml}
<div style="margin-top:22px;display:flex;gap:10px"><button class="btn primary">${pr ? 'Save changes' : 'Create draft'}</button>
<a class="btn" href="${pr ? `/prs/${pr.id}` : '/prs'}">Cancel</a></div></form>
<script>
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
         .map((v) => `<option value="${v.id}" ${v.id === opts.selectedVendor ? 'selected' : ''}>${esc(v.name)}, ${esc(v.city)}</option>`)
         .join('')}</select><div class="hint">Use this when a vendor sent a quote by phone, WhatsApp or email.</div></div>`
    : ''}
<div class="card flush" style="margin-bottom:14px"><table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num" style="width:190px">Unit price (₹)</th><th class="num">Line total</th></tr></thead><tbody>
${items
  .map(
    (i) => `<tr><td><strong>${esc(i.name)}</strong>${i.spec ? `<div class="muted small">${esc(i.spec)}</div>` : ''}</td>
<td class="num">${i.quantity} ${esc(i.unit)}</td>
<td class="num"><input name="price_${i.id}" data-qty="${i.quantity}" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(priceOf(i.id))}" required style="text-align:right"></td>
<td class="num" data-line="${i.id}">–</td></tr>`,
  )
  .join('')}
<tr><td colspan="3" class="right"><strong>Quote total</strong></td><td class="num"><strong id="grand">–</strong></td></tr></tbody></table></div>
<div class="grid"><div><label>Delivery time (days)</label><input name="delivery_days" type="number" min="0" max="365" step="1" value="${esc(q?.deliveryDays)}" required></div>
<div><label>Quote valid for (days)</label><input name="validity_days" type="number" min="0" max="365" step="1" value="${esc(q?.validityDays)}"></div></div>
<div style="margin-top:14px"><label>Notes</label><textarea name="notes" maxlength="1000" placeholder="Warranty, installation, payment terms...">${esc(q?.notes)}</textarea></div>
<div style="margin-top:16px"><button class="btn primary">${esc(opts.label)}</button></div></form>
<script>
(function(){var f=document.getElementById('quote-form');if(!f)return;var fmt=new Intl.NumberFormat('en-IN',{maximumFractionDigits:2});
function calc(){var t=0;f.querySelectorAll('input[data-qty]').forEach(function(i){var v=parseFloat(i.value),q=Number(i.dataset.qty),c=f.querySelector('[data-line="'+i.name.slice(6)+'"]');
if(isFinite(v)){t+=v*q;c.textContent='₹'+fmt.format(v*q)}else c.textContent='–'});document.getElementById('grand').textContent=t?'₹'+fmt.format(t):'–'}
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
          (q) => `<th class="vendor ${q.isWinner ? 'winner-col' : ''}">${esc(q.vendorName)}<div class="muted small" style="font-weight:400">${esc(q.vendorCity)}</div>
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
         <input type="date" name="quote_deadline" aria-label="Quote deadline" style="width:auto" title="Optional quote deadline" value="${esc(pr.quote_deadline)}">
         <button class="btn primary">Open for quotes</button></form>`
      : pr.status === 'open'
        ? `<a class="btn" href="/prs/${pr.id}/edit">Edit deadline and notes</a>`
        : '';

  const awarded = pr.status === 'awarded' && winner
    ? `<div class="card" style="border-color:#abefc6"><div class="row" style="margin:0"><div><span class="chip won">Awarded</span>
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
<div class="row"><div><h1>${esc(pr.pr_number)} ${esc(pr.title)}</h1><div class="tags" style="margin:6px 0 0">${statusChip(pr.status)}${sourceChip(pr.created_via)}</div></div>
<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">${actions}</div></div>
<div class="card"><dl class="meta" style="margin:0">
<div><dt>Requested by</dt><dd>${esc(pr.requester_name)}</dd></div><div><dt>Department</dt><dd>${esc(pr.department) || '–'}</dd></div>
<div><dt>Delivery city</dt><dd>${esc(pr.delivery_city) || '–'}</dd></div><div><dt>Needed by</dt><dd>${fdate(pr.needed_by) || '–'}</dd></div>
<div><dt>Budget</dt><dd>${inr(pr.budget_inr) || '–'}</dd></div><div><dt>Quote deadline</dt><dd>${fdate(pr.quote_deadline) || '–'}</dd></div></dl>
${pr.justification ? `<p class="muted" style="margin:16px 0 0">${esc(pr.justification)}</p>` : ''}</div>
<div class="card flush"><table><thead><tr><th>Item</th><th>Specification</th><th class="num">Quantity</th></tr></thead><tbody>${items
    .map((i) => `<tr><td><strong>${esc(i.name)}</strong></td><td class="muted">${esc(i.spec) || '–'}</td><td class="num">${i.quantity} ${esc(i.unit)}</td></tr>`)
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
          <td>${esc(r.delivery_city) || '–'}</td><td class="nowrap">${fdate(r.needed_by) || '–'}</td><td class="nowrap">${fdate(r.quote_deadline) || 'Open'}</td>
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
<div class="card"><dl class="meta" style="margin:0"><div><dt>Delivery city</dt><dd>${esc(pr.delivery_city) || '–'}</dd></div>
<div><dt>Needed by</dt><dd>${fdate(pr.needed_by) || '–'}</dd></div><div><dt>Quote deadline</dt><dd>${fdate(pr.quote_deadline) || 'Open'}</dd></div></dl>
${pr.justification ? `<p class="muted" style="margin:16px 0 0">${esc(pr.justification)}</p>` : ''}</div>${form}`;
}

// ---------- about and connect ----------

export function aboutPage(): string {
  return `<h1>About this prototype</h1><p class="sub">Built to show a business that runs on the customer's own Claude plan, with no AI inside the app.</p>
<div class="grid two">
<div class="card"><h2>What is real</h2><ul style="margin:0;padding-left:18px"><li>Claude connects through MCP and creates, edits, reads and awards purchase requests.</li><li>Procurement Manager and Vendor logins with separate screens and access rules.</li><li>Purchase requests, quotes, comparison and winner stored in a live database.</li><li>Vendors can only see requests open for quotes and their own quote.</li></ul></div>
<div class="card"><h2>What is simulated or not built</h2><ul style="margin:0;padding-left:18px"><li>Create PO and the handoff to Volopay: shown as a disabled button.</li><li>Vendor emails and notifications: none are sent.</li><li>Vendor verification, approvals and payments.</li><li>Sign-in is a one-click demo login. A real build would use proper accounts and OAuth for the Claude connector.</li><li>All names and data are fictional demo data.</li></ul></div></div>
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
<li><em>"I need 40 laptops (16 GB RAM, 512 GB SSD) delivered to Pune by 30 November. Budget is 28 lakh. Raise a purchase request."</em></li>
<li>Edit the draft here in the app, then: <em>"Open it for quotes."</em></li>
<li>Quote as the vendor, and enter other quotes from the manager screen. Then: <em>"Show me the quotes and recommend one."</em></li>
<li><em>"Mark Bharat Business Supplies as the winner."</em></li></ol></div>`;
}
