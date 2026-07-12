'use client';

/* Site public — portage fidèle de « Site Étoile Filante v3.dc.html ».
   SPA : la navigation change l'état `page` (comme la maquette), sans rechargement. */

import { useEffect, useState } from 'react';
import { S } from '@/lib/s';
import { tideChart } from '@/lib/chart';
import * as EF from '@/lib/ef-core';
import type { EFData, EFState } from '@/lib/ef-core';

type Page = 'accueil' | 'balades' | 'peche' | 'evenements' | 'tarifs' | 'infos' | 'contact';

const TELEPHONE = '06 38 69 03 67';
const TEL_HREF = TELEPHONE.replace(/\s/g, '');
const AFFICHER_DEMAIN = true;

const WIX = (id: string) =>
  'https://static.wixstatic.com/media/' + id + '/v1/fill/w_1100,h_720,al_c,q_85/' + id;

/* Décoration des créneaux selon leur statut (chips de l'ardoise) */
const DECOR: Record<string, { lbl: string; bg: string; fg: string; deco: string; op: number }> = {
  assuree: { lbl: 'Sortie assurée', bg: '#DFF3E8', fg: '#0F7A47', deco: 'none', op: 1 },
  attente: { lbl: 'Sous réserve météo', bg: '#FBF3DC', fg: '#8A6A1B', deco: 'none', op: 1 },
  annulee: { lbl: 'Annulée', bg: '#FBE7E2', fg: '#C2432E', deco: 'line-through', op: 0.55 },
};
function decorate(slots: EF.DaySlot[]) {
  return slots.map((s) => {
    const m = DECOR[s.status] || DECOR.attente;
    return { ...s, statusLabel: m.lbl, chipBg: m.bg, chipFg: m.fg, timeDeco: m.deco, pillOpacity: m.op };
  });
}

/* Petit poisson SVG au trait (récurrent dans la maquette) */
function Fish({
  width, height, stroke, strokeWidth, style,
}: { width: number; height: number; stroke: string; strokeWidth: number; style?: React.CSSProperties }) {
  return (
    <svg width={width} height={height} viewBox="0 0 34 20" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" style={style}>
      <path d="M2 10 C 8 3, 18 3, 24 10 C 18 17, 8 17, 2 10 Z"></path>
      <path d="M24 10 L 31 4 L 29 10 L 31 16 Z"></path>
      <circle cx="8" cy="9" r="1.1" fill={stroke}></circle>
    </svg>
  );
}
/* Bateau SVG au trait */
function Boat({ size, stroke }: { size: number; stroke: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 17 L21 17 L18.5 21 L5.5 21 Z"></path>
      <path d="M12 4 L12 17"></path>
      <path d="M12 6 C 16 7, 18 10, 18.5 14 L12 14 Z"></path>
    </svg>
  );
}

export default function SiteApp() {
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState<Page>('accueil');
  const [data, setData] = useState<EFData | null>(null);
  const [admin, setAdmin] = useState<EFState>({});
  const [now, setNow] = useState(() => new Date());
  const [faqOpen, setFaqOpen] = useState(-1);
  const [vw, setVw] = useState(1200);
  const [menuOpen, setMenuOpen] = useState(false);
  const [prestaMenuOpen, setPrestaMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVw(window.innerWidth);
    setNow(new Date());
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    const onState = () => setAdmin(EF.getState());
    window.addEventListener('ef-state', onState);
    window.addEventListener('storage', onState);
    const tick = setInterval(() => setNow(new Date()), 60e3);
    setAdmin(EF.getState());
    EF.load(4)
      .then(setData)
      .catch(() => setData({ error: true, extremes: [] } as unknown as EFData));
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('ef-state', onState);
      window.removeEventListener('storage', onState);
      clearInterval(tick);
    };
  }, []);

  const go = (p: Page) => (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setPage(p);
    setFaqOpen(-1);
    setMenuOpen(false);
    setPrestaMenuOpen(false);
    window.scrollTo(0, 0);
  };
  const goArdoise = (e: React.MouseEvent) => {
    if (page !== 'accueil') {
      e.preventDefault();
      setPage('accueil');
      setMenuOpen(false);
      window.scrollTo(0, 0);
    } else {
      setMenuOpen(false);
    }
  };

  if (!mounted) return <div style={S('min-height:100vh;background:#DFF1FB')} />;

  /* ---------- calculs (équivalent renderVals de la maquette) ---------- */
  const isDesktop = vw >= 1020;
  const loading = !data;
  let slotsToday: ReturnType<typeof decorate> = [];
  let slotsDemain: ReturnType<typeof decorate> = [];
  let chart: ReturnType<typeof tideChart> = null;
  if (data && !data.error) {
    const demain = new Date(now.getTime() + 864e5);
    slotsToday = decorate(EF.daySlots(data, now, admin));
    slotsDemain = decorate(EF.daySlots(data, demain, admin));
    chart = tideChart(data, now, now);
  }

  // Disponibilité météo (utilisée par la carte « Météo du jour »)
  const hasMeteo = !!(data && data.weather && EF.weatherAt(data.weather, now));

  const coefs = chart
    ? chart.extremesToday
        .filter((e) => e.typeLabel === 'Pleine mer')
        .map((e) => (e.hLabel.match(/coef (\d+)/) || [])[1])
        .filter(Boolean)
    : [];
  const coefToday = coefs.length ? coefs.join(' / ') : '—';
  const banner = admin.banner || { text: '', on: false };
  const todayLabel = EF.fmtDateLong(now);
  const demainLabel = EF.fmtDateShort(new Date(now.getTime() + 864e5));
  const showDemain = AFFICHER_DEMAIN && !loading && slotsDemain.length > 0;

  /* météo du jour (carte style iPhone) */
  const wNow = data && data.weather ? EF.weatherAt(data.weather, now) : null;
  const waveNow = data ? EF.waveAt(data.marineWave, now) : null;
  const code = wNow ? wNow.code : -1;
  const wxSun = code === 0 || code === 1;
  const wxPartly = code === 2;
  const wxCloud = code === 3;
  const wxRain = (code >= 51 && code <= 67) || (code >= 80 && code <= 86) || (code >= 71 && code <= 77);
  const wxStorm = code >= 95;
  const wxFog = code === 45 || code === 48;
  const wxIconColor = wxSun ? '#F2B824' : wxStorm ? '#5B3FA8' : wxRain ? '#4FB3E8' : wxPartly ? '#D9A62B' : '#8FA9BE';
  const wxTemp = wNow ? wNow.temp + '°' : '—';
  const wxLabel = wNow ? wNow.label : '';
  const wxWind = wNow ? wNow.wind + ' km/h ' + wNow.dir : '—';
  const wxGust = wNow ? wNow.gust + ' km/h' : '—';
  const wxWave = waveNow == null ? '—' : String(waveNow).replace('.', ',') + ' m';

  const sourceLabel = !data
    ? ''
    : data.source === 'api'
      ? 'Marées : Open-Meteo · modèle Copernicus GTSM · Météo : Open-Meteo (données officielles, actualisées en continu)'
      : 'Marées : estimation harmonique locale (données temps réel momentanément indisponibles)';

  const faqData: [string, string][] = [
    ['Pourquoi les horaires changent-ils tous les jours ?', "Le port du Tréport s'assèche à marée basse : les bateaux ne peuvent sortir que de 2h40 avant à 3h00 après la pleine mer. Comme la marée se décale d'environ 50 minutes par jour, les horaires de balade changent chaque jour · c'est pour ça que cette page les calcule automatiquement."],
    ['Et si la météo est mauvaise ?', "Le capitaine confirme ou annule chaque sortie la veille selon le vent et l'état de la mer. Le statut de chaque départ est affiché en direct sur la page d'accueil, et les annulations de dernière minute sont publiées sur Facebook."],
    ['Où embarque-t-on ? Où se garer ?', "Embarquement au quai François 1ᵉʳ, face à la billetterie. Parkings au quai Sud et sur l'esplanade de la plage, à 5 minutes à pied. En été, venez 20 minutes en avance."],
    ['Le funiculaire, ça marche comment ?', "Le funiculaire gratuit du Tréport relie la ville haute (falaises) au port en 3 minutes. Pratique si vous logez en haut : descendez, la billetterie est à 300 m de la station basse."],
    ['Les animaux sont-ils acceptés ?', 'Oui, les animaux sont acceptés à bord, tenus en laisse.'],
    ['Faut-il réserver ?', "Pour les balades, les billets s'achètent à la billetterie du quai le jour même · la réservation par téléphone est conseillée en plein été. Pour la pêche en mer (groupe de 7 minimum), la réservation au " + TELEPHONE + ' est obligatoire.'],
    ['À partir de quel âge ?', 'Dès le plus jeune âge : gratuit pour les moins de 4 ans, gilets adaptés à bord. La balade de 30 minutes est idéale pour une première fois avec de jeunes enfants.'],
  ];

  const tarifCards = [
    { title: 'Balade 30 min', sub: 'Départ et retour à la billetterie', bg: '#FFFFFF', fg: '#0B2239', border: '#DCEDF8', rowLine: '#E4EFF7',
      rows: [{ k: 'Adulte (+ de 11 ans)', v: '10 €' }, { k: 'Enfant (− de 11 ans)', v: '8 €' }, { k: 'Bébé (− de 3 ans)', v: 'Gratuit' }],
      note: 'Billets à la billetterie du quai, le jour même.' },
    { title: 'Balade 1 h', sub: "Jusqu'au Bois de Cise · retour Office de Tourisme", bg: '#0B2239', fg: '#FFFFFF', border: '#0B2239', rowLine: 'rgba(255,255,255,0.18)',
      rows: [{ k: 'Adulte (+ de 11 ans)', v: '15 €' }, { k: 'Enfant (− de 11 ans)', v: '10 €' }, { k: 'Bébé (− de 3 ans)', v: 'Gratuit' }],
      note: "La plus demandée en été · retour à l'Office de Tourisme du Tréport (800 m de la billetterie)." },
    { title: 'Pêche en mer · 6 h', sub: 'Groupe de 7 pêcheurs minimum', bg: '#FFFFFF', fg: '#0B2239', border: '#DCEDF8', rowLine: '#E4EFF7',
      rows: [{ k: 'Par personne', v: '60 €' }, { k: 'Location de canne à pêche', v: '12 €' }],
      note: 'Prévoyez bottes et glacière : vous repartez avec vos poissons ! Réservation au ' + TELEPHONE + '.' },
    { title: 'Privatisation', sub: 'Le ou les bateaux, pour une occasion', bg: '#FFFFFF', fg: '#0B2239', border: '#DCEDF8', rowLine: '#E4EFF7',
      rows: [{ k: 'Privatisation 30 minutes', v: '300 €' }, { k: 'Privatisation 1 heure', v: '600 €' }],
      note: "Dispersion de cendres en mer, enterrement de vie de célibataire, vin d'honneur…" },
  ];
  const paiements = ['Carte bleue', 'Espèces', 'Chèques', 'Chèques Vacances', 'Sans contact', 'Visa / Mastercard'];

  /* prochaines sorties pêche (publiées par le back-office) */
  const MONTHS_ABBR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0);
  const pechesAvenir = (admin.peches || [])
    .filter((p) => p.date && new Date(p.date + 'T23:59:59') >= today0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 6)
    .map((p) => {
      const d = new Date(p.date + 'T12:00:00');
      const st = p.status || 'attente';
      return {
        id: p.id,
        day: d.getDate(), month: MONTHS_ABBR[d.getMonth()],
        dayLabel: EF.fmtDateShort(d),
        time: p.time ? p.time.replace(':', 'h') : '6h00',
        note: p.note || "L'Étoile Filante · 6 heures",
        chipLabel: st === 'complet' ? 'Complet' : st === 'confirme' ? 'Départ confirmé' : 'Places disponibles',
        chipBg: st === 'complet' ? '#FBE7E2' : st === 'confirme' ? '#DFF3E8' : '#FBF3DC',
        chipFg: st === 'complet' ? '#C2432E' : st === 'confirme' ? '#0F7A47' : '#8A6A1B',
      };
    });

  const pages: [Page, string][] = [
    ['accueil', 'Accueil'], ['balades', 'Balades en mer'], ['peche', 'Pêche en mer'],
    ['evenements', 'Événements'], ['tarifs', 'Tarifs'], ['infos', 'Infos pratiques'], ['contact', 'Contact'],
  ];
  const mobileNavItems = pages.map(([id, label], i) => ({
    id, label, num: '0' + (i + 1),
    color: page === id ? '#1D82C4' : '#0B2239',
  }));
  const navColor = (active: boolean) => (active ? '#FFFFFF' : 'rgba(255,255,255,0.72)');
  const navLine = (active: boolean) => (active ? '#4FB3E8' : 'transparent');
  const isPresta = ['balades', 'peche', 'evenements'].indexOf(page) >= 0;

  const marqueePhotos = [
    ['/uploads/IMG_1296.jpg', "L'Étoile Filante pavoisée"],
    ['/uploads/557359461_1300992931813752_8519210241802143735_n.jpg', 'Les deux bateaux en mer'],
    ['/uploads/489852318_1545069553206137_8951543170285698201_n.jpg', 'Les falaises et le funiculaire du Tréport'],
    ['/uploads/480689857_1133889561857424_778771142117709038_n.jpg', 'Le phare du Tréport'],
    ['/uploads/679452210_1893613361685086_61712237109849653_n.jpg', "L'Étoile Filante devant les falaises"],
    ['/uploads/516615855_1631783037868121_8439297537344777529_n.jpg', "La côte d'albâtre vue des falaises"],
    ['/uploads/IMG_1320.jpg', 'Mers-les-Bains vue du large'],
    ['/uploads/518207258_1636985877347837_501752820138468060_n.jpg', 'Feu d’artifice sur le port'],
  ];

  return (
    <div style={S('min-height:100vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#D8EEFA 0%,#F7FCFF 30%,#FFFFFF 55%,#EAF6FD 100%);position:relative;overflow:hidden')}>
      {/* texture marine de fond */}
      <div style={S('position:absolute;top:620px;left:-180px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,rgba(79,179,232,0.14),rgba(79,179,232,0) 70%);pointer-events:none')}></div>
      <div style={S('position:absolute;top:1500px;right:-220px;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle,rgba(29,130,196,0.10),rgba(29,130,196,0) 70%);pointer-events:none')}></div>

      {/* ======================= BANDEAU ADMIN ======================= */}
      {!!(banner.on && banner.text) && (
        <div style={S('background:#0B2239;color:#FFFFFF;padding:11px 20px;text-align:center;font-size:13.5px;font-weight:600;letter-spacing:0.01em')}>
          <span style={S('display:inline-block;width:7px;height:7px;border-radius:50%;background:#4FB3E8;margin-right:9px;vertical-align:1px')}></span>
          {banner.text}
        </div>
      )}

      {/* ======================= HEADER ======================= */}
      <header style={S('position:sticky;top:0;z-index:60;background:rgba(11,34,57,0.94);backdrop-filter:blur(14px);border-bottom:1px solid rgba(79,179,232,0.35);box-shadow:0 24px 54px rgba(11,34,57,0.45)')}>
        <div style={S('max-width:1240px;margin:0 auto;padding:0 24px;display:flex;align-items:center;gap:28px;height:74px')}>
          <a href="#" onClick={go('accueil')} style={S('display:flex;flex-direction:column;gap:1px;text-decoration:none;color:#FFFFFF;flex:none')}>
            <span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:16.5px;letter-spacing:0.01em;white-space:nowrap;color:#FFFFFF")}>
              Étoile Filante <span style={S('color:#4FB3E8')}>✦</span> L&apos;EDEN
            </span>
            <span style={S('font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:#9ED4F2')}>Promenades en mer · Le Tréport</span>
          </a>
          {isDesktop && (
            <>
              <nav style={S('display:flex;align-items:center;gap:32px;margin:0 auto')}>
                <a href="#" onClick={go('accueil')} className="hvWhite" style={S(`padding:26px 0;font-size:13px;font-weight:600;letter-spacing:0.02em;color:${navColor(page === 'accueil')};text-decoration:none;border-bottom:2px solid ${navLine(page === 'accueil')};margin-bottom:-2px`)}>Accueil</a>
                <div style={S('position:relative')}>
                  <button onClick={() => setPrestaMenuOpen(!prestaMenuOpen)} className="hvWhite" style={S(`cursor:pointer;display:flex;align-items:center;gap:7px;padding:26px 0;font-size:13px;font-weight:600;letter-spacing:0.02em;color:${navColor(isPresta)};border-bottom:2px solid ${navLine(isPresta)};margin-bottom:-2px`)}>
                    Prestations
                    <svg width="10" height="7" viewBox="0 0 10 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ transform: `rotate(${prestaMenuOpen ? '180deg' : '0deg'})`, transition: 'transform 0.2s' }}>
                      <path d="M1 1.5 L5 5.5 L9 1.5"></path>
                    </svg>
                  </button>
                  {prestaMenuOpen && (
                    <div style={S('position:absolute;top:calc(100% + 2px);left:50%;transform:translateX(-50%);background:#FFFFFF;border:1px solid #DCEDF8;border-radius:18px;box-shadow:0 24px 60px rgba(11,34,57,0.28);padding:8px;min-width:250px;display:flex;flex-direction:column;gap:2px')}>
                      <a href="#" onClick={go('balades')} className="hvSkyBg" style={S('display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;text-decoration:none;color:#0B2239')}>
                        <span style={S('display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#EAF6FD;flex:none')}><Boat size={16} stroke="#1D82C4" /></span>
                        <span><span style={S('display:block;font-weight:700;font-size:13.5px')}>Balades en mer</span><span style={S('display:block;font-size:11px;color:#8FA9BE')}>30 min ou 1 h, commentées</span></span>
                      </a>
                      <a href="#" onClick={go('peche')} className="hvSkyBg" style={S('display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;text-decoration:none;color:#0B2239')}>
                        <span style={S('display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#EAF6FD;flex:none')}><Fish width={17} height={17} stroke="#1D82C4" strokeWidth={2} /></span>
                        <span><span style={S('display:block;font-weight:700;font-size:13.5px')}>Pêche en mer</span><span style={S('display:block;font-size:11px;color:#8FA9BE')}>6 h au large, dès 7 pêcheurs</span></span>
                      </a>
                      <a href="#" onClick={go('evenements')} className="hvSkyBg" style={S('display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;text-decoration:none;color:#0B2239')}>
                        <span style={S('display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#EAF6FD;flex:none')}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="5.5" width="17" height="15" rx="3"></rect><line x1="3.5" y1="10" x2="20.5" y2="10"></line><line x1="8.5" y1="3.5" x2="8.5" y2="7"></line><line x1="15.5" y1="3.5" x2="15.5" y2="7"></line></svg>
                        </span>
                        <span><span style={S('display:block;font-weight:700;font-size:13.5px')}>Événements &amp; privatisation</span><span style={S('display:block;font-size:11px;color:#8FA9BE')}>Un bateau rien que pour vous</span></span>
                      </a>
                    </div>
                  )}
                </div>
                <a href="#" onClick={go('tarifs')} className="hvWhite" style={S(`padding:26px 0;font-size:13px;font-weight:600;letter-spacing:0.02em;color:${navColor(page === 'tarifs')};text-decoration:none;border-bottom:2px solid ${navLine(page === 'tarifs')};margin-bottom:-2px`)}>Tarifs</a>
                <a href="#" onClick={go('infos')} className="hvWhite" style={S(`padding:26px 0;font-size:13px;font-weight:600;letter-spacing:0.02em;color:${navColor(page === 'infos')};text-decoration:none;border-bottom:2px solid ${navLine(page === 'infos')};margin-bottom:-2px`)}>Infos pratiques</a>
              </nav>
              <a href="#ardoise" onClick={goArdoise} className="hvPillSky" style={S('flex:none;padding:11px 22px;border-radius:999px;background:#FFFFFF;color:#0B2239;font-weight:700;font-size:13.5px;text-decoration:none;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,0.25)')}>Horaires du jour</a>
            </>
          )}
          {!isDesktop && (
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Ouvrir le menu" style={S('cursor:pointer;margin-left:auto;flex:none;display:flex;align-items:center;justify-content:center;padding:8px 4px;background:transparent;color:#FFFFFF')}>
              <svg width="34" height="26" viewBox="0 0 26 20" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {/* 3 crêtes qui déferlent */}
                <path d="M1 9 C 2 3, 5 1, 7 3.4 C 8.6 5.3, 6.6 7, 5.2 5.2"></path>
                <path d="M8.5 9 C 9.5 3, 12.5 1, 14.5 3.4 C 16.1 5.3, 14.1 7, 12.7 5.2"></path>
                <path d="M16 9 C 17 3, 20 1, 22 3.4 C 23.6 5.3, 21.6 7, 20.2 5.2"></path>
                {/* 2 lignes ondulées */}
                <path d="M1.5 13.5 Q 5 11 8.5 13.5 T 15.5 13.5 T 22.5 13.5"></path>
                <path d="M1.5 17.5 Q 5 15 8.5 17.5 T 15.5 17.5 T 22.5 17.5"></path>
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* ======================= MENU MOBILE ======================= */}
      {menuOpen && (
        <div style={S('position:fixed;inset:0;z-index:100;background:#FFFFFF;display:flex;flex-direction:column;padding:18px 24px 30px')}>
          <div style={S('display:flex;justify-content:space-between;align-items:center;height:56px')}>
            <span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:16.5px;color:#0B2239")}>Étoile Filante <span style={S('color:#4FB3E8')}>✦</span></span>
            <button onClick={() => setMenuOpen(false)} aria-label="Fermer le menu" className="hvSkyBg" style={S('cursor:pointer;width:44px;height:44px;border-radius:50%;border:1.5px solid #E4EFF7;color:#0B2239;font-size:17px;display:flex;align-items:center;justify-content:center')}>✕</button>
          </div>
          <nav style={S('flex:1;display:flex;flex-direction:column;justify-content:center;gap:2px')}>
            {mobileNavItems.map((n) => (
              <a key={n.id} href="#" onClick={go(n.id)} style={S('display:flex;align-items:baseline;gap:18px;padding:15px 8px;border-bottom:1px solid #EDF5FA;text-decoration:none')}>
                <span style={S('font-size:12px;font-weight:700;letter-spacing:0.14em;color:#4FB3E8;min-width:26px')}>{n.num}</span>
                <span style={S(`font-family:'Sora',sans-serif;font-weight:700;font-size:clamp(26px,6.5vw,34px);color:${n.color}`)}>{n.label}</span>
              </a>
            ))}
          </nav>
          <a href={`tel:${TEL_HREF}`} className="hvBlueBg" style={S('display:flex;align-items:center;justify-content:center;gap:10px;padding:17px 24px;border-radius:999px;background:#0B2239;color:#FFFFFF;font-weight:700;font-size:16px;text-decoration:none')}>Réserver · {TELEPHONE}</a>
        </div>
      )}

      <main style={S('flex:1')}>
        {/* ============================ ACCUEIL =========================== */}
        {page === 'accueil' && (
          <div>
            {/* HERO PLEINE BANNIÈRE */}
            <section style={S('position:relative;overflow:hidden')}>
              <img className="hero-img" src="/uploads/679452210_1893613361685086_61712237109849653_n-3.jpg" alt="L'Étoile Filante et ses passagers devant les falaises de craie" style={S('width:100%;height:clamp(500px,62vw,700px);object-fit:cover;display:block')} />
              <div style={S('position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,34,57,0.18) 0%,rgba(11,34,57,0.10) 40%,rgba(11,34,57,0.72) 100%)')}></div>
              <div style={S('position:absolute;inset:0;display:flex;align-items:flex-end')}>
                <div className="hero-content" style={S('max-width:1240px;margin:0 auto;width:100%;padding:0 24px clamp(120px,14vw,170px)')}>
                  <div className="hero-eyebrow" style={S('font-size:12px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:#BEE3F5;margin-bottom:16px')}>Promenades en bateau · Le Tréport</div>
                  <h1 className="hero-h1" style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(34px,5.4vw,68px);line-height:1.05;letter-spacing:-0.02em;margin:0 0 16px;max-width:18ch;color:#FFFFFF;text-wrap:balance;text-shadow:0 2px 30px rgba(11,34,57,0.4)")}>
                    <span style={S('background:rgba(189,232,245,0.92);color:#0B2239;padding:1px 14px;border-radius:14px;box-decoration-break:clone;-webkit-box-decoration-break:clone')}>Balades en mer</span> au pied des plus hautes falaises d&apos;Europe
                  </h1>
                  <p className="hero-p" style={S('font-size:clamp(15px,1.5vw,17.5px);line-height:1.6;color:rgba(255,255,255,0.88);margin:0 0 26px;max-width:52ch')}>Embarquez pour 30 minutes ou 1 heure à bord de L&apos;Étoile Filante et de L&apos;EDEN · du Tréport à Mers-les-Bains, jusqu&apos;au Bois de Cise. Une sortie commentée, au rythme de la marée.</p>
                  <div style={S('display:flex;gap:12px;flex-wrap:wrap')}>
                    <a href="#ardoise" className="hvPillLight" style={S('padding:14px 26px;border-radius:999px;background:#FFFFFF;color:#0B2239;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 10px 30px rgba(11,34,57,0.3)')}>Horaires du jour ↓</a>
                    <a href={`tel:${TEL_HREF}`} className="hvGlass" style={S('padding:14px 26px;border-radius:999px;background:rgba(255,255,255,0.16);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.5);color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none')}>Réserver · {TELEPHONE}</a>
                  </div>
                </div>
              </div>
              <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style={S('position:absolute;bottom:-1px;left:0;width:100%;height:clamp(50px,7vw,90px);display:block')}>
                <path d="M0,50 C180,20 360,80 540,55 C720,30 900,75 1080,52 C1260,30 1380,60 1440,45 L1440,90 L0,90 Z" fill="#D8EEFA"></path>
                <path d="M0,68 C200,45 420,88 640,66 C860,45 1100,85 1440,62 L1440,90 L0,90 Z" fill="rgba(255,255,255,0.55)"></path>
              </svg>
            </section>

            {/* MÉTÉO DU JOUR */}
            <section style={S('max-width:1240px;margin:clamp(-90px,-9vw,-60px) auto 0;padding:0 24px;position:relative;z-index:6')}>
              <div style={S('background:#FFFFFF;border:1px solid #DCEDF8;border-radius:26px;box-shadow:0 24px 60px rgba(11,34,57,0.18);color:#0B2239;padding:18px 28px;display:flex;align-items:center;gap:24px;flex-wrap:wrap;position:relative;overflow:hidden')}>
                <div style={S('position:absolute;top:-60px;right:-40px;width:190px;height:190px;border-radius:50%;background:#F2F9FE;pointer-events:none;z-index:0')}></div>
                <div style={S('min-width:150px;position:relative;z-index:1')}>
                  <div style={S('font-size:10.5px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:#1D82C4')}>Météo du jour</div>
                  <div style={S('font-size:12px;font-weight:600;color:#8FA9BE;margin-top:2px;text-transform:capitalize')}>{todayLabel}</div>
                </div>
                {hasMeteo && (
                  <>
                    <div style={S('display:flex;align-items:center;gap:16px;position:relative;z-index:1')}>
                      <div style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:46px;line-height:1;color:#0B2239")}>{wxTemp}</div>
                      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={wxIconColor} strokeWidth="1.7" strokeLinecap="round">
                        {wxSun && (<><circle cx="12" cy="12" r="4.5"></circle><line x1="12" y1="3" x2="12" y2="5.5"></line><line x1="12" y1="18.5" x2="12" y2="21"></line><line x1="3" y1="12" x2="5.5" y2="12"></line><line x1="18.5" y1="12" x2="21" y2="12"></line><line x1="5.6" y1="5.6" x2="7.4" y2="7.4"></line><line x1="16.6" y1="16.6" x2="18.4" y2="18.4"></line><line x1="5.6" y1="18.4" x2="7.4" y2="16.6"></line><line x1="16.6" y1="7.4" x2="18.4" y2="5.6"></line></>)}
                        {wxPartly && (<><circle cx="9" cy="9" r="3.5"></circle><line x1="9" y1="2.5" x2="9" y2="4.2"></line><line x1="2.5" y1="9" x2="4.2" y2="9"></line><line x1="4.4" y1="4.4" x2="5.6" y2="5.6"></line><path d="M8 20 A3.5 3.5 0 0 1 8.8 13.1 A4.5 4.5 0 0 1 17.4 14.3 A3.2 3.2 0 0 1 17 20 Z"></path></>)}
                        {wxCloud && <path d="M6.5 17.5 A4 4 0 0 1 7.4 9.6 A5.2 5.2 0 0 1 17.3 11 A3.6 3.6 0 0 1 17 17.5 Z"></path>}
                        {wxRain && (<><path d="M6.5 14.5 A4 4 0 0 1 7.4 6.6 A5.2 5.2 0 0 1 17.3 8 A3.6 3.6 0 0 1 17 14.5 Z"></path><line x1="8.5" y1="17" x2="7.5" y2="20"></line><line x1="12.5" y1="17" x2="11.5" y2="20"></line><line x1="16.5" y1="17" x2="15.5" y2="20"></line></>)}
                        {wxStorm && (<><path d="M6.5 13.5 A4 4 0 0 1 7.4 5.6 A5.2 5.2 0 0 1 17.3 7 A3.6 3.6 0 0 1 17 13.5 Z"></path><path d="M12.5 15 L10 18.5 L12.5 18.5 L11 22" fill="none"></path></>)}
                        {wxFog && (<><line x1="4" y1="9" x2="20" y2="9"></line><line x1="6" y1="13" x2="18" y2="13"></line><line x1="4.5" y1="17" x2="19.5" y2="17"></line></>)}
                      </svg>
                      <div style={S('font-size:15px;font-weight:700;max-width:16ch;color:#0B2239')}>{wxLabel}</div>
                    </div>
                    <div style={S('display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;position:relative;z-index:1')}>
                      <span style={S('background:#F2F9FE;border:1px solid #DCEDF8;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700;color:#1D82C4')}>vent {wxWind}</span>
                      <span style={S('background:#F2F9FE;border:1px solid #DCEDF8;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700;color:#1D82C4')}>rafales {wxGust}</span>
                      <span style={S('background:#F2F9FE;border:1px solid #DCEDF8;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700;color:#1D82C4')}>mer {wxWave}</span>
                      <span style={S('background:#F2F9FE;border:1px solid #DCEDF8;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700;color:#1D82C4')}>coef {coefToday}</span>
                    </div>
                  </>
                )}
                {!hasMeteo && (
                  <div style={S('font-size:13.5px;color:#8FA9BE;animation:ef-pulse 1.6s infinite')}>Relevé Open-Meteo en cours…</div>
                )}
              </div>
            </section>

            {/* PANNEAU ARDOISE (pleine largeur, vagues haut et bas) */}
            <section id="ardoise" style={S('position:relative;margin-top:clamp(26px,3.4vw,44px)')}>
              <svg viewBox="0 0 1440 100" preserveAspectRatio="none" style={S('display:block;width:100%;height:clamp(46px,7vw,100px)')}>
                <path d="M0,100 L0,55 C180,20 360,85 560,58 C760,30 940,80 1140,55 C1290,36 1380,58 1440,48 L1440,100 Z" fill="#0F3053"></path>
                <path d="M0,100 L0,75 C220,50 460,96 700,74 C940,52 1180,92 1440,68 L1440,100 Z" fill="rgba(79,179,232,0.35)"></path>
              </svg>
              <div style={S('background:linear-gradient(160deg,#0F3053 0%,#0B2239 70%);color:#FFFFFF;position:relative;overflow:hidden;padding:clamp(12px,1.8vw,26px) 0 clamp(36px,4.5vw,64px)')}>
                <div style={S('position:absolute;top:-140px;right:-100px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(79,179,232,0.22),rgba(79,179,232,0) 70%);pointer-events:none')}></div>
                <div style={S('max-width:1240px;margin:0 auto;padding:0 24px;position:relative')}>
                  <div style={S('position:relative;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(20px,2.6vw,32px);align-items:stretch')}>
                    <div className="ardoise-photo" style={S('position:relative;border-radius:22px;overflow:hidden;min-height:280px')}>
                      <img src="/uploads/IMG_1313.jpg" alt="L'EDEN en balade, passagers à bord" style={S('position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block')} />
                      <div style={S('position:absolute;left:12px;bottom:12px;background:rgba(11,34,57,0.6);backdrop-filter:blur(8px);border-radius:999px;padding:7px 15px;font-size:12px;font-weight:600;color:#DFF1FB')}>En mer, au large du Tréport</div>
                    </div>

                    <div className="ardoise-body" style={S('display:flex;flex-direction:column')}>
                      <div style={S('display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap')}>
                        <h2 style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(22px,2.6vw,30px);letter-spacing:-0.01em;margin:0")}>L&apos;ardoise du jour</h2>
                        <div style={S('font-size:12.5px;font-weight:600;color:#9ED4F2;text-transform:capitalize')}>{todayLabel} · coef {coefToday}</div>
                      </div>
                      {loading && (
                        <div style={S('font-size:14px;padding:24px 0;color:#9ED4F2;animation:ef-pulse 1.6s infinite')}>Consultation de la marée…</div>
                      )}
                      {!loading && slotsToday.length > 0 && (
                        <div style={S('display:flex;flex-direction:column;margin-top:8px')}>
                          {slotsToday.map((s) => (
                            <div key={s.id} style={S('display:flex;align-items:center;gap:14px;padding:11px 2px;border-bottom:1px solid rgba(158,212,242,0.22)')}>
                              <div style={S(`font-family:'Sora',sans-serif;font-size:19px;font-weight:700;color:#FFFFFF;opacity:${s.pillOpacity};text-decoration:${s.timeDeco};min-width:78px`)}>{s.depLabel}</div>
                              <div style={S('flex:1;min-width:0;font-size:13.5px;font-weight:600;color:#BEE3F5')}>Balade {s.durLabel} <span style={S('font-weight:400;color:#7FA8C4')}>· retour {s.endLabel}</span></div>
                              <div style={S(`padding:5px 13px;border-radius:999px;font-size:11px;font-weight:700;background:${s.chipBg};color:${s.chipFg};white-space:nowrap`)}>{s.statusLabel}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {!loading && slotsToday.length === 0 && (
                        <div style={S('font-size:15px;color:#BEE3F5;padding:18px 0;line-height:1.6')}>Pas de sortie possible aujourd&apos;hui · la marée ne le permet pas. Rendez-vous demain !</div>
                      )}
                      {showDemain && (
                        <div style={S('display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px')}>
                          <div style={S('font-size:12px;font-weight:700;color:#9ED4F2;text-transform:capitalize')}>Demain · {demainLabel} :</div>
                          {slotsDemain.map((s) => (
                            <div key={s.id} style={S(`background:rgba(255,255,255,0.10);border:1px solid rgba(158,212,242,0.3);border-radius:999px;padding:4px 11px;font-size:12px;font-weight:700;color:#DFF1FB;text-decoration:${s.timeDeco};opacity:${s.pillOpacity}`)}>{s.depLabel}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* accès rapides : 4 cartes blanches en relief */}
                  <div style={S('position:relative;margin-top:clamp(18px,2.4vw,26px)')}>
                    <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:14px;align-items:stretch')}>
                      {/* 1 · Tarifs */}
                      <div style={S('background:#FFFFFF;border-radius:22px;padding:18px 20px 16px;box-shadow:0 16px 40px rgba(4,16,28,0.35);color:#0B2239;display:flex;flex-direction:column;gap:12px')}>
                        <div style={S('display:flex;align-items:center;gap:10px')}>
                          <span style={S("display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:#EAF6FD;font-family:'Sora',sans-serif;font-weight:800;font-size:16px;color:#1D82C4")}>€</span>
                          <span style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:14.5px")}>Tarifs <span style={S('background:#BDE8F5;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:700;color:#0B2239;margin-left:4px')}>2026</span></span>
                        </div>
                        <div style={S('display:flex;gap:12px')}>
                          <div style={S('flex:1;background:#F2F9FE;border-radius:14px;padding:10px 12px')}>
                            <div style={S('font-size:10.5px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#1D82C4;margin-bottom:7px')}>30 min</div>
                            <div style={S('display:flex;justify-content:space-between;font-size:12.5px;padding:3px 0')}><span style={S('color:#5C7893')}>Adulte</span><strong style={S("font-family:'Sora',sans-serif")}>10 €</strong></div>
                            <div style={S('display:flex;justify-content:space-between;font-size:12.5px;padding:3px 0')}><span style={S('color:#5C7893')}>Enfant</span><strong style={S("font-family:'Sora',sans-serif")}>8 €</strong></div>
                          </div>
                          <div style={S('flex:1;background:#F2F9FE;border-radius:14px;padding:10px 12px')}>
                            <div style={S('font-size:10.5px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#1D82C4;margin-bottom:7px')}>1 heure</div>
                            <div style={S('display:flex;justify-content:space-between;font-size:12.5px;padding:3px 0')}><span style={S('color:#5C7893')}>Adulte</span><strong style={S("font-family:'Sora',sans-serif")}>15 €</strong></div>
                            <div style={S('display:flex;justify-content:space-between;font-size:12.5px;padding:3px 0')}><span style={S('color:#5C7893')}>Enfant</span><strong style={S("font-family:'Sora',sans-serif")}>10 €</strong></div>
                          </div>
                        </div>
                        <div style={S('font-size:11.5px;color:#5C7893;line-height:1.5')}>Bébé (−3 ans) <strong style={S('color:#0F7A47')}>gratuit</strong> · billets à la billetterie du quai</div>
                        <a href="#" onClick={go('tarifs')} className="hvNavy" style={S('font-size:12.5px;font-weight:700;color:#1D82C4;margin-top:auto')}>Tous les tarifs →</a>
                      </div>

                      {/* 2 · Réservation sur place */}
                      <div style={S('background:#FFFFFF;border-radius:22px;padding:18px 20px 16px;box-shadow:0 16px 40px rgba(4,16,28,0.35);color:#0B2239;display:flex;flex-direction:column;gap:12px')}>
                        <div style={S('display:flex;align-items:center;gap:10px')}>
                          <span style={S('display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:#EAF6FD')}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="6.5" width="17" height="11" rx="3"></rect><line x1="15" y1="7.5" x2="15" y2="9.5"></line><line x1="15" y1="11" x2="15" y2="13"></line><line x1="15" y1="14.5" x2="15" y2="16.5"></line></svg>
                          </span>
                          <span style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:14.5px")}>Réservation sur place</span>
                        </div>
                        <div style={S('font-size:12.5px;line-height:1.6;color:#5C7893')}>Billets vendus <strong style={S('color:#0B2239;background:#BDE8F5;border-radius:5px;padding:0 5px')}>le jour J</strong> à la billetterie · Place de la Poissonnerie municipale, quai François 1ᵉʳ.</div>
                        <a href={`tel:${TEL_HREF}`} className="hvBlueBg" style={S('margin-top:auto;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 16px;border-radius:999px;background:#0B2239;color:#FFFFFF;font-weight:700;font-size:13px;text-decoration:none')}>
                          <span style={S('display:inline-block;width:7px;height:7px;border-radius:50%;background:#4CD98A')}></span>{TELEPHONE}
                        </a>
                      </div>

                      {/* 3 · Modalités d'accueil */}
                      <div style={S('background:#FFFFFF;border-radius:22px;padding:18px 20px 16px;box-shadow:0 16px 40px rgba(4,16,28,0.35);color:#0B2239;display:flex;flex-direction:column;gap:12px')}>
                        <div style={S('display:flex;align-items:center;gap:10px')}>
                          <span style={S('display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:#EAF6FD')}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round"><path d="M12 20.5 C 7 16.5, 3.5 13, 3.5 9.2 A 4.4 4.4 0 0 1 12 7.2 A 4.4 4.4 0 0 1 20.5 9.2 C 20.5 13, 17 16.5, 12 20.5 Z"></path></svg>
                          </span>
                          <span style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:14.5px")}>Tout le monde embarque</span>
                        </div>
                        <div style={S('display:flex;flex-direction:column;gap:9px;font-size:12.5px;color:#5C7893;line-height:1.5')}>
                          <div style={S('display:flex;align-items:center;gap:10px')}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="#1D82C4" style={S('flex:none')}><circle cx="6" cy="8" r="2"></circle><circle cx="10.5" cy="5" r="2"></circle><circle cx="15.5" cy="5" r="2"></circle><circle cx="20" cy="8" r="2"></circle><path d="M13 10 C 9 10, 6.5 13.5, 7 16.5 C 7.4 18.8, 9.5 19, 11 18.2 C 12.3 17.5, 13.7 17.5, 15 18.2 C 16.5 19, 18.6 18.8, 19 16.5 C 19.5 13.5, 17 10, 13 10 Z"></path></svg>
                            <span><strong style={S('color:#0B2239')}>Chiens acceptés</strong>, tenus en laisse</span>
                          </div>
                          <div style={S('display:flex;align-items:center;gap:10px')}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round" style={S('flex:none')}><circle cx="12" cy="6" r="3"></circle><path d="M7 21 C 7 15.5, 17 15.5, 17 21"></path><path d="M4.5 12.5 C 7 10.5, 17 10.5, 19.5 12.5"></path></svg>
                            <span><strong style={S('color:#0B2239')}>Bébés bienvenus</strong> · gratuit avant 3 ans, <span style={S('background:#BDE8F5;border-radius:5px;padding:0 5px;color:#0B2239;font-weight:600')}>gilets adaptés</span></span>
                          </div>
                          <div style={S('display:flex;align-items:center;gap:10px')}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round" style={S('flex:none')}><circle cx="12" cy="4.5" r="2"></circle><path d="M12 7 L12 13 L16.5 13 L18.5 18"></path><path d="M12 9.5 L16 9.5"></path><circle cx="10" cy="17" r="4.5"></circle></svg>
                            <span><strong style={S('color:#0B2239')}>PMR :</strong> accès possible, prévenez-nous au {TELEPHONE}</span>
                          </div>
                        </div>
                        <a href="#" onClick={go('infos')} className="hvNavy" style={S('font-size:12.5px;font-weight:700;color:#1D82C4;margin-top:auto')}>Toutes les infos pratiques →</a>
                      </div>

                      {/* 4 · Embarquement */}
                      <div style={S('background:#FFFFFF;border-radius:22px;padding:18px 20px 16px;box-shadow:0 16px 40px rgba(4,16,28,0.35);color:#0B2239;display:flex;flex-direction:column;gap:12px')}>
                        <div style={S('display:flex;align-items:center;gap:10px')}>
                          <span style={S('display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;background:#EAF6FD')}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="5.5" r="2.5"></circle><line x1="12" y1="8" x2="12" y2="19"></line><line x1="8" y1="11" x2="16" y2="11"></line><path d="M5 14.5 A 8 8 0 0 0 19 14.5"></path></svg>
                          </span>
                          <span style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:14.5px")}>Embarquement</span>
                        </div>
                        <img src="/uploads/480689857_1133889561857424_778771142117709038_n.jpg" alt="Le bateau passant le feu vert du port, devant la billetterie" style={S('width:100%;height:86px;object-fit:cover;border-radius:14px;display:block')} />
                        <div style={S('font-size:12.5px;line-height:1.6;color:#5C7893')}><strong style={S('color:#0B2239')}>Quai François 1ᵉʳ</strong>, face à la billetterie. Parkings à 5 min à pied, <span style={S('background:#BDE8F5;border-radius:5px;padding:0 5px;color:#0B2239;font-weight:600')}>funiculaire gratuit</span> depuis la ville haute.</div>
                        <a href="#" onClick={go('contact')} className="hvNavy" style={S('font-size:12.5px;font-weight:700;color:#1D82C4;margin-top:auto')}>Plan d&apos;accès →</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style={S('display:block;width:100%;height:clamp(40px,6vw,90px);margin-top:-1px')}>
                <path d="M0,0 L0,35 C200,70 420,15 660,42 C900,70 1140,25 1440,50 L1440,0 Z" fill="#0B2239"></path>
                <path d="M0,0 L0,18 C240,44 500,8 760,30 C1020,52 1240,16 1440,34 L1440,0 Z" fill="rgba(79,179,232,0.30)"></path>
              </svg>
            </section>

            {/* BLOC SORTIES · fond bleu clair, vagues intégrées */}
            <section style={S('position:relative;margin-top:clamp(56px,8vw,96px)')}>
              <svg viewBox="0 0 1440 100" preserveAspectRatio="none" style={S('display:block;width:100%;height:clamp(46px,7vw,100px)')}>
                <path d="M0,100 L0,55 C180,20 360,85 560,58 C760,30 940,80 1140,55 C1290,36 1380,58 1440,48 L1440,100 Z" fill="#BDE4F6"></path>
                <path d="M0,100 L0,75 C220,50 460,96 700,74 C940,52 1180,92 1440,68 L1440,100 Z" fill="rgba(255,255,255,0.4)"></path>
              </svg>
              <div style={S('background:#BDE4F6;position:relative;overflow:hidden;padding:clamp(20px,3vw,44px) 0 clamp(60px,8vw,100px)')}>
                {/* poissons flottants */}
                <Fish width={40} height={24} stroke="#1D82C4" strokeWidth={1.6} style={S('position:absolute;top:60px;left:6%;animation:ef-swim 5s ease-in-out infinite;opacity:0.65')} />
                <Fish width={30} height={18} stroke="#1D82C4" strokeWidth={1.8} style={S('position:absolute;top:130px;right:8%;transform:scaleX(-1);animation:ef-float 6s ease-in-out infinite;opacity:0.5')} />
                <Fish width={26} height={16} stroke="#FFFFFF" strokeWidth={1.8} style={S('position:absolute;bottom:70px;left:12%;animation:ef-swim 7s ease-in-out infinite;opacity:0.8')} />
                <div style={S('position:absolute;bottom:120px;right:14%;display:flex;flex-direction:column;gap:8px;align-items:center;opacity:0.6')}>
                  <span style={S('width:8px;height:8px;border-radius:50%;border:1.5px solid #FFFFFF;animation:ef-float 4s ease-in-out infinite')}></span>
                  <span style={S('width:12px;height:12px;border-radius:50%;border:1.5px solid #FFFFFF;animation:ef-float 5s ease-in-out infinite')}></span>
                  <span style={S('width:6px;height:6px;border-radius:50%;border:1.5px solid #FFFFFF;animation:ef-float 6s ease-in-out infinite')}></span>
                </div>

                <div style={S('max-width:1240px;margin:0 auto;padding:0 24px;position:relative')}>
                  <div style={S('text-align:center;margin-bottom:34px')}>
                    <div style={S("display:inline-block;background:#E9F8FF;box-shadow:0 8px 24px rgba(11,34,57,0.12);border-radius:14px;padding:10px 26px;font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(17px,1.9vw,22px);letter-spacing:0.12em;text-transform:uppercase;color:#1D82C4;margin-bottom:16px")}>Nos sorties en mer</div>
                    <h2 style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(26px,3.2vw,40px);letter-spacing:-0.02em;margin:0;color:#0B2239")}>Trois façons de <span style={S('background:#FFFFFF;border-radius:12px;padding:1px 12px;box-decoration-break:clone;-webkit-box-decoration-break:clone')}>prendre le large</span></h2>
                  </div>
                  <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px')}>
                    <a href="#" onClick={go('balades')} style={S('position:relative;border-radius:24px;overflow:hidden;display:block;text-decoration:none;color:#FFFFFF')}>
                      <img src="/uploads/IMG_1313.jpg" alt="Balade 30 min" style={S('width:100%;height:380px;object-fit:cover;display:block')} />
                      <div style={S('position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,34,57,0) 40%,rgba(11,34,57,0.82) 100%)')}></div>
                      <div style={S('position:absolute;top:14px;left:14px;font-size:12px;font-weight:700;letter-spacing:0.12em;color:#FFFFFF;background:rgba(11,34,57,0.5);backdrop-filter:blur(8px);border-radius:999px;padding:6px 13px')}>01</div>
                      <div style={S('position:absolute;top:14px;right:14px;font-size:12.5px;font-weight:700;color:#0B2239;background:rgba(255,255,255,0.9);border-radius:999px;padding:7px 14px')}>dès 8 €</div>
                      <div style={S('position:absolute;left:0;right:0;bottom:0;padding:22px 22px 20px')}>
                        <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:21px;margin-bottom:6px")}>Balade 30 min</div>
                        <div style={S('font-size:13.5px;line-height:1.55;color:rgba(255,255,255,0.85)')}>Le grand classique : falaises du Tréport et de Mers-les-Bains, commentées par le capitaine.</div>
                      </div>
                    </a>
                    <a href="#" onClick={go('balades')} style={S('position:relative;border-radius:24px;overflow:hidden;display:block;text-decoration:none;color:#FFFFFF')}>
                      <img src="/uploads/IMG_1294.jpg" alt="Balade 1 h" style={S('width:100%;height:380px;object-fit:cover;display:block')} />
                      <div style={S('position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,34,57,0) 40%,rgba(11,34,57,0.82) 100%)')}></div>
                      <div style={S('position:absolute;top:14px;left:14px;font-size:12px;font-weight:700;letter-spacing:0.12em;color:#FFFFFF;background:rgba(11,34,57,0.5);backdrop-filter:blur(8px);border-radius:999px;padding:6px 13px')}>02</div>
                      <div style={S('position:absolute;top:14px;right:14px;font-size:12.5px;font-weight:700;color:#0B2239;background:rgba(255,255,255,0.9);border-radius:999px;padding:7px 14px')}>dès 10 €</div>
                      <div style={S('position:absolute;left:0;right:0;bottom:0;padding:22px 22px 20px')}>
                        <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:21px;margin-bottom:6px")}>Balade 1 h</div>
                        <div style={S('font-size:13.5px;line-height:1.55;color:rgba(255,255,255,0.85)')}>La version longue, jusqu&apos;au Bois de Cise · le temps d&apos;apercevoir phoques et oiseaux marins.</div>
                      </div>
                    </a>
                    <a href="#" onClick={go('peche')} style={S('position:relative;border-radius:24px;overflow:hidden;display:block;text-decoration:none;color:#FFFFFF')}>
                      <img src="/uploads/679031361_1893613261685096_5120760682960525618_n.jpg" alt="Pêche en mer · 6 h" style={S('width:100%;height:380px;object-fit:cover;display:block')} />
                      <div style={S('position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,34,57,0) 40%,rgba(11,34,57,0.82) 100%)')}></div>
                      <div style={S('position:absolute;top:14px;left:14px;font-size:12px;font-weight:700;letter-spacing:0.12em;color:#FFFFFF;background:rgba(11,34,57,0.5);backdrop-filter:blur(8px);border-radius:999px;padding:6px 13px')}>03</div>
                      <div style={S('position:absolute;top:14px;right:14px;font-size:12.5px;font-weight:700;color:#0B2239;background:rgba(255,255,255,0.9);border-radius:999px;padding:7px 14px')}>60 €/pers</div>
                      <div style={S('position:absolute;left:0;right:0;bottom:0;padding:22px 22px 20px')}>
                        <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:21px;margin-bottom:6px")}>Pêche en mer · 6 h</div>
                        <div style={S('font-size:13.5px;line-height:1.55;color:rgba(255,255,255,0.85)')}>Constituez votre groupe de pêcheurs (7 minimum) et ramenez du poisson frais pour le dîner.</div>
                      </div>
                    </a>
                  </div>
                  <div style={S('text-align:center;margin-top:30px')}>
                    <a href="#" onClick={go('balades')} className="hvBlueBg" style={S('display:inline-block;padding:13px 28px;border-radius:999px;background:#0B2239;color:#FFFFFF;font-weight:700;font-size:14.5px;text-decoration:none;box-shadow:0 12px 30px rgba(11,34,57,0.25)')}>Tout découvrir →</a>
                  </div>
                </div>
              </div>
              <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style={S('display:block;width:100%;height:clamp(40px,6vw,90px);margin-top:-1px')}>
                <path d="M0,0 L0,35 C200,70 420,15 660,42 C900,70 1140,25 1440,50 L1440,0 Z" fill="#BDE4F6"></path>
              </svg>
            </section>

            {/* EMBARQUER, C'EST SIMPLE */}
            <section style={S('position:relative;padding:clamp(40px,6vw,72px) 0 0')}>
              {/* vague full frame de clôture */}
              <svg viewBox="0 0 1440 100" preserveAspectRatio="none" style={S('display:block;width:100%;height:clamp(46px,7vw,100px)')}>
                <path d="M0,100 L0,55 C180,20 360,85 560,58 C760,30 940,80 1140,55 C1290,36 1380,58 1440,48 L1440,100 Z" fill="#BDE4F6"></path>
                <path d="M0,100 L0,75 C220,50 460,96 700,74 C940,52 1180,92 1440,68 L1440,100 Z" fill="rgba(255,255,255,0.4)"></path>
              </svg>

              {/* COMMENT ÇA MARCHE */}
              <div style={S('background:#BDE4F6;position:relative;overflow:hidden;padding:clamp(18px,2.6vw,40px) 0 clamp(56px,7vw,88px)')}>
                <Fish width={34} height={21} stroke="#1D82C4" strokeWidth={1.7} style={S('position:absolute;top:56px;right:9%;animation:ef-swim 6s ease-in-out infinite;opacity:0.55')} />
                <Fish width={24} height={15} stroke="#FFFFFF" strokeWidth={1.9} style={S('position:absolute;bottom:60px;left:7%;transform:scaleX(-1);animation:ef-float 5s ease-in-out infinite;opacity:0.75')} />
                <div style={S('max-width:1240px;margin:0 auto;padding:0 24px')}>
                  <div style={S('text-align:center;margin-bottom:32px')}>
                    <h2 style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(24px,3vw,38px);letter-spacing:-0.02em;margin:0;color:#0B2239")}>Embarquer, c&apos;est <span style={S('background:#FFFFFF;border-radius:12px;padding:1px 12px;box-decoration-break:clone;-webkit-box-decoration-break:clone')}>simple comme bonjour</span></h2>
                  </div>
                  <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px')}>
                    <div style={S('background:#FFFFFF;border-radius:24px;padding:24px 26px;box-shadow:0 14px 36px rgba(11,34,57,0.14);position:relative')}>
                      <div style={S('display:flex;align-items:center;gap:12px;margin-bottom:12px')}>
                        <span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:26px;color:#4FB3E8")}>1</span>
                        <span style={S('display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#EAF6FD')}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="3.5" width="16" height="17" rx="2.5"></rect><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="12.5" y2="16"></line></svg>
                        </span>
                      </div>
                      <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:16.5px;color:#0B2239;margin-bottom:6px")}>Consultez l&apos;ardoise du jour</div>
                      <div style={S('font-size:13.5px;color:#5C7893;line-height:1.6')}>Les horaires suivent la marée : ils changent chaque jour. Ici même, sur Facebook, ou sur l&apos;ardoise du quai.</div>
                      <a href="#ardoise" className="hvNavy" style={S('display:inline-block;margin-top:10px;font-size:13px;font-weight:700;color:#1D82C4')}>Voir les horaires ↑</a>
                    </div>
                    <div style={S('background:#FFFFFF;border-radius:24px;padding:24px 26px;box-shadow:0 14px 36px rgba(11,34,57,0.14)')}>
                      <div style={S('display:flex;align-items:center;gap:12px;margin-bottom:12px')}>
                        <span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:26px;color:#4FB3E8")}>2</span>
                        <span style={S('display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#EAF6FD')}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8.5 C 4 7, 5 6, 6.5 6 L17.5 6 C 19 6, 20 7, 20 8.5 L20 9.5 C 18.8 9.5, 18 10.4, 18 11.5 C 18 12.6, 18.8 13.5, 20 13.5 L20 14.5 C 20 16, 19 17, 17.5 17 L6.5 17 C 5 17, 4 16, 4 14.5 L4 13.5 C 5.2 13.5, 6 12.6, 6 11.5 C 6 10.4, 5.2 9.5, 4 9.5 Z"></path><line x1="14" y1="6" x2="14" y2="17" strokeDasharray="2 2.4"></line></svg>
                        </span>
                      </div>
                      <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:16.5px;color:#0B2239;margin-bottom:6px")}>Prenez vos billets sur le quai</div>
                      <div style={S('font-size:13.5px;color:#5C7893;line-height:1.6')}>À la billetterie, le jour même · Place de la Poissonnerie municipale. Arrivez 20 minutes avant en plein été.</div>
                      <a href={`tel:${TEL_HREF}`} className="hvNavy" style={S('display:inline-block;margin-top:10px;font-size:13px;font-weight:700;color:#1D82C4')}>Réserver par téléphone →</a>
                    </div>
                    <div style={S('background:#FFFFFF;border-radius:24px;padding:24px 26px;box-shadow:0 14px 36px rgba(11,34,57,0.14)')}>
                      <div style={S('display:flex;align-items:center;gap:12px;margin-bottom:12px')}>
                        <span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:26px;color:#4FB3E8")}>3</span>
                        <span style={S('display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#EAF6FD')}>
                          <Boat size={20} stroke="#1D82C4" />
                        </span>
                      </div>
                      <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:16.5px;color:#0B2239;margin-bottom:6px")}>Embarquez face à la billetterie</div>
                      <div style={S('font-size:13.5px;color:#5C7893;line-height:1.6')}>Gilets pour les petits, chiens en laisse bienvenus. Le capitaine vous accueille · larguez les amarres !</div>
                      <a href="#" onClick={go('infos')} className="hvNavy" style={S('display:inline-block;margin-top:10px;font-size:13px;font-weight:700;color:#1D82C4')}>Infos pratiques →</a>
                    </div>
                  </div>
                </div>
              </div>
              <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style={S('display:block;width:100%;height:clamp(40px,6vw,90px);margin-top:-1px')}>
                <path d="M0,0 L0,35 C200,70 420,15 660,42 C900,70 1140,25 1440,50 L1440,0 Z" fill="#BDE4F6"></path>
              </svg>
            </section>

            {/* MARÉE & MÉTÉO */}
            <section id="maree" style={S('position:relative;margin-top:clamp(40px,6vw,80px)')}>
              <svg viewBox="0 0 1440 100" preserveAspectRatio="none" style={S('display:block;width:100%;height:clamp(46px,7vw,100px)')}>
                <path d="M0,100 L0,55 C180,20 360,85 560,58 C760,30 940,80 1140,55 C1290,36 1380,58 1440,48 L1440,100 Z" fill="#0F3053"></path>
                <path d="M0,100 L0,75 C220,50 460,96 700,74 C940,52 1180,92 1440,68 L1440,100 Z" fill="rgba(79,179,232,0.35)"></path>
              </svg>
              <div style={S('background:linear-gradient(160deg,#0F3053 0%,#0B2239 70%);color:#FFFFFF;position:relative;overflow:hidden;padding:clamp(14px,2vw,30px) 0 clamp(40px,5vw,72px)')}>
                <div style={S('position:absolute;top:-140px;right:-100px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(79,179,232,0.20),rgba(79,179,232,0) 70%);pointer-events:none')}></div>
                <div style={S('position:absolute;bottom:60px;left:-80px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(79,179,232,0.14),rgba(79,179,232,0) 70%);pointer-events:none')}></div>
                <div style={S('max-width:1240px;margin:0 auto;padding:0 24px;position:relative')}>

                  <div style={S('text-align:center;max-width:60ch;margin:0 auto clamp(34px,4vw,52px)')}>
                    <div style={S('display:inline-block;padding:8px 20px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(158,212,242,0.4);font-size:13px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#BEE3F5;margin-bottom:22px')}>Bon à savoir</div>
                    <h2 style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(30px,4vw,52px);line-height:1.06;letter-spacing:-0.02em;margin:0 0 20px")}>Pourquoi réserver <span style={S('background:#BDE8F5;color:#0B2239;border-radius:12px;padding:0 12px;box-decoration-break:clone;-webkit-box-decoration-break:clone')}>sur place</span>, le jour&nbsp;J&nbsp;?</h2>
                    <p style={S('font-size:clamp(16px,1.7vw,20px);line-height:1.6;color:#CFE8F7;margin:0')}>Nos bateaux dépendent de deux choses qu&apos;on ne maîtrise pas&nbsp;: la marée et la mer. Voilà pourquoi tout se décide au dernier moment, pour votre sécurité et votre plaisir.</p>
                  </div>

                  <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:26px')}>
                    {/* Raison 1 : marée */}
                    <div style={S('background:rgba(255,255,255,0.10);border:1px solid rgba(158,212,242,0.32);border-radius:28px;overflow:hidden;backdrop-filter:blur(6px)')}>
                      <div style={S('position:relative;height:190px')}>
                        <img src="/uploads/maree-basse-phare.jpg" alt="Le port du Tréport à marée basse" style={S('width:100%;height:100%;object-fit:cover;display:block')} />
                        <div style={S('position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,34,57,0) 45%,rgba(11,34,57,0.85) 100%)')}></div>
                        <div style={S('position:absolute;left:20px;bottom:16px;display:flex;align-items:center;gap:12px')}>
                          <span style={S('display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.92)')}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round"><path d="M2.5 12 C 5 9, 8 9, 10.5 12 C 13 15, 16 15, 18.5 12 C 20 10.3, 21.2 10, 21.8 10.2"></path><path d="M2.5 17.5 C 5 14.5, 8 14.5, 10.5 17.5 C 13 20.5, 16 20.5, 18.5 17.5"></path></svg></span>
                          <span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:24px;color:#FFFFFF;text-shadow:0 2px 12px rgba(11,34,57,0.6)")}>La marée commande</span>
                        </div>
                      </div>
                      <div style={S('padding:20px 24px 24px')}>
                        <p style={S('margin:0;font-size:16px;line-height:1.6;color:#DDF1FB')}>Le port du Tréport <strong style={S('color:#FFFFFF')}>s&apos;assèche à marée basse</strong>. Les bateaux ne sortent que de <strong style={S('color:#FFFFFF')}>2h40 avant</strong> à <strong style={S('color:#FFFFFF')}>3h après</strong> la pleine mer — des horaires qui se décalent chaque jour.</p>
                      </div>
                    </div>
                    {/* Raison 2 : mer */}
                    <div style={S('background:rgba(255,255,255,0.10);border:1px solid rgba(158,212,242,0.32);border-radius:28px;overflow:hidden;backdrop-filter:blur(6px)')}>
                      <div style={S('position:relative;height:190px')}>
                        <img src="/uploads/tempete-jetee.jpg" alt="Mer agitée sur la jetée du Tréport" style={S('width:100%;height:100%;object-fit:cover;display:block')} />
                        <div style={S('position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,34,57,0) 45%,rgba(11,34,57,0.85) 100%)')}></div>
                        <div style={S('position:absolute;left:20px;bottom:16px;display:flex;align-items:center;gap:12px')}>
                          <span style={S('display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.92)')}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round"><path d="M3 14 L6 14 A2.5 2.5 0 1 0 8 10 M4 18 L14 18 A2.5 2.5 0 1 1 12 22 M3 10 L16 10 A3 3 0 1 0 13 6"></path></svg></span>
                          <span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:24px;color:#FFFFFF;text-shadow:0 2px 12px rgba(11,34,57,0.6)")}>La mer décide</span>
                        </div>
                      </div>
                      <div style={S('padding:20px 24px 24px')}>
                        <p style={S('margin:0;font-size:16px;line-height:1.6;color:#DDF1FB')}>La météo est <strong style={S('color:#FFFFFF')}>difficile à prévoir en mer</strong> : vent et vagues changent en quelques heures. Par gros temps, <strong style={S('color:#FFFFFF')}>la sécurité prime</strong> et la sortie est annulée.</p>
                      </div>
                    </div>
                    {/* Raison 3 : confirmation */}
                    <div style={S('background:rgba(255,255,255,0.10);border:1px solid rgba(158,212,242,0.32);border-radius:28px;overflow:hidden;backdrop-filter:blur(6px)')}>
                      <div style={S('position:relative;height:190px')}>
                        <img src="/uploads/518207258_1636985877347837_501752820138468060_n-780e21f1.jpg" alt="Feu d'artifice sur le port du Tréport à la tombée de la nuit" style={S('width:100%;height:100%;object-fit:cover;display:block')} />
                        <div style={S('position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,34,57,0) 45%,rgba(11,34,57,0.85) 100%)')}></div>
                        <div style={S('position:absolute;left:20px;bottom:16px;display:flex;align-items:center;gap:12px')}>
                          <span style={S('display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,0.92)')}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1D82C4" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7 L12 12 L15.5 14"></path></svg></span>
                          <span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:24px;color:#FFFFFF;text-shadow:0 2px 12px rgba(11,34,57,0.6)")}>Confirmé la veille</span>
                        </div>
                      </div>
                      <div style={S('padding:20px 24px 24px')}>
                        <p style={S('margin:0;font-size:16px;line-height:1.6;color:#DDF1FB')}>Le capitaine valide chaque sortie <strong style={S('color:#FFFFFF')}>la veille</strong>, et l&apos;ardoise du jour est mise à jour ici en direct. Vous venez <strong style={S('color:#FFFFFF')}>l&apos;esprit tranquille</strong>.</p>
                      </div>
                    </div>
                  </div>

                  {/* Pas de réservation en ligne */}
                  <div style={S('background:rgba(255,255,255,0.10);border:1px solid rgba(158,212,242,0.35);border-radius:28px;padding:clamp(24px,3vw,38px);display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;align-items:center')}>
                    <div>
                      <div style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(22px,2.4vw,30px);letter-spacing:-0.01em;margin-bottom:12px")}>Pourquoi pas de réservation en ligne&nbsp;?</div>
                      <p style={S('margin:0;font-size:16px;line-height:1.65;color:#CFE8F7')}>Réserver des semaines à l&apos;avance nous obligerait à annuler dès que la marée ou la météo tourne — frustrant pour tout le monde. Chez nous, <strong style={S('color:#FFFFFF')}>aucun risque, aucune déception</strong> : les billets s&apos;achètent sur le quai le jour même.</p>
                    </div>
                    <div style={S('display:flex;flex-direction:column;gap:12px')}>
                      <a href="#ardoise" style={S('display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 26px;border-radius:999px;background:#FFFFFF;color:#0B2239;font-weight:700;font-size:16px;text-decoration:none;box-shadow:0 12px 30px rgba(0,0,0,0.25)')}>Voir l&apos;ardoise du jour ↑</a>
                      <a href={`tel:${TEL_HREF}`} style={S('display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 26px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.4);color:#FFFFFF;font-weight:700;font-size:16px;text-decoration:none')}><span style={S('display:inline-block;width:8px;height:8px;border-radius:50%;background:#4CD98A')}></span>Réserver · {TELEPHONE}</a>
                    </div>
                  </div>

                  <div style={S('text-align:center;margin-top:20px;font-size:12px;color:rgba(190,227,245,0.7)')}>{sourceLabel}</div>
                </div>
              </div>
              <svg viewBox="0 0 1440 90" preserveAspectRatio="none" style={S('display:block;width:100%;height:clamp(40px,6vw,90px);margin-top:-1px')}>
                <path d="M0,0 L0,35 C200,70 420,15 660,42 C900,70 1140,25 1440,50 L1440,0 Z" fill="#0B2239"></path>
                <path d="M0,0 L0,18 C240,44 500,8 760,30 C1020,52 1240,16 1440,34 L1440,0 Z" fill="rgba(79,179,232,0.30)"></path>
              </svg>
            </section>

            {/* PANORAMA */}
            <section style={S('max-width:1240px;margin:0 auto;padding:clamp(64px,9vw,120px) 24px 0')}>
              <div style={S('position:relative;border-radius:28px;overflow:hidden')}>
                <img src="/uploads/IMG_1320.jpg" alt="Mers-les-Bains et ses villas Belle Époque, depuis la mer" style={S('width:100%;height:clamp(280px,38vw,460px);object-fit:cover;display:block')} />
                <div style={S('position:absolute;left:16px;bottom:16px;background:rgba(255,255,255,0.88);backdrop-filter:blur(12px);border-radius:999px;padding:9px 20px;font-size:13px;font-weight:600;color:#0B2239')}>Mers-les-Bains et ses villas Belle Époque · vues du large</div>
              </div>
            </section>

            {/* FACEBOOK + ACCÈS */}
            <section style={S('max-width:1240px;margin:0 auto;padding:clamp(64px,9vw,120px) 24px clamp(64px,9vw,110px);display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px')}>
              <div style={S('background:#F2F9FE;border:1px solid #DCEDF8;border-radius:28px;padding:32px;display:flex;flex-direction:column;gap:14px')}>
                <div style={S('font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#1D82C4')}>Actualités</div>
                <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:23px;letter-spacing:-0.01em")}>Suivez la mer au jour le jour</div>
                <p style={S('margin:0;font-size:14.5px;line-height:1.65;color:#5C7893;flex:1')}>Annulations météo de dernière minute, photos des sorties, actualités du port : tout se passe sur notre page Facebook, mise à jour par le capitaine.</p>
                <a href="https://www.facebook.com/EtoileFilante76/" target="_blank" rel="noopener" className="hvBlueBg" style={S('align-self:flex-start;padding:13px 24px;border-radius:999px;background:#0B2239;color:#FFFFFF;font-weight:700;font-size:14px;text-decoration:none')}>Ouvrir la page Facebook ↗</a>
              </div>
              <div style={S('background:#FFFFFF;border:1px solid #DCEDF8;border-radius:28px;overflow:hidden;display:flex;flex-direction:column')}>
                <iframe title="Plan d'accès au quai François 1er" src="https://www.openstreetmap.org/export/embed.html?bbox=1.3579%2C50.0545%2C1.3865%2C50.0695&layer=mapnik&marker=50.0620715%2C1.37143055" style={S('border:0;width:100%;flex:1;min-height:230px')}></iframe>
                <div style={S('padding:18px 24px;font-size:14px;line-height:1.6;color:#5C7893')}><strong style={S('color:#0B2239')}>Embarquement :</strong> Quai François 1ᵉʳ, 76470 Le Tréport · billetterie sur le quai, face aux bateaux.</div>
              </div>
            </section>
          </div>
        )}

        {/* ======================== BALADES EN MER ======================== */}
        {page === 'balades' && (
          <div style={S('max-width:1240px;margin:0 auto;padding:clamp(44px,6vw,72px) 24px clamp(64px,9vw,110px)')}>
            <div style={S('max-width:720px;margin-bottom:48px')}>
              <div style={S('font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#1D82C4;margin-bottom:14px')}>Balades en mer</div>
              <h1 style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(32px,4.6vw,56px);letter-spacing:-0.02em;line-height:1.05;margin:0 0 16px")}>30 minutes ou 1 heure, <span style={S('background:#BDE8F5;border-radius:12px;padding:0 12px;box-decoration-break:clone;-webkit-box-decoration-break:clone')}>au pied des falaises</span></h1>
              <p style={S('font-size:16.5px;line-height:1.7;color:#5C7893;margin:0')}>Toutes nos balades partent du quai François 1ᵉʳ et sont commentées par le capitaine : anecdotes sur la faune, la flore et l&apos;histoire de la côte d&apos;albâtre. Un départ toutes les 30 minutes · L&apos;Étoile Filante et L&apos;EDEN se relaient à quai.</p>
            </div>

            <div style={S('display:flex;flex-direction:column;gap:56px')}>
              <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:34px;align-items:center')}>
                <img src="/uploads/IMG_1313.jpg" alt="Balade en mer · 30 minutes" style={S('width:100%;height:clamp(260px,30vw,400px);object-fit:cover;display:block;border-radius:26px')} />
                <div style={S('display:flex;flex-direction:column;gap:14px')}>
                  <div style={S('display:flex;align-items:center;gap:12px')}>
                    <span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:15px;color:#4FB3E8")}>01</span>
                    <span style={S('height:1px;width:36px;background:#B9D8EC')}></span>
                    <span style={S('font-size:11.5px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#1D82C4')}>Promenade</span>
                  </div>
                  <h2 style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:clamp(24px,2.6vw,32px);letter-spacing:-0.01em;margin:0")}>Balade en mer · 30 minutes</h2>
                  <p style={S('margin:0;font-size:15.5px;line-height:1.75;color:#5C7893')}>Départ du quai François 1ᵉʳ, cap sur les falaises de craie les plus hautes d&apos;Europe. Le capitaine commente la côte, le port, la faune et la flore. Parfait pour une première sortie en famille.</p>
                  <div style={S('display:flex;gap:8px;flex-wrap:wrap;margin-top:4px')}>
                    {['30 minutes', 'Tous âges', 'Commentée', 'Animaux acceptés'].map((f) => (
                      <div key={f} style={S('background:#EAF6FD;border-radius:999px;padding:7px 15px;font-size:12.5px;font-weight:700;color:#1D82C4')}>{f}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:34px;align-items:center')}>
                <div style={S('display:flex;flex-direction:column;gap:14px;order:1')}>
                  <div style={S('display:flex;align-items:center;gap:12px')}>
                    <span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:15px;color:#4FB3E8")}>02</span>
                    <span style={S('height:1px;width:36px;background:#B9D8EC')}></span>
                    <span style={S('font-size:11.5px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#1D82C4')}>Promenade</span>
                  </div>
                  <h2 style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:clamp(24px,2.6vw,32px);letter-spacing:-0.01em;margin:0")}>Balade en mer · 1 heure</h2>
                  <p style={S('margin:0;font-size:15.5px;line-height:1.75;color:#5C7893')}>La balade complète : du Tréport à Mers-les-Bains et jusqu&apos;au Bois de Cise. Villas Belle Époque vues du large, colonies d&apos;oiseaux marins, et parfois des phoques au rendez-vous.</p>
                  <div style={S('display:flex;gap:8px;flex-wrap:wrap;margin-top:4px')}>
                    {['1 heure', "Jusqu'au Bois de Cise", 'Commentée'].map((f) => (
                      <div key={f} style={S('background:#EAF6FD;border-radius:999px;padding:7px 15px;font-size:12.5px;font-weight:700;color:#1D82C4')}>{f}</div>
                    ))}
                  </div>
                </div>
                <img src="/uploads/IMG_1320.jpg" alt="Balade en mer · 1 heure" style={S('width:100%;height:clamp(260px,30vw,400px);object-fit:cover;display:block;border-radius:26px;order:2')} />
              </div>
            </div>

            <div style={S('margin-top:72px;padding-top:48px;border-top:1px solid #E4EFF7')}>
              <h2 style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(24px,3vw,36px);letter-spacing:-0.02em;margin:0 0 28px")}>Les bateaux &amp; l&apos;équipage</h2>
              <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px')}>
                {([
                  ["L'EDEN", WIX('3fd16e_64ce061d147443df8c68886b5abb354a~mv2.jpg'), "Jusqu'à 90 passagers. Le grand frère, spacieux et stable, idéal pour les groupes."],
                  ["L'Étoile Filante", '/uploads/IMG_1296.jpg', "Jusqu'à 70 passagers. Le bateau historique qui a donné son nom à la maison."],
                  ['Gautier, votre capitaine', WIX('3fd16e_feb6a7796b1840ae956e2296f1fb130c~mv2.jpg'), 'Marin du Tréport, il commente chaque sortie et décide chaque veille des départs selon la météo.'],
                ] as [string, string, string][]).map(([title, img, desc]) => (
                  <div key={title} style={S('background:#F2F9FE;border:1px solid #DCEDF8;border-radius:24px;overflow:hidden')}>
                    <img src={img} alt={title} style={S('width:100%;height:200px;object-fit:cover;display:block')} />
                    <div style={S('padding:18px 22px 20px')}>
                      <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:17px")}>{title}</div>
                      <div style={S('font-size:13.5px;color:#5C7893;margin-top:6px;line-height:1.6')}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================= PÊCHE EN MER ========================= */}
        {page === 'peche' && (
          <div style={S('max-width:1240px;margin:0 auto;padding:clamp(44px,6vw,72px) 24px clamp(64px,9vw,110px)')}>
            <div style={S('max-width:720px;margin-bottom:48px')}>
              <div style={S('font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#1D82C4;margin-bottom:14px')}>Pêche en mer</div>
              <h1 style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(32px,4.6vw,56px);letter-spacing:-0.02em;line-height:1.05;margin:0 0 16px")}>6 heures au large, <span style={S('background:#BDE8F5;border-radius:12px;padding:0 12px;box-decoration-break:clone;-webkit-box-decoration-break:clone')}>poisson garanti</span></h1>
              <p style={S('font-size:16.5px;line-height:1.7;color:#5C7893;margin:0')}>Constituez votre groupe de pêcheurs · <strong style={S('color:#0B2239')}>7 personnes minimum</strong> · et partez 6 heures au large avec le capitaine, le plus souvent à bord de L&apos;Étoile Filante. Prévoyez bottes et glacière : vous repartez avec vos poissons !</p>
            </div>

            <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:34px;align-items:start')}>
              <div style={S('display:flex;flex-direction:column;gap:18px')}>
                <img src="/uploads/679031361_1893613261685096_5120760682960525618_n.jpg" alt="L'Étoile Filante au large, un chalutier à l'horizon" style={S('width:100%;height:clamp(240px,26vw,340px);object-fit:cover;display:block;border-radius:26px')} />
                <div style={S('display:flex;gap:8px;flex-wrap:wrap')}>
                  {['Sortie 6 heures', '60 € / personne', 'Location de canne 12 €', '7 pêcheurs minimum'].map((f) => (
                    <div key={f} style={S('background:#EAF6FD;border-radius:999px;padding:8px 16px;font-size:12.5px;font-weight:700;color:#1D82C4')}>{f}</div>
                  ))}
                </div>
                <div style={S('background:#F2F9FE;border:1px solid #DCEDF8;border-radius:20px;padding:18px 22px;font-size:14px;line-height:1.7;color:#5C7893')}><strong style={S('color:#0B2239')}>Réservation obligatoire</strong> par téléphone au <a href={`tel:${TEL_HREF}`} style={S('font-weight:700')}>{TELEPHONE}</a> · les départs dépendent de la marée du matin (souvent autour de 6h).</div>
              </div>

              <div style={S('background:#FFFFFF;border:1px solid #DCEDF8;border-radius:26px;padding:26px 28px;box-shadow:0 12px 34px rgba(20,93,160,0.10)')}>
                <div style={S('display:flex;align-items:center;gap:12px;margin-bottom:16px')}>
                  <span style={S('display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;background:#EAF6FD')}>
                    <Fish width={22} height={22} stroke="#1D82C4" strokeWidth={1.8} />
                  </span>
                  <h2 style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:20px;margin:0")}>Prochaines sorties pêche</h2>
                </div>
                {pechesAvenir.length > 0 && (
                  <div style={S('display:flex;flex-direction:column;gap:10px')}>
                    {pechesAvenir.map((p) => (
                      <div key={p.id} style={S('display:flex;align-items:center;gap:16px;background:#F2F9FE;border:1px solid #DCEDF8;border-radius:18px;padding:14px 18px')}>
                        <div style={S('text-align:center;background:#FFFFFF;border:1px solid #DCEDF8;border-radius:14px;padding:8px 14px;min-width:64px')}>
                          <div style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:20px;color:#0B2239;line-height:1")}>{p.day}</div>
                          <div style={S('font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#1D82C4;margin-top:3px')}>{p.month}</div>
                        </div>
                        <div style={S('flex:1;min-width:0')}>
                          <div style={S('font-weight:700;font-size:15px;color:#0B2239;text-transform:capitalize')}>{p.dayLabel}</div>
                          <div style={S('font-size:13px;color:#5C7893;margin-top:2px')}>Départ {p.time} · {p.note}</div>
                        </div>
                        <div style={S(`padding:6px 13px;border-radius:999px;font-size:11.5px;font-weight:700;background:${p.chipBg};color:${p.chipFg};white-space:nowrap`)}>{p.chipLabel}</div>
                      </div>
                    ))}
                  </div>
                )}
                {pechesAvenir.length === 0 && (
                  <div style={S('background:#F2F9FE;border-radius:18px;padding:20px 22px;font-size:14.5px;line-height:1.7;color:#5C7893')}>Aucune date programmée pour le moment · appelez le <a href={`tel:${TEL_HREF}`} style={S('font-weight:700')}>{TELEPHONE}</a> pour constituer votre groupe : dès 7 pêcheurs, le capitaine cale une date sur la marée.</div>
                )}
                <div style={S('margin-top:16px;font-size:12px;color:#8FA9BE;line-height:1.6')}>Les dates sont publiées ici dès qu&apos;un groupe est constitué et que la marée le permet.</div>
              </div>
            </div>
          </div>
        )}

        {/* ================== ÉVÉNEMENTS & PRIVATISATION ================== */}
        {page === 'evenements' && (
          <div style={S('max-width:1240px;margin:0 auto;padding:clamp(44px,6vw,72px) 24px clamp(64px,9vw,110px)')}>
            <div style={S('max-width:720px;margin-bottom:48px')}>
              <div style={S('font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#1D82C4;margin-bottom:14px')}>Événements &amp; privatisation</div>
              <h1 style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(32px,4.6vw,56px);letter-spacing:-0.02em;line-height:1.05;margin:0 0 16px")}>Un bateau <span style={S('background:#BDE8F5;border-radius:12px;padding:0 12px;box-decoration-break:clone;-webkit-box-decoration-break:clone')}>rien que pour vous</span></h1>
              <p style={S('font-size:16.5px;line-height:1.7;color:#5C7893;margin:0')}>Vin d&apos;honneur, enterrement de vie de célibataire, dispersion de cendres en mer, sorties scolaires et groupes : privatisez L&apos;Étoile Filante ou L&apos;EDEN, avec le commentaire du capitaine si vous le souhaitez.</p>
            </div>

            <div style={S('position:relative;border-radius:28px;overflow:hidden;margin-bottom:34px')}>
              <img src="/uploads/518207258_1636985877347837_501752820138468060_n.jpg" alt="Feu d'artifice sur le port du Tréport" style={S('width:100%;height:clamp(280px,38vw,440px);object-fit:cover;display:block')} />
              <div style={S('position:absolute;left:16px;bottom:16px;background:rgba(255,255,255,0.88);backdrop-filter:blur(12px);border-radius:999px;padding:9px 20px;font-size:13px;font-weight:600;color:#0B2239')}>Les soirs d&apos;événement, le port devient un spectacle</div>
            </div>

            <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px')}>
              <div style={S('background:#FFFFFF;border:1px solid #DCEDF8;border-radius:26px;padding:28px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 30px rgba(20,93,160,0.08)')}>
                <div style={S('font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#1D82C4')}>Privatisation</div>
                <div style={S('display:flex;align-items:baseline;gap:8px')}><span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:34px;color:#0B2239")}>300 €</span><span style={S('font-size:13px;color:#5C7893')}>· 30 minutes</span></div>
                <div style={S('font-size:13.5px;color:#5C7893;line-height:1.6')}>Le tour classique des falaises, rien que pour votre groupe.</div>
              </div>
              <div style={S('background:#0B2239;border-radius:26px;padding:28px;display:flex;flex-direction:column;gap:10px;color:#FFFFFF;box-shadow:0 14px 38px rgba(11,34,57,0.28)')}>
                <div style={S('font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#9ED4F2')}>Privatisation</div>
                <div style={S('display:flex;align-items:baseline;gap:8px')}><span style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:34px")}>600 €</span><span style={S('font-size:13px;color:#BEE3F5')}>· 1 heure</span></div>
                <div style={S('font-size:13.5px;color:#BEE3F5;line-height:1.6')}>Jusqu&apos;au Bois de Cise · le format idéal pour un vin d&apos;honneur au large.</div>
              </div>
              <div style={S('background:#FFFFFF;border:1px solid #DCEDF8;border-radius:26px;padding:28px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 30px rgba(20,93,160,0.08)')}>
                <div style={S('font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#1D82C4')}>Groupes &amp; scolaires</div>
                <div style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:22px;color:#0B2239")}>Sur devis</div>
                <div style={S('font-size:13.5px;color:#5C7893;line-height:1.6')}>Écoles, centres de loisirs, établissements : jusqu&apos;à 90 passagers sur L&apos;EDEN, créneau réservé au planning.</div>
              </div>
            </div>

            <div style={S('margin-top:28px;background:#F2F9FE;border:1px solid #DCEDF8;border-radius:22px;padding:22px 26px;display:flex;gap:18px;align-items:center;flex-wrap:wrap')}>
              <div style={S('flex:1;min-width:240px;font-size:14.5px;line-height:1.7;color:#5C7893')}><strong style={S('color:#0B2239')}>Une date en tête ?</strong> Appelez le capitaine : il cale votre créneau sur la marée et bloque le bateau au planning.</div>
              <a href={`tel:${TEL_HREF}`} className="hvBlueBg" style={S('display:inline-flex;align-items:center;gap:9px;padding:13px 24px;border-radius:999px;background:#0B2239;color:#FFFFFF;font-weight:700;font-size:14.5px;text-decoration:none')}>
                <span style={S('display:inline-block;width:8px;height:8px;border-radius:50%;background:#4CD98A')}></span>{TELEPHONE}
              </a>
            </div>
          </div>
        )}

        {/* ============================ TARIFS ============================ */}
        {page === 'tarifs' && (
          <div style={S('max-width:1240px;margin:0 auto;padding:clamp(44px,6vw,72px) 24px clamp(64px,9vw,110px)')}>
            <div style={S('max-width:720px;margin-bottom:44px')}>
              <div style={S('font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#1D82C4;margin-bottom:14px')}>Tarifs</div>
              <h1 style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(32px,4.6vw,56px);letter-spacing:-0.02em;line-height:1.05;margin:0 0 16px")}>Des prix simples, comme au quai</h1>
              <p style={S('font-size:16.5px;line-height:1.7;color:#5C7893;margin:0')}>Billets en vente à la billetterie du quai, le jour même. Réservation conseillée par téléphone au <a href={`tel:${TEL_HREF}`} style={S('font-weight:700')}>{TELEPHONE}</a>.</p>
            </div>

            <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px')}>
              {tarifCards.map((t) => (
                <div key={t.title} style={S(`background:${t.bg};color:${t.fg};border:1px solid ${t.border};border-radius:28px;padding:32px;display:flex;flex-direction:column;gap:16px`)}>
                  <div>
                    <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:21px;letter-spacing:-0.01em")}>{t.title}</div>
                    <div style={S('font-size:13px;margin-top:4px;opacity:0.7')}>{t.sub}</div>
                  </div>
                  <div style={S('display:flex;flex-direction:column;gap:10px;flex:1')}>
                    {t.rows.map((r) => (
                      <div key={r.k} style={S(`display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-bottom:1px solid ${t.rowLine};padding-bottom:9px`)}>
                        <div style={S('font-size:14.5px')}>{r.k}</div>
                        <div style={S("font-family:'Sora',sans-serif;font-weight:700;font-size:17px;white-space:nowrap")}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={S('font-size:12.5px;line-height:1.55;opacity:0.7')}>{t.note}</div>
                </div>
              ))}
            </div>

            <div style={S('margin-top:24px;background:#F2F9FE;border:1px solid #DCEDF8;border-radius:999px;padding:15px 26px;display:flex;gap:12px;flex-wrap:wrap;align-items:center')}>
              <div style={S('font-weight:700;font-size:13.5px;color:#0B2239')}>Moyens de paiement :</div>
              {paiements.map((p) => (
                <div key={p} style={S('background:#FFFFFF;border:1px solid #DCEDF8;border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:600;color:#5C7893')}>{p}</div>
              ))}
            </div>
          </div>
        )}

        {/* ======================== INFOS PRATIQUES ======================= */}
        {page === 'infos' && (
          <div style={S('max-width:900px;margin:0 auto;padding:clamp(44px,6vw,72px) 24px clamp(64px,9vw,110px)')}>
            <div style={S('margin-bottom:40px')}>
              <div style={S('font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#1D82C4;margin-bottom:14px')}>Infos pratiques</div>
              <h1 style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(32px,4.6vw,56px);letter-spacing:-0.02em;line-height:1.05;margin:0")}>Avant d&apos;embarquer</h1>
            </div>
            <div style={S('display:flex;flex-direction:column')}>
              {faqData.map(([q, a], i) => (
                <div key={q} style={S('border-bottom:1px solid #E4EFF7')}>
                  <button onClick={() => setFaqOpen(faqOpen === i ? -1 : i)} className="hvBlue" style={S("cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:14px;width:100%;padding:22px 4px;font-family:'Sora',sans-serif;font-weight:700;font-size:16.5px;color:#0B2239")}>
                    <span>{q}</span>
                    <span style={S('display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#EAF6FD;color:#1D82C4;font-size:17px;font-weight:600;flex:none')}>{faqOpen === i ? '−' : '+'}</span>
                  </button>
                  {faqOpen === i && (
                    <div style={S('padding:0 4px 24px;font-size:15px;line-height:1.75;color:#5C7893;max-width:66ch')}>{a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================== CONTACT ============================ */}
        {page === 'contact' && (
          <div style={S('max-width:1240px;margin:0 auto;padding:clamp(44px,6vw,72px) 24px clamp(64px,9vw,110px)')}>
            <div style={S('max-width:720px;margin-bottom:44px')}>
              <div style={S('font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:#1D82C4;margin-bottom:14px')}>Contact</div>
              <h1 style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(32px,4.6vw,56px);letter-spacing:-0.02em;line-height:1.05;margin:0")}>Réservez en un coup de fil</h1>
            </div>
            <div style={S('display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px;align-items:stretch')}>
              <div style={S('background:#F2F9FE;border:1px solid #DCEDF8;border-radius:28px;padding:36px;display:flex;flex-direction:column;gap:18px')}>
                <div style={S('font-size:11.5px;letter-spacing:0.22em;text-transform:uppercase;color:#1D82C4;font-weight:700')}>Réservation par téléphone</div>
                <a href={`tel:${TEL_HREF}`} className="hvBlue" style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:clamp(28px,3.6vw,42px);letter-spacing:-0.02em;color:#0B2239;text-decoration:none")}>{TELEPHONE}</a>
                <div style={S('font-size:14.5px;line-height:1.65;color:#5C7893')}>Gautier Ricque, capitaine.<br />Réponse rapide en saison · sinon, laissez un message.</div>
                <div style={S('height:1px;background:#DCEDF8')}></div>
                <div style={S('font-size:14.5px;line-height:2')}>
                  <div><span style={S('color:#8FA9BE')}>Email :</span> <a href="mailto:gautier76910@live.fr" style={S('font-weight:700')}>gautier76910@live.fr</a></div>
                  <div><span style={S('color:#8FA9BE')}>Billetterie :</span> <span style={S('font-weight:600')}>Place de la Poissonnerie municipale, quai François 1ᵉʳ, 76470 Le Tréport</span></div>
                  <div><span style={S('color:#8FA9BE')}>Facebook :</span> <a href="https://www.facebook.com/EtoileFilante76/" target="_blank" rel="noopener" style={S('font-weight:700')}>@EtoileFilante76 ↗</a></div>
                </div>
                <div style={S('background:#FFFFFF;border:1px solid #DCEDF8;border-radius:18px;padding:15px 18px;font-size:13px;line-height:1.6;color:#5C7893')}>Pas de réservation en ligne : un coup de fil suffit, et la billetterie du quai vend les billets le jour même.</div>
              </div>
              <div style={S('background:#FFFFFF;border:1px solid #DCEDF8;border-radius:28px;overflow:hidden;display:flex;flex-direction:column')}>
                <iframe title="Plan d'accès" src="https://www.openstreetmap.org/export/embed.html?bbox=1.3535%2C50.0525%2C1.3905%2C50.0715&layer=mapnik&marker=50.0620715%2C1.37143055" style={S('border:0;width:100%;flex:1;min-height:320px')}></iframe>
                <div style={S('padding:18px 24px;font-size:14px;line-height:1.65;color:#5C7893')}>Parkings : quai Sud et esplanade de la plage (5 min à pied). Le funiculaire gratuit relie la ville haute au port.</div>
              </div>
            </div>
          </div>
        )}

        {/* BANDEAU PHOTOS DÉFILANT */}
        <section style={S('overflow:hidden;padding:clamp(44px,6vw,76px) 0 clamp(26px,3.4vw,44px)')}>
          <div style={S('display:flex;gap:14px;width:max-content;animation:ef-scroll 55s linear infinite')}>
            {[...marqueePhotos, ...marqueePhotos].map(([src, alt], i) => (
              <img key={i} src={src} alt={i < marqueePhotos.length ? alt : ''} style={S('width:300px;height:200px;object-fit:cover;border-radius:20px;flex:none')} />
            ))}
          </div>
        </section>
      </main>

      {/* ======================= FOOTER ======================= */}
      <footer style={S('background:#0B2239;color:#8FA9BE;padding:44px 24px 36px')}>
        <div style={S('max-width:1240px;margin:0 auto;display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;align-items:flex-start')}>
          <div>
            <div style={S("font-family:'Sora',sans-serif;font-weight:800;font-size:17px;color:#FFFFFF")}>Étoile Filante <span style={S('color:#4FB3E8')}>✦</span> L&apos;EDEN</div>
            <div style={S('font-size:13px;margin-top:8px;line-height:1.7')}>Promenades et pêche en mer<br />Quai François 1ᵉʳ · 76470 Le Tréport<br /><a href={`tel:${TEL_HREF}`} style={S('color:#FFFFFF;font-weight:600')}>{TELEPHONE}</a></div>
          </div>
          <div style={S('font-size:11.5px;display:flex;flex-direction:column;gap:10px;align-items:flex-end;max-width:420px;text-align:right')}>
            <div style={S('display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end')}>
              <a href="#" onClick={go('contact')} style={S('color:#FFFFFF;border:1px solid rgba(79,179,232,0.45);border-radius:999px;padding:8px 18px;text-decoration:none;font-weight:600')}>Contact &amp; réservation →</a>
              <a href="/cockpit" style={S('color:#FFFFFF;border:1px solid rgba(79,179,232,0.45);border-radius:999px;padding:8px 18px;text-decoration:none;font-weight:600')}>Back-office →</a>
            </div>
            <span style={S('opacity:0.7;line-height:1.6')}>{sourceLabel}</span>
            <span style={S('opacity:0.5')}>Photos © Ulterior Portus</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
