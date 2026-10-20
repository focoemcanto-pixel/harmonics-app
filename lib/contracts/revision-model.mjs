import {
  getServiceSpecs,
  normalizeServiceSpecs,
  legacyServiceProjection,
  describeService,
} from "./service-specs.mjs";
export const REVISION_FIELDS = [
  "event_date",
  "event_time",
  "location_name",
  "location_address",
  "has_sound",
  "has_transport",
  "agreed_amount",
  "payment_method",
  "signal_due_date",
  "balance_due_date",
  "card_due_date",
  "payment_card",
  "notes",
  "custom_contract_enabled",
  "custom_contract_content",
  "custom_contract_rich_html",
  "contract_template_id",
  "contract_mode",
];
export function revisionSnapshot(precontract, changes = {}) {
  const next = { ...precontract };
  for (const key of REVISION_FIELDS)
    if (Object.hasOwn(changes, key)) next[key] = changes[key];
  next.service_specs = Object.hasOwn(changes, "service_specs")
    ? normalizeServiceSpecs(changes.service_specs)
    : getServiceSpecs(precontract);
  Object.assign(next, legacyServiceProjection(next.service_specs));
  next.agreed_amount = Number(next.agreed_amount || 0);
  if (!Number.isFinite(next.agreed_amount) || next.agreed_amount < 0)
    throw new Error("Valor contratado inválido.");
  for (const key of [
    "event_date",
    "signal_due_date",
    "balance_due_date",
    "card_due_date",
  ]) {
    if (!next[key] && key !== "event_date") continue;
    const value = String(next[key] || "");
    const date = new Date(`${value}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new Error("Data inválida.");
  }
  if (
    next.event_time &&
    !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(next.event_time)
  )
    throw new Error("Horário inválido.");

  return next;
}
export function revisionDiff(before, after) {
  const oldSpecs = getServiceSpecs(before),
    newSpecs = getServiceSpecs(after);
  const changes = [];
  for (const id of new Set([
    ...oldSpecs.map((s) => s.id),
    ...newSpecs.map((s) => s.id),
  ])) {
    const a = oldSpecs.find((s) => s.id === id),
      b = newSpecs.find((s) => s.id === id);
    if (JSON.stringify(a) !== JSON.stringify(b))
      changes.push({
        field: b?.label || a?.label,
        before: a ? describeService(a) : "Não contratado",
        after: b ? describeService(b) : "Não contratado",
      });
  }
  const labels = {
    agreed_amount: "Valor",
    event_date: "Data",
    event_time: "Horário",
    location_name: "Local",
    location_address: "Endereço do evento",
    payment_method: "Condição de pagamento",
    signal_due_date: "Vencimento do sinal",
    balance_due_date: "Vencimento do saldo",
    card_due_date: "Vencimento no cartão",
    payment_card: "Pagamento por cartão",
    has_sound: "Sonorização",
    has_transport: "Transporte",
    notes: "Observações",
    custom_contract_rich_html: "Cláusulas personalizadas",
    contract_template_id: "Template",
  };
  for (const [key, label] of Object.entries(labels))
    if (String(before[key] ?? "") !== String(after[key] ?? ""))
      changes.push({
        field: label,
        before:
          key === "custom_contract_rich_html"
            ? "Texto anterior"
            : String(before[key] ?? "Não informado"),
        after:
          key === "custom_contract_rich_html"
            ? "Texto revisado"
            : String(after[key] ?? "Não informado"),
      });
  return changes.map((change) =>
    change.field === "Valor"
      ? {
          ...change,
          before: new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(Number(change.before || 0)),
          after: new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(Number(change.after || 0)),
        }
      : change,
  );
}
