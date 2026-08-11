import { describe, expect, it } from 'vitest';
import { getNewlyGuessablePokemon, shouldPlayProgressiveItemSound } from './audioTriggers';

describe('audioTriggers', () => {
  it('detects newly guessable pokemon', () => {
    const previous = new Set([1, 2]);
    const next = new Set([1, 2, 3]);

    expect(getNewlyGuessablePokemon(previous, next)).toEqual([3]);
  });

  it('plays progressive-item sounds when a relevant unlock arrives', () => {
    expect(shouldPlayProgressiveItemSound({
      gymBadgeDelta: 1,
      daycareDelta: 0,
      stonesAdd: [],
      typesAdd: [],
      regionsAdd: [],
      routeKeysAdd: [],
      lineUnlocksAdd: [],
      linkCable: false,
      ultraWormhole: false,
      timeRift: false,
      fossilRestorer: false,
    })).toBe(true);
  });

  it('does not play progressive-item sounds for empty updates', () => {
    expect(shouldPlayProgressiveItemSound({
      gymBadgeDelta: 0,
      daycareDelta: 0,
      stonesAdd: [],
      typesAdd: [],
      regionsAdd: [],
      routeKeysAdd: [],
      lineUnlocksAdd: [],
      linkCable: false,
      ultraWormhole: false,
      timeRift: false,
      fossilRestorer: false,
    })).toBe(false);
  });
});
