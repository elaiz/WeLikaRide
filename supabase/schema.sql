-- WeLikaRide Supabase Schema
-- Run this in your Supabase SQL Editor

-- Profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  phone text,
  role text not null check (role in ('rider', 'driver', 'admin')),
  approved boolean not null default false,  -- drivers must be approved; riders/admins are always considered active
  total_miles numeric default 0,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
-- Admins can read all profiles
create policy "Admins can read all profiles" on public.profiles for select
  using ((select role from public.profiles where id = auth.uid()) = 'admin');
-- Admins can update any profile (to approve/deactivate drivers)
create policy "Admins can update profiles" on public.profiles for update
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Driver invite tokens (single-use, created by admins)
create table if not exists public.driver_invites (
  id uuid default gen_random_uuid() primary key,
  token text not null unique,
  created_by uuid references public.profiles(id) not null,
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz default now()
);
alter table public.driver_invites enable row level security;
-- Anyone (even unauthenticated) can look up an invite token by value during registration
create policy "Public can read invite by token" on public.driver_invites for select using (true);
-- Only admins can insert invites
create policy "Admins can create invites" on public.driver_invites for insert
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');
-- Admins can view all invites
create policy "Admins can view all invites" on public.driver_invites for select
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Ride Requests
-- NOTE: destination is intentionally NOT stored per privacy design
create table if not exists public.ride_requests (
  id uuid default gen_random_uuid() primary key,
  rider_id uuid references public.profiles(id) on delete cascade not null,
  rider_name text not null,
  pickup_address text,           -- typed address, OR
  pickup_lat numeric,            -- GPS coordinates
  pickup_lng numeric,            --
  pickup_time timestamptz,       -- optional requested time
  notes text,
  status text not null default 'pending' check (status in ('pending','accepted','completed','cancelled')),
  driver_id uuid references public.profiles(id),
  driver_name text,
  mileage numeric,
  created_at timestamptz default now()
);
alter table public.ride_requests enable row level security;
-- Riders can see and create their own requests
create policy "Riders can insert own requests" on public.ride_requests for insert with check (auth.uid() = rider_id);
create policy "Riders can view own requests" on public.ride_requests for select using (auth.uid() = rider_id);
-- Drivers can see all pending or their own accepted/completed requests
create policy "Drivers can view requests" on public.ride_requests for select
  using (
    (select role from public.profiles where id = auth.uid()) = 'driver'
  );
create policy "Drivers can update requests" on public.ride_requests for update
  using (
    (select role from public.profiles where id = auth.uid()) = 'driver'
  );

-- Complete a ride and record mileage atomically.
-- Only the accepting driver can call this.
create or replace function public.complete_ride(ride_id uuid, miles numeric default 0)
returns void language plpgsql security definer as $$
declare
  v_driver_id uuid;
begin
  -- Verify the caller is the driver who accepted this ride
  select driver_id into v_driver_id
  from public.ride_requests
  where id = ride_id and status = 'accepted';

  if v_driver_id is null then
    raise exception 'Ride not found or not in accepted state';
  end if;
  if v_driver_id <> auth.uid() then
    raise exception 'Only the assigned driver can complete this ride';
  end if;

  -- Mark ride completed and record mileage
  update public.ride_requests
  set status = 'completed', mileage = nullif(miles, 0)
  where id = ride_id;

  -- Accumulate driver total miles
  if miles > 0 then
    update public.profiles
    set total_miles = total_miles + miles
    where id = v_driver_id;
  end if;
end;
$$;
