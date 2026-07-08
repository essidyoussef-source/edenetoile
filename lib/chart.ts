import { EFData, Extreme, fmtTime } from './ef-core';

/* Graphique de marée SVG (viewBox 760×240) — courbe + aire + fenêtres de
   sortie + marqueurs PM/BM + trait « maintenant ». Utilisé par le site et le
   cockpit (portage du helper `_chart` des deux maquettes). */
export interface TideChartData {
  d: string;
  areaD: string;
  markers: { x: number; y: number; ty: number; fill: string; label: string }[];
  windows: { x: number; w: number }[];
  hourTicks: { x: number; label: string }[];
  nowX: number;
  showNow: boolean;
  extremesToday: { typeLabel: string; color: string; timeLabel: string; hLabel: string }[];
}

export function tideChart(
  data: Pick<EFData, 'tide' | 'extremes'>,
  dayDate: Date,
  now: Date
): TideChartData | null {
  const day0 = new Date(dayDate); day0.setHours(0, 0, 0, 0);
  const t0 = day0.getTime(), t1 = t0 + 864e5;
  const W = 760, H = 240, PT = 16, PB = 38, PL = 10, PR = 10;
  const pts: [number, number][] = [];
  const { times, heights } = data.tide;
  for (let i = 0; i < times.length; i++) {
    const t = times[i].getTime();
    if (t >= t0 - 36e5 && t <= t1 + 36e5) pts.push([t, heights[i]]);
  }
  if (pts.length < 3) return null;
  let hmin = Infinity, hmax = -Infinity;
  pts.forEach((p) => { hmin = Math.min(hmin, p[1]); hmax = Math.max(hmax, p[1]); });
  hmin = Math.floor(hmin - 0.4); hmax = Math.ceil(hmax + 0.4);
  const x = (t: number) => PL + (t - t0) / 864e5 * (W - PL - PR);
  const y = (h: number) => PT + (1 - (h - hmin) / (hmax - hmin)) * (H - PT - PB);
  let d = '';
  pts.forEach((p, i) => { d += (i ? ' L ' : 'M ') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1); });
  const areaD = d + ' L ' + x(pts[pts.length - 1][0]).toFixed(1) + ' ' + (H - PB + 2) + ' L ' + x(pts[0][0]).toFixed(1) + ' ' + (H - PB + 2) + ' Z';
  const markers: TideChartData['markers'] = [];
  const windows: TideChartData['windows'] = [];
  const extremesToday: TideChartData['extremesToday'] = [];
  data.extremes.forEach((e: Extreme) => {
    const t = e.time.getTime();
    if (e.type === 'PM') {
      const ws = Math.max(t0, t - (2 * 60 + 40) * 60e3), we = Math.min(t1, t + 180 * 60e3);
      if (we > t0 && ws < t1) windows.push({ x: Math.round(x(ws)), w: Math.max(2, Math.round(x(we) - x(ws))) });
    }
    if (t < t0 || t > t1) return;
    const hLabel = e.height.toFixed(1).replace('.', ',') + ' m';
    markers.push({
      x: Math.round(x(t)), y: Math.round(y(e.height)),
      ty: e.type === 'PM' ? Math.round(y(e.height)) - 12 : Math.round(y(e.height)) + 22,
      fill: e.type === 'PM' ? '#18A45F' : '#4FB3E8',
      label: (e.type === 'PM' ? 'PM ' : 'BM ') + fmtTime(e.time),
    });
    extremesToday.push({
      typeLabel: e.type === 'PM' ? 'Pleine mer' : 'Basse mer',
      color: e.type === 'PM' ? '#0F7A47' : '#1D82C4',
      timeLabel: fmtTime(e.time),
      hLabel: hLabel + (e.coef ? ' · coef ' + e.coef : ''),
    });
  });
  const hourTicks = [0, 6, 12, 18, 24].map((h) => ({
    x: Math.round(x(t0 + h * 36e5)),
    label: (h === 24 ? '24' : String(h).padStart(2, '0')) + 'h',
  }));
  const showNow = now.getTime() >= t0 && now.getTime() < t1;
  const nowX = Math.round(x(Math.min(Math.max(now.getTime(), t0), t1)));
  return { d, areaD, markers, windows, hourTicks, nowX, showNow, extremesToday };
}
