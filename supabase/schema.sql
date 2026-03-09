-- =============================================
-- ORBIT — Life Tracking App
-- Paste this entire file into Supabase SQL Editor
-- and click "Run"
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USECASES table
create table if not exists usecases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  icon text default '🎯',
  notify_email text,
  notify_time time default '09:00',
  created_at timestamptz default now()
);

-- CHECKLIST ITEMS table
create table if not exists checklist_items (
  id uuid primary key default uuid_generate_v4(),
  usecase_id uuid references usecases(id) on delete cascade not null,
  label text not null,
  description text,
  value_type text check (value_type in ('checkbox', 'score', 'number', 'text')) default 'checkbox',
  sort_order int default 0,
  created_at timestamptz default now()
);

-- CHECKIN ENTRIES table
create table if not exists checkin_entries (
  id uuid primary key default uuid_generate_v4(),
  checklist_item_id uuid references checklist_items(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  value text,
  created_at timestamptz default now(),
  unique(checklist_item_id, user_id, date)
);

-- =============================================
-- Row Level Security (RLS) — REQUIRED
-- Each user can only see their own data
-- =============================================

alter table usecases enable row level security;
alter table checklist_items enable row level security;
alter table checkin_entries enable row level security;

-- Usecases: users own their rows
create policy "Users manage own usecases"
  on usecases for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Checklist items: accessible if user owns the parent usecase
create policy "Users manage own checklist items"
  on checklist_items for all
  using (
    exists (
      select 1 from usecases
      where usecases.id = checklist_items.usecase_id
      and usecases.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from usecases
      where usecases.id = checklist_items.usecase_id
      and usecases.user_id = auth.uid()
    )
  );

-- Checkin entries: users own their entries
create policy "Users manage own entries"
  on checkin_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================
-- Done! Tables created successfully.
-- =============================================
