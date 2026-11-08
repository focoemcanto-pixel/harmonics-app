# Harmonics AI — Inteligência Comercial (V3)

Continua `HYBRID_INBOX_V2.md`. **Tudo desligado por padrão**; só atua com a IA já liberada
(modo Automático/Rascunho) e com as chaves do painel ligadas. Painel: `/inbox/inteligencia` (admin).

## O que faz
| Área | Como | Garantias |
|---|---|---|
| Ensinar à IA | Regras, FAQs, políticas, rider, exemplos, respostas por intenção (`ai_knowledge_items`) | Toda versão nasce **pendente**; aprovar arquiva a anterior; rollback = reativar versão antiga; conflito resolvido por prioridade |
| Aprendizado | Respostas da equipe (Inbox e app Business) e correções de rascunho viram `ai_learning_suggestions`, agrupadas por padrão (≥3 = recorrente) | Nada entra em vigor sem aprovação |
| Memória | `lead_data` por cliente com operações ADD/UPDATE/DELETE (modelo mem0) auditadas em `ai_memory_events` | Prompt recebe só dados estruturados + 12 últimas mensagens |
| Recuperação | BM25 simplificado + intenção + prioridade, orçamento de caracteres, cache 60 s | Regras ≥ 90 sempre entram; pendentes nunca |
| Preço | `quote_price_rules` vigentes → `pricing_settings`; território (`ai_service_areas`) ou regra de km + distância rodoviária (Google) | Sem valor cadastrado = pendência, nunca invenção; condicional/margem baixa = aprovação; bloqueado = humano |
| Agenda e músicos | `events` + `event_musicians` + `invites`; catálogo `ai_musician_profiles` | Vocalista principal consultado em silêncio; substitutos só com conflito confirmado (ou pedido) e disponibilidade verificada; inconclusivo = revisão sem anunciar indisponibilidade |
| Rider | Conhecimento `rider` por formação/serviço | Sem rider cadastrado = equipe confirma |
| Vendas | 8 micro-estratégias (SPIN, Voss, ACRC/LAER) — no máx. 2 por resposta | Sem desconto, sem urgência artificial |
| CRM | `sales_stage`, objeções, motivo de perda, valor, histórico `ai_stage_events` | Funil e métricas em Negociações |
| Remarketing | `ai_followups` (padrão 2/5/10 dias) → template Meta fora da janela de 24h | Cancela com resposta, contratação, perda, opt-out ou humano |
| Fechamento | `preparar_fechamento` → resumo determinístico (data, formação, instrumentos/músicos, som, receptivo, total) → **CONFIRMO** → revalida preço/agenda → orçamento + pré-contrato nativos → link `/contrato/<token>` | Correção invalida; idempotente (1 fechamento aberto por conversa); contrato assinado nunca é alterado; sem dados pessoais |
| Pós-venda | Conhecimento `post_sale` + `obter_link_cliente` (`/cliente/<token>`) | Link só para contrato assinado do próprio número |
| Transferência | Resumo determinístico (`handoff_summary`) no Inbox; alerta WhatsApp ao responsável opcional | Humano assume ⇒ pendências da IA canceladas |
| Observabilidade | Langfuse via OTLP (`LANGFUSE_BASE_URL/PUBLIC_KEY/SECRET_KEY`) | Só metadados; conteúdo apenas com `LANGFUSE_CAPTURE_CONTENT=true` |

## Ativação (requer aprovação)
1. Migration `20261109120000_harmonics_ai_commercial_v3.sql` (aditiva).
2. Cadastrar em `/inbox/inteligencia`: preços já existentes no Orçamentos, localidades, músicos (marcar o vocalista principal), rider, políticas/FAQs — e aprovar.
3. Simulador confere o cálculo antes de ligar.
4. Ligar por etapas: estratégias → follow-ups (templates aprovados na Meta) → fechamento autônomo.

## Testes
`npm test` · `npm run test:ai-local` (Postgres 16) · `npm run eval:ai` (promptfoo, determinístico) · CI `Harmonics AI CI`.

## Rollback
`AI_INBOX_KILL_SWITCH=true` ou desligar no painel; desligar `autonomous_closing_enabled`/`followup_enabled`;
conhecimento: "Voltar para vN". Reverter o código remove só rotas/telas novas; tabelas `ai_*` podem ficar.

Origem e licenças dos componentes de terceiros: `lib/ai/commercial/THIRD_PARTY.md`.

## Inicialização da base (bootstrap)
Painel → Ensinar à IA → **Inicializar com dados do Harmonics** (prévia → criar). Fontes: tipos de evento,
modelos de contrato (pagamento, cancelamento, horários, estrutura/rider, alimentação, repertório),
mensagens oficiais para clientes, catálogo de momentos/estilos do repertório e funcionalidades do painel.
Cria sugestões `pending_approval` com `source='import'` e `metadata.origin {table,id,field}`; remove preços,
variáveis de template, datas, telefones e e-mails; não repete itens já importados nem conteúdo já ensinado;
não altera configurações. Localidades do histórico de eventos aparecem só como sugestão em Localidades.
Validação: `supabase/local/ai-panel.local.test.mjs` (handlers reais, sessão Owner sintética).
