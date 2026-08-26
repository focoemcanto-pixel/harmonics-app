import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, source) {
  fs.writeFileSync(path, source);
  console.log(`[confirmed scale invite patch] ${path}: atualizado`);
}

function ensureRoutePatch() {
  const path = 'app/api/events/[id]/scale/route.js';
  let source = read(path);
  const original = source;

  if (!source.includes('confirmed_at: item.confirmed_at || null,')) {
    source = source.replace(
      /existentesParaReativar\.push\(\{\s*id: existing\.id,\s*suggested_role_name: item\.role \|\| null,\s*\}\);/m,
      `existentesParaReativar.push({\n          id: existing.id,\n          musician_id: item.musician_id,\n          status: item.status || 'pending',\n          confirmed_at: item.confirmed_at || null,\n          suggested_role_name: item.role || null,\n        });`
    );
  }

  if (!source.includes("status: isPreconfirmed ? 'confirmed' : 'pending'")) {
    source = source.replace(
      /const invitesPayload = novosParaCriar\.map\(\(item\) => \(\{[\s\S]*?invite_token:[\s\S]*?\}\)\);/m,
      `const invitesPayload = novosParaCriar.map((item) => {\n        const scaleStatus = String(item?.status || '').trim().toLowerCase();\n        const isPreconfirmed = scaleStatus === 'confirmed';\n        return {\n          event_id: eventId,\n          contact_id: item.musician_id,\n          suggested_role_name: item.role || null,\n          status: isPreconfirmed ? 'confirmed' : 'pending',\n          responded_at: isPreconfirmed ? item?.confirmed_at || new Date().toISOString() : null,\n          invite_token:\n            typeof crypto !== 'undefined' && crypto.randomUUID\n              ? crypto.randomUUID()\n              : \`${Date.now()}-\${item.musician_id}\`,\n        };\n      });`
    );
  }

  if (!source.includes("String(reactivated?.status || '').trim().toLowerCase() === 'confirmed'")) {
    source = source.replace(
      /if \(existentesParaReativar\.length > 0\) \{[\s\S]*?await updateInviteRoles\(supabase, existentesParaReativar\);\s*\}/m,
      `if (existentesParaReativar.length > 0) {\n      for (const reactivated of existentesParaReativar) {\n        const isPreconfirmed = String(reactivated?.status || '').trim().toLowerCase() === 'confirmed';\n        const { error: reactivateError } = await supabase\n          .from('invites')\n          .update({\n            status: isPreconfirmed ? 'confirmed' : 'pending',\n            responded_at: isPreconfirmed ? reactivated?.confirmed_at || new Date().toISOString() : null,\n            whatsapp_sent_at: null,\n            whatsapp_last_error: null,\n          })\n          .eq('event_id', eventId)\n          .eq('id', reactivated.id);\n        if (reactivateError) throw reactivateError;\n      }\n\n      await updateInviteRoles(supabase, existentesParaReativar);\n    }`
    );
  }

  if (!source.includes('A escala é a fonte de verdade para membros pré-confirmados')) {
    source = source.replace(
      `    await updateInviteRoles(supabase, roleUpdates);\n\n    const removidosIds = removidos.map((item) => item.musician_id).filter(Boolean);`,
      `    await updateInviteRoles(supabase, roleUpdates);\n\n    // A escala é a fonte de verdade para membros pré-confirmados pelo administrador.\n    // Se o músico já foi salvo como confirmed na escala, seu invite não pode continuar pending.\n    for (const item of escalaLocalDedupe) {\n      if (String(item?.status || '').trim().toLowerCase() !== 'confirmed') continue;\n      const existingInvite = inviteMap.get(String(item.musician_id));\n      if (!existingInvite?.id || String(existingInvite.status || '').toLowerCase() === 'confirmed') continue;\n\n      const { error: confirmInviteError } = await supabase\n        .from('invites')\n        .update({\n          status: 'confirmed',\n          responded_at: item?.confirmed_at || new Date().toISOString(),\n        })\n        .eq('event_id', eventId)\n        .eq('id', existingInvite.id);\n      if (confirmInviteError) throw confirmInviteError;\n    }\n\n    const removidosIds = removidos.map((item) => item.musician_id).filter(Boolean);`
    );
  }

  if (!source.includes(".eq('status', 'pending')\n      .is('whatsapp_sent_at', null);")) {
    source = source.replace(
      `.eq('event_id', eventId)\n      .neq('status', 'removed')\n      .is('whatsapp_sent_at', null);`,
      `.eq('event_id', eventId)\n      .eq('status', 'pending')\n      .is('whatsapp_sent_at', null);`
    );
  }

  const requiredMarkers = [
    'confirmed_at: item.confirmed_at || null,',
    "status: isPreconfirmed ? 'confirmed' : 'pending'",
    "String(reactivated?.status || '').trim().toLowerCase() === 'confirmed'",
    'A escala é a fonte de verdade para membros pré-confirmados',
  ];
  const missing = requiredMarkers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    throw new Error(`[confirmed scale invite patch] Não foi possível garantir os marcadores: ${missing.join(' | ')}`);
  }

  if (source !== original) write(path, source);
  else console.log(`[confirmed scale invite patch] ${path}: já aplicado`);
}

function ensureGlobalDashboardPatch() {
  const path = 'app/api/membro/global-dashboard/route.js';
  let source = read(path);
  const original = source;

  if (!source.includes("role, status, notes, confirmed_at')")) {
    source = source.replace(
      ".select('id, event_id, musician_id, musician_name, snapshot_name, role, status, notes')",
      ".select('id, event_id, musician_id, musician_name, snapshot_name, role, status, notes, confirmed_at')"
    );
  }

  if (!source.includes('const effectiveInvite =')) {
    source = source.replace(
      `      const personalInvite = personalInviteByEventId.get(eventId);\n      if (personalInvite) {\n        return {\n          ...personalInvite,`,
      `      const personalInvite = personalInviteByEventId.get(eventId);\n      if (personalInvite) {\n        const ownScale = scales.find((row) =>\n          String(row?.event_id || '') === eventId &&\n          String(row?.musician_id || '') === String(auth.contact?.id || auth.userId)\n        );\n        const scaleStatus = String(ownScale?.status || '').trim().toLowerCase();\n        const effectiveInvite =\n          scaleStatus === 'confirmed' &&\n          String(personalInvite?.status || '').trim().toLowerCase() !== 'confirmed'\n            ? {\n                ...personalInvite,\n                status: 'confirmed',\n                responded_at: ownScale?.confirmed_at || personalInvite?.responded_at || null,\n              }\n            : personalInvite;\n        return {\n          ...effectiveInvite,`
    );
  }

  if (!source.includes('const effectiveInvite =')) {
    throw new Error('[confirmed scale invite patch] Reconciliação da agenda global não foi aplicada.');
  }

  if (source !== original) write(path, source);
  else console.log(`[confirmed scale invite patch] ${path}: já aplicado`);
}

ensureRoutePatch();
ensureGlobalDashboardPatch();
console.log('[confirmed scale invite patch] concluído');
