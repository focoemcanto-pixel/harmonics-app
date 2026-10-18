import { activeEntries, eventSummary, expectedReceiptDate, today } from "./model.mjs";

const cancelled = (event) =>
  ["cancelado", "cancelled", "canceled"].includes(String(event?.status || "").toLowerCase());

export function receivablesOverview(events, sheets, ledger, date = today()) {
  const active = activeEntries(ledger);
  const receiptEntries = active.filter((entry) => entry.kind === "receipt");
  const rows = [];

  for (const event of events) {
    if (cancelled(event)) continue;
    const sheet = sheets.find((item) => item.event_id === event.id);
    const summary = eventSummary(event, sheet, ledger);
    if (!summary.checked) continue;

    const receipts = receiptEntries
      .filter((entry) => entry.event_id === event.id)
      .sort((a, b) =>
        String(b.occurred_on || "").localeCompare(String(a.occurred_on || "")) ||
        String(b.created_at || "").localeCompare(String(a.created_at || "")),
      );
    const dueOn = summary.open > 0 ? expectedReceiptDate(event, sheet) : null;

    rows.push({
      event_id: event.id,
      event_name: event.client_name,
      event_date: event.event_date,
      contract: summary.contract,
      received: summary.received,
      open: summary.open,
      overpayment: summary.overpayment,
      costs: summary.total,
      margin: summary.margin,
      due_on: dueOn,
      overdue: Boolean(dueOn && dueOn < date && summary.open > 0),
      status:
        summary.overpayment > 0
          ? "overpaid"
          : summary.open === 0
            ? "paid"
            : summary.received > 0
              ? "partial"
              : "pending",
      receipts,
    });
  }

  rows.sort((a, b) => {
    if (a.status === "paid" && b.status !== "paid") return 1;
    if (b.status === "paid" && a.status !== "paid") return -1;
    return String(a.due_on || a.event_date || "9999").localeCompare(
      String(b.due_on || b.event_date || "9999"),
    );
  });

  const realizedByMonth = new Map();
  for (const entry of receiptEntries) {
    if (!entry.occurred_on) continue;
    const month = entry.occurred_on.slice(0, 7);
    realizedByMonth.set(month, (realizedByMonth.get(month) || 0) + entry.amount_cents);
  }

  const remainingByMonth = new Map();
  for (const row of rows) {
    if (!row.open || !row.due_on) continue;
    const month = row.due_on.slice(0, 7);
    remainingByMonth.set(month, (remainingByMonth.get(month) || 0) + row.open);
  }

  const months = [...new Set([...realizedByMonth.keys(), ...remainingByMonth.keys()])]
    .sort()
    .map((month) => {
      const realized = realizedByMonth.get(month) || 0;
      const remaining = remainingByMonth.get(month) || 0;
      return { month, realized, remaining, expected: realized + remaining };
    });

  const contract = rows.reduce((sum, row) => sum + row.contract, 0);
  const received = rows.reduce((sum, row) => sum + row.received, 0);
  const open = rows.reduce((sum, row) => sum + row.open, 0);
  const costs = rows.reduce((sum, row) => sum + row.costs, 0);
  const margin = rows.reduce((sum, row) => sum + row.margin, 0);

  return {
    rows,
    months,
    totals: { contract, received, open, costs, margin },
  };
}
