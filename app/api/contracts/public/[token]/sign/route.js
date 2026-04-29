import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildSignedContractHtml, extractSignerIp } from '@/lib/contracts/premiumSignature';
import { generateAndSaveInternalContractPdf } from '@/lib/contracts/internalPdfFlow';
import { requireRequiredEnv } from '@/lib/config/validate-env';
import { logError, logInfo, logWarn, maskToken } from '@/lib/observability/server-log';
import { getRequestIp, getUserAgent } from '@/lib/api/request-meta';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { writeAuditLog } from '@/lib/audit/audit-log';

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

async function runPdfFlow({ supabase, contractId, precontractId, signedHtml }) {
  logInfo('CONTRACT_PUBLIC_SIGN', 'SERVICE_CALL_START', { contractId, precontractId });
  const pdfData = await generateAndSaveInternalContractPdf({
    supabase,
    contractId,
    precontractId,
    html: signedHtml,
  });

  logInfo('CONTRACT_PUBLIC_SIGN', 'SERVICE_CALL_OK', {
    contractId,
    precontractId,
    hasPdfUrl: Boolean(pdfData?.pdfUrl),
  });
  if (!pdfData?.pdfUrl) {
    const error = new Error('Fluxo interno retornou sem pdfUrl.');
    error.code = 'STORAGE_ERROR';
    error.stage = 'STORAGE_ERROR';
    throw error;
  }
  return pdfData.pdfUrl;
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
  logInfo('CONTRACT_PUBLIC_SIGN', 'TOKEN_RESOLVE_START', { token: maskToken(token) });

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

  logInfo('CONTRACT_PUBLIC_SIGN', 'CONTEXT_RESOLVED', { foundContract, foundPrecontract, createdContract });

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
  const requestIp = getRequestIp(request);
  const requestUserAgent = getUserAgent(request);
  let signedContractContext = null;

  logInfo('CONTRACT_PUBLIC_SIGN', 'START', {
    hasToken: Boolean(token),
    token: maskToken(token),
  });
  if (!token) {
    return NextResponse.json({ ok: false, message: 'Token inválido.' }, { status: 400 });
  }

  const rateLimitResult = checkRateLimit({
    key: `contract-sign:${requestIp || 'ip-na'}:${maskToken(token) || 'token-na'}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimitResult.ok) {
    return NextResponse.json(
      { ok: false, error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimitResult.retryAfterSeconds || 60) },
      }
    );
  }

  const publicToken = token;

  try {
    requireRequiredEnv('contracts/public-sign');

    const body = await request.json().catch(() => null);
    const signedAt = new Date().toISOString();
    const signerIp = extractSignerIp(request.headers);
    const userAgent = asString(request.headers.get('user-agent')) || requestUserAgent || 'Não disponível';
    const signerName = asString(body?.signerName) || 'Não informado';
    const signerCpf = asString(body?.signerCpf) || 'Não informado';
    const origin = resolveSignatureOrigin(body?.origin);
    const contractHtml = asString(body?.html || body?.signedHtml);

    if (!contractHtml) {
      return NextResponse.json({ ok: false, message: 'HTML assinado é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let { contract, precontract } = await resolveSigningContext({ supabase, token });
    signedContractContext = { contract, precontract };

    if (!precontract?.id) {
      return NextResponse.json({ ok: false, message: 'Contrato não encontrado para assinatura.' }, { status: 404 });
    }

    if (!contract?.id || !contract?.precontract_id) {
      throw new Error('Contexto inválido: contract.id/precontract_id ausentes após resolução do token.');
    }

    if (contract.signed_at && contract.document_hash) {
      if (!asString(contract.validation_token || contract.verification_token)) {
        const recoveredValidationToken = publicToken;
        await updateContractWithFallbacks({
          supabase,
          contractId: contract.id,
          patchPayload: { validation_token: recoveredValidationToken, verification_token: recoveredValidationToken },
        });
        contract = { ...contract, validation_token: recoveredValidationToken, verification_token: recoveredValidationToken };
      }

      if (contract.pdf_url) {
        await writeAuditLog({
          supabase,
          action: 'contract.sign',
          entityType: 'contract',
          entityId: contract.id,
          status: 'success',
          ip: signerIp || requestIp,
          userAgent,
          metadata: {
            alreadySigned: true,
            pdfAvailable: true,
            token: maskToken(publicToken),
          },
        });
        return NextResponse.json({
          ok: true,
          alreadySigned: true,
          contractId: contract.id,
          precontractId: contract.precontract_id,
          signedAt: contract.signed_at,
          documentHash: contract.document_hash,
          validationToken: contract.validation_token || contract.verification_token || null,
          verificationToken: contract.validation_token || contract.verification_token || null,
          pdfUrl: contract.pdf_url || null,
        });
      }

      const signedHtml = asString(
        contract.signed_html
        || contract.raw_payload?.signed_contract_html
        || contract.raw_payload?.contract_html_snapshot
      );

      logInfo('CONTRACT_PUBLIC_SIGN', 'CONTEXT_RESOLVED', {
        contractId: contract.id,
        precontractId: contract.precontract_id,
        hasSignedHtml: Boolean(signedHtml),
      });

      if (!signedHtml) {
        logError('CONTRACT_PUBLIC_SIGN', 'ERROR', new Error('MISSING_SIGNED_HTML_FOR_PDF_RECOVERY'), {
          contractId: contract.id,
          precontractId: contract.precontract_id,
        });

        return NextResponse.json({
          ok: true,
          alreadySigned: true,
          pdfPending: true,
          contractId: contract.id,
          precontractId: contract.precontract_id,
          signedAt: contract.signed_at,
          documentHash: contract.document_hash,
          validationToken: contract.validation_token || contract.verification_token || null,
          verificationToken: contract.validation_token || contract.verification_token || null,
          pdfUrl: null,
          message: 'Contrato assinado. O PDF ainda está sendo preparado.',
        });
      }

      let recoveredPdfUrl = null;
      try {
        recoveredPdfUrl = await runPdfFlow({
          supabase,
          contractId: contract.id,
          precontractId: contract.precontract_id,
          signedHtml,
        });
        logInfo('CONTRACT_PUBLIC_SIGN', 'SERVICE_CALL_OK', {
          contractId: contract.id,
          precontractId: contract.precontract_id,
          hasPdfUrl: Boolean(recoveredPdfUrl),
          mode: 'already-signed-recovery',
        });
      } catch (error) {
        logError('CONTRACT_PUBLIC_SIGN', 'ERROR', error, {
          contractId: contract.id,
          precontractId: contract.precontract_id,
          stage: error?.stage || error?.code || 'UNKNOWN',
          code: error?.code || null,
          status: error?.status || null,
          message: error?.message || String(error),
        });

        return NextResponse.json(
          {
            ok: false,
            message: error?.message || 'Falha ao gerar PDF interno.',
            code: error?.code || 'INTERNAL_PDF_ERROR',
            stage: error?.stage || error?.code || null,
            status: error?.status || 502,
          },
          { status: error?.status || 502 }
        );
      }

      if (recoveredPdfUrl) {
        try {
          await updateContractWithFallbacks({
            supabase,
            contractId: contract.id,
            patchPayload: { pdf_url: recoveredPdfUrl },
          });
        } catch (error) {
          logWarn('CONTRACT_PUBLIC_SIGN', 'FINAL_UPDATE_FAILED_NON_BLOCKING', {
            contractId: contract.id,
            precontractId: contract.precontract_id,
            mode: 'already-signed-recovery',
            error: error?.message || String(error),
          });
        }

        await writeAuditLog({
          supabase,
          action: 'contract.pdf.generate_final',
          entityType: 'contract',
          entityId: contract.id,
          status: 'success',
          ip: signerIp || requestIp,
          userAgent,
          metadata: {
            mode: 'already-signed-recovery',
            token: maskToken(publicToken),
          },
        });
        return NextResponse.json({
          ok: true,
          alreadySigned: true,
          pdfRecovered: true,
          contractId: contract.id,
          precontractId: contract.precontract_id,
          signedAt: contract.signed_at,
          documentHash: contract.document_hash,
          validationToken: contract.validation_token || contract.verification_token || null,
          verificationToken: contract.validation_token || contract.verification_token || null,
          pdfUrl: recoveredPdfUrl,
        });
      }

      return NextResponse.json({
        ok: true,
        alreadySigned: true,
        pdfPending: true,
        contractId: contract.id,
        precontractId: contract.precontract_id,
        signedAt: contract.signed_at,
        documentHash: contract.document_hash,
        validationToken: contract.validation_token || contract.verification_token || null,
        verificationToken: contract.validation_token || contract.verification_token || null,
        pdfUrl: null,
        message: 'Contrato assinado. O PDF ainda está sendo preparado.',
      });
    }

    const validationToken = publicToken;

    const signedDocument = await buildSignedContractHtml({
      contractHtml,
      signerName,
      signerCpf,
      signedAt,
      signerIp,
      userAgent,
      origin,
      contractId: contract.id,
      validationToken,
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
      validation_token: validationToken,
      verification_token: validationToken,
      verify_url: signedDocument.verifyUrl,
      contract_id: contract.id,
      signature_provider: 'Harmonics Internal Signature',
    };

    if (!asString(contract.public_token)) {
      logError('CONTRACT_PUBLIC_SIGN', 'ERROR', new Error('contract sem public_token'), { contractId: contract.id });
    }

    const { missingColumns } = await updateContractWithFallbacks({
      supabase,
      contractId: contract.id,
      patchPayload: {
        status: 'signed',
        precontract_id: contract.precontract_id,
        public_token: publicToken,
        signed_html: signedDocument.signedHtml,
        document_hash: signedDocument.documentHash,
        signed_at: signedDocument.signedAtIso,
        signer_ip: signerIp,
        user_agent: userAgent,
        validation_token: validationToken,
        verification_token: validationToken,
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
    signedContractContext = {
      contract: {
        ...contract,
        signed_html: signedDocument.signedHtml,
        document_hash: signedDocument.documentHash,
        signed_at: signedDocument.signedAtIso,
      },
      precontract,
    };

    let pdfUrl = asString(contract.pdf_url);

    try {
      pdfUrl = await runPdfFlow({
        supabase,
        contractId: contract.id,
        precontractId: contract.precontract_id,
        signedHtml: signedDocument.signedHtml,
      });
      logInfo('CONTRACT_PUBLIC_SIGN', 'SERVICE_CALL_OK', {
        contractId: contract.id,
        precontractId: contract.precontract_id,
        hasPdfUrl: Boolean(pdfUrl),
        mode: 'fresh-sign',
      });
    } catch (error) {
      logError('CONTRACT_PUBLIC_SIGN', 'ERROR', error, {
        contractId: contract.id,
        precontractId: contract.precontract_id,
        stage: error?.stage || error?.code || 'UNKNOWN',
        code: error?.code || null,
        status: error?.status || null,
        message: error?.message || String(error),
      });

      return NextResponse.json(
        {
          ok: false,
          message: error?.message || 'Falha ao gerar PDF interno.',
          code: error?.code || 'INTERNAL_PDF_ERROR',
          stage: error?.stage || error?.code || null,
          status: error?.status || 502,
        },
        { status: error?.status || 502 }
      );
    }

    await writeAuditLog({
      supabase,
      action: 'contract.sign',
      entityType: 'contract',
      entityId: contract.id,
      status: 'success',
      ip: signerIp || requestIp,
      userAgent,
      metadata: {
        precontractId: contract.precontract_id,
        token: maskToken(publicToken),
        signerName: signerName ? '[provided]' : '[missing]',
        signerCpfMasked: maskCpf(signerCpf),
      },
    });

    if (pdfUrl) {
      await writeAuditLog({
        supabase,
        action: 'contract.pdf.generate_final',
        entityType: 'contract',
        entityId: contract.id,
        status: 'success',
        ip: signerIp || requestIp,
        userAgent,
        metadata: {
          mode: 'fresh-sign',
          token: maskToken(publicToken),
        },
      });
    }

    const finalSignedAt = signedDocument.signedAtIso || new Date().toISOString();
    const finalPatch = {
      public_token: publicToken,
      validation_token: publicToken,
      verification_token: publicToken,
      pdf_url: pdfUrl || null,
      signed_at: finalSignedAt,
      document_hash: signedDocument.documentHash,
    };

    let finalMissingColumns = [];
    try {
      const finalResult = await updateContractWithFallbacks({
        supabase,
        contractId: contract.id,
        patchPayload: finalPatch,
      });
      finalMissingColumns = finalResult?.missingColumns || [];
    } catch (error) {
      logWarn('CONTRACT_PUBLIC_SIGN', 'FINAL_UPDATE_FAILED_NON_BLOCKING', {
        contractId: contract.id,
        precontractId: contract.precontract_id,
        mode: 'fresh-sign',
        hasPdfUrl: Boolean(pdfUrl),
        error: error?.message || String(error),
      });
    }

    logInfo('CONTRACT_PUBLIC_SIGN', 'DB_UPDATE_OK', {
      contractId: contract.id,
      finalMissingColumns,
      hasPdfUrl: Boolean(pdfUrl),
    });

    return NextResponse.json({
      ok: true,
      alreadySigned: false,
      contractId: contract.id,
      precontractId: contract.precontract_id,
      signedAt: signedDocument.signedAtIso,
      documentHash: signedDocument.documentHash,
      validationToken,
      verificationToken: validationToken,
      verifyUrl: signedDocument.verifyUrl,
      pdfUrl: pdfUrl || null,
      pdfPending: !pdfUrl,
      missingColumns,
      finalMissingColumns,
      message: pdfUrl
        ? 'Contrato assinado e PDF final gerado com sucesso.'
        : 'Contrato assinado. O PDF ainda está sendo preparado.',
    });
  } catch (error) {
    try {
      const supabase = getSupabaseAdmin();
      await writeAuditLog({
        supabase,
        action: 'contract.sign',
        entityType: 'contract',
        entityId: signedContractContext?.contract?.id || null,
        status: 'failed',
        ip: requestIp,
        userAgent: requestUserAgent,
        metadata: {
          token: maskToken(publicToken),
          error: error?.message || 'Contrato assinado. O PDF ainda está sendo preparado.',
        },
      });
    } catch {
      // no-op: auditoria é best effort
    }
    logError('CONTRACT_PUBLIC_SIGN', 'ERROR', error, {
      contractId: signedContractContext?.contract?.id || null,
      precontractId: signedContractContext?.precontract?.id || signedContractContext?.contract?.precontract_id || null,
    });

    const fallbackContractId = signedContractContext?.contract?.id || null;
    const fallbackPrecontractId = signedContractContext?.precontract?.id || signedContractContext?.contract?.precontract_id || null;
    const alreadyHasSignature =
      Boolean(signedContractContext?.contract?.document_hash)
      && Boolean(signedContractContext?.contract?.signed_at || signedContractContext?.contract?.signed_html);

    if (fallbackContractId && alreadyHasSignature) {
      return NextResponse.json(
        {
          ok: true,
          pdfPending: true,
          contractId: fallbackContractId,
          precontractId: fallbackPrecontractId,
          message: 'Contrato assinado. O PDF ainda está sendo preparado.',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Contrato assinado. O PDF ainda está sendo preparado.',
      },
      { status: 500 }
    );
  }
}
