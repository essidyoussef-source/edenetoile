import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { LAT, LON } from '@/lib/ef-core';
import { ACCESS_OPEN, AUTH_COOKIE, isValidToken } from '@/lib/auth';

/* Proxy Open-Meteo Marine (marées + vagues) — cache serveur 30 min pour ne
   pas taper l'API à chaque visite. Protégé sauf si l'accès est public. */
export async function GET(req: NextRequest) {
  if (!ACCESS_OPEN) {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;
    if (!(await isValidToken(token))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const days = Math.min(16, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '4', 10) || 4));
  const url =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}` +
    `&hourly=sea_level_height_msl,wave_height&timezone=Europe%2FParis&forecast_days=${days}&cell_selection=sea`;
  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ error: true }, { status: 502 });
  }
}
