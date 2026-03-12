// Public client ID — safe to embed (no client_secret, implicit grant only)
const TWITCH_CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID ?? 'bbsnyiujc5kp5r2tw29wv4skzevnar';
const STORAGE_KEY_TOKEN = 'pokepelago_twitch_oauth_token';
const STORAGE_KEY_USERNAME = 'pokepelago_twitch_oauth_username';

export function getTwitchClientId(): string {
    return TWITCH_CLIENT_ID;
}

export function hasTwitchClientId(): boolean {
    return TWITCH_CLIENT_ID.length > 0;
}

export function getTwitchAuthUrl(): string {
    const redirectUri = window.location.origin + window.location.pathname;
    const scopes = 'chat:read chat:edit';
    const params = new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'token',
        scope: scopes,
    });
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

export function parseTwitchTokenFromHash(): string | null {
    const hash = window.location.hash;
    if (!hash.includes('access_token')) return null;
    const params = new URLSearchParams(hash.substring(1));
    return params.get('access_token');
}

export function clearHashFromUrl(): void {
    history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function storeTwitchToken(token: string): void {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
}

export function getTwitchToken(): string | null {
    return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function storeTwitchUsername(username: string): void {
    localStorage.setItem(STORAGE_KEY_USERNAME, username);
}

export function getTwitchUsername(): string | null {
    return localStorage.getItem(STORAGE_KEY_USERNAME);
}

export function clearTwitchAuth(): void {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_USERNAME);
    window.dispatchEvent(new Event('pokepelago_twitch_auth_changed'));
}

export interface TwitchValidateResponse {
    login: string;
    user_id: string;
    scopes: string[];
}

export async function validateTwitchToken(token: string): Promise<TwitchValidateResponse | null> {
    try {
        const res = await fetch('https://id.twitch.tv/oauth2/validate', {
            headers: { Authorization: `OAuth ${token}` },
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}
