/**
 * Regression tests for BUG-12 and the class of "APWorld ID layout ↔ client
 * decoder drift" bugs. These assertions run in CI on every PR so a drift
 * like the one that produced BUG-12 (two call sites independently computing
 * the same ID → name mapping, one going wrong) gets caught before shipping.
 *
 * The test feeds synthetic item IDs — constructed by replicating APWorld's
 * `worlds/pokepelago/Items.py` assignment formula in-test — through the
 * decoders in `itemDecoding.ts` and asserts the round-trip is lossless.
 * Because `GameContext.onConnected` and `GameContext.onItemsReceived` both
 * call into these helpers (post-refactor), correctness here implies both
 * real runtime paths are correct.
 */
import { describe, it, expect } from 'vitest';
import rawRouteData from './route_data.json';
import {
    decodeRouteKey,
    decodeLineUnlock,
    decodeTypeKey,
    decodeRegionPass,
    TYPE_NAMES_ORDERED,
    REGION_NAMES_ORDERED,
    type ItemOffsets,
} from './itemDecoding';

// Mirror of src/hooks/useOffsets.ts:NEW_OFFSETS for the relevant fields.
// Kept inline so the test doesn't import from React code.
const OFFSETS: ItemOffsets = {
    ITEM_OFFSET: 8574000,
    TYPE_ITEM_OFFSET: 2000,
    REGION_PASS_OFFSET: 5000,
    ROUTE_KEY_OFFSET: 7000,
    LINE_UNLOCK_OFFSET: 9000,
};

/** Replicate the APWorld's two-phase route-key ordering from Items.py:81.
 *  Groups (no `roaming-` or `virtual-` prefix) come first alphabetically,
 *  then ungrouped routes, also alphabetically. Any drift of this heuristic
 *  vs the real APWorld ordering will fail the full-coverage test below. */
function buildApWorldRouteKeyOrder(): string[] {
    const all = Object.keys(rawRouteData.routeKeyItems);
    const isUngrouped = (k: string) => k.startsWith('roaming-') || k.startsWith('virtual-');
    const groups = all.filter(k => !isUngrouped(k)).sort();
    const ungrouped = all.filter(isUngrouped).sort();
    return [...groups, ...ungrouped];
}

describe('decodeRouteKey', () => {
    const apOrder = buildApWorldRouteKeyOrder();

    it('decodes every route-key ID round-trip vs APWorld reference order', () => {
        expect(apOrder.length).toBe(80);
        for (let i = 0; i < apOrder.length; i++) {
            const itemId = OFFSETS.ITEM_OFFSET + OFFSETS.ROUTE_KEY_OFFSET + i;
            const expectedName = (rawRouteData.routeKeyItems as Record<string, string>)[apOrder[i]];
            expect(decodeRouteKey(itemId, OFFSETS), `index ${i} (${apOrder[i]})`).toBe(expectedName);
        }
    });

    // BUG-12 explicit regression guard. These 16 indexes are the ones where
    // the pre-fix flat sort decoded to the wrong item name (APWorld still
    // placed them correctly; only the client's lookup was off). Values come
    // from generating the reference order via `worlds/pokepelago/Items.py`
    // at commit 6d85e9f's parent — locked here so any regression names them.
    it.each([
        [44, 'Sinnoh Early Routes Key'],
        [45, 'Sinnoh Late Routes Key'],
        [46, 'Sinnoh Mid Routes Key'],
        [47, 'Sinnoh Post-Game Routes Key'],
        [48, 'Sinnoh Sea & Island Routes Key'],
        [49, 'Sinnoh Wilds Key'],
        [50, 'Unova Early Routes Key'],
        [51, 'Unova Late Routes Key'],
        [52, 'Unova Mid Routes Key'],
        [53, 'Unova Post-Game Routes Key'],
        [54, 'Unova Wilds Key'],
        [55, 'Roaming Hoenn Area Key'],
        [56, 'Roaming Johto Area Key'],
        [57, 'Roaming Kalos Area Key'],
        [58, 'Roaming Kanto Area Key'],
        [59, 'Roaming Sinnoh Area Key'],
    ])('BUG-12 regression: index %i decodes to %s', (index, expectedName) => {
        const itemId = OFFSETS.ITEM_OFFSET + OFFSETS.ROUTE_KEY_OFFSET + (index as number);
        expect(decodeRouteKey(itemId, OFFSETS)).toBe(expectedName);
    });

    it('returns null for IDs outside the route-key range', () => {
        expect(decodeRouteKey(OFFSETS.ITEM_OFFSET + OFFSETS.ROUTE_KEY_OFFSET - 1, OFFSETS)).toBeNull();
        expect(decodeRouteKey(OFFSETS.ITEM_OFFSET + OFFSETS.ROUTE_KEY_OFFSET + 80, OFFSETS)).toBeNull();
        expect(decodeRouteKey(OFFSETS.ITEM_OFFSET, OFFSETS)).toBeNull();
    });
});

describe('decodeLineUnlock', () => {
    it('decodes every line-unlock ID via base_id offset', () => {
        const entries = Object.entries(rawRouteData.lineUnlockItems as Record<string, string>);
        expect(entries.length).toBeGreaterThan(0);
        for (const [baseIdStr, expectedName] of entries) {
            const itemId = OFFSETS.ITEM_OFFSET + OFFSETS.LINE_UNLOCK_OFFSET + Number(baseIdStr);
            expect(decodeLineUnlock(itemId, OFFSETS), `baseId ${baseIdStr}`).toBe(expectedName);
        }
    });

    it('returns null for IDs outside the line-unlock range', () => {
        expect(decodeLineUnlock(OFFSETS.ITEM_OFFSET + OFFSETS.LINE_UNLOCK_OFFSET, OFFSETS)).toBeNull();
        expect(decodeLineUnlock(OFFSETS.ITEM_OFFSET + OFFSETS.LINE_UNLOCK_OFFSET + 1026, OFFSETS)).toBeNull();
        expect(decodeLineUnlock(OFFSETS.ITEM_OFFSET, OFFSETS)).toBeNull();
    });
});

describe('decodeTypeKey', () => {
    it('decodes every Gen-1 type in the canonical order', () => {
        expect(TYPE_NAMES_ORDERED.length).toBe(18);
        TYPE_NAMES_ORDERED.forEach((typeName, i) => {
            const itemId = OFFSETS.ITEM_OFFSET + OFFSETS.TYPE_ITEM_OFFSET + i;
            expect(decodeTypeKey(itemId, OFFSETS)).toBe(typeName);
        });
    });

    it('returns null for IDs outside the type-key range', () => {
        expect(decodeTypeKey(OFFSETS.ITEM_OFFSET + OFFSETS.TYPE_ITEM_OFFSET - 1, OFFSETS)).toBeNull();
        expect(decodeTypeKey(OFFSETS.ITEM_OFFSET + OFFSETS.TYPE_ITEM_OFFSET + 18, OFFSETS)).toBeNull();
    });
});

describe('decodeRegionPass', () => {
    it('decodes every region in the canonical order', () => {
        expect(REGION_NAMES_ORDERED.length).toBe(10);
        REGION_NAMES_ORDERED.forEach((regionName, i) => {
            const itemId = OFFSETS.ITEM_OFFSET + OFFSETS.REGION_PASS_OFFSET + i;
            expect(decodeRegionPass(itemId, OFFSETS)).toBe(regionName);
        });
    });

    it('returns null for IDs outside the region-pass range', () => {
        expect(decodeRegionPass(OFFSETS.ITEM_OFFSET + OFFSETS.REGION_PASS_OFFSET - 1, OFFSETS)).toBeNull();
        expect(decodeRegionPass(OFFSETS.ITEM_OFFSET + OFFSETS.REGION_PASS_OFFSET + 10, OFFSETS)).toBeNull();
    });
});

describe('decoder isolation', () => {
    // A Sinnoh Mid Routes Key (item id 8581046) must decode ONLY as a route key,
    // not be accidentally claimed by any other decoder. This guards against a
    // future offset collision or a decoder with a too-wide range check.
    it('Sinnoh Mid Routes Key is unambiguous', () => {
        const sinnohMidId = OFFSETS.ITEM_OFFSET + OFFSETS.ROUTE_KEY_OFFSET + 46;
        expect(sinnohMidId).toBe(8581046);
        expect(decodeRouteKey(sinnohMidId, OFFSETS)).toBe('Sinnoh Mid Routes Key');
        expect(decodeTypeKey(sinnohMidId, OFFSETS)).toBeNull();
        expect(decodeRegionPass(sinnohMidId, OFFSETS)).toBeNull();
        expect(decodeLineUnlock(sinnohMidId, OFFSETS)).toBeNull();
    });
});
