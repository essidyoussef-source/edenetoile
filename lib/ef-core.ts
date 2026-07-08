/* Moteur marées + météo — Le Tréport (50.061N, 1.374E)
   Portage du fichier de handoff `ef-data.js` (logique métier inchangée).
   Marées : Open-Meteo Marine (modèle Copernicus GTSM) — repli : modèle harmonique local M2+S2+N2
   Météo : Open-Meteo Forecast (Météo-France AROME/ARPEGE agrégés)
   Règle métier : sorties possibles de PM−2h40 à PM+3h00.
   Les appels Open-Meteo passent par les routes /api/tides et /api/weather (cache serveur). */

export const LAT = 50.061;
export const LON = 1.374;
const LS_KEY = 'ef_backoffice_v1';

const pad = (n: number) => String(n).padStart(2, '0');
export const fmtTime = (d: Date) => pad(d.getHours()) + 'h' + pad(d.getMinutes());
export const dateKey = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const fmtDateLong = (d: Date) => DAYS_FR[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_FR[d.getMonth()] + ' ' + d.getFullYear();
export const fmtDateShort = (d: Date) => DAYS_FR[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_FR[d.getMonth()];

export const WMO: Record<number, string> = {
  0: 'Ciel dégagé', 1: 'Peu nuageux', 2: 'Partiellement nuageux', 3: 'Couvert',
  45: 'Brouillard', 48: 'Brouillard givrant', 51: 'Bruine légère', 53: 'Bruine', 55: 'Bruine dense',
  61: 'Pluie faible', 63: 'Pluie modérée', 65: 'Pluie forte', 66: 'Pluie verglaçante', 67: 'Pluie verglaçante',
  71: 'Neige faible', 73: 'Neige', 75: 'Neige forte', 77: 'Neige en grains',
  80: 'Averses faibles', 81: 'Averses', 82: 'Fortes averses', 85: 'Averses de neige', 86: 'Averses de neige',
  95: 'Orage', 96: 'Orage avec grêle', 99: 'Orage avec grêle',
};
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
export const windDir = (deg: number) => COMPASS[Math.round((deg % 360) / 22.5) % 16];

/* ---------- Types ---------- */
export interface TideSeries { times: Date[]; heights: number[] }
export interface Extreme { type: 'PM' | 'BM'; time: Date; height: number; coef?: number; estimated?: boolean }
export interface MarineWave { times: Date[]; wave: (number | null)[] }
export interface WeatherHourly {
  time: string[]; temperature_2m: number[]; wind_speed_10m: number[]; wind_gusts_10m: number[];
  wind_direction_10m: number[]; weather_code: number[]; precipitation_probability?: number[];
}
export interface WeatherDaily {
  time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[];
  wind_speed_10m_max: number[]; wind_gusts_10m_max: number[];
}
export interface WeatherData { hourly?: WeatherHourly; daily?: WeatherDaily }
export interface EFData {
  source: 'api' | 'fallback'; tide: TideSeries; extremes: Extreme[];
  weather: WeatherData | null; marineWave: MarineWave | null; error?: boolean;
}
export interface Slot {
  id: string; date: string; dep: Date; dur: number; end: Date;
  depLabel: string; endLabel: string; durLabel: string; hw: Date | null; custom: boolean;
}
export type SlotStatus = 'attente' | 'assuree' | 'annulee' | 'retiree' | 'privatise';
export interface DaySlot extends Slot { status: SlotStatus; boat: string; coef: number | null }
export interface Priva { id: string; from: string; to?: string; timeFrom?: string; timeTo?: string; boat: string; label?: string }
export interface Peche { id: string; date: string; time?: string; status?: string; note?: string }
export interface Resa { id: string; date: string; slotId: string; slotLabel: string; name: string; tel: string; pax: number }
export interface EFState {
  statuses?: Record<string, SlotStatus>;
  boats?: Record<string, string>;
  dayStart?: Record<string, string>;
  pmStart?: Record<string, string>;
  custom?: { date: string; time: string; dur: number }[];
  privas?: Priva[];
  peches?: Peche[];
  resas?: Resa[];
  banner?: { text: string; on: boolean };
  config?: { noBefore?: string; noAfter?: string };
}

async function fetchJSON(u: string) {
  const r = await fetch(u);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/* ---- Repli harmonique local (M2 + S2 + N2), amplitudes typiques Le Tréport ---- */
export function syntheticSeries(startDay: Date, days: number): TideSeries {
  const times: Date[] = [], heights: number[] = [];
  const t0 = startDay.getTime();
  const H = 3600e3;
  const M2 = 12.4206012 * H, S2 = 12 * H, N2 = 12.65834751 * H;
  const anchor = Date.UTC(2026, 0, 1, 2, 10); // phase de calage locale
  for (let m = 0; m <= days * 24 * 60; m += 12) {
    const t = t0 + m * 60e3;
    const h = 4.9
      + 3.45 * Math.cos(2 * Math.PI * (t - anchor) / M2)
      + 1.15 * Math.cos(2 * Math.PI * (t - anchor) / S2)
      + 0.65 * Math.cos(2 * Math.PI * (t - anchor) / N2 + 1.1);
    times.push(new Date(t));
    heights.push(Math.round(h * 100) / 100);
  }
  return { times, heights };
}

/* ---- Extrêmes (PM/BM) par interpolation quadratique ---- */
export function findExtremes(tide: TideSeries): Extreme[] {
  const { times, heights } = tide;
  const out: Extreme[] = [];
  for (let i = 1; i < heights.length - 1; i++) {
    const a = heights[i - 1], b = heights[i], c = heights[i + 1];
    const isMax = b >= a && b >= c && (b > a || b > c);
    const isMin = b <= a && b <= c && (b < a || b < c);
    if (!isMax && !isMin) continue;
    const denom = a - 2 * b + c;
    let off = 0, hv = b;
    if (Math.abs(denom) > 1e-9) {
      off = 0.5 * (a - c) / denom;
      off = Math.max(-1, Math.min(1, off));
      hv = b - 0.25 * (a - c) * off;
    }
    const dt = times[i].getTime() - times[i - 1].getTime();
    const t = new Date(times[i].getTime() + off * dt);
    const last = out[out.length - 1];
    if (last && last.type === (isMax ? 'PM' : 'BM') && Math.abs(t.getTime() - last.time.getTime()) < 4 * 3600e3) {
      if ((isMax && hv > last.height) || (!isMax && hv < last.height)) { out.pop(); } else { continue; }
    }
    out.push({ type: isMax ? 'PM' : 'BM', time: t, height: Math.round(hv * 100) / 100 });
  }
  // coefficient estimé depuis le marnage (marnage Tréport ≈ coef × 0,098 m)
  out.forEach((e, i) => {
    if (e.type !== 'PM') return;
    const prev = out[i - 1], next = out[i + 1];
    const lows = [prev, next].filter((x) => x && x.type === 'BM').map((x) => x.height);
    if (!lows.length) return;
    const range = e.height - lows.reduce((s, v) => s + v, 0) / lows.length;
    e.coef = Math.max(20, Math.min(120, Math.round(range / 0.098)));
  });
  return out;
}

/* ---- Créneaux de balades dans la fenêtre PM−2h40 → PM+3h00 ----
   Deux bateaux en alternance à quai → un départ toutes les 30 minutes. */
const OPEN_H = 9, CLOSE_H = 19.75;
function timeToH(str: string | undefined, def: number) {
  if (!str || !/^\d{1,2}:\d{2}$/.test(str)) return def;
  const [h, m] = str.split(':');
  return +h + +m / 60;
}
export function slotsForDate(extremes: Extreme[], dayDate: Date, config?: EFState['config']): Slot[] {
  config = config || {};
  const openH = timeToH(config.noBefore, OPEN_H);
  const closeH = timeToH(config.noAfter, CLOSE_H);
  const dayStart = new Date(dayDate); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 864e5);
  const res: Slot[] = [];
  extremes.filter((e) => e.type === 'PM').forEach((pm) => {
    const ws = pm.time.getTime() - (2 * 60 + 40) * 60e3;
    const we = pm.time.getTime() + 180 * 60e3;
    if (we < dayStart.getTime() || ws > dayEnd.getTime()) return;
    let t = Math.max(ws, dayStart.getTime());
    t = Math.ceil(t / (30 * 60e3)) * (30 * 60e3);
    const pattern = [30, 30, 30, 60];
    let k = 0;
    while (true) {
      const dep = new Date(t);
      const hr = dep.getHours() + dep.getMinutes() / 60;
      if (hr > closeH || t >= we || t >= dayEnd.getTime()) break;
      let dur = pattern[k % pattern.length];
      if (t + dur * 60e3 > we) {
        if (dur === 60 && t + 30 * 60e3 <= we) dur = 30; else break;
      }
      if (hr >= openH && dep >= dayStart) res.push(mkSlot(dep, dur, pm));
      t += 30 * 60e3;
      k++;
    }
  });
  const seen: Record<string, 1> = {};
  return res
    .filter((s) => s.dep >= dayStart && s.dep < dayEnd && !seen[s.id] && (seen[s.id] = 1))
    .sort((a, b) => a.dep.getTime() - b.dep.getTime());
}
export function mkSlot(dep: Date, dur: number, pm: Extreme | null): Slot {
  return {
    id: dateKey(dep) + '_' + fmtTime(dep) + '_' + dur,
    date: dateKey(dep), dep, dur,
    end: new Date(dep.getTime() + dur * 60e3),
    depLabel: fmtTime(dep), endLabel: fmtTime(new Date(dep.getTime() + dur * 60e3)),
    durLabel: dur === 60 ? '1 h' : '30 min',
    hw: pm ? pm.time : null, custom: !pm,
  };
}

/* ---- Météo au plus proche d'une heure donnée ---- */
export function weatherAt(weather: WeatherData | null, date: Date) {
  if (!weather || !weather.hourly) return null;
  const h = weather.hourly;
  let best = 0, bd = Infinity;
  for (let i = 0; i < h.time.length; i++) {
    const d = Math.abs(new Date(h.time[i]).getTime() - date.getTime());
    if (d < bd) { bd = d; best = i; }
  }
  const code = h.weather_code[best];
  return {
    temp: Math.round(h.temperature_2m[best]),
    wind: Math.round(h.wind_speed_10m[best]),
    gust: Math.round(h.wind_gusts_10m[best]),
    dir: windDir(h.wind_direction_10m[best]),
    dirDeg: h.wind_direction_10m[best],
    precip: h.precipitation_probability ? h.precipitation_probability[best] : null,
    code, label: WMO[code] || '—',
  };
}
export function waveAt(marineWave: MarineWave | null, date: Date) {
  if (!marineWave) return null;
  let best = 0, bd = Infinity;
  for (let i = 0; i < marineWave.times.length; i++) {
    const d = Math.abs(marineWave.times[i].getTime() - date.getTime());
    if (d < bd) { bd = d; best = i; }
  }
  const v = marineWave.wave[best];
  return v == null ? null : Math.round(v * 10) / 10;
}

/* ---- Chargement principal ---- */
export async function load(days?: number): Promise<EFData> {
  days = days || 4;
  const startDay = new Date(); startDay.setHours(0, 0, 0, 0);
  let tide: TideSeries | null = null, source: EFData['source'] = 'fallback';
  let weather: WeatherData | null = null, marineWave: MarineWave | null = null;
  try {
    const m = await fetchJSON('/api/tides?days=' + days);
    const hs: (number | null)[] = m.hourly.sea_level_height_msl;
    if (hs && hs.filter((v) => v != null).length > 12) {
      const times = m.hourly.time.map((s: string) => new Date(s));
      // recale sur le zéro hydrographique approx. du Tréport (niveau moyen ≈ +4,9 m CM)
      tide = { times, heights: hs.map((v) => Math.round(((v == null ? 0 : v) + 4.9) * 100) / 100) };
      marineWave = { times, wave: m.hourly.wave_height };
      source = 'api';
    }
  } catch { /* repli */ }
  if (!tide) tide = syntheticSeries(startDay, days);
  try {
    weather = await fetchJSON('/api/weather?days=' + days);
  } catch { /* météo indisponible */ }
  return { source, tide, extremes: findExtremes(tide), weather, marineWave };
}

/* ---- État partagé site ↔ back-office (localStorage) ---- */
export function getState(): EFState {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(window.localStorage.getItem(LS_KEY) || 'null') || {}; } catch { return {}; }
}
export function setState(patch: Partial<EFState>): EFState {
  const s = Object.assign(getState(), patch);
  window.localStorage.setItem(LS_KEY, JSON.stringify(s));
  try { window.dispatchEvent(new CustomEvent('ef-state')); } catch { /* noop */ }
  return s;
}
// statut d'un créneau : 'attente' (défaut) | 'assuree' | 'annulee' | 'retiree'
export function slotStatus(state: EFState, id: string): SlotStatus { return (state.statuses || {})[id] || 'attente'; }
export function setSlotStatus(id: string, status: SlotStatus) {
  const s = getState();
  const st = s.statuses || {};
  st[id] = status;
  return setState({ statuses: st });
}
export function customSlots(state: EFState, dk: string): Slot[] {
  return (state.custom || []).filter((c) => c.date === dk).map((c) => {
    const [h, mn] = c.time.split(':');
    const d = new Date(dk + 'T' + pad(+h) + ':' + pad(+mn) + ':00');
    return mkSlot(d, c.dur, null);
  });
}
export function addCustomSlot(dk: string, time: string, dur: number) {
  const s = getState();
  const list = s.custom || [];
  list.push({ date: dk, time, dur });
  return setState({ custom: list });
}

/* Créneaux du jour fusionnés avec l'état admin (bateaux, privatisations, coef) */
export const BOATS = ["L'EDEN", "L'Étoile Filante"];
function hmToMin(str: string | undefined, def: number) {
  if (!str || !/^\d{1,2}:\d{2}$/.test(str)) return def;
  const [h, m] = str.split(':');
  return +h * 60 + +m;
}
export function daySlots(data: Pick<EFData, 'extremes'>, dayDate: Date, state?: EFState): DaySlot[] {
  state = state || getState();
  const dk = dateKey(dayDate);
  const cfg = state.config || {};
  const all = slotsForDate(data.extremes, dayDate, cfg).concat(customSlots(state, dk))
    .sort((a, b) => a.dep.getTime() - b.dep.getTime());
  const overrides = state.boats || {};
  const privas = state.privas || [];
  // bateau qui ouvre la journée : choix admin, sinon alternance quotidienne automatique
  const dayNum = Math.floor(new Date(dk + 'T12:00:00').getTime() / 864e5);
  const mStart = (state.dayStart || {})[dk] || BOATS[dayNum % 2];
  const pStart = (state.pmStart || {})[dk] || null;
  let cur = Math.max(0, BOATS.indexOf(mStart));
  let pmApplied = false;
  return all.map((s) => {
    if (!pmApplied && pStart && s.dep.getHours() >= 13) { cur = Math.max(0, BOATS.indexOf(pStart)); pmApplied = true; }
    const boat = overrides[s.id] || BOATS[cur % 2];
    cur++;
    let status = slotStatus(state!, s.id);
    let coef: number | null = null;
    if (s.hw && data.extremes) {
      const pm = data.extremes.find((e) => e.type === 'PM' && Math.abs(e.time.getTime() - s.hw!.getTime()) < 60e3);
      if (pm && pm.coef) coef = pm.coef;
    }
    privas.forEach((p) => {
      if (!p.from) return;
      if (p.boat !== boat && p.boat !== 'Les deux bateaux') return;
      if (dk < p.from || dk > (p.to || p.from)) return;
      const depM = s.dep.getHours() * 60 + s.dep.getMinutes();
      if (depM >= hmToMin(p.timeFrom, 0) && depM < hmToMin(p.timeTo, 1440) && status !== 'retiree') status = 'privatise';
    });
    return Object.assign({}, s, { status, boat, coef });
  }).filter((s) => s.status !== 'retiree');
}
export function setBoat(id: string, boat: string) {
  const s = getState();
  const b = s.boats || {};
  b[id] = boat;
  return setState({ boats: b });
}
/* Estimation harmonique pour dates hors fenêtre API (calendrier annuel) */
export function estimateExtremes(startDate: Date, days?: number): Extreme[] {
  const day0 = new Date(startDate); day0.setHours(0, 0, 0, 0);
  const ex = findExtremes(syntheticSeries(day0, days || 2));
  ex.forEach((e) => { e.estimated = true; });
  return ex;
}
