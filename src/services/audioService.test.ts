import { describe, expect, it } from 'vitest';
import { customSoundMarker, isCustomSoundMarker } from './audioService';

describe('audioService markers', () => {
    it('stores only a lightweight IndexedDB marker in UI settings', () => {
        const marker = customSoundMarker(123);
        expect(marker).toBe('indexeddb:123');
        expect(isCustomSoundMarker(marker)).toBe(true);
        expect(isCustomSoundMarker('')).toBe(false);
        expect(marker.length).toBeLessThan(32);
    });
});
