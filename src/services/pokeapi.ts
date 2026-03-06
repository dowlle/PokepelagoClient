import type { PokemonRef } from '../types/pokemon';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const CACHE_KEY = 'pokepelago_pokemon_cache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheEntry {
    data: PokemonRef[];
    fetchedAt: number;
}

function readCache(): PokemonRef[] | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const entry: CacheEntry = JSON.parse(raw);
        if (Date.now() - entry.fetchedAt < CACHE_TTL_MS) return entry.data;
    } catch {
        // corrupt cache — ignore
    }
    return null;
}

function writeCache(data: PokemonRef[]) {
    try {
        const entry: CacheEntry = { data, fetchedAt: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
    } catch {
        // localStorage full — not critical
    }
}

/**
 * Fetch all base-species Pokemon (IDs 1-10000).
 * IDs >= 10000 are alternate forms (megas, regional variants, etc.)
 * Results are cached in localStorage for 7 days to survive PokeAPI outages.
 */
export const fetchAllPokemon = async (): Promise<{ data: PokemonRef[]; error: string | null }> => {
    const cached = readCache();
    if (cached) return { data: cached, error: null };

    try {
        const response = await fetch(`${POKEAPI_BASE}/pokemon?limit=10000`);
        if (!response.ok) throw new Error(`PokeAPI responded with ${response.status}`);
        const json = await response.json();
        const data: PokemonRef[] = (json.results as { name: string; url: string }[])
            .map(p => {
                const id = parseInt(p.url.split('/').filter(Boolean).pop() || '0');
                return { name: p.name, url: p.url, id };
            })
            .filter(p => p.id > 0 && p.id < 10000);
        writeCache(data);
        return { data, error: null };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('Failed to fetch pokemon list:', err);
        return { data: [], error: message };
    }
};
