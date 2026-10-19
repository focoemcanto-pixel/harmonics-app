import { activeEntries, dashboard, eventSummary, expectedReceiptDate, realizedEventCosts, today } from "./model.mjs";
const cancelled = (event) => ["cancelado", "cancelled", "canceled"].includes(String(event?.status || "").toLowerCase());
export function receivablesOverview(events, sheets, ledger, settings = null, date = today()) {
  const active = activeEntries(ledger), receiptEntries = active.filter((entry) => entry.kind === "receipt"), withdrawalEntries = active.filter((entry) => entry.kind === "withdrawal"), rows = [];
  for (const event of events) { if (cancelled(event)) continue; const sheet = sheets.find((item) => item.event_id === event.id), summary = eventSummary(event, sheet, ledger); if (!summary.checked) continue; const receipts = receiptEntries.filter((entry) => entry.event_id === event.id).sort((a,b)=>String(b.occurred_on||"").localeCompare(String(a.occurred_on||""))||String(b.created_at||"").localeCompare(String(a.created_at||""))), dueOn = summary.open > 0 ? expectedReceiptDate(event, sheet) : null; rows.push({ event_id:event.id,event_name:event.client_name,event_date:event.event_date,location_name:event.location_name,contract:summary.contract,received:summary.received,open:summary.open,overpayment:summary.overpayment,costs:summary.total,margin:summary.margin,due_on:dueOn,overdue:Boolean(dueOn&&dueOn<date&&summary.open>0),status:summary.overpayment>0?"overpaid":summary.open===0?"paid":summary.received>0?"partial":"pending",receipts }); }
  rows.sort((a,b)=>{if(a.status==="paid"&&b.status!=="paid")return 1;if(b.status==="paid"&&a.status!=="paid")return -1;return String(a.due_on||a.event_date||"9999").localeCompare(String(b.due_on||b.event_date||"9999"));});
  const realizedByMonth=new Map(),remainingByMonth=new Map(); for(const entry of receiptEntries){if(!entry.occurred_on)continue;const month=entry.occurred_on.slice(0,7);realizedByMonth.set(month,(realizedByMonth.get(month)||0)+entry.amount_cents);} for(const row of rows){if(!row.open||!row.due_on)continue;const month=row.due_on.slice(0,7);remainingByMonth.set(month,(remainingByMonth.get(month)||0)+row.open);} const months=[...new Set([...realizedByMonth.keys(),...remainingByMonth.keys()])].sort().map((month)=>{const realized=realizedByMonth.get(month)||0,remaining=remainingByMonth.get(month)||0;return{month,realized,remaining,expected:realized+remaining};});
  const contract=rows.reduce((s,r)=>s+r.contract,0),received=rows.reduce((s,r)=>s+r.received,0),open=rows.reduce((s,r)=>s+r.open,0),costs=rows.reduce((s,r)=>s+r.costs,0),margin=rows.reduce((s,r)=>s+r.margin,0),cash=settings?dashboard(events,sheets,ledger,settings,date):null,withdrawals=withdrawalEntries.filter((e)=>!e.in_opening).reduce((s,e)=>s+e.amount_cents,0);
  return {rows,months,totals:{contract,received,open,costs,margin,withdrawals},cash:cash?{current:cash.cash,futureCosts:cash.committed,futureMusicians:cash.musician,futureOther:cash.other,remainingReceivables:cash.receivable,projected:cash.projected,operationalFree:cash.free}:null};
}

// Busca global do checklist: nome, data (ISO ou dd/mm/aaaa) ou local, sem depender do mês selecionado.
const fold = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function matchesEventSearch(row, term) {
  const raw = fold(term).trim(); if (!raw) return true;
  const br = row.event_date ? row.event_date.split("-").reverse().join("/") : "";
  const haystack = fold(`${row.event_name || row.client_name || ""} ${row.event_date || ""} ${br} ${row.location_name || ""}`);
  return raw.split(/\s+/).every((part) => haystack.includes(part));
}
// Linha do tempo de um evento: lançamentos reais (com estornos) + custo realizado automaticamente.
export function eventHistory(event, sheet, ledger, settings, date = today()) {
  const reversed = new Set(ledger.filter((x) => x.kind === "reversal").map((x) => x.reverses_id));
  const items = ledger.filter((x) => x.event_id === event.id).map((x) => ({ ...x, source: "ledger", reversed: x.kind !== "reversal" && reversed.has(x.id) }));
  const realized = realizedEventCosts(event, eventSummary(event, sheet, ledger), settings, date);
  if (realized.total > 0) items.push({ id: `realized:${event.id}`, source: "realized", kind: "realized_cost", amount_cents: realized.total, musician_cents: realized.musician, other_cents: realized.other, occurred_on: event.event_date, created_at: `${event.event_date}T23:59:59Z` });
  return items.sort((a, b) => String(b.occurred_on || "").localeCompare(String(a.occurred_on || "")) || String(b.created_at || "").localeCompare(String(a.created_at || "")));
}
