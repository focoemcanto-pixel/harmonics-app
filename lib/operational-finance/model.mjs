// Only operational entries are accepted here. All amounts are integer cents.
export function cents(value) {
  const raw = String(value ?? "").replace(/R\$|\s/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Informe um valor positivo com até duas casas decimais.");
  const n = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(n) || n > 100000000000) throw new Error("Valor fora do limite.");
  return n;
}
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export function receiptDeadline(eventDate) { if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate || "")) return null; const date = new Date(`${eventDate}T12:00:00Z`); if (!Number.isFinite(date.getTime())) return null; date.setUTCDate(date.getUTCDate() - 2); return date.toISOString().slice(0, 10); }
export function expectedReceiptDate(event, sheet) { const deadline = receiptDeadline(event.event_date); const manual = sheet?.expected_receipt_on; return manual && /^\d{4}-\d{2}-\d{2}$/.test(manual) ? deadline ? (manual < deadline ? manual : deadline) : manual : deadline; }
export const money = (n) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((n || 0) / 100);
export function activeEntries(entries) { const reversed = new Set(entries.filter((x) => x.kind === "reversal").map((x) => x.reverses_id)); return entries.filter((x) => x.kind !== "reversal" && !reversed.has(x.id)); }
export function eventSummary(event, sheet, entries) {
  const movements = activeEntries(entries).filter((x) => x.event_id === event.id);
  const received = movements.filter((x) => x.kind === "receipt").reduce((n, x) => n + x.amount_cents, 0);
  const costs = (sheet?.costs || []).filter((x) => x.excluded !== true).map((x) => { const paid = movements.filter((m) => m.kind === "payment" && m.cost_id === x.id).reduce((n, m) => n + m.amount_cents, 0); return { ...x, paid, open: Math.max(x.amount_cents - paid, 0) }; });
  const contract = sheet?.contract_cents ?? Math.round(Number(event.agreed_amount || 0) * 100); const total = costs.reduce((n, x) => n + x.amount_cents, 0);
  return { contract, received, open: Math.max(contract - received, 0), overpayment: Math.max(received - contract, 0), costs, total, margin: contract - total, checked: sheet?.status === "checked" };
}
export const isCancelledEvent = (event) => ["cancelado", "cancelada", "cancelled", "canceled"].includes(String(event?.status || "").toLowerCase());
const openCostSplit = (summary) => { let musician = 0, other = 0; for (const cost of summary.costs) { const amount = Math.max(cost.amount_cents - (cost.paid || 0), 0); if (cost.category === "musician") musician += amount; else other += amount; } return { musician, other, total: musician + other }; };
export function futureEventCosts(event, summary, date = today()) {
  if (!summary.checked || isCancelledEvent(event) || !event?.event_date || event.event_date < date) return { musician: 0, other: 0, total: 0 };
  return openCostSplit(summary);
}
// Evento conferido que já aconteceu depois do marco zero: o saldo de custos ainda não pago no
// histórico é considerado pago na data do evento (sem baixa músico a músico). Pagamentos
// manuais/legados do mesmo custo já reduziram esse saldo, então nada é deduzido duas vezes.
export function realizedEventCosts(event, summary, settings, date = today()) {
  if (!settings?.opening_on || !summary.checked || isCancelledEvent(event) || !event?.event_date) return { musician: 0, other: 0, total: 0 };
  if (event.event_date < settings.opening_on || event.event_date >= date) return { musician: 0, other: 0, total: 0 };
  return openCostSplit(summary);
}
/**
 * Fonte única do caixa real:
 * caixa inicial + recebimentos posteriores − retiradas − pagamentos de custos − custos realizados
 * automaticamente (eventos passados após o marco zero) ± ajustes de conciliação. Lançamentos marcados como já incluídos
 * no caixa inicial ficam no histórico sem movimentar o caixa; estornos anulam o lançamento original.
 */
export function cashPosition(events, sheets, entries, settings, date = today()) {
  const opening = settings?.opening_cents || 0, openingOn = settings?.opening_on || null;
  const active = activeEntries(entries), counts = (x) => !x.in_opening && (!openingOn || x.occurred_on >= openingOn);
  const sum = (kind) => active.filter((x) => x.kind === kind && counts(x)).reduce((n, x) => n + x.amount_cents, 0);
  const receipts = sum("receipt"), withdrawals = sum("withdrawal"), payments = sum("payment");
  // Ajuste de conciliação: corrige o caixa para o saldo real conferido; não é retirada nem custo.
  const adjustmentsIn = sum("adjustment_in"), adjustmentsOut = sum("adjustment_out"), adjustments = adjustmentsIn - adjustmentsOut;
  const reversedIds = new Set(entries.filter((x) => x.kind === "reversal").map((x) => x.reverses_id));
  const reversed = entries.filter((x) => reversedIds.has(x.id) && counts(x)).length;
  const realizedEvents = [], uncheckedPast = [];
  for (const event of events) {
    if (isCancelledEvent(event) || !event?.event_date || !openingOn || event.event_date < openingOn || event.event_date >= date) continue;
    const sheet = sheets.find((x) => x.event_id === event.id), summary = eventSummary(event, sheet, entries);
    if (!summary.checked) { uncheckedPast.push({ event_id: event.id, event_name: event.client_name, event_date: event.event_date }); continue; }
    const realized = realizedEventCosts(event, summary, settings, date);
    if (realized.total > 0) realizedEvents.push({ event_id: event.id, event_name: event.client_name, event_date: event.event_date, ...realized });
  }
  realizedEvents.sort((a, b) => a.event_date.localeCompare(b.event_date));
  const realizedCosts = realizedEvents.reduce((n, x) => n + x.total, 0);
  const reconstructed = opening + receipts - withdrawals - payments - realizedCosts;
  return { opening, opening_on: openingOn, receipts, withdrawals, payments, adjustments, adjustmentsIn, adjustmentsOut, reversed, realizedCosts, realizedEvents, uncheckedPast, reconstructed, cash: reconstructed + adjustments };
}
export function dashboard(events, sheets, entries, settings, date = today()) {
  const position = cashPosition(events, sheets, entries, settings, date), cash = position.cash;
  let musician = 0, other = 0, receivable = 0, margin = 0, unchecked = 0;
  for (const event of events) { if (isCancelledEvent(event)) continue; const s = eventSummary(event, sheets.find((x) => x.event_id === event.id), entries); if (!s.checked) { if (event.event_date >= date) unchecked++; continue; } const future = futureEventCosts(event, s, date); musician += future.musician; other += future.other; receivable += s.open; if (event.event_date >= date) margin += s.margin; }
  const committed = musician + other; return { cash, musician, other, committed, free: cash - committed, receivable, margin, projected: cash - committed + receivable, unchecked, position };
}
export function suggestedCosts(event, savedCosts, musicians, defaults, makeId) {
  const costs = structuredClone(savedCosts || []); const standard = (key) => defaults.find((d) => d.key === key);
  for (const m of musicians.filter((m) => m.event_id === event.id)) { if (costs.some((c) => c.scale_id === m.id)) continue; const rule = standard(`musician:${m.musician_id}`) ?? standard(`role:${m.role}`) ?? standard("general:musician"); costs.push({ id: makeId(), scale_id: m.id, musician_id: m.musician_id, description: `${m.name} — ${m.role || "Músico"}`, category: "musician", status: "predicted", amount_cents: rule?.amount_cents ?? 0, default_cents: rule?.amount_cents ?? 0, notes: "" }); }
  if (Array.isArray(savedCosts)) return costs;
  const categories = [{ key: "cost:sonorização", category: "sonorização", description: "Sonorização", enabled: event.has_sound }, { key: "cost:transporte", category: "transporte", description: "Transporte / deslocamento", enabled: event.has_transport }, { key: "cost:operacional", category: "operacional", description: "Operacional", enabled: true }];
  for (const item of categories) { const rule = standard(item.key); if (!item.enabled || !rule || rule.amount_cents <= 0 || costs.some((c) => c.default_key === item.key || c.category === item.category)) continue; costs.push({ id: makeId(), default_key: item.key, category: item.category, description: item.description, status: "predicted", amount_cents: rule.amount_cents, default_cents: rule.amount_cents, notes: "" }); } return costs;
}
export function describeReception(event) { const hours = Number(event.reception_hours); const hasDuration = Number.isFinite(hours) && hours > 0; if (event.has_reception === true || hasDuration) return ["Sim", hasDuration ? `${hours}h` : "Duração não informada", event.reception_formation, event.reception_instruments].filter(Boolean).join(" • "); return event.has_reception === false ? "Não" : "Não informado"; }
export function monthlyCommitments(events, sheets, ledger, date = today()) {
  const currentMonth = date.slice(0, 7), groups = new Map(), overdueReceipts = [], arrears = []; const bucket = (month) => { if (!groups.has(month)) groups.set(month, { month, musician: 0, other: 0, total: 0, receivable: 0, receipts: [], unchecked: 0, items: [] }); return groups.get(month); }; bucket(currentMonth);
  for (const event of events) { if (isCancelledEvent(event)) continue; const sheet = sheets.find((s) => s.event_id === event.id), summary = eventSummary(event, sheet, ledger); if (!summary.checked) { if (event.event_date >= date && !["cancelado", "cancelled", "canceled"].includes(String(event.status).toLowerCase())) bucket(event.event_date.slice(0, 7)).unchecked++; continue; }
    if (summary.open > 0) { const manual = typeof sheet.expected_receipt_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sheet.expected_receipt_on), due = expectedReceiptDate(event, sheet), receipt = { event_id: event.id, event_name: event.client_name, amount: summary.open, due_on: due, date_source: manual ? "manual" : "event", overdue: due ? due < date : false }; if (!due || due.slice(0, 7) < currentMonth) overdueReceipts.push(receipt); else { const group = bucket(due.slice(0, 7)); group.receivable += summary.open; group.receipts.push(receipt); } }
    if (!event.event_date || event.event_date < date) continue; for (const cost of summary.costs) { const amount = Math.max(cost.amount_cents - (cost.paid || 0), 0); if (amount <= 0) continue; const manualDue = typeof cost.due_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cost.due_on) && cost.due_on <= event.event_date, due = manualDue ? cost.due_on : event.event_date, item = { event_id: event.id, event_name: event.client_name, event_date: event.event_date, cost_id: cost.id, description: cost.description, category: cost.category, amount, due_on: due, date_source: manualDue ? "manual" : "event", overdue: due < date };
    // Data manual de pagamento já vencida (evento ainda futuro): obrigação em atraso, não some para a data do evento.
    if (item.overdue) { arrears.push(item); continue; } const group = bucket(due.slice(0, 7)); group.items.push(item); group.total += amount; if (cost.category === "musician") group.musician += amount; else group.other += amount; }
  }
  let cumulative = 0, cumulativeReceivable = 0; const months = [...groups.values()].sort((a,b)=>a.month.localeCompare(b.month)).map((group)=>{ group.items.sort((a,b)=>a.due_on.localeCompare(b.due_on)||String(a.event_name).localeCompare(String(b.event_name))); group.receipts.sort((a,b)=>a.due_on.localeCompare(b.due_on)); cumulative += group.total; cumulativeReceivable += group.receivable; return {...group,cumulative,cumulativeReceivable,projectedChange:cumulativeReceivable-cumulative}; }); arrears.sort((a,b)=>a.due_on.localeCompare(b.due_on)); return { months, arrears, arrearsTotal: arrears.reduce((n, x) => n + x.amount, 0), overdueReceipts };
}
export function excludeCost(cost) { if (cost.excluded) return { ...cost }; return { ...cost, excluded: true, excluded_amount_cents: cost.amount_cents, amount_cents: 0 }; }
export function restoreCost(cost) { const kept = Object.fromEntries(Object.entries(cost).filter(([key]) => key !== "excluded" && key !== "excluded_amount_cents")); return { ...kept, amount_cents: cost.excluded_amount_cents ?? cost.default_cents ?? 0 }; }
