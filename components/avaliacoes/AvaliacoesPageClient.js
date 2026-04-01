'use client';

import { useEffect, useMemo, useState } from 'react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function formatDateBR(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

function SummaryCard({ label, value, helper, tone = 'default' }) {
  const tones = {
    default: 'border-[#dbe3ef] bg-white text-[#0f172a]',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  };

  return (
    <div className={`rounded-[24px] border p-4 ${tones[tone] || tones.default}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.1em] opacity-75">
        {label}
      </div>
      <div className="mt-2 text-[30px] font-black tracking-[-0.04em]">{value}</div>
      {helper ? <div className="mt-1 text-[13px] font-semibold opacity-80">{helper}</div> : null}
    </div>
  );
}

function ReviewCard({ item }) {
  return (
    <div className="rounded-[26px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[20px] font-black text-[#0f172a]">
            {item?.event_title || 'Evento'}
          </div>
          <div className="mt-1 text-[14px] font-semibold text-[#64748b]">
            {item?.client_name || 'Cliente'}
          </div>
        </div>

        <div className="rounded-full bg-violet-50 px-3 py-1 text-[12px] font-black text-violet-700">
          {item?.rating || 0}/5
        </div>
      </div>

      {item?.testimonial ? (
        <p className="mt-4 text-[15px] leading-7 text-[#475569]">
          “{item.testimonial}”
        </p>
      ) : (
        <p className="mt-4 text-[15px] leading-7 text-[#94a3b8]">
          Sem comentário escrito.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[#f8fafc] px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#475569]">
          Enviado em {formatDateBR(item?.submitted_at)}
        </span>

        <span
          className={classNames(
            'rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em]',
            item?.would_recommend
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          )}
        >
          {item?.would_recommend ? 'Recomendaria' : 'Não marcou recomendação'}
        </span>
      </div>
    </div>
  );
}

export default function AvaliacoesPageClient() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadReviews() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/admin/reviews', {
        cache: 'no-store',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao carregar avaliações');
      }

      setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Erro ao carregar avaliações');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReviews();
  }, []);

  const average = useMemo(() => {
    if (!reviews.length) return '0.0';
    const total = reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  const recommendCount = reviews.filter((item) => item?.would_recommend).length;
  const withComment = reviews.filter((item) => item?.testimonial).length;

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
        <div className="text-[12px] font-black uppercase tracking-[0.14em] text-violet-600">
          Pós-evento
        </div>
        <h1 className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#0f172a]">
          Avaliações dos clientes
        </h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#64748b]">
          Acompanhe os comentários recebidos após os eventos e use os melhores depoimentos
          como prova social da Harmonics.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Avaliações" value={reviews.length} helper="total recebido" />
          <SummaryCard label="Nota média" value={average} helper="de 5.0" tone="violet" />
          <SummaryCard label="Recomendariam" value={recommendCount} helper="marcaram sim" tone="emerald" />
          <SummaryCard label="Com comentário" value={withComment} helper="texto escrito" tone="amber" />
        </div>
      </section>

      {error ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-5 text-[15px] font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[220px] animate-pulse rounded-[28px] bg-[#eef2f7]"
            />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-[26px] border border-dashed border-[#dbe3ef] bg-[#f8fafc] px-5 py-8 text-center">
          <div className="text-[18px] font-black text-[#0f172a]">
            Nenhuma avaliação recebida ainda
          </div>
          <p className="mx-auto mt-2 max-w-xl text-[15px] leading-7 text-[#64748b]">
            Assim que os clientes responderem o review pós-evento, as avaliações aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {reviews.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
