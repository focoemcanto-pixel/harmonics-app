const DEFAULT_MODEL = 'gpt-4.1-mini';

function parseJsonSafe(raw = '{}') {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function extractAiText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();

  const content = payload?.output?.[0]?.content;
  if (Array.isArray(content)) {
    const textItem = content.find((item) => typeof item?.text === 'string' && item.text.trim());
    if (textItem?.text) return textItem.text.trim();
  }

  return '{}';
}

function buildPrompt({ text, missingFields }) {
  return `Extraia dados APENAS da cláusula/objeto do evento no contrato abaixo e retorne SOMENTE JSON válido no formato solicitado.\n\nFormato obrigatório:\n{\n  "client_name": "",\n  "event_type": "",\n  "event_date": "YYYY-MM-DD",\n  "event_time": "HH:mm",\n  "location_name": "",\n  "location_address": "",\n  "formation": "",\n  "instruments": "",\n  "reception_hours": 0,\n  "has_sound": false,\n  "agreed_amount": 0,\n  "observations": ""\n}\n\nRegras:\n- Extrair dados apenas do objeto/cláusula do evento\n- Ignorar endereço do CONTRATANTE\n- Ignorar endereço do CONTRATADO\n- Se não tiver certeza, deixar vazio\n- Retornar somente JSON válido\n\nCampos faltantes prioritários: ${missingFields.join(', ') || 'nenhum'}\n\nContrato:\n${text}`;
}

export async function extractContractDataWithAi({ text, missingFields = [] }) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return { aiUsed: false, aiData: {}, model: null };

  const model = String(process.env.OPENAI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: buildPrompt({ text, missingFields }),
      text: { format: { type: 'json_object' } },
    }),
  });

  if (!response.ok) {
    throw new Error('Falha na IA');
  }

  const payload = await response.json();
  const aiData = parseJsonSafe(extractAiText(payload));

  return {
    aiUsed: true,
    aiData,
    model,
  };
}
