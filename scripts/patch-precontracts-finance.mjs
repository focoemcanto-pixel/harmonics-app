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
console.log('[patch-precontracts-finance] PreContratosClient.js atualizado.');
