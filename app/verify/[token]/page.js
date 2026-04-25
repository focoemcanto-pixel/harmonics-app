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

function NotFoundCard() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white p-4 sm:p-6">
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-full bg-rose-100 p-2 text-rose-700">⚠️</div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-rose-700">Validação pública</p>
            <h1 className="text-2xl font-black text-slate-900">Documento não encontrado ou token inválido.</h1>
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Confira se o link foi copiado completo. Se necessário, solicite um novo PDF assinado.
        </p>
      </section>
    </main>
  );
}

export default async function VerifyContractPage({ params }) {
  const token = asString(Array.isArray(params?.token) ? params.token[0] : params?.token);

  if (!token) {
    return <NotFoundCard />;
  }

  const supabase = getSupabaseAdmin();
  const contractFields = 'id, public_token, verification_token, status, signed_at, document_hash, pdf_url, signature_metadata, signature_name, signer_ip, user_agent';

  const { data: contractByVerificationToken } = await supabase
    .from('contracts')
    .select(contractFields)
    .eq('verification_token', token)
    .maybeSingle();

  let contract = contractByVerificationToken || null;

  if (!contract?.id) {
    const { data: contractByPublicToken } = await supabase
      .from('contracts')
      .select(contractFields)
      .eq('public_token', token)
      .maybeSingle();
    contract = contractByPublicToken || null;
  }

  if (!contract?.id) {
    const { data: contractByRawPayloadToken } = await supabase
      .from('contracts')
      .select(contractFields)
      .filter('raw_payload->signature_metadata->>verification_token', 'eq', token)
      .maybeSingle();
    contract = contractByRawPayloadToken || null;
  }

  if (!contract?.id) {
    return <NotFoundCard />;
  }

  const metadata = contract.signature_metadata || {};

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-slate-50 to-white p-4 sm:p-6">
      <section className="mx-auto max-w-2xl rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-700">✅</div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Status da validação</p>
            <h1 className="text-2xl font-black text-slate-900">Documento verificado</h1>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <p><strong>Signatário:</strong> {asString(metadata.signer_name || contract.signature_name) || 'Não informado'}</p>
          <p><strong>CPF:</strong> {maskCpf(metadata.signer_cpf || '')}</p>
          <p><strong>Data/hora da assinatura:</strong> {formatSignedAt(contract.signed_at || metadata.signed_at_utc)}</p>
          <p><strong>ID do contrato:</strong> {contract.id}</p>
          <p className="break-all"><strong>Hash SHA256:</strong> {asString(contract.document_hash || metadata.document_hash) || 'Não disponível'}</p>
          <p><strong>Origem da assinatura:</strong> {asString(metadata.origin) || 'Sistema Harmonics'}</p>
          <p><strong>Status:</strong> {asString(contract.status) || 'Não informado'}</p>
          <p>Este documento foi assinado eletronicamente pelo sistema Harmonics.</p>
        </div>

        {contract.pdf_url ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href={contract.pdf_url} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white">
              Abrir PDF assinado
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
