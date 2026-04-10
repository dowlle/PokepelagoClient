import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { useTwitch } from '../context/TwitchContext';
import { X, ExternalLink, HelpCircle, MapPin, Sparkles, CheckCircle2, Lock, Palette, User, Link, Shield } from 'lucide-react';
import { getCleanName } from '../utils/pokemon';
import { getDerpemonCredit } from '../services/derpemonService';
import pokemonNamesJson from '../data/pokemon_names.json';
import { TYPE_COLORS } from '../utils/typeColors';
import { PmdSpriteCanvas } from './PmdSpriteCanvas';
import { normalizePmdBaseUrl } from '../services/pmdSpriteService';

export const PokemonDetails: React.FC = () => {
    const {
        selectedPokemonId,
        setSelectedPokemonId,
        allPokemon,
        unlockedIds,
        checkedIds,
        hintedIds,
        shinyIds,
        say,
        getLocationName,
        masterBalls,
        pokegears,
        pokedexes,
        consumeMasterBall,
        consumePokegear,
        consumePokedex,
        usedPokegears,
        usedPokedexes,
        isPokemonGuessable,
        masterBallBypassGates,
        getSpriteUrl,
        uiSettings,
        derpemonIndex,
        scoutLocation,
        isConnected,
        derpyfiedIds,
        spriteRefreshCounter,
        locationOffset,
        pmdSpriteUrl,
        gymBadges
    } = useGame();
    const { getCredit } = useTwitch();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [details, setDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [gifLoaded, setGifLoaded] = useState(false);
    const [pendingHint, setPendingHint] = useState<string | null>(null);
    const [itemCooldown, setItemCooldown] = useState<string | null>(null);
    const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
    const [scoutedItem, setScoutedItem] = useState<{ itemName: string, playerName: string } | null>(null);
    const [gearSpriteLoaded, setGearSpriteLoaded] = useState(false);
    const [masterBallSpriteLoaded, setMasterBallSpriteLoaded] = useState(false);
    const [pokedexSpriteLoaded, setPokedexSpriteLoaded] = useState(false);
    const gifRef = useRef<HTMLImageElement>(null);

    const normalizedPmdUrl = React.useMemo(
        () => pmdSpriteUrl ? normalizePmdBaseUrl(pmdSpriteUrl) : '',
        [pmdSpriteUrl]
    );

    const pokemon = allPokemon.find(p => p.id === selectedPokemonId);
    const isChecked = selectedPokemonId ? checkedIds.has(selectedPokemonId) : false;
    const isHinted = selectedPokemonId ? hintedIds.has(selectedPokemonId) : false;

    useEffect(() => {
        if (selectedPokemonId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(true);
            setGifLoaded(false);
            setPendingHint(null);
            setScoutedItem(null);

            // Fetch PokeAPI metadata
            fetch(`https://pokeapi.co/api/v2/pokemon/${selectedPokemonId}`)
                .then(res => res.json())
                .then(data => {
                    setDetails(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Failed to fetch pokemon details', err);
                    setLoading(false);
                });

            // Fetch Local Sprite (prefer Derpemon > animated > static)
            const loadLocalSprites = async () => {
                const isShiny = shinyIds.has(selectedPokemonId);

                // When Derpémon set is active, try the Derpemon static sprite first.
                // Only fall back to animated/showdown if no Derpemon sprite exists.
                if (uiSettings.spriteSet === 'derpemon') {
                    const derpUrl = await getSpriteUrl(selectedPokemonId, { shiny: isShiny });
                    if (derpUrl) {
                        setSpriteUrl(derpUrl);
                        return;
                    }
                }

                // Default path: prefer animated, fall back to static
                let url = await getSpriteUrl(selectedPokemonId, { shiny: isShiny, animated: true });
                if (!url) {
                    url = await getSpriteUrl(selectedPokemonId, { shiny: isShiny });
                }
                setSpriteUrl(url);
                if (!url) setGifLoaded(true); // No sprite to load, mark as loaded to show info
            };
            loadLocalSprites();

            // Scout item contents
            if (isChecked && isConnected) {
                scoutLocation(selectedPokemonId + locationOffset).then(res => {
                    if (res) setScoutedItem(res);
                }).catch(e => console.warn('Failed to scout location', e));
            }
        } else {
            setDetails(null);
            setSpriteUrl(prev => {
                if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                return null;
            });
        }
        return () => {
            setSpriteUrl(prev => {
                if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                return null;
            });
        };
    }, [selectedPokemonId, uiSettings.spriteSet, allPokemon, isChecked, isConnected, scoutLocation, shinyIds, getSpriteUrl, spriteRefreshCounter, locationOffset]);

    if (!selectedPokemonId || !pokemon) return null;

    const isUnlocked = unlockedIds.has(selectedPokemonId);
    const isShiny = shinyIds.has(selectedPokemonId);

    // Only show name and real info if guessed (checked)
    const showInfo = isChecked;
    const showShadow = isUnlocked && !isChecked;

    const handleHintClick = (itemName: string) => {
        if (pendingHint === itemName) {
            say(`!hint ${itemName}`);
            setPendingHint(null);
        } else {
            setPendingHint(itemName);
        }
    };

    const handleUseItem = (item: 'master' | 'gear' | 'dex') => {
        if (item === 'master') consumeMasterBall(selectedPokemonId);
        if (item === 'gear') consumePokegear(selectedPokemonId);
        if (item === 'dex') consumePokedex(selectedPokemonId);

        setItemCooldown(item);
        setTimeout(() => setItemCooldown(null), 2000);
    };

    const isPokegeared = usedPokegears.has(selectedPokemonId);
    const isPokedexed = usedPokedexes.has(selectedPokemonId);
    const { canGuess, reason, reasons, missingRegion, missingTypes, missingPokemon, missingRouteKeys, missingLineUnlock, badgeLevelRequired } = isPokemonGuessable(selectedPokemonId);

    const lang = localStorage.getItem('pokepelago_language') ?? 'en';
    const langNames = (pokemonNamesJson as Record<string, Record<string, string>>)[selectedPokemonId.toString()];
    const localName = lang !== 'global' && langNames?.[lang];

    let displayName = '???';
    if (showInfo) {
        displayName = localName || getCleanName(pokemon.name);
    } else if (isPokedexed) {
        const hintBase = localName || pokemon.name;
        displayName = hintBase.slice(0, 3).toUpperCase() + '...';
    }

    // Location ID = National Dex ID + locationOffset
    const unlockLocationName = getLocationName(selectedPokemonId + locationOffset);

    // Derpemon credit (shown for all unlocked Pokémon when Derpemon set is active OR if hit by Derp Trap)
    const derpemonCreator = (uiSettings.spriteSet === 'derpemon' || derpyfiedIds.has(selectedPokemonId))
        ? getDerpemonCredit(derpemonIndex, selectedPokemonId)
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedPokemonId(null)}>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="absolute top-4 right-4 z-10">
                    <button
                        onClick={() => setSelectedPokemonId(null)}
                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Pokemon Display */}
                <div className={`h-48 flex items-center justify-center relative overflow-hidden ${isShiny && isChecked ? 'bg-linear-to-b from-yellow-900/20 to-transparent' : 'bg-gray-800/20'}`}>
                    {loading && (
                        <div className="w-12 h-12 border-4 border-blue-500 rounded-full animate-spin border-t-transparent opacity-50 absolute z-0"></div>
                    )}

                    {isUnlocked || isChecked ? (
                        <div className="relative">
                            {isShiny && isChecked && (
                                <div className="absolute -inset-8 bg-yellow-500/10 blur-3xl animate-pulse rounded-full" />
                            )}
                            {normalizedPmdUrl ? (
                                <PmdSpriteCanvas
                                    id={selectedPokemonId}
                                    baseUrl={normalizedPmdUrl}
                                    anim="Idle"
                                    filterClass={
                                        showShadow && !isPokegeared ? 'brightness-0 opacity-40 contrast-100' :
                                        showShadow && isPokegeared ? 'brightness-50 opacity-80' : ''
                                    }
                                    size={128}
                                />
                            ) : spriteUrl ? (
                                <img
                                    ref={gifRef}
                                    src={spriteUrl}
                                    alt={pokemon.name}
                                    onLoad={() => setGifLoaded(true)}
                                    className={`
                                        w-32 h-32 object-contain relative z-10 transition-opacity duration-300
                                        ${showShadow && !isPokegeared ? 'brightness-0 opacity-40 contrast-100' : ''}
                                        ${showShadow && isPokegeared ? 'brightness-50 opacity-80' : ''}
                                        ${gifLoaded ? 'opacity-100' : 'opacity-0'}
                                    `}
                                />
                            ) : (
                                <div className="w-32 h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-700 rounded-2xl opacity-40">
                                    <HelpCircle size={40} className="text-gray-600 mb-1" />
                                    <span className="text-[10px] text-gray-500 font-mono">#{selectedPokemonId}</span>
                                </div>
                            )}
                            {!gifLoaded && !loading && (
                                <div className="w-12 h-12 border-4 border-gray-700 rounded-full animate-spin border-t-transparent opacity-50 absolute inset-0 m-auto"></div>
                            )}
                        </div>
                    ) : (
                        <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center opacity-20">
                            <HelpCircle size={64} className="text-gray-400" />
                        </div>
                    )}

                    <div className="absolute bottom-4 left-6">
                        <span className="text-4xl font-black text-white/5 opacity-40 select-none">#{selectedPokemonId}</span>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 pt-2 space-y-6">
                    <div className="flex justify-between items-end min-h-12.5">
                        <div>
                            <h2 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                                {displayName}
                                {isShiny && isChecked && gifLoaded && <Sparkles size={20} className="text-yellow-400" />}
                            </h2>
                            <p className="text-xs text-gray-500 font-mono">National Dex #{selectedPokemonId}</p>
                        </div>

                        <div className="flex gap-2">
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {details?.types && showInfo && details.types.map((t: any) => {
                                const typeName = t.type.name.charAt(0).toUpperCase() + t.type.name.slice(1);
                                const color = TYPE_COLORS[typeName];
                                return (
                                    <span
                                        key={t.type.name}
                                        className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-right-2"
                                        style={color ? {
                                            backgroundColor: `${color}33`,
                                            border: `1px solid ${color}66`,
                                            color,
                                        } : { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#d1d5db' }}
                                    >
                                        {t.type.name}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {showInfo && details ? (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="bg-gray-800/40 rounded-xl p-3 border border-gray-800">
                                <span className="text-[10px] text-gray-500 uppercase font-black block mb-1">Dimensions</span>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Height</span>
                                    <span className="text-white font-bold">{details.height / 10}m</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Weight</span>
                                    <span className="text-white font-bold">{details.weight / 10}kg</span>
                                </div>
                            </div>
                            <div className="bg-gray-800/40 rounded-xl p-3 border border-gray-800">
                                <span className="text-[10px] text-gray-500 uppercase font-black block mb-1">Abilities</span>
                                <div className="space-y-0.5">
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    {details.abilities.map((a: any) => (
                                        <div key={a.ability.name} className="flex justify-between text-xs">
                                            <span className="text-gray-400 capitalize">{a.ability.name.replace('-', ' ')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-24 flex items-center justify-center bg-gray-800/10 rounded-xl border border-dashed border-gray-800">
                            <p className="text-xs text-gray-600 italic">
                                {!isChecked ? "Unlock and guess this Pokémon to reveal its data" : "Loading data..."}
                            </p>
                        </div>
                    )}

                    {/* Requirements Section */}
                    {!isChecked && !canGuess && (missingRegion || missingTypes || missingPokemon || missingRouteKeys || missingLineUnlock || badgeLevelRequired || reason) && (
                        <div className="bg-red-900/10 border border-red-500/30 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                            <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider">
                                <Lock size={14} />
                                <span>Missing Requirements</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {missingRegion && (
                                    <span
                                        onClick={() => handleHintClick(`${missingRegion} Pass`)}
                                        className={`px-3 py-1 bg-red-950/60 border rounded-lg text-[10px] text-red-200 uppercase font-black tracking-widest shadow-lg cursor-pointer transition-all hover:bg-red-900/40 ${pendingHint === `${missingRegion} Pass` ? 'border-yellow-500/80 animate-pulse' : 'border-red-500/30'}`}
                                        title={pendingHint === `${missingRegion} Pass` ? 'Click again to hint this item' : `Click to hint ${missingRegion} Pass`}
                                    >
                                        {pendingHint === `${missingRegion} Pass` ? `Hint ${missingRegion} Pass?` : `${missingRegion} Pass`}
                                    </span>
                                )}
                                {missingTypes && missingTypes.map((t: string) => {
                                    const itemName = `${t} Type Key`;
                                    return (
                                        <span
                                            key={t}
                                            onClick={() => handleHintClick(itemName)}
                                            className={`px-3 py-1 bg-red-950/60 border rounded-lg text-[10px] text-red-200 uppercase font-black tracking-widest shadow-lg cursor-pointer transition-all hover:bg-red-900/40 ${pendingHint === itemName ? 'border-yellow-500/80 animate-pulse' : 'border-red-500/30'}`}
                                            title={pendingHint === itemName ? 'Click again to hint this item' : `Click to hint ${itemName}`}
                                        >
                                            {pendingHint === itemName ? `Hint ${t} Key?` : `${t} Unlock`}
                                        </span>
                                    );
                                })}
                                {missingPokemon && (missingRegion ? null : (
                                    <span className="px-3 py-1 bg-red-950/60 border border-red-500/30 rounded-lg text-[10px] text-red-200 uppercase font-black tracking-widest shadow-lg">
                                        Pokémon Item
                                    </span>
                                ))}
                                {reasons && reasons.map((r: string, i: number) => {
                                    const itemName = r;
                                    return (
                                        <span
                                            key={i}
                                            onClick={() => handleHintClick(itemName)}
                                            className={`px-3 py-1 bg-red-950/60 border rounded-lg text-[10px] text-red-200 uppercase font-black tracking-widest shadow-lg cursor-pointer transition-all hover:bg-red-900/40 ${pendingHint === itemName ? 'border-yellow-500/80 animate-pulse' : 'border-red-500/30'}`}
                                            title={pendingHint === itemName ? 'Click again to hint this item' : `Click to hint ${itemName}`}
                                        >
                                            {pendingHint === itemName ? `Hint ${r}?` : r}
                                        </span>
                                    );
                                })}
                                {!missingRegion && !missingTypes && !missingPokemon && !missingRouteKeys && !missingLineUnlock && !badgeLevelRequired && !reasons && reason && (
                                    <span className="px-3 py-1 bg-red-950/60 border border-red-500/30 rounded-lg text-[10px] text-red-200 uppercase font-black tracking-widest shadow-lg">
                                        {reason}
                                    </span>
                                )}
                            </div>
                            {/* Route Lock */}
                            {missingRouteKeys && missingRouteKeys.length > 0 && (
                                <div className="flex items-center gap-2 text-xs">
                                    <MapPin size={14} className="text-orange-400 shrink-0" />
                                    <span className="text-orange-300/90">
                                        Route: Need one of:{' '}
                                        {missingRouteKeys.length <= 3
                                            ? missingRouteKeys.join(', ')
                                            : `${missingRouteKeys.slice(0, 2).join(', ')} +${missingRouteKeys.length - 2} more`}
                                    </span>
                                </div>
                            )}
                            {/* Line Lock */}
                            {missingLineUnlock && (
                                <div className="flex items-center gap-2 text-xs">
                                    <Link size={14} className="text-orange-400 shrink-0" />
                                    <span className="text-orange-300/90">
                                        Family: Need {missingLineUnlock}
                                    </span>
                                </div>
                            )}
                            {/* Badge Level */}
                            {badgeLevelRequired && (
                                <div className="flex items-center gap-2 text-xs">
                                    <Shield size={14} className="text-orange-400 shrink-0" />
                                    <span className="text-orange-300/90">
                                        Badges: {gymBadges}/{badgeLevelRequired}
                                    </span>
                                </div>
                            )}
                            {pendingHint && (
                                <p className="text-[9px] text-yellow-400/70 italic">Click the highlighted badge again to send the hint request.</p>
                            )}
                        </div>
                    )}

                    {/* AP Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase text-gray-600 tracking-widest border-b border-gray-800 pb-2">
                            <span>Archipelago Data</span>
                        </div>

                        {isChecked && (
                            <div className="bg-green-900/10 border border-green-500/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in duration-500">
                                <CheckCircle2 size={18} className="text-green-500 mt-0.5" />
                                <div>
                                    <span className="text-[10px] text-green-500 font-bold uppercase block">Obtained</span>
                                    {scoutedItem ? (
                                        <>
                                            <p className="text-sm text-white font-medium">
                                                {scoutedItem.itemName}
                                                {scoutedItem.playerName !== 'Appiepelago' && scoutedItem.playerName !== 'Player1' && scoutedItem.playerName !== 'Archipelago' && (
                                                    <span className="text-gray-400 font-normal"> for {scoutedItem.playerName}</span>
                                                )}
                                            </p>
                                            <p className="text-[10px] text-green-500/80 mt-0.5">at {unlockLocationName}</p>
                                        </>
                                    ) : (
                                        <p className="text-sm text-white font-medium">Unlocks: {unlockLocationName}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {isHinted && !isChecked && (
                            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-4 flex items-start gap-3">
                                <MapPin size={18} className="text-indigo-400 mt-0.5" />
                                <div>
                                    <span className="text-[10px] text-indigo-400 font-bold uppercase block">Hint Location</span>
                                    <p className="text-sm text-white font-medium">Location found!</p>
                                    <p className="text-[10px] text-indigo-300/60 italic">Check your Archipelago Log for details.</p>
                                </div>
                            </div>
                        )}


                        {isUnlocked && !isChecked && (
                            <div className={`bg-blue-900/10 border border-blue-500/20 rounded-xl p-4 flex items-middle gap-3 ${!canGuess ? 'opacity-50 grayscale' : ''}`}>
                                <HelpCircle size={18} className="text-blue-400" />
                                <span className="text-xs text-blue-300/80 font-medium whitespace-pre-line">
                                    {canGuess ? "Available to guess in the grid!" : reason}
                                </span>
                            </div>
                        )}

                        {/* Special Items Section */}
                        {!isChecked && (
                            <div className="pt-2">
                                <div className="flex items-center justify-between text-[10px] font-black uppercase text-gray-600 tracking-widest border-b border-gray-800 pb-2 mb-4">
                                    <span>Utility Items</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {/* Pokegear */}
                                    <button
                                        onClick={() => handleUseItem('gear')}
                                        disabled={pokegears === 0 || isPokegeared || !!itemCooldown}
                                        className={`
                                            group relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all
                                            ${isPokegeared
                                                ? 'bg-indigo-900/30 border-indigo-500/50 scale-105 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                                : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-700/50 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:hover:bg-gray-800/40'}
                                        `}
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-gray-200 text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-700 z-50">
                                            Reveals the first letter of this Pokemon's name
                                        </div>
                                        <div className="w-10 h-10 flex items-center justify-center mb-1">
                                            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-radar.png" style={{ imageRendering: 'pixelated' }} className={`w-8 h-8 object-contain transition-opacity duration-200 ${gearSpriteLoaded ? 'opacity-100' : 'opacity-0'}`} alt="Poke Radar" onLoad={() => setGearSpriteLoaded(true)} />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-tighter text-gray-300">Gear</span>
                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-600 rounded-full border-2 border-gray-900 flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                                            {pokegears}
                                        </div>
                                    </button>

                                    {/* Pokedex */}
                                    <button
                                        onClick={() => handleUseItem('dex')}
                                        disabled={pokedexes === 0 || isPokedexed || !!itemCooldown}
                                        className={`
                                            group relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all
                                            ${isPokedexed
                                                ? 'bg-blue-900/30 border-blue-500/50 scale-105 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                                : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-700/50 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:hover:bg-gray-800/40'}
                                        `}
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-gray-200 text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-700 z-50">
                                            Reveals silhouette, types, and generation
                                        </div>
                                        <div className="w-10 h-10 flex items-center justify-center mb-1">
                                            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ss-ticket.png" style={{ imageRendering: 'pixelated' }} className={`w-8 h-8 object-contain transition-opacity duration-200 ${pokedexSpriteLoaded ? 'opacity-100' : 'opacity-0'}`} alt="SS Ticket" onLoad={() => setPokedexSpriteLoaded(true)} />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-tighter text-gray-300">Dex</span>
                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full border-2 border-gray-900 flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                                            {pokedexes}
                                        </div>
                                    </button>

                                    {/* Master Ball */}
                                    <button
                                        onClick={() => handleUseItem('master')}
                                        disabled={masterBalls === 0 || !!itemCooldown || (!masterBallBypassGates && !canGuess)}
                                        className="group relative flex flex-col items-center justify-center p-3 rounded-2xl border bg-gray-800/40 border-gray-700/50 hover:bg-red-900/20 hover:border-red-500/40 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:hover:bg-gray-800/40 transition-all"
                                    >
                                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-gray-200 text-[9px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-700 z-50">
                                            Instantly reveals this Pokemon without guessing
                                        </div>
                                        <div className="w-10 h-10 flex items-center justify-center mb-1">
                                            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/master-ball.png" style={{ imageRendering: 'pixelated' }} className={`w-8 h-8 object-contain transition-opacity duration-200 ${masterBallSpriteLoaded ? 'opacity-100' : 'opacity-0'}`} alt="Master Ball" onLoad={() => setMasterBallSpriteLoaded(true)} />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-tighter text-gray-300">Reveal</span>
                                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full border-2 border-gray-900 flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                                            {masterBalls}
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Guess Credit */}
                    {isChecked && selectedPokemonId && getCredit(selectedPokemonId) && (
                        <div className="flex items-center justify-center gap-1.5 text-[10px] text-purple-400/70 animate-in fade-in duration-500">
                            <User size={10} />
                            <span>
                                Guessed by{' '}
                                <span className="font-bold text-purple-400">
                                    {getCredit(selectedPokemonId) === 'You' ? 'You' : `@${getCredit(selectedPokemonId)}`}
                                </span>
                            </span>
                        </div>
                    )}

                    {/* Derpemon Creator Credit */}
                    {derpemonCreator && (isUnlocked || isChecked) && (
                        <div className="flex items-center justify-center gap-1.5 text-[10px] text-purple-400/70 animate-in fade-in duration-500">
                            <Palette size={10} />
                            <span>
                                Sprite by{' '}
                                <span className="font-bold text-purple-400">{derpemonCreator}</span>
                                {' • '}
                                <a
                                    href="https://github.com/TheShadowOfLight/DerpemonCommunityProject"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-500 hover:underline"
                                >
                                    Derpemon Community Project ↗
                                </a>
                            </span>
                        </div>
                    )}

                    {showInfo && (
                        <div className="flex justify-center text-[10px]">
                            <a
                                href={`https://pokemondb.net/pokedex/${pokemon.name}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-500 hover:text-blue-400 flex items-center gap-1 transition-colors capitalize font-bold tracking-widest"
                            >
                                <ExternalLink size={10} />
                                View on PokemonDB
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
