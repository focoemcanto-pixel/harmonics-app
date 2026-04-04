'use client';

import { useState } from 'react';

export default function MemberAdminView({ invites, escalas, repertorios, onRefresh }) {
  const [activeTab, setActiveTab] = useState('convites');

  const tabs = [
    { key: 'convites', label: 'Todos os Convites', count: invites.length },
    { key: 'escalas', label: 'Todas as Escalas', count: escalas.length },
    { key: 'repertorios', label: 'Todos os Repertórios', count: repertorios.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header Administrativo */}
      <div className="rounded-[28px] border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full border border-violet-300 bg-violet-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-violet-700">
              Visão Administrativa
            </div>
            <h1 className="mt-3 text-[32px] font-black tracking-[-0.04em] text-slate-900">
              Painel de Membros
            </h1>
            <p className="mt-2 text-[15px] text-slate-600 max-w-2xl">
              Visão completa de todos os convites, escalas e repertórios do universo dos membros.
            </p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="rounded-[16px] bg-white border border-violet-200 px-4 py-3 text-[13px] font-black text-slate-900 hover:bg-violet-50 transition"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 rounded-[18px] px-4 py-3 text-[14px] font-black transition ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-lg'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
                <span className="ml-2 text-[12px] opacity-75">
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 min-h-[400px]">
        {activeTab === 'convites' && (
          <div className="space-y-4">
            <h2 className="text-[20px] font-black text-slate-900">
              Todos os Convites ({invites.length})
            </h2>

            {invites.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Nenhum convite encontrado no sistema.
              </div>
            ) : (
              <div className="space-y-3">
                {invites.map((invite) => {
                  const contactName = invite.contacts?.name || 'Nome não informado';
                  const contactEmail = invite.contacts?.email || '-';
                  const eventName = invite.events?.client_name || 'Evento não identificado';
                  const eventDate = invite.events?.event_date
                    ? new Date(invite.events.event_date).toLocaleDateString('pt-BR')
                    : '-';

                  return (
                    <div
                      key={invite.id}
                      className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 hover:bg-white hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-[16px] font-black text-slate-900">
                              {contactName}
                            </h3>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${
                                invite.status === 'accepted'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : invite.status === 'pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {invite.status === 'accepted'
                                ? 'Aceito'
                                : invite.status === 'pending'
                                ? 'Pendente'
                                : invite.status || 'Desconhecido'}
                            </span>
                          </div>

                          <p className="mt-2 text-[14px] text-slate-600">
                            Email: {contactEmail}
                          </p>

                          <p className="mt-1 text-[13px] text-slate-500">
                            Evento: {eventName}
                          </p>

                          <p className="mt-1 text-[12px] text-slate-400">
                            Data do evento: {eventDate}
                          </p>

                          {invite.created_at && (
                            <p className="mt-1 text-[12px] text-slate-400">
                              Criado em: {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {invite.token && (
                            <code className="text-[11px] bg-slate-100 px-2 py-1 rounded font-mono text-slate-600">
                              {invite.token.slice(0, 8)}...
                            </code>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'escalas' && (
          <div className="space-y-4">
            <h2 className="text-[20px] font-black text-slate-900">
              Todas as Escalas ({escalas.length})
            </h2>

            {escalas.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Nenhuma escala encontrada no sistema.
              </div>
            ) : (
              <div className="space-y-3">
                {escalas.map((escala) => {
                  const contactName = escala.contacts?.name || 'Músico não identificado';
                  const eventName = escala.events?.client_name || 'Evento não identificado';
                  const eventDate = escala.events?.event_date
                    ? new Date(escala.events.event_date).toLocaleDateString('pt-BR')
                    : '-';
                  const eventTime = escala.events?.event_time?.slice(0, 5) || '-';

                  return (
                    <div
                      key={escala.id}
                      className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 hover:bg-white hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[16px] font-black text-slate-900">
                            {contactName}
                          </h3>

                          <p className="mt-2 text-[14px] text-slate-600">
                            Evento: {eventName}
                          </p>

                          <p className="mt-1 text-[13px] text-slate-500">
                            Instrumento: {escala.instrument || '-'}
                          </p>

                          <p className="mt-1 text-[13px] text-slate-500">
                            Data: {eventDate} às {eventTime}
                          </p>

                          {escala.events?.location_name && (
                            <p className="mt-1 text-[13px] text-slate-500">
                              Local: {escala.events.location_name}
                            </p>
                          )}

                          <p className="mt-2 text-[12px] text-slate-400">
                            Formação: {escala.events?.formation || '-'}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${
                            escala.status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : escala.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {escala.status === 'confirmed'
                            ? 'Confirmada'
                            : escala.status === 'pending'
                            ? 'Pendente'
                            : escala.status || 'Indefinido'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'repertorios' && (
          <div className="space-y-4">
            <h2 className="text-[20px] font-black text-slate-900">
              Todos os Repertórios ({repertorios.length})
            </h2>

            {repertorios.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Nenhum repertório encontrado no sistema.
              </div>
            ) : (
              <div className="space-y-3">
                {repertorios.map((repertorio) => (
                  <div
                    key={repertorio.id}
                    className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 hover:bg-white hover:shadow-md transition"
                  >
                    <h3 className="text-[16px] font-black text-slate-900">
                      {repertorio.name || 'Repertório sem nome'}
                    </h3>

                    {repertorio.description && (
                      <p className="mt-2 text-[14px] text-slate-600">
                        {repertorio.description}
                      </p>
                    )}

                    <p className="mt-2 text-[12px] text-slate-400">
                      Criado em: {new Date(repertorio.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
