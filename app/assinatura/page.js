import { redirect } from 'next/navigation';

export default function AssinaturaRedirect() {
  redirect('/settings/billing');
}
