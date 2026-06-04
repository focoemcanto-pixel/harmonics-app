import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildContractTemplateData } from '../../../../../lib/contracts/buildContractTemplateData';
import { renderContractHtmlWithData, resolveContractHtmlSource } from '../../../../../lib/contracts/resolveContractHtmlSource';

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error('Supabase admin não configurado.');
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}

function safeJson(value) {
  return JSON.stringify(value ?? null).replace(/</g, '\\u003c');
}

function buildLivePreviewHtml({ token, sourceHtml, initialHtml, initialTemplateData }) {
  return `
<div id="contract-live-preview-root">${initialHtml || ''}</div>
<script>
(function () {
  const token = ${safeJson(token)};
  const sourceHtml = ${safeJson(sourceHtml || '')};
  const baseData = ${safeJson(initialTemplateData || {})};
  const root = document.getElementById('contract-live-preview-root');
  let lastSignature = '';

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function onlyDigits(value) {
    return clean(value).replace(/\\D/g, '');
  }

  function escapeHtml(value) {
    return clean(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeTime(value) {
    const raw = clean(value);
    const match = raw.match(/^(\\d{2}:\\d{2})/);
    return match ? match[1] : raw;
  }

  function buildAddress(form) {
    return [
      clean(form.address_street),
      clean(form.address_number) ? 'nº ' + clean(form.address_number) : '',
      clean(form.address_complement),
      clean(form.address_neighborhood),
      clean(form.address_cep) ? 'CEP ' + clean(form.address_cep) : '',
      clean(form.address_city),
      clean(form.address_state),
    ].filter(Boolean).join(', ');
  }

  function buildEventLocation(form) {
    return [clean(form.event_location_name), clean(form.event_location_address)]
      .filter(Boolean)
      .join(' - ');
  }

  function formToTemplateData(form) {
    const address = buildAddress(form || {});
    const eventLocation = buildEventLocation(form || {});
    const eventTime = normalizeTime(form && form.event_time);
    const signerCpf = onlyDigits(form && form.signer_cpf);
    const cpf = onlyDigits(form && form.cpf);

    return {
      client_name: clean(form && form.full_name),
      client_marital_status: clean(form && form.marital_status),
      client_profession: clean(form && form.profession),
      client_cpf: cpf,
      client_rg: clean(form && form.rg),
      client_address: address,
      event_date: clean(form && form.event_date),
      event_time: eventTime,
      event_location: eventLocation,
      event_location_name: clean(form && form.event_location_name),
      event_location_address: clean(form && form.event_location_address),
      client_signature: clean(form && form.signer_name),
      accepted_name: clean(form && form.signer_name),
      accepted_cpf: signerCpf,
      NOME: clean(form && form.full_name),
      ESTADO_CIVIL: clean(form && form.marital_status),
      PROFISSAO: clean(form && form.profession),
      CPF: cpf,
      RG: clean(form && form.rg),
      ENDERECO: address,
      DATA_EVENTO: clean(form && form.event_date),
      HORA_EVENTO: eventTime,
      LOCAL_EVENTO: eventLocation,
      NOME_LOCAL_EVENTO: clean(form && form.event_location_name),
      ENDERECO_EVENTO: clean(form && form.event_location_address),
      ASSINATURA: clean(form && form.signer_name),
      ACEITE_NOME: clean(form && form.signer_name),
      ACEITE_CPF: signerCpf,
    };
  }

  const aliases = {
    client_name: ['NOME', 'CLIENTE_NOME', 'nome', 'cliente_nome', 'contratante_nome', 'NOME_CONTRATANTE'],
    client_marital_status: ['ESTADO_CIVIL', 'estado_civil', 'contratante_estado_civil', 'CLIENTE_ESTADO_CIVIL'],
    client_profession: ['PROFISSAO', 'profissao', 'profissão', 'contratante_profissao', 'CLIENTE_PROFISSAO', 'PROFISSÃO'],
    client_cpf: ['CPF', 'cpf', 'contratante_cpf', 'CLIENTE_CPF', 'CPF_CONTRATANTE'],
    client_rg: ['RG', 'rg', 'contratante_rg', 'CLIENTE_RG', 'RG_CONTRATANTE'],
    client_address: ['ENDERECO', 'endereco', 'endereço', 'contratante_endereco', 'CLIENTE_ENDERECO', 'ENDEREÇO', 'ENDERECO_CONTRATANTE'],
    event_date: ['DATA_EVENTO', 'data_evento'],
    event_time: ['HORA_EVENTO', 'hora_evento'],
    event_location: ['LOCAL_EVENTO', 'local_evento'],
    event_location_name: ['NOME_LOCAL_EVENTO', 'LOCAL_NOME', 'nome_local_evento', 'local_nome'],
    event_location_address: ['ENDERECO_EVENTO', 'LOCAL_ENDERECO', 'endereco_evento', 'local_endereco'],
    client_signature: ['ASSINATURA', 'assinatura'],
    accepted_name: ['ACEITE_NOME', 'aceite_nome'],
    accepted_cpf: ['ACEITE_CPF', 'aceite_cpf'],
  };

  const essential = new Set([
    'client_name', 'nome', 'cliente_nome', 'contratante_nome',
    'client_cpf', 'cpf', 'contratante_cpf',
    'client_rg', 'rg', 'contratante_rg',
    'client_address', 'endereco', 'contratante_endereco',
    'client_signature', 'accepted_name', 'accepted_cpf',
  ]);

  function getValue(data, key) {
    if (!data || !key) return '';
    if (Object.prototype.hasOwnProperty.call(data, key) && clean(data[key])) return clean(data[key]);

    const normalized = clean(key).toLowerCase();
    const aliasEntry = Object.entries(aliases).find(function ([canonical, list]) {
      return canonical === normalized || list.includes(key) || list.includes(normalized);
    });
    const canonical = aliasEntry && aliasEntry[0] ? aliasEntry[0] : normalized;
    const list = aliases[canonical] || [];
    const candidates = [key, normalized, canonical, canonical.toUpperCase()].concat(list);

    for (const candidate of candidates) {
      if (Object.prototype.hasOwnProperty.call(data, candidate) && clean(data[candidate])) {
        return clean(data[candidate]);
      }
    }

    return essential.has(canonical) ? '__________' : '';
  }

  function renderTemplate(template, data) {
    let rendered = String(template || '');
    rendered = rendered.replace(/\{\{#([A-Za-z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, function (_full, key, inner) {
      const value = getValue(data, key);
      return value && value !== '__________' ? inner : '';
    });
    rendered = rendered.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, function (_full, key) {
      return escapeHtml(getValue(data, key));
    });
    return rendered;
  }

  async function refreshFromDraft() {
    if (!root || !token || !sourceHtml) return;

    try {
      const response = await fetch('/api/public/contracts/' + encodeURIComponent(token) + '/draft', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await response.json().catch(function () { return null; });
      const form = payload && payload.initial_form ? payload.initial_form : {};
      const liveData = Object.assign({}, baseData || {}, formToTemplateData(form));
      const signature = JSON.stringify(liveData);
      if (signature === lastSignature) return;
      lastSignature = signature;
      root.innerHTML = renderTemplate(sourceHtml, liveData);
    } catch (error) {
      console.warn('[CONTRACT_LIVE_PREVIEW] atualização ignorada', error);
    }
  }

  refreshFromDraft();
  setTimeout(refreshFromDraft, 350);
  setTimeout(refreshFromDraft, 900);
  setInterval(refreshFromDraft, 2000);
})();
</script>`;
}

export async function GET(_request, context) {
  try {
    const { token: rawToken } = await context.params;
    const token = String(rawToken || '').trim();

    if (!token) {
      return new NextResponse('Token inválido.', { status: 400 });
    }

    const supabase = getAdminSupabase();

    let precontract = null;
    let contract = null;

    const { data: preByToken, error: preError } = await supabase
      .from('precontracts')
      .select('*')
      .eq('public_token', token)
      .maybeSingle();

    if (preError) throw preError;

    if (preByToken) {
      precontract = preByToken;
    } else {
      const { data: contractByToken, error: contractByTokenError } = await supabase
        .from('contracts')
        .select('*')
        .eq('public_token', token)
        .maybeSingle();

      if (contractByTokenError) throw contractByTokenError;

      if (contractByToken?.precontract_id) {
        const { data: preById, error: preByIdError } = await supabase
          .from('precontracts')
          .select('*')
          .eq('id', contractByToken.precontract_id)
          .maybeSingle();

        if (preByIdError) throw preByIdError;
        precontract = preById || null;
        contract = contractByToken || null;
      }
    }

    if (!precontract) {
      return new NextResponse('Pré-contrato não encontrado.', { status: 404 });
    }

    if (!contract) {
      const { data: contractByPre, error: contractError } = await supabase
        .from('contracts')
        .select('*')
        .eq('precontract_id', precontract.id)
        .maybeSingle();

      if (contractError) throw contractError;
      contract = contractByPre || null;
    }

    if (!precontract.public_token && token) {
      await supabase
        .from('precontracts')
        .update({ public_token: token })
        .eq('id', precontract.id);
    }

    let contact = null;
    let event = null;

    const contactId = contract?.contact_id || precontract?.contact_id || null;
    const eventId = contract?.event_id || precontract?.event_id || null;

    if (contactId) {
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .maybeSingle();
      contact = data || null;
    }

    if (eventId) {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();
      event = data || null;
    }

    const templateData = buildContractTemplateData({
      contract,
      precontract,
      contact,
      event,
    });

    let sourceHtml = resolveContractHtmlSource(precontract || {}).html;

    if (!String(sourceHtml || '').trim() && precontract?.contract_template_id) {
      const { data: templateDataRow } = await supabase
        .from('contract_templates')
        .select('content')
        .eq('id', precontract.contract_template_id)
        .maybeSingle();
      sourceHtml = resolveContractHtmlSource(templateDataRow || {}).html;
    }

    const initialHtml = renderContractHtmlWithData(sourceHtml, templateData).trim();

    if (!initialHtml) {
      return new NextResponse('Template de contrato não encontrado para este pré-contrato.', {
        status: 404,
      });
    }

    const html = buildLivePreviewHtml({
      token,
      sourceHtml,
      initialHtml,
      initialTemplateData: templateData,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return new NextResponse(
      error?.message || 'Erro ao gerar preview HTML.',
      { status: 500 }
    );
  }
}
