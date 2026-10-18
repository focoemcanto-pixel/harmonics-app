import Link from 'next/link';
import LegalDocument from '@/components/public/LegalDocument';
import PublicFooter from '@/components/public/PublicFooter';
import { TERMS_MARKDOWN } from '@/lib/legal/content';
import { LEGAL_DOCUMENTS } from '@/lib/legal/documents';

export const metadata = {
  title: 'Termos de Uso | Harmonics',
  description: 'Termos de Uso da plataforma Harmonics (versão ' + LEGAL_DOCUMENTS.terms.version + ').',
};

export default function Page() {
  return (
    <main className="min-h-[100dvh] bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 md:py-14">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-emerald-200">Harmonics</Link>
          <Link href="/planos" className="text-sm font-semibold text-slate-300 hover:text-white">Ver planos</Link>
        </div>
        <LegalDocument markdown={TERMS_MARKDOWN} />
      </div>
      <PublicFooter />
    </main>
  );
}
