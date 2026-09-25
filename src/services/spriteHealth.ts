// Sprite load outcomes, per source, for the Sprites settings status (#41).
//
// spriteUrlCache knows which URL each slot resolved to, but not whether the
// browser could actually load it: a 404 or a blocked request only surfaces as
// the <img> error event. PokemonSlot reports those events here, and the
// Sprites settings tab turns the counts into a plain-words diagnosis
// (utils/spriteDiagnosis.ts). Counts are keyed by URL so a slot remounting
// after a region toggle does not count twice. useSpriteManager resets the
// store whenever it evicts the URL cache, because the old URLs are stale then.

import { DERPEMON_RAW_BASE } from './derpemonService';

export type SpriteSourceKind = 'local' | 'repo' | 'derpemon';

export interface SpriteSourceCounts {
    loaded: number;
    failed: number;
}

export type SpriteHealthSnapshot = Record<SpriteSourceKind, SpriteSourceCounts>;

const KINDS: SpriteSourceKind[] = ['local', 'repo', 'derpemon'];

const loaded: Record<SpriteSourceKind, Set<string>> = { local: new Set(), repo: new Set(), derpemon: new Set() };
const failed: Record<SpriteSourceKind, Set<string>> = { local: new Set(), repo: new Set(), derpemon: new Set() };

const listeners = new Set<() => void>();
let snapshot: SpriteHealthSnapshot | null = null;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;

export function spriteSourceOf(url: string): SpriteSourceKind {
    if (url.startsWith('blob:')) return 'local';
    if (url.startsWith(DERPEMON_RAW_BASE)) return 'derpemon';
    return 'repo';
}

// A full grid load reports ~1000 events in a burst; listeners (only the open
// settings tab) are told at most a few times per second.
function changed(): void {
    snapshot = null;
    if (notifyTimer !== null || listeners.size === 0) return;
    notifyTimer = setTimeout(() => {
        notifyTimer = null;
        for (const listener of listeners) listener();
    }, 250);
}

export function recordSpriteImageLoaded(url: string): void {
    const kind = spriteSourceOf(url);
    if (loaded[kind].has(url)) return;
    loaded[kind].add(url);
    failed[kind].delete(url);
    changed();
}

export function recordSpriteImageFailed(url: string): void {
    const kind = spriteSourceOf(url);
    if (failed[kind].has(url) || loaded[kind].has(url)) return;
    failed[kind].add(url);
    changed();
}

export function resetSpriteHealth(): void {
    for (const kind of KINDS) {
        loaded[kind].clear();
        failed[kind].clear();
    }
    changed();
}

// Stable between changes, as useSyncExternalStore requires.
export function getSpriteHealthSnapshot(): SpriteHealthSnapshot {
    if (snapshot === null) {
        snapshot = {
            local: { loaded: loaded.local.size, failed: failed.local.size },
            repo: { loaded: loaded.repo.size, failed: failed.repo.size },
            derpemon: { loaded: loaded.derpemon.size, failed: failed.derpemon.size },
        };
    }
    return snapshot;
}

export function subscribeSpriteHealth(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

// ---------------------------------------------------------------------------
// One-sprite URL test. The grid only shows sprites for caught or hinted
// Pokemon, so on a fresh game there are no load events to learn from; the
// settings tab tests one sprite from the configured URL instead.

export type SpriteUrlTestResult = 'ok' | 'not-found' | 'http-error' | 'unreachable';

export interface SpriteUrlTestDeps {
    // Resolves true if the browser can display the image.
    loadImage: (url: string) => Promise<boolean>;
    // HTTP status of the URL; throws on a network, CORS or CSP failure.
    fetchStatus: (url: string) => Promise<number>;
}

const browserDeps: SpriteUrlTestDeps = {
    loadImage: (url) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    }),
    fetchStatus: async (url) => (await fetch(url, { method: 'HEAD', cache: 'no-store' })).status,
};

export async function testSpriteUrl(url: string, deps: SpriteUrlTestDeps = browserDeps): Promise<SpriteUrlTestResult> {
    if (await deps.loadImage(url)) return 'ok';
    // The image event carries no reason, so ask again with fetch to tell a
    // wrong address (404) from a request that never got an answer.
    try {
        const status = await deps.fetchStatus(url);
        if (status === 404 || status === 410) return 'not-found';
        // A 2xx that the <img> still could not show is not a sprite either
        // (for example an HTML page).
        return status >= 200 && status < 300 ? 'not-found' : 'http-error';
    } catch {
        return 'unreachable';
    }
}

// Test-only.
export function _resetSpriteHealthForTests(): void {
    for (const kind of KINDS) {
        loaded[kind].clear();
        failed[kind].clear();
    }
    snapshot = null;
    if (notifyTimer !== null) clearTimeout(notifyTimer);
    notifyTimer = null;
    listeners.clear();
}
