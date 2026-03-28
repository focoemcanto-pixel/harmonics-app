'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import EscalaCard from '../../components/escalas/EscalaCard';

export default function EventoEscalaTab({ eventId }) {
  const [escalaLocal, setEscalaLocal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarEscala() {
      setLoading(true);
      setErro('');
      try {
        const { data, error } = await supabase
          .from('event_musicians')
          .select('id, role, musician_id, status, notes')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        setEscalaLocal(data || []);
      } catch (e) {
        setErro('Erro ao carregar escala do evento.');
      } finally {
        setLoading(false);
      }
    }
    if(eventId) carregarEscala();
  }, [eventId]);

  // UI e funcoes serao implementadas nos proximos passos
  return (
    <section className="space-y-4">
      {erro && <div className="text-red-600">{erro}</div>}
      {loading ? (
        <div>Carregando escala...</div>
      ) : escalaLocal.length === 0 ? (
        <div>Nenhum músico escalado ainda.</div>
      ) : (
        escalaLocal.map(item => (
          <EscalaCard key={item.id || item.role + item.musician_id} escala={item} />
        ))
      )}
      {/* Inputs, botões de edição e salvar serão adicionados aqui */}
    </section>
  );
}