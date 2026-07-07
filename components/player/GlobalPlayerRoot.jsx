'use client';

import { GlobalPlayerProvider } from '@/components/player/GlobalPlayerProvider';
import GlobalPlayerHostFixed from '@/components/player/GlobalPlayerHostFixed';

export default function GlobalPlayerRoot({ children }) {
  return (
    <GlobalPlayerProvider>
      <GlobalPlayerHostFixed />
      {children}
    </GlobalPlayerProvider>
  );
}
