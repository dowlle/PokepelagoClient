import React from 'react';
import type { PokemonRef } from '../types/pokemon';
import { useGame } from '../context/GameContext';
import { getCleanName } from '../utils/pokemon';
import pokemonMetadata from '../data/pokemon_metadata.json';
import pokemonNamesJson from '../data/pokemon_names.json';
import { TYPE_COLORS } from '../utils/typeColors';
import { PmdSpriteCanvas } from './PmdSpriteCanvas';
import { normalizePmdBaseUrl } from '../services/pmdSpriteService';

interface PokemonSlotProps {
    pokemon: PokemonRef;
    status: 'locked' | 'unlocked' | 'checked' | 'shadow' | 'hint';
    isShiny?: boolean;
    order?: number;
}

const PokemonSlotImpl: React.FC<PokemonSlotProps> = ({ pokemon, status, isShiny = false, order }) => {
    const { setSelectedPokemonId, isPokemonGuessable, usedPokegears, getSpriteUrl, uiSettings, releasedIds, spriteRefreshCounter, pmdSpriteUrl, derpyfiedIds } = useGame();
    const { canGuess, reason } = isPokemonGuessable(pokemon.id);
    const isPokegeared = usedPokegears.has(pokemon.id);
    // Only slots whose own derpy state changes re-run the sprite-loading effect.
    // Previously `getSpriteUrl` was a dep that churned on every Derp trap, tearing
    // down every tile's sprite at once (BUG-03).
    const isDerpified = derpyfiedIds.has(pokemon.id);

    const [spriteUrl, setSpriteUrl] = React.useState<string | null>(null);
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const [hasHovered, setHasHovered] = React.useState(false);


    // PMD animated sprite state
    const normalizedPmdUrl = React.useMemo(
        () => pmdSpriteUrl ? normalizePmdBaseUrl(pmdSpriteUrl) : '',
        [pmdSpriteUrl]
    );
    const [playingAttack, setPlayingAttack] = React.useState(false);
    const [pmdError, setPmdError] = React.useState(false);
    const [idleFrameSize, setIdleFrameSize] = React.useState<number | null>(null);
    const prevStatusRef = React.useRef(status);

    // Trigger Attack animation when a Pokémon is first checked
    React.useEffect(() => {
        if (prevStatusRef.current !== 'checked' && status === 'checked' && normalizedPmdUrl) {
            setPlayingAttack(true);
            setPmdError(false);
        }
        prevStatusRef.current = status;
    }, [status, normalizedPmdUrl]);

    // Reset pmdError if the URL changes
    React.useEffect(() => {
        setPmdError(false);
        setPlayingAttack(false);
    }, [normalizedPmdUrl]);

    // Load sprite. Cleanup does NOT null spriteUrl -- the <img> keeps rendering
    // the old (possibly just-revoked) blob URL until the next effect resolves,
    // which eliminates the blank flash on every re-run.
    React.useEffect(() => {
        let active = true;
        let createdUrl: string | null = null;
        const loadSprite = async () => {
            if (!uiSettings.enableSprites) {
                if (active) {
                    setSpriteUrl(null);
                    setHasError(true);
                }
                return;
            }

            const url = await getSpriteUrl(pokemon.id, { shiny: isShiny });
            if (active) {
                createdUrl = url;
                setSpriteUrl(url);
                if (!url) setHasError(true);
            } else if (url && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        };
        loadSprite();
        return () => {
            active = false;
            if (createdUrl && createdUrl.startsWith('blob:')) URL.revokeObjectURL(createdUrl);
        };
    }, [pokemon.id, isShiny, getSpriteUrl, uiSettings.enableSprites, spriteRefreshCounter, isDerpified]);

    // Reset load state when url changes
    React.useEffect(() => {
        setIsLoaded(false);
        setHasError(false);
    }, [spriteUrl]);

    const isChecked = status === 'checked';
    const isVisible = isChecked || status === 'shadow' || status === 'hint';
    const lang = localStorage.getItem('pokepelago_language') ?? 'en';
    const langNames = (pokemonNamesJson as Record<string, Record<string, string>>)[pokemon.id.toString()];
    const localName = lang !== 'global' && langNames?.[lang];
    const cleanName = localName || getCleanName(pokemon.name);

    const isReadyToGuess = !isChecked && canGuess;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawTypes: string[] = (pokemonMetadata as any)[pokemon.id]?.types ?? [];
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const typeDotStyle: React.CSSProperties = (() => {
        if (!uiSettings.typeDot) return { backgroundColor: '#4ade80', boxShadow: '0 0 4px #4ade80aa' };
        const typeColor1 = TYPE_COLORS[capitalize(rawTypes[0])] ?? '#4ade80';
        const typeColor2 = rawTypes[1] ? (TYPE_COLORS[capitalize(rawTypes[1])] ?? typeColor1) : typeColor1;
        return rawTypes.length >= 2
            ? { background: `linear-gradient(135deg, ${typeColor1} 50%, ${typeColor2} 50%)`, boxShadow: `0 0 4px ${typeColor1}aa` }
            : { backgroundColor: typeColor1, boxShadow: `0 0 4px ${typeColor1}aa` };
    })();

    const getBorderClass = () => {
        if (releasedIds.has(pokemon.id)) return 'bg-blue-950/30 border-blue-800/30 opacity-40';
        if (isChecked) return 'bg-green-900/40 border-green-700/60';
        if (isReadyToGuess) return 'bg-emerald-950/80 border-green-500/70 shadow-[0_0_8px_rgba(34,197,94,0.35)]';
        if (status === 'shadow') return 'bg-blue-950/30 border-blue-800/30 opacity-40';
        if (status === 'unlocked') return 'bg-gray-900/40 border-gray-700/40 opacity-35 grayscale';
        if (status === 'hint') return 'bg-indigo-950/40 border-indigo-900/40 opacity-60';
        return 'bg-gray-800/60 border-gray-700/30'; // locked
    };

    // FEAT-10: slot + sprite size is driven by uiSettings.spriteSize (1x / 2x / 4x).
    // Base = 44px (original w-11). Users with complaints about sprites being too small
    // can bump this. Text overlays (dex #, shiny sparkle) stay at their intrinsic size
    // so they remain legible at the corner of the larger slot without dominating it.
    const slotPx = 44 * uiSettings.spriteSize;

    return (
        <div
            onClick={() => setSelectedPokemonId(pokemon.id)}
            onMouseEnter={() => {
                if (!uiSettings.persistentDot && isReadyToGuess && !hasHovered) setHasHovered(true);
            }}
            className={`
                flex items-center justify-center transition-all duration-300 relative group cursor-pointer
                border
                ${getBorderClass()}
                ${isReadyToGuess ? 'hover:scale-110 hover:shadow-[0_0_14px_rgba(34,197,94,0.6)] active:scale-95' : 'hover:scale-105 active:scale-95'}
                ${isShiny && isChecked ? 'shadow-[0_0_10px_rgba(255,215,0,0.4)]' : ''}
            `}
            style={{ width: slotPx, height: slotPx, borderRadius: 'var(--pp-slot-radius)', ...(order !== undefined ? { order } : {}) }}
            title={!canGuess ? reason : (isChecked ? cleanName : status === 'hint' ? `${cleanName} (Hinted)` : `#${pokemon.id}`)}
        >
            {isVisible && normalizedPmdUrl && !pmdError && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
                    <PmdSpriteCanvas
                        id={pokemon.id}
                        baseUrl={normalizedPmdUrl}
                        anim={playingAttack ? 'Attack' : 'Idle'}
                        onAnimComplete={() => setPlayingAttack(false)}
                        onError={() => { setPmdError(true); setPlayingAttack(false); }}
                        onFrameSize={playingAttack ? undefined : setIdleFrameSize}
                        referenceFrameSize={playingAttack && idleFrameSize ? idleFrameSize : undefined}
                        filterClass={
                            status === 'shadow' || status === 'hint' || releasedIds.has(pokemon.id)
                                ? (isPokegeared ? 'brightness-50 opacity-80' : 'brightness-0 contrast-100 opacity-60')
                                : ''
                        }
                        size={slotPx}
                    />
                </div>
            )}

            {isVisible && !normalizedPmdUrl && !hasError && spriteUrl && (
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
                    <img
                        src={spriteUrl}
                        alt={isChecked ? pokemon.name : `Pokemon #${pokemon.id}`}
                        onLoad={() => setIsLoaded(true)}
                        onError={() => setHasError(true)}
                        className={`
                            object-contain z-10 transition-all duration-300
                            ${isLoaded ? 'opacity-100' : 'opacity-0'}
                            ${status === 'shadow' || status === 'hint' || releasedIds.has(pokemon.id)
                                ? (isPokegeared ? 'brightness-50 opacity-80' : 'brightness-0 contrast-100 opacity-60')
                                : ''}
                        `}
                        style={{ imageRendering: 'pixelated', width: slotPx, height: slotPx }}
                    />
                </div>
            )}

            {uiSettings.showDexNumbers && (() => {
                const hasSpriteContent = isVisible && ((uiSettings.enableSprites && spriteUrl && !hasError) || (normalizedPmdUrl && !pmdError));
                const showLarge = !hasSpriteContent;
                return showLarge ? (
                    <span className="text-gray-500/80 font-mono font-bold z-10 pointer-events-none" style={{ fontSize: 11 * uiSettings.spriteSize }}>
                        #{pokemon.id}
                    </span>
                ) : (
                    <span className="absolute bottom-0.5 left-0.5 text-gray-500/60 font-mono z-10 pointer-events-none" style={{ fontSize: 10 * uiSettings.spriteSize }}>
                        #{pokemon.id}
                    </span>
                );
            })()}

            {/* Shiny sparkle indicator */}
            {isShiny && isChecked && (
                <div className="absolute top-0.5 right-0.5 z-20 animate-pulse">
                    <span className="leading-none drop-shadow-[0_0_2px_rgba(255,215,0,0.8)]" style={{ fontSize: 10 * uiSettings.spriteSize }}>✨</span>
                </div>
            )}

            {/* Guessable indicator — type-colored dot; persistent or notification-style */}
            {isReadyToGuess && (uiSettings.persistentDot || !hasHovered) && (
                <div className="absolute top-0.5 right-0.5 z-20 transition-opacity duration-300" title={rawTypes.map(capitalize).join(' / ')}>
                    <span className="block rounded-full" style={{ ...typeDotStyle, width: 6 * uiSettings.spriteSize, height: 6 * uiSettings.spriteSize }} />
                </div>
            )}

            {status === 'unlocked' && (
                <span className="text-yellow-700 font-bold opacity-40" style={{ fontSize: 18 * uiSettings.spriteSize }}>?</span>
            )}

            {status === 'locked' && (
                <span className="text-gray-700" style={{ fontSize: 10 * uiSettings.spriteSize }}>●</span>
            )}

            {/* Tooltip */}
            {isChecked && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none border border-gray-700 shadow-xl">
                    {cleanName}
                </div>
            )}
        </div>
    );
};

// PERF-01: memoize so identical-prop slots skip re-renders driven purely by parent
// (DexGrid local state: filter toggles, shuffle order, etc.). Note: useGame() inside
// the component still causes context-driven re-renders regardless of memo. Full win
// is gated on PERF-02 (context split). PokemonSlot receives only stable props from
// DexGrid — `pokemon` is memoized via pokemonById, `status`/`isShiny`/`order` are
// primitives — so the default shallow comparator is correct here.
export const PokemonSlot = React.memo(PokemonSlotImpl);
