import React, { useState, useEffect, useCallback } from 'react';
import type { PokemonRef } from '../types/pokemon';
import { GENERATIONS } from '../types/pokemon';
import { useGame } from '../context/GameContext';
import { PokemonSlot } from './PokemonSlot';
import { Lock, GripVertical, ChevronDown } from 'lucide-react';
import pokemonMetadata from '../data/pokemon_metadata.json';
import { SUB_LEGENDARY_IDS, BOX_LEGENDARY_IDS, MYTHIC_IDS, BABY_IDS, TRADE_EVO_IDS, FOSSIL_IDS, ULTRA_BEAST_IDS, PARADOX_IDS, STONE_EVO_IDS } from '../data/pokemon_gates';
import { isPerfMode, markDexGridMount, setExpectedSlots } from '../utils/perfHarness';
import { useSlotLayout, useInViewport } from '../hooks/useSlotLayout';

const REGION_LAYOUT_KEY = 'pokepelago_region_layout';

// PERF-12: JS-driven absolute slot positioning inside region bodies. Region
// body slots render as `position: absolute; transform: translate(x, y)`
// instead of CSS Grid auto-fill, skipping browser layout for ~150 children
// per card. Region cards' outer layout (drag-drop, masonry, the cards-per-row
// grid) stays in CSS — that's a cheap pass over ~5 elements. The legacy CSS-
// grid path is preserved behind ?legacyDexGrid=1 as an escape hatch in case
// the JS path regresses for someone in the wild; once 2-4 weeks of beta usage
// confirm no issues, the legacy path can be deleted.
//
// Trace iteration log (2026-05-06): four traces against a representative
// region/sidebar toggle session brought worst-case Layout from 489 ms (initial
// JS layout, willChange:transform on slots) → 1266 ms (regression with
// contain:strict on the wrapper — size-containment was breaking on dynamic
// totalHeight) → 716 ms (revert to contain:layout, drop willChange, add
// contain:layout paint per slot) → 383 ms (add IntersectionObserver per
// region, only render visible-region slots). Avg Layout 158 → 112 ms; 51% of
// Layouts now under 16 ms (single-frame). See
// [[2026-05-06 — Plan — JS-Driven DexGrid Slot Positioning]] for original
// design + the matching shipped plan note for what actually shipped.
function isLegacyDexGridMode(): boolean {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('legacyDexGrid') === '1';
}

// Per-region slot grid. Two layout paths:
//   - legacy: CSS Grid `auto-fill, ${slotPx}px`. The browser places each slot
//     in the next available cell. Cost scales with slot count (~150 per card)
//     and dominates per-Layout time during region/sidebar toggle.
//   - JS-driven (?jsDexGrid=1): `position: relative; height: totalHeight`
//     positioning parent; each slot is `position: absolute; transform: translate`.
//     Slot positions come from useSlotLayout, which measures via ResizeObserver
//     and recomputes O(N) on input change. Browser does no layout for slots —
//     just paints them at known transforms. Hot-path win is the region toggle:
//     show/hide a `display: none` parent costs ~zero layout instead of re-running
//     auto-placement on 150 children.
const RegionSlots: React.FC<{
    pokemonInGen: PokemonRef[];
    shuffleOrder: Map<number, number>;
    slotPx: number;
    statusFor: (id: number) => 'locked' | 'unlocked' | 'checked' | 'shadow' | 'hint';
    canGuessFor: (id: number) => { canGuess: boolean; reason?: string };
    shinyIds: Set<number>;
    releasedIds: Set<number>;
    usedPokegears: Set<number>;
    derpyfiedIds: Set<number>;
    jsLayout: boolean;
}> = ({ pokemonInGen, shuffleOrder, slotPx, statusFor, canGuessFor, shinyIds, releasedIds, usedPokegears, derpyfiedIds, jsLayout }) => {
    // Gap mirrors the legacy `gap-1 sm:gap-1.5` (4px / 6px at Tailwind's sm
    // breakpoint = 640px). matchMedia listener keeps the JS layout in sync
    // when the user resizes across the breakpoint; a static fallback value
    // lets SSR / non-window environments pick the desktop default.
    const [gap, setGap] = React.useState(() => {
        if (typeof window === 'undefined') return 6;
        return window.matchMedia('(min-width: 640px)').matches ? 6 : 4;
    });
    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(min-width: 640px)');
        const onChange = () => setGap(mq.matches ? 6 : 4);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    // Pre-shuffle the order if shuffle is active. The CSS-grid path uses the
    // `order` prop on each slot (also passed below); the JS-layout path needs
    // a real reordering of the input array because positions are computed by
    // index. Sorting by shuffleOrder gives the same visual result without
    // relying on CSS `order`.
    const orderedPokemon = React.useMemo(() => {
        if (shuffleOrder.size === 0) return pokemonInGen;
        return [...pokemonInGen].sort(
            (a, b) => (shuffleOrder.get(a.id) ?? 0) - (shuffleOrder.get(b.id) ?? 0),
        );
    }, [pokemonInGen, shuffleOrder]);

    const { ref, layout } = useSlotLayout(jsLayout ? orderedPokemon.length : 0, slotPx, gap);

    // Per-region viewport gate (PERF-12 v2). Only render slot DOM nodes when
    // the region is in viewport (with 600px overscan via useInViewport's
    // default rootMargin). For an off-screen region, the wrapper still
    // reserves its full height so scrolling stays correct, but no slots are
    // mounted — Chrome's Layout pass therefore doesn't have to walk them.
    // Sprite cache is refcounted (services/spriteUrlCache.ts) so unmounted
    // slots' blob URLs survive remount with no opacity-0 reload flicker.
    // Only applied in jsLayout mode; legacy CSS-grid path keeps every slot
    // mounted for backwards-compat with the in-flight beta perf sweep.
    const { ref: viewportRef, inViewport } = useInViewport<HTMLDivElement>();

    const renderSlot = (p: PokemonRef) => {
        const { canGuess, reason } = canGuessFor(p.id);
        return (
            <PokemonSlot
                key={p.id}
                pokemon={p}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                status={statusFor(p.id) as any}
                isShiny={shinyIds.has(p.id)}
                order={shuffleOrder.get(p.id)}
                canGuess={canGuess}
                reason={reason}
                isReleased={releasedIds.has(p.id)}
                isPokegeared={usedPokegears.has(p.id)}
                isDerpified={derpyfiedIds.has(p.id)}
            />
        );
    };

    // Merge the two refs (ResizeObserver from useSlotLayout, IntersectionObserver
    // from useInViewport) onto a single wrapper element via a callback ref.
    const setWrapperRef = React.useCallback((el: HTMLDivElement | null) => {
        ref.current = el;
        viewportRef.current = el;
    }, [ref, viewportRef]);

    if (jsLayout) {
        // BUG-15 (2026-05-06): the original PERF-12 design positioned slots
        // via `position: absolute; transform: translate(x, y)` inside a
        // `position: relative; contain: layout` wrapper. Firefox's
        // hit-testing for those abs children was broken — getBoundingClientRect
        // reported the correct rect but elementFromPoint at the slot center
        // returned the wrapper, so lower-row slots became unclickable. Fixed
        // by reverting to the same CSS Grid auto-fill placement the legacy
        // path uses; slots are now normal grid items, hit-tested correctly.
        // We KEEP the per-region IntersectionObserver virtualization gate
        // (off-screen regions skip rendering all 150 slot DOM nodes), and
        // keep `useSlotLayout` only for the off-screen height reservation
        // so scroll position survives a region scrolling out of viewport.
        return (
            <div
                ref={setWrapperRef}
                className="grid gap-1 sm:gap-1.5 justify-start"
                style={{
                    gridTemplateColumns: `repeat(auto-fill, ${slotPx}px)`,
                    // Reserve height when slots aren't rendered (off-screen
                    // virtualization). When `inViewport`, the grid auto-sizes
                    // to its rendered children and minHeight becomes a no-op.
                    minHeight: inViewport ? undefined : layout.totalHeight,
                }}
            >
                {inViewport ? orderedPokemon.map(renderSlot) : null}
            </div>
        );
    }

    return (
        <div
            className="grid gap-1 sm:gap-1.5 justify-start"
            style={{
                // Switch from flex flex-wrap to CSS Grid auto-fill.
                // Grid auto-placement is faster than flex-wrap
                // because the cell grid is precomputed: every cell
                // is exactly slotPx, so children just drop into
                // the next available cell. flex-wrap had to do
                // intrinsic-size resolution per child to determine
                // row breaks.
                gridTemplateColumns: `repeat(auto-fill, ${slotPx}px)`,
            }}
        >
            {pokemonInGen.map(renderSlot)}
        </div>
    );
};

export const DexGrid: React.FC = () => {
    const { allPokemon, unlockedIds, checkedIds, hintedIds, shinyIds, generationFilter, uiSettings, gameMode, isPokemonGuessable, shuffleEndTime, releasedIds, activeRegions, regionPasses, regionLocksEnabled, startingRegion, typeFilter, dexFilter, setDexFilter, categoryFilter, usedPokegears, usedPokedexes, derpyfiedIds } = useGame();

    const [now, setNow] = useState(() => Date.now());

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
        } catch { /* ignore */ }
        return GENERATIONS.map(g => g.label);
    });

    const [regionOpen, setRegionOpen] = useState<Record<string, boolean>>(() => {
        // Perf-mode override: force every region open so each run measures the
        // same workload. Skips localStorage so prior collapsed regions don't
        // skew the timing.
        if (isPerfMode()) {
            const all: Record<string, boolean> = {};
            for (const g of GENERATIONS) all[g.label] = true;
            return all;
        }
        try {
            const saved = localStorage.getItem(REGION_LAYOUT_KEY);
            if (saved) return JSON.parse(saved).open ?? {};
        } catch { /* ignore */ }
        return {};
    });

    useEffect(() => {
        // Don't persist perf-mode forced state.
        if (isPerfMode()) return;
        localStorage.setItem(REGION_LAYOUT_KEY, JSON.stringify({ order: regionOrder, open: regionOpen }));
    }, [regionOrder, regionOpen]);

    // Perf harness: mark DexGrid mount once, set expected slot count from the
    // pokemon list so the harness can fire all-slots-mounted / all-sprites-loaded
    // when the counters reach it.
    useEffect(() => {
        markDexGridMount();
    }, []);
    useEffect(() => {
        if (allPokemon.length > 0) setExpectedSlots(allPokemon.length);
    }, [allPokemon.length]);

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

        // If the player spent a Pokegear or Pokedex on this slot, force the
        // silhouette regardless of the Enable Shadows setting -- otherwise the
        // item's grid-side effect is invisible when shadows are off (BUG-04).
        const hasRevealedItem = usedPokegears.has(id) || usedPokedexes.has(id);

        if (gameMode === 'standalone') {
            return (uiSettings.enableShadows || hasRevealedItem) ? 'shadow' : 'locked';
        }

        const { canGuess } = isPokemonGuessable(id);
        const isRevealed = unlockedIds.has(id);

        if (canGuess) {
            return (uiSettings.enableShadows || hasRevealedItem) ? 'shadow' : 'locked';
        } else if (isRevealed) {
            return 'unlocked';
        }

        if (hintedIds.has(id)) return 'hint';
        return hasRevealedItem ? 'shadow' : 'locked';
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

    // Slot pixel size. Hoisted from PokemonSlot so DexGrid can drive the
    // grid track size on the slot wrap. Single source of truth shared by
    // the wrapping container and the slots themselves.
    const slotPx = 44 * uiSettings.spriteSize;

    // Effective column count: 'auto' tracks activeCount (existing behavior);
    // a manual override is capped at activeCount so we don't render empty
    // cells. Discord 2026-05-06 feedback: with 1 active region the dex grid
    // wasted horizontal space; this setting lets users force more / fewer
    // columns regardless of how many regions they have on.
    const effectiveColumns = uiSettings.dexGridColumns === 'auto'
        ? Math.min(activeCount, 5)
        : Math.min(uiSettings.dexGridColumns, activeCount);

    // Build the responsive grid/columns class string from effectiveColumns.
    // Uses the same breakpoint scheme as before so small screens still stack.
    const colTokens = uiSettings.masonry
        ? ['columns-1', 'sm:columns-2', 'lg:columns-3', 'xl:columns-4', '2xl:columns-5']
        : ['grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4', '2xl:grid-cols-5'];
    const responsiveCols = colTokens.slice(0, effectiveColumns).join(' ');
    const baseLayout = uiSettings.masonry
        ? 'gap-3 sm:gap-4 px-1 sm:px-4 pb-32 space-y-3 sm:space-y-4'
        : 'grid gap-3 sm:gap-4 px-1 sm:px-4 pb-32 items-start';
    const containerClass = `${responsiveCols} ${baseLayout}`;

    const toggleDexFilter = (key: 'guessable' | 'guessed') => {
        setDexFilter(prev => {
            const next = new Set(prev);
            if (next.has(key)) { next.delete(key); } else { next.add(key); }
            return next;
        });
    };

    // A "ran away" (released) Pokemon is in checkedIds but must be guessed
    // again, so it counts as NOT currently guessed. It belongs in the
    // Guessable bucket if (and only if) its gates are open (isPokemonGuessable),
    // and must NOT appear in the Guessed bucket. Mirror the same predicate in
    // the dex filter below so the counts and the filtered grid stay consistent.
    const guessableCount = allPokemon.filter(p => (!checkedIds.has(p.id) || releasedIds.has(p.id)) && isPokemonGuessable(p.id).canGuess).length;
    const guessedCount = allPokemon.filter(p => checkedIds.has(p.id) && !releasedIds.has(p.id)).length;

    // PERF-12: JS-driven absolute slot positioning is the default. The
    // ?legacyDexGrid=1 query param is the escape hatch back to the previous
    // CSS Grid auto-fill path. Computed once per render (cheap;
    // URLSearchParams is fast). Could be hoisted to module scope, but keeping
    // it here lets dev hot-reload pick up flag changes without a full reload.
    const jsLayout = !isLegacyDexGridMode();

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
            {orderedGenerations.map(({ gen }, genIndex) => {
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
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const types: string[] = (pokemonMetadata as any)[p.id]?.types ?? [];
                        return types.some(t => typeFilter.includes(t.charAt(0).toUpperCase() + t.slice(1)));
                    })
                    : fullInGen;

                // Dex filter (guessable / guessed)
                if (dexFilter.size > 0) {
                    pokemonInGen = pokemonInGen.filter(p => {
                        // A released ("ran away") mon is still in checkedIds but
                        // must be re-caught, so it is NOT currently guessed. Treat
                        // it as catchable when its gates are open so it shows up in
                        // the Guessable filter (and stays out of Guessed).
                        const isGuessed = checkedIds.has(p.id) && !releasedIds.has(p.id);
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

                const regionSlug = gen.region.toLowerCase();

                return (
                    <div
                        key={gen.label}
                        onDragOver={(e) => handleDragOver(e, gen.label)}
                        onDragLeave={handleDragLeave}
                        onDrop={() => handleDrop(gen.label)}
                        {...(genIndex === 0 ? { 'data-tour': 'dex-region' } : {})}
                        className={`
                            border shadow-2xl flex flex-col h-fit
                            region-card-${regionSlug} region-bg-${regionSlug}
                            ${uiSettings.masonry ? 'break-inside-avoid mb-4' : ''}
                            w-full transition-all duration-150
                            ${isLocked ? 'opacity-80 shadow-none' : ''}
                            ${isDragTarget ? 'border-blue-500/60 shadow-[0_0_14px_rgba(59,130,246,0.3)]' : ''}
                            ${draggedLabel === gen.label ? 'opacity-40' : ''}
                        `}
                        style={{
                            backgroundColor: 'var(--pp-region-bg)',
                            borderColor: isDragTarget ? undefined : 'var(--pp-border-region)',
                            borderRadius: 'var(--pp-card-radius)',
                        }}
                    >
                        {/* Header: drag handle + toggle */}
                        <div
                            className={`flex items-center gap-2 p-3 sm:p-4 cursor-pointer select-none region-header-${regionSlug}`}
                            onClick={() => toggleRegion(gen.label)}
                            style={{ backgroundColor: 'var(--pp-region-header-bg)', borderRadius: 'var(--pp-card-radius) var(--pp-card-radius) 0 0' }}
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
                                <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 region-text-${regionSlug}`} style={{ color: 'var(--pp-text-region)' }}>
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

                        {/* Region body. Always mounted; display toggles via the
                            isRegionOpen flag. Trace analysis 2026-05-06 showed
                            PERF-03's conditional unmount caused per-click Layout
                            of ~800ms because React reconciled 150 components +
                            DOM mutated + parent dex-grid container reflowed.
                            With always-mounted + display:none, closing a region
                            short-circuits subtree layout entirely (browser skips
                            display:none subtrees) and opening is just a style
                            change with no React reconciliation cost.

                            The earlier DOM-weight win from PERF-03 is real but
                            lesser than the per-click layout cost. content-visibility:auto
                            could later layer on top for offscreen virtualization
                            when this is shipped. */}
                        <div
                            className="px-2 pb-3 sm:px-4 sm:pb-4"
                            style={{
                                display: isRegionOpen ? undefined : 'none',
                                contain: 'layout',
                                // content-visibility: auto was tried 2026-05-06
                                // (commit 2e1173b) and reverted: it added
                                // intersection-check + on-demand-layout work to
                                // every scroll event in our stacked-region
                                // layout, which made scrolling perceptibly
                                // janky and increased total Layout count from
                                // 41 -> 102 events per session. Net negative.
                            }}
                        >
                            <RegionSlots
                                pokemonInGen={pokemonInGen}
                                shuffleOrder={shuffleOrder}
                                slotPx={slotPx}
                                statusFor={getStatus}
                                canGuessFor={isPokemonGuessable}
                                shinyIds={shinyIds}
                                releasedIds={releasedIds}
                                usedPokegears={usedPokegears}
                                derpyfiedIds={derpyfiedIds}
                                jsLayout={jsLayout}
                            />
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
    );
};
