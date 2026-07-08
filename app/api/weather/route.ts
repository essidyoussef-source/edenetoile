import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { LAT, LON } from '@/lib/ef-core';
import { AUTH_COOKIE, isValidToken } from '@/lib/auth';

/* Proxy Open-Meteo Forecast (météo horaire + quotidienne) — cache serveur 30 min.
   Réservé aux visiteurs authentifiés. */
export async function GET(req: NextRequest) {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!(await isValidToken(token))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const days = Math.min(16, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '4', 10) || 4));
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    '&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,weather_code,precipitation_probability' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max' +
    `&timezone=Europe%2FParis&forecast_days=${days}`;
  try {
    const r = await fetch(url, { next: { revalidate: 1800 } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ error: true }, { status: 502 });
  }
}
