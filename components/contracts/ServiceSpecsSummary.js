import {
  getServiceSpecs,
  durationLabel,
} from "@/lib/contracts/service-specs.mjs";
export default function ServiceSpecsSummary({ row }) {
  const services = getServiceSpecs(row || {});
  if (!services.length) return null;
  return (
    <section className="my-3 space-y-2 rounded-2xl border border-current/15 p-4">
      <h3 className="font-bold">Serviços contratados</h3>
      {services.map((s) => (
        <div key={s.id}>
          <p className="font-semibold">
            {s.label}
            {s.formation ? ` — ${s.formation}` : ""}
          </p>
          <p className="text-sm">
            {s.roles.join(", ")}
            {s.duration_minutes
              ? ` · ${durationLabel(s.duration_minutes)}`
              : ""}
          </p>
          {s.notes ? <p className="text-sm">{s.notes}</p> : null}
        </div>
      ))}
    </section>
  );
}
