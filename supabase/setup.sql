-- =====================================================================
-- W²ander — fresh database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a brand-new project.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Settings: who the admin is (edit the email if it ever changes)
-- ---------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),
  admin_email text not null
);
insert into public.app_settings (admin_email) values ('rachel.l.werner@gmail.com');
alter table public.app_settings enable row level security;
-- no policies: only server code / SQL editor can read or change it

-- ---------------------------------------------------------------------
-- People ("members"): everyone who travels, with or without a login
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'member');

create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text,                       -- optional: kids etc. can have no login
  phone text not null default '',
  birthday date,
  role public.app_role not null default 'member',
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index members_email_key on public.members (lower(email)) where email is not null;

-- Rachel's own member row (links to her login on first sign-in)
insert into public.members (name, email, role)
values ('Rachel Werner', 'rachel.l.werner@gmail.com', 'admin');

-- ---------------------------------------------------------------------
-- Helper functions (security definer so policies can use them)
-- ---------------------------------------------------------------------
create or replace function public.current_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid() limit 1
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and role = 'admin')
$$;

-- ---------------------------------------------------------------------
-- Trips and who is on them
-- ---------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  title text not null default 'Untitled trip',
  destination text not null default '',
  start_date date,
  end_date date,
  cover_emoji text not null default '🌍',
  activities jsonb not null default '[]'::jsonb,   -- bookings; "who" holds member ids
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_start_idx on public.trips (start_date desc);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  can_edit boolean not null default false,
  added_at timestamptz not null default now(),
  primary key (trip_id, member_id)
);
create index trip_members_member_idx on public.trip_members (member_id);

create or replace function public.can_view_trip(_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.trip_members tm
    join public.members m on m.id = tm.member_id
    where tm.trip_id = _trip and m.user_id = auth.uid()
  )
$$;

create or replace function public.can_edit_trip(_trip uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.trip_members tm
    join public.members m on m.id = tm.member_id
    where tm.trip_id = _trip and m.user_id = auth.uid() and tm.can_edit
  )
$$;

-- ---------------------------------------------------------------------
-- Voting: propose a few options, family votes, admin picks one
-- ---------------------------------------------------------------------
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  question text not null,
  day_index int,                    -- optional: which day this is for
  status text not null default 'open' check (status in ('open', 'closed')),
  chosen_option_id uuid,
  closes_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index polls_trip_idx on public.polls (trip_id, created_at desc);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  activity jsonb not null,          -- same shape as a booking
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.polls
  add constraint polls_chosen_fk foreign key (chosen_option_id)
  references public.poll_options(id) on delete set null;

create table public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (poll_id, member_id)  -- one vote per person; changing it replaces it
);

-- ---------------------------------------------------------------------
-- Email import (admin's review inbox)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  inbox_code text not null unique default encode(gen_random_bytes(4), 'hex'),
  created_at timestamptz not null default now()
);

create table public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'paste',
  from_email text,
  to_email text,
  subject text,
  body text not null default '',
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now()
);
create index inbound_emails_user_idx on public.inbound_emails (user_id, created_at desc);

create table public.parsed_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_id uuid references public.inbound_emails(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  booking jsonb not null,
  booking_date date,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index parsed_bookings_user_idx on public.parsed_bookings (user_id, status, created_at desc);

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trips_touch before update on public.trips
  for each row execute function public.touch_updated_at();
create trigger members_touch before update on public.members
  for each row execute function public.touch_updated_at();

-- On sign-up: create a profile and link the login to the matching person
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;

  update public.members set user_id = new.id
   where lower(email) = lower(new.email) and user_id is null;

  -- the configured admin always ends up as admin
  if lower(new.email) = (select lower(admin_email) from public.app_settings) then
    insert into public.members (user_id, name, email, role)
    values (new.id, split_part(new.email, '@', 1), new.email, 'admin')
    on conflict do nothing;
    update public.members set role = 'admin' where user_id = new.id;
  end if;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Members may not promote themselves or edit others (admin only)
-- (enforced by RLS below; this trigger blocks role changes by non-admins
--  in case an update policy is ever widened)
create or replace function public.guard_member_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only the admin can change roles';
  end if;
  return new;
end; $$;
create trigger members_guard_role before update on public.members
  for each row execute function public.guard_member_role();

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.members         enable row level security;
alter table public.trips           enable row level security;
alter table public.trip_members    enable row level security;
alter table public.polls           enable row level security;
alter table public.poll_options    enable row level security;
alter table public.poll_votes      enable row level security;
alter table public.profiles        enable row level security;
alter table public.inbound_emails  enable row level security;
alter table public.parsed_bookings enable row level security;

-- members: admin sees/manages everyone; others see themselves + people on their trips
create policy members_select on public.members for select to authenticated using (
  public.is_admin()
  or user_id = auth.uid()
  or exists (
    select 1 from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.member_id = public.current_member_id() and theirs.member_id = members.id
  )
);
create policy members_admin_insert on public.members for insert to authenticated with check (public.is_admin());
create policy members_admin_update on public.members for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy members_self_update  on public.members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_admin_delete on public.members for delete to authenticated using (public.is_admin());

-- trips
create policy trips_select on public.trips for select to authenticated using (public.can_view_trip(id));
create policy trips_insert on public.trips for insert to authenticated with check (public.is_admin());
create policy trips_update on public.trips for update to authenticated using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));
create policy trips_delete on public.trips for delete to authenticated using (public.is_admin());

-- trip_members: visible to anyone on the trip; only admin changes it
create policy trip_members_select on public.trip_members for select to authenticated using (public.can_view_trip(trip_id));
create policy trip_members_admin  on public.trip_members for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- polls + options: anyone on the trip sees them; editors manage them
create policy polls_select on public.polls for select to authenticated using (public.can_view_trip(trip_id));
create policy polls_write  on public.polls for all to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy poll_options_select on public.poll_options for select to authenticated using (
  exists (select 1 from public.polls p where p.id = poll_id and public.can_view_trip(p.trip_id)));
create policy poll_options_write on public.poll_options for all to authenticated using (
  exists (select 1 from public.polls p where p.id = poll_id and public.can_edit_trip(p.trip_id)))
  with check (exists (select 1 from public.polls p where p.id = poll_id and public.can_edit_trip(p.trip_id)));

-- votes: everyone on the trip sees votes; you can only cast/change/remove your own, while open
create policy poll_votes_select on public.poll_votes for select to authenticated using (
  exists (select 1 from public.polls p where p.id = poll_id and public.can_view_trip(p.trip_id)));
create policy poll_votes_own on public.poll_votes for all to authenticated
  using (member_id = public.current_member_id())
  with check (
    member_id = public.current_member_id()
    and exists (select 1 from public.polls p
                where p.id = poll_id and p.status = 'open' and public.can_view_trip(p.trip_id))
    and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = poll_votes.poll_id)
  );

-- profiles + inbox: your own rows only
create policy profiles_own on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy inbound_emails_own on public.inbound_emails for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy parsed_bookings_own on public.parsed_bookings for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.members, public.trips, public.trip_members, public.polls,
  public.poll_options, public.poll_votes, public.profiles,
  public.inbound_emails, public.parsed_bookings
to authenticated;
grant all on all tables in schema public to service_role;

revoke execute on function public.handle_new_user(), public.touch_updated_at(), public.guard_member_role()
  from public, anon, authenticated;
revoke execute on function public.is_admin(), public.current_member_id(),
  public.can_view_trip(uuid), public.can_edit_trip(uuid) from public, anon;
grant execute on function public.is_admin(), public.current_member_id(),
  public.can_view_trip(uuid), public.can_edit_trip(uuid) to authenticated, service_role;
