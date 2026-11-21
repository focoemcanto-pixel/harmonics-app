'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, FileText, History, MapPin, MessageSquare, Music2, RefreshCw, Search, X } from 'lucide-react';
import styles from './NaraApprovals.module.css';

const API = '/api/ai/commercial/simulation-supervision';
const PAGE_SIZE = 6;
const STATUS = {
  awaiting_approval: 'Aguardando aprovação', approved: 'Aprovado', changes_requested: 'Ajustes solicitados',
  rejected: 'Recusado', expired: 'Expirado', superseded: 'Substituído',
};
const FILTERS = [
  ['all', 'Conversas', MessageSquare], ['awaiting_approval', 'Em revisão', Clock3],
  ['changes_requested', 'Em ajuste', RefreshCw], ['approved', 'Link liberado', Check],
];
const TABS = [['summary', 'Resumo', ClipboardCheck], ['document', 'Pré-contrato', FileText], ['history', 'Histórico', History]];
const DECISIONS = { adjust: 'Solicitar ajustes', reject: 'Recusar', expire: 'Simular expiração' };
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Bahia' });
const formatDate = (value) => value ? value.slice(0, 10).split('-').reverse().join('/') : 'Data pendente';
const formatTime = (value) => value ? dateTime.format(new Date(value)) : '—';
const normalize = (value) => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const clientName = (row) => row.name || 'Cliente · ' + row.id.slice(0, 6).toUpperCase();
const eventLocation = (row) => [row.summary?.location, row.city].filter(Boolean).join(' · ') || 'Local pendente';

async function read(query = '', options = {}) {
  const response = await fetch(API + query, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Não foi possível carregar a Central de Aprovações.'), {
    disabled: data.enabled === false, status: response.status,
  });
  return data;
}

function Status({ status }) {
  return <span className={styles.status} data-status={status}>{STATUS[status] || 'A conferir'}</span>;
}

function ConversationCard({ row, open }) {
  const { summary } = row;
  const initials = row.name?.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return (
    <button type="button" className={styles.card} onClick={open} aria-haspopup="dialog">
      <span className={styles.avatar}>{initials || <Music2 size={19} />}</span>
      <span className={styles.identity}>
        <strong>{clientName(row)}</strong>
        <span>{row.eventType || 'Evento'} <span aria-hidden="true">·</span> {summary?.ceremony?.formation || 'Formação pendente'}</span>
      </span>
      <span className={styles.event}>
        <span><CalendarDays size={14} />{formatDate(summary?.date)}{summary?.time && ' · ' + summary.time.slice(0, 5)}</span>
        <span><MapPin size={14} /><span>{eventLocation(row)}</span></span>
      </span>
      <span className={styles.total}>
        <strong>{summary?.total != null ? money.format(summary.total) : '—'}</strong>
        <span>{row.pending?.length ? row.pending.length + ' campos pendentes' : 'Dados completos'}</span>
      </span>
      <Status status={row.status} />
      <ChevronRight size={19} className={styles.chevron} />
    </button>
  );
}

function Fact({ label, children }) {
  return <div><dt>{label}</dt><dd>{children || 'Pendente'}</dd></div>;
}

function ReviewSummary({ review }) {
  const { document } = review;
  const summary = review.summary || {};
  return (
    <div className={styles.sections}>
      <section className={styles.panel}>
        <h3><CalendarDays size={17} /> Evento e serviços</h3>
        <dl className={styles.facts}>
          <Fact label="Evento">{review.eventType}</Fact>
          <Fact label="Data e horário">{[formatDate(summary.date), summary.time?.slice(0, 5)].filter(Boolean).join(' · ')}</Fact>
          <Fact label="Local">{eventLocation(review)}</Fact>
          <Fact label="Endereço do evento">{review.address}</Fact>
          {review.guests && <Fact label="Convidados">{review.guests}</Fact>}
          <Fact label={review.modality === 'por_tempo' ? 'Apresentação' : 'Formação da cerimônia'}>{summary.ceremony?.formation}{review.hours && ' · ' + review.hours + 'h'}</Fact>
          <Fact label="Instrumentos">{summary.ceremony?.instruments?.join(', ')}</Fact>
          {summary.musicians?.length > 0 && <Fact label="Músicos">{summary.musicians.map(m => [m.role, m.name].filter(Boolean).join(' · ')).join(', ')}</Fact>}
          <Fact label="Sonorização">{summary.sound ? 'Incluída' : 'Sem sonorização'}</Fact>
          <Fact label="Receptivo">{summary.reception ? [summary.reception.formation, summary.reception.instruments?.join(', '), summary.reception.hours + 'h'].filter(Boolean).join(' · ') : 'Sem receptivo'}</Fact>
        </dl>
      </section>
      <section className={styles.panel}>
        <h3><FileText size={17} /> Valores e condições</h3>
        <dl className={styles.price}>
          {summary.items?.map(item => <div key={item.key}><dt>{item.label}</dt><dd>{money.format(item.amount)}</dd></div>)}
          <div className={styles.grandTotal}><dt>Total da proposta</dt><dd>{summary.total == null ? '—' : money.format(summary.total)}</dd></div>
        </dl>
        {document?.payment && <dl className={styles.facts}>
          <Fact label="Sinal">{[document.payment.deposit, document.payment.depositDate && 'até ' + document.payment.depositDate].filter(Boolean).join(' · ')}</Fact>
          <Fact label="Saldo">{[document.payment.balance, document.payment.balanceDate && 'até ' + document.payment.balanceDate].filter(Boolean).join(' · ')}</Fact>
        </dl>}
        <p className={styles.muted}>As condições e formas de pagamento constam no pré-contrato.</p>
      </section>
      <section className={styles.panel}>
        <h3><ClipboardCheck size={17} /> Aprovação e link</h3>
        <div className={styles.linkState}>
          <Status status={review.status} />
          <span>{review.expiresAt ? 'Validade até ' + formatTime(review.expiresAt) : review.status === 'awaiting_approval' ? 'Link disponível após aprovação' : 'Link indisponível'}</span>
        </div>
        {review.reason && <p>{review.reason}</p>}
        {review.link && <a className={styles.textLink} href={review.link} target="_blank" rel="noreferrer">Abrir link fictício <ArrowUpRight size={15} /></a>}
      </section>
    </div>
  );
}

function ReviewHistory({ review }) {
  const versions = [...review.versions, review];
  return <ol className={styles.timeline}>
    {versions.map((version, index) => {
      const changes = [
        version.summary?.ceremony?.formation,
        version.summary?.date && formatDate(version.summary.date),
        version.summary?.time?.slice(0, 5),
        version.summary?.location,
        version.summary?.total != null && money.format(version.summary.total),
      ].filter(Boolean);
      return <li key={index} className={styles.panel}>
        <h3>Versão {index + 1} {index === versions.length - 1 && <span>Atual</span>}</h3>
        <p>{changes.join(' · ')}</p>
        {version.summary && <details>
          <summary>Ver itens da proposta</summary>
          <dl className={styles.price}>
            {version.summary.items?.map(item => <div key={item.key}><dt>{item.label}</dt><dd>{money.format(item.amount)}</dd></div>)}
          </dl>
          <p>{[version.summary.ceremony?.instruments?.join(', '), version.summary.sound ? 'Com sonorização' : 'Sem sonorização',
            version.summary.reception ? 'Receptivo ' + version.summary.reception.hours + 'h · ' + version.summary.reception.formation : 'Sem receptivo'].filter(Boolean).join(' · ')}</p>
        </details>}
        <p>Cliente confirmou{version.confirmation ? ' com “' + version.confirmation + '”' : ''}{version.confirmedAt ? ' em ' + formatTime(version.confirmedAt) : ''}.</p>
        <p><Status status={version.previousStatus || version.status} /> {version.decidedAt && formatTime(version.decidedAt)}</p>
        {version.reason && <p>{version.reason}</p>}
        {version.supersededAt && <p className={styles.muted}>Substituída em {formatTime(version.supersededAt)}</p>}
      </li>;
    }).reverse()}
  </ol>;
}

function ReviewDrawer({ row, close, reload }) {
  const dialog = useRef(null);
  const [review, setReview] = useState(null);
  const [tab, setTab] = useState('summary');
  const [documentSeen, setDocumentSeen] = useState(false);
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const body = useRef(null);
  const loadReview = useCallback(async (signal) => {
    const data = await read('?review=1&id=' + row.id, { signal });
    setReview(data.review);
    setDocumentSeen(false);
  }, [row.id]);

  useEffect(() => {
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    const trigger = document.activeElement;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    loadReview(controller.signal).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [loadReview]);

  function selectTab(next) {
    setTab(next);
    if (next === 'document' && review?.document) setDocumentSeen(true);
    if (body.current) body.current.scrollTop = 0;
  }

  async function decide(event, decision) {
    event.preventDefault();
    if (!review || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await read('', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, revision: review.revision, action: decision, reason, documentHash: review.document?.hash }),
      });
      setAction('');
      setReason('');
      setNotice(decision === 'approve' ? 'Aprovado. A Nara retomou a conversa de teste com o link.' :
        decision === 'adjust' ? 'Ajuste registrado na conversa de teste.' :
        decision === 'reject' ? 'Recusa registrada na conversa de teste.' : 'O link de teste expirou.');
      await Promise.all([loadReview(), reload()]);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) {
        setAction('');
        selectTab('summary');
        await Promise.allSettled([loadReview(), reload()]);
      }
    } finally { setBusy(false); }
  }

  const canDecide = review?.status === 'awaiting_approval';
  const requiresReason = action === 'adjust' || action === 'reject';

  return (
    <dialog ref={dialog} className={styles.drawer} aria-labelledby="nara-review-title" onCancel={e => { e.preventDefault(); if (!busy) close(); }}>
      <div className={styles.drawerFrame}>
        <header className={styles.drawerHead}>
          <div><p className={styles.eyebrow}>Revisão de proposta</p><h2 id="nara-review-title">{clientName(review || row)}</h2></div>
          <button autoFocus type="button" className={styles.iconButton} onClick={close} disabled={busy} aria-label="Fechar revisão"><X size={21} /></button>
          <div className={styles.drawerMeta}><Status status={review?.status || row.status} />
            <a href={'?tab=chat&engine=v2&simulation=' + row.id} target="_blank" rel="noreferrer" className={styles.textLink}><MessageSquare size={15} /> Ver conversa <ArrowUpRight size={14} /></a>
          </div>
        </header>
        <nav className={styles.tabs} aria-label="Seções da revisão">
          {TABS.map(([key, label, Icon]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => selectTab(key)}><Icon size={16} /> {label}{key === 'history' && review?.versions.length > 0 && <span>{review.versions.length + 1}</span>}</button>)}
        </nav>
        <div className={styles.drawerBody} ref={body}>
          {review ? <>
            {tab === 'summary' && <ReviewSummary review={review} />}
            {tab === 'history' && <ReviewHistory review={review} />}
            {tab === 'document' && (review.document ? <div className={styles.document}>
              {!!review.document.pending.length && <section className={styles.pendingFields}><h3>Campos a preencher pelo cliente</h3><p>{review.document.pending.join(' · ')}</p></section>}
              <iframe title="Prévia do pré-contrato Harmonics" sandbox="" srcDoc={review.document.html} />
            </div> : <div className={styles.empty}>O tipo de evento precisa de um modelo contratual configurado para gerar a prévia.</div>)}
          </> : <p className={styles.empty}>{error ? 'Revisão indisponível.' : 'Carregando revisão…'}</p>}
        </div>
        {(canDecide || review?.link || error || notice) && <footer className={styles.actions}>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {notice && <p role="status" className={styles.notice}>{notice}</p>}
          {action ? <form onSubmit={e => decide(e, action)}>
            {requiresReason && <label>Motivo obrigatório<textarea autoFocus required maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="Escreva o que precisa ser revisto." /></label>}
            {action === 'expire' && <p>O link desta simulação ficará indisponível.</p>}
            <div className={styles.actionButtons}>
              <button type="button" className={styles.secondary} disabled={busy} onClick={() => { setAction(''); setReason(''); }}>Cancelar</button>
              <button className={action === 'reject' ? styles.danger : styles.primary} disabled={busy || (requiresReason && !reason.trim())}>{busy ? 'Salvando…' : DECISIONS[action]}</button>
            </div>
          </form> : canDecide ? <div className={styles.actionButtons}>
            <button type="button" className={styles.reject} disabled={busy} onClick={() => setAction('reject')}>Recusar</button>
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => setAction('adjust')}>Solicitar ajustes</button>
            {documentSeen ? <button type="button" className={styles.primary} disabled={busy} onClick={e => decide(e, 'approve')}><Check size={16} /> Aprovar envio</button> :
              <button type="button" className={styles.primary} onClick={() => selectTab('document')}><FileText size={16} /> Conferir pré-contrato</button>}
          </div> : review?.link ? <div className={styles.actionButtons}><button type="button" className={styles.secondary} onClick={() => setAction('expire')}>Simular expiração</button></div> : null}
        </footer>}
      </div>
    </dialog>
  );
}

export default function NaraApprovals({ simulationOnly }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [direct, setDirect] = useState(null);
  const reload = useCallback(async (signal) => {
    try {
      const sessions = new Map();
      let offset = 0;
      let result;
      do {
        result = await read('?offset=' + offset, { signal });
        for (const row of result.sessions) sessions.set(row.id, row);
        offset += result.sessions.length;
      } while (result.more);
      setRows([...sessions.values()]);
      setError('');
      setDisabled(false);
    } catch (err) {
      if (signal?.aborted) return;
      setDisabled(Boolean(err.disabled));
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('simulation');
    if (id) setDirect(id);
    const controller = new AbortController();
    reload(controller.signal);
    const timer = setInterval(() => { if (!document.hidden) reload(controller.signal); }, 5000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [reload]);

  useEffect(() => {
    const row = rows?.find(item => item.id === direct);
    if (row) { setSelected(row); setDirect(null); }
  }, [direct, rows]);

  if (!simulationOnly && disabled) return null;
  const history = rows || [];
  const matching = history.filter(row => (filter === 'all' || row.status === filter) &&
    normalize([clientName(row), row.eventType, eventLocation(row), row.summary?.ceremony?.formation, formatDate(row.summary?.date)].join(' ')).includes(normalize(query.trim())));
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const displayPage = Math.min(pages, page);
  const visible = matching.slice((displayPage - 1) * PAGE_SIZE, displayPage * PAGE_SIZE);
  function changeFilter(value) { setFilter(value); setPage(1); }

  return (
    <section className={styles.root} aria-labelledby="nara-approvals-title">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}><span /> Harmonics <span aria-hidden="true">/</span> Nara V2</p>
          <h1 id="nara-approvals-title">Central de Aprovações</h1>
          <p>Revise as propostas confirmadas e libere o pré-contrato de cada conversa.</p>
        </div>
        <span className={styles.environment}>Ambiente de teste</span>
      </header>
      <div className={styles.metrics} role="group" aria-label="Indicadores da fila">
        {FILTERS.map(([key, label, Icon]) => <button type="button" key={key} onClick={() => changeFilter(key)} aria-pressed={key === filter}>
          <span className={styles.metricIcon}><Icon size={17} /></span>
          <strong>{rows ? key === 'all' ? history.length : history.filter(row => row.status === key).length : '—'}</strong>
          <span>{label}</span>
        </button>)}
      </div>
      <div className={styles.queue}>
        <div className={styles.toolbar}>
          <h2>Propostas por conversa</h2>
          <label className={styles.search}><Search size={17} /><input type="search" aria-label="Buscar propostas" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Cliente, evento ou local" /></label>
          <select className={styles.select} aria-label="Filtrar por situação" value={filter} onChange={e => changeFilter(e.target.value)}>
            <option value="all">Todas as situações</option>
            {Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        {error && <p role="alert" className={styles.error}>{error} <button type="button" onClick={() => reload()} className={styles.textLink}>Tentar novamente</button></p>}
        <div className={styles.list}>
          {visible.map(row => <ConversationCard key={row.id} row={row} open={() => setSelected(row)} />)}
          {!visible.length && <div className={styles.empty}><ClipboardCheck size={23} />
            <strong>{error ? 'Fila indisponível' : !rows ? 'Carregando propostas…' : rows.length ? 'Nenhuma proposta encontrada' : 'Nenhuma proposta confirmada'}</strong>
            {rows && !rows.length && <a href="?tab=chat&engine=v2" className={styles.textLink}>Abrir Chat de Testes <ArrowUpRight size={15} /></a>}
          </div>}
        </div>
        {pages > 1 && <nav className={styles.pagination} aria-label="Páginas de propostas">
          <span>Página {displayPage} de {pages}</span>
          <button type="button" className={styles.iconButton} disabled={displayPage === 1} onClick={() => setPage(displayPage - 1)} aria-label="Página anterior"><ChevronLeft size={17} /></button>
          <button type="button" className={styles.iconButton} disabled={displayPage === pages} onClick={() => setPage(displayPage + 1)} aria-label="Próxima página"><ChevronRight size={17} /></button>
        </nav>}
      </div>
      {selected && <ReviewDrawer key={selected.id} row={selected} close={() => setSelected(null)} reload={reload} />}
    </section>
  );
}
