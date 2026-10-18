import LegalDocument from '@/components/public/LegalDocument';
import PublicFooter from '@/components/public/PublicFooter';
import { PublicBackground, PublicHeader } from '@/components/public/PublicUI';
import { TERMS_MARKDOWN } from '@/lib/legal/content';
import { LEGAL_DOCUMENTS } from '@/lib/legal/documents';

export const metadata = {
  title: 'Termos de Uso | Harmonics',
  description: 'Termos de Uso da plataforma Harmonics (versão ' + LEGAL_DOCUMENTS.terms.version + ').',
};

export default function Page() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <PublicBackground />
      <PublicHeader />
      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-14 pt-6 md:pt-10">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-8 md:p-10">
          <LegalDocument markdown={TERMS_MARKDOWN} />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
