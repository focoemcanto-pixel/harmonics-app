import fs from 'node:fs';

const file = 'components/automacoes/RegrasPageClient.js';
let source = fs.readFileSync(file, 'utf8');

const duplicatePreset = `      {
        id: 'payment_pending_2_days_client',
        key: 'lembrete_pagamento_rapido',
        name: 'Lembrete de pagamento',
        title: 'Lembrete de pagamento',
        subtitle: 'Notifica saldo pendente antes do evento',
        event_type: 'payment_pending_2_days_client',
        recipient_type: 'financial',
        triggerType: 'scheduled',
        badge: 'Programado',
        days_before: 2,
        send_time: '10:00',
      },
`;

if (source.includes(duplicatePreset)) {
  source = source.replace(duplicatePreset, '');
  fs.writeFileSync(file, source);
  console.log('[patch-automation-single-payment-reminder] removed duplicate D-2 preset');
} else {
  console.log('[patch-automation-single-payment-reminder] duplicate D-2 preset already absent');
}
