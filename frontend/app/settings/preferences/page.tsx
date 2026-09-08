import { redirect } from 'next/navigation';

export default function LegacyPreferencesRedirect() {
  redirect('/settings/account');
}
