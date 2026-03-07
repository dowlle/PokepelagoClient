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
    { key: 'linkCable',      label: 'Link Cable',      enabledKey: 'tradeLocksEnabled',      haveKey: 'hasLinkCable' },
    { key: 'fossilRestorer', label: 'Fossil Restorer', enabledKey: 'fossilLocksEnabled',     haveKey: 'hasFossilRestorer' },
    { key: 'ultraWormhole',  label: 'Ultra Wormhole',  enabledKey: 'ultraBeastLocksEnabled', haveKey: 'hasUltraWormhole' },
    { key: 'timeRift',       label: 'Time Rift',       enabledKey: 'paradoxLocksEnabled',    haveKey: 'hasTimeRift' },
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
    } = useGame();

    if (!isConnected || gameMode !== 'archipelago') return null;

    const hasAnyGate =
        legendaryLocksEnabled ||
        (tradeLocksEnabled || babyLocksEnabled || fossilLocksEnabled || ultraBeastLocksEnabled || paradoxLocksEnabled) ||
        stoneLocksEnabled ||
        (regionLocksEnabled && Object.keys(activeRegions).length > 1);

    if (!hasAnyGate) return null;

    const [isOpen, setIsOpen] = useState(true);

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
                            return (
                                <div
                                    key={i}
                                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                                    style={{
                                        borderColor: filled ? tierColor : '#374151',
                                        backgroundColor: filled ? `${tierColor}33` : 'transparent',
                                    }}
                                    title={`Badge ${i + 1} — unlocks ${tier === 'mythic' ? 'Mythics' : tier === 'box' ? 'Box Legendaries' : 'Sub-Legendaries'}`}
                                >
                                    {filled && (
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tierColor }} />
                                    )}
                                </div>
                            );
                        })}
                        <span className="text-[9px] text-gray-500 ml-1">{gymBadges}/8</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-[8px] text-gray-600">
                        <span style={{ color: '#60A5FA' }}>6 = Sub-Leg.</span>
                        <span style={{ color: '#A78BFA' }}>7 = Box</span>
                        <span style={{ color: '#F59E0B' }}>8 = Mythic</span>
                    </div>
                </div>
            )}

            {/* Daycare (shown separately since it has a count) */}
            {babyLocksEnabled && (
                <div className="flex items-center gap-2">
                    <div
                        className="flex-1 flex items-center justify-between px-2 py-1 rounded border text-[9px] font-bold transition-all"
                        style={{
                            borderColor: daycareCount >= daycareRequired ? '#22C55E66' : '#37415144',
                            backgroundColor: daycareCount >= daycareRequired ? '#22C55E1A' : '#1f293744',
                            color: daycareCount >= daycareRequired ? '#4ADE80' : '#6B7280',
                        }}
                    >
                        <span>Daycare</span>
                        <span className="font-normal">{daycareCount}/{daycareRequired}</span>
                    </div>
                </div>
            )}

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
                        return (
                            <div
                                key={item.key}
                                className="flex items-center gap-2 px-2 py-1 rounded border text-[9px] font-bold transition-all"
                                style={{
                                    borderColor: have ? '#22C55E66' : '#37415144',
                                    backgroundColor: have ? '#22C55E1A' : '#1f293744',
                                    color: have ? '#4ADE80' : '#6B7280',
                                }}
                            >
                                <span className="text-[10px]">{have ? '✓' : '○'}</span>
                                <span>{item.label}</span>
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
                            return (
                                <div
                                    key={stone}
                                    title={`${stone.charAt(0).toUpperCase()}${stone.slice(1)} Stone${have ? ' (obtained)' : ' (needed)'}`}
                                    className="w-8 h-8 rounded border flex items-center justify-center transition-all"
                                    style={{
                                        borderColor: have ? `${color}88` : '#37415166',
                                        backgroundColor: have ? `${color}22` : '#1f293744',
                                        opacity: have ? 1 : 0.35,
                                    }}
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
                            return (
                                <div
                                    key={region}
                                    className="px-1.5 py-0.5 rounded text-[8px] font-bold border transition-all"
                                    style={{
                                        borderColor: have ? '#F59E0B66' : '#37415144',
                                        backgroundColor: have ? '#F59E0B1A' : '#1f293744',
                                        color: have ? '#FCD34D' : '#4B5563',
                                    }}
                                >
                                    {isStarting ? `${region} ★` : `${have ? '✓' : '○'} ${region}`}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            </>}
        </div>
    );
};
