import { NextRequest, NextResponse } from 'next/server';

/* Accès protégé par mot de passe (préversion privée).
   ⚠️ Ce middleware s'exécute sur le runtime Edge de Vercel : il doit rester
   totalement autonome (aucun import de lib/) pour ne pas partager de chunk
   ciblé Node — sinon « ReferenceError: __dirname is not defined » à l'exécution.
   Les constantes ci-dessous DOIVENT rester identiques à celles de lib/auth.ts
   (utilisé, lui, par la route de connexion côté Node). */

const AUTH_COOKIE = 'ef_acces';
const SALT = 'etoile-filante-treport-2026';
const DEFAULT_PASSWORD = 'moussaillon76';

async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(SALT + '|' + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* Tout le site (pages, images, API) est derrière le mot de passe,
   à l'exception de la page d'accès elle-même et de sa route de connexion. */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = await tokenFor(process.env.SITE_PASSWORD || DEFAULT_PASSWORD);
  if (token && token === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  const dest = req.nextUrl.pathname + (req.nextUrl.search || '');
  url.pathname = '/acces';
  url.search = '';
  if (dest && dest !== '/') url.searchParams.set('suite', dest);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!acces|api/acces|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
