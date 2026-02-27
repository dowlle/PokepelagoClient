import React from 'react';
import { useGame } from '../context/GameContext';

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
    const { typeUnlocks, typeLocksEnabled } = useGame();

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
                                px-1 py-1 rounded-md border text-[9px] font-black uppercase tracking-tighter text-center transition-all duration-500
                                ${isUnlocked ? 'shadow-[0_0_8px_rgba(0,0,0,0.2)]' : 'opacity-40 grayscale'}
                            `}
                        >
                            {type}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
