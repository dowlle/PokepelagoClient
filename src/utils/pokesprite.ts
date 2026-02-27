// Mapping for base forms that have specific names in pokesprite
export const getPokespriteUrl = (_name: string, id: number, shiny: boolean = false): string => {
    // Official PokeAPI sprites are much more reliable as they use IDs
    const baseUrl = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

    if (shiny) {
        return `${baseUrl}/shiny/${id}.png`;
    }
    return `${baseUrl}/${id}.png`;
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
    if (!repoUrl) return null;

    // Normalize GitHub tree URLs → raw.githubusercontent.com
    let base = repoUrl.trim().replace(/\/$/, '');

    // github.com/user/repo/tree/branch/path → raw.githubusercontent.com/user/repo/branch/path
    const treeMatch = base.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/tree\/([^/]+)\/?(.*)$/);
    if (treeMatch) {
        const [, repoPath, branch, subPath] = treeMatch;
        base = `https://raw.githubusercontent.com/${repoPath}/${branch}/${subPath}`.replace(/\/$/, '');
    }

    // Ensure the base ends at /pokemon (strip deeper paths the user may have included)
    if (!base.includes('/pokemon')) {
        base = `${base}/pokemon`;
    } else {
        base = base.replace(/\/pokemon.*$/, '/pokemon');
    }

    if (options.animated) {
        const animBase = `${base}/other/showdown`;
        return options.shiny ? `${animBase}/shiny/${id}.gif` : `${animBase}/${id}.gif`;
    }

    return options.shiny ? `${base}/shiny/${id}.png` : `${base}/${id}.png`;
};
