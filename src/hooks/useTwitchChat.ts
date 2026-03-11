import { useEffect, useRef, useState, useCallback } from 'react';
import tmi from 'tmi.js';
import { useGame } from '../context/GameContext';
import { useGuessEngine, type LanguageCode } from './useGuessEngine';

interface UseTwitchChatOptions {
    enabled: boolean;
    channelName: string;
    selectedLanguage: LanguageCode;
}

interface UseTwitchChatResult {
    isConnected: boolean;
    error: string | null;
}

const RATE_LIMIT_MS = 5_000;

export function useTwitchChat({ enabled, channelName, selectedLanguage }: UseTwitchChatOptions): UseTwitchChatResult {
    const { showToast } = useGame();
    const { attemptGuess } = useGuessEngine(selectedLanguage);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clientRef = useRef<tmi.Client | null>(null);
    const rateLimitMap = useRef<Map<string, number>>(new Map());

    const attemptGuessRef = useRef(attemptGuess);
    const showToastRef = useRef(showToast);
    useEffect(() => { attemptGuessRef.current = attemptGuess; }, [attemptGuess]);
    useEffect(() => { showToastRef.current = showToast; }, [showToast]);

    const handleMessage = useCallback((_channel: string, tags: tmi.ChatUserstate, message: string) => {
        const trimmed = message.trim();
        const match = trimmed.match(/^!guess\s+(.+)$/i);
        if (!match) return;

        const guessName = match[1].trim();
        if (!guessName) return;

        const username = tags['display-name'] || tags.username || 'anonymous';

        // Rate limit per viewer
        const now = Date.now();
        const lastGuess = rateLimitMap.current.get(username) ?? 0;
        if (now - lastGuess < RATE_LIMIT_MS) return;
        rateLimitMap.current.set(username, now);

        const result = attemptGuessRef.current(guessName);

        if (result.type === 'success') {
            showToastRef.current('success', `✓ ${result.pokemonName} - guessed by @${username}`);
        } else if (result.type === 'recaught') {
            showToastRef.current('recaught', `Re-caught ${result.pokemonName} - by @${username}`);
        }
        // Silently ignore errors and already-guessed for chat guesses
    }, []);

    useEffect(() => {
        if (!enabled || !channelName.trim()) {
            // Disconnect if settings changed
            if (clientRef.current) {
                clientRef.current.disconnect().catch(() => {});
                clientRef.current = null;
            }
            setIsConnected(false);
            setError(null);
            return;
        }

        const channel = channelName.trim().toLowerCase().replace(/^#/, '');
        setError(null);

        const client = new tmi.Client({
            connection: { reconnect: true, secure: true },
            channels: [channel],
        });

        clientRef.current = client;

        client.on('message', handleMessage);
        client.on('connected', () => setIsConnected(true));
        client.on('disconnected', () => setIsConnected(false));

        client.connect().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            setError(`Failed to connect: ${msg}`);
            setIsConnected(false);
        });

        return () => {
            client.removeAllListeners();
            client.disconnect().catch(() => {});
            clientRef.current = null;
            setIsConnected(false);
        };
    }, [enabled, channelName, handleMessage]);

    // Clean up stale rate limit entries periodically
    useEffect(() => {
        if (!enabled) return;
        const interval = setInterval(() => {
            const now = Date.now();
            for (const [user, time] of rateLimitMap.current) {
                if (now - time > 60_000) rateLimitMap.current.delete(user);
            }
        }, 30_000);
        return () => clearInterval(interval);
    }, [enabled]);

    return { isConnected, error };
}
