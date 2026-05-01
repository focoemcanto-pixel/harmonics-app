'use client';

import { useMemo, useState } from 'react';
import { Field, Input } from '../admin/AdminFormPrimitives';
import AppModal from '../ui/AppModal';
import { supabase } from '@/lib/supabase';

const EDITABLE_FIELDS = [
  'client_name',
  'whatsapp_phone',
  'guests_emails',
  'event_type',
  'event_date',
  'event_time',
  'duration_min',
  'location_name',
  'location_address',
  'formation',
  'instruments',
  'agreed_amount',
  'observations',
  'status',
];

export default function ExternalContractImportModal({ open, onClose, onImported, initialData, toast }) {
  const [importFile, setImportFile] = useState(null);
  const [mode, setMode] = useState('extract');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extractedData, setExtractedData] = useState(initialData || {});
  const [missingFields, setMissingFields] = useState([]);
  const [extractionConfidence, setExtractionConfidence] = useState(null);
  const [resultData, setResultData] = useState(null);

  const reviewedData = useMemo(() => extractedData || {}, [extractedData]);

  async function runImport(nextMode) {
    if (!importFile) {
      setError('Selecione um arquivo PDF antes de continuar.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const f = new FormData();
      f.append('file', importFile);
      f.append('mode', nextMode);
      if (nextMode === 'confirm') {
        f.append('reviewedData', JSON.stringify(reviewedData));
      }

      const resp = await fetch('/api/events/import-from-contract', {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: f,
      });
      const payload = await resp.json();
      if (!resp.ok || !payload?.ok) throw new Error(payload?.error || 'Falha na importação.');

      if (nextMode === 'extract') {
        setMode('confirm');
        setExtractedData(payload.extractedData || {});
        setMissingFields(payload.missingFields || []);
        setExtractionConfidence(payload.extractionConfidence ?? null);
        if (payload?.message) toast?.warning?.(payload.message);
      } else {
        setResultData(payload);
        onImported?.(payload);
        toast?.success?.('Evento criado com contrato externo.');
      }
    } catch (err) {
      const msg = err?.message || 'Erro ao importar contrato.';
      setError(msg);
      toast?.error?.(msg);
    } finally {
      setLoading(false);
    }
  }

  const links = {
    event: resultData?.eventId ? `/eventos/${resultData.eventId}` : null,
    pdf: resultData?.contractPdfUrl || resultData?.pdfUrl || null,
    panel: resultData?.panelLink || resultData?.adminLink || null,
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Importar contrato externo"
      subtitle="Vamos tentar identificar os dados do contrato. Você poderá revisar antes de salvar."
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={loading} onClick={() => runImport('extract')} className="rounded-[12px] border px-3 py-2 text-sm font-bold disabled:opacity-50">Extrair dados</button>
          <button type="button" disabled={loading || mode !== 'confirm'} onClick={() => runImport('confirm')} className="rounded-[12px] bg-violet-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Confirmar e criar evento com contrato externo</button>
        </div>
      }
    >
      <input type="file" accept="application/pdf" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
      {extractionConfidence !== null ? <p className="mt-3 text-sm text-slate-600">Confiança da extração: {Math.round(Number(extractionConfidence) * 100)}%</p> : null}
      {missingFields?.length ? <p className="mt-2 text-sm text-amber-700">Campos faltantes: {missingFields.join(', ')}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {EDITABLE_FIELDS.map((key) => (
          <Field key={key} label={key}>
            <Input value={reviewedData[key] || ''} onChange={(e) => setExtractedData((prev) => ({ ...prev, [key]: e.target.value }))} />
          </Field>
        ))}
      </div>

      {resultData ? (
        <div className="mt-4 rounded-[14px] border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-bold text-emerald-800">Importação concluída.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {links.event ? <a className="font-semibold text-emerald-900 underline" href={links.event}>Ver evento</a> : null}
            {links.pdf ? <a className="font-semibold text-emerald-900 underline" href={links.pdf} target="_blank" rel="noreferrer">Ver PDF</a> : null}
            {links.panel ? <button type="button" className="font-semibold text-emerald-900 underline" onClick={() => navigator.clipboard?.writeText(links.panel)}>Copiar link do painel</button> : null}
          </div>
        </div>
      ) : null}

      {loading ? <p className="mt-3 text-sm text-slate-500">Processando...</p> : null}
    </AppModal>
  );
}
