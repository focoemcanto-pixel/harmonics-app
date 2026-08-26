import fs from 'node:fs';

function patchFile(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  let changed = false;

  for (const { oldText, newText, marker } of replacements) {
    if (marker && source.includes(marker)) continue;
    if (!source.includes(oldText)) {
      throw new Error(`[automation invite patch] Trecho esperado não encontrado em ${path}: ${oldText.slice(0, 140)}`);
    }
    source = source.replace(oldText, newText);
    changed = true;
  }

  if (changed) fs.writeFileSync(path, source);
  console.log(`[automation invite patch] ${path}: ${changed ? 'atualizado' : 'já aplicado'}`);
}

patchFile('components/automacoes/RegrasPageClient.js', [
  {
    oldText: "  const [enviandoManual, setEnviandoManual] = useState(false);",
    newText: "  const [enviandoManual, setEnviandoManual] = useState(false);\n  const [entityOptions, setEntityOptions] = useState([]);\n  const [loadingEntityOptions, setLoadingEntityOptions] = useState(false);",
    marker: 'const [entityOptions, setEntityOptions] = useState([]);',
  },
  {
    oldText: "  async function enviarTeste(preset) {\n    setManualForm((prev) => ({ ...prev, eventType: preset.event_type }));\n    setManualModalAberto(true);\n  }",
    newText: "  async function loadEntityOptions(eventType) {\n    if (!eventType) {\n      setEntityOptions([]);\n      return;\n    }\n    try {\n      setLoadingEntityOptions(true);\n      const response = await fetch('/api/automation/entity-options?eventType=' + encodeURIComponent(eventType), { cache: 'no-store' });\n      const payload = await response.json().catch(() => ({}));\n      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Não foi possível listar opções para teste.');\n      setEntityOptions(Array.isArray(payload.options) ? payload.options : []);\n    } catch (error) {\n      setEntityOptions([]);\n      toast.error(error.message || 'Não foi possível carregar contratos/eventos para teste.');\n    } finally {\n      setLoadingEntityOptions(false);\n    }\n  }\n\n  async function enviarTeste(preset) {\n    const eventType = preset.event_type;\n    setManualForm((prev) => ({ ...prev, eventType, entityId: '' }));\n    setManualModalAberto(true);\n    await loadEntityOptions(eventType);\n  }",
    marker: 'async function loadEntityOptions(eventType)',
  },
  {
    oldText: "              <select value={manualForm.eventType} onChange={(e) => setManualForm((f) => ({ ...f, eventType: e.target.value }))} className=\"w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm\">\n                {EVENT_TYPES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}\n              </select>\n\n              <input\n                type=\"text\"\n                value={manualForm.entityId}\n                onChange={(e) => setManualForm((f) => ({ ...f, entityId: e.target.value }))}\n                placeholder=\"ID da entidade (ex.: invite_id, event_id, contract_id)\"\n                className=\"w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm\"\n              />",
    newText: "              <select\n                value={manualForm.eventType}\n                onChange={async (e) => {\n                  const eventType = e.target.value;\n                  setManualForm((f) => ({ ...f, eventType, entityId: '' }));\n                  await loadEntityOptions(eventType);\n                }}\n                className=\"w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm\"\n              >\n                {EVENT_TYPES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}\n              </select>\n\n              <div>\n                <label className=\"mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-slate-500\">\n                  Registro para o teste\n                </label>\n                <select\n                  value={manualForm.entityId}\n                  onChange={(e) => setManualForm((f) => ({ ...f, entityId: e.target.value }))}\n                  disabled={loadingEntityOptions}\n                  className=\"w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm disabled:bg-slate-50 disabled:text-slate-400\"\n                >\n                  <option value=\"\">{loadingEntityOptions ? 'Carregando...' : 'Selecione pelo nome e data'}</option>\n                  {entityOptions.map((option) => (\n                    <option key={(option.kind || 'entity') + '-' + option.id + '-' + (option.contractId || '')} value={option.id}>\n                      {option.label}{option.subtitle ? ' — ' + option.subtitle : ''}\n                    </option>\n                  ))}\n                </select>\n                {!loadingEntityOptions && entityOptions.length === 0 ? (\n                  <p className=\"mt-2 text-xs font-semibold text-amber-700\">Nenhum registro disponível para este gatilho.</p>\n                ) : null}\n              </div>",
    marker: 'Selecione pelo nome e data',
  },
]);

patchFile('app/api/events/[id]/scale/route.js', [
  {
    oldText: "import { diffEscala } from '@/lib/escalas/escalas-sync';",
    newText: "import { diffEscala } from '@/lib/escalas/escalas-sync';\nimport { sendInviteService } from '@/lib/whatsapp/send-invite-service';",
    marker: "send-invite-service';",
  },
  {
    oldText: "    const { data: escalaFinal, error: escalaFinalError } = await supabase\n      .from('event_musicians')\n      .select('event_id, musician_id, role, status, notes, confirmed_at')\n      .eq('event_id', eventId);\n    if (escalaFinalError) throw escalaFinalError;\n\n    return NextResponse.json({",
    newText: "    const { data: escalaFinal, error: escalaFinalError } = await supabase\n      .from('event_musicians')\n      .select('event_id, musician_id, role, status, notes, confirmed_at')\n      .eq('event_id', eventId);\n    if (escalaFinalError) throw escalaFinalError;\n\n    // O envio automático passa a nascer no backend no mesmo fluxo do salvamento da escala.\n    // Assim não dependemos de uma segunda chamada do navegador para disparar os convites.\n    const { data: pendingDispatchInvites, error: pendingDispatchError } = await supabase\n      .from('invites')\n      .select('id, status, whatsapp_sent_at')\n      .eq('event_id', eventId)\n      .neq('status', 'removed')\n      .is('whatsapp_sent_at', null);\n    if (pendingDispatchError) throw pendingDispatchError;\n\n    const inviteDispatchResults = [];\n    for (const invite of pendingDispatchInvites || []) {\n      const result = await sendInviteService({ inviteId: invite.id, supabaseAdmin: supabase });\n      const sent = Number(result?.data?.sent || 0);\n      const skipped = result?.data?.skipped === true;\n      const ok = result?.ok === true && (sent > 0 || skipped);\n      inviteDispatchResults.push({\n        inviteId: invite.id,\n        ok,\n        sent,\n        skipped,\n        error: ok ? null : result?.error || result?.data?.error || result?.data?.warning || 'Envio não confirmado pelo provider',\n      });\n    }\n\n    const automaticSent = inviteDispatchResults.filter((item) => item.sent > 0).length;\n    const automaticSkipped = inviteDispatchResults.filter((item) => item.skipped).length;\n    const automaticFailed = inviteDispatchResults.filter((item) => !item.ok).length;\n\n    return NextResponse.json({",
    marker: 'const inviteDispatchResults = [];',
  },
  {
    oldText: "        removidosConvites: removidosIds.length,\n      },",
    newText: "        removidosConvites: removidosIds.length,\n        automaticSent,\n        automaticSkipped,\n        automaticFailed,\n      },\n      inviteDispatch: {\n        total: inviteDispatchResults.length,\n        sent: automaticSent,\n        skipped: automaticSkipped,\n        failed: automaticFailed,\n        results: inviteDispatchResults,\n      },",
    marker: 'automaticSent,',
  },
]);

patchFile('components/eventos/EventoEscalaTab.js', [
  {
    oldText: "  return {\n    novos: Number(data?.stats?.novosConvites || 0),\n  };",
    newText: "  return {\n    novos: Number(data?.stats?.novosConvites || 0),\n    inviteDispatch: data?.inviteDispatch || null,\n  };",
    marker: 'inviteDispatch: data?.inviteDispatch || null',
  },
  {
    oldText: "    await persistirEscala();\n    if (!isMountedRef.current) return;\n    console.info('[automation][step] salvar_escala_persisted', { eventId });\n\n    const response = await fetch('/api/whatsapp/send-event-invites', {",
    newText: "    const persistResult = await persistirEscala();\n    if (!isMountedRef.current) return;\n    console.info('[automation][step] salvar_escala_persisted', { eventId, inviteDispatch: persistResult?.inviteDispatch || null });\n\n    const backendDispatch = persistResult?.inviteDispatch;\n    if (backendDispatch && Number(backendDispatch.total || 0) > 0) {\n      const sentCount = Number(backendDispatch.sent || 0);\n      const failedCount = Number(backendDispatch.failed || 0);\n      if (failedCount > 0 && sentCount === 0) {\n        const firstError = backendDispatch?.results?.find?.((item) => !item?.ok)?.error;\n        throw new Error(firstError || 'Escala salva, mas ' + failedCount + ' convite(s) falharam no envio automático.');\n      }\n      if (failedCount > 0) {\n        setSucesso('Escala salva. Envio parcial: ' + sentCount + ' convite(s) enviado(s) e ' + failedCount + ' falha(s).');\n        return;\n      }\n      setSucesso('Escala salva e ' + sentCount + ' convite(s) enviado(s) automaticamente.');\n      return;\n    }\n\n    // Fallback para eventos antigos/sem pendências encontradas no salvamento.\n    const response = await fetch('/api/whatsapp/send-event-invites', {",
    marker: 'const backendDispatch = persistResult?.inviteDispatch;',
  },
]);

patchFile('lib/whatsapp/send-whatsapp-message.js', [
  {
    oldText: "  if (!response.ok) {\n    console.error('[sendWhatsAppMessage][debug] provider_error_response', {",
    newText: "  const semanticFailure =\n    data?.success === false ||\n    data?.ok === false ||\n    String(data?.status || '').toLowerCase() === 'error' ||\n    String(data?.status || '').toLowerCase() === 'failed';\n\n  if (!response.ok || semanticFailure) {\n    console.error('[sendWhatsAppMessage][debug] provider_error_response', {",
    marker: 'const semanticFailure =',
  },
]);

console.log('[automation invite patch] concluído');
