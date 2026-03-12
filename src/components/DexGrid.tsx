import React, { useState, useEffect, useCallback } from 'react';
import type { PokemonRef } from '../types/pokemon';
import { GENERATIONS } from '../types/pokemon';
import { useGame } from '../context/GameContext';
import { PokemonSlot } from './PokemonSlot';
import { Lock, GripVertical, ChevronDown } from 'lucide-react';
import pokemonMetadata from '../data/pokemon_metadata.json';
import { SUB_LEGENDARY_IDS, BOX_LEGENDARY_IDS, MYTHIC_IDS, BABY_IDS, TRADE_EVO_IDS, FOSSIL_IDS, ULTRA_BEAST_IDS, PARADOX_IDS, STONE_EVO_IDS } from '../data/pokemon_gates';

const REGION_LAYOUT_KEY = 'pokepelago_region_layout';

export const DexGrid: React.FC = () => {
    const { allPokemon, unlockedIds, checkedIds, hintedIds, shinyIds, generationFilter, uiSettings, gameMode, isPokemonGuessable, shuffleEndTime, releasedIds, activeRegions, regionPasses, regionLocksEnabled, startingRegion, typeFilter, dexFilter, setDexFilter, categoryFilter } = useGame();

    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (shuffleEndTime > now) {
            const interval = setInterval(() => setNow(Date.now()), 1000);
            return () => clearInterval(interval);
        }
    }, [shuffleEndTime, now]);

    const isShuffled = shuffleEndTime > now;

    // Region layout: order + open/closed — persisted to localStorage
    const [regionOrder, setRegionOrder] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(REGION_LAYOUT_KEY);
            if (saved) return JSON.parse(saved).order ?? GENERATIONS.map(g => g.label);
        } catch {}
        return GENERATIONS.map(g => g.label);
    });

    const [regionOpen, setRegionOpen] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem(REGION_LAYOUT_KEY);
            if (saved) return JSON.parse(saved).open ?? {};
        } catch {}
        return {};
    });

    useEffect(() => {
        localStorage.setItem(REGION_LAYOUT_KEY, JSON.stringify({ order: regionOrder, open: regionOpen }));
    }, [regionOrder, regionOpen]);

    const toggleRegion = useCallback((label: string) => {
        setRegionOpen(prev => ({ ...prev, [label]: prev[label] === false }));
    }, []);

    // Drag and drop
    const [draggedLabel, setDraggedLabel] = useState<string | null>(null);
    const [dragOverLabel, setDragOverLabel] = useState<string | null>(null);

    const handleDragStart = useCallback((label: string) => setDraggedLabel(label), []);
    const handleDragEnd = useCallback(() => { setDraggedLabel(null); setDragOverLabel(null); }, []);

    const handleDragOver = useCallback((e: React.DragEvent, label: string) => {
        e.preventDefault();
        setDragOverLabel(label);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        // Only clear if leaving the card entirely (not entering a child)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOverLabel(null);
        }
    }, []);

    const handleDrop = useCallback((targetLabel: string) => {
        if (!draggedLabel || draggedLabel === targetLabel) {
            setDragOverLabel(null);
            return;
        }
        const dragged = draggedLabel;
        setRegionOrder(order => {
            const arr = GENERATIONS.map(g => g.label).map(l => order.includes(l) ? order.indexOf(l) : Infinity)
                .map((pos, i) => ({ label: GENERATIONS[i].label, pos }))
                .sort((a, b) => a.pos - b.pos)
                .map(x => x.label);
            const fromIdx = arr.indexOf(dragged);
            const toIdx = arr.indexOf(targetLabel);
            if (fromIdx === -1 || toIdx === -1) return order;
            arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, dragged);
            return arr;
        });
        setDraggedLabel(null);
        setDragOverLabel(null);
    }, [draggedLabel]);

    // Build a map for quick lookups
    const pokemonById = React.useMemo(() => {
        const map = new Map<number, PokemonRef>();
        allPokemon.forEach(p => map.set(p.id, p));
        return map;
    }, [allPokemon]);

    const getStatus = (id: number): 'locked' | 'unlocked' | 'checked' | 'shadow' | 'hint' => {
        if (releasedIds.has(id)) return 'shadow';
        if (checkedIds.has(id)) return 'checked';

        if (gameMode === 'standalone') {
            return uiSettings.enableShadows ? 'shadow' : 'locked';
        }

        const { canGuess } = isPokemonGuessable(id);
        const isRevealed = unlockedIds.has(id);

        if (canGuess) {
            return uiSettings.enableShadows ? 'shadow' : 'locked';
        } else if (isRevealed) {
            return 'unlocked';
        }

        if (hintedIds.has(id)) return 'hint';
        return 'locked';
    };

    // Ordered + filtered generations
    const orderedGenerations = React.useMemo(() => {
        return GENERATIONS
            .map((gen, idx) => ({ gen, idx }))
            .filter(({ idx }) => generationFilter.includes(idx))
            .sort((a, b) => {
                const ia = regionOrder.indexOf(a.gen.label);
                const ib = regionOrder.indexOf(b.gen.label);
                if (ia === -1 && ib === -1) return 0;
                if (ia === -1) return 1;
                if (ib === -1) return -1;
                return ia - ib;
            });
    }, [generationFilter, regionOrder]);

    const activeCount = generationFilter.length;

    const containerClass = uiSettings.masonry
        ? `columns-1 ${activeCount > 1 ? 'sm:columns-2' : ''} ${activeCount > 2 ? 'lg:columns-3' : ''} ${activeCount > 3 ? 'xl:columns-4' : ''} ${activeCount > 4 ? '2xl:columns-5' : ''} gap-3 sm:gap-4 px-1 sm:px-4 pb-32 space-y-3 sm:space-y-4`
        : `grid grid-cols-1 ${activeCount > 1 ? 'sm:grid-cols-2' : ''} ${activeCount > 2 ? 'lg:grid-cols-3' : ''} ${activeCount > 3 ? 'xl:grid-cols-4' : ''} ${activeCount > 4 ? '2xl:grid-cols-5' : ''} gap-3 sm:gap-4 px-1 sm:px-4 pb-32 items-start`;

    const toggleDexFilter = (key: 'guessable' | 'guessed') => {
        setDexFilter(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const guessableCount = allPokemon.filter(p => !checkedIds.has(p.id) && isPokemonGuessable(p.id).canGuess).length;
    const guessedCount = allPokemon.filter(p => checkedIds.has(p.id) && !releasedIds.has(p.id)).length;

    return (
        <div className="flex flex-col">
            {/* Dex filter bar */}
            <div className="flex items-center gap-2 px-2 pt-1 pb-2 sm:px-4 sm:pb-3">
                <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest">Show:</span>
                <button
                    onClick={() => toggleDexFilter('guessable')}
                    className={`px-2 py-1 text-[10px] uppercase font-black tracking-widest rounded-lg border transition-all ${
                        dexFilter.has('guessable')
                            ? 'border-green-500/60 text-green-300 bg-green-900/30'
                            : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-400'
                    }`}
                >
                    Guessable <span className="text-orange-400">{guessableCount}</span>
                </button>
                <button
                    onClick={() => toggleDexFilter('guessed')}
                    className={`px-2 py-1 text-[10px] uppercase font-black tracking-widest rounded-lg border transition-all ${
                        dexFilter.has('guessed')
                            ? 'border-amber-500/60 text-amber-300 bg-amber-900/30'
                            : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-400'
                    }`}
                >
                    Guessed <span className="text-green-400">{guessedCount}</span>
                </button>
                {dexFilter.size > 0 && (
                    <button
                        onClick={() => setDexFilter(new Set())}
                        className="px-2 py-1 text-[10px] uppercase font-black tracking-widest rounded-lg border border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-500 transition-all"
                    >
                        Clear
                    </button>
                )}
            </div>
            <div className={containerClass}>
            {orderedGenerations.map(({ gen }) => {
                // Full list for header stats (unaffected by type filter)
                const fullInGen: PokemonRef[] = [];
                for (let id = gen.startId; id <= gen.endId; id++) {
                    const p = pokemonById.get(id);
                    if (p) fullInGen.push(p);
                }
                const checkedCount = fullInGen.filter(p => checkedIds.has(p.id)).length;

                // Type-filtered list for body rendering
                let pokemonInGen = typeFilter.length > 0
                    ? fullInGen.filter(p => {
                        const types: string[] = (pokemonMetadata as any)[p.id]?.types ?? [];
                        return types.some(t => typeFilter.includes(t.charAt(0).toUpperCase() + t.slice(1)));
                    })
                    : fullInGen;

                // Dex filter (guessable / guessed)
                if (dexFilter.size > 0) {
                    pokemonInGen = pokemonInGen.filter(p => {
                        const isGuessed = checkedIds.has(p.id);
                        const canGuess = isPokemonGuessable(p.id).canGuess && !isGuessed;
                        if (dexFilter.has('guessable') && dexFilter.has('guessed')) return canGuess || isGuessed;
                        if (dexFilter.has('guessable')) return canGuess;
                        if (dexFilter.has('guessed')) return isGuessed;
                        return true;
                    });
                }

                // Category filter (from GateTracker clicks)
                if (categoryFilter) {
                    pokemonInGen = pokemonInGen.filter(p => {
                        switch (categoryFilter) {
                            case 'sub-legendary': return SUB_LEGENDARY_IDS.has(p.id);
                            case 'box-legendary': return BOX_LEGENDARY_IDS.has(p.id);
                            case 'mythic': return MYTHIC_IDS.has(p.id);
                            case 'baby': return BABY_IDS.has(p.id);
                            case 'trade-evo': return TRADE_EVO_IDS.has(p.id);
                            case 'fossil': return FOSSIL_IDS.has(p.id);
                            case 'ultra-beast': return ULTRA_BEAST_IDS.has(p.id);
                            case 'paradox': return PARADOX_IDS.has(p.id);
                            default: {
                                // Region filter: "region-Kanto" etc.
                                if (categoryFilter.startsWith('region-')) {
                                    const region = categoryFilter.slice(7);
                                    return gen.region === region;
                                }
                                // Stone filter: "stone-fire" etc.
                                if (categoryFilter.startsWith('stone-')) {
                                    const stone = categoryFilter.slice(6);
                                    return STONE_EVO_IDS[stone]?.has(p.id) ?? false;
                                }
                                return true;
                            }
                        }
                    });
                }

                if ((typeFilter.length > 0 || dexFilter.size > 0 || categoryFilter) && pokemonInGen.length === 0) return null;

                const shuffleOrder = new Map<number, number>();
                if (isShuffled) {
                    const seed = shuffleEndTime % 1000000;
                    const shuffleArr = [...pokemonInGen];
                    for (let i = shuffleArr.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.abs(Math.sin(seed + i) * 10000)) % (i + 1);
                        [shuffleArr[i], shuffleArr[j]] = [shuffleArr[j], shuffleArr[i]];
                    }
                    shuffleArr.forEach((p, idx) => shuffleOrder.set(p.id, idx));
                }

                const isLocked = regionLocksEnabled &&
                    Object.keys(activeRegions).length > 0 &&
                    gen.region in activeRegions &&
                    gen.region !== startingRegion &&
                    !regionPasses.has(gen.region);

                const isRegionOpen = regionOpen[gen.label] !== false;
                const isDragTarget = dragOverLabel === gen.label && draggedLabel !== gen.label;

                return (
                    <div
                        key={gen.label}
                        onDragOver={(e) => handleDragOver(e, gen.label)}
                        onDragLeave={handleDragLeave}
                        onDrop={() => handleDrop(gen.label)}
                        className={`
                            bg-gray-900/70 border rounded-xl backdrop-blur-sm shadow-2xl flex flex-col h-fit
                            ${uiSettings.masonry ? 'break-inside-avoid mb-4' : ''}
                            w-full transition-all duration-150
                            ${isLocked ? 'opacity-80 shadow-none' : ''}
                            ${isDragTarget ? 'border-blue-500/60 shadow-[0_0_14px_rgba(59,130,246,0.3)]' : 'border-gray-700/50'}
                            ${draggedLabel === gen.label ? 'opacity-40' : ''}
                        `}
                    >
                        {/* Header: drag handle + toggle */}
                        <div
                            className="flex items-center gap-2 p-3 sm:p-4 cursor-pointer select-none"
                            onClick={() => toggleRegion(gen.label)}
                        >
                            <div
                                draggable
                                onDragStart={(e) => { e.stopPropagation(); handleDragStart(gen.label); }}
                                onDragEnd={handleDragEnd}
                                onClick={(e) => e.stopPropagation()}
                                className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                            >
                                <GripVertical size={14} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                    {gen.region}
                                    {isLocked && <Lock size={12} className="text-gray-600" />}
                                    {isShuffled && (
                                        <span className="text-red-500 animate-pulse text-xs lowercase">
                                            shuffled! ({Math.ceil((shuffleEndTime - now) / 1000)}s)
                                        </span>
                                    )}
                                </h3>
                                {isLocked && (
                                    <span className="text-[10px] text-gray-600 font-normal normal-case tracking-normal">
                                        Need {gen.region} Pass
                                    </span>
                                )}
                            </div>

                            <span className="text-xs font-mono text-gray-600 shrink-0">
                                {checkedCount} / {fullInGen.length}
                            </span>

                            <ChevronDown
                                size={14}
                                className={`text-gray-600 shrink-0 transition-transform duration-200 ${isRegionOpen ? '' : '-rotate-90'}`}
                            />
                        </div>

                        {/* Body — always mounted so sprites stay loaded; hidden via CSS only */}
                        <div className={`px-2 pb-3 sm:px-4 sm:pb-4 ${isRegionOpen ? '' : 'hidden'}`}>
                            <div className="flex flex-wrap gap-1 sm:gap-1.5 justify-start">
                                {pokemonInGen.map(p => (
                                    <PokemonSlot
                                        key={p.id}
                                        pokemon={p}
                                        status={getStatus(p.id) as any}
                                        isShiny={shinyIds.has(p.id)}
                                        order={shuffleOrder.get(p.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
    );
};
