-- Noite a Dois — planos de conta: gratuito < premium < admin.
-- Rode no SQL Editor do projeto (depois de 20261101120000_inicial.sql).
--
-- • gratuito: o jogo completo, com as cartas padrão (surpresa) e os limites de "O que vale hoje".
-- • premium:  cria e edita as próprias cartas (com foto), escolhe a pedra do dado.
-- • admin:    tudo do premium + área do desenvolvedor (todas as cartas, modo de teste, ver como outro plano).
--
-- O jogador NUNCA muda o próprio plano: o gatilho abaixo ignora qualquer tentativa vinda do app
-- (papéis anon/authenticated). Só o SQL Editor ou a service role alteram o plano.

alter table public.perfis
  add column if not exists plano text not null default 'gratuito'
  check (plano in ('gratuito', 'premium', 'admin'));

-- contas que já existem hoje viram admin (inclusive quem ainda não tinha perfil salvo)
insert into public.perfis (id) select id from auth.users on conflict (id) do nothing;
update public.perfis set plano = 'admin';

create or replace function public.proteger_plano() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.plano := 'gratuito';      -- conta nova pelo app começa sempre no gratuito
    else
      new.plano := old.plano;       -- o app não consegue trocar o plano
    end if;
  end if;
  return new;
end $$;

drop trigger if exists perfis_plano on public.perfis;
create trigger perfis_plano before insert or update on public.perfis
  for each row execute function public.proteger_plano();

-- Para mudar o plano de alguém depois (no SQL Editor):
--   update public.perfis set plano = 'premium'
--   where id = (select id from auth.users where email = 'pessoa@exemplo.com');
