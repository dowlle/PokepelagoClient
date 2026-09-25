import { describe, it, expect, beforeEach } from 'vitest';
import {
    recordSpriteImageLoaded,
    recordSpriteImageFailed,
    resetSpriteHealth,
    getSpriteHealthSnapshot,
    spriteSourceOf,
    testSpriteUrl,
    _resetSpriteHealthForTests,
} from './spriteHealth';
import { DERPEMON_RAW_BASE } from './derpemonService';

beforeEach(() => _resetSpriteHealthForTests());

describe('sprite health counts (#41)', () => {
    it('sorts URLs into sources', () => {
        expect(spriteSourceOf('blob:http://localhost/abc')).toBe('local');
        expect(spriteSourceOf(`${DERPEMON_RAW_BASE}/25%20-%20someone.png`)).toBe('derpemon');
        expect(spriteSourceOf('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png')).toBe('repo');
    });

    it('counts each URL once, and a later load clears an earlier failure', () => {
        const a = 'https://example.test/pokemon/1.png';
        const b = 'https://example.test/pokemon/2.png';
        recordSpriteImageLoaded(a);
        recordSpriteImageLoaded(a); // remount after a region toggle
        recordSpriteImageFailed(b);
        recordSpriteImageFailed(b);
        expect(getSpriteHealthSnapshot().repo).toEqual({ loaded: 1, failed: 1 });
        recordSpriteImageLoaded(b);
        expect(getSpriteHealthSnapshot().repo).toEqual({ loaded: 2, failed: 0 });
        recordSpriteImageFailed(a);
        expect(getSpriteHealthSnapshot().repo).toEqual({ loaded: 2, failed: 0 });
    });

    it('keeps the snapshot stable until something changes, and resets', () => {
        recordSpriteImageLoaded('blob:x');
        const first = getSpriteHealthSnapshot();
        expect(getSpriteHealthSnapshot()).toBe(first);
        resetSpriteHealth();
        const after = getSpriteHealthSnapshot();
        expect(after).not.toBe(first);
        expect(after.local).toEqual({ loaded: 0, failed: 0 });
    });
});

describe('testSpriteUrl', () => {
    const url = 'https://example.test/pokemon/1.png';

    it('is ok when the image loads, without a fetch', async () => {
        let fetched = false;
        const result = await testSpriteUrl(url, {
            loadImage: async () => true,
            fetchStatus: async () => { fetched = true; return 200; },
        });
        expect(result).toBe('ok');
        expect(fetched).toBe(false);
    });

    it('classifies a 404 as not found', async () => {
        expect(await testSpriteUrl(url, { loadImage: async () => false, fetchStatus: async () => 404 })).toBe('not-found');
    });

    it('classifies a 200 that is not an image as not found', async () => {
        expect(await testSpriteUrl(url, { loadImage: async () => false, fetchStatus: async () => 200 })).toBe('not-found');
    });

    it('classifies other HTTP errors separately', async () => {
        expect(await testSpriteUrl(url, { loadImage: async () => false, fetchStatus: async () => 503 })).toBe('http-error');
    });

    it('classifies a request that throws as unreachable (blocked or offline)', async () => {
        expect(await testSpriteUrl(url, {
            loadImage: async () => false,
            fetchStatus: async () => { throw new TypeError('Failed to fetch'); },
        })).toBe('unreachable');
    });
});
