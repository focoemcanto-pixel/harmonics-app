import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'app/api/cliente/repertorio/route.js');
const source = fs.readFileSync(filePath, 'utf8');

const before = `    } else {
      const clientToken = clientTokenInput || token;
      const { data: precontract, error: precontractError } = await supabase
        .from('precontracts')
        .select('id, public_token, event_id')
        .eq('public_token', clientToken)
        .maybeSingle();

      if (precontractError) throw precontractError;

      if (!precontract?.event_id) {
        return NextResponse.json(
          { ok: false, error: 'Token de repertório inválido.' },
          { status: 404 }
        );
      }

      eventId = precontract.event_id;
      tokenResolution = 'client_token';
      const ensured = await ensureOpenRepertoireToken(supabase, eventId);
      tokenRow = ensured.tokenRow;
      createdToken = ensured.created;
    }`;

const after = `    } else {
      const clientToken = clientTokenInput || token;
      const { data: precontract, error: precontractError } = await supabase
        .from('precontracts')
        .select('id, public_token, event_id')
        .eq('public_token', clientToken)
        .maybeSingle();

      if (precontractError) throw precontractError;

      if (precontract?.event_id) {
        eventId = precontract.event_id;
        tokenResolution = 'precontract_client_token';
      } else {
        const { data: contract, error: contractError } = await supabase
          .from('contracts')
          .select('id, public_token, event_id')
          .eq('public_token', clientToken)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (contractError) throw contractError;

        if (!contract?.event_id) {
          return NextResponse.json(
            { ok: false, error: 'Token de repertório inválido.' },
            { status: 404 }
          );
        }

        eventId = contract.event_id;
        tokenResolution = 'contract_client_token';
      }

      const ensured = await ensureOpenRepertoireToken(supabase, eventId);
      tokenRow = ensured.tokenRow;
      createdToken = ensured.created;
    }`;

if (source.includes(after)) {
  console.log('[repertoire token patch] Fallback de contrato já aplicado.');
  process.exit(0);
}

if (!source.includes(before)) {
  console.error('[repertoire token patch] Bloco esperado não encontrado; abortando para evitar alteração insegura.');
  process.exit(1);
}

fs.writeFileSync(filePath, source.replace(before, after));
console.log('[repertoire token patch] Fallback de contracts.public_token aplicado com sucesso.');
