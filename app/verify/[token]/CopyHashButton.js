'use client';

import { useMemo, useState } from 'react';

export default function CopyHashButton({ hash }) {
  const [copied, setCopied] = useState(false);
  const safeHash = useMemo(() => String(hash || '').trim(), [hash]);

  async function handleCopy() {
    if (!safeHash) return;
    try {
      await navigator.clipboard.writeText(safeHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!safeHash}
      className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {copied ? 'Hash copiado' : 'Copiar hash'}
    </button>
  );
}
