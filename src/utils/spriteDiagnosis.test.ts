import { describe, it, expect } from 'vitest';
import { diagnoseSprites, type SpriteDiagnosisInput } from './spriteDiagnosis';
import { POKEAPI_SPRITE_BASE } from './pokesprite';

const none = { loaded: 0, failed: 0 };

function input(overrides: Partial<SpriteDiagnosisInput> = {}): SpriteDiagnosisInput {
    return {
        enableSprites: true,
        spriteSet: 'normal',
        localCount: 0,
        repoUrl: '',
        repoTest: null,
        health: { local: none, repo: none, derpemon: none },
        cache: { stalledCount: 0, emptyCount: 0 },
        ...overrides,
    };
}

describe('diagnoseSprites (#41)', () => {
    it('reports no source when nothing is set, even though the cache holds 1025 empty entries', () => {
        const d = diagnoseSprites(input({ cache: { stalledCount: 0, emptyCount: 1025 } }));
        expect(d.problem).toBe('no-source');
        expect(d.sources).toEqual({ local: 'unused', repo: 'unused', derpemon: 'unused' });
    });

    it('reports sprites switched off before anything else', () => {
        expect(diagnoseSprites(input({ enableSprites: false, repoUrl: POKEAPI_SPRITE_BASE, repoTest: 'ok' })).problem).toBe('sprites-off');
        expect(diagnoseSprites(input({ enableSprites: false })).problem).toBe('sprites-off');
    });

    it('is fine with a working PokeAPI source', () => {
        const d = diagnoseSprites(input({
            repoUrl: POKEAPI_SPRITE_BASE,
            repoTest: 'ok',
            health: { local: none, repo: { loaded: 40, failed: 0 }, derpemon: none },
        }));
        expect(d.problem).toBeNull();
        expect(d.sources.repo).toBe('ok');
    });

    it('is checking while the test sprite is pending and nothing loaded yet', () => {
        const d = diagnoseSprites(input({ repoUrl: POKEAPI_SPRITE_BASE }));
        expect(d.problem).toBeNull();
        expect(d.sources.repo).toBe('checking');
    });

    it('maps the one-sprite test result to wrong URL or blocked', () => {
        const url = 'https://raw.githubusercontent.com/PokeAPI/sprites/main/wrong';
        expect(diagnoseSprites(input({ repoUrl: url, repoTest: 'not-found' })).problem).toBe('not-found');
        expect(diagnoseSprites(input({ repoUrl: url, repoTest: 'unreachable' })).problem).toBe('unreachable');
        expect(diagnoseSprites(input({ repoUrl: url, repoTest: 'http-error' })).problem).toBe('unreachable');
    });

    it('flags a URL that cannot be a sprite folder', () => {
        expect(diagnoseSprites(input({ repoUrl: 'pokeapi sprites' })).problem).toBe('bad-url');
        expect(diagnoseSprites(input({ repoUrl: 'https://github.com/PokeAPI/sprites' })).problem).toBe('bad-url');
    });

    it('reports a broken repo URL even when local imports exist', () => {
        const d = diagnoseSprites(input({ localCount: 500, repoUrl: 'https://example.com/nope', repoTest: 'not-found' }));
        expect(d.problem).toBe('not-found');
        expect(d.sources.local).toBe('ok');
    });

    it('treats grid failures with a passing test as partly missing, and all failing as unreachable', () => {
        const partial = diagnoseSprites(input({
            repoUrl: POKEAPI_SPRITE_BASE,
            repoTest: 'ok',
            health: { local: none, repo: { loaded: 30, failed: 5 }, derpemon: none },
        }));
        expect(partial.problem).toBe('some-missing');
        const all = diagnoseSprites(input({
            repoUrl: POKEAPI_SPRITE_BASE,
            repoTest: 'ok',
            health: { local: none, repo: { loaded: 0, failed: 12 }, derpemon: none },
        }));
        expect(all.problem).toBe('unreachable');
    });

    it('reports stuck sprites for stalled cache entries', () => {
        const d = diagnoseSprites(input({ repoUrl: POKEAPI_SPRITE_BASE, repoTest: 'ok', cache: { stalledCount: 3, emptyCount: 0 } }));
        expect(d.problem).toBe('stuck');
    });

    it('reports stuck sprites for cached "no sprite" entries left from before a URL was set', () => {
        const d = diagnoseSprites(input({ repoUrl: POKEAPI_SPRITE_BASE, repoTest: 'ok', cache: { stalledCount: 0, emptyCount: 200 } }));
        expect(d.problem).toBe('stuck');
    });

    it('accepts empty cache entries with local imports only (IDs the import does not cover)', () => {
        const d = diagnoseSprites(input({
            localCount: 151,
            health: { local: { loaded: 20, failed: 0 }, repo: none, derpemon: none },
            cache: { stalledCount: 0, emptyCount: 874 },
        }));
        expect(d.problem).toBeNull();
    });

    it('counts the Derpemon set as a source', () => {
        const d = diagnoseSprites(input({ spriteSet: 'derpemon' }));
        expect(d.problem).toBeNull();
        expect(d.sources.derpemon).toBe('ok');
        const failing = diagnoseSprites(input({ spriteSet: 'derpemon', health: { local: none, repo: none, derpemon: { loaded: 0, failed: 9 } } }));
        expect(failing.problem).toBe('unreachable');
    });
});
