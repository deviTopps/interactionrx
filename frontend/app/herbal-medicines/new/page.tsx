import { redirect } from 'next/navigation';

export default function NewMedicinePage() {
  redirect('/herbal-medicines?add=true');
}
