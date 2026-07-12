import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_OPEN, AUTH_COOKIE, isValidToken } from '@/lib/auth';

/* Portail d'accès du site (« / » et « /cockpit »).
   Si ACCESS_OPEN est true (cf. lib/auth.ts), l'accès est public et aucun mot de
   passe n'est demandé. Sinon, on redirige vers /acces tant que le cookie n'est
   pas valide. Ce layout tourne sur le runtime Node (pas Edge), ce qui évite le
   bug « __dirname is not defined » de l'infra Edge Vercel. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  if (ACCESS_OPEN) return <>{children}</>;
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!(await isValidToken(token))) redirect('/acces');
  return <>{children}</>;
}
