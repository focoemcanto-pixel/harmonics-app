# Nara Agent v2 — arquitetura e validação

## Objetivo
Motor conversacional de teste em paralelo à Nara atual. Baseado no Vercel AI SDK 7 e no provedor oficial @ai-sdk/openai 4. Não há obrigatoriedade de uma ação comercial a cada mensagem. As ações sensíveis usam os validadores já existentes.

**URL do teste administrativo:** https://app.bandaharmonics.com/inbox/inteligencia?tab=chat&engine=v2

## Componentes
- lib/ai/agent/v2.mjs — ToolLoopAgent, contexto, memória e proteção de preços
- app/api/ai/commercial/chat-simulation/route.js — somente administradores autenticados; engine = v2 seleciona o novo fluxo
- components/inbox/ChatSimulationPanel.js — seletor de motor e deep-link; reinicia a conversa ao mudar
- lib/ai/commercial/engine.mjs — conhecimento ativo recuperado seletivamente do Supabase
- lib/ai/agent/tools.mjs — mesmas tabelas e ferramentas oficiais; preços não vêm do histórico
- createSimulationStore — alterações de estado, contratos e aprovações são simulados e não gravados na produção

## Regras essenciais
1. V2 só no simulador; não alterar nem habilitar o atendimento WhatsApp. Nenhuma ação real de contrato, reserva, pagamento ou envio.
2. O modelo decide entre responder naturalmente e chamar ferramentas. Não usa a ferramenta obrigatória de decisão conduzir_atendimento.
3. Preços somente a partir de tabelas e ferramentas oficiais. Não repetir tabela após pergunta explicativa.
4. Cerimônia e receptivo têm formações independentes. Interesse em receptivo sem especificação não significa Duo nem 1h.
5. Dados confirmados pelo cliente viram memória estruturada; históricos não são automaticamente políticas.
6. Fechamento exige escolha confirmada e resumo. Confirmação e próxima etapa do contrato são apenas simuladas.
7. Dúvidas de disponibilidade, descontos ou cláusulas exigem confirmação/aprovação, sem prometer ações não executadas.

## Configuração e segurança
- Dependências: ai 7, @ai-sdk/openai 4, lockfile versionado.
- Modelo de teste: AI_NARA_V2_MODEL (padrão gpt-4.1). Produção atual permanece com seu próprio AI_INBOX_MODEL.
- Limite por turno: até seis etapas, teto de tempo de 45s, sem armazenamento da requisição pela API (store=false).
- Os acessos de teste exigem guardWorkspaceAdmin.
- Voltar ao motor Atual desativa o teste v2 imediatamente, sem afetar a produção.
- Não há gravação de dados pessoais, conteúdos privados das 15 conversas ou mensagens reais do WhatsApp no repositório público.

## Qualidade
- npm test inclui tests/ai/nara-v2.test.mjs.
- CI executa testes, integração PostgreSQL e regressões do mecanismo atual.
- Comparar os dois motores com as mesmas situações: pedido inicial, Casa Rio, receptivo sem formação, receptivo Trio ou Duo com cerimônia diferente, dúvida sobre duração, objeção e fechamento com confirmação.
- Diagnósticos no simulador: modelo, tokens, custo e ferramentas.
- Os 90 cenários privados de avaliação são referência para testes adicionais; aprovação unitária não substitui conversas reais com o modelo.

## Skill / documentação
- https://github.com/vercel/ai
- https://ai-sdk.dev/docs/agents/building-agents
- https://developers.cloudflare.com/workers-ai/configuration/ai-sdk/
- Para agente de programação compatível com skills: npx skills add vercel/ai (skill de desenvolvimento, não motor de runtime).

**Gate:** não habilitar ai_enabled/Meta até aprovação explícita do responsável após avaliação conversacional.
