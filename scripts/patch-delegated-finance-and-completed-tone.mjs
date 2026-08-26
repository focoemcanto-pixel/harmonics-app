import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
  console.log(`[delegated privacy + completed tone] ${path}: atualizado`);
}

// 1) Financeiro continua exclusivo da experiência administrativa.
{
  const path = 'components/eventos/EventoEscalaTab.js';
  let src = read(path);

  if (!src.includes('hideFinancial = false')) {
    src = src.replace(
      'export default function EventoEscalaTab({ eventId }) {',
      'export default function EventoEscalaTab({ eventId, hideFinancial = false }) {'
    );
  }

  const financeBlock = `          <div className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-3">\n            <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[#64748b]">Financeiro</div>\n            <div className="mt-1 text-[14px] font-black text-[#0f172a]">{formatMoney(evento?.open_amount)} pendente</div>\n            <Link href="/pagamentos" className="mt-2 inline-flex rounded-[12px] border border-[#dbe3ef] px-3 py-1.5 text-[12px] font-black text-[#0f172a]">\n              Ver pagamentos\n            </Link>\n          </div>`;

  if (src.includes(financeBlock) && !src.includes('{!hideFinancial ? (\n          <div className="rounded-2xl border border-[#e2e8f0] bg-white px-3 py-3">')) {
    src = src.replace(financeBlock, `{!hideFinancial ? (\n${financeBlock}\n          ) : null}`);
  }

  write(path, src);
}

// 2) Todo construtor aberto pelo painel de membro é uma experiência delegada:
//    pode montar escala, mas não vê informações financeiras.
{
  const path = 'components/membro/MembroEscalaModal.js';
  let src = read(path);
  src = src.replace(
    '<EventoEscalaTab eventId={resolvedEvent.id} />',
    '<EventoEscalaTab eventId={resolvedEvent.id} hideFinancial />'
  );
  src = src.replace(
    '<EventoEscalaTab eventId={immediateEventId} />',
    '<EventoEscalaTab eventId={immediateEventId} hideFinancial />'
  );
  write(path, src);
}

// 3) Evento concluído = grafite, independentemente de ser escala pessoal ou agenda global.
//    Este patch roda DEPOIS do patch de status visual da agenda; portanto o concluído
//    precisa ter prioridade dentro de getAgendaVisualMeta().
{
  const path = 'components/membro/MembroEscalasTab.js';
  let src = read(path);

  const graphiteMarker = "label: 'CONCLUÍDO',\n      badgeClass: 'border-slate-300/25 bg-slate-500/15 text-slate-200'";
  if (src.includes('function getAgendaVisualMeta(item) {') && !src.includes(graphiteMarker)) {
    src = src.replace(
      'function getAgendaVisualMeta(item) {\n  const isGlobalAgenda =',
      `function getAgendaVisualMeta(item) {\n  const isCompleted = isEventDone(item);\n  if (isCompleted) {\n    return {\n      label: 'CONCLUÍDO',\n      badgeClass: 'border-slate-300/25 bg-slate-500/15 text-slate-200',\n      cardClass: 'border-slate-400/20 bg-[linear-gradient(135deg,rgba(100,116,139,.12),#17151d)]',\n      railClass: 'bg-slate-500',\n    };\n  }\n\n  const isGlobalAgenda =`
    );
  }

  // Compatibilidade com a versão antiga do card, caso o patch visual global não esteja presente.
  src = src.replaceAll(
    "bg-emerald-500/12 text-emerald-300 border-emerald-400/20",
    "bg-slate-500/15 text-slate-300 border-slate-400/20"
  );
  src = src.replace(
    "done\n          ? 'border-emerald-400/25 bg-[linear-gradient(135deg,rgba(34,197,94,.06),#1e1535)]'\n          : 'border-[#352a55] bg-[#1e1535]'",
    "done\n          ? 'border-slate-400/20 bg-[linear-gradient(135deg,rgba(100,116,139,.12),#17151d)]'\n          : 'border-[#352a55] bg-[#1e1535]'"
  );
  src = src.replace("done ? 'bg-emerald-500' : 'bg-violet-500'", "done ? 'bg-slate-500' : 'bg-violet-500'");

  write(path, src);
}

console.log('[delegated privacy + completed tone] patch concluído.');
