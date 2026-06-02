'use client';

import { useState } from 'react';
import type { Persona } from '@/lib/types';
import type { Skill } from '@/lib/types';
import { fuseTwo, fuseThree } from '@/lib/fusion';
import { PersonaSearch } from './PersonaSearch';
import { PersonaCard } from './PersonaCard';
import { twoIngredientSpecials, specialRecipes } from '@/lib/data';

interface Props {
  personas: Persona[];
  skillsDb: Record<string, Skill>;
}

export function ForwardFusion({ personas, skillsDb }: Props) {
  const [p1, setP1] = useState<Persona | null>(null);
  const [p2, setP2] = useState<Persona | null>(null);
  const [p3, setP3] = useState<Persona | null>(null);
  const [tripleMode, setTripleMode] = useState(false);

  const result = tripleMode
    ? (p1 && p2 && p3 ? fuseThree(p1, p2, p3) : null)
    : (p1 && p2 ? fuseTwo(p1, p2) : null);

  const isSpecial = !tripleMode && p1 && p2
    ? !!twoIngredientSpecials[[p1.name, p2.name].sort().join('|')]
    : false;

  const isMultiSpecial = !tripleMode && result &&
    specialRecipes[result.name]?.length > 2;

  const selectedNames = [p1?.name, p2?.name, p3?.name].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setTripleMode(false); setP3(null); }}
          className={`px-3 py-1.5 text-sm rounded ${!tripleMode ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          2-Persona Fusion
        </button>
        <button
          onClick={() => setTripleMode(true)}
          className={`px-3 py-1.5 text-sm rounded ${tripleMode ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          3-Persona (Triangle)
        </button>
      </div>

      {/* Ingredient selectors */}
      <div className={`grid gap-4 ${tripleMode ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        <div className="space-y-2">
          <label className="text-slate-400 text-sm font-medium">First Persona</label>
          <PersonaSearch
            personas={personas}
            value={p1}
            onChange={setP1}
            placeholder="Search first persona…"
            exclude={selectedNames.filter(n => n !== p1?.name)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-slate-400 text-sm font-medium">Second Persona</label>
          <PersonaSearch
            personas={personas}
            value={p2}
            onChange={setP2}
            placeholder="Search second persona…"
            exclude={selectedNames.filter(n => n !== p2?.name)}
          />
        </div>
        {tripleMode && (
          <div className="space-y-2">
            <label className="text-slate-400 text-sm font-medium">Third Persona</label>
            <PersonaSearch
              personas={personas}
              value={p3}
              onChange={setP3}
              placeholder="Search third persona…"
              exclude={selectedNames.filter(n => n !== p3?.name)}
            />
          </div>
        )}
      </div>

      {/* Fusion result */}
      {(tripleMode ? p1 && p2 && p3 : p1 && p2) && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-700" />
            <span className="text-yellow-500 text-sm font-medium">Fusion Result</span>
            <div className="h-px flex-1 bg-slate-700" />
          </div>

          {result ? (
            <div className="space-y-3">
              {isSpecial && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-yellow-400 text-sm">
                  ★ Special recipe fusion
                </div>
              )}
              <PersonaCard persona={result} skillsDb={skillsDb} highlight />
            </div>
          ) : (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center text-red-400">
              No valid fusion — these personas cannot be fused together
            </div>
          )}
        </div>
      )}

      {/* Input persona details */}
      {(p1 || p2 || p3) && (
        <div className={`grid gap-4 ${tripleMode ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
          {p1 && <PersonaCard persona={p1} skillsDb={skillsDb} />}
          {p2 && <PersonaCard persona={p2} skillsDb={skillsDb} />}
          {p3 && tripleMode && <PersonaCard persona={p3} skillsDb={skillsDb} />}
        </div>
      )}
    </div>
  );
}
