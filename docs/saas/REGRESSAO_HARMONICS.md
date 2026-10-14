# Regressão da operação Harmonics — checklist pós-deploy (Fase 13)

Executar logo após o deploy desta branch, com a conta real da Harmonics, **sem criar dados de teste**
(só abrir telas e usar fluxos de leitura; ações de escrita apenas nas operações reais do dia).

| Área | O que verificar | Mudança desta entrega que toca a área |
|---|---|---|
| Login | entrar, sair, entrar de novo | esqueleto do app no lugar de "Verificando sessão" |
| Dashboard | números iguais aos de antes; sem eventos de outros tenants | consultas em paralelo; RLS sem bypass global |
| Eventos | lista, abrir evento, aba de preços (carregar e salvar preço) | preço via `/api/settings/pricing` |
| Escalas | montar escala, templates de formação, convites | templates por workspace; `/templates-escala` volta a funcionar |
| Contratos / pré-contratos | gerar, abrir link público, assinar, abrir PDF | link de PDF passa por `/api/public/files/contract/<token>` |
| Portal do cliente | abrir portal, ver preços, repertório, abrir PDF | preço resolvido pelo workspace do evento |
| Automações | listar/editar regras, templates e canais; testar canal | rotas exigem admin do workspace; ping só para wasenderapi.com |
| WhatsApp | um envio real do dia (convite/lembrete) | workspace legado mantém o caminho de envio anterior |
| Alertas admin | repertório enviado / pagamento informado pelo cliente | `workspaceId/eventId` repassado; Harmonics segue o caminho legado |
| Financeiro | `/pagamentos` e financeiro operacional | sem mudança funcional (custos padrão: ver decisão D-1) |
| Google / contrato | geração via Google (se usada) | nenhuma mudança (rotacionar token em BE-3) |
| Agenda do membro | painel `/membro` de um músico | patches de build incorporados (código idêntico ao produzido antes) |
| Configurações | equipe, workspace, assinatura (deve mostrar "Plano interno") | nova tela de assinatura |

Rollback: cada migration tem script em `supabase/rollbacks/`; o código é revertido pelo deploy anterior.
Interruptores: `ENFORCE_WORKSPACE_PLANS=false` desliga bloqueio por limite; `LEGACY_ENV_WORKSPACE_ID` fixa o workspace dono das variáveis de WhatsApp.
