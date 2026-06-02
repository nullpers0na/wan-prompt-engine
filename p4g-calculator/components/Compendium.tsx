'use client';

import { useState, useMemo } from 'react';
import type { Persona } from '@/lib/types';
import type { Skill } from '@/lib/types';
import { PersonaCard } from './PersonaCard';
import { ARCANA_COLORS } from './arcanaColors';

interface Props {
  personas: Persona[];
  skillsDb: Record<string, Skill>;
}

export function Compendium({ personas, skillsDb }: Props) {
  const [query, setQuery] = useState('');
  const [arcanaFilter, setArcanaFilter] = useState('');
  const [selected, setSelected] = useState<Persona | null>(null);

  const arcanas = useMemo(
    () => Array.from(new Set(personas.map(p => p.arcana))).sort(),
    [personas]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return personas
      .filter(p => !arcanaFilter || p.arcana === arcanaFilter)
      .filter(p =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.arcana.toLowerCase().includes(q)
      )
      .sort((a, b) => a.arcana.localeCompare(b.arcana) || a.lvl - b.lvl);
  }, [personas, query, arcanaFilter]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          className="flex-1 min-w-48 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500 text-sm"
          placeholder="Search by name or arcana…"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); }}
        />
      </div>

      {/* Arcana filter */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setArcanaFilter('')}
          className={`text-xs px-2 py-0.5 rounded ${!arcanaFilter ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
        >
          All ({personas.length})
        </button>
        {arcanas.map(a => {
          const count = personas.filter(p => p.arcana === a).length;
          return (
            <button
              key={a}
              onClick={() => setArcanaFilter(a === arcanaFilter ? '' : a)}
              className={`text-xs px-2 py-0.5 rounded ${arcanaFilter === a ? 'bg-yellow-600 text-white' : `${ARCANA_COLORS[a] ?? 'bg-slate-700 text-slate-400'} opacity-80 hover:opacity-100`}`}
            >
              {a} ({count})
            </button>
          );
        })}
      </div>

      <div className="text-slate-500 text-xs">{filtered.length} personas</div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-800">
              <th className="text-left px-3 py-2 text-slate-400 font-medium">Name</th>
              <th className="text-left px-3 py-2 text-slate-400 font-medium">Arcana</th>
              <th className="text-center px-3 py-2 text-slate-400 font-medium">Lv</th>
              <th className="text-left px-3 py-2 text-slate-400 font-medium hidden sm:table-cell">Innate Skills</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const innate = Object.entries(p.skills)
                .filter(([, v]) => v < 1)
                .sort(([, a], [, b]) => a - b)
                .map(([n]) => n);
              return (
                <tr
                  key={p.name}
                  className="border-b border-slate-800 hover:bg-slate-800/60 cursor-pointer transition-colors"
                  onClick={() => setSelected(selected?.name === p.name ? null : p)}
                >
                  <td className="px-3 py-2 text-white font-medium">{p.name}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${ARCANA_COLORS[p.arcana] ?? 'bg-slate-600 text-white'}`}>
                      {p.arcana}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-yellow-400 font-bold">{p.lvl}</td>
                  <td className="px-3 py-2 text-slate-300 text-xs hidden sm:table-cell">
                    {innate.slice(0, 3).join(', ')}
                    {innate.length > 3 && ` +${innate.length - 3}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <PersonaCard persona={selected} skillsDb={skillsDb} />
          </div>
        </div>
      )}
    </div>
  );
}
