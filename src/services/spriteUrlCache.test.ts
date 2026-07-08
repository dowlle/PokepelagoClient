import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    acquireSpriteUrl,
    releaseSpriteUrl,
    peekSpriteUrl,
    evictAllSpriteUrls,
    getSpriteUrlCacheStats,
    spriteUrlCacheKey,
    _resetSpriteUrlCache,
} from './spriteUrlCache';

// BUG-21 regression suite. The failure mode from the reporter's overlay readout:
// evictAllSpriteUrls ran while slot acquisitions were outstanding, so
// resolutions arriving after the wipe were dropped (never stored, blobs never
// revoked) and the cache ended empty underneath a fully-held grid
// (size 0 / active refs 0 with acq-rel pinned at the visible slot count).

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

const revokeObjectURL = vi.fn();

beforeEach(() => {
    vi.stubGlobal('URL', { revokeObjectURL, createObjectURL: vi.fn() });
    revokeObjectURL.mockClear();
    _resetSpriteUrlCache();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('spriteUrlCacheKey', () => {
    it('encodes id and option flags stably', () => {
        expect(spriteUrlCacheKey(25, {})).toBe('25');
        expect(spriteUrlCacheKey(25, { shiny: true })).toBe('25_s');
        expect(spriteUrlCacheKey(25, { shiny: true, animated: true, derpyfied: true })).toBe('25_s_a_d');
    });
});

describe('acquireSpriteUrl (baseline)', () => {
    it('stores the resolved URL and serves later acquires from cache', async () => {
        const factory = vi.fn(async () => 'https://example.test/25.png');
        await acquireSpriteUrl('25', factory);
        expect(peekSpriteUrl('25')).toBe('https://example.test/25.png');

        const url = await acquireSpriteUrl('25', factory);
        expect(url).toBe('https://example.test/25.png');
        expect(factory).toHaveBeenCalledTimes(1);
        expect(getSpriteUrlCacheStats().hits).toBe(1);
    });

    it('drops a failed entry so a retry re-runs the factory', async () => {
        const failing = vi.fn(async () => { throw new Error('offline'); });
        await expect(acquireSpriteUrl('25', failing)).rejects.toThrow('offline');
        expect(getSpriteUrlCacheStats().size).toBe(0);

        const url = await acquireSpriteUrl('25', async () => 'https://example.test/25.png');
        expect(url).toBe('https://example.test/25.png');
    });

    it('release on a missing entry is a no-op', () => {
        expect(() => releaseSpriteUrl('nope')).not.toThrow();
        expect(getSpriteUrlCacheStats().releases).toBe(1);
    });
});

describe('post-evict resolutions (BUG-21)', () => {
    it('does not re-populate the cache from a resolution that arrives after eviction', async () => {
        const d = deferred<string | null>();
        const promise = acquireSpriteUrl('25', () => d.promise);

        evictAllSpriteUrls();
        d.resolve('https://example.test/25.png');

        // Awaiters still receive the URL (their effects decide whether it is
        // still wanted), but the cache must not resurrect the dead entry.
        await expect(promise).resolves.toBe('https://example.test/25.png');
        expect(getSpriteUrlCacheStats().size).toBe(0);
        expect(peekSpriteUrl('25')).toBeNull();
        expect(getSpriteUrlCacheStats().orphaned).toBe(1);
    });

    it('revokes an orphaned blob URL instead of leaking it (PERF-13 path)', async () => {
        const d = deferred<string | null>();
        const promise = acquireSpriteUrl('25', () => d.promise);

        evictAllSpriteUrls();
        d.resolve('blob:https://example.test/dead-beef');
        await promise;

        expect(revokeObjectURL).toHaveBeenCalledWith('blob:https://example.test/dead-beef');
        expect(getSpriteUrlCacheStats().orphaned).toBe(1);
    });

    it('does not revoke orphaned plain-https URLs', async () => {
        const d = deferred<string | null>();
        const promise = acquireSpriteUrl('25', () => d.promise);

        evictAllSpriteUrls();
        d.resolve('https://example.test/25.png');
        await promise;

        expect(revokeObjectURL).not.toHaveBeenCalled();
        expect(getSpriteUrlCacheStats().orphaned).toBe(1);
    });

    it('a stale resolution never overwrites the successor entry from a post-evict re-acquire', async () => {
        const stale = deferred<string | null>();
        const stalePromise = acquireSpriteUrl('25', () => stale.promise);

        // Sprite-set toggle: evict, then the slot re-acquires (same key, new
        // factory) as its effect re-runs on the refresh counter.
        evictAllSpriteUrls();
        const fresh = deferred<string | null>();
        const freshPromise = acquireSpriteUrl('25', () => fresh.promise);

        fresh.resolve('https://example.test/new-set/25.png');
        await freshPromise;
        stale.resolve('https://example.test/old-set/25.png');
        await stalePromise;

        expect(peekSpriteUrl('25')).toBe('https://example.test/new-set/25.png');
        expect(getSpriteUrlCacheStats().size).toBe(1);
        expect(getSpriteUrlCacheStats().orphaned).toBe(1);
    });

    it('a stale rejection never deletes the successor entry for the same key', async () => {
        const stale = deferred<string | null>();
        const stalePromise = acquireSpriteUrl('25', () => stale.promise);

        evictAllSpriteUrls();
        const freshUrl = await acquireSpriteUrl('25', async () => 'https://example.test/new-set/25.png');
        expect(freshUrl).toBe('https://example.test/new-set/25.png');

        stale.reject(new Error('aborted'));
        await expect(stalePromise).rejects.toThrow('aborted');

        // Pre-fix, the catch handler did an unguarded cache.delete(key) and
        // killed the healthy successor entry.
        expect(peekSpriteUrl('25')).toBe('https://example.test/new-set/25.png');
        expect(getSpriteUrlCacheStats().size).toBe(1);
    });

    it('rapid toggle churn converges to a populated cache once fetches settle', async () => {
        // Simulates the reported few-dozen Derpy<->normal toggles on one key:
        // each round evicts mid-flight, then re-acquires. The end state must
        // be a live cache serving the LAST generation, never the wiped-empty
        // state from the overlay readout.
        const generations: Array<ReturnType<typeof deferred<string | null>>> = [];
        let last: Promise<string | null> = Promise.resolve(null);
        for (let round = 0; round < 20; round++) {
            evictAllSpriteUrls();
            const d = deferred<string | null>();
            generations.push(d);
            last = acquireSpriteUrl('25', () => d.promise);
        }
        // Resolve out of order: latest first, then the stale backlog.
        generations[19].resolve('https://example.test/gen19.png');
        await last;
        for (let round = 0; round < 19; round++) {
            generations[round].resolve(`blob:https://example.test/gen${round}`);
        }
        await Promise.all(generations.map((g) => g.promise));

        expect(peekSpriteUrl('25')).toBe('https://example.test/gen19.png');
        expect(getSpriteUrlCacheStats().size).toBe(1);
        expect(getSpriteUrlCacheStats().orphaned).toBe(19);
        expect(revokeObjectURL).toHaveBeenCalledTimes(19);
    });
});

describe('evictAllSpriteUrls', () => {
    it('revokes stored blob URLs and clears the map', async () => {
        await acquireSpriteUrl('1', async () => 'blob:https://example.test/one');
        await acquireSpriteUrl('2', async () => 'https://example.test/two.png');
        expect(getSpriteUrlCacheStats().size).toBe(2);

        evictAllSpriteUrls();

        expect(revokeObjectURL).toHaveBeenCalledWith('blob:https://example.test/one');
        expect(revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(getSpriteUrlCacheStats().size).toBe(0);
        expect(getSpriteUrlCacheStats().evictions).toBe(2);
    });
});
