"use client";
const input =
  "w-full rounded-xl border border-slate-300 bg-white p-2 text-base text-slate-900";
export default function ServiceSpecsEditor({ value = [], onChange }) {
  const update = (i, key, v) =>
    onChange(value.map((s, n) => (n === i ? { ...s, [key]: v } : s)));
  return (
    <section className="space-y-3">
      <h3 className="font-bold">Serviços contratados</h3>
      {value.map((s, i) => (
        <fieldset
          key={s.id}
          className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-2"
        >
          <legend className="px-2 font-semibold">
            {s.label || `Serviço ${i + 1}`}
          </legend>
          <label>
            Tipo do serviço
            <input
              className={input}
              value={s.label}
              onChange={(e) => update(i, "label", e.target.value)}
            />
          </label>
          <label>
            Formação
            <input
              className={input}
              value={s.formation}
              onChange={(e) => update(i, "formation", e.target.value)}
              placeholder="Trio, Quarteto..."
            />
          </label>
          <label>
            Instrumentos/funções
            <input
              className={input}
              value={Array.isArray(s.roles) ? s.roles.join(", ") : s.roles}
              onChange={(e) =>
                update(
                  i,
                  "roles",
                  e.target.value.split(",").map((x) => x.trim()),
                )
              }
              placeholder="Voz, Violino, Teclado"
            />
          </label>
          <label>
            Duração em minutos
            <input
              className={input}
              type="number"
              min="1"
              max="14400"
              value={s.duration_minutes ?? ""}
              onChange={(e) =>
                update(
                  i,
                  "duration_minutes",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            />
          </label>
          <label className="md:col-span-2">
            Observações específicas
            <textarea
              className={input}
              value={s.notes || ""}
              onChange={(e) => update(i, "notes", e.target.value)}
            />
          </label>
          <button
            type="button"
            className="text-left text-sm text-red-700"
            onClick={() => onChange(value.filter((_, n) => n !== i))}
          >
            Remover serviço
          </button>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-3">
        {[
          ["primary", "Cerimônia"],
          ["reception", "Receptivo"],
          ["other", "Outro serviço"],
        ].map(([kind, label]) => (
          <button
            className="rounded-xl border border-violet-300 bg-white px-3 py-2 text-violet-800"
            type="button"
            key={kind}
            onClick={() =>
              onChange([
                ...value,
                {
                  id: crypto.randomUUID(),
                  kind,
                  label: kind === "other" ? "Novo serviço" : label,
                  formation: "",
                  roles: [],
                  duration_minutes: null,
                  notes: "",
                },
              ])
            }
          >
            Adicionar {label.toLowerCase()}
          </button>
        ))}
      </div>
    </section>
  );
}
