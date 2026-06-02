import type { Persona, FusionRecipe } from './types';
import {
  personasByArcana,
  personasByArcanaForResults,
  arcanaFusionMap,
  twoIngredientSpecials,
  specialRecipes,
  personaMap,
  fusiblePersonas,
  getTripleArcana,
} from './data';

function getResultArcana(arcana1: string, arcana2: string): string | null {
  return arcanaFusionMap[arcana1]?.[arcana2] ?? null;
}

/**
 * Forward fusion: given two personas, return the result.
 * Algorithm matches aqiu384/megaten-fusion-tool (P3/P4 persona fusion rules):
 *   - Different arcana: result = lowest persona in result arcana with lvl >= floor((lvl1+lvl2)/2)+1
 *   - Same arcana: result = highest persona in same arcana with lvl <= floor((lvl1+lvl2)/2)+1
 *     (excluding both ingredients from result candidates)
 */
export function fuseTwo(p1: Persona, p2: Persona): Persona | null {
  // 1. Two-ingredient special recipe check (highest priority)
  const specialKey = [p1.name, p2.name].sort().join('|');
  if (twoIngredientSpecials[specialKey]) {
    return personaMap[twoIngredientSpecials[specialKey]] ?? null;
  }

  const threshold = Math.floor((p1.lvl + p2.lvl) / 2) + 1;

  // 2. Same arcana fusion
  if (p1.arcana === p2.arcana) {
    // Result = highest non-special persona in same arcana with lvl <= threshold,
    // excluding both ingredient personas
    const candidates = (personasByArcanaForResults[p1.arcana] ?? [])
      .filter(p => p.name !== p1.name && p.name !== p2.name);
    let result: Persona | null = null;
    for (const p of candidates) {
      if (p.lvl <= threshold) result = p;
      else break;
    }
    return result;
  }

  // 3. Different arcana fusion
  const resultArcana = getResultArcana(p1.arcana, p2.arcana);
  if (!resultArcana || resultArcana === '-') return null;

  // Result = lowest non-special persona in result arcana with lvl >= threshold,
  // excluding both ingredient personas
  const candidates = (personasByArcanaForResults[resultArcana] ?? [])
    .filter(p => p.name !== p1.name && p.name !== p2.name);
  return candidates.find(p => p.lvl >= threshold) ?? null;
}

/**
 * Triple (3-way) forward fusion.
 * Algorithm matches aqiu384/megaten-fusion-tool per-triple-fusions.ts:
 *   1. Sort inputs by level desc → (T1=highest, N1, N2)
 *   2. Intermediate arcana = normalChart[N1.arcana][N2.arcana]  (same arcana case: use same arcana)
 *   3. Result arcana = tripleChart[T1.arcana][intermediateArcana]  (lower-triangular)
 *   4. Threshold = (T1.lvl + N1.lvl + N2.lvl) / 3 + 4.25
 *   5. Result = lowest non-special persona in result arcana >= threshold
 */
export function fuseThree(p1: Persona, p2: Persona, p3: Persona): Persona | null {
  const [pT1, pN1, pN2] = [p1, p2, p3].sort((a, b) => b.lvl - a.lvl);
  const inputNames = new Set([p1.name, p2.name, p3.name]);

  // Intermediate arcana: normal 2-way chart for N1 × N2
  let interArcana: string | null;
  if (pN1.arcana === pN2.arcana) {
    interArcana = pN1.arcana;
  } else {
    interArcana = arcanaFusionMap[pN1.arcana]?.[pN2.arcana] ?? null;
  }
  if (!interArcana || interArcana === '-') return null;

  // Result arcana: triple chart for T1 × intermediate
  let resultArcana: string | null;
  if (pT1.arcana === interArcana) {
    // Same arcana triple: triple chart same-race lookup
    resultArcana = getTripleArcana(pT1.arcana, pT1.arcana);
  } else {
    resultArcana = getTripleArcana(pT1.arcana, interArcana);
  }
  if (!resultArcana || resultArcana === '-') return null;

  const tripleModifier = 4.25;
  const threshold = (pT1.lvl + pN1.lvl + pN2.lvl) / 3 + tripleModifier;

  const candidates = (personasByArcanaForResults[resultArcana] ?? [])
    .filter(p => !inputNames.has(p.name));
  return candidates.find(p => p.lvl >= threshold) ?? null;
}

/**
 * Reverse fusion: given a target persona, return all recipes that produce it.
 * Handles special recipes (multi-ingredient) and normal two-way fusion.
 */
export function reverseTwo(target: Persona): FusionRecipe[] {
  const recipes: FusionRecipe[] = [];

  // Special recipe (fixed ingredient list)
  if (specialRecipes[target.name]) {
    const ings = specialRecipes[target.name]
      .map(n => personaMap[n])
      .filter(Boolean);
    if (ings.length === specialRecipes[target.name].length) {
      recipes.push({ ingredients: ings, isSpecial: true });
    }
    // Special personas can ONLY be made via their special recipe
    return recipes;
  }

  // Normal fusions: iterate all unordered pairs (only personas with in-chart arcanas)
  const all = fusiblePersonas;
  for (let i = 0; i < all.length; i++) {
    for (let j = i; j < all.length; j++) {
      const result = fuseTwo(all[i], all[j]);
      if (result?.name === target.name) {
        recipes.push({ ingredients: [all[i], all[j]], isSpecial: false });
      }
    }
  }

  return recipes;
}
