import { pool } from './db.js';
import { createPR, getActorByEmail, markWinner, openForQuotes, submitQuote } from './domain.js';

export const DEMO_MANAGER_EMAIL = 'manager@quotedesk.demo';
export const DEMO_VENDOR_EMAIL = 'vendor@quotedesk.demo';

// Demo data only. Names are fictional. Runs once, when the database is empty.
export async function seed(): Promise<void> {
  const existing = await pool.query('select count(*)::int as n from users');
  if (existing.rows[0].n > 0) return;

  await pool.query(
    `insert into vendors (name, city, contact_name) values
      ('Sahyadri IT Distributors', 'Pune', 'Neha Joshi'),
      ('Bharat Business Supplies', 'Mumbai', 'Imran Shaikh'),
      ('Deccan Office Systems', 'Hyderabad', 'Lakshmi Reddy')`,
  );
  const v = await pool.query('select id, name from vendors order by id');
  const sahyadri = v.rows[0].id as number;
  await pool.query(
    `insert into users (email, name, role, vendor_id) values
      ($1, 'Aarav Kulkarni', 'manager', null),
      ($2, 'Neha Joshi', 'vendor', $3)`,
    [DEMO_MANAGER_EMAIL, DEMO_VENDOR_EMAIL, sahyadri],
  );

  const manager = (await getActorByEmail(DEMO_MANAGER_EMAIL))!;
  const vendor = (await getActorByEmail(DEMO_VENDOR_EMAIL))!;

  // One finished example so reviewers can see a comparison and a winner without doing anything.
  const pr = await createPR(
    manager,
    {
      title: 'Ergonomic office chairs for Pune office',
      department: 'Admin',
      deliveryCity: 'Pune',
      neededBy: '2026-12-15',
      budgetInr: 450000,
      justification: 'Sample request seeded for the demo.',
      items: [{ name: 'Ergonomic office chair', quantity: 60, unit: 'nos', spec: 'Mesh back, adjustable lumbar support, 5 year warranty' }],
    },
    'app',
  );
  await openForQuotes(manager, pr.pr_number);
  const itemId = (await pool.query('select id from pr_items where pr_id = $1', [pr.id])).rows[0].id as number;
  await submitQuote(vendor, pr.pr_number, { deliveryDays: 12, validityDays: 30, notes: 'Free installation in Pune.', prices: { [itemId]: 6400 } });
  await submitQuote(manager, pr.pr_number, { vendorId: v.rows[1].id, deliveryDays: 18, validityDays: 30, notes: 'Quote received by phone.', prices: { [itemId]: 6150 } });
  await submitQuote(manager, pr.pr_number, { vendorId: v.rows[2].id, deliveryDays: 7, validityDays: 15, notes: 'Stock available. Delivery within a week.', prices: { [itemId]: 6700 } });
  await markWinner(manager, pr.pr_number, { vendorName: 'Bharat Business Supplies' });
}
