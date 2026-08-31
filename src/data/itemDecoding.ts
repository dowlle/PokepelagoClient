/**
 * Pure, deterministic decoders that map an Archipelago item ID to the
 * corresponding Pokepelago item name. Kept side-effect-free so the decode
 * path is easy to test in isolation.
 *
 * Both GameContext reconstruction paths (`onConnected` initial replay and
 * `onItemsReceived` streaming updates) call these helpers, so a single test
 * against these functions locks down the behavior for both paths at once —
 * the class of drift that produced BUG-12 (two call sites independently
 * re-implementing the same ID → name math, one quietly going wrong).
 *
 * DEVEX-15: when the bundled route_data.json carries explicit
 * `routeKeyIds` / `lineUnlockIds` maps (APWorld now exports them straight
 * from `item_data_table`), `decodeRouteKey` / `decodeLineUnlock` resolve by
 * direct absolute-ID lookup and never touch the ordering / base-id math that
 * produced BUG-12. The offset-arithmetic path below is retained as a
 * backward-compatible fallback for pre-DEVEX-15 exports (a new client running
 * against a route_data.json bundled with an in-flight seed): if any change to
 * the APWorld item-ID layout (`worlds/pokepelago/Items.py`) happens while
 * those old exports are still around, the fallback must stay mirrored here and
 * in the test fixture.
 */
import {
    ROUTE_KEY_ITEMS, ROUTE_KEY_ORDER, LINE_UNLOCK_ITEMS,
    ROUTE_KEY_IDS, LINE_UNLOCK_IDS,
} from './routeData';

/** DEVEX-15 fast path: absolute AP item ID → item name, inverted from the
 *  explicit maps the APWorld exports. Empty when the bundle predates DEVEX-15,
 *  in which case the decoders fall back to offset arithmetic. */
const ROUTE_KEY_ID_TO_NAME: Map<number, string> = new Map(
    Object.entries(ROUTE_KEY_IDS).map(([name, id]) => [id, name] as const),
);
const LINE_UNLOCK_ID_TO_NAME: Map<number, string> = new Map(
    Object.entries(LINE_UNLOCK_IDS).map(([name, id]) => [id, name] as const),
);

export interface ItemOffsets {
    ITEM_OFFSET: number;
    TYPE_ITEM_OFFSET: number;
    REGION_PASS_OFFSET: number;
    ROUTE_KEY_OFFSET: number;
    LINE_UNLOCK_OFFSET: number;
}

export interface UsefulItemOffsets {
    ITEM_OFFSET: number;
    USEFUL_ITEM_OFFSET: number;
}

/** Canonical useful-item order used by APWorld's Items.py assignment:
 *  USEFUL_ITEM_OFFSET + 1 = Master Ball, +2 = Pokedex, +3 = Pokegear.
 *  See BUG-24: GameContext's inline reimplementation of this mapping had
 *  +2 and +3 transposed at three call sites. Locked here as the reference
 *  so a future drift gets caught by the regression test below. */
export const USEFUL_ITEM_NAMES_ORDERED: readonly string[] = [
    'Master Ball', 'Pokedex', 'Pokegear',
] as const;

/** Canonical type order used by APWorld's GEN_1_TYPES; Items.py assigns
 *  TYPE_ITEM_OFFSET + index in this order. Must not be reordered. */
export const TYPE_NAMES_ORDERED: readonly string[] = [
    'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting',
    'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost',
    'Dragon', 'Fairy', 'Steel', 'Dark',
] as const;

/** Canonical region order used by APWorld's GAME_REGIONS; Items.py assigns
 *  REGION_PASS_OFFSET + index in this order. Must not be reordered. */
export const REGION_NAMES_ORDERED: readonly string[] = [
    'Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova',
    'Kalos', 'Alola', 'Galar', 'Hisui', 'Paldea',
] as const;

/**
 * Decode a Route Key item ID to its display name, or null if the ID is
 * not in the ROUTE_KEY_OFFSET range.
 *
 * The index is the item ID minus (ITEM_OFFSET + ROUTE_KEY_OFFSET), and
 * the mapping to a name uses ROUTE_KEY_ORDER — APWorld's two-phase sort
 * (groups alphabetically, then ungrouped alphabetically). See BUG-12 for
 * the history of why a flat alphabetical sort is wrong here.
 */
export function decodeRouteKey(itemId: number, offsets: ItemOffsets): string | null {
    // DEVEX-15 fast path: authoritative explicit map present → direct lookup.
    // The map covers every route key, so an ID it doesn't contain is simply
    // not a route key (return null rather than falling through to the guess).
    if (ROUTE_KEY_ID_TO_NAME.size > 0) return ROUTE_KEY_ID_TO_NAME.get(itemId) ?? null;
    // Fallback (pre-DEVEX-15 export): two-phase order + offset arithmetic.
    const base = offsets.ITEM_OFFSET + offsets.ROUTE_KEY_OFFSET;
    const idx = itemId - base;
    if (idx < 0 || idx >= ROUTE_KEY_ORDER.length) return null;
    const rk = ROUTE_KEY_ORDER[idx];
    return ROUTE_KEY_ITEMS[rk] ?? null;
}

/**
 * Decode a Line Unlock item ID to its display name, or null if the ID
 * is not in the LINE_UNLOCK_OFFSET range. APWorld encodes the base
 * Pokemon ID directly as the offset (no sort ordering involved), so this
 * is a straight lookup.
 */
export function decodeLineUnlock(itemId: number, offsets: ItemOffsets): string | null {
    // DEVEX-15 fast path: authoritative explicit map present → direct lookup.
    if (LINE_UNLOCK_ID_TO_NAME.size > 0) return LINE_UNLOCK_ID_TO_NAME.get(itemId) ?? null;
    // Fallback (pre-DEVEX-15 export): base Pokemon ID encoded as the offset.
    const base = offsets.ITEM_OFFSET + offsets.LINE_UNLOCK_OFFSET;
    const baseId = itemId - base;
    if (baseId <= 0 || baseId > 1025) return null;
    return LINE_UNLOCK_ITEMS[String(baseId)] ?? null;
}

/**
 * Decode a Type Key item ID to its type name, or null if the ID is not
 * in the TYPE_ITEM_OFFSET range.
 */
export function decodeTypeKey(itemId: number, offsets: ItemOffsets): string | null {
    const base = offsets.ITEM_OFFSET + offsets.TYPE_ITEM_OFFSET;
    const idx = itemId - base;
    if (idx < 0 || idx >= TYPE_NAMES_ORDERED.length) return null;
    return TYPE_NAMES_ORDERED[idx];
}

/**
 * Decode a Region Pass item ID to its region name, or null if the ID
 * is not in the REGION_PASS_OFFSET range.
 */
export function decodeRegionPass(itemId: number, offsets: ItemOffsets): string | null {
    const base = offsets.ITEM_OFFSET + offsets.REGION_PASS_OFFSET;
    const idx = itemId - base;
    if (idx < 0 || idx >= REGION_NAMES_ORDERED.length) return null;
    return REGION_NAMES_ORDERED[idx];
}

/**
 * Decode a useful-item (Master Ball / Pokedex / Pokegear) item ID to its
 * display name, or null if the ID is not in the USEFUL_ITEM_OFFSET range.
 */
export function decodeUsefulItem(itemId: number, offsets: UsefulItemOffsets): string | null {
    const base = offsets.ITEM_OFFSET + offsets.USEFUL_ITEM_OFFSET;
    const idx = itemId - base - 1;
    if (idx < 0 || idx >= USEFUL_ITEM_NAMES_ORDERED.length) return null;
    return USEFUL_ITEM_NAMES_ORDERED[idx];
}
