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
            version: '0.6.1',
            date: 'April 2026',
            highlights: [
                {
                    label: 'Who\'s That Pokémon? silhouette',
                    text: 'Unguessed and hinted slots now render as a silhouette with a subtle indigo halo (warm red in the Pokémon theme). Toggleable in Settings if you prefer pure flat silhouettes.',
                },
                {
                    label: 'Sprite size option',
                    text: 'Five discrete sizes in the Sprites tab: 1x, 1.25x, 1.5x, 1.75x, and 2x. Sprites and overlays scale together. Default stays at 1x so returning players see no change.',
                },
                {
                    label: 'Pokémon Details upgrade',
                    text: 'Shadow silhouette for unguessed Pokémon inside the modal. A and D cycle through unguessed Pokémon, arrows cycle through the full dex. The global guess input at the top stays usable while the modal is open. Always Show Types setting reveals type badges before guessing.',
                },
                {
                    label: 'Server version indicator',
                    text: 'The sidebar now shows which APWorld version the host is running, and tells you when a newer Poképelago release is out so you can ask your host to update for the next seed.',
                },
                {
                    label: 'Game state isolation across servers',
                    text: 'Switching between Archipelago servers or slots no longer leaks state between games. A full reset fires on every connect, and the new game seeds fresh from the server.',
                },
                {
                    label: 'Grid performance overhaul',
                    text: 'Catching one Pokémon no longer re-renders the other 1024 slots. Large item batches on connect update in a single pass. Collapsed regions unmount to keep the DOM light.',
                },
                {
                    label: 'Settings groupings',
                    text: 'Interface toggles are grouped under Grid Layout, Type Display, Catch Feedback, and Integrations. Sidebar link renamed to Preferences and Appearance.',
                },
                {
                    label: 'Bug fixes',
                    text: 'Derp Trap no longer blanks out other caught sprites. Pokédex and Pokegear items now force the silhouette even when Enable Shadows is off. The guided tour sits above the Settings modal and closes it on steps that do not need it. A/D navigation skips Pokémon that are not in the current game scope.',
                },
            ],
        },
        {
            version: '0.6.0',
            date: 'April 2026',
            highlights: [
                {
                    label: 'Settings redesign',
                    text: 'Settings now live in a tabbed modal (Interface / Sprites / Twitch) accessible from the gear icon in the top bar. The sidebar keeps Connection, Generations, and Sprite Set always one click away. Escape closes modals.',
                },
                {
                    label: 'Progression v2',
                    text: 'New optional locks layered on top of the existing gate system: Route Keys unlock groups of Pokémon by area, Line Unlocks unlock whole evolution families, and Badge Level Gating ties legendary tiers to gym badge count.',
                },
                {
                    label: 'Pokémon theme',
                    text: 'An alternative colourful, game-inspired skin. Pick it in Settings → Interface → Theme. The default dark theme is still there.',
                },
                {
                    label: 'Smart auto-submit',
                    text: 'Guesses submit instantly when your input has a single match (most of the time). The 250ms debounce only kicks in when your prefix could still grow into a longer Pokémon name.',
                },
                {
                    label: 'Route Clearing display',
                    text: 'The Gate Tracker now shows per-route progress so you can see which areas are almost cleared and which still have Pokémon hiding.',
                },
                {
                    label: 'Shiny Charm log entry',
                    text: 'When a Shiny Charm turns one of your caught Pokémon shiny, the log shows a pink entry naming exactly who got the glow-up.',
                },
                {
                    label: 'Release Trap fix',
                    text: 'Recaught Pokémon no longer get released again by stale DataStorage updates on reconnect.',
                },
                {
                    label: 'Colorblind-friendly labels',
                    text: 'Optional type abbreviations on the colored indicator dots, with full type-name tooltips on hover.',
                },
                {
                    label: 'Dependency security hardening',
                    text: 'All 28 dependencies pinned to exact versions. Patched vite path-traversal + WebSocket file read, picomatch method injection / ReDoS, and brace-expansion zero-step hang.',
                },
                {
                    label: 'Built for Archipelago 0.6.6',
                    text: 'Updated for the latest AP release. Small bug fixes in the standalone-mode state reset and the confetti CSP.',
                },
            ],
        },
        {
            version: '0.5.1',
            date: 'April 2026',
            highlights: [
                {
                    label: 'Cleaner .apworld bundles',
                    text: 'Test and dev files are now stripped from released .apworld packages.',
                },
                {
                    label: 'Release workflow stability',
                    text: 'Internal ap-actions checkout disabled for the public release path so CI no longer flakes on protected branches.',
                },
            ],
        },
        {
            version: '0.5.0',
            date: 'April 2026',
            highlights: [
                {
                    label: 'Guided tour',
                    text: 'First-time players get an interactive walkthrough covering connection, key settings, and how to guess. Re-run it any time from the Settings footer.',
                },
                {
                    label: 'Master Ball bypass toggle',
                    text: 'New YAML option master_ball_bypass_gates (default true) lets you decide whether Master Balls bypass lock gates or respect them.',
                },
                {
                    label: 'Trade-evolution lock fixes',
                    text: 'Foongus, Trevenant, and Gourgeist now correctly require the Link Cable when trade-locks are on.',
                },
                {
                    label: 'Nidoran matching across languages',
                    text: 'Nidoran♂ and Nidoran♀ now match correctly in all 11 languages regardless of how you type the symbol or abbreviation.',
                },
                {
                    label: 'Automated releases',
                    text: '.apworld and template YAML are now built and published by a CI workflow, with pre-flight version checks and an npm audit gate.',
                },
                {
                    label: 'Reconnect safety',
                    text: 'Traps no longer re-fire when you reconnect to an existing slot — processed counts are properly synced from the server.',
                },
                {
                    label: 'Security + accessibility polish',
                    text: 'Patched a high-severity flatted vulnerability and landed several medium-severity error-handling and accessibility improvements across the app.',
                },
            ],
        },
        {
            version: '0.4.0',
            date: 'March 2026',
            highlights: [
                {
                    label: 'Localized names everywhere',
                    text: 'Pokemon names now appear in your selected language across the entire UI: detail modal, grid tooltips, guess toasts, autocomplete, and name hints all respect your language choice.',
                },
                {
                    label: 'Diacritics support',
                    text: 'Guessing now uses Unicode normalization so accented names like "Flabébé" match correctly regardless of how you type them.',
                },
                {
                    label: 'Interactive lock badges',
                    text: 'Missing requirement badges in the Pokemon detail view are now clickable. Tap once to highlight, tap again to request an AP hint for that item. Works for Region Passes, Type Keys, Gym Badges, and all gate items.',
                },
                {
                    label: 'Category filtering from Item Tracker',
                    text: 'Click any obtained item in the sidebar Item Tracker to filter the grid. Filter by region, legendary tier, baby Pokemon, trade evolutions, fossils, Ultra Beasts, Paradox Pokemon, or specific stone evolutions.',
                },
                {
                    label: 'Co-op sync',
                    text: 'Multiple players on the same AP slot now see each other\'s guesses in real time via RoomUpdate packet handling.',
                },
                {
                    label: 'World hop stability',
                    text: 'Disconnecting now fully resets all game state. No more stale derpemon sprites, phantom filters, or leaked items from previous sessions. Orphan socket guards prevent old connections from interfering.',
                },
                {
                    label: 'Dex number overlay',
                    text: 'Each grid tile now shows the National Dex number. Toggle it on or off in Settings.',
                },
                {
                    label: 'Persistent vs notification dot',
                    text: 'Choose whether the type-colored dot stays visible permanently or disappears on hover (notification style). Configurable in Settings.',
                },
                {
                    label: 'HTTPS connection fix',
                    text: 'The client now detects secure pages and skips insecure WebSocket protocols automatically, with clearer error messages when connections fail.',
                },
                {
                    label: 'Ko-fi support',
                    text: 'A support link has been added to the Settings panel. If you enjoy Pokepelago, consider buying us a coffee!',
                },
            ],
        },
        {
            version: '0.3.2',
            date: 'March 2026',
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
            date: 'Feb 2026',
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
            date: 'Feb 2026',
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
    // Escape-to-close
    React.useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

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
                    <p className="text-gray-500 text-sm">v0.4.0 · A Pokémon guessing game for Archipelago Multiworld</p>
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
                            <a
                                href="https://sprites.pmdcollab.org/#/Contributors"
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 rounded-xl text-xs text-gray-400 hover:text-white transition-all"
                            >
                                <img src="https://sprites.pmdcollab.org/favicon.ico" alt="" className="w-3 h-3 shrink-0" />
                                Mystery Dungeon sprites by SpriteCollab
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
