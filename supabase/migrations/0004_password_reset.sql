-- Elfelejtett jelszó.
--
-- Külön tábla, nem a regisztrációs kódoké: egy regisztrációhoz kiküldött kód
-- ne legyen felhasználható jelszó-visszaállításra, és fordítva sem.
--
-- Itt sincs policy, az RLS pedig be van kapcsolva, tehát az appba fordított
-- anon kulcs nem éri el. Csak a service role kulcs, a szerver oldalon.

create table if not exists app_reset_codes (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

alter table app_reset_codes enable row level security;

-- A takarítás erre is terjedjen ki.
create or replace function purge_expired_auth() returns void
language sql
as $$
  delete from app_signup_codes where expires_at < now();
  delete from app_reset_codes where expires_at < now();
  delete from app_sessions where expires_at < now();
$$;
