# Segurança — advisors Fase 7

Projeto Supabase: `dppyamtmjzmmkzjlmiew` (`site`).

## Resultado `get_advisors` (security)

| Aviso | Nível | Ação |
|---|---|---|
| `is_admin()` / `current_profile_role()` executáveis por `authenticated` (SECURITY DEFINER) | WARN | **Intencional.** Políticas RLS chamam essas funções; `EXECUTE` já foi revogado de `anon`/`public`. Não revogar de `authenticated`. |
| Leaked password protection desabilitado | WARN | Habilitar no Dashboard Auth (HaveIBeenPwned). Fluxo principal é Discord OAuth. |

Nenhum lint **ERROR** crítico de RLS ausente nas tabelas de loja/conteúdo.

## Modelo RLS (resumo)

- Catálogo (`store_*`, `featured_items`): leitura pública do ativo; escrita `is_admin()`
- `orders` / `order_items`: insert/select do próprio user (`pending` no insert); update `paid` só via service role (webhook)
- `deliveries`: policy SELECT com `false` para client; escrita só service role (webhook / FiveM functions)
- Conteúdo home / regras / depoimentos: leitura pública (ou publicados); write admin

## Client

Grep Fase 7: sem `SERVICE_ROLE`, `sk_live`/`sk_test` ou secrets no `src/`. Apenas `VITE_*` públicos.
