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

const parseDexFilter = (): GridFilter => {
    const param = urlParams.get('dexfilter');
    if (param === 'guessable' || param === 'guessed') return param;
    return 'all';
};

// Carousel: ?carousel=10 means cycle every 10 seconds. Absent = no carousel.
const carouselParam = urlParams.get('carousel');
const carouselInterval = carouselParam ? Math.max(3, parseInt(carouselParam, 10) || 10) : 0;

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

// Build carousel steps: each enabled module is a step, but dex gets 3 steps (all/guessable/guessed)
const buildCarouselSteps = (): { module: OverlayModule; dexFilter?: GridFilter }[] => {
    const steps: { module: OverlayModule; dexFilter?: GridFilter }[] = [];
    for (const mod of enabledModules) {
        if (mod === 'dex') {
            steps.push({ module: 'dex', dexFilter: 'all' });
            steps.push({ module: 'dex', dexFilter: 'guessable' });
            steps.push({ module: 'dex', dexFilter: 'guessed' });
        } else {
            steps.push({ module: mod });
        }
    }
    return steps;
};

const carouselSteps = carouselInterval > 0 ? buildCarouselSteps() : [];

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

export const OverlayView: React.FC = () => {
    const {
        allPokemon, checkedIds, releasedIds, goalCount, activePokemonLimit,
        STARTER_OFFSET, MILESTONE_OFFSET,
        isPokemonGuessable, hintedIds, shinyIds, unlockedIds,
        uiSettings, gameMode, activeRegions, generationFilter, isConnected,
    } = useGame();
    const { leaderboard, guessFeed } = useTwitch();

    const [gridFilter, setGridFilter] = React.useState<GridFilter>(parseDexFilter);

    // Carousel state
    const [carouselIndex, setCarouselIndex] = React.useState(0);

    React.useEffect(() => {
        if (carouselInterval <= 0 || carouselSteps.length === 0) return;
        const timer = setInterval(() => {
            setCarouselIndex(prev => (prev + 1) % carouselSteps.length);
        }, carouselInterval * 1000);
        return () => clearInterval(timer);
    }, []);

    // Sync dex filter from carousel
    const activeStep = carouselSteps[carouselIndex];
    React.useEffect(() => {
        if (carouselInterval > 0 && activeStep?.module === 'dex' && activeStep.dexFilter) {
            setGridFilter(activeStep.dexFilter);
        }
    }, [carouselIndex, activeStep]);

    const isModuleVisible = (mod: OverlayModule): boolean => {
        if (!enabledModulesSet.has(mod)) return false;
        if (carouselInterval <= 0) return true;
        return activeStep?.module === mod;
    };

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
                    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-3 border border-gray-800/50">
                        <div className="flex gap-1 mb-3">
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
        <div className="min-h-screen bg-transparent text-white font-sans p-4 overflow-y-auto">
            <div className="max-w-lg mx-auto space-y-4">
                {/* Carousel indicator */}
                {carouselInterval > 0 && carouselSteps.length > 1 && (
                    <div className="flex justify-center gap-1">
                        {carouselSteps.map((step, i) => (
                            <button
                                key={`${step.module}-${step.dexFilter ?? ''}-${i}`}
                                onClick={() => setCarouselIndex(i)}
                                className={`h-1 rounded-full transition-all duration-300 ${
                                    i === carouselIndex
                                        ? 'w-4 bg-green-400'
                                        : 'w-1.5 bg-gray-700 hover:bg-gray-500'
                                }`}
                            />
                        ))}
                    </div>
                )}

                {/* Module content — wrapped in CarouselSlide when carousel is active */}
                {carouselInterval > 0 ? (
                    <CarouselSlide slideKey={`${activeStep?.module}-${activeStep?.dexFilter ?? ''}`}>
                        {renderModule(activeStep?.module)}
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
