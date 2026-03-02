export interface GameProfile {
    id: string;
    name: string;
    hostname: string;
    port: number;
    slotName: string;
    password?: string;
    apworldVersion?: 'legacy' | 'new' | 'unknown';
    isGoaled: boolean;
    goaledAt?: number;
    lastConnected?: number;
    lastKnownGuessable?: number;
    lastKnownCaught?: number;
    goalCount?: number;
    activeRegionNames?: string[];
}

const PROFILES_KEY = 'pokepelago_game_profiles';
const AUTO_REMOVE_KEY = 'pokepelago_autoremove_days';
const DEFAULT_AUTO_REMOVE_DAYS = 3;

export function getProfiles(): GameProfile[] {
    try {
        const raw = localStorage.getItem(PROFILES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function persistProfiles(profiles: GameProfile[]): void {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function saveProfile(profile: GameProfile): void {
    const profiles = getProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
        profiles[idx] = profile;
    } else {
        profiles.push(profile);
    }
    persistProfiles(profiles);
}

export function deleteProfile(id: string): void {
    const profiles = getProfiles().filter(p => p.id !== id);
    persistProfiles(profiles);
}

export function updateProfile(id: string, patch: Partial<GameProfile>): void {
    const profiles = getProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx >= 0) {
        profiles[idx] = { ...profiles[idx], ...patch };
        persistProfiles(profiles);
    }
}

export function getAutoRemoveDays(): number {
    try {
        const val = localStorage.getItem(AUTO_REMOVE_KEY);
        return val ? Number(val) : DEFAULT_AUTO_REMOVE_DAYS;
    } catch {
        return DEFAULT_AUTO_REMOVE_DAYS;
    }
}

export function setAutoRemoveDays(days: number): void {
    localStorage.setItem(AUTO_REMOVE_KEY, String(days));
}

export function pruneGoaledProfiles(): void {
    const days = getAutoRemoveDays();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const profiles = getProfiles().filter(p => {
        if (!p.isGoaled) return true;
        if (!p.goaledAt) return true;
        return p.goaledAt >= cutoff;
    });
    persistProfiles(profiles);
}
