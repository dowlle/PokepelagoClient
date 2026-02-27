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

export interface LogEntry {
    id: string;
    timestamp: number;
    type: 'item' | 'check' | 'hint' | 'chat' | 'system';
    text: string;
    color?: string; // CSS color or class
    parts?: LogPart[];
}

export interface LogPart {
    text: string;
    type?: 'player' | 'item' | 'location' | 'color';
    color?: string;
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
    logs: LogEntry[];
    gameMode: 'archipelago' | 'standalone' | null;
}

export interface UISettings {
    widescreen: boolean;
    masonry: boolean;
    enableSprites: boolean;
    enableShadows: boolean;
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
    unlockRegion: (region: string) => void;
    lockRegion: (region: string) => void;
    clearAllRegions: () => void;
    unlockType: (type: string) => void;
    lockType: (type: string) => void;
    clearAllTypes: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// ID Offsets (must match apworld)
const ITEM_OFFSET = 8574000;
const LOCATION_OFFSET = 8571000;

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
    const [pingLatency, setPingLatency] = useState<number | null>(null);
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

    const getSpriteUrl = useCallback(async (id: number, options: { shiny?: boolean; animated?: boolean } = {}) => {
        const key = generateSpriteKey(id, options);
        const blob = await getSprite(key);
        if (blob) {
            return URL.createObjectURL(blob);
        }
        return null;
    }, []);

    useEffect(() => {
        refreshSpriteCount();
    }, [refreshSpriteCount]);

    const getLocationName = useCallback((locationId: number) => {
        if (!clientRef.current) return `Location #${locationId}`;
        return clientRef.current.package.lookupLocationName(clientRef.current.game, locationId) || `Location #${locationId}`;
    }, []);

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
        return saved ? JSON.parse(saved) : { widescreen: false, masonry: false, enableSprites: true, enableShadows: false };
    });

    const clientRef = useRef<Client | null>(null);
    const isConnectingRef = useRef<boolean>(false);

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

    const checkPokemon = useCallback((id: number) => {
        setCheckedIds(prev => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
        });

        // Send check to Archipelago
        if (clientRef.current && isConnected) {
            const locationId = LOCATION_OFFSET + id;
            clientRef.current.check(locationId);
        }
    }, [isConnected]);

    // --- Auto-check Oak's Lab (Starting Items) ---
    useEffect(() => {
        if (!clientRef.current || !isConnected || gameMode !== 'archipelago') return;

        let sentChecks = false;
        const newChecked = new Set<number>();
        for (let i = 500; i < 520; i++) {
            if (!checkedIds.has(i)) {
                clientRef.current.check(LOCATION_OFFSET + i);
                newChecked.add(i);
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
                if (id >= 500 && id < 520) return; // Skip Oak's Lab starting items
                if (id >= 1000) return; // Skip Milestones

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
            const globalMilestones = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 148];
            globalMilestones.forEach(count => {
                const newCatches = Math.max(0, totalCatches - 3);
                if (newCatches >= count) {
                    const apLocationId = LOCATION_OFFSET + 1000 + count;
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
                        const apLocationId = LOCATION_OFFSET + 2000 + (index * 50) + step;
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

    // --- Goal Checking ---
    useEffect(() => {
        if (!clientRef.current || !isConnected || gameMode !== 'archipelago' || !goal) return;

        let won = false;
        const guessedPokemonCount = Array.from(checkedIds).filter(id => id < 500 || (id >= 520 && id < 1000)).length;

        if (goal.type === 'any_pokemon' || goal.type === 'percentage') {
            won = guessedPokemonCount >= goal.amount;
        } else if (goal.type === 'region_completion' && goal.region) {
            // Count how many we have from this region
            let countInRegion = 0;
            let totalInRegion = 0;

            // Go through all pokemon to find total needed
            allPokemon.forEach(p => {
                const region = GENERATIONS.find(g => p.id >= g.startId && p.id <= g.endId)?.region;
                if (region === goal.region) {
                    totalInRegion++;
                    if (checkedIds.has(p.id)) countInRegion++;
                }
            });

            won = totalInRegion > 0 && countInRegion >= totalInRegion;
        } else if (goal.type === 'all_legendaries') {
            let countLegs = 0;
            let totalLegs = 0;

            allPokemon.forEach(p => {
                const data = (pokemonMetadata as any)[p.id];
                if (data?.is_legendary) {
                    totalLegs++;
                    if (checkedIds.has(p.id)) countLegs++;
                }
            });

            won = totalLegs > 0 && countLegs >= totalLegs;
        }

        if (won) {
            console.log("Goal met! Sending CLIENT_GOAL status.");
            clientRef.current.updateStatus(30); // 30 is ClientStatus.CLIENT_GOAL
        }
    }, [checkedIds, isConnected, gameMode, goal, allPokemon]);

    const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
        setLogs(prev => [
            {
                ...entry,
                id: Math.random().toString(36).substring(7),
                timestamp: Date.now()
            },
            ...prev.slice(0, 99) // Keep last 100
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
                    }
                });

                client.socket.on('connected', (packet: ConnectedPacket) => {
                    console.log(`Connected to Archipelago via ${protocol || '(explicit protocol)'}!`, packet);

                    // Sync already checked locations
                    const checkedLocs = packet.checked_locations || [];
                    const newChecked = new Set<number>();
                    checkedLocs.forEach((locId: number) => {
                        if (locId >= LOCATION_OFFSET && locId < LOCATION_OFFSET + 2000) {
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
                        if (item.id >= ITEM_OFFSET + 1100 && item.id <= ITEM_OFFSET + 1117) {
                            newTypeUnlocks.add(typesMap[item.id - (ITEM_OFFSET + 1100)]);
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
                        if (gens === 0) setGenerationFilter([0]);
                        else if (gens === 1) setGenerationFilter([0, 1]);
                        else if (gens === 2) setGenerationFilter([0, 1, 2]);
                    }

                    // Goal setting
                    if (slotData.goal !== undefined && slotData.goal_amount !== undefined) {
                        const goalTypes: ('any_pokemon' | 'percentage' | 'region_completion' | 'all_legendaries')[] =
                            ['any_pokemon', 'percentage', 'region_completion', 'all_legendaries'];
                        const regions = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Kalos", "Alola", "Galar", "Paldea"];
                        setGoal({
                            type: goalTypes[slotData.goal] || 'any_pokemon',
                            amount: slotData.goal_amount,
                            region: slotData.goal_region ? regions[slotData.goal_region - 1] : undefined
                        });
                    }
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
                        } else if (item.id >= ITEM_OFFSET + 1100 && item.id <= ITEM_OFFSET + 1117) {
                            const types = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Fairy', 'Steel', 'Dark'];
                            const typeName = types[item.id - (ITEM_OFFSET + 1100)];
                            setTypeUnlocks(prev => new Set(prev).add(typeName));
                            setLogs(prev => [{
                                id: crypto.randomUUID(),
                                timestamp: Date.now(),
                                type: 'system',
                                text: `Received Type Unlock: ${typeName}`,
                                parts: [{ text: `Received Type Unlock: ${typeName}`, type: 'color', color: '#10B981' }]
                            }, ...prev.slice(0, 99)]);
                        } else if (item.id === ITEM_OFFSET + 2001 || item.id === ITEM_OFFSET + 2002 || item.id === ITEM_OFFSET + 2003) {
                            recalculateItems = true;
                        }
                    });

                    if (recalculateItems) {
                        setUsedMasterBalls(used => {
                            const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + 2001).length;
                            setMasterBalls(Math.max(0, totalServer - used.size));
                            return used;
                        });
                        setUsedPokegears(used => {
                            const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + 2002).length;
                            setPokegears(Math.max(0, totalServer - used.size));
                            return used;
                        });
                        setUsedPokedexes(used => {
                            const totalServer = client.items.received.filter(i => i.id === ITEM_OFFSET + 2003).length;
                            setPokedexes(Math.max(0, totalServer - used.size));
                            return used;
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

                        addLog({
                            type: packet.type === 'Hint' ? 'hint' : packet.type === 'ItemSend' ? 'item' : packet.type === 'Chat' ? 'chat' : 'system',
                            text: parts.map(p => p.text).join(''),
                            parts
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

                await client.login(url, info.slotName, 'Pokepelago', {
                    password: info.password,
                    items: itemsHandlingFlags.all,
                });

                setIsConnected(true);
                setConnectionError(null);
                localStorage.setItem('pokepelago_connected', 'true');
                isConnectingRef.current = false;

                if (pingTimeoutRef.current) clearInterval(pingTimeoutRef.current as any);
                pingTimeoutRef.current = setInterval(() => {
                    if (clientRef.current) {
                        lastPingTimeRef.current = Date.now();
                        // Use the socket.send method provided by archipelago.js
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
        setUiSettings(prev => ({ ...prev, ...newSettings }));
    };

    const useMasterBall = useCallback((pokemonId: number) => {
        if (masterBalls > 0) {
            setMasterBalls(prev => prev - 1);
            setUsedMasterBalls(prev => new Set(prev).add(pokemonId));
            checkPokemon(pokemonId);
            addLog({
                type: 'system',
                text: `Used a Master Ball on Pokemon #${pokemonId}!`
            });
        }
    }, [masterBalls, checkPokemon, addLog]);

    const usePokegear = useCallback((pokemonId: number) => {
        if (pokegears > 0) {
            setPokegears(prev => prev - 1);
            setUsedPokegears(prev => new Set(prev).add(pokemonId));
            addLog({
                type: 'system',
                text: `Used a Pokegear on Pokemon #${pokemonId}!`
            });
        }
    }, [pokegears, addLog]);

    const usePokedex = useCallback((pokemonId: number) => {
        if (pokedexes > 0) {
            setPokedexes(prev => prev - 1);
            setUsedPokedexes(prev => new Set(prev).add(pokemonId));
            addLog({
                type: 'system',
                text: `Used a Pokedex on Pokemon #${pokemonId}!`
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
    }, [gameMode, generationFilter, typeLocksEnabled, typeUnlocks, unlockedIds, legendaryGating]);

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
            isPokemonGuessable,
            gameMode,
            setGameMode,
            unlockRegion,
            lockRegion,
            clearAllRegions,
            unlockType,
            lockType,
            clearAllTypes
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
