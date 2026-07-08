import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE, isValidToken } from '@/lib/auth';

/* Portail d'accès (préversion privée).
   Ce layout server-component enveloppe tout le site (« / » et « /cockpit ») et
   s'exécute sur le runtime Node par défaut — contrairement au middleware Edge,
   il ne déclenche pas le bug « __dirname is not defined » de l'infra Edge Vercel.
   La page /acces et la route /api/acces sont hors de ce groupe, donc publiques. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!(await isValidToken(token))) redirect('/acces');
  return <>{children}</>;
}
