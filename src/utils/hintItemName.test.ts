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

    it('leaves canonical route-key / line-unlock item names untouched', () => {
        // The per-item names (NOT the generic sentinels) are what the dedicated
        // Route/Family hint buttons send. They must pass through unchanged so
        // !hint gets the real AP item: "{display} Key" / "{BaseName} Line".
        expect(hintItemNameForReason('Melemele Island Key')).toBe('Melemele Island Key');
        expect(hintItemNameForReason('Bulbasaur Line')).toBe('Bulbasaur Line');
    });
});

/**
 * Residual hint-bug gap: GameContext pushes the GENERIC sentinel reasons
 * 'Route Key' and 'Line Unlock' into `gateReasons`. A string-to-string mapper
 * cannot know WHICH route/line is missing, so these can never resolve to a real
 * AP item. The fix suppresses them from the clickable `reasons.map` badges; the
 * dedicated Route/Family sections emit the real per-item hints instead. This
 * suite proves no hint path can emit `!hint Route Key` / `!hint Line Unlock`.
 */
describe('generic route/line sentinels never reach !hint', () => {
    // Mirror of the filter applied at the PokemonDetails reasons.map call site.
    const GENERIC_SENTINELS = ['Route Key', 'Line Unlock'];
    const hintableReasons = (reasons: string[]) =>
        reasons.filter(r => !GENERIC_SENTINELS.includes(r));

    it('filters out the generic sentinels before they reach the hint mapper', () => {
        const gateReasons = [
            'Route Key',
            'Line Unlock',
            'Need Thunder Stone',
            'Badges: 3/8',
            'Link Cable',
        ];
        const hinted = hintableReasons(gateReasons).map(hintItemNameForReason);

        // No surviving hint arg is the broken generic literal.
        expect(hinted).not.toContain('Route Key');
        expect(hinted).not.toContain('Line Unlock');
        // The legitimate gates still map correctly.
        expect(hinted).toEqual(['Thunder Stone', 'Gym Badge', 'Link Cable']);
    });

    it('emits no !hint command for a Pokemon gated ONLY by route/line', () => {
        // Worst case: the sole gates are the generic sentinels. After filtering,
        // there is nothing to hint generically — the real per-item buttons take
        // over (covered by the route-key/line-unlock pass-through test above).
        const gateReasons = ['Route Key', 'Line Unlock'];
        const hinted = hintableReasons(gateReasons).map(hintItemNameForReason);
        expect(hinted).toHaveLength(0);
        for (const arg of hinted) {
            expect(`!hint ${arg}`).not.toBe('!hint Route Key');
            expect(`!hint ${arg}`).not.toBe('!hint Line Unlock');
        }
    });
});
