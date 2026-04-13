'use client';

import { useEffect, useMemo, useState } from 'react';
import AvaliacaoCard from '@/components/avaliacoes/AvaliacaoCard';

function SummaryCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-sm font-medium text-slate-500">{helper}</p> : null}
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
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-7 shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Prova social premium</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
          Painel de depoimentos
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Transforme cada avaliação em ativo de marketing: selecione depoimentos, copie para redes
          sociais e prepare artes com um clique.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total" value={reviews.length} helper="depoimentos recebidos" />
          <SummaryCard label="Nota média" value={average} helper="de 5 estrelas" />
          <SummaryCard label="Recomendariam" value={recommendCount} helper="badge verde" />
          <SummaryCard label="Com comentário" value={withComment} helper="texto em destaque" />
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[330px] animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-9 text-center">
          <p className="text-xl font-extrabold text-slate-900">Ainda não há depoimentos publicados</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-600">
            Assim que os noivos enviarem feedback pós-evento, os cards premium aparecerão aqui.
          </p>
        </div>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
          {reviews.map((item) => (
            <AvaliacaoCard key={item.id} item={item} />
          ))}
        </section>
      )}
    </div>
  );
}
