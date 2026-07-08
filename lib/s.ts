import type { CSSProperties } from 'react';

/* Convertit une chaîne CSS inline (telle que fournie par la maquette design)
   en objet de style React. Les déclarations sont mémoïsées : la même chaîne
   n'est parsée qu'une fois. */
const cache = new Map<string, CSSProperties>();

export function S(css: string): CSSProperties {
  const hit = cache.get(css);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop || !val) continue;
    if (prop.startsWith('--')) {
      out[prop] = val;
      continue;
    }
    out[prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = val;
  }
  const style = out as CSSProperties;
  cache.set(css, style);
  return style;
}
