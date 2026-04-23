import { useState, useRef, useEffect, useCallback } from 'react';
import type { UISettings } from '../context/GameContext';
import { getSprite, countSprites, generateSpriteKey } from '../services/spriteService';
import { resolveExternalSpriteUrl } from '../utils/pokesprite';
import { getDerpemonUrl, type DerpemonIndex } from '../services/derpemonService';

export function useSpriteManager(params: {
    uiSettings: UISettings;
    derpyfiedIds: Set<number>;
    derpemonIndex: DerpemonIndex;
}) {
    const { uiSettings, derpyfiedIds, derpemonIndex } = params;

    const [spriteCount, setSpriteCount] = useState(0);
    const [spriteRepoUrl, setSpriteRepoUrlState] = useState<string>(() => {
        const qp = new URLSearchParams(window.location.search);
        return qp.get('sprites') || localStorage.getItem('pokepelago_spriteRepoUrl') || '';
    });
    const [pmdSpriteUrl, setPmdSpriteUrlState] = useState<string>(() => {
        const qp = new URLSearchParams(window.location.search);
        return qp.get('pmd') || localStorage.getItem('pokepelago_pmdSpriteUrl') || '';
    });
    const [spriteRefreshCounter, setSpriteRefreshCounter] = useState<number>(0);

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

    const getSpriteUrl = useCallback(async (id: number, options: { shiny?: boolean; animated?: boolean } = {}) => {
        // 0. Derp Trap Forced Override (takes highest precedence)
        if (derpyfiedIdsRef.current.has(id) && !options.animated) {
            const derpemonUrl = getDerpemonUrl(derpemonIndex, id);
            if (derpemonUrl) return derpemonUrl;
        }

        // 1. Derpemon sprite set (GitHub CDN, static sprites only — no shiny/animated)
        if (uiSettings.spriteSet === 'derpemon' && !options.animated) {
            const derpemonUrl = getDerpemonUrl(derpemonIndex, id);
            if (derpemonUrl) return derpemonUrl;
        }

        // 2. Check local IDB sprites
        if (uiSettings.enableSprites) {
            const key = generateSpriteKey(id, options);
            const blob = await getSprite(key);
            if (blob) {
                return URL.createObjectURL(blob);
            }
        }

        // 3. Fall back to external repo URL if configured
        if (spriteRepoUrl) {
            return resolveExternalSpriteUrl(spriteRepoUrl, id, options);
        }
        return null;
    }, [derpemonIndex, spriteRepoUrl, uiSettings.spriteSet, uiSettings.enableSprites]);

    return {
        spriteCount,
        spriteRepoUrl,
        setSpriteRepoUrl,
        pmdSpriteUrl,
        setPmdSpriteUrl,
        spriteRefreshCounter,
        setSpriteRefreshCounter,
        refreshSpriteCount,
        getSpriteUrl,
    };
}
