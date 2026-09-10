-- Permite ao usuário autenticado ler a PRÓPRIA assinatura.
-- `subscriptions` está com RLS habilitado (sem policy), então o papel `authenticated`
-- não enxergava a linha — por isso o middleware usa service role. Esta policy só
-- CONCEDE leitura da própria linha; writes continuam via service role (webhook/trial).
alter table subscriptions enable row level security;

drop policy if exists "Users read own subscription" on subscriptions;
create policy "Users read own subscription"
  on subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);
