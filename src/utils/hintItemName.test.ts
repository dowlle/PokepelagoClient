/**
 * Regression test for the hint-arg bug (Point 4): clicking a gate badge in the
 * "Missing Requirements" panel sent the human-readable *reason* string to
 * `!hint` instead of the canonical Archipelago item name, so the server got
 * e.g. `!hint Need Thunder Stone` (matches no item). `hintItemNameForReason`
 * normalizes the `gateReasons` strings from GameContext to the canonical names
 * defined in the APWorld's `worlds/pokepelago/Items.py`.
 */
import { describe, it, expect } from 'vitest';
import { hintItemNameForReason } from './hintItemName';

describe('hintItemNameForReason', () => {
    it('strips the "Need ..." prefix from every evo-stone gate reason', () => {
        const stones = [
            'Fire Stone', 'Water Stone', 'Thunder Stone', 'Leaf Stone',
            'Moon Stone', 'Sun Stone', 'Shiny Stone', 'Dusk Stone',
            'Dawn Stone', 'Ice Stone',
        ];
        for (const stone of stones) {
            // GameContext builds "Need ${Stone} Stone" (GameContext.tsx:943)
            expect(hintItemNameForReason(`Need ${stone}`)).toBe(stone);
        }
    });

    it('confirmed repro: "Need Thunder Stone" -> "Thunder Stone"', () => {
        expect(hintItemNameForReason('Need Thunder Stone')).toBe('Thunder Stone');
    });

    it('maps the progressive badge gate to its base item name', () => {
        expect(hintItemNameForReason('Badges: 3/8')).toBe('Gym Badge');
        expect(hintItemNameForReason('Badges: 0/6')).toBe('Gym Badge');
    });

    it('maps the progressive daycare gate to its base item name', () => {
        expect(hintItemNameForReason('Daycare: 1/2')).toBe('Daycare');
        expect(hintItemNameForReason('Daycare: 0/3')).toBe('Daycare');
    });

    it('passes already-canonical gate item names through unchanged', () => {
        for (const name of ['Link Cable', 'Fossil Restorer', 'Ultra Wormhole', 'Time Rift']) {
            expect(hintItemNameForReason(name)).toBe(name);
        }
    });

    it('does not mangle other canonical item-name shapes', () => {
        // Region passes / type keys / route keys are passed canonical at their
        // call sites; the mapper must be a no-op for them.
        expect(hintItemNameForReason('Kanto Pass')).toBe('Kanto Pass');
        expect(hintItemNameForReason('Fire Type Key')).toBe('Fire Type Key');
        expect(hintItemNameForReason('Master Ball')).toBe('Master Ball');
    });
});
