'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, UploadCloud, X } from 'lucide-react';
import { Field, Input } from '../admin/AdminFormPrimitives';
import AppModal from '../ui/AppModal';
import { supabase } from '@/lib/supabase';

const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;

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

function formatFileSize(bytes = 0) {
  if (!bytes) return '0 MB';
  return `${(Number(bytes) / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeFetchError(error) {
  const message = String(error?.message || '').trim();
  if (/failed to fetch|networkerror|load failed|cancelled/i.test(message)) {
    return 'Não foi possível enviar o PDF. Verifique a internet do celular, confirme que o arquivo é um PDF válido e tente novamente. Se continuar, salve o PDF em Arquivos/Downloads e selecione novamente.';
  }
  return message || 'Erro ao importar contrato.';
}

export default function ExternalContractImportModal({ open, onClose, onImported, initialData, toast }) {
  const toDisplayDateBr = (value) => {
    const safe = String(value || '').trim();
    const isoMatch = safe.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    return safe;
  };
  const toIsoDate = (value) => {
    const safe = String(value || '').trim();
    const brMatch = safe.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    return safe;
  };
  const [importFile, setImportFile] = useState(null);
  const [mode, setMode] = useState('extract');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extractedData, setExtractedData] = useState(initialData || {});
  const [missingFields, setMissingFields] = useState([]);
  const [extractionConfidence, setExtractionConfidence] = useState(null);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [resultData, setResultData] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const uploadAbortRef = useRef(null);
  const reviewedData = useMemo(() => extractedData || {}, [extractedData]);
  const minimumMissingFields = useMemo(() => {
    const missing = [];
    if (!reviewedData.client_name) missing.push('client_name');
    if (!reviewedData.event_type) missing.push('event_type');
    if (!reviewedData.event_date) missing.push('event_date');
    if (!reviewedData.event_time) missing.push('event_time');
    if (!reviewedData.location_name) missing.push('location_name');
    if (!reviewedData.agreed_amount && (!reviewedData.formation || !reviewedData.instruments)) missing.push('agreed_amount_or_formation_instruments');
    return missing;
  }, [reviewedData]);

  useEffect(() => {
    if (!importFile) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(importFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [importFile]);

  useEffect(() => () => {
    uploadAbortRef.current?.abort?.();
  }, []);

  function resetImportState() {
    setIsPreviewOpen(false);
    setMode('extract');
    setExtractionStatus('');
    setExtractionConfidence(null);
    setMissingFields([]);
    setExtractedData({});
    setResultData(null);
    setError('');
  }

  function handleFileChange(file) {
    resetImportState();
    if (!file) {
      setImportFile(null);
      return;
    }

    const fileName = String(file.name || '').toLowerCase();
    const fileType = String(file.type || '').toLowerCase();
    const isPdf = fileType === 'application/pdf' || fileType === 'application/octet-stream' || fileName.endsWith('.pdf');

    if (!isPdf) {
      setImportFile(null);
      setError('Selecione um arquivo PDF válido.');
      toast?.error?.('Selecione um arquivo PDF válido.');
      return;
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      setImportFile(null);
      const msg = `PDF muito grande (${formatFileSize(file.size)}). O limite é 15 MB.`;
      setError(msg);
      toast?.error?.(msg);
      return;
    }

    setImportFile(file);
  }

  async function buildSafeUploadPayload(file) {
    const buffer = await file.arrayBuffer();
    const fallbackName = file?.name || 'contrato.pdf';

    try {
      const safeFile = new File([buffer], fallbackName, { type: 'application/pdf' });
      return { uploadPayload: safeFile, payloadName: safeFile.name || fallbackName };
    } catch (_error) {
      const safeBlob = new Blob([buffer], { type: 'application/pdf' });
      return { uploadPayload: safeBlob, payloadName: fallbackName };
    }
  }

  async function runImport(nextMode) {
    if (!importFile) {
      setError('Selecione um arquivo PDF antes de continuar.');
      return;
    }
    setError('');
    setLoading(true);
    let timeoutId = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Sessão expirada. Saia da conta, entre novamente e tente importar o PDF outra vez.');
      }

      const { uploadPayload, payloadName } = await buildSafeUploadPayload(importFile);

      console.info('[EXTERNAL_CONTRACT_UPLOAD]', {
        name: payloadName,
        type: uploadPayload.type || 'application/pdf',
        size: uploadPayload.size || 0,
      });

      const f = new FormData();
      f.append('file', uploadPayload, payloadName);
      f.append('mode', nextMode);
      if (nextMode === 'confirm') {
        f.append('reviewedData', JSON.stringify(reviewedData));
      }

      const controller = new AbortController();
      uploadAbortRef.current = controller;
      timeoutId = setTimeout(() => controller.abort(), 60_000);

      const resp = await fetch('/api/events/import-from-contract', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        body: f,
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      timeoutId = null;
      uploadAbortRef.current = null;
      const contentType = String(resp.headers.get('content-type') || '');
      const responsePayload = contentType.includes('application/json') ? await resp.json() : { ok: false, error: await resp.text() };
      if (!resp.ok || !responsePayload?.ok) throw new Error(responsePayload?.error || responsePayload?.message || 'Falha na importação.');

      if (nextMode === 'extract') {
        setMode('confirm');
        setExtractedData(responsePayload.extractedData || {});
        setMissingFields(responsePayload.missingFields || []);
        setExtractionConfidence(responsePayload.extractionConfidence ?? null);
        setExtractionStatus(responsePayload.extractionStatus || '');
        if (responsePayload?.warning) toast?.warning?.(responsePayload.warning);
      } else {
        setResultData(responsePayload);
        onImported?.(responsePayload);
        toast?.success?.('Evento criado com contrato externo.');
      }
    } catch (err) {
      console.error('[EXTERNAL_CONTRACT_UPLOAD_ERROR]', err);
      const msg = normalizeFetchError(err);
      setError(msg);
      toast?.error?.(msg);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      uploadAbortRef.current = null;
      setLoading(false);
    }
  }

  const links = {
    event: resultData?.eventId ? `/eventos/${resultData.eventId}` : null,
    pdf: resultData?.contractPdfUrl || resultData?.pdfUrl || null,
    panel: resultData?.clientPanelLink || resultData?.panelLink || resultData?.adminLink || null,
  };
  const absolutePanelLink = links.panel
    ? (links.panel.startsWith('http://') || links.panel.startsWith('https://')
      ? links.panel
      : `${window.location.origin}${links.panel}`)
    : null;
  const extractedSummaryMessage = extractionStatus === 'auto'
    ? 'Dados encontrados automaticamente'
    : extractionStatus === 'partial'
      ? 'Alguns dados não puderam ser identificados'
      : 'Preenchimento manual necessário';

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Importar contrato externo"
      subtitle="Vamos tentar identificar os dados do contrato. Você poderá revisar antes de salvar."
      maxWidthClass="max-w-3xl"
      footer={
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={loading} onClick={() => runImport('extract')} className="rounded-[12px] border px-3 py-2 text-sm font-bold disabled:opacity-50">Extrair dados automaticamente</button>
          <button type="button" disabled={loading || mode !== 'confirm' || minimumMissingFields.length > 0} onClick={() => runImport('confirm')} className="rounded-[12px] bg-violet-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Confirmar e criar evento com contrato externo</button>
        </div>
      }
    >
      <label className="block cursor-pointer rounded-[14px] border-2 border-dashed border-violet-200 bg-violet-50/40 p-6 text-center transition hover:border-violet-400 hover:bg-violet-50">
        <input className="hidden" type="file" accept="application/pdf,.pdf" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
        <UploadCloud className="mx-auto mb-3 h-8 w-8 text-violet-500" />
        <p className="text-sm font-semibold text-slate-800">Clique para selecionar o contrato em PDF</p>
        <p className="mt-1 text-sm text-slate-500">ou arraste o arquivo aqui</p>
        <p className="mt-1 text-xs text-slate-400">PDF até 15MB</p>
        <span className="mt-3 inline-flex rounded-[10px] bg-violet-600 px-3 py-2 text-xs font-bold text-white">Selecionar PDF</span>
      </label>
      {importFile ? <p className="mt-2 text-sm text-slate-700">Arquivo selecionado: {importFile.name}</p> : null}
      {importFile ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" className="w-full rounded-[14px] border border-slate-300 bg-white/90 px-4 py-3 text-sm font-bold text-slate-900 shadow-sm transition hover:border-violet-400 hover:bg-violet-50 sm:w-auto" onClick={() => setIsPreviewOpen(true)}>Visualizar contrato</button>
          <button type="button" disabled={loading} className="w-full rounded-[14px] border border-violet-300 bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-50 sm:w-auto" onClick={() => runImport('extract')}>Extrair dados automaticamente</button>
          <button type="button" disabled={loading} className="w-full rounded-[14px] border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50 sm:w-auto" onClick={() => {
            setMode('confirm');
            setMissingFields([]);
            setExtractionStatus('manual');
            setExtractionConfidence(null);
            setExtractedData({});
            setError('');
          }}>Preencher manualmente</button>
        </div>
      ) : null}
      {extractionConfidence !== null ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${extractionStatus === 'auto' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{extractedSummaryMessage}</span>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Revise antes de criar o evento</span>
          {missingFields?.length ? <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Campos para revisar</span> : null}
        </div>
      ) : null}
      {missingFields?.length ? <p className="mt-2 text-sm text-amber-700">Campos para revisar: {missingFields.map((field) => (field === 'text_unreadable' ? 'Texto do PDF não pôde ser lido automaticamente' : field)).join(', ')}</p> : null}
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
                    <Input
                      value={key === 'event_date' ? toDisplayDateBr(reviewedData[key]) : (reviewedData[key] || '')}
                      onChange={(e) => setExtractedData((prev) => ({ ...prev, [key]: key === 'event_date' ? toIsoDate(e.target.value) : e.target.value }))}
                    />
                  )}
                </Field>
              ))}
            </div>
          </section>
        ))}
      </div>

      {resultData ? (
        <div className="mt-4 rounded-[14px] border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-bold text-emerald-800">Evento criado com sucesso.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {links.event ? <a className="font-semibold text-emerald-900 underline" href={links.event}>Ver evento</a> : null}
            {links.pdf ? <a className="font-semibold text-emerald-900 underline" href={links.pdf} target="_blank" rel="noreferrer">Ver PDF do contrato</a> : null}
            {absolutePanelLink ? <button type="button" className="font-semibold text-emerald-900 underline" onClick={() => navigator.clipboard?.writeText(absolutePanelLink)}>Copiar link do painel do cliente</button> : null}
            {absolutePanelLink ? <a className="font-semibold text-emerald-900 underline" href={absolutePanelLink} target="_blank" rel="noreferrer">Abrir painel do cliente</a> : null}
          </div>
        </div>
      ) : null}

      {loading ? <p className="mt-3 text-sm text-slate-500">Processando...</p> : null}

      {isPreviewOpen && previewUrl ? (
        <div className="fixed inset-0 z-[220] flex h-[100dvh] flex-col overflow-hidden bg-slate-950/95 text-white" role="dialog" aria-modal="true">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-3 pt-[max(12px,env(safe-area-inset-top))]">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">Preview do contrato</p>
              <p className="truncate text-xs text-white/60">{importFile?.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white">
                <ExternalLink className="h-4 w-4" /> Abrir PDF
              </a>
              <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950" onClick={() => setIsPreviewOpen(false)} aria-label="Fechar preview">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden bg-slate-900 p-0 sm:p-4">
            <div className="mx-auto h-full w-full max-w-5xl overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:rounded-[22px] sm:border sm:border-white/15">
              <object title="Preview do contrato em PDF" data={previewUrl} type="application/pdf" className="h-full w-full">
                <iframe title="Preview do contrato em PDF" src={previewUrl} className="h-full w-full border-0" />
                <div className="p-6 text-center text-slate-900">
                  <p className="font-bold">Não foi possível exibir o PDF neste navegador.</p>
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-[12px] bg-violet-600 px-4 py-2 text-sm font-bold text-white">Abrir PDF</a>
                </div>
              </object>
            </div>
          </div>
        </div>
      ) : null}
    </AppModal>
  );
}
