import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useGame } from '../context/GameContext';
import pokemonMetadata from '../data/pokemon_metadata.json';
import { TYPE_COLORS } from '../utils/typeColors';
import { GENERATIONS } from '../types/pokemon';

const TYPES_ORDER = [
    'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice',
    'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
    'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark'
];

export const TypeStatus: React.FC = () => {
    const { typeUnlocks, typeLocksEnabled, checkedIds, activeRegions, generationFilter, isConnected, typeFilter, setTypeFilter } = useGame();

    const typeStats = useMemo(() => {
        const stats: Record<string, { guessed: number; total: number }> = {};
        TYPES_ORDER.forEach(t => (stats[t] = { guessed: 0, total: 0 }));

        const regionEntries = Object.values(activeRegions);
        const isActive = (id: number) => {
            // AP connected: use activeRegions from slot_data
            if (isConnected && regionEntries.length > 0) {
                return regionEntries.some(([lo, hi]) => id >= lo && id <= hi);
            }
            // Standalone or AP-offline: use generationFilter
            const genIdx = GENERATIONS.findIndex(g => id >= g.startId && id <= g.endId);
            return genIdx !== -1 && generationFilter.includes(genIdx);
        };

        for (let id = 1; id <= 1025; id++) {
            if (!isActive(id)) continue;
            const data = (pokemonMetadata as any)[id];
            if (!data) continue;
            data.types.forEach((t: string) => {
                const typeName = t.charAt(0).toUpperCase() + t.slice(1);
                if (stats[typeName]) {
                    stats[typeName].total++;
                    if (checkedIds.has(id)) stats[typeName].guessed++;
                }
            });
        }
        return stats;
    }, [checkedIds, activeRegions, generationFilter, isConnected]);

    const [isOpen, setIsOpen] = useState(true);

    if (!typeLocksEnabled) return null;

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 space-y-2">
            <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setIsOpen(o => !o)}
            >
                <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                    Type Proficiency
                </h4>
                <ChevronDown
                    size={12}
                    className={`text-gray-500 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                />
            </div>
            {isOpen && <div className="border-t border-gray-800 pt-2"><div className="grid grid-cols-3 gap-1.5">
                {TYPES_ORDER.map(type => {
                    const isUnlocked = typeUnlocks.has(type);
                    const color = TYPE_COLORS[type];

                    return (
                        <button
                            key={type}
                            onClick={(e) => {
                                if (e.ctrlKey || e.metaKey) {
                                    // Multi-select: toggle this type in/out of the selection
                                    setTypeFilter(prev =>
                                        prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                                    );
                                } else {
                                    // Single-select: select only this type, or clear if already sole selection
                                    setTypeFilter(prev =>
                                        prev.length === 1 && prev[0] === type ? [] : [type]
                                    );
                                }
                            }}
                            style={{
                                backgroundColor: isUnlocked ? `${color}33` : '#1f293744',
                                borderColor: typeFilter.includes(type) ? color : (isUnlocked ? `${color}66` : '#37415144'),
                                color: isUnlocked ? color : '#4b5563',
                                boxShadow: typeFilter.includes(type) ? `0 0 8px ${color}88` : undefined,
                            }}
                            className={`
                                px-1 py-1 rounded-md border text-[9px] font-black uppercase tracking-tighter text-center transition-all duration-200 flex flex-col items-center cursor-pointer
                                ${isUnlocked ? '' : 'opacity-40 grayscale'}
                                ${typeFilter.includes(type) ? 'scale-105' : 'hover:scale-105'}
                            `}
                        >
                            <span>{type}</span>
                            <span className="text-[8px] opacity-70 font-normal normal-case tracking-normal">
                                ({typeStats[type]?.guessed ?? 0}/{typeStats[type]?.total ?? 0})
                            </span>
                        </button>
                    );
                })}
            </div></div>}
        </div>
    );
};
