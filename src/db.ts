import pg from 'pg';

// numeric -> number, date -> 'YYYY-MM-DD' string (no timezone shifts)
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://postgres@localhost:5433/quotedesk',
  ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined,
});

const SCHEMA = `
create table if not exists vendors (
  id serial primary key,
  name text not null unique,
  city text not null,
  contact_name text
);
create table if not exists users (
  id serial primary key,
  email text not null unique,
  name text not null,
  role text not null check (role in ('manager','vendor')),
  vendor_id int references vendors(id)
);
create sequence if not exists pr_number_seq;
create table if not exists purchase_requests (
  id serial primary key,
  pr_number text not null unique,
  title text not null,
  requester_id int not null references users(id),
  department text,
  delivery_city text,
  needed_by date,
  budget_inr numeric,
  justification text,
  status text not null default 'draft' check (status in ('draft','open','awarded')),
  quote_deadline date,
  winner_quote_id int,
  created_via text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists pr_items (
  id serial primary key,
  pr_id int not null references purchase_requests(id) on delete cascade,
  position int not null,
  name text not null,
  spec text,
  quantity int not null check (quantity > 0),
  unit text not null default 'nos'
);
create table if not exists quotes (
  id serial primary key,
  pr_id int not null references purchase_requests(id) on delete cascade,
  vendor_id int not null references vendors(id),
  submitted_by int not null references users(id),
  on_behalf boolean not null default false,
  delivery_days int not null check (delivery_days >= 0),
  validity_days int,
  notes text,
  total_inr numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pr_id, vendor_id)
);
create table if not exists quote_lines (
  id serial primary key,
  quote_id int not null references quotes(id) on delete cascade,
  pr_item_id int not null references pr_items(id) on delete cascade,
  unit_price_inr numeric not null check (unit_price_inr >= 0),
  unique (quote_id, pr_item_id)
);
`;

export async function migrate(): Promise<void> {
  await pool.query(SCHEMA);
}
