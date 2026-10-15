import { redirect } from 'next/navigation';

// Tela antiga com planos fixos (plus/premium) que não existiam no banco.
// Os planos agora vêm da mesma fonte do backend, em /settings/billing.
export default function AssinarRedirect() {
  redirect('/settings/billing');
}
