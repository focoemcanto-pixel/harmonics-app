# Finalização SaaS — checklist de progresso

Legenda: ✅ concluído · 🟡 parcial · ⛔ bloqueio externo · ⏳ pendente

## Fase 0 — Contenção de segurança
- ✅ 0.1 Matriz de acesso das 23 tabelas (`ACCESS_MATRIX.md`)
- ✅ 0.2 Escalonamento via `profiles.role` bloqueado no banco (trigger `trg_guard_profile_privilege_columns`), testado ao vivo
- ✅ 0.x RLS + revoke anon nas 23 tabelas, com políticas de compatibilidade (aplicado em produção 2026-10-14, migrations `20261014090000/0100/0200`)
- ⛔ 0.4 Storage: remoção da listagem (BE-1) e buckets privados (BE-2)
- ⛔ 0.5 Rotação do token Google (BE-3)
