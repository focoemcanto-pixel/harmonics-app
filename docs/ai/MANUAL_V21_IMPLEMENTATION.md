# Harmonics AI — implementação do Manual Mestre v2.1

O manual (Markdown) é importado pelo Owner no painel (**Inteligência Comercial → Manual e tabelas**) e fica
no banco do workspace; não é versionado no repositório (contém cachês e margens internos).

| Manual | Implementação |
|---|---|
| §1–3, §16–19, §23 | Importação → conhecimento **pendente** por seção (estilo, respostas, políticas, pós-venda, exemplos). Itens "PENDENTE" exigem revisão; nada entra sem aprovação. Regra de ouro e identificação como IA no prompt. |
| §4, §7, §8 | Propostas de tabela pendentes → aprovadas pelo Owner em `quote_price_rules` com vigência (data do evento decide). Faixas por região via `ai_service_areas.price_tier` (`base`, `metro`, `ate120`, `custom`) e chaves `formação@faixa`; receptivo adicional só com cerimônia; apresentação por tempo em `other/show:<formação>_<h>h`. |
| §5, §6 | Deslocamento da banda e da equipe de som (área ou regra `transport/band_trip`, `transport/sound_trip`); som de referência só para cerimônia; por tempo/especial = sob medida (revisão). Acima de 2h/fora da Bahia = localidade `custom`/não cadastrada ⇒ humano. |
| §9 | Custo interno: vocalista principal sem cachê, tecladista com cachê próprio, extra por hora de receptivo só para contratados; margem mínima configurável (PENDENTE). Cachês/margens nunca vão ao cliente nem ao conhecimento. |
| §10 | Negociação em 5 passos (acolher → facilidades → Pix+cartão → outra formação → exceção via aprovação). Pedido de desconto não transfere de imediato. |
| §12 | Cadência por contexto (2 dias parceiro / 3 dias comparando, última tentativa +5), máximo 2, templates Meta, cancelamentos automáticos. |
| §13 | `vincular_evento` + `ai_conversation_participants`: vínculo verificado pelo responsável, permissões por participante; link do painel só para participante verificado com contrato assinado. |
| §14, §20.3 | Confirmação expressa → pré-contrato preparado em **rascunho** (modelo do tipo de evento) → **Contratos para aprovar** → aprovação da versão exata (hash) → envio único (`closing-link:<id>`); alteração material exige nova aprovação; rejeição devolve a conversa ao responsável. |
| §15 | Lembretes de assinatura (2/7/12 dias, templates) cancelados ao assinar/cancelar/expirar ou com takeover; expiração próxima na fila de Acompanhamentos. |
| §20 | Central com filas (Precisa do responsável, Contratos, Acompanhamentos, Aprendizado), telefone real, botão WhatsApp e atalho para o Inbox. |
| §20.4 | Autonomia: **supervisionado** (padrão), **assistido** (regras do Owner: tipos de evento, formações, valor máximo, receptivo) e **autônomo** (só casos convencionais). Só o Owner libera, com frase "LIBERAR AUTONOMIA"; qualquer admin revoga na hora; tudo em `ai_autonomy_events`. |

Migration: `20261110120000_harmonics_ai_manual_v21.sql` (aditiva; não altera `quote_price_rules` nem contratos).
Testes: `npm test`, `npm run test:ai-local` (inclui `ai-manual.local.test.mjs`), `npm run eval:ai`.
