import type { Persona, Skill } from './types';

import goldenDemonData from '../data/golden-demon-data.json';
import fusionChartData from '../data/golden-fusion-chart.json';
import specialRecipesData from '../data/special-recipes.json';
import skillsData from '../data/skills.json';

// Fusion chart races set for fast membership check
const _chartRaces = new Set(
  (fusionChartData as { races: string[]; table: string[][] }).races
);

// Build persona list from golden demon data (superset of base P4 personas).
// Excludes personas whose arcana is not in the fusion chart (e.g. World/Izanagi-no-Okami).
export const personas: Persona[] = Object.entries(
  goldenDemonData as Record<string, {
    inherits: string; lvl: number; race: string;
    resists: string; stats: number[]; skills: Record<string, number>;
  }>
).map(([name, d]) => ({
  name,
  arcana: d.race,
  lvl: d.lvl,
  inherits: d.inherits,
  resists: d.resists,
  stats: d.stats,
  skills: d.skills,
}));

// All personas that can appear in normal fusion (in-chart arcana only)
export const fusiblePersonas: Persona[] = personas.filter(p => _chartRaces.has(p.arcana));

export const personaMap: Record<string, Persona> = Object.fromEntries(
  personas.map(p => [p.name, p])
);

// Group personas by arcana, sorted by level ascending
export const personasByArcana: Record<string, Persona[]> = {};
for (const p of personas) {
  if (!personasByArcana[p.arcana]) personasByArcana[p.arcana] = [];
  personasByArcana[p.arcana].push(p);
}
for (const arcana of Object.keys(personasByArcana)) {
  personasByArcana[arcana].sort((a, b) => a.lvl - b.lvl);
}

// Fusion chart
export const fusionChart = fusionChartData as { races: string[]; table: string[][] };

// Triple (3-way) fusion chart lookup uses the LOWER-triangular portion of the same table:
// tripleChart[i][j] = fullTable[max(i,j)][min(i,j)]
export function getTripleArcana(arcana1: string, arcana2: string): string | null {
  const { races: r, table: t } = fusionChart;
  const i = r.indexOf(arcana1);
  const j = r.indexOf(arcana2);
  if (i < 0 || j < 0) return null;
  return t[Math.max(i, j)][Math.min(i, j)] ?? null;
}

// Build O(1) lookup: arcana pair -> result arcana
// The full table is 23×23 but only the upper-triangular portion is canonical for
// normal 2-way fusion: result = table[min(i,j)][max(i,j)].
// The lower triangular portion is used for triple-fusion (separate logic).
export const arcanaFusionMap: Record<string, Record<string, string>> = {};
const { races, table } = fusionChart;
for (let i = 0; i < races.length; i++) {
  for (let j = 0; j < races.length; j++) {
    const raceA = races[i];
    const raceB = races[j];
    // Always use the upper-triangular entry for symmetry
    const result = table[Math.min(i, j)][Math.max(i, j)];
    if (!arcanaFusionMap[raceA]) arcanaFusionMap[raceA] = {};
    arcanaFusionMap[raceA][raceB] = result;
  }
}

// Special recipes: result name -> ingredient names[]
export const specialRecipes = specialRecipesData as Record<string, string[]>;

// Personas that can only be made via their special recipe — excluded from normal fusion results
export const specialPersonaNames = new Set(Object.keys(specialRecipes));

// Reverse special map: sorted ingredient pair string -> result name (2-ingredient only)
export const twoIngredientSpecials: Record<string, string> = {};
for (const [result, ings] of Object.entries(specialRecipes)) {
  if (ings.length === 2) {
    const key = [ings[0], ings[1]].sort().join('|');
    twoIngredientSpecials[key] = result;
  }
}

// Personas usable as normal fusion RESULTS (excludes special-recipe-only personas)
export const personasByArcanaForResults: Record<string, Persona[]> = {};
for (const [arcana, list] of Object.entries(personasByArcana)) {
  personasByArcanaForResults[arcana] = list.filter(p => !specialPersonaNames.has(p.name));
}

// Skills lookup
export const skills = skillsData as Record<string, Skill>;

// All unique arcanas in play
export const arcanas: string[] = Array.from(new Set(personas.map(p => p.arcana))).sort();
