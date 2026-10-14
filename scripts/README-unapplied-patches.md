# Patches de source não aplicados

Os 22 scripts que rodavam no `prebuild` (e o `patch-member-player-order-and-playback.mjs`,
importado por um deles) foram incorporados ao código em 2026-10-14 e removidos: o build não
modifica mais arquivos versionados.

Restam dois scripts que **nunca estiveram no `prebuild`**, portanto nunca afetaram produção:

- `patch-invite-dedupe-source-truth.mjs` — altera `lib/automation/execute-automation-event.js`
- `patch-precontracts-finance.mjs` — altera a tela de pré-contratos (finanças)

Aplicá-los mudaria o comportamento atual. Ficam aqui apenas como referência; se forem
desejados, devem ser aplicados conscientemente, revisados e commitados como mudança de código.
