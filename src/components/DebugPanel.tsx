import React from 'react';
import { useGame } from '../context/GameContext';
import { getCleanName } from '../utils/pokemon';
import { ChevronDown, ChevronRight, CheckCircle2, Circle, AlertCircle, RefreshCw } from 'lucide-react';
import pokemonMetadata from '../data/pokemon_metadata.json';

const POKEMON_TYPES = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark'];

interface DebugPanelProps {
    isLogOpen: boolean;
    isSidebarOpen: boolean;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ isLogOpen, isSidebarOpen }) => {
    const {
        allPokemon, unlockedIds, checkedIds, unlockPokemon,
        typeUnlocks, unlockType, lockType, clearAllTypes,
        setShuffleEndTime, setDerpyfiedIds, setReleasedIds,
        derpemonIndex, releasedIds, derpyfiedIds, setSpriteRefreshCounter, showToast,
        STARTER_OFFSET, MILESTONE_OFFSET, TYPE_MILESTONE_OFFSET, TYPE_MILESTONE_MULTIPLIER,
        slotMilestones, slotTypeMilestones,
        isConnected, detectedApWorldVersion,
        recheckMilestones,
    } = useGame();

    const [debugType, setDebugType] = React.useState(POKEMON_TYPES[0]);
    const [milestonesExpanded, setMilestonesExpanded] = React.useState(false);
    const [typeMilestonesExpanded, setTypeMilestonesExpanded] = React.useState(false);
    const [expandedTypes, setExpandedTypes] = React.useState<Set<string>>(new Set());
    const [recheckResult, setRecheckResult] = React.useState<{ globalSent: number; typeSent: number } | null>(null);

    // Debug actions
    const unlockRandom = () => {
        if (allPokemon.length === 0) return;
        const eligible = allPokemon.filter(p => !unlockedIds.has(p.id));
        if (eligible.length === 0) return;
        const pick = eligible[Math.floor(Math.random() * eligible.length)];
        unlockPokemon(pick.id);
    };

    const unlockBatch = () => {
        const eligible = allPokemon.filter(p => !unlockedIds.has(p.id));
        const count = Math.min(10, eligible.length);
        const shuffled = [...eligible].sort(() => Math.random() - 0.5);
        shuffled.slice(0, count).forEach(p => unlockPokemon(p.id));
    };

    const unlockAll = () => {
        if (confirm('Unlock EVERY Pokemon? This might lag for a second.')) {
            allPokemon.forEach(p => unlockPokemon(p.id));
        }
    };

    const triggerDerpTrap = () => {
        const available = allPokemon.filter(p => !derpyfiedIds.has(p.id) && derpemonIndex[p.id]);
        if (available.length > 0) {
            const p = available[Math.floor(Math.random() * available.length)];
            setDerpyfiedIds(prev => new Set(prev).add(p.id));
            setSpriteRefreshCounter((c: number) => c + 1);
            if (checkedIds.has(p.id)) {
                showToast('trap', `${getCleanName(p.name)} turned derpy!`);
            } else {
                showToast('trap', `A Pokémon turned derpy!`);
            }
        }
    };

    const triggerReleaseTrap = () => {
        const valid = Array.from(checkedIds).filter(id => id !== 1 && id !== 4 && id !== 7 && !releasedIds.has(id));
        if (valid.length > 0) {
            const id = valid[Math.floor(Math.random() * valid.length)];
            setReleasedIds(prev => new Set(prev).add(id));
            showToast('trap', 'Oh no! A Pokémon ran away!');
        }
    };

    const handleRecheck = () => {
        const result = recheckMilestones();
        setRecheckResult(result);
        if (result.globalSent + result.typeSent > 0) {
            showToast('success', `Re-sent ${result.globalSent} global + ${result.typeSent} type milestone checks`);
        } else {
            showToast('success', 'All milestone checks are already up to date');
        }
        // Clear result message after a few seconds
        setTimeout(() => setRecheckResult(null), 5000);
    };

    // Compute milestone statuses
    const globalMilestones = slotMilestones ?? [];
    const totalCatches = React.useMemo(() => {
        let count = 0;
        checkedIds.forEach(id => {
            if (id >= STARTER_OFFSET && id < STARTER_OFFSET + 20) return;
            if (id >= MILESTONE_OFFSET) return;
            if (id >= 1 && id <= 1025) count++;
        });
        return count;
    }, [checkedIds, STARTER_OFFSET, MILESTONE_OFFSET]);

    const typeCounts = React.useMemo(() => {
        const counts: Record<string, number> = {};
        checkedIds.forEach(id => {
            if (id >= STARTER_OFFSET && id < STARTER_OFFSET + 20) return;
            if (id >= MILESTONE_OFFSET) return;
            if (id >= 1 && id <= 1025) {
                const data = (pokemonMetadata as any)[id];
                if (!data) return;
                data.types.forEach((t: string) => {
                    const cType = t.charAt(0).toUpperCase() + t.slice(1);
                    counts[cType] = (counts[cType] || 0) + 1;
                });
            }
        });
        return counts;
    }, [checkedIds, STARTER_OFFSET, MILESTONE_OFFSET]);

    const globalMilestoneStatuses = React.useMemo(() => {
        return globalMilestones.map(threshold => {
            const localId = MILESTONE_OFFSET + threshold;
            const isChecked = checkedIds.has(localId);
            const isReached = totalCatches >= threshold;
            return {
                threshold,
                localId,
                isChecked,
                isReached,
                status: isChecked ? 'sent' as const : isReached ? 'reached-not-sent' as const : 'pending' as const,
            };
        });
    }, [globalMilestones, checkedIds, totalCatches, MILESTONE_OFFSET]);

    const typeMilestoneStatuses = React.useMemo(() => {
        const result: Record<string, { threshold: number; localId: number; isChecked: boolean; isReached: boolean; status: 'sent' | 'reached-not-sent' | 'pending' }[]> = {};
        POKEMON_TYPES.forEach((typeName, index) => {
            const typeSteps = slotTypeMilestones?.[typeName] ?? [];
            const rawCount = typeCounts[typeName] || 0;
            result[typeName] = typeSteps.map(step => {
                const localId = TYPE_MILESTONE_OFFSET + (index * TYPE_MILESTONE_MULTIPLIER) + step;
                const isChecked = checkedIds.has(localId);
                const isReached = rawCount >= step;
                return {
                    threshold: step,
                    localId,
                    isChecked,
                    isReached,
                    status: isChecked ? 'sent' as const : isReached ? 'reached-not-sent' as const : 'pending' as const,
                };
            });
        });
        return result;
    }, [checkedIds, typeCounts, slotTypeMilestones, TYPE_MILESTONE_OFFSET, TYPE_MILESTONE_MULTIPLIER]);

    const toggleTypeExpanded = (type: string) => {
        setExpandedTypes(prev => {
            const next = new Set(prev);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            return next;
        });
    };

    const sentCount = globalMilestoneStatuses.filter(m => m.status === 'sent').length;
    const issueCount = globalMilestoneStatuses.filter(m => m.status === 'reached-not-sent').length;
    const typeSentCount = Object.values(typeMilestoneStatuses).flat().filter(m => m.status === 'sent').length;
    const typeTotalCount = Object.values(typeMilestoneStatuses).flat().length;
    const typeIssueCount = Object.values(typeMilestoneStatuses).flat().filter(m => m.status === 'reached-not-sent').length;
    const totalIssues = issueCount + typeIssueCount;

    return (
        <div
            className="absolute bottom-0 left-0 right-0 z-20 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 transition-all duration-300 hidden md:block"
            style={{ right: isSidebarOpen ? '320px' : '0', left: isLogOpen ? '320px' : '0' }}
        >
            <div className="max-w-screen-xl mx-auto flex flex-col gap-2 px-4 py-3 max-h-[50vh] overflow-y-auto">
                {/* Row 1: Debug Controls */}
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-gray-500 uppercase tracking-wider font-bold shrink-0">Debug Controls</span>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => (window as any).runAutoComplete?.()} className="px-3 py-1 bg-green-900/50 hover:bg-green-900/80 text-green-200 rounded text-xs border border-green-700/50 whitespace-nowrap">Auto-Complete Start</button>
                        <button onClick={() => (window as any).stopAutoComplete?.()} className="px-3 py-1 bg-red-900/50 hover:bg-red-900/80 text-red-200 rounded text-xs border border-red-700/50 whitespace-nowrap">Auto-Complete Stop</button>
                        <button onClick={unlockRandom} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs border border-gray-700 whitespace-nowrap">Unlock 1</button>
                        <button onClick={unlockBatch} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs border border-gray-700 whitespace-nowrap">Unlock 10</button>
                        <button onClick={unlockAll} className="px-3 py-1 bg-red-900/50 hover:bg-red-900/80 text-red-200 rounded text-xs border border-red-700/50 whitespace-nowrap">Unlock ALL</button>
                        <div className="w-px h-4 bg-gray-700 mx-1"></div>
                        <button onClick={() => setShuffleEndTime(Date.now() + 30000)} className="px-3 py-1 bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 rounded text-xs border border-purple-700/50 whitespace-nowrap">Shuffle Trap (30s)</button>
                        <button onClick={triggerDerpTrap} className="px-3 py-1 bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 rounded text-xs border border-purple-700/50 whitespace-nowrap">Derp Trap</button>
                        <button onClick={triggerReleaseTrap} className="px-3 py-1 bg-purple-900/50 hover:bg-purple-900/80 text-purple-200 rounded text-xs border border-purple-700/50 whitespace-nowrap">Release Trap</button>
                    </div>
                </div>

                {/* Row 2: Type Controls */}
                <div className="flex flex-wrap gap-4 items-center border-t border-gray-800 pt-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Types:</span>
                        <select
                            value={debugType}
                            onChange={(e) => setDebugType(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                        >
                            {POKEMON_TYPES.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => typeUnlocks.has(debugType) ? lockType(debugType) : unlockType(debugType)}
                            className={`px-3 py-1 rounded text-xs border transition-colors ${typeUnlocks.has(debugType) ? 'bg-green-900/30 text-green-400 border-green-700/50 hover:bg-green-900/50' : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'}`}
                        >
                            {typeUnlocks.has(debugType) ? 'Unlocked' : 'Locked'}
                        </button>
                        <div className="h-4 w-px bg-gray-800 mx-1"></div>
                        <button onClick={() => POKEMON_TYPES.forEach(t => unlockType(t))} className="text-[10px] text-blue-400 hover:underline">All</button>
                        <button onClick={clearAllTypes} className="text-[10px] text-red-400 hover:underline">Clear</button>
                    </div>
                </div>

                {/* Row 3: Milestone Status */}
                <div className="border-t border-gray-800 pt-2">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Milestone Status</span>
                        <span className="text-[10px] text-gray-600">
                            APWorld: <span className={detectedApWorldVersion === 'legacy' ? 'text-amber-400' : detectedApWorldVersion === 'new' ? 'text-green-400' : 'text-gray-400'}>
                                {detectedApWorldVersion}
                            </span>
                        </span>
                        <span className="text-[10px] text-gray-600">
                            Source: <span className={slotMilestones ? 'text-green-400' : 'text-red-400'}>{slotMilestones ? 'server locations' : 'not loaded'}</span>
                        </span>
                        {!isConnected && (
                            <span className="text-[10px] text-amber-400 flex items-center gap-1">
                                <AlertCircle size={10} />
                                Offline
                            </span>
                        )}
                        <div className="flex items-center gap-2 ml-auto">
                            {recheckResult && (
                                <span className="text-[10px] text-green-400">
                                    Sent {recheckResult.globalSent} global + {recheckResult.typeSent} type
                                </span>
                            )}
                            <button
                                onClick={handleRecheck}
                                disabled={!isConnected || !slotMilestones}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs border whitespace-nowrap transition-colors ${
                                    !isConnected || !slotMilestones
                                        ? 'bg-gray-800/50 text-gray-600 border-gray-700/50 cursor-not-allowed'
                                        : totalIssues > 0
                                            ? 'bg-amber-900/50 hover:bg-amber-900/80 text-amber-200 border-amber-700/50'
                                            : 'bg-blue-900/50 hover:bg-blue-900/80 text-blue-200 border-blue-700/50'
                                }`}
                                title={!isConnected ? 'Must be connected to re-check' : !slotMilestones ? 'Milestone data not loaded' : 'Force re-send all reached milestone checks to the server'}
                            >
                                <RefreshCw size={10} />
                                {totalIssues > 0 ? `Re-check All (${totalIssues} missing)` : 'Re-check All'}
                            </button>
                        </div>
                    </div>

                    {/* Global Milestones */}
                    <button
                        onClick={() => setMilestonesExpanded(prev => !prev)}
                        className="flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors w-full text-left py-1"
                    >
                        {milestonesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span className="font-semibold">Global Milestones</span>
                        <span className="text-[10px] text-gray-500">({totalCatches} caught)</span>
                        <span className="text-[10px] text-green-400">{sentCount}/{globalMilestones.length} sent</span>
                        {issueCount > 0 && (
                            <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                                <AlertCircle size={10} />
                                {issueCount} reached but not sent
                            </span>
                        )}
                    </button>

                    {milestonesExpanded && (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-1 pl-5 pb-2">
                            {globalMilestoneStatuses.map(m => (
                                <div
                                    key={m.threshold}
                                    className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded ${
                                        m.status === 'sent' ? 'bg-green-900/20 text-green-400' :
                                        m.status === 'reached-not-sent' ? 'bg-amber-900/20 text-amber-400' :
                                        'bg-gray-800/50 text-gray-500'
                                    }`}
                                    title={`Threshold: ${m.threshold} | Local ID: ${m.localId} | Status: ${m.status}`}
                                >
                                    {m.status === 'sent' ? <CheckCircle2 size={10} /> :
                                     m.status === 'reached-not-sent' ? <AlertCircle size={10} /> :
                                     <Circle size={10} />}
                                    <span className="font-mono">{m.threshold}</span>
                                    <span className="text-[9px] text-gray-600">#{m.localId}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Type Milestones */}
                    <button
                        onClick={() => setTypeMilestonesExpanded(prev => !prev)}
                        className="flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors w-full text-left py-1"
                    >
                        {typeMilestonesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span className="font-semibold">Type Milestones</span>
                        <span className={`text-[10px] ${slotTypeMilestones ? 'text-green-400/70' : 'text-red-400/70'}`}>({slotTypeMilestones ? 'server locations' : 'not loaded'})</span>
                        <span className="text-[10px] text-green-400">{typeSentCount}/{typeTotalCount} sent</span>
                        {typeIssueCount > 0 && (
                            <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                                <AlertCircle size={10} />
                                {typeIssueCount} reached but not sent
                            </span>
                        )}
                    </button>

                    {typeMilestonesExpanded && (
                        <div className="pl-5 pb-2 space-y-0.5">
                            {POKEMON_TYPES.map(typeName => {
                                const milestones = typeMilestoneStatuses[typeName];
                                if (!milestones || milestones.length === 0) return null;
                                const typeCount = typeCounts[typeName] || 0;
                                const sentForType = milestones.filter(m => m.status === 'sent').length;
                                const issuesForType = milestones.filter(m => m.status === 'reached-not-sent').length;
                                const isExpanded = expandedTypes.has(typeName);

                                return (
                                    <div key={typeName}>
                                        <button
                                            onClick={() => toggleTypeExpanded(typeName)}
                                            className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-gray-200 transition-colors w-full text-left py-0.5"
                                        >
                                            {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                            <span className="font-medium w-16">{typeName}</span>
                                            <span className="text-[10px] text-gray-600">{typeCount} caught</span>
                                            <span className="text-[10px] text-green-400/70">{sentForType}/{milestones.length}</span>
                                            {issuesForType > 0 && (
                                                <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                                                    <AlertCircle size={9} />
                                                    {issuesForType}
                                                </span>
                                            )}
                                        </button>
                                        {isExpanded && (
                                            <div className="flex flex-wrap gap-1 pl-6 pb-1">
                                                {milestones.map(m => (
                                                    <div
                                                        key={m.threshold}
                                                        className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                                                            m.status === 'sent' ? 'bg-green-900/20 text-green-400' :
                                                            m.status === 'reached-not-sent' ? 'bg-amber-900/20 text-amber-400' :
                                                            'bg-gray-800/50 text-gray-500'
                                                        }`}
                                                        title={`Threshold: ${m.threshold} | Local ID: ${m.localId} | Status: ${m.status}`}
                                                    >
                                                        {m.status === 'sent' ? <CheckCircle2 size={8} /> :
                                                         m.status === 'reached-not-sent' ? <AlertCircle size={8} /> :
                                                         <Circle size={8} />}
                                                        <span className="font-mono">{m.threshold}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
