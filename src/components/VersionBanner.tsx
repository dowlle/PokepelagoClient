import React, { useState } from 'react';

// Cross-deploy notice for the 0.6.3 beta-testing window. Detects beta vs prod at runtime
// from the URL path (prod is served at /PokepelagoClient/, beta at /PokepelagoClient/beta/),
// so the same component behaves correctly on both branches without a build flag.
//   - prod  → "v0.6.3 is ready to test on the beta site →" (links to the beta site)
//   - beta  → "you're on the v0.6.3 beta — download the .apworld →" (links to the GitHub Release)
// Dismissible; the dismissal is remembered per-version in localStorage.

const RELEASE_URL = 'https://github.com/dowlle/PokepelagoClient/releases/tag/v0.6.3';
const BETA_URL = 'https://dowlle.github.io/PokepelagoClient/beta/';
const DISMISS_KEY = 'pokepelago_banner_v0_6_3';

export const VersionBanner: React.FC = () => {
    const isBeta = typeof window !== 'undefined' && window.location.pathname.includes('/beta');
    const [dismissed, setDismissed] = useState<boolean>(() => {
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
                {isBeta ? (
                    <>
                        You&apos;re testing the <strong>v0.6.3 beta</strong>.{' '}
                        <a href={RELEASE_URL} target="_blank" rel="noreferrer" className="underline font-semibold hover:opacity-80">
                            Download the v0.6.3 .apworld &rarr;
                        </a>
                    </>
                ) : (
                    <>
                        <strong>Poképelago v0.6.3</strong> is ready to test on the{' '}
                        <a href={BETA_URL} target="_blank" rel="noreferrer" className="underline font-semibold hover:opacity-80">
                            beta site &rarr;
                        </a>
                    </>
                )}
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
