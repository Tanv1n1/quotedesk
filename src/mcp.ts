import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  Actor, AppError, CATEGORIES, PRDetail, PRRow, UOMS, createPR, getQuotes, listPRs, listProducts, listVendors, markWinner,
  openForQuotes, updatePR,
} from './domain.js';

// The MCP layer is a thin door onto the same domain functions the web screens use.
// Claude does all the reasoning. These tools only store, read and change records.

const itemSchema = z.object({
  name: z.string().describe('Item name, e.g. "Laptop 14 inch". Use the catalogue name from list_products when the item is in the catalogue.'),
  quantity: z.number().int().positive().describe('Whole number of units'),
  uom: z.enum(UOMS).optional().describe('Unit of measure. Required unless the item is in the product catalogue, which then supplies it. Ask if it is unclear, for example cable could be Metre or Roll.'),
  category: z.enum(CATEGORIES).optional().describe('Product category. Taken from the catalogue when the item is in it.'),
  spec: z.string().optional().describe('Specification or notes for vendors, e.g. "16 GB RAM, 512 GB SSD"'),
});

type ItemArg = z.infer<typeof itemSchema>;
const toItems = (items: ItemArg[] | undefined) =>
  items?.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.uom, category: i.category, spec: i.spec }));

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(e: unknown) {
  if (!(e instanceof AppError)) {
    console.error(e);
    return { isError: true, content: [{ type: 'text' as const, text: 'Something went wrong on the server.' }] };
  }
  // Required details are missing: nothing was saved. Claude should ask the manager, not fill the gap itself.
  const msg = e.missing
    ? `Nothing was saved. Required details are missing: ${e.missing.join(', ')}. Ask the manager for these, then call the tool again. Do not guess or fill them in yourself.`
    : e.message;
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
    items: d.items.map((i) => ({ name: i.name, quantity: i.quantity, uom: i.unit, category: i.category, spec: i.spec })),
    quotes: d.quotes.map((q) => ({
      vendor: q.vendorName,
      city: q.vendorCity,
      vendor_category: q.vendorCategory,
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
    vendors_not_yet_quoted: d.pendingVendors.map((v) => ({ name: v.name, category: v.category })),
  };
}

export function buildMcpServer(actor: Actor, baseUrl: string): McpServer {
  const server = new McpServer({ name: 'quotedesk', version: '0.2.0' });

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
            delivery_city: r.delivery_city, needed_by: r.needed_by, quote_deadline: r.quote_deadline,
            quotes_received: r.quote_count, lowest_quote_inr: r.lowest_total, budget_inr: r.budget_inr, winner: r.winner_name,
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
        'Create a purchase request (PR) as a draft from what the manager asked for. Required from the manager: what to buy with a quantity for each item, the delivery city, and the needed-by date. Each item also needs a unit of measure, which comes from the product catalogue when the item is in it. If the manager has not given a required detail, ask for it before calling this tool. Never invent a city, a date, a quantity or a budget. Budget and department are optional. You may write the short title yourself. The PR is saved as a draft: the manager can review and edit it in the app before it goes out for quotes.',
      inputSchema: {
        title: z.string().describe('Short title you write from the request, e.g. "Laptops for new joiners"'),
        items: z.array(itemSchema).min(1).describe('Line items requested'),
        department: z.string().optional(),
        delivery_city: z.string().optional().describe('Required. City the goods are delivered to. Ask if not given.'),
        needed_by: z.string().optional().describe('Required. Date as YYYY-MM-DD. Ask if not given.'),
        budget_inr: z.number().nonnegative().optional().describe('Total budget in INR. Optional. Leave out if not given.'),
        justification: z.string().optional().describe('Why it is needed, in one or two sentences'),
      },
    },
    async (a) => {
      try {
        const pr = await createPR(
          actor,
          {
            title: a.title, items: toItems(a.items), department: a.department, deliveryCity: a.delivery_city,
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
          title: a.title, items: toItems(a.items), department: a.department, deliveryCity: a.delivery_city,
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
        'Move a draft PR to "open". Vendors can then log in to the app and submit quotes, and the manager can also enter a quote on a vendor\'s behalf in the app. Items are locked after this. Only call it after the manager has said to go ahead. A quote deadline is required: it must be today or later, and on or before the needed-by date. If the manager has not given one, ask for it. Do not pick a date yourself.',
      inputSchema: {
        pr_number: z.string().describe('Like PR-0003'),
        quote_deadline: z.string().optional().describe('Required unless the PR already has one. Last date for quotes, YYYY-MM-DD. Ask if not given.'),
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
    'list_products',
    {
      title: 'List the product catalogue',
      description:
        'List catalogue products with their category, unit of measure and standard specification. Check it before creating a PR so item names, units and categories match the catalogue. Items outside the catalogue are allowed, but then you must give their unit of measure.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        return ok((await listProducts(actor)).map((p) => ({ name: p.name, category: p.category, uom: p.uom, standard_spec: p.spec })));
      } catch (e) { return fail(e); }
    },
  );

  server.registerTool(
    'list_vendors',
    {
      title: 'List vendors',
      description:
        'List registered vendors with city, category, contact person, and how many quotes they have submitted and won. Use it to tell the manager which vendors fit a request by category.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        return ok((await listVendors()).map((v) => ({
          name: v.name, city: v.city, category: v.category, contact_person: v.contact_name, quotes_submitted: v.quote_count, requests_won: v.won_count,
        })));
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
