// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GlobalGuessInput } from './GlobalGuessInput';

const { twitchChatCalls, gameState } = vi.hoisted(() => ({
    twitchChatCalls: [] as Array<{ enabled: boolean; channelName: string; selectedLanguage: string }>,
    gameState: {
        guessLang: 'de' as string,
        displayLang: 'en' as string,
    },
}));

vi.mock('../context/GameContext', () => ({
    useGame: () => ({
        allPokemon: [],
        checkedIds: new Set<number>(),
        isPokemonGuessable: () => ({ canGuess: false }),
        activePokemonLimit: 151,
        releasedIds: new Set<number>(),
        toast: null,
        showToast: vi.fn(),
        STARTER_OFFSET: 10000,
        MILESTONE_OFFSET: 20000,
        goalCount: 151,
        gameMode: 'archipelago',
        uiSettings: { stopAutosubmitOnGoal: false },
        guessLang: gameState.guessLang,
        displayLang: gameState.displayLang,
        setGuessLang: vi.fn(),
        setDisplayLang: vi.fn(),
    }),
}));
vi.mock('../context/TwitchContext', () => ({ useTwitch: () => ({ addGuess: vi.fn() }) }));
vi.mock('../hooks/useTwitchChat', () => ({
    useTwitchChat: (opts: { enabled: boolean; channelName: string; selectedLanguage: string }) => {
        twitchChatCalls.push(opts);
    },
}));
vi.mock('./CreditsModal', () => ({ CreditsModal: () => null }));
vi.mock('./PokeLogo', () => ({ PokeLogo: () => null }));

describe('GlobalGuessInput language selectors (ISSUE-40)', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        twitchChatCalls.length = 0;
        gameState.guessLang = 'de';
        gameState.displayLang = 'en';
        localStorage.clear();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        container.remove();
        localStorage.clear();
    });

    it('passes global to Twitch chat even when the guess language is not global', () => {
        act(() => { root.render(createElement(GlobalGuessInput)); });
        expect(twitchChatCalls.at(-1)).toMatchObject({ selectedLanguage: 'global' });
    });

    it('labels the two language selectors distinctly so they are not confused', () => {
        act(() => { root.render(createElement(GlobalGuessInput)); });
        const buttonText = Array.from(container.querySelectorAll('button')).map(b => b.textContent ?? '');
        expect(buttonText.some(t => t.includes('Guess'))).toBe(true);
        expect(buttonText.some(t => t.includes('Show'))).toBe(true);
    });
});
