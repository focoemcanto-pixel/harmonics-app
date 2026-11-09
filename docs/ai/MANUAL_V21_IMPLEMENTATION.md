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

## Identidade da assistente e organização das tabelas (v5)

- `ai_workspace_settings.assistant_company` (migration `20261111120000_harmonics_ai_assistant_identity.sql`, aditiva):
  a assistente se apresenta como "<assistant_name>, assistente da <assistant_company>"; nulo usa o nome público do workspace.
- Apresentação só na primeira resposta da IA na conversa; se o cliente já pediu orçamento, a apresentação vem na mesma
  mensagem da resposta objetiva (valores com data e local; senão, pede só data e local). Depois disso, sem reapresentação.
- Importação do Manual: seções com até 2.000 caracteres e corte nunca logo após o número de um item de lista.
- Cada proposta de preço importada recebe `metadata.official` (regras oficiais da mesma chave ou chave antiga equivalente)
  e `metadata.review.status` (`new`, `identical`, `same_value_new_key`, `differs`, `conflict`), exibidos no painel.
  Aprovação continua exigindo data de início e confirmação explícita, inclusive do aviso "sem data final".

## Sonorização por duração e preços de referência (v6)

- Regra única em `lib/quotes/sound-rules.mjs`, usada pela Nara, pela API `/api/quotes/analyze` e pela prévia de Orçamentos:
  `sound/church` (cerimônia), `sound/church_reception_<h>h` (h = 1..2) e o custo interno do técnico em
  `musician_fee/sound_tech[_reception_<h>h]` (nunca exibido ao cliente). Receptivo acima de 2h (ou fracionado) não tem preço
  automático: exige validação. Margem mínima do som: 500 (abaixo disso, a Nara pede aprovação e Orçamentos sinaliza).
- Compatibilidade: enquanto não existir regra `church_reception_<h>h` vigente na data, vale o esquema anterior
  (`church_reception` único). Assim o deploy do código não altera preços antes da troca de dados aprovada.
- `consultar_precos` passa a ler as regras oficiais vigentes na data do evento (como `calcular_orcamento`); a tabela do módulo
  Eventos (`pricing_settings`) fica só como reserva para itens sem regra oficial.
- Deslocamento da banda: a Nara usa `band_trip` ou, na falta, `standard_trip` (sem duplicar regras).
- Orçamentos: o custo do técnico aparece em `costs.soundTechCost` e entra no lucro estimado; a fórmula do preço sugerido não muda.
