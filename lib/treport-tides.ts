/* ─────────────────────────────────────────────────────────────────────────
   DONNÉES DE RÉFERENCE — MARÉES DU PORT DU TRÉPORT (76)
   ─────────────────────────────────────────────────────────────────────────
   Caractéristiques marégraphiques de référence, pour donner du contexte et
   de la crédibilité à l'affichage. Valeurs INDICATIVES issues de références
   nautiques / SHOM (ordres de grandeur fiables), à CONFIRMER sur l'annuaire
   officiel avant tout usage opérationnel :

     • Annuaire des marées SHOM : https://maree.shom.fr  (port : Le Tréport,
       rattaché au port de référence de DIEPPE).
     • Le Tréport est un « port rattaché » : l'annuaire officiel le donne par
       différences de hauteur/heure par rapport à Dieppe.

   ⚠️ Le coefficient et les hauteurs affichés par l'appli sont CALCULÉS/ESTIMÉS
   à partir d'un modèle (Open-Meteo Marine + estimation harmonique locale),
   pas lus dans l'annuaire officiel. Pour du 100 % officiel : intégrer les
   prédictions SHOM (constantes harmoniques calibrées Le Tréport, ou l'API
   maree.shom.fr).
   ───────────────────────────────────────────────────────────────────────── */

export const TREPORT_REF = {
  nom: 'Le Tréport',
  departement: 'Seine-Maritime (76)',
  mer: 'Manche (côte d’Albâtre)',
  // Position de la station (utilisée pour les appels Open-Meteo)
  latitude: 50.061, // ≈ 50°03′40″ N
  longitude: 1.374, // ≈ 001°22′26″ E
  latLonTexte: '50°03′40″ N · 001°22′26″ E',

  // Référence verticale
  zeroHydrographique:
    'Zéro hydrographique (ZH) = niveau des plus basses mers astronomiques, référence des sondes SHOM.',

  // Port de rattachement (référence officielle SHOM)
  portDeReference: 'Dieppe',
  rattachementNote:
    'Port rattaché à Dieppe (≈ 30 km au SO). Pleine mer quasi simultanée ; l’annuaire officiel SHOM donne Le Tréport par différences par rapport à Dieppe.',

  // Marnage (régime macrotidal — parmi les plus forts de la Manche)
  marnage: {
    vivesEauxMoy: '≈ 8,5 à 9 m',
    mortesEauxMoy: '≈ 4 à 5 m',
    note: 'Régime macrotidal ; les plus grandes marées dépassent 9 m de marnage.',
  },

  // Niveaux caractéristiques approximatifs au-dessus du zéro hydrographique (m)
  // (ordres de grandeur — à confirmer SHOM)
  niveaux: {
    PMVE: '≈ 9,0 à 9,5 m', // pleine mer de vives-eaux
    PMME: '≈ 7 m', //          pleine mer de mortes-eaux
    niveauMoyen: '≈ 4,9 m', // niveau moyen (utilisé pour le recalage de l’appli)
    BMME: '≈ 3 m', //          basse mer de mortes-eaux
    BMVE: '≈ 0,8 à 1 m', //    basse mer de vives-eaux
  },

  // Échelle des coefficients de marée (système français)
  coefficients: {
    min: 20,
    max: 120,
    reperes: [
      { c: '20 – 40', libelle: 'très petites marées (mortes-eaux)' },
      { c: '45', libelle: 'morte-eau moyenne' },
      { c: '70', libelle: 'marée moyenne' },
      { c: '95', libelle: 'vive-eau moyenne' },
      { c: '100 – 120', libelle: 'grandes marées (vives-eaux)' },
    ],
    note: '100 = vive-eau moyenne d’équinoxe ; au-delà de 100 = grandes marées.',
  },

  // Règle métier de sortie des bateaux (le port s’assèche à marée basse)
  fenetreSortie: 'Sorties possibles de PM − 2h40 à PM + 3h00 (le port s’assèche à marée basse).',

  // Sources
  sources: [
    'Annuaire des marées SHOM — maree.shom.fr (Le Tréport / Dieppe)',
    'Marées temps réel : Open-Meteo Marine (modèle Copernicus GTSM)',
  ],
} as const;

/* Lignes prêtes à afficher (label / valeur) pour un encart « références » */
export const TREPORT_REF_ROWS: { k: string; v: string }[] = [
  { k: 'Position', v: TREPORT_REF.latLonTexte },
  { k: 'Mer', v: TREPORT_REF.mer },
  { k: 'Port de référence', v: TREPORT_REF.portDeReference + ' (SHOM)' },
  { k: 'Marnage vives-eaux', v: TREPORT_REF.marnage.vivesEauxMoy },
  { k: 'Marnage mortes-eaux', v: TREPORT_REF.marnage.mortesEauxMoy },
  { k: 'PM vives-eaux', v: TREPORT_REF.niveaux.PMVE },
  { k: 'BM vives-eaux', v: TREPORT_REF.niveaux.BMVE },
  { k: 'Niveau moyen', v: TREPORT_REF.niveaux.niveauMoyen },
  { k: 'Coefficients', v: TREPORT_REF.coefficients.min + ' → ' + TREPORT_REF.coefficients.max + ' (100 = VE moyenne)' },
  { k: 'Fenêtre de sortie', v: 'PM − 2h40 → PM + 3h00' },
];
