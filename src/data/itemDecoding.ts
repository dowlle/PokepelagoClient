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
 * IMPORTANT: any change to APWorld item-ID layout (see
 * `worlds/pokepelago/Items.py`) must be mirrored here AND in the test
 * fixture. Until DEVEX-15 lands (APWorld emits explicit id→name maps),
 * the client reconstructs the ordering from conventions the APWorld
 * happens to follow; the test asserts the reconstruction is correct.
 */
import { ROUTE_KEY_ITEMS, ROUTE_KEY_ORDER, LINE_UNLOCK_ITEMS } from './routeData';

export interface ItemOffsets {
    ITEM_OFFSET: number;
    TYPE_ITEM_OFFSET: number;
    REGION_PASS_OFFSET: number;
    ROUTE_KEY_OFFSET: number;
    LINE_UNLOCK_OFFSET: number;
}

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
