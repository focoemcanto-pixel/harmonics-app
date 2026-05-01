'use client';

import { useMemo, useState } from 'react';
import { Field, Input } from '../admin/AdminFormPrimitives';
import AppModal from '../ui/AppModal';
import { supabase } from '@/lib/supabase';

const FIELD_LABELS = {
  client_name: 'Nome do cliente',
  whatsapp_phone: 'WhatsApp',
  event_type: 'Tipo de evento',
  event_date: 'Data do evento',
  event_time: 'Horário',
  duration_min: 'Duração da cerimônia (min)',
  location_name: 'Nome do local',
  location_address: 'Endereço do evento',
  formation: 'Formação',
  instruments: 'Instrumentos',
  reception_hours: 'Receptivo (horas)',
  has_sound: 'Som incluso',
  agreed_amount: 'Valor contratado',
  observations: 'Observações',
  status: 'Status',
};

const FORM_SECTIONS = [
  { title: 'Cliente', fields: ['client_name', 'whatsapp_phone'] },
  { title: 'Evento', fields: ['event_type', 'event_date', 'event_time', 'duration_min', 'location_name', 'location_address'] },
  { title: 'Formação e execução', fields: ['formation', 'instruments', 'reception_hours', 'has_sound'] },
  { title: 'Financeiro', fields: ['agreed_amount', 'status'] },
  { title: 'Observações', fields: ['observations'] },
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
      {extractionConfidence !== null ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Extraído automaticamente</span>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Revise antes de criar o evento</span>
          {missingFields?.length ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Campos com baixa confiança</span> : null}
        </div>
      ) : null}
      {missingFields?.length ? <p className="mt-2 text-sm text-amber-700">Campos faltantes: {missingFields.join(', ')}</p> : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 space-y-5">
        {FORM_SECTIONS.map((section) => (
          <section key={section.title} className="rounded-[12px] border border-slate-200 p-3">
            <h4 className="mb-3 text-sm font-bold text-slate-800">{section.title}</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {section.fields.map((key) => (
                <Field key={key} label={FIELD_LABELS[key] || key}>
                  {key === 'has_sound' ? (
                    <select className="w-full rounded-[10px] border px-3 py-2" value={reviewedData[key] ? 'true' : 'false'} onChange={(e) => setExtractedData((prev) => ({ ...prev, [key]: e.target.value === 'true' }))}>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  ) : (
                    <Input value={reviewedData[key] || ''} onChange={(e) => setExtractedData((prev) => ({ ...prev, [key]: e.target.value }))} />
                  )}
                </Field>
              ))}
            </div>
          </section>
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
