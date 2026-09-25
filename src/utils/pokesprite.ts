// Raw base of the official PokeAPI sprite repo. The splash screen and the
// Sprites settings tab both offer it as the one-click sprite source.
export const POKEAPI_SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

// Mapping for base forms that have specific names in pokesprite
export const getPokespriteUrl = (_name: string, id: number, shiny: boolean = false): string => {
    // Official PokeAPI sprites are much more reliable as they use IDs
    const baseUrl = POKEAPI_SPRITE_BASE;

    if (shiny) {
        return `${baseUrl}/shiny/${id}.png`;
    }
    return `${baseUrl}/${id}.png`;
};

/**
 * What a user typed into the Sprite Repo URL field, and the raw base URL the
 * sprites are actually fetched from.
 *
 *  - `empty`: nothing set.
 *  - `invalid`: not an http(s) URL.
 *  - `github-page`: a github.com tree/blob page link. It still works (it is
 *    rewritten to `base`), but the settings offer `base` so users see where
 *    sprites really come from.
 *  - `github-repo`: a github.com link without a branch and folder, which
 *    cannot be mapped to a raw URL.
 *  - `direct`: any other http(s) URL, used as-is.
 */
export type SpriteRepoUrlInfo =
    | { kind: 'empty' }
    | { kind: 'invalid' }
    | { kind: 'github-repo' }
    | { kind: 'github-page'; base: string }
    | { kind: 'direct'; base: string };

// Ensure the base ends at /pokemon (strip deeper paths the user may have included)
const toPokemonBase = (base: string): string => {
    const trimmed = base.replace(/\/+$/, '');
    if (!trimmed.includes('/pokemon')) return `${trimmed}/pokemon`;
    return trimmed.replace(/\/pokemon.*$/, '/pokemon');
};

export const normalizeSpriteRepoUrl = (repoUrl: string): SpriteRepoUrlInfo => {
    const input = (repoUrl ?? '').trim();
    if (!input) return { kind: 'empty' };
    if (!/^https?:\/\/[^/\s]+\.[^/\s]+/i.test(input)) return { kind: 'invalid' };

    const noQuery = input.replace(/[?#].*$/, '').replace(/\/+$/, '');

    // github.com/user/repo/tree/branch/path (or /blob/) → raw.githubusercontent.com/user/repo/branch/path
    const treeMatch = noQuery.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+\/[^/]+)\/(?:tree|blob)\/([^/]+)\/?(.*)$/i);
    if (treeMatch) {
        const [, repoPath, branch, subPath] = treeMatch;
        return {
            kind: 'github-page',
            base: toPokemonBase(`https://raw.githubusercontent.com/${repoPath}/${branch}/${subPath}`),
        };
    }
    if (/^https?:\/\/(?:www\.)?github\.com\//i.test(noQuery)) return { kind: 'github-repo' };

    return { kind: 'direct', base: toPokemonBase(noQuery) };
};

/**
 * Converts a user-provided GitHub sprites tree URL or raw base URL to a
 * fetchable raw.githubusercontent.com URL for a specific Pokemon ID.
 *
 * Accepts:
 *  - https://github.com/PokeAPI/sprites/tree/master/sprites
 *  - https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon
 *  - https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon
 */
export const resolveExternalSpriteUrl = (
    repoUrl: string,
    id: number,
    options: { shiny?: boolean; animated?: boolean } = {}
): string | null => {
    const info = normalizeSpriteRepoUrl(repoUrl);
    if (info.kind === 'empty') return null;
    // Invalid input keeps the pre-#41 behaviour (build a URL anyway) so the
    // grid records a failure the Sprites settings can explain.
    const base = 'base' in info ? info.base : toPokemonBase(repoUrl.trim());

    if (options.animated) {
        const animBase = `${base}/other/showdown`;
        return options.shiny ? `${animBase}/shiny/${id}.gif` : `${animBase}/${id}.gif`;
    }

    return options.shiny ? `${base}/shiny/${id}.png` : `${base}/${id}.png`;
};
