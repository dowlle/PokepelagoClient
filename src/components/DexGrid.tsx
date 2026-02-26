import React from 'react';
import type { PokemonRef } from '../types/pokemon';
import { GENERATIONS } from '../types/pokemon';
import { useGame } from '../context/GameContext';
import { PokemonSlot } from './PokemonSlot';
import { Lock } from 'lucide-react';

export const DexGrid: React.FC = () => {
    const { allPokemon, unlockedIds, checkedIds, hintedIds, shinyIds, generationFilter, uiSettings, gameMode, isPokemonGuessable } = useGame();

    // Build a map for quick lookups
    const pokemonById = React.useMemo(() => {
        const map = new Map<number, PokemonRef>();
        allPokemon.forEach(p => map.set(p.id, p));
        return map;
    }, [allPokemon]);

    const getStatus = (id: number): 'locked' | 'unlocked' | 'checked' | 'shadow' | 'hint' => {
        if (checkedIds.has(id)) return 'checked';

        if (gameMode === 'standalone') {
            return uiSettings.enableShadows ? 'shadow' : 'locked';
        }

        const { canGuess } = isPokemonGuessable(id);
        const isRevealed = unlockedIds.has(id);

        if (canGuess) {
            return 'shadow';
        } else if (isRevealed) {
            return 'unlocked';
        }

        if (hintedIds.has(id)) return 'hint';
        return 'locked';
    };

    const activeCount = generationFilter.length;

    const containerClass = uiSettings.masonry
        ? `columns-1 ${activeCount > 1 ? 'sm:columns-2' : ''} ${activeCount > 2 ? 'lg:columns-3' : ''} ${activeCount > 3 ? 'xl:columns-4' : ''} ${activeCount > 4 ? '2xl:columns-5' : ''} gap-4 px-4 pb-32 space-y-4`
        : `grid grid-cols-1 ${activeCount > 1 ? 'sm:grid-cols-2' : ''} ${activeCount > 2 ? 'lg:grid-cols-3' : ''} ${activeCount > 3 ? 'xl:grid-cols-4' : ''} ${activeCount > 4 ? '2xl:grid-cols-5' : ''} gap-4 px-4 pb-32`;

    return (
        <div className={containerClass}>
            {GENERATIONS.map((gen, genIdx) => {
                if (!generationFilter.includes(genIdx)) return null;

                // Build list of pokemon IDs in this generation
                const pokemonInGen: PokemonRef[] = [];
                for (let id = gen.startId; id <= gen.endId; id++) {
                    const p = pokemonById.get(id);
                    if (p) pokemonInGen.push(p);
                }

                const checkedCount = pokemonInGen.filter(p => checkedIds.has(p.id)).length;
                const isLocked = false;

                return (
                    <div
                        key={gen.label}
                        className={`
                            bg-gray-900/70 border border-gray-700/50 rounded-xl p-4 backdrop-blur-sm shadow-2xl flex flex-col h-fit
                            ${uiSettings.masonry ? 'break-inside-avoid mb-4' : ''}
                            w-full
                            ${isLocked ? 'opacity-80 shadow-none' : ''}
                        `}
                    >
                        <div className="flex justify-between items-baseline mb-3">
                            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                {gen.region}
                                {isLocked && <Lock size={12} className="text-gray-600" />}
                            </h3>
                            <span className="text-xs font-mono text-gray-600">
                                {checkedCount} / {pokemonInGen.length}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-start">
                            {pokemonInGen.map(p => (
                                <PokemonSlot
                                    key={p.id}
                                    pokemon={p}
                                    status={getStatus(p.id) as any}
                                    isShiny={shinyIds.has(p.id)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
