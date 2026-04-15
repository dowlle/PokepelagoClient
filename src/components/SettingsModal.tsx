import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Image, Trash2, Upload, Link2, Monitor, Maximize, LayoutGrid, Tv, LogIn, LogOut, Palette, Eye, Settings } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { importFromFiles, clearAllSprites } from '../services/spriteService';
import { getTwitchAuthUrl, getTwitchUsername, clearTwitchAuth, hasTwitchClientId } from '../services/twitchAuthService';
import { THEMES } from '../utils/themes';
import type { ThemeId } from '../utils/themes';
import { ObsOverlayBuilder } from './settings/ObsOverlayBuilder';

type SettingsTab = 'interface' | 'sprites' | 'twitch';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const {
        uiSettings,
        updateUiSettings,
        spriteCount,
        refreshSpriteCount,
        setGameMode,
        spriteRepoUrl,
        setSpriteRepoUrl,
        pmdSpriteUrl,
        setPmdSpriteUrl,
        connectionInfo,
        isConnected,
    } = useGame();

    const [activeTab, setActiveTab] = useState<SettingsTab>('interface');

    // Sprite import state
    const [importProgress, setImportProgress] = useState<number | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    // Twitch settings (persisted in localStorage, read by useTwitchChat in GlobalGuessInput)
    const [twitchEnabled, setTwitchEnabled] = useState(() => localStorage.getItem('pokepelago_twitch_enabled') === 'true');
    const [twitchChannel, setTwitchChannel] = useState(() => localStorage.getItem('pokepelago_twitch_channel') ?? '');
    const [twitchAuthUser, setTwitchAuthUser] = useState(() => getTwitchUsername());
    const [chatFeedback, setChatFeedback] = useState(() => localStorage.getItem('pokepelago_twitch_chat_feedback') !== 'false');
    const [twitchIntegration, setTwitchIntegration] = useState(() => localStorage.getItem('pokepelago_twitch_integration') === 'true');

    // Listen for auth changes
    React.useEffect(() => {
        const handler = () => setTwitchAuthUser(getTwitchUsername());
        window.addEventListener('pokepelago_twitch_auth_changed', handler);
        return () => window.removeEventListener('pokepelago_twitch_auth_changed', handler);
    }, []);

    // Listen for tour requests to switch tabs (tour dispatches section names as tab keys)
    React.useEffect(() => {
        const handler = (e: Event) => {
            const section = (e as CustomEvent).detail as string;
            if (section === 'interface' || section === 'sprites' || section === 'twitch') {
                setActiveTab(section);
            }
        };
        window.addEventListener('pokepelago_tour_open_section', handler);
        return () => window.removeEventListener('pokepelago_tour_open_section', handler);
    }, []);

    // Escape-to-close
    React.useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setIsImporting(true);
            const count = await importFromFiles(e.target.files, (current) => {
                setImportProgress(current);
            });
            await refreshSpriteCount();
            setIsImporting(false);
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

    if (!isOpen) return null;

    const tabs: Array<{ key: SettingsTab; label: string; icon: React.ReactNode; visible: boolean; badge?: React.ReactNode }> = [
        { key: 'interface', label: 'Interface', icon: <Monitor size={14} />, visible: true },
        { key: 'sprites', label: 'Sprites', icon: <Image size={14} />, visible: true, badge: spriteCount > 0 ? <span className="text-[9px] text-yellow-400 bg-yellow-900/20 px-1.5 py-0.5 rounded border border-yellow-700/30">{spriteCount}</span> : undefined },
        { key: 'twitch', label: 'Twitch', icon: <Tv size={14} />, visible: twitchIntegration, badge: twitchEnabled && twitchChannel ? <span className="text-[9px] text-purple-400 bg-purple-900/20 px-1.5 py-0.5 rounded border border-purple-700/30">Active</span> : undefined },
    ];

    return createPortal(
        <div
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-800 flex flex-col max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-0 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-3">
                        <Settings className="text-blue-400" size={20} />
                        Settings
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Tab bar */}
                <div className="flex px-6 pt-4 gap-1" style={{ borderBottom: '1px solid var(--pp-border)' }}>
                    {tabs.filter(t => t.visible).map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors rounded-t-lg ${
                                activeTab === tab.key
                                    ? 'text-blue-400 bg-blue-900/20 border-b-2 border-blue-500 -mb-px'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                            {tab.badge}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    <div className="p-6">

                        {/* Interface tab */}
                        {activeTab === 'interface' && (
                            <div className="space-y-4">
                                {/* Theme Selector */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                        <Palette size={14} className="text-amber-400" />
                                        Theme
                                    </label>
                                    <div className="grid gap-2 grid-cols-2">
                                        {THEMES.map(theme => {
                                            const isActive = uiSettings.theme === theme.id;
                                            const previewColors: Record<ThemeId, { from: string; to: string; accent: string }> = {
                                                default: { from: '#4ADE80', to: '#10B981', accent: '#3B82F6' },
                                                pokemon: { from: '#EF4444', to: '#EAB308', accent: '#DC2626' },
                                            };
                                            const colors = previewColors[theme.id];
                                            return (
                                                <button
                                                    key={theme.id}
                                                    onClick={() => updateUiSettings({ theme: theme.id })}
                                                    className={`relative p-3 rounded-xl border text-left transition-all ${
                                                        isActive
                                                            ? 'border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                                                            : 'border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/50'
                                                    }`}
                                                    style={isActive ? { backgroundColor: `${colors.accent}10` } : undefined}
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-16 h-2 rounded-full" style={{ background: `linear-gradient(to right, ${colors.from}, ${colors.to})` }} />
                                                        {isActive && <span className="text-[9px] text-amber-400 font-bold uppercase">Active</span>}
                                                    </div>
                                                    <div className="text-[11px] font-bold text-gray-200">{theme.label}</div>
                                                    <div className="text-[9px] text-gray-500">{theme.description}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid gap-3 grid-cols-2">
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
                                    <label data-tour="shadow-toggle" className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded hover:bg-gray-800/50 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-blue-950 border border-blue-800 opacity-40 group-hover:scale-110 transition-transform" />
                                            <div>
                                                <div className="text-xs font-bold text-gray-200">Enable Shadows</div>
                                                <div className="text-[9px] text-gray-500">Show silhouettes for unexplored Pokemon</div>
                                            </div>
                                        </div>
                                        <input type="checkbox" checked={uiSettings.enableShadows} onChange={(e) => updateUiSettings({ enableShadows: e.target.checked })} className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500" />
                                    </label>
                                    <label className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded hover:bg-gray-800/50 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full group-hover:scale-110 transition-transform" style={{ background: 'linear-gradient(135deg, #7AC74C 50%, #6390F0 50%)' }} />
                                            <div>
                                                <div className="text-xs font-bold text-gray-200">Type-Colored Dot</div>
                                                <div className="text-[9px] text-gray-500">Use Pokemon type colors for the guessable indicator dot</div>
                                            </div>
                                        </div>
                                        <input type="checkbox" checked={uiSettings.typeDot} onChange={(e) => updateUiSettings({ typeDot: e.target.checked })} className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-emerald-600 focus:ring-emerald-500" />
                                    </label>
                                    <label className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded hover:bg-gray-800/50 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 flex items-center justify-center text-cyan-400 font-mono text-[10px] font-bold group-hover:scale-110 transition-transform">#</div>
                                            <div>
                                                <div className="text-xs font-bold text-gray-200">Show Dex Numbers</div>
                                                <div className="text-[9px] text-gray-500">Show Pokemon number on each grid tile</div>
                                            </div>
                                        </div>
                                        <input type="checkbox" checked={uiSettings.showDexNumbers} onChange={(e) => updateUiSettings({ showDexNumbers: e.target.checked })} className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-cyan-600 focus:ring-cyan-500" />
                                    </label>
                                    <label className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded hover:bg-gray-800/50 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 flex items-center justify-center text-orange-400 text-[10px] group-hover:scale-110 transition-transform">📌</div>
                                            <div>
                                                <div className="text-xs font-bold text-gray-200">Persistent Type Dot</div>
                                                <div className="text-[9px] text-gray-500">Keep dot visible until guessed instead of hiding on hover</div>
                                            </div>
                                        </div>
                                        <input type="checkbox" checked={uiSettings.persistentDot} onChange={(e) => updateUiSettings({ persistentDot: e.target.checked })} className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-orange-600 focus:ring-orange-500" />
                                    </label>
                                    <label className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded hover:bg-gray-800/50 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-2">
                                            <Eye size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                                            <div>
                                                <div className="text-xs font-bold text-gray-200">Type Labels</div>
                                                <div className="text-[9px] text-gray-500">Show type abbreviations on colored indicators (colorblind-friendly)</div>
                                            </div>
                                        </div>
                                        <input type="checkbox" checked={uiSettings.colorblindMode === 'labels'} onChange={(e) => updateUiSettings({ colorblindMode: e.target.checked ? 'labels' : 'off' })} className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-cyan-600 focus:ring-cyan-500" />
                                    </label>
                                    {__TWITCH_ENABLED__ && (
                                    <label className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded hover:bg-gray-800/50 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-2">
                                            <Tv size={16} className="text-purple-400 group-hover:scale-110 transition-transform" />
                                            <div>
                                                <div className="text-xs font-bold text-gray-200">Enable Twitch Integration</div>
                                                <div className="text-[9px] text-gray-500">Show Twitch chat guessing and leaderboard features</div>
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={twitchIntegration}
                                            onChange={(e) => {
                                                setTwitchIntegration(e.target.checked);
                                                localStorage.setItem('pokepelago_twitch_integration', String(e.target.checked));
                                                window.dispatchEvent(new Event('pokepelago_twitch_integration_changed'));
                                            }}
                                            className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-purple-500"
                                        />
                                    </label>
                                    )}
                                </div>
                                <div className="pt-2 border-t border-gray-800/50">
                                    <button
                                        onClick={() => {
                                            if (confirm('Reset Game Mode? This will return you to the splash screen. Your local progress (imported sprites and checked/guessed Pokemon) will NOT be deleted.')) {
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

                        {/* Sprites tab */}
                        {activeTab === 'sprites' && (
                            <div className="space-y-4">
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
                                <div className="space-y-2" data-tour="sprite-url">
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

                                {/* Animated (PMD) Sprite URL */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                        <span className="text-pink-400 text-sm">✨</span>
                                        Animated Sprites
                                        {pmdSpriteUrl && (
                                            <span className="text-[9px] text-pink-400 bg-pink-900/20 px-1.5 py-0.5 rounded border border-pink-700/30">Active</span>
                                        )}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={pmdSpriteUrl}
                                            onChange={(e) => setPmdSpriteUrl(e.target.value)}
                                            placeholder="Go find the Mystery Sprite Repo!"
                                            className="flex-1 bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors"
                                        />
                                        {pmdSpriteUrl && (
                                            <button onClick={() => setPmdSpriteUrl('')} className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors" title="Clear URL">
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-gray-600 italic">
                                        There's a sprite repo out there that has animated sprites. Can you solve this Mystery?
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
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        <input type="file" className="hidden" multiple {...{ webkitdirectory: '', directory: '' } as any} onChange={handleImport} disabled={isImporting} />
                                    </label>
                                    <p className="text-[9px] text-gray-500 italic text-center">
                                        Check the <a href="https://github.com/dowlle/PokepelagoClient" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white underline">Pokepelago README</a> for sprite pack instructions.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Twitch tab */}
                        {activeTab === 'twitch' && twitchIntegration && (
                            <div className="space-y-4">
                                <p className="text-[10px] text-gray-400 leading-relaxed">
                                    Let your Twitch chat guess Pokemon for you! Viewers type <code className="text-purple-300 bg-purple-900/20 px-1 rounded">!guess pikachu</code> in chat and it counts as a guess in your game.
                                </p>

                                <label className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded hover:bg-gray-800/50 transition-colors cursor-pointer group">
                                    <div className="flex items-center gap-2">
                                        <Tv size={16} className="text-purple-400 group-hover:scale-110 transition-transform" />
                                        <div>
                                            <div className="text-xs font-bold text-gray-200">Enable Chat Guessing</div>
                                            <div className="text-[9px] text-gray-500">Connect to Twitch IRC (read-only, no login needed)</div>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={twitchEnabled}
                                        onChange={(e) => {
                                            setTwitchEnabled(e.target.checked);
                                            localStorage.setItem('pokepelago_twitch_enabled', String(e.target.checked));
                                            window.dispatchEvent(new Event('pokepelago_twitch_changed'));
                                        }}
                                        className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-purple-500"
                                    />
                                </label>

                                {twitchEnabled && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[10px] text-gray-400 mb-1 uppercase tracking-tight">Channel Name</label>
                                            <input
                                                type="text"
                                                value={twitchChannel}
                                                onChange={(e) => {
                                                    setTwitchChannel(e.target.value);
                                                    localStorage.setItem('pokepelago_twitch_channel', e.target.value);
                                                    window.dispatchEvent(new Event('pokepelago_twitch_changed'));
                                                }}
                                                placeholder="your_twitch_channel"
                                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded text-xs text-white outline-none focus:border-purple-500 transition-colors"
                                            />
                                        </div>
                                        <div className="text-[9px] text-gray-500 space-y-1">
                                            <p>Viewers can guess with: <code className="text-purple-300 bg-purple-900/20 px-1 rounded">!guess &lt;pokemon name&gt;</code></p>
                                            <p>Rate limited to 1 guess per viewer every 5 seconds. Wrong guesses are silently ignored.</p>
                                        </div>

                                        {/* OAuth / Chat Feedback */}
                                        {hasTwitchClientId() && (
                                            <div className="space-y-3 pt-2 border-t border-gray-800">
                                                <div className="text-[10px] text-gray-400 uppercase tracking-tight font-bold">Chat Feedback (Optional)</div>
                                                {twitchAuthUser ? (
                                                    <div className="flex items-center justify-between p-3 bg-purple-900/10 border border-purple-700/30 rounded-lg">
                                                        <div className="flex items-center gap-2">
                                                            <LogIn size={14} className="text-purple-400" />
                                                            <div>
                                                                <div className="text-xs font-bold text-purple-300">@{twitchAuthUser}</div>
                                                                <div className="text-[9px] text-gray-500">Authenticated -- bot can post to chat</div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => { clearTwitchAuth(); setTwitchAuthUser(null); }}
                                                            className="p-1.5 rounded hover:bg-gray-800 text-gray-500 hover:text-red-400 transition-colors"
                                                            title="Disconnect Twitch account"
                                                        >
                                                            <LogOut size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { window.location.href = getTwitchAuthUrl(); }}
                                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 hover:border-purple-500/50 rounded-lg text-xs font-bold transition-all"
                                                    >
                                                        <LogIn size={14} />
                                                        Connect Twitch Account
                                                    </button>
                                                )}
                                                <p className="text-[9px] text-gray-600">Login lets the bot post correct guess confirmations back to your chat.</p>

                                                {twitchAuthUser && (
                                                    <label className="flex items-center justify-between p-3 bg-gray-800/30 border border-gray-700 rounded hover:bg-gray-800/50 transition-colors cursor-pointer">
                                                        <div>
                                                            <div className="text-xs font-bold text-gray-200">Post correct guesses to chat</div>
                                                            <div className="text-[9px] text-gray-500">Bot confirms correct guesses in your Twitch chat</div>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={chatFeedback}
                                                            onChange={(e) => {
                                                                setChatFeedback(e.target.checked);
                                                                localStorage.setItem('pokepelago_twitch_chat_feedback', String(e.target.checked));
                                                            }}
                                                            className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-purple-500"
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        )}

                                        {/* OBS Overlay URL Builder */}
                                        {isConnected && <ObsOverlayBuilder
                                            connectionInfo={connectionInfo}
                                            spriteRepoUrl={spriteRepoUrl}
                                            pmdSpriteUrl={pmdSpriteUrl}
                                        />}
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-800 bg-gray-950/50 flex items-center justify-between">
                    <button
                        onClick={() => {
                            localStorage.removeItem('pokepelago_tour_completed');
                            localStorage.removeItem('pokepelago_tour_seen_prompt');
                            window.dispatchEvent(new Event('pokepelago_tour_restart'));
                        }}
                        className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                    >
                        Restart guided tour
                    </button>
                    <a
                        href="https://ko-fi.com/dowlle"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FF5E5B]/10 hover:bg-[#FF5E5B]/20 border border-[#FF5E5B]/20 hover:border-[#FF5E5B]/40 transition-all"
                    >
                        <span className="text-sm group-hover:scale-110 transition-transform">&#9749;</span>
                        <span className="text-[10px] font-bold text-[#FF5E5B]/80 group-hover:text-[#FF5E5B] tracking-wide">
                            Support on Ko-fi
                        </span>
                    </a>
                </div>
            </div>
        </div>,
        document.body,
    );
};
