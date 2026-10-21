"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ServiceSpecsSummary from "@/components/contracts/ServiceSpecsSummary";
export default function RevisionSigningPage() {
  const { token } = useParams();
  const [data, setData] = useState(null),
    [form, setForm] = useState({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const endpoint = `/api/public/contract-revisions/${token}`;
  useEffect(() => {
    let cancelled = false;
    fetch(endpoint, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message);
        if (!cancelled) {
          setData(j);
          setForm({
            signer_name: j.signer_name,
            signer_cpf: j.signer_cpf,
            accepted_terms: false,
            content_hash: j.content_hash,
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);
  async function sign() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      setData(j);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <section className="mx-auto max-w-3xl space-y-5 rounded-3xl bg-white p-5 text-slate-900 md:p-8">
        <p className="font-bold text-violet-700">Harmonics</p>
        <h1 className="text-2xl font-bold">
          Revisão contratual {data ? `· Versão ${data.version}` : ""}
        </h1>
        {error ? (
          <p role="alert" className="bg-red-50 p-3 text-red-800">
            {error}
          </p>
        ) : null}
        {!data && !error ? <p>Carregando revisão...</p> : null}
        {data ? (
          <>
            <p>
              {data.status === "signed"
                ? "Esta versão está assinada."
                : "A versão anteriormente assinada permanece vigente até a assinatura desta revisão."}
            </p>
            <ServiceSpecsSummary row={{ service_specs: data.services }} />
            <section>
              <h2 className="font-bold">Alterações desta revisão</h2>
              {data.changes.map((c, i) => (
                <p key={i}>
                  <strong>{c.field}:</strong> {c.before} → {c.after}
                </p>
              ))}
            </section>
            <iframe
              title="Contrato revisado completo"
              sandbox=""
              srcDoc={data.html}
              className="h-[65vh] w-full rounded-xl border"
            />
            {data.status === "signed" ? (
              <a
                className="font-bold text-violet-700 underline"
                href={data.pdf_url}
                target="_blank"
                rel="noreferrer"
              >
                Abrir PDF assinado desta versão
              </a>
            ) : (
              <section className="space-y-4">
                <h2 className="font-bold">Nova assinatura</h2>
                <label className="block">
                  Nome na assinatura
                  <input
                    className="block w-full rounded-xl border p-3 text-base"
                    value={form.signer_name || ""}
                    onChange={(e) =>
                      setForm({ ...form, signer_name: e.target.value })
                    }
                  />
                </label>
                <label className="block">
                  CPF da assinatura
                  <input
                    className="block w-full rounded-xl border p-3 text-base"
                    inputMode="numeric"
                    value={form.signer_cpf || ""}
                    onChange={(e) =>
                      setForm({ ...form, signer_cpf: e.target.value })
                    }
                  />
                </label>
                <label className="flex gap-3">
                  <input
                    type="checkbox"
                    checked={form.accepted_terms === true}
                    onChange={(e) =>
                      setForm({ ...form, accepted_terms: e.target.checked })
                    }
                  />
                  Li o documento completo e concordo com os termos desta nova
                  versão.
                </label>
                <button
                  disabled={busy || !form.accepted_terms}
                  onClick={sign}
                  className="rounded-xl bg-violet-700 px-5 py-3 font-bold text-white disabled:opacity-50"
                >
                  {busy
                    ? "Gerando documento e registrando assinatura..."
                    : "Assinar nova versão"}
                </button>
              </section>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
