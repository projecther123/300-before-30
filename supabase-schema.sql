-- 300 Before 30 — proposed Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  username_key text generated always as (lower(username)) stored unique,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

create table if not exists public.master_experiences (
  id uuid primary key default gen_random_uuid(),
  position int not null unique,
  title text not null,
  category text not null,
  goal_type text not null default 'standard' check (goal_type in ('standard','counter','checklist')),
  target int,
  is_active boolean not null default true
);

create table if not exists public.master_subgoals (
  id uuid primary key default gen_random_uuid(),
  master_experience_id uuid not null references public.master_experiences(id) on delete cascade,
  position int not null,
  title text not null
);

create table if not exists public.user_experiences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  master_experience_id uuid references public.master_experiences(id) on delete set null,
  sort_order numeric not null,
  title text not null,
  category text not null,
  goal_type text not null default 'standard' check (goal_type in ('standard','counter','checklist')),
  target int,
  current_value int not null default 0,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.user_subgoals (
  id uuid primary key default gen_random_uuid(),
  user_experience_id uuid not null references public.user_experiences(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sort_order int not null,
  title text not null,
  completed boolean not null default false
);

alter table public.profiles enable row level security;
alter table public.user_experiences enable row level security;
alter table public.user_subgoals enable row level security;
alter table public.master_experiences enable row level security;
alter table public.master_subgoals enable row level security;

create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "delete own profile" on public.profiles for delete to authenticated using (id = auth.uid());

create policy "read master experiences" on public.master_experiences for select to authenticated using (true);
create policy "read master subgoals" on public.master_subgoals for select to authenticated using (true);

create policy "own user experiences" on public.user_experiences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own user subgoals" on public.user_subgoals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- In production, use a SECURITY DEFINER function / transaction for profile creation +
-- copying the master 300, and expose only the minimum privileges required.
