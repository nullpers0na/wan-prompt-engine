'use client';

import { useState } from 'react';
import { personas } from '@/lib/data';
import { skills } from '@/lib/data';
import { ForwardFusion } from '@/components/ForwardFusion';
import { ReverseFusion } from '@/components/ReverseFusion';
import { Compendium } from '@/components/Compendium';

type Tab = 'compendium' | 'forward' | 'reverse';

export default function Home() {
  const [tab, setTab] = useState<Tab>('forward');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'compendium', label: 'Compendium' },
    { id: 'forward', label: 'Fuse Two' },
    { id: 'reverse', label: 'Find Recipes' },
  ];

  return (
    <div className="min-h-screen bg-[#0f1117]">
      {/* Header */}
      <header className="border-b border-slate-800 bg-[#0a0c14]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-yellow-400 font-bold text-xl tracking-wide">
              P4G Fusion Calculator
            </h1>
            <span className="text-slate-500 text-sm">Persona 4 Golden</span>
          </div>
          <p className="text-slate-500 text-xs mt-0.5">{personas.length} personas · data from aqiu384/megaten-fusion-tool</p>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-slate-800 bg-[#0a0c14]">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-yellow-500 text-yellow-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {tab === 'compendium' && (
          <Compendium personas={personas} skillsDb={skills} />
        )}
        {tab === 'forward' && (
          <ForwardFusion personas={personas} skillsDb={skills} />
        )}
        {tab === 'reverse' && (
          <ReverseFusion personas={personas} skillsDb={skills} />
        )}
      </main>
    </div>
  );
}
