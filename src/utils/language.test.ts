// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
    getGuessLanguage,
    getDisplayLanguage,
    setGuessLanguage,
    setDisplayLanguage,
    applySeedGuessLanguage,
    clearSeedGuessLanguage,
    GUESS_LANGUAGE_KEY,
    DISPLAY_LANGUAGE_KEY,
    SEED_GUESS_LANGUAGE_KEY,
    isLanguageCode,
} from './language';

describe('language settings (ISSUE-40)', () => {
    beforeEach(() => localStorage.clear());

    it('defaults to global guessing / English display', () => {
        expect(getGuessLanguage()).toBe('global');
        expect(getDisplayLanguage()).toBe('en');
    });

    it('persists an explicitly chosen guess language', () => {
        setGuessLanguage('de');
        expect(localStorage.getItem(GUESS_LANGUAGE_KEY)).toBe('de');
        expect(getGuessLanguage()).toBe('de');
    });

    it('keeps display independent of the guess language once set', () => {
        setDisplayLanguage('en');
        setGuessLanguage('de');
        expect(getDisplayLanguage()).toBe('en');
        expect(getGuessLanguage()).toBe('de');
    });

    it('ignores the seed guess language for display', () => {
        applySeedGuessLanguage('de');
        expect(getGuessLanguage()).toBe('de');
        expect(getDisplayLanguage()).toBe('en');
    });

    it('migrates a legacy single-select language into display exactly once', () => {
        localStorage.setItem(GUESS_LANGUAGE_KEY, 'de');
        expect(getDisplayLanguage()).toBe('de');
        expect(localStorage.getItem(DISPLAY_LANGUAGE_KEY)).toBe('de');
        // Afterwards the two settings are independent.
        setGuessLanguage('en');
        expect(getDisplayLanguage()).toBe('de');
    });

    it('does not migrate a legacy global selection into display', () => {
        localStorage.setItem(GUESS_LANGUAGE_KEY, 'global');
        expect(getDisplayLanguage()).toBe('en');
        expect(localStorage.getItem(DISPLAY_LANGUAGE_KEY)).toBeNull();
    });

    it('applies the seed default only when no user preference exists', () => {
        applySeedGuessLanguage('fr');
        expect(getGuessLanguage()).toBe('fr');

        setGuessLanguage('en'); // player preference wins afterwards
        applySeedGuessLanguage('de');
        expect(getGuessLanguage()).toBe('en');
    });

    it('clears a stale seed default when a later seed omits the option', () => {
        applySeedGuessLanguage('fr');
        expect(getGuessLanguage()).toBe('fr');

        clearSeedGuessLanguage();
        expect(getGuessLanguage()).toBe('global');
    });

    it('keeps an explicit player choice when a seed default is cleared', () => {
        setGuessLanguage('de');
        clearSeedGuessLanguage();
        expect(getGuessLanguage()).toBe('de');
    });

    it('ignores invalid stored/seed values', () => {
        localStorage.setItem(GUESS_LANGUAGE_KEY, 'klingon');
        localStorage.setItem(SEED_GUESS_LANGUAGE_KEY, 'klingon');
        expect(getGuessLanguage()).toBe('global');

        localStorage.setItem(DISPLAY_LANGUAGE_KEY, 'klingon');
        expect(getDisplayLanguage()).toBe('en');
    });

    it('isLanguageCode validates codes', () => {
        expect(isLanguageCode('zh-Hant')).toBe(true);
        expect(isLanguageCode('roomaji')).toBe(true);
        expect(isLanguageCode('global')).toBe(true);
        expect(isLanguageCode('klingon')).toBe(false);
    });
});