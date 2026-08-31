import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { UISettings } from '../context/GameContext';
import { getSprite, countSprites, generateSpriteKey } from '../services/spriteService';
import { resolveExternalSpriteUrl } from '../utils/pokesprite';
import { getDerpemonUrl, type DerpemonIndex } from '../services/derpemonService';
import {
    acquireSpriteUrl,
    releaseSpriteUrl,
    evictAllSpriteUrls,
    peekSpriteUrl,
    spriteUrlCacheKey,
} from '../services/spriteUrlCache';

export function useSpriteManager(params: {
    uiSettings: UISettings;
    derpyfiedIds: Set<number>;
    derpemonIndex: DerpemonIndex;
    // Canonical sprite-refresh counter is owned by useTrapHandler and lifted
    // through GameContext. We observe it here to trigger cache eviction; we
    // do NOT own a duplicate state.
    spriteRefreshCounter: number;
}) {
    const { uiSettings, derpyfiedIds, derpemonIndex, spriteRefreshCounter } = params;

    const [spriteCount, setSpriteCount] = useState(0);
    const [spriteRepoUrl, setSpriteRepoUrlState] = useState<string>(() => {
        const qp = new URLSearchParams(window.location.search);
        return qp.get('sprites') || localStorage.getItem('pokepelago_spriteRepoUrl') || '';
    });
    const [pmdSpriteUrl, setPmdSpriteUrlState] = useState<string>(() => {
        const qp = new URLSearchParams(window.location.search);
        return qp.get('pmd') || localStorage.getItem('pokepelago_pmdSpriteUrl') || '';
    });

    // derpyfiedIds is read through a ref rather than a callback dep: if it were a
    // dep, every Derpy trap would recreate getSpriteUrl, propagate through every
    // PokemonSlot effect dep, and tear down all 1025 sprite-loading effects at
    // once -- the root cause of BUG-03. Per-slot refresh is handled by
    // PokemonSlot/PokemonDetails subscribing to derpyfiedIds directly and
    // re-running only when their own pokemon's derpy state flips.
    const derpyfiedIdsRef = useRef<Set<number>>(derpyfiedIds);
    useEffect(() => { derpyfiedIdsRef.current = derpyfiedIds; }, [derpyfiedIds]);

    const setSpriteRepoUrl = useCallback((url: string) => {
        setSpriteRepoUrlState(url);
        localStorage.setItem('pokepelago_spriteRepoUrl', url);
    }, []);

    const setPmdSpriteUrl = useCallback((url: string) => {
        setPmdSpriteUrlState(url);
        localStorage.setItem('pokepelago_pmdSpriteUrl', url);
    }, []);

    const refreshSpriteCount = useCallback(async () => {
        const count = await countSprites();
        setSpriteCount(count);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        refreshSpriteCount();
    }, [refreshSpriteCount]);

    // Evict the URL cache whenever spriteRefreshCounter changes. The counter
    // bumps on sprite-set/enableSprites toggle, manual debug refresh, shuffle
    // traps, and resets to 0 on disconnect -- all cases where the previously
    // resolved URLs are stale.
    //
    // BUG-21: this MUST be a layout effect, not a passive one. React runs all
    // passive effects children-first, so as a passive effect every mounted
    // PokemonSlot re-ran its acquire effect against the stale cache before
    // this hook's owner (GameContext, above the slots) got to evict -- the
    // eviction then wiped the entries underneath the live slots and orphaned
    // their in-flight resolutions, blanking sprites until a full page refresh
    // (field overlay readout, 2026-07-08: size 0 / active refs 0 with
    // acq-rel pinned at the visible slot count). Layout effects run before
    // ALL passive effects of the same commit, so slots always re-acquire
    // against an already-clean cache.
    const lastEvictedCounterRef = useRef<number>(spriteRefreshCounter);
    useLayoutEffect(() => {
        if (lastEvictedCounterRef.current !== spriteRefreshCounter) {
            evictAllSpriteUrls();
            lastEvictedCounterRef.current = spriteRefreshCounter;
        }
    }, [spriteRefreshCounter]);

    // Pure factory: resolve a sprite URL from configured sources. Captures
    // derpemonIndex / spriteRepoUrl / spriteSet / enableSprites; the cache
    // gets evicted via spriteRefreshCounter when these change so the next
    // acquire re-runs the factory.
    const resolveSpriteUrl = useCallback(async (
        id: number,
        options: { shiny?: boolean; animated?: boolean; derpyfied?: boolean },
    ): Promise<string | null> => {
        if (options.derpyfied && !options.animated) {
            const derpemonUrl = getDerpemonUrl(derpemonIndex, id);
            if (derpemonUrl) return derpemonUrl;
        }
        if (uiSettings.spriteSet === 'derpemon' && !options.animated) {
            const derpemonUrl = getDerpemonUrl(derpemonIndex, id);
            if (derpemonUrl) return derpemonUrl;
        }
        if (uiSettings.enableSprites) {
            const key = generateSpriteKey(id, options);
            const blob = await getSprite(key);
            if (blob) {
                return URL.createObjectURL(blob);
            }
        }
        if (spriteRepoUrl) {
            return resolveExternalSpriteUrl(spriteRepoUrl, id, options);
        }
        return null;
    }, [derpemonIndex, spriteRepoUrl, uiSettings.spriteSet, uiSettings.enableSprites]);

    // Cache-aware acquire/release pair for PokemonSlot. Slot calls acquire on
    // mount with a stable key derived from (id, shiny, derpyfied); remounts
    // (region toggle, derp flip) hit the cache synchronously after the first
    // resolution. The slot is responsible for calling releaseSlotSpriteUrl
    // on unmount.
    const acquireSlotSpriteUrl = useCallback((
        id: number,
        options: { shiny?: boolean; animated?: boolean; derpyfied?: boolean },
    ): { key: string; promise: Promise<string | null> } => {
        const key = spriteUrlCacheKey(id, options);
        const promise = acquireSpriteUrl(key, () => resolveSpriteUrl(id, options));
        return { key, promise };
    }, [resolveSpriteUrl]);

    const releaseSlotSpriteUrl = useCallback((key: string): void => {
        releaseSpriteUrl(key);
    }, []);

    const peekSlotSpriteUrl = useCallback((
        id: number,
        options: { shiny?: boolean; animated?: boolean; derpyfied?: boolean },
    ): string | null => {
        return peekSpriteUrl(spriteUrlCacheKey(id, options));
    }, []);

    // Legacy single-shot getSpriteUrl, kept for PokemonDetails (only one open
    // at a time, no remount churn). Reads the live derpyfied set via the ref
    // so per-pokemon flips don't recreate the callback.
    const getSpriteUrl = useCallback(async (
        id: number,
        options: { shiny?: boolean; animated?: boolean } = {},
    ) => {
        const derpyfied = derpyfiedIdsRef.current.has(id);
        return resolveSpriteUrl(id, { ...options, derpyfied });
    }, [resolveSpriteUrl]);

    return {
        spriteCount,
        spriteRepoUrl,
        setSpriteRepoUrl,
        pmdSpriteUrl,
        setPmdSpriteUrl,
        refreshSpriteCount,
        getSpriteUrl,
        acquireSlotSpriteUrl,
        releaseSlotSpriteUrl,
        peekSlotSpriteUrl,
    };
}
