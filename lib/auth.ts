/* Accès protégé par mot de passe (site de démonstration privé).
   Le mot de passe vient de la variable d'environnement SITE_PASSWORD ;
   à défaut, un mot de passe par défaut est utilisé pour que la préversion
   fonctionne sans configuration. Le cookie stocke un hachage salé, jamais
   le mot de passe lui-même. */

const SALT = 'etoile-filante-treport-2026';
const DEFAULT_PASSWORD = 'moussaillon76';

export const AUTH_COOKIE = 'ef_acces';

export function sitePassword(): string {
  return process.env.SITE_PASSWORD || DEFAULT_PASSWORD;
}

export async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + '|' + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function expectedToken(): Promise<string> {
  return tokenFor(sitePassword());
}
