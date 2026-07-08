import React, { useState } from 'react';

// Post-promotion release notice: prod now serves v0.6.3, so tell players (on both prod
// and beta) to grab the updated .apworld from the GitHub Release. Auto-expires after the
// one-week notice window, so no follow-up removal PR is needed. Dismissible; the
// dismissal is remembered per-notice in localStorage (a fresh key, so players who
// dismissed the earlier beta-testing banner still see this one once).

const RELEASE_URL = 'https://github.com/dowlle/PokepelagoClient/releases/tag/v0.6.3';
const DISMISS_KEY = 'pokepelago_banner_v0_6_3_release';
// One week after the prod promotion; the banner stops rendering itself after this date.
const SHOW_UNTIL = Date.parse('2026-07-16T00:00:00+02:00');

export const VersionBanner: React.FC = () => {
    // Hidden when dismissed earlier or past the notice window (checked once at mount).
    const [dismissed, setDismissed] = useState<boolean>(() => {
        if (Date.now() > SHOW_UNTIL) return true;
        try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
    });

    // Don't show during local development.
    if (import.meta.env.DEV || dismissed) return null;

    const dismiss = () => {
        try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
        setDismissed(true);
    };

    return (
        <div
            className="shrink-0 flex items-center justify-center gap-3 px-4 py-1.5 text-xs sm:text-[13px]"
            style={{ background: 'var(--pp-accent, #4f46e5)', color: '#fff', borderBottom: '1px solid rgba(0,0,0,0.25)' }}
        >
            <span className="text-center">
                <strong>Pok&eacute;pelago v0.6.3</strong> is live! Get the updated{' '}
                <a href={RELEASE_URL} target="_blank" rel="noreferrer" className="underline font-semibold hover:opacity-80">
                    pokepelago.apworld from the release page &rarr;
                </a>
            </span>
            <button
                onClick={dismiss}
                aria-label="Dismiss"
                className="ml-1 leading-none text-base opacity-80 hover:opacity-100 font-bold"
            >
                &times;
            </button>
        </div>
    );
};
