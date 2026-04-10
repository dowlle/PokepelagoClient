import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { useTwitch } from '../context/TwitchContext';
import { getCleanName } from '../utils/pokemon';
import { CreditsModal } from './CreditsModal';
import { useGuessEngine, POKEMON_LANGUAGES, pokemonNames, type LanguageCode } from '../hooks/useGuessEngine';
import { useTwitchChat } from '../hooks/useTwitchChat';
import { PokeLogo } from './PokeLogo';

export const GlobalGuessInput: React.FC = () => {
    const { allPokemon, checkedIds, isPokemonGuessable, activePokemonLimit, releasedIds, toast, showToast, STARTER_OFFSET, MILESTONE_OFFSET, goalCount, gameMode } = useGame();
    const { addGuess } = useTwitch();
    const [guess, setGuess] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [isCreditsOpen, setIsCreditsOpen] = useState(false);

    // Language selector state
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(() =>
        (localStorage.getItem('pokepelago_language') as LanguageCode) ?? 'global'
    );
    const [langMenuOpen, setLangMenuOpen] = useState(false);

    const { matchesPokemon, displayName, attemptGuess } = useGuessEngine(selectedLanguage);

    // Twitch chat guessing (settings from localStorage, managed in SettingsPanel)
    const [twitchIntegration, setTwitchIntegration] = useState(() => localStorage.getItem('pokepelago_twitch_integration') === 'true');
    const [twitchEnabled, setTwitchEnabled] = useState(() => localStorage.getItem('pokepelago_twitch_enabled') === 'true');
    const [twitchChannel, setTwitchChannel] = useState(() => localStorage.getItem('pokepelago_twitch_channel') ?? '');
    useEffect(() => {
        const handler = () => {
            setTwitchIntegration(localStorage.getItem('pokepelago_twitch_integration') === 'true');
            setTwitchEnabled(localStorage.getItem('pokepelago_twitch_enabled') === 'true');
            setTwitchChannel(localStorage.getItem('pokepelago_twitch_channel') ?? '');
        };
        window.addEventListener('storage', handler);
        window.addEventListener('pokepelago_twitch_changed', handler);
        window.addEventListener('pokepelago_twitch_integration_changed', handler);
        return () => {
            window.removeEventListener('storage', handler);
            window.removeEventListener('pokepelago_twitch_changed', handler);
            window.removeEventListener('pokepelago_twitch_integration_changed', handler);
        };
    }, []);
    useTwitchChat({ enabled: __TWITCH_ENABLED__ && twitchIntegration && twitchEnabled, channelName: twitchChannel, selectedLanguage });

    // Close language menu when clicking outside
    useEffect(() => {
        if (!langMenuOpen) return;
        const close = () => setLangMenuOpen(false);
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [langMenuOpen]);

    const handleSelectLanguage = (code: LanguageCode) => {
        setSelectedLanguage(code);
        localStorage.setItem('pokepelago_language', code);
        setLangMenuOpen(false);
    };

    // Debug trigger (dev/beta only)
    useEffect(() => {
        if (!import.meta.env.DEV && !__IS_BETA__) return;
        if (guess.toLowerCase().trim() === 'myuncleworksatnintendo') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((window as any).toggleDebug) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).toggleDebug();
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setGuess('');
            }
        }
    }, [guess]);

    const checkedIdsRef = useRef(checkedIds);
    const isPokemonGuessableRef = useRef(isPokemonGuessable);
    const releasedIdsRef = useRef(releasedIds);

    useEffect(() => {
        checkedIdsRef.current = checkedIds;
        isPokemonGuessableRef.current = isPokemonGuessable;
        releasedIdsRef.current = releasedIds;
    }, [checkedIds, isPokemonGuessable, releasedIds]);

    // Expose auto-complete for debug (dev/beta only)
    useEffect(() => {
        if (!import.meta.env.DEV && !__IS_BETA__) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).runAutoComplete = async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).isAutoCompleting = true;
            console.log("Starting Auto-Complete Simulation...");

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            while ((window as any).isAutoCompleting) {
                let guessedThisLoop = false;
                for (const p of allPokemon) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    if (!(window as any).isAutoCompleting) break;

                    const id = p.id;
                    if (checkedIdsRef.current.has(id) && !releasedIdsRef.current.has(id)) continue;

                    const guessCheck = isPokemonGuessableRef.current(id);
                    if (!guessCheck.canGuess) continue;

                    guessedThisLoop = true;
                    setGuess(p.name);
                    // Must be longer than the auto-submit debounce (250ms) so the guess actually fires
                    await new Promise(r => setTimeout(r, 350));
                }

                if (!guessedThisLoop) {
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            setGuess('');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).isAutoCompleting = false;
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).stopAutoComplete = () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).isAutoCompleting = false;
        };
    }, [allPokemon]);

    // Auto-submit logic (debounced to prevent premature matches, e.g. "Hypno" while typing "Hypnomade")
    useEffect(() => {
        const normalised = guess.toLowerCase().trim();
        if (normalised.length < 3) return;

        const timer = setTimeout(() => {
            const match = allPokemon.find(p => {
                if (!matchesPokemon(p, normalised)) return false;
                if (checkedIds.has(p.id) && !releasedIds.has(p.id)) return false;
                return isPokemonGuessable(p.id).canGuess || releasedIds.has(p.id);
            });

            if (match) {
                const result = attemptGuess(guess);
                if ((result.type === 'success' || result.type === 'recaught') && result.pokemonId != null && result.pokemonName) {
                    addGuess(result.pokemonId, result.pokemonName, null, result.type);
                }
                showToast(result.type, result.message);
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setGuess('');
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [guess, allPokemon, checkedIds, isPokemonGuessable, releasedIds, matchesPokemon, attemptGuess, showToast, addGuess]);

    const handleManualGuess = (name: string) => {
        const result = attemptGuess(name);
        if ((result.type === 'success' || result.type === 'recaught') && result.pokemonId != null && result.pokemonName) {
            addGuess(result.pokemonId, result.pokemonName, null, result.type);
        }
        showToast(result.type, result.message);
        if (result.type !== 'error') setGuess('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!guess.trim()) return;
        handleManualGuess(guess);
    };

    const currentLang = POKEMON_LANGUAGES.find(l => l.code === selectedLanguage) ?? POKEMON_LANGUAGES[0];

    return (
        <>
        <div className="relative z-30 shrink-0 themed-header" style={{ backgroundColor: 'var(--pp-bg-base)', borderBottom: '1px solid var(--pp-border)' }}>
            <div className="max-w-7xl mx-auto flex items-center gap-3 px-2 py-2 sm:px-4 sm:py-3">
                {/* Logo */}
                <div className="hidden sm:flex items-center gap-1.5">
                    <PokeLogo size="sm" onClick={() => setIsCreditsOpen(true)} />
                    {__IS_BETA__ && <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-900/30 border border-amber-700/50 rounded px-1.5 py-0.5">beta</span>}
                </div>
                {/* Mobile beta badge — visible when logo is hidden */}
                {__IS_BETA__ && (
                    <span className="sm:hidden text-[9px] font-bold uppercase tracking-widest text-amber-400 bg-amber-900/30 border border-amber-700/50 rounded px-1.5 py-0.5 shrink-0">beta</span>
                )}

                {/* Input */}
                <form onSubmit={handleSubmit} className="flex-1 relative max-w-md">
                    <input
                        ref={inputRef}
                        type="text"
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        placeholder="Name a Pokémon..."
                        className="w-full px-3 py-1.5 rounded text-white text-sm outline-none transition-colors"
                        style={{ backgroundColor: 'var(--pp-input-bg)', border: '1px solid var(--pp-input-border)' }}
                        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--pp-input-focus)'}
                        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--pp-input-border)'}
                        autoComplete="off"
                        spellCheck={false}
                        data-tour="guess-input"
                    />
                </form>

                {/* Language Selector */}
                <div className="relative" data-tour="lang-selector">
                    <button
                        type="button"
                        onClick={() => setLangMenuOpen(prev => !prev)}
                        title="Guess language"
                        className="flex items-center gap-1 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm hover:border-green-500 transition-colors select-none"
                    >
                        <span>{currentLang.flag}</span>
                        <span className="text-gray-400 text-xs hidden sm:inline">{currentLang.label}</span>
                        <span className="text-gray-500 text-[10px]">▾</span>
                    </button>

                    {langMenuOpen && (
                        <div
                            className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-700 rounded shadow-xl z-50 min-w-max"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            {POKEMON_LANGUAGES.map(lang => (
                                <button
                                    key={lang.code}
                                    type="button"
                                    onClick={() => handleSelectLanguage(lang.code)}
                                    className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-800 transition-colors ${selectedLanguage === lang.code ? 'text-green-400 font-semibold' : 'text-gray-200'}`}
                                >
                                    <span className="w-5 text-center">{lang.flag}</span>
                                    <span>{lang.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Stats: guessed pokémon / goal */}
                {(() => {
                    const guessedCount = Array.from(checkedIds).filter(id =>
                        id >= 1 && id <= 1025 &&
                        !(id >= STARTER_OFFSET && id < STARTER_OFFSET + 20) &&
                        id < MILESTONE_OFFSET &&
                        !releasedIds.has(id)
                    ).length;
                    const displayGoal = goalCount ?? activePokemonLimit;
                    const isGoalMet = guessedCount >= displayGoal;
                    return (
                        <div className="hidden sm:flex items-center gap-1 text-sm whitespace-nowrap" data-tour="stats-counter">
                            <span className={`font-bold ${isGoalMet ? 'text-yellow-400' : 'text-green-400'}`}>
                                {guessedCount}
                            </span>
                            <span className="text-gray-500">/</span>
                            <span className="text-gray-300">{displayGoal}</span>
                        </div>
                    );
                })()}

                {/* Feedback toast */}
                {toast && (
                    <div key={toast.id} className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all animate-fade-in z-50 whitespace-nowrap ${toast.type === 'success' || toast.type === 'recaught' ? 'bg-green-600 text-white' :
                        toast.type === 'already' ? 'bg-yellow-600 text-white' :
                            toast.type === 'trap' ? 'bg-purple-600 text-white font-bold' :
                                'bg-red-600 text-white'
                        }`}>
                        {toast.message}
                    </div>
                )}

                {/* Debug Hints (dev/beta only) */}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(import.meta.env.DEV || __IS_BETA__) && (window as any).isDebugVisible && guess.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded shadow-xl max-h-48 overflow-y-auto z-50">
                        {allPokemon
                            .filter(p => {
                                const clean = getCleanName(p.name).toLowerCase();
                                let isMatch = clean.includes(guess.toLowerCase());

                                if (!isMatch) {
                                    const langNames = pokemonNames[p.id.toString()] ?? {};
                                    isMatch = Object.values(langNames).some(loc => loc.toLowerCase().includes(guess.toLowerCase()));
                                }

                                return isMatch && !checkedIds.has(p.id);
                            })
                            .slice(0, 10)
                            .map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setGuess(displayName(p));
                                        inputRef.current?.focus();
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-gray-800 text-xs flex justify-between items-center"
                                >
                                    <span>{displayName(p)}</span>
                                    {gameMode === 'standalone' ? (
                                        <span className="text-gray-500 text-[10px] uppercase">Available</span>
                                    ) : isPokemonGuessable(p.id).canGuess ? (
                                        <span className="text-green-500 text-[10px] uppercase font-bold">Unlocked</span>
                                    ) : (
                                        <span className="text-gray-500 text-[10px] uppercase">Locked</span>
                                    )}
                                </button>
                            ))}
                    </div>
                )}
            </div>
        </div>
        <CreditsModal isOpen={isCreditsOpen} onClose={() => setIsCreditsOpen(false)} />
        </>
    );
};
