import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { ArrowRight, Check, CircleAlert } from 'lucide-react';
import PublicFooter from '@/components/public/PublicFooter';
import { PublicBackground, PublicHeader, primaryButtonClass, secondaryButtonClass } from '@/components/public/PublicUI';
import { BrowserFrame, PhoneFrame } from '@/components/public/landing/Frames';
import ExperienceTabs from '@/components/public/landing/ExperienceTabs';
import Reveal from '@/components/public/landing/Reveal';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { loadPublicPlans } from '@/lib/billing/public-plans';
import { RECOMMENDED_PLAN_SLUG, formatMoney, isPaidPlan, planTagline } from '@/lib/billing/plan-presentation';
import { TESTIMONIALS } from '@/lib/landing/testimonials';

// Página de vendas pública. Quem já está autenticado continua indo direto para o painel.
// As telas mostradas são capturas reais do produto com uma banda fictícia (Banda Aurora).
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://app.bandaharmonics.com';
const TITLE = 'Harmonics | Gestão completa para bandas e equipes musicais';
const DESCRIPTION =
  'Eventos, clientes, contratos com assinatura eletrônica, escalas de músicos, repertório, pagamentos e comunicação por WhatsApp em um só lugar. Comece grátis.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'Harmonics',
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: `${SITE_URL}/landing/og-harmonics.png`, width: 1200, height: 630, alt: 'Harmonics — gestão para bandas' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_URL}/landing/og-harmonics.png`],
  },
};

async function hasAuthenticatedUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  try {
    const cookieStore = await cookies();
    if (!cookieStore.getAll().some((cookie) => cookie.name.startsWith('sb-'))) return false;
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    });
    const { data } = await supabase.auth.getUser();
    return Boolean(data?.user);
  } catch {
    return false;
  }
}

type PublicPlan = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  monthly_price: number | string;
  can_use_automation?: boolean;
  can_use_whatsapp?: boolean;
};

async function loadPlans(): Promise<PublicPlan[]> {
  try {
    const { plans } = await loadPublicPlans(getSupabaseAdmin());
    return plans as PublicPlan[];
  } catch {
    return [];
  }
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

const CHAOS = [
  'Agenda num caderno ou planilha',
  'Contrato em PDF perdido no e-mail',
  'Confirmação de músico no WhatsApp, um por um',
  'Repertório chegando em áudio e print',
  'Cobrança acompanhada de cabeça',
  '“Quem toca no sábado mesmo?”',
  'Cliente perguntando horário e local de novo',
  'Tudo dependendo da memória de quem organiza',
];

const CHAIN = ['Cliente', 'Pré-contrato', 'Contrato', 'Pagamentos', 'Músicos', 'Escala', 'Repertório', 'Comunicação'];

const STEPS = [
  {
    n: '01',
    title: 'O evento entra uma vez',
    text: 'Data, horário, local, formação, instrumentos, valores e custos ficam no evento. Daí em diante, contrato, escala, repertório e financeiro partem dessas mesmas informações.',
    visual: { kind: 'browser', src: '/landing/adm-eventos.webp', path: '/eventos', alt: 'Agenda de eventos da Banda Aurora no Harmonics' },
  },
  {
    n: '02',
    title: 'Cliente e contratação conectados',
    text: 'Você monta o pré-contrato e envia um link. O contratante confere o combinado e preenche os próprios dados; ao assinar, vira cliente na sua base e o evento é confirmado.',
    visual: { kind: 'phone', src: '/landing/cli-contrato-dados.webp', alt: 'Contratante conferindo os dados combinados do evento no celular' },
  },
  {
    n: '03',
    title: 'Contrato gerado e acompanhado',
    text: 'O contrato sai do seu modelo, com os dados do evento. Você vê o que foi enviado, visualizado e assinado, e abre o PDF quando precisar.',
    visual: { kind: 'browser', src: '/landing/adm-contratos.webp', path: '/contratos', alt: 'Lista de contratos com status de link gerado, preenchendo e assinado' },
  },
  {
    n: '04',
    title: 'A equipe montada sem caos',
    text: 'Escale os músicos por função e acompanhe quem confirmou, quem está pendente e quais funções ainda estão descobertas.',
    visual: { kind: 'browser', src: '/landing/adm-escala.webp', path: '/eventos', alt: 'Situação da equipe do evento: confirmados, pendentes e lacunas por função' },
  },
  {
    n: '05',
    title: 'O evento preparado',
    text: 'O contratante monta o repertório por momentos do evento e a equipe estuda pelo próprio painel. Nada de lista chegando na véspera.',
    visual: { kind: 'phone', src: '/landing/cli-repertorio-cortejo.webp', alt: 'Cliente montando a ordem do cortejo no repertório do casamento' },
  },
  {
    n: '06',
    title: 'A comunicação no automático',
    text: 'Convites, lembretes e avisos saem pelo WhatsApp conectado à sua conta, a partir de regras prontas que você liga e desliga.',
    visual: { kind: 'browser', src: '/landing/adm-regras.webp', path: '/automacoes/regras', alt: 'Regras rápidas de automação para escala e contratos' },
  },
];

const AUTOMATIONS = [
  'Convite de escala para o músico ao salvar a escala',
  'Lembrete para o músico que não respondeu o convite',
  'Aviso para a administração quando um contrato é assinado',
  'Aviso ao cliente quando a revisão do contrato ou do repertório é liberada',
  'Lembrete de repertório para o cliente antes do evento',
  'Lembrete de pagamento pendente para o cliente',
  'Confirmação com o cliente no dia do evento',
  'Pedido de avaliação ao cliente depois do evento',
];

function FAQ_ITEMS(automationPlans: string) {
  return [
    {
      q: 'Preciso instalar alguma coisa?',
      a: 'Não. O Harmonics funciona no navegador do computador e do celular. Se quiser, dá para adicioná-lo à tela inicial do celular como um app.',
    },
    {
      q: 'Posso começar gratuitamente?',
      a: 'Sim. Toda conta começa no plano Free, sem cartão de crédito. Você muda para um plano pago quando precisar de mais eventos, mais membros ou de automações.',
    },
    {
      q: 'Minha equipe também pode acessar?',
      a: 'Sim. Você convida pessoas para o seu espaço com papéis diferentes (por exemplo, admin, financeiro ou operacional), dentro do limite de membros do seu plano.',
    },
    {
      q: 'Meus músicos enxergam toda a administração?',
      a: 'Não. Músicos acessam a área do membro, com os próprios convites, agenda e repertórios. Valores, contratos e a administração da banda ficam no painel de quem gerencia.',
    },
    {
      q: 'Como funcionam os contratos?',
      a: 'Você cria um pré-contrato a partir dos seus modelos e envia o link. O contratante confere o combinado, preenche os dados, lê o contrato, pode pedir ajustes e assina eletronicamente. A assinatura fica registrada com data, hora e dados de verificação, e o PDF fica disponível para os dois lados. O conteúdo do contrato é definido por você.',
    },
    {
      q: 'Quais planos têm WhatsApp e automações?',
      a: automationPlans
        ? `Automações e WhatsApp integrado estão nos planos ${automationPlans}. O envio usa o número da sua banda, conectado por um provedor de WhatsApp compatível.`
        : 'Automações e WhatsApp integrado estão nos planos pagos. O envio usa o número da sua banda, conectado por um provedor de WhatsApp compatível.',
    },
    {
      q: 'Posso mudar de plano depois?',
      a: 'Sim, a qualquer momento, em Configurações → Assinatura. O novo plano vale assim que o pagamento é confirmado.',
    },
    {
      q: 'O que acontece se eu cancelar?',
      a: 'Não há fidelidade. Você mantém o plano até o fim do período já pago; depois, o espaço passa aos limites do plano Free, sem perder os dados.',
    },
  ];
}

function SectionHeading({ eyebrow, title, text, center = false }: { eyebrow: string; title: string; text?: string; center?: boolean }) {
  return (
    <div className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white md:text-[2.75rem] md:leading-[1.08]">{title}</h2>
      {text ? <p className="mt-4 text-base leading-7 text-slate-300 md:text-lg md:leading-8">{text}</p> : null}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm leading-6 text-slate-200 md:text-[15px]">
      <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export default async function Home() {
  if (await hasAuthenticatedUser()) redirect('/dashboard');

  const plans = await loadPlans();
  const automationPlans = joinNames(plans.filter((plan) => plan.can_use_automation || plan.can_use_whatsapp).map((plan) => plan.name));
  const faq = FAQ_ITEMS(automationPlans);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'Harmonics',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: SITE_URL,
        description: DESCRIPTION,
        offers: plans.map((plan) => ({ '@type': 'Offer', name: plan.name, price: Number(plan.monthly_price || 0), priceCurrency: 'BRL' })),
        publisher: { '@type': 'Organization', name: 'FOCO START LTDA' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
      },
    ],
  };

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicBackground />
      <PublicHeader />

      <main className="relative z-10">
        {/* HERO */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 md:px-6 md:pt-14">
          <div className="mx-auto max-w-4xl text-center">
            <p className="inline-flex rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-violet-100">
              Gestão para bandas e equipes musicais
            </p>
            <h1 className="mt-6 text-[2.5rem] font-black leading-[1.02] tracking-[-0.055em] text-white sm:text-6xl lg:text-[4.4rem]">
              Sua banda organizada do primeiro contato ao{' '}
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-violet-200 bg-clip-text text-transparent">último acorde.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              O Harmonics reúne a operação da banda em um único lugar: eventos, clientes, contratos, músicos, escalas,
              repertório, pagamentos e comunicação. Menos mensagens perdidas, mais evento bem feito.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className={primaryButtonClass}>
                Começar grátis <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/planos" className={secondaryButtonClass}>Ver planos</Link>
            </div>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              {['Plano gratuito para começar', 'Sem cartão no cadastro', 'Sem fidelidade'].map((item) => (
                <li key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto mt-14 max-w-5xl">
            <div className="absolute -inset-x-10 -top-10 bottom-0 rounded-[48px] bg-gradient-to-b from-violet-600/25 via-fuchsia-600/10 to-transparent blur-3xl" aria-hidden="true" />
            <BrowserFrame
              src="/landing/adm-dashboard.webp"
              alt="Dashboard do Harmonics com a saúde da operação, contratos pendentes e escalas abertas"
              path="/dashboard"
              width={1600}
              height={472}
              priority
              className="relative"
            />
            <div className="absolute -bottom-16 right-2 hidden w-[180px] sm:block md:-right-10 md:w-[210px] lg:-right-24">
              <PhoneFrame src="/landing/cli-portal.webp" alt="Painel do cliente no celular com o contrato assinado" priority />
            </div>
          </div>
          <p className="mt-16 text-center text-xs text-slate-500 sm:mt-20">Telas reais do Harmonics com uma banda fictícia de demonstração.</p>
        </section>

        {/* PROBLEMA → SOLUÇÃO */}
        <section id="produto" className="scroll-mt-6 mx-auto w-full max-w-6xl px-4 pb-24 md:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="O problema"
              title="Hoje, a operação de uma banda vive espalhada."
              text="O Harmonics foi criado a partir da rotina real de uma banda de eventos: muita coisa acontecendo ao mesmo tempo, em lugares diferentes, e tudo dependendo de alguém lembrar."
            />
          </Reveal>
          <Reveal className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CHAOS.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-slate-300">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-300/80" aria-hidden="true" />
                {item}
              </div>
            ))}
          </Reveal>

          <Reveal className="mt-16 rounded-[32px] border border-white/12 bg-gradient-to-br from-violet-700/25 via-fuchsia-700/10 to-transparent p-6 md:p-10">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">A mudança</p>
                <h3 className="mt-3 text-3xl font-black tracking-[-0.045em] md:text-4xl">Tudo conectado ao mesmo evento.</h3>
                <p className="mt-4 text-base leading-7 text-slate-300">
                  No Harmonics, o evento é o centro da operação. O cliente, o contrato, os pagamentos, os músicos, a escala, o
                  repertório e as mensagens ficam ligados a ele. Quando algo muda, todo mundo vê a mesma informação.
                </p>
              </div>
              <div className="relative">
                <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                  <div className="rounded-2xl bg-white px-6 py-3 text-center shadow-[0_18px_60px_rgba(124,58,237,0.45)]">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">Evento</p>
                    <p className="text-lg font-black text-slate-950">Casamento Juliana &amp; Rafael</p>
                  </div>
                  <div className="h-6 w-px bg-gradient-to-b from-white/60 to-white/10" aria-hidden="true" />
                  <ol className="flex flex-wrap justify-center gap-2" aria-label="Tudo que fica ligado ao evento">
                    {CHAIN.map((item, index) => (
                      <li key={item} className="flex items-center gap-2">
                        <span className="rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-2 text-sm font-bold text-slate-100">{item}</span>
                        {index < CHAIN.length - 1 ? <ArrowRight className="h-3.5 w-3.5 text-violet-300/70" aria-hidden="true" /> : null}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* COMO FUNCIONA */}
        <section id="como-funciona" className="scroll-mt-6 mx-auto w-full max-w-6xl px-4 pb-24 md:px-6">
          <Reveal>
            <SectionHeading
              center
              eyebrow="Como funciona"
              title="Do primeiro contato ao dia do evento, em um só fluxo."
              text="Veja como o Harmonics acompanha cada etapa. Todas as telas abaixo são do produto real."
            />
          </Reveal>
          <ol className="mt-16 space-y-20 md:space-y-28">
            {STEPS.map((step, index) => {
              const reverse = index % 2 === 1;
              return (
                <li key={step.n}>
                  <Reveal className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
                    <div className={reverse ? 'lg:order-2' : ''}>
                      <span className="text-5xl font-black tracking-[-0.06em] text-white/15 md:text-6xl" aria-hidden="true">{step.n}</span>
                      <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] md:text-3xl">
                        <span className="sr-only">Etapa {step.n}: </span>
                        {step.title}
                      </h3>
                      <p className="mt-4 max-w-lg text-base leading-7 text-slate-300">{step.text}</p>
                    </div>
                    <div className={reverse ? 'lg:order-1' : ''}>
                      {step.visual.kind === 'browser' ? (
                        <BrowserFrame src={step.visual.src} alt={step.visual.alt} path={step.visual.path} height={step.visual.src.includes('escala') ? 444 : 1000} />
                      ) : (
                        <PhoneFrame src={step.visual.src} alt={step.visual.alt} className="mx-auto w-[240px] sm:w-[270px]" />
                      )}
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </section>

        {/* TRÊS EXPERIÊNCIAS */}
        <section className="border-y border-white/8 bg-white/[0.02] py-24">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <Reveal>
              <SectionHeading
                center
                eyebrow="Três experiências, um único fluxo"
                title="Cada pessoa vê o que precisa. A operação continua conectada."
                text="O Harmonics não é só um painel administrativo: o contratante e os músicos têm a própria experiência, ligada ao mesmo evento."
              />
            </Reveal>
            <Reveal className="mt-12">
              <ExperienceTabs />
            </Reveal>
          </div>
        </section>

        {/* RECURSOS: CONTRATOS */}
        <section id="recursos" className="scroll-mt-6 mx-auto w-full max-w-6xl px-4 py-24 md:px-6">
          <Reveal>
            <SectionHeading
              eyebrow="Contratos"
              title="Do link à assinatura, sem papel e sem correria."
              text="O contratante recebe um link, confere o combinado, preenche os dados, lê o contrato e assina pelo celular. Você acompanha cada passo pelo painel."
            />
          </Reveal>
          <Reveal className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {[
              ['/landing/cli-contrato.webp', '1. O cliente abre o link', 'Data, horário, formação e instrumentos já preenchidos por você.'],
              ['/landing/cli-contrato-assinatura.webp', '2. Revisa e assina', 'Lê o contrato completo, confirma os dados e assina eletronicamente.'],
              ['/landing/cli-contrato-assinado.webp', '3. PDF na hora', 'Contrato concluído, PDF disponível e acesso ao painel do cliente.'],
              ['/landing/cli-portal-contrato.webp', '4. Sempre à mão', 'O contrato assinado fica no painel do cliente para consulta.'],
            ].map(([src, title, text]) => (
              <figure key={src}>
                <PhoneFrame src={src} alt={`${title}: ${text}`} />
                <figcaption className="mt-4">
                  <p className="text-sm font-black text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400 sm:text-sm sm:leading-6">{text}</p>
                </figcaption>
              </figure>
            ))}
          </Reveal>
          <Reveal className="mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <ul className="space-y-3">
              <Bullet>Modelos de contrato da sua banda, preenchidos com os dados do evento</Bullet>
              <Bullet>Status de cada envio: link gerado, visualizado, em preenchimento e assinado</Bullet>
              <Bullet>O cliente pode pedir um ajuste antes de assinar</Bullet>
              <Bullet>Registro da assinatura com data, hora e dados de verificação</Bullet>
              <Bullet>Ao assinar, o evento é confirmado e o cliente entra na sua base</Bullet>
            </ul>
            <BrowserFrame src="/landing/adm-contratos.webp" alt="Acompanhamento dos contratos da banda" path="/contratos" />
          </Reveal>
          <p className="mt-6 text-xs leading-5 text-slate-500">
            O Harmonics oferece as ferramentas de envio e assinatura eletrônica. O conteúdo e a adequação jurídica de cada contrato
            são definidos pela banda.
          </p>
        </section>

        {/* ESCALAS E EQUIPE */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-6">
          <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <BrowserFrame src="/landing/adm-convites.webp" alt="Convites por evento com confirmados, pendentes e recusas" path="/convites" />
            </div>
            <div>
              <SectionHeading
                eyebrow="Escalas e equipe"
                title="Chega de confirmar músico por mensagem, um por um."
                text="Monte a escala, o convite chega ao músico e a resposta volta para o painel. Você enxerga a cobertura de cada evento antes de virar problema."
              />
              <ul className="mt-6 space-y-3">
                <Bullet>Convite com aceite ou recusa pela área do músico</Bullet>
                <Bullet>Cobertura por função: o que está coberto, frágil ou faltando</Bullet>
                <Bullet>Lembrete automático para quem ainda não respondeu</Bullet>
                <Bullet>Modelos de escala reutilizáveis para formações frequentes</Bullet>
              </ul>
            </div>
          </Reveal>
          <Reveal className="mt-14 grid grid-cols-1 items-center gap-10 rounded-[32px] border border-white/10 bg-white/[0.03] p-6 md:grid-cols-[0.9fr_1.1fr] md:p-10">
            <div>
              <h3 className="text-2xl font-black tracking-[-0.04em]">O músico chega sabendo de tudo.</h3>
              <p className="mt-3 text-base leading-7 text-slate-300">
                Na área do membro, cada músico vê os próprios convites, a agenda com local, horário de chegada e formação, e os
                repertórios para estudar.
              </p>
            </div>
            <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-4">
              <PhoneFrame src="/landing/mem-home.webp" alt="Início da área do músico com solicitações e escalas" />
              <PhoneFrame src="/landing/mem-repertorios.webp" alt="Repertórios do mês na área do músico" className="mt-10" />
            </div>
          </Reveal>
        </section>

        {/* REPERTÓRIO E FINANCEIRO */}
        <section className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-24 md:px-6">
          <Reveal className="grid grid-cols-1 items-center gap-10 rounded-[32px] border border-white/10 bg-white/[0.03] p-6 md:p-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">Repertório</p>
              <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] md:text-3xl">O cliente monta, a banda recebe organizado.</h3>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Em casamentos, o repertório é montado por momentos: antessala, cortejo, cerimônia, saída e receptivo. Você revisa,
                libera ajustes quando precisar e a equipe estuda pelo próprio painel.
              </p>
            </div>
            <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-4">
              <PhoneFrame src="/landing/cli-repertorio.webp" alt="Assistente de repertório do cliente" />
              <PhoneFrame src="/landing/cli-repertorio-cortejo.webp" alt="Ordem das entradas do cortejo" className="mt-10" />
            </div>
          </Reveal>
          <Reveal className="grid grid-cols-1 items-center gap-10 rounded-[32px] border border-white/10 bg-white/[0.03] p-6 md:p-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid grid-cols-[1fr_auto] items-end gap-4 lg:order-1">
              <BrowserFrame src="/landing/adm-financeiro.webp" alt="Resumo financeiro com receita, recebido, custos e lucro" path="/pagamentos" />
              <PhoneFrame src="/landing/cli-financeiro.webp" alt="Pagamentos do evento no painel do cliente" className="w-[110px] sm:w-[150px]" />
            </div>
            <div className="lg:order-2">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">Financeiro</p>
              <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] md:text-3xl">Quanto entrou, quanto falta e quanto sobra.</h3>
              <p className="mt-4 text-base leading-7 text-slate-300">
                Receita contratada, recebido, em aberto, custos e lucro de cada evento. O cliente acompanha os vencimentos e envia o
                comprovante pelo painel; você valida.
              </p>
            </div>
          </Reveal>
        </section>

        {/* AUTOMAÇÕES E WHATSAPP */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-6">
          <Reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <SectionHeading
                eyebrow="Automações e WhatsApp"
                title="As mensagens de rotina saem sozinhas."
                text="Regras prontas enviam as mensagens certas na hora certa pelo WhatsApp da sua banda. Você acompanha cada envio na central de automação."
              />
              <ul className="mt-6 grid grid-cols-1 gap-3">
                {AUTOMATIONS.map((item) => <Bullet key={item}>{item}</Bullet>)}
              </ul>
              <p className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-500/10 px-4 py-3 text-sm leading-6 text-violet-100">
                {automationPlans ? `Disponível nos planos ${automationPlans}.` : 'Disponível nos planos pagos.'} O WhatsApp é
                conectado por um provedor compatível com o número da sua banda.
              </p>
            </div>
            <BrowserFrame src="/landing/adm-automacoes.webp" alt="Central de automação com regras ativas, envios e status do agendador" path="/automacoes" />
          </Reveal>
        </section>

        {/* PROVA SOCIAL — só aparece com depoimentos reais e autorizados (lib/landing/testimonials.js) */}
        {TESTIMONIALS.length ? (
          <section className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-6" aria-labelledby="depoimentos">
            <Reveal>
              <SectionHeading center eyebrow="Quem usa" title="O que dizem bandas, clientes e músicos." />
              <h2 id="depoimentos" className="sr-only">Depoimentos</h2>
            </Reveal>
            <Reveal className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
              {TESTIMONIALS.map((item: { quote: string; name: string; role: string }) => (
                <figure key={`${item.name}-${item.quote.slice(0, 20)}`} className="flex flex-col rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
                  <blockquote className="flex-1 text-base leading-7 text-slate-200">“{item.quote}”</blockquote>
                  <figcaption className="mt-5">
                    <p className="font-black text-white">{item.name}</p>
                    <p className="text-sm text-slate-400">{item.role}</p>
                  </figcaption>
                </figure>
              ))}
            </Reveal>
          </section>
        ) : null}

        {/* PLANOS */}
        {plans.length ? (
          <section className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-6">
            <Reveal className="rounded-[32px] border border-white/12 bg-white/[0.03] p-6 md:p-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <SectionHeading
                  eyebrow="Planos"
                  title="Comece grátis. Cresça quando a agenda pedir."
                  text="Pagamento mensal por Pix, boleto ou cartão. Sem fidelidade: cancele quando quiser."
                />
                <Link href="/planos" className={`${primaryButtonClass} shrink-0`}>
                  Ver planos e começar <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {plans.map((plan) => {
                  const recommended = plan.slug === RECOMMENDED_PLAN_SLUG;
                  return (
                    <Link
                      key={plan.id}
                      href="/planos"
                      className={`rounded-[20px] border p-5 transition hover:-translate-y-0.5 ${
                        recommended ? 'border-violet-300/50 bg-violet-600/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                      }`}
                    >
                      <p className="flex items-center justify-between gap-2 font-black text-white">
                        {plan.name}
                        {recommended ? <span className="rounded-full bg-violet-500/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-violet-100">Recomendado</span> : null}
                      </p>
                      <p className="mt-1 text-2xl font-black tracking-[-0.03em]">
                        {isPaidPlan(plan) ? formatMoney(plan.monthly_price) : 'Grátis'}
                        {isPaidPlan(plan) ? <span className="text-sm font-semibold text-slate-400">/mês</span> : null}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{planTagline(plan)}</p>
                    </Link>
                  );
                })}
              </div>
            </Reveal>
          </section>
        ) : null}

        {/* FAQ */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-6" aria-labelledby="faq">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <Reveal>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">Dúvidas frequentes</p>
              <h2 id="faq" className="mt-3 text-3xl font-black tracking-[-0.045em] md:text-4xl">Perguntas antes de começar</h2>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                Outras dúvidas? Escreva para{' '}
                <a href="mailto:focoemcanto@gmail.com" className="font-semibold text-violet-200 hover:text-white">focoemcanto@gmail.com</a>.
              </p>
            </Reveal>
            <Reveal className="space-y-3">
              {faq.map((item) => (
                <details key={item.q} className="group rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 open:bg-white/[0.06]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-white [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="text-xl leading-none text-violet-200 transition group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-6">
          <Reveal className="relative overflow-hidden rounded-[36px] border border-white/12 bg-gradient-to-br from-violet-700/50 via-fuchsia-700/30 to-purple-900/40 px-6 py-14 text-center md:px-12 md:py-20">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_55%)]" aria-hidden="true" />
            <h2 className="relative mx-auto max-w-3xl text-3xl font-black tracking-[-0.05em] md:text-5xl md:leading-[1.05]">
              Menos tempo administrando a operação. Mais tempo fazendo a banda acontecer.
            </h2>
            <p className="relative mx-auto mt-5 max-w-xl text-base leading-7 text-slate-200">
              Crie sua conta grátis, configure seu espaço em um minuto e cadastre o próximo evento hoje.
            </p>
            <div className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 text-sm font-black text-slate-950 transition hover:bg-violet-100">
                Começar grátis <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/planos" className={secondaryButtonClass}>Ver planos</Link>
            </div>
          </Reveal>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
