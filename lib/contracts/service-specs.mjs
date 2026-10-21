const text = (v) => String(v ?? "").trim();
export function normalizeServiceSpecs(input) {
  if (!Array.isArray(input) || input.length > 30)
    throw new Error("Informe uma lista de até 30 serviços.");
  const ids = new Set();
  return input.map((item, index) => {
    const id = text(item.id || `service-${index + 1}`);
    if (ids.has(id)) throw new Error("Serviço duplicado.");
    ids.add(id);
    const label = text(item.label);
    const duration =
      item.duration_minutes === "" || item.duration_minutes == null
        ? null
        : Number(item.duration_minutes);
    if (
      !label ||
      label.length > 120 ||
      (duration !== null &&
        (!Number.isInteger(duration) || duration <= 0 || duration > 14400))
    )
      throw new Error("Nome ou duração do serviço inválido.");
    const roles = (
      Array.isArray(item.roles) ? item.roles : text(item.roles).split(/[,;\n]/)
    )
      .map(text)
      .filter(Boolean);
    if (roles.length > 40 || roles.some((r) => r.length > 100))
      throw new Error("Instrumentos/funções inválidos.");
    return {
      id,
      kind: text(item.kind || "other").slice(0, 60),
      label,
      formation: text(item.formation).slice(0, 120),
      roles,
      duration_minutes: duration,
      notes: text(item.notes).slice(0, 2000),
    };
  });
}
export function getServiceSpecs(row = {}) {
  if (Array.isArray(row.service_specs))
    return normalizeServiceSpecs(row.service_specs);
  const rows = [];
  if (row.formation || row.instruments)
    rows.push({
      id: "primary",
      kind: "primary",
      label: "Cerimônia",
      formation: row.formation,
      roles: row.instruments || "",
      duration_minutes: row.duration_min || null,
    });
  if (Number(row.reception_hours) > 0 || row.has_reception === true)
    rows.push({
      id: "reception",
      kind: "reception",
      label: "Receptivo",
      formation: row.reception_formation,
      roles: row.reception_instruments || "",
      duration_minutes:
        Number(row.reception_hours) > 0
          ? Number(row.reception_hours) * 60
          : null,
    });
  return normalizeServiceSpecs(rows);
}
export function durationLabel(minutes) {
  return minutes
    ? minutes % 60 === 0
      ? `${minutes / 60}h`
      : `${minutes} min`
    : "";
}
export function describeService(s) {
  return [
    s.formation,
    s.roles.join(", "),
    durationLabel(s.duration_minutes),
    s.notes,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function servicesText(specs) {
  return specs.map((s) => `${s.label}: ${describeService(s)}`).join("\n");
}
// Only a compatibility projection for existing consumers; service_specs is authoritative.
export function legacyServiceProjection(specs) {
  const main =
    specs.find((s) => s.kind === "primary") ||
    specs.find((s) => s.kind !== "reception");
  const reception = specs.find((s) => s.kind === "reception");
  return {
    formation: main?.formation || null,
    instruments: main?.roles.join(", ") || null,
    duration_min: main?.duration_minutes || 60,
    reception_formation: reception?.formation || null,
    reception_instruments: reception?.roles.join(", ") || null,
    reception_hours: reception?.duration_minutes
      ? Math.ceil(reception.duration_minutes / 60)
      : 0,
  };
}
