'use client';

import { GlobalPlayerProvider } from '@/components/player/GlobalPlayerProvider';
import GlobalPlayerHost from '@/components/player/GlobalPlayerHost';

export default function GlobalPlayerRoot({ children }) {
  return (
    <GlobalPlayerProvider>
      <GlobalPlayerHost />
      {children}
    </GlobalPlayerProvider>
  );
}
