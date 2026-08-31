/**
 * Fire-and-forget operational telemetry to the AP-Pie events log.
 *
 * Events go to the cookieless analytics endpoint at ap-pie.com (documented at
 * https://ap-pie.com/privacy). Everything sent is a canonical short code or a
 * number: no server hostnames, no slot names, no guesses, no free-form text.
 * The server stores no IP, no User-Agent string, and records these kinds
 * anonymously even when the player is signed in to ap-pie.com. Browsers that
 * send Sec-GPC or DNT are honoured server-side.
 *
 * Failure posture: telemetry must never affect gameplay. Every entry point
 * swallows every error, sends are batched and flushed with sendBeacon (which
 * survives page unload), and a failed or blocked send is simply dropped.
 */

const EVENTS_ENDPOINT = 'https://ap-pie.com/api/events';
const MAX_BATCH = 10; // server-side cap per call
const FLUSH_DELAY_MS = 5000;

export type TelemetryKind =
    | 'pokepelago_connect_result'
    | 'pokepelago_goal_reached'
    | 'pokepelago_sprite_block_detected';

type TelemetryProps = Record<string, string | number | boolean>;

interface QueuedEvent {
    kind: TelemetryKind;
    visit_id: string;
    props: TelemetryProps;
}

// In-memory only, by design: lives in this tab's memory and dies on reload,
// so it cannot link two visits or two devices. Mirrors the ap-pie SPA.
const visitId: string = (() => {
    try {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    } catch {
        return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }
})();

let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pagehideHooked = false;

function send(events: QueuedEvent[]): void {
    if (events.length === 0) return;
    // text/plain keeps this a CORS "simple request": no preflight, and the
    // response is never read. The server parses the body as JSON regardless.
    const body = JSON.stringify({ events });
    try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            if (navigator.sendBeacon(EVENTS_ENDPOINT, body)) return;
        }
    } catch { /* fall through to fetch */ }
    try {
        void fetch(EVENTS_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors',
            keepalive: true,
            headers: { 'Content-Type': 'text/plain' },
            body,
        }).catch(() => { /* dropped by contract */ });
    } catch { /* dropped by contract */ }
}

export function flushTelemetry(): void {
    try {
        if (flushTimer !== null) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }
        while (queue.length > 0) {
            send(queue.slice(0, MAX_BATCH));
            queue = queue.slice(MAX_BATCH);
        }
    } catch { /* never throws */ }
}

/** Queue one event. Batches for a few seconds; flushes on pagehide. */
export function recordTelemetry(kind: TelemetryKind, props: TelemetryProps = {}): void {
    try {
        if (import.meta.env.MODE === 'development') return; // no dev-server noise in the log
        queue.push({ kind, visit_id: visitId, props });
        if (!pagehideHooked && typeof window !== 'undefined') {
            pagehideHooked = true;
            window.addEventListener('pagehide', flushTelemetry);
        }
        if (queue.length >= MAX_BATCH) {
            flushTelemetry();
        } else if (flushTimer === null) {
            flushTimer = setTimeout(flushTelemetry, FLUSH_DELAY_MS);
        }
    } catch { /* never throws */ }
}

/** Test hook: reset module state between tests. */
export function _resetTelemetryForTests(): void {
    if (flushTimer !== null) clearTimeout(flushTimer);
    flushTimer = null;
    queue = [];
}
