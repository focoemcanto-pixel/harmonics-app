'use client';

import { getToneClasses } from '../../lib/contatos/contatos-ui';

export default function ContatoPill({ tone = 'default', children }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${getToneClasses(
        tone
      )}`}
    >
      {children}
    </span>
  );
}
