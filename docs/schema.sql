create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text not null,
  avatar_url text,
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now()
);

create table if not exists public.credit_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  pet_number text not null unique,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  current_host_user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  species text not null check (species in ('cat', 'dog')),
  avatar_url text,
  source_image_url text,
  front_image_url text,
  asset_bundle_url text,
  location_status text not null default 'at_owner_desktop'
    check (location_status in ('at_owner_desktop', 'hosted_by_friend', 'away')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.material_slot_definitions (
  slot text primary key,
  name text not null,
  group_id text not null,
  unlock_tier text not null default 'custom',
  trigger_label text not null,
  trigger_is_editable boolean not null default false,
  duration_seconds integer not null check (duration_seconds between 4 and 15),
  credit_rate_per_second numeric(8, 2) not null default 1 check (credit_rate_per_second >= 0),
  default_cost integer generated always as (ceil(duration_seconds * credit_rate_per_second)::integer) stored,
  prompt_template text not null,
  generation_settings jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.material_slot_definitions
  add column if not exists unlock_tier text not null default 'custom';

alter table public.material_slot_definitions
  drop constraint if exists material_slot_definitions_unlock_tier_check;

alter table public.material_slot_definitions
  add constraint material_slot_definitions_unlock_tier_check
  check (unlock_tier in ('basic', 'advanced', 'custom'));

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace view public.public_material_slot_definitions as
select
  slot,
  name,
  group_id,
  unlock_tier,
  trigger_label,
  trigger_is_editable,
  duration_seconds,
  credit_rate_per_second,
  default_cost,
  generation_settings,
  is_enabled,
  sort_order,
  updated_at
from public.material_slot_definitions
where is_enabled = true;

create table if not exists public.pet_assets (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  slot text not null references public.material_slot_definitions(slot),
  video_url text,
  status text not null default 'missing',
  provider text,
  provider_job_id text,
  prompt_snapshot_ref text,
  generation_settings_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id, slot)
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade,
  asset_id uuid references public.pet_assets(id) on delete set null,
  job_type text not null check (job_type in ('front_image', 'action_video')),
  slot text,
  status text not null default 'queued',
  cost integer not null default 0,
  provider text,
  provider_job_id text,
  result_url text,
  prompt_snapshot_ref text,
  generation_settings_snapshot jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.generation_jobs(id) on delete set null,
  amount integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_referrals (
  referred_user_id uuid primary key references public.profiles(id) on delete cascade,
  referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  registered_at timestamptz not null default now(),
  reward_percent_at_registration integer not null check (reward_percent_at_registration between 0 and 100),
  first_recharge_discount_percent_at_registration integer not null check (first_recharge_discount_percent_at_registration between 0 and 100),
  first_recharge_discount_used_at timestamptz,
  check (referred_user_id <> referrer_user_id)
);

create table if not exists public.recharge_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  provider_transaction_id text,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'CNY',
  credits_granted integer not null check (credits_granted >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recharge_records
  add column if not exists discount_percent integer not null default 0 check (discount_percent between 0 and 100),
  add column if not exists discount_amount_cents integer not null default 0 check (discount_amount_cents >= 0),
  add column if not exists referral_code_id uuid references public.referral_codes(id) on delete set null,
  add column if not exists referred_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists paid_at timestamptz,
  add column if not exists note text;

create table if not exists public.referral_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid not null references public.profiles(id) on delete cascade,
  referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
  recharge_record_id uuid not null references public.recharge_records(id) on delete restrict,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'CNY',
  reward_percent integer not null check (reward_percent between 0 and 100),
  reward_amount_cents integer not null check (reward_amount_cents >= 0),
  reward_credits integer not null check (reward_credits >= 0),
  status text not null default 'posted' check (status in ('posted', 'voided')),
  created_at timestamptz not null default now(),
  unique (recharge_record_id)
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_user_id, to_user_id)
);

create table if not exists public.friendships (
  user_a_id uuid not null references public.profiles(id) on delete cascade,
  user_b_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a_id, user_b_id),
  check (user_a_id <> user_b_id)
);

create table if not exists public.pet_hosting_requests (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.desktop_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (
    type in (
      'hosting_request_created',
      'hosting_request_accepted',
      'hosting_request_declined',
      'pet_recalled',
      'desktop_bundle_changed'
    )
  ),
  actor_user_id uuid references public.profiles(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  hosting_request_id uuid references public.pet_hosting_requests(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists desktop_events_user_id_id_idx
on public.desktop_events(user_id, id);

alter table public.profiles enable row level security;
alter table public.credit_balances enable row level security;
alter table public.pets enable row level security;
alter table public.material_slot_definitions enable row level security;
alter table public.app_settings enable row level security;
alter table public.pet_assets enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.referral_codes enable row level security;
alter table public.user_referrals enable row level security;
alter table public.recharge_records enable row level security;
alter table public.referral_reward_ledger enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.pet_hosting_requests enable row level security;
alter table public.desktop_events enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select on public.credit_balances to authenticated;
grant select, insert, update on public.pets to authenticated;
revoke select on public.material_slot_definitions from anon, authenticated;
grant select, insert, update on public.material_slot_definitions to service_role;
revoke all on public.app_settings from anon, authenticated;
grant select, insert, update on public.app_settings to service_role;
grant select on public.public_material_slot_definitions to anon, authenticated;
grant select, insert, update on public.pet_assets to authenticated;
grant select, insert, update on public.generation_jobs to authenticated;
grant select, insert on public.credit_ledger to authenticated;
revoke all on public.referral_codes from anon, authenticated;
grant select, insert, update on public.referral_codes to service_role;
revoke all on public.user_referrals from anon, authenticated;
grant select, insert, update on public.user_referrals to service_role;
grant select, insert on public.recharge_records to authenticated;
grant select, insert, update on public.recharge_records to service_role;
revoke all on public.referral_reward_ledger from anon, authenticated;
grant select, insert, update on public.referral_reward_ledger to service_role;
grant select, insert, update on public.friend_requests to authenticated;
grant select, insert, delete on public.friendships to authenticated;
grant select, insert, update on public.pet_hosting_requests to authenticated;
grant select on public.desktop_events to authenticated;
grant insert on public.desktop_events to service_role;
grant usage, select on sequence public.desktop_events_id_seq to service_role;

drop policy if exists "profiles are visible to their owner" on public.profiles;
create policy "profiles are visible to their owner"
on public.profiles for select
to authenticated
using (auth.uid() is not null and id = auth.uid());

drop policy if exists "users can view their credit balance" on public.credit_balances;
create policy "users can view their credit balance"
on public.credit_balances for select
to authenticated
using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "users can view owned or hosted pets" on public.pets;
create policy "users can view owned or hosted pets"
on public.pets for select
to authenticated
using (
  auth.uid() is not null
  and (owner_user_id = auth.uid() or current_host_user_id = auth.uid())
);

drop policy if exists "users can view materials for owned or hosted pets" on public.pet_assets;
create policy "users can view materials for owned or hosted pets"
on public.pet_assets for select
to authenticated
using (
  exists (
    select 1
    from public.pets
    where pets.id = pet_assets.pet_id
      and (pets.owner_user_id = auth.uid() or pets.current_host_user_id = auth.uid())
  )
);

drop policy if exists "material slot definitions are readable" on public.material_slot_definitions;
create policy "material slot definitions are readable"
on public.material_slot_definitions for select
to service_role
using (is_enabled = true);

drop policy if exists "service role can manage app settings" on public.app_settings;
create policy "service role can manage app settings"
on public.app_settings for all
to service_role
using (true)
with check (true);

drop policy if exists "users can view their generation jobs" on public.generation_jobs;
create policy "users can view their generation jobs"
on public.generation_jobs for select
to authenticated
using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "users can view their credit ledger" on public.credit_ledger;
create policy "users can view their credit ledger"
on public.credit_ledger for select
to authenticated
using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "users can view their recharge records" on public.recharge_records;
create policy "users can view their recharge records"
on public.recharge_records for select
to authenticated
using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "users can view owned referral codes" on public.referral_codes;
create policy "users can view owned referral codes"
on public.referral_codes for select
to authenticated
using (auth.uid() is not null and owner_user_id = auth.uid());

drop policy if exists "users can view their referral attribution" on public.user_referrals;
create policy "users can view their referral attribution"
on public.user_referrals for select
to authenticated
using (
  auth.uid() is not null
  and (referred_user_id = auth.uid() or referrer_user_id = auth.uid())
);

drop policy if exists "users can view their referral rewards" on public.referral_reward_ledger;
create policy "users can view their referral rewards"
on public.referral_reward_ledger for select
to authenticated
using (
  auth.uid() is not null
  and (referrer_user_id = auth.uid() or referred_user_id = auth.uid())
);

drop policy if exists "users can view related hosting requests" on public.pet_hosting_requests;
create policy "users can view related hosting requests"
on public.pet_hosting_requests for select
to authenticated
using (
  auth.uid() is not null
  and (from_user_id = auth.uid() or to_user_id = auth.uid())
);

drop policy if exists "users can view their desktop events" on public.desktop_events;
create policy "users can view their desktop events"
on public.desktop_events for select
to authenticated
using (
  auth.uid() is not null
  and user_id = auth.uid()
);

drop policy if exists "users can view their friendships" on public.friendships;
create policy "users can view their friendships"
on public.friendships for select
to authenticated
using (
  auth.uid() is not null
  and (user_a_id = auth.uid() or user_b_id = auth.uid())
);

insert into public.app_settings (key, value, updated_at)
values (
  'video_generation_settings',
  '{
    "model": "doubao-seedance-2-0-mini-260615",
    "durationSeconds": 10,
    "ratio": "adaptive",
    "resolution": "720p",
    "framesPerSecond": 24,
    "cameraFixed": true,
    "watermark": false,
    "generateAudio": false,
    "returnLastFrame": true
  }'::jsonb,
  now()
)
on conflict (key) do nothing;

insert into public.app_settings (key, value, updated_at)
values (
  'referral_settings',
  '{
    "rewardPercent": 10,
    "firstRechargeDiscountPercent": 20
  }'::jsonb,
  now()
)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('source-images', 'source-images', true, 31457280, array['image/png', 'image/jpeg', 'image/webp']),
  ('front-images', 'front-images', true, 31457280, array['image/png', 'image/jpeg', 'image/webp']),
  ('action-videos', 'action-videos', true, 52428800, array['video/mp4', 'video/quicktime', 'video/webm']),
  ('asset-bundles', 'asset-bundles', true, 104857600, array['application/zip', 'application/octet-stream'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();
