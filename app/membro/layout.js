import { Suspense } from 'react';

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
