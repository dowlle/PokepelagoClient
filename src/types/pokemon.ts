export interface PokemonRef {
    name: string;
    url: string;
    id: number;
}

export interface GenerationRange {
    label: string;
    region: string;
    startId: number;
    endId: number;
}

export const GENERATIONS: GenerationRange[] = [
    { label: 'Gen 1', region: 'Kanto', startId: 1, endId: 151 },
    { label: 'Gen 2', region: 'Johto', startId: 152, endId: 251 },
    { label: 'Gen 3', region: 'Hoenn', startId: 252, endId: 386 },
    { label: 'Gen 4', region: 'Sinnoh', startId: 387, endId: 493 },
    { label: 'Gen 5', region: 'Unova', startId: 494, endId: 649 },
    { label: 'Gen 6', region: 'Kalos', startId: 650, endId: 721 },
    { label: 'Gen 7', region: 'Alola', startId: 722, endId: 809 },
    { label: 'Gen 8', region: 'Galar', startId: 810, endId: 905 },
    { label: 'Gen 9', region: 'Paldea', startId: 906, endId: 1025 },
];

/** Friendly display name: "bulbasaur" -> "Bulbasaur" */
export function formatPokemonName(name: string): string {
    return name
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
