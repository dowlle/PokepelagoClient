import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { GENERATIONS } from '../types/pokemon';
import { Server, Wifi, Image, Filter, BookOpen, Settings } from 'lucide-react';
import { ConnectionManager } from './ConnectionManager';
import { getProfiles, saveProfile } from '../services/connectionManagerService';
import type { GameProfile } from '../services/connectionManagerService';
import { AccordionHeader } from './settings/AccordionHeader';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    isEmbedded?: boolean;
    onOpenModal?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, isEmbedded = false, onOpenModal }) => {
    const {
        generationFilter,
        setGenerationFilter,
        connect,
        isConnected,
        connectionError,
        disconnect,
        uiSettings,
        updateUiSettings,
        connectionInfo,
        setConnectionInfo,
        pingLatency,
        gameMode,
        setGameMode,
        connectionQuality,
        derpemonSpriteCount,
        currentProfileId,
        setCurrentProfileId,
    } = useGame();

    const [isConnecting, setIsConnecting] = useState(false);
    const [isManagerOpen, setIsManagerOpen] = useState(false);

    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('pokepelago_settings_sections');
            return saved ? JSON.parse(saved) : { connection: true, generations: true, sprites: false };
        } catch {
            return { connection: true, generations: true, sprites: false };
        }
    });

    const toggleSection = (key: string) => {
        setOpenSections(prev => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem('pokepelago_settings_sections', JSON.stringify(next));
            return next;
        });
    };

    // Listen for tour requests to open specific accordion sections
    React.useEffect(() => {
        const handler = (e: Event) => {
            const section = (e as CustomEvent).detail as string;
            setOpenSections(prev => {
                if (prev[section]) return prev;
                const next = { ...prev, [section]: true };
                localStorage.setItem('pokepelago_settings_sections', JSON.stringify(next));
                return next;
            });
        };
        window.addEventListener('pokepelago_tour_open_section', handler);
        return () => window.removeEventListener('pokepelago_tour_open_section', handler);
    }, []);

    if (!isOpen && !isEmbedded) return null;

    const toggleGen = (index: number) => {
        setGenerationFilter((prev: number[]) => {
            if (prev.includes(index)) {
                if (prev.length === 1) return prev;
                return prev.filter((i: number) => i !== index);
            }
            return [...prev, index];
        });
    };

    const selectAll = () => setGenerationFilter(GENERATIONS.map((_, i) => i));

    const isGameSaved = (() => {
        if (!isConnected) return false;
        if (currentProfileId) return getProfiles().some(p => p.id === currentProfileId);
        return getProfiles().some(p =>
            p.hostname === connectionInfo.hostname &&
            p.port === connectionInfo.port &&
            p.slotName === connectionInfo.slotName
        );
    })();

    const handleSaveToManager = () => {
        const profiles = getProfiles();
        const existing = currentProfileId
            ? profiles.find(p => p.id === currentProfileId)
            : profiles.find(p =>
                p.hostname === connectionInfo.hostname &&
                p.port === connectionInfo.port &&
                p.slotName === connectionInfo.slotName
            );
        if (!existing) {
            const newProfile: GameProfile = {
                id: crypto.randomUUID(),
                name: `${connectionInfo.slotName} @ ${connectionInfo.hostname}:${connectionInfo.port}`,
                hostname: connectionInfo.hostname,
                port: connectionInfo.port,
                slotName: connectionInfo.slotName,
                password: connectionInfo.password,
                isGoaled: false,
                lastConnected: Date.now(),
            };
            saveProfile(newProfile);
            setCurrentProfileId(newProfile.id);
        }
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setCurrentProfileId(null);
        setIsConnecting(true);
        await connect(connectionInfo);
        setIsConnecting(false);
    };

    const updateInfo = (updates: Partial<typeof connectionInfo>) => {
        setConnectionInfo(prev => ({ ...prev, ...updates }));
    };

    const handleConnectProfile = async (profile: GameProfile) => {
        setCurrentProfileId(profile.id);
        // Build one canonical connInfo used for both form state and connect() call.
        // password must be '' not undefined -- JSON.stringify omits undefined fields,
        // which can cause the AP server to reject the Connect packet.
        const connInfo = {
            hostname: profile.hostname,
            port: profile.port,
            slotName: profile.slotName,
            password: profile.password || '',
        };
        setConnectionInfo(connInfo);
        setIsConnecting(true);
        await connect(connInfo, profile.id);
        setIsConnecting(false);
    };

    const settingsContent = (
        <div className={`space-y-2 ${isEmbedded ? 'p-4 pb-4' : 'p-6'}`}>

            {/* Connection */}
            <section className="border border-gray-800 rounded-xl overflow-hidden">
                <AccordionHeader
                    sectionKey="connection"
                    icon={<Server size={13} className="text-blue-400" />}
                    label="Connection"
                    badge={isConnected ? <span className="text-[9px] text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded border border-green-700/30 normal-case font-normal tracking-normal">● Active</span> : undefined}
                    isEmbedded={isEmbedded}
                    openSections={openSections}
                    toggleSection={toggleSection}
                />
                {openSections['connection'] && (
                    <div className="px-4 py-4 space-y-4 border-t border-gray-800">
                        <button
                            onClick={() => setIsManagerOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg text-xs text-gray-400 hover:text-gray-200 font-bold uppercase tracking-wider transition-colors"
                        >
                            <BookOpen size={12} />
                            Manage Games
                        </button>
                        {!isConnected ? (
                            gameMode === 'standalone' ? (
                                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 text-center space-y-3">
                                    <p className="text-[10px] text-gray-400">You are currently playing in <strong>Standalone Mode</strong>. Progress is saved locally in your browser.</p>
                                    <button
                                        onClick={() => {
                                            if (confirm('Switch to Archipelago mode? Your local guess progress will remain, but game logic will sync with the server.')) {
                                                setGameMode('archipelago');
                                            }
                                        }}
                                        className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded text-xs font-bold transition-colors"
                                    >
                                        SWITCH TO ARCHIPELAGO
                                    </button>
                                </div>
                            ) : (
                                <>
                                <form onSubmit={handleConnect} className="space-y-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2">
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-tight">Server</label>
                                            <input type="text" value={connectionInfo.hostname} onChange={(e) => updateInfo({ hostname: e.target.value })} className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-xs text-white outline-none focus:border-blue-500" placeholder="archipelago.gg" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-tight">Port</label>
                                            <input type="number" value={connectionInfo.port} onChange={(e) => updateInfo({ port: Number(e.target.value) })} className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-xs text-white outline-none focus:border-blue-500" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-tight">Slot Name</label>
                                            <input type="text" value={connectionInfo.slotName} onChange={(e) => updateInfo({ slotName: e.target.value })} className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-xs text-white outline-none focus:border-blue-500" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-tight">Password</label>
                                            <input type="password" value={connectionInfo.password} onChange={(e) => updateInfo({ password: e.target.value })} className="w-full px-2 py-1.5 bg-gray-950 border border-gray-700 rounded text-xs text-white outline-none focus:border-blue-500" />
                                        </div>
                                    </div>
                                    {connectionError && <div className="text-[10px] text-red-400 bg-red-900/10 p-2 rounded border border-red-900/30">{connectionError}</div>}
                                    <button type="submit" disabled={isConnecting} className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-gray-400 text-white rounded text-xs font-bold transition-colors shadow-lg shadow-blue-900/20">
                                        {isConnecting ? 'CONNECTING...' : 'CONNECT'}
                                    </button>
                                </form>
                                <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 text-center space-y-3">
                                    <p className="text-[10px] text-gray-400">Not playing with Archipelago? Switch to <strong>Standalone Mode</strong> to freely guess all Pokemon.</p>
                                    <button
                                        onClick={() => {
                                            if (confirm('Switch to Standalone Mode? Your guess progress will remain.')) {
                                                setGameMode('standalone');
                                            }
                                        }}
                                        className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded text-xs font-bold transition-colors"
                                    >
                                        SWITCH TO STANDALONE
                                    </button>
                                </div>
                                </>
                            )
                        ) : (
                            <div className={`border rounded p-4 flex flex-col gap-3 ${connectionQuality === 'dead' ? 'bg-red-900/10 border-red-800/30' : connectionQuality === 'degraded' ? 'bg-yellow-900/10 border-yellow-800/30' : 'bg-green-900/10 border-green-800/30'}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${connectionQuality === 'dead' ? 'bg-red-900/30 text-red-400' : connectionQuality === 'degraded' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-green-900/30 text-green-400'}`}>
                                            <Wifi size={16} />
                                        </div>
                                        <div>
                                            <div className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${connectionQuality === 'dead' ? 'text-red-400' : connectionQuality === 'degraded' ? 'text-yellow-400' : 'text-green-400'}`}>
                                                {connectionQuality === 'dead' ? 'Lost Connection' : connectionQuality === 'degraded' ? 'Unstable' : 'Connected'}
                                                {pingLatency !== null && connectionQuality !== 'dead' && (
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${connectionQuality === 'degraded' ? 'bg-yellow-500/20 text-yellow-300' : pingLatency < 100 ? 'bg-green-500/20 text-green-300' : pingLatency < 300 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-500/20 text-red-300'}`}>
                                                        {pingLatency}ms
                                                    </span>
                                                )}
                                                {connectionQuality === 'degraded' && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 animate-pulse">No response</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-gray-400">as {connectionInfo.slotName}</div>
                                        </div>
                                    </div>
                                    <button onClick={disconnect} className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors border border-gray-700">DISCONNECT</button>
                                </div>
                                <button
                                    onClick={isGameSaved ? undefined : handleSaveToManager}
                                    disabled={isGameSaved}
                                    className={`w-full py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border ${isGameSaved ? 'bg-green-900/20 text-green-400 border-green-700/30 cursor-default' : 'bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-gray-200 border-gray-700 hover:border-gray-600'}`}
                                >
                                    {isGameSaved ? 'SAVED' : 'SAVE TO GAME MANAGER'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Generations */}
            <section className="border border-gray-800 rounded-xl overflow-hidden">
                <AccordionHeader
                    sectionKey="generations"
                    icon={<Filter size={13} className="text-emerald-400" />}
                    label="Generations"
                    badge={isConnected ? <span className="text-[9px] text-blue-400 bg-blue-900/10 px-1.5 py-0.5 rounded border border-blue-900/30 normal-case font-normal tracking-normal">Synced</span> : undefined}
                    isEmbedded={isEmbedded}
                    openSections={openSections}
                    toggleSection={toggleSection}
                />
                {openSections['generations'] && (
                    <div className="px-4 py-4 space-y-3 border-t border-gray-800">
                        {!isConnected && (
                            <div className="flex justify-end text-[10px] uppercase tracking-wide">
                                <button onClick={selectAll} className="text-blue-400 hover:text-blue-300">All</button>
                            </div>
                        )}
                        <div className={`grid gap-2 ${isEmbedded ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                            {GENERATIONS.map((gen, index) => {
                                const isSelected = generationFilter.includes(index);
                                return (
                                    <button
                                        key={gen.label}
                                        onClick={() => !isConnected && toggleGen(index)}
                                        disabled={isConnected}
                                        className={`px-3 py-2 rounded border text-left transition-all relative overflow-hidden group ${isSelected ? 'bg-blue-600/10 border-blue-500 text-blue-100' : 'bg-gray-800/30 border-gray-700 text-gray-500 hover:bg-gray-800 hover:border-gray-600'} ${isConnected ? 'cursor-not-allowed opacity-60' : ''}`}
                                    >
                                        <div className="font-bold text-[11px] relative z-10">{gen.label}</div>
                                        <div className="text-[9px] opacity-60 relative z-10 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis">{gen.region}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </section>

            {/* Sprite Set */}
            <section className="border border-gray-800 rounded-xl overflow-hidden">
                <AccordionHeader
                    sectionKey="sprites"
                    icon={<Image size={13} className="text-yellow-400" />}
                    label="Sprites"
                    badge={uiSettings.spriteSet === 'derpemon' && derpemonSpriteCount > 0 ? <span className="text-[9px] text-purple-400 bg-purple-900/20 px-1.5 py-0.5 rounded border border-purple-700/30 normal-case font-normal tracking-normal">{derpemonSpriteCount} sprites</span> : undefined}
                    isEmbedded={isEmbedded}
                    openSections={openSections}
                    toggleSection={toggleSection}
                />
                {openSections['sprites'] && (
                    <div className="px-4 py-4 border-t border-gray-800">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                <span>Sprite Set</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => updateUiSettings({ spriteSet: 'normal' })} className={`py-2 px-3 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all border ${uiSettings.spriteSet !== 'derpemon' ? 'bg-blue-600/20 border-blue-500/50 text-blue-200' : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:bg-gray-800/80'}`}>
                                    Normal
                                </button>
                                <button onClick={() => updateUiSettings({ spriteSet: 'derpemon' })} className={`py-2 px-3 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all border ${uiSettings.spriteSet === 'derpemon' ? 'bg-purple-600/20 border-purple-500/50 text-purple-200' : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:bg-gray-800/80'}`}>
                                    Derpemon
                                </button>
                            </div>
                            {uiSettings.spriteSet === 'derpemon' && (
                                <p className="text-[9px] text-gray-600 italic">
                                    Sprites by the community <a href="https://github.com/TheShadowOfLight/DerpemonCommunityProject" target="_blank" rel="noreferrer" className="text-purple-500 hover:underline">Derpemon Community Project</a>
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </section>

            {/* More Settings */}
            {onOpenModal && (
                <button
                    onClick={onOpenModal}
                    className="w-full flex items-center justify-center gap-2 py-3 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                    <Settings size={14} />
                    More Settings...
                </button>
            )}

        </div>
    );

    const managerModal = (
        <ConnectionManager
            isOpen={isManagerOpen}
            onClose={() => setIsManagerOpen(false)}
            onConnect={handleConnectProfile}
        />
    );

    return (
        <>
            <div className="h-full overflow-y-auto custom-scrollbar">{settingsContent}</div>
            {managerModal}
        </>
    );
};
