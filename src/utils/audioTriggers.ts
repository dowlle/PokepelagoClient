export interface ProgressiveItemSoundState {
  stonesAdd: string[];
  typesAdd: string[];
  regionsAdd: string[];
  routeKeysAdd: string[];
  lineUnlocksAdd: string[];
  gymBadgeDelta: number;
  daycareDelta: number;
  linkCable: boolean;
  ultraWormhole: boolean;
  timeRift: boolean;
  fossilRestorer: boolean;
}

export function getNewlyGuessablePokemon(previous: Set<number>, next: Set<number>): number[] {
  return Array.from(next).filter(id => !previous.has(id));
}

export function shouldPlayProgressiveItemSound(state: ProgressiveItemSoundState): boolean {
  return (
    state.stonesAdd.length > 0 ||
    state.typesAdd.length > 0 ||
    state.regionsAdd.length > 0 ||
    state.routeKeysAdd.length > 0 ||
    state.lineUnlocksAdd.length > 0 ||
    state.gymBadgeDelta > 0 ||
    state.daycareDelta > 0 ||
    state.linkCable ||
    state.ultraWormhole ||
    state.timeRift ||
    state.fossilRestorer
  );
}
