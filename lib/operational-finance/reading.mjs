// Keep undated events visible without assigning an artificial date or competence.
export function compareEventDates(a, b) {
  if (!a.event_date) return b.event_date ? 1 : 0;
  if (!b.event_date) return -1;
  return a.event_date.localeCompare(b.event_date);
}

// Presentation selectors only: all monetary results remain owned by financeDecision.
export function readingContext(decision, planning, events, month) {
  const later = decision.timeline.filter((row) => row.on.slice(0, 7) > month);
  const operation = decision.months.find((row) => row.month === month);
  const critical = later.reduce((lowest, row) => !lowest || row.balance < lowest.balance ? row : lowest, null);
  const receipts = planning.months.flatMap((row) => row.receipts);
  const costs = [...planning.arrears, ...planning.months.flatMap((row) => row.items)];
  const nextReceipt = critical && receipts.filter((row) => row.due_on > critical.on).sort((a, b) => a.due_on.localeCompare(b.due_on))[0];
  const through = nextReceipt?.due_on || critical?.on;
  const reserveMovements = [
    ...costs.map((row) => ({ ...row, direction: 'out' })),
    ...receipts.map((row) => ({ ...row, direction: 'in' })),
  ].filter((row) => row.due_on?.slice(0, 7) > month && (!through || row.due_on <= through))
    .sort((a, b) => a.due_on.localeCompare(b.due_on) || a.direction.localeCompare(b.direction));
  const crossingReceipts = receipts.filter((row) => row.due_on?.slice(0, 7) === month && events.find((event) => event.id === row.event_id)?.event_date?.slice(0, 7) !== month)
    .map((row) => ({ ...row, event_date: events.find((event) => event.id === row.event_id)?.event_date }));
  const outsideReceipts = events.filter((event) => event.event_date?.slice(0, 7) === month)
    .map((event) => ({ event, receipt: receipts.find((row) => row.event_id === event.id), uncertain: planning.overdueReceipts.find((row) => row.event_id === event.id) }))
    .filter(({ receipt, uncertain }) => uncertain || receipt && receipt.due_on?.slice(0, 7) !== month);
  const risk = decision.timeline.find((row) => row.on.slice(0, 7) >= month && row.balance < 0);
  return { operation, critical, nextReceipt, reserveMovements, crossingReceipts, outsideReceipts, risk };
}
