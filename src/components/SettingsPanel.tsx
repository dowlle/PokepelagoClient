import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { GENERATIONS } from '../types/pokemon';
import { X, Server, Wifi, LayoutGrid, Maximize, Image, Trash2, Upload, Link2, ChevronDown, Filter, Monitor } from 'lucide-react';
import { importFromFiles, clearAllSprites } from '../services/spriteService';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    isEmbedded?: boolean;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, isEmbedded = false }) => {
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
        spriteCount,
        refreshSpriteCount,
        gameMode,
        setGameMode,
        spriteRepoUrl,
        setSpriteRepoUrl,
        connectionQuality,
        derpemonSpriteCount
    } = useGame();

    const [isConnecting, setIsConnecting] = useState(false);
    const [importProgress, setImportProgress] = useState<number | null>(null);

    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('pokepelago_settings_sections');
            return saved ? JSON.parse(saved) : { connection: true, generations: true, sprites: false, interface: false };
        } catch {
            return { connection: true, generations: true, sprites: false, interface: false };
        }
    });

    const toggleSection = (key: string) => {
        setOpenSections(prev => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem('pokepelago_settings_sections', JSON.stringify(next));
            return next;
        });
    };

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

    const selectAll = () => setGenerationFilter([0]);

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsConnecting(true);
        await connect(connectionInfo);
        setIsConnecting(false);
    };

    const updateInfo = (updates: Partial<typeof connectionInfo>) => {
        setConnectionInfo(prev => ({ ...prev, ...updates }));
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setIsConnecting(true);
            const count = await importFromFiles(e.target.files, (current) => {
                setImportProgress(current);
            });
            await refreshSpriteCount();
            setIsConnecting(false);
            setImportProgress(null);
            alert(`Successfully imported ${count} sprites! Reloading game...`);
            window.location.reload();
        }
    };

    const handleClearSprites = async () => {
        if (confirm('Are you sure you want to clear all imported sprites? This will revert to placeholders.')) {
            await clearAllSprites();
            await refreshSpriteCount();
        }
    };

    const AccordionHeader = ({
        sectionKey, icon, label, badge
    }: {
        sectionKey: string;
        icon: React.ReactNode;
        label: string;
        badge?: React.ReactNode;
    }) => (
        <button
            onClick={() => toggleSection(sectionKey)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/60 hover:bg-gray-800/60 transition-colors"
        >
            <h3 className={`font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2 ${isEmbedded ? 'text-[10px]' : 'text-xs'}`}>
                {icon}
                {label}
                {badge}
            </h3>
            <ChevronDown
                size={14}
                className={`text-gray-600 transition-transform duration-200 ${openSections[sectionKey] ? 'rotate-180' : ''}`}
            />
        </button>
    );

    const settingsContent = (
        <div className={`space-y-2 ${isEmbedded ? 'p-4 pb-4' : 'p-6'}`}>

            {/* Connection */}
            <section className="border border-gray-800 rounded-xl overflow-hidden">
                <AccordionHeader
                    sectionKey="connection"
                    icon={<Server size={13} className="text-blue-400" />}
                    label="Connection"
                    badge={isConnected ? <span className="text-[9px] text-green-400 bg-green-900/20 px-1.5 py-0.5 rounded border border-green-700/30 normal-case font-normal tracking-normal">● Active</span> : undefined}
                />
                {openSections['connection'] && (
                    <div className="px-4 py-4 space-y-4 border-t border-gray-800">
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

            {/* Sprite Management */}
            <section className="border border-gray-800 rounded-xl overflow-hidden">
                <AccordionHeader
                    sectionKey="sprites"
                    icon={<Image size={13} className="text-yellow-400" />}
                    label="Sprite Management"
                    badge={spriteCount > 0 ? <span className="text-[9px] text-yellow-400 bg-yellow-900/20 px-1.5 py-0.5 rounded border border-yellow-700/30 normal-case font-normal tracking-normal">{spriteCount} local</span> : undefined}
                />
                {openSections['sprites'] && (
                    <div className="px-4 py-4 border-t border-gray-800">
                        <div className="bg-gray-800/20 border border-gray-800 rounded-xl p-4 space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="text-xs font-bold text-gray-200">Local Sprites</div>
                                    <div className="text-[10px] text-gray-500">{spriteCount} sprites in storage</div>
                                </div>
                                {spriteCount > 0 && (
                                    <button onClick={handleClearSprites} className="p-2 text-red-500 hover:bg-red-950/30 rounded-lg transition-colors" title="Clear All Sprites">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Sprite Set */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                    <span>Sprite Set</span>
                                    {uiSettings.spriteSet === 'derpemon' && derpemonSpriteCount > 0 && (
                                        <span className="text-[9px] text-purple-400 bg-purple-900/20 px-1.5 py-0.5 rounded border border-purple-700/30">{derpemonSpriteCount} sprites</span>
                                    )}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => updateUiSettings({ spriteSet: 'normal' })} className={`py-2 px-3 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all border ${uiSettings.spriteSet !== 'derpemon' ? 'bg-blue-600/20 border-blue-500/50 text-blue-200' : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:bg-gray-800/80'}`}>
                                        Normal
                                    </button>
                                    <button onClick={() => updateUiSettings({ spriteSet: 'derpemon' })} className={`py-2 px-3 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all border ${uiSettings.spriteSet === 'derpemon' ? 'bg-purple-600/20 border-purple-500/50 text-purple-200' : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:bg-gray-800/80'}`}>
                                        Derpémon 🐾
                                    </button>
                                </div>
                                {uiSettings.spriteSet === 'derpemon' && (
                                    <p className="text-[9px] text-gray-600 italic">
                                        Sprites by the community • <a href="https://github.com/TheShadowOfLight/DerpemonCommunityProject" target="_blank" rel="noreferrer" className="text-purple-500 hover:underline">Derpemon Community Project ↗</a>
                                    </p>
                                )}
                            </div>

                            <label className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-700/50 rounded-xl hover:bg-gray-800/80 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-2">
                                    <Image size={16} className="text-yellow-400 group-hover:scale-110 transition-transform" />
                                    <div>
                                        <div className="text-xs font-bold text-gray-200">Enable Custom Sprites</div>
                                        <div className="text-[9px] text-gray-500">Show downloaded sprite packs</div>
                                    </div>
                                </div>
                                <input type="checkbox" checked={uiSettings.enableSprites} onChange={(e) => updateUiSettings({ enableSprites: e.target.checked })} className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-yellow-600 focus:ring-yellow-500" />
                            </label>

                            {/* Sprite Repo URL */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                    <Link2 size={14} className="text-blue-400" />
                                    Sprite Repo URL
                                </label>
                                <div className="flex gap-2">
                                    <input type="url" value={spriteRepoUrl} onChange={(e) => setSpriteRepoUrl(e.target.value)} placeholder="https://github.com/PokeAPI/sprites/tree/master/sprites" className="flex-1 bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors" />
                                    {spriteRepoUrl && (
                                        <button onClick={() => setSpriteRepoUrl('')} className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors" title="Clear URL">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-[9px] text-gray-600 italic">
                                    Paste a GitHub sprites tree URL to load sprites directly. Local imports take priority.
                                    Try: <a href="https://github.com/PokeAPI/sprites/tree/master/sprites" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">PokeAPI sprites</a>
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-700 rounded-xl hover:bg-gray-800/40 hover:border-gray-600 transition-all cursor-pointer group">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload size={24} className="text-gray-500 group-hover:text-blue-400 mb-2" />
                                        <p className="text-[11px] text-gray-400 group-hover:text-gray-200 font-bold uppercase tracking-tighter">
                                            {importProgress !== null ? `Processing ${importProgress}...` : 'Import Sprite Folder'}
                                        </p>
                                        <p className="text-[9px] text-gray-600">
                                            {importProgress !== null ? 'Please wait' : "Select the 'sprites' directory"}
                                        </p>
                                    </div>
                                    <input type="file" className="hidden" multiple {...{ webkitdirectory: '', directory: '' } as any} onChange={handleImport} />
                                </label>
                                <p className="text-[9px] text-gray-500 italic text-center">
                                    Check the <a href="https://github.com/dowlle/Pokepelago#1-download-the-sprites" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white underline">Poképelago README</a> for sprite pack instructions.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Interface */}
            <section className="border border-gray-800 rounded-xl overflow-hidden">
                <AccordionHeader
                    sectionKey="interface"
                    icon={<Monitor size={13} className="text-purple-400" />}
                    label="Interface"
                />
                {openSections['interface'] && (
                    <div className="px-4 py-4 space-y-4 border-t border-gray-800">
                        <div className={`grid gap-3 ${isEmbedded ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            <label className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded hover:bg-gray-800/50 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-2">
                                    <Maximize size={16} className="text-purple-400 group-hover:scale-110 transition-transform" />
                                    <div>
                                        <div className="text-xs font-bold text-gray-200">Widescreen</div>
                                        <div className="text-[9px] text-gray-500">Full page width</div>
                                    </div>
                                </div>
                                <input type="checkbox" checked={uiSettings.widescreen} onChange={(e) => updateUiSettings({ widescreen: e.target.checked })} className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-purple-500" />
                            </label>
                            <label className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded hover:bg-gray-800/50 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-2">
                                    <LayoutGrid size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                                    <div>
                                        <div className="text-xs font-bold text-gray-200">Fit Regions</div>
                                        <div className="text-[9px] text-gray-500">Remove gaps</div>
                                    </div>
                                </div>
                                <input type="checkbox" checked={uiSettings.masonry} onChange={(e) => updateUiSettings({ masonry: e.target.checked })} className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-emerald-600 focus:ring-emerald-500" />
                            </label>
                            <label className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded hover:bg-gray-800/50 transition-colors cursor-pointer group">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full bg-blue-950 border border-blue-800 opacity-40 group-hover:scale-110 transition-transform" />
                                    <div>
                                        <div className="text-xs font-bold text-gray-200">Enable Shadows</div>
                                        <div className="text-[9px] text-gray-500">Show silhouettes for unexplored Pokémon</div>
                                    </div>
                                </div>
                                <input type="checkbox" checked={uiSettings.enableShadows} onChange={(e) => updateUiSettings({ enableShadows: e.target.checked })} className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500" />
                            </label>
                        </div>
                        <div className="pt-2 border-t border-gray-800/50">
                            <button
                                onClick={() => {
                                    if (confirm('Reset Game Mode? This will return you to the splash screen. Your local progress (imported sprites and checked/guessed Pokémon) will NOT be deleted.')) {
                                        setGameMode(null);
                                    }
                                }}
                                className="w-full py-2 bg-red-950/10 hover:bg-red-950/20 text-red-400/60 hover:text-red-400 border border-red-900/20 hover:border-red-500/30 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Reset Game Mode
                            </button>
                        </div>
                    </div>
                )}
            </section>

        </div>
    );

    if (isEmbedded) {
        return <div className="h-full overflow-y-auto custom-scrollbar">{settingsContent}</div>;
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/50">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Server className="text-blue-400" />
                        Settings
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-all">
                        <X size={20} />
                    </button>
                </div>
                <div className="overflow-y-auto custom-scrollbar">
                    {settingsContent}
                </div>
                <div className="p-6 border-t border-gray-800 bg-gray-950/50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition-all border border-gray-700">
                        CLOSE
                    </button>
                </div>
            </div>
        </div>
    );
};
