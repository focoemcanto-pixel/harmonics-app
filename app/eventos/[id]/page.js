'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import AppShell from '../../../components/layout/AppShell';
import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import EventoEscalaTab from '../../../components/eventos/EventoEscalaTab';

function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;

  const cleaned = String(value)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatPhoneDisplay(value) {
  const cleaned = cleanPhone(value);
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return value || '-';
}

function formatDateBR(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function formatDateTimeBR(dateValue, timeValue) {
  const date = formatDateBR(dateValue);
  const time = timeValue ? String(timeValue).slice(0, 5) : '--:--';
  return `${date} às ${time}`;
}

function isPastEvent(eventDate) {
  if (!eventDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const event = new Date(`${eventDate}T00:00:00`);
  event.setHours(0, 0, 0, 0);

  return event.getTime() < today.getTime();
}

function isTodayEvent(eventDate) {
  if (!eventDate) return false;

  const today = new Date();
  const event = new Date(`${eventDate}T00:00:00`);

  return (
    today.getFullYear() === event.getFullYear() &&
    today.getMonth() === event.getMonth() &&
    today.getDate() === event.getDate()
  );
}

function getTimelineLabel(eventDate) {
  if (!eventDate) return { text: 'Sem data', tone: 'default' };
  if (isTodayEvent(eventDate)) return { text: 'Hoje', tone: 'blue' };
  if (isPastEvent(eventDate)) return { text: 'Realizado', tone: 'default' };
  return { text: 'Próximo', tone: 'emerald' };
}

function getPaymentTone(paymentStatus) {
  if (paymentStatus === 'Pago') return 'emerald';
  if (paymentStatus === 'Parcial') return 'amber';
  if (paymentStatus === 'Pendente') return 'red';
  return 'default';
}

function formatOperationalStatus(status) {
  const value = String(status || '').trim().toLowerCase();

  if (!value) return 'Rascunho';
  if (value === 'draft') return 'Rascunho';
  if (value === 'confirmed') return 'Confirmado';
  if (value === 'cancelled') return 'Cancelado';
  if (value === 'rascunho') return 'Rascunho';
  if (value === 'confirmado') return 'Confirmado';
  if (value === 'cancelado') return 'Cancelado';

  return status;
}

function getOperationalTone(status) {
  const value = String(status || '').trim().toLowerCase();

  if (value === 'confirmed' || value === 'confirmado') return 'emerald';
  if (value === 'cancelled' || value === 'cancelado') return 'red';
  if (value === 'draft' || value === 'rascunho') return 'default';

  return 'default';
}

function InfoItem({ label, value, full = false }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        {value || '-'}
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone = 'default' }) {
  const toneClasses = {
    default: 'border-slate-200 bg-white text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className={`rounded-3xl border p-4 md:p-5 ${toneClasses[tone] || toneClasses.default}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function EventoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [evento, setEvento] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    async function carregarEvento() {
      if (!id) return;

      try {
        setCarregando(true);

        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        setEvento(data || null);
      } catch (error) {
        console.error('Erro ao carregar detalhe do evento:', error);
        alert('Não foi possível carregar este evento.');
      } finally {
        setCarregando(false);
      }
    }

    carregarEvento();
  }, [id]);

  async function excluirEvento() {
    if (!evento?.id) return;
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;

    try {
      setExcluindo(true);

      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', evento.id);

      if (error) throw error;

      alert('Evento excluído com sucesso.');
      router.push('/eventos');
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      alert('Erro ao excluir evento.');
    } finally {
      setExcluindo(false);
    }
  }

  const resumoFinanceiro = useMemo(() => {
    if (!evento) return null;

    const agreed = toNumber(evento.agreed_amount);
    const paid = toNumber(evento.paid_amount);
    const open = toNumber(evento.open_amount);
    const profit = toNumber(evento.profit_amount);

    return {
      agreed,
      paid,
      open,
      profit,
    };
  }, [evento]);

  if (carregando) {
    return (
      <AppShell title="Detalhe do evento">
        <Card>
          <p className="text-center text-slate-500">Carregando evento...</p>
        </Card>
      </AppShell>
    );
  }

  if (!evento) {
    return (
      <AppShell title="Detalhe do evento">
        <Card>
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <p className="text-lg font-semibold text-slate-900">
              Evento não encontrado
            </p>
            <p className="text-sm text-slate-500">
              Esse registro pode ter sido removido ou o ID informado não existe.
            </p>
            <Link href="/eventos">
              <Button variant="secondary">Voltar para eventos</Button>
            </Link>
          </div>
        </Card>
      </AppShell>
    );
  }

  const timeline = getTimelineLabel(evento.event_date);
  const paymentStatus = evento.payment_status || 'Pendente';

  return (
    <AppShell title="Detalhe do evento">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={timeline.tone}>{timeline.text}</Badge>
                  <Badge tone={getPaymentTone(paymentStatus)}>{paymentStatus}</Badge>
                  <Badge tone={getOperationalTone(evento.status)}>
                    {formatOperationalStatus(evento.status)}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold tracking-wide text-violet-600">
                    Harmonics SaaS
                  </p>

                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                    {evento.client_name || 'Sem contratante'}
                  </h1>

                  <div className="flex flex-col gap-1 text-sm text-slate-500 md:text-base">
                    <p>{evento.event_type || 'Tipo não informado'}</p>
                    <p>{formatDateTimeBR(evento.event_date, evento.event_time)}</p>
                    {evento.location_name ? <p>{evento.location_name}</p> : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:max-w-[340px] lg:justify-end">
                <Link href="/eventos">
                  <Button variant="secondary">Voltar</Button>
                </Link>

                <Link href={`/eventos?edit=${evento.id}`}>
                  <Button>Editar evento</Button>
                </Link>

                <Button
                  variant="danger"
                  onClick={excluirEvento}
                  disabled={excluindo}
                >
                  {excluindo ? 'Excluindo...' : 'Excluir'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Formação
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {evento.formation || '-'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Receptivo
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {evento.reception_hours ? `${evento.reception_hours}h` : 'Não'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Som
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {evento.has_sound ? 'Sim' : 'Não'}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Código interno
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                  {evento.id || '-'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Valor acertado"
            value={formatMoney(resumoFinanceiro?.agreed)}
            tone="blue"
          />
          <MetricCard
            label="Valor quitado"
            value={formatMoney(resumoFinanceiro?.paid)}
            tone="emerald"
          />
          <MetricCard
            label="Saldo em aberto"
            value={formatMoney(resumoFinanceiro?.open)}
            tone={resumoFinanceiro?.open > 0 ? 'amber' : 'default'}
          />
          <MetricCard
            label="Lucro estimado"
            value={formatMoney(resumoFinanceiro?.profit)}
            tone={resumoFinanceiro?.profit > 0 ? 'default' : 'red'}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card title="Detalhes do evento">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InfoItem label="Contratante / Cliente" value={evento.client_name} />
                <InfoItem label="Tipo do evento" value={evento.event_type} />
                <InfoItem label="Data" value={formatDateBR(evento.event_date)} />
                <InfoItem
                  label="Hora"
                  value={evento.event_time ? String(evento.event_time).slice(0, 5) : '-'}
                />
                <InfoItem
                  label="Duração"
                  value={evento.duration_min ? `${evento.duration_min} min` : '-'}
                />
                <InfoItem label="Local" value={evento.location_name} />
                <InfoItem label="Formação" value={evento.formation} />
                <InfoItem label="Instrumentos" value={evento.instruments} />
                <InfoItem label="Contato WhatsApp" value={evento.whatsapp_name} />
                <InfoItem
                  label="Número WhatsApp"
                  value={formatPhoneDisplay(evento.whatsapp_phone)}
                />
                <InfoItem label="Emails convidados" value={evento.guests_emails} full />
                <InfoItem label="Observações" value={evento.observations} full />
              </div>
            </Card>

            <Card title="Financeiro detalhado">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InfoItem
                  label="Preço da formação"
                  value={formatMoney(evento.formation_price)}
                />
                <InfoItem
                  label="Preço do som"
                  value={formatMoney(evento.sound_price)}
                />
                <InfoItem
                  label="Preço do receptivo"
                  value={formatMoney(evento.reception_price)}
                />
                <InfoItem
                  label="Deslocamento"
                  value={formatMoney(evento.transport_price)}
                />
                <InfoItem
                  label="Custo músicos"
                  value={formatMoney(evento.musician_cost)}
                />
                <InfoItem
                  label="Custo som"
                  value={formatMoney(evento.sound_cost)}
                />
                <InfoItem
                  label="Custo extra transporte"
                  value={formatMoney(evento.extra_transport_cost)}
                />
                <InfoItem label="Status de pagamento" value={paymentStatus} />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Operação">
              <div className="grid grid-cols-1 gap-4">
                <InfoItem label="Tem som?" value={evento.has_sound ? 'Sim' : 'Não'} />
                <InfoItem
                  label="Receptivo"
                  value={evento.reception_hours ? `${evento.reception_hours}h` : '0h'}
                />
                <InfoItem
                  label="Status operacional"
                  value={formatOperationalStatus(evento.status)}
                />
              </div>
            </Card>

            <Card title="Convites">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5">
                <p className="text-sm font-medium text-slate-900">
                  Módulo em preparação
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Aqui vamos plugar os convidados e respostas desse evento.
                </p>
              </div>
            </Card>

            <Card title="Escala">
              <EventoEscalaTab eventId={evento.id} />
            </Card>

            <Card title="Contrato e pagamentos">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5">
                <p className="text-sm font-medium text-slate-900">
                  Próxima integração
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Esse bloco vai receber contrato, parcelas, comprovantes e histórico financeiro.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
