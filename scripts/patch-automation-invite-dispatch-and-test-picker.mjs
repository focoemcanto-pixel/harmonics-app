import fs from 'node:fs';

function patchIfPresent(path, oldText, newText, marker) {
  let source = fs.readFileSync(path, 'utf8');
  if (marker && source.includes(marker)) {
    console.log(`[automation invite patch] ${path}: já aplicado (${marker})`);
    return;
  }
  if (!source.includes(oldText)) {
    console.log(`[automation invite patch] ${path}: trecho já transformado/indisponível, seguindo sem falhar`);
    return;
  }
  source = source.replace(oldText, newText);
  fs.writeFileSync(path, source);
  console.log(`[automation invite patch] ${path}: atualizado`);
}

// Mantém somente o seletor amigável de registros na tela de teste.
// O envio de convites da escala NÃO é mais injetado aqui: existe um único caminho
// de disparo, explícito, após salvar a escala -> /api/whatsapp/send-event-invites.
patchIfPresent(
  'components/automacoes/RegrasPageClient.js',
  "  const [enviandoManual, setEnviandoManual] = useState(false);",
  "  const [enviandoManual, setEnviandoManual] = useState(false);\n  const [entityOptions, setEntityOptions] = useState([]);\n  const [loadingEntityOptions, setLoadingEntityOptions] = useState(false);",
  'const [entityOptions, setEntityOptions] = useState([]);'
);

patchIfPresent(
  'components/automacoes/RegrasPageClient.js',
  "  async function enviarTeste(preset) {\n    setManualForm((prev) => ({ ...prev, eventType: preset.event_type }));\n    setManualModalAberto(true);\n  }",
  "  async function loadEntityOptions(eventType) {\n    if (!eventType) {\n      setEntityOptions([]);\n      return;\n    }\n    try {\n      setLoadingEntityOptions(true);\n      const response = await fetch('/api/automation/entity-options?eventType=' + encodeURIComponent(eventType), { cache: 'no-store' });\n      const payload = await response.json().catch(() => ({}));\n      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Não foi possível listar opções para teste.');\n      setEntityOptions(Array.isArray(payload.options) ? payload.options : []);\n    } catch (error) {\n      setEntityOptions([]);\n      toast.error(error.message || 'Não foi possível carregar contratos/eventos para teste.');\n    } finally {\n      setLoadingEntityOptions(false);\n    }\n  }\n\n  async function enviarTeste(preset) {\n    const eventType = preset.event_type;\n    setManualForm((prev) => ({ ...prev, eventType, entityId: '' }));\n    setManualModalAberto(true);\n    await loadEntityOptions(eventType);\n  }",
  'async function loadEntityOptions(eventType)'
);

patchIfPresent(
  'components/automacoes/RegrasPageClient.js',
  `              <select value={manualForm.eventType} onChange={(e) => setManualForm((f) => ({ ...f, eventType: e.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm">\n                {EVENT_TYPES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}\n              </select>\n\n              <input\n                type="text"\n                value={manualForm.entityId}\n                onChange={(e) => setManualForm((f) => ({ ...f, entityId: e.target.value }))}\n                placeholder="ID da entidade (ex.: invite_id, event_id, contract_id)"\n                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"\n              />`,
  `              <select\n                value={manualForm.eventType}\n                onChange={async (e) => {\n                  const eventType = e.target.value;\n                  setManualForm((f) => ({ ...f, eventType, entityId: '' }));\n                  await loadEntityOptions(eventType);\n                }}\n                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"\n              >\n                {EVENT_TYPES.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}\n              </select>\n\n              <div>\n                <label className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-slate-500">\n                  Registro para o teste\n                </label>\n                <select\n                  value={manualForm.entityId}\n                  onChange={(e) => setManualForm((f) => ({ ...f, entityId: e.target.value }))}\n                  disabled={loadingEntityOptions}\n                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm disabled:bg-slate-50 disabled:text-slate-400"\n                >\n                  <option value="">{loadingEntityOptions ? 'Carregando...' : 'Selecione pelo nome e data'}</option>\n                  {entityOptions.map((option) => (\n                    <option key={(option.kind || 'entity') + '-' + option.id + '-' + (option.contractId || '')} value={option.id}>\n                      {option.label}{option.subtitle ? ' — ' + option.subtitle : ''}\n                    </option>\n                  ))}\n                </select>\n                {!loadingEntityOptions && entityOptions.length === 0 ? (\n                  <p className="mt-2 text-xs font-semibold text-amber-700">Nenhum registro disponível para este gatilho.</p>\n                ) : null}\n              </div>`,
  'Selecione pelo nome e data'
);

// Provider pode responder HTTP 2xx com payload semântico de falha.
patchIfPresent(
  'lib/whatsapp/send-whatsapp-message.js',
  "  if (!response.ok) {\n    console.error('[sendWhatsAppMessage][debug] provider_error_response', {",
  "  const semanticFailure =\n    data?.success === false ||\n    data?.ok === false ||\n    String(data?.status || '').toLowerCase() === 'error' ||\n    String(data?.status || '').toLowerCase() === 'failed';\n\n  if (!response.ok || semanticFailure) {\n    console.error('[sendWhatsAppMessage][debug] provider_error_response', {",
  'const semanticFailure ='
);

console.log('[automation invite patch] concluído — disparo de escala permanece em caminho único');
