import fs from 'node:fs';

function patchFile(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  let changed = false;

  for (const { oldText, newText, marker, all = false } of replacements) {
    if (marker && source.includes(marker)) continue;
    if (!source.includes(oldText)) {
      throw new Error(`[confirmed scale invite patch] Trecho esperado não encontrado em ${path}: ${oldText.slice(0, 180)}`);
    }
    source = all ? source.split(oldText).join(newText) : source.replace(oldText, newText);
    changed = true;
  }

  if (changed) fs.writeFileSync(path, source);
  console.log(`[confirmed scale invite patch] ${path}: ${changed ? 'atualizado' : 'já aplicado'}`);
}

patchFile('app/api/events/[id]/scale/route.js', [
  {
    oldText: `      const invitesPayload = novosParaCriar.map((item) => ({\n        event_id: eventId,\n        contact_id: item.musician_id,\n        suggested_role_name: item.role || null,\n        status: 'pending',\n        invite_token:`,
    newText: `      const invitesPayload = novosParaCriar.map((item) => {\n        const scaleStatus = String(item?.status || '').trim().toLowerCase();\n        const isPreconfirmed = scaleStatus === 'confirmed';\n        return {\n        event_id: eventId,\n        contact_id: item.musician_id,\n        suggested_role_name: item.role || null,\n        status: isPreconfirmed ? 'confirmed' : 'pending',\n        responded_at: isPreconfirmed ? item?.confirmed_at || new Date().toISOString() : null,\n        invite_token:`,
    marker: "status: isPreconfirmed ? 'confirmed' : 'pending'",
  },
  {
    oldText: `            : \`${Date.now()}-\${item.musician_id}\`,\n      }));`,
    newText: `            : \`${Date.now()}-\${item.musician_id}\`,\n        };\n      });`,
    marker: 'responded_at: isPreconfirmed',
  },
  {
    oldText: `    if (existentesParaReativar.length > 0) {\n      const existingIds = existentesParaReativar.map((item) => item.id).filter(isUuid);\n      const { error: reactivateError } = await supabase\n        .from('invites')\n        .update({\n          status: 'pending',\n          responded_at: null,\n          whatsapp_sent_at: null,\n          whatsapp_last_error: null,\n        })\n        .eq('event_id', eventId)\n        .in('id', existingIds);\n      if (reactivateError) throw reactivateError;\n\n      await updateInviteRoles(supabase, existentesParaReativar);\n    }`,
    newText: `    if (existentesParaReativar.length > 0) {\n      for (const reactivated of existentesParaReativar) {\n        const scaleItem = escalaLocalDedupe.find((item) => String(item?.musician_id) === String(inviteMap.get(String(item?.musician_id))?.contact_id) && inviteMap.get(String(item?.musician_id))?.id === reactivated.id) ||\n          escalaLocalDedupe.find((item) => inviteMap.get(String(item?.musician_id))?.id === reactivated.id);\n        const isPreconfirmed = String(scaleItem?.status || '').trim().toLowerCase() === 'confirmed';\n        const { error: reactivateError } = await supabase\n          .from('invites')\n          .update({\n            status: isPreconfirmed ? 'confirmed' : 'pending',\n            responded_at: isPreconfirmed ? scaleItem?.confirmed_at || new Date().toISOString() : null,\n            whatsapp_sent_at: null,\n            whatsapp_last_error: null,\n          })\n          .eq('event_id', eventId)\n          .eq('id', reactivated.id);\n        if (reactivateError) throw reactivateError;\n      }\n\n      await updateInviteRoles(supabase, existentesParaReativar);\n    }`,
    marker: 'const isPreconfirmed = String(scaleItem?.status',
  },
  {
    oldText: `    await updateInviteRoles(supabase, roleUpdates);\n\n    const removidosIds = removidos.map((item) => item.musician_id).filter(Boolean);`,
    newText: `    await updateInviteRoles(supabase, roleUpdates);\n\n    // A escala é a fonte de verdade para membros pré-confirmados pelo administrador.\n    // Se o músico já foi salvo como confirmed na escala, seu invite não pode continuar pending.\n    for (const item of escalaLocalDedupe) {\n      if (String(item?.status || '').trim().toLowerCase() !== 'confirmed') continue;\n      const existingInvite = inviteMap.get(String(item.musician_id));\n      if (!existingInvite?.id || String(existingInvite.status || '').toLowerCase() === 'confirmed') continue;\n\n      const { error: confirmInviteError } = await supabase\n        .from('invites')\n        .update({\n          status: 'confirmed',\n          responded_at: item?.confirmed_at || new Date().toISOString(),\n        })\n        .eq('event_id', eventId)\n        .eq('id', existingInvite.id);\n      if (confirmInviteError) throw confirmInviteError;\n    }\n\n    const removidosIds = removidos.map((item) => item.musician_id).filter(Boolean);`,
    marker: 'A escala é a fonte de verdade para membros pré-confirmados',
  },
  {
    oldText: `.eq('event_id', eventId)\n      .neq('status', 'removed')\n      .is('whatsapp_sent_at', null);`,
    newText: `.eq('event_id', eventId)\n      .eq('status', 'pending')\n      .is('whatsapp_sent_at', null);`,
    marker: ".eq('status', 'pending')\n      .is('whatsapp_sent_at', null);",
  },
]);

patchFile('app/api/membro/global-dashboard/route.js', [
  {
    oldText: `      const personalInvite = personalInviteByEventId.get(eventId);\n      if (personalInvite) {\n        return {\n          ...personalInvite,`,
    newText: `      const personalInvite = personalInviteByEventId.get(eventId);\n      if (personalInvite) {\n        const ownScale = scales.find((row) =>\n          String(row?.event_id || '') === eventId &&\n          String(row?.musician_id || '') === String(auth.contact?.id || auth.userId)\n        );\n        const scaleStatus = String(ownScale?.status || '').trim().toLowerCase();\n        const effectiveInvite = scaleStatus === 'confirmed' && String(personalInvite?.status || '').trim().toLowerCase() !== 'confirmed'\n          ? { ...personalInvite, status: 'confirmed', responded_at: ownScale?.confirmed_at || personalInvite?.responded_at || null }\n          : personalInvite;\n        return {\n          ...effectiveInvite,`,
    marker: 'const effectiveInvite = scaleStatus ===',
  },
]);

console.log('[confirmed scale invite patch] concluído');
