import { createContext, useContext } from 'react';
import type { UISettings } from './GameContext';

// PERF-02 surgical split.
//
// PokemonSlot is rendered ~1025x in DexGrid. Previously it called useGame()
// to read a handful of fields, but the GameContext value is a ~120-field
// object re-created on every provider render. Any state change anywhere in
// the provider (catching a Pokemon, receiving an item, ticking a timer)
// invalidated the context value, which cascaded to every consumer and
// defeated the React.memo wrapper on PokemonSlot (PERF-01).
//
// This narrow context exposes ONLY the fields PokemonSlot actually needs,
// all of which are stable during normal gameplay:
//   - uiSettings: changes on user settings toggle
//   - getSpriteUrl: useCallback, deps change rarely (sprite set / repo URL)
//   - spriteRefreshCounter: bumped on sprite-set change (rare)
//   - pmdSpriteUrl: changes when user sets a PMD repo URL (rare)
//   - setSelectedPokemonId: useState setter, auto-stable
//
// Per-pokemon state (canGuess/reason/isReleased/isPokegeared/isDerpified/
// isShiny) is now computed once per render in DexGrid and passed to each
// PokemonSlot as props, so PokemonSlot no longer subscribes to the hot-path
// game-state sets at all.
export interface PokemonSlotContextValue {
    uiSettings: UISettings;
    getSpriteUrl: (id: number, options?: { shiny?: boolean; animated?: boolean }) => Promise<string | null>;
    spriteRefreshCounter: number;
    pmdSpriteUrl: string;
    setSelectedPokemonId: (id: number | null) => void;
}

export const PokemonSlotContext = createContext<PokemonSlotContextValue | undefined>(undefined);

export function usePokemonSlotContext(): PokemonSlotContextValue {
    const ctx = useContext(PokemonSlotContext);
    if (!ctx) throw new Error('usePokemonSlotContext must be used inside PokemonSlotContext.Provider');
    return ctx;
}
