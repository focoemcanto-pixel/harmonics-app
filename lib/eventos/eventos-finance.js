import { toNumber } from './eventos-format';

export function normalizeFormation(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return '';
  if (s.startsWith('solo')) return 'Solo';
  if (s.startsWith('duo')) return 'Duo';
  if (s.startsWith('trio')) return 'Trio';
  if (s.startsWith('quart')) return 'Quarteto';
  if (s.startsWith('quint')) return 'Quinteto';
  if (s.startsWith('sext')) return 'Sexteto';
  if (s.startsWith('sept')) return 'Septeto';
  return value;
}

export function getDefaultPricing() {
  return {
    price_solo: 600,
    price_duo: 1100,
    price_trio: 1600,
    price_quarteto: 1900,
    price_quinteto: 2200,
    price_sexteto: 2400,
    price_septeto: 0,

    sound_price: 600,

    reception_duo_1h: 500,
    reception_duo_2h: 800,
    reception_duo_3h: 1100,

    reception_trio_1h: 800,
    reception_trio_2h: 1100,
    reception_trio_3h: 1400,

    reception_quarteto_1h: 1100,
    reception_quarteto_2h: 1400,
    reception_quarteto_3h: 1700,

    reception_quinteto_1h: 1400,
    reception_quinteto_2h: 1700,
    reception_quinteto_3h: 2000,

    reception_sexteto_1h: 1700,
    reception_sexteto_2h: 2000,
    reception_sexteto_3h: 2300,

    reception_septeto_1h: 2000,
    reception_septeto_2h: 2300,
    reception_septeto_3h: 2600,
  };
}

export function buildCanonicalFormationPrices(pricing = {}) {
  const source = pricing?.formation_prices && typeof pricing.formation_prices === 'object'
    ? pricing.formation_prices
    : {};

  return {
    solo: toNumber(source.solo ?? pricing.price_solo),
    duo: toNumber(source.duo ?? pricing.price_duo),
    trio: toNumber(source.trio ?? pricing.price_trio),
    quarteto: toNumber(source.quarteto ?? pricing.price_quarteto),
    quinteto: toNumber(source.quinteto ?? pricing.price_quinteto),
    sexteto: toNumber(source.sexteto ?? pricing.price_sexteto),
    septeto: toNumber(source.septeto ?? pricing.price_septeto),
  };
}

export function hydratePricingFromCanonical(pricing = {}) {
  const canonical = buildCanonicalFormationPrices(pricing);
  return {
    ...pricing,
    formation_prices: canonical,
    price_solo: canonical.solo,
    price_duo: canonical.duo,
    price_trio: canonical.trio,
    price_quarteto: canonical.quarteto,
    price_quinteto: canonical.quinteto,
    price_sexteto: canonical.sexteto,
    price_septeto: canonical.septeto,
  };
}

export function getAutomaticFormationPrice(formation, pricing) {
  const f = normalizeFormation(formation);
  if (!f) return 0;
  const canonical = buildCanonicalFormationPrices(pricing);

  switch (f) {
    case 'Solo':
      return toNumber(canonical.solo);
    case 'Duo':
      return toNumber(canonical.duo);
    case 'Trio':
      return toNumber(canonical.trio);
    case 'Quarteto':
      return toNumber(canonical.quarteto);
    case 'Quinteto':
      return toNumber(canonical.quinteto);
    case 'Sexteto':
      return toNumber(canonical.sexteto);
    case 'Septeto':
      return toNumber(canonical.septeto);
    default:
      return 0;
  }
}

export function getAutomaticReceptionPrice(formation, hours, pricing) {
  const f = normalizeFormation(formation);
  const h = parseInt(hours, 10) || 0;
  if (!h || !f) return 0;

  if (f === 'Duo') return toNumber(pricing[`reception_duo_${h}h`]);
  if (f === 'Trio') return toNumber(pricing[`reception_trio_${h}h`]);
  if (f === 'Quarteto') return toNumber(pricing[`reception_quarteto_${h}h`]);
  if (f === 'Quinteto') return toNumber(pricing[`reception_quinteto_${h}h`]);
  if (f === 'Sexteto') return toNumber(pricing[`reception_sexteto_${h}h`]);
  if (f === 'Septeto') return toNumber(pricing[`reception_septeto_${h}h`]);

  return 0;
}

export function getPaymentStatus(agreed, paid) {
  const a = toNumber(agreed);
  const p = toNumber(paid);

  if (a <= 0) return 'Pendente';
  if (p <= 0) return 'Pendente';
  if (p >= a) return 'Pago';
  return 'Parcial';
}

export function getPaymentTone(paymentStatus) {
  if (paymentStatus === 'Pago') return 'emerald';
  if (paymentStatus === 'Parcial') return 'amber';
  if (paymentStatus === 'Pendente') return 'red';
  return 'default';
}
