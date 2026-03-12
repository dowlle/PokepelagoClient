import React from 'react';
import { useGame } from '../context/GameContext';
import { useTwitch, type GuessFeedEntry } from '../context/TwitchContext';
import { Trophy, Clock, Target } from 'lucide-react';
import { TypeStatus } from './TypeStatus';
import { GateTracker } from './GateTracker';
import { PokemonSlot } from './PokemonSlot';
import type { PokemonRef } from '../types/pokemon';
import { GENERATIONS } from '../types/pokemon';

type GridFilter = 'all' | 'guessable' | 'guessed';
type OverlayModule = 'progress' | 'types' | 'items' | 'feed' | 'guessers' | 'dex';

const ALL_MODULES: OverlayModule[] = ['progress', 'types', 'items', 'feed', 'guessers', 'dex'];

const urlParams = new URLSearchParams(window.location.search);

const parseModules = (): OverlayModule[] => {
    const param = urlParams.get('modules');
    if (!param) return [...ALL_MODULES];
    const requested = param.split(',').filter((m): m is OverlayModule =>
        ALL_MODULES.includes(m as OverlayModule)
    );
    return requested.length > 0 ? requested : [...ALL_MODULES];
};

const enabledModules = parseModules();
const enabledModulesSet = new Set(enabledModules);

const parseDexFilters = (): GridFilter[] => {
    const param = urlParams.get('dexfilter');
    if (!param) return ['all'];
    const filters = param.split(',').filter((f): f is GridFilter =>
        f === 'all' || f === 'guessable' || f === 'guessed'
    );
    return filters.length > 0 ? filters : ['all'];
};

const dexFilters = parseDexFilters();

// Carousel: ?carousel=10 means cycle every 10 seconds. Absent = no carousel.
const carouselParam = urlParams.get('carousel');
const carouselInterval = carouselParam ? Math.max(3, parseInt(carouselParam, 10) || 10) : 0;

// Layout constants for page computation
const MODULE_GAP = 16; // space-y-4 = 1rem
const CONTAINER_PADDING = 32; // p-4 top + bottom
const INDICATOR_HEIGHT = 20; // page dots + gap

const FeedEntry: React.FC<{ entry: GuessFeedEntry }> = ({ entry }) => (
    <div className="flex items-center gap-2 text-sm py-1.5 px-3 animate-in fade-in slide-in-from-top-2 duration-300">
        <span className={entry.type === 'recaught' ? 'text-yellow-400' : 'text-green-400'}>
            {entry.type === 'recaught' ? '↩' : '✓'}
        </span>
        <span className="text-white font-bold truncate">{entry.pokemonName}</span>
        <span className="text-purple-400 truncate">
            {entry.username ? `@${entry.username}` : 'You'}
        </span>
    </div>
);

const CarouselSlide: React.FC<{ slideKey: string; children: React.ReactNode }> = ({ slideKey, children }) => {
    const [visible, setVisible] = React.useState(false);
    const [currentKey, setCurrentKey] = React.useState(slideKey);
    const [content, setContent] = React.useState(children);

    React.useEffect(() => {
        if (slideKey === currentKey) return;
        // Fade out, swap content, fade in
        setVisible(false);
        const timer = setTimeout(() => {
            setCurrentKey(slideKey);
            setContent(children);
            setVisible(true);
        }, 300);
        return () => clearTimeout(timer);
    }, [slideKey, currentKey, children]);

    // Initial fade in
    React.useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
    }, []);

    return (
        <div
            className="transition-all duration-300 ease-in-out"
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(8px)',
            }}
        >
            {content}
        </div>
    );
};

// Auto-scrolls overflowing content with carousel integration.
// Uses transform: translateY() for reliable scrolling (avoids scrollTop issues with flex/overflow).
// When overflow is detected: pauses carousel → translates content up → signals completion.
const AutoScroll: React.FC<{
    active: boolean;
    speed?: number;
    pauseMs?: number;
    resetKey?: string;
    onOverflowDetected?: () => void;
    onScrollComplete?: () => void;
    children: React.ReactNode;
}> = ({
    active, speed = 40, pauseMs = 2000, resetKey, onOverflowDetected, onScrollComplete, children,
}) => {
    const outerRef = React.useRef<HTMLDivElement>(null);
    const innerRef = React.useRef<HTMLDivElement>(null);
    const onOverflowRef = React.useRef(onOverflowDetected);
    const onCompleteRef = React.useRef(onScrollComplete);
    onOverflowRef.current = onOverflowDetected;
    onCompleteRef.current = onScrollComplete;

    React.useEffect(() => {
        if (!active) return;
        const outer = outerRef.current;
        const inner = innerRef.current;
        if (!outer || !inner) return;

        let raf: number;
        let timeout: ReturnType<typeof setTimeout>;
        let lastTime = 0;
        let scrolling = false;
        let started = false;
        let offset = 0;

        const getMaxOffset = () => Math.max(0, inner.offsetHeight - outer.clientHeight);

        const startScroll = () => {
            scrolling = true;
            lastTime = 0;
            offset = 0;
            inner.style.transform = 'translateY(0)';
            raf = requestAnimationFrame(tick);
        };

        const tick = (time: number) => {
            if (!scrolling) return;
            if (!lastTime) { lastTime = time; raf = requestAnimationFrame(tick); return; }
            const dt = (time - lastTime) / 1000;
            lastTime = time;

            offset += speed * dt;
            const max = getMaxOffset();

            if (max <= 0 || offset >= max) {
                scrolling = false;
                offset = max;
                inner.style.transform = `translateY(-${offset}px)`;
                timeout = setTimeout(() => {
                    onCompleteRef.current?.();
                }, pauseMs);
                return;
            }

            inner.style.transform = `translateY(-${offset}px)`;
            raf = requestAnimationFrame(tick);
        };

        const checkOverflow = () => {
            if (started) return;
            if (inner.offsetHeight > outer.clientHeight) {
                started = true;
                onOverflowRef.current?.(); // pause carousel
                inner.style.transform = 'translateY(0)';
                timeout = setTimeout(startScroll, pauseMs); // pause at top, then scroll
            }
        };

        checkOverflow();
        requestAnimationFrame(checkOverflow);
        const observer = new ResizeObserver(checkOverflow);
        observer.observe(outer);
        observer.observe(inner);

        return () => {
            scrolling = false;
            cancelAnimationFrame(raf);
            clearTimeout(timeout);
            observer.disconnect();
            if (inner) inner.style.transform = '';
        };
    }, [active, speed, pauseMs, resetKey]);

    return (
        <div ref={outerRef} className={active ? 'flex-1 min-h-0 overflow-hidden' : ''}>
            <div ref={innerRef}>
                {children}
            </div>
        </div>
    );
};

export const OverlayView: React.FC = () => {
    const {
        allPokemon, checkedIds, releasedIds, goalCount, activePokemonLimit,
        STARTER_OFFSET, MILESTONE_OFFSET,
        isPokemonGuessable, hintedIds, shinyIds, unlockedIds,
        uiSettings, gameMode, activeRegions, generationFilter, isConnected,
    } = useGame();
    const { leaderboard, guessFeed } = useTwitch();

    const [gridFilter, setGridFilter] = React.useState<GridFilter>(dexFilters[0]);
    const dexFilterIndexRef = React.useRef(dexFilters.length - 1);

    // --- Adaptive carousel state ---
    const containerRef = React.useRef<HTMLDivElement>(null);
    const measureRef = React.useRef<HTMLDivElement>(null);
    const [viewportHeight, setViewportHeight] = React.useState(window.innerHeight);
    const [moduleHeights, setModuleHeights] = React.useState<Record<string, number>>({});
    const [pageIndex, setPageIndex] = React.useState(0);
    const [carouselPaused, setCarouselPaused] = React.useState(false);

    // Track container height via ResizeObserver
    React.useEffect(() => {
        if (carouselInterval <= 0) return;
        const el = containerRef.current;
        if (!el) return;
        setViewportHeight(el.clientHeight);
        const observer = new ResizeObserver(entries => {
            setViewportHeight(entries[0].contentRect.height);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Measure module heights from hidden sizer after each render (frozen during scroll)
    React.useLayoutEffect(() => {
        if (carouselInterval <= 0 || !measureRef.current || carouselPaused) return;
        const next: Record<string, number> = {};
        const children = measureRef.current.children;
        for (let i = 0; i < children.length; i++) {
            const el = children[i] as HTMLElement;
            const mod = el.dataset.module;
            if (mod) next[mod] = el.offsetHeight;
        }
        // Only update if heights changed (avoids re-render loop)
        setModuleHeights(prev => {
            const keys = Object.keys(next);
            if (keys.length === Object.keys(prev).length && keys.every(k => prev[k] === next[k])) {
                return prev;
            }
            return next;
        });
    });

    // Compute pages: greedily pack modules into viewport-height groups
    const pages = React.useMemo((): OverlayModule[][] => {
        if (carouselInterval <= 0) return [enabledModules];

        const available = viewportHeight - CONTAINER_PADDING - INDICATOR_HEIGHT;
        if (available <= 0) return [enabledModules];

        // Only include modules that rendered content (height > 0)
        const visibleModules = enabledModules.filter(mod => (moduleHeights[mod] ?? 0) > 0);
        if (visibleModules.length === 0) return [enabledModules];

        const result: OverlayModule[][] = [];
        let page: OverlayModule[] = [];
        let pageHeight = 0;

        for (const mod of visibleModules) {
            const h = moduleHeights[mod] ?? 0;
            const needed = page.length > 0 ? MODULE_GAP + h : h;

            if (page.length > 0 && pageHeight + needed > available) {
                result.push(page);
                page = [mod];
                pageHeight = h;
            } else {
                page.push(mod);
                pageHeight += needed;
            }
        }
        if (page.length > 0) result.push(page);
        return result.length > 0 ? result : [enabledModules];
    }, [viewportHeight, moduleHeights]);

    // Carousel timer: setTimeout per page. Paused when AutoScroll takes over.
    React.useEffect(() => {
        if (carouselInterval <= 0 || pages.length <= 1 || carouselPaused) return;
        const timer = setTimeout(() => {
            setPageIndex(prev => (prev + 1) % pages.length);
        }, carouselInterval * 1000);
        return () => clearTimeout(timer);
    }, [pageIndex, carouselInterval, pages.length, carouselPaused]);

    // Clamp pageIndex when page count shrinks
    React.useEffect(() => {
        setPageIndex(prev => prev >= pages.length ? 0 : prev);
    }, [pages.length]);

    // Cycle dex filter when a dex page becomes active (multi-filter: ?dexfilter=guessable,guessed)
    const prevPageIndexRef = React.useRef(pageIndex);
    React.useEffect(() => {
        if (carouselInterval <= 0 || dexFilters.length <= 1) return;
        const prev = prevPageIndexRef.current;
        prevPageIndexRef.current = pageIndex;
        if (prev === pageIndex) return;
        const page = pages[pageIndex];
        if (page?.includes('dex')) {
            dexFilterIndexRef.current = (dexFilterIndexRef.current + 1) % dexFilters.length;
            setGridFilter(dexFilters[dexFilterIndexRef.current]);
        }
    }, [pageIndex, pages]);

    const currentPage = pages[pageIndex] ?? pages[0] ?? enabledModules;
    const currentPageKey = currentPage.join(',') + (currentPage.includes('dex') ? `-${gridFilter}` : '');
    const pageAvailableHeight = viewportHeight - CONTAINER_PADDING - (pages.length > 1 ? INDICATOR_HEIGHT : 0);

    // --- Data hooks ---
    const guessedCount = React.useMemo(() =>
        Array.from(checkedIds).filter(id =>
            id >= 1 && id <= 1025 &&
            !(id >= STARTER_OFFSET && id < STARTER_OFFSET + 20) &&
            id < MILESTONE_OFFSET &&
            !releasedIds.has(id)
        ).length,
        [checkedIds, STARTER_OFFSET, MILESTONE_OFFSET, releasedIds]
    );

    const displayGoal = goalCount ?? activePokemonLimit;
    const percentage = displayGoal > 0 ? Math.min(100, Math.round((guessedCount / displayGoal) * 100)) : 0;

    const sortedLeaderboard = React.useMemo(() =>
        Array.from(leaderboard.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5),
        [leaderboard]
    );

    const getStatus = React.useCallback((p: PokemonRef): 'locked' | 'unlocked' | 'checked' | 'shadow' | 'hint' => {
        if (releasedIds.has(p.id)) return 'shadow';
        if (checkedIds.has(p.id)) return 'checked';
        if (gameMode === 'standalone') return 'shadow';
        const { canGuess } = isPokemonGuessable(p.id);
        if (canGuess) return 'shadow';
        if (unlockedIds.has(p.id)) return 'unlocked';
        if (hintedIds.has(p.id)) return 'hint';
        return 'locked';
    }, [checkedIds, releasedIds, hintedIds, isPokemonGuessable, unlockedIds, gameMode]);

    const activePokemon = React.useMemo(() => {
        const regionEntries = Object.values(activeRegions);
        return allPokemon.filter(p => {
            if (isConnected && regionEntries.length > 0) {
                return regionEntries.some(([lo, hi]) => p.id >= lo && p.id <= hi);
            }
            const genIdx = GENERATIONS.findIndex(g => p.id >= g.startId && p.id <= g.endId);
            return genIdx !== -1 && generationFilter.includes(genIdx);
        });
    }, [allPokemon, activeRegions, generationFilter, isConnected]);

    const filteredPokemon = React.useMemo(() => {
        if (gridFilter === 'all') return activePokemon;
        if (gridFilter === 'guessed') return activePokemon.filter(p => checkedIds.has(p.id) && !releasedIds.has(p.id));
        // guessable: can guess AND not yet checked
        return activePokemon.filter(p => !checkedIds.has(p.id) && isPokemonGuessable(p.id).canGuess);
    }, [activePokemon, gridFilter, checkedIds, releasedIds, isPokemonGuessable]);

    // AutoScroll ↔ carousel coordination
    const handleOverflowDetected = React.useCallback(() => {
        setCarouselPaused(true);
    }, []);

    const handleScrollComplete = React.useCallback(() => {
        setCarouselPaused(false);
        setPageIndex(prev => (prev + 1) % pages.length);
    }, [pages.length]);

    const FILTER_BUTTONS: { key: GridFilter; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'guessable', label: 'Guessable' },
        { key: 'guessed', label: 'Guessed' },
    ];

    const renderModule = (mod?: OverlayModule) => {
        if (!mod || !enabledModulesSet.has(mod)) return null;

        switch (mod) {
            case 'progress':
                return (
                    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800/50">
                        <div className="flex items-center gap-2 mb-2">
                            <Target size={16} className="text-green-400" />
                            <span className="text-sm font-bold text-green-400">Progress</span>
                            <span className="ml-auto text-lg font-black text-white">
                                {guessedCount}<span className="text-gray-500">/{displayGoal}</span>
                            </span>
                        </div>
                        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <div className="text-right text-xs text-gray-500 mt-1">{percentage}%</div>
                    </div>
                );
            case 'types':
                return <TypeStatus />;
            case 'items':
                return <GateTracker />;
            case 'feed':
                return guessFeed.length > 0 ? (
                    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800/50 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/50">
                            <Clock size={14} className="text-blue-400" />
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Live Feed</span>
                        </div>
                        <div className="max-h-48 overflow-hidden">
                            {guessFeed.slice(0, 8).map(entry => (
                                <FeedEntry key={entry.id} entry={entry} />
                            ))}
                        </div>
                    </div>
                ) : null;
            case 'guessers':
                return sortedLeaderboard.length > 0 ? (
                    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-800/50 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/50">
                            <Trophy size={14} className="text-purple-400" />
                            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Top Guessers</span>
                        </div>
                        <div className="p-2">
                            {sortedLeaderboard.map(([username, count], i) => (
                                <div key={username} className="flex items-center gap-2 text-sm py-1.5 px-2">
                                    <span className={`w-5 text-right font-black ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                                        {i + 1}.
                                    </span>
                                    <span className="text-purple-300 font-medium truncate flex-1">@{username}</span>
                                    <span className="text-gray-400 font-mono font-bold">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null;
            case 'dex':
                return (
                    <div className={`bg-gray-900/80 backdrop-blur-sm rounded-xl p-3 border border-gray-800/50${
                        carouselInterval > 0 ? ' h-full flex flex-col' : ''
                    }`}>
                        <div className="flex gap-1 mb-3 shrink-0">
                            {FILTER_BUTTONS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setGridFilter(key)}
                                    className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
                                        gridFilter === key
                                            ? 'bg-green-600/30 text-green-400 border border-green-500/50'
                                            : 'bg-gray-800/50 text-gray-500 border border-gray-700/30 hover:text-gray-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <AutoScroll active={carouselInterval > 0} speed={40} pauseMs={2000} resetKey={gridFilter}
                            onOverflowDetected={handleOverflowDetected} onScrollComplete={handleScrollComplete}>
                            <div className="flex flex-wrap gap-1">
                                {filteredPokemon.map(p => (
                                    <PokemonSlot
                                        key={p.id}
                                        pokemon={p}
                                        status={getStatus(p)}
                                        isShiny={shinyIds.has(p.id)}
                                    />
                                ))}
                            </div>
                        </AutoScroll>
                        {filteredPokemon.length === 0 && (
                            <div className="text-center text-gray-500 text-xs py-4">
                                No Pokémon match this filter
                            </div>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div ref={containerRef} className="h-screen bg-transparent text-white font-sans p-4 overflow-hidden">
            {/* Hidden measurement layer — same width, measures true module heights */}
            {carouselInterval > 0 && (
                <div className="max-w-lg mx-auto relative">
                    <div
                        ref={measureRef}
                        aria-hidden
                        className="space-y-4 absolute inset-x-0 top-0"
                        style={{ visibility: 'hidden', pointerEvents: 'none' }}
                    >
                        {enabledModules.map(mod => (
                            <div key={mod} data-module={mod}>
                                {renderModule(mod)}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="max-w-lg mx-auto space-y-4">
                {/* Page indicator dots */}
                {carouselInterval > 0 && pages.length > 1 && (
                    <div className="flex justify-center gap-1">
                        {pages.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setPageIndex(i)}
                                className={`h-1 rounded-full transition-all duration-300 ${
                                    i === pageIndex
                                        ? 'w-4 bg-green-400'
                                        : 'w-1.5 bg-gray-700 hover:bg-gray-500'
                                }`}
                            />
                        ))}
                    </div>
                )}

                {/* Module content */}
                {carouselInterval > 0 ? (
                    <CarouselSlide slideKey={currentPageKey}>
                        <div className="flex flex-col gap-4" style={{ height: pageAvailableHeight }}>
                            {currentPage.map(mod => (
                                <div key={mod} className={mod === 'dex' ? 'flex-1 min-h-0' : 'shrink-0'}>
                                    {renderModule(mod)}
                                </div>
                            ))}
                        </div>
                    </CarouselSlide>
                ) : (<>
                    {renderModule('progress')}
                    {renderModule('types')}
                    {renderModule('items')}
                    {renderModule('feed')}
                    {renderModule('guessers')}
                    {renderModule('dex')}
                </>)}
            </div>
        </div>
    );
};
