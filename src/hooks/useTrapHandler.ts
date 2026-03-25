import { useState, useRef, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { Client, Item } from 'archipelago.js';
import type { PokemonRef } from '../types/pokemon';
import type { DerpemonIndex } from '../services/derpemonService';
import type { OffsetTable } from './useOffsets';
import type { ToastMessage, LogEntry } from '../context/GameContext';
import { getCleanName } from '../utils/pokemon';

interface UseTrapHandlerParams {
    offsetsRef: MutableRefObject<OffsetTable>;
    checkedIdsRef: MutableRefObject<Set<number>>;
    isPokemonGuessableRef: MutableRefObject<((id: number) => { canGuess: boolean }) | null>;
    allPokemon: PokemonRef[];
    derpemonIndex: DerpemonIndex;
    startingStarter: string | null;
    showToast: (type: ToastMessage['type'], message: string) => void;
    addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
}

export function useTrapHandler({
    offsetsRef, checkedIdsRef, isPokemonGuessableRef,
    allPokemon, derpemonIndex, startingStarter, showToast, addLog,
}: UseTrapHandlerParams) {
    const [shuffleEndTime, setShuffleEndTime] = useState<number>(0);
    const [derpyfiedIds, setDerpyfiedIds] = useState<Set<number>>(new Set());
    const [releasedIds, setReleasedIds] = useState<Set<number>>(new Set());
    const [spriteRefreshCounter, setSpriteRefreshCounter] = useState<number>(0);

    // storageReadyRef gates trap processing to prevent re-triggering on reconnect.
    // Set to true once DataStorage initial values have been loaded.
    const storageReadyRef = useRef(false);
    // Tracks how many Derp/Release Trap items have been processed so new ones can be detected.
    const processedDerpTrapCountRef = useRef<number>(0);
    const processedReleaseTrapCountRef = useRef<number>(0);

    // Called once from the DataStorage .then() after initial values are loaded.
    // serverDerpCount / serverReleaseCount are the current total trap items on the server,
    // used to sync processed counts so traps don't re-fire on reconnect.
    const initFromDataStorage = useCallback((
        derpData: number[] | null,
        relData: number[] | null,
        recaughtData: number[] | null,
        serverDerpCount: number,
        serverReleaseCount: number,
    ) => {
        if (derpData) setDerpyfiedIds(new Set(derpData));
        // Sync processed count to the server total so existing traps don't re-fire
        processedDerpTrapCountRef.current = serverDerpCount;
        if (relData) {
            const recaught = recaughtData ? new Set(recaughtData) : new Set<number>();
            setReleasedIds(new Set(relData.filter(id => !recaught.has(id))));
        }
        processedReleaseTrapCountRef.current = serverReleaseCount;
        storageReadyRef.current = true;
    }, []);

    // Called from DataStorage live-update callbacks
    const onDataStorageDerpUpdate = useCallback((value: number[]) => {
        setDerpyfiedIds(new Set(value));
    }, []);

    const onDataStorageReleaseUpdate = useCallback((value: number[]) => {
        processedReleaseTrapCountRef.current = value.length;
        setReleasedIds(new Set(value));
    }, []);

    const onDataStorageRecaughtUpdate = useCallback((recaughtIds: Set<number>) => {
        setReleasedIds(prev => new Set([...prev].filter(id => !recaughtIds.has(id))));
    }, []);

    // Called from the itemsReceived handler inside useAPConnection.
    // Processes any trap/useful-item IDs in the received batch.
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
    const processTrapItems = useCallback((items: Item[], client: Client) => {
        const { ITEM_OFFSET, TRAP_ITEM_OFFSET, USEFUL_ITEM_OFFSET } = offsetsRef.current;

        let recalculateItems = false;
        items.forEach(item => {
            if (item.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 1) {
                // Small Shuffle Trap
                if (storageReadyRef.current) setShuffleEndTime(Date.now() + 30_000);
            } else if (item.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 2) {
                // Big Shuffle Trap
                if (storageReadyRef.current) setShuffleEndTime(Date.now() + 150_000);
            } else if (
                item.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 3 ||
                item.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 4 ||
                item.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 1 ||
                item.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 2 ||
                item.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 3
            ) {
                recalculateItems = true;
            }
        });

        if (!recalculateItems) return;

        // Process Derp Mon Trap
        setDerpyfiedIds(derps => {
            if (!storageReadyRef.current) return derps;
            const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 3).length;
            if (totalServer <= processedDerpTrapCountRef.current) return derps;

            const newDerps = new Set(derps);
            const basePathPokes = allPokemon.filter(p => !newDerps.has(p.id) && derpemonIndex[p.id]);

            // Priority 1: already guessed or currently guessable
            let availablePokes = basePathPokes.filter(p =>
                checkedIdsRef.current.has(p.id) ||
                (isPokemonGuessableRef.current && isPokemonGuessableRef.current(p.id).canGuess)
            );
            // Priority 2: fallback to all with derpemon sprites
            if (availablePokes.length === 0) availablePokes = [...basePathPokes];

            let toAdd = totalServer - processedDerpTrapCountRef.current;
            processedDerpTrapCountRef.current = totalServer;
            while (toAdd > 0 && availablePokes.length > 0) {
                const randIdx = Math.floor(Math.random() * availablePokes.length);
                const picked = availablePokes.splice(randIdx, 1)[0];
                newDerps.add(picked.id);
                toAdd--;

                // Keep basePathPokes in sync so mid-loop fallback doesn't re-pick the same one
                const baseIdx = basePathPokes.findIndex(p => p.id === picked.id);
                if (baseIdx !== -1) basePathPokes.splice(baseIdx, 1);
                if (availablePokes.length === 0 && toAdd > 0) availablePokes = [...basePathPokes];

                if (checkedIdsRef.current.has(picked.id)) {
                    showToast('trap', `${getCleanName(picked.name)} turned derpy!`);
                } else {
                    showToast('trap', `A Pokémon turned derpy!`);
                }
            }

            // Sync newly derped IDs to server DataStorage
            const team = client.players.self.team;
            const slot = client.players.self.slot;
            const derpKey = `pokepelago_team_${team}_slot_${slot}_derpyfied`;
            const unsynced = Array.from(newDerps).filter(id => !derps.has(id));
            if (unsynced.length > 0) {
                client.storage.prepare(derpKey, []).add(unsynced).commit();
            }
            if (toAdd > 0) {
                setSpriteRefreshCounter(c => c + 1);
            }
            return newDerps;
        });

        // Process Release Trap
        setReleasedIds(released => {
            if (!storageReadyRef.current) return released;
            const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 4).length;
            const processedCount = processedReleaseTrapCountRef.current;
            if (totalServer <= processedCount) return released;

            const newReleased = new Set(released);
            // Exclude the player's starting starter from release
            const starterId = startingStarter
                ? allPokemon.find(p => p.name.toLowerCase() === startingStarter.toLowerCase())?.id
                : undefined;
            const validCheckedIds = Array.from(checkedIdsRef.current).filter(
                id => id !== starterId && !newReleased.has(id)
            );
            let toAdd = totalServer - processedCount;
            processedReleaseTrapCountRef.current = totalServer;

            while (toAdd > 0 && validCheckedIds.length > 0) {
                const randIdx = Math.floor(Math.random() * validCheckedIds.length);
                const pickedId = validCheckedIds.splice(randIdx, 1)[0];
                newReleased.add(pickedId);
                toAdd--;

                addLog({
                    type: 'system',
                    text: `Release Trap triggering! A Pokémon ran away!`,
                    parts: [{ text: `A Pokémon ran away! You must guess it again.`, type: 'color', color: '#EF4444' }],
                });
                showToast('trap', 'Oh no! A Pokémon ran away!');
            }

            // Sync to server DataStorage
            const team = client.players.self.team;
            const slot = client.players.self.slot;
            const relKey = `pokepelago_team_${team}_slot_${slot}_released`;
            const unsynced = Array.from(newReleased).filter(id => !released.has(id));
            if (unsynced.length > 0) {
                client.storage.prepare(relKey, []).add(unsynced).commit();
            }
            return newReleased;
        });
    }, [allPokemon, derpemonIndex, startingStarter, offsetsRef, showToast, addLog]);

    return {
        shuffleEndTime,
        setShuffleEndTime,
        derpyfiedIds,
        setDerpyfiedIds,
        releasedIds,
        setReleasedIds,
        spriteRefreshCounter,
        setSpriteRefreshCounter,
        storageReadyRef,
        processedReleaseTrapCountRef,
        initFromDataStorage,
        onDataStorageDerpUpdate,
        onDataStorageReleaseUpdate,
        onDataStorageRecaughtUpdate,
        processTrapItems,
    };
}
