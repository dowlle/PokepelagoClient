import React from 'react';
import type { PokemonRef } from '../types/pokemon';
import { useGame } from '../context/GameContext';
import { getCleanName } from '../utils/pokemon';

interface PokemonSlotProps {
    pokemon: PokemonRef;
    status: 'locked' | 'unlocked' | 'checked' | 'shadow' | 'hint';
    isShiny?: boolean;
}

export const PokemonSlot: React.FC<PokemonSlotProps> = ({ pokemon, status, isShiny = false }) => {
    const { setSelectedPokemonId, isPokemonGuessable, usedPokegears, getSpriteUrl, uiSettings, gameMode } = useGame();
    const { canGuess, reason } = isPokemonGuessable(pokemon.id);
    const isPokegeared = usedPokegears.has(pokemon.id);

    const [spriteUrl, setSpriteUrl] = React.useState<string | null>(null);
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const [hasHovered, setHasHovered] = React.useState(false);

    // Load sprite from local storage
    React.useEffect(() => {
        let active = true;
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
                setSpriteUrl(url);
                if (!url) setHasError(true);
            }
        };
        loadSprite();
        return () => { active = false; };
    }, [pokemon.id, isShiny, getSpriteUrl, uiSettings.enableSprites]);

    // Reset load state when url changes
    React.useEffect(() => {
        setIsLoaded(false);
        setHasError(false);
    }, [spriteUrl]);

    const isChecked = status === 'checked';
    const isVisible = isChecked || status === 'shadow' || status === 'hint';
    const cleanName = getCleanName(pokemon.name);

    const isReadyToGuess = !isChecked && canGuess && status === 'shadow' && gameMode !== 'standalone';

    const getBorderClass = () => {
        if (isChecked) return 'bg-green-900/40 border-green-700/60';
        if (isReadyToGuess) return 'bg-emerald-950/80 border-green-500/70 shadow-[0_0_8px_rgba(34,197,94,0.35)]';
        if (status === 'shadow') return 'bg-blue-950/30 border-blue-800/30 opacity-40';
        if (status === 'unlocked') return 'bg-gray-900/40 border-gray-700/40 opacity-35 grayscale';
        if (status === 'hint') return 'bg-indigo-950/40 border-indigo-900/40 opacity-60';
        return 'bg-gray-800/60 border-gray-700/30'; // locked
    };

    return (
        <div
            onClick={() => setSelectedPokemonId(pokemon.id)}
            onMouseEnter={() => {
                if (isReadyToGuess && !hasHovered) setHasHovered(true);
            }}
            className={`
                w-11 h-11 rounded-md flex items-center justify-center transition-all duration-300 relative group cursor-pointer
                border
                ${getBorderClass()}
                ${isReadyToGuess ? 'hover:scale-110 hover:shadow-[0_0_14px_rgba(34,197,94,0.6)] active:scale-95' : 'hover:scale-105 active:scale-95'}
                ${isShiny && isChecked ? 'shadow-[0_0_10px_rgba(255,215,0,0.4)]' : ''}
            `}
            title={!canGuess ? reason : (isChecked ? cleanName : status === 'hint' ? `${cleanName} (Hinted)` : `#${pokemon.id}`)}
        >
            {isVisible && !hasError && spriteUrl && (
                <div className="absolute inset-0 flex items-center justify-center overflow-visible pointer-events-none">
                    <img
                        src={spriteUrl}
                        alt={pokemon.name}
                        onLoad={() => setIsLoaded(true)}
                        onError={() => setHasError(true)}
                        className={`
                            w-12 h-12 object-contain z-10 scale-[1.1] transition-all duration-300
                            ${isLoaded ? 'opacity-100' : 'opacity-0'}
                            ${status === 'shadow' || status === 'hint'
                                ? (isPokegeared ? 'brightness-50 opacity-80' : 'brightness-0 contrast-100 opacity-60')
                                : ''}
                        `}
                        style={{ imageRendering: 'pixelated' }}
                    />
                </div>
            )}

            {(hasError || (isVisible && !isLoaded)) && (
                <span className="text-[10px] text-gray-600 font-mono z-0">
                    #{pokemon.id}
                </span>
            )}

            {/* Shiny sparkle indicator */}
            {isShiny && isChecked && (
                <div className="absolute top-0.5 right-0.5 z-20 animate-pulse">
                    <span className="text-[10px] leading-none drop-shadow-[0_0_2px_rgba(255,215,0,0.8)]">✨</span>
                </div>
            )}

            {/* Guessable indicator — green dot in corner, hides PERMANENTLY after hover */}
            {isReadyToGuess && !hasHovered && (
                <div className="absolute top-0.5 right-0.5 z-20 transition-opacity duration-300">
                    <span className="block w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]" />
                </div>
            )}

            {status === 'unlocked' && (
                <span className="text-yellow-700 text-lg font-bold opacity-40">?</span>
            )}

            {status === 'locked' && (
                <span className="text-gray-700 text-[8px]">●</span>
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
