import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, expectedToken } from './lib/auth';

/* Tout le site (pages, images, API) est derrière le mot de passe,
   à l'exception de la page d'accès elle-même et de sa route de connexion. */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === (await expectedToken())) return NextResponse.next();

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
