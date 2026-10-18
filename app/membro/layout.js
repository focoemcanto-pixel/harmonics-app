import { Suspense } from 'react';

// App instalado a partir do portal do membro abre sempre em /membro (manifest e escopo próprios),
// nunca no painel administrativo do manifest global.
export const metadata = {
  manifest: '/membro.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Harmonics Membro',
    statusBarStyle: 'black-translucent',
  },
};

function MemberPanelFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050814] text-white">
      <div className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-[15px] font-semibold">
        Carregando painel do membro...
      </div>
    </div>
  );
}

export default function MemberLayout({ children }) {
  return <Suspense fallback={<MemberPanelFallback />}>{children}</Suspense>;
}
