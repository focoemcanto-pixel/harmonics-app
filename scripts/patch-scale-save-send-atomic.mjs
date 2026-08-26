import fs from 'node:fs';

function patch(path, mutate) {
  let source = fs.readFileSync(path, 'utf8');
  const before = source;
  source = mutate(source);
  if (source !== before) fs.writeFileSync(path, source);
  console.log(`[scale save+send atomic] ${path}: ${source !== before ? 'atualizado' : 'já aplicado/compatível'}`);
}

patch('app/api/events/[id]/scale/route.js', (source) => {
  if (!source.includes("send-invite-service")) {
    source = source.replace(
      "import { diffEscala } from '@/lib/escalas/escalas-sync';",
      "import { diffEscala } from '@/lib/escalas/escalas-sync';\nimport { sendInviteService } from '@/lib/whatsapp/send-invite-service';"
    );
  }

  if (!source.includes("const shouldSendInvites = body?.sendInvites === true;")) {
    source = source.replace(
      "    const escalaLocal = Array.isArray(body?.escalaLocal) ? body.escalaLocal : [];",
      "    const escalaLocal = Array.isArray(body?.escalaLocal) ? body.escalaLocal : [];\n    const shouldSendInvites = body?.sendInvites === true;"
    );
  }

  if (!source.includes('const dispatch = { requested: shouldSendInvites')) {
    const anchor = `    if (escalaFinalError) throw escalaFinalError;\n\n    return NextResponse.json({`;
    const replacement = `    if (escalaFinalError) throw escalaFinalError;\n\n    // Salvar + enviar acontece no MESMO request. Assim não dependemos de um\n    // segundo fetch do navegador, de estado stale nem de uma nova resolução de sessão.\n    // A deduplicação continua sendo whatsapp_sent_at: somente pending ainda não enviados.\n    const dispatch = { requested: shouldSendInvites, total: 0, successCount: 0, failedCount: 0, results: [], firstError: null };\n\n    if (shouldSendInvites) {\n      const { data: pendingInvites, error: pendingInvitesError } = await supabase\n        .from('invites')\n        .select('id, status, whatsapp_sent_at')\n        .eq('event_id', eventId)\n        .eq('status', 'pending')\n        .is('whatsapp_sent_at', null);\n      if (pendingInvitesError) throw pendingInvitesError;\n\n      const queue = (pendingInvites || []).filter((row) => isUuid(row?.id));\n      dispatch.total = queue.length;\n\n      for (const invite of queue) {\n        const result = await sendInviteService({ inviteId: invite.id, supabaseAdmin: supabase });\n        const sent = result?.ok === true && Number(result?.data?.sent || 0) > 0;\n        const skipped = result?.ok === true && result?.data?.skipped === true;\n        const ok = sent || skipped;\n        const error = ok ? null : result?.error || result?.data?.error || result?.data?.cause || result?.data?.warning || 'O convite não foi confirmado pelo provedor.';\n        dispatch.results.push({ inviteId: invite.id, ok, sent, skipped, error, response: result?.data || null });\n        if (ok) dispatch.successCount += 1;\n        else {\n          dispatch.failedCount += 1;\n          if (!dispatch.firstError) dispatch.firstError = error;\n        }\n      }\n    }\n\n    return NextResponse.json({`;
    if (!source.includes(anchor)) throw new Error('[scale save+send atomic] âncora do retorno da escala não encontrada');
    source = source.replace(anchor, replacement);
  }

  if (!source.includes('dispatch,\n      stats:')) {
    source = source.replace(
      "      escala: escalaFinal || [],\n      stats:",
      "      escala: escalaFinal || [],\n      dispatch,\n      stats:"
    );
  }

  return source;
});

patch('components/eventos/EventoEscalaTab.js', (source) => {
  source = source.replace('async function persistirEscala() {', 'async function persistirEscala({ sendInvites = false } = {}) {');
  source = source.replace(
    '    body: JSON.stringify({ escalaLocal: escalaLocalDedupe }),',
    '    body: JSON.stringify({ escalaLocal: escalaLocalDedupe, sendInvites }),'
  );
  source = source.replace(
    `  return {\n    novos: Number(data?.stats?.novosConvites || 0),\n  };`,
    `  return {\n    novos: Number(data?.stats?.novosConvites || 0),\n    dispatch: data?.dispatch || null,\n  };`
  );

  const start = source.indexOf('async function salvarEscala() {');
  const end = source.indexOf('\n\n  if (carregando) {', start);
  if (start === -1 || end === -1) throw new Error('[scale save+send atomic] handlers de salvar não encontrados');

  const handlers = `async function salvarEscala() {\n  try {\n    setSalvando(true);\n    setSucesso('');\n    await persistirEscala({ sendInvites: false });\n    if (!isMountedRef.current) return;\n    setSucesso('Escala salva com sucesso.');\n  } catch (e) {\n    console.error('[scale][save] failed', e);\n    if (!isMountedRef.current) return;\n    toast.error(e?.message || 'Erro ao salvar escala.');\n  } finally {\n    if (isMountedRef.current) setSalvando(false);\n  }\n}\n\nasync function salvarEEnviarConvites() {\n  try {\n    setSalvando(true);\n    setEnviandoConvites(true);\n    setSucesso('');\n    setInviteProgress({ current: 0, total: 0 });\n\n    const persisted = await persistirEscala({ sendInvites: true });\n    if (!isMountedRef.current) return;\n\n    const dispatch = persisted?.dispatch || {};\n    const total = Number(dispatch?.total || 0);\n    const sentCount = Number(dispatch?.successCount || 0);\n    const failedCount = Number(dispatch?.failedCount || 0);\n    setInviteProgress({ current: sentCount + failedCount, total });\n\n    if (failedCount > 0) {\n      const detail = dispatch?.firstError || 'Falha não identificada pelo provedor.';\n      if (sentCount > 0) {\n        setSucesso(\`Escala salva. Envio parcial: \${sentCount} enviado(s) e \${failedCount} falha(s).\`);\n        toast.error(\`\${failedCount} convite(s) falharam: \${detail}\`);\n      } else {\n        throw new Error(\`Escala salva, mas nenhum convite foi enviado. \${detail}\`);\n      }\n      return;\n    }\n\n    setSucesso(\n      total > 0\n        ? \`Escala salva e \${sentCount} convite(s) enviado(s) pelo WhatsApp.\`\n        : 'Escala salva. Não havia convite pendente sem envio.'\n    );\n  } catch (e) {\n    console.error('[scale][save+send] failed', e);\n    if (!isMountedRef.current) return;\n    toast.error(e?.message || 'Erro ao salvar e enviar convites.');\n  } finally {\n    if (isMountedRef.current) {\n      setSalvando(false);\n      setEnviandoConvites(false);\n    }\n  }\n}`;

  source = source.slice(0, start) + handlers + source.slice(end);
  return source;
});

console.log('[scale save+send atomic] patch concluído');
