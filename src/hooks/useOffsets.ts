import { useRef } from 'react';

export interface OffsetTable {
    ITEM_OFFSET: number;
    LOCATION_OFFSET: number;
    STARTER_OFFSET: number;
    MILESTONE_OFFSET: number;
    TYPE_MILESTONE_OFFSET: number;
    TYPE_MILESTONE_MULTIPLIER: number;
    TYPE_ITEM_OFFSET: number;
    USEFUL_ITEM_OFFSET: number;
    TRAP_ITEM_OFFSET: number;
    REGION_PASS_OFFSET: number;
    STARTER_COUNT: number;
}

export const NEW_OFFSETS: OffsetTable = {
    ITEM_OFFSET: 8574000,
    LOCATION_OFFSET: 8560000,
    STARTER_OFFSET: 100_000,
    MILESTONE_OFFSET: 10_000,
    TYPE_MILESTONE_OFFSET: 20_000,
    TYPE_MILESTONE_MULTIPLIER: 1000,
    TYPE_ITEM_OFFSET: 2000,
    USEFUL_ITEM_OFFSET: 3000,
    TRAP_ITEM_OFFSET: 4000,
    REGION_PASS_OFFSET: 5000,
    STARTER_COUNT: 8,
};

export const LEGACY_OFFSETS: OffsetTable = {
    ITEM_OFFSET: 8574000,
    LOCATION_OFFSET: 8571000,
    STARTER_OFFSET: 500,
    MILESTONE_OFFSET: 1000,
    TYPE_MILESTONE_OFFSET: 2000,
    TYPE_MILESTONE_MULTIPLIER: 50,
    TYPE_ITEM_OFFSET: 1100,
    USEFUL_ITEM_OFFSET: 2000,
    TRAP_ITEM_OFFSET: 3000,
    REGION_PASS_OFFSET: 5000,
    STARTER_COUNT: 20,
};

export const GAME_REGIONS_ORDER = [
    'Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova',
    'Kalos', 'Alola', 'Galar', 'Hisui', 'Paldea',
] as const;

/**
 * Returns a ref holding the current offset table.
 * Use offsetsRef.current everywhere inside event handlers (synchronous, no re-render lag).
 * applyVersion() updates the ref synchronously for use in the same event handler call.
 */
export function useOffsets() {
    const offsetsRef = useRef<OffsetTable>({ ...NEW_OFFSETS });
    const isNewApWorldRef = useRef(false);

    const applyVersion = (isNew: boolean) => {
        isNewApWorldRef.current = isNew;
        offsetsRef.current = isNew ? { ...NEW_OFFSETS } : { ...LEGACY_OFFSETS };
    };

    return { offsetsRef, isNewApWorldRef, applyVersion };
}
