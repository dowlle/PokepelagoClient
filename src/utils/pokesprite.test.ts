import { describe, it, expect } from 'vitest';
import { normalizeSpriteRepoUrl, resolveExternalSpriteUrl, POKEAPI_SPRITE_BASE } from './pokesprite';

describe('normalizeSpriteRepoUrl (#41)', () => {
    it('maps a github.com tree URL to the raw.githubusercontent.com base', () => {
        expect(normalizeSpriteRepoUrl('https://github.com/PokeAPI/sprites/tree/master/sprites')).toEqual({
            kind: 'github-page',
            base: POKEAPI_SPRITE_BASE,
        });
    });

    it('keeps the path inside the repo and cuts it at /pokemon', () => {
        expect(normalizeSpriteRepoUrl('https://github.com/PokeAPI/sprites/tree/master/sprites/pokemon/other/showdown/')).toEqual({
            kind: 'github-page',
            base: POKEAPI_SPRITE_BASE,
        });
        expect(normalizeSpriteRepoUrl('https://github.com/someone/my-sprites/tree/dev/packs/gen5')).toEqual({
            kind: 'github-page',
            base: 'https://raw.githubusercontent.com/someone/my-sprites/dev/packs/gen5/pokemon',
        });
    });

    it('treats a blob (single file) link and a www. link like a tree link', () => {
        expect(normalizeSpriteRepoUrl('https://www.github.com/PokeAPI/sprites/blob/master/sprites/pokemon/25.png')).toEqual({
            kind: 'github-page',
            base: POKEAPI_SPRITE_BASE,
        });
    });

    it('drops a query string or fragment copied along with the link', () => {
        expect(normalizeSpriteRepoUrl('https://github.com/PokeAPI/sprites/tree/master/sprites?tab=readme#top')).toEqual({
            kind: 'github-page',
            base: POKEAPI_SPRITE_BASE,
        });
    });

    it('leaves a raw base as it is', () => {
        expect(normalizeSpriteRepoUrl(`  ${POKEAPI_SPRITE_BASE}/  `)).toEqual({ kind: 'direct', base: POKEAPI_SPRITE_BASE });
        expect(normalizeSpriteRepoUrl('https://sprites.example.com/pack')).toEqual({
            kind: 'direct',
            base: 'https://sprites.example.com/pack/pokemon',
        });
    });

    it('flags a repo front page, which has no branch or folder to map', () => {
        expect(normalizeSpriteRepoUrl('https://github.com/PokeAPI/sprites')).toEqual({ kind: 'github-repo' });
    });

    it('flags empty and non-URL input', () => {
        expect(normalizeSpriteRepoUrl('')).toEqual({ kind: 'empty' });
        expect(normalizeSpriteRepoUrl('   ')).toEqual({ kind: 'empty' });
        expect(normalizeSpriteRepoUrl('raw.githubusercontent.com/PokeAPI/sprites')).toEqual({ kind: 'invalid' });
        expect(normalizeSpriteRepoUrl('C:\\Users\\me\\sprites')).toEqual({ kind: 'invalid' });
    });
});

describe('resolveExternalSpriteUrl', () => {
    it('builds static, shiny and animated URLs from a tree URL', () => {
        const tree = 'https://github.com/PokeAPI/sprites/tree/master/sprites';
        expect(resolveExternalSpriteUrl(tree, 25)).toBe(`${POKEAPI_SPRITE_BASE}/25.png`);
        expect(resolveExternalSpriteUrl(tree, 25, { shiny: true })).toBe(`${POKEAPI_SPRITE_BASE}/shiny/25.png`);
        expect(resolveExternalSpriteUrl(tree, 25, { animated: true })).toBe(`${POKEAPI_SPRITE_BASE}/other/showdown/25.gif`);
        expect(resolveExternalSpriteUrl(tree, 25, { animated: true, shiny: true })).toBe(`${POKEAPI_SPRITE_BASE}/other/showdown/shiny/25.gif`);
    });

    it('returns null without a URL', () => {
        expect(resolveExternalSpriteUrl('', 1)).toBeNull();
    });
});
