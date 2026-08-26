'use client';

import { useEffect, useRef, useState } from 'react';

function normalizeValue(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');
}

export default function EditableMusicalKey({ row }) {
  const itemId = String(row?.id || row?.repertoire_item_id || '').trim();
  const initial = normalizeValue(row?.musicalKey ?? row?.musical_key ?? row?.tom ?? '');
  const [value, setValue] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const next = normalizeValue(row?.musicalKey ?? row?.musical_key ?? row?.tom ?? '');
    setValue(next);
    if (!editing) setDraft(next);
  }, [row?.id, row?.musicalKey, row?.musical_key, row?.tom, editing]);

  useEffect(() => {
    if (!editing) return;
    const timer = setTimeout(() => inputRef.current?.focus?.(), 30);
    return () => clearTimeout(timer);
  }, [editing]);

  async function save() {
    if (!itemId || saving) return;
    const next = normalizeValue(draft);
    if (next === value) {
      setEditing(false);
      setError('');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const response = await fetch('/api/membro/repertoire-key', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, musicalKey: next }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Não foi possível salvar o tom.');
      }
      const saved = normalizeValue(payload?.musicalKey ?? next);
      setValue(saved);
      setDraft(saved);
      setEditing(false);
    } catch (saveError) {
      setError(saveError?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (!itemId) {
    return (
      <div className="flex h-9 min-w-[48px] items-center justify-center rounded-[11px] border border-white/10 bg-white/5 px-2 text-[10px] font-black uppercase tracking-[0.08em] text-white/35">
        Tom —
      </div>
    );
  }

  if (editing) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 12))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
            if (e.key === 'Escape') {
              setDraft(value);
              setEditing(false);
              setError('');
            }
          }}
          onBlur={() => save()}
          inputMode="text"
          autoCapitalize="characters"
          aria-label="Editar tom da música"
          placeholder="Tom"
          className="h-9 w-[62px] rounded-[11px] border border-violet-300/35 bg-[#120b24] px-2 text-center text-[12px] font-black text-white outline-none ring-2 ring-violet-400/20 placeholder:text-white/35"
        />
        {error ? (
          <div className="absolute right-0 top-[42px] z-20 w-[180px] rounded-xl border border-red-400/20 bg-[#2b1020] px-2.5 py-2 text-[10px] font-bold leading-4 text-red-200 shadow-xl">
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
        setError('');
      }}
      disabled={saving}
      aria-label={value ? `Editar tom ${value}` : 'Definir tom da música'}
      title="Definir/editar tom"
      className="flex h-9 min-w-[48px] items-center justify-center rounded-[11px] border border-violet-300/20 bg-violet-400/10 px-2 text-[10px] font-black uppercase tracking-[0.08em] text-violet-100 transition active:scale-95 disabled:opacity-60"
    >
      {saving ? '...' : `Tom ${value || '—'}`}
    </button>
  );
}
