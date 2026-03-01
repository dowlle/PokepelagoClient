import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { getCleanName } from '../utils/pokemon';
import pokemonNames from '../data/pokemon_names.json';

export const GlobalGuessInput: React.FC = () => {
    const { allPokemon, checkedIds, checkPokemon, gameMode, isPokemonGuessable, activePokemonLimit, releasedIds, setReleasedIds, toast, showToast, STARTER_OFFSET, MILESTONE_OFFSET, goalCount } = useGame();
    const [guess, setGuess] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Debug trigger
    useEffect(() => {
        if (guess.toLowerCase().trim() === 'myuncleworksatnintendo') {
            if ((window as any).toggleDebug) {
                (window as any).toggleDebug();
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

    // Expose auto-complete for debug
    useEffect(() => {
        (window as any).runAutoComplete = async () => {
            (window as any).isAutoCompleting = true;
            console.log("Starting Auto-Complete Simulation...");

            // We need to continuously re-evaluate allPokemon because logic state changes.
            // Loop until complete or stopped
            while ((window as any).isAutoCompleting) {
                let guessedThisLoop = false;
                for (const p of allPokemon) {
                    if (!(window as any).isAutoCompleting) break;

                    const id = p.id;
                    // Skip if already checked AND not released (released = must re-guess)
                    if (checkedIdsRef.current.has(id) && !releasedIdsRef.current.has(id)) continue;

                    const guessCheck = isPokemonGuessableRef.current(id);
                    if (!guessCheck.canGuess) continue;

                    guessedThisLoop = true;
                    setGuess(p.name);
                    await new Promise(r => setTimeout(r, 80)); // Visual typing speed
                }

                // If we didn't guess anything this loop, wait a moment before trying again to avoid CPU spin
                if (!guessedThisLoop) {
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            setGuess('');
            (window as any).isAutoCompleting = false;
        };

        (window as any).stopAutoComplete = () => {
            (window as any).isAutoCompleting = false;
        };
    }, [allPokemon]);

    // Auto-submit logic
    useEffect(() => {
        const normalised = guess.toLowerCase().trim();
        if (normalised.length < 3) return; // Wait for at least 3 chars to avoid too many matches

        // Try to find a match that is unlocked and not yet checked
        const match = allPokemon.find(p => {
            const clean = getCleanName(p.name).toLowerCase();
            const raw = p.name.toLowerCase();
            const strip = (s: string) => s.replace(/[^a-z0-9]/g, '');

            const strippedNormalised = strip(normalised);

            let isMatch = raw === normalised ||
                clean === normalised ||
                (strippedNormalised !== '' && (strip(raw) === strippedNormalised || strip(clean) === strippedNormalised));

            if (!isMatch) {
                // Check localized names
                const localizedNames: string[] = (pokemonNames as Record<string, string[]>)[p.id.toString()] || [];
                for (const locName of localizedNames) {
                    const cleanLoc = getCleanName(locName).toLowerCase();
                    const rawLoc = locName.toLowerCase();
                    if (rawLoc === normalised || cleanLoc === normalised || (strippedNormalised !== '' && (strip(rawLoc) === strippedNormalised || strip(cleanLoc) === strippedNormalised))) {
                        isMatch = true;
                        break;
                    }
                }
            }

            if (!isMatch) return false;
            // Allow checking if it's in releasedIds even if it's in checkedIds
            if (checkedIds.has(p.id) && !releasedIds.has(p.id)) return false;

            // Check all unlock conditions (gen filters, region lock, type lock, dexsanity, etc.)
            return isPokemonGuessable(p.id).canGuess || releasedIds.has(p.id);
        });

        if (match) {
            if (releasedIds.has(match.id)) {
                // Re-caught a released Pokemon
                setReleasedIds(prev => {
                    const next = new Set(prev);
                    next.delete(match.id);
                    return next;
                });
                showToast('recaught', `Re-caught ${getCleanName(match.name)}!`);
            } else {
                // Success! Auto-submit
                checkPokemon(match.id);
                showToast('success', `✓ ${getCleanName(match.name)}!`);
            }
            setGuess('');
        }
    }, [guess, allPokemon, checkedIds, checkPokemon, isPokemonGuessable, releasedIds, setReleasedIds]);

    const attemptGuess = (name: string) => {
        const normalised = name.toLowerCase().trim();
        // Find matching pokemon
        const match = allPokemon.find(p => {
            const clean = getCleanName(p.name).toLowerCase();
            const raw = p.name.toLowerCase();
            const strip = (s: string) => s.replace(/[^a-z0-9]/g, '');

            const strippedNormalised = strip(normalised);

            let isMatch = raw === normalised ||
                clean === normalised ||
                (strippedNormalised !== '' && (strip(raw) === strippedNormalised || strip(clean) === strippedNormalised));

            if (!isMatch) {
                // Check localized names
                const localizedNames: string[] = (pokemonNames as Record<string, string[]>)[p.id.toString()] || [];
                for (const locName of localizedNames) {
                    const cleanLoc = getCleanName(locName).toLowerCase();
                    const rawLoc = locName.toLowerCase();
                    if (rawLoc === normalised || cleanLoc === normalised || (strippedNormalised !== '' && (strip(rawLoc) === strippedNormalised || strip(cleanLoc) === strippedNormalised))) {
                        isMatch = true;
                        break;
                    }
                }
            }

            return isMatch;
        });

        if (!match) {
            showToast('error', `✗ ${normalised}`);
            return;
        }

        if (releasedIds.has(match.id)) {
            // Re-caught a released Pokemon
            setReleasedIds(prev => {
                const next = new Set(prev);
                next.delete(match.id);
                return next;
            });
            showToast('recaught', `Re-caught ${getCleanName(match.name)}!`);
            setGuess('');
            return;
        }

        if (checkedIds.has(match.id)) {
            showToast('already', `Already guessed ${getCleanName(match.name)}`);
            setGuess('');
            return;
        }

        const guessCheck = isPokemonGuessable(match.id);
        if (!guessCheck.canGuess) {
            // Correct name, but blocked by some lock condition
            const reason = gameMode === 'standalone' ? 'Generation Locked' : (guessCheck.reason || 'Not found or not unlocked');
            showToast('error', `✗ ${reason}`);
            return;
        }

        // Success!
        checkPokemon(match.id);
        showToast('success', `✓ ${getCleanName(match.name)}!`);
        setGuess('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!guess.trim()) return;
        attemptGuess(guess);
    };

    return (
        <div className="relative z-30 bg-gray-950 border-b border-gray-800 shrink-0">
            <div className="max-w-screen-xl mx-auto flex items-center gap-3 px-4 py-3">
                {/* Logo */}
                <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent whitespace-nowrap hidden sm:block">
                    Poképelago
                </h1>

                {/* Input */}
                <form onSubmit={handleSubmit} className="flex-1 relative max-w-md">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm whitespace-nowrap">Name a Pokémon:</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={guess}
                            onChange={(e) => setGuess(e.target.value)}
                            placeholder=""
                            className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm outline-none focus:border-green-500 transition-colors"
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>
                </form>

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
                        <div className="flex items-center gap-1 text-sm whitespace-nowrap">
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

                {/* Debug Hints */}
                {window && (window as any).isDebugVisible && guess.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded shadow-xl max-h-48 overflow-y-auto z-50">
                        {allPokemon
                            .filter(p => {
                                const clean = getCleanName(p.name).toLowerCase();
                                let isMatch = clean.includes(guess.toLowerCase());

                                if (!isMatch) {
                                    const localizedNames: string[] = (pokemonNames as Record<string, string[]>)[p.id.toString()] || [];
                                    isMatch = localizedNames.some(loc => loc.toLowerCase().includes(guess.toLowerCase()));
                                }

                                return isMatch && !checkedIds.has(p.id);
                            })
                            .slice(0, 10)
                            .map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setGuess(getCleanName(p.name));
                                        inputRef.current?.focus();
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-gray-800 text-xs flex justify-between items-center"
                                >
                                    <span>{getCleanName(p.name)}</span>
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
    );
};
