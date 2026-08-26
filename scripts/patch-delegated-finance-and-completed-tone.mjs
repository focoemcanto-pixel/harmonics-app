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
  write(path, src);
}

// 3) Evento concluído = grafite. Verde fica reservado para "Minha escala • Confirmado".
{
  const path = 'components/membro/MembroEscalasTab.js';
  let src = read(path);

  src = src.replaceAll(
    "bg-emerald-500/12 text-emerald-300 border-emerald-400/20",
    "bg-slate-500/15 text-slate-300 border-slate-400/20"
  );

  src = src.replace(
    "done\n          ? 'border-emerald-400/25 bg-[linear-gradient(135deg,rgba(34,197,94,.06),#1e1535)]'\n          : 'border-[#352a55] bg-[#1e1535]'",
    "done\n          ? 'border-slate-400/20 bg-[linear-gradient(135deg,rgba(100,116,139,.10),#17151d)]'\n          : 'border-[#352a55] bg-[#1e1535]'"
  );

  src = src.replace(
    "done ? 'bg-emerald-500' : 'bg-violet-500'",
    "done ? 'bg-slate-500' : 'bg-violet-500'"
  );

  // Patches anteriores podem ter introduzido a mesma semântica com pequenas variações.
  src = src.replaceAll("done ? 'bg-emerald-400' :", "done ? 'bg-slate-400' :");
  src = src.replaceAll("done ? 'bg-emerald-500' :", "done ? 'bg-slate-500' :");

  write(path, src);
}

console.log('[delegated privacy + completed tone] patch concluído.');
