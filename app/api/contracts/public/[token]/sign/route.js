import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildSignedContractHtml, extractSignerIp, generateVerificationToken } from '@/lib/contracts/premiumSignature';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function asString(value) {
  return String(value || '').trim();
}

function maskCpf(cpf) {
  const digits = asString(cpf).replace(/\D/g, '');
  if (digits.length !== 11) return '***.***.***-**';
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

function extractToken(params) {
  if (Array.isArray(params?.token)) return asString(params.token[0]);
  return asString(params?.token);
}

function resolveSignatureOrigin(rawOrigin) {
  const normalized = asString(rawOrigin).toLowerCase();
  if (normalized === 'cliente') return 'CLIENTE';
  return 'Sistema Harmonics';
}

async function updateContractWithFallbacks({ supabase, contractId, patchPayload }) {
  const missingColumns = [];
  let currentPayload = { ...patchPayload };

  while (true) {
    const { error } = await supabase.from('contracts').update(currentPayload).eq('id', contractId);
    if (!error) return { missingColumns };

    const message = String(error.message || '');
    const match = message.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"?contracts"?\s+does\s+not\s+exist/i)
      || message.match(/Could not find the '([^']+)' column/i);

    const column = match?.[1] || '';
    if (!column || !Object.prototype.hasOwnProperty.call(currentPayload, column)) {
      throw error;
    }

    missingColumns.push(column);
    delete currentPayload[column];
  }
}

async function resolveSigningContext({ supabase, token }) {
  console.info('[CONTRACT_PUBLIC_SIGN][TOKEN_RESOLVE_START]', { token });

  let contract = null;
  let precontract = null;
  let foundContract = false;
  let foundPrecontract = false;
  let createdContract = false;

  const { data: contractByToken, error: contractByTokenError } = await supabase
    .from('contracts')
    .select('*')
    .eq('public_token', token)
    .maybeSingle();

  if (contractByTokenError) throw contractByTokenError;

  if (contractByToken?.id) {
    contract = contractByToken;
    foundContract = true;
  }

  if (!contract) {
    const { data: preByToken, error: preByTokenError } = await supabase
      .from('precontracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (preByTokenError) throw preByTokenError;

    if (preByToken?.id) {
      precontract = preByToken;
      foundPrecontract = true;
    }

    let contractFromPre = null;

    if (precontract?.id) {
      const { data: contractByPrecontract, error: contractByPrecontractError } = await supabase
        .from('contracts')
        .select('*')
        .eq('precontract_id', precontract.id)
        .maybeSingle();

      if (contractByPrecontractError) throw contractByPrecontractError;
      contractFromPre = contractByPrecontract || null;
    }

    let newContract = null;

    if (!contractFromPre && precontract?.id) {
      const { data: insertedContract, error: insertError } = await supabase
        .from('contracts')
        .insert({
          precontract_id: precontract.id,
          public_token: token,
          status: 'draft',
        })
        .select()
        .single();

      if (insertError) {
        const conflictMessage = String(insertError.message || '').toLowerCase();
        if (
          conflictMessage.includes('duplicate key') ||
          conflictMessage.includes('unique') ||
          conflictMessage.includes('violates')
        ) {
          const { data: contractAfterConflict, error: loadAfterConflictError } = await supabase
            .from('contracts')
            .select('*')
            .eq('precontract_id', precontract.id)
            .maybeSingle();

          if (loadAfterConflictError) throw loadAfterConflictError;
          newContract = contractAfterConflict || null;
        } else {
          throw insertError;
        }
      } else {
        newContract = insertedContract || null;
        createdContract = Boolean(newContract?.id);
      }
    }

    contract = contract || contractFromPre || newContract;
    foundContract = foundContract || Boolean(contract?.id);
  }

  if (!precontract && contract?.precontract_id) {
    const { data: preByContractId, error: preByContractIdError } = await supabase
      .from('precontracts')
      .select('*')
      .eq('id', contract.precontract_id)
      .maybeSingle();

    if (preByContractIdError) throw preByContractIdError;
    precontract = preByContractId || null;
    foundPrecontract = foundPrecontract || Boolean(precontract?.id);
  }

  console.info('[TOKEN_FLOW]', { foundContract, foundPrecontract, createdContract });

  if (!contract?.id) {
    throw new Error('Não foi possível criar ou recuperar contrato vinculado ao precontract.');
  }

  const syncOps = [];

  if (precontract?.id && precontract.public_token !== token) {
    syncOps.push(
      supabase
        .from('precontracts')
        .update({ public_token: token })
        .eq('id', precontract.id)
    );
    precontract = { ...precontract, public_token: token };
  }

  if (contract.public_token !== token) {
    syncOps.push(
      supabase
        .from('contracts')
        .update({ public_token: token })
        .eq('id', contract.id)
    );
    contract = { ...contract, public_token: token };
  }

  if (syncOps.length > 0) {
    const results = await Promise.all(syncOps);
    const syncError = results.find((result) => result?.error)?.error;
    if (syncError) throw syncError;
  }

  if (precontract?.id && !contract.precontract_id) {
    const { error: patchContractError } = await supabase
      .from('contracts')
      .update({ precontract_id: precontract.id })
      .eq('id', contract.id);

    if (patchContractError) throw patchContractError;
    contract = { ...contract, precontract_id: precontract.id };
  }

  return { contract, precontract };
}

export async function POST(request, context) {
  const resolvedParams = await context?.params;
  const token = extractToken(resolvedParams);

  console.info('[CONTRACT_PUBLIC_SIGN][PARAMS_RESOLVED]', {
    rawParams: resolvedParams,
    token,
  });
  if (!token) {
    return NextResponse.json({ ok: false, message: 'Token inválido.' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => null);
    const signedAt = new Date().toISOString();
    const signerIp = extractSignerIp(request.headers);
    const userAgent = asString(request.headers.get('user-agent')) || 'Não disponível';
    const signerName = asString(body?.signerName) || 'Não informado';
    const signerCpf = asString(body?.signerCpf) || 'Não informado';
    const origin = resolveSignatureOrigin(body?.origin);
    const contractHtml = asString(body?.html || body?.signedHtml);

    if (!contractHtml) {
      return NextResponse.json({ ok: false, message: 'HTML assinado é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { contract, precontract } = await resolveSigningContext({ supabase, token });

    if (!precontract?.id) {
      return NextResponse.json({ ok: false, message: 'Contrato não encontrado para assinatura.' }, { status: 404 });
    }

    if (!contract?.id || !contract?.precontract_id) {
      throw new Error('Contexto inválido: contract.id/precontract_id ausentes após resolução do token.');
    }

    if (contract.signed_at && contract.document_hash) {
      return NextResponse.json({
        ok: true,
        alreadySigned: true,
        contractId: contract.id,
        precontractId: contract.precontract_id,
        signedAt: contract.signed_at,
        documentHash: contract.document_hash,
        verificationToken: contract.verification_token || null,
        pdfUrl: contract.pdf_url || null,
      });
    }

    const verificationToken = asString(contract.verification_token) || generateVerificationToken();

    const signedDocument = await buildSignedContractHtml({
      contractHtml,
      signerName,
      signerCpf,
      signedAt,
      signerIp,
      userAgent,
      origin,
      contractId: contract.id,
      verificationToken,
    });

    const signatureMetadata = {
      origin,
      signer_name: signerName,
      signer_cpf: signerCpf,
      signer_cpf_masked: maskCpf(signerCpf),
      signer_ip: signerIp,
      user_agent: userAgent,
      signed_at_br: signedDocument.signedAtBr,
      signed_at_utc: signedDocument.signedAtIso,
      document_hash: signedDocument.documentHash,
      verification_token: verificationToken,
      verify_url: signedDocument.verifyUrl,
      contract_id: contract.id,
      signature_provider: 'Harmonics Internal Signature',
    };

    const { missingColumns } = await updateContractWithFallbacks({
      supabase,
      contractId: contract.id,
      patchPayload: {
        status: 'signed',
        precontract_id: contract.precontract_id,
        public_token: token,
        signed_html: signedDocument.signedHtml,
        document_hash: signedDocument.documentHash,
        signed_at: signedDocument.signedAtIso,
        signer_ip: signerIp,
        user_agent: userAgent,
        verification_token: verificationToken,
        signature_metadata: signatureMetadata,
        signature_name: signerName,
        raw_payload: {
          ...(contract.raw_payload || {}),
          signed_contract_html: signedDocument.signedHtml,
          contract_html_snapshot: signedDocument.immutableHtml,
          signature_metadata: signatureMetadata,
        },
      },
    });

    const pdfPayload = {
      contractId: contract.id,
      precontractId: contract.precontract_id,
      html: signedDocument.signedHtml,
    };

    console.info('[CONTRACT_PUBLIC_SIGN][PDF_REQUEST_PAYLOAD]', pdfPayload);

    const pdfRes = await fetch(new URL('/api/contracts/internal/pdf', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pdfPayload),
      cache: 'no-store',
    });

    const pdfJson = await pdfRes.json().catch(() => null);
    const pdfUrl = asString(pdfJson?.pdfUrl || contract.pdf_url);

    if (pdfUrl) {
      await supabase.from('contracts').update({ pdf_url: pdfUrl }).eq('id', contract.id);
    }

    return NextResponse.json({
      ok: true,
      alreadySigned: false,
      contractId: contract.id,
      precontractId: contract.precontract_id,
      signedAt: signedDocument.signedAtIso,
      documentHash: signedDocument.documentHash,
      verificationToken,
      verifyUrl: signedDocument.verifyUrl,
      pdfUrl: pdfUrl || null,
      pdfPending: !pdfUrl,
      missingColumns,
      message: pdfUrl
        ? 'Contrato assinado e PDF final gerado com sucesso.'
        : 'Contrato assinado. O PDF ainda está sendo preparado.',
    });
  } catch (error) {
    console.error('[CONTRACT_PUBLIC_SIGN] erro ao assinar contrato interno', error);
    return NextResponse.json(
      {
        ok: false,
        message: 'Contrato assinado. O PDF ainda está sendo preparado.',
        technicalMessage: error?.message || 'Erro interno ao assinar contrato.',
      },
      { status: 500 }
    );
  }
}
