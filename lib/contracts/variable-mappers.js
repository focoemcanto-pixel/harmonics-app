/**
 * Mapeadores de variáveis padrão
 * Define como extrair valores de sourceData para cada variável
 */

function formatDateBR(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(value) {
  if (!value) return 'R$ 0,00';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
}

export const STANDARD_VARIABLE_MAPPERS = {
  client_name: {
    extract: (data) => data?.client_name || data?.name || '',
    format: (val) => val.trim(),
  },
  client_cpf: {
    extract: (data) => data?.client_cpf || data?.cpf || '',
    format: (val) => val,
  },
  client_rg: {
    extract: (data) => data?.client_rg || data?.rg || '',
    format: (val) => val,
  },
  client_address: {
    extract: (data) => {
      if (data?.address_street) {
        const parts = [
          data.address_street,
          data.address_number,
          data.address_complement,
          data.address_neighborhood,
          data.address_city,
          data.address_state,
          data.address_cep,
        ].filter(Boolean);
        return parts.join(', ');
      }
      return data?.client_address || '';
    },
    format: (val) => val.trim(),
  },
  event_date: {
    extract: (data) => data?.event_date || '',
    format: (val) => formatDateBR(val),
  },
  event_time: {
    extract: (data) => data?.event_time || '',
    format: (val) => val,
  },
  location_name: {
    extract: (data) => data?.event_location_name || data?.location_name || '',
    format: (val) => val.trim(),
  },
  location_address: {
    extract: (data) => data?.event_location_address || data?.location_address || '',
    format: (val) => val.trim(),
  },
  agreed_amount: {
    extract: (data) => data?.agreed_amount || data?.valor_total || 0,
    format: (val) => formatCurrency(val),
  },
  formation: {
    extract: (data) => data?.formation || data?.formacao || '',
    format: (val) => val.trim(),
  },
  event_type: {
    extract: (data) => data?.event_type || data?.tipo_evento || '',
    format: (val) => val.trim(),
  },
  event_duration: {
    extract: (data) => data?.event_duration || data?.duracao || '',
    format: (val) => val,
  },
  payment_terms: {
    extract: (data) => data?.payment_terms || data?.condicoes_pagamento || '',
    format: (val) => val.trim(),
  },
  signer_name: {
    extract: (data) => data?.signer_name || data?.nome_assinante || '',
    format: (val) => val.trim(),
  },
  signer_cpf: {
    extract: (data) => data?.signer_cpf || data?.cpf_assinante || '',
    format: (val) => val,
  },
  today_date: {
    extract: () => new Date().toISOString(),
    format: (val) => formatDateBR(val),
  },
};

export function resolveStandardVariable(variableKey, sourceData, fallback = '') {
  const mapper = STANDARD_VARIABLE_MAPPERS[variableKey];
  if (!mapper) {
    console.warn(`[Contract Builder] No mapper found for variable: ${variableKey}`);
    return fallback;
  }
  try {
    const extracted = mapper.extract(sourceData);
    const formatted = mapper.format(extracted);
    return formatted || fallback;
  } catch (error) {
    console.error(`[Contract Builder] Error resolving variable ${variableKey}:`, error);
    return fallback;
  }
}
