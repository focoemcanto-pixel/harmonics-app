'use client';

import { usePathname } from 'next/navigation';
import OperationalEmptyState from '@/components/onboarding/OperationalEmptyState';

const ROUTE_CONFIG = {
  '/eventos': {
    badge: 'Primeiro evento',
    title: 'Comece criando ou revisando seu primeiro evento.',
    description:
      'Eventos são o centro operacional do Harmonics. A partir deles você organiza contrato, escala, financeiro, repertório e comunicação com cliente e equipe.',
    primaryAction: { label: 'Criar primeiro evento', href: '/eventos?tab=evento' },
    secondaryAction: { label: 'Configurar tipos de evento', href: '/eventos/tipos' },
    tourKey: 'create-first-event',
    tips: [
      'Cadastre data, horário, local e tipo de evento.',
      'Defina formação, valores e informações operacionais.',
      'Depois gere pré-contrato ou siga para escala e financeiro.',
    ],
  },
  '/eventos/tipos': {
    badge: 'Catálogo comercial',
    title: 'Configure os tipos de evento do seu negócio.',
    description:
      'Tipos de evento organizam a venda e permitem associar automaticamente o modelo de contrato correto para cada situação.',
    primaryAction: { label: 'Criar tipo de evento', href: '/eventos/tipos' },
    secondaryAction: { label: 'Criar template primeiro', href: '/contratos/templates' },
    tourKey: 'event-type-created',
    tips: [
      'Crie categorias como casamento, aniversário, corporativo ou culto.',
      'Associe um template padrão ao tipo quando possível.',
      'Use isso para acelerar a geração de pré-contratos.',
    ],
  },
  '/pre-contratos': {
    badge: 'Fluxo comercial',
    title: 'Gere seu primeiro pré-contrato guiado.',
    description:
      'O pré-contrato cria o link que o cliente preenche, revisa, assina e usa para acessar o painel do cliente depois da assinatura.',
    primaryAction: { label: 'Gerar pré-contrato', href: '/pre-contratos' },
    secondaryAction: { label: 'Configurar templates', href: '/contratos/templates' },
    tourKey: 'create-first-precontract',
    tips: [
      'Escolha o tipo de evento e dados principais do cliente.',
      'Aplique um template interno de contrato.',
      'Gere o link e simule preenchimento, assinatura, PDF e painel do cliente.',
    ],
  },
  '/contratos/templates': {
    badge: 'Modelos de contrato',
    title: 'Configure o modelo que automatiza seus contratos.',
    description:
      'Templates permitem transformar os dados do evento em contratos internos, assinatura digital e PDF final sem depender de Google Docs ou Render nos workspaces SaaS.',
    primaryAction: { label: 'Criar template', href: '/contratos/templates' },
    secondaryAction: { label: 'Ver tipos de evento', href: '/eventos/tipos' },
    tourKey: 'contract-template',
    tips: [
      'Crie um modelo base com linguagem jurídica simples.',
      'Use tags dinâmicas para cliente, data, local, valor e formação.',
      'Associe o template ao tipo de evento para agilizar novos contratos.',
    ],
  },
  '/automacoes/canais': {
    badge: 'Comunicação automática',
    title: 'Conecte o primeiro canal WhatsApp do workspace.',
    description:
      'Canais liberam convites, lembretes, mensagens operacionais, alertas administrativos e logs de envio dentro do Harmonics.',
    primaryAction: { label: 'Conectar canal', href: '/automacoes/canais' },
    secondaryAction: { label: 'Ver automações', href: '/automacoes' },
    tourKey: 'automation-channel',
    tips: [
      'Escolha o provedor WhatsApp usado pelo workspace.',
      'Cadastre API URL, token e instância.',
      'Teste o envio antes de ativar automações reais.',
    ],
  },
  '/configuracoes/equipe': {
    badge: 'Equipe',
    title: 'Convide pessoas para operar o workspace com você.',
    description:
      'A equipe permite separar funções administrativas, financeiras e operacionais sem compartilhar uma única conta.',
    primaryAction: { label: 'Convidar membro', href: '/configuracoes/equipe' },
    secondaryAction: { label: 'Revisar workspace', href: '/settings/workspace' },
    tourKey: 'team-configured',
    tips: [
      'Adicione administradores ou operadores conforme a função.',
      'Revise permissões antes de liberar acesso.',
      'Use a equipe para preparar o app para uso comercial real.',
    ],
  },
};

function getRouteConfig(pathname) {
  const normalized = String(pathname || '').split('?')[0];
  return ROUTE_CONFIG[normalized] || null;
}

export default function OperationalRouteOnboarding({ enabled = false }) {
  const pathname = usePathname();
  const config = getRouteConfig(pathname);

  if (!enabled || !config) return null;

  return (
    <div className="mb-5">
      <OperationalEmptyState {...config} />
    </div>
  );
}
