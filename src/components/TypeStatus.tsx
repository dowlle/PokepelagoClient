import React, { useMemo } from 'react';
import { useGame } from '../context/GameContext';
import pokemonMetadata from '../data/pokemon_metadata.json';

const TYPE_COLORS: Record<string, string> = {
    Normal: '#A8A77A',
    Fire: '#EE8130',
    Water: '#6390F0',
    Electric: '#F7D02C',
    Grass: '#7AC74C',
    Ice: '#96D9D6',
    Fighting: '#C22E28',
    Poison: '#A33EA1',
    Ground: '#E2BF65',
    Flying: '#A98FF3',
    Psychic: '#F95587',
    Bug: '#A6B91A',
    Rock: '#B6A136',
    Ghost: '#735797',
    Dragon: '#6F35FC',
    Steel: '#B7B7CE',
    Dark: '#705746',
    Fairy: '#D685AD',
};

const TYPES_ORDER = [
    'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice',
    'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug',
    'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark'
];

export const TypeStatus: React.FC = () => {
    const { typeUnlocks, typeLocksEnabled, checkedIds, activeRegions } = useGame();

    const typeStats = useMemo(() => {
        const stats: Record<string, { guessed: number; total: number }> = {};
        TYPES_ORDER.forEach(t => (stats[t] = { guessed: 0, total: 0 }));

        const regionEntries = Object.values(activeRegions);
        const isActive = (id: number) =>
            regionEntries.length === 0
                ? id >= 1 && id <= 1025
                : regionEntries.some(([lo, hi]) => id >= lo && id <= hi);

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
    }, [checkedIds, activeRegions]);

    if (!typeLocksEnabled) return null;

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 space-y-2">
            <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest border-b border-gray-800 pb-1 mb-2">
                Type Proficiency
            </h4>
            <div className="grid grid-cols-3 gap-1.5">
                {TYPES_ORDER.map(type => {
                    const isUnlocked = typeUnlocks.has(type);
                    const color = TYPE_COLORS[type];

                    return (
                        <div
                            key={type}
                            style={{
                                backgroundColor: isUnlocked ? `${color}33` : '#1f293744',
                                borderColor: isUnlocked ? `${color}66` : '#37415144',
                                color: isUnlocked ? color : '#4b5563'
                            }}
                            className={`
                                px-1 py-1 rounded-md border text-[9px] font-black uppercase tracking-tighter text-center transition-all duration-500 flex flex-col items-center
                                ${isUnlocked ? 'shadow-[0_0_8px_rgba(0,0,0,0.2)]' : 'opacity-40 grayscale'}
                            `}
                        >
                            <span>{type}</span>
                            <span className="text-[8px] opacity-70 font-normal normal-case tracking-normal">
                                ({typeStats[type]?.guessed ?? 0}/{typeStats[type]?.total ?? 0})
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
