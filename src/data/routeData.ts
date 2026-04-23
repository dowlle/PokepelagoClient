/**
 * Static route/line/badge data for client-side gate checks.
 * Generated from the APworld's route_data.py via _export_client_data.py.
 *
 * This data is static — it doesn't change per-game. The APworld sends
 * active_regions + lock toggle booleans via slot_data; the client filters
 * this data at runtime.
 */
import rawData from './route_data.json';

interface RouteInfo {
    name: string;
    region: string;
    count: number;
}

interface RouteDataBundle {
    routeInfo: Record<string, RouteInfo>;
    pokemonRoutes: Record<string, string[]>;
    familyBase: Record<string, number>;
    routeKeyItems: Record<string, string>;
    lineUnlockItems: Record<string, string>;
    pokemonLevels: Record<string, number>;
    badgeLevelThresholds: number[];
}

const data = rawData as RouteDataBundle;

/** Route key → {name, region, pokemon count} */
export const ROUTE_INFO = data.routeInfo;

/** Pokemon ID → list of route keys where it can be found */
export const POKEMON_ROUTES = data.pokemonRoutes;

/** Pokemon ID → base form ID of its evolution family */
export const FAMILY_BASE = data.familyBase;

/** Route key → item name (e.g., "kanto-route-1" → "Kanto Route 1 Key") */
export const ROUTE_KEY_ITEMS = data.routeKeyItems;

/**
 * Canonical ordering of route keys for item-ID assignment, matching
 * APWorld worlds/pokepelago/Items.py: `sorted(ROUTE_GROUPS.keys()) + sorted(ungrouped)`.
 *
 * Why: APWorld assigns route-key item IDs as ITEM_OFFSET + ROUTE_KEY_OFFSET + index.
 * The index is computed by a TWO-PHASE sort (groups first, then ungrouped). A flat
 * alphabetical `Object.keys().sort()` on the client misaligns 16 of 80 keys,
 * causing Sinnoh/Unova/Roaming keys to decode as the wrong item (BUG-12, client
 * hotfix 2026-04-23 against APWorld v0.6.1).
 *
 * Pattern heuristic: ungrouped keys are all and only those prefixed with
 * "roaming-" or "virtual-" (matches APWorld ROUTE_GROUPS vs ROUTE_DATA split
 * as of schema B, shipped in v0.6.0+). The dev-time assertion below catches
 * drift if a future APWorld change adds an ungrouped key outside this pattern.
 *
 * Backward compat: pre-0.6 seeds never send items in the ROUTE_KEY_OFFSET range
 * (route keys didn't exist), so this ordering only affects v0.6+ seeds.
 */
const UNGROUPED_ROUTE_KEY_PREFIXES = ['roaming-', 'virtual-'] as const;
const isUngroupedRouteKey = (k: string): boolean =>
    UNGROUPED_ROUTE_KEY_PREFIXES.some(p => k.startsWith(p));

export const ROUTE_KEY_ORDER: string[] = (() => {
    const all = Object.keys(ROUTE_KEY_ITEMS);
    const groups = all.filter(k => !isUngroupedRouteKey(k)).sort();
    const ungrouped = all.filter(isUngroupedRouteKey).sort();
    return [...groups, ...ungrouped];
})();

/**
 * Route key → list of Pokemon IDs on that route.
 * Derived from pokemonRoutes (pokemon→routes) by inverting.
 */
export const ROUTE_POKEMON: Record<string, number[]> = (() => {
    const result: Record<string, number[]> = {};
    for (const [pidStr, routes] of Object.entries(data.pokemonRoutes)) {
        const pid = Number(pidStr);
        for (const rk of routes) {
            if (!result[rk]) result[rk] = [];
            result[rk].push(pid);
        }
    }
    return result;
})();

/** Base Pokemon ID → line unlock item name (e.g., "1" → "Bulbasaur Line") */
export const LINE_UNLOCK_ITEMS = data.lineUnlockItems;

/** Pokemon ID → minimum encounter level (for badge level display) */
export const POKEMON_LEVELS = data.pokemonLevels;

/** Badge thresholds: index i means badge i covers levels up to threshold[i] */
export const BADGE_LEVEL_THRESHOLDS = data.badgeLevelThresholds;

/**
 * Get the route key item names that would unlock a given Pokemon.
 * Filters by active regions. For evo-only Pokemon, inherits from base form.
 */
export function getRouteKeysForPokemon(
    pokemonId: number,
    activeRegions: Record<string, [number, number]>,
): string[] {
    const activeRegionSet = new Set(Object.keys(activeRegions));
    let routes = POKEMON_ROUTES[String(pokemonId)] ?? [];

    // Evo-only: inherit base form's routes
    if (routes.length === 0) {
        const baseId = FAMILY_BASE[String(pokemonId)];
        if (baseId && baseId !== pokemonId) {
            routes = POKEMON_ROUTES[String(baseId)] ?? [];
        }
    }

    // Filter to active regions and resolve to item names
    return routes
        .filter(rk => {
            const info = ROUTE_INFO[rk];
            return info && activeRegionSet.has(info.region);
        })
        .map(rk => ROUTE_KEY_ITEMS[rk])
        .filter(Boolean);
}

/**
 * Get the line unlock item name for a Pokemon's evolution family.
 */
export function getLineUnlockForPokemon(pokemonId: number): string | null {
    const baseId = FAMILY_BASE[String(pokemonId)] ?? pokemonId;
    return LINE_UNLOCK_ITEMS[String(baseId)] ?? null;
}

/**
 * Get the badge count required for a Pokemon based on encounter level.
 * Returns 0 if no badge required or no level data.
 */
export function getBadgeRequirement(pokemonId: number): number {
    let level = POKEMON_LEVELS[String(pokemonId)];

    // Evo-only: use base form level
    if (level === undefined) {
        const baseId = FAMILY_BASE[String(pokemonId)];
        if (baseId && baseId !== pokemonId) {
            level = POKEMON_LEVELS[String(baseId)];
        }
    }

    if (level === undefined) return 0;

    for (let i = 0; i < BADGE_LEVEL_THRESHOLDS.length; i++) {
        if (level <= BADGE_LEVEL_THRESHOLDS[i]) return i;
    }
    return BADGE_LEVEL_THRESHOLDS.length;
}

/**
 * Get all route keys for a specific region (for progress tracking).
 */
export function getRouteKeysForRegion(region: string): string[] {
    return Object.entries(ROUTE_INFO)
        .filter(([, info]) => info.region === region)
        .map(([rk]) => ROUTE_KEY_ITEMS[rk])
        .filter(Boolean);
}

/**
 * Get all line unlock items for families that have members in given regions.
 */
export function getLineUnlocksForRegions(
    activeRegions: Record<string, [number, number]>,
): string[] {
    const activeIds = new Set<number>();
    for (const [, [lo, hi]] of Object.entries(activeRegions)) {
        for (let i = lo; i <= hi; i++) activeIds.add(i);
    }

    const basesNeeded = new Set<number>();
    for (const id of activeIds) {
        const base = FAMILY_BASE[String(id)] ?? id;
        basesNeeded.add(base);
    }

    return Array.from(basesNeeded)
        .map(base => LINE_UNLOCK_ITEMS[String(base)])
        .filter(Boolean);
}
