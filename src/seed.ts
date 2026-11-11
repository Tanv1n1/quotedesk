import { pool } from './db.js';
import { createPR, getActorByEmail, markWinner, openForQuotes, submitQuote } from './domain.js';

export const DEMO_MANAGER_EMAIL = 'manager@quotedesk.demo';
export const DEMO_VENDOR_EMAIL = 'vendor@quotedesk.demo';

// name, city, contact, category, email. All fictional.
const DEMO_VENDORS = [
  ['Sahyadri IT Distributors', 'Pune', 'Neha Joshi', 'IT hardware', 'sales@sahyadri-it.example'],
  ['Bharat Business Supplies', 'Mumbai', 'Imran Shaikh', 'Office supplies', 'orders@bharat-supplies.example'],
  ['Deccan Office Systems', 'Hyderabad', 'Lakshmi Reddy', 'Office furniture', 'quotes@deccan-office.example'],
];

// name, category, unit of measure, standard specification
const DEMO_PRODUCTS = [
  ['Laptop 14 inch', 'IT hardware', 'Nos', '16 GB RAM, 512 GB SSD'],
  ['Laptop bag', 'IT hardware', 'Nos', null],
  ['Monitor 24 inch', 'IT hardware', 'Nos', 'Full HD, HDMI'],
  ['Network cable Cat6', 'IT hardware', 'Metre', null],
  ['Ergonomic office chair', 'Office furniture', 'Nos', 'Mesh back, adjustable lumbar support'],
  ['A4 copier paper', 'Office supplies', 'Ream', '75 GSM, 500 sheets'],
  ['Whiteboard marker', 'Office supplies', 'Box', 'Box of 10'],
  ['LED tube light 20W', 'Electrical', 'Nos', null],
  ['Floor cleaner', 'Housekeeping', 'Litre', null],
];

const isoDaysFromToday = (n: number): string =>
  new Date(Date.now() + n * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// Runs on every start and only fills gaps, so a database created by an earlier version is brought up to date.
async function ensureCatalogue(): Promise<void> {
  for (const [name, , , category, email] of DEMO_VENDORS) {
    await pool.query(
      'update vendors set category = coalesce(category, $2), email = coalesce(email, $3) where name = $1', [name, category, email]);
  }
  await pool.query(`update vendors set category = 'Other' where category is null`);
  const n = await pool.query('select count(*)::int as n from products');
  if (n.rows[0].n === 0) {
    for (const p of DEMO_PRODUCTS) {
      await pool.query('insert into products (name, category, uom, spec) values ($1,$2,$3,$4) on conflict (name) do nothing', p);
    }
  }
  await pool.query(`update pr_items set unit = 'Nos' where lower(unit) = 'nos' and unit <> 'Nos'`);
  await pool.query(
    `update pr_items i set category = p.category from products p where i.category is null and lower(i.name) = lower(p.name)`);
}

// Demo data only. Names are fictional. The sample request is created once, when the database is empty.
export async function seed(): Promise<void> {
  const existing = await pool.query('select count(*)::int as n from users');
  if (existing.rows[0].n > 0) return ensureCatalogue();

  for (const [name, city, contact] of DEMO_VENDORS) {
    await pool.query('insert into vendors (name, city, contact_name) values ($1,$2,$3)', [name, city, contact]);
  }
  await ensureCatalogue();
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
      neededBy: isoDaysFromToday(30),
      budgetInr: 450000,
      justification: 'Sample request seeded for the demo.',
      items: [{ name: 'Ergonomic office chair', quantity: 60, unit: 'Nos', spec: 'Mesh back, adjustable lumbar support, 5 year warranty' }],
    },
    'app',
  );
  await openForQuotes(manager, pr.pr_number, isoDaysFromToday(7));
  const itemId = (await pool.query('select id from pr_items where pr_id = $1', [pr.id])).rows[0].id as number;
  await submitQuote(vendor, pr.pr_number, { deliveryDays: 12, validityDays: 30, notes: 'Free installation in Pune.', prices: { [itemId]: 6400 } });
  await submitQuote(manager, pr.pr_number, { vendorId: v.rows[1].id, deliveryDays: 18, validityDays: 30, notes: 'Quote received by phone.', prices: { [itemId]: 6150 } });
  await submitQuote(manager, pr.pr_number, { vendorId: v.rows[2].id, deliveryDays: 7, validityDays: 15, notes: 'Stock available. Delivery within a week.', prices: { [itemId]: 6700 } });
  await markWinner(manager, pr.pr_number, { vendorName: 'Bharat Business Supplies' });
}
