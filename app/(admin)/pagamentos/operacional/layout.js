import Link from "next/link";
export default function OperationalFinanceLayout({ children }) {
  return <><div className="mx-auto mb-3 flex w-full max-w-7xl flex-wrap gap-2 px-3 pt-3 sm:px-5"><Link href="/pagamentos/operacional/caixa" className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800">Caixa vivo</Link><Link href="/pagamentos/operacional" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">Operação completa</Link><Link href="/pagamentos/operacional/recebimentos" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">Recebimentos</Link></div>{children}</>;
}
