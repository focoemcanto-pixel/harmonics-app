"use client";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import ProtectedRoute from "@/components/ProtectedRoute";

// A operação detalhada foi preservada em /pagamentos/operacional/detalhes.
// A entrada principal apresenta a escolha clara entre o caixa vivo e os controles avançados.
export default function Page() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminShell>
        <main className="space-y-5 text-slate-900">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-violet-700">Harmonics</p>
            <h1 className="text-3xl font-bold">Financeiro operacional</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Acompanhe o caixa real e a projeção da operação sem perder os controles detalhados que já existiam.</p>
          </div>
          <section className="grid gap-4 lg:grid-cols-2">
            <Link href="/pagamentos/recebimentos" className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm transition-shadow hover:shadow-md">
              <p className="text-sm font-semibold text-violet-700">VISÃO PRINCIPAL</p>
              <h2 className="mt-2 text-2xl font-bold">Caixa vivo e recebimentos</h2>
              <p className="mt-2 text-slate-600">Caixa atual, valores a receber, custos futuros, caixa projetado, retiradas e checklist global de clientes.</p>
            </Link>
            <Link href="/pagamentos/operacional/detalhes" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <p className="text-sm font-semibold text-slate-500">CONTROLES AVANÇADOS</p>
              <h2 className="mt-2 text-2xl font-bold">Operação detalhada</h2>
              <p className="mt-2 text-slate-600">Eventos, conferência, custos, configurações, histórico, estornos e ferramentas operacionais já existentes.</p>
            </Link>
          </section>
          <Link href="/pagamentos/recebimentos" className="inline-flex rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white">Abrir caixa vivo</Link>
        </main>
      </AdminShell>
    </ProtectedRoute>
  );
}
