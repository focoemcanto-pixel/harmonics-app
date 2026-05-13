import Link from 'next/link';
import AdminShell from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';

const SETTINGS_CARDS = [
  {
    title: 'Conta',
    href: '/settings/account',
    icon: '👤',
    description: 'Perfil do usuário, redefinição de senha, sessão ativa e preferências pessoais.',
    status: 'Disponível',
  },
  {
    title: 'Workspace',
    href: '/settings/workspace',
    icon: '🏢',
    description: 'Nome público, identidade visual, cor principal, WhatsApp de suporte e zona de perigo.',
    status: 'Disponível',
  },
  {
    title: 'Onboarding',
    href: '/settings/onboarding',
    icon: '🧭',
    description: 'Checklist real do workspace, progresso inicial, próximos passos e configuração guiada.',
    status: 'Disponível',
  },
  {
    title: 'Equipe',
    href: '/configuracoes/equipe',
    icon: '👥',
    description: 'Convide usuários, ajuste cargos e controle permissões dos membros do workspace.',
    status: 'Disponível',
  },
  {
    title: 'Assinatura',
    href: '/settings/billing',
    icon: '💳',
    description: 'Plano atual, estrutura de upgrade, downgrade, cobrança e status de pagamento.',
    status: 'Base pronta',
  },
  {
    title: 'Segurança',
    href: '/settings/security',
    icon: '🔐',
    description: 'Sessões, auditoria, proteção de conta, governança e hardening multi-tenant.',
    status: 'Base pronta',
  },
  {
    title: 'Integrações',
    href: '/settings/integrations',
    icon: '🔌',
    description: 'WhatsApp, provedores de envio, automações externas e canais conectados.',
    status: 'Base pronta',
  },
  {
    title: 'White-label',
    href: '/settings/white-label',
    icon: '✨',
    description: 'Logo, domínio próprio, favicon e personalização avançada por workspace.',
    status: 'Futuro',
    disabled: true,
  },
];

function SettingsCard({ item }) {
  const content = (
    <div className={`h-full rounded-[28px] border bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)] transition ${
      item.disabled
        ? 'border-[#e2e8f0] opacity-70'
        : 'border-[#dbe3ef] hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)]'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[22px]">
          {item.icon}
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${
          item.disabled ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'
        }`}>
          {item.status}
        </span>
      </div>

      <h2 className="mt-5 text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">
        {item.title}
      </h2>
      <p className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
        {item.description}
      </p>

      <div className="mt-6 text-[13px] font-black text-violet-700">
        {item.disabled ? 'Ainda não liberado' : 'Abrir configurações →'}
      </div>
    </div>
  );

  if (item.disabled) return content;

  return (
    <Link href={item.href} className="block h-full">
      {content}
    </Link>
  );
}

export default function SettingsOverviewPage() {
  return (
    <AdminShell pageTitle="Configurações" activeItem="settings" mobileSubtitle="Perfil, workspace e SaaS">
      <div className="space-y-6">
        <section className="rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">
            Central do SaaS
          </div>
          <h1 className="mt-2 text-[34px] font-black tracking-[-0.05em] text-[#0f172a] md:text-[44px]">
            Configurações
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] font-semibold leading-7 text-[#64748b]">
            Gerencie os ajustes gerais do workspace: identidade, equipe, conta, assinatura, segurança, integrações, onboarding e recursos avançados. A exclusão do workspace fica protegida dentro da área Workspace, na zona de perigo.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {SETTINGS_CARDS.map((item) => (
            <SettingsCard key={item.title} item={item} />
          ))}
        </section>
      </div>
    </AdminShell>
  );
}
