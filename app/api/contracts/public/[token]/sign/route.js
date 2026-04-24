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

export async function POST(request, { params }) {
  const token = extractToken(params);
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
    const contractHtml = asString(body?.html);

    if (!contractHtml) {
      return NextResponse.json({ ok: false, message: 'HTML assinado é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (contractError) throw contractError;

    if (!contract?.id) {
      return NextResponse.json({ ok: false, message: 'Contrato não encontrado para assinatura.' }, { status: 404 });
    }

    if (contract.signed_at && contract.document_hash) {
      return NextResponse.json({
        ok: true,
        alreadySigned: true,
        contractId: contract.id,
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

    const pdfRes = await fetch(new URL('/api/contracts/internal/pdf', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractId: contract.id,
        precontractId: contract.precontract_id,
        html: signedDocument.signedHtml,
      }),
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
      precontractId: contract.precontract_id || null,
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
        message: 'Contrato assinado. Não foi possível preparar o PDF agora.',
        technicalMessage: error?.message || 'Erro interno ao assinar contrato.',
      },
      { status: 500 }
    );
  }
}
