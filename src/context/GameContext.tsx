import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { PokemonRef } from '../types/pokemon';
import { GENERATIONS } from '../types/pokemon';
import { fetchAllPokemon } from '../services/pokeapi';
import type { Client } from 'archipelago.js';
import type { ConnectedPacket, Item } from 'archipelago.js';
import pokemonMetadata from '../data/pokemon_metadata.json';
import { getCleanName } from '../utils/pokemon';
import { updateProfile } from '../services/connectionManagerService';
import { loadDerpemonIndex, type DerpemonIndex } from '../services/derpemonService';
import { GAME_REGIONS_ORDER } from '../hooks/useOffsets';
import {
    SUB_LEGENDARY_IDS, BOX_LEGENDARY_IDS, MYTHIC_IDS,
    BABY_IDS, TRADE_EVO_IDS, FOSSIL_IDS, ULTRA_BEAST_IDS, PARADOX_IDS,
    STONE_EVO_IDS, STONE_NAMES_ORDERED,
} from '../data/pokemon_gates';
import type { OffsetTable } from '../hooks/useOffsets';
import type { MutableRefObject } from 'react';
import { useAPConnection } from '../hooks/useAPConnection';
import { useSpriteManager } from '../hooks/useSpriteManager';
import { useGoalChecker } from '../hooks/useGoalChecker';
import { useTrapHandler } from '../hooks/useTrapHandler';

export interface LogEntry {
    id: string;
    timestamp: number;
    type: 'item' | 'check' | 'hint' | 'chat' | 'system';
    text: string;
    color?: string;
    parts?: LogPart[];
    isMe?: boolean;
}

export interface LogPart {
    text: string;
    type?: 'player' | 'item' | 'location' | 'color';
    color?: string;
}

export interface ToastMessage {
    type: 'success' | 'error' | 'already' | 'recaught' | 'trap';
    message: string;
    id: number;
}

interface GameState {
    allPokemon: PokemonRef[];
    unlockedIds: Set<number>;
    checkedIds: Set<number>;
    hintedIds: Set<number>;
    isLoading: boolean;
    generationFilter: number[];
    uiSettings: UISettings;
    shadowsEnabled: boolean;
    shinyIds: Set<number>;
    typeLocksEnabled: boolean;
    dexsanityEnabled: boolean;
    legendaryGating: number;
    regionPasses: Set<string>;
    typeUnlocks: Set<string>;
    masterBalls: number;
    pokegears: number;
    pokedexes: number;
    goal?: {
        type: 'any_pokemon' | 'percentage' | 'region_completion' | 'all_legendaries';
        amount: number;
        region?: string;
    };
    goalCount?: number;
    activePokemonLimit: number;
    activeRegions: Record<string, [number, number]>;
    startingRegion: string;
    regionLocksEnabled: boolean;
    logs: LogEntry[];
    gameMode: 'archipelago' | 'standalone' | null;
    startingLocationsEnabled: boolean;
    shuffleEndTime: number;
    derpyfiedIds: Set<number>;
    releasedIds: Set<number>;
    // New lock gate state
    gymBadges: number;
    hasLinkCable: boolean;
    daycareCount: number;
    hasFossilRestorer: boolean;
    hasUltraWormhole: boolean;
    hasTimeRift: boolean;
    unlockedStones: Set<string>;
    legendaryLocksEnabled: boolean;
    tradeLocksEnabled: boolean;
    babyLocksEnabled: boolean;
    daycareRequired: number;
    fossilLocksEnabled: boolean;
    ultraBeastLocksEnabled: boolean;
    paradoxLocksEnabled: boolean;
    stoneLocksEnabled: boolean;
    startingStarter: string | null;
}

export interface UISettings {
    widescreen: boolean;
    masonry: boolean;
    enableSprites: boolean;
    enableShadows: boolean;
    spriteSet: 'normal' | 'derpemon';
    typeDot: boolean;
    showDexNumbers: boolean;
    persistentDot: boolean;
}

interface ConnectionInfo {
    hostname: string;
    port: number;
    slotName: string;
    password?: string;
}

interface GameContextType extends GameState {
    unlockPokemon: (id: number) => void;
    checkPokemon: (id: number) => void;
    recatchPokemon: (id: number) => void;
    setGenerationFilter: React.Dispatch<React.SetStateAction<number[]>>;
    updateUiSettings: (settings: Partial<UISettings>) => void;
    isConnected: boolean;
    connectionError: string | null;
    connect: (info: ConnectionInfo, profileId?: string) => Promise<void>;
    disconnect: () => void;
    addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
    say: (text: string) => void;
    connectionInfo: ConnectionInfo;
    setConnectionInfo: React.Dispatch<React.SetStateAction<ConnectionInfo>>;
    pingLatency: number | null;
    connectionQuality: 'good' | 'degraded' | 'dead' | null;
    selectedPokemonId: number | null;
    setSelectedPokemonId: (id: number | null) => void;
    getLocationName: (locationId: number) => string;
    isPokemonGuessable: (id: number) => {
        canGuess: boolean;
        reason?: string;
        reasons?: string[];
        missingRegion?: string;
        missingTypes?: string[];
        missingPokemon?: boolean;
        legendaryGatingCount?: number;
    };
    useMasterBall: (pokemonId: number) => void;
    usePokegear: (pokemonId: number) => void;
    usePokedex: (pokemonId: number) => void;
    usedMasterBalls: Set<number>;
    usedPokegears: Set<number>;
    usedPokedexes: Set<number>;
    spriteCount: number;
    gameMode: 'archipelago' | 'standalone' | null;
    setGameMode: (mode: 'archipelago' | 'standalone' | null) => void;
    refreshSpriteCount: () => Promise<void>;
    getSpriteUrl: (id: number, options?: { shiny?: boolean; animated?: boolean }) => Promise<string | null>;
    derpemonIndex: DerpemonIndex;
    derpemonSpriteCount: number;
    spriteRepoUrl: string;
    setSpriteRepoUrl: (url: string) => void;
    pmdSpriteUrl: string;
    setPmdSpriteUrl: (url: string) => void;
    unlockRegion: (region: string) => void;
    lockRegion: (region: string) => void;
    clearAllRegions: () => void;
    scoutLocation: (locationId: number) => Promise<{ itemName: string; playerName: string } | null>;
    unlockType: (type: string) => void;
    lockType: (type: string) => void;
    clearAllTypes: () => void;
    goalCount: number | undefined;
    activePokemonLimit: number;
    activeRegions: Record<string, [number, number]>;
    startingRegion: string;
    regionLocksEnabled: boolean;
    startingLocationsEnabled: boolean;
    gameStarted: boolean;
    startGame: () => void;
    connectionKey: number;
    shuffleEndTime: number;
    derpyfiedIds: Set<number>;
    releasedIds: Set<number>;
    setShuffleEndTime: React.Dispatch<React.SetStateAction<number>>;
    setDerpyfiedIds: React.Dispatch<React.SetStateAction<Set<number>>>;
    setReleasedIds: React.Dispatch<React.SetStateAction<Set<number>>>;
    spriteRefreshCounter: number;
    setSpriteRefreshCounter: React.Dispatch<React.SetStateAction<number>>;
    toast: ToastMessage | null;
    showToast: (type: ToastMessage['type'], message: string) => void;
    locationOffset: number;
    STARTER_OFFSET: number;
    MILESTONE_OFFSET: number;
    detectedApWorldVersion: 'legacy' | 'new' | 'unknown';
    currentProfileId: string | null;
    setCurrentProfileId: React.Dispatch<React.SetStateAction<string | null>>;
    typeFilter: string[];
    setTypeFilter: React.Dispatch<React.SetStateAction<string[]>>;
    dexFilter: Set<'guessable' | 'guessed'>;
    setDexFilter: React.Dispatch<React.SetStateAction<Set<'guessable' | 'guessed'>>>;
    categoryFilter: string | null;
    setCategoryFilter: React.Dispatch<React.SetStateAction<string | null>>;
    pokemonLoadError: string | null;
    retryPokemonLoad: () => void;
    // New lock gate state (exposed for TrackerSidebar and other consumers)
    gymBadges: number;
    hasLinkCable: boolean;
    daycareCount: number;
    hasFossilRestorer: boolean;
    hasUltraWormhole: boolean;
    hasTimeRift: boolean;
    unlockedStones: Set<string>;
    legendaryLocksEnabled: boolean;
    tradeLocksEnabled: boolean;
    babyLocksEnabled: boolean;
    daycareRequired: number;
    fossilLocksEnabled: boolean;
    ultraBeastLocksEnabled: boolean;
    paradoxLocksEnabled: boolean;
    stoneLocksEnabled: boolean;
    startingStarter: string | null;
    connectedTeamSlot: { team: number; slot: number } | null;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    // ── Core Pokemon & Game State ────────────────────────────────────────────────
    const [allPokemon, setAllPokemon] = useState<PokemonRef[]>([]);
    const [unlockedIds, setUnlockedIds] = useState<Set<number>>(new Set());
    const [checkedIds, setCheckedIds] = useState<Set<number>>(() => {
        if (localStorage.getItem('pokepelago_gamemode') === 'standalone') {
            const saved = localStorage.getItem('pokepelago_standalone_caught');
            return saved ? new Set<number>(JSON.parse(saved)) : new Set<number>();
        }
        return new Set<number>();
    });
    const [hintedIds, setHintedIds] = useState<Set<number>>(new Set());
    const [shinyIds, setShinyIds] = useState<Set<number>>(new Set());
    const [shadowsEnabled, setShadowsEnabled] = useState(false);
    const [goal, setGoal] = useState<GameState['goal'] | undefined>();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(null);
    const [typeLocksEnabled, setTypeLocksEnabled] = useState(false);
    const [dexsanityEnabled, setDexsanityEnabled] = useState(true);
    const [legendaryGating, setLegendaryGating] = useState(0);
    const [regionPasses, setRegionPasses] = useState<Set<string>>(new Set());
    const [typeUnlocks, setTypeUnlocks] = useState<Set<string>>(new Set());
    const [activePokemonLimit, setActivePokemonLimit] = useState<number>(386);
    const [activeRegions, setActiveRegions] = useState<Record<string, [number, number]>>({});
    const [startingRegion, setStartingRegion] = useState<string>('');
    const [regionLocksEnabled, setRegionLocksEnabled] = useState<boolean>(false);
    const [goalCount, setGoalCount] = useState<number | undefined>(undefined);
    const [slotMilestones, setSlotMilestones] = useState<number[] | undefined>(undefined);
    const [startingLocationsEnabled, setStartingLocationsEnabled] = useState(true);
    const [connectedTeamSlot, setConnectedTeamSlot] = useState<{ team: number; slot: number } | null>(null);
    const [dexsanityLocalWarning, setDexsanityLocalWarning] = useState(false);
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const [detectedApWorldVersion, setDetectedApWorldVersion] = useState<'legacy' | 'new' | 'unknown'>('unknown');
    const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string[]>([]);
    const [dexFilter, setDexFilter] = useState<Set<'guessable' | 'guessed'>>(new Set());
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    // ── Gate item state (new lock systems) ──────────────────────────────────────
    const [gymBadges, setGymBadges] = useState(0);
    const [hasLinkCable, setHasLinkCable] = useState(false);
    const [daycareCount, setDaycareCount] = useState(0);
    const [hasFossilRestorer, setHasFossilRestorer] = useState(false);
    const [hasUltraWormhole, setHasUltraWormhole] = useState(false);
    const [hasTimeRift, setHasTimeRift] = useState(false);
    const [unlockedStones, setUnlockedStones] = useState<Set<string>>(new Set());
    const [legendaryLocksEnabled, setLegendaryLocksEnabled] = useState(false);
    const [tradeLocksEnabled, setTradeLocksEnabled] = useState(false);
    const [babyLocksEnabled, setBabyLocksEnabled] = useState(false);
    const [daycareRequired, setDaycareRequired] = useState(1);
    const [fossilLocksEnabled, setFossilLocksEnabled] = useState(false);
    const [ultraBeastLocksEnabled, setUltraBeastLocksEnabled] = useState(false);
    const [paradoxLocksEnabled, setParadoxLocksEnabled] = useState(false);
    const [stoneLocksEnabled, setStoneLocksEnabled] = useState(false);
    const [startingStarter, setStartingStarter] = useState<string | null>(null);

    // ── Item Counts ──────────────────────────────────────────────────────────────
    const [masterBalls, setMasterBalls] = useState(0);
    const [pokegears, setPokegears] = useState(0);
    const [pokedexes, setPokedexes] = useState(0);
    const [usedMasterBalls, setUsedMasterBalls] = useState<Set<number>>(() => {
        const saved = localStorage.getItem('pokepelago_standalone_usedMasterBalls');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const [usedPokegears, setUsedPokegears] = useState<Set<number>>(() => {
        const saved = localStorage.getItem('pokepelago_standalone_usedPokegears');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const [usedPokedexes, setUsedPokedexes] = useState<Set<number>>(() => {
        const saved = localStorage.getItem('pokepelago_standalone_usedPokedexes');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    // ── UI & Connection ──────────────────────────────────────────────────────────
    const [uiSettings, setUiSettings] = useState<UISettings>(() => {
        const saved = localStorage.getItem('pokepelago_ui');
        const defaults: UISettings = {
            widescreen: false, masonry: false, enableSprites: true,
            enableShadows: false, spriteSet: 'normal', typeDot: true,
            showDexNumbers: true, persistentDot: true,
        };
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    });
    const [isLoading, setIsLoading] = useState(true);
    const [pokemonLoadError, setPokemonLoadError] = useState<string | null>(null);
    const [generationFilter, setGenerationFilter] = useState<number[]>(GENERATIONS.map((_, i) => i));
    const urlParams = useState(() => new URLSearchParams(window.location.search))[0];
    const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>(() => {
        if (urlParams.has('host') || urlParams.has('port') || urlParams.has('name')) {
            const saved = localStorage.getItem('pokepelago_connection');
            const base = saved ? (() => { try { return JSON.parse(saved); } catch { return null; } })() : null;
            return {
                hostname: urlParams.get('host') || base?.hostname || 'archipelago.gg',
                port: urlParams.has('port') ? parseInt(urlParams.get('port')!, 10) || 38281 : base?.port || 38281,
                slotName: urlParams.get('name') || base?.slotName || 'Player1',
                password: urlParams.get('password') || base?.password || '',
            };
        }
        const saved = localStorage.getItem('pokepelago_connection');
        if (saved) { try { return JSON.parse(saved); } catch (e) { console.error('Failed to parse saved connection info', e); } }
        return { hostname: 'archipelago.gg', port: 38281, slotName: 'Player1', password: '' };
    });
    const [gameMode, setGameModeState] = useState<'archipelago' | 'standalone' | null>(() => {
        if (urlParams.has('splash')) return null;
        return localStorage.getItem('pokepelago_gamemode') as any || null;
    });

    // ── Derpemon index (loaded once, shared by useTrapHandler + useSpriteManager) ─
    const [derpemonIndex, setDerpemonIndex] = useState<DerpemonIndex>({});
    useEffect(() => { loadDerpemonIndex().then(setDerpemonIndex); }, []);

    // ── Refs used by event handlers ──────────────────────────────────────────────
    const checkedIdsRef = useRef<Set<number>>(checkedIds);
    const isPokemonGuessableRef = useRef<any>(null);
    const connectionInfoRef = useRef(connectionInfo);
    useEffect(() => { checkedIdsRef.current = checkedIds; }, [checkedIds]);
    useEffect(() => { connectionInfoRef.current = connectionInfo; }, [connectionInfo]);

    // ── Toast ────────────────────────────────────────────────────────────────────
    const showToast = useCallback((type: ToastMessage['type'], message: string) => {
        setToast({ type, message, id: Date.now() });
    }, []);
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // ── Log ─────────────────────────────────────────────────────────────────────
    const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
        setLogs(prev => [
            { ...entry, id: Math.random().toString(36).substring(7), timestamp: Date.now() },
            ...prev.slice(0, 999),
        ]);
    }, []);

    // ── AP Connection Hook ───────────────────────────────────────────────────────
    const apConnection = useAPConnection();
    const {
        clientRef, isConnected, connectionError, pingLatency, connectionQuality,
        connectionKey, isConnectingRef, offsetsRef, isNewApWorldRef,
    } = apConnection;

    // ── Trap Handler Hook ────────────────────────────────────────────────────────
    const {
        shuffleEndTime, setShuffleEndTime,
        derpyfiedIds, setDerpyfiedIds,
        releasedIds, setReleasedIds,
        spriteRefreshCounter, setSpriteRefreshCounter,
        storageReadyRef,
        initFromDataStorage,
        onDataStorageDerpUpdate, onDataStorageReleaseUpdate, onDataStorageRecaughtUpdate,
        processTrapItems,
    } = useTrapHandler({
        offsetsRef,
        checkedIdsRef,
        isPokemonGuessableRef,
        allPokemon,
        derpemonIndex,
        showToast,
        addLog,
    });

    // ── Sprite Manager Hook ──────────────────────────────────────────────────────
    const {
        spriteCount,
        spriteRepoUrl, setSpriteRepoUrl,
        pmdSpriteUrl, setPmdSpriteUrl,
        refreshSpriteCount, getSpriteUrl,
    } = useSpriteManager({ uiSettings, derpyfiedIds, derpemonIndex });

    // ── Goal Checker Hook ────────────────────────────────────────────────────────
    useGoalChecker({
        clientRef, offsetsRef, isNewApWorldRef,
        checkedIds, setCheckedIds,
        releasedIds, allPokemon,
        isConnected, goalCount, gameMode,
        currentProfileId, typeLocksEnabled, typeUnlocks, unlockedIds,
        slotMilestones,
    });

    // ── Persistence Effects ──────────────────────────────────────────────────────
    useEffect(() => {
        if (gameMode === 'standalone')
            localStorage.setItem('pokepelago_standalone_usedMasterBalls', JSON.stringify(Array.from(usedMasterBalls)));
    }, [usedMasterBalls, gameMode]);
    useEffect(() => {
        if (gameMode === 'standalone')
            localStorage.setItem('pokepelago_standalone_usedPokegears', JSON.stringify(Array.from(usedPokegears)));
    }, [usedPokegears, gameMode]);
    useEffect(() => {
        if (gameMode === 'standalone')
            localStorage.setItem('pokepelago_standalone_usedPokedexes', JSON.stringify(Array.from(usedPokedexes)));
    }, [usedPokedexes, gameMode]);

    // Reload standalone caught data when switching into standalone mode mid-session
    useEffect(() => {
        if (gameMode !== 'standalone') return;
        const saved = localStorage.getItem('pokepelago_standalone_caught');
        if (saved) setCheckedIds(new Set<number>(JSON.parse(saved)));
    }, [gameMode]);

    useEffect(() => {
        if (gameMode !== 'standalone') return;
        if (checkedIds.size === 0) return;
        localStorage.setItem('pokepelago_standalone_caught', JSON.stringify(Array.from(checkedIds)));
    }, [checkedIds, gameMode]);

    // Save caught Pokémon locally for dexsanity=OFF AP games
    useEffect(() => {
        if (gameMode !== 'archipelago' || dexsanityEnabled || !connectedTeamSlot) return;
        const { team, slot } = connectedTeamSlot;
        localStorage.setItem(
            `pokepelago_team_${team}_slot_${slot}_caught_local`,
            JSON.stringify(Array.from(checkedIds))
        );
    }, [checkedIds, gameMode, dexsanityEnabled, connectedTeamSlot]);

    // Show dexsanity=OFF warning once per slot
    useEffect(() => {
        if (!connectedTeamSlot || dexsanityEnabled) { setDexsanityLocalWarning(false); return; }
        const { team, slot } = connectedTeamSlot;
        const warned = localStorage.getItem(`pokepelago_team_${team}_slot_${slot}_local_warned`);
        if (!warned) setDexsanityLocalWarning(true);
    }, [connectedTeamSlot, dexsanityEnabled]);

    useEffect(() => {
        localStorage.setItem('pokepelago_ui', JSON.stringify(uiSettings));
    }, [uiSettings]);

    useEffect(() => {
        localStorage.setItem('pokepelago_connection', JSON.stringify(connectionInfo));
    }, [connectionInfo]);

    // Load initial data and auto-connect
    const retryPokemonLoad = useCallback(async () => {
        setIsLoading(true);
        setPokemonLoadError(null);
        const { data, error } = await fetchAllPokemon();
        if (error) {
            setPokemonLoadError(error);
        } else {
            setAllPokemon(data);
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const loadDataAndConnect = async () => {
            setIsLoading(true);
            const { data, error } = await fetchAllPokemon();
            if (error) {
                setPokemonLoadError(error);
                setIsLoading(false);
                return;
            }
            setAllPokemon(data);

            // Auto-connect from URL query params (?host=…&port=…&name=…)
            const qp = new URLSearchParams(window.location.search);
            const hasUrlConnection = qp.has('host') || qp.has('port') || qp.has('name');
            if (hasUrlConnection) {
                setGameModeState('archipelago');
                try { await connect(connectionInfoRef.current); } catch (e) { console.error('URL auto-connect failed', e); }
                // Clean connection params from URL, but preserve other params (e.g. overlay=1)
                // Skip for overlay mode — keeping params lets refresh reconnect automatically
                if (!qp.has('overlay')) {
                    const cleanUrl = new URL(window.location.href);
                    cleanUrl.searchParams.delete('host');
                    cleanUrl.searchParams.delete('port');
                    cleanUrl.searchParams.delete('name');
                    cleanUrl.searchParams.delete('password');
                    const remaining = cleanUrl.search;
                    window.history.replaceState({}, '', window.location.pathname + remaining);
                }
            } else {
                const wasConnected = localStorage.getItem('pokepelago_connected') === 'true';
                const savedConnection = localStorage.getItem('pokepelago_connection');
                const savedMode = localStorage.getItem('pokepelago_gamemode');
                if (savedMode === 'archipelago' && wasConnected && savedConnection) {
                    // Ensure gameMode is set (important for overlay tabs where it may not be persisted)
                    setGameModeState('archipelago');
                    // Await auto-connect so the loading spinner stays up until it resolves.
                    // This prevents a race where the user opens the Connection Manager and
                    // clicks "Connect" while isConnectingRef is still true (which would
                    // silently ignore their request).
                    try { await connect(JSON.parse(savedConnection)); } catch (e) { console.error('Auto-connect failed', e); }
                }
            }

            setIsLoading(false);
        };
        loadDataAndConnect();
    }, []);

    useEffect(() => {
        return () => { if (clientRef.current) clientRef.current.socket.disconnect(); };
    }, []);

    // ── Core Game Functions ──────────────────────────────────────────────────────
    const unlockPokemon = useCallback((id: number) => {
        setUnlockedIds(prev => {
            if (prev.has(id)) return prev;
            const next = new Set(prev); next.add(id); return next;
        });
    }, []);

    const checkPokemon = useCallback((id: number) => {
        setCheckedIds(prev => {
            if (prev.has(id)) return prev;
            const next = new Set(prev); next.add(id); return next;
        });

        // With dexsanity=off there are no per-Pokemon AP locations — only update local state.
        // Persist the guess to DataStorage so it survives reconnects.
        if (!dexsanityEnabled) {
            if (clientRef.current?.authenticated && id >= 1 && id <= 1025) {
                const team = clientRef.current.players.self.team;
                const slot = clientRef.current.players.self.slot;
                clientRef.current.storage.prepare(`pokepelago_team_${team}_slot_${slot}_caught`, []).add([id]).commit();
            }
            return;
        }

        const locationId = offsetsRef.current.LOCATION_OFFSET + id;

        if (clientRef.current?.authenticated) {
            try { clientRef.current.check(locationId); } catch (e) { console.warn('[checkPokemon] check() threw:', e); }
            return;
        }

        if (gameMode !== 'archipelago') return;

        // Disconnected — reconnect and then send the check.
        console.log('[checkPokemon] Not authenticated, reconnecting...');
        const pendingLocationId = locationId;
        const savedInfo = connectionInfoRef.current;
        const doReconnect = async () => {
            if (gameMode !== 'archipelago' || isConnectingRef.current) return;
            try {
                await connect(savedInfo);
                if (clientRef.current?.authenticated) {
                    try { clientRef.current.check(pendingLocationId); } catch (_) { }
                }
            } catch (e) { console.warn('[checkPokemon] reconnect failed:', e); }
        };
        doReconnect();
    }, [isConnected, dexsanityEnabled, gameMode]);

    const recatchPokemon = useCallback((id: number) => {
        setReleasedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        if (clientRef.current?.authenticated && gameMode === 'archipelago') {
            const team = clientRef.current.players.self.team;
            const slot = clientRef.current.players.self.slot;
            clientRef.current.storage.prepare(`pokepelago_team_${team}_slot_${slot}_recaught`, []).add([id]).commit();
        }
    }, [gameMode]);

    const startGame = useCallback(() => {
        if (!clientRef.current || !isConnected || gameMode !== 'archipelago') return;
        const { STARTER_OFFSET, STARTER_COUNT, LOCATION_OFFSET } = offsetsRef.current;
        const newChecked = new Set<number>();
        for (let i = 0; i < STARTER_COUNT; i++) {
            const localId = STARTER_OFFSET + i;
            if (!checkedIds.has(localId)) {
                clientRef.current.check(LOCATION_OFFSET + localId);
                newChecked.add(localId);
            }
        }
        if (newChecked.size > 0) {
            setCheckedIds(prev => { const next = new Set(prev); newChecked.forEach(id => next.add(id)); return next; });
        }
    }, [isConnected, checkedIds, gameMode]);

    const isPokemonGuessable = useCallback((id: number) => {
        const data = (pokemonMetadata as any)[id];
        if (!data) return { canGuess: true };

        if (gameMode === 'standalone') {
            const genIdx = GENERATIONS.findIndex(g => id >= g.startId && id <= g.endId);
            if (genIdx === -1 || !generationFilter.includes(genIdx))
                return { canGuess: false, reason: 'Generation not enabled in settings' };
            return { canGuess: true };
        }

        if (!isConnected) {
            const genIdx = GENERATIONS.findIndex(g => id >= g.startId && id <= g.endId);
            if (genIdx === -1 || !generationFilter.includes(genIdx))
                return { canGuess: false, reason: 'Generation not enabled in settings' };
            return { canGuess: true };
        }

        if (Object.keys(activeRegions).length > 0) {
            const inActiveRegion = Object.values(activeRegions).some(([low, high]) => id >= low && id <= high);
            if (!inActiveRegion) return { canGuess: false, reason: 'This Pokemon is not in your active region.' };
            if (regionLocksEnabled) {
                let pokemonRegion = '';
                for (const [region, [low, high]] of Object.entries(activeRegions)) {
                    if (id >= low && id <= high) { pokemonRegion = region; break; }
                }
                if (pokemonRegion && pokemonRegion !== startingRegion && !regionPasses.has(pokemonRegion)) {
                    return { canGuess: false, reason: `Need ${pokemonRegion} Pass to access this Pokemon.`, missingRegion: pokemonRegion };
                }
            }
        } else if (id > activePokemonLimit) {
            return { canGuess: false, reason: 'This Pokemon is not in your active generation.' };
        }

        if (gameMode === 'archipelago' && detectedApWorldVersion === 'legacy') {
            if (!unlockedIds.has(id))
                return { canGuess: false, reason: "Waiting for this Pokémon's Unlock item.", missingPokemon: true };
        }

        // Collect ALL gate failures so we can show them simultaneously
        const missingTypesList: string[] = typeLocksEnabled
            ? data.types
                .filter((t: string) => !typeUnlocks.has(t.charAt(0).toUpperCase() + t.slice(1)))
                .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1))
            : [];

        const gateReasons: string[] = [];
        if (legendaryLocksEnabled) {
            const needed = MYTHIC_IDS.has(id) ? 8 : BOX_LEGENDARY_IDS.has(id) ? 7 : SUB_LEGENDARY_IDS.has(id) ? 6 : 0;
            if (needed > 0 && gymBadges < needed)
                gateReasons.push(`Badges: ${gymBadges}/${needed}`);
        }
        if (tradeLocksEnabled && TRADE_EVO_IDS.has(id) && !hasLinkCable)
            gateReasons.push('Link Cable');
        if (babyLocksEnabled && BABY_IDS.has(id) && daycareCount < daycareRequired)
            gateReasons.push(`Daycare: ${daycareCount}/${daycareRequired}`);
        if (fossilLocksEnabled && FOSSIL_IDS.has(id) && !hasFossilRestorer)
            gateReasons.push('Fossil Restorer');
        if (ultraBeastLocksEnabled && ULTRA_BEAST_IDS.has(id) && !hasUltraWormhole)
            gateReasons.push('Ultra Wormhole');
        if (paradoxLocksEnabled && PARADOX_IDS.has(id) && !hasTimeRift)
            gateReasons.push('Time Rift');
        if (stoneLocksEnabled) {
            for (const [stone, ids] of Object.entries(STONE_EVO_IDS)) {
                if (ids.has(id) && !unlockedStones.has(stone))
                    gateReasons.push(`Need ${stone.charAt(0).toUpperCase()}${stone.slice(1)} Stone`);
            }
        }

        if (missingTypesList.length > 0 || gateReasons.length > 0) {
            const firstReason = missingTypesList.length > 0
                ? `Missing Type Keys: ${missingTypesList.join(', ')}`
                : gateReasons[0];
            return {
                canGuess: false,
                reason: firstReason,
                reasons: gateReasons,
                missingTypes: missingTypesList.length > 0 ? missingTypesList : undefined,
            };
        }

        return { canGuess: true };
    }, [gameMode, isConnected, generationFilter, activePokemonLimit, activeRegions, startingRegion,
        regionLocksEnabled, regionPasses, typeLocksEnabled, typeUnlocks, detectedApWorldVersion, unlockedIds,
        legendaryLocksEnabled, gymBadges, tradeLocksEnabled, hasLinkCable,
        babyLocksEnabled, daycareCount, daycareRequired, fossilLocksEnabled, hasFossilRestorer,
        ultraBeastLocksEnabled, hasUltraWormhole, paradoxLocksEnabled, hasTimeRift,
        stoneLocksEnabled, unlockedStones]);

    useEffect(() => { isPokemonGuessableRef.current = isPokemonGuessable; }, [isPokemonGuessable]);

    const getLocationName = useCallback((locationId: number) => {
        let name: string | undefined;
        if (clientRef.current)
            name = clientRef.current.package.lookupLocationName(clientRef.current.game, locationId, false);
        const { LOCATION_OFFSET, MILESTONE_OFFSET } = offsetsRef.current;
        if (!name && locationId > LOCATION_OFFSET && locationId <= LOCATION_OFFSET + Math.max(1050, MILESTONE_OFFSET)) {
            const pkmnId = locationId - LOCATION_OFFSET;
            const pkmn = allPokemon.find(p => p.id === pkmnId);
            if (pkmn) name = `Pokémon #${pkmnId} (${getCleanName(pkmn.name)})`;
        }
        return name || `Unknown Location ${locationId}`;
    }, [allPokemon]);

    const say = useCallback((text: string) => {
        if (clientRef.current && isConnected) clientRef.current.messages.say(text);
    }, [isConnected]);

    const dismissDexsanityWarning = useCallback(() => {
        if (connectedTeamSlot) {
            const { team, slot } = connectedTeamSlot;
            localStorage.setItem(`pokepelago_team_${team}_slot_${slot}_local_warned`, 'true');
        }
        setDexsanityLocalWarning(false);
    }, [connectedTeamSlot]);

    const setGameMode = useCallback((mode: 'archipelago' | 'standalone' | null) => {
        setGameModeState(mode);
        if (mode) localStorage.setItem('pokepelago_gamemode', mode);
        else localStorage.removeItem('pokepelago_gamemode');
    }, []);

    const updateUiSettings = (newSettings: Partial<UISettings>) => {
        setUiSettings(prev => {
            const next = { ...prev, ...newSettings };
            if (newSettings.spriteSet !== undefined || newSettings.enableSprites !== undefined)
                setSpriteRefreshCounter(c => c + 1);
            return next;
        });
    };

    const useMasterBall = useCallback((pokemonId: number) => {
        if (masterBalls > 0) {
            setMasterBalls(prev => prev - 1);
            setUsedMasterBalls(prev => new Set(prev).add(pokemonId));
            if (clientRef.current?.authenticated) {
                const team = clientRef.current.players.self.team;
                const slot = clientRef.current.players.self.slot;
                clientRef.current.storage.prepare(`pokepelago_team_${team}_slot_${slot}_used_masterballs`, []).add([pokemonId]).commit();
            }
            checkPokemon(pokemonId);
            addLog({ type: 'system', text: `Used a Master Ball on Pokemon #${pokemonId}!`, isMe: true });
        }
    }, [masterBalls, checkPokemon, addLog]);

    const usePokegear = useCallback((pokemonId: number) => {
        if (pokegears > 0) {
            setPokegears(prev => prev - 1);
            setUsedPokegears(prev => new Set(prev).add(pokemonId));
            if (clientRef.current?.authenticated) {
                const team = clientRef.current.players.self.team;
                const slot = clientRef.current.players.self.slot;
                clientRef.current.storage.prepare(`pokepelago_team_${team}_slot_${slot}_used_pokegears`, []).add([pokemonId]).commit();
            }
            addLog({ type: 'system', text: `Used a Pokegear on Pokemon #${pokemonId}!`, isMe: true });
        }
    }, [pokegears, addLog]);

    const usePokedex = useCallback((pokemonId: number) => {
        if (pokedexes > 0) {
            setPokedexes(prev => prev - 1);
            setUsedPokedexes(prev => new Set(prev).add(pokemonId));
            if (clientRef.current?.authenticated) {
                const team = clientRef.current.players.self.team;
                const slot = clientRef.current.players.self.slot;
                clientRef.current.storage.prepare(`pokepelago_team_${team}_slot_${slot}_used_pokedexes`, []).add([pokemonId]).commit();
            }
            addLog({ type: 'system', text: `Used a Pokedex on Pokemon #${pokemonId}!`, isMe: true });
        }
    }, [pokedexes, addLog]);

    const unlockRegion = useCallback((region: string) => { setRegionPasses(prev => new Set(prev).add(region)); }, []);
    const lockRegion = useCallback((region: string) => { setRegionPasses(prev => { const next = new Set(prev); next.delete(region); return next; }); }, []);
    const clearAllRegions = useCallback(() => { setRegionPasses(new Set()); }, []);
    const unlockType = useCallback((typeName: string) => { setTypeUnlocks(prev => new Set(prev).add(typeName)); }, []);
    const lockType = useCallback((typeName: string) => { setTypeUnlocks(prev => { const next = new Set(prev); next.delete(typeName); return next; }); }, []);
    const clearAllTypes = useCallback(() => { setTypeUnlocks(new Set()); }, []);

    const scoutLocation = useCallback(async (locationId: number) => {
        if (!clientRef.current?.authenticated) return null;
        try {
            const items = await clientRef.current.scout([locationId]);
            if (items && items.length > 0) {
                const item = items[0];
                return { itemName: item.name, playerName: item.receiver.alias };
            }
        } catch (e) { console.warn('[GameContext] Failed to scout location', locationId, e); }
        return null;
    }, []);

    // ── Connection Event Handlers ─────────────────────────────────────────────────

    const onConnected = useCallback((
        packet: ConnectedPacket,
        client: Client,
        isNewVersion: boolean,
        offsets: MutableRefObject<OffsetTable>,
    ) => {
        const o = offsets.current;

        // Sync already-checked locations
        const checkedLocs = packet.checked_locations || [];
        const newChecked = new Set<number>();
        checkedLocs.forEach((locId: number) => {
            if (locId >= o.LOCATION_OFFSET && locId <= o.LOCATION_OFFSET + 200_000)
                newChecked.add(locId - o.LOCATION_OFFSET);
        });
        setCheckedIds(newChecked);

        // Reconstruct received items
        const receivedItems = client.items.received;
        const newUnlocked = new Set<number>();
        receivedItems.forEach(item => {
            if (item.id > o.ITEM_OFFSET && item.id <= o.ITEM_OFFSET + 1025)
                newUnlocked.add(item.id - o.ITEM_OFFSET);
        });
        setUnlockedIds(newUnlocked);

        // Reconstruct shinyIds
        const shinyCount = receivedItems.filter(i => i.id === o.ITEM_OFFSET + 6020).length;
        setShinyIds(shinyCount > 0 ? new Set(Array.from(newUnlocked).slice(0, shinyCount)) : new Set());

        // Reconstruct gate items
        setGymBadges(receivedItems.filter(i => i.id === o.ITEM_OFFSET + 6000).length);
        setHasLinkCable(receivedItems.some(i => i.id === o.ITEM_OFFSET + 6001));
        setDaycareCount(receivedItems.filter(i => i.id === o.ITEM_OFFSET + 6002).length);
        setHasUltraWormhole(receivedItems.some(i => i.id === o.ITEM_OFFSET + 6003));
        setHasTimeRift(receivedItems.some(i => i.id === o.ITEM_OFFSET + 6004));
        setHasFossilRestorer(receivedItems.some(i => i.id === o.ITEM_OFFSET + 6005));
        const newStones = new Set<string>();
        STONE_NAMES_ORDERED.forEach((s, i) => {
            if (receivedItems.some(item => item.id === o.ITEM_OFFSET + 6010 + i)) newStones.add(s);
        });
        setUnlockedStones(newStones);

        // Reconstruct Type Unlocks
        const typesMap = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark'];
        const newTypeUnlocks = new Set<string>();
        receivedItems.forEach(item => {
            if (item.id >= o.ITEM_OFFSET + o.TYPE_ITEM_OFFSET && item.id <= o.ITEM_OFFSET + o.TYPE_ITEM_OFFSET + 17)
                newTypeUnlocks.add(typesMap[item.id - (o.ITEM_OFFSET + o.TYPE_ITEM_OFFSET)]);
        });
        setTypeUnlocks(newTypeUnlocks);

        // Reconstruct Region Passes
        const newRegionPasses = new Set<string>();
        receivedItems.forEach(item => {
            const idx = item.id - (o.ITEM_OFFSET + o.REGION_PASS_OFFSET);
            if (idx >= 0 && idx < GAME_REGIONS_ORDER.length) newRegionPasses.add(GAME_REGIONS_ORDER[idx]);
        });
        setRegionPasses(newRegionPasses);

        // Parse slot data
        const slotData = packet.slot_data as any || {};
        setShadowsEnabled(!!slotData.shadows);
        setTypeLocksEnabled(!!slotData.type_locks);
        setDexsanityEnabled(slotData.dexsanity !== undefined ? !!slotData.dexsanity : true);
        setLegendaryGating(slotData.legendary_gating ?? 0);
        setRegionLocksEnabled(!!slotData.region_locks);
        setLegendaryLocksEnabled(!!slotData.legendary_locks);
        setTradeLocksEnabled(!!slotData.trade_locks);
        setBabyLocksEnabled(!!slotData.baby_locks);
        setDaycareRequired(slotData.daycare_count ?? 1);
        setFossilLocksEnabled(!!slotData.fossil_locks);
        setUltraBeastLocksEnabled(!!slotData.ultra_beast_locks);
        setParadoxLocksEnabled(!!slotData.paradox_locks);
        setStoneLocksEnabled(!!slotData.stone_locks);
        setStartingStarter(slotData.starting_starter ?? null);

        if (slotData.active_regions !== undefined) {
            const ar = slotData.active_regions as Record<string, [number, number]>;
            setActiveRegions(ar);
            setStartingRegion(slotData.starting_region ?? '');
            const regionToGenIdx: Record<string, number> = {
                Kanto: 0, Johto: 1, Hoenn: 2, Sinnoh: 3, Unova: 4, Kalos: 5, Alola: 6, Galar: 7, Hisui: 8, Paldea: 9,
            };
            const genIdxSet = new Set<number>();
            for (const r of Object.keys(ar)) { const idx = regionToGenIdx[r]; if (idx !== undefined) genIdxSet.add(idx); }
            setGenerationFilter(Array.from(genIdxSet).sort());
            setActivePokemonLimit(Math.max(...Object.values(ar).map(([, hi]) => hi)));
        } else if (slotData.pokemon_generations !== undefined) {
            const gens = slotData.pokemon_generations;
            if (gens === 0) { setGenerationFilter([0]); setActivePokemonLimit(151); }
            else if (gens === 1) { setGenerationFilter([0, 1]); setActivePokemonLimit(251); }
            else if (gens === 2) { setGenerationFilter([0, 1, 2]); setActivePokemonLimit(386); }
            else if (gens === 3) { setGenerationFilter([0, 1, 2, 3]); setActivePokemonLimit(493); }
            else if (gens === 4) { setGenerationFilter([0, 1, 2, 3, 4]); setActivePokemonLimit(649); }
            else if (gens === 5) { setGenerationFilter([0, 1, 2, 3, 4, 5]); setActivePokemonLimit(721); }
            else if (gens === 6) { setGenerationFilter([0, 1, 2, 3, 4, 5, 6]); setActivePokemonLimit(809); }
            else if (gens === 7) { setGenerationFilter([0, 1, 2, 3, 4, 5, 6, 7]); setActivePokemonLimit(898); }
            else if (gens === 8) { setGenerationFilter([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); setActivePokemonLimit(1025); }
        }

        if (slotData.goal_count !== undefined) {
            setGoalCount(slotData.goal_count);
            setGoal({ type: 'any_pokemon', amount: slotData.goal_count });
        }
        const rawMilestones = slotData.milestones;
        if (Array.isArray(rawMilestones) && rawMilestones.every((n: unknown) => typeof n === 'number')) {
            setSlotMilestones(rawMilestones as number[]);
        }
        if (typeof slotData.starter_count === 'number') {
            offsetsRef.current = { ...offsetsRef.current, STARTER_COUNT: slotData.starter_count };
        }
        setStartingLocationsEnabled(!!slotData.starting_locations);
        setDetectedApWorldVersion(isNewVersion ? 'new' : 'legacy');

        if (!isNewVersion) {
            setLogs(prev => [{
                id: crypto.randomUUID(), timestamp: Date.now(), type: 'system',
                text: '⚠ Connected to a Legacy APWorld. Some features (region locks, type key system) may not be available.',
                color: '#F59E0B',
            }, ...prev.slice(0, 99)]);
        }

        if (currentProfileId) {
            updateProfile(currentProfileId, {
                lastConnected: Date.now(),
                apworldVersion: isNewVersion ? 'new' : 'legacy',
                goalCount: slotData.goal_count,
                activeRegionNames: slotData.active_regions ? Object.keys(slotData.active_regions) : undefined,
            });
        }

        // DataStorage setup
        const team = client.players.self.team;
        const slot = client.players.self.slot;

        // Detect new game via seed change; wipe stale local backup if needed
        const seedName = client.room.seedName;
        const seedKey = `pokepelago_team_${team}_slot_${slot}_seed`;
        const caughtLocalKey = `pokepelago_team_${team}_slot_${slot}_caught_local`;
        if (localStorage.getItem(seedKey) !== seedName) {
            localStorage.removeItem(caughtLocalKey);
            localStorage.setItem(seedKey, seedName);
        }
        setConnectedTeamSlot({ team, slot });

        // Immediately restore from local backup for dexsanity=OFF
        if (!slotData.dexsanity) {
            const localCaught = localStorage.getItem(caughtLocalKey);
            if (localCaught) {
                const ids = JSON.parse(localCaught) as number[];
                setCheckedIds(prev => new Set([...prev, ...ids]));
            }
        }

        const mbKey = `pokepelago_team_${team}_slot_${slot}_used_masterballs`;
        const pgKey = `pokepelago_team_${team}_slot_${slot}_used_pokegears`;
        const pdKey = `pokepelago_team_${team}_slot_${slot}_used_pokedexes`;
        const derpKey = `pokepelago_team_${team}_slot_${slot}_derpyfied`;
        const relKey = `pokepelago_team_${team}_slot_${slot}_released`;
        const recaughtKey = `pokepelago_team_${team}_slot_${slot}_recaught`;
        const caughtKey = !slotData.dexsanity ? `pokepelago_team_${team}_slot_${slot}_caught` : null;

        const keysToWatch = [mbKey, pgKey, pdKey, derpKey, relKey, recaughtKey, ...(caughtKey ? [caughtKey] : [])];
        // Validate that DataStorage values are finite integers in the valid Pokémon ID range.
        const validIds = (raw: unknown): number[] =>
            Array.isArray(raw) ? (raw as unknown[]).filter((v): v is number => Number.isFinite(v) && (v as number) >= 1 && (v as number) <= 1025) : [];

        client.storage.notify(keysToWatch, (key, value) => {
            if (!Array.isArray(value)) return;
            const usedIds = new Set(validIds(value));
            if (key === mbKey) {
                const total = client.items.received.filter(i => i.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 1).length;
                setMasterBalls(Math.max(0, total - usedIds.size)); setUsedMasterBalls(usedIds);
            } else if (key === pgKey) {
                const total = client.items.received.filter(i => i.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 2).length;
                setPokegears(Math.max(0, total - usedIds.size)); setUsedPokegears(usedIds);
            } else if (key === pdKey) {
                const total = client.items.received.filter(i => i.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 3).length;
                setPokedexes(Math.max(0, total - usedIds.size)); setUsedPokedexes(usedIds);
            } else if (key === derpKey) {
                onDataStorageDerpUpdate(validIds(value));
            } else if (key === relKey) {
                onDataStorageReleaseUpdate(validIds(value));
            } else if (key === recaughtKey) {
                onDataStorageRecaughtUpdate(new Set(validIds(value)));
            } else if (caughtKey && key === caughtKey) {
                setCheckedIds(prev => new Set([...prev, ...usedIds]));
            }
        }).then((data) => {
            // Reconstruct useful item counts from received items + DataStorage used sets
            const mbUsed = new Set(validIds(data[mbKey] ?? []));
            const pgUsed = new Set(validIds(data[pgKey] ?? []));
            const pdUsed = new Set(validIds(data[pdKey] ?? []));

            const mbTotal = client.items.received.filter(i => i.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 1).length;
            const pgTotal = client.items.received.filter(i => i.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 2).length;
            const pdTotal = client.items.received.filter(i => i.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 3).length;

            setMasterBalls(Math.max(0, mbTotal - mbUsed.size));
            setUsedMasterBalls(mbUsed);
            setPokegears(Math.max(0, pgTotal - pgUsed.size));
            setUsedPokegears(pgUsed);
            setPokedexes(Math.max(0, pdTotal - pdUsed.size));
            setUsedPokedexes(pdUsed);

            initFromDataStorage(
                Array.isArray(data[derpKey]) ? validIds(data[derpKey]) : null,
                Array.isArray(data[relKey]) ? validIds(data[relKey]) : null,
                Array.isArray(data[recaughtKey]) ? validIds(data[recaughtKey]) : null,
            );
            if (caughtKey && Array.isArray(data[caughtKey]))
                setCheckedIds(prev => new Set([...prev, ...validIds(data[caughtKey])]));
        }).catch(console.error);
    }, [currentProfileId, onDataStorageDerpUpdate, onDataStorageReleaseUpdate, onDataStorageRecaughtUpdate, initFromDataStorage]);

    const onDisconnected = useCallback(() => {
        setUnlockedIds(new Set());
        setCheckedIds(new Set());
        setHintedIds(new Set());
        setShinyIds(new Set());
        setLogs([]);
        setDerpyfiedIds(new Set());
        setReleasedIds(new Set());
        setSpriteRefreshCounter(0);
        setTypeFilter([]);
        setDexFilter(new Set());
        setCategoryFilter(null);
        setSelectedPokemonId(null);
        setMasterBalls(0); setPokegears(0); setPokedexes(0);
        setUsedMasterBalls(new Set()); setUsedPokegears(new Set()); setUsedPokedexes(new Set());
        setShuffleEndTime(0);
        setConnectedTeamSlot(null);
        setSlotMilestones(undefined);
        // Reset gate items
        setGymBadges(0);
        setHasLinkCable(false);
        setDaycareCount(0);
        setHasFossilRestorer(false);
        setHasUltraWormhole(false);
        setHasTimeRift(false);
        setUnlockedStones(new Set());
        setLegendaryLocksEnabled(false);
        setTradeLocksEnabled(false);
        setBabyLocksEnabled(false);
        setDaycareRequired(1);
        setFossilLocksEnabled(false);
        setUltraBeastLocksEnabled(false);
        setParadoxLocksEnabled(false);
        setStoneLocksEnabled(false);
        setStartingStarter(null);
        localStorage.setItem('pokepelago_connected', 'false');
    }, []);

    const onItemsReceived = useCallback((items: Item[], client: Client) => {
        const o = offsetsRef.current;
        let recalculateItems = false;

        items.forEach(item => {
            if (item.id > o.ITEM_OFFSET && item.id <= o.ITEM_OFFSET + 1025) {
                unlockPokemon(item.id - o.ITEM_OFFSET);
            } else if (item.id === o.ITEM_OFFSET + 6020) {
                setUnlockedIds(unlocked => {
                    const pokemonIds = Array.from(unlocked);
                    setShinyIds(prev => {
                        const next = new Set(prev);
                        const targetIdx = prev.size;
                        if (targetIdx < pokemonIds.length) next.add(pokemonIds[targetIdx]);
                        return next;
                    });
                    return unlocked;
                });
            } else if (item.id === o.ITEM_OFFSET + 6000) {
                setGymBadges(prev => prev + 1);
            } else if (item.id === o.ITEM_OFFSET + 6001) {
                setHasLinkCable(true);
            } else if (item.id === o.ITEM_OFFSET + 6002) {
                setDaycareCount(prev => prev + 1);
            } else if (item.id === o.ITEM_OFFSET + 6003) {
                setHasUltraWormhole(true);
            } else if (item.id === o.ITEM_OFFSET + 6004) {
                setHasTimeRift(true);
            } else if (item.id === o.ITEM_OFFSET + 6005) {
                setHasFossilRestorer(true);
            } else if (item.id >= o.ITEM_OFFSET + 6010 && item.id <= o.ITEM_OFFSET + 6019) {
                const stone = STONE_NAMES_ORDERED[item.id - (o.ITEM_OFFSET + 6010)];
                if (stone) setUnlockedStones(prev => new Set(prev).add(stone));
            } else if (item.id >= o.ITEM_OFFSET + o.TYPE_ITEM_OFFSET && item.id <= o.ITEM_OFFSET + o.TYPE_ITEM_OFFSET + 17) {
                const types = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark'];
                const typeName = types[item.id - (o.ITEM_OFFSET + o.TYPE_ITEM_OFFSET)];
                setTypeUnlocks(prev => new Set(prev).add(typeName));
                setLogs(prev => [{
                    id: crypto.randomUUID(), timestamp: Date.now(), type: 'system',
                    text: `Received Type Unlock: ${typeName}`,
                    parts: [{ text: `Received Type Unlock: ${typeName}`, type: 'color', color: '#10B981' }],
                }, ...prev.slice(0, 99)]);
            } else if (item.id >= o.ITEM_OFFSET + o.REGION_PASS_OFFSET && item.id < o.ITEM_OFFSET + o.REGION_PASS_OFFSET + GAME_REGIONS_ORDER.length) {
                const regionName = GAME_REGIONS_ORDER[item.id - (o.ITEM_OFFSET + o.REGION_PASS_OFFSET)];
                setRegionPasses(prev => new Set(prev).add(regionName));
                setLogs(prev => [{
                    id: crypto.randomUUID(), timestamp: Date.now(), type: 'system',
                    text: `Received ${regionName} Pass!`,
                    parts: [{ text: `Received ${regionName} Pass!`, type: 'color', color: '#F59E0B' }],
                }, ...prev.slice(0, 99)]);
            } else if (
                item.id === o.ITEM_OFFSET + o.TRAP_ITEM_OFFSET + 1 ||
                item.id === o.ITEM_OFFSET + o.TRAP_ITEM_OFFSET + 2 ||
                item.id === o.ITEM_OFFSET + o.TRAP_ITEM_OFFSET + 3 ||
                item.id === o.ITEM_OFFSET + o.TRAP_ITEM_OFFSET + 4 ||
                item.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 1 ||
                item.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 2 ||
                item.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 3
            ) {
                recalculateItems = true;
            }
        });

        if (recalculateItems) {
            setUsedMasterBalls(used => { setMasterBalls(Math.max(0, client.items.received.filter(i => i.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 1).length - used.size)); return used; });
            setUsedPokegears(used => { setPokegears(Math.max(0, client.items.received.filter(i => i.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 2).length - used.size)); return used; });
            setUsedPokedexes(used => { setPokedexes(Math.max(0, client.items.received.filter(i => i.id === o.ITEM_OFFSET + o.USEFUL_ITEM_OFFSET + 3).length - used.size)); return used; });
            processTrapItems(items, client);
        }
    }, [unlockPokemon, processTrapItems]);

    const onPrintJSON = useCallback((packet: any, client: Client) => {
        if (packet.type === 'Hint') {
            const item = packet.item as any;
            if (item && item.receiving_player === client.players.self.slot) {
                const o = offsetsRef.current;
                if ((item.item as number) > o.ITEM_OFFSET && (item.item as number) <= o.ITEM_OFFSET + 1025) {
                    const dexId = (item.item as number) - o.ITEM_OFFSET;
                    setHintedIds(prev => { const next = new Set(prev); next.add(dexId); return next; });
                }
            }
        }
        if (packet.data) {
            const parts = packet.data.map((p: any) => {
                let text = p.text || '';
                let type = p.type || 'color';
                if (p.type === 'player_id') {
                    const pid = parseInt(p.text);
                    text = client.players.findPlayer(pid)?.alias || `Player ${pid}`; type = 'player';
                } else if (p.type === 'item_id') {
                    const iid = parseInt(p.text);
                    const player = client.players.findPlayer(p.player);
                    text = client.package.lookupItemName(player?.game || client.game, iid) || `Item ${iid}`; type = 'item';
                } else if (p.type === 'location_id') {
                    const lid = parseInt(p.text);
                    const player = client.players.findPlayer(p.player);
                    text = client.package.lookupLocationName(player?.game || client.game, lid) || `Location ${lid}`; type = 'location';
                }
                return { text, type, color: p.color };
            });
            const isHintOrItem = packet.type === 'Hint' || packet.type === 'ItemSend' || packet.type === 'ItemCheat';
            const isMe = !isHintOrItem || !client.players.self ? true :
                packet.data.some((p: any) => p.type === 'player_id' && parseInt(p.text) === client.players.self.slot);
            addLog({
                type: packet.type === 'Hint' ? 'hint' : packet.type === 'ItemSend' ? 'item' : packet.type === 'Chat' ? 'chat' : 'system',
                text: parts.map((p: any) => p.text).join(''), parts, isMe,
            });
        }
    }, [addLog]);

    const onLocationInfo = useCallback((packet: any, client: Client) => {
        const o = offsetsRef.current;
        packet.locations.forEach((item: any) => {
            if (item.player === client.players.self.slot && (item.item as number) > o.ITEM_OFFSET && (item.item as number) <= o.ITEM_OFFSET + 1025) {
                const dexId = (item.item as number) - o.ITEM_OFFSET;
                setHintedIds(prev => { const next = new Set(prev); next.add(dexId); return next; });
            }
        });
    }, []);

    const onRoomUpdate = useCallback((packet: any) => {
        const o = offsetsRef.current;
        const newChecked: number[] | undefined = packet.checked_locations;
        if (!newChecked || newChecked.length === 0) return;
        setCheckedIds(prev => {
            const next = new Set(prev);
            let changed = false;
            for (const locId of newChecked) {
                if (locId >= o.LOCATION_OFFSET && locId <= o.LOCATION_OFFSET + 200_000) {
                    const pokemonId = locId - o.LOCATION_OFFSET;
                    if (!next.has(pokemonId)) {
                        next.add(pokemonId);
                        changed = true;
                    }
                }
            }
            return changed ? next : prev;
        });
    }, []);

    // ── Public connect / disconnect ───────────────────────────────────────────────
    const connect = useCallback(async (info: ConnectionInfo, profileId?: string) => {
        if (profileId) setCurrentProfileId(profileId);
        storageReadyRef.current = false;
        const isOverlay = urlParams.has('overlay');
        await apConnection.connect(info, profileId, {
            onConnected, onDisconnected, onItemsReceived, onPrintJSON, onLocationInfo, onRoomUpdate,
        }, isOverlay ? ['Tracker'] : undefined);
    }, [apConnection, onConnected, onDisconnected, onItemsReceived, onPrintJSON, onLocationInfo, onRoomUpdate, urlParams]);

    const disconnect = useCallback(() => {
        apConnection.disconnect();
        onDisconnected();
    }, [apConnection, onDisconnected]);

    // ── Overlay auto-reconnect ────────────────────────────────────────────────────
    // When the overlay loses connection, retry with exponential backoff (3s → 6s → 12s, max 30s)
    const overlayReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const overlayBackoffRef = useRef(3000);
    useEffect(() => {
        const isOverlay = urlParams.has('overlay');
        if (!isOverlay || gameMode !== 'archipelago') return;

        if (isConnected) {
            // Connected — reset backoff
            overlayBackoffRef.current = 3000;
            if (overlayReconnectRef.current) { clearTimeout(overlayReconnectRef.current); overlayReconnectRef.current = null; }
            return;
        }

        // Disconnected in overlay mode — schedule reconnect
        if (isConnectingRef.current) return; // already connecting
        overlayReconnectRef.current = setTimeout(async () => {
            overlayReconnectRef.current = null;
            if (isConnectingRef.current) return;
            try {
                await connect(connectionInfoRef.current);
            } catch {
                // Will trigger re-render with isConnected still false → effect retries with higher backoff
            }
            overlayBackoffRef.current = Math.min(overlayBackoffRef.current * 2, 30000);
        }, overlayBackoffRef.current);

        return () => { if (overlayReconnectRef.current) { clearTimeout(overlayReconnectRef.current); overlayReconnectRef.current = null; } };
    }, [isConnected, gameMode, connect, urlParams, isConnectingRef]);

    // ── Derived ──────────────────────────────────────────────────────────────────
    const { STARTER_OFFSET, STARTER_COUNT } = offsetsRef.current;
    const gameStarted = !startingLocationsEnabled ||
        Array.from({ length: STARTER_COUNT }, (_, i) => i).some(i => checkedIds.has(STARTER_OFFSET + i));

    return (
        <GameContext.Provider value={{
            allPokemon, unlockedIds, checkedIds, hintedIds, shinyIds, isLoading,
            generationFilter, setGenerationFilter,
            unlockPokemon, checkPokemon, recatchPokemon,
            uiSettings, updateUiSettings,
            isConnected, connectionError, connect, disconnect,
            shadowsEnabled, goal, logs, addLog, say,
            connectionInfo, setConnectionInfo,
            pingLatency, connectionQuality,
            selectedPokemonId, setSelectedPokemonId,
            getLocationName,
            typeLocksEnabled, dexsanityEnabled, legendaryGating,
            regionPasses, typeUnlocks,
            masterBalls, pokegears, pokedexes,
            useMasterBall, usePokegear, usePokedex,
            usedMasterBalls, usedPokegears, usedPokedexes,
            spriteCount, refreshSpriteCount, getSpriteUrl,
            derpemonIndex, derpemonSpriteCount: Object.keys(derpemonIndex).length,
            spriteRepoUrl, setSpriteRepoUrl, pmdSpriteUrl, setPmdSpriteUrl,
            isPokemonGuessable, gameMode, setGameMode,
            goalCount, activePokemonLimit, activeRegions, startingRegion, regionLocksEnabled,
            startingLocationsEnabled, gameStarted, startGame,
            connectionKey,
            unlockRegion, lockRegion, clearAllRegions,
            scoutLocation,
            unlockType, lockType, clearAllTypes,
            shuffleEndTime, derpyfiedIds, releasedIds,
            setShuffleEndTime, setDerpyfiedIds, setReleasedIds,
            spriteRefreshCounter, setSpriteRefreshCounter,
            toast, showToast,
            locationOffset: offsetsRef.current.LOCATION_OFFSET,
            STARTER_OFFSET: offsetsRef.current.STARTER_OFFSET,
            MILESTONE_OFFSET: offsetsRef.current.MILESTONE_OFFSET,
            detectedApWorldVersion,
            currentProfileId, setCurrentProfileId,
            typeFilter, setTypeFilter,
            dexFilter, setDexFilter,
            categoryFilter, setCategoryFilter,
            pokemonLoadError, retryPokemonLoad,
            gymBadges, hasLinkCable, daycareCount, hasFossilRestorer, hasUltraWormhole, hasTimeRift,
            unlockedStones, legendaryLocksEnabled, tradeLocksEnabled, babyLocksEnabled, daycareRequired,
            fossilLocksEnabled, ultraBeastLocksEnabled, paradoxLocksEnabled, stoneLocksEnabled, startingStarter,
            connectedTeamSlot,
        }}>
            {children}
            {dexsanityLocalWarning && (
                <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-amber-500/40 flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-800 bg-amber-900/20">
                            <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                                ⚠ Progress saved locally only
                            </h2>
                        </div>
                        <div className="px-6 py-5 text-gray-300 text-sm leading-relaxed">
                            <p>
                                Because <strong className="text-white">Dexsanity is off</strong>, your caught Pokémon are
                                stored on <strong className="text-white">this device only</strong> — they cannot sync to
                                the Archipelago server.
                            </p>
                            <p className="mt-3 text-gray-400">
                                If you continue on another device or browser, your catch progress will not carry over.
                            </p>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-800 flex justify-end">
                            <button
                                onClick={dismissDexsanityWarning}
                                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-colors"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGame must be used within a GameProvider');
    return context;
};
