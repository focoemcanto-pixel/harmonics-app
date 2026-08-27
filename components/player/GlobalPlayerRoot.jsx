'use client';

import { GlobalPlayerProvider } from '@/components/player/GlobalPlayerProvider';
import GlobalPlayerHostFixed from '@/components/player/GlobalPlayerHostFixed';
import MediaSessionBridge from '@/components/player/MediaSessionBridge';

export default function GlobalPlayerRoot({ children }) {
  return (
    <GlobalPlayerProvider>
      <GlobalPlayerHostFixed />
      <MediaSessionBridge />
      {children}
    </GlobalPlayerProvider>
  );
}
