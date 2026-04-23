import React, { useState } from 'react';
import { Copy } from 'lucide-react';

const OBS_MODULES = [
    { key: 'progress', label: 'Progress Bar' },
    { key: 'types', label: 'Type Tracker' },
    { key: 'items', label: 'Item Tracker' },
    { key: 'feed', label: 'Live Feed' },
    { key: 'guessers', label: 'Leaderboard' },
    { key: 'dex', label: 'Dex Grid' },
    { key: 'log', label: 'AP Log' },
] as const;

const DEX_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'guessable', label: 'Guessable' },
    { key: 'guessed', label: 'Guessed' },
] as const;

interface ObsOverlayBuilderProps {
    connectionInfo: { hostname: string; port: number; slotName: string; password?: string };
    spriteRepoUrl: string;
    pmdSpriteUrl: string;
}

export const ObsOverlayBuilder: React.FC<ObsOverlayBuilderProps> = ({ connectionInfo, spriteRepoUrl, pmdSpriteUrl }) => {
    const [modules, setModules] = useState<Set<string>>(() => new Set(OBS_MODULES.map(m => m.key)));
    const [dexFilters, setDexFilters] = useState<Set<string>>(() => new Set(['all']));
    const [carousel, setCarousel] = useState(false);
    const [carouselSpeed, setCarouselSpeed] = useState(10);
    const [copied, setCopied] = useState(false);

    const toggleModule = (key: string) => {
        setModules(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const buildUrl = () => {
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set('overlay', '1');
        url.searchParams.set('host', connectionInfo.hostname);
        url.searchParams.set('port', String(connectionInfo.port));
        url.searchParams.set('name', connectionInfo.slotName);
        if (connectionInfo.password) url.searchParams.set('password', connectionInfo.password);
        if (spriteRepoUrl) url.searchParams.set('sprites', spriteRepoUrl);
        if (pmdSpriteUrl) url.searchParams.set('pmd', pmdSpriteUrl);
        const enabledModules = OBS_MODULES.map(m => m.key).filter(k => modules.has(k));
        if (enabledModules.length > 0 && enabledModules.length < OBS_MODULES.length) {
            url.searchParams.set('modules', enabledModules.join(','));
        }
        if (modules.has('dex')) {
            const selected = DEX_FILTERS.map(f => f.key).filter(k => dexFilters.has(k));
            // Only emit param if not just 'all' (the default)
            if (!(selected.length === 1 && selected[0] === 'all')) {
                url.searchParams.set('dexfilter', selected.join(','));
            }
        }
        if (carousel) {
            url.searchParams.set('carousel', String(carouselSpeed));
        }
        return url.toString();
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(buildUrl());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-3 pt-2 border-t border-gray-800">
            <div className="text-[10px] text-gray-400 uppercase tracking-tight font-bold">OBS Overlay</div>

            {/* Module toggles */}
            <div className="grid grid-cols-2 gap-1">
                {OBS_MODULES.map(({ key, label }) => (
                    <label
                        key={key}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-[10px] font-bold cursor-pointer transition-all ${
                            modules.has(key)
                                ? 'bg-purple-900/30 border-purple-700/50 text-purple-300'
                                : 'bg-gray-800/30 border-gray-700/30 text-gray-600'
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={modules.has(key)}
                            onChange={() => toggleModule(key)}
                            className="w-3 h-3 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-purple-500"
                        />
                        {label}
                    </label>
                ))}
            </div>

            {/* Dex filter */}
            {modules.has('dex') && (
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-bold">Dex Views:</span>
                    <div className="flex gap-1 flex-1">
                        {DEX_FILTERS.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setDexFilters(prev => {
                                    const next = new Set(prev);
                                    if (next.has(key)) {
                                        if (next.size > 1) next.delete(key); // keep at least one
                                    } else {
                                        next.add(key);
                                    }
                                    return next;
                                })}
                                className={`flex-1 py-1 text-[9px] font-bold rounded transition-all ${
                                    dexFilters.has(key)
                                        ? 'bg-green-900/40 text-green-400 border border-green-700/50'
                                        : 'bg-gray-800/30 text-gray-600 border border-gray-700/30'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Carousel toggle */}
            <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={carousel}
                        onChange={(e) => setCarousel(e.target.checked)}
                        className="w-3 h-3 rounded border-gray-700 bg-gray-900 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-[10px] text-gray-400 font-bold">Carousel</span>
                </label>
                {carousel && (
                    <div className="flex items-center gap-1.5 ml-auto">
                        <input
                            type="range"
                            min={3}
                            max={30}
                            value={carouselSpeed}
                            onChange={(e) => setCarouselSpeed(Number(e.target.value))}
                            className="w-16 h-1 accent-purple-500"
                        />
                        <span className="text-[9px] text-gray-500 font-mono w-6 text-right">{carouselSpeed}s</span>
                    </div>
                )}
            </div>

            {/* URL preview */}
            <div className="bg-gray-950/60 rounded border border-gray-800/50 p-2 break-all text-[10px] text-gray-500 font-mono max-h-16 overflow-y-auto select-all">
                {buildUrl()}
            </div>

            {connectionInfo.password && (
                <div className="flex items-start gap-1.5 text-[10px] text-yellow-600 bg-yellow-900/10 border border-yellow-800/30 rounded px-2 py-1.5">
                    This URL contains your AP password in plaintext. Do not share it or show it on stream.
                </div>
            )}

            {/* Copy button */}
            <button
                onClick={handleCopy}
                className={`w-full flex items-center justify-center gap-2 py-2.5 border rounded-lg text-xs font-bold transition-all ${
                    copied
                        ? 'bg-green-900/30 border-green-700/50 text-green-400'
                        : 'bg-gray-800/50 hover:bg-gray-800 text-gray-300 border-gray-700/50 hover:border-gray-600'
                }`}
            >
                <Copy size={14} />
                {copied ? 'Copied!' : 'Copy OBS Overlay URL'}
            </button>
        </div>
    );
};
