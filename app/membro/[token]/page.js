import React from 'react';

export default async function Page({ params }) {
  const token = String(params?.token || '').trim();

  if (!token) {
    return (
      <main style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Token inválido</h1>
        <p>O link do convite está inválido ou incompleto.</p>
      </main>
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return (
      <main style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Erro de configuração</h1>
        <p>Variáveis de ambiente do Supabase não estão configuradas.</p>
      </main>
    );
  }

  try {
    const url = new URL('/rest/v1/escalas', supabaseUrl);
    url.searchParams.set('select', '*,events(client_name,event_date,event_time,location)');
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
        <main style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Convite não encontrado</h1>
          <p>O convite que você tentou acessar não foi localizado.</p>
        </main>
      );
    }

    const musicianName = escala.musician_name || 'Músico não identificado';
    const eventName = escala.events?.client_name || 'Evento não informado';
    const eventDate = escala.events?.event_date || '-';
    const eventTime = escala.events?.event_time || '-';
    const location = escala.events?.location || '-';
    const role = escala.role || '-';
    const notes = escala.notes || '-';
    const status = escala.status || '-';

    return (
      <main style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, boxShadow: '0 6px 20px rgba(2,6,23,0.06)' }}>
            <header style={{ marginBottom: 18 }}>
              <h1 style={{ fontSize: 22, margin: 0 }}>{musicianName}</h1>
              <p style={{ margin: '6px 0 0', color: '#475569' }}>Convite para o evento</p>
            </header>

            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Evento</div>
                <div style={{ fontWeight: 700 }}>{eventName}</div>
              </div>

              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Função</div>
                <div style={{ fontWeight: 700 }}>{role}</div>
              </div>

              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Data</div>
                <div style={{ fontWeight: 700 }}>{eventDate}</div>
              </div>

              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Horário</div>
                <div style={{ fontWeight: 700 }}>{eventTime}</div>
              </div>

              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>Local</div>
                <div style={{ fontWeight: 700 }}>{location}</div>
              </div>
            </section>

            <section style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>Observações</div>
              <div style={{ marginTop: 6, padding: 12, background: '#f1f5f9', borderRadius: 8 }}>{notes}</div>
            </section>

            <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Status</div>
                <div style={{ fontWeight: 800, marginTop: 6 }}>{status}</div>
              </div>

              <div style={{ textAlign: 'right', fontSize: 12, color: '#94a3b8' }}>
                <div>Convite público</div>
                <div style={{ marginTop: 6 }}>Sem autenticação necessária</div>
              </div>
            </footer>
          </div>
        </div>
      </main>
    );
  } catch (err) {
    console.error(err);
    return (
      <main style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Erro</h1>
        <p>Ocorreu um erro ao carregar o convite. Tente novamente mais tarde.</p>
      </main>
    );
  }
}