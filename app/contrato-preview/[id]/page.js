import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { buildContractTemplateData } from '@/lib/contracts/buildContractTemplateData';
import { generateInternalContract } from '@/lib/contracts/internalContractGenerator';

export const dynamic = 'force-dynamic';

function createAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase não configurado para contrato-preview.');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function ContratoPreviewPage({ params }) {
  const precontractId = params?.id;

  if (!precontractId) {
    notFound();
  }

  const supabase = createAdminSupabase();

  const { data: precontract, error: precontractError } = await supabase
    .from('precontracts')
    .select('*')
    .eq('id', precontractId)
    .maybeSingle();

  if (precontractError) {
    throw new Error(`Erro ao buscar precontract: ${precontractError.message}`);
  }

  if (!precontract) {
    notFound();
  }

  let contract = null;
  let contact = null;
  let event = null;

  if (precontract.id) {
    const { data } = await supabase
      .from('contracts')
      .select('*')
      .eq('precontract_id', precontract.id)
      .maybeSingle();

    contract = data || null;
  }

  if (precontract.contact_id) {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', precontract.contact_id)
      .maybeSingle();

    contact = data || null;
  }

  if (precontract.event_id) {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('id', precontract.event_id)
      .maybeSingle();

    event = data || null;
  }

  const context = { precontract, contract, contact, event };
  const templateData = buildContractTemplateData(context);
  const internal = generateInternalContract(context, templateData);

  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl rounded-[28px] border border-[#dbe3ef] bg-white p-6 shadow-[0_10px_26px_rgba(17,24,39,0.04)] md:p-10">
        <div className="mb-6 flex flex-col gap-2 border-b border-slate-200 pb-4">
          <span className="inline-flex w-fit rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
            Preview interno do contrato
          </span>
          <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
            {precontract.client_name || contact?.name || event?.client_name || 'Contrato'}
          </h1>
          <p className="text-sm text-slate-500">
            Pré-contrato: {precontract.id}
          </p>
        </div>

        <article
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: internal.html }}
        />
      </div>
    </main>
  );
}
