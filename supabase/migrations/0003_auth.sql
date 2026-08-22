-- Fiókok és bejelentkezés.
--
-- Ezekhez a táblákhoz az alkalmazásba fordított anon kulcs SEM olvasni, sem
-- írni nem tud: RLS be van kapcsolva, és szándékosan NINCS egyetlen policy
-- sem. Kizárólag a service role kulcs fér hozzájuk, az pedig csak a szerver
-- oldali API útvonalakon él, sosem kerül a kliensbe.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Felhasználók
-- ---------------------------------------------------------------------------
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  -- Mindig kisbetűsen tároljuk, hogy a "Sim@x.hu" és a "sim@x.hu" ugyanaz
  -- a fiók legyen.
  email text not null unique,
  -- scrypt: "scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>". Sosem jelszó.
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table app_users enable row level security;

-- ---------------------------------------------------------------------------
-- Függőben lévő regisztrációk
--
-- A fiók csak a kód beírása után jön létre, addig itt vár. Így egy meg nem
-- erősített email cím nem foglalja le magát a felhasználók között.
-- ---------------------------------------------------------------------------
create table if not exists app_signup_codes (
  email text primary key,
  -- A kód is hashelve van: egy adatbázis-szivárgás így sem engedne senkit
  -- befejezni egy idegen regisztrációt.
  code_hash text not null,
  password_hash text not null,
  expires_at timestamptz not null,
  -- Néhány rossz próbálkozás után a kód érvénytelen lesz.
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

alter table app_signup_codes enable row level security;

-- ---------------------------------------------------------------------------
-- Munkamenetek
-- ---------------------------------------------------------------------------
create table if not exists app_sessions (
  -- Csak a token hash-e van eltárolva; magát a tokent csak az eszköz ismeri.
  token_hash text primary key,
  user_id uuid not null references app_users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists app_sessions_user_idx on app_sessions (user_id);

alter table app_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- Takarítás
--
-- Lejárt kódok és munkamenetek eltávolítása. Hívható a Supabase ütemezőjéből,
-- de a bejelentkezés akkor is helyes marad, ha soha nem fut le: minden
-- ellenőrzés nézi a lejáratot.
-- ---------------------------------------------------------------------------
create or replace function purge_expired_auth() returns void
language sql
as $$
  delete from app_signup_codes where expires_at < now();
  delete from app_sessions where expires_at < now();
$$;
