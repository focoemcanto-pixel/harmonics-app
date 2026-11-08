/** Validação dos campos editáveis de configuração da IA/canal (pura). */
const MODES = ['observe', 'draft', 'auto'];
const CHANNEL_STATUS = ['draft', 'active', 'paused'];

function num(value, { min, max }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(Math.max(n, min), max);
}
function text(value, max) {
  if (value === null) return null;
  return typeof value === 'string' ? value.trim().slice(0, max) || null : undefined;
}

export function parseSettingsInput(body = {}) {
  const out = {};
  if (typeof body.ai_enabled === 'boolean') out.ai_enabled = body.ai_enabled;
  if (MODES.includes(body.mode)) out.mode = body.mode;
  const name = text(body.assistant_name, 60);
  if (name) out.assistant_name = name;
  for (const [key, max] of [['business_description', 1500], ['tone_notes', 600]]) {
    const v = text(body[key], max);
    if (v !== undefined) out[key] = v;
  }
  const limits = {
    daily_ai_reply_limit: { min: 0, max: 5000 },
    daily_cost_limit_usd: { min: 0, max: 100 },
    monthly_cost_limit_usd: { min: 0, max: 2000 },
    max_ai_turns_per_conversation: { min: 1, max: 200 },
    retention_days: { min: 30, max: 3650 },
  };
  for (const [key, range] of Object.entries(limits)) {
    const v = num(body[key], range);
    if (v !== undefined) out[key] = key.endsWith('_usd') ? Math.round(v * 10000) / 10000 : Math.round(v);
  }
  for (const key of ['autonomous_closing_enabled', 'followup_enabled', 'notify_admin_on_handoff']) {
    if (typeof body[key] === 'boolean') out[key] = body[key];
  }
  if (Array.isArray(body.followup_days)) {
    out.followup_days = body.followup_days.map((d) => Math.round(Number(d))).filter((d) => d >= 1 && d <= 60).slice(0, 5);
  }
  if (Array.isArray(body.followup_templates)) {
    out.followup_templates = body.followup_templates.map((t) => String(t || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '')).slice(0, 5);
  }
  if (typeof body.followup_template_language === 'string' && /^[a-z]{2}(_[A-Z]{2})?$/.test(body.followup_template_language)) {
    out.followup_template_language = body.followup_template_language;
  }
  const contact = text(body.handoff_contact_name, 60);
  if (contact !== undefined) out.handoff_contact_name = contact;
  if (Array.isArray(body.strategies_enabled)) {
    const allowed = ['discovery', 'empathy', 'calibrated_questions', 'price_objection', 'comparison_objection', 'stall_objection', 'closing', 'post_sale'];
    out.strategies_enabled = body.strategies_enabled.filter((k) => allowed.includes(k));
  }
  if (body.logistics_rules && typeof body.logistics_rules === 'object') {
    const r = body.logistics_rules;
    const rules = {};
    for (const key of ['free_radius_km', 'per_km_rate', 'toll_per_km', 'lodging_over_km', 'lodging_fee_per_musician']) {
      const v = num(r[key], { min: 0, max: 100000 });
      if (v !== undefined && r[key] !== '' && r[key] !== null) rules[key] = v;
    }
    const origin = text(r.origin, 160);
    if (origin) rules.origin = origin;
    out.logistics_rules = rules;
  }
  if (body.min_margin_pct === null || body.min_margin_pct === '') out.min_margin_pct = null;
  else { const m = num(body.min_margin_pct, { min: 0, max: 95 }); if (m !== undefined) out.min_margin_pct = m; }
  const buffer = num(body.schedule_buffer_minutes, { min: 0, max: 600 });
  if (buffer !== undefined) out.schedule_buffer_minutes = Math.round(buffer);
  return out;
}

export function parseChannelInput(body = {}) {
  const out = {};
  const phoneNumberId = typeof body.phone_number_id === 'string' ? body.phone_number_id.replace(/\D/g, '') : undefined;
  if (phoneNumberId) out.phone_number_id = phoneNumberId;
  const waba = typeof body.waba_id === 'string' ? body.waba_id.replace(/\D/g, '') : undefined;
  if (waba !== undefined) out.waba_id = waba || null;
  const display = text(body.display_phone, 30);
  if (display !== undefined) out.display_phone = display;
  if (CHANNEL_STATUS.includes(body.status)) out.status = body.status;
  if (typeof body.coexistence === 'boolean') out.coexistence = body.coexistence;
  const token = typeof body.access_token === 'string' ? body.access_token.trim() : '';
  return { fields: out, accessToken: token && token.length >= 20 ? token : null };
}
