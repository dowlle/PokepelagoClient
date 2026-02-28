import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { PokemonRef } from '../types/pokemon';
import { GENERATIONS } from '../types/pokemon';
import { fetchAllPokemon } from '../services/pokeapi';
import { Client, itemsHandlingFlags } from 'archipelago.js';
import type {
    ConnectedPacket,
    ConnectionRefusedPacket,
    Item
} from 'archipelago.js';
import pokemonMetadata from '../data/pokemon_metadata.json';
import { getSprite, countSprites, generateSpriteKey } from '../services/spriteService';
import { getCleanName } from '../utils/pokemon';
import { resolveExternalSpriteUrl } from '../utils/pokesprite';
import { loadDerpemonIndex, getDerpemonUrl, type DerpemonIndex } from '../services/derpemonService';

export interface LogEntry {
    id: string;
    timestamp: number;
    type: 'item' | 'check' | 'hint' | 'chat' | 'system';
    text: string;
    color?: string; // CSS color or class
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
    goalCount?: number;       // raw count from slot_data (how many Pokémon to guess)
    activePokemonLimit: number; // max Pokémon index in this generation (151/251/386)
    logs: LogEntry[];
    gameMode: 'archipelago' | 'standalone' | null;
    shuffleEndTime: number;
    derpyfiedIds: Set<number>;
    releasedIds: Set<number>;
}

export interface UISettings {
    widescreen: boolean;
    masonry: boolean;
    enableSprites: boolean;
    enableShadows: boolean;
    spriteSet: 'normal' | 'derpemon';
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
    setGenerationFilter: React.Dispatch<React.SetStateAction<number[]>>;
    updateUiSettings: (settings: Partial<UISettings>) => void;
    isConnected: boolean;
    connectionError: string | null;
    connect: (info: ConnectionInfo) => Promise<void>;
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
    unlockRegion: (region: string) => void;
    lockRegion: (region: string) => void;
    clearAllRegions: () => void;
    scoutLocation: (locationId: number) => Promise<{ itemName: string; playerName: string } | null>;
    unlockType: (type: string) => void;
    lockType: (type: string) => void;
    clearAllTypes: () => void;
    goalCount: number | undefined;
    activePokemonLimit: number;
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
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// ID Offsets (must match apworld)
let ITEM_OFFSET = 8574000;
let LOCATION_OFFSET = 8571000;
let STARTER_OFFSET = 500;
let MILESTONE_OFFSET = 1000;
let TYPE_MILESTONE_OFFSET = 2000;
let TYPE_MILESTONE_MULTIPLIER = 50;
let TYPE_ITEM_OFFSET = 1100;
let USEFUL_ITEM_OFFSET = 2000;
let TRAP_ITEM_OFFSET = 3000;

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [allPokemon, setAllPokemon] = useState<PokemonRef[]>([]);
    const [unlockedIds, setUnlockedIds] = useState<Set<number>>(new Set());
    const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
    const [hintedIds, setHintedIds] = useState<Set<number>>(new Set());
    const [shinyIds, setShinyIds] = useState<Set<number>>(new Set());
    const [shadowsEnabled, setShadowsEnabled] = useState(false);
    const [goal, setGoal] = useState<GameState['goal'] | undefined>();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(null);
    const [typeLocksEnabled, setTypeLocksEnabled] = useState(false);
    const [legendaryGating, setLegendaryGating] = useState(0);
    const [regionPasses, setRegionPasses] = useState<Set<string>>(new Set());
    const [typeUnlocks, setTypeUnlocks] = useState<Set<string>>(new Set());
    const [activePokemonLimit, setActivePokemonLimit] = useState<number>(386); // default to Gen 3
    const [goalCount, setGoalCount] = useState<number | undefined>(undefined);

    const [shuffleEndTime, setShuffleEndTime] = useState<number>(0);
    const [derpyfiedIds, setDerpyfiedIds] = useState<Set<number>>(new Set());
    const [releasedIds, setReleasedIds] = useState<Set<number>>(new Set());
    const [spriteRefreshCounter, setSpriteRefreshCounter] = useState<number>(0);
    const [toast, setToast] = useState<ToastMessage | null>(null);

    const showToast = useCallback((type: ToastMessage['type'], message: string) => {
        setToast({ type, message, id: Date.now() });
    }, []);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const [pingLatency, setPingLatency] = useState<number | null>(null);
    const [connectionQuality, setConnectionQuality] = useState<'good' | 'degraded' | 'dead' | null>(null);
    const pingTimeoutRef = useRef<number | ReturnType<typeof setInterval> | null>(null);
    const lastPingTimeRef = useRef<number>(0);
    const [masterBalls, setMasterBalls] = useState(0);
    const [pokegears, setPokegears] = useState(0);
    const [pokedexes, setPokedexes] = useState(0);
    const [usedMasterBalls, setUsedMasterBalls] = useState<Set<number>>(() => {
        const saved = localStorage.getItem('pokepelago_usedMasterBalls');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const [usedPokegears, setUsedPokegears] = useState<Set<number>>(() => {
        const saved = localStorage.getItem('pokepelago_usedPokegears');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });
    const [usedPokedexes, setUsedPokedexes] = useState<Set<number>>(() => {
        const saved = localStorage.getItem('pokepelago_usedPokedexes');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    // Save Used Items
    useEffect(() => {
        localStorage.setItem('pokepelago_usedMasterBalls', JSON.stringify(Array.from(usedMasterBalls)));
    }, [usedMasterBalls]);
    useEffect(() => {
        localStorage.setItem('pokepelago_usedPokegears', JSON.stringify(Array.from(usedPokegears)));
    }, [usedPokegears]);
    useEffect(() => {
        localStorage.setItem('pokepelago_usedPokedexes', JSON.stringify(Array.from(usedPokedexes)));
    }, [usedPokedexes]);
    const [spriteCount, setSpriteCount] = useState(0);
    const [derpemonIndex, setDerpemonIndex] = useState<DerpemonIndex>({});
    const [spriteRepoUrl, setSpriteRepoUrlState] = useState<string>(
        () => localStorage.getItem('pokepelago_spriteRepoUrl') || ''
    );

    const setSpriteRepoUrl = useCallback((url: string) => {
        setSpriteRepoUrlState(url);
        localStorage.setItem('pokepelago_spriteRepoUrl', url);
    }, []);
    const [gameMode, setGameModeState] = useState<'archipelago' | 'standalone' | null>(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.has('splash')) return null;
        return localStorage.getItem('pokepelago_gamemode') as any || null;
    });

    const setGameMode = useCallback((mode: 'archipelago' | 'standalone' | null) => {
        setGameModeState(mode);
        if (mode) {
            localStorage.setItem('pokepelago_gamemode', mode);
        } else {
            localStorage.removeItem('pokepelago_gamemode');
        }
    }, []);

    const refreshSpriteCount = useCallback(async () => {
        const count = await countSprites();
        setSpriteCount(count);
    }, []);

    // A ref that always reflects the current spriteSet — used inside getSpriteUrl
    // to avoid the circular declaration-order issue (getSpriteUrl is defined before uiSettings).
    const spriteSetRef = useRef<'normal' | 'derpemon'>('normal');
    const enableSpritesRef = useRef<boolean>(true);

    const getSpriteUrl = useCallback(async (id: number, options: { shiny?: boolean; animated?: boolean } = {}) => {
        // 0. Derp Trap Forced Override (takes highest precedence)
        if (derpyfiedIds.has(id) && !options.animated) {
            const derpemonUrl = getDerpemonUrl(derpemonIndex, id);
            if (derpemonUrl) return derpemonUrl;
        }

        // 1. Derpemon sprite set (GitHub CDN, static sprites only — no shiny/animated)
        if (spriteSetRef.current === 'derpemon' && !options.animated) {
            const derpemonUrl = getDerpemonUrl(derpemonIndex, id);
            if (derpemonUrl) return derpemonUrl;
        }

        // 2. Check local IDB sprites
        if (enableSpritesRef.current) {
            const key = generateSpriteKey(id, options);
            const blob = await getSprite(key);
            if (blob) {
                return URL.createObjectURL(blob);
            }
        }

        // 3. Fall back to external repo URL if configured
        if (spriteRepoUrl) {
            return resolveExternalSpriteUrl(spriteRepoUrl, id, options);
        }
        return null;
        // spriteSetRef.current and derpyfiedIds are listed here so the callback re-creates when they change,
        // ensuring PokemonSlot/PokemonDetails effects re-run and fetch the correct sprite immediately.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [derpemonIndex, spriteSetRef.current, enableSpritesRef.current, spriteRepoUrl, derpyfiedIds]);


    useEffect(() => {
        refreshSpriteCount();
    }, [refreshSpriteCount]);

    // Load Derpemon index once on mount
    useEffect(() => {
        loadDerpemonIndex().then(setDerpemonIndex);
    }, []);

    const getLocationName = useCallback((locationId: number) => {
        let name: string | undefined;

        if (clientRef.current) {
            name = clientRef.current.package.lookupLocationName(clientRef.current.game, locationId, false);
        }

        if (!name && locationId > LOCATION_OFFSET && locationId <= LOCATION_OFFSET + Math.max(1050, MILESTONE_OFFSET)) {
            const pkmnId = locationId - LOCATION_OFFSET;
            const pkmn = allPokemon.find(p => p.id === pkmnId);
            if (pkmn) {
                name = `Pokémon #${pkmnId} (${getCleanName(pkmn.name)})`;
            }
        }

        return name || `Unknown Location ${locationId}`;
    }, [allPokemon]);

    const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>(() => {
        const saved = localStorage.getItem('pokepelago_connection');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to parse saved connection info', e);
            }
        }
        return {
            hostname: 'archipelago.gg',
            port: 38281,
            slotName: 'Player1',
            password: ''
        };
    });
    const [isLoading, setIsLoading] = useState(true);
    const [generationFilter, setGenerationFilter] = useState<number[]>([0]);

    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [uiSettings, setUiSettings] = useState<UISettings>(() => {
        const saved = localStorage.getItem('pokepelago_ui');
        const defaults: UISettings = { widescreen: false, masonry: false, enableSprites: true, enableShadows: false, spriteSet: 'normal' };
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    });

    // Keep spriteSetRef in sync every render so getSpriteUrl always reads the latest value.
    spriteSetRef.current = uiSettings.spriteSet;
    enableSpritesRef.current = uiSettings.enableSprites;

    const clientRef = useRef<Client | null>(null);
    const isConnectingRef = useRef<boolean>(false);
    const checkedIdsRef = useRef<Set<number>>(checkedIds);
    const isPokemonGuessableRef = useRef<any>(null); // To avoid dependency cycle in useEffect

    useEffect(() => {
        checkedIdsRef.current = checkedIds;
    }, [checkedIds]);

    // Save UI settings
    useEffect(() => {
        localStorage.setItem('pokepelago_ui', JSON.stringify(uiSettings));
    }, [uiSettings]);


    // Save Connection Info
    useEffect(() => {
        localStorage.setItem('pokepelago_connection', JSON.stringify(connectionInfo));
    }, [connectionInfo]);

    // Load initial data and auto-connect
    useEffect(() => {
        const loadDataAndConnect = async () => {
            setIsLoading(true);
            const data = await fetchAllPokemon();
            setAllPokemon(data);
            setIsLoading(false);

            // Auto-reconnect if previously connected AND mode is archipelago
            const wasConnected = localStorage.getItem('pokepelago_connected') === 'true';
            const savedConnection = localStorage.getItem('pokepelago_connection');
            const savedMode = localStorage.getItem('pokepelago_gamemode');

            if (savedMode === 'archipelago' && wasConnected && savedConnection) {
                try {
                    const info = JSON.parse(savedConnection);
                    connect(info);
                } catch (e) {
                    console.error('Auto-connect failed', e);
                }
            }
        };
        loadDataAndConnect();
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (clientRef.current) {
                clientRef.current.socket.disconnect();
            }
        };
    }, []);

    const unlockPokemon = useCallback((id: number) => {
        setUnlockedIds(prev => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

    const connectionInfoRef = useRef(connectionInfo);
    useEffect(() => { connectionInfoRef.current = connectionInfo; }, [connectionInfo]);

    const checkPokemon = useCallback((id: number) => {
        setCheckedIds(prev => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
        });

        const locationId = LOCATION_OFFSET + id;

        // Use the library's proper `authenticated` property — this checks both socket connection and AP login
        if (clientRef.current?.authenticated) {
            try {
                clientRef.current.check(locationId);
            } catch (e) {
                console.warn('[checkPokemon] check() threw:', e);
            }
            return;
        }

        // Disconnected — queue a reconnect then send the check once online again.
        // Store pending location so it can be sent after the 'connected' event fires.
        console.log('[checkPokemon] Not authenticated, reconnecting...');
        const pendingLocationId = locationId;
        const savedInfo = connectionInfoRef.current;

        const doReconnect = async () => {
            if (isConnectingRef.current) return;
            try {
                // connect() will set up all event handlers (receivedItems, disconnected, etc.) properly
                await connect(savedInfo);
                // After reconnect, try sending the check if now authenticated
                if (clientRef.current?.authenticated) {
                    try { clientRef.current.check(pendingLocationId); } catch (_) { }
                }
            } catch (e) {
                console.warn('[checkPokemon] reconnect failed:', e);
            }
        };
        doReconnect();
    }, [isConnected]);



    // --- Auto-check Oak's Lab (Starting Items) ---
    useEffect(() => {
        if (!clientRef.current || !isConnected || gameMode !== 'archipelago') return;

        let sentChecks = false;
        const newChecked = new Set<number>();
        for (let i = 0; i < 20; i++) {
            const localId = STARTER_OFFSET + i;
            if (!checkedIds.has(localId)) {
                clientRef.current.check(LOCATION_OFFSET + localId);
                newChecked.add(localId);
                sentChecks = true;
            }
        }

        if (sentChecks) {
            setCheckedIds(prev => {
                const next = new Set(prev);
                newChecked.forEach(id => next.add(id));
                return next;
            });
        }
    }, [isConnected, checkedIds, gameMode]);

    // --- Extended Locations (Catch X Type/Region) Checking ---
    useEffect(() => {
        if (!clientRef.current || !isConnected || gameMode === 'standalone') return;

        const checkExtendedLocations = () => {
            const typeCounts: Record<string, number> = {};
            let totalCatches = 0;

            // Count everything we've guessed so far (Checked Locations)
            Array.from(checkedIds).forEach(id => {
                if (id >= STARTER_OFFSET && id < STARTER_OFFSET + 20) return; // Skip Oak's Lab starting items
                if (id >= MILESTONE_OFFSET && id < MILESTONE_OFFSET + 2000) return; // Skip Global Milestones
                if (id >= TYPE_MILESTONE_OFFSET) return; // Skip Type Milestones

                totalCatches++;
                const data = (pokemonMetadata as any)[id];
                if (!data) return;

                // Types
                data.types.forEach((t: string) => {
                    const cType = t.charAt(0).toUpperCase() + t.slice(1);
                    typeCounts[cType] = (typeCounts[cType] || 0) + 1;
                });
            });

            // 1. Global Milestone Locations (1000 + count)
            const globalMilestones = [
                1, 5, 10,
                ...Array.from({ length: 37 }, (_, i) => (i + 2) * 10), // 20, 30, ..., 380
                148, 248, 383
            ].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
            globalMilestones.forEach(count => {
                const newCatches = Math.max(0, totalCatches - 3);
                if (newCatches >= count) {
                    const apLocationId = LOCATION_OFFSET + MILESTONE_OFFSET + count;
                    const localId = apLocationId - LOCATION_OFFSET;
                    if (!checkedIds.has(localId)) {
                        clientRef.current?.check(apLocationId);
                        setCheckedIds(prev => new Set(prev).add(localId));
                    }
                }
            });

            // 2. Type-Specific Milestones (2000 + (index * 50) + step)
            const typesList = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark'];
            const typeSteps = [1, 2, 5, 10, 15, 20, 30, 40, 50];

            const starterTypeCounts: Record<string, number> = {
                "Grass": 1,
                "Poison": 1,
                "Fire": 1,
                "Water": 1
            };

            typesList.forEach((typeName, index) => {
                // Archipelago Logic restricts type milestones until you have the Type Key natively
                if (typeLocksEnabled && !typeUnlocks.has(typeName)) return;

                const rawCount = typeCounts[typeName] || 0;
                const newTypeCatches = Math.max(0, rawCount - (starterTypeCounts[typeName] || 0));

                typeSteps.forEach(step => {
                    if (newTypeCatches >= step) {
                        const apLocationId = LOCATION_OFFSET + TYPE_MILESTONE_OFFSET + (index * TYPE_MILESTONE_MULTIPLIER) + step;
                        const localId = apLocationId - LOCATION_OFFSET;
                        if (!checkedIds.has(localId)) {
                            clientRef.current?.check(apLocationId);
                            setCheckedIds(prev => new Set(prev).add(localId));
                        }
                    }
                });
            });
        };

        checkExtendedLocations();
    }, [checkedIds, isConnected, gameMode, pokemonMetadata, unlockedIds, typeLocksEnabled, typeUnlocks]);

    const isPokemonGuessable = useCallback((id: number) => {
        const data = (pokemonMetadata as any)[id];
        if (!data) return { canGuess: true };

        // --- STANDALONE PROGRESSION ---
        if (gameMode === 'standalone') {
            const genIdx = GENERATIONS.findIndex(g => id >= g.startId && id <= g.endId);
            if (genIdx === -1 || !generationFilter.includes(genIdx)) {
                return { canGuess: false, reason: 'Generation not enabled in settings' };
            }
            return { canGuess: true };
        }

        // --- ARCHIPELAGO PROGRESSION ---
        // 1. Missing Pokemon Unlock Check
        if (!unlockedIds.has(id)) {
            return {
                canGuess: false,
                reason: 'You have not found this Pokemon yet!',
                missingPokemon: true
            };
        }

        // 2. Type Locks Check
        if (typeLocksEnabled) {
            const missingTypes = data.types.filter((t: string) => {
                const cType = t.charAt(0).toUpperCase() + t.slice(1);
                return !typeUnlocks.has(cType);
            });
            if (missingTypes.length > 0) {
                const missing = missingTypes.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1));
                return {
                    canGuess: false,
                    reason: `Missing Type Keys: ${missing.join(', ')}`,
                    missingTypes: missing
                };
            }
        }

        return { canGuess: true };
    }, [gameMode, generationFilter, typeLocksEnabled, typeUnlocks, unlockedIds, pokemonMetadata]);

    useEffect(() => {
        isPokemonGuessableRef.current = isPokemonGuessable;
    }, [isPokemonGuessable]);

    // --- Goal / Victory Checking ---
    useEffect(() => {
        if (!clientRef.current || !isConnected || gameMode !== 'archipelago') return;
        if (goalCount === undefined) return;

        // Count Pokémon guess locations only (IDs 1–1025, excluding Oak's Lab 500-519 and milestones 1000+)
        const guessedCount = Array.from(checkedIds).filter(id => id >= 1 && id < 500).length
            + Array.from(checkedIds).filter(id => id >= 520 && id < 1000).length;

        if (guessedCount >= goalCount) {
            console.log(`Goal met! ${guessedCount}/${goalCount} Pokémon guessed. Sending CLIENT_GOAL.`);
            clientRef.current.updateStatus(30); // 30 = ClientStatus.CLIENT_GOAL
        }
    }, [checkedIds, isConnected, gameMode, goalCount]);

    const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
        setLogs(prev => [
            {
                ...entry,
                id: Math.random().toString(36).substring(7),
                timestamp: Date.now()
            },
            ...prev.slice(0, 999) // Keep last 1000
        ]);
    }, []);

    const say = useCallback((text: string) => {
        if (clientRef.current && isConnected) {
            clientRef.current.messages.say(text);
        }
    }, [isConnected]);

    const connect = async (info: ConnectionInfo) => {
        if (isConnectingRef.current) {
            console.log('Already connecting, ignoring request.');
            return;
        }

        isConnectingRef.current = true;
        setConnectionError(null);
        setIsConnected(false);

        const protocolsToTry = info.hostname.includes('://') ? [''] : ['wss://', 'ws://'];
        let lastError: any = null;

        for (const protocol of protocolsToTry) {
            try {
                const client = new Client();
                clientRef.current = client;

                const url = `${protocol}${info.hostname}:${info.port}`;

                // Socket Event Handlers
                client.socket.on('connectionRefused', (packet: ConnectionRefusedPacket) => {
                    setConnectionError(`Connection refused: ${packet.errors?.join(', ') || 'Unknown error'}`);
                    setIsConnected(false);
                    if (pingTimeoutRef.current) clearInterval(pingTimeoutRef.current);
                });

                client.socket.on('bounced', (packet: any) => {
                    if (packet.tags && packet.tags.includes('ping')) {
                        setPingLatency(Date.now() - lastPingTimeRef.current);
                        setConnectionQuality('good');
                    }
                });

                // Properly detect disconnects using the library's built-in event.
                // This fires whether the server drops us or we lose network.
                client.socket.on('disconnected', () => {
                    console.log('[GameContext] Disconnected from Archipelago server.');
                    setIsConnected(false);
                    setConnectionQuality('dead');
                    setPingLatency(null);
                    if (pingTimeoutRef.current) {
                        clearInterval(pingTimeoutRef.current as any);
                        pingTimeoutRef.current = null;
                    }
                });

                client.socket.on('connected', (packet: ConnectedPacket) => {
                    console.log(`Connected to Archipelago via ${protocol || '(explicit protocol)'}!`, packet);

                    // Detect APVersion based on offset
                    const allLocs = [
                        ...(packet.missing_locations || []),
                        ...(packet.checked_locations || [])
                    ];
                    // The new offset is 8560000, so any location ID between 8560000 and 8569999 means it's the new apworld
                    const isNewVersion = allLocs.some((id: number) => id >= 8560000 && id < 8570000);
                    if (isNewVersion) {
                        LOCATION_OFFSET = 8560000;
                        STARTER_OFFSET = 100_000;
                        MILESTONE_OFFSET = 10_000;
                        TYPE_MILESTONE_OFFSET = 20_000;
                        TYPE_MILESTONE_MULTIPLIER = 1000;
                        TYPE_ITEM_OFFSET = 2000;
                        USEFUL_ITEM_OFFSET = 3000;
                        TRAP_ITEM_OFFSET = 4000;
                        console.log('[GameContext] Detected Gen 9+ APWorld (Location Offset: 8560000)');
                    } else {
                        LOCATION_OFFSET = 8571000;
                        STARTER_OFFSET = 500;
                        MILESTONE_OFFSET = 1000;
                        TYPE_MILESTONE_OFFSET = 2000;
                        TYPE_MILESTONE_MULTIPLIER = 50;
                        TYPE_ITEM_OFFSET = 1100;
                        USEFUL_ITEM_OFFSET = 2000;
                        TRAP_ITEM_OFFSET = 3000;
                        console.log('[GameContext] Detected Legacy APWorld (Location Offset: 8571000)');
                    }

                    // Sync already checked locations
                    const checkedLocs = packet.checked_locations || [];
                    const newChecked = new Set<number>();
                    checkedLocs.forEach((locId: number) => {
                        if (locId >= LOCATION_OFFSET && locId <= LOCATION_OFFSET + 200_000) {
                            newChecked.add(locId - LOCATION_OFFSET);
                        }
                    });
                    setCheckedIds(newChecked);

                    // Sync already received items (fully reconstruct unlockedIds)
                    const receivedItems = client.items.received;
                    const newUnlocked = new Set<number>();
                    receivedItems.forEach((item) => {
                        if (item.id > ITEM_OFFSET && item.id <= ITEM_OFFSET + 1025) {
                            newUnlocked.add(item.id - ITEM_OFFSET);
                        }
                    });
                    setUnlockedIds(newUnlocked);

                    // Reconstruct shinyIds from received items count
                    const shinyCount = receivedItems.filter(i => i.id === 105000).length;
                    if (shinyCount > 0) {
                        const receivedPokemonIds = Array.from(newUnlocked);
                        setShinyIds(new Set(receivedPokemonIds.slice(0, shinyCount)));
                    }

                    // Reconstruct Type Unlocks
                    const newTypeUnlocks = new Set<string>();
                    const typesMap = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark'];
                    receivedItems.forEach(item => {
                        if (item.id >= ITEM_OFFSET + TYPE_ITEM_OFFSET && item.id <= ITEM_OFFSET + TYPE_ITEM_OFFSET + 17) {
                            newTypeUnlocks.add(typesMap[item.id - (ITEM_OFFSET + TYPE_ITEM_OFFSET)]);
                        }
                    });
                    setTypeUnlocks(newTypeUnlocks);

                    // Handle slot data for settings
                    const slotData = packet.slot_data as any || {};

                    // Shadows setting
                    setShadowsEnabled(!!slotData.shadows);

                    // Logic settings
                    setTypeLocksEnabled(!!slotData.type_locks);
                    setLegendaryGating(slotData.legendary_gating ?? 0);

                    // Generation scaling
                    if (slotData.pokemon_generations !== undefined) {
                        const gens = slotData.pokemon_generations;
                        if (gens === 0) { setGenerationFilter([0]); setActivePokemonLimit(151); }
                        else if (gens === 1) { setGenerationFilter([0, 1]); setActivePokemonLimit(251); }
                        else if (gens === 2) { setGenerationFilter([0, 1, 2]); setActivePokemonLimit(386); }
                        else if (gens === 3) { setGenerationFilter([0, 1, 2, 3]); setActivePokemonLimit(493); }
                        else if (gens === 4) { setGenerationFilter([0, 1, 2, 3, 4]); setActivePokemonLimit(649); }
                        else if (gens === 5) { setGenerationFilter([0, 1, 2, 3, 4, 5]); setActivePokemonLimit(721); }
                        else if (gens === 6) { setGenerationFilter([0, 1, 2, 3, 4, 5, 6]); setActivePokemonLimit(809); }
                        else if (gens === 7) { setGenerationFilter([0, 1, 2, 3, 4, 5, 6, 7]); setActivePokemonLimit(898); }
                        else if (gens === 8) { setGenerationFilter([0, 1, 2, 3, 4, 5, 6, 7, 8]); setActivePokemonLimit(1025); }
                    }

                    // Goal setting — server sends 'goal_count' (a raw Pokémon count)
                    if (slotData.goal_count !== undefined) {
                        setGoalCount(slotData.goal_count);
                        // Also set legacy goal for display in the toolbar
                        setGoal({
                            type: 'any_pokemon',
                            amount: slotData.goal_count,
                        });
                    }

                    // Setup DataStorage sync for used items
                    const team = client.players.self.team;
                    const slot = client.players.self.slot;
                    const mbKey = `pokepelago_team_${team}_slot_${slot}_used_masterballs`;
                    const pgKey = `pokepelago_team_${team}_slot_${slot}_used_pokegears`;
                    const pdKey = `pokepelago_team_${team}_slot_${slot}_used_pokedexes`;
                    const derpKey = `pokepelago_team_${team}_slot_${slot}_derpyfied`;
                    const relKey = `pokepelago_team_${team}_slot_${slot}_released`;

                    client.storage.notify([mbKey, pgKey, pdKey, derpKey, relKey], (key, value) => {
                        if (!Array.isArray(value)) return;
                        const usedIds = new Set(value as number[]);

                        // Because this callback runs anytime the value changes, update the state and the dynamic counters.
                        if (key === mbKey) {
                            setUsedMasterBalls(prev => {
                                const merged = new Set([...prev, ...usedIds]);
                                const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 1).length;
                                setMasterBalls(Math.max(0, totalServer - merged.size));
                                return merged;
                            });
                        } else if (key === pgKey) {
                            setUsedPokegears(prev => {
                                const merged = new Set([...prev, ...usedIds]);
                                const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 2).length;
                                setPokegears(Math.max(0, totalServer - merged.size));
                                return merged;
                            });
                        } else if (key === pdKey) {
                            setUsedPokedexes(prev => {
                                const merged = new Set([...prev, ...usedIds]);
                                const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 3).length;
                                setPokedexes(Math.max(0, totalServer - merged.size));
                                return merged;
                            });
                        } else if (key === derpKey) {
                            setDerpyfiedIds(usedIds);
                        } else if (key === relKey) {
                            setReleasedIds(usedIds);
                        }
                    }).then((data) => {
                        const localMB = new Set(JSON.parse(localStorage.getItem('pokepelago_usedMasterBalls') || '[]'));
                        const localPG = new Set(JSON.parse(localStorage.getItem('pokepelago_usedPokegears') || '[]'));
                        const localPD = new Set(JSON.parse(localStorage.getItem('pokepelago_usedPokedexes') || '[]'));

                        const pushUnsynced = (localSet: Set<any>, serverArr: any, key: string) => {
                            const serverSet = new Set(Array.isArray(serverArr) ? serverArr : []);
                            // Push items locally used that the server isn't tracking yet
                            const unsynced = Array.from(localSet).filter(id => !serverSet.has(id));
                            if (unsynced.length > 0) {
                                client.storage.prepare(key, []).add(unsynced).commit();
                            }
                        };

                        pushUnsynced(localMB, data[mbKey], mbKey);
                        pushUnsynced(localPG, data[pgKey], pgKey);
                        pushUnsynced(localPD, data[pdKey], pdKey);

                        // Initialize traps from server data
                        if (Array.isArray(data[derpKey])) setDerpyfiedIds(new Set(data[derpKey] as number[]));
                        if (Array.isArray(data[relKey])) setReleasedIds(new Set(data[relKey] as number[]));
                    }).catch(console.error);
                });

                // Handle items via ItemsManager
                client.items.on('itemsReceived', (items: Item[]) => {
                    let recalculateItems = false;
                    items.forEach((item) => {
                        if (item.id > ITEM_OFFSET && item.id <= ITEM_OFFSET + 1025) {
                            const dexId = item.id - ITEM_OFFSET;
                            unlockPokemon(dexId);
                        } else if (item.id === 105000) {
                            // Shiny Upgrade
                            setUnlockedIds(unlocked => {
                                const pokemonIds = Array.from(unlocked);
                                setShinyIds(prev => {
                                    const next = new Set(prev);
                                    // Apply to the next unlocked pokemon that isn't shiny yet
                                    const targetIdx = prev.size;
                                    if (targetIdx < pokemonIds.length) {
                                        next.add(pokemonIds[targetIdx]);
                                    }
                                    return next;
                                });
                                return unlocked;
                            });
                        } else if (item.id >= ITEM_OFFSET + TYPE_ITEM_OFFSET && item.id <= ITEM_OFFSET + TYPE_ITEM_OFFSET + 17) {
                            const types = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark'];
                            const typeName = types[item.id - (ITEM_OFFSET + TYPE_ITEM_OFFSET)];
                            setTypeUnlocks(prev => new Set(prev).add(typeName));
                            setLogs(prev => [{
                                id: crypto.randomUUID(),
                                timestamp: Date.now(),
                                type: 'system',
                                text: `Received Type Unlock: ${typeName}`,
                                parts: [{ text: `Received Type Unlock: ${typeName}`, type: 'color', color: '#10B981' }]
                            }, ...prev.slice(0, 99)]);
                        } else if (item.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 1) {
                            // Small Shuffle Trap
                            setShuffleEndTime(Date.now() + 30000); // 30s
                        } else if (item.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 2) {
                            // Big Shuffle Trap
                            setShuffleEndTime(Date.now() + 150000); // 2m 30s
                        } else if (item.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 3) {
                            // Derpy Mon Trap
                            recalculateItems = true;
                        } else if (item.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 4) {
                            // Release Trap
                            recalculateItems = true;
                        } else if (item.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 1 || item.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 2 || item.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 3) {
                            recalculateItems = true;
                        }
                    });

                    if (recalculateItems) {
                        setUsedMasterBalls(used => {
                            const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 1).length;
                            setMasterBalls(Math.max(0, totalServer - used.size));
                            return used;
                        });
                        setUsedPokegears(used => {
                            const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 2).length;
                            setPokegears(Math.max(0, totalServer - used.size));
                            return used;
                        });
                        setUsedPokedexes(used => {
                            const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + USEFUL_ITEM_OFFSET + 3).length;
                            setPokedexes(Math.max(0, totalServer - used.size));
                            return used;
                        });

                        // Process Trap items (Derp Mon, Release Trap)
                        // This logic runs to find "unprocessed" trap events safely by comparing server quantities against stored list sizes
                        setDerpyfiedIds(derps => {
                            const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 3).length;
                            if (totalServer > derps.size) {
                                let newDerps = new Set(derps);
                                const basePathPokes = allPokemon.filter(p => !newDerps.has(p.id) && derpemonIndex[p.id]);

                                // Priority 1: Guessed or Guessable
                                let availablePokes = basePathPokes.filter(p => checkedIdsRef.current.has(p.id) || (isPokemonGuessableRef.current && isPokemonGuessableRef.current(p.id).canGuess));

                                // Priority 2: Fallback to all if Priority 1 is empty
                                if (availablePokes.length === 0) {
                                    availablePokes = basePathPokes;
                                }

                                let toAdd = totalServer - derps.size;
                                while (toAdd > 0 && availablePokes.length > 0) {
                                    const randIdx = Math.floor(Math.random() * availablePokes.length);
                                    const picked = availablePokes.splice(randIdx, 1)[0];
                                    newDerps.add(picked.id);
                                    toAdd--;

                                    // Remove the picked Pokemon from basePathPokes so we don't accidentally pick it again if we fall back
                                    const baseIdx = basePathPokes.findIndex(p => p.id === picked.id);
                                    if (baseIdx !== -1) basePathPokes.splice(baseIdx, 1);

                                    if (availablePokes.length === 0 && toAdd > 0) {
                                        availablePokes = basePathPokes; // Fallback mid-loop if we run out
                                    }

                                    if (checkedIdsRef.current.has(picked.id)) {
                                        showToast('trap', `${getCleanName(picked.name)} turned derpy!`);
                                    } else {
                                        showToast('trap', `A Pokémon turned derpy!`);
                                    }
                                }

                                // Sync newly added IDs to server
                                const team = client.players.self.team;
                                const slot = client.players.self.slot;
                                const derpKey = `pokepelago_team_${team}_slot_${slot}_derpyfied`;

                                const unsynced = Array.from(newDerps).filter(id => !derps.has(id));
                                if (unsynced.length > 0) {
                                    client.storage.prepare(derpKey, []).add(unsynced).commit();
                                }

                                if (toAdd > 0) {
                                    setSpriteRefreshCounter(c => c + 1); // Force re-render of sprites
                                }

                                return newDerps;
                            }
                            return derps;
                        });

                        setReleasedIds(released => {
                            const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + TRAP_ITEM_OFFSET + 4).length;
                            if (totalServer > released.size) {
                                let newReleased = new Set(released);
                                // Pick from currently checked Pokémon (but not starters 1, 4, 7 for safety and thematic reasons)
                                const validCheckedIds = Array.from(checkedIdsRef.current).filter(id => id !== 1 && id !== 4 && id !== 7 && !newReleased.has(id));
                                let toAdd = totalServer - released.size;

                                while (toAdd > 0 && validCheckedIds.length > 0) {
                                    const randIdx = Math.floor(Math.random() * validCheckedIds.length);
                                    const pickedId = validCheckedIds.splice(randIdx, 1)[0];
                                    newReleased.add(pickedId);
                                    toAdd--;

                                    setLogs(prev => [{
                                        id: crypto.randomUUID(),
                                        timestamp: Date.now(),
                                        type: 'system',
                                        text: `Release Trap triggering! A Pokémon ran away!`,
                                        parts: [{ text: `A Pokémon ran away! You must guess it again.`, type: 'color', color: '#EF4444' }]
                                    }, ...prev.slice(0, 99)]);

                                    showToast('trap', 'Oh no! A Pokémon ran away!');
                                }

                                // Sync newly added IDs to server
                                const team = client.players.self.team;
                                const slot = client.players.self.slot;
                                const relKey = `pokepelago_team_${team}_slot_${slot}_released`;

                                const unsynced = Array.from(newReleased).filter(id => !released.has(id));
                                if (unsynced.length > 0) {
                                    client.storage.prepare(relKey, []).add(unsynced).commit();
                                }
                                return newReleased;
                            }
                            return released;
                        });
                    }
                });

                // Generic log capturing
                client.socket.on('printJSON', (packet) => {
                    if (packet.type === 'Hint') {
                        const item = packet.item as any;
                        if (item && item.receiving_player === client.players.self.slot && (item.item as number) > ITEM_OFFSET && (item.item as number) <= ITEM_OFFSET + 1025) {
                            const dexId = (item.item as number) - ITEM_OFFSET;
                            setHintedIds(prev => {
                                const next = new Set(prev);
                                next.add(dexId);
                                return next;
                            });
                        }
                    }

                    if (packet.data) {
                        const parts: LogPart[] = packet.data.map((p: any) => {
                            let text = p.text || '';
                            let type = p.type || 'color';

                            if (p.type === 'player_id') {
                                const pid = parseInt(p.text);
                                text = client.players.findPlayer(pid)?.alias || `Player ${pid}`;
                                type = 'player';
                            } else if (p.type === 'item_id') {
                                const iid = parseInt(p.text);
                                const player = client.players.findPlayer(p.player);
                                text = client.package.lookupItemName(player?.game || client.game, iid) || `Item ${iid}`;
                                type = 'item';
                            } else if (p.type === 'location_id') {
                                const lid = parseInt(p.text);
                                const player = client.players.findPlayer(p.player);
                                text = client.package.lookupLocationName(player?.game || client.game, lid) || `Location ${lid}`;
                                type = 'location';
                            }

                            return { text, type, color: p.color };
                        });

                        const isHintOrItem = packet.type === 'Hint' || packet.type === 'ItemSend' || packet.type === 'ItemCheat';
                        let isMe = true;
                        if (isHintOrItem && client.players.self) {
                            // If it's a hint or item, default to not me, unless my slot is mentioned
                            isMe = packet.data.some((p: any) => p.type === 'player_id' && parseInt(p.text) === client.players.self.slot);
                        }

                        addLog({
                            type: packet.type === 'Hint' ? 'hint' : packet.type === 'ItemSend' ? 'item' : packet.type === 'Chat' ? 'chat' : 'system',
                            text: parts.map(p => p.text).join(''),
                            parts,
                            isMe
                        });
                    }
                });

                client.socket.on('locationInfo', (packet) => {
                    packet.locations.forEach(item => {
                        if (item.player === client.players.self.slot && (item.item as number) > ITEM_OFFSET && (item.item as number) <= ITEM_OFFSET + 1025) {
                            const dexId = (item.item as number) - ITEM_OFFSET;
                            setHintedIds(prev => {
                                const next = new Set(prev);
                                next.add(dexId);
                                return next;
                            });
                        }
                    });
                });

                // 1. Try to load cached DataPackage
                const cachedPackageRaw = localStorage.getItem('pokepelago_datapackage');
                if (cachedPackageRaw) {
                    try {
                        const parsedCache = JSON.parse(cachedPackageRaw);
                        client.package.importPackage(parsedCache);
                        console.log('[GameContext] Loaded Archipelago data package from cache.');
                    } catch (e) {
                        console.warn('[GameContext] Failed to parse cached data package, ignoring.', e);
                    }
                }

                await client.login(url, info.slotName, 'Pokepelago', {
                    password: info.password,
                    items: itemsHandlingFlags.all,
                });

                // 2. Save DataPackage back to cache immediately upon successful login
                // (this ensures we have definitions for the current game)
                try {
                    const latestPackage = client.package.exportPackage();
                    localStorage.setItem('pokepelago_datapackage', JSON.stringify(latestPackage));
                    console.log('[GameContext] Saved Archipelago data package to cache.');
                } catch (e) {
                    console.error('[GameContext] Failed to save data package to cache.', e);
                }

                setIsConnected(true);
                setConnectionQuality('good');
                setConnectionError(null);
                localStorage.setItem('pokepelago_connected', 'true');
                isConnectingRef.current = false;

                if (pingTimeoutRef.current) clearInterval(pingTimeoutRef.current as any);
                pingTimeoutRef.current = setInterval(() => {
                    if (clientRef.current?.authenticated) {
                        lastPingTimeRef.current = Date.now();
                        (clientRef.current as any).socket.send({ cmd: 'Bounce', tags: ['ping'] });
                    }
                }, 5000);

                return; // Successfully connected! Exit loop.

            } catch (err: any) {
                console.warn(`Connection to ${protocol}${info.hostname}:${info.port} failed:`, err);
                lastError = err;

                if (clientRef.current) {
                    clientRef.current.socket.disconnect();
                }

                // If error is related to Archipelago denying login specifically (rather than a WebSocket transport failure), don't retry.
                const msg = err?.message || String(err);
                if (msg.includes('Invalid Slot') || msg.includes('Invalid Password') || msg.includes('Invalid Game') || msg.includes('Incompatible Version')) {
                    break;
                }
            }
        }

        console.error('All connection attempts failed', lastError);
        setConnectionError(lastError?.message || 'Failed to connect. The host may be offline or you might have a secure connection issue.');
        setIsConnected(false);
        isConnectingRef.current = false;
    };

    const disconnect = () => {
        if (pingTimeoutRef.current) {
            clearInterval(pingTimeoutRef.current as any);
            pingTimeoutRef.current = null;
        }
        setPingLatency(null);
        setConnectionQuality(null);
        if (clientRef.current) {
            clientRef.current.socket.disconnect();
            clientRef.current = null;
        }
        setIsConnected(false);
        localStorage.setItem('pokepelago_connected', 'false');
        setUnlockedIds(new Set());
        setCheckedIds(new Set());
        setHintedIds(new Set());
    };

    const updateUiSettings = (newSettings: Partial<UISettings>) => {
        setUiSettings(prev => {
            const next = { ...prev, ...newSettings };
            if (newSettings.spriteSet !== undefined || newSettings.enableSprites !== undefined) {
                setSpriteRefreshCounter(c => c + 1);
            }
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
            addLog({
                type: 'system',
                text: `Used a Master Ball on Pokemon #${pokemonId}!`,
                isMe: true
            });
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

            addLog({
                type: 'system',
                text: `Used a Pokegear on Pokemon #${pokemonId}!`,
                isMe: true
            });
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

            addLog({
                type: 'system',
                text: `Used a Pokedex on Pokemon #${pokemonId}!`,
                isMe: true
            });
        }
    }, [pokedexes, addLog]);

    const unlockRegion = useCallback((region: string) => {
        setRegionPasses(prev => new Set(prev).add(region));
    }, []);

    const lockRegion = useCallback((region: string) => {
        setRegionPasses(prev => {
            const next = new Set(prev);
            next.delete(region);
            return next;
        });
    }, []);

    const clearAllRegions = useCallback(() => {
        setRegionPasses(new Set());
    }, []);

    const unlockType = useCallback((typeName: string) => {
        setTypeUnlocks(prev => new Set(prev).add(typeName));
    }, []);

    const lockType = useCallback((typeName: string) => {
        setTypeUnlocks(prev => {
            const next = new Set(prev);
            next.delete(typeName);
            return next;
        });
    }, []);

    const clearAllTypes = useCallback(() => {
        setTypeUnlocks(new Set());
    }, []);

    const scoutLocation = useCallback(async (locationId: number) => {
        if (!clientRef.current?.authenticated) return null;
        try {
            const items = await clientRef.current.scout([locationId]);
            if (items && items.length > 0) {
                const item = items[0];
                return {
                    itemName: item.name,
                    playerName: item.receiver.alias
                };
            }
        } catch (e) {
            console.warn('[GameContext] Failed to scout location', locationId, e);
        }
        return null;
    }, []);

    // isPokemonGuessable moved up
    return (
        <GameContext.Provider value={{
            allPokemon,
            unlockedIds,
            checkedIds,
            hintedIds,
            shinyIds,
            isLoading,
            generationFilter,
            setGenerationFilter,
            unlockPokemon,
            checkPokemon,
            uiSettings,
            updateUiSettings,
            isConnected,
            connectionError,
            connect,
            disconnect,
            shadowsEnabled,
            goal,
            logs,
            addLog,
            say,
            connectionInfo,
            setConnectionInfo,
            pingLatency,
            connectionQuality,
            selectedPokemonId,
            setSelectedPokemonId,
            getLocationName,
            typeLocksEnabled,
            legendaryGating,
            regionPasses,
            typeUnlocks,
            masterBalls,
            pokegears,
            pokedexes,
            useMasterBall,
            usePokegear,
            usePokedex,
            usedMasterBalls,
            usedPokegears,
            usedPokedexes,
            spriteCount,
            refreshSpriteCount,
            getSpriteUrl,
            derpemonIndex,
            derpemonSpriteCount: Object.keys(derpemonIndex).length,
            spriteRepoUrl,
            setSpriteRepoUrl,
            isPokemonGuessable,
            gameMode,
            setGameMode,
            goalCount,
            activePokemonLimit,
            unlockRegion,
            lockRegion,
            clearAllRegions,
            scoutLocation,
            unlockType,
            lockType,
            clearAllTypes,
            shuffleEndTime,
            derpyfiedIds,
            releasedIds,
            setShuffleEndTime,
            setDerpyfiedIds,
            setReleasedIds,
            spriteRefreshCounter,
            setSpriteRefreshCounter,
            toast,
            showToast,
            locationOffset: LOCATION_OFFSET
        }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};
