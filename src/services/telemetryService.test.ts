import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordTelemetry, flushTelemetry, _resetTelemetryForTests } from './telemetryService';

describe('telemetryService', () => {
    let beaconMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        _resetTelemetryForTests();
        vi.useFakeTimers();
        beaconMock = vi.fn().mockReturnValue(true);
        Object.defineProperty(navigator, 'sendBeacon', {
            value: beaconMock,
            configurable: true,
            writable: true,
        });
    });

    afterEach(() => {
        _resetTelemetryForTests();
        vi.useRealTimers();
    });

    function sentBodies(): { events: { kind: string; visit_id: string; props: Record<string, unknown> }[] }[] {
        return beaconMock.mock.calls.map(call => JSON.parse(call[1] as string));
    }

    it('batches events and flushes after the delay', () => {
        recordTelemetry('pokepelago_connect_result', { outcome: 'success', apworld_version: 'new' });
        recordTelemetry('pokepelago_goal_reached', { goal_count: 151 });
        expect(beaconMock).not.toHaveBeenCalled();

        vi.advanceTimersByTime(5000);

        expect(beaconMock).toHaveBeenCalledTimes(1);
        const [body] = sentBodies();
        expect(body.events).toHaveLength(2);
        expect(body.events[0].kind).toBe('pokepelago_connect_result');
        expect(body.events[0].props).toEqual({ outcome: 'success', apworld_version: 'new' });
        expect(body.events[1].props).toEqual({ goal_count: 151 });
    });

    it('sends the same in-memory visit id on every event, alphanumeric and capped', () => {
        recordTelemetry('pokepelago_connect_result', { outcome: 'success' });
        recordTelemetry('pokepelago_goal_reached', { goal_count: 1 });
        flushTelemetry();

        const [body] = sentBodies();
        const ids = body.events.map(e => e.visit_id);
        expect(ids[0]).toBe(ids[1]);
        expect(ids[0]).toMatch(/^[a-z0-9]+$/i);
        expect(ids[0].length).toBeLessThanOrEqual(64);
    });

    it('flushes immediately when a batch fills, splitting to the server cap', () => {
        for (let i = 0; i < 12; i++) {
            recordTelemetry('pokepelago_connect_result', { outcome: 'failed', reason: 'unreachable' });
        }
        flushTelemetry();

        const bodies = sentBodies();
        expect(bodies.length).toBeGreaterThanOrEqual(2);
        for (const body of bodies) {
            expect(body.events.length).toBeLessThanOrEqual(10);
        }
        const total = bodies.reduce((n, body) => n + body.events.length, 0);
        expect(total).toBe(12);
    });

    it('falls back to fetch when sendBeacon refuses, and never throws', () => {
        beaconMock.mockReturnValue(false);
        const fetchMock = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('fetch', fetchMock);

        recordTelemetry('pokepelago_sprite_block_detected', { failures: 6, layer: 'pokeapi' });
        expect(() => flushTelemetry()).not.toThrow();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://ap-pie.com/api/events');
        expect(init.method).toBe('POST');
        expect(init.keepalive).toBe(true);
        vi.unstubAllGlobals();
    });

    it('swallows a throwing transport instead of surfacing it', () => {
        beaconMock.mockImplementation(() => { throw new Error('blocked by CSP'); });
        vi.stubGlobal('fetch', vi.fn(() => { throw new Error('also blocked'); }));

        recordTelemetry('pokepelago_connect_result', { outcome: 'success' });
        expect(() => flushTelemetry()).not.toThrow();
        vi.unstubAllGlobals();
    });
});
