import React from 'react';

function formatDateBR(value) {
  if (!value) return 'Data não informada';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Data não informada';

  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTimeBR(value) {
  if (!value) return 'Horário não informado';

  const s = String(value).trim();

  if (/^\d{2}:\d{2}/.test(s)) {
    return s.slice(0, 5);
  }

  const d = new Date(`1970-01-01T${s}`);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return s;
}

function getStatusMeta(status) {
  const key = String(status || '').trim().toLowerCase();

  const map = {
    pending: {
      label: 'Aguardando resposta',
      classes: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    confirmed: {
      label: 'Confirmado',
      classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    declined: {
      label: 'Recusado',
      classes: 'border-red-200 bg-red-50 text-red-700',
    },
    backup: {
      label: 'Reserva',
      classes: 'border-blue-200 bg-blue-50 text-blue-700',
    },
  };

  return (
    map[key] || {
      label: 'Status não informado',
      classes: 'border-slate-200 bg-slate-50 text-slate-700',
    }
  );
}

function InfoCard({ label, value, full = false }) {
  return (
    <div
      className={`rounded-[22px] border border-slate-200 bg-slate-50/80 p-5 ${
        full ? 'md:col-span-2' : ''
      }`}
    >
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-[16px] font-bold leading-6 text-slate-900">
        {value}
      </div>
    </div>
  );
}

function ErrorState({ title, message }) {
  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-10 text-[#0f172a]">
      <div className="mx-auto max-w-xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="mb-3 text-[12px] font-black uppercase tracking-[0.18em] text-violet-600">
          Harmonics
        </div>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-slate-600">{message}</p>
      </div>
    </main>
  );
}

export default async function Page({ params }) {
  const token = String(params?.token || '').trim();

  if (!token) {
    return (
      <ErrorState
        title="Token inválido"
        message="O link do convite está inválido ou incompleto."
      />
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return (
      <ErrorState
        title="Erro de configuração"
        message="As variáveis de ambiente do Supabase não estão configuradas."
      />
    );
  }

  try {
    const url = new URL('/rest/v1/escalas', supabaseUrl);
    url.searchParams.set(
      'select',
      '*,events(client_name,event_date,event_time,location)'
    );
    url.searchParams.set('invite_token', `eq.${token}`);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error('Falha na busca do convite');
    }

    const data = await res.json();
    const escala = Array.isArray(data) && data.length > 0 ? data[0] : null;

    if (!escala) {
      return (
        <ErrorState
          title="Convite não encontrado"
          message="O convite que você tentou acessar não foi localizado."
        />
      );
    }

    const musicianName = escala.musician_name || 'Músico não identificado';
    const eventName = escala.events?.client_name || 'Evento não informado';
    const eventDate = formatDateBR(escala.events?.event_date);
    const eventTime = formatTimeBR(escala.events?.event_time);
    const location = escala.events?.location || 'Local não informado';
    const role = escala.role || 'Função não informada';
    const notes = escala.notes || 'Nenhuma observação registrada até o momento.';
    const statusMeta = getStatusMeta(escala.status);

    return (
      <main className="min-h-screen bg-[#f6f7fb] px-5 py-8 text-[#0f172a]">
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 text-center">
            <div className="text-[12px] font-black uppercase tracking-[0.18em] text-violet-600">
              Harmonics
            </div>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
              Seu convite
            </h1>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">
              Confira abaixo os dados da sua escala.
            </p>
          </div>

          <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[12px] font-black uppercase tracking-[0.18em] text-violet-600">
                  Convite de escala
                </div>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                  {eventName}
                </h2>
              </div>

              <span
                className={`inline-flex rounded-full border px-4 py-2 text-[12px] font-black ${statusMeta.classes}`}
              >
                {statusMeta.label}
              </span>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-5">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Membro
                </div>
                <div className="mt-2 text-[22px] font-black text-slate-900">
                  {musicianName}
                </div>
                <div className="mt-2 text-[14px] text-slate-600">
                  Convite individual para sua participação neste evento.
                </div>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-5">
                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                  Função
                </div>
                <div className="mt-2 text-[22px] font-black text-slate-900">
                  {role}
                </div>
                <div className="mt-2 text-[14px] text-slate-600">
                  Sua atuação prevista para esta escala.
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Detalhes do evento
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <InfoCard label="Data" value={eventDate} />
                <InfoCard label="Horário" value={eventTime} />
                <InfoCard label="Local" value={location} full />
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-violet-100 bg-violet-50/70 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
                Observações
              </div>
              <p className="mt-3 text-[15px] leading-7 text-slate-700">
                {notes}
              </p>
            </div>

            <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                Próximo passo
              </div>
              <p className="mt-3 text-[15px] leading-7 text-slate-700">
                Em breve você poderá confirmar ou recusar este convite por aqui.
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  } catch (err) {
    console.error(err);

    return (
      <ErrorState
        title="Erro ao carregar convite"
        message="Ocorreu um erro ao carregar os dados. Tente novamente mais tarde."
      />
    );
  }
}
