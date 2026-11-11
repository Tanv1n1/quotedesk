import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = process.argv[2] ?? 'http://localhost:3100/mcp/dev-token';
const client = new Client({ name: 'smoke', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content[0].text;
  console.log(`\n# ${name} ${r.isError ? '(ERROR)' : ''}\n${t.length > 700 ? t.slice(0, 700) + ' ...' : t}`);
  return r.isError ? { error: t } : JSON.parse(t);
};
const tools = await client.listTools();
console.log('tools:', tools.tools.map((t) => t.name).join(', '));
const day = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
await call('list_prs');
await call('list_products');
await call('list_vendors');
// incomplete request: must be refused with a list of what to ask for
const inc = await call('create_pr', { title: 'Laptops', items: [{ name: 'Laptop 14 inch', quantity: 40 }] });
console.log('INCOMPLETE REFUSED:', Boolean(inc.error) && inc.error.includes('delivery city') && inc.error.includes('needed-by date') && inc.error.includes('Ask the manager'));
const inc2 = await call('create_pr', { title: 'Cable', delivery_city: 'Pune', needed_by: day(20), items: [{ name: 'Speaker wire', quantity: 100 }] });
console.log('UNIT ASKED FOR:', Boolean(inc2.error) && inc2.error.includes('unit of measure'));
const c = await call('create_pr', {
  title: 'Laptops for new joiners', department: 'Engineering', delivery_city: 'Pune', needed_by: day(20), budget_inr: 2800000,
  items: [{ name: 'Laptop 14 inch', quantity: 40, spec: '16 GB RAM, 512 GB SSD' }, { name: 'Speaker wire', quantity: 100, uom: 'Metre', category: 'Electrical' }],
});
const n = c.created.pr_number;
await call('update_pr', { pr_number: n, budget_inr: 3000000 });
const nd = await call('open_for_quotes', { pr_number: n });
console.log('DEADLINE ASKED FOR:', Boolean(nd.error) && nd.error.includes('quote deadline'));
const op = await call('open_for_quotes', { pr_number: n, quote_deadline: day(5) });
console.log('OPENED:', op.opened?.status === 'open');
await call('update_pr', { pr_number: n, title: 'should fail' });
await call('mark_winner', { pr_number: n, vendor_name: 'Nobody' });
const g = await call('get_quotes', { pr_number: n });
console.log('ITEM UOM FROM CATALOGUE:', g.items?.[0]?.uom === 'Nos' && g.items?.[0]?.category === 'IT hardware' && g.items?.[1]?.uom === 'Metre');
await call('get_quotes', { pr_number: 'PR-9999' });
console.log('\nCREATED', n);
await client.close();
