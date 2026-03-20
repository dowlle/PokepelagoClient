import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { STONE_NAMES_ORDERED } from '../data/pokemon_gates';

const STONE_COLORS: Record<string, string> = {
    fire:    '#EF4444',
    water:   '#3B82F6',
    thunder: '#EAB308',
    leaf:    '#22C55E',
    moon:    '#A78BFA',
    sun:     '#F97316',
    shiny:   '#EC4899',
    dusk:    '#F59E0B',
    dawn:    '#38BDF8',
    ice:     '#67E8F9',
};

const STONE_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items';

const STONE_SPRITE_NAMES: Record<string, string> = {
    fire:    'fire-stone',
    water:   'water-stone',
    thunder: 'thunder-stone',
    leaf:    'leaf-stone',
    moon:    'moon-stone',
    sun:     'sun-stone',
    shiny:   'shiny-stone',
    dusk:    'dusk-stone',
    dawn:    'dawn-stone',
    ice:     'ice-stone',
};

const SPECIAL_ITEMS = [
    { key: 'linkCable',      label: 'Link Cable',      enabledKey: 'tradeLocksEnabled',      haveKey: 'hasLinkCable',      filterKey: 'trade-evo' },
    { key: 'fossilRestorer', label: 'Fossil Restorer', enabledKey: 'fossilLocksEnabled',     haveKey: 'hasFossilRestorer', filterKey: 'fossil' },
    { key: 'ultraWormhole',  label: 'Ultra Wormhole',  enabledKey: 'ultraBeastLocksEnabled', haveKey: 'hasUltraWormhole',  filterKey: 'ultra-beast' },
    { key: 'timeRift',       label: 'Time Rift',       enabledKey: 'paradoxLocksEnabled',    haveKey: 'hasTimeRift',       filterKey: 'paradox' },
] as const;

export const GateTracker: React.FC = () => {
    const {
        isConnected, gameMode,
        legendaryLocksEnabled, gymBadges,
        tradeLocksEnabled, hasLinkCable,
        babyLocksEnabled, daycareCount, daycareRequired,
        fossilLocksEnabled, hasFossilRestorer,
        ultraBeastLocksEnabled, hasUltraWormhole,
        paradoxLocksEnabled, hasTimeRift,
        stoneLocksEnabled, unlockedStones,
        regionLocksEnabled, regionPasses, activeRegions, startingRegion,
        say, categoryFilter, setCategoryFilter,
    } = useGame();

    const [pendingHint, setPendingHint] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(true);

    if (!isConnected || gameMode !== 'archipelago') return null;

    const handleHintClick = (itemName: string) => {
        if (pendingHint === itemName) {
            say(`!hint ${itemName}`);
            setPendingHint(null);
        } else {
            setPendingHint(itemName);
        }
    };

    const handleFilterClick = (filter: string) => {
        setCategoryFilter(prev => prev === filter ? null : filter);
    };

    const hasAnyGate =
        legendaryLocksEnabled ||
        (tradeLocksEnabled || babyLocksEnabled || fossilLocksEnabled || ultraBeastLocksEnabled || paradoxLocksEnabled) ||
        stoneLocksEnabled ||
        (regionLocksEnabled && Object.keys(activeRegions).length > 1);

    if (!hasAnyGate) return null;

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 space-y-3">
            <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setIsOpen(o => !o)}
            >
                <h4 className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                    Item Tracker
                </h4>
                <ChevronDown
                    size={12}
                    className={`text-gray-500 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                />
            </div>

            {isOpen && <>
            {/* Gym Badges */}
            {legendaryLocksEnabled && (
                <div>
                    <div className="text-[9px] font-bold uppercase text-gray-500 mb-1.5 tracking-wider">Gym Badges</div>
                    <div className="flex items-center gap-1">
                        {Array.from({ length: 8 }, (_, i) => {
                            const filled = i < gymBadges;
                            const tier = i < 6 ? 'sub' : i < 7 ? 'box' : 'mythic';
                            const tierColor = tier === 'mythic' ? '#F59E0B' : tier === 'box' ? '#A78BFA' : '#60A5FA';
                            const filterName = tier === 'mythic' ? 'mythic' : tier === 'box' ? 'box-legendary' : 'sub-legendary';
                            const isActiveFilter = categoryFilter === filterName;
                            return (
                                <div
                                    key={i}
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${isActiveFilter ? 'ring-1 ring-white/50' : ''} ${!filled && pendingHint === 'Gym Badge' ? 'animate-pulse' : ''}`}
                                    style={{
                                        borderColor: filled ? tierColor : (!filled && pendingHint === 'Gym Badge') ? '#EAB308' : '#374151',
                                        backgroundColor: filled ? `${tierColor}33` : 'transparent',
                                    }}
                                    title={filled
                                        ? `Click to filter ${tier === 'mythic' ? 'Mythics' : tier === 'box' ? 'Box Legendaries' : 'Sub-Legendaries'}`
                                        : pendingHint === 'Gym Badge' ? 'Click again to hint Gym Badge' : 'Click to hint Gym Badge'
                                    }
                                    onClick={() => filled ? handleFilterClick(filterName) : handleHintClick('Gym Badge')}
                                >
                                    {filled && (
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tierColor }} />
                                    )}
                                </div>
                            );
                        })}
                        <span className="text-[9px] text-gray-500 ml-1">{gymBadges}/8</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px] text-gray-600">
                        <span style={{ color: '#60A5FA' }}>6 = Sub-Leg.</span>
                        <span style={{ color: '#A78BFA' }}>7 = Box</span>
                        <span style={{ color: '#F59E0B' }}>8 = Mythic</span>
                    </div>
                </div>
            )}

            {/* Daycare (shown separately since it has a count) */}
            {babyLocksEnabled && (() => {
                const have = daycareCount >= daycareRequired;
                const isActiveFilter = categoryFilter === 'baby';
                return (
                    <div className="flex items-center gap-2">
                        <div
                            className={`flex-1 flex items-center justify-between px-2 py-1 rounded border text-[9px] font-bold transition-all cursor-pointer hover:brightness-125 ${isActiveFilter ? 'ring-1 ring-white/50' : ''} ${!have && pendingHint === 'Daycare' ? 'animate-pulse' : ''}`}
                            style={{
                                borderColor: have ? '#22C55E66' : (pendingHint === 'Daycare' ? '#EAB30866' : '#37415144'),
                                backgroundColor: have ? '#22C55E1A' : '#1f293744',
                                color: have ? '#4ADE80' : '#6B7280',
                            }}
                            title={have
                                ? (isActiveFilter ? 'Click to clear filter' : 'Click to filter Baby Pokemon')
                                : (pendingHint === 'Daycare' ? 'Click again to hint Daycare' : 'Click to hint Daycare')
                            }
                            onClick={() => have ? handleFilterClick('baby') : handleHintClick('Daycare')}
                        >
                            <span>Daycare</span>
                            <span className="font-normal">{daycareCount}/{daycareRequired}</span>
                        </div>
                    </div>
                );
            })()}

            {/* Special single-copy items */}
            {SPECIAL_ITEMS.some(item => {
                const enabled = item.enabledKey === 'tradeLocksEnabled' ? tradeLocksEnabled
                    : item.enabledKey === 'fossilLocksEnabled' ? fossilLocksEnabled
                    : item.enabledKey === 'ultraBeastLocksEnabled' ? ultraBeastLocksEnabled
                    : paradoxLocksEnabled;
                return enabled;
            }) && (
                <div className="flex flex-col gap-1">
                    {SPECIAL_ITEMS.map(item => {
                        const enabled =
                            item.enabledKey === 'tradeLocksEnabled' ? tradeLocksEnabled
                            : item.enabledKey === 'fossilLocksEnabled' ? fossilLocksEnabled
                            : item.enabledKey === 'ultraBeastLocksEnabled' ? ultraBeastLocksEnabled
                            : paradoxLocksEnabled;
                        if (!enabled) return null;
                        const have =
                            item.haveKey === 'hasLinkCable' ? hasLinkCable
                            : item.haveKey === 'hasFossilRestorer' ? hasFossilRestorer
                            : item.haveKey === 'hasUltraWormhole' ? hasUltraWormhole
                            : hasTimeRift;
                        const isActiveFilter = categoryFilter === item.filterKey;
                        const isPending = !have && pendingHint === item.label;
                        return (
                            <div
                                key={item.key}
                                className={`flex items-center gap-2 px-2 py-1 rounded border text-[9px] font-bold transition-all cursor-pointer hover:brightness-125 ${isActiveFilter ? 'ring-1 ring-white/50' : ''} ${isPending ? 'animate-pulse' : ''}`}
                                style={{
                                    borderColor: have ? '#22C55E66' : (isPending ? '#EAB30866' : '#37415144'),
                                    backgroundColor: have ? '#22C55E1A' : '#1f293744',
                                    color: have ? '#4ADE80' : '#6B7280',
                                }}
                                title={have
                                    ? (isActiveFilter ? 'Click to clear filter' : `Click to filter ${item.label} Pokemon`)
                                    : (isPending ? `Click again to hint ${item.label}` : `Click to hint ${item.label}`)
                                }
                                onClick={() => have ? handleFilterClick(item.filterKey) : handleHintClick(item.label)}
                            >
                                <span className="text-[10px]">{have ? '✓' : '○'}</span>
                                <span>{isPending ? `Hint ${item.label}?` : item.label}</span>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Evo Stones */}
            {stoneLocksEnabled && (
                <div>
                    <div className="text-[9px] font-bold uppercase text-gray-500 mb-1.5 tracking-wider">Evo Stones</div>
                    <div className="flex flex-wrap gap-1.5">
                        {STONE_NAMES_ORDERED.map(stone => {
                            const have = unlockedStones.has(stone);
                            const color = STONE_COLORS[stone] ?? '#9CA3AF';
                            const spriteName = STONE_SPRITE_NAMES[stone];
                            const stoneLabel = `${stone.charAt(0).toUpperCase()}${stone.slice(1)} Stone`;
                            const filterName = `stone-${stone}`;
                            const isActiveFilter = categoryFilter === filterName;
                            const isPending = !have && pendingHint === stoneLabel;
                            return (
                                <div
                                    key={stone}
                                    title={have
                                        ? (isActiveFilter ? 'Click to clear filter' : `Click to filter ${stoneLabel} evolutions`)
                                        : (isPending ? `Click again to hint ${stoneLabel}` : `Click to hint ${stoneLabel}`)
                                    }
                                    className={`w-8 h-8 rounded border flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${isActiveFilter ? 'ring-1 ring-white/50' : ''} ${isPending ? 'animate-pulse' : ''}`}
                                    style={{
                                        borderColor: have ? `${color}88` : (isPending ? '#EAB30888' : '#37415166'),
                                        backgroundColor: have ? `${color}22` : '#1f293744',
                                        opacity: have ? 1 : (isPending ? 0.7 : 0.35),
                                    }}
                                    onClick={() => have ? handleFilterClick(filterName) : handleHintClick(stoneLabel)}
                                >
                                    <img
                                        src={`${STONE_SPRITE_BASE}/${spriteName}.png`}
                                        alt={stone}
                                        className="w-6 h-6 object-contain image-rendering-pixelated"
                                        style={{ imageRendering: 'pixelated' }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Region Passes */}
            {regionLocksEnabled && Object.keys(activeRegions).length > 1 && (
                <div>
                    <div className="text-[9px] font-bold uppercase text-gray-500 mb-1.5 tracking-wider">Region Passes</div>
                    <div className="flex flex-wrap gap-1">
                        {Object.keys(activeRegions).map(region => {
                            const isStarting = region === startingRegion;
                            const have = isStarting || regionPasses.has(region);
                            const filterName = `region-${region}`;
                            const isActiveFilter = categoryFilter === filterName;
                            const hintName = `${region} Pass`;
                            const isPending = !have && pendingHint === hintName;
                            return (
                                <div
                                    key={region}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer hover:brightness-125 ${isActiveFilter ? 'ring-1 ring-white/50' : ''} ${isPending ? 'animate-pulse' : ''}`}
                                    style={{
                                        borderColor: have ? '#F59E0B66' : (isPending ? '#EAB30866' : '#37415144'),
                                        backgroundColor: have ? '#F59E0B1A' : '#1f293744',
                                        color: have ? '#FCD34D' : '#4B5563',
                                    }}
                                    title={have
                                        ? (isActiveFilter ? 'Click to clear filter' : `Click to filter ${region} Pokemon`)
                                        : (isPending ? `Click again to hint ${hintName}` : `Click to hint ${hintName}`)
                                    }
                                    onClick={() => have ? handleFilterClick(filterName) : handleHintClick(hintName)}
                                >
                                    {isPending ? `Hint ${region}?` : isStarting ? `${region} ★` : `${have ? '✓' : '○'} ${region}`}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {pendingHint && (
                <p className="text-[10px] text-yellow-400/70 italic">Click again to hint {pendingHint}.</p>
            )}
            {categoryFilter && (
                <p className="text-[10px] text-blue-400/70 italic">
                    Filtering by: {categoryFilter.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    {' — '}
                    <span className="underline cursor-pointer" onClick={() => setCategoryFilter(null)}>clear</span>
                </p>
            )}
            </>}
        </div>
    );
};
