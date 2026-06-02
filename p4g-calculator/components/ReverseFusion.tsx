'use client';

import { useState, useMemo } from 'react';
import type { Persona, FusionRecipe } from '@/lib/types';
import type { Skill } from '@/lib/types';
import { reverseTwo } from '@/lib/fusion';
import { PersonaSearch } from './PersonaSearch';
import { PersonaCard } from './PersonaCard';
import { ARCANA_COLORS } from './arcanaColors';

interface Props {
  personas: Persona[];
  skillsDb: Record<string, Skill>;
}

type SortMode = 'level' | 'arcana';

function RecipeRow({
  recipe,
  onClick,
}: {
  recipe: FusionRecipe;
  onClick?: (p: Persona) => void;
}) {
  const [p1, p2, ...rest] = recipe.ingredients;
  const totalLvl = recipe.ingredients.reduce((s, p) => s + p.lvl, 0);

  return (
    <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 hover:border-slate-500 transition-colors">
      {recipe.isSpecial && (
        <span className="text-yellow-500 text-xs font-bold shrink-0">★ Special</span>
      )}
      <div className="flex flex-wrap gap-2 flex-1 min-w-0">
        {recipe.ingredients.map((p, i) => (
          <button
            key={i}
            onClick={() => onClick?.(p)}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${ARCANA_COLORS[p.arcana] ?? 'bg-slate-600 text-white'}`}>
              {p.arcana.slice(0, 4)}
            </span>
            <span className="text-white text-sm">{p.name}</span>
            <span className="text-slate-400 text-xs">Lv{p.lvl}</span>
            {i < recipe.ingredients.length - 1 && (
              <span className="text-slate-500 text-sm ml-1">+</span>
            )}
          </button>
        ))}
      </div>
      <span className="text-slate-400 text-xs shrink-0">Σ{totalLvl}</span>
    </div>
  );
}

export function ReverseFusion({ personas, skillsDb }: Props) {
  const [target, setTarget] = useState<Persona | null>(null);
  const [sort, setSort] = useState<SortMode>('level');
  const [detail, setDetail] = useState<Persona | null>(null);
  const [arcanaFilter, setArcanaFilter] = useState<string>('');

  const recipes = useMemo<FusionRecipe[]>(() => {
    if (!target) return [];
    return reverseTwo(target);
  }, [target]);

  const arcanas = useMemo(() => {
    if (!recipes.length) return [];
    const set = new Set<string>();
    for (const r of recipes) r.ingredients.forEach(p => set.add(p.arcana));
    return Array.from(set).sort();
  }, [recipes]);

  const displayed = useMemo(() => {
    let list = recipes;
    if (arcanaFilter) {
      list = list.filter(r => r.ingredients.some(p => p.arcana === arcanaFilter));
    }
    if (sort === 'level') {
      list = [...list].sort((a, b) => {
        const sumA = a.ingredients.reduce((s, p) => s + p.lvl, 0);
        const sumB = b.ingredients.reduce((s, p) => s + p.lvl, 0);
        return sumA - sumB;
      });
    } else {
      list = [...list].sort((a, b) =>
        a.ingredients[0].arcana.localeCompare(b.ingredients[0].arcana)
      );
    }
    return list;
  }, [recipes, sort, arcanaFilter]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-slate-400 text-sm font-medium">Target Persona</label>
        <PersonaSearch
          personas={personas}
          value={target}
          onChange={p => { setTarget(p); setDetail(null); setArcanaFilter(''); }}
          placeholder="Search target persona…"
        />
      </div>

      {target && (
        <>
          <PersonaCard persona={target} skillsDb={skillsDb} highlight />

          {recipes.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">No fusion recipes found</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-300 text-sm font-medium">
                  {displayed.length} recipe{displayed.length !== 1 ? 's' : ''}
                  {arcanaFilter ? ` (filtered)` : ''}
                </span>
                <div className="flex gap-1 ml-auto">
                  <button
                    onClick={() => setSort('level')}
                    className={`text-xs px-2 py-1 rounded ${sort === 'level' ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    Sort: Level
                  </button>
                  <button
                    onClick={() => setSort('arcana')}
                    className={`text-xs px-2 py-1 rounded ${sort === 'arcana' ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    Sort: Arcana
                  </button>
                </div>
              </div>

              {arcanas.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setArcanaFilter('')}
                    className={`text-xs px-2 py-0.5 rounded ${!arcanaFilter ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                  >
                    All
                  </button>
                  {arcanas.map(a => (
                    <button
                      key={a}
                      onClick={() => setArcanaFilter(a === arcanaFilter ? '' : a)}
                      className={`text-xs px-2 py-0.5 rounded ${arcanaFilter === a ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {displayed.map((r, i) => (
                  <RecipeRow key={i} recipe={r} onClick={setDetail} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-400 text-sm">Click outside to close</span>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <PersonaCard persona={detail} skillsDb={skillsDb} />
          </div>
        </div>
      )}
    </div>
  );
}
