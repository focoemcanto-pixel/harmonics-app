import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function asString(value) {
  return String(value || '').trim();
}

function maskCpf(cpf) {
  const digits = asString(cpf).replace(/\D/g, '');
  if (digits.length !== 11) return '***.***.***-**';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

function formatSignedAt(value) {
  if (!value) return 'Não disponível';
  const date = new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

export default async function VerifyContractPage({ params }) {
  const token = asString(Array.isArray(params?.token) ? params.token[0] : params?.token);

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-100 p-4">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 text-center shadow-sm">
          Documento não encontrado ou token inválido.
        </div>
      </main>
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: contract } = await supabase
    .from('contracts')
    .select('id, pdf_url, signature_metadata, signed_at, document_hash, signature_name, verification_token')
    .eq('verification_token', token)
    .maybeSingle();

  if (!contract?.id) {
    return (
      <main className="min-h-screen bg-slate-100 p-4">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 text-center shadow-sm">
          Documento não encontrado ou token inválido.
        </div>
      </main>
    );
  }

  const metadata = contract.signature_metadata || {};

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <section className="mx-auto max-w-2xl rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">✅</div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Status: Contrato válido</p>
            <h1 className="text-2xl font-black text-slate-900">Documento verificado pelo sistema Harmonics</h1>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <p><strong>Signatário:</strong> {asString(metadata.signer_name || contract.signature_name) || 'Não informado'}</p>
          <p><strong>CPF:</strong> {maskCpf(metadata.signer_cpf || '')}</p>
          <p><strong>Data/hora da assinatura:</strong> {formatSignedAt(contract.signed_at || metadata.signed_at_utc)}</p>
          <p><strong>ID do contrato:</strong> {contract.id}</p>
          <p className="break-all"><strong>Hash SHA256:</strong> {asString(contract.document_hash || metadata.document_hash) || 'Não disponível'}</p>
          <p><strong>Origem da assinatura:</strong> {asString(metadata.origin) || 'Sistema Harmonics'}</p>
        </div>

        {contract.pdf_url ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href={contract.pdf_url} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white">
              Abrir/Baixar PDF assinado
            </a>
            <Link href="/" className="rounded-xl border border-slate-200 px-4 py-3 text-center font-semibold text-slate-700">
              Voltar ao início
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
