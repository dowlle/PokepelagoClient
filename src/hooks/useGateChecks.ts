/**
 * Centralized Pokemon gate check logic.
 * Extracted from GameContext to keep it manageable.
 * Handles all lock axes: type, region, route, line, badge, legendary, trade, baby, fossil, UB, paradox, stone.
 */
import { useCallback } from 'react';
import { GENERATIONS } from '../types/pokemon';
import {
    SUB_LEGENDARY_IDS, BOX_LEGENDARY_IDS, MYTHIC_IDS,
    TRADE_EVO_IDS, BABY_IDS, FOSSIL_IDS, ULTRA_BEAST_IDS, PARADOX_IDS,
    STONE_EVO_IDS,
} from '../data/pokemon_gates';
import {
    getRouteKeysForPokemon, getLineUnlockForPokemon, getBadgeRequirement,
} from '../data/routeData';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import pokemonMetadata from '../data/pokemon_metadata.json';

export interface GuessableResult {
    canGuess: boolean;
    reason?: string;
    reasons?: string[];
    missingTypes?: string[];
    missingRegion?: string;
    missingPokemon?: boolean;
    missingRouteKeys?: string[];
    missingLineUnlock?: string;
    badgeLevelRequired?: number;
}

export interface GateCheckDeps {
    gameMode: 'archipelago' | 'standalone' | null;
    isConnected: boolean;
    generationFilter: number[];
    activePokemonLimit: number;
    activeRegions: Record<string, [number, number]>;
    startingRegion: string;
    detectedApWorldVersion: string;
    // Item state
    unlockedIds: Set<number>;
    regionPasses: Set<string>;
    typeUnlocks: Set<string>;
    routeKeys: Set<string>;
    lineUnlocks: Set<string>;
    gymBadges: number;
    hasLinkCable: boolean;
    daycareCount: number;
    hasFossilRestorer: boolean;
    hasUltraWormhole: boolean;
    hasTimeRift: boolean;
    unlockedStones: Set<string>;
    // Lock toggles
    typeLocksEnabled: boolean;
    regionLocksEnabled: boolean;
    routeLocksEnabled: boolean;
    lineLocksEnabled: boolean;
    badgeLevelGatingEnabled: boolean;
    legendaryLocksEnabled: boolean;
    tradeLocksEnabled: boolean;
    babyLocksEnabled: boolean;
    daycareRequired: number;
    fossilLocksEnabled: boolean;
    ultraBeastLocksEnabled: boolean;
    paradoxLocksEnabled: boolean;
    stoneLocksEnabled: boolean;
}

export function useGateChecks(deps: GateCheckDeps) {
    const {
        gameMode, isConnected, generationFilter, activePokemonLimit,
        activeRegions, startingRegion, detectedApWorldVersion,
        unlockedIds, regionPasses, typeUnlocks, routeKeys, lineUnlocks,
        gymBadges, hasLinkCable, daycareCount, hasFossilRestorer,
        hasUltraWormhole, hasTimeRift, unlockedStones,
        typeLocksEnabled, regionLocksEnabled, routeLocksEnabled,
        lineLocksEnabled, badgeLevelGatingEnabled, legendaryLocksEnabled,
        tradeLocksEnabled, babyLocksEnabled, daycareRequired,
        fossilLocksEnabled, ultraBeastLocksEnabled, paradoxLocksEnabled,
        stoneLocksEnabled,
    } = deps;

    const isPokemonGuessable = useCallback((id: number): GuessableResult => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (pokemonMetadata as any)[id];
        if (!data) return { canGuess: true };

        // Standalone / disconnected: generation filter only
        if (gameMode === 'standalone' || !isConnected) {
            const genIdx = GENERATIONS.findIndex(g => id >= g.startId && id <= g.endId);
            if (genIdx === -1 || !generationFilter.includes(genIdx))
                return { canGuess: false, reason: 'Generation not enabled in settings' };
            return { canGuess: true };
        }

        // Region check
        if (Object.keys(activeRegions).length > 0) {
            const inActiveRegion = Object.values(activeRegions).some(([low, high]) => id >= low && id <= high);
            if (!inActiveRegion) return { canGuess: false, reason: 'This Pokemon is not in your active region.' };
            if (regionLocksEnabled) {
                let pokemonRegion = '';
                for (const [region, [low, high]] of Object.entries(activeRegions)) {
                    if (id >= low && id <= high) { pokemonRegion = region; break; }
                }
                if (pokemonRegion && pokemonRegion !== startingRegion && !regionPasses.has(pokemonRegion)) {
                    return { canGuess: false, reason: `Need ${pokemonRegion} Pass to access this Pokemon.`, missingRegion: pokemonRegion };
                }
            }
        } else if (id > activePokemonLimit) {
            return { canGuess: false, reason: 'This Pokemon is not in your active generation.' };
        }

        // Legacy APWorld: unlock item required
        if (gameMode === 'archipelago' && detectedApWorldVersion === 'legacy') {
            if (!unlockedIds.has(id))
                return { canGuess: false, reason: "Waiting for this Pokemon's Unlock item.", missingPokemon: true };
        }

        // Collect ALL gate failures
        const gateReasons: string[] = [];
        let missingTypesList: string[] = [];
        let missingRouteKeys: string[] | undefined;
        let missingLineUnlock: string | undefined;
        let badgeLevelRequired: number | undefined;

        // Type locks
        if (typeLocksEnabled) {
            missingTypesList = data.types
                .filter((t: string) => !typeUnlocks.has(t.charAt(0).toUpperCase() + t.slice(1)))
                .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1));
        }

        // Route locks: need ANY route key for a route this Pokemon appears on
        if (routeLocksEnabled) {
            const neededKeys = getRouteKeysForPokemon(id, activeRegions);
            if (neededKeys.length > 0 && !neededKeys.some(k => routeKeys.has(k))) {
                missingRouteKeys = neededKeys;
                gateReasons.push('Route Key');
            }
        }

        // Line locks: need the family's Line Unlock
        if (lineLocksEnabled) {
            const lineItem = getLineUnlockForPokemon(id);
            if (lineItem && !lineUnlocks.has(lineItem)) {
                missingLineUnlock = lineItem;
                gateReasons.push('Line Unlock');
            }
        }

        // Badge gating: max(level requirement, legendary tier)
        let badgeReq = 0;
        if (badgeLevelGatingEnabled) {
            badgeReq = getBadgeRequirement(id);
        }
        if (legendaryLocksEnabled) {
            const legendaryReq = MYTHIC_IDS.has(id) ? 8 : BOX_LEGENDARY_IDS.has(id) ? 7 : SUB_LEGENDARY_IDS.has(id) ? 6 : 0;
            badgeReq = Math.max(badgeReq, legendaryReq);
        }
        if (badgeReq > 0 && gymBadges < badgeReq) {
            badgeLevelRequired = badgeReq;
            gateReasons.push(`Badges: ${gymBadges}/${badgeReq}`);
        }

        // Category locks
        if (tradeLocksEnabled && TRADE_EVO_IDS.has(id) && !hasLinkCable)
            gateReasons.push('Link Cable');
        if (babyLocksEnabled && BABY_IDS.has(id) && daycareCount < daycareRequired)
            gateReasons.push(`Daycare: ${daycareCount}/${daycareRequired}`);
        if (fossilLocksEnabled && FOSSIL_IDS.has(id) && !hasFossilRestorer)
            gateReasons.push('Fossil Restorer');
        if (ultraBeastLocksEnabled && ULTRA_BEAST_IDS.has(id) && !hasUltraWormhole)
            gateReasons.push('Ultra Wormhole');
        if (paradoxLocksEnabled && PARADOX_IDS.has(id) && !hasTimeRift)
            gateReasons.push('Time Rift');
        if (stoneLocksEnabled) {
            for (const [stone, ids] of Object.entries(STONE_EVO_IDS)) {
                if (ids.has(id) && !unlockedStones.has(stone))
                    gateReasons.push(`Need ${stone.charAt(0).toUpperCase()}${stone.slice(1)} Stone`);
            }
        }

        if (missingTypesList.length > 0 || gateReasons.length > 0) {
            const firstReason = missingTypesList.length > 0
                ? `Missing Type Keys: ${missingTypesList.join(', ')}`
                : gateReasons[0];
            return {
                canGuess: false,
                reason: firstReason,
                reasons: gateReasons,
                missingTypes: missingTypesList.length > 0 ? missingTypesList : undefined,
                missingRouteKeys,
                missingLineUnlock,
                badgeLevelRequired,
            };
        }

        return { canGuess: true };
    }, [
        gameMode, isConnected, generationFilter, activePokemonLimit, activeRegions,
        startingRegion, detectedApWorldVersion, unlockedIds, regionPasses, typeUnlocks,
        routeKeys, lineUnlocks, gymBadges, hasLinkCable, daycareCount, daycareRequired,
        hasFossilRestorer, hasUltraWormhole, hasTimeRift, unlockedStones,
        typeLocksEnabled, regionLocksEnabled, routeLocksEnabled, lineLocksEnabled,
        badgeLevelGatingEnabled, legendaryLocksEnabled, tradeLocksEnabled,
        babyLocksEnabled, fossilLocksEnabled, ultraBeastLocksEnabled,
        paradoxLocksEnabled, stoneLocksEnabled,
    ]);

    return isPokemonGuessable;
}
