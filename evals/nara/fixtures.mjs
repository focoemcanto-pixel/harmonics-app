// Fixtures 100% SINTÉTICAS para as avaliações da Nara (preços, nomes, links e datas inventados).
// Não copiar dados de produção para cá (AGENTS.md).
const R = (category, item_key, amount, valid_from = '2026-01-01', valid_until = null) => ({ category, item_key, label: item_key, amount, valid_from, valid_until });

export const SIM_TODAY = '2026-11-09';

export const fixtures = {
  companyName: 'Banda Exemplo',
  settings: {
    assistant_name: 'Nara', assistant_company: 'Banda Exemplo', handoff_contact_name: 'Responsável Teste',
    vocalist_rules: { duo_masculino: 'voz-m', duo_feminino: 'voz-f', reception_masculino: 'voz-m', reception_feminino: 'voz-f' },
    arrival_minutes: 120, schedule_buffer_minutes: 60,
  },
  rules: [
    ...[['duo', 1100], ['trio', 1600], ['quarteto', 2000], ['quinteto', 2300]].map(([k, v]) => R('ceremony', k, v)),
    R('sound', 'church', 750), R('sound', 'church_reception_1h', 850), R('sound', 'church_reception_2h', 950),
    ...[['duo', 450, 700], ['trio', 700, 1000], ['quarteto', 1000, 1300]].flatMap(([k, a, b]) => [R('reception', `${k}_1h`, a), R('reception', `${k}_2h`, b)]),
    R('musician_fee', 'sound_tech', 250), R('musician_fee', 'sound_tech_reception_1h', 350), R('musician_fee', 'sound_tech_reception_2h', 450),
    R('transport', 'standard_trip', 150),
    ...[['duo', 1300], ['trio', 1900], ['quarteto', 2300]].map(([k, v]) => R('ceremony', `${k}@metro`, v)),
  ],
  pricing: { price_solo: 650, price_duo: 1100, price_trio: 1600, price_quarteto: 2000, price_quinteto: 2300, price_sexteto: 2600, price_septeto: 3000, sound_price: 750 },
  areas: [
    { name: 'Cidade Base', match_terms: ['salvador', 'cidade base'], status: 'served' },
    { name: 'Cidade Vizinha', match_terms: ['lauro de freitas'], status: 'served' },
    { name: 'Litoral Distante', match_terms: ['praia do forte'], status: 'conditional', notes: 'Fora da região-base: logística confirmada pela equipe.' },
    { name: 'Cidade Metro', match_terms: ['cidade metro'], status: 'served', price_tier: 'metro' },
  ],
  eventTypes: [{ name: 'Casamento', default_contract_template_id: 'tpl-sim' }],
  knowledge: [
    { item_key: 'k-som', kind: 'rule', title: 'Som', content: 'O som pode ser da banda ou do espaço. Para receptivo acima de 2h a equipe confirma o valor do som.', intents: ['rider', 'pricing'], priority: 80 },
    { item_key: 'k-repertorio', kind: 'faq', title: 'Repertório', content: 'O repertório é montado junto com o casal a partir das músicas desejadas; a equipe confirma a viabilidade de cada pedido.', intents: ['repertoire'], priority: 60 },
    { item_key: 'k-formacao', kind: 'faq', title: 'Formações', content: 'Formações pequenas têm base harmônica (piano ou violão). Trio é um bom ponto de partida; Duo atende eventos intimistas.', intents: ['formation'], priority: 60 },
    { item_key: 'k-link-montagem', kind: 'response', title: 'Link oficial de montagem', content: 'Link oficial para montar a formação: https://exemplo.test/monte-sua-banda/', intents: ['pricing'], priority: 50 },
    // Pendente de aprovação: a Nara NÃO pode citar estas condições.
    { item_key: 'k-pagamento', kind: 'policy', title: 'Condições de pagamento', content: 'Sinal de 30% na assinatura e saldo em 3 parcelas no cartão ou Pix.', intents: ['payment'], priority: 90, status: 'pending_approval' },
  ],
  musicians: [
    { contact_id: 'voz-m', display_name: 'Voz Masculina A (sim)', roles: ['vocal'], voice: 'masculino', is_primary_vocal: true, client_presentable: true, presentation_urls: ['https://video.example.test/a'] },
    { contact_id: 'voz-f', display_name: 'Voz Feminina B (sim)', roles: ['vocal'], voice: 'feminino', client_presentable: true, presentation_urls: ['https://video.example.test/b'] },
    { contact_id: 'alt-m', display_name: 'Voz Masculina C (sim)', roles: ['vocal'], voice: 'masculino', client_presentable: true, presentation_urls: ['https://video.example.test/c'] },
    { contact_id: 'sem-link', display_name: 'Vocal Não Autorizado (sim)', roles: ['vocal'], voice: 'masculino', client_presentable: false, presentation_urls: [] },
  ],
  bookings: [{ id: 'ev-ocupado', event_date: '2027-04-17', event_time: '15:00', duration_min: 60, reception_hours: 0, status: 'confirmado', client_name: 'Evento existente (sim)', musicians: [{ contact_id: 'voz-m', role: 'Vocal Masculino', status: 'confirmed' }] }],
};
