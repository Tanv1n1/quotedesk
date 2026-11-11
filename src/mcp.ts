import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  Actor, AppError, PRDetail, PRRow, createPR, getQuotes, listPRs, markWinner, openForQuotes, updatePR,
} from './domain.js';

// The MCP layer is a thin door onto the same domain functions the web screens use.
// Claude does all the reasoning. These tools only store, read and change records.

const itemSchema = z.object({
  name: z.string().describe('Item name, e.g. "Laptop 14 inch"'),
  quantity: z.number().int().positive().describe('Whole number of units'),
  spec: z.string().optional().describe('Specification or notes for vendors, e.g. "16 GB RAM, 512 GB SSD"'),
  unit: z.string().optional().describe('Unit of measure, default "nos"'),
});

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(e: unknown) {
  const msg = e instanceof AppError ? e.message : 'Something went wrong on the server.';
  if (!(e instanceof AppError)) console.error(e);
  return { isError: true, content: [{ type: 'text' as const, text: msg }] };
}

function prSummary(pr: PRRow, baseUrl: string) {
  return {
    pr_number: pr.pr_number,
    title: pr.title,
    status: pr.status,
    department: pr.department,
    delivery_city: pr.delivery_city,
    needed_by: pr.needed_by,
    budget_inr: pr.budget_inr,
    quote_deadline: pr.quote_deadline,
    justification: pr.justification,
    created_via: pr.created_via,
    app_url: `${baseUrl}/prs/${pr.id}`,
  };
}

function detailForClaude(d: PRDetail, baseUrl: string) {
  const itemName = new Map(d.items.map((i) => [i.id, i.name]));
  return {
    ...prSummary(d.pr, baseUrl),
    items: d.items.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, spec: i.spec })),
    quotes: d.quotes.map((q) => ({
      vendor: q.vendorName,
      city: q.vendorCity,
      total_inr: q.totalInr,
      delivery_days: q.deliveryDays,
      validity_days: q.validityDays,
      notes: q.notes,
      entered_by: q.onBehalf ? 'procurement manager on behalf of vendor' : 'vendor',
      unit_prices_inr: Object.fromEntries(q.lines.map((l) => [itemName.get(l.itemId) ?? String(l.itemId), l.unitPriceInr])),
      is_lowest_total: q.isLowest,
      is_fastest_delivery: q.isFastest,
      within_budget: q.withinBudget,
      is_winner: q.isWinner,
    })),
    vendors_not_yet_quoted: d.pendingVendors.map((v) => v.name),
  };
}

export function buildMcpServer(actor: Actor, baseUrl: string): McpServer {
  const server = new McpServer({ name: 'quotedesk', version: '0.1.0' });

  server.registerTool(
    'list_prs',
    {
      title: 'List purchase requests',
      description:
        'List all purchase requests with status (draft, open, awarded), quote counts and lowest quote so far. Use this to find a PR number when the manager refers to a request by description.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const rows = await listPRs(actor);
        return ok(
          rows.map((r) => ({
            pr_number: r.pr_number, title: r.title, status: r.status, items: r.item_count, total_units: r.total_units,
            quotes_received: r.quote_count, lowest_quote_inr: r.lowest_total, budget_inr: r.budget_inr,
            app_url: `${baseUrl}/prs/${r.id}`,
          })),
        );
      } catch (e) { return fail(e); }
    },
  );

  server.registerTool(
    'create_pr',
    {
      title: 'Create a purchase request',
      description:
        'Create a purchase request (PR) as a draft from what the manager asked for. Fill in items, quantities and any budget, delivery city or needed-by date they mentioned. Do not invent a budget or dates they did not give. The PR is saved as a draft: the manager can review and edit it in the app before it goes out for quotes.',
      inputSchema: {
        title: z.string().describe('Short title, e.g. "Laptops for new joiners"'),
        items: z.array(itemSchema).min(1).describe('Line items requested'),
        department: z.string().optional(),
        delivery_city: z.string().optional(),
        needed_by: z.string().optional().describe('Date as YYYY-MM-DD'),
        budget_inr: z.number().nonnegative().optional().describe('Total budget in INR'),
        justification: z.string().optional().describe('Why it is needed, in one or two sentences'),
      },
    },
    async (a) => {
      try {
        const pr = await createPR(
          actor,
          {
            title: a.title, items: a.items, department: a.department, deliveryCity: a.delivery_city,
            neededBy: a.needed_by, budgetInr: a.budget_inr, justification: a.justification,
          },
          'claude',
        );
        return ok({ created: prSummary(pr, baseUrl), next: 'Tell the manager the PR is a draft in the app. Ask whether to open it for quotes.' });
      } catch (e) { return fail(e); }
    },
  );

  server.registerTool(
    'update_pr',
    {
      title: 'Update a purchase request',
      description:
        'Change a purchase request. While the PR is a draft, any field and the full item list can change (if you pass items, they replace the existing list). Once open for quotes, only quote_deadline and justification can change. An awarded PR cannot be edited.',
      inputSchema: {
        pr_number: z.string().describe('Like PR-0003'),
        title: z.string().optional(),
        items: z.array(itemSchema).optional().describe('Replaces the whole item list (draft only)'),
        department: z.string().optional(),
        delivery_city: z.string().optional(),
        needed_by: z.string().optional().describe('YYYY-MM-DD'),
        budget_inr: z.number().nonnegative().optional(),
        justification: z.string().optional(),
        quote_deadline: z.string().optional().describe('YYYY-MM-DD'),
      },
    },
    async (a) => {
      try {
        const pr = await updatePR(actor, a.pr_number, {
          title: a.title, items: a.items, department: a.department, deliveryCity: a.delivery_city,
          neededBy: a.needed_by, budgetInr: a.budget_inr, justification: a.justification, quoteDeadline: a.quote_deadline,
        });
        return ok({ updated: prSummary(pr, baseUrl) });
      } catch (e) { return fail(e); }
    },
  );

  server.registerTool(
    'open_for_quotes',
    {
      title: 'Open a purchase request for quotes',
      description:
        'Move a draft PR to "open". Vendors can then log in to the app and submit quotes, and the manager can also enter a quote on a vendor\'s behalf in the app. Items are locked after this. Only call it after the manager has said to go ahead.',
      inputSchema: {
        pr_number: z.string().describe('Like PR-0003'),
        quote_deadline: z.string().optional().describe('Last date for quotes, YYYY-MM-DD'),
      },
    },
    async (a) => {
      try {
        const pr = await openForQuotes(actor, a.pr_number, a.quote_deadline);
        return ok({ opened: prSummary(pr, baseUrl), next: 'Vendors can now quote in the app. Ask the manager to say when they want to review quotes.' });
      } catch (e) { return fail(e); }
    },
  );

  server.registerTool(
    'get_quotes',
    {
      title: 'Get quotes for a purchase request',
      description:
        'Return every vendor quote on a PR with per-item unit prices, totals, delivery days, validity, notes, budget fit and which vendors have not quoted yet. Use it to compare the quotes and give a clear recommendation with reasons (price, delivery, validity, budget). The decision stays with the manager.',
      inputSchema: { pr_number: z.string().describe('Like PR-0003') },
      annotations: { readOnlyHint: true },
    },
    async (a) => {
      try {
        return ok(detailForClaude(await getQuotes(actor, a.pr_number), baseUrl));
      } catch (e) { return fail(e); }
    },
  );

  server.registerTool(
    'mark_winner',
    {
      title: 'Mark the winning vendor',
      description:
        'Award the PR to one vendor. This is final: the PR becomes "awarded" and can no longer take quotes. Only call this after the manager has explicitly named the vendor to award. Never choose the winner on your own. After awarding, tell the manager that creating a purchase order is the next step, which this prototype does not do.',
      inputSchema: {
        pr_number: z.string().describe('Like PR-0003'),
        vendor_name: z.string().describe('Name of the vendor that won, as shown in get_quotes'),
      },
    },
    async (a) => {
      try {
        const d = await markWinner(actor, a.pr_number, { vendorName: a.vendor_name });
        const w = d.quotes.find((q) => q.isWinner);
        return ok({
          awarded: prSummary(d.pr, baseUrl),
          winner: w ? { vendor: w.vendorName, total_inr: w.totalInr, delivery_days: w.deliveryDays } : null,
          next: 'Purchase order creation is the next step. It is not built in this prototype.',
        });
      } catch (e) { return fail(e); }
    },
  );

  return server;
}
