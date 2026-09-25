// ISSUE-40: display language and guessing language are independent user settings.
//
// - Guessing language (`pokepelago_language`): what the guess engine accepts.
//   Default `global` (= accept any language the engine knows).
//   A seed can supply a default via the APWorld `guess_language` YAML option
//   (`pokepelago_seed_guess_language`) — applied only when the player has not
//   picked their own guess language (the site selector wins otherwise).
// - Display language (`pokepelago_display_language`): what the dex grid,
//   details modal and log show. Default `en`. Never seeded by the YAML.

// Language codes match the PokeAPI `language.name` field returned by the pokemon-species endpoint.
export const POKEMON_LANGUAGES = [
    { code: 'global',  label: 'Global',    flag: '🌐', langCode: null      },
    { code: 'en',      label: 'English',   flag: '🇬🇧', langCode: 'en'     },
    { code: 'fr',      label: 'Français',  flag: '🇫🇷', langCode: 'fr'     },
    { code: 'de',      label: 'Deutsch',   flag: '🇩🇪', langCode: 'de'     },
    { code: 'es',      label: 'Español',   flag: '🇪🇸', langCode: 'es'     },
    { code: 'it',      label: 'Italiano',  flag: '🇮🇹', langCode: 'it'     },
    { code: 'ja',      label: '日本語',     flag: '🇯🇵', langCode: 'ja'     },
    { code: 'roomaji', label: 'Romaji',     flag: '🇯🇵', langCode: 'ja-Hrkt'},
    { code: 'ko',      label: '한국어',     flag: '🇰🇷', langCode: 'ko'     },
    { code: 'zh-Hant', label: '繁體中文',   flag: '🇹🇼', langCode: 'zh-Hant'},
    { code: 'zh-Hans', label: '简体中文',   flag: '🇨🇳', langCode: 'zh-Hans'},
] as const;

export type LanguageCode = typeof POKEMON_LANGUAGES[number]['code'];

export const GUESS_LANGUAGE_KEY = 'pokepelago_language';
export const DISPLAY_LANGUAGE_KEY = 'pokepelago_display_language';
export const SEED_GUESS_LANGUAGE_KEY = 'pokepelago_seed_guess_language';
export const LANGUAGE_CHANGED_EVENT = 'pokepelago_language_changed';

const LANGUAGE_CODES = POKEMON_LANGUAGES.map(l => l.code) as readonly string[];

// A "concrete" language is one the engine can match against (Global matches all,
// so it is the only non-concrete entry).
export const DISPLAY_LANGUAGES = POKEMON_LANGUAGES.filter(l => l.code !== 'global');

export function isLanguageCode(value: string): value is LanguageCode {
    return (LANGUAGE_CODES as readonly string[]).includes(value);
}

function read(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* quota exceeded — ignore */ }
}

export function notifyLanguageChanged(): void {
    window.dispatchEvent(new Event(LANGUAGE_CHANGED_EVENT));
}

/** Effective guess language: player preference -> seed default (YAML) -> global. */
export function getGuessLanguage(): LanguageCode {
    const stored = read(GUESS_LANGUAGE_KEY);
    if (stored && isLanguageCode(stored)) return stored;
    const seeded = read(SEED_GUESS_LANGUAGE_KEY);
    if (seeded && isLanguageCode(seeded)) return seeded;
    return 'global';
}

/**
 * Effective display language: explicit setting -> one-time legacy migration ->
 * English. Before ISSUE-40 the single language selector drove display too; a user
 * who had picked e.g. German gets that copied into the new display setting once so
 * they see no change after upgrading. Afterwards the two settings are independent.
 */
export function getDisplayLanguage(): LanguageCode {
    const stored = read(DISPLAY_LANGUAGE_KEY);
    if (stored && isLanguageCode(stored)) return stored;
    const legacy = read(GUESS_LANGUAGE_KEY);
    if (legacy && legacy !== 'global' && isLanguageCode(legacy)) {
        write(DISPLAY_LANGUAGE_KEY, legacy);
        return legacy;
    }
    return 'en';
}

export function setGuessLanguage(code: LanguageCode): void {
    write(GUESS_LANGUAGE_KEY, code);
    notifyLanguageChanged();
}

export function setDisplayLanguage(code: LanguageCode): void {
    write(DISPLAY_LANGUAGE_KEY, code);
    notifyLanguageChanged();
}

/**
 * Apply the APWorld YAML option once the server sends slot_data. Only seeds the
 * default when the player has never picked a guess language themselves, so the
 * YAML sets the initial preference and the site selector still wins afterwards.
 */
export function applySeedGuessLanguage(code: string): void {
    if (!isLanguageCode(code)) return;
    if (read(GUESS_LANGUAGE_KEY)) return;
    write(SEED_GUESS_LANGUAGE_KEY, code);
}