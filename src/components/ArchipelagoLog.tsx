import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/GameContext';
import { Send } from 'lucide-react';

export const ArchipelagoLog: React.FC = () => {
    const { logs, say, isConnected } = useGame();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [chatInput, setChatInput] = useState('');
    const [filterToMe, setFilterToMe] = useState(false);

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

    const getPartColor = (part: any) => {
        if (part.color === 'red') return 'text-red-400 font-bold';
        if (part.color === 'blue' || part.type === 'player') return 'text-blue-400 font-bold';
        if (part.color === 'green' || part.type === 'location') return 'text-green-400 font-bold';
        if (part.color === 'yellow' || part.type === 'item') return 'text-yellow-400 font-bold';
        if (part.color === 'purple') return 'text-purple-400 font-bold';
        if (part.color === 'cyan') return 'text-cyan-400 font-bold';
        return 'text-gray-300';
    };

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
                        <div className="mb-2 text-2xl">⏳</div>
                        Waiting for signal...
                    </div>
                ) : (
                    logs.filter(log => !filterToMe || log.isMe).map((log) => (
                        <div key={log.id} className="animate-in fade-in slide-in-from-left-1 duration-300 border-l-2 border-gray-800 pl-3 py-0.5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] text-gray-500 opacity-50">
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                                <span className={`text-[8px] uppercase px-1 rounded-sm border ${log.type === 'item' ? 'border-yellow-900/50 text-yellow-600' :
                                    log.type === 'chat' ? 'border-blue-900/50 text-blue-400' :
                                        log.type === 'hint' ? 'border-purple-900/50 text-purple-400' :
                                            'border-gray-800 text-gray-500'
                                    }`}>
                                    {log.type}
                                </span>
                            </div>
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
                        </div>
                    ))
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
