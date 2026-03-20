import { useState, useRef } from 'react';
import { Client, itemsHandlingFlags } from 'archipelago.js';
import type { ConnectedPacket, ConnectionRefusedPacket, Item } from 'archipelago.js';
import { NEW_OFFSETS, LEGACY_OFFSETS, useOffsets } from './useOffsets';
import type { OffsetTable } from './useOffsets';
import type { MutableRefObject } from 'react';

interface ConnectionInfo {
    hostname: string;
    port: number;
    slotName: string;
    password?: string;
}

export interface ConnectionHandlers {
    /** Called when the AP server accepts our login. Receives the packet, client instance,
     *  isNewVersion flag, and offsets already updated by the connection hook. */
    onConnected: (packet: ConnectedPacket, client: Client, isNewVersion: boolean, offsetsRef: MutableRefObject<OffsetTable>) => void;
    /** Called when the socket disconnects (server-side kick or network loss). */
    onDisconnected: () => void;
    /** Called for each batch of received items. */
    onItemsReceived: (items: Item[], client: Client) => void;
    /** Called for chat/hint/item log packets. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onPrintJSON: (packet: any, client: Client) => void;
    /** Called for location scout responses. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onLocationInfo: (packet: any, client: Client) => void;
    /** Called when the server broadcasts a room update (e.g. co-op partner checked locations). */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onRoomUpdate?: (packet: any) => void;
}

export function useAPConnection() {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [pingLatency, setPingLatency] = useState<number | null>(null);
    const [connectionQuality, setConnectionQuality] = useState<'good' | 'degraded' | 'dead' | null>(null);
    const [connectionKey, setConnectionKey] = useState(0);

    const clientRef = useRef<Client | null>(null);
    const isConnectingRef = useRef<boolean>(false);
    const pingTimeoutRef = useRef<number | ReturnType<typeof setInterval> | null>(null);
    const lastPingTimeRef = useRef<number>(0);

    // Offsets managed here; updated synchronously inside the 'connected' handler.
    const { offsetsRef, isNewApWorldRef, applyVersion } = useOffsets();

    // handlersRef always holds the latest callbacks without re-registering socket listeners.
    const handlersRef = useRef<ConnectionHandlers | null>(null);

    const connect = async (info: ConnectionInfo, _profileId?: string, handlers?: ConnectionHandlers, tags?: string[]) => {
        if (handlers) handlersRef.current = handlers;

        if (isConnectingRef.current) {
            console.log('Already connecting, ignoring request.');
            return;
        }

        isConnectingRef.current = true;
        setConnectionError(null);
        setIsConnected(false);

        // Stop any active ping interval — will restart after successful login.
        // Do NOT manually disconnect the old client here: the server kicks the old
        // session once the new connection authenticates. Disconnecting early and
        // immediately reconnecting causes the server to reject the new WebSocket.
        // The orphan guard on the 'disconnected' handler prevents the old client
        // from clobbering state.
        if (pingTimeoutRef.current) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            clearInterval(pingTimeoutRef.current as any);
            pingTimeoutRef.current = null;
        }

        const isSecurePage = typeof window !== 'undefined' && window.location.protocol === 'https:';
        const isLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(info.hostname);
        const protocolsToTry = info.hostname.includes('://')
            ? ['']
            : (isSecurePage && !isLocalhost) ? ['wss://'] : ['wss://', 'ws://'];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let lastError: any = null;
        const oldClient = clientRef.current;

        for (const protocol of protocolsToTry) {
            try {
                const client = new Client();
                clientRef.current = client;

                const url = `${protocol}${info.hostname}:${info.port}`;

                // ── Socket Event Handlers ────────────────────────────────────────────────

                client.socket.on('connectionRefused', (packet: ConnectionRefusedPacket) => {
                    const errors = packet.errors || [];
                    let msg = 'Connection refused.';
                    if (errors.includes('InvalidSlot'))
                        msg = `Slot "${info.slotName}" not found. Check that your name matches the YAML exactly.`;
                    else if (errors.includes('InvalidPassword'))
                        msg = 'Incorrect password.';
                    else if (errors.includes('InvalidGame'))
                        msg = `Slot "${info.slotName}" is not a Pokepelago game.`;
                    else if (errors.includes('IncompatibleVersion'))
                        msg = 'Archipelago version incompatible with this client.';
                    else if (errors.length > 0)
                        msg = `Connection refused: ${errors.join(', ')}`;
                    setConnectionError(msg);
                    setIsConnected(false);
                    if (pingTimeoutRef.current) clearInterval(pingTimeoutRef.current);
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                client.socket.on('bounced', (packet: any) => {
                    if (packet.tags && packet.tags.includes('ping')) {
                        setPingLatency(Date.now() - lastPingTimeRef.current);
                        setConnectionQuality('good');
                    }
                });

                // Orphan guard: if a new connect() has superseded this client, ignore its
                // disconnect event so it cannot clobber newly established state.
                client.socket.on('disconnected', () => {
                    if (clientRef.current !== client) return;
                    console.log('[useAPConnection] Disconnected from Archipelago server.');
                    setIsConnected(false);
                    setConnectionQuality('dead');
                    setPingLatency(null);
                    if (pingTimeoutRef.current) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        clearInterval(pingTimeoutRef.current as any);
                        pingTimeoutRef.current = null;
                    }
                    handlersRef.current?.onDisconnected();
                });

                client.socket.on('connected', (packet: ConnectedPacket) => {
                    // Orphan guard: if a newer connect() has replaced this client, ignore.
                    if (clientRef.current !== client) return;
                    console.log(`Connected to Archipelago via ${protocol || '(explicit protocol)'}!`, packet);

                    // ── APWorld Version Detection ────────────────────────────────────────
                    const allLocs = [
                        ...(packet.missing_locations || []),
                        ...(packet.checked_locations || []),
                    ];
                    const isNewVersion =
                        (typeof packet.slot_data === 'object' && packet.slot_data !== null && 'dexsanity' in packet.slot_data) ||
                        allLocs.some((id: number) => (id >= 8560000 && id < 8570000) || id >= 8660000);

                    applyVersion(isNewVersion);

                    if (isNewVersion) {
                        console.log('[useAPConnection] Detected Gen 9+ APWorld (Location Offset: 8560000)');
                    } else {
                        console.log('[useAPConnection] Detected Legacy APWorld (Location Offset: 8571000)');
                    }

                    setConnectionKey(k => k + 1);
                    handlersRef.current?.onConnected(packet, client, isNewVersion, offsetsRef);
                });

                client.items.on('itemsReceived', (items: Item[]) => {
                    if (clientRef.current !== client) return;
                    handlersRef.current?.onItemsReceived(items, client);
                });

                client.socket.on('printJSON', (packet) => {
                    if (clientRef.current !== client) return;
                    handlersRef.current?.onPrintJSON(packet, client);
                });

                client.socket.on('locationInfo', (packet) => {
                    if (clientRef.current !== client) return;
                    handlersRef.current?.onLocationInfo(packet, client);
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                client.socket.on('roomUpdate', (packet: any) => {
                    if (clientRef.current !== client) return;
                    handlersRef.current?.onRoomUpdate?.(packet);
                });

                // ── DataPackage cache ────────────────────────────────────────────────────
                const cachedPackageRaw = localStorage.getItem('pokepelago_datapackage');
                if (cachedPackageRaw) {
                    try {
                        const parsedCache = JSON.parse(cachedPackageRaw);
                        client.package.importPackage(parsedCache);
                        console.log('[useAPConnection] Loaded Archipelago data package from cache.');
                    } catch (e) {
                        console.warn('[useAPConnection] Failed to parse cached data package, ignoring.', e);
                    }
                }

                await client.login(url, info.slotName, 'Pokepelago', {
                    password: info.password,
                    items: itemsHandlingFlags.all,
                    ...(tags && tags.length > 0 ? { tags } : {}),
                });

                // Save DataPackage back to cache after successful login
                try {
                    const latestPackage = client.package.exportPackage();
                    localStorage.setItem('pokepelago_datapackage', JSON.stringify(latestPackage));
                    console.log('[useAPConnection] Saved Archipelago data package to cache.');
                } catch (e) {
                    console.error('[useAPConnection] Failed to save data package to cache.', e);
                }

                setIsConnected(true);
                setConnectionQuality('good');
                setConnectionError(null);
                localStorage.setItem('pokepelago_connected', 'true');
                isConnectingRef.current = false;

                // Start 5-second ping loop for latency tracking
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (pingTimeoutRef.current) clearInterval(pingTimeoutRef.current as any);
                pingTimeoutRef.current = setInterval(() => {
                    try {
                        if (clientRef.current?.authenticated) {
                            lastPingTimeRef.current = Date.now();
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (clientRef.current as any).socket.send({ cmd: 'Bounce', tags: ['ping'] });
                        }
                    } catch { /* socket may have closed between check and send */ }
                }, 5000);

                // Now that the new client is authenticated, safely drop the old one.
                // Doing this before login would cause the server to reject the new
                // WebSocket while it tears down the previous session.
                if (oldClient && oldClient !== client) {
                    oldClient.socket.disconnect();
                }

                return; // Successfully connected — exit loop

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                console.warn(`Connection to ${protocol}${info.hostname}:${info.port} failed:`, err);
                lastError = err;

                // Orphan the failed client BEFORE disconnecting it so the async
                // 'disconnected' event is blocked by the orphan guard and onDisconnected()
                // is not called mid-fallback (which would reset game state unnecessarily).
                const failedClient = clientRef.current;
                clientRef.current = null;
                if (failedClient) failedClient.socket.disconnect();

                // Don't retry on AP-level auth failures (only on transport-level failures)
                const msg = err?.message || String(err);
                if (
                    msg.includes('Invalid Slot') || msg.includes('Invalid Password') ||
                    msg.includes('Invalid Game') || msg.includes('Incompatible Version')
                ) {
                    break;
                }
            }
        }

        console.error('All connection attempts failed', lastError);
        const rawMsg = lastError?.message || String(lastError || '');
        let friendlyMsg: string;
        if (rawMsg.includes('refused') || rawMsg.includes('ECONNREFUSED') || rawMsg.includes('ENOTFOUND') || rawMsg.includes('timed out'))
            friendlyMsg = 'Server is offline or unreachable. Check the host and port.';
        else if (rawMsg.includes('SSL') || rawMsg.includes('ERR_SSL') || rawMsg.includes('wss'))
            friendlyMsg = 'Secure connection failed. Try using ws:// instead of wss://.';
        else if (rawMsg.includes('insecure'))
            friendlyMsg = 'Cannot connect with ws:// from an HTTPS page. The server needs to support wss://.';
        else if (rawMsg.includes('Invalid Slot') || rawMsg.includes('InvalidSlot'))
            friendlyMsg = `Slot "${info.slotName}" not found. Check that your name matches the YAML exactly.`;
        else if (rawMsg.includes('Invalid Password') || rawMsg.includes('InvalidPassword'))
            friendlyMsg = 'Incorrect password.';
        else if (rawMsg.includes('Invalid Game') || rawMsg.includes('InvalidGame'))
            friendlyMsg = `Slot "${info.slotName}" is not a Pokepelago game.`;
        else if (rawMsg)
            friendlyMsg = rawMsg;
        else
            friendlyMsg = 'Failed to connect. The host may be offline or you might have a secure connection issue.';
        setConnectionError(friendlyMsg);
        setIsConnected(false);
        isConnectingRef.current = false;
    };

    const disconnect = () => {
        if (pingTimeoutRef.current) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    };

    return {
        clientRef,
        isConnected,
        connectionError,
        pingLatency,
        connectionQuality,
        connectionKey,
        isConnectingRef,
        offsetsRef,
        isNewApWorldRef,
        connect,
        disconnect,
    };
}

// Re-export OffsetTable for consumers that need it without importing useOffsets directly
export type { OffsetTable };
export { NEW_OFFSETS, LEGACY_OFFSETS };
