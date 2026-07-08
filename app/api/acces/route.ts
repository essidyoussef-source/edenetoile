import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, sitePassword, tokenFor } from '@/lib/auth';

/* Connexion : compare le mot de passe soumis, pose le cookie d'accès
   (hachage salé, HttpOnly) puis redirige vers la page demandée. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get('password') || '');
  const suiteRaw = String(form.get('suite') || '/');
  // uniquement des chemins internes
  const suite = suiteRaw.startsWith('/') && !suiteRaw.startsWith('//') ? suiteRaw : '/';

  const url = req.nextUrl.clone();
  url.search = '';

  if (password !== sitePassword()) {
    url.pathname = '/acces';
    url.searchParams.set('err', '1');
    if (suite !== '/') url.searchParams.set('suite', suite);
    return NextResponse.redirect(url, 303);
  }

  const [pathname, search] = suite.split('?');
  url.pathname = pathname;
  if (search) url.search = search;
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(AUTH_COOKIE, await tokenFor(password), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 jours
  });
  return res;
}
