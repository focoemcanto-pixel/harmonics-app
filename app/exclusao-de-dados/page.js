import Link from 'next/link';
import PublicFooter from '@/components/public/PublicFooter';
import { PublicBackground, PublicHeader } from '@/components/public/PublicUI';

export const metadata = {
  title: 'Exclusão de Dados | Harmonics',
  description: 'Instruções para solicitar acesso, correção ou exclusão de dados pessoais vinculados à plataforma Harmonics e às suas integrações.',
};

export default function DataDeletionPage() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-slate-950 text-white">
      <PublicBackground />
      <PublicHeader />
      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-14 pt-6 md:pt-10">
        <article className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-8 md:p-10">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Solicitar exclusão de dados</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            A Harmonics, operada pela FOCO START LTDA, recebe solicitações de exclusão,
            correção e acesso a dados pessoais utilizados na plataforma Harmonics e nas suas
            integrações de comunicação, incluindo WhatsApp Business e Meta.
          </p>
          <h2 className="mt-8 text-lg font-semibold">Como solicitar</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-6 text-sm leading-7 text-slate-300">
            <li>
              Envie um e-mail para{' '}
              <a className="font-semibold text-violet-300 underline" href="mailto:focoemcanto@gmail.com?subject=Solicita%C3%A7%C3%A3o%20de%20exclus%C3%A3o%20de%20dados%20-%20Harmonics">
                focoemcanto@gmail.com
              </a>{' '}
              com o assunto “Solicitação de exclusão de dados — Harmonics”.
            </li>
            <li>
              Informe se você tem uma conta na plataforma ou se entrou em contato com a
              Banda Harmonics por WhatsApp. Para localizar os dados, identifique o e-mail da
              conta ou o número de WhatsApp relacionado ao pedido e descreva o que deseja excluir.
              Não envie senhas, códigos de autenticação ou documentos sensíveis no primeiro contato.
            </li>
            <li>
              Nossa equipe avaliará o pedido e poderá solicitar a confirmação de sua identidade
              por um canal seguro antes de proceder à exclusão ou responder sobre eventuais
              limitações legais aplicáveis.
            </li>
          </ol>
          <h2 className="mt-8 text-lg font-semibold">O que acontece com os dados</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Os dados elegíveis serão excluídos ou anonimizados de acordo com a legislação
            aplicável. Determinados registros podem precisar ser conservados para cumprir
            obrigações legais, regulatórias ou para o exercício regular de direitos.
            Se os dados foram inseridos na plataforma por outro cliente da Harmonics, o
            pedido poderá ser encaminhado ao responsável pelo tratamento.
          </p>
          <p className="mt-6 text-sm leading-7 text-slate-300">
            Consulte também nossa{' '}
            <Link href="/privacidade" className="font-semibold text-violet-300 underline">
              Política de Privacidade
            </Link>{' '}
            para informações sobre o tratamento de dados e os direitos dos titulares.
          </p>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
