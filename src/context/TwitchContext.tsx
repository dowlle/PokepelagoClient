import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useGame } from './GameContext';

export interface GuessFeedEntry {
    id: number;
    pokemonId: number;
    pokemonName: string;
    username: string | null; // null = keyboard guess ("You")
    timestamp: number;
    type: 'success' | 'recaught';
}

interface TwitchContextType {
    leaderboard: Map<string, number>;
    credits: Map<number, string>;
    guessFeed: GuessFeedEntry[];
    addGuess: (pokemonId: number, pokemonName: string, username: string | null, resultType: 'success' | 'recaught') => void;
    getCredit: (pokemonId: number) => string | null;
}

const TwitchContext = createContext<TwitchContextType | undefined>(undefined);

const MAX_FEED_ENTRIES = 20;
const CHANNEL_NAME = 'pokepelago_twitch';
const isOverlay = new URLSearchParams(window.location.search).has('overlay');

function storageKey(team: number, slot: number, suffix: string): string {
    return `pokepelago_team_${team}_slot_${slot}_twitch_${suffix}`;
}

function loadMap<V>(key: string, parse: (raw: Record<string, unknown>) => Map<string, V> | Map<number, V>): Map<string, V> | Map<number, V> {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return new Map();
        return parse(JSON.parse(raw));
    } catch {
        return new Map();
    }
}

function saveLeaderboard(key: string, map: Map<string, number>): void {
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(map)));
}

function saveCredits(key: string, map: Map<number, string>): void {
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(map)));
}

export const TwitchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { connectedTeamSlot, connectionKey } = useGame();

    const [leaderboard, setLeaderboard] = useState<Map<string, number>>(new Map());
    const [credits, setCredits] = useState<Map<number, string>>(new Map());
    const [guessFeed, setGuessFeed] = useState<GuessFeedEntry[]>([]);
    const feedIdRef = useRef(0);

    // State mirror refs for BroadcastChannel sync responses (avoids stale closures)
    const leaderboardRef = useRef(leaderboard);
    const creditsRef = useRef(credits);
    const guessFeedRef = useRef(guessFeed);
    leaderboardRef.current = leaderboard;
    creditsRef.current = credits;
    guessFeedRef.current = guessFeed;

    const channelRef = useRef<BroadcastChannel | null>(null);
    // Guard to prevent overlay's addGuess from broadcasting back
    const fromBroadcastRef = useRef(false);

    // Load persisted data when slot changes
    useEffect(() => {
        if (!connectedTeamSlot) {
            setLeaderboard(new Map());
            setCredits(new Map());
            setGuessFeed([]);
            return;
        }
        const { team, slot } = connectedTeamSlot;
        const lb = loadMap<number>(storageKey(team, slot, 'leaderboard'), (raw) => {
            const m = new Map<string, number>();
            for (const [k, v] of Object.entries(raw)) {
                if (typeof v === 'number') m.set(k, v);
            }
            return m;
        }) as Map<string, number>;
        const cr = loadMap<string>(storageKey(team, slot, 'credits'), (raw) => {
            const m = new Map<number, string>();
            for (const [k, v] of Object.entries(raw)) {
                if (typeof v === 'string') m.set(Number(k), v);
            }
            return m;
        }) as Map<number, string>;

        setLeaderboard(lb);
        setCredits(cr);
        setGuessFeed([]);
    }, [connectionKey, connectedTeamSlot]);

    const addGuess = useCallback((pokemonId: number, pokemonName: string, username: string | null, resultType: 'success' | 'recaught') => {
        const displayUser = username ?? 'You';

        // Update leaderboard (only for Twitch users, not manual guesses)
        if (username) {
            setLeaderboard(prev => {
                const next = new Map(prev);
                next.set(username, (next.get(username) ?? 0) + 1);
                if (connectedTeamSlot) {
                    const { team, slot } = connectedTeamSlot;
                    saveLeaderboard(storageKey(team, slot, 'leaderboard'), next);
                }
                return next;
            });
        }

        // Update credits
        setCredits(prev => {
            const next = new Map(prev);
            next.set(pokemonId, displayUser);
            if (connectedTeamSlot) {
                const { team, slot } = connectedTeamSlot;
                saveCredits(storageKey(team, slot, 'credits'), next);
            }
            return next;
        });

        // Update feed
        setGuessFeed(prev => {
            const entry: GuessFeedEntry = {
                id: ++feedIdRef.current,
                pokemonId,
                pokemonName,
                username,
                timestamp: Date.now(),
                type: resultType,
            };
            const next = [entry, ...prev];
            if (next.length > MAX_FEED_ENTRIES) next.length = MAX_FEED_ENTRIES;
            return next;
        });

        // Broadcast to overlay tabs (main tab only, skip if this was received from broadcast)
        if (!isOverlay && !fromBroadcastRef.current) {
            channelRef.current?.postMessage({
                type: 'guess',
                pokemonId, pokemonName, username, resultType,
                timestamp: Date.now(),
            });
        }
    }, [connectedTeamSlot]);

    // BroadcastChannel: shared setup helper
    const setupChannel = useCallback(() => {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channelRef.current = channel;

        channel.onmessage = (event) => {
            const data = event.data;
            if (!data || !data.type) return;

            if (isOverlay) {
                if (data.type === 'guess') {
                    const { pokemonId, pokemonName, username, resultType } = data;
                    const displayUser = username ?? 'You';
                    if (username) {
                        setLeaderboard(prev => {
                            const next = new Map(prev);
                            next.set(username, (next.get(username) ?? 0) + 1);
                            return next;
                        });
                    }
                    setCredits(prev => {
                        const next = new Map(prev);
                        next.set(pokemonId, displayUser);
                        return next;
                    });
                    setGuessFeed(prev => {
                        const entry: GuessFeedEntry = {
                            id: ++feedIdRef.current,
                            pokemonId,
                            pokemonName,
                            username,
                            timestamp: data.timestamp ?? Date.now(),
                            type: resultType,
                        };
                        const next = [entry, ...prev];
                        if (next.length > MAX_FEED_ENTRIES) next.length = MAX_FEED_ENTRIES;
                        return next;
                    });
                } else if (data.type === 'sync') {
                    setLeaderboard(new Map(data.leaderboard));
                    setCredits(new Map(data.credits));
                    setGuessFeed(data.guessFeed ?? []);
                }
            } else {
                if (data.type === 'request-sync') {
                    channel.postMessage({
                        type: 'sync',
                        leaderboard: Array.from(leaderboardRef.current.entries()),
                        credits: Array.from(creditsRef.current.entries()),
                        guessFeed: guessFeedRef.current,
                    });
                }
            }
        };

        return channel;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Overlay: create channel immediately on mount (doesn't need AP connection)
    useEffect(() => {
        if (!isOverlay) return;
        const channel = setupChannel();
        channel.postMessage({ type: 'request-sync' });
        return () => { channel.close(); channelRef.current = null; };
    }, [setupChannel]);

    // Main tab: create channel once connected (needs data to broadcast/sync)
    useEffect(() => {
        if (isOverlay || !connectedTeamSlot) return;
        const channel = setupChannel();
        return () => { channel.close(); channelRef.current = null; };
    }, [connectedTeamSlot, connectionKey, setupChannel]);

    const getCredit = useCallback((pokemonId: number): string | null => {
        return credits.get(pokemonId) ?? null;
    }, [credits]);

    return (
        <TwitchContext.Provider value={{ leaderboard, credits, guessFeed, addGuess, getCredit }}>
            {children}
        </TwitchContext.Provider>
    );
};

export function useTwitch(): TwitchContextType {
    const ctx = useContext(TwitchContext);
    if (!ctx) throw new Error('useTwitch must be used within TwitchProvider');
    return ctx;
}
