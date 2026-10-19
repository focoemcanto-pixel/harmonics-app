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
        <section className="pt-1 md:pt-2">
          <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8b93a3]">
            Conta do usuário
          </div>

          <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[#0c0d12] md:text-[34px]">
            Perfil e acesso
          </h1>

          <p className="mt-1.5 max-w-3xl text-[14px] leading-6 text-[#586174] md:text-[15px]">
            Gerencie seus dados pessoais, segurança da conta, sessão ativa e preferências básicas do painel administrativo.
          </p>
        </section>

        <AccountSettingsClient />
      </div>
    </AdminShell>
  );
}
