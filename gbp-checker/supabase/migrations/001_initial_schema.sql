-- GBP Checker - Initial Database Schema
-- This migration creates all tables needed for the GBP Checker SaaS app.

-- Profiles table (extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  company_name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'business')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  monthly_audit_limit integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Audits table
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),

  -- Input fields
  firmenname text not null,
  stadt text not null,
  branche text not null,
  reichweite text not null check (reichweite in ('Lokal', 'Regional', 'Bundesweit')),
  ladenlokal text not null check (ladenlokal in ('Ja', 'Nein')),
  kontakt_email text not null,
  kontakt_name text,

  -- Result fields (populated by n8n callback)
  gesamt_score integer,
  score_label text,
  report_json jsonb,
  report_html text,
  error_message text,

  -- Meta
  n8n_execution_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.audits enable row level security;
create policy "Users can view own audits" on public.audits for select using (auth.uid() = user_id);
create policy "Users can insert own audits" on public.audits for insert with check (auth.uid() = user_id);

-- Usage table
create table public.usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  period_start date not null,
  period_end date not null,
  audits_used integer not null default 0,
  audits_limit integer not null,
  created_at timestamptz not null default now(),

  unique(user_id, period_start)
);

alter table public.usage enable row level security;
create policy "Users can view own usage" on public.usage for select using (auth.uid() = user_id);

-- Webhook logs (server-only, no RLS)
create table public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('n8n', 'stripe')),
  event_type text,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

-- Trigger: auto-create profile and usage on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, plan, monthly_audit_limit)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', null),
    'free',
    1
  );

  insert into public.usage (user_id, period_start, period_end, audits_used, audits_limit)
  values (
    new.id,
    current_date,
    current_date + interval '30 days',
    0,
    1
  );

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable realtime for audits (for status polling)
alter publication supabase_realtime add table public.audits;

-- Indexes for performance
create index idx_audits_user_id on public.audits(user_id);
create index idx_audits_status on public.audits(status);
create index idx_usage_user_id on public.usage(user_id);
create index idx_usage_period on public.usage(user_id, period_start);
create index idx_webhook_logs_created on public.webhook_logs(created_at);
