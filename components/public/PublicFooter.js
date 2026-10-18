import Link from 'next/link';

// Rodapé das páginas públicas (landing, planos, cadastro, login, documentos legais).
export default function PublicFooter({ className = '' }) {
  return (
    <footer className={`border-t border-white/10 px-4 py-6 text-sm text-slate-400 ${className}`}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} Harmonics · FOCO START LTDA · CNPJ 29.671.912/0001-77</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Links institucionais">
          <Link href="/planos" className="hover:text-slate-200">Planos</Link>
          <Link href="/termos" className="hover:text-slate-200">Termos de Uso</Link>
          <Link href="/privacidade" className="hover:text-slate-200">Política de Privacidade</Link>
          <a href="mailto:focoemcanto@gmail.com" className="hover:text-slate-200">Contato</a>
        </nav>
      </div>
    </footer>
  );
}
