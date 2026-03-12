import { useEffect, useRef, useState, useCallback } from 'react';
import tmi from 'tmi.js';
import { useGame } from '../context/GameContext';
import { useTwitch } from '../context/TwitchContext';
import { useGuessEngine, type LanguageCode } from './useGuessEngine';
import { getTwitchToken, getTwitchUsername } from '../services/twitchAuthService';

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
const CHAT_POST_COOLDOWN_MS = 2_000;

export function useTwitchChat({ enabled, channelName, selectedLanguage }: UseTwitchChatOptions): UseTwitchChatResult {
    const { showToast } = useGame();
    const { addGuess } = useTwitch();
    const { attemptGuess } = useGuessEngine(selectedLanguage);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const clientRef = useRef<tmi.Client | null>(null);
    const rateLimitMap = useRef<Map<string, number>>(new Map());
    const lastChatPostRef = useRef(0);

    // Track auth state for reconnection
    const [authToken, setAuthToken] = useState<string | null>(() => getTwitchToken());
    const [authUsername, setAuthUsername] = useState<string | null>(() => getTwitchUsername());

    // Listen for auth changes
    useEffect(() => {
        const handler = () => {
            setAuthToken(getTwitchToken());
            setAuthUsername(getTwitchUsername());
        };
        window.addEventListener('pokepelago_twitch_auth_changed', handler);
        return () => window.removeEventListener('pokepelago_twitch_auth_changed', handler);
    }, []);

    const attemptGuessRef = useRef(attemptGuess);
    const showToastRef = useRef(showToast);
    const addGuessRef = useRef(addGuess);
    useEffect(() => { attemptGuessRef.current = attemptGuess; }, [attemptGuess]);
    useEffect(() => { showToastRef.current = showToast; }, [showToast]);
    useEffect(() => { addGuessRef.current = addGuess; }, [addGuess]);

    const postToChat = useCallback((channel: string, message: string) => {
        const client = clientRef.current;
        if (!client || !authToken) return;

        const chatFeedback = localStorage.getItem('pokepelago_twitch_chat_feedback') !== 'false';
        if (!chatFeedback) return;

        const now = Date.now();
        if (now - lastChatPostRef.current < CHAT_POST_COOLDOWN_MS) return;
        lastChatPostRef.current = now;

        client.say(channel, message).catch(() => {});
    }, [authToken]);

    const postToChatRef = useRef(postToChat);
    useEffect(() => { postToChatRef.current = postToChat; }, [postToChat]);

    const channelRef = useRef('');

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

        if (result.type === 'success' || result.type === 'recaught') {
            if (result.pokemonId != null && result.pokemonName) {
                addGuessRef.current(result.pokemonId, result.pokemonName, username, result.type);
            }
            if (result.type === 'success') {
                showToastRef.current('success', `✓ ${result.pokemonName} - guessed by @${username}`);
                postToChatRef.current(channelRef.current, `✓ ${result.pokemonName} guessed by @${username}!`);
            } else {
                showToastRef.current('recaught', `Re-caught ${result.pokemonName} - by @${username}`);
                postToChatRef.current(channelRef.current, `↩ ${result.pokemonName} re-caught by @${username}!`);
            }
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
        channelRef.current = channel;
        setError(null);

        const options: tmi.Options = {
            connection: { reconnect: true, secure: true },
            channels: [channel],
        };

        // Use authenticated connection if token available
        if (authToken && authUsername) {
            options.identity = {
                username: authUsername,
                password: `oauth:${authToken}`,
            };
        }

        const client = new tmi.Client(options);

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
    }, [enabled, channelName, handleMessage, authToken, authUsername]);

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
