import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Shield, Globe, Laptop, ArrowRight, Download, Github, BookOpen } from 'lucide-react';
import { ConnectionManager } from './ConnectionManager';
import { CreditsModal } from './CreditsModal';
import { PokeLogo } from './PokeLogo';
import type { GameProfile } from '../services/connectionManagerService';

export const SplashScreen: React.FC = () => {
    const { setGameMode, connect, setConnectionInfo, setCurrentProfileId } = useGame();
    const [isManagerOpen, setIsManagerOpen] = useState(false);
    const [isCreditsOpen, setIsCreditsOpen] = useState(false);

    const handleConnectProfile = async (profile: GameProfile) => {
        setCurrentProfileId(profile.id);
        setConnectionInfo({
            hostname: profile.hostname,
            port: profile.port,
            slotName: profile.slotName,
            password: profile.password || '',
        });
        setGameMode('archipelago');
        await connect({
            hostname: profile.hostname,
            port: profile.port,
            slotName: profile.slotName,
            password: profile.password,
        }, profile.id);
    };

    return (
        <>
        <div className="fixed inset-0 z-100 overflow-y-auto font-sans flex items-center justify-center p-4 themed-bg" style={{ backgroundColor: 'var(--pp-splash-bg)' }}>
            <div className="max-w-4xl w-full relative splash-pokeball">
                {/* Hero Section */}
                <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-1000 flex flex-col items-center">
                    <PokeLogo size="lg" onClick={() => setIsCreditsOpen(true)} />
                    <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--pp-text-secondary)' }}>
                        A modern, collection-focused Pokémon tracking experience designed for the Archipelago multi-world network.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 mb-12">
                    {/* Information Card */}
                    <div className="rounded-3xl p-8 backdrop-blur-sm animate-in fade-in slide-in-from-left-4 duration-700 delay-200" style={{ backgroundColor: 'var(--pp-bg-surface)', border: '1px solid var(--pp-border)' }}>
                        <div className="flex items-center gap-3 mb-6 text-green-400">
                            <Shield size={24} />
                            <h2 className="text-xl font-bold">Privacy & Sprites</h2>
                        </div>
                        <p className="text-gray-400 text-sm leading-relaxed mb-6">
                            To comply with community guidelines, this application does not host or serve any Nintendo-ripped assets.
                            <strong> All sprites must be sourced and imported by you.</strong>
                        </p>

                        <div className="space-y-4">
                            <div className="flex gap-4 items-start">
                                <div className="p-2 bg-gray-800 rounded-lg text-blue-400 shrink-0">
                                    <Github size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-200">Paste a Sprite URL (Easy)</h3>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Go to Settings and paste a GitHub sprites tree URL, or{' '}
                                        <button
                                            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                                            onClick={() => {
                                                localStorage.setItem('pokepelago_spriteRepoUrl', 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon');
                                                localStorage.setItem('pokepelago_defaultTab', 'settings');
                                                setGameMode('archipelago');
                                            }}
                                        >
                                            click here to use PokeAPI sprites and start playing
                                        </button>.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="p-2 bg-gray-800 rounded-lg text-emerald-400 shrink-0">
                                    <Download size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-200">Local Import (Offline)</h3>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Alternatively, import a sprite folder through the settings panel to store sprites locally in your browser.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Mode Selection */}
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-700 delay-300">
                        <button
                            onClick={() => {
                                localStorage.setItem('pokepelago_defaultTab', 'settings');
                                setGameMode('archipelago');
                            }}
                            className="group relative flex-1 text-left p-8 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 hover:border-blue-500/50 rounded-3xl transition-all duration-300 active:scale-[0.98]"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-900/20">
                                    <Globe className="text-white" size={28} />
                                </div>
                                <ArrowRight className="text-blue-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Connect to Archipelago</h3>
                            <p className="text-blue-200/60 text-sm leading-relaxed">
                                Sync your progress with a multi-world server. Track items, checks, and hints in real-time.
                            </p>
                        </button>

                        <button
                            onClick={() => setGameMode('standalone')}
                            className="group relative flex-1 text-left p-8 bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 hover:border-gray-600 rounded-3xl transition-all duration-300 active:scale-[0.98]"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-gray-700 rounded-2xl shadow-lg">
                                    <Laptop className="text-white" size={28} />
                                </div>
                                <ArrowRight className="text-gray-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-2">Play Standalone</h3>
                            <p className="text-gray-500 text-sm leading-relaxed">
                                Play offline as a pure Pokémon guessing game. No server connection required.
                            </p>
                        </button>
                    </div>
                </div>

                {/* Manage Games */}
                <div className="flex justify-center mb-4 animate-in fade-in duration-700 delay-400">
                    <button
                        onClick={() => setIsManagerOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-2xl text-sm text-gray-400 hover:text-gray-200 font-bold transition-all"
                    >
                        <BookOpen size={16} />
                        Manage Games
                    </button>
                </div>

                {/* Footer Info */}
                <div className="flex flex-wrap justify-center gap-8 text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 animate-in fade-in duration-1000 delay-500">
                    <a href="https://github.com/dowlle/PokepelagoClient" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                        <Github size={12} />
                        <span>Poképelago Client Repo</span>
                    </a>
                    <a href="https://github.com/dowlle/ArchipelagoPokepelago" target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                        <Github size={12} />
                        <span>Pokepelago Archipelago Repo</span>
                    </a>
                    <div className="flex items-center gap-2">
                        <Shield size={12} />
                        <span>Client-Side Storage Only</span>
                    </div>
                </div>
            </div>
        </div>
        <ConnectionManager
            isOpen={isManagerOpen}
            onClose={() => setIsManagerOpen(false)}
            onConnect={handleConnectProfile}
        />
        <CreditsModal
            isOpen={isCreditsOpen}
            onClose={() => setIsCreditsOpen(false)}
        />
        </>
    );
};
