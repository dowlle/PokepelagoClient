import type { PokemonRef } from '../types/pokemon';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

/**
 * Fetch all base-species Pokemon (IDs 1-10000).
 * IDs >= 10000 are alternate forms (megas, regional variants, etc.)
 */
export const fetchAllPokemon = async (): Promise<PokemonRef[]> => {
    try {
        const response = await fetch(`${POKEAPI_BASE}/pokemon?limit=10000`);
        const data = await response.json();
        return data.results
            .map((p: { name: string; url: string }) => {
                const id = parseInt(p.url.split('/').filter(Boolean).pop() || '0');
                return { name: p.name, url: p.url, id };
            })
            .filter((p: PokemonRef) => p.id > 0 && p.id < 10000);
    } catch (error) {
        console.error('Failed to fetch pokemon list:', error);
        return [];
    }
};
