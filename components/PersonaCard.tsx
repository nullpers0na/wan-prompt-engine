'use client';

import type { Persona } from '@/lib/types';
import type { Skill } from '@/lib/types';
import { ARCANA_COLORS, ELEM_LABELS, ELEM_COLORS } from './arcanaColors';

const RESIST_CHARS: Record<string, { label: string; color: string }> = {
  '-': { label: 'norm', color: 'text-slate-400' },
  'w': { label: 'weak', color: 'text-red-400' },
  'n': { label: 'null', color: 'text-sky-400' },
  'r': { label: 'refl', color: 'text-purple-400' },
  'd': { label: 'absr', color: 'text-emerald-400' },
  'S': { label: 'strg', color: 'text-green-400' },
};

const ELEMS_ORDER = ['phy', 'fir', 'ice', 'ele', 'win', 'lig', 'dar', 'alm'];

interface Props {
  persona: Persona;
  skillsDb: Record<string, Skill>;
  highlight?: boolean;
}

export function PersonaCard({ persona, skillsDb, highlight = false }: Props) {
  const resistArr = persona.resists.split('');

  const innateSkills = Object.entries(persona.skills)
    .filter(([, v]) => v < 1)
    .sort(([, a], [, b]) => a - b)
    .map(([name]) => name);

  const learnedSkills = Object.entries(persona.skills)
    .filter(([, v]) => v >= 1)
    .sort(([, a], [, b]) => a - b);

  return (
    <div className={`rounded-xl border ${highlight ? 'border-yellow-500 bg-slate-800' : 'border-slate-700 bg-slate-900'} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-white font-bold text-lg">{persona.name}</h3>
          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded mt-1 ${ARCANA_COLORS[persona.arcana] ?? 'bg-slate-600 text-white'}`}>
            {persona.arcana}
          </span>
        </div>
        <div className="text-right">
          <div className="text-yellow-400 font-bold text-xl">Lv {persona.lvl}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-1 text-center">
        {['St', 'Ma', 'En', 'Ag', 'Lu'].map((stat, i) => (
          <div key={stat} className="bg-slate-800 rounded p-1">
            <div className="text-slate-400 text-xs">{stat}</div>
            <div className="text-white font-medium text-sm">{persona.stats[i]}</div>
          </div>
        ))}
      </div>

      {/* Resistances */}
      <div>
        <div className="text-slate-400 text-xs mb-1">Resistances</div>
        <div className="grid grid-cols-8 gap-0.5 text-center">
          {ELEMS_ORDER.map((elem, i) => {
            const resistChar = resistArr[i] ?? '-';
            const r = RESIST_CHARS[resistChar] ?? RESIST_CHARS['-'];
            return (
              <div key={elem} className="bg-slate-800 rounded p-0.5">
                <div className="text-slate-500 text-xs leading-none">{ELEM_LABELS[elem]?.slice(0, 3)}</div>
                <div className={`text-xs font-bold ${r.color}`}>{r.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skills */}
      <div>
        <div className="text-slate-400 text-xs mb-1">Skills</div>
        <div className="space-y-0.5">
          {innateSkills.map(name => {
            const skill = skillsDb[name];
            const elemKey = skill?.element ?? '';
            return (
              <div key={name} className="flex items-center gap-1.5 text-xs">
                <span className={`px-1.5 py-0.5 rounded text-white text-xs ${ELEM_COLORS[elemKey] ?? 'bg-slate-700'}`}>
                  {ELEM_LABELS[elemKey] ?? elemKey}
                </span>
                <span className="text-white">{name}</span>
                <span className="text-slate-500 ml-auto">innate</span>
              </div>
            );
          })}
          {learnedSkills.map(([name, lvl]) => {
            const skill = skillsDb[name];
            const elemKey = skill?.element ?? '';
            return (
              <div key={name} className="flex items-center gap-1.5 text-xs">
                <span className={`px-1.5 py-0.5 rounded text-white text-xs ${ELEM_COLORS[elemKey] ?? 'bg-slate-700'}`}>
                  {ELEM_LABELS[elemKey] ?? elemKey}
                </span>
                <span className="text-white">{name}</span>
                <span className="text-yellow-500 ml-auto">Lv {lvl}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
