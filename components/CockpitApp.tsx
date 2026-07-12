'use client';

/* Back-office (« cockpit ») — portage fidèle de « Back-office Étoile Filante v3.dc.html ».
   Trois vues : Planning (agenda semainier), Gestion du jour, Calendrier des marées.
   L'état est partagé avec le site via localStorage (clé ef_backoffice_v1). */

import { useEffect, useRef, useState } from 'react';
import { S } from '@/lib/s';
import { tideChart, TideChartData } from '@/lib/chart';
import * as EF from '@/lib/ef-core';
import type { DaySlot, EFData, EFState, SlotStatus } from '@/lib/ef-core';

type View = 'semaine' | 'planning' | 'calendrier';
type Scope = 'jour' | '3j' | 'semaine7';

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const CYCLE: Record<string, SlotStatus> = { attente: 'assuree', assuree: 'annulee', annulee: 'attente' };

const BTN = (active: boolean, kind: 'a' | 'w' | 'x') => {
  const ON = {
    a: { bg: '#18A45F', fg: '#FFFFFF', border: '#18A45F' },
    w: { bg: '#D9A62B', fg: '#FFFFFF', border: '#D9A62B' },
    x: { bg: '#D95B47', fg: '#FFFFFF', border: '#D95B47' },
  };
  return active ? ON[kind] : { bg: '#FFFFFF', fg: '#5C7893', border: '#A9D6EF' };
};

const inputStyle = "padding:9px 13px;border:1px solid #A9D6EF;border-radius:999px;font-size:12.5px;background:#FFF;color:#0B2239;font-family:'Instrument Sans',sans-serif";

interface Block {
  key: string; top: number; h: number; bg: string; accent: string; fg: string; subFg: string;
  dot: string; deco: string; opacity: number; label: string; sub: string; title: string;
  cursor: string; cycle: () => void;
}

/* Graphique de marée (SVG) — partagé entre les trois vues */
function TideSvg({ chart, showNow }: { chart: TideChartData | null; showNow?: boolean }) {
  return (
    <svg viewBox="0 0 760 240" style={S('width:100%;height:auto;display:block;margin-top:4px')}>
      {(chart ? chart.windows : []).map((w, i) => (
        <rect key={i} x={w.x} y="16" width={w.w} height="186" fill="rgba(79,179,232,0.14)" rx="10"></rect>
      ))}
      <path d={chart ? chart.areaD : ''} fill="rgba(79,179,232,0.10)"></path>
      <path d={chart ? chart.d : ''} fill="none" stroke="#0B2239" strokeWidth="2.4" strokeLinecap="round"></path>
      {(chart ? chart.hourTicks : []).map((h) => (
        <g key={h.label}>
          <line x1={h.x} y1="202" x2={h.x} y2="208" stroke="#B9D8EC" strokeWidth="1"></line>
          <text x={h.x} y="226" textAnchor="middle" fontFamily="Instrument Sans, sans-serif" fontSize="12" fill="#8FA9BE">{h.label}</text>
        </g>
      ))}
      {chart && (showNow ?? chart.showNow) && (
        <line x1={chart.nowX} y1="12" x2={chart.nowX} y2="204" stroke="#D98E2B" strokeWidth="1.8" strokeDasharray="5 4"></line>
      )}
      {(chart ? chart.markers : []).map((m) => (
        <g key={m.label}>
          <circle cx={m.x} cy={m.y} r="4.5" fill={m.fill} stroke="#FFFFFF" strokeWidth="2"></circle>
          <text x={m.x} y={m.ty} textAnchor="middle" fontFamily="Instrument Sans, sans-serif" fontSize="12.5" fontWeight="700" fill="#0B2239">{m.label}</text>
        </g>
      ))}
    </svg>
  );
}

export default function CockpitApp() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<EFData | null>(null);
  const [admin, setAdmin] = useState<EFState>({});
  const [selDay, setSelDay] = useState(0);
  const [view, setView] = useState<View>('semaine');
  const [scope, setScope] = useState<Scope>('semaine7');
  const [weekOffset, setWeekOffset] = useState(0);
  const [calMonth, setCalMonth] = useState<Date | null>(null);
  const [calSel, setCalSel] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState('');
  const [addSlotMsg, setAddSlotMsg] = useState('');
  const [privaMsg, setPrivaMsg] = useState('');
  const [cfgMsg, setCfgMsg] = useState('');
  const [wkCfgMsg, setWkCfgMsg] = useState('');

  const bannerRef = useRef<HTMLInputElement>(null);
  const addTimeRef = useRef<HTMLInputElement>(null);
  const addDurRef = useRef<HTMLSelectElement>(null);
  const resaNameRef = useRef<HTMLInputElement>(null);
  const resaTelRef = useRef<HTMLInputElement>(null);
  const resaSlotRef = useRef<HTMLSelectElement>(null);
  const resaPaxRef = useRef<HTMLInputElement>(null);
  const pecheDateRef = useRef<HTMLInputElement>(null);
  const pecheTimeRef = useRef<HTMLInputElement>(null);
  const pecheStatusRef = useRef<HTMLSelectElement>(null);
  const pecheNoteRef = useRef<HTMLInputElement>(null);
  const privaFromRef = useRef<HTMLInputElement>(null);
  const privaToRef = useRef<HTMLInputElement>(null);
  const privaTimeFromRef = useRef<HTMLInputElement>(null);
  const privaTimeToRef = useRef<HTMLInputElement>(null);
  const privaBoatRef = useRef<HTMLSelectElement>(null);
  const privaLabelRef = useRef<HTMLInputElement>(null);
  const cfgFromRef = useRef<HTMLInputElement>(null);
  const cfgToRef = useRef<HTMLInputElement>(null);
  const wkFromRef = useRef<HTMLInputElement>(null);
  const wkToRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAdmin(EF.getState());
    setMounted(true);
    const onState = () => setAdmin(EF.getState());
    window.addEventListener('ef-state', onState);
    window.addEventListener('storage', onState);
    EF.load(10)
      .then(setData)
      .catch(() => setData({ error: true, extremes: [] } as unknown as EFData));
    return () => {
      window.removeEventListener('ef-state', onState);
      window.removeEventListener('storage', onState);
    };
  }, []);

  if (!mounted) return <div style={S('min-height:100vh;background:#F2F9FE')} />;

  const now = new Date();
  const selDate = new Date(Date.now() + selDay * 864e5);
  selDate.setHours(12, 0, 0, 0);
  const loading = !data;
  const dk = EF.dateKey(selDate);
  const cfg = admin.config || {};

  /* ---- onglets de vue ---- */
  const viewTabs = ([
    { id: 'semaine', label: 'Planning' },
    { id: 'planning', label: 'Gestion du jour' },
    { id: 'calendrier', label: 'Calendrier des marées' },
  ] as { id: View; label: string }[]).map((v) => ({
    ...v,
    bg: view === v.id ? '#0B2239' : '#FFFFFF',
    color: view === v.id ? '#FFFFFF' : '#5C7893',
    border: view === v.id ? '#0B2239' : '#CBE6F6',
    dot: view === v.id ? '#4FB3E8' : '#CBE6F6',
  }));

  const dayTabs = [0, 1, 2].map((i) => {
    const d = new Date(now.getTime() + i * 864e5);
    const active = i === selDay;
    return {
      i,
      label: i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : 'Après-demain',
      sub: EF.fmtDateShort(d),
      bg: active ? '#FFFFFF' : 'rgba(255,255,255,0.16)',
      color: active ? '#0B2239' : '#FFFFFF',
      border: active ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
    };
  });

  /* ---- infos du jour sélectionné (bandeau de la gestion du jour) ---- */
  let rawSlots: DaySlot[] = [];
  let coefSel = '—', windowChip = 'fenêtre —', meteoChip = 'météo —';
  if (data && !data.error) {
    rawSlots = EF.daySlots(data, selDate, admin);
    const day0 = new Date(selDate); day0.setHours(0, 0, 0, 0);
    const day1 = new Date(day0.getTime() + 864e5);
    const dayEx = data.extremes.filter((e) => e.time >= day0 && e.time < day1);
    const coefsList = dayEx.filter((e) => e.coef).map((e) => e.coef);
    coefSel = coefsList.length ? coefsList.join(' / ') : '—';
    const wins = dayEx.filter((e) => e.type === 'PM').map((pm) => {
      const ws = new Date(Math.max(day0.getTime(), pm.time.getTime() - 160 * 60e3));
      const we = new Date(Math.min(day1.getTime() - 1, pm.time.getTime() + 180 * 60e3));
      return EF.fmtTime(ws) + '→' + EF.fmtTime(we);
    });
    windowChip = wins.length ? 'sorties ' + wins.join(' · ') : 'pas de fenêtre';
    const pmMid = dayEx.find((e) => e.type === 'PM');
    const w = data.weather ? EF.weatherAt(data.weather, pmMid ? pmMid.time : selDate) : null;
    if (w) meteoChip = w.temp + '° · vent ' + w.wind + ' km/h';
  }

  const resasAll = admin.resas || [];
  const resasDay = resasAll.filter((r) => r.date === dk);

  /* ---- volet « Balades » du jour (gestion du jour) ---- */
  const buildPanel = (day: Date, isAnchor: boolean) => {
    const dkDay = EF.dateKey(day);
    const apiEnd = data && !data.error ? new Date(now.getTime() + 9 * 864e5) : null;
    const useApi = !!(data && !data.error && apiEnd && day <= apiEnd && day >= new Date(now.getTime() - 864e5));
    const prevDay = new Date(new Date(day).setHours(0, 0, 0, 0) - 864e5);
    const dataDay = useApi
      ? (data as EFData)
      : { tide: EF.syntheticSeries(prevDay, 3), extremes: EF.estimateExtremes(prevDay, 3) };
    const raw = EF.daySlots(dataDay, day, admin);
    const day0 = new Date(day); day0.setHours(0, 0, 0, 0);
    const day1 = new Date(day0.getTime() + 864e5);
    const dayEx = (dataDay.extremes || []).filter((e) => e.time >= day0 && e.time < day1);
    const coefs2 = dayEx.filter((e) => e.type === 'PM' && e.coef).map((e) => e.coef);
    const wins2 = dayEx.filter((e) => e.type === 'PM').map((pm) => {
      const ws = new Date(Math.max(day0.getTime(), pm.time.getTime() - 160 * 60e3));
      const we = new Date(Math.min(day1.getTime() - 1, pm.time.getTime() + 180 * 60e3));
      return EF.fmtTime(ws) + '→' + EF.fmtTime(we);
    });
    const chartD = tideChart(dataDay, day, now);
    const tideRowsD = dayEx.map((e) => ({
      typeLabel: e.type === 'PM' ? 'Pleine mer' : 'Basse mer',
      color: e.type === 'PM' ? '#0F7A47' : '#1D82C4',
      timeLabel: EF.fmtTime(e.time),
      hLabel: e.height.toFixed(1).replace('.', ',') + ' m' + (e.coef ? ' · coef ' + e.coef : ''),
    }));
    const pmMid2 = dayEx.find((e) => e.type === 'PM');
    const w2 = data && data.weather ? EF.weatherAt(data.weather, pmMid2 ? pmMid2.time : day) : null;
    const wave2 = data ? EF.waveAt(data.marineWave, pmMid2 ? pmMid2.time : day) : null;
    const inForecast = !!(useApi && w2);
    let tiles: { k: string; v: string; sub: string }[] = [];
    let advice = '', aBg = '#F2F9FE', aBorder = '#DCEDF8', aFg = '#0B2239';
    if (inForecast && w2) {
      tiles = [
        { k: 'Ciel', v: String(w2.temp) + '°C', sub: w2.label },
        { k: 'Vent', v: w2.wind + ' km/h', sub: w2.dir },
        { k: 'Rafales', v: w2.gust + ' km/h', sub: w2.gust >= 45 ? 'vigilance' : 'ok' },
        { k: 'Pluie', v: w2.precip == null ? '—' : w2.precip + ' %', sub: 'probabilité' },
        { k: 'Mer', v: wave2 == null ? '—' : String(wave2).replace('.', ',') + ' m', sub: 'vagues' },
      ];
      const risky2 = w2.gust >= 45 || (wave2 != null && wave2 >= 1.2);
      advice = risky2
        ? '⚠ Conditions limites (rafales ' + w2.gust + ' km/h' + (wave2 != null ? ', vagues ' + String(wave2).replace('.', ',') + ' m' : '') + ") · envisager l'annulation."
        : 'Conditions favorables · sorties envisageables, à confirmer la veille.';
      aBg = risky2 ? '#FBE7E2' : '#DFF3E8';
      aBorder = risky2 ? '#F0C4B9' : '#B5E2C8';
      aFg = risky2 ? '#C2432E' : '#0F7A47';
    }
    const resasD = resasAll.filter((r) => r.date === dkDay);
    const paxD: Record<string, number> = {};
    resasD.forEach((r) => { paxD[r.slotId] = (paxD[r.slotId] || 0) + (+r.pax || 0); });
    const slotsD = raw.map((s) => {
      const wS = data && data.weather ? EF.weatherAt(data.weather, s.dep) : null;
      const pax = paxD[s.id] || 0;
      const isPriv = s.status === 'privatise';
      const isEden = s.boat === "L'EDEN";
      return {
        ...s,
        timeDeco: s.status === 'annulee' ? 'line-through' : 'none',
        timeOpacity: s.status === 'annulee' ? 0.45 : 1,
        rowBg: isPriv ? '#F6F3FC' : s.status === 'annulee' ? '#FDF3F0' : s.status === 'assuree' ? '#F3FBF6' : '#FFFFFF',
        border: isPriv ? '#E2D9F5' : s.status === 'annulee' ? '#F0C4B9' : s.status === 'assuree' ? '#B5E2C8' : '#DCEDF8',
        resaLabel: pax ? pax + ' pers. réservées' : 'aucune résa',
        meteoLabel: (useApi && wS ? wS.label + ' · ' + wS.temp + '° · vent ' + wS.dir + ' ' + wS.wind + ' km/h' : 'météo à venir') + (s.coef ? ' · coef ' + s.coef : ''),
        boatBg: isEden ? '#EAF6FD' : '#FFF6E8',
        boatBorder: isEden ? '#A9D6EF' : '#EBD5AE',
        boatFg: isEden ? '#1D82C4' : '#A8731E',
        isPrivatise: isPriv,
        switchBoat: () => EF.setBoat(s.id, isEden ? "L'Étoile Filante" : "L'EDEN"),
        btnA: BTN(s.status === 'assuree', 'a'),
        btnW: BTN(s.status === 'attente', 'w'),
        btnX: BTN(s.status === 'annulee', 'x'),
        setAssuree: () => EF.setSlotStatus(s.id, 'assuree'),
        setAttente: () => EF.setSlotStatus(s.id, 'attente'),
        setAnnulee: () => EF.setSlotStatus(s.id, 'annulee'),
        retirer: () => EF.setSlotStatus(s.id, 'retiree'),
      };
    });
    const label = EF.fmtDateLong(day);
    const BOAT_OPTS = ['Auto', "L'EDEN", "L'Étoile Filante"];
    const mkBoatBtns = (key: 'dayStart' | 'pmStart', current: string | undefined) =>
      BOAT_OPTS.map((o) => {
        const val = o === 'Auto' ? null : o;
        const active = (current || null) === val;
        return {
          label: o === "L'Étoile Filante" ? 'Étoile F.' : o === "L'EDEN" ? 'EDEN' : 'Auto',
          bg: active ? '#0B2239' : '#FFFFFF', fg: active ? '#FFFFFF' : '#5C7893', border: active ? '#0B2239' : '#C9E2F2',
          set: () => {
            const st = EF.getState();
            const map = { ...(st[key] || {}) };
            if (val) map[dkDay] = val; else delete map[dkDay];
            EF.setState({ [key]: map });
          },
        };
      });
    return {
      label, isAnchor,
      coefChip: coefs2.length ? coefs2.join(' / ') : '—',
      meteoChip: inForecast && w2 ? w2.temp + '° · vent ' + w2.wind + ' km/h' : useApi ? 'météo en cours' : 'marée estimée',
      windowChip: wins2.length ? wins2.join(' · ') : 'aucune',
      assurerTout: () => {
        if (window.confirm('Êtes-vous sûr·e de valider TOUS les créneaux de la journée du ' + label + ' ? Ils passeront « Sortie assurée » sur le site.')) {
          raw.forEach((s) => s.status !== 'privatise' && EF.setSlotStatus(s.id, 'assuree'));
        }
      },
      annulerTout: () => {
        if (window.confirm('Annuler tous les créneaux du ' + label + ' ?')) {
          raw.forEach((s) => s.status !== 'privatise' && EF.setSlotStatus(s.id, 'annulee'));
        }
      },
      morningBtns: mkBoatBtns('dayStart', (admin.dayStart || {})[dkDay]),
      pmBtns: mkBoatBtns('pmStart', (admin.pmStart || {})[dkDay]),
      noSlots: !loading && slotsD.length === 0,
      slots: slotsD,
      chart: chartD,
      tideRows: tideRowsD,
      hasMeteo: inForecast,
      meteoTiles: tiles, advice, adviceBg: aBg, adviceBorder: aBorder, adviceFg: aFg,
    };
  };
  const dayPanels = data && view === 'planning' ? [buildPanel(selDate, true)] : [];

  /* ---- alerte : créneaux de demain non confirmés ---- */
  let alertOn = false, alertText = '';
  let alertValider = () => {};
  if (data && !data.error) {
    const demain = new Date(now.getTime() + 864e5); demain.setHours(12, 0, 0, 0);
    const slotsDemain = EF.daySlots(data, demain, admin);
    const nbAttente = slotsDemain.filter((s) => s.status === 'attente').length;
    if (nbAttente > 0) {
      alertOn = true;
      alertText = nbAttente + ' créneau' + (nbAttente > 1 ? 'x' : '') + ' de demain (' + EF.fmtDateShort(demain) + ') encore « sous réserve »';
      alertValider = () => {
        if (window.confirm('Valider les ' + nbAttente + ' créneaux restants de demain ? Ils passeront « Sortie assurée » sur le site.')) {
          slotsDemain.forEach((s) => s.status === 'attente' && EF.setSlotStatus(s.id, 'assuree'));
        }
      };
    }
  }

  /* ---- pêches ---- */
  const peches = (admin.peches || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((p) => {
    const d = new Date(p.date + 'T12:00:00');
    const st = p.status || 'attente';
    return {
      id: p.id,
      dateLabel: EF.fmtDateShort(d),
      timeLabel: p.time ? p.time.replace(':', 'h') : '6h00',
      note: p.note || "L'Étoile Filante · 6 h",
      chipLabel: st === 'complet' ? 'Complet' : st === 'confirme' ? 'Confirmé' : 'Places dispo',
      chipBg: st === 'complet' ? '#FBE7E2' : st === 'confirme' ? '#DFF3E8' : '#FBF3DC',
      chipFg: st === 'complet' ? '#C2432E' : st === 'confirme' ? '#0F7A47' : '#8A6A1B',
      remove: () => EF.setState({ peches: (EF.getState().peches || []).filter((x) => x.id !== p.id) }),
    };
  });

  /* ---- privatisations ---- */
  const fmtD = (s: string) => { const d = new Date(s + 'T12:00:00'); return d.getDate() + ' ' + MONTHS_FR[d.getMonth()].slice(0, 4) + '.'; };
  const privas = (admin.privas || []).slice().sort((a, b) => (a.from < b.from ? -1 : 1)).map((p) => ({
    id: p.id,
    periodLabel: p.from === (p.to || p.from) ? fmtD(p.from) : fmtD(p.from) + ' → ' + fmtD(p.to || p.from),
    timeLabel: (p.timeFrom || '—').replace(':', 'h') + ' → ' + (p.timeTo || '—').replace(':', 'h'),
    boat: p.boat, label: p.label || '—',
    remove: () => EF.setState({ privas: (EF.getState().privas || []).filter((x) => x.id !== p.id) }),
  }));

  /* ---- calendrier des marées ---- */
  const calBase = calMonth || new Date(now.getFullYear(), now.getMonth(), 1);
  const calDays: {
    dk: string; select: () => void; dayLabel: string; coef: number | string; coefColor: string;
    pms: string[]; meteoLabel: string; hasPriva: boolean; privaLabel: string;
    hasPeche: boolean; pecheTime: string; bg: string; border: string;
  }[] = [];
  if (view === 'calendrier') {
    const mStart = new Date(calBase.getFullYear(), calBase.getMonth(), 1);
    const mEnd = new Date(calBase.getFullYear(), calBase.getMonth() + 1, 0);
    const apiEnd = data && !data.error ? new Date(now.getTime() + 9 * 864e5) : null;
    const estEx = EF.estimateExtremes(mStart, mEnd.getDate() + 1);
    for (let day = 1; day <= mEnd.getDate(); day++) {
      const d0 = new Date(calBase.getFullYear(), calBase.getMonth(), day);
      const d1 = new Date(d0.getTime() + 864e5);
      const dkDay = EF.dateKey(d0);
      const useApi = !!(data && !data.error && apiEnd && d0 >= new Date(now.getTime() - 864e5) && d1 <= apiEnd);
      const src = useApi ? (data as EFData).extremes : estEx;
      const ex = src.filter((e) => e.time >= d0 && e.time < d1);
      const pms = ex.filter((e) => e.type === 'PM');
      const coefsD = pms.filter((e) => e.coef).map((e) => e.coef as number);
      const coef = coefsD.length ? Math.max(...coefsD) : null;
      let meteoLabel = '';
      if (data && data.weather && data.weather.daily) {
        const idx = data.weather.daily.time.indexOf(dkDay);
        if (idx >= 0) {
          const dd = data.weather.daily;
          meteoLabel = (EF.WMO[dd.weather_code[idx]] || '') + ' · ' + Math.round(dd.temperature_2m_max[idx]) + '° · vent ' + Math.round(dd.wind_speed_10m_max[idx]) + ' km/h';
        }
      }
      const priva = (admin.privas || []).find((p) => p.from && dkDay >= p.from && dkDay <= (p.to || p.from));
      const peche = (admin.peches || []).find((p) => p.date === dkDay);
      const isToday = dkDay === EF.dateKey(now);
      const isSel = calSel === dkDay;
      calDays.push({
        dk: dkDay,
        select: () => setCalSel(dkDay),
        dayLabel: DAYS_SHORT[d0.getDay()] + ' ' + day,
        coef: coef || '—',
        coefColor: coef != null && coef >= 95 ? '#C2432E' : coef != null && coef >= 70 ? '#0F7A47' : '#8A6A1B',
        pms: pms.map((e) => EF.fmtTime(e.time) + ' · ' + e.height.toFixed(1).replace('.', ',') + ' m' + (useApi ? '' : ' *')),
        meteoLabel,
        hasPriva: !!priva, privaLabel: priva ? 'Privatisé · ' + (priva.label || priva.boat) : '',
        hasPeche: !!peche, pecheTime: peche && peche.time ? peche.time.replace(':', 'h') : '',
        bg: isSel ? '#DCF3FF' : isToday ? '#EAF6FD' : '#FFFFFF',
        border: isSel ? '#1D82C4' : isToday ? '#4FB3E8' : '#E4EFF7',
      });
    }
  }

  /* graphique du jour sélectionné dans le calendrier */
  let calChart: TideChartData | null = null;
  let calTideRows: { typeLabel: string; color: string; timeLabel: string; hLabel: string }[] = [];
  let calSelCoef = '—', calSelLabel = '', calSelNote = '';
  if (view === 'calendrier' && calSel) {
    const selD = new Date(calSel + 'T12:00:00');
    const day0 = new Date(selD); day0.setHours(0, 0, 0, 0);
    const day1 = new Date(day0.getTime() + 864e5);
    const apiEnd2 = data && !data.error ? new Date(now.getTime() + 9 * 864e5) : null;
    const useApi = !!(data && !data.error && apiEnd2 && selD <= apiEnd2 && selD >= new Date(now.getTime() - 864e5));
    const prevDay = new Date(day0.getTime() - 864e5);
    const dataSel = useApi
      ? (data as EFData)
      : { tide: EF.syntheticSeries(prevDay, 3), extremes: EF.estimateExtremes(prevDay, 3) };
    calChart = tideChart(dataSel, selD, now);
    calTideRows = (dataSel.extremes || []).filter((e) => e.time >= day0 && e.time < day1).map((e) => ({
      typeLabel: e.type === 'PM' ? 'Pleine mer' : 'Basse mer',
      color: e.type === 'PM' ? '#0F7A47' : '#1D82C4',
      timeLabel: EF.fmtTime(e.time),
      hLabel: e.height.toFixed(1).replace('.', ',') + ' m' + (e.coef ? ' · coef ' + e.coef : ''),
    }));
    const cs = (dataSel.extremes || []).filter((e) => e.type === 'PM' && e.time >= day0 && e.time < day1 && e.coef).map((e) => e.coef);
    calSelCoef = cs.length ? cs.join(' / ') : '—';
    calSelLabel = EF.fmtDateLong(selD);
    calSelNote = useApi ? 'Données Open-Meteo temps réel' : "Estimation harmonique locale · à confirmer avec l'annuaire SHOM";
  }

  /* ---- semainier (agenda) ---- */
  const nDays = scope === 'jour' ? 1 : scope === '3j' ? 3 : 7;
  const monday = new Date(now); monday.setHours(12, 0, 0, 0);
  if (scope === 'semaine7') monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);
  else monday.setDate(monday.getDate() + weekOffset * nDays);
  // grille agenda : 6h → 21h30, 44 px par heure
  const H0 = 6, H1 = 21.5, PPH = 44;
  const gridH = Math.round((H1 - H0) * PPH);
  const hourMarks: { top: number; label: string }[] = [];
  for (let h = Math.ceil(H0); h <= Math.floor(H1); h++) hourMarks.push({ top: Math.round((h - H0) * PPH), label: h + 'h' });
  const yOf = (d: Date) => Math.max(0, Math.min(gridH, (d.getHours() + d.getMinutes() / 60 - H0) * PPH));
  const yOfHM = (hm: string) => { const [h, m] = (hm || '0:0').split(':'); return Math.max(0, Math.min(gridH, (+h + +m / 60 - H0) * PPH)); };
  const weekDays: {
    dk: string; dayLabel: string; coef: number | string; meteoShort: string;
    goDay: () => void; headBg: string; headFg: string;
    windows: { top: number; h: number }[]; blocks: Block[];
  }[] = [];
  if (view === 'semaine') {
    const apiEnd = data && !data.error ? new Date(now.getTime() + 9 * 864e5) : null;
    const BOAT_STY: Record<string, { bg: string; accent: string; fg: string; sub: string }> = {
      "L'EDEN": { bg: '#DCEFFB', accent: '#1D82C4', fg: '#0B2239', sub: '#1D82C4' },
      "L'Étoile Filante": { bg: '#FFF0DB', accent: '#D9862B', fg: '#0B2239', sub: '#A8731E' },
    };
    const DOT: Record<string, string> = { attente: '#D9A62B', assuree: '#18A45F', annulee: '#D95B47' };
    for (let i = 0; i < nDays; i++) {
      const day = new Date(monday.getTime() + i * 864e5);
      const dkDay = EF.dateKey(day);
      const useApi = !!(data && !data.error && apiEnd && day <= apiEnd && day >= new Date(now.getTime() - 864e5));
      const dataDay = useApi ? (data as EFData) : { extremes: EF.estimateExtremes(new Date(day.getTime() - 864e5), 3) };
      const dSlots = EF.daySlots(dataDay, day, admin);
      const day0 = new Date(day); day0.setHours(0, 0, 0, 0);
      const day1 = new Date(day0.getTime() + 864e5);
      const dayEx = (dataDay.extremes || []).filter((e) => e.time >= day0 && e.time < day1);
      const coefsD = dayEx.filter((e) => e.type === 'PM' && e.coef).map((e) => e.coef as number);
      let meteoShort = useApi ? '' : 'estimé';
      if (data && data.weather && data.weather.daily) {
        const idx = data.weather.daily.time.indexOf(dkDay);
        if (idx >= 0) meteoShort = Math.round(data.weather.daily.temperature_2m_max[idx]) + '° · ' + Math.round(data.weather.daily.wind_speed_10m_max[idx]) + ' km/h';
      }
      const isToday = dkDay === EF.dateKey(now);
      // fenêtres de marée (PM −2h40 → +3h)
      const windows = dayEx.filter((e) => e.type === 'PM').map((pm) => {
        const ws = new Date(Math.max(day0.getTime(), pm.time.getTime() - 160 * 60e3));
        const we = new Date(Math.min(day1.getTime() - 1, pm.time.getTime() + 180 * 60e3));
        const top = Math.round(yOf(ws));
        return { top, h: Math.max(6, Math.round(yOf(we) - top)) };
      });
      const blocks: Block[] = [];
      // balades
      dSlots.forEach((s) => {
        if (s.status === 'privatise') return; // couvert par le bloc privatisation
        const bs = BOAT_STY[s.boat] || BOAT_STY["L'EDEN"];
        const top = Math.round(yOf(s.dep));
        blocks.push({
          key: s.id,
          top, h: Math.max(20, Math.round(yOf(s.end) - top) - 2),
          bg: bs.bg, accent: bs.accent, fg: s.status === 'annulee' ? '#8FA9BE' : bs.fg, subFg: bs.sub,
          dot: DOT[s.status] || DOT.attente,
          deco: s.status === 'annulee' ? 'line-through' : 'none',
          opacity: s.status === 'annulee' ? 0.55 : 1,
          label: s.depLabel, sub: s.durLabel + ' · ' + (s.boat === "L'EDEN" ? 'EDEN' : 'Étoile F.'),
          title: (s.status === 'attente' ? 'À confirmer' : s.status === 'assuree' ? 'Assurée' : 'Annulée') + ' · cliquer pour changer',
          cursor: 'pointer',
          cycle: () => EF.setSlotStatus(s.id, CYCLE[s.status] || 'assuree'),
        });
      });
      // privatisations
      (admin.privas || []).forEach((p) => {
        if (!p.from || dkDay < p.from || dkDay > (p.to || p.from)) return;
        const top = Math.round(yOfHM(p.timeFrom || '09:00'));
        blocks.push({
          key: 'priva-' + p.id,
          top, h: Math.max(24, Math.round(yOfHM(p.timeTo || '18:00') - top) - 2),
          bg: '#EDE7F9', accent: '#5B3FA8', fg: '#5B3FA8', subFg: '#7B5FC8', dot: '#5B3FA8',
          deco: 'none', opacity: 1,
          label: 'Privatisé', sub: p.label || p.boat, title: 'Privatisation : ' + (p.label || '') + ' · ' + p.boat,
          cursor: 'default', cycle: () => {},
        });
      });
      // pêches
      (admin.peches || []).forEach((p) => {
        if (p.date !== dkDay) return;
        const top = Math.round(yOfHM(p.time || '06:00'));
        blocks.push({
          key: 'peche-' + p.id,
          top, h: Math.max(24, Math.round(Math.min(gridH, top + 6 * PPH) - top) - 2),
          bg: '#D9F4EF', accent: '#0F8E7E', fg: '#0F8E7E', subFg: '#0F8E7E', dot: '#0F8E7E',
          deco: 'none', opacity: 1,
          label: 'Pêche ' + (p.time || '6h').replace(':', 'h'), sub: p.note || '6 h · Étoile F.', title: 'Sortie pêche en mer',
          cursor: 'default', cycle: () => {},
        });
      });
      weekDays.push({
        dk: dkDay,
        dayLabel: DAYS_SHORT[day.getDay()] + ' ' + day.getDate(),
        coef: coefsD.length ? Math.max(...coefsD) : '—',
        meteoShort: meteoShort || '—',
        goDay: () => {
          const off = Math.round((day0.getTime() - new Date(new Date(now).setHours(0, 0, 0, 0)).getTime()) / 864e5);
          if (off >= 0 && off <= 2) { setView('planning'); setSelDay(off); }
        },
        headBg: isToday ? '#0B2239' : '#EAF6FD',
        headFg: isToday ? '#FFFFFF' : '#1D82C4',
        windows, blocks,
      });
    }
  }
  const weekLabel = nDays === 1
    ? EF.fmtDateLong(monday)
    : EF.fmtDateShort(monday) + ' → ' + EF.fmtDateShort(new Date(monday.getTime() + (nDays - 1) * 864e5));
  const weekCols = nDays;
  // Vue « Jour » : pas de largeur minimale → la grille remplit l'écran, aucun
  // scroll horizontal. Vues 3 jours / Semaine : largeur mini = scroll possible.
  const gridMinW = nDays === 1 ? 0 : 54 + nDays * 128;

  const banner = admin.banner || { text: '', on: false };
  const sourceShort = !data
    ? 'Chargement…'
    : data.source === 'api'
      ? 'Marées/météo : Open-Meteo temps réel · calendrier lointain : estimation harmonique'
      : 'Marées : estimation locale (API indisponible)';

  const slotOptions = rawSlots.filter((s) => s.status !== 'privatise').map((s) => ({ id: s.id, label: s.depLabel + ' · ' + s.durLabel + ' · ' + s.boat }));
  const resaTotal = resasDay.reduce((sum, r) => sum + (+r.pax || 0), 0) + ' pers. au total';

  const scopeTabs = ([
    { id: 'jour', label: 'Jour' }, { id: '3j', label: '3 jours' }, { id: 'semaine7', label: 'Semaine' },
  ] as { id: Scope; label: string }[]).map((sc) => ({
    ...sc,
    bg: scope === sc.id ? '#0B2239' : '#FFFFFF',
    color: scope === sc.id ? '#FFFFFF' : '#5C7893',
    border: scope === sc.id ? '#0B2239' : '#CBE6F6',
  }));

  /* ---- actions formulaires ---- */
  const saveWkCfg = () => {
    EF.setState({ config: { noBefore: wkFromRef.current?.value || '', noAfter: wkToRef.current?.value || '' } });
    setWkCfgMsg('Appliqué ✓');
    setTimeout(() => setWkCfgMsg(''), 2000);
  };
  const saveCfg = () => {
    EF.setState({ config: { noBefore: cfgFromRef.current?.value || '', noAfter: cfgToRef.current?.value || '' } });
    setCfgMsg('Appliqué ✓');
    setTimeout(() => setCfgMsg(''), 2000);
  };
  const addSlot = () => {
    const t = addTimeRef.current?.value;
    if (!t) { setAddSlotMsg('Choisissez une heure.'); return; }
    EF.addCustomSlot(dk, t, +(addDurRef.current?.value || 30));
    if (addTimeRef.current) addTimeRef.current.value = '';
    setAddSlotMsg('');
  };
  const addPeche = () => {
    const date = pecheDateRef.current?.value;
    if (!date) return;
    const list = EF.getState().peches || [];
    list.push({ id: 'p' + Date.now(), date, time: pecheTimeRef.current?.value || '06:00', status: pecheStatusRef.current?.value, note: (pecheNoteRef.current?.value || '').trim() });
    EF.setState({ peches: list });
    if (pecheDateRef.current) pecheDateRef.current.value = '';
    if (pecheNoteRef.current) pecheNoteRef.current.value = '';
  };
  const addPriva = () => {
    const from = privaFromRef.current?.value;
    const tf = privaTimeFromRef.current?.value, tt = privaTimeToRef.current?.value;
    if (!from || !tf || !tt) { setPrivaMsg('Date + heures requises.'); return; }
    const list = EF.getState().privas || [];
    list.push({ id: 'v' + Date.now(), from, to: privaToRef.current?.value || from, timeFrom: tf, timeTo: tt, boat: privaBoatRef.current?.value || "L'EDEN", label: (privaLabelRef.current?.value || '').trim() });
    EF.setState({ privas: list });
    if (privaFromRef.current) privaFromRef.current.value = '';
    if (privaToRef.current) privaToRef.current.value = '';
    if (privaLabelRef.current) privaLabelRef.current.value = '';
    setPrivaMsg('');
  };
  const toggleBanner = () => {
    EF.setState({ banner: { text: (bannerRef.current ? bannerRef.current.value : banner.text) || '', on: !banner.on } });
  };
  const saveBanner = () => {
    const text = (bannerRef.current?.value || '').trim();
    EF.setState({ banner: { text, on: !!text } });
    setBannerMsg(text ? 'Publié ✓' : 'Bandeau retiré');
    setTimeout(() => setBannerMsg(''), 2500);
  };
  const addResa = () => {
    const name = (resaNameRef.current?.value || '').trim();
    if (!name) return;
    const slotId = resaSlotRef.current?.value || (rawSlots[0] && rawSlots[0].id) || '';
    const slot = rawSlots.find((s) => s.id === slotId);
    const list = EF.getState().resas || [];
    list.push({ id: 'r' + Date.now(), date: dk, slotId, slotLabel: slot ? slot.depLabel : '—', name, tel: (resaTelRef.current?.value || '').trim() || '—', pax: +(resaPaxRef.current?.value || 1) });
    EF.setState({ resas: list });
    if (resaNameRef.current) resaNameRef.current.value = '';
    if (resaTelRef.current) resaTelRef.current.value = '';
    if (resaPaxRef.current) resaPaxRef.current.value = '';
  };

  return (
    <div style={S('min-height:100vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#D8EEFA 0%,#F2F9FE 22%,#FFFFFF 60%,#EAF6FD 100%)')}>
      {/* HEADER */}
      <header style={S('position:sticky;top:0;z-index:60;background:rgba(11,34,57,0.94);backdrop-filter:blur(14px);border-bottom:1px solid rgba(79,179,232,0.35);box-shadow:0 24px 54px rgba(11,34,57,0.45)')}>
        <div style={S('max-width:1320px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:68px;flex-wrap:wrap')}>
          <a href="/" title="Voir le site" style={S('display:flex;align-items:center;gap:12px;text-decoration:none')}>
            <span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:16px;color:#FFFFFF;white-space:nowrap")}>Étoile Filante <span style={S('color:#4FB3E8')}>✦</span></span>
            <span style={S('padding:5px 13px;border-radius:999px;background:rgba(79,179,232,0.22);border:1px solid rgba(79,179,232,0.45);color:#9ED4F2;font-size:10.5px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase')}>Back-office</span>
          </a>
          <div className="hide-mobile" style={S('font-size:12px;color:#9ED4F2')}>{sourceShort}</div>
        </div>
      </header>

      <main style={S('flex:1;max-width:1320px;width:100%;margin:0 auto;padding:24px 24px 70px')}>
        {/* ONGLETS VUE */}
        <div style={S('display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:20px')}>
          {viewTabs.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} style={S(`cursor:pointer;display:flex;align-items:center;gap:9px;padding:11px 20px;border-radius:999px;background:${v.bg};color:${v.color};border:1px solid ${v.border};font-weight:700;font-size:13.5px`)}>
              <span style={S(`display:inline-block;width:7px;height:7px;border-radius:50%;background:${v.dot}`)}></span>{v.label}
            </button>
          ))}
        </div>

        {/* ALERTE VALIDATION */}
        {alertOn && (
          <div style={S('background:#FFF6E0;border:1.5px solid #EBD9A8;border-radius:18px;padding:13px 20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:16px')}>
            <span style={S('display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#F5E5B8;flex:none;font-size:16px')}>⚠️</span>
            <div style={S('flex:1;min-width:220px;font-size:13.5px;font-weight:600;color:#8A6A1B;line-height:1.5')}>{alertText} · les visiteurs du site attendent l&apos;information.</div>
            <button onClick={alertValider} className="hvGreenBg" style={S('cursor:pointer;padding:9px 18px;border-radius:999px;background:#2BB673;color:#FFF;font-weight:700;font-size:12.5px')}>✓ Valider les sorties de demain</button>
          </div>
        )}

        {/* ============================ VUE SEMAINIER ============================ */}
        {view === 'semaine' && (
          <>
            <div style={S('background:#FFFFFF;border:1px solid #CBE6F6;border-radius:24px;padding:20px 22px;box-shadow:0 10px 30px rgba(20,93,160,0.08);margin-bottom:16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap')}>
              <div className="week-nav" style={S('display:flex;align-items:center;gap:14px')}>
                <button onClick={() => setWeekOffset(weekOffset - 1)} className="hvD6" style={S('cursor:pointer;width:38px;height:38px;border-radius:50%;background:#EAF6FD;color:#1D82C4;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none')}>←</button>
                <div className="week-label" style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:17px;min-width:210px;text-align:center;text-transform:capitalize")}>{weekLabel}</div>
                <button onClick={() => setWeekOffset(weekOffset + 1)} className="hvD6" style={S('cursor:pointer;width:38px;height:38px;border-radius:50%;background:#EAF6FD;color:#1D82C4;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none')}>→</button>
              </div>
              <div className="week-scope" style={S('display:flex;align-items:center;gap:6px;margin-left:8px;flex-wrap:wrap')}>
                <span style={S('font-size:11px;font-weight:800;letter-spacing:0.08em;color:#8FA9BE')}>VUE</span>
                {scopeTabs.map((sc) => (
                  <button key={sc.id} onClick={() => { setScope(sc.id); setWeekOffset(0); }} style={S(`cursor:pointer;padding:8px 16px;border-radius:999px;background:${sc.bg};color:${sc.color};border:1px solid ${sc.border};font-weight:700;font-size:12px`)}>{sc.label}</button>
                ))}
              </div>
              <div style={S('flex:1')}></div>
              <div className="week-filter" style={S('display:flex;align-items:center;gap:8px;background:#F2F9FE;border-radius:999px;padding:7px 14px;flex-wrap:wrap')}>
                <span style={S('font-size:11px;font-weight:800;color:#1D82C4')}>PAS AVANT</span>
                <input type="time" ref={wkFromRef} defaultValue={cfg.noBefore || ''} style={S('padding:5px 9px;border:1px solid #A9D6EF;border-radius:999px;font-size:12.5px;background:#FFF;color:#0B2239')} />
                <span style={S('font-size:11px;font-weight:800;color:#1D82C4')}>PAS APRÈS</span>
                <input type="time" ref={wkToRef} defaultValue={cfg.noAfter || ''} style={S('padding:5px 9px;border:1px solid #A9D6EF;border-radius:999px;font-size:12.5px;background:#FFF;color:#0B2239')} />
                <button onClick={saveWkCfg} className="hvBlueBg" style={S('cursor:pointer;padding:6px 14px;border-radius:999px;background:#0B2239;color:#FFF;font-weight:700;font-size:12px')}>Appliquer</button>
                <span style={S('font-size:11.5px;color:#0F7A47;font-weight:700')}>{wkCfgMsg}</span>
              </div>
            </div>

            <div className="pw-card" style={{ ...S('background:#FFFFFF;border:1px solid #CBE6F6;border-radius:24px;padding:16px 16px 18px;box-shadow:0 10px 30px rgba(20,93,160,0.08);overflow-x:auto'), ['--gut' as string]: '54px' }}>
              <div style={{ minWidth: gridMinW }}>
                {/* entêtes de jours */}
                <div style={{ ...S('gap:0;margin-bottom:6px'), display: 'grid', gridTemplateColumns: `var(--gut) repeat(${weekCols},1fr)` }}>
                  <div></div>
                  {weekDays.map((d) => (
                    <button key={d.dk} onClick={d.goDay} title="Ouvrir la gestion de ce jour" className="hvOp" style={S(`cursor:pointer;background:${d.headBg};color:${d.headFg};padding:9px 11px;border-radius:14px;margin:0 3px;text-align:center`)}>
                      <div style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:13px;text-transform:capitalize")}>{d.dayLabel}</div>
                      <div style={S('font-size:10px;font-weight:700;opacity:0.8;margin-top:1px')}>coef {d.coef} · {d.meteoShort}</div>
                    </button>
                  ))}
                </div>
                {/* grille horaire */}
                <div style={{ display: 'grid', gridTemplateColumns: `var(--gut) repeat(${weekCols},1fr)`, gap: 0 }}>
                  <div style={{ position: 'relative', height: gridH }}>
                    {hourMarks.map((h) => (
                      <div key={h.label} style={{ ...S('position:absolute;right:8px;transform:translateY(-50%);font-size:10.5px;font-weight:700;color:#8FA9BE'), top: h.top }}>{h.label}</div>
                    ))}
                  </div>
                  {weekDays.map((d) => (
                    <div key={d.dk} style={{ ...S('position:relative;border-left:1px solid #EDF5FA;background:repeating-linear-gradient(180deg,transparent 0px,transparent 43px,#F2F8FC 43px,#F2F8FC 44px)'), height: gridH }}>
                      {d.windows.map((w, i) => (
                        <div key={i} style={{ ...S('position:absolute;left:0;right:0;background:rgba(79,179,232,0.08);border-top:1.5px dashed rgba(79,179,232,0.4);border-bottom:1.5px dashed rgba(79,179,232,0.4);pointer-events:none'), top: w.top, height: w.h }}></div>
                      ))}
                      {d.blocks.map((b) => (
                        <button key={b.key} onClick={b.cycle} title={b.title} className="hvDim" style={{ ...S(`position:absolute;left:4px;right:4px;background:${b.bg};border-left:4px solid ${b.accent};border-radius:9px;padding:3px 8px;overflow:hidden;box-shadow:0 2px 8px rgba(11,34,57,0.08)`), cursor: b.cursor, top: b.top, height: b.h, opacity: b.opacity }}>
                          <div style={S('display:flex;align-items:center;gap:5px')}>
                            <span style={S(`display:inline-block;width:6px;height:6px;border-radius:50%;background:${b.dot};flex:none`)}></span>
                            <span style={S(`font-family:'Sora',sans-serif;font-weight:800;font-size:11px;color:${b.fg};text-decoration:${b.deco};white-space:nowrap`)}>{b.label}</span>
                          </div>
                          <div style={S(`font-size:9.5px;font-weight:700;color:${b.subFg};white-space:nowrap;margin-top:1px`)}>{b.sub}</div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="legend-bar" style={S('display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-top:14px;background:#FFFFFF;border:1px solid #CBE6F6;border-radius:999px;padding:11px 20px')}>
              <span style={S('font-size:11.5px;font-weight:800;color:#5C7893;letter-spacing:0.06em')}>LÉGENDE</span>
              <span style={S('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#5C7893')}><span style={S('width:12px;height:12px;border-radius:4px;background:#DCEFFB;border-left:3px solid #1D82C4')}></span>L&apos;EDEN</span>
              <span style={S('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#5C7893')}><span style={S('width:12px;height:12px;border-radius:4px;background:#FFF0DB;border-left:3px solid #D9862B')}></span>L&apos;Étoile Filante</span>
              <span style={S('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#5C7893')}><span style={S('width:12px;height:12px;border-radius:4px;background:#EDE7F9;border-left:3px solid #5B3FA8')}></span>Privatisation</span>
              <span style={S('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#5C7893')}><span style={S('width:12px;height:12px;border-radius:4px;background:#D9F4EF;border-left:3px solid #0F8E7E')}></span>Pêche en mer</span>
              <span style={S('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#5C7893')}><span style={S('width:8px;height:8px;border-radius:50%;background:#D9A62B')}></span>à confirmer</span>
              <span style={S('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#5C7893')}><span style={S('width:8px;height:8px;border-radius:50%;background:#18A45F')}></span>assurée</span>
              <span style={S('display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#5C7893')}><span style={S('width:8px;height:8px;border-radius:50%;background:#D95B47')}></span>annulée</span>
              <span style={S('margin-left:auto;font-size:11px;color:#8FA9BE')}>Cliquer un créneau pour changer son statut · zone hachurée = fenêtre de marée</span>
            </div>
          </>
        )}

        {/* ============================ VUE GESTION DU JOUR ============================ */}
        {view === 'planning' && (
          <>
            {/* bandeau jour */}
            <div className="day-banner" style={S('background:linear-gradient(115deg,#4FB3E8,#1D82C4);border-radius:24px;color:#FFFFFF;padding:18px 26px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;box-shadow:0 18px 44px rgba(11,34,57,0.18);margin-bottom:18px;position:relative;overflow:hidden')}>
              <div style={S('position:absolute;top:-60px;right:-40px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,0.13);z-index:0')}></div>
              <div className="day-tabs" style={S('display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:1')}>
                {dayTabs.map((d) => (
                  <button key={d.i} onClick={() => { setSelDay(d.i); setAddSlotMsg(''); }} style={S(`cursor:pointer;padding:9px 18px;border-radius:999px;background:${d.bg};color:${d.color};border:1px solid ${d.border};font-weight:700;font-size:13px`)}>
                    {d.label} <span style={S('font-size:11px;opacity:0.75;text-transform:capitalize;margin-left:5px')}>{d.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="day-cols" style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px;align-items:start')}>
              {/* ====== COLONNE PLANNING DU JOUR ====== */}
              <div style={S('display:flex;flex-direction:column;gap:16px;min-width:0')}>
                {/* VOLET BALADES */}
                {dayPanels.map((d) => (
                  <div key={d.label} style={S('background:#FFFFFF;border:1px solid #CBE6F6;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(20,93,160,0.08)')}>
                    <div style={S('background:linear-gradient(115deg,#16436B,#0B2239);color:#FFFFFF;padding:16px 24px;display:flex;align-items:center;gap:12px;flex-wrap:wrap')}>
                      <span style={S('display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(79,179,232,0.25)')}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#9ED4F2" strokeWidth="1.8" strokeLinecap="round"><path d="M3 17 L21 17 L18.5 21 L5.5 21 Z"></path><path d="M12 4 L12 17"></path><path d="M12 6 C 16 7, 18 10, 18.5 14 L12 14 Z"></path></svg>
                      </span>
                      <div style={S('flex:1')}>
                        <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:16px")}>Balades · <span style={S('text-transform:capitalize')}>{d.label}</span></div>
                        <div style={S('font-size:11.5px;color:#9ED4F2')}>coef {d.coefChip} · {d.meteoChip} · fenêtre {d.windowChip}</div>
                      </div>
                      <div style={S('display:flex;gap:8px')}>
                        <button onClick={d.assurerTout} className="hvGreenBg" style={S('cursor:pointer;padding:8px 15px;border-radius:999px;background:#2BB673;color:#FFF;font-weight:700;font-size:11.5px')}>✓ Valider toute la journée</button>
                        <button onClick={d.annulerTout} className="hvRedBg" style={S('cursor:pointer;padding:8px 15px;border-radius:999px;background:rgba(240,112,92,0.85);color:#FFF;font-weight:700;font-size:11.5px')}>Tout annuler</button>
                      </div>
                    </div>
                    <div style={S('padding:16px 20px 20px;display:flex;flex-direction:column')}>
                      {/* bateau qui ouvre la journée / l'après-midi */}
                      <div style={S('display:flex;gap:14px;flex-wrap:wrap;align-items:center;background:#F2F9FE;border:1px solid #DCEDF8;border-radius:16px;padding:10px 15px;margin-bottom:13px')}>
                        <div style={S('display:flex;align-items:center;gap:7px')}>
                          <span style={S('font-size:11px;font-weight:800;color:#5C7893;letter-spacing:0.04em')}>OUVRE LE MATIN</span>
                          {d.morningBtns.map((b) => (
                            <button key={b.label} onClick={b.set} style={S(`cursor:pointer;padding:6px 12px;border-radius:999px;background:${b.bg};color:${b.fg};border:1px solid ${b.border};font-weight:700;font-size:11px`)}>{b.label}</button>
                          ))}
                        </div>
                        <div style={S('display:flex;align-items:center;gap:7px')}>
                          <span style={S('font-size:11px;font-weight:800;color:#5C7893;letter-spacing:0.04em')}>REPREND L&apos;APRÈS-MIDI</span>
                          {d.pmBtns.map((b) => (
                            <button key={b.label} onClick={b.set} style={S(`cursor:pointer;padding:6px 12px;border-radius:999px;background:${b.bg};color:${b.fg};border:1px solid ${b.border};font-weight:700;font-size:11px`)}>{b.label}</button>
                          ))}
                        </div>
                        <div style={S('font-size:10.5px;color:#8FA9BE;flex:1;min-width:160px;text-align:right')}>Alternance auto : celui qui ouvre aujourd&apos;hui n&apos;ouvre pas demain</div>
                      </div>
                      <div className="pb-slots">
                      {loading && (
                        <div style={S('font-size:13.5px;color:#5C7893;padding:14px 0;animation:ef-pulse 1.6s infinite')}>Calcul de la marée…</div>
                      )}
                      {d.noSlots && (
                        <div style={S('background:#F2F9FE;border-radius:16px;padding:18px;font-size:14px;color:#5C7893')}>Aucune balade possible ce jour-là (fenêtre de marée hors horaires configurés).</div>
                      )}
                      <div style={S('display:flex;flex-direction:column;gap:9px')}>
                        {d.slots.map((s) => (
                          <div key={s.id} style={S(`border:1px solid ${s.border};background:${s.rowBg};border-radius:18px;padding:12px 15px;display:flex;align-items:center;gap:13px;flex-wrap:wrap`)}>
                            <div style={S('min-width:132px')}>
                              <div style={S('display:flex;align-items:baseline;gap:7px')}>
                                <div style={S(`font-family:'Sora',sans-serif;font-size:18px;font-weight:700;color:#0B2239;text-decoration:${s.timeDeco};opacity:${s.timeOpacity}`)}>{s.depLabel}</div>
                                <div style={S('font-size:12px;font-weight:700;color:#5C7893')}>{s.durLabel}</div>
                                {s.custom && <div style={S('font-size:9px;font-weight:800;letter-spacing:0.08em;background:#EAF6FD;color:#1D82C4;border-radius:999px;padding:2px 7px')}>MANUEL</div>}
                              </div>
                              <div style={S('font-size:11px;color:#8FA9BE;margin-top:2px')}>retour {s.endLabel} · {s.resaLabel}</div>
                            </div>
                            <button onClick={s.switchBoat} title="Changer de bateau" className="hvBorderBlue" style={S(`cursor:pointer;display:flex;align-items:center;gap:7px;padding:6px 13px;border-radius:999px;background:${s.boatBg};border:1px solid ${s.boatBorder};font-size:11.5px;font-weight:700;color:${s.boatFg}`)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 17 L21 17 L18.5 21 L5.5 21 Z"></path><path d="M12 5 L12 17"></path><path d="M12 7 C 15.5 8, 17.5 10.5, 18 14 L12 14 Z"></path></svg>
                              {s.boat} ⇄
                            </button>
                            <div style={S('flex:1;min-width:120px;font-size:12px;color:#5C7893;line-height:1.45')}>{s.meteoLabel}</div>
                            {s.isPrivatise ? (
                              <div style={S('padding:7px 14px;border-radius:999px;font-size:11.5px;font-weight:800;background:#E9E2F8;color:#5B3FA8;white-space:nowrap')}>Privatisé · bloqué</div>
                            ) : (
                              <div style={S('display:flex;gap:5px;align-items:center;flex-wrap:wrap')}>
                                <button onClick={s.setAssuree} style={S(`cursor:pointer;padding:7px 13px;border-radius:999px;font-weight:700;font-size:11px;background:${s.btnA.bg};color:${s.btnA.fg};border:1px solid ${s.btnA.border}`)}>Assurée</button>
                                <button onClick={s.setAttente} style={S(`cursor:pointer;padding:7px 13px;border-radius:999px;font-weight:700;font-size:11px;background:${s.btnW.bg};color:${s.btnW.fg};border:1px solid ${s.btnW.border}`)}>Attente</button>
                                <button onClick={s.setAnnulee} style={S(`cursor:pointer;padding:7px 13px;border-radius:999px;font-weight:700;font-size:11px;background:${s.btnX.bg};color:${s.btnX.fg};border:1px solid ${s.btnX.border}`)}>Annulée</button>
                                <button onClick={s.retirer} title="Retirer ce créneau" className="hvDel" style={S('cursor:pointer;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#B9D8EC')}>✕</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {d.isAnchor && (
                        <div style={S('margin-top:14px;border-top:1px dashed #CBE6F6;padding-top:14px;display:flex;gap:9px;align-items:center;flex-wrap:wrap')}>
                          <div style={S('font-size:12.5px;font-weight:700;color:#5C7893')}>Ajouter un créneau :</div>
                          <input type="time" ref={addTimeRef} style={S("padding:8px 13px;border:1px solid #A9D6EF;border-radius:999px;font-size:13px;background:#FFF;color:#0B2239")} />
                          <select ref={addDurRef} style={S("padding:8px 13px;border:1px solid #A9D6EF;border-radius:999px;font-size:13px;background:#FFF;color:#0B2239;font-family:'Instrument Sans',sans-serif")}>
                            <option value="30">30 min</option>
                            <option value="60">1 h</option>
                          </select>
                          <button onClick={addSlot} className="hvBlueBg" style={S('cursor:pointer;padding:8px 16px;border-radius:999px;background:#0B2239;color:#FFF;font-weight:700;font-size:12.5px')}>Ajouter</button>
                          <div style={S('font-size:12px;color:#C2432E;font-weight:700')}>{addSlotMsg}</div>
                        </div>
                      )}
                      </div>

                      {/* marée + météo du jour */}
                      <div className="pb-tide" style={S('margin-top:15px;border-top:1px dashed #CBE6F6;padding-top:15px;display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px;align-items:start')}>
                        <div style={S('background:#F7FBFE;border:1px solid #E4EFF7;border-radius:18px;padding:14px 16px 6px')}>
                          <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap')}>
                            <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:13.5px")}>La marée</div>
                            <div style={S('font-size:10.5px;color:#8FA9BE')}>fenêtres de sortie en bleu</div>
                          </div>
                          <TideSvg chart={d.chart} />
                          <div style={S('display:flex;gap:12px;flex-wrap:wrap;margin-top:2px;padding-bottom:8px')}>
                            {d.tideRows.map((t, i) => (
                              <div key={i} style={S('font-size:11.5px;color:#5C7893')}><span style={S(`font-weight:700;color:${t.color}`)}>{t.typeLabel}</span> {t.timeLabel} · {t.hLabel}</div>
                            ))}
                          </div>
                        </div>
                        <div style={S('background:#F7FBFE;border:1px solid #E4EFF7;border-radius:18px;padding:14px 16px')}>
                          <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:13.5px;margin-bottom:9px")}>Météo <span style={S('font-weight:500;color:#8FA9BE;font-size:11px')}>(à la pleine mer)</span></div>
                          {d.hasMeteo ? (
                            <>
                              <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:7px')}>
                                {d.meteoTiles.map((t) => (
                                  <div key={t.k} style={S('background:#FFFFFF;border:1px solid #E4EFF7;border-radius:13px;padding:9px 11px')}>
                                    <div style={S('font-size:9.5px;letter-spacing:0.08em;text-transform:uppercase;color:#1D82C4;font-weight:700')}>{t.k}</div>
                                    <div style={S("font-family:'Sora',sans-serif;font-size:14.5px;font-weight:700;margin-top:2px;color:#0B2239")}>{t.v}</div>
                                    <div style={S('font-size:10px;color:#5C7893')}>{t.sub}</div>
                                  </div>
                                ))}
                              </div>
                              <div style={S(`margin-top:10px;background:${d.adviceBg};border:1px solid ${d.adviceBorder};border-radius:13px;padding:10px 13px;font-size:11.5px;font-weight:600;color:${d.adviceFg};line-height:1.5`)}>{d.advice}</div>
                            </>
                          ) : (
                            <div style={S('font-size:12px;color:#8FA9BE;animation:ef-pulse 1.6s infinite')}>Météo disponible ~10 jours à l&apos;avance…</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* PÊCHES EN MER */}
                <div style={S('background:#FFFFFF;border:1px solid #CBE6F6;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(20,93,160,0.08)')}>
                  <div style={S('background:linear-gradient(115deg,#1D82C4,#4FB3E8);color:#FFFFFF;padding:16px 24px;display:flex;align-items:center;gap:12px')}>
                    <span style={S('display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2)')}>
                      <svg width="20" height="20" viewBox="0 0 34 20" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round"><path d="M2 10 C 8 3, 18 3, 24 10 C 18 17, 8 17, 2 10 Z"></path><path d="M24 10 L 31 4 L 29 10 L 31 16 Z"></path><circle cx="8" cy="9" r="1.1" fill="#FFFFFF"></circle></svg>
                    </span>
                    <div style={S('flex:1')}>
                      <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:16px")}>Sorties pêche en mer</div>
                      <div style={S('font-size:11.5px;color:rgba(255,255,255,0.85)')}>Publiées sur la page « Pêche en mer » du site · L&apos;Étoile Filante en général</div>
                    </div>
                  </div>
                  <div style={S('padding:18px 20px 20px')}>
                    <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:10px')}>
                      <input type="date" ref={pecheDateRef} style={S(inputStyle)} />
                      <input type="time" ref={pecheTimeRef} style={S(inputStyle)} />
                      <select ref={pecheStatusRef} style={S(inputStyle)}>
                        <option value="attente">Places disponibles</option>
                        <option value="confirme">Départ confirmé</option>
                        <option value="complet">Complet</option>
                      </select>
                      <input type="text" ref={pecheNoteRef} placeholder="Note (bateau, groupe…)" style={S(inputStyle)} />
                    </div>
                    <button onClick={addPeche} className="hvNavyBg" style={S('cursor:pointer;padding:9px 17px;border-radius:999px;background:#1D82C4;color:#FFF;font-weight:700;font-size:12.5px')}>+ Publier la sortie pêche</button>
                    <div style={S('display:flex;flex-direction:column;gap:8px;margin-top:14px')}>
                      {peches.map((p) => (
                        <div key={p.id} style={S('display:flex;align-items:center;gap:12px;background:#F2F9FE;border:1px solid #DCEDF8;border-radius:16px;padding:10px 15px')}>
                          <div style={S("font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#0B2239;min-width:120px;text-transform:capitalize")}>{p.dateLabel}</div>
                          <div style={S('font-size:12.5px;font-weight:700;color:#1D82C4;min-width:52px')}>{p.timeLabel}</div>
                          <div style={S('flex:1;font-size:12px;color:#5C7893')}>{p.note}</div>
                          <div style={S(`padding:5px 12px;border-radius:999px;font-size:11px;font-weight:800;background:${p.chipBg};color:${p.chipFg}`)}>{p.chipLabel}</div>
                          <button onClick={p.remove} className="hvDel" style={S('cursor:pointer;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#B9D8EC;font-weight:700')}>✕</button>
                        </div>
                      ))}
                    </div>
                    {peches.length === 0 && (
                      <div style={S('margin-top:12px;font-size:12.5px;color:#8FA9BE')}>Aucune sortie pêche programmée · la page du site affiche « appelez pour constituer un groupe ».</div>
                    )}
                  </div>
                </div>

                {/* PRIVATISATIONS / GROUPES */}
                <div style={S('background:#FFFFFF;border:1px solid #CBE6F6;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(20,93,160,0.08)')}>
                  <div style={S('background:linear-gradient(115deg,#5B3FA8,#7B5FC8);color:#FFFFFF;padding:16px 24px;display:flex;align-items:center;gap:12px')}>
                    <span style={S('display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2)')}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="5.5" width="17" height="15" rx="3"></rect><line x1="3.5" y1="10" x2="20.5" y2="10"></line><line x1="8.5" y1="3.5" x2="8.5" y2="7"></line><line x1="15.5" y1="3.5" x2="15.5" y2="7"></line></svg>
                    </span>
                    <div style={S('flex:1')}>
                      <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:16px")}>Privatisations &amp; groupes</div>
                      <div style={S('font-size:11.5px;color:rgba(255,255,255,0.85)')}>Scolaires, événements… Le créneau est bloqué au planning pour le bateau choisi</div>
                    </div>
                  </div>
                  <div style={S('padding:18px 20px 20px')}>
                    <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:10px')}>
                      <input type="date" ref={privaFromRef} title="Du" style={S(inputStyle)} />
                      <input type="date" ref={privaToRef} title="Au (optionnel)" style={S(inputStyle)} />
                      <input type="time" ref={privaTimeFromRef} title="De" style={S(inputStyle)} />
                      <input type="time" ref={privaTimeToRef} title="À" style={S(inputStyle)} />
                      <select ref={privaBoatRef} style={S(inputStyle)}>
                        <option value="L'EDEN">L&apos;EDEN</option>
                        <option value="L'Étoile Filante">L&apos;Étoile Filante</option>
                        <option value="Les deux bateaux">Les deux bateaux</option>
                      </select>
                      <input type="text" ref={privaLabelRef} placeholder="Qui ? (école, mariage…)" style={S(inputStyle)} />
                    </div>
                    <button onClick={addPriva} className="hvPurpleBg" style={S('cursor:pointer;padding:9px 17px;border-radius:999px;background:#5B3FA8;color:#FFF;font-weight:700;font-size:12.5px')}>+ Bloquer le créneau</button>
                    <div style={S('font-size:12px;color:#C2432E;font-weight:700;display:inline-block;margin-left:10px')}>{privaMsg}</div>
                    <div style={S('display:flex;flex-direction:column;gap:8px;margin-top:14px')}>
                      {privas.map((p) => (
                        <div key={p.id} style={S('display:flex;align-items:center;gap:12px;background:#F6F3FC;border:1px solid #E2D9F5;border-radius:16px;padding:10px 15px')}>
                          <div style={S("font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#5B3FA8;min-width:150px")}>{p.periodLabel}</div>
                          <div style={S('font-size:12.5px;font-weight:700;color:#0B2239;min-width:96px')}>{p.timeLabel}</div>
                          <div style={S('font-size:12px;font-weight:700;color:#5C7893;min-width:110px')}>{p.boat}</div>
                          <div style={S('flex:1;font-size:12px;color:#5C7893')}>{p.label}</div>
                          <button onClick={p.remove} className="hvDel" style={S('cursor:pointer;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#C7B8E8;font-weight:700')}>✕</button>
                        </div>
                      ))}
                    </div>
                    {privas.length === 0 && (
                      <div style={S('margin-top:12px;font-size:12.5px;color:#8FA9BE')}>Aucune privatisation à venir.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* ====== COLONNE DROITE ====== */}
              <div style={S('display:flex;flex-direction:column;gap:16px;min-width:0')}>
                {/* RÉGLAGES HORAIRES */}
                <div style={S('background:#FFFFFF;border:1px solid #CBE6F6;border-radius:24px;padding:20px 22px;box-shadow:0 10px 30px rgba(20,93,160,0.08)')}>
                  <div style={S('display:flex;align-items:center;gap:10px;margin-bottom:12px')}>
                    <span style={S('display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#EAF6FD')}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7 L12 12 L15.5 14"></path></svg>
                    </span>
                    <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:15px")}>Amplitude des balades</div>
                  </div>
                  <div style={S('font-size:12px;color:#5C7893;line-height:1.6;margin-bottom:12px')}>Aucun départ ne sera proposé avant l&apos;heure « min » ni après l&apos;heure « max », quelle que soit la marée.</div>
                  <div style={S('display:flex;gap:10px;align-items:center;flex-wrap:wrap')}>
                    <div style={S('display:flex;align-items:center;gap:8px;background:#F2F9FE;border-radius:999px;padding:7px 14px')}>
                      <span style={S('font-size:11.5px;font-weight:800;color:#1D82C4')}>PAS AVANT</span>
                      <input type="time" ref={cfgFromRef} defaultValue={cfg.noBefore || ''} style={S('padding:5px 9px;border:1px solid #A9D6EF;border-radius:999px;font-size:12.5px;background:#FFF;color:#0B2239')} />
                    </div>
                    <div style={S('display:flex;align-items:center;gap:8px;background:#F2F9FE;border-radius:999px;padding:7px 14px')}>
                      <span style={S('font-size:11.5px;font-weight:800;color:#1D82C4')}>PAS APRÈS</span>
                      <input type="time" ref={cfgToRef} defaultValue={cfg.noAfter || ''} style={S('padding:5px 9px;border:1px solid #A9D6EF;border-radius:999px;font-size:12.5px;background:#FFF;color:#0B2239')} />
                    </div>
                    <button onClick={saveCfg} className="hvBlueBg" style={S('cursor:pointer;padding:8px 16px;border-radius:999px;background:#0B2239;color:#FFF;font-weight:700;font-size:12.5px')}>Appliquer</button>
                    <div style={S('font-size:12px;color:#0F7A47;font-weight:700')}>{cfgMsg}</div>
                  </div>
                </div>

                {/* BANDEAU SITE */}
                <div style={S('background:#FFFFFF;border:1px solid #CBE6F6;border-radius:24px;padding:20px 22px;box-shadow:0 10px 30px rgba(20,93,160,0.08)')}>
                  <div style={S('display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:11px;flex-wrap:wrap')}>
                    <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:15px")}>Bandeau d&apos;information du site</div>
                    <button onClick={toggleBanner} style={S(`cursor:pointer;padding:7px 15px;border-radius:999px;font-weight:700;font-size:11px;background:${banner.on ? '#2BB673' : '#FFFFFF'};color:${banner.on ? '#FFFFFF' : '#5C7893'};border:1px solid ${banner.on ? '#2BB673' : '#A9D6EF'}`)}>{banner.on ? 'Affiché sur le site' : 'Masqué'}</button>
                  </div>
                  <input type="text" ref={bannerRef} defaultValue={banner.text || ''} placeholder="Ex. : Mer agitée cet après-midi · sorties de 16h annulées." style={S("width:100%;padding:11px 17px;border:1px solid #A9D6EF;border-radius:999px;font-size:13.5px;font-family:'Instrument Sans',sans-serif;background:#FFF;color:#0B2239")} />
                  <div style={S('display:flex;align-items:center;gap:11px;margin-top:11px')}>
                    <button onClick={saveBanner} className="hvBlueBg" style={S('cursor:pointer;padding:8px 16px;border-radius:999px;background:#0B2239;color:#FFF;font-weight:700;font-size:12.5px')}>Publier</button>
                    <div style={S('font-size:12px;color:#0F7A47;font-weight:700')}>{bannerMsg}</div>
                  </div>
                </div>

                {/* CARNET */}
                <div style={S('background:#FFFFFF;border:1px solid #CBE6F6;border-radius:24px;padding:20px 22px;box-shadow:0 10px 30px rgba(20,93,160,0.08)')}>
                  <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:15px;margin-bottom:3px")}>Carnet de réservations</div>
                  <div style={S('font-size:11.5px;color:#8FA9BE;margin-bottom:12px')}>Téléphone · <span style={S('text-transform:capitalize')}>{EF.fmtDateShort(selDate)}</span> · {resaTotal}</div>
                  <div style={S('display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin-bottom:9px')}>
                    <input type="text" ref={resaNameRef} placeholder="Nom" style={S("min-width:0;width:100%;padding:9px 15px;border:1px solid #A9D6EF;border-radius:999px;font-size:13px;background:#FFF;color:#0B2239")} />
                    <input type="tel" ref={resaTelRef} placeholder="Téléphone" style={S("min-width:0;width:100%;padding:9px 15px;border:1px solid #A9D6EF;border-radius:999px;font-size:13px;background:#FFF;color:#0B2239")} />
                    <select ref={resaSlotRef} style={S("min-width:0;width:100%;padding:9px 15px;border:1px solid #A9D6EF;border-radius:999px;font-size:13px;background:#FFF;color:#0B2239;font-family:'Instrument Sans',sans-serif")}>
                      {slotOptions.map((o) => (
                        <option key={o.id} value={o.id}>{o.label}</option>
                      ))}
                    </select>
                    <input type="number" ref={resaPaxRef} placeholder="Nb pers." min="1" style={S("min-width:0;width:100%;padding:9px 15px;border:1px solid #A9D6EF;border-radius:999px;font-size:13px;background:#FFF;color:#0B2239")} />
                  </div>
                  <button onClick={addResa} className="hvGreenBg" style={S('cursor:pointer;padding:9px 17px;border-radius:999px;background:#2BB673;color:#FFF;font-weight:700;font-size:12.5px')}>+ Noter la réservation</button>
                  <div style={S('display:flex;flex-direction:column;gap:7px;margin-top:13px')}>
                    {resasDay.map((r) => (
                      <div key={r.id} style={S('display:flex;align-items:center;gap:11px;background:#F2F9FE;border-radius:14px;padding:9px 14px')}>
                        <div style={S("font-family:'Sora',sans-serif;font-size:12.5px;font-weight:700;color:#0B2239;min-width:56px")}>{r.slotLabel}</div>
                        <div style={S('flex:1;min-width:0')}>
                          <div style={S('font-weight:700;font-size:13px;color:#0B2239')}>{r.name} <span style={S('font-weight:500;color:#5C7893')}>· {r.pax} pers.</span></div>
                          <div style={S('font-size:11.5px;color:#8FA9BE')}>{r.tel}</div>
                        </div>
                        <button onClick={() => EF.setState({ resas: (EF.getState().resas || []).filter((x) => x.id !== r.id) })} className="hvDel" style={S('cursor:pointer;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#B9D8EC;font-weight:700')}>✕</button>
                      </div>
                    ))}
                  </div>
                  {resasDay.length === 0 && (
                    <div style={S('margin-top:12px;font-size:12.5px;color:#8FA9BE')}>Aucune réservation notée pour ce jour.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============================ VUE CALENDRIER ============================ */}
        {view === 'calendrier' && (
          <div style={S('background:#FFFFFF;border:1px solid #CBE6F6;border-radius:24px;padding:24px 26px;box-shadow:0 10px 30px rgba(20,93,160,0.08)')}>
            <div style={S('display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px')}>
              <div className="week-nav" style={S('display:flex;align-items:center;gap:16px')}>
                <button onClick={() => setCalMonth(new Date(calBase.getFullYear(), calBase.getMonth() - 1, 1))} className="hvD6" style={S('cursor:pointer;width:38px;height:38px;border-radius:50%;background:#EAF6FD;color:#1D82C4;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none')}>←</button>
                <div className="week-label" style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:20px;text-transform:capitalize;min-width:190px;text-align:center")}>{MONTHS_FR[calBase.getMonth()] + ' ' + calBase.getFullYear()}</div>
                <button onClick={() => setCalMonth(new Date(calBase.getFullYear(), calBase.getMonth() + 1, 1))} className="hvD6" style={S('cursor:pointer;width:38px;height:38px;border-radius:50%;background:#EAF6FD;color:#1D82C4;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex:none')}>→</button>
              </div>
              <div style={S('margin-left:auto;font-size:12px;color:#8FA9BE;max-width:420px;line-height:1.5')}>Marées calculées toute l&apos;année (estimation harmonique locale, à confirmer avec l&apos;annuaire SHOM). Météo affichée dès qu&apos;elle est disponible (~10 jours à l&apos;avance). <strong style={S('color:#5C7893')}>Cliquez un jour pour afficher son graphique.</strong></div>
            </div>

            {/* Graphique du jour sélectionné */}
            {!!calChart && (
              <div style={S('background:#F2F9FE;border:1.5px solid #A9D6EF;border-radius:20px;padding:16px 20px 8px;margin-bottom:18px')}>
                <div style={S('display:flex;align-items:baseline;gap:14px;flex-wrap:wrap')}>
                  <div style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:17px;text-transform:capitalize")}>{calSelLabel}</div>
                  <div style={S('padding:5px 14px;border-radius:999px;background:#FFFFFF;border:1px solid #CBE6F6;font-size:12px;font-weight:800;color:#1D82C4')}>coefficient {calSelCoef}</div>
                  <div style={S('font-size:11.5px;color:#8FA9BE')}>{calSelNote}</div>
                  <button onClick={() => setCalSel(null)} className="hvDel" style={S('cursor:pointer;margin-left:auto;width:30px;height:30px;border-radius:50%;background:#FFFFFF;border:1px solid #CBE6F6;color:#5C7893;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px')}>✕</button>
                </div>
                <TideSvg chart={calChart} />
                <div style={S('display:flex;gap:14px;flex-wrap:wrap;margin-top:2px;padding-bottom:8px')}>
                  {calTideRows.map((t, i) => (
                    <div key={i} style={S('font-size:12px;color:#5C7893')}><span style={S(`font-weight:700;color:${t.color}`)}>{t.typeLabel}</span> {t.timeLabel} · {t.hLabel}</div>
                  ))}
                </div>
              </div>
            )}

            <div style={S('display:grid;grid-template-columns:repeat(auto-fill,minmax(172px,1fr));gap:10px')}>
              {calDays.map((d) => (
                <button key={d.dk} onClick={d.select} className="hvSkyBorder" style={S(`cursor:pointer;background:${d.bg};border:1.5px solid ${d.border};border-radius:16px;padding:11px 13px;display:flex;flex-direction:column;gap:6px`)}>
                  <div style={S('display:flex;justify-content:space-between;align-items:baseline;width:100%')}>
                    <div style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:15px;color:#0B2239")}>{d.dayLabel}</div>
                    <div style={S(`font-size:10.5px;font-weight:800;color:${d.coefColor}`)}>coef {d.coef}</div>
                  </div>
                  <div style={S('display:flex;flex-direction:column;gap:2px')}>
                    {d.pms.map((pm, i) => (
                      <div key={i} style={S('font-size:11.5px;color:#5C7893')}><span style={S('font-weight:700;color:#0F7A47')}>PM</span> {pm}</div>
                    ))}
                  </div>
                  <div style={S('font-size:11px;color:#1D82C4;font-weight:600')}>{d.meteoLabel}</div>
                  {d.hasPriva && (
                    <div style={S('font-size:10px;font-weight:800;background:#E9E2F8;color:#5B3FA8;border-radius:999px;padding:3px 9px;align-self:flex-start')}>{d.privaLabel}</div>
                  )}
                  {d.hasPeche && (
                    <div style={S('font-size:10px;font-weight:800;background:#DCF3FF;color:#1D82C4;border-radius:999px;padding:3px 9px;align-self:flex-start')}>Pêche {d.pecheTime}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={S('margin-top:20px;text-align:center;font-size:11.5px;color:#8FA9BE;line-height:1.6')}>Pensez à valider les sorties du lendemain chaque soir. {sourceShort}.</div>
      </main>
    </div>
  );
}
