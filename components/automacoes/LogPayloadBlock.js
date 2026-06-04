'use client';

import { useMemo, useState } from 'react';

const MOBILE_PREVIEW_LIMIT = 900;
const DESKTOP_PREVIEW_LIMIT = 2400;

function getPreview(text, limit) {
  if (!text || text.length <= limit) return text;
  return `${text.slice(0, limit)}\n…`;
}

export default function LogPayloadBlock({ title, value }) {
  const [expanded, setExpanded] = useState(false);

  const serialized = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value || '');
    }
  }, [value]);

  if (!serialized || serialized === 'null' || serialized === '{}') return null;

  const mobilePreview = getPreview(serialized, MOBILE_PREVIEW_LIMIT);
  const desktopPreview = getPreview(serialized, DESKTOP_PREVIEW_LIMIT);
  const isLong = serialized.length > MOBILE_PREVIEW_LIMIT;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-[13px] font-bold text-[#0f172a]">{title}</label>
        {isLong ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="shrink-0 rounded-full border border-[#e2e8f0] px-3 py-1 text-[12px] font-bold text-[#475569] transition hover:bg-[#f8fafc]"
          >
            {expanded ? 'Recolher' : 'Expandir'}
          </button>
        ) : null}
      </div>

      <pre className="mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 text-[11px] leading-relaxed text-[#475569] [-webkit-overflow-scrolling:touch] sm:max-h-72">
        <span className="sm:hidden">{expanded ? serialized : mobilePreview}</span>
        <span className="hidden sm:inline">{expanded ? serialized : desktopPreview}</span>
      </pre>
    </div>
  );
}
