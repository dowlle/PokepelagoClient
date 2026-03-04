import React from 'react';
import { createPortal } from 'react-dom';
import { X, Github } from 'lucide-react';

interface CreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const changelog: Array<{
    version: string;
    date: string;
    highlights: Array<{ label: string; text: string }>;
}> = [
    {
        version: '0.3.2',
        date: 'March 2025',
        highlights: [
            {
                label: 'Milestone logic fix',
                text: 'Global and type milestones now have proper access rules. AP will only consider them reachable when enough Pokémon are actually accessible with your current items.',
            },
            {
                label: 'Trap weights',
                text: 'Configure how often each trap type appears via trap_weights in your YAML. Set any trap to 0 to disable it entirely.',
            },
            {
                label: 'Language selector',
                text: 'Choose to accept guesses in a specific language only. Prevents accidental catches from shorter names in other languages (e.g. German "Dodu" matching Doduo). Your pick is saved between sessions.',
            },
            {
                label: 'Type proficiency counter',
                text: 'The type sidebar now shows how many Pokémon of each type you\'ve caught out of the total available, e.g. Fire (12/15).',
            },
        ],
    },
    {
        version: '0.3.1',
        date: 'Feb 2025',
        highlights: [
            {
                label: 'New APWorld logic',
                text: 'Full rewrite of generation logic. Multiple Poképelago games can now generate in under a second. Dexsanity no longer uses per-Pokémon unlock items.',
            },
            {
                label: 'Gens 4–9 & region locks',
                text: 'All nine generations are back! Region locks return as Region Passes in the multiworld item pool.',
            },
            {
                label: 'Derpemon traps',
                text: 'Derpemon community sprites can now be triggered as a trap or toggled on globally. Community members have already created 100+ derpy sprites!',
            },
            {
                label: 'Shuffle & release traps',
                text: 'The shuffle trap scrambles your Dex grid, and the release trap frees a caught Pokémon that you\'ll have to guess again.',
            },
            {
                label: 'Game Manager',
                text: 'Save multiple connection profiles and switch between games instantly. Goaled games are flagged and can be auto-cleaned.',
            },
            {
                label: 'Type colors & filters',
                text: 'Type badges use proper type colors everywhere. Click type pills to filter the Dex grid. Ctrl+click for multi-select.',
            },
        ],
    },
    {
        version: '0.2.0',
        date: 'Feb 2025',
        highlights: [
            {
                label: 'Sprite URL loading',
                text: 'Paste a sprite repo URL in Settings and sprites load automatically. No more downloading and uploading ZIP files.',
            },
            {
                label: 'Better connection handling',
                text: 'The game reliably detects server disconnects and shows real-time connection quality.',
            },
            {
                label: 'Multilingual name guessing',
                text: 'Pokémon with accents, dots, or names in Japanese, French, and other languages are now recognized correctly.',
            },
        ],
    },
];

export const CreditsModal: React.FC<CreditsModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-200 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative z-10 max-w-2xl w-full max-h-[85vh] overflow-y-auto bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-8 pt-8 pb-5 rounded-t-3xl">
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>

                    <h2 className="text-3xl font-black tracking-tighter bg-linear-to-r from-green-400 via-emerald-500 to-blue-500 bg-clip-text text-transparent mb-1">
                        Poképelago
                    </h2>
                    <p className="text-gray-500 text-sm">v0.3.2 · A Pokémon guessing game for Archipelago Multiworld</p>
                </div>

                <div className="px-8 py-6 space-y-8">
                    {/* Credits */}
                    <section>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Credits</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-2xl border border-gray-700/50">
                                <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-black text-lg shrink-0">
                                    A
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white">Appie</span>
                                        <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-700/40">Creator</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">APWorld design, client, game logic, and ongoing development</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-2xl border border-gray-700/50">
                                <div className="w-10 h-10 rounded-full bg-linear-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white font-black text-sm shrink-0">
                                    DP
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-white">Derpemon Community</span>
                                        <span className="text-[10px] uppercase tracking-widest text-yellow-400 font-bold bg-yellow-900/30 px-2 py-0.5 rounded-full border border-yellow-700/40">Community</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        100+ hand-crafted Derpemon sprites for the derpemon trap —{' '}
                                        <a href="https://github.com/TheShadowOfLight/DerpemonCommunityProject" target="_blank" rel="noreferrer" className="text-yellow-400 hover:underline">contribute here</a>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                            <a
                                href="https://github.com/dowlle/PokepelagoClient"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-xl text-xs text-gray-400 hover:text-white font-bold transition-all"
                            >
                                <Github size={13} />
                                GitHub
                            </a>
                            <a
                                href="https://archipelago.gg/"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-xl text-xs text-gray-400 hover:text-white transition-all"
                            >
                                <img src="https://archipelago.gg/favicon.ico" alt="" className="w-3 h-3 shrink-0" />
                                Built for Archipelago
                            </a>
                        </div>
                    </section>

                    {/* Changelog */}
                    <section>
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-4">Changelog</h3>
                        <div className="space-y-7">
                            {changelog.map((release) => (
                                <div key={release.version}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-sm font-black text-white">v{release.version}</span>
                                        <span className="text-[10px] text-gray-600">{release.date}</span>
                                        <div className="flex-1 h-px bg-gray-800" />
                                    </div>
                                    <div className="space-y-2.5">
                                        {release.highlights.map((item, i) => (
                                            <p key={i} className="text-xs leading-relaxed">
                                                <span className="font-bold text-gray-300">{item.label}:</span>
                                                <span className="text-gray-500"> {item.text}</span>
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                    </section>

                    {/* Footer */}
                    <div className="border-t border-gray-800 pt-4 text-center text-[10px] text-gray-700 font-bold uppercase tracking-widest">
                        Made with ♥ for multiworld randomizer fans everywhere
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
