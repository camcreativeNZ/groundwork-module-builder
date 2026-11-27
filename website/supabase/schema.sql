-- Groundwork website database: accounts, teams, seats and progress.
-- Paste this whole file into Supabase > SQL Editor > New query, then select Run.
-- It is safe to run again: it only creates what is missing and replaces the rules.

-- ---------- Tables ----------

-- A team is whoever bought seats: one person, or a company.
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'My team',
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- A licence is one purchase of seats on a plan, renewed yearly by Stripe.
create table if not exists public.licences (
  id                   uuid primary key default gen_random_uuid(),
  team_id              uuid not null references public.teams (id) on delete cascade,
  plan                 text not null check (plan in ('foundations', 'full')),
  seats                integer not null check (seats > 0),
  status               text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  renews_at            timestamptz not null,
  stripe_customer      text,
  stripe_subscription  text unique,
  created_at           timestamptz not null default now()
);

-- Who is in a team. Invited people have an email but no user yet; they are linked when they sign up.
create table if not exists public.members (
  team_id     uuid not null references public.teams (id) on delete cascade,
  email       text not null,
  user_id     uuid references auth.users (id) on delete set null,
  role        text not null default 'learner' check (role in ('admin', 'learner')),
  learner     boolean not null default true,      -- an admin may manage without taking a seat
  invited_at  timestamptz not null default now(),
  primary key (team_id, email)
);
create index if not exists members_user_idx on public.members (user_id);

-- One row per learner per module. Saved by the module player as the learner works.
create table if not exists public.progress (
  user_id       uuid not null references auth.users (id) on delete cascade,
  module_id     text not null,
  status        text not null default 'incomplete' check (status in ('incomplete', 'completed')),
  passed        boolean,
  score         real,                                -- 0 to 1 (the share of quiz questions right)
  score_raw     real,
  score_max     real,
  location      text,
  suspend_data  text,
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (user_id, module_id)
);

-- Columns added after the first version (safe to run again).
alter table public.progress add column if not exists score_raw real;
alter table public.progress add column if not exists score_max real;

-- ---------- Helpers ----------

-- The best plan the signed-in person can use right now: 'full', 'foundations' or null.
create or replace function public.my_plan()
returns text language sql stable security definer set search_path = public as $$
  select case
    when bool_or(l.plan = 'full') then 'full'
    when bool_or(l.plan = 'foundations') then 'foundations'
  end
  from members m
  join licences l on l.team_id = m.team_id
  where m.user_id = auth.uid() and m.learner
    and l.status in ('active', 'past_due') and l.renews_at > now();
$$;

-- Teams the signed-in person administers (used by the security rules below).
create or replace function public.is_team_admin(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where team_id = t and user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_team_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where team_id = t and user_id = auth.uid());
$$;

-- When someone signs up, link any invitations sent to their email.
create or replace function public.link_invites()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update members set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.link_invites();

-- ---------- Security rules (row level security) ----------
-- The website's public key can only do what these rules allow.
-- Licences and teams are only created by the server after payment (it uses the secret key).

alter table public.teams    enable row level security;
alter table public.licences enable row level security;
alter table public.members  enable row level security;
alter table public.progress enable row level security;

drop policy if exists "members see their team" on public.teams;
create policy "members see their team" on public.teams
  for select using (public.is_team_member(id));

drop policy if exists "members see their licences" on public.licences;
create policy "members see their licences" on public.licences
  for select using (public.is_team_member(team_id));

drop policy if exists "see yourself and, as admin, your team" on public.members;
create policy "see yourself and, as admin, your team" on public.members
  for select using (user_id = auth.uid() or public.is_team_admin(team_id));

drop policy if exists "own progress: read" on public.progress;
create policy "own progress: read" on public.progress
  for select using (user_id = auth.uid());

drop policy if exists "own progress: add" on public.progress;
create policy "own progress: add" on public.progress
  for insert with check (user_id = auth.uid() and public.my_plan() is not null);

drop policy if exists "own progress: update" on public.progress;
create policy "own progress: update" on public.progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Team admins can see their learners' progress (for reports in stage 2).
drop policy if exists "admins see team progress" on public.progress;
create policy "admins see team progress" on public.progress
  for select using (exists (
    select 1 from public.members m
    where m.user_id = progress.user_id and public.is_team_admin(m.team_id)
  ));

grant execute on function public.my_plan() to authenticated;
