'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ProtectedRoute from '@/components/ProtectedRoute';
import Link from 'next/link';

const MEMBER_PROFILES_SELECT_FIELDS = 'id, name, email, role';
const ESCALAS_RECENTES_SELECT_FIELDS = `
  id,
  created_at,
  status,
  confirmada,
  confirmed,
  evento:eventos(nome, data),
  membro:profiles(name, email)
`;
const ESCALAS_RECENTES_FALLBACK_SELECT_FIELDS = 'id, created_at, status, confirmada, confirmed';

function UserIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CalendarIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CheckCircleIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function PainelMembrosContent() {
  const [membros, setMembros] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const { data: membrosData, error: membrosError } = await supabase
        .from('profiles')
        .select(MEMBER_PROFILES_SELECT_FIELDS)
        .eq('role', 'member')
        .order('name');

      if (membrosError) {
        throw new Error(`Erro ao buscar membros: ${membrosError.message}`);
      }

      const { data: escalasData, error: escalasError } = await supabase
        .from('escalas')
        .select(ESCALAS_RECENTES_SELECT_FIELDS)
        .order('created_at', { ascending: false })
        .limit(10);

      if (escalasError) {
        console.error('Erro ao buscar escalas com JOIN:', escalasError);
        const { data: escalasSimples } = await supabase
          .from('escalas')
          .select(ESCALAS_RECENTES_FALLBACK_SELECT_FIELDS)
          .order('created_at', { ascending: false })
          .limit(10);

        setEscalas(escalasSimples || []);
      } else {
        setEscalas(escalasData || []);
      }

      setMembros(membrosData || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function isConfirmed(escala) {
    return escala.confirmada === true || escala.confirmed === true || escala.status === 'confirmed';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4" />
          <p className="text-slate-600">Carregando painel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)] max-w-md w-full text-center">
          <p className="text-red-600 font-semibold mb-2">Erro ao carregar dados</p>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="rounded-[18px] bg-violet-600 px-5 py-3 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(124,58,237,0.18)]"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const confirmadasCount = escalas.filter(isConfirmed).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/dashboard"
              className="text-sm text-violet-600 hover:text-violet-700 font-semibold"
            >
              ← Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-900">
            Painel de Membros
          </h1>
          <p className="text-slate-600 mt-2">
            Visão geral das agendas e escalas dos membros
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Resumo */}
          <div className="lg:col-span-3 rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Resumo</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-violet-50 rounded-[18px] p-4">
                <div className="flex items-center gap-3">
                  <UserIcon className="w-8 h-8 text-violet-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600">Total de Membros</p>
                    <p className="text-2xl font-black text-slate-900">{membros.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-[18px] p-4">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="w-8 h-8 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600">Escalas Recentes</p>
                    <p className="text-2xl font-black text-slate-900">{escalas.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-[18px] p-4">
                <div className="flex items-center gap-3">
                  <CheckCircleIcon className="w-8 h-8 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600">Confirmadas</p>
                    <p className="text-2xl font-black text-slate-900">{confirmadasCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Membros */}
          <div className="lg:col-span-2 rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Membros Ativos</h2>
              <Link
                href="/contatos"
                className="text-sm text-violet-600 hover:text-violet-700 font-semibold"
              >
                Ver todos
              </Link>
            </div>

            <div className="space-y-3">
              {membros.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">
                  Nenhum membro cadastrado
                </p>
              ) : (
                membros.slice(0, 5).map((membro) => (
                  <div
                    key={membro.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-[14px] hover:bg-slate-100 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-5 h-5 text-violet-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {membro.name || 'Sem nome'}
                      </p>
                      <p className="text-sm text-slate-600 truncate">{membro.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Escalas Recentes */}
          <div className="rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)]">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Escalas Recentes</h2>

            <div className="space-y-3">
              {escalas.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">
                  Nenhuma escala recente
                </p>
              ) : (
                escalas.slice(0, 5).map((escala) => (
                  <div key={escala.id} className="p-3 bg-slate-50 rounded-[14px]">
                    <div className="flex items-start justify-between mb-1">
                      <p className="font-semibold text-sm text-slate-900 truncate pr-2">
                        {escala.evento?.nome || 'Evento sem nome'}
                      </p>
                      {isConfirmed(escala) && (
                        <CheckCircleIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      {escala.membro?.name || 'Membro'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {escala.evento?.data
                        ? new Date(escala.evento.data).toLocaleDateString('pt-BR')
                        : 'Sem data'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PainelMembrosPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <PainelMembrosContent />
    </ProtectedRoute>
  );
}
