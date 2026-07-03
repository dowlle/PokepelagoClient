/**
 * Client-side "seed completability" verificator (BUG-16/17/18 guard).
 *
 * Given a slot's `slot_data` (what the AP server sends on connect), this checks whether the
 * seed is THEORETICALLY completable from the CLIENT's own gating logic: if the player
 * eventually collects every gate item that exists for this config, can EVERY in-scope Pokemon
 * be guessed? If any in-scope mon stays locked even with the MAXIMAL collected state (all gate
 * items + all active regions), that is a client/server gating divergence or an impossible gate
 * and must be reported.
 *
 * KEY DESIGN INSIGHT
 * ------------------
 * Client guessability of a mon is a function of the CONFIG (active regions + which lock toggles
 * are on + badge tiers + the gate classification), NOT of the seed's random item placement. The
 * seed changes WHEN items arrive, not WHICH gate items exist for the config. So "can this mon
 * ever be unlocked" is seed-independent for a fixed config. The verificator therefore takes
 * `slot_data` (which encodes the config) and needs no spoiler/placement.
 *
 * FAITHFULNESS
 * ------------
 * `isGuessableMaximal` is a byte-faithful port of the live gating predicate
 * `isPokemonGuessableImpl` in `src/context/GameContext.tsx` (the gate-reason assembly around
 * lines 844-962). Instead of short-circuiting, it builds the genuine MAXIMAL collected state
 * (`buildMaximalState`) — every type key, region pass, route key, line unlock, stone, single
 * gate item, daycareCount = required, gymBadges = 8 — and runs the exact same checks against
 * those Sets/counters that the live path runs. It reuses the SAME pure data helpers the live
 * path uses (`buildEffectiveGates`, `getRouteKeysForPokemon`, `getLineUnlockForPokemon`,
 * `getBadgeRequirement`), so the gate data can never drift from the client's bundled copy. The
 * port is pinned against the live structure in `verifySeedCompletable.test.ts`.
 *
 * Only the AP (`archipelago`, connected, non-legacy) gating path is modelled, because that is
 * the path these seeds run under. Standalone / legacy-unlock paths are noted inline.
 */
import pokemonMetadata from '../data/pokemon_metadata.json';
import { buildEffectiveGates, type ServerGateCategories, type EffectiveGates } from '../data/gateCategories';
import {
    getRouteKeysForPokemon, getLineUnlockForPokemon, getBadgeRequirement,
    ROUTE_KEY_ITEMS, LINE_UNLOCK_ITEMS,
} from '../data/routeData';

/** Lock-toggle + region config extracted from slot_data. Field names mirror slot_data exactly. */
export interface VerifyConfig {
    activeRegions: Record<string, [number, number]>;
    startingRegion: string;
    daycareRequired: number;
    typeLocksEnabled: boolean;
    regionLocksEnabled: boolean;
    routeLocksEnabled: boolean;
    lineLocksEnabled: boolean;
    badgeLevelGatingEnabled: boolean;
    legendaryLocksEnabled: boolean;
    tradeLocksEnabled: boolean;
    babyLocksEnabled: boolean;
    fossilLocksEnabled: boolean;
    ultraBeastLocksEnabled: boolean;
    paradoxLocksEnabled: boolean;
    stoneLocksEnabled: boolean;
    dexsanityEnabled: boolean;
    gates: EffectiveGates;
}

/** The maximal collected state: everything a player could ever collect for the config. */
export interface MaximalState {
    typeUnlocks: Set<string>;
    regionPasses: Set<string>;
    routeKeys: Set<string>;
    lineUnlocks: Set<string>;
    unlockedStones: Set<string>;
    hasLinkCable: boolean;
    hasFossilRestorer: boolean;
    hasUltraWormhole: boolean;
    hasTimeRift: boolean;
    gymBadges: number;
    daycareCount: number;
}

export interface BlockedMon {
    id: number;
    name: string;
    reason: string;
}

export interface VerifyResult {
    completable: boolean;
    inScope: number;
    blocked: BlockedMon[];
}

type Meta = Record<string, { name: string; types: string[]; is_legendary: boolean }>;
const META = pokemonMetadata as unknown as Meta;

/** Max gym-badge count the player can ever hold (the highest legendary tier is 8). */
const MAX_GYM_BADGES = 8;

/** Every Pokemon type the client recognises (capitalised, matching the live type-key check). */
const ALL_TYPES = [
    'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground',
    'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark',
];

/**
 * Read a slot_data payload into the config the verificator needs. Mirrors the slot_data parsing
 * in GameContext.onConnected (the `!!slotData.x` coercions and `gate_categories` handling).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configFromSlotData(slotData: any): VerifyConfig {
    const activeRegions = (slotData.active_regions ?? {}) as Record<string, [number, number]>;
    return {
        activeRegions,
        startingRegion: slotData.starting_region ?? '',
        daycareRequired: slotData.daycare_count ?? 1,
        typeLocksEnabled: !!slotData.type_locks,
        regionLocksEnabled: !!slotData.region_locks,
        routeLocksEnabled: !!slotData.route_locks,
        lineLocksEnabled: !!slotData.line_locks,
        badgeLevelGatingEnabled: !!slotData.badge_level_gating,
        legendaryLocksEnabled: !!slotData.legendary_locks,
        tradeLocksEnabled: !!slotData.trade_locks,
        babyLocksEnabled: !!slotData.baby_locks,
        fossilLocksEnabled: !!slotData.fossil_locks,
        ultraBeastLocksEnabled: !!slotData.ultra_beast_locks,
        paradoxLocksEnabled: !!slotData.paradox_locks,
        stoneLocksEnabled: !!slotData.stone_locks,
        dexsanityEnabled: slotData.dexsanity !== undefined ? !!slotData.dexsanity : true,
        // DEVEX-15: gate the way the generating server did. Absent (legacy seed) -> fallback.
        gates: buildEffectiveGates((slotData.gate_categories ?? null) as ServerGateCategories | null),
    };
}

/**
 * Construct the MAXIMAL collected state for a config: every gate item that exists is held.
 *  - typeUnlocks: all 18 types
 *  - regionPasses: every active region (a pass exists for each)
 *  - routeKeys: every route key item that belongs to an active region
 *  - lineUnlocks: every line-unlock item (families with members anywhere)
 *  - unlockedStones: every stone the gate classification references
 *  - all single gate items held; gymBadges = 8; daycareCount = daycareRequired
 */
export function buildMaximalState(config: VerifyConfig): MaximalState {
    const activeRegionSet = new Set(Object.keys(config.activeRegions));

    const routeKeys = new Set<string>();
    for (const [, item] of Object.entries(ROUTE_KEY_ITEMS)) {
        if (item) routeKeys.add(item);
    }

    const lineUnlocks = new Set<string>();
    for (const item of Object.values(LINE_UNLOCK_ITEMS)) {
        if (item) lineUnlocks.add(item);
    }

    const unlockedStones = new Set<string>(Object.keys(config.gates.stoneEvo));

    return {
        typeUnlocks: new Set(ALL_TYPES),
        regionPasses: new Set(activeRegionSet),
        routeKeys,
        lineUnlocks,
        unlockedStones,
        hasLinkCable: true,
        hasFossilRestorer: true,
        hasUltraWormhole: true,
        hasTimeRift: true,
        gymBadges: MAX_GYM_BADGES,
        daycareCount: config.daycareRequired,
    };
}

/**
 * The in-scope Pokemon set: every id covered by an active region range.
 *
 * (Dexsanity governs whether per-Pokemon AP *locations* exist, not which mons are guessable; the
 * live `isPokemonGuessableImpl` never reads dexsanity. A mon is "in scope" for guessing iff it
 * falls in an active region — exactly the `activeRegions` membership the live predicate checks at
 * line 864. We carry `dexsanityEnabled` for completeness but scope is region-driven.)
 */
export function inScopeIds(config: VerifyConfig): number[] {
    const ranges = Object.values(config.activeRegions);
    const ids: number[] = [];
    for (const idStr of Object.keys(META)) {
        const id = Number(idStr);
        if (ranges.some(([low, high]) => id >= low && id <= high)) ids.push(id);
    }
    return ids.sort((a, b) => a - b);
}

/**
 * Byte-faithful port of `isPokemonGuessableImpl` (GameContext.tsx ~844-962), run against an
 * explicit collected `state`. Only the AP non-legacy path is modelled. When `state` is the
 * maximal state, the only mons that come back blocked are ones no item can ever unlock — i.e.
 * impossible gates / classification bugs (the BUG-16/17/18 class).
 */
export function isGuessableMaximal(
    id: number,
    config: VerifyConfig,
    state: MaximalState,
): { canGuess: boolean; reason?: string } {
    const data = META[String(id)];
    if (!data) return { canGuess: true };

    const {
        activeRegions, startingRegion, regionLocksEnabled, typeLocksEnabled,
        routeLocksEnabled, lineLocksEnabled, badgeLevelGatingEnabled, legendaryLocksEnabled,
        tradeLocksEnabled, babyLocksEnabled, fossilLocksEnabled, ultraBeastLocksEnabled,
        paradoxLocksEnabled, stoneLocksEnabled, daycareRequired, gates,
    } = config;

    // region membership / region-pass gate (live 863-877)
    if (Object.keys(activeRegions).length > 0) {
        const inActiveRegion = Object.values(activeRegions).some(([low, high]) => id >= low && id <= high);
        if (!inActiveRegion) return { canGuess: false, reason: 'This Pokemon is not in your active region.' };
        if (regionLocksEnabled) {
            let pokemonRegion = '';
            for (const [region, [low, high]] of Object.entries(activeRegions)) {
                if (id >= low && id <= high) { pokemonRegion = region; break; }
            }
            if (pokemonRegion && pokemonRegion !== startingRegion && !state.regionPasses.has(pokemonRegion)) {
                return { canGuess: false, reason: `Need ${pokemonRegion} Pass to access this Pokemon.` };
            }
        }
    }

    // type keys (live 885-889, 947-949)
    const missingTypesList: string[] = typeLocksEnabled
        ? data.types
            .filter((t: string) => !state.typeUnlocks.has(t.charAt(0).toUpperCase() + t.slice(1)))
            .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1))
        : [];

    const gateReasons: string[] = [];

    // route locks (live 896-903)
    if (routeLocksEnabled) {
        const neededKeys = getRouteKeysForPokemon(id, activeRegions);
        if (neededKeys.length > 0 && !neededKeys.some(k => state.routeKeys.has(k))) {
            gateReasons.push('Route Key');
        }
    }

    // line locks (live 905-912)
    if (lineLocksEnabled) {
        const lineItem = getLineUnlockForPokemon(id);
        if (lineItem && !state.lineUnlocks.has(lineItem)) {
            gateReasons.push('Line Unlock');
        }
    }

    // badge gating: max(level requirement, legendary tier) (live 914-928)
    {
        let badgeReq = 0;
        if (badgeLevelGatingEnabled) {
            badgeReq = getBadgeRequirement(id);
        }
        if (legendaryLocksEnabled) {
            const legendaryReq = gates.mythic.has(id) ? 8 : gates.boxLegendary.has(id) ? 7 : gates.subLegendary.has(id) ? 6 : 0;
            badgeReq = Math.max(badgeReq, legendaryReq);
        }
        if (badgeReq > 0 && state.gymBadges < badgeReq) {
            gateReasons.push(`Badges: ${state.gymBadges}/${badgeReq}`);
        }
    }

    // single-item gates (live 930-939)
    if (tradeLocksEnabled && gates.tradeEvo.has(id) && !state.hasLinkCable)
        gateReasons.push('Link Cable');
    if (babyLocksEnabled && gates.baby.has(id) && state.daycareCount < daycareRequired)
        gateReasons.push(`Daycare: ${state.daycareCount}/${daycareRequired}`);
    if (fossilLocksEnabled && gates.fossil.has(id) && !state.hasFossilRestorer)
        gateReasons.push('Fossil Restorer');
    if (ultraBeastLocksEnabled && gates.ultraBeast.has(id) && !state.hasUltraWormhole)
        gateReasons.push('Ultra Wormhole');
    if (paradoxLocksEnabled && gates.paradox.has(id) && !state.hasTimeRift)
        gateReasons.push('Time Rift');

    // stone locks (live 940-945)
    if (stoneLocksEnabled) {
        for (const [stone, ids] of Object.entries(gates.stoneEvo)) {
            if (ids.has(id) && !state.unlockedStones.has(stone))
                gateReasons.push(`Need ${stone.charAt(0).toUpperCase()}${stone.slice(1)} Stone`);
        }
    }

    if (missingTypesList.length > 0 || gateReasons.length > 0) {
        const firstReason = missingTypesList.length > 0
            ? `Missing Type Keys: ${missingTypesList.join(', ')}`
            : gateReasons[0];
        return { canGuess: false, reason: firstReason };
    }

    return { canGuess: true };
}

/**
 * Verify a seed is theoretically completable from the client's gating logic for the config
 * encoded in `slot_data`. See file header for the design rationale.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function verifySeedCompletable(slotData: any): VerifyResult {
    const config = configFromSlotData(slotData);
    const state = buildMaximalState(config);
    const ids = inScopeIds(config);
    const blocked: BlockedMon[] = [];
    for (const id of ids) {
        const res = isGuessableMaximal(id, config, state);
        if (!res.canGuess) {
            const meta = META[String(id)];
            blocked.push({ id, name: meta?.name ?? `#${id}`, reason: res.reason ?? 'unknown' });
        }
    }
    return { completable: blocked.length === 0, inScope: ids.length, blocked };
}
