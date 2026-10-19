"use client";
import { money, today, isCancelledEvent } from "@/lib/operational-finance/model.mjs";
import { readingContext } from "@/lib/operational-finance/reading.mjs";
import styles from "./FinancialReading.module.css";

const monthName = (month) => new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
const shortMonth = (month) => new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
const dateName = (date) => date ? date.split("-").reverse().join("/") : "sem data";
const number = (value) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value || 0);
function DetailRow({ label, value }) { return <div className={styles.detailRow}><dt>{label}</dt><dd>{money(value)}</dd></div>; }

export default function FinancialReading({ decision, planning, events, sheets = [], month, setMonth, onEvent, onUnchecked }) {
  const current = today().slice(0, 7), isCurrent = month === current, isFuture = month > current;
  const context = readingContext(decision, planning, events, month);
  const op = context.operation || { contract: 0, costs: 0, result: 0, received: 0, open: 0, receivable: 0, commitments: 0, coverage: 0, marginPercent: 0 };
  const unconfirmed = events.filter((event) => event.event_date?.slice(0, 7) === month && !isCancelledEvent(event) && sheets.find((sheet) => sheet.event_id === event.id)?.status !== "checked");
  const flow = planning.months.find((row) => row.month === month);
  const negative = (op.free ?? 0) < 0;
  const futureRows = decision.months.filter((row) => row.month >= current);
  const openEvent = (id) => { const event = events.find((row) => row.id === id); if (event) onEvent(event); };
  const protection = <div className={styles.protection}>
    <div className={styles.protectionHeading}><div><span className={styles.eyebrow}>Proteção futura</span><h3>{op.reserve > 0 ? `${money(op.reserve)} precisam permanecer no caixa` : "Sem reserva adicional neste fechamento"}</h3></div><span className={styles.protectionIcon} aria-hidden="true">{op.reserve > 0 ? "↳" : "✓"}</span></div>
    {op.reserve > 0 && context.critical ? <p>Necessários em <strong>{monthName(context.critical.on.slice(0, 7))}</strong>, até {dateName(context.critical.on)}.{context.nextReceipt ? ` A próxima entrada após esse compromisso está prevista para ${dateName(context.nextReceipt.due_on)}.` : " Não há entrada posterior prevista que elimine essa necessidade."}</p> : <p>As entradas previstas, na ordem dos vencimentos, cobrem os compromissos posteriores conhecidos. Depende de receber nas datas previstas.</p>}
    <details className={styles.disclosure}><summary>Entender esta reserva <span aria-hidden="true">+</span></summary>
      <p className={styles.note}>A proteção considera o maior aperto de caixa ao longo dos vencimentos seguintes. Uma entrada posterior não cobre uma saída anterior. Movimentos do mesmo dia são compensados.</p>
      {context.reserveMovements.length ? <ol className={styles.movements}>{context.reserveMovements.map((item) => <li key={`${item.direction}:${item.event_id}:${item.cost_id || item.due_on}`}>
        <time>{dateName(item.due_on)}</time><button onClick={() => openEvent(item.event_id)}><strong>{item.event_name}</strong><span>{item.direction === "in" ? "Entrada prevista" : item.description || "Compromisso"}</span></button><b>{item.direction === "in" ? "+" : "−"} {money(item.amount)}</b>
      </li>)}</ol> : <p className={styles.note}>Nenhum compromisso posterior com ficha conferida.</p>}
    </details>
  </div>;
  const operation = <section className={styles.operation} aria-label={`Operação de ${monthName(month)}`}>
    <header className={styles.sectionHeading}><div><span className={styles.eyebrow}>Rentabilidade dos eventos</span><h2>Operação de {shortMonth(month)}</h2></div><span className={styles.margin}>Margem <strong>{number(op.marginPercent)}%</strong></span></header>
    <div className={styles.economicEquation}>
      <div><span>Faturamento contratado</span><strong>{money(op.contract)}</strong></div><span className={styles.operator} aria-hidden="true">−</span>
      <div><span>Custos dos eventos</span><strong>{money(op.costs)}</strong></div><span className={styles.operator} aria-hidden="true">=</span>
      <div className={styles.economicResult}><span>Resultado operacional</span><strong>{money(op.result)}</strong></div>
    </div>
    <p className={styles.note}>Pela data dos eventos. Antecipações e retiradas não mudam o lucro deste mês.</p>
    <details className={styles.disclosure}><summary>Ver detalhes da operação <span aria-hidden="true">+</span></summary>
      <dl className={styles.detailColumns}>{[["Já recebido pelos eventos", op.received], ["Falta receber pelos eventos", op.open], ["Cachês totais", op.musician], ["Outros custos", op.other], ["Custos realizados", op.realized], ["Custos pendentes", op.pending]].map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}</dl>
      <p className={styles.note}>“Falta receber pelos eventos” acompanha os eventos de {shortMonth(month)}. “Entradas previstas no mês” acompanha as datas de recebimento, inclusive de eventos de outros meses.</p>
      <details className={styles.disclosure}><summary>Operação de todos os eventos futuros conferidos ({decision.future.events}) <span aria-hidden="true">+</span></summary><dl>{[["Contratado", decision.future.contract], ["Cachês", decision.future.musician], ["Outros custos", decision.future.other], ["Resultado operacional", decision.future.result]].map(([label, value]) => <DetailRow key={label} label={label} value={value} />)}</dl></details>
    </details>
    {op.unchecked > 0 && <aside className={styles.partial}><p><strong>Operação parcial.</strong> {op.unchecked} evento(s) do mês sem conferência. Receita, custos e resultado podem mudar.</p><details className={styles.disclosure}><summary>Conferir as fichas deste mês <span aria-hidden="true">+</span></summary><ul className={styles.unconfirmedList}>{unconfirmed.map((event) => <li key={event.id}><button onClick={() => onEvent(event)}>{event.client_name} · {dateName(event.event_date)} <span aria-hidden="true">↗</span></button></li>)}</ul></details><button onClick={onUnchecked}>Abrir checklist geral</button></aside>}
  </section>;
  return <div className={styles.reading}>
    <header className={styles.toolbar}><div><span className={styles.eyebrow}>Leitura financeira</span><p>Decida com clareza. Explore quando precisar.</p></div><label>Mês de referência<input type="month" aria-label="Mês de referência" value={month} onChange={(event) => { if (event.target.value) setMonth(event.target.value); }} /></label></header>
    {isCurrent ? <section className={styles.cash} aria-label={`Seu caixa — ${monthName(month)}`}>
      <div className={styles.cashFlow}><span className={styles.eyebrow}>Seu caixa · {shortMonth(month)}</span>
        <div className={styles.cashToday}><span>Caixa hoje</span><strong>{money(decision.cash)}</strong></div>
        <dl className={styles.flowEquation}><DetailRow label="+ Ainda vai entrar neste mês" value={op.receivable} /><DetailRow label="− Ainda vai sair neste mês" value={op.commitments} /></dl>
        <div className={styles.closing}><span>Você termina {shortMonth(month)} com</span><strong>{money(op.projected)}</strong><small>Projeção após entradas e compromissos restantes.</small></div>
      </div>
      <div className={styles.cashDecision}>{protection}<div className={`${styles.free} ${negative ? styles.deficit : ""}`}><span className={styles.eyebrow}>{negative ? "Falta proteger" : "Livre para usar no fechamento"}</span><strong>{money(Math.abs(op.free || 0))}</strong><p>{negative ? `As entradas previstas não cobrem os compromissos conhecidos${context.risk ? ` até ${dateName(context.risk.on)}` : " no horizonte projetado"}.` : "Caixa projetado menos proteção futura. Disponibilidade condicionada às entradas previstas e às fichas conferidas."}</p></div></div>
      <aside className={styles.todayRisk}><span className={styles.eyebrow}>Se nenhuma outra entrada acontecesse</span><p>{op.withoutReceipts < 0 ? <><strong>Faltariam {money(-op.withoutReceipts)}</strong> para cumprir os compromissos restantes de {shortMonth(month)}.</> : <><strong>Sobrariam {money(op.withoutReceipts)}</strong> após cumprir os compromissos restantes de {shortMonth(month)} com o caixa de hoje.</>}</p></aside>
    </section> : null}
    {decision.unchecked > 0 && <aside className={styles.partial}><div><strong>Projeção parcial</strong><p>{decision.unchecked} eventos futuros ainda não foram conferidos. Caixa livre e proteção podem mudar quando essas fichas forem conferidas.</p></div><button onClick={onUnchecked}>Conferir eventos <span aria-hidden="true">↗</span></button></aside>}
    {operation}
    {!isCurrent && <section className={styles.coverage} aria-label={`Cobertura futura de ${monthName(month)}`}>
      <span className={styles.eyebrow}>{isFuture ? "Financiamento restante" : "Pendências com previsão no período"}</span><h2>Cobertura de {shortMonth(month)}</h2>
      <p className={styles.note}>{money(op.received)} já {isFuture ? "recebidos antecipadamente pelos eventos" : "recebidos pelos eventos"}. Esse valor compõe a operação acima e não entra novamente como recebimento futuro.</p>
      <dl className={styles.coverageEquation}><DetailRow label="Ainda a receber com previsão neste mês" value={op.receivable} /><DetailRow label="− Compromissos ainda pendentes neste mês" value={op.commitments} /><DetailRow label="= Saldo futuro do mês" value={op.coverage} /></dl>
      <p className={styles.coverageConclusion}>{op.need > 0 ? `${shortMonth(month)} ainda precisa de ${money(op.need)} do caixa.` : "Os recebimentos restantes previstos no mês cobrem seus compromissos."}</p>
      {op.projected !== undefined && <details className={styles.disclosure}><summary>Posição de caixa após {shortMonth(month)} <span aria-hidden="true">+</span></summary><p className={styles.note}>Projeção acumulada desde hoje; este saldo não é o lucro isolado do mês.</p><dl><DetailRow label="Caixa projetado" value={op.projected} /><DetailRow label="Proteção para os meses seguintes" value={op.reserve} /><DetailRow label={negative ? "Falta proteger" : "Caixa efetivamente livre"} value={Math.abs(op.free)} /></dl>{protection}</details>}
    </section>}
    {(context.crossingReceipts.length > 0 || context.outsideReceipts.length > 0) && <details className={`${styles.bridge} ${styles.disclosure}`}>
      <summary><span>Por que as entradas do mês diferem dos saldos dos eventos?<small>{money(op.receivable)} no fluxo de caixa · {money(op.open)} a receber pelos eventos de {shortMonth(month)}</small></span><span aria-hidden="true">+</span></summary>
      <p className={styles.note}>A data de recebimento pode vir antes ou depois do mês do evento. Os valores são lidos por critérios diferentes; não são somados entre si.</p>
      {context.crossingReceipts.map((item) => <div key={item.event_id} className={styles.bridgeItem}><button onClick={() => openEvent(item.event_id)}>{item.event_name} <span aria-hidden="true">↗</span></button><strong>+ {money(item.amount)}</strong><p>Recebimento em {dateName(item.due_on)} · evento em {dateName(item.event_date)}. Faz parte do caixa de {shortMonth(month)} e da operação de {monthName(item.event_date.slice(0, 7))}.</p></div>)}
      {context.outsideReceipts.map(({ event, receipt, uncertain }) => <div key={event.id} className={styles.bridgeItem}><button onClick={() => openEvent(event.id)}>{event.client_name} <span aria-hidden="true">↗</span></button><strong>{money((receipt || uncertain).amount)}</strong><p>Evento de {shortMonth(month)} · {uncertain ? "Recebimento vencido ou sem previsão vigente; fora da projeção datada." : `entrada prevista em ${dateName(receipt.due_on)}, fora deste mês.`}</p></div>)}
    </details>}
    {decision.uncertainReceivable > 0 && <p className={styles.partial}>Há {money(decision.uncertainReceivable)} em recebimentos vencidos ou sem previsão vigente. Continuam pendentes; não financiam a projeção datada. Consulte os detalhes do fluxo abaixo.</p>}
    <section className={styles.timeline} aria-label="Caminho do caixa"><header className={styles.sectionHeading}><div><span className={styles.eyebrow}>Da posição de hoje aos próximos meses</span><h2>O caminho do caixa</h2></div><span className={styles.note}>Fechamentos acumulados</span></header>
      <ol className={styles.timelineTrack}><li className={styles.timelineToday}><span className={styles.timelineDot} /><span className={styles.eyebrow}>Hoje</span><strong>{money(decision.cash)}</strong><small>Caixa real</small></li>{futureRows.slice(0, 3).map((row) => <li key={row.month} className={row.month === month ? styles.selectedMonth : ""}><span className={styles.timelineDot} /><button onClick={() => setMonth(row.month)} aria-pressed={row.month === month}>{shortMonth(row.month)} <span aria-hidden="true">↗</span></button><strong>{money(row.projected)}</strong><small>{row.free < 0 ? `Falta proteger ${money(-row.free)}` : row.reserve > 0 ? `Proteger ${money(row.reserve)}` : "Sem reserva adicional"}</small></li>)}</ol>
      <details className={styles.disclosure}><summary>Se eu retirar dinheiro hoje, quando há risco? <span aria-hidden="true">+</span></summary><p className={styles.note}>{decision.free < 0 ? `Já existe um déficit de ${money(-decision.free)} na projeção conhecida.` : `O limite projetado para uma retirada hoje é ${money(decision.free)}, condicionado aos recebimentos nas datas previstas. Uma retirada acima disso antecipa o risco de faltar caixa.`} Retiradas registradas recalculam esta leitura, sem alterar o lucro dos eventos.</p><details className={styles.disclosure}><summary>Vencimentos e saldo dia a dia <span aria-hidden="true">+</span></summary><ol className={styles.timelineDetails}>{decision.timeline.map((day) => <li key={day.on}><time>{dateName(day.on)}</time><dl><DetailRow label="Movimento previsto do dia" value={day.change} /><DetailRow label="Caixa após os movimentos" value={day.balance} /><DetailRow label="Proteção necessária depois" value={day.reserveAfter} /></dl></li>)}</ol></details><ol className={styles.timelineDetails}>{futureRows.map((row) => <li key={row.month}><button onClick={() => setMonth(row.month)}>{monthName(row.month)}{row.unchecked ? " · Parcial" : ""}</button><dl><DetailRow label="Resultado operacional" value={row.result} /><DetailRow label="Fluxo pendente" value={row.coverage} /><DetailRow label="Caixa projetado" value={row.projected} /><DetailRow label="Proteção posterior" value={row.reserve} /><DetailRow label={row.free < 0 ? "Falta proteger" : "Livre"} value={Math.abs(row.free)} /></dl></li>)}</ol></details>
    </section>
    {flow?.unchecked > 0 && !op.unchecked && <p className={styles.partial}>{flow.unchecked} eventos com previsão no período aguardam conferência. <button onClick={onUnchecked}>Abrir checklist</button></p>}
  </div>;
}
