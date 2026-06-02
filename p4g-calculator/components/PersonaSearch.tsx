'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { Persona } from '@/lib/types';
import { ARCANA_COLORS } from './arcanaColors';

interface Props {
  personas: Persona[];
  value: Persona | null;
  onChange: (p: Persona | null) => void;
  placeholder?: string;
  exclude?: string[];
}

export function PersonaSearch({ personas, value, onChange, placeholder = 'Search persona…', exclude = [] }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return personas
      .filter(p => !exclude.includes(p.name))
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.arcana.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [personas, query, exclude]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(p: Persona) {
    onChange(p);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      {value ? (
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${ARCANA_COLORS[value.arcana] ?? 'bg-slate-600 text-white'}`}>
            {value.arcana}
          </span>
          <span className="text-white font-medium flex-1">{value.name}</span>
          <span className="text-slate-400 text-sm">Lv {value.lvl}</span>
          <button
            onClick={() => onChange(null)}
            className="text-slate-400 hover:text-white ml-1 text-lg leading-none"
          >×</button>
        </div>
      ) : (
        <input
          type="text"
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      )}

      {open && !value && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-slate-400 px-3 py-2 text-sm">No results</p>
          ) : filtered.map(p => (
            <button
              key={p.name}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-left"
              onMouseDown={() => select(p)}
            >
              <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${ARCANA_COLORS[p.arcana] ?? 'bg-slate-600 text-white'}`}>
                {p.arcana}
              </span>
              <span className="text-white text-sm flex-1">{p.name}</span>
              <span className="text-slate-400 text-xs">Lv {p.lvl}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
