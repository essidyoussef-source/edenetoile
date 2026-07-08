# L'Étoile Filante & L'EDEN · Promenades en mer au Tréport

Site vitrine + back-office (« cockpit ») pour les promenades en mer de L'Étoile Filante
et de L'EDEN au port du Tréport. Les horaires de balade dépendent de la marée (le port
s'assèche à marée basse) : le site calcule automatiquement les créneaux possibles à
partir des marées et de la météo Open-Meteo, et le capitaine confirme/annule depuis le
cockpit.

**Préversion privée** : tout le site est protégé par mot de passe.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- Styles inline portés au pixel près depuis les maquettes (`lib/s.ts` convertit les
  chaînes CSS de la maquette en objets de style React)
- **Open-Meteo** (marées + météo, gratuit et sans clé) via les routes proxy
  `/api/tides` et `/api/weather` (cache serveur 30 min) · repli : modèle harmonique
  local M2+S2+N2 si l'API est indisponible
- Aucune base de données : l'état du cockpit (statuts, bateaux, privatisations,
  pêches, réservations, bandeau) vit dans le `localStorage` du navigateur
  (clé `ef_backoffice_v1`), comme dans le prototype

## Pages

| Route | Description |
| --- | --- |
| `/` | Site public (accueil, balades, pêche, événements, tarifs, infos, contact) |
| `/cockpit` | Back-office : planning agenda, gestion du jour, calendrier des marées |
| `/acces` | Porte d'entrée par mot de passe |

L'accès est gardé par un **layout server-component** sur le groupe de routes `app/(site)/`
(runtime Node), pas par un middleware Edge — cela évite un bug de bundling Edge de
Next 15.5 (`__dirname is not defined`). Les routes `/api/tides` et `/api/weather`
vérifient le cookie et renvoient 401 si l'accès n'est pas validé.

## Mot de passe

Défini par la variable d'environnement `SITE_PASSWORD`. Sans variable, le mot de passe
par défaut est **`moussaillon76`**. Le cookie d'accès (HttpOnly) stocke un hachage
salé, jamais le mot de passe. Pour changer le mot de passe : définir `SITE_PASSWORD`
dans les réglages Vercel puis redéployer — toutes les personnes connectées devront se
reconnecter.

## Développement

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de production
```

## Limites connues (préversion)

- **État partagé** : le cockpit écrit dans le `localStorage` du navigateur — les
  changements du capitaine ne sont visibles que dans *son* navigateur. Pour la mise en
  production réelle, brancher une base (Vercel KV / Postgres ou Supabase) derrière une
  route `api/schedule`, comme prévu dans le handoff.
- **Marées lointaines** : au-delà de ~10 jours, estimation harmonique locale (marquée
  d'un astérisque) — à recaler sur l'annuaire SHOM pour du 100 % officiel.
- La page est marquée `noindex` (préversion privée).

Photos © Ulterior Portus / Étoile Filante.
