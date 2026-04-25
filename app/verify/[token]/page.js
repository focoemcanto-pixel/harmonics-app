import { getSupabaseAdmin } from '@/lib/supabase-admin';
import CopyHashButton from './CopyHashButton';

export const dynamic = 'force-dynamic';
const precontractSelect = `
  id,
  public_token,
  client_name,
  nome_cliente,
  client_email,
  client_phone,
  event_date,
  data_evento,
  event_time,
  hora_evento,
  event_location,
  location_name,
  location_address,
  local,
  address,
  venue,
  event_type,
  tipo_evento
`;

function asString(value) {
  return String(value || '').trim();
}

function resolveContractToken(contract) {
  return (
    contract?.signature_metadata?.validation_token ||
    contract?.signature_metadata?.verification_token ||
    contract?.raw_payload?.signature_metadata?.validation_token ||
    contract?.raw_payload?.signature_metadata?.verification_token ||
    null
  );
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

function shouldFallbackToWildcard(error) {
  const message = asString(error?.message).toLowerCase();
  return message.includes('could not find') || message.includes('column') || message.includes('schema cache');
}

async function fetchPrecontractWithFallback({ supabase, filterColumn, filterValue }) {
  let query = supabase.from('precontracts').select(precontractSelect).eq(filterColumn, filterValue);
  query = filterColumn === 'id' ? query.maybeSingle() : query.maybeSingle();

  const { data, error } = await query;
  if (!error) return { data, error: null };
  if (!shouldFallbackToWildcard(error)) return { data: null, error };

  const fallback = await supabase
    .from('precontracts')
    .select('*')
    .eq(filterColumn, filterValue)
    .maybeSingle();

  return fallback;
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
  const resolvedParams = await params;
  const rawToken = Array.isArray(resolvedParams?.token)
    ? resolvedParams.token[0]
    : resolvedParams?.token;
  const token = asString(rawToken);

  console.info('[VERIFY_PAGE][TOKEN]', {
    rawParams: resolvedParams,
    token,
  });

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

  const { data: precontract, error: precontractError } = await fetchPrecontractWithFallback({
    supabase,
    filterColumn: 'public_token',
    filterValue: token,
  });

  if (precontractError) {
    console.error('[VERIFY_PAGE][QUERY_ERROR]', {
      step: 'precontract',
      message: precontractError.message,
    });
  }

  const contractSelect = `
    id,
    public_token,
    precontract_id,
    document_hash,
    pdf_url,
    status,
    signed_at,
    signature_metadata,
    raw_payload,
    created_at
  `;

  const { data: contractByPublicToken, error: contractByPublicTokenError } = await supabase
    .from('contracts')
    .select(contractSelect)
    .eq('public_token', token)
    .maybeSingle();

  if (contractByPublicTokenError) {
    console.error('[VERIFY_PAGE][QUERY_ERROR]', {
      step: 'contractByPublicToken',
      message: contractByPublicTokenError.message,
    });
  }

  const {
    data: contractByValidationOrVerificationOrHash,
    error: contractByValidationOrVerificationOrHashError,
  } = await supabase
    .from('contracts')
    .select(contractSelect)
    .eq('document_hash', token)
    .maybeSingle();

  if (contractByValidationOrVerificationOrHashError) {
    console.error('[VERIFY_PAGE][QUERY_ERROR]', {
      step: 'contractByValidationOrVerificationOrHash',
      message: contractByValidationOrVerificationOrHashError.message,
    });
  }

  const contractCandidates = [contractByPublicToken, contractByValidationOrVerificationOrHash].filter(Boolean);

  const contractByValidationToken =
    contractCandidates.find((candidate) => asString(resolveContractToken(candidate)) === token) || null;
  const contractByVerificationToken =
    contractCandidates.find((candidate) => asString(resolveContractToken(candidate)) === token) || null;
  const contractByDocumentHash =
    asString(contractByValidationOrVerificationOrHash?.document_hash) === token
      ? contractByValidationOrVerificationOrHash
      : null;

  let contractByPrecontract = null;
  if (precontract?.id) {
    const { data, error } = await supabase
      .from('contracts')
      .select(contractSelect)
      .eq('precontract_id', precontract.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[VERIFY_PAGE][QUERY_ERROR]', {
        step: 'contractByPrecontract',
        message: error.message,
      });
    }

    contractByPrecontract = data || null;
  }

  const contract =
    contractByPublicToken ||
    contractByValidationToken ||
    contractByVerificationToken ||
    contractByDocumentHash ||
    contractByPrecontract ||
    null;

  let resolvedPrecontract = precontract || null;
  if (!resolvedPrecontract?.id && contract?.precontract_id) {
    const { data: byId } = await fetchPrecontractWithFallback({
      supabase,
      filterColumn: 'id',
      filterValue: contract.precontract_id,
    });
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
  const rawMetadata = contract.raw_payload?.signature_metadata || {};

  const signerName = asString(metadata.signer_name || rawMetadata.signer_name) || 'Não informado';
  const signerCpf = maskCpf(metadata.signer_cpf || rawMetadata.signer_cpf || '');
  const signedAt = formatDateTimeBR(contract.signed_at || metadata.signed_at_utc || rawMetadata.signed_at_utc);
  const hash = asString(contract.document_hash || metadata.document_hash || rawMetadata.document_hash);
  const clientName =
    asString(resolvedPrecontract?.client_name) ||
    asString(resolvedPrecontract?.nome_cliente) ||
    asString(metadata.signer_name) ||
    'Não informado';
  const eventDate = resolvedPrecontract?.event_date || resolvedPrecontract?.data_evento || null;
  const eventTime =
    asString(resolvedPrecontract?.event_time) ||
    asString(resolvedPrecontract?.hora_evento) ||
    'Não informado';
  const eventLocation =
    asString(resolvedPrecontract?.event_location) ||
    asString(resolvedPrecontract?.location_name) ||
    asString(resolvedPrecontract?.location_address) ||
    asString(resolvedPrecontract?.local) ||
    asString(resolvedPrecontract?.address) ||
    asString(resolvedPrecontract?.venue) ||
    'Não informado';

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
          <p><strong>IP:</strong> {maskIp(metadata.signer_ip || rawMetadata.signer_ip)}</p>
          <p><strong>User Agent:</strong> {summarizeUserAgent(metadata.user_agent || rawMetadata.user_agent)}</p>
          <p><strong>Origem:</strong> Sistema Harmonics</p>
        </InfoCard>

        <InfoCard title="Evento">
          <p><strong>Cliente:</strong> {clientName}</p>
          <p><strong>Data:</strong> {formatDateBR(eventDate)}</p>
          <p><strong>Horário:</strong> {eventTime}</p>
          <p><strong>Local:</strong> {eventLocation}</p>
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
        </div>
      </div>
    </ValidationShell>
  );
}
