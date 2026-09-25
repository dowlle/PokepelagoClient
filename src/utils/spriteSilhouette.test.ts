/**
 * FEAT-04: the details-window gif must show the same silhouette / gear reveal
 * treatment as the dex grid. The treatment used to live inline in
 * PokemonSlot; it is now shared (utils/spriteSilhouette.ts) so both surfaces
 * map the same states the same way.
 */
import { describe, it, expect } from 'vitest';
import {
    getSilhouetteAppearance,
    SILHOUETTE_OPACITY,
    POKEGEAR_SILHOUETTE_OPACITY,
} from './spriteSilhouette';

describe('getSilhouetteAppearance', () => {
    it('leaves a guessed (revealed) sprite untouched', () => {
        expect(getSilhouetteAppearance(false, false, false)).toEqual({});
        // A Pokegear reveal on an already-guessed Pokemon is also full colour.
        expect(getSilhouetteAppearance(false, true, true)).toEqual({});
    });

    it('renders a plain black silhouette for an unguessed Pokemon', () => {
        expect(getSilhouetteAppearance(true, false, false)).toEqual({
            filter: 'brightness(0)',
            opacity: SILHOUETTE_OPACITY,
        });
    });

    it('adds the themed glow to the black silhouette when enabled', () => {
        expect(getSilhouetteAppearance(true, false, true)).toEqual({
            filter: 'brightness(0) drop-shadow(0 0 2px var(--pp-silhouette-glow))',
            opacity: SILHOUETTE_OPACITY,
        });
    });

    it('keeps the colours but dims them for a Pokegear-revealed Pokemon', () => {
        expect(getSilhouetteAppearance(true, true, false)).toEqual({
            filter: 'brightness(0.5)',
            opacity: POKEGEAR_SILHOUETTE_OPACITY,
        });
        // Silhouette Glow is for the black variant only; a gear reveal ignores it.
        expect(getSilhouetteAppearance(true, true, true)).toEqual({
            filter: 'brightness(0.5)',
            opacity: POKEGEAR_SILHOUETTE_OPACITY,
        });
    });

    it('maps the Pokedex reveal (not Pokegear) to the black silhouette', () => {
        // A Pokedex reveal is modelled by isPokegeared=false: the grid forces
        // the shadow but gives it the plain black treatment.
        expect(getSilhouetteAppearance(true, false, false).filter).toBe('brightness(0)');
    });
});
