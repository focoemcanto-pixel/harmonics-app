import Link from 'next/link';

// Rodapé das páginas públicas (landing, planos, cadastro, login, documentos legais).
export default function PublicFooter({ className = '' }) {
  return (
    <footer className={`relative z-10 border-t border-white/10 py-8 text-sm text-slate-400 ${className}`}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 md:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-black tracking-[-0.02em] text-slate-200">Harmonics</p>
          <p className="text-xs leading-5">© {new Date().getFullYear()} FOCO START LTDA · CNPJ 29.671.912/0001-77 · Salvador/BA</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Links institucionais">
          <Link href="/planos" className="transition hover:text-white">Planos</Link>
          <Link href="/termos" className="transition hover:text-white">Termos de Uso</Link>
          <Link href="/privacidade" className="transition hover:text-white">Política de Privacidade</Link>
          <a href="mailto:focoemcanto@gmail.com" className="transition hover:text-white">Contato</a>
        </nav>
      </div>
    </footer>
  );
}
