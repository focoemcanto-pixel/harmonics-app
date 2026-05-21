'use client';
import { useState } from 'react';

export default function AtivarContaPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setLoading(true); setMessage('');
    const res = await fetch('/api/public/ativar-conta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    const json = await res.json().catch(() => ({}));
    setMessage(json?.message || (res.ok ? 'Verifique seu e-mail.' : 'Não foi possível enviar link.'));
    setLoading(false);
  }

  return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-white/15 bg-white/5 p-6"><h1 className="text-3xl font-black">Ativar conta migrada</h1><p className="mt-2 text-sm text-slate-300">Informe o e-mail usado na assinatura para receber seu link mágico/reset.</p><input className="mt-4 w-full rounded-xl bg-slate-900 p-3" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com"/><button className="mt-4 w-full rounded-xl bg-violet-600 p-3 font-bold" disabled={loading}>{loading ? 'Enviando...' : 'Receber link'}</button>{message ? <p className="mt-3 text-sm">{message}</p> : null}</form></main>;
}
