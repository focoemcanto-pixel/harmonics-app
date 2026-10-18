import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Page() {
  return <ProtectedRoute requiredRole="admin"><AdminShell><main className="space-y-4 text-slate-900"><h1 className="text-3xl font-bold">Operação detalhada</h1><p className="text-slate-600">Os controles detalhados existentes serão preservados integralmente; esta rota não cria um segundo financeiro nem altera dados.</p><div className="flex flex-wrap gap-2"><Link className="rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white" href="/pagamentos/operacional">Financeiro operacional</Link><Link className="rounded-xl border px-4 py-2 font-semibold" href="/pagamentos/recebimentos">Caixa vivo</Link></div></main></AdminShell></ProtectedRoute>;
}
