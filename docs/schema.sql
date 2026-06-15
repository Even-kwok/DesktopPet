create table if not exists public.profiles (
  id uuid primary key,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  current_host_user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  species text not null check (species in ('cat', 'dog')),
  avatar_url text,
  source_image_url text,
  front_image_url text,
  asset_bundle_url text,
  location_status text not null default 'at_owner_desktop',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pet_assets (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  slot text not null,
  video_url text,
  status text not null default 'missing',
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
