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

## Fonte única de preços: Eventos e painel do cliente (v7)

- `lib/quotes/official-prices.mjs`: preços por data do evento a partir de `quote_price_rules` (mesma regra da Nara e de
  Orçamentos). A tabela do módulo Eventos (`pricing_settings`) só cobre itens sem regra oficial (ex.: Solo e Septeto).
- Tela Eventos: o preenchimento automático (ao escolher formação, receptivo ou som) usa a data do evento. Eventos já salvos
  não são recalculados. `/api/settings/pricing` devolve `official_rules` sem custos internos (`musician_fee` nunca sai).
- Painel do cliente e repertório: ofertas de receptivo pela regra oficial vigente na data do evento.
- `lib/quotes/rule-change.mjs` + `POST /api/pricing/rules/preview` (somente Owner, somente leitura): planeja uma alteração
  com vigência — encerra na véspera a regra vigente, respeita regra futura, recusa início repetido e avisa retroatividade.

## Edição centralizada das tabelas com vigência (v8)

- Migration `20261112120000_price_rules_governance.sql`: leitura de `quote_price_rules` por membros ativos (custos
  internos `musician_fee` só Owner/Admin), **sem escrita pelo navegador**; tabela de auditoria `quote_price_rule_changes`;
  `price_rules_state_hash` e `apply_price_rule_change` (atômica, serializada por chave, recusa prévia desatualizada e
  início repetido, encerra a regra vigente na véspera e respeita regra futura).
- API: `GET /api/pricing/rules` (Owner/Admin), `POST /api/pricing/rules` (somente Owner, motivo e confirmação explícita),
  `POST /api/pricing/rules/preview` devolve `expected_hash`.
- Central → **Tabelas**: consulta por categoria, nova vigência com prévia, motivo e histórico.
- Tabela antiga do Eventos (`pricing_settings`): somente leitura (`PUT /api/settings/pricing` → 423). Os custos padrão do
  financeiro continuam editáveis na mesma aba.
- Orçamentos (`quotes`, com custos e lucro no snapshot): o navegador perde a escrita e a leitura fica restrita a
  Owner/Admin/Financeiro (o app acessa pelo servidor). A política de leitura da integração (`arm_read_quote`) é mantida.
- Custos padrão do financeiro (`finance_cost_defaults`, sem política de acesso no navegador): lidos e gravados pela nova rota
  `GET/PUT /api/settings/finance-costs` (somente Owner/Admin/Financeiro, escopo do workspace), usada pelas telas Eventos e
  Pagamentos.

## Conversas simuladas da assistente (sem WhatsApp)

`supabase/local/nara-sim.local.test.mjs` roda conversas completas pelo pipeline real (ingestão → regras → prompt →
ferramentas → fechamento supervisionado → envio falso) em Postgres local descartável, com dados sintéticos:

- 1º contato pedindo orçamento: apresentação única e resposta objetiva pela tabela vigente na data; sem reapresentação depois.
- Troca de vigência por data do evento e som por duração (0h/1h/2h); 3h ou mais vai para aprovação, sem total definitivo.
- Ferramentas nunca devolvem custo interno ao modelo.
- Desconto segue a negociação; link de contrato da IA é bloqueado; pedido de pessoa transfere; opt-out encerra.
- Fechamento: resumo determinístico, CONFIRMO prepara o pré-contrato e nenhum link sai sem aprovação.
- IA desligada globalmente não gera nada.

Modo padrão (CI): modelo roteirizado. Modo real: `OPENAI_API_KEY=... NARA_SIM_OUT=/caminho/transcricao.json npm run sim:nara`
(com o banco local já criado por `npm run test:ai-local`); grava a transcrição fora do repositório.
