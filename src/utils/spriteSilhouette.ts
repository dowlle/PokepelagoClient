/**
 * Silhouette / reveal treatment shared by the dex grid (PokemonSlot) and the
 * Pokemon details window (PokemonDetails).
 *
 * A Pokemon that has not been guessed yet is drawn as a silhouette. Spending a
 * Pokegear on it keeps the sprite's colours but dims them (so the "I paid to
 * peek" signal reads differently from a default black silhouette); spending a
 * Pokedex on it gives the plain black silhouette. The optional Silhouette Glow
 * setting adds a themed halo to the black variant.
 *
 * Both surfaces must render the same treatment. The grid applies it as an
 * inline style, which is what lets it survive alongside the sprite fade-in;
 * the details window previously used Tailwind opacity classes and the loading
 * `opacity-100` won the cascade, so the dimming never showed for gifs.
 */
export interface SilhouetteAppearance {
    filter?: string;
    opacity?: number;
}

export const SILHOUETTE_OPACITY = 0.85;
export const POKEGEAR_SILHOUETTE_OPACITY = 0.8;

export function getSilhouetteAppearance(
    isSilhouette: boolean,
    isPokegeared: boolean,
    silhouetteGlow: boolean,
): SilhouetteAppearance {
    if (!isSilhouette) return {};
    if (isPokegeared) {
        return { filter: 'brightness(0.5)', opacity: POKEGEAR_SILHOUETTE_OPACITY };
    }
    return {
        filter: silhouetteGlow
            ? 'brightness(0) drop-shadow(0 0 2px var(--pp-silhouette-glow))'
            : 'brightness(0)',
        opacity: SILHOUETTE_OPACITY,
    };
}
