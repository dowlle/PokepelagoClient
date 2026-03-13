import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import confetti from 'canvas-confetti';
import type { Client } from 'archipelago.js';
import type { PokemonRef } from '../types/pokemon';
import type { OffsetTable } from './useOffsets';
import pokemonMetadata from '../data/pokemon_metadata.json';
import { updateProfile } from '../services/connectionManagerService';

interface UseGoalCheckerParams {
    clientRef: MutableRefObject<Client | null>;
    offsetsRef: MutableRefObject<OffsetTable>;
    isNewApWorldRef: MutableRefObject<boolean>;
    checkedIds: Set<number>;
    setCheckedIds: React.Dispatch<React.SetStateAction<Set<number>>>;
    releasedIds: Set<number>;
    allPokemon: PokemonRef[];
    isConnected: boolean;
    goalCount: number | undefined;
    gameMode: 'archipelago' | 'standalone' | null;
    currentProfileId: string | null;
    typeLocksEnabled: boolean;
    typeUnlocks: Set<string>;
    unlockedIds: Set<number>;
    slotMilestones?: number[];
    slotTypeMilestones?: Record<string, number[]>;
}

export function useGoalChecker({
    clientRef, offsetsRef, isNewApWorldRef, checkedIds, setCheckedIds,
    releasedIds, isConnected, goalCount, gameMode,
    currentProfileId, typeLocksEnabled, typeUnlocks, unlockedIds,
    slotMilestones, slotTypeMilestones,
}: UseGoalCheckerParams) {
    const celebrationTriggered = useRef(false);

    // Extended Locations: milestone and type-milestone AP location checks
    useEffect(() => {
        if (!clientRef.current || !isConnected || gameMode === 'standalone') return;

        const {
            LOCATION_OFFSET, MILESTONE_OFFSET, TYPE_MILESTONE_OFFSET,
            TYPE_MILESTONE_MULTIPLIER, STARTER_OFFSET,
        } = offsetsRef.current;

        const typeCounts: Record<string, number> = {};
        let totalCatches = 0;

        Array.from(checkedIds).forEach(id => {
            if (id >= STARTER_OFFSET && id < STARTER_OFFSET + 20) return;
            if (id >= MILESTONE_OFFSET) return;
            if (id >= 1 && id <= 1025) {
                totalCatches++;
                const data = (pokemonMetadata as any)[id];
                if (!data) return;
                data.types.forEach((t: string) => {
                    const cType = t.charAt(0).toUpperCase() + t.slice(1);
                    typeCounts[cType] = (typeCounts[cType] || 0) + 1;
                });
            }
        });

        // 1. Global Milestone Locations
        // The milestone list is sourced from slot_data (new APWorld) so the client always uses
        // the server's authoritative values (A5 in docs/recommendations.md).
        // Legacy APWorld does not send milestones in slot_data; fall back to the hardcoded list.
        const LEGACY_MILESTONES = [
            1, 2, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 250, 400, 600, 800, 1000,
            148, 248, 383, 490, 646, 718, 806, 895, 1022,
        ].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
        const globalMilestones = slotMilestones ?? LEGACY_MILESTONES;

        globalMilestones.forEach(count => {
            if (totalCatches >= count) {
                const apLocationId = LOCATION_OFFSET + MILESTONE_OFFSET + count;
                const localId = apLocationId - LOCATION_OFFSET;
                if (!checkedIds.has(localId)) {
                    clientRef.current?.check(apLocationId);
                    setCheckedIds(prev => new Set(prev).add(localId));
                }
            }
        });

        // 2. Type-Specific Milestones
        {
            const typesList = [
                'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting',
                'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost',
                'Dragon', 'Fairy', 'Steel', 'Dark',
            ];
            const fallbackSteps = [1, 2, 5, 10, 20, 35, 50];

            // Legacy APWorld: Kanto starters were pre-collected, not in typeCounts — offset by 1.
            // New APWorld: starters are guessed normally and counted.
            const starterTypeOffsets: Record<string, number> = isNewApWorldRef.current ? {} : {
                Grass: 1, Poison: 1, Fire: 1, Water: 1,
            };

            typesList.forEach((typeName, index) => {
                const rawCount = typeCounts[typeName] || 0;
                const offset = starterTypeOffsets[typeName] || 0;
                const typeSteps = slotTypeMilestones?.[typeName] ?? fallbackSteps;

                typeSteps.forEach(step => {
                    if (rawCount + offset >= step) {
                        const apLocationId = LOCATION_OFFSET + TYPE_MILESTONE_OFFSET + (index * TYPE_MILESTONE_MULTIPLIER) + step;
                        const localId = apLocationId - LOCATION_OFFSET;
                        if (!checkedIds.has(localId)) {
                            console.log(`[TypeMilestone] Sending check: Caught ${step} ${typeName} Pokemon (apId=${apLocationId})`);
                            clientRef.current?.check(apLocationId);
                            setCheckedIds(prev => new Set(prev).add(localId));
                        }
                    }
                });
            });
        }
    }, [checkedIds, isConnected, gameMode, typeLocksEnabled, typeUnlocks, unlockedIds, slotMilestones, slotTypeMilestones]);


    // Victory: send CLIENT_GOAL when guessedCount >= goalCount
    useEffect(() => {
        if (!clientRef.current || !isConnected || gameMode !== 'archipelago') return;
        if (goalCount === undefined) return;

        const { STARTER_OFFSET, MILESTONE_OFFSET } = offsetsRef.current;

        // Count Pokémon guess locations only (IDs 1–1025).
        // Excludes Oak's Lab starters, milestone locations, and released (ran away) Pokémon.
        const guessedCount = Array.from(checkedIds).filter(id => {
            if (id >= STARTER_OFFSET && id < STARTER_OFFSET + 20) return false;
            if (id >= MILESTONE_OFFSET) return false;
            if (releasedIds.has(id)) return false;
            return id >= 1 && id <= 1025;
        }).length;

        if (guessedCount >= goalCount) {
            console.log(`Goal met! ${guessedCount}/${goalCount} Pokémon guessed. Sending CLIENT_GOAL.`);
            clientRef.current.updateStatus(30); // 30 = ClientStatus.CLIENT_GOAL
            if (currentProfileId) {
                updateProfile(currentProfileId, { isGoaled: true, goaledAt: Date.now() });
            }
            if (!celebrationTriggered.current) {
                celebrationTriggered.current = true;
                confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#f87171', '#facc15', '#4ade80', '#60a5fa', '#c084fc'] });
                setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 } }), 200);
                setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } }), 200);
            }
        }
    }, [checkedIds, isConnected, gameMode, goalCount, releasedIds, currentProfileId]);
}
