import { describe, it, expect } from 'vitest';
import {
    verifySeedCompletable, configFromSlotData, buildMaximalState, isGuessableMaximal, inScopeIds,
} from './verifySeedCompletable';
import {
    SUB_LEGENDARY_IDS, BOX_LEGENDARY_IDS, MYTHIC_IDS, BABY_IDS, TRADE_EVO_IDS,
    FOSSIL_IDS, ULTRA_BEAST_IDS, PARADOX_IDS, STONE_EVO_IDS,
} from '../data/pokemon_gates';

// Region ranges, mirrored from the APWorld data.py REGION_RANGES / REGION_DATA.
const REGION_RANGES: Record<string, [number, number]> = {
    Kanto: [1, 151], Johto: [152, 251], Hoenn: [252, 386], Sinnoh: [387, 493],
    Unova: [494, 649], Kalos: [650, 721], Alola: [722, 809], Galar: [810, 898],
    Hisui: [899, 905], Paldea: [906, 1025],
};

/**
 * Build a slot_data.gate_categories payload from the client's bundled gate sets. For a current
 * (0.6.2+) APWorld these bundled sets ARE the classification the server ships in slot_data — both
 * are derived from the same data.py — so this faithfully reproduces "what the server sent" for
 * the 11 honest all-locks seeds without hand-copying IDs from Python.
 */
function bundledGateCategories() {
    const arr = (s: Set<number>) => [...s].sort((a, b) => a - b);
    const stone: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(STONE_EVO_IDS)) stone[k] = arr(v);
    return {
        legendary_sub: arr(SUB_LEGENDARY_IDS),
        legendary_box: arr(BOX_LEGENDARY_IDS),
        legendary_mythic: arr(MYTHIC_IDS),
        baby: arr(BABY_IDS),
        trade_evo: arr(TRADE_EVO_IDS),
        fossil: arr(FOSSIL_IDS),
        ultra_beast: arr(ULTRA_BEAST_IDS),
        paradox: arr(PARADOX_IDS),
        stone_evo: stone,
    };
}

/** slot_data for a given region list + lock toggles, shaped like the APWorld fill_slot_data. */
function slotData(opts: {
    regions: string[];
    startingRegion?: string;
    locks: boolean;
    dexsanity?: boolean;
    daycareCount?: number;
}) {
    const active_regions: Record<string, [number, number]> = {};
    for (const r of opts.regions) active_regions[r] = REGION_RANGES[r];
    const l = opts.locks;
    return {
        apworld_version: '0.6.2',
        active_regions,
        starting_region: opts.startingRegion ?? opts.regions[0],
        dexsanity: opts.dexsanity ?? true,
        daycare_count: opts.daycareCount ?? 1,
        type_locks: l,
        region_locks: l,
        route_locks: l,
        line_locks: l,
        badge_level_gating: l,
        legendary_locks: l,
        trade_locks: l,
        baby_locks: l,
        fossil_locks: l,
        ultra_beast_locks: l,
        paradox_locks: l,
        stone_locks: l,
        gate_categories: bundledGateCategories(),
    };
}

const ALL_REGIONS = Object.keys(REGION_RANGES);

describe('verifySeedCompletable', () => {
    it('all-locks / all-10-regions config is completable with 0 blocked (the 11 heavy seeds)', () => {
        // dexsanity + type + region + route + line + badge_level_gating + legendary + trade +
        // baby + fossil + ultra_beast + paradox + stone, all 10 regions. This single config
        // check covers seeds 1001/1002/1003/2001/2002/2003/3001/3002/4001/4002/3569, because
        // client completability is config-determined, not seed-determined.
        const sd = slotData({ regions: ALL_REGIONS, startingRegion: 'Kanto', locks: true });
        const res = verifySeedCompletable(sd);
        expect(res.inScope).toBe(1025);
        expect(res.blocked).toEqual([]);
        expect(res.completable).toBe(true);
    });

    it('minimal config (Kanto only, all locks off) is completable, 151 in scope', () => {
        const sd = slotData({ regions: ['Kanto'], locks: false });
        const res = verifySeedCompletable(sd);
        expect(res.inScope).toBe(151);
        expect(res.completable).toBe(true);
        expect(res.blocked).toEqual([]);
    });

    it('mid config (Kanto+Johto+Hoenn, all locks on) is completable', () => {
        const sd = slotData({ regions: ['Kanto', 'Johto', 'Hoenn'], startingRegion: 'Kanto', locks: true });
        const res = verifySeedCompletable(sd);
        expect(res.inScope).toBe(386);
        expect(res.completable).toBe(true);
        expect(res.blocked).toEqual([]);
    });

    it('in-scope set is exactly the union of active region ranges', () => {
        const config = configFromSlotData(slotData({ regions: ['Kanto', 'Hoenn'], locks: true }));
        const ids = inScopeIds(config);
        expect(ids.length).toBe(151 + (386 - 252 + 1));
        expect(ids.includes(1)).toBe(true);
        expect(ids.includes(151)).toBe(true);
        expect(ids.includes(152)).toBe(false); // Johto not active
        expect(ids.includes(252)).toBe(true);
        expect(ids.includes(386)).toBe(true);
    });

    // --- Pin: the maximal-state port mirrors the live predicate's gate decisions. ---
    // The live `isPokemonGuessableImpl` returns canGuess=true once every required item is held.
    // We assert representative gated mons flip to guessable exactly when their item is present,
    // and stay blocked when it is removed from the maximal state (so the port really evaluates
    // the gate, rather than vacuously passing).

    it('port: a legendary needs >0 badges, and the badge check actually gates it', () => {
        const config = configFromSlotData(slotData({ regions: ALL_REGIONS, locks: true }));
        // Mewtwo (150) is a sub-legendary -> tier 6 under legendary_locks.
        expect(MYTHIC_IDS.has(150) || BOX_LEGENDARY_IDS.has(150) || SUB_LEGENDARY_IDS.has(150)).toBe(true);
        const full = buildMaximalState(config);
        expect(isGuessableMaximal(150, config, full).canGuess).toBe(true);
        // Drop badges below the legendary tier -> it must block with a badge reason.
        const starved = { ...full, gymBadges: 0 };
        const r = isGuessableMaximal(150, config, starved);
        expect(r.canGuess).toBe(false);
        expect(r.reason).toMatch(/Badges:/);
    });

    it('port: a type-locked mon blocks when its type key is missing', () => {
        const config = configFromSlotData(slotData({ regions: ['Kanto'], locks: true }));
        const full = buildMaximalState(config);
        // Bulbasaur (1) is Grass/Poison. Remove Grass -> must report a missing type key.
        expect(isGuessableMaximal(1, config, full).canGuess).toBe(true);
        const noGrass = { ...full, typeUnlocks: new Set([...full.typeUnlocks].filter(t => t !== 'Grass')) };
        const r = isGuessableMaximal(1, config, noGrass);
        expect(r.canGuess).toBe(false);
        expect(r.reason).toMatch(/Missing Type Keys/);
    });

    it('port: a region-locked non-starting mon blocks without its region pass', () => {
        const config = configFromSlotData(slotData({ regions: ['Kanto', 'Johto'], startingRegion: 'Kanto', locks: true }));
        const full = buildMaximalState(config);
        // 152 (Chikorita) is in Johto (non-starting). Full state -> guessable.
        expect(isGuessableMaximal(152, config, full).canGuess).toBe(true);
        const noPass = { ...full, regionPasses: new Set<string>(['Kanto']) };
        const r = isGuessableMaximal(152, config, noPass);
        expect(r.canGuess).toBe(false);
        expect(r.reason).toMatch(/Johto Pass/);
    });

    it('legacy seed (no gate_categories) still resolves via the fallback classification', () => {
        const sd = slotData({ regions: ['Kanto'], locks: true }) as Record<string, unknown>;
        delete sd.gate_categories;
        const res = verifySeedCompletable(sd);
        expect(res.completable).toBe(true);
        expect(res.inScope).toBe(151);
    });
});
