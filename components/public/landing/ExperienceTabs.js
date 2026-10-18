'use client';

import { useState } from 'react';
import { BrowserFrame, PhoneFrame } from '@/components/public/landing/Frames';

const EXPERIENCES = [
  {
    key: 'admin',
    label: 'Quem administra',
    title: 'O painel da operação inteira',
    text: 'O gestor vê o que precisa de atenção agora: contratos pendentes, pagamentos aguardando validação, escalas incompletas e a agenda dos próximos eventos, com valores e status de cada um.',
    points: ['Pendências reais da operação em um só lugar', 'Próximos eventos com contrato, pagamento e escala', 'Equipe interna com papéis: admin, financeiro, operacional e mais'],
    visual: { type: 'browser', src: '/landing/adm-dashboard-agenda.webp', path: '/dashboard', alt: 'Dashboard do Harmonics com pendências da operação e próximos eventos' },
  },
  {
    key: 'cliente',
    label: 'O contratante',
    title: 'Um painel próprio para cada cliente',
    text: 'Depois de assinar, o contratante acompanha o evento por um link: contrato e PDF, repertório por momentos, pagamentos com envio de comprovante e as próximas etapas.',
    points: ['Sem login: acesso por link exclusivo do evento', 'Repertório montado pelo próprio cliente', 'Valores, vencimentos e envio de comprovante'],
    visual: { type: 'phones', items: [
      { src: '/landing/cli-portal.webp', alt: 'Painel do cliente no celular com o contrato assinado' },
      { src: '/landing/cli-financeiro.webp', alt: 'Financeiro do evento no painel do cliente' },
    ] },
  },
  {
    key: 'musico',
    label: 'O músico',
    title: 'Cada músico vê só o que é dele',
    text: 'Na área do membro, o músico responde convites, consulta a agenda com local, horário de chegada e formação, e estuda o repertório dos eventos. Sem acesso à administração da banda.',
    points: ['Convites para aceitar ou recusar', 'Agenda com as escalas confirmadas', 'Repertórios do mês para estudar'],
    visual: { type: 'phones', items: [
      { src: '/landing/mem-solicitacoes.webp', alt: 'Área do músico com convite de escala pendente' },
      { src: '/landing/mem-agenda.webp', alt: 'Agenda do músico com evento confirmado' },
    ] },
  },
];

export default function ExperienceTabs() {
  const [active, setActive] = useState('admin');

  function onKeyDown(event) {
    const index = EXPERIENCES.findIndex((item) => item.key === active);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + EXPERIENCES.length) % EXPERIENCES.length;
      setActive(EXPERIENCES[next].key);
      document.getElementById(`exp-tab-${EXPERIENCES[next].key}`)?.focus();
    }
  }

  return (
    <div>
      <div role="tablist" aria-label="Experiências do Harmonics" className="flex flex-wrap justify-center gap-2" onKeyDown={onKeyDown}>
        {EXPERIENCES.map((item) => {
          const selected = item.key === active;
          return (
            <button
              key={item.key}
              id={`exp-tab-${item.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`exp-panel-${item.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(item.key)}
              className={`rounded-full px-5 py-2.5 text-sm font-black transition ${
                selected ? 'bg-white text-slate-950' : 'border border-white/15 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {EXPERIENCES.map((item) => (
        <div
          key={item.key}
          id={`exp-panel-${item.key}`}
          role="tabpanel"
          aria-labelledby={`exp-tab-${item.key}`}
          hidden={item.key !== active}
          className="mt-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]"
        >
          <div>
            <h3 className="text-2xl font-black tracking-[-0.04em] md:text-3xl">{item.title}</h3>
            <p className="mt-4 text-base leading-7 text-slate-300">{item.text}</p>
            <ul className="mt-6 space-y-3">
              {item.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm font-semibold text-slate-200">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-[11px] text-emerald-300" aria-hidden="true">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          {item.visual.type === 'browser' ? (
            <BrowserFrame src={item.visual.src} alt={item.visual.alt} path={item.visual.path} />
          ) : (
            <div className="mx-auto grid w-full max-w-lg grid-cols-2 gap-4 sm:gap-6">
              {item.visual.items.map((phone, index) => (
                <PhoneFrame key={phone.src} src={phone.src} alt={phone.alt} className={index === 1 ? 'mt-10' : ''} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
