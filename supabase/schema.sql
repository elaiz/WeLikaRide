-- WeLikaRide Supabase Schema
-- Run this in your Supabase SQL Editor (idempotent: safe to re-run)

-- ─────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id               uuid references auth.users(id) on delete cascade primary key,
  name             text not null,
  phone            text,
  role             text not null check (role in ('rider', 'driver', 'admin')),
  -- drivers start unapproved until an admin activates them
  -- riders and admins are always considered active (approved = true by default for non-drivers)
  approved         boolean not null default false,
  total_miles      numeric default 0,
  -- persistent rider accommodations shown to drivers on every ride request
  special_requests text,
  created_at       timestamptz default now()
);
alter table public.profiles enable row level security;

create policy "Users can read own profile"   on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
-- Admins can read and update all profiles (approve/deactivate drivers, etc.)
create policy "Admins can read all profiles"   on public.profiles for select
  using ((select role from public.profiles where id = auth.uid()) = 'admin');
create policy "Admins can update any profile"  on public.profiles for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- ─────────────────────────────────────────────
-- DRIVER INVITE TOKENS
-- ─────────────────────────────────────────────
create table if not exists public.driver_invites (
  id          uuid default gen_random_uuid() primary key,
  token       text not null unique,
  created_by  uuid references public.profiles(id) not null,
  used_by     uuid references public.profiles(id),
  used_at     timestamptz,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz default now()
);
alter table public.driver_invites enable row level security;

-- No direct SELECT access to the invites table from unauthenticated clients.
-- Token validation goes through the check_driver_invite RPC (SECURITY DEFINER)
-- to prevent enumeration of all valid tokens.
-- Only admins can create or view invites.
create policy "Admins can create invites" on public.driver_invites for insert
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');
create policy "Admins can view all invites" on public.driver_invites for select
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- ─────────────────────────────────────────────
-- DO NOT PICKUP LIST
-- ─────────────────────────────────────────────
create table if not exists public.do_not_pickup (
  id         uuid default gen_random_uuid() primary key,
  rider_id   uuid references public.profiles(id) on delete cascade not null unique,
  reason     text,           -- private note for admins only, NOT shown to drivers
  added_by   uuid references public.profiles(id) not null,
  created_at timestamptz default now()
);
alter table public.do_not_pickup enable row level security;

-- Admins can do everything
create policy "Admins can manage do_not_pickup" on public.do_not_pickup for all
  using ((select role from public.profiles where id = auth.uid()) = 'admin');
-- Approved drivers can read the rider_id list (but NOT the reason — select only id + rider_id)
create policy "Drivers can read do_not_pickup ids" on public.do_not_pickup for select
  using (
    (select role  from public.profiles where id = auth.uid()) = 'driver' and
    (select approved from public.profiles where id = auth.uid()) = true
  );

-- ─────────────────────────────────────────────
-- RIDE REQUESTS
-- NOTE: destination is intentionally NOT stored (privacy)
-- ─────────────────────────────────────────────
create table if not exists public.ride_requests (
  id               uuid default gen_random_uuid() primary key,
  rider_id         uuid references public.profiles(id) on delete cascade not null,
  rider_name       text not null,
  -- snapshot of the rider's special_requests at time of booking so drivers
  -- always see the right info even if the profile is updated later
  special_requests text,
  pickup_address   text,
  pickup_lat       numeric,
  pickup_lng       numeric,
  pickup_time      timestamptz,
  notes            text,
  status           text not null default 'pending'
                     check (status in ('pending','accepted','completed','cancelled')),
  driver_id        uuid references public.profiles(id),
  driver_name      text,
  mileage          numeric,
  created_at       timestamptz default now()
);
alter table public.ride_requests enable row level security;

-- Riders manage their own requests
create policy "Riders can insert own requests" on public.ride_requests for insert
  with check (auth.uid() = rider_id);
create policy "Riders can view own requests"   on public.ride_requests for select
  using (auth.uid() = rider_id);
-- Approved drivers see all pending/active requests
create policy "Drivers can view requests" on public.ride_requests for select
  using (
    (select role     from public.profiles where id = auth.uid()) = 'driver' and
    (select approved from public.profiles where id = auth.uid()) = true
  );
create policy "Drivers can update requests" on public.ride_requests for update
  using (
    (select role     from public.profiles where id = auth.uid()) = 'driver' and
    (select approved from public.profiles where id = auth.uid()) = true
  );
-- Admins can view all ride requests
create policy "Admins can view all requests" on public.ride_requests for select
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- ─────────────────────────────────────────────
-- RPC: validate and consume a driver invite token
-- Called during registration; runs as SECURITY DEFINER so it can
-- read driver_invites without a public SELECT policy.
-- ─────────────────────────────────────────────
create or replace function public.consume_driver_invite(p_token text, p_user_id uuid)
returns boolean language plpgsql security definer as $$
declare
  v_invite_id uuid;
begin
  select id into v_invite_id
  from public.driver_invites
  where token = p_token
    and used_by is null
    and expires_at > now();

  if v_invite_id is null then
    return false;
  end if;

  -- Mark invite as used
  update public.driver_invites
  set used_by = p_user_id, used_at = now()
  where id = v_invite_id;

  -- Approve the driver profile
  update public.profiles
  set approved = true
  where id = p_user_id;

  return true;
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: check whether an invite token is valid (without exposing all tokens)
-- Returns true if the token exists, is unused, and has not expired.
-- Runs as SECURITY DEFINER so unauthenticated callers can validate a token
-- they received in an invite link without being able to enumerate all tokens.
-- ─────────────────────────────────────────────
create or replace function public.check_driver_invite(p_token text)
returns boolean language plpgsql security definer as $$
begin
  return exists (
    select 1 from public.driver_invites
    where token = p_token
      and used_by is null
      and expires_at > now()
  );
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: register_user — atomically create a profile and (for drivers)
-- consume the invite token. This avoids the race condition where the
-- profile upsert succeeds but the invite consumption fails.
-- ─────────────────────────────────────────────
create or replace function public.register_user(
  p_user_id        uuid,
  p_name           text,
  p_phone          text,
  p_role           text,
  p_special_requests text,
  p_invite_token   text
) returns boolean language plpgsql security definer as $$
begin
  -- Validate invite before touching any row
  if p_role = 'driver' then
    if not exists (
      select 1 from public.driver_invites
      where token = p_invite_token
        and used_by is null
        and expires_at > now()
    ) then
      return false;
    end if;
  end if;

  -- Create the profile
  insert into public.profiles (id, name, phone, role, approved, special_requests)
  values (
    p_user_id,
    p_name,
    p_phone,
    p_role,
    case when p_role = 'driver' then false else true end,
    case when p_role = 'rider' then p_special_requests else null end
  )
  on conflict (id) do update set
    name             = excluded.name,
    phone            = excluded.phone,
    special_requests = excluded.special_requests;

  -- Consume the invite and approve the driver
  if p_role = 'driver' then
    update public.driver_invites
    set used_by = p_user_id, used_at = now()
    where token = p_invite_token;

    update public.profiles set approved = true where id = p_user_id;
  end if;

  return true;
end;
$$;

-- ─────────────────────────────────────────────
-- RPC: complete a ride + log mileage atomically
-- Only the assigned driver can call this.
-- ─────────────────────────────────────────────
create or replace function public.complete_ride(ride_id uuid, miles numeric default 0)
returns void language plpgsql security definer as $$
declare
  v_driver_id uuid;
begin
  select driver_id into v_driver_id
  from public.ride_requests
  where id = ride_id and status = 'accepted';

  if v_driver_id is null then
    raise exception 'Ride not found or not in accepted state';
  end if;
  if v_driver_id <> auth.uid() then
    raise exception 'Only the assigned driver can complete this ride';
  end if;

  update public.ride_requests
  set status = 'completed', mileage = nullif(miles, 0)
  where id = ride_id;

  if miles > 0 then
    update public.profiles
    set total_miles = total_miles + miles
    where id = v_driver_id;
  end if;
end;
$$;

-- ─────────────────────────────────────────────
-- FIRST ADMIN SETUP (run manually once)
-- After creating your admin account via the app, run:
--   update public.profiles set role = 'admin', approved = true where id = '<your-user-uuid>';
-- ─────────────────────────────────────────────
