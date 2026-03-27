'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import AppShell from '../../components/layout/AppShell';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

function cleanPhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatPhone(value) {
  const v = cleanPhone(value);
  if (v.length === 11) {
    return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  }
  return value || '-';
}

export default function ContatosPage() {
  const [contatos, setContatos] = useState([]);
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [editandoId, setEditandoId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    tag: '',
    notes: '',
  });

  async function carregarContatos() {
    try {
      setCarregando(true);

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setContatos(data || []);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      alert(`Erro ao carregar contatos: ${error?.message}`);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarContatos();
  }, []);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function iniciarEdicao(c) {
    setEditandoId(c.id);

    setForm({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      tag: c.tag || '',
      notes: c.notes || '',
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditandoId(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      tag: '',
      notes: '',
    });
  }

  async function salvarContato() {
    if (!form.name.trim()) {
      alert('Informe o nome');
      return;
    }

    try {
      setSalvando(true);

      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: cleanPhone(form.phone),
        tag: form.tag.trim() || null,
        notes: form.notes.trim() || null,
        is_active: true,
      };

      let result;

      if (editandoId) {
        result = await supabase
          .from('contacts')
          .update(payload)
          .eq('id', editandoId);
      } else {
        result = await supabase
          .from('contacts')
          .insert([payload]);
      }

      if (result.error) throw result.error;

      resetForm();
      await carregarContatos();
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
      alert(`Erro ao salvar contato: ${error?.message}`);
    } finally {
      setSalvando(false);
    }
  }

  async function excluirContato(id) {
    if (!confirm('Excluir contato?')) return;

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (editandoId === id) resetForm();

      await carregarContatos();
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      alert(`Erro ao excluir contato: ${error?.message}`);
    }
  }

  const lista = useMemo(() => {
    const termo = busca.toLowerCase();

    return contatos.filter((c) =>
      [c.name, c.email, c.phone, c.tag]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(termo))
    );
  }, [contatos, busca]);

  return (
    <AppShell title="Contatos">
      <div className="space-y-6">
        <Card title={editandoId ? 'Editar contato' : 'Novo contato'}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Nome"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />

            <Input
              label="Email (login do painel)"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
            />

            <Input
              label="WhatsApp"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />

            <Input
              label="Tag (ex: vocal, noivo, músico)"
              value={form.tag}
              onChange={(e) => handleChange('tag', e.target.value)}
            />

            <Input
              label="Observações"
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="md:col-span-2"
            />
          </div>

          <div className="mt-5 flex gap-3">
            <Button onClick={salvarContato} disabled={salvando}>
              {salvando ? 'Salvando...' : editandoId ? 'Atualizar contato' : 'Salvar contato'}
            </Button>

            {editandoId && (
              <Button variant="soft" onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
        </Card>

        <Card title="Lista de contatos">
          <Input
            placeholder="Buscar por nome, email, telefone ou tag..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="mb-4"
          />

          {carregando ? (
            <p className="text-slate-500">Carregando contatos...</p>
          ) : lista.length === 0 ? (
            <p className="text-slate-500">Nenhum contato encontrado.</p>
          ) : (
            <div className="space-y-3">
              {lista.map((c) => (
                <Card
                  key={c.id}
                  title={c.name || 'Sem nome'}
                  subtitle={formatPhone(c.phone)}
                >
                  <p className="text-sm text-slate-500">
                    {c.email || '-'}
                  </p>

                  {c.tag && (
                    <p className="text-sm text-indigo-600 mt-1">
                      {c.tag}
                    </p>
                  )}

                  {c.notes && (
                    <p className="text-sm text-slate-400 mt-1">
                      {c.notes}
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Button variant="soft" onClick={() => iniciarEdicao(c)}>
                      Editar
                    </Button>

                    <Button
                      variant="danger"
                      onClick={() => excluirContato(c.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}