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
await call('list_prs');
const c = await call('create_pr', {
  title: 'Laptops for new joiners', department: 'Engineering', delivery_city: 'Pune', needed_by: '2026-11-30', budget_inr: 2800000,
  items: [{ name: 'Laptop 14 inch', quantity: 40, spec: '16 GB RAM, 512 GB SSD' }],
});
const n = c.created.pr_number;
await call('update_pr', { pr_number: n, budget_inr: 3000000 });
await call('open_for_quotes', { pr_number: n });
await call('update_pr', { pr_number: n, title: 'should fail' });
await call('mark_winner', { pr_number: n, vendor_name: 'Nobody' });
await call('get_quotes', { pr_number: 'PR-0001' });
await call('get_quotes', { pr_number: 'PR-9999' });
console.log('\nCREATED', n);
await client.close();
