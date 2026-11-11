import express from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { MCP_TOKEN, baseUrlOf } from './config.js';
import { migrate } from './db.js';
import { getActorByEmail } from './domain.js';
import { buildMcpServer } from './mcp.js';
import { DEMO_MANAGER_EMAIL, seed } from './seed.js';
import { webRoutes } from './web.js';


const app = express();
app.set('trust proxy', 1);

function tokenOk(given: string | undefined): boolean {
  if (!given) return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(MCP_TOKEN).digest();
  return timingSafeEqual(a, b);
}

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// ----- MCP endpoint -----
// Claude's custom connector form takes a URL only, so the secret travels in the path.
// An Authorization: Bearer header is also accepted for clients that can send one.
async function handleMcp(req: express.Request, res: express.Response) {
  const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!tokenOk(req.params.token ?? bearer)) {
    res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
    return;
  }
  const actor = await getActorByEmail(DEMO_MANAGER_EMAIL);
  if (!actor) {
    res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Not ready' }, id: null });
    return;
  }
  const server = buildMcpServer(actor, baseUrlOf(req));
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined }); // stateless
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

const mcpJson = express.json({ limit: '1mb' });
const notAllowed = (_req: express.Request, res: express.Response) =>
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });

app.post('/mcp/:token', mcpJson, (req, res) => void handleMcp(req, res).catch((e) => {
  console.error(e);
  if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
}));
app.post('/mcp', mcpJson, (req, res) => void handleMcp(req, res).catch((e) => {
  console.error(e);
  if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
}));
app.get(['/mcp/:token', '/mcp'], notAllowed);
app.delete(['/mcp/:token', '/mcp'], notAllowed);

webRoutes(app);

const port = Number(process.env.PORT ?? 3000);
migrate()
  .then(seed)
  .then(() => app.listen(port, () => console.log(`QuoteDesk listening on ${port}`)))
  .catch((e) => {
    console.error('Startup failed', e);
    process.exit(1);
  });
