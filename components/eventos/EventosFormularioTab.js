'use client';

import { Field, Input, Select } from '../admin/AdminFormPrimitives';
import Pill from '../admin/AdminPill';

function SectionCard({ eyebrow, title, subtitle, children }) {
  return (
    <section className="rounded-[24px] border border-[#e6edf7] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:p-6">
      <div className="mb-5">
        {eyebrow ? (
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
            {eyebrow}
          </div>
        ) : null}

        <h3 className="mt-1 text-[20px] font-black text-[#0f172a]">{title}</h3>

        {subtitle ? (
          <p className="mt-1 text-[14px] font-medium text-[#64748b]">
            {subtitle}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function InfoChip({ label, value, tone = 'default' }) {
  return (
    <div className="rounded-[18px] border border-[#edf2f7] bg-[#f8fafc] px-4 py-3">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {tone !== 'default' ? <Pill tone={tone}>{value}</Pill> : null}
        {tone === 'default' ? (
          <div className="text-[15px] font-black text-[#0f172a]">{value}</div>
        ) : null}
      </div>
    </div>
  );
}

function MoneyCard({ label, value, tone = 'slate' }) {
  const toneClasses =
    tone === 'violet'
      ? 'bg-violet-50 text-violet-700 border-violet-100'
      : tone === 'amber'
      ? 'bg-amber-50 text-amber-800 border-amber-100'
      : tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : 'bg-[#f8fafc] text-[#0f172a] border-[#edf2f7]';

  return (
    <div className={`rounded-[20px] border px-4 py-4 ${toneClasses}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] opacity-80">
        {label}
      </div>
      <div className="mt-2 text-[20px] font-black">{value}</div>
    </div>
  );
}

export default function EventosFormularioTab({
  editandoId,
  contatos,
  form,
  handleFormChange,
  aplicarAutomaticosDaFormacao,
  financial,
  salvarEvento,
  cancelarEdicao,
  salvando,
  EVENT_TYPES,
  FORMATIONS,
  formatPhoneDisplay,
  getPaymentTone,
}) {
  const tituloPrincipal = editandoId ? 'Editar evento' : 'Novo evento';
  const subtituloPrincipal = editandoId
    ? 'Ajuste dados, operação e financeiro sem perder o contexto do evento.'
    : 'Monte um novo evento com cliente, operação e financeiro em um fluxo mais claro.';

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.9fr_1fr]">
      <div className="space-y-5">
        <section className="rounded-[28px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
                Gestão de evento
              </div>
              <h2 className="mt-1 text-[28px] font-black leading-tight text-[#0f172a]">
                {tituloPrincipal}
              </h2>
              <p className="mt-2 max-w-[720px] text-[15px] font-medium text-[#64748b]">
                {subtituloPrincipal}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Pill tone="blue">
                {form.event_date ? `Data: ${form.event_date}` : 'Sem data'}
              </Pill>
              <Pill tone={getPaymentTone(financial.paymentStatus)}>
                {financial.paymentStatus}
              </Pill>
              <Pill tone="default">{form.status || 'Rascunho'}</Pill>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            <InfoChip
              label="Cliente"
              value={form.client_name || 'Não informado'}
            />
            <InfoChip
              label="Tipo / Formação"
              value={`${form.event_type || 'Evento'} • ${form.formation || '-'}`}
            />
            <InfoChip
              label="Local"
              value={form.location_name || 'Não informado'}
            />
          </div>
        </section>

        <SectionCard
          eyebrow="Cliente"
          title="Contratante e contato principal"
          subtitle="Selecione um contato existente ou preencha manualmente os dados do cliente."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Contratante / Cliente">
              <Select
                value={form.client_contact_id || ''}
                onChange={(e) => {
                  const selected = contatos.find(
                    (c) => String(c.id) === String(e.target.value)
                  );

                  handleFormChange('client_contact_id', e.target.value);
                  handleFormChange('client_name', selected?.name || '');
                  handleFormChange('whatsapp_name', selected?.name || '');
                  handleFormChange('whatsapp_phone', selected?.phone || '');
                  handleFormChange('guests_emails', selected?.email || '');
                }}
              >
                <option value="">Selecione um contato</option>
                {contatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `• ${formatPhoneDisplay(c.phone)}` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Nome do cliente">
              <Input
                value={form.client_name}
                onChange={(e) => handleFormChange('client_name', e.target.value)}
              />
            </Field>

            <Field label="Nome no WhatsApp">
              <Input
                value={form.whatsapp_name}
                onChange={(e) => handleFormChange('whatsapp_name', e.target.value)}
              />
            </Field>

            <Field label="WhatsApp">
              <Input
                value={form.whatsapp_phone}
                onChange={(e) => handleFormChange('whatsapp_phone', e.target.value)}
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Emails convidados">
                <Input
                  value={form.guests_emails}
                  onChange={(e) => handleFormChange('guests_emails', e.target.value)}
                  placeholder="emails separados por vírgula"
                />
              </Field>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Evento"
          title="Detalhes principais"
          subtitle="Defina data, hora, local e estrutura base do evento."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Tipo de evento">
              <Select
                value={form.event_type}
                onChange={(e) => handleFormChange('event_type', e.target.value)}
              >
                <option value="">Selecione</option>
                {EVENT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Data">
              <Input
                type="date"
                value={form.event_date}
                onChange={(e) => handleFormChange('event_date', e.target.value)}
              />
            </Field>

            <Field label="Hora">
              <Input
                type="time"
                step="60"
                value={form.event_time}
                onChange={(e) => handleFormChange('event_time', e.target.value)}
              />
            </Field>

            <Field label="Duração (min)">
              <Input
                value={form.duration_min}
                onChange={(e) => handleFormChange('duration_min', e.target.value)}
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Local">
                <Input
                  value={form.location_name}
                  onChange={(e) =>
                    handleFormChange('location_name', e.target.value)
                  }
                />
              </Field>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Operação"
          title="Formação, som e execução"
          subtitle="Monte a operação do evento e alimente automaticamente os valores."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Formação">
              <Select
                value={form.formation}
                onChange={(e) =>
                  aplicarAutomaticosDaFormacao(
                    e.target.value,
                    form.reception_hours,
                    form.has_sound
                  )
                }
              >
                <option value="">Selecione</option>
                {FORMATIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Instrumentos">
              <Input
                value={form.instruments}
                onChange={(e) => handleFormChange('instruments', e.target.value)}
              />
            </Field>

            <Field label="Receptivo (h)">
              <Input
                value={form.reception_hours}
                onChange={(e) =>
                  aplicarAutomaticosDaFormacao(
                    form.formation,
                    e.target.value,
                    form.has_sound
                  )
                }
              />
            </Field>

            <Field label="Pago até agora">
              <Input
                value={form.paid_amount}
                onChange={(e) => handleFormChange('paid_amount', e.target.value)}
              />
            </Field>

            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => handleFormChange('status', e.target.value)}
              >
                {['Rascunho', 'Confirmado', 'Executado'].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </Field>

            <label className="flex items-center justify-between rounded-[18px] border border-[#dbe3ef] bg-[#f8fafc] px-4 py-4">
              <span className="text-[15px] font-bold text-[#0f172a]">
                Tem som
              </span>
              <input
                type="checkbox"
                checked={!!form.has_sound}
                onChange={(e) =>
                  aplicarAutomaticosDaFormacao(
                    form.formation,
                    form.reception_hours,
                    e.target.checked
                  )
                }
                className="h-5 w-5"
              />
            </label>

            <div className="md:col-span-2">
              <Field label="Observações">
                <textarea
                  value={form.observations}
                  onChange={(e) =>
                    handleFormChange('observations', e.target.value)
                  }
                  rows={5}
                  className="w-full rounded-[18px] border border-[#dbe3ef] bg-white px-4 py-4 text-[15px] font-semibold text-[#0f172a] outline-none"
                />
              </Field>
            </div>
          </div>
        </SectionCard>

        <section className="rounded-[24px] border border-[#dbe3ef] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
                Ações
              </div>
              <h3 className="mt-1 text-[20px] font-black text-[#0f172a]">
                Finalizar cadastro
              </h3>
              <p className="mt-1 text-[14px] font-medium text-[#64748b]">
                Salve o evento e mantenha a operação atualizada.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={salvarEvento}
                disabled={salvando}
                className="rounded-[18px] bg-violet-600 px-5 py-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)] disabled:opacity-60"
              >
                {salvando
                  ? 'Salvando...'
                  : editandoId
                  ? 'Atualizar evento'
                  : 'Criar evento'}
              </button>

              {editandoId ? (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="rounded-[18px] border border-[#dbe3ef] bg-white px-5 py-4 text-[14px] font-black text-[#0f172a]"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-5">
        <SectionCard
          eyebrow="Financeiro"
          title="Resumo automático"
          subtitle="Os números abaixo acompanham a configuração do evento em tempo real."
        >
          <div className="grid grid-cols-1 gap-3">
            <MoneyCard
              label="Formação"
              value={financial.formationPriceFormatted}
            />
            <MoneyCard label="Som" value={financial.soundPriceFormatted} />
            <MoneyCard
              label="Receptivo"
              value={financial.receptionPriceFormatted}
            />
            <MoneyCard
              label="Valor acertado"
              value={financial.agreedAmountFormatted}
              tone="violet"
            />
            <MoneyCard
              label="Em aberto"
              value={financial.openAmountFormatted}
              tone="amber"
            />
            <MoneyCard
              label="Lucro final"
              value={financial.profitAmountFormatted}
              tone="emerald"
            />

            <div className="rounded-[20px] border border-[#e6edf7] bg-white px-4 py-4">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#64748b]">
                Status do pagamento
              </div>
              <div className="mt-3">
                <Pill tone={getPaymentTone(financial.paymentStatus)}>
                  {financial.paymentStatus}
                </Pill>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Custos"
          title="Margem do evento"
          subtitle="Informe seus custos para acompanhar a rentabilidade real."
        >
          <div className="space-y-4">
            <Field label="Custo músicos">
              <Input
                value={form.musician_cost}
                onChange={(e) => handleFormChange('musician_cost', e.target.value)}
              />
            </Field>

            <Field label="Custo som">
              <Input
                value={form.sound_cost}
                onChange={(e) => handleFormChange('sound_cost', e.target.value)}
              />
            </Field>

            <Field label="Transporte extra">
              <Input
                value={form.extra_transport_cost}
                onChange={(e) =>
                  handleFormChange('extra_transport_cost', e.target.value)
                }
              />
            </Field>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}