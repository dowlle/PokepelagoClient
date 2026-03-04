/**
 * PMDCollab SpriteCollab sprite service.
 * Handles URL construction and AnimData.xml parsing for Mystery Dungeon animated sprites.
 *
 * Repo: https://github.com/PMDCollab/SpriteCollab
 * Structure: sprite/{0001}/Idle-Anim.png  (zero-padded 4-digit Pokémon ID)
 */

export interface AnimFrameData {
    frameWidth: number;
    frameHeight: number;
    /** Per-frame tick durations. 1 tick ≈ 1000/60 ms. */
    durations: number[];
}

/**
 * Convert a GitHub tree URL or raw URL pointing at the SpriteCollab sprite directory
 * to a normalized raw.githubusercontent.com base URL.
 *
 * Accepts:
 *  - https://github.com/PMDCollab/SpriteCollab/tree/master/sprite
 *  - https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite
 */
export function normalizePmdBaseUrl(url: string): string {
    let base = url.trim().replace(/\/$/, '');
    const treeMatch = base.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/tree\/([^/]+)\/?(.*)$/);
    if (treeMatch) {
        const [, repoPath, branch, subPath] = treeMatch;
        base = `https://raw.githubusercontent.com/${repoPath}/${branch}/${subPath}`.replace(/\/$/, '');
    }
    return base;
}

/** Zero-pad a Pokémon ID to 4 digits, e.g. 25 → "0025", 1025 → "1025". */
export function padPmdId(id: number): string {
    return String(id).padStart(4, '0');
}

/** Returns the three URLs needed for a Pokémon's PMD sprites. */
export function getPmdSpriteUrls(id: number, baseUrl: string) {
    const paddedId = padPmdId(id);
    const base = `${baseUrl}/${paddedId}`;
    return {
        idleUrl: `${base}/Idle-Anim.png`,
        attackUrl: `${base}/Attack-Anim.png`,
        animDataUrl: `${base}/AnimData.xml`,
    };
}

// Module-level cache: animDataUrl → Promise<AnimFrameData | null>
// Using Promise values so concurrent calls share the same fetch.
const _animDataCache = new Map<string, Promise<AnimFrameData | null>>();

/**
 * Fetch and parse an AnimData.xml for a specific animation name.
 * Results are cached globally per URL — safe to call from many components simultaneously.
 * Resolves <CopyOf> references recursively.
 */
export function fetchAnimData(animDataUrl: string, animName: string): Promise<AnimFrameData | null> {
    const cacheKey = `${animDataUrl}::${animName}`;
    if (_animDataCache.has(cacheKey)) {
        return _animDataCache.get(cacheKey)!;
    }

    const promise = _fetchAndParseAnimData(animDataUrl, animName);
    _animDataCache.set(cacheKey, promise);
    return promise;
}

async function _fetchAndParseAnimData(animDataUrl: string, animName: string): Promise<AnimFrameData | null> {
    try {
        const res = await fetch(animDataUrl);
        if (!res.ok) return null;
        const xmlText = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        return _resolveAnim(doc, animName, 0);
    } catch {
        return null;
    }
}

function _resolveAnim(doc: Document, animName: string, depth: number): AnimFrameData | null {
    // Guard against infinite loops from malformed CopyOf chains
    if (depth > 10) return null;

    const anims = doc.querySelectorAll('Anims > Anim');
    for (const anim of anims) {
        const name = anim.querySelector('Name')?.textContent?.trim();
        if (name !== animName) continue;

        const copyOf = anim.querySelector('CopyOf')?.textContent?.trim();
        if (copyOf) {
            return _resolveAnim(doc, copyOf, depth + 1);
        }

        const frameWidth = parseInt(anim.querySelector('FrameWidth')?.textContent ?? '0', 10);
        const frameHeight = parseInt(anim.querySelector('FrameHeight')?.textContent ?? '0', 10);
        const durationEls = anim.querySelectorAll('Durations > Duration');
        const durations = Array.from(durationEls).map(d => parseInt(d.textContent ?? '4', 10));

        if (frameWidth > 0 && frameHeight > 0 && durations.length > 0) {
            return { frameWidth, frameHeight, durations };
        }
        return null;
    }
    return null;
}

/** Clear the AnimData cache (useful for testing). */
export function clearPmdAnimDataCache(): void {
    _animDataCache.clear();
}
