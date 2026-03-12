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

    // Refs kept in sync every render so getSpriteUrl always reads the latest value
    // without needing to include uiSettings in its dependency array (which would
    // cause a cascade of PokemonSlot effect re-runs on every settings change).
    const spriteSetRef = useRef<'normal' | 'derpemon'>('normal');
    const enableSpritesRef = useRef<boolean>(true);
    spriteSetRef.current = uiSettings.spriteSet;
    enableSpritesRef.current = uiSettings.enableSprites;

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
        refreshSpriteCount();
    }, [refreshSpriteCount]);

    const getSpriteUrl = useCallback(async (id: number, options: { shiny?: boolean; animated?: boolean } = {}) => {
        // 0. Derp Trap Forced Override (takes highest precedence)
        if (derpyfiedIds.has(id) && !options.animated) {
            const derpemonUrl = getDerpemonUrl(derpemonIndex, id);
            if (derpemonUrl) return derpemonUrl;
        }

        // 1. Derpemon sprite set (GitHub CDN, static sprites only — no shiny/animated)
        if (spriteSetRef.current === 'derpemon' && !options.animated) {
            const derpemonUrl = getDerpemonUrl(derpemonIndex, id);
            if (derpemonUrl) return derpemonUrl;
        }

        // 2. Check local IDB sprites
        if (enableSpritesRef.current) {
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
        // spriteSetRef.current and derpyfiedIds listed here so the callback re-creates when
        // they change, ensuring PokemonSlot/PokemonDetails effects re-run immediately.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [derpemonIndex, spriteSetRef.current, enableSpritesRef.current, spriteRepoUrl, derpyfiedIds]);

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
