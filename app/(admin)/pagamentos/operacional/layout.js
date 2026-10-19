"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const tabClass = (active) => `shrink-0 whitespace-nowrap rounded-full px-4 py-2 font-medium transition ${active ? "bg-[#0c0d12] text-white" : "text-[#586174] hover:bg-[#f6f7f9] hover:text-[#0c0d12]"}`;
export default function OperationalFinanceLayout({ children }) {
  const pathname = usePathname();
  return <><nav aria-label="Visões do financeiro operacional" className="mb-4 flex w-full max-w-full gap-1 overflow-x-auto rounded-full border border-[#e4e7ec] bg-white p-1 text-[13px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] [scrollbar-width:none] sm:w-fit"><Link href="/pagamentos/operacional/caixa" className={tabClass(pathname === "/pagamentos/operacional/caixa")}>Caixa vivo</Link><Link href="/pagamentos/operacional" className={tabClass(pathname === "/pagamentos/operacional")}>Operação completa</Link><Link href="/pagamentos/operacional/recebimentos" className={tabClass(pathname === "/pagamentos/operacional/recebimentos")}>Recebimentos</Link></nav>{children}</>;
}
