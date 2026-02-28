/**
 * Derpemon Community Project sprite service.
 * Fetches the sprite index from GitHub once per day and caches it in sessionStorage.
 * Sprites are served via GitHub's raw CDN — no download required.
 *
 * Repo: https://github.com/TheShadowOfLight/DerpemonCommunityProject
 * Naming convention: "{dex_id} - {creator}.png"
 */

export type DerpemonIndex = Record<number, string>; // { dexId: creatorName }

const API_URL =
    'https://api.github.com/repos/TheShadowOfLight/DerpemonCommunityProject/contents/Derpemon/Sprites';
const RAW_BASE =
    'https://raw.githubusercontent.com/TheShadowOfLight/DerpemonCommunityProject/main/Derpemon/Sprites';

const CACHE_KEY = 'pokepelago_derpemon_index_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
    fetchedAt: number;
    index: DerpemonIndex;
}

/** Parse a GitHub Contents API response into a dexId → creator map. */
function parseIndex(files: any[]): DerpemonIndex {
    const index: DerpemonIndex = {};
    for (const file of files) {
        if (file.type !== 'file') continue;
        // Match: "25 - Katante.png" or "1018 - Stella_Boop.png"
        const match = file.name.match(/^(\d+) - (.+)\.png$/i);
        if (match) {
            const id = parseInt(match[1], 10);
            const creator = match[2];
            if (!isNaN(id)) {
                index[id] = creator;
            }
        }
    }
    return index;
}

/**
 * Load the Derpemon sprite index from sessionStorage (if fresh) or fetch from GitHub.
 * Call this once on app startup. Safe to call multiple times — returns cached value immediately.
 */
export async function loadDerpemonIndex(): Promise<DerpemonIndex> {
    // Check in-memory cache first (already resolved in this session)
    if (_inMemoryCache !== null) return _inMemoryCache;

    // Check sessionStorage cache
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
            const cached: CacheEntry = JSON.parse(raw);
            if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
                _inMemoryCache = cached.index;
                return cached.index;
            }
        }
    } catch {
        // ignore malformed cache
    }

    // Fetch from GitHub API
    try {
        const res = await fetch(API_URL, {
            headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
        const files: any[] = await res.json();
        const index = parseIndex(files);

        // Persist to sessionStorage
        const entry: CacheEntry = { fetchedAt: Date.now(), index };
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));

        _inMemoryCache = index;
        return index;
    } catch (err) {
        console.warn('[derpemonService] Failed to load sprite index:', err);
        _inMemoryCache = {};
        return {};
    }
}

/** Module-level in-memory cache to avoid repeated sessionStorage reads. */
let _inMemoryCache: DerpemonIndex | null = null;

/**
 * Reset the in-memory cache (useful for testing or forcing a re-fetch).
 */
export function resetDerpemonCache(): void {
    _inMemoryCache = null;
    sessionStorage.removeItem(CACHE_KEY);
}

/**
 * Returns the raw GitHub CDN URL for a Pokémon's Derpemon sprite,
 * or null if no Derpemon sprite exists for this ID.
 */
export function getDerpemonUrl(index: DerpemonIndex, id: number): string | null {
    const creator = index[id];
    if (!creator) return null;
    // Encode the filename properly (spaces → %20)
    const filename = encodeURIComponent(`${id} - ${creator}.png`);
    return `${RAW_BASE}/${filename}`;
}

/**
 * Returns the creator's name for a given Pokémon ID, or null if no Derpemon sprite exists.
 */
export function getDerpemonCredit(index: DerpemonIndex, id: number): string | null {
    return index[id] ?? null;
}
