import { useEffect, useState } from 'react';

// FEAT-11: fetch the latest Pokepelago release tag from the client repo so
// we can compare it against the APWorld version the server is running.
// Release surface is intentionally the CLIENT repo per the project's policy
// (APWorld repo is shared with other AP worlds and does not host releases).

const CACHE_KEY = 'pokepelago_latest_release';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — release cadence is weeks, not hours
const GITHUB_API = 'https://api.github.com/repos/dowlle/PokepelagoClient/releases/latest';

interface CachedRelease {
    version: string;
    url: string;
    timestamp: number;
}

function readCache(): CachedRelease | null {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as CachedRelease; }
    catch { return null; }
}

export function useLatestRelease(): { version: string | null; url: string | null } {
    // Hydrate from cache synchronously in the lazy initializer so the UI never
    // flashes empty and we avoid a render-then-setState cascade.
    const [state, setState] = useState<{ version: string | null; url: string | null }>(() => {
        const cached = readCache();
        return cached ? { version: cached.version, url: cached.url } : { version: null, url: null };
    });

    useEffect(() => {
        const cached = readCache();
        // Still-fresh cache → skip the network request entirely.
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return;

        // Silently fail on network/API errors: the indicator just doesn't appear.
        fetch(GITHUB_API)
            .then(r => r.ok ? r.json() : null)
            .then((data: { tag_name?: string; html_url?: string } | null) => {
                if (!data?.tag_name || !data.html_url) return;
                const v = data.tag_name.replace(/^v/i, '');
                setState({ version: v, url: data.html_url });
                const entry: CachedRelease = { version: v, url: data.html_url, timestamp: Date.now() };
                try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); }
                catch { /* quota exceeded — ok, we'll just refetch next session */ }
            })
            .catch(e => console.warn('[useLatestRelease] fetch failed:', e));
    }, []);

    return state;
}
