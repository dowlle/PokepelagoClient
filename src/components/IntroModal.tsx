import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Download, Gamepad2, Youtube } from 'lucide-react';
import { PokeLogo } from './PokeLogo';

// P0-6: first-run "What is Pokepelago?" card. Shown once on a fresh origin
// (before the guided tour) and re-openable from Settings. Answers the two
// onboarding gaps from Discord: where the .apworld + YAML live, and how the
// pieces fit together, without assuming the player already knows Archipelago.

const INTRO_SEEN_KEY = 'pokepelago_tour_intro_seen';
const INTRO_OPEN_EVENT = 'pokepelago_intro_open';
// Deep-link to the newest release so the download stays correct across versions.
const RELEASE_LATEST_URL = 'https://github.com/dowlle/PokepelagoClient/releases/latest';
// YouTube walkthrough — filmed separately; link appears only once this is set.
const WALKTHROUGH_URL = '';

export const IntroModal: React.FC = () => {
    // Auto-open on a fresh origin. Read the flag in the lazy initializer (not an
    // effect) so we don't trigger a cascading render — same pattern as VersionBanner.
    const [isOpen, setIsOpen] = useState<boolean>(() => {
        try { return localStorage.getItem(INTRO_SEEN_KEY) !== 'true'; } catch { return true; }
    });

    // Re-open on the replay event dispatched from Settings.
    useEffect(() => {
        const handler = () => setIsOpen(true);
        window.addEventListener(INTRO_OPEN_EVENT, handler);
        return () => window.removeEventListener(INTRO_OPEN_EVENT, handler);
    }, []);

    const close = useCallback(() => {
        try { localStorage.setItem(INTRO_SEEN_KEY, 'true'); } catch { /* ignore quota/private mode */ }
        setIsOpen(false);
    }, []);

    // Escape-to-close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, close]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={close}>
            <div
                className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-800 flex flex-col max-h-[90vh] overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-800 bg-gray-950/60 shrink-0 flex flex-col items-center gap-3 relative">
                    <button
                        onClick={close}
                        className="absolute top-3 right-3 p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                    <PokeLogo size="sm" />
                    <p className="text-sm text-gray-400 text-center max-w-sm leading-relaxed">
                        A Pok&eacute;mon guessing game for the Archipelago multiworld randomizer:
                        recall a Pok&eacute;mon&apos;s name to catch it, unlocking more as your run progresses.
                    </p>
                </div>

                {/* Body — three panels */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
                    <div className="flex gap-4 items-start rounded-xl border border-gray-800 bg-gray-800/20 p-4">
                        <div className="p-2 bg-gray-800 rounded-lg text-green-400 shrink-0">
                            <Sparkles size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-200 mb-1">1. What it is</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                This is the companion tracker. Lock gates (gym badges, type keys, evolution lines, and more)
                                decide which Pok&eacute;mon you can guess; you receive the items that open them from the multiworld.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start rounded-xl border border-gray-800 bg-gray-800/20 p-4">
                        <div className="p-2 bg-gray-800 rounded-lg text-emerald-400 shrink-0">
                            <Download size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-200 mb-1">2. Get the .apworld + YAML</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Grab <code className="text-gray-400">pokepelago.apworld</code> and the template{' '}
                                <code className="text-gray-400">Pokepelago.yaml</code> from the{' '}
                                <a
                                    href={RELEASE_LATEST_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 font-semibold"
                                >
                                    latest release
                                </a>. Install the .apworld into Archipelago, edit the YAML to taste, then generate or join a seed.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start rounded-xl border border-gray-800 bg-gray-800/20 p-4">
                        <div className="p-2 bg-gray-800 rounded-lg text-blue-400 shrink-0">
                            <Gamepad2 size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-200 mb-1">3. Connect &amp; guess</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Pick your guess language, connect to your server, and start typing Pok&eacute;mon names —
                                guesses auto-submit when they match. Click any Pok&eacute;mon to see what unlocks it and request a hint.
                            </p>
                        </div>
                    </div>

                    {WALKTHROUGH_URL && (
                        <a
                            href={WALKTHROUGH_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 rounded-xl border border-red-800/40 bg-red-900/10 hover:bg-red-900/20 p-3 text-xs font-bold text-red-300 hover:text-red-200 transition-colors"
                        >
                            <Youtube size={16} />
                            Watch the 4-minute walkthrough
                        </a>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-800 shrink-0 flex justify-end bg-gray-950/40">
                    <button
                        onClick={close}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};
