import React from 'react';
import { getSpriteUrlCacheStats, type SpriteUrlCacheStats } from '../services/spriteUrlCache';

// Sprite URL cache diagnostics overlay.
//
// Activate by appending ?debug=sprites to the URL. Polls the cache module's
// counters at 500ms and renders a fixed-position panel in the corner. Used
// for diagnosing the sprite-deload reports from Discord users (region toggle
// triggering blob churn). Ask affected users to reload with the flag and
// screenshot the panel during repro.

function shouldShow(): boolean {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === 'sprites';
}

export const SpriteDebugOverlay: React.FC = () => {
    const [enabled] = React.useState(shouldShow);
    const [stats, setStats] = React.useState<SpriteUrlCacheStats | null>(null);

    React.useEffect(() => {
        if (!enabled) return;
        const tick = () => setStats(getSpriteUrlCacheStats(false));
        tick();
        const handle = window.setInterval(tick, 500);
        return () => window.clearInterval(handle);
    }, [enabled]);

    if (!enabled || !stats) return null;

    const hitRate = stats.acquires > 0
        ? `${((stats.hits / stats.acquires) * 100).toFixed(1)}%`
        : '—';

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 8,
                right: 8,
                zIndex: 9999,
                background: 'rgba(0, 0, 0, 0.85)',
                color: '#a3e635',
                fontFamily: 'monospace',
                fontSize: 11,
                lineHeight: 1.45,
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid #4d7c0f',
                pointerEvents: 'none',
                userSelect: 'none',
                minWidth: 200,
            }}
            data-testid="sprite-debug-overlay"
        >
            <div style={{ color: '#bef264', fontWeight: 'bold', marginBottom: 4 }}>
                sprite cache
            </div>
            <div>size: {stats.size}</div>
            <div>blobs: {stats.blobUrlCount}</div>
            <div>in-flight: {stats.inFlightCount}</div>
            <div>active refs: {stats.activeRefs}</div>
            <div style={{ marginTop: 4, color: '#84cc16' }}>
                acq {stats.acquires} / rel {stats.releases}
            </div>
            <div>hit-rate: {hitRate}</div>
            <div>evictions: {stats.evictions}</div>
            <div>orphaned: {stats.orphaned}</div>
        </div>
    );
};
