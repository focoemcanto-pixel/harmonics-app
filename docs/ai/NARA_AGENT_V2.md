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
- Modelo de teste: AI_NARA_V2_MODEL (padrão gpt-6.1-sol, para comparar inteligência avançada com o GPT-4.1-mini atual). Produção atual permanece com seu próprio AI_INBOX_MODEL.
- Limite por turno: até seis etapas, teto de tempo de 45s, até 1200 tokens de saída por etapa, sem armazenamento da requisição pela API (store=false).
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

## Pesquisa de locais e rota rodoviária

Habilite no ambiente do Chat de Testes com `AI_NARA_ROAD_GEO_ENABLED=true`, após aplicar a migração do cache e conferir as credenciais. A origem vem de `ai_workspace_settings.logistics_rules.origin`. Cadastre o ponto de saída como `latitude,longitude` para o OSRM.

- `AI_NARA_NOMINATIM_URL` aponta para uma instância HTTPS própria ou contratada com permissão de cache e quotas aplicadas pelo provedor. O fluxo novo não usa o Nominatim público da OSMF. Veja a [política de uso](https://operations.osmfoundation.org/policies/nominatim/).
- `AI_NARA_OSRM_URL` aponta para uma instância HTTPS própria ou contratada do [OSRM](https://project-osrm.org/docs/v26.6.1/http.html), perfil carro. Sem esse endereço, a cotação externa fica pendente.
- Para locais novos, a busca direta na web precede a confirmação no mapa. Ela requer `AI_VENUE_WEB_SEARCH_ENABLED=true` e `OPENAI_API_KEY`. Ela é faturável. Um endereço citado é apenas uma pista e precisa ser corroborado pelo mapa. Use limites de consumo no provedor.
- Precedência aprovada para sobreposição: até 120 km prevalece sobre metro. Áreas-base explícitas e exceções cadastradas continuam aplicáveis. Acima de 120 km, acima do limite de tempo ou fora da Bahia, o caso é personalizado. Uma cidade sem endereço usa o ponto do município para a estimativa inicial. Confirme o espaço e o horário no pré-contrato.
- O cache de teste tem namespace separado, acesso apenas do servidor e chave por workspace, consulta, endereço, origem e versão dos mapas. Ajuste `AI_NARA_MAPS_REVISION` quando trocar os mapas ou o perfil de rota. Evidência OSRM válida dura sete dias, pendências duram quinze minutos. Preços são consultados no banco a cada cotação, com a vigência da data do evento.

## Prévia isolada da PR 839

O build antigo usa `wrangler versions upload`. A URL de versão desse
comando usa os vínculos do Worker e não recebe automaticamente os segredos
da configuração Previews Base. A prévia nativa `nara-v2-pr839` tem seu
próprio deploy. O segredo `AI_NARA_GEOAPIFY_API_KEY` fica em Previews Base
e é copiado pelo Cloudflare quando a prévia é criada. A partir daí,
novos deploys da mesma prévia reutilizam o vínculo. Para rotacionar uma
chave, atualize a base para futuras prévias e a prévia existente pelo
gerenciador de segredos do Cloudflare.

Prepare o build com `NEXT_PUBLIC_SUPABASE_URL=https://xsmdnbovjovfvdgnncje.supabase.co`
e `NEXT_PUBLIC_SUPABASE_ANON_KEY` do projeto `harmonics-saas-dev`.
Configure na prévia este mesmo projeto e chave pública, o
`SUPABASE_SERVICE_ROLE_KEY` de desenvolvimento e um `OPENAI_API_KEY`
autorizado para o modelo de teste. Use as configurações protegidas do
ambiente para provisionar credenciais. Depois de confirmar as credenciais,
publique com:

```sh
npx opennextjs-cloudflare build
npx --yes wrangler@4.135.0 preview --name nara-v2-pr839 --config wrangler.nara-preview.toml
```

A homologação acontece no Chat de Testes autenticado da prévia. Para cada
local, inicie uma conversa nova para conferir a primeira consulta e outra
para conferir o reaproveitamento. Registre a rota, a faixa, o texto da
tabela, a gravação no cache e a repetição com `cache: hit` e `calls: []`.
