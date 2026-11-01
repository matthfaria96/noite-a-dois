-- Noite a Dois — banco próprio (projeto Supabase separado do app de finanças).
-- Rode no SQL Editor do projeto novo.

create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome_ele text,
  nome_ela text,
  config jsonb not null default '{}'::jsonb,       -- volumes, narração, gráficos, duração...
  estatisticas jsonb not null default '{}'::jsonb, -- partidas jogadas, vitórias etc.
  atualizado_em timestamptz not null default now()
);

alter table public.perfis enable row level security;

-- cada pessoa só enxerga e altera o próprio perfil
create policy "perfil: ler o próprio" on public.perfis
  for select using (auth.uid() = id);
create policy "perfil: criar o próprio" on public.perfis
  for insert with check (auth.uid() = id);
create policy "perfil: alterar o próprio" on public.perfis
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "perfil: apagar o próprio" on public.perfis
  for delete using (auth.uid() = id);

create or replace function public.tocar_atualizado_em() returns trigger
language plpgsql as $$ begin new.atualizado_em = now(); return new; end $$;

drop trigger if exists perfis_atualizado on public.perfis;
create trigger perfis_atualizado before update on public.perfis
  for each row execute function public.tocar_atualizado_em();
