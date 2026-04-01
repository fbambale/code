Digital Registration & Records Management System (CODE Society Kenya)

Overview
- Simple HTML/CSS/JS app using Supabase for Auth and Postgres (RLS enabled).
- Features: Authentication, Branch management, Client CRUD, User/Role management, Basic reports, Audit logging.

Quick Start
1) Open index.html in a browser (or serve via a local server).
2) Update Supabase config is already set in js/supabase.js with your URL/key.
3) Ensure email confirmations are enabled in Supabase Auth (recommended).

Project Structure
- index.html            Landing, login and signup
- dashboard.html        Main app shell after login
- css/styles.css        Styles
- js/app.js             App utilities (validators, UI helpers)
- js/supabase.js        Supabase client and data access
- js/clients.js         Clients feature UI/logic
- js/branches.js        Branches feature UI/logic
- js/users.js           Users/roles feature UI/logic
- js/reports.js         Reports placeholders

Security/Validation
- Strong password policy: min 12 chars, upper/lower/number/special, no spaces, not in common list.
- Name rules: letters, spaces, hyphens only; 2–50 chars; starts with a letter.
- Email validation: regex + disposable domain blocklist; require email confirmation in Supabase.
- RLS policies restrict data to branch and role.

Supabase Schema (execute in SQL Editor)
-- Enable extension for gen_random_uuid
create extension if not exists pgcrypto;

create table if not exists public.roles (
  id smallserial primary key,
  name text unique not null check (name in ('admin','staff','viewer'))
);
insert into public.roles(name)
  values ('admin'), ('staff'), ('viewer')
  on conflict (name) do nothing;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z0-9_-]{2,10}$'),
  name text not null check (char_length(name) between 3 and 80),
  address text,
  phone text,
  email text check (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_id smallint not null references public.roles(id),
  branch_id uuid references public.branches(id),
  full_name text not null,
  created_at timestamptz default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  national_id text unique not null check (national_id ~ '^[A-Z0-9]{6,20}$'),
  first_name text not null check (first_name ~ '^[A-Za-z][A-Za-z\s\-]{1,49}$'),
  last_name text not null check (last_name ~ '^[A-Za-z][A-Za-z\s\-]{1,49}$'),
  email text unique,
  phone text,
  dob date,
  gender text check (gender in ('male','female','other')),
  address text,
  notes text,
  branch_id uuid not null references public.branches(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- basic email/phone checks (allow nulls)
alter table public.clients
  add constraint clients_email_chk check (email is null or email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
alter table public.clients
  add constraint clients_phone_chk check (phone is null or phone ~ '^\+?[0-9]{7,15}$');

create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  data jsonb,
  created_at timestamptz default now()
);

-- RLS
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: users can see their own; admins can see all
create policy if not exists profiles_self_select on public.profiles
for select using (auth.uid() = user_id);
create policy if not exists profiles_admin_all on public.profiles
for all using (
  exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.user_id = auth.uid() and r.name = 'admin'
  )
);

-- Branches: read for all authenticated; write for admins only
create policy if not exists branches_read on public.branches
for select using (auth.uid() is not null);
create policy if not exists branches_admin_write on public.branches
for all using (
  exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.user_id = auth.uid() and r.name = 'admin'
  )
);

-- Clients select: same branch or admin
create policy if not exists clients_select_branch on public.clients
for select using (
  exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.user_id = auth.uid() and (r.name = 'admin' or p.branch_id = clients.branch_id)
  )
);
-- Clients insert/update/delete: staff/admin in same branch
create policy if not exists clients_write_branch on public.clients
for insert with check (
  exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.user_id = auth.uid() and (r.name in ('admin','staff') and p.branch_id = branch_id)
  )
);
create policy if not exists clients_update_branch on public.clients
for update using (
  exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.user_id = auth.uid() and (r.name in ('admin','staff') and p.branch_id = clients.branch_id)
  )
);
create policy if not exists clients_delete_branch on public.clients
for delete using (
  exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.user_id = auth.uid() and (r.name in ('admin','staff') and p.branch_id = clients.branch_id)
  )
);

-- Audit logs: insert by any authenticated; select admin only
create policy if not exists audit_insert on public.audit_logs
for insert with check (auth.uid() is not null);
create policy if not exists audit_select_admin on public.audit_logs
for select using (
  exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.user_id = auth.uid() and r.name = 'admin'
  )
);

Recommended Auth Settings
- Require email confirmation.
- Disable unverified logins.
- Optionally restrict email signups to allowed domains.

Running
- Open index.html directly or with a local server.
- After signing up, create your own profile/role using the Admin user.

