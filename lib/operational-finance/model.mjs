// Only operational entries are accepted here. All amounts are integer cents.
export function cents(value) {
  const raw = String(value ?? "").replace(/R\$|\s/g, "");
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error("Informe um valor positivo com até duas casas decimais.");
  const n = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(n) || n > 100000000000)
    throw new Error("Valor fora do limite.");
  return n;
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const money = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    (n || 0) / 100,
  );
export function activeEntries(entries) {
  const reversed = new Set(
    entries.filter((x) => x.kind === "reversal").map((x) => x.reverses_id),
  );
  return entries.filter((x) => x.kind !== "reversal" && !reversed.has(x.id));
}
export function eventSummary(event, sheet, entries) {
  const movements = activeEntries(entries).filter(
    (x) => x.event_id === event.id,
  );
  const received = movements
    .filter((x) => x.kind === "receipt")
    .reduce((n, x) => n + x.amount_cents, 0);
  const costs = (sheet?.costs || []).map((x) => {
    const paid = movements
      .filter((m) => m.kind === "payment" && m.cost_id === x.id)
      .reduce((n, m) => n + m.amount_cents, 0);
    return { ...x, paid, open: Math.max(x.amount_cents - paid, 0) };
  });
  const contract =
    sheet?.contract_cents ?? Math.round(Number(event.agreed_amount || 0) * 100);
  const total = costs.reduce((n, x) => n + x.amount_cents, 0);
  return {
    contract,
    received,
    open: Math.max(contract - received, 0),
    overpayment: Math.max(received - contract, 0),
    costs,
    total,
    margin: contract - total,
    checked: sheet?.status === "checked",
  };
}
export function dashboard(events, sheets, entries, settings, date = today()) {
  const active = activeEntries(entries);
  const flows = active.filter(
    (x) => !x.in_opening && x.occurred_on >= settings?.opening_on,
  );
  const cash =
    (settings?.opening_cents || 0) +
    flows.reduce(
      (n, x) => n + (x.kind === "receipt" ? x.amount_cents : -x.amount_cents),
      0,
    );
  let musician = 0,
    other = 0,
    receivable = 0,
    margin = 0,
    unchecked = 0;
  for (const event of events) {
    const s = eventSummary(
      event,
      sheets.find((x) => x.event_id === event.id),
      entries,
    );
    if (!s.checked) {
      if (event.event_date >= date) unchecked++;
      continue;
    }
    for (const c of s.costs) {
      if (c.category === "musician") musician += c.open;
      else other += c.open;
    }
    receivable += s.open;
    if (event.event_date >= date) margin += s.margin;
  }
  const committed = musician + other;
  return {
    cash,
    musician,
    other,
    committed,
    free: cash - committed,
    receivable,
    margin,
    projected: cash - committed + receivable,
    unchecked,
  };
}
