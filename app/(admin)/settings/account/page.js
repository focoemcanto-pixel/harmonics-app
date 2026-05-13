import AdminShell from '@/components/layout/AdminShell';
import AccountSettingsClient from '@/components/settings/AccountSettingsClient';

export const dynamic = 'force-dynamic';

export default function AccountSettingsPage() {
  return (
    <AdminShell
      pageTitle="Conta"
      activeItem="settings"
      mobileSubtitle="Perfil e segurança"
    >
      <div className="space-y-6">
        <section className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">
            Conta do usuário
          </div>

          <h1 className="mt-2 text-[34px] font-black tracking-[-0.05em] text-[#0f172a] md:text-[44px]">
            Perfil e acesso
          </h1>

          <p className="mt-3 max-w-3xl text-[15px] font-semibold leading-7 text-[#64748b]">
            Gerencie seus dados pessoais, segurança da conta, sessão ativa e preferências básicas do painel administrativo.
          </p>
        </section>

        <AccountSettingsClient />
      </div>
    </AdminShell>
  );
}
