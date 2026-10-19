// Fonte única da navegação do admin: menu lateral (desktop), barra inferior + "Mais" (mobile)
// e busca rápida usam esta mesma lista. `module` é a chave de permissão de /api/workspace/me.

export const ADMIN_NAV_SECTIONS = [
  {
    key: 'operacao',
    label: 'Operação',
    items: [
      { key: 'dashboard', module: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', helper: 'Visão executiva' },
      {
        key: 'eventos',
        module: 'eventos',
        label: 'Eventos',
        href: '/eventos',
        icon: 'CalendarDays',
        helper: 'Próximas entregas',
        children: [
          { label: 'Visão geral', href: '/eventos' },
          { label: 'Tipos de evento', href: '/eventos/tipos' },
        ],
      },
      { key: 'escalas', module: 'escalas', label: 'Escalas', href: '/escalas', icon: 'Users', helper: 'Operação musical' },
      { key: 'convites', module: 'convites', label: 'Convites', href: '/convites', icon: 'Send', helper: 'Chamadas e respostas' },
    ],
  },
  {
    key: 'comercial',
    label: 'Comercial',
    items: [
      { key: 'orcamentos', module: 'contratos', label: 'Orçamentos', href: '/orcamentos', icon: 'Calculator', helper: 'Preço e logística' },
      { key: 'pre-contratos', module: 'contratos', label: 'Pré-contratos', href: '/pre-contratos', icon: 'Link2', helper: 'Comercial inicial' },
      {
        key: 'contratos',
        module: 'contratos',
        label: 'Contratos',
        href: '/contratos',
        icon: 'FileText',
        helper: 'Fluxo contratual',
        children: [
          { label: 'Visão geral', href: '/contratos' },
          { label: 'Templates de contrato', href: '/contratos/templates' },
        ],
      },
      { key: 'pagamentos', module: 'pagamentos', label: 'Financeiro', href: '/pagamentos', icon: 'Wallet', helper: 'Receitas e custos' },
    ],
  },
  {
    key: 'relacionamento',
    label: 'Relacionamento',
    items: [
      { key: 'contatos', module: 'contatos', label: 'Contatos', href: '/contatos', icon: 'Contact', helper: 'Rede e fornecedores' },
      { key: 'avaliacoes', module: 'avaliacoes', label: 'Avaliações', href: '/avaliacoes', icon: 'Star', helper: 'Retorno dos clientes' },
    ],
  },
  {
    key: 'musical',
    label: 'Musical',
    items: [
      { key: 'repertorios', module: 'repertorios', label: 'Repertórios', href: '/repertorios', icon: 'Music', helper: 'Biblioteca principal' },
      { key: 'sugestoes', module: 'sugestoes', label: 'Sugestões', href: '/sugestoes', icon: 'Sparkles', helper: 'Ideias do cliente' },
    ],
  },
  {
    key: 'automacao',
    label: 'Automação',
    items: [
      {
        key: 'automacoes',
        module: 'automacoes',
        label: 'Automação',
        href: '/automacoes',
        icon: 'Zap',
        helper: 'Fluxos e rotinas',
        children: [
          { label: 'Visão geral', href: '/automacoes' },
          { label: 'Templates', href: '/automacoes/templates' },
          { label: 'Logs', href: '/automacoes/logs' },
        ],
      },
    ],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    items: [
      {
        key: 'settings',
        module: 'workspace',
        label: 'Configurações',
        href: '/settings',
        icon: 'Settings',
        helper: 'Conta, workspace e equipe',
        children: [
          { label: 'Visão geral', href: '/settings' },
          { label: 'Onboarding', href: '/settings/onboarding' },
          { label: 'Workspace', href: '/settings/workspace' },
          { label: 'Equipe', href: '/configuracoes/equipe', module: 'usuarios' },
          { label: 'Assinatura', href: '/settings/billing', clientWorkspaceOnly: true },
        ],
      },
    ],
  },
];

// Atalhos fixos da barra inferior no celular (o restante fica em "Mais").
export const ADMIN_MOBILE_PRIMARY_KEYS = ['dashboard', 'eventos', 'escalas', 'pagamentos'];

const ITEM_PREFIXES = {
  eventos: ['/eventos'],
  escalas: ['/escalas', '/templates-escala'],
  contratos: ['/contratos'],
  automacoes: ['/automacoes'],
  pagamentos: ['/pagamentos', '/a/pagamento'],
  settings: ['/settings', '/configuracoes', '/admin/usuarios', '/getting-started'],
  'pre-contratos': ['/pre-contratos'],
  contatos: ['/contatos', '/admin/painel-membros'],
};

export function getAllNavItems() {
  return ADMIN_NAV_SECTIONS.flatMap((section) => section.items.map((item) => ({ ...item, section: section.label })));
}

export function isPathInItem(pathname, item) {
  if (!pathname || !item) return false;
  const prefixes = ITEM_PREFIXES[item.key] || [item.href];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function findActiveNavItem(pathname) {
  return getAllNavItems().find((item) => isPathInItem(pathname, item)) || null;
}

export function findActiveChild(pathname, item) {
  if (!item?.children?.length) return null;
  const exact = item.children.find((child) => child.href === pathname);
  if (exact) return exact;
  return item.children
    .filter((child) => child.href !== item.href && pathname?.startsWith(`${child.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0] || null;
}

/**
 * Filtra a navegação pelas permissões do workspace. Enquanto as permissões carregam, mostra tudo
 * (as rotas continuam protegidas pelos guards e pelas APIs; o menu é só atalho).
 */
export function filterNavSections({ modules, loading, showClientBilling }) {
  const allowed = loading
    ? null
    : new Set([...(Array.isArray(modules) && modules.length ? modules : ['dashboard']), 'workspace']);
  const can = (module) => !module || !allowed || allowed.has(module);

  return ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .filter((item) => can(item.module))
      .map((item) => (item.children
        ? { ...item, children: item.children.filter((child) => can(child.module) && (!child.clientWorkspaceOnly || showClientBilling)) }
        : item)),
  })).filter((section) => section.items.length > 0);
}
