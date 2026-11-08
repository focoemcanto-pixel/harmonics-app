# Componentes de terceiros — Harmonics AI comercial

Inspecionados por `git clone --depth 1` fora do repositório em 2026-11-08. Nenhuma aplicação
completa foi instalada; apenas ideias/trechos condensados ou integração via HTTP.

| Projeto | Licença | Uso no Harmonics | Decisão |
|---|---|---|---|
| [jmbluhm/b2b-sales-skills](https://github.com/jmbluhm/b2b-sales-skills) | Apache-2.0 | `strategies.mjs`: Chris Voss (empatia tática, perguntas calibradas), SPIN, LAER, Feel-Felt-Found e scripts de objeção, **traduzidos e condensados** (modificados). | Reutilizado (texto adaptado, com atribuição). |
| [TheCraigHewitt/skills](https://github.com/TheCraigHewitt/skills) | MIT | `strategies.mjs`: princípios ACRC de `sales/objection-handling`, `sales/negotiation`; cadência de `sales/outbound-sequence` como referência para os follow-ups 2/5/10 dias. | Reutilizado (adaptado). |
| [mem0ai/mem0](https://github.com/mem0ai/mem0) | Apache-2.0 | `memory.mjs`: modelo de operações ADD/UPDATE/DELETE/NONE (`DEFAULT_UPDATE_MEMORY_PROMPT`) aplicado de forma **determinística** a campos estruturados, sem chamada extra de LLM. | SDK não usado: exige vector store e runtime Node/Python incompatíveis com Workers e aumentaria custo. |
| [langfuse/langfuse](https://github.com/langfuse/langfuse) | MIT (exceto `ee/`) | `observability.mjs`: exporta spans OTLP/HTTP JSON para `/api/public/otel/v1/traces` (endpoint OTel do Langfuse). Sem conteúdo de mensagem por padrão (LGPD). | SDK não usado (Node/OTel pesado para Workers); integração por HTTP, opcional por env. |
| [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | MIT | `evals/ai/`: suíte de avaliação com provider JavaScript local (`file://`), executada com `npx promptfoo` (não é dependência do app). | Reutilizado como ferramenta de teste. |
| [activepieces/activepieces](https://github.com/activepieces/activepieces) | MIT (exceto `packages/ee`) | Avaliado para follow-ups/automações. | Não instalado: plataforma completa com servidor próprio; o Harmonics já tem cron, fila transacional e automações. Follow-ups implementados na fila existente. |
