-- Flóra tudástára: klinikai irányelvek desztillált ajánlásai.
-- Futtatás: Supabase Dashboard -> SQL Editor -> beilleszt -> Run.

create table if not exists public.flora_knowledge (
  id         bigserial primary key,
  source     text not null,          -- pl. 'ESPEN 2019 (practical)'
  source_ref text,                   -- pl. 'Recommendation 12'
  topic      text not null,          -- pl. 'flare', 'remission', 'micronutrient'
  grade      text,                   -- evidenciafokozat: 'A' | 'B' | '0' | 'GPP'
  content    text not null,          -- tömör magyar ajánlás
  created_at timestamptz not null default now()
);

comment on table public.flora_knowledge is
  'Irányelvekből desztillált ajánlások Flóra rendszerpromptjához. Csak olvasható a kliensnek.';

-- A tábla nyilvánosan olvasható, de senki nem írhat az anon/authenticated kulccsal.
-- Szerkeszteni a Dashboardból vagy service_role kulccsal lehet.
alter table public.flora_knowledge enable row level security;

drop policy if exists "flora_knowledge_read" on public.flora_knowledge;
create policy "flora_knowledge_read"
  on public.flora_knowledge
  for select
  to anon, authenticated
  using (true);

-- Témára szűréshez, ha később kell. 189 sornál még nem szükséges, de olcsó.
create index if not exists flora_knowledge_topic_idx
  on public.flora_knowledge (topic);
