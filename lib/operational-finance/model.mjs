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
  const costs = (sheet?.costs || [])
    .filter((x) => x.excluded !== true)
    .map((x) => {
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

// Operational standards only. Saved agreements always win, including explicit zeroes.
export function suggestedCosts(event, savedCosts, musicians, defaults, makeId) {
  const costs = structuredClone(savedCosts || []);
  const standard = (key) => defaults.find((d) => d.key === key);
  for (const m of musicians.filter((m) => m.event_id === event.id)) {
    if (costs.some((c) => c.scale_id === m.id)) continue;
    const rule =
      standard(`musician:${m.musician_id}`) ??
      standard(`role:${m.role}`) ??
      standard("general:musician");
    costs.push({
      id: makeId(),
      scale_id: m.id,
      musician_id: m.musician_id,
      description: `${m.name} — ${m.role || "Músico"}`,
      category: "musician",
      status: "predicted",
      amount_cents: rule?.amount_cents ?? 0,
      default_cents: rule?.amount_cents ?? 0,
      notes: "",
    });
  }
  // Standards initialize an unsaved sheet; saved omissions are manual decisions.
  if (Array.isArray(savedCosts)) return costs;
  const categories = [
    {
      key: "cost:sonorização",
      category: "sonorização",
      description: "Sonorização",
      enabled: event.has_sound,
    },
    {
      key: "cost:transporte",
      category: "transporte",
      description: "Transporte / deslocamento",
      enabled: event.has_transport,
    },
    {
      key: "cost:operacional",
      category: "operacional",
      description: "Operacional",
      enabled: true,
    },
  ];
  for (const item of categories) {
    const rule = standard(item.key);
    if (
      !item.enabled ||
      !rule ||
      rule.amount_cents <= 0 ||
      costs.some(
        (c) => c.default_key === item.key || c.category === item.category,
      )
    )
      continue;
    costs.push({
      id: makeId(),
      default_key: item.key,
      category: item.category,
      description: item.description,
      status: "predicted",
      amount_cents: rule.amount_cents,
      default_cents: rule.amount_cents,
      notes: "",
    });
  }
  return costs;
}

// Existing event cards use reception_hours as the indication of a reception.
// Imported events can retain has_reception=false even with an agreed duration.
export function describeReception(event) {
  const hours = Number(event.reception_hours);
  const hasDuration = Number.isFinite(hours) && hours > 0;
  if (event.has_reception === true || hasDuration) {
    return [
      "Sim",
      hasDuration ? `${hours}h` : "Duração não informada",
      event.reception_formation,
      event.reception_instruments,
    ]
      .filter(Boolean)
      .join(" • ");
  }
  return event.has_reception === false ? "Não" : "Não informado";
}

// Cash requirements use unpaid operational costs, never unreceived revenue.
export function monthlyCommitments(events, sheets, ledger, date = today()) {
  const currentMonth = date.slice(0, 7);
  const groups = new Map();
  const arrears = [];
  const overdueReceipts = [];
  const bucket = (month) => {
    if (!groups.has(month))
      groups.set(month, {
        month,
        musician: 0,
        other: 0,
        total: 0,
        receivable: 0,
        receipts: [],
        unchecked: 0,
        items: [],
      });
    return groups.get(month);
  };
  bucket(currentMonth);
  for (const event of events) {
    const sheet = sheets.find((s) => s.event_id === event.id);
    const summary = eventSummary(event, sheet, ledger);
    if (!summary.checked) {
      if (
        event.event_date >= date &&
        !["cancelado", "cancelled", "canceled"].includes(
          String(event.status).toLowerCase(),
        )
      )
        bucket(event.event_date.slice(0, 7)).unchecked++;
      continue;
    }
    if (summary.open > 0) {
      const manual =
        typeof sheet.expected_receipt_on === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(sheet.expected_receipt_on);
      const due = manual ? sheet.expected_receipt_on : event.event_date;
      const receipt = {
        event_id: event.id,
        event_name: event.client_name,
        amount: summary.open,
        due_on: due,
        date_source: manual ? "manual" : "event",
        overdue: due ? due < date : false,
      };
      if (!due || due.slice(0, 7) < currentMonth) overdueReceipts.push(receipt);
      else {
        const group = bucket(due.slice(0, 7));
        group.receivable += summary.open;
        group.receipts.push(receipt);
      }
    }
    for (const cost of summary.costs) {
      if (cost.open <= 0) continue;
      const explicit =
        typeof cost.due_on === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(cost.due_on);
      const due = explicit ? cost.due_on : event.event_date || date;
      const item = {
        event_id: event.id,
        event_name: event.client_name,
        event_date: event.event_date,
        cost_id: cost.id,
        description: cost.description,
        category: cost.category,
        amount: cost.open,
        due_on: due,
        date_source: explicit
          ? "manual"
          : event.event_date
            ? "event"
            : "missing",
        overdue: due < date,
      };
      if (due.slice(0, 7) < currentMonth) {
        arrears.push(item);
        continue;
      }
      const group = bucket(due.slice(0, 7));
      group.items.push(item);
      group.total += item.amount;
      if (cost.category === "musician") group.musician += item.amount;
      else group.other += item.amount;
    }
  }
  arrears.sort(
    (a, b) =>
      a.due_on.localeCompare(b.due_on) ||
      String(a.event_name).localeCompare(String(b.event_name)),
  );
  const arrearsTotal = arrears.reduce((sum, item) => sum + item.amount, 0);
  let cumulative = arrearsTotal;
  let cumulativeReceivable = 0;
  const months = [...groups.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((group) => {
      group.items.sort(
        (a, b) =>
          a.due_on.localeCompare(b.due_on) ||
          String(a.event_name).localeCompare(String(b.event_name)),
      );
      group.receipts.sort((a, b) => a.due_on.localeCompare(b.due_on));
      cumulative += group.total;
      cumulativeReceivable += group.receivable;
      return {
        ...group,
        cumulative,
        cumulativeReceivable,
        projectedChange: cumulativeReceivable - cumulative,
      };
    });
  return { months, arrears, arrearsTotal, overdueReceipts };
}

export function excludeCost(cost) {
  if (cost.excluded) return { ...cost };
  return {
    ...cost,
    excluded: true,
    excluded_amount_cents: cost.amount_cents,
    amount_cents: 0,
  };
}
export function restoreCost(cost) {
  const restored = {
    ...cost,
    amount_cents: cost.excluded_amount_cents ?? cost.default_cents ?? 0,
  };
  delete restored.excluded;
  delete restored.excluded_amount_cents;
  return restored;
}
