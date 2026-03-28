'use client';

export function getEscalasSummary(escalas) {
  const total = escalas.length;
  const confirmados = escalas.filter((e) => e.status === 'confirmed').length;
  const pendentes = escalas.filter((e) => e.status === 'pending').length;
  const declinados = escalas.filter((e) => e.status === 'declined').length;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const eventosComDataFutura = new Set(
    escalas
      .filter((e) => {
        const dateStr = e.events?.event_date;
        if (!dateStr) return false;
        const data = new Date(dateStr);
        return data >= hoje;
      })
      .map((e) => e.event_id)
  );

  const proximosEventos = eventosComDataFutura.size;

  return {
    total,
    confirmados,
    pendentes,
    declinados,
    proximosEventos,
  };
}
