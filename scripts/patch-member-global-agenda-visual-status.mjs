import fs from 'node:fs';

function patchFile(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  let changed = false;

  for (const { oldText, newText, marker, all = false } of replacements) {
    if (marker && source.includes(marker)) continue;
    if (!source.includes(oldText)) {
      throw new Error(`[member global agenda visual] Trecho esperado não encontrado em ${path}: ${oldText.slice(0, 160)}`);
    }
    source = all ? source.split(oldText).join(newText) : source.replace(oldText, newText);
    changed = true;
  }

  if (changed) fs.writeFileSync(path, source);
  console.log(`[member global agenda visual] ${path}: ${changed ? 'atualizado' : 'já aplicado'}`);
}

patchFile('app/api/membro/global-dashboard/route.js', [
  {
    oldText: `      const personalInvite = personalInviteByEventId.get(eventId);\n      if (personalInvite) return personalInvite;`,
    newText: `      const personalInvite = personalInviteByEventId.get(eventId);\n      if (personalInvite) {\n        return {\n          ...personalInvite,\n          source_flags: {\n            globalAgenda: true,\n            personalInvite: true,\n            adminPreview: auth.canAdminWorkspace === true,\n            delegatedAgendaViewer: auth.delegatedAgendaViewer === true,\n          },\n        };\n      }`,
    marker: 'personalInvite: true,',
  },
  {
    oldText: `        source_flags: {\n          globalAgenda: true,\n          adminPreview: auth.canAdminWorkspace === true,`,
    newText: `        source_flags: {\n          globalAgenda: true,\n          personalInvite: false,\n          adminPreview: auth.canAdminWorkspace === true,`,
    marker: 'personalInvite: false,',
  },
]);

patchFile('lib/membro/membro-invites.js', [
  {
    oldText: `      id: invite?.id,\n      inviteStatus: invite?.status || 'pending',`,
    newText: `      id: invite?.id,\n      sourceFlags: invite?.source_flags || null,\n      isGlobalAgenda: invite?.source_flags?.globalAgenda === true,\n      isPersonalInvite: invite?.source_flags?.personalInvite === true,\n      inviteStatus: invite?.status || 'pending',`,
    marker: 'isGlobalAgenda: invite?.source_flags?.globalAgenda === true',
  },
]);

patchFile('app/membro/page.js', [
  {
    oldText: `  const { confirmados, pendentes, proximosConfirmados, resumo } = useMemo(() => ({\n    confirmados: Array.isArray(dashboard?.confirmados) ? dashboard.confirmados : [],\n    pendentes: Array.isArray(dashboard?.pendentes) ? dashboard.pendentes : [],\n    proximosConfirmados: Array.isArray(dashboard?.proximosConfirmados)\n      ? dashboard.proximosConfirmados\n      : [],\n    resumo: dashboard?.resumo || {\n      pendentes: 0,\n      confirmados: 0,\n      repertorios: 0,\n    },\n  }), [dashboard]);`,
    newText: `  const { confirmados, pendentes, recusados, proximosConfirmados, resumo } = useMemo(() => ({\n    confirmados: Array.isArray(dashboard?.confirmados) ? dashboard.confirmados : [],\n    pendentes: Array.isArray(dashboard?.pendentes) ? dashboard.pendentes : [],\n    recusados: Array.isArray(dashboard?.recusados) ? dashboard.recusados : [],\n    proximosConfirmados: Array.isArray(dashboard?.proximosConfirmados)\n      ? dashboard.proximosConfirmados\n      : [],\n    resumo: dashboard?.resumo || {\n      pendentes: 0,\n      confirmados: 0,\n      repertorios: 0,\n    },\n  }), [dashboard]);\n\n  const agendaItems = useMemo(() => {\n    if (!(member?.isAdmin || member?.canViewAllEvents)) return confirmados;\n\n    const byEventId = new Map();\n    [...confirmados, ...pendentes, ...recusados].forEach((item) => {\n      const key = String(item?.eventId || item?.id || '').trim();\n      if (!key) return;\n      const previous = byEventId.get(key);\n      if (!previous || item?.isPersonalInvite === true) byEventId.set(key, item);\n    });\n\n    return Array.from(byEventId.values());\n  }, [member?.isAdmin, member?.canViewAllEvents, confirmados, pendentes, recusados]);`,
    marker: 'const agendaItems = useMemo(() => {',
  },
  {
    oldText: 'confirmados={confirmados}',
    newText: 'confirmados={agendaItems}',
    marker: 'confirmados={agendaItems}',
    all: true,
  },
]);

patchFile('components/membro/MembroEscalasTab.js', [
  {
    oldText: `function EventCard({\n  item,`,
    newText: `function getAgendaVisualMeta(item) {\n  const isGlobalAgenda = item?.isGlobalAgenda === true || item?.sourceFlags?.globalAgenda === true;\n  const isPersonalInvite = item?.isPersonalInvite === true || item?.sourceFlags?.personalInvite === true || !isGlobalAgenda;\n  const status = String(item?.inviteStatus || '').trim().toLowerCase();\n\n  if (isPersonalInvite && status === 'pending') {\n    return {\n      label: 'MEU CONVITE • RESPONDER',\n      badgeClass: 'border-amber-300/30 bg-amber-500/15 text-amber-200',\n      cardClass: 'border-amber-400/35 bg-[linear-gradient(135deg,rgba(245,158,11,.12),#1e1535)]',\n      railClass: 'bg-amber-400',\n    };\n  }\n\n  if (isPersonalInvite && status === 'declined') {\n    return {\n      label: 'MEU CONVITE • RECUSADO',\n      badgeClass: 'border-rose-300/30 bg-rose-500/15 text-rose-200',\n      cardClass: 'border-rose-400/30 bg-[linear-gradient(135deg,rgba(244,63,94,.10),#1e1535)]',\n      railClass: 'bg-rose-500',\n    };\n  }\n\n  if (isPersonalInvite) {\n    return {\n      label: 'MINHA ESCALA • CONFIRMADO',\n      badgeClass: 'border-emerald-300/30 bg-emerald-500/15 text-emerald-200',\n      cardClass: 'border-emerald-400/35 bg-[linear-gradient(135deg,rgba(16,185,129,.12),#1e1535)]',\n      railClass: 'bg-emerald-500',\n    };\n  }\n\n  return {\n    label: 'AGENDA GLOBAL',\n    badgeClass: 'border-violet-300/25 bg-violet-500/12 text-violet-200',\n    cardClass: 'border-[#352a55] bg-[#1e1535]',\n    railClass: 'bg-violet-500',\n  };\n}\n\nfunction EventCard({\n  item,`,
    marker: 'function getAgendaVisualMeta(item)',
  },
  {
    oldText: `  const formationTone = getFormationTone(item?.formation);\n\n  return (`,
    newText: `  const formationTone = getFormationTone(item?.formation);\n  const agendaVisual = getAgendaVisualMeta(item);\n\n  return (`,
    marker: 'const agendaVisual = getAgendaVisualMeta(item);',
  },
  {
    oldText: `      className={\`relative overflow-hidden rounded-[18px] border p-[18px] text-[#f1eeff] shadow-[0_4px_20px_rgba(0,0,0,.3)] transition active:scale-[0.995] xl:rounded-[22px] xl:p-[20px] \${\n        done\n          ? 'border-emerald-400/25 bg-[linear-gradient(135deg,rgba(34,197,94,.06),#1e1535)]'\n          : 'border-[#352a55] bg-[#1e1535]'\n      }\`}\n    >\n      <div\n        className={\`absolute left-0 top-0 h-full w-[4px] \${\n          done ? 'bg-emerald-500' : 'bg-violet-500'\n        }\`}\n      />`,
    newText: `      className={\`relative overflow-hidden rounded-[18px] border p-[18px] text-[#f1eeff] shadow-[0_4px_20px_rgba(0,0,0,.3)] transition active:scale-[0.995] xl:rounded-[22px] xl:p-[20px] \${agendaVisual.cardClass}\`}\n    >\n      <div className={\`absolute left-0 top-0 h-full w-[4px] \${agendaVisual.railClass}\`} />`,
    marker: '${agendaVisual.cardClass}',
  },
  {
    oldText: `      <div className="mt-3 text-[17px] font-black tracking-[-0.02em] xl:text-[19px]">\n        {done ? '✅ ' : ''}\n        {item?.clientName || 'Evento'}\n      </div>`,
    newText: `      <div className="mt-3 flex flex-wrap items-center gap-2">\n        <span className={\`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] \${agendaVisual.badgeClass}\`}>\n          {agendaVisual.label}\n        </span>\n      </div>\n\n      <div className="mt-2 text-[17px] font-black tracking-[-0.02em] xl:text-[19px]">\n        {done ? '✅ ' : ''}\n        {item?.clientName || 'Evento'}\n      </div>`,
    marker: '{agendaVisual.label}',
  },
]);

console.log('[member global agenda visual] patch concluído.');
