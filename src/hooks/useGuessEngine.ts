import { useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { getCleanName } from '../utils/pokemon';
import pokemonNamesJson from '../data/pokemon_names.json';

// Language codes match the PokeAPI `language.name` field returned by the pokemon-species endpoint.
export const POKEMON_LANGUAGES = [
    { code: 'global',  label: 'Global',    flag: '🌐', langCode: null      },
    { code: 'en',      label: 'English',   flag: '🇬🇧', langCode: 'en'     },
    { code: 'fr',      label: 'Français',  flag: '🇫🇷', langCode: 'fr'     },
    { code: 'de',      label: 'Deutsch',   flag: '🇩🇪', langCode: 'de'     },
    { code: 'es',      label: 'Español',   flag: '🇪🇸', langCode: 'es'     },
    { code: 'it',      label: 'Italiano',  flag: '🇮🇹', langCode: 'it'     },
    { code: 'ja',      label: '日本語',     flag: '🇯🇵', langCode: 'ja'     },
    { code: 'roomaji', label: 'ローマ字',   flag: '🇯🇵', langCode: 'ja-Hrkt'},
    { code: 'ko',      label: '한국어',     flag: '🇰🇷', langCode: 'ko'     },
    { code: 'zh-Hant', label: '繁體中文',   flag: '🇹🇼', langCode: 'zh-Hant'},
    { code: 'zh-Hans', label: '简体中文',   flag: '🇨🇳', langCode: 'zh-Hans'},
] as const;

export type LanguageCode = typeof POKEMON_LANGUAGES[number]['code'];

const LEGACY_LANG_ORDER = ['ja', 'ja-Hrkt', 'ko', 'zh-Hant', 'fr', 'de', 'en', 'zh-Hans'];

type NamesMap = Record<string, Record<string, string>>;

function normalisePokemonNames(raw: Record<string, unknown>): NamesMap {
    const result: NamesMap = {};
    for (const [id, val] of Object.entries(raw)) {
        if (Array.isArray(val)) {
            const keyed: Record<string, string> = {};
            (val as string[]).forEach((name, i) => {
                if (name && LEGACY_LANG_ORDER[i]) keyed[LEGACY_LANG_ORDER[i]] = name;
            });
            result[id] = keyed;
        } else if (val && typeof val === 'object') {
            result[id] = val as Record<string, string>;
        }
    }
    return result;
}

export const pokemonNames: NamesMap = normalisePokemonNames(pokemonNamesJson as Record<string, unknown>);

export type GuessResult = {
    type: 'success' | 'error' | 'already' | 'recaught';
    message: string;
    pokemonName?: string;
    pokemonId?: number;
};

export function useGuessEngine(selectedLanguage: LanguageCode) {
    const {
        allPokemon, checkedIds, checkPokemon, gameMode,
        isPokemonGuessable, releasedIds, recatchPokemon,
        startGame, startingLocationsEnabled, gameStarted,
    } = useGame();

    const matchesPokemon = useCallback((p: typeof allPokemon[0], normalised: string): boolean => {
        const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        const sn = strip(normalised);

        const strMatches = (s: string): boolean => {
            const sl = s.toLowerCase();
            const sc = getCleanName(s).toLowerCase();
            return sl === normalised || sc === normalised ||
                (sn !== '' && (strip(sl) === sn || strip(sc) === sn));
        };

        const raw = p.name.toLowerCase();
        const clean = getCleanName(p.name).toLowerCase();
        const englishMatch = raw === normalised || clean === normalised ||
            (sn !== '' && (strip(raw) === sn || strip(clean) === sn));

        const langNames: Record<string, string> = pokemonNames[p.id.toString()] ?? {};
        const enSpeciesMatch = langNames['en'] ? strMatches(langNames['en']) : false;

        if (selectedLanguage === 'en') return englishMatch || enSpeciesMatch;

        if (selectedLanguage === 'global') {
            if (englishMatch || enSpeciesMatch) return true;
            return Object.values(langNames).some(name => strMatches(name));
        }

        const langDef = POKEMON_LANGUAGES.find(l => l.code === selectedLanguage);
        if (!langDef || langDef.langCode === null) return false;
        const locName = langNames[langDef.langCode];
        return locName ? strMatches(locName) : false;
    }, [selectedLanguage]);

    const displayName = useCallback((p: typeof allPokemon[0]): string => {
        const names = pokemonNames[p.id.toString()];
        const local = selectedLanguage !== 'global' && names?.[selectedLanguage];
        return local || getCleanName(p.name);
    }, [selectedLanguage]);

    const attemptGuess = useCallback((name: string): GuessResult => {
        const normalised = name.toLowerCase().trim();
        const match = allPokemon.find(p => matchesPokemon(p, normalised));

        if (!match) {
            return { type: 'error', message: `✗ ${normalised}` };
        }

        if (releasedIds.has(match.id)) {
            recatchPokemon(match.id);
            return { type: 'recaught', message: `Re-caught ${displayName(match)}!`, pokemonName: displayName(match), pokemonId: match.id };
        }

        if (checkedIds.has(match.id)) {
            return { type: 'already', message: `Already guessed ${displayName(match)}`, pokemonName: displayName(match), pokemonId: match.id };
        }

        const guessCheck = isPokemonGuessable(match.id);
        if (!guessCheck.canGuess) {
            const reason = gameMode === 'standalone' ? 'Generation Locked' : (guessCheck.reason || 'Not found or not unlocked');
            return { type: 'error', message: `✗ ${reason}` };
        }

        if (startingLocationsEnabled && !gameStarted && gameMode === 'archipelago') startGame();
        checkPokemon(match.id);
        return { type: 'success', message: `✓ ${displayName(match)}!`, pokemonName: displayName(match), pokemonId: match.id };
    }, [allPokemon, matchesPokemon, displayName, checkedIds, releasedIds, isPokemonGuessable, checkPokemon, recatchPokemon, gameMode, startingLocationsEnabled, gameStarted, startGame]);

    return { matchesPokemon, displayName, attemptGuess };
}
