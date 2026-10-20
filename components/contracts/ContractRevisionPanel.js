"use client";
import { useEffect, useState } from "react";
import ServiceSpecsEditor from "./ServiceSpecsEditor";
import RichContractEditor from "./RichContractEditor";
import { getServiceSpecs } from "@/lib/contracts/service-specs.mjs";
const input =
  "w-full rounded-xl border border-slate-300 bg-white p-2 text-base text-slate-900";
export default function ContractRevisionPanel({ contractId }) {
  const [open, setOpen] = useState(false),
    [data, setData] = useState(null),
    [draft, setDraft] = useState(null),
    [source, setSource] = useState(""),
    [review, setReview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [link, setLink] = useState("");
  const endpoint = `/api/contracts/${contractId}/revisions`;
  async function load() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(endpoint, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      setData(j);
      setDraft({
        ...j.precontract,
        service_specs: getServiceSpecs(j.precontract),
      });
      setSource(j.source);
      setReview(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (open) load();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  async function action(kind, revisionId) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: kind,
          changes: draft,
          source_html: source,
          revision_id: revisionId,
          expected_updated_at: data.contract.updated_at,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      if (kind === "preview") setReview(j);
      else {
        if (j.link) setLink(j.link);
        if (kind === "cancel") setLink("");
        await load();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const pending = data?.history?.find((v) => v.status === "pending");
  const signed = data?.history?.find((v) => v.status === "signed");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-violet-300 bg-white px-4 py-3 font-semibold text-violet-800"
      >
        Revisar contrato / histórico
      </button>
      {open ? (
        <div className="fixed inset-0 z-[220] overflow-y-auto bg-slate-950/70 p-3">
          <section className="mx-auto my-4 max-w-4xl space-y-5 rounded-3xl bg-white p-5 text-slate-900 md:p-8">
            <div className="flex justify-between gap-3">
              <h2 className="text-xl font-bold">Revisar contrato</h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  setLink("");
                }}
              >
                Fechar
              </button>
            </div>
            <p>
              A versão {signed?.version || 1} assinada permanece vigente até a
              nova assinatura. Evento, cliente, escala e pagamentos são
              preservados.
            </p>
            {error ? (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">
                {error}
              </p>
            ) : null}
            {busy ? <p>Processando...</p> : null}
            {data ? (
              <section className="space-y-2 rounded-2xl bg-slate-50 p-4">
                <h3 className="font-bold">Histórico do mesmo contrato</h3>
                {data.history.length ? (
                  data.history.map((v) => (
                    <div key={v.id} className="border-b border-slate-200 py-2">
                      <p className="font-semibold">
                        Versão {v.version} —{" "}
                        {v.status === "pending"
                          ? "Aguardando assinatura"
                          : v.status === "signed"
                            ? v.id === signed?.id
                              ? "Assinada · VIGENTE"
                              : "Assinada · Histórico"
                            : "Cancelada"}{" "}
                        {v.signed_at
                          ? new Date(v.signed_at).toLocaleString("pt-BR")
                          : ""}
                      </p>
                      {v.status === "signed" && v.pdf_url ? (
                        <a
                          className="text-violet-700 underline"
                          href={`/api/public/files/contract/${v.public_token}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir documento desta versão
                        </a>
                      ) : null}
                      {v.financial_review_required ? (
                        <p className="text-sm text-amber-800">
                          Valor revisado. Conferir condições e parcelas no
                          financeiro; nenhuma cobrança foi criada por esta
                          revisão.
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p>
                    Versão 1 assinada. O histórico será preservado ao gerar a
                    primeira revisão.
                  </p>
                )}
              </section>
            ) : null}
            {pending ? (
              <section className="space-y-3 rounded-xl border border-amber-300 p-4">
                <p className="font-bold">
                  Versão {pending.version} pendente — ainda não vigente
                </p>
                {pending.changes.map((c, i) => (
                  <p key={i}>
                    {c.field}: {c.before} → {c.after}
                  </p>
                ))}
                <a
                  href={`/contrato/revisao/${pending.public_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-violet-700 underline"
                >
                  Abrir link de nova assinatura
                </a>
                <button
                  disabled={busy}
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `${window.location.origin}/contrato/revisao/${pending.public_token}`,
                    )
                  }
                >
                  Copiar link para enviar ao cliente
                </button>
                <button
                  disabled={busy}
                  type="button"
                  className="block text-red-700"
                  onClick={() => action("cancel", pending.id)}
                >
                  Cancelar revisão pendente
                </button>
              </section>
            ) : null}
            {link && !pending ? <a href={link}>Abrir revisão criada</a> : null}
            {draft && !pending && !review ? (
              <>
                <ServiceSpecsEditor
                  value={draft.service_specs}
                  onChange={(v) => setDraft({ ...draft, service_specs: v })}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["event_date", "Data do evento", "date"],
                    ["event_time", "Horário", "time"],
                    ["location_name", "Local", "text"],
                    ["location_address", "Endereço", "text"],
                    ["agreed_amount", "Novo valor contratado (R$)", "number"],
                    ["payment_method", "Condição de pagamento", "text"],
                    ["signal_due_date", "Vencimento do sinal", "date"],
                    ["balance_due_date", "Vencimento do saldo", "date"],
                    ["card_due_date", "Vencimento do cartão", "date"],
                  ].map(([k, l, t]) => (
                    <label key={k}>
                      {l}
                      <input
                        className={input}
                        type={t}
                        step={t === "number" ? "0.01" : undefined}
                        value={draft[k] ?? ""}
                        onChange={(e) =>
                          setDraft({ ...draft, [k]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4">
                  {[
                    ["has_sound", "Sonorização"],
                    ["has_transport", "Transporte"],
                    ["payment_card", "Pagamento por cartão"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={draft[key] === true}
                        onChange={(e) =>
                          setDraft({ ...draft, [key]: e.target.checked })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <label>
                  Observações
                  <textarea
                    className={input}
                    value={draft.notes || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, notes: e.target.value })
                    }
                  />
                </label>
                <details>
                  <summary className="cursor-pointer font-semibold">
                    Editar cláusulas desta revisão
                  </summary>
                  <RichContractEditor
                    initialHtml={data.source}
                    onChangeHtml={setSource}
                  />
                </details>
                <p className="text-sm text-amber-800">
                  Mudanças de valor só entram em vigor após assinatura.
                  Pagamentos realizados e parcelas existentes não serão
                  recriados. A conferência financeira é manual.
                </p>
                <button
                  disabled={busy}
                  type="button"
                  onClick={() => action("preview")}
                  className="rounded-xl bg-violet-700 px-4 py-3 font-bold text-white"
                >
                  Revisar mudanças
                </button>
              </>
            ) : null}
            {review ? (
              <section className="space-y-4">
                <h3 className="font-bold">Alterações desta revisão</h3>
                {review.changes.map((c, i) => (
                  <div key={i}>
                    <p className="font-semibold">{c.field}</p>
                    <p>
                      {c.before} → {c.after}
                    </p>
                  </div>
                ))}
                <iframe
                  title="Documento da revisão"
                  className="h-96 w-full border"
                  sandbox=""
                  srcDoc={review.html}
                />
                <div className="flex gap-3">
                  <button disabled={busy} onClick={() => setReview(null)}>
                    Voltar à edição
                  </button>
                  <button
                    disabled={busy || !review.changes.length}
                    onClick={() => action("create")}
                    className="rounded-xl bg-violet-700 p-3 font-bold text-white"
                  >
                    Gerar nova versão para assinatura
                  </button>
                </div>
              </section>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
