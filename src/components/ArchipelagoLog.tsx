import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { Send, ChevronDown, ChevronRight } from 'lucide-react';
import type { LogEntry } from '../context/GameContext';

// ── Grouping helpers ────────────────────────────────────────────────────────

/** Extract region from a Route Key item name, e.g. "Kanto Route 1 Key" → "Kanto" */
function extractRouteKeyRegion(text: string): string | null {
    const m = text.match(/(\w+)\s+Route\s+\d+\s+Key/);
    return m ? m[1] : null;
}

/** Check if an item log entry's text contains a Route Key */
function isRouteKeyEntry(entry: LogEntry): boolean {
    return entry.type === 'item' && /\w+\s+Route\s+\d+\s+Key/.test(entry.text);
}

/** Check if an item log entry's text contains a Line Unlock */
function isLineUnlockEntry(entry: LogEntry): boolean {
    return entry.type === 'item' && /\w+\s+Line\b/.test(entry.text);
}

/** Extract the line name from text, e.g. "... Charmander Line ..." → "Charmander Line" */
function extractLineName(text: string): string | null {
    const m = text.match(/(\w+\s+Line)\b/);
    return m ? m[1] : null;
}

type DisplayEntry =
    | { kind: 'single'; entry: LogEntry }
    | { kind: 'route-group'; id: string; timestamp: number; entries: LogEntry[]; summary: string; isMe: boolean }
    | { kind: 'line-group'; id: string; timestamp: number; entries: LogEntry[]; summary: string; isMe: boolean };

function buildGroupedEntries(logs: LogEntry[]): DisplayEntry[] {
    const result: DisplayEntry[] = [];
    let i = 0;

    while (i < logs.length) {
        const entry = logs[i];

        // Try to group consecutive Route Key entries
        if (isRouteKeyEntry(entry)) {
            const group: LogEntry[] = [entry];
            let j = i + 1;
            while (j < logs.length && isRouteKeyEntry(logs[j])) {
                group.push(logs[j]);
                j++;
            }
            if (group.length >= 2) {
                // Build summary
                const regionCounts: Record<string, number> = {};
                for (const e of group) {
                    const region = extractRouteKeyRegion(e.text) ?? 'Unknown';
                    regionCounts[region] = (regionCounts[region] || 0) + 1;
                }
                const regions = Object.keys(regionCounts);
                let summary: string;
                if (regions.length === 1) {
                    summary = `Received ${group.length} ${regions[0]} Route Keys`;
                } else {
                    const detail = regions.map(r => `${regionCounts[r]} ${r}`).join(', ');
                    summary = `Received ${group.length} Route Keys (${detail})`;
                }
                result.push({
                    kind: 'route-group',
                    id: `rg-${group[0].id}`,
                    timestamp: group[0].timestamp,
                    entries: group,
                    summary,
                    isMe: group.some(e => e.isMe),
                });
                i = j;
                continue;
            }
        }

        // Try to group consecutive Line Unlock entries
        if (isLineUnlockEntry(entry)) {
            const group: LogEntry[] = [entry];
            let j = i + 1;
            while (j < logs.length && isLineUnlockEntry(logs[j])) {
                group.push(logs[j]);
                j++;
            }
            if (group.length >= 2) {
                const names = group.map(e => extractLineName(e.text)).filter(Boolean);
                const summary = `Received ${group.length} Line Unlocks: ${names.join(', ')}`;
                result.push({
                    kind: 'line-group',
                    id: `lg-${group[0].id}`,
                    timestamp: group[0].timestamp,
                    entries: group,
                    summary,
                    isMe: group.some(e => e.isMe),
                });
                i = j;
                continue;
            }
        }

        result.push({ kind: 'single', entry });
        i++;
    }

    return result;
}

// ── Component ───────────────────────────────────────────────────────────────

export const ArchipelagoLog: React.FC = () => {
    const { logs, say, isConnected } = useGame();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [chatInput, setChatInput] = useState('');
    const [filterToMe, setFilterToMe] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [logs]);

    const handleSend = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!chatInput.trim() || !isConnected) return;

        say(chatInput.trim());
        setChatInput('');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getPartColor = (part: any) => {
        if (part.color === 'red') return 'text-red-400 font-bold';
        if (part.color === 'blue' || part.type === 'player') return 'text-blue-400 font-bold';
        if (part.color === 'green' || part.type === 'location') return 'text-green-400 font-bold';
        if (part.color === 'yellow' || part.type === 'item') return 'text-yellow-400 font-bold';
        if (part.color === 'purple') return 'text-purple-400 font-bold';
        if (part.color === 'cyan') return 'text-cyan-400 font-bold';
        return 'text-gray-300';
    };

    const toggleGroup = (id: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Filter then group
    const filteredLogs = useMemo(() => {
        const filtered = logs.filter(log => {
            if (!filterToMe) return true;
            const t = log.text;
            if (log.type === 'system' && (t.includes('has left') || t.includes('has joined') || t.includes('has connected') || t.includes('has stopped tracking'))) {
                return false;
            }
            return log.isMe;
        });
        return filtered.slice(0, 100);
    }, [logs, filterToMe]);

    const displayEntries = useMemo(() => buildGroupedEntries(filteredLogs), [filteredLogs]);

    const renderLogEntry = (log: LogEntry) => (
        <div className="flex flex-wrap gap-x-1 items-baseline">
            {log.parts ? (
                log.parts.map((part, i) => (
                    <span key={i} className={getPartColor(part)}>
                        {part.text}
                    </span>
                ))
            ) : (
                <span className="text-gray-300">{log.text}</span>
            )}
        </div>
    );

    const renderTimestamp = (timestamp: number) => (
        <span className="text-[9px] text-gray-500 opacity-50">
            {new Date(timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
    );

    const renderTypeBadge = (type: string) => (
        <span className={`text-[10px] uppercase px-1 rounded-sm border ${type === 'item' ? 'border-yellow-900/50 text-yellow-600' :
            type === 'chat' ? 'border-blue-900/50 text-blue-400' :
                type === 'hint' ? 'border-purple-900/50 text-purple-400' :
                    'border-gray-800 text-gray-500'
            }`}>
            {type}
        </span>
    );

    return (
        <div className="flex flex-col h-full bg-gray-950/20">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-950/40">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                    Activity History
                    <button
                        onClick={() => setFilterToMe(!filterToMe)}
                        className={`p-1 rounded transition-colors ${filterToMe ? 'bg-blue-900/50 text-blue-400' : 'hover:bg-gray-800 text-gray-600 hover:text-gray-400'}`}
                        title="Filter to me"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                    </button>
                </span>
                <span className="text-[9px] text-gray-600 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">{logs.length} entries</span>
            </div>

            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-gray-800"
            >
                {logs.length === 0 ? (
                    <div className="text-gray-600 italic text-center py-20 grayscale opacity-50">
                        <div className="mb-2 text-2xl">&#x23F3;</div>
                        Waiting for signal...
                    </div>
                ) : (
                    displayEntries.map((de) => {
                        if (de.kind === 'single') {
                            const log = de.entry;
                            return (
                                <div key={log.id} className="animate-in fade-in slide-in-from-left-1 duration-300 border-l-2 border-gray-800 pl-3 py-0.5">
                                    <div className="flex justify-between items-center mb-1">
                                        {renderTimestamp(log.timestamp)}
                                        {renderTypeBadge(log.type)}
                                    </div>
                                    {renderLogEntry(log)}
                                </div>
                            );
                        }

                        // Grouped entry (route-group or line-group)
                        const isExpanded = expandedGroups.has(de.id);
                        return (
                            <div key={de.id} className="animate-in fade-in slide-in-from-left-1 duration-300 border-l-2 border-yellow-800/50 pl-3 py-0.5">
                                <div className="flex justify-between items-center mb-1">
                                    {renderTimestamp(de.timestamp)}
                                    {renderTypeBadge('item')}
                                </div>
                                <button
                                    onClick={() => toggleGroup(de.id)}
                                    className="flex items-center gap-1 text-left w-full group"
                                >
                                    {isExpanded
                                        ? <ChevronDown size={12} className="text-gray-500 shrink-0" />
                                        : <ChevronRight size={12} className="text-gray-500 shrink-0" />
                                    }
                                    <span className="text-yellow-400/80 group-hover:text-yellow-300 transition-colors">
                                        {de.summary}
                                    </span>
                                </button>
                                {isExpanded && (
                                    <div className="mt-2 ml-4 space-y-2 border-l border-gray-800 pl-3">
                                        {de.entries.map(log => (
                                            <div key={log.id} className="py-0.5">
                                                {renderLogEntry(log)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-gray-800 bg-gray-950/40">
                <form onSubmit={handleSend} className="relative">
                    <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={isConnected ? "Send message or !command..." : "Offline"}
                        disabled={!isConnected}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 pl-3 pr-10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={!isConnected || !chatInput.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-blue-400 disabled:opacity-0 transition-all"
                    >
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
};
