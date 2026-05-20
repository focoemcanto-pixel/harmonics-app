import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(
  process.cwd(),
  'app',
  '(admin)',
  'pre-contratos',
  'PreContratosClient.js'
);

let source = fs.readFileSync(filePath, 'utf8');

const robustToNumber = `function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let cleaned = String(value)
    .trim()
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/[^0-9,.-]/g, '');

  if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.') return 0;

  const isNegative = cleaned.startsWith('-');
  cleaned = cleaned.replace(/-/g, '');

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    // Quando há vírgula e ponto, o último separador é o decimal.
    // Ex.: 2.000,00 => 2000.00 | 2,000.00 => 2000.00
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const decimalDigits = cleaned.length - lastComma - 1;
    if (decimalDigits === 0) {
      normalized = cleaned.replace(/,/g, '');
    } else if (decimalDigits <= 2) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Ex.: 2,000 deve representar 2000, não 2.
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastDot >= 0) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    const decimalDigits = cleaned.length - lastDot - 1;

    if (dotCount > 1) {
      // Ex.: 1.234.567 => 1234567
      normalized = cleaned.replace(/\./g, '');
    } else if (decimalDigits === 0) {
      normalized = cleaned.replace(/\./g, '');
    } else if (decimalDigits <= 2) {
      // Ex.: 1.50 => 1.50
      normalized = cleaned;
    } else {
      // Ex.: 2.000 deve representar 2000, não 2.
      normalized = cleaned.replace(/\./g, '');
    }
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}
`;

source = source.replace(
  /function toNumber\(value\) \{[\s\S]*?\n\}\n\nfunction formatMoney/,
  `${robustToNumber}\nfunction formatMoney`
);

const helper = `
function getFinancialTotal(source) {
  return (
    toNumber(source.base_amount) +
    toNumber(source.add_reception) +
    toNumber(source.add_sound) +
    toNumber(source.add_transport)
  );
}
`;

if (!source.includes('function getFinancialTotal(source)')) {
  source = source.replace(
    /function formatMoney\(value\) \{[\s\S]*?\n\}\n/,
    (match) => `${match}${helper}`
  );
}

source = source.replace(
  `    setForm((prev) => ({
      ...prev,
      [field]: normalizedValue,
    }));
`,
  `    setForm((prev) => {
      const next = {
        ...prev,
        [field]: normalizedValue,
      };

      const financialFields = [
        'base_amount',
        'add_reception',
        'add_sound',
        'add_transport',
      ];

      if (financialFields.includes(field)) {
        const previousTotal = getFinancialTotal(prev);
        const nextTotal = getFinancialTotal(next);

        const agreedWasAuto =
          String(prev.agreed_amount || '').trim() === '' ||
          toNumber(prev.agreed_amount) === previousTotal;

        if (agreedWasAuto) {
          next.agreed_amount = String(nextTotal);
        }
      }

      return next;
    });
`
);

source = source.replace(
  /  const financeiro = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[form\]\);\n\n  const conflitos/,
  `  const financeiro = useMemo(() => {
    const base = toNumber(form.base_amount);
    const addReception = toNumber(form.add_reception);
    const addSound = toNumber(form.add_sound);
    const addTransport = toNumber(form.add_transport);

    const calculado = base + addReception + addSound + addTransport;
    const agreed = String(form.agreed_amount || '').trim() === ''
      ? calculado
      : toNumber(form.agreed_amount);

    const signalAmount = toNumber(form.signal_amount);
    const remainingAmount = Math.max(agreed - signalAmount, 0);

    return {
      base,
      addReception,
      addSound,
      addTransport,
      calculado,
      agreed,
      signalAmount,
      remainingAmount,
    };
  }, [form]);

  const conflitos`
);

fs.writeFileSync(filePath, source);
console.log('[patch-precontracts-finance] PreContratosClient.js atualizado com parser BRL robusto.');
