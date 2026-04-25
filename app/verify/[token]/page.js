import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import CopyHashButton from './CopyHashButton';

export const dynamic = 'force-dynamic';

function asString(value) {
  return String(value || '').trim();
}

function maskCpf(cpf) {
  const digits = asString(cpf).replace(/\D/g, '');
  if (digits.length !== 11) return '***.***.***-**';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

function maskIp(ip) {
  const value = asString(ip);
  if (!value) return 'Não disponível';
  if (value.includes(':')) {
    const parts = value.split(':').filter(Boolean);
    if (parts.length < 2) return '****';
    return `${parts[0]}:${parts[1]}:****`;
  }

  const octets = value.split('.');
  if (octets.length === 4) {
    return `${octets[0]}.${octets[1]}.*.*`;
  }

  return `${value.slice(0, 6)}****`;
}

function summarizeUserAgent(value) {
  const ua = asString(value);
  if (!ua) return 'Não disponível';
  return ua.length > 100 ? `${ua.slice(0, 100)}...` : ua;
}

function formatDateTimeBR(value) {
  if (!value) return 'Não disponível';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não disponível';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function formatDateBR(value) {
  if (!value) return 'Não informado';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return asString(value);
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(date);
}

function breakHash(hash) {
  const value = asString(hash);
  if (!value) return 'Não disponível';
  return value.match(/.{1,32}/g)?.join('\n') || value;
}

function ValidationShell({ tone = 'emerald', title, subtitle, children }) {
  const toneClasses = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  return (
    <main className="min-h-screen bg-[#f3f6fb] px-4 py-10">
      <section className="mx-auto w-full max-w-3xl rounded-[32px] border border-[#dbe3ef] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] sm:p-10">
        <div className="mb-7 flex flex-col gap-4">
          <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-4 py-1 text-xs font-bold tracking-[0.2em] text-slate-700">
            HARMONICS • VALIDAÇÃO PÚBLICA
          </span>
          <div className="flex items-start gap-4">
            <div className={`rounded-full border p-3 ${toneClasses[tone]}`}>
              <span className="text-xl">{tone === 'emerald' ? '✓' : tone === 'amber' ? '!' : '×'}</span>
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900">{title}</h1>
              <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
            </div>
          </div>
        </div>
        {children}
        <footer className="mt-10 border-t border-slate-100 pt-5 text-xs text-slate-500">
          Validação pública emitida pelo sistema Harmonics.
        </footer>
      </section>
    </main>
  );
}

function InfoCard({ title, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
      <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-slate-800">{title}</h2>
      <div className="space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  );
}

export default async function VerifyContractPage({ params }) {
  const token = asString(Array.isArray(params?.token) ? params.token[0] : params?.token);

  if (!token) {
    return (
      <ValidationShell
        tone="rose"
        title="Documento não encontrado ou token inválido."
        subtitle="Confira se o link foi copiado completo ou solicite um novo PDF assinado."
      />
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: precontract } = await supabase
    .from('precontracts')
    .select('id, public_token, client_name, client_email, client_phone, event_date, event_time, event_location')
    .eq('public_token', token)
    .maybeSingle();

  const contractQuery = supabase
    .from('contracts')
    .select(`
      id,
      public_token,
      precontract_id,
      status,
      signed_at,
      document_hash,
      pdf_url,
      signature_name,
      signature_cpf,
      signer_ip,
      user_agent,
      validation_token,
      verification_token,
      signature_metadata,
      created_at,
      updated_at
    `);

  const { data: contractByPublicToken } = (precontract?.id
    ? await contractQuery.or(`public_token.eq.${token},precontract_id.eq.${precontract.id}`).maybeSingle()
    : await contractQuery.eq('public_token', token).maybeSingle());

  let contract = contractByPublicToken || null;

  if (!contract?.id) {
    const { data: byVerificationToken } = await supabase
      .from('contracts')
      .select(`
        id,
        public_token,
        precontract_id,
        status,
        signed_at,
        document_hash,
        pdf_url,
        signature_name,
        signature_cpf,
        signer_ip,
        user_agent,
        validation_token,
        verification_token,
        signature_metadata,
        created_at,
        updated_at
      `)
      .or(`validation_token.eq.${token},verification_token.eq.${token}`)
      .maybeSingle();

    contract = byVerificationToken || null;
  }

  if (!contract?.id) {
    const { data: byMetadataToken } = await supabase
      .from('contracts')
      .select(`
        id,
        public_token,
        precontract_id,
        status,
        signed_at,
        document_hash,
        pdf_url,
        signature_name,
        signature_cpf,
        signer_ip,
        user_agent,
        validation_token,
        verification_token,
        signature_metadata,
        created_at,
        updated_at
      `)
      .or(`signature_metadata->>validation_token.eq.${token},signature_metadata->>verification_token.eq.${token}`)
      .maybeSingle();

    contract = byMetadataToken || null;
  }

  let resolvedPrecontract = precontract || null;
  if (!resolvedPrecontract?.id && contract?.precontract_id) {
    const { data: byId } = await supabase
      .from('precontracts')
      .select('id, public_token, client_name, client_email, client_phone, event_date, event_time, event_location')
      .eq('id', contract.precontract_id)
      .maybeSingle();
    resolvedPrecontract = byId || null;
  }

  if (!contract?.id) {
    return (
      <ValidationShell
        tone="rose"
        title="Documento não encontrado ou token inválido."
        subtitle="Confira se o link foi copiado completo ou solicite um novo PDF assinado."
      />
    );
  }

  const metadata = contract.signature_metadata || {};
  const isSigned = asString(contract.status).toLowerCase() === 'signed' && !!contract.signed_at;

  if (!isSigned) {
    return (
      <ValidationShell
        tone="amber"
        title="Documento encontrado, mas ainda não assinado."
        subtitle="Este contrato existe no sistema, porém a assinatura eletrônica ainda não foi concluída."
      >
        <InfoCard title="Status do documento">
          <p><strong>Status:</strong> {asString(contract.status) || 'Pendente'}</p>
          <p><strong>ID do contrato:</strong> {contract.id}</p>
          <p><strong>Cliente:</strong> {asString(resolvedPrecontract?.client_name) || 'Não informado'}</p>
        </InfoCard>
      </ValidationShell>
    );
  }

  const signerName = asString(contract.signature_name || metadata.signer_name) || 'Não informado';
  const signerCpf = maskCpf(contract.signature_cpf || metadata.signer_cpf || '');
  const signedAt = formatDateTimeBR(contract.signed_at || metadata.signed_at_utc);
  const hash = asString(contract.document_hash || metadata.document_hash);

  return (
    <ValidationShell
      tone="emerald"
      title="Documento verificado"
      subtitle="Este contrato foi assinado eletronicamente e possui registro técnico de integridade."
    >
      <div className="space-y-4">
        <InfoCard title="Status">
          <p><strong>Status:</strong> Documento válido</p>
          <p><strong>Hash SHA256:</strong> confirmado</p>
          <p><strong>Assinatura eletrônica:</strong> registrada</p>
        </InfoCard>

        <InfoCard title="Signatário">
          <p><strong>Nome:</strong> {signerName}</p>
          <p><strong>CPF:</strong> {signerCpf}</p>
          <p><strong>Data/hora da assinatura:</strong> {signedAt}</p>
        </InfoCard>

        <InfoCard title="Dados técnicos">
          <p><strong>ID do contrato:</strong> {contract.id}</p>
          <p className="whitespace-pre-wrap break-all"><strong>Hash SHA256:</strong> {breakHash(hash)}</p>
          <p><strong>IP:</strong> {maskIp(contract.signer_ip || metadata.signer_ip)}</p>
          <p><strong>User Agent:</strong> {summarizeUserAgent(contract.user_agent || metadata.user_agent)}</p>
          <p><strong>Origem:</strong> Sistema Harmonics</p>
        </InfoCard>

        <InfoCard title="Evento">
          <p><strong>Cliente:</strong> {asString(resolvedPrecontract?.client_name) || 'Não informado'}</p>
          <p><strong>Data:</strong> {formatDateBR(resolvedPrecontract?.event_date)}</p>
          <p><strong>Horário:</strong> {asString(resolvedPrecontract?.event_time) || 'Não informado'}</p>
          <p><strong>Local:</strong> {asString(resolvedPrecontract?.event_location) || 'Não informado'}</p>
        </InfoCard>

        <div className="flex flex-wrap gap-3 pt-2">
          {contract.pdf_url ? (
            <a
              href={contract.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-[#0f172a] px-5 py-3 text-sm font-black text-white"
            >
              Abrir PDF assinado
            </a>
          ) : null}
          <CopyHashButton hash={hash} />
          <Link href="/" className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700">
            Voltar ao início
          </Link>
        </div>
      </div>
    </ValidationShell>
  );
}
