import AdminShell from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';

const SECURITY_ITEMS = [
  'Proteção multi-tenant por workspace',
  'RLS e isolamento de dados por organização',
  'Validação de membership antes de acessar módulos',
  'Encerramento automático de sessão após exclusão de workspace',
  'Auditoria e histórico de login (em breve)',
  '2FA / autenticação em duas etapas (em breve)',
];

export default function SecuritySettingsPage() {
  return (
    <AdminShell pageTitle="Segurança" activeItem="settings" mobileSubtitle="Proteção e auditoria">
      <div className="space-y-6">
        <section className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">
            Segurança
          </div>

          <h1 className="mt-2 text-[34px] font-black tracking-[-0.05em] text-[#0f172a] md:text-[44px]">
            Segurança e governança
          </h1>

          <p className="mt-3 max-w-3xl text-[15px] font-semibold leading-7 text-[#64748b]">
            O Harmonics já opera com isolamento por workspace e proteção de membership. Esta área centralizará auditoria, 2FA, logs e governança avançada do SaaS.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <h2 className="text-[24px] font-black tracking-[-0.03em] text-[#0f172a]">
              Camadas já implementadas
            </h2>

            <div className="mt-5 grid gap-3">
              {SECURITY_ITEMS.map((item) => (
                <div key={item} className="rounded-2xl border border-[#e2e8f0] bg-slate-50 px-4 py-4 text-sm font-semibold text-[#334155]">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-amber-200 bg-amber-50 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
            <div className="text-[12px] font-black uppercase tracking-[0.14em] text-amber-700">
              Roadmap
            </div>

            <h2 className="mt-2 text-[26px] font-black tracking-[-0.03em] text-amber-950">
              Próxima etapa de hardening
            </h2>

            <ul className="mt-5 space-y-3 text-[14px] font-semibold leading-7 text-amber-900">
              <li>• Logs de auditoria por usuário</li>
              <li>• Histórico de exclusão de entidades</li>
              <li>• Sessões simultâneas</li>
              <li>• Confirmações críticas administrativas</li>
              <li>• Proteção contra exclusão do último owner</li>
              <li>• Segurança avançada de billing</li>
            </ul>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
