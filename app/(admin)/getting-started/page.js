import Link from 'next/link';
import AdminShell from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    title: 'Crie seu primeiro evento',
    description: 'Cadastre um evento real ou teste para entender o fluxo operacional do Harmonics.',
    href: '/eventos',
    icon: '📅',
    action: 'Ir para eventos',
  },
  {
    title: 'Configure sua identidade',
    description: 'Ajuste nome público, cor principal e WhatsApp de suporte do workspace.',
    href: '/settings/workspace',
    icon: '🎨',
    action: 'Configurar workspace',
  },
  {
    title: 'Adicione sua equipe',
    description: 'Convide membros, defina cargos e prepare a operação para múltiplos usuários.',
    href: '/configuracoes/equipe',
    icon: '👥',
    action: 'Adicionar equipe',
  },
  {
    title: 'Prepare seus contratos',
    description: 'Revise modelos, pré-contratos e o fluxo de geração de links para clientes.',
    href: '/contratos',
    icon: '📄',
    action: 'Ver contratos',
  },
  {
    title: 'Configure automações',
    description: 'Organize canais, templates, lembretes e envio de mensagens operacionais.',
    href: '/automacoes',
    icon: '⚙️',
    action: 'Ver automações',
  },
  {
    title: 'Teste repertórios e convites',
    description: 'Explore os fluxos de repertório, escalas, convites e confirmação dos músicos.',
    href: '/repertorios',
    icon: '🎧',
    action: 'Ver repertórios',
  },
];

export default function GettingStartedPage() {
  return (
    <AdminShell pageTitle="Primeiros passos" activeItem="settings" mobileSubtitle="Tutorial guiado">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[34px] border border-[#dbe3ef] bg-white shadow-[0_18px_46px_rgba(15,23,42,0.06)]">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
            <div>
              <div className="inline-flex rounded-full bg-violet-100 px-4 py-2 text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">
                Onboarding guiado
              </div>

              <h1 className="mt-5 max-w-3xl text-[38px] font-black leading-[0.95] tracking-[-0.06em] text-[#0f172a] md:text-[56px]">
                Configure o Harmonics do jeito certo.
              </h1>

              <p className="mt-5 max-w-2xl text-[16px] font-semibold leading-8 text-[#64748b]">
                Siga este roteiro para transformar um workspace vazio em uma operação funcional: evento, equipe, contratos, automações, repertórios e pagamentos.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/eventos" className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(124,58,237,0.24)] transition hover:bg-violet-500">
                  Criar primeiro evento
                </Link>
                <Link href="/settings/workspace" className="rounded-2xl border border-[#dbe3ef] bg-white px-5 py-3 text-sm font-black text-[#0f172a] transition hover:bg-slate-50">
                  Ajustar identidade
                </Link>
              </div>
            </div>

            <div className="rounded-[30px] border border-violet-200 bg-violet-50 p-6">
              <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-700">
                Progresso sugerido
              </div>
              <div className="mt-4 text-[52px] font-black tracking-[-0.06em] text-violet-950">
                0/6
              </div>
              <p className="mt-2 text-[14px] font-semibold leading-7 text-violet-800">
                Nesta primeira versão, o checklist é orientativo. Na próxima etapa ele será salvo por workspace e marcado automaticamente conforme o uso real.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {STEPS.map((step, index) => (
            <Link key={step.title} href={step.href} className="group block rounded-[30px] border border-[#dbe3ef] bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[24px]">
                  {step.icon}
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-slate-500">
                  Etapa {index + 1}
                </span>
              </div>

              <h2 className="mt-5 text-[22px] font-black tracking-[-0.03em] text-[#0f172a]">
                {step.title}
              </h2>

              <p className="mt-2 text-[14px] font-semibold leading-6 text-[#64748b]">
                {step.description}
              </p>

              <div className="mt-6 text-[13px] font-black text-violet-700">
                {step.action} →
              </div>
            </Link>
          ))}
        </section>

        <section className="rounded-[30px] border border-amber-200 bg-amber-50 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
          <div className="text-[12px] font-black uppercase tracking-[0.14em] text-amber-700">
            Próxima evolução
          </div>
          <h2 className="mt-2 text-[26px] font-black tracking-[-0.03em] text-amber-950">
            Criar evento de exemplo
          </h2>
          <p className="mt-3 max-w-3xl text-[14px] font-semibold leading-7 text-amber-900">
            O próximo refinamento será um botão para criar dados demo: evento, cliente, escala, contrato teste e repertório exemplo. Isso permitirá que o usuário aprenda o produto sem cadastrar tudo manualmente.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}
