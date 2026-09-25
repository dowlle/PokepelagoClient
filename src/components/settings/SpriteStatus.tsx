import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { getSpriteUrlCacheStats } from '../../services/spriteUrlCache';
import {
    getSpriteHealthSnapshot,
    subscribeSpriteHealth,
    testSpriteUrl,
    type SpriteSourceKind,
    type SpriteUrlTestResult,
} from '../../services/spriteHealth';
import { diagnoseSprites, type SpriteProblem, type SpriteSourceState } from '../../utils/spriteDiagnosis';
import { normalizeSpriteRepoUrl, resolveExternalSpriteUrl, POKEAPI_SPRITE_BASE } from '../../utils/pokesprite';

// Sprites settings status (#41): tells the player why sprites are missing,
// using the same counters as the ?debug=sprites overlay plus the per-source
// load outcomes from services/spriteHealth.

const PROBLEM_TEXT: Record<SpriteProblem, { title: string; detail: string }> = {
    'sprites-off': {
        title: 'Sprites are switched off.',
        detail: 'Tick "Enable Custom Sprites" below to show them.',
    },
    'no-source': {
        title: 'No sprite source is set.',
        detail: 'Pokepelago comes without sprites, so Pokemon show as numbers until you pick a source: use PokeAPI sprites, paste a sprite URL, or import a folder.',
    },
    'bad-url': {
        title: 'The sprite URL does not look right.',
        detail: 'It should be a link to a sprites folder, like the PokeAPI one.',
    },
    'not-found': {
        title: 'No sprites at the sprite URL (404).',
        detail: 'The site answered, but there is no sprite at that address. Check that the link points at a sprites folder.',
    },
    'unreachable': {
        title: 'Sprites could not be downloaded.',
        detail: 'The sprite site did not answer. You may be offline, or an ad blocker, school or work network, or browser setting may be blocking it.',
    },
    'stuck': {
        title: 'Some sprites got stuck while loading.',
        detail: 'Press "Reload sprites" to fetch them again.',
    },
    'some-missing': {
        title: 'Some sprites failed to load.',
        detail: 'Your sprite source is missing some Pokemon, so those show as numbers.',
    },
};

const STATE_TEXT: Record<SpriteSourceState, string> = {
    'ok': 'Working',
    'checking': 'Checking...',
    'unused': 'Not set',
    'sprites-off': 'Off',
    'no-source': 'Not set',
    'bad-url': 'Not a sprite link',
    'not-found': 'Wrong URL (404)',
    'unreachable': 'Blocked or offline',
    'stuck': 'Stuck',
    'some-missing': 'Some missing',
};

const SOURCE_LABEL: Record<SpriteSourceKind, string> = {
    local: 'Imported sprites',
    repo: 'Sprite URL',
    derpemon: 'Derpemon',
};

// Tests one sprite (#1) from the configured repo URL, debounced so typing a
// URL does not fire a request per keystroke. null while a test is pending.
function useRepoTest(repoUrl: string, retry: number): SpriteUrlTestResult | null {
    const testUrl = React.useMemo(() => {
        const info = normalizeSpriteRepoUrl(repoUrl);
        return info.kind === 'github-page' || info.kind === 'direct' ? resolveExternalSpriteUrl(repoUrl, 1) : null;
    }, [repoUrl]);
    const [result, setResult] = React.useState<{ url: string; retry: number; value: SpriteUrlTestResult } | null>(null);

    React.useEffect(() => {
        if (!testUrl) return;
        let active = true;
        const handle = window.setTimeout(() => {
            void testSpriteUrl(testUrl).then((value) => {
                if (active) setResult({ url: testUrl, retry, value });
            });
        }, 600);
        return () => { active = false; window.clearTimeout(handle); };
    }, [testUrl, retry]);

    return result && result.url === testUrl && result.retry === retry ? result.value : null;
}

function useCacheCounters() {
    const read = () => {
        const { stalledCount, emptyCount } = getSpriteUrlCacheStats(false);
        return { stalledCount, emptyCount };
    };
    const [counters, setCounters] = React.useState(read);
    React.useEffect(() => {
        const handle = window.setInterval(() => {
            const next = read();
            setCounters(prev => prev.stalledCount === next.stalledCount && prev.emptyCount === next.emptyCount ? prev : next);
        }, 1000);
        return () => window.clearInterval(handle);
    }, []);
    return counters;
}

export const SpriteStatus: React.FC = () => {
    const {
        uiSettings,
        updateUiSettings,
        spriteCount,
        spriteRepoUrl,
        setSpriteRepoUrl,
        setSpriteRefreshCounter,
    } = useGame();

    const [retry, setRetry] = React.useState(0);
    const health = React.useSyncExternalStore(subscribeSpriteHealth, getSpriteHealthSnapshot);
    const cache = useCacheCounters();
    const repoTest = useRepoTest(spriteRepoUrl, retry);

    const diagnosis = diagnoseSprites({
        enableSprites: uiSettings.enableSprites,
        spriteSet: uiSettings.spriteSet,
        localCount: spriteCount,
        repoUrl: spriteRepoUrl,
        repoTest,
        health,
        cache,
    });

    const applyPokeApi = () => {
        setSpriteRepoUrl(POKEAPI_SPRITE_BASE);
        if (!uiSettings.enableSprites) updateUiSettings({ enableSprites: true });
    };
    const reload = () => {
        setSpriteRefreshCounter(c => c + 1);
        setRetry(r => r + 1);
    };

    const { problem } = diagnosis;
    const checking = problem === null && diagnosis.sources.repo === 'checking';
    const actionClass = 'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-yellow-600 hover:bg-yellow-500 text-white transition-colors';

    let action: React.ReactNode = null;
    if (problem === 'sprites-off') {
        action = <button type="button" className={actionClass} onClick={() => updateUiSettings({ enableSprites: true })}>Turn sprites on</button>;
    } else if (problem === 'no-source' || problem === 'bad-url' || problem === 'not-found') {
        action = <button type="button" className={actionClass} onClick={applyPokeApi}>Use PokeAPI sprites</button>;
    } else if (problem === 'stuck') {
        action = <button type="button" className={actionClass} onClick={reload}>Reload sprites</button>;
    } else if (problem === 'unreachable' || problem === 'some-missing') {
        action = <button type="button" className={actionClass} onClick={reload}>Try again</button>;
    }

    const sources = (Object.keys(SOURCE_LABEL) as SpriteSourceKind[]).filter(kind => diagnosis.sources[kind] !== 'unused');

    return (
        <div
            className={`p-3 rounded-xl border space-y-2 ${problem ? 'bg-amber-950/20 border-amber-700/40' : 'bg-gray-900/50 border-gray-700/50'}`}
            data-testid="sprite-status"
            data-problem={problem ?? (checking ? 'checking' : 'ok')}
            role="status"
        >
            <div className="flex items-start gap-2">
                {problem
                    ? <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    : checking
                        ? <Loader2 size={16} className="text-blue-400 shrink-0 mt-0.5 animate-spin" />
                        : <CheckCircle2 size={16} className="text-green-400 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-200">
                        {problem ? PROBLEM_TEXT[problem].title : checking ? 'Checking your sprite source...' : 'Sprites are working.'}
                    </div>
                    {problem && (
                        <div className="text-[10px] leading-snug" style={{ color: 'var(--pp-text-secondary)' }}>
                            {PROBLEM_TEXT[problem].detail}
                        </div>
                    )}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>

            {sources.length > 0 && (
                <div className="pt-2 space-y-1" style={{ borderTop: '1px solid var(--pp-border)' }}>
                    {sources.map(kind => {
                        const state = diagnosis.sources[kind];
                        const counts = health[kind];
                        const bad = state !== 'ok' && state !== 'checking';
                        return (
                            <div key={kind} className="flex items-center justify-between gap-2 text-[10px]" data-testid={`sprite-source-${kind}`}>
                                <span className="font-bold text-gray-300">{SOURCE_LABEL[kind]}</span>
                                <span className="flex items-center gap-2" style={{ color: 'var(--pp-text-muted)' }}>
                                    <span>
                                        {counts.loaded + counts.failed === 0
                                            ? 'none shown yet'
                                            : `${counts.loaded} loaded, ${counts.failed} failed`}
                                    </span>
                                    <span className={bad ? 'text-amber-400 font-bold' : 'text-green-400 font-bold'}>
                                        {STATE_TEXT[state]}
                                    </span>
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Shown under the Sprite Repo URL field: a github.com page link still works,
// but offering the raw base makes it clear where sprites come from and
// catches links that cannot work (a repo front page).
export const SpriteRepoUrlHint: React.FC<{ repoUrl: string; onUse: (base: string) => void }> = ({ repoUrl, onUse }) => {
    const info = normalizeSpriteRepoUrl(repoUrl);
    if (info.kind === 'github-page') {
        return (
            <div className="text-[10px] leading-snug p-2 rounded-lg bg-blue-950/30 border border-blue-800/40" style={{ color: 'var(--pp-text-secondary)' }} data-testid="sprite-url-hint">
                This is a GitHub page link. Sprites load from{' '}
                <span className="font-mono break-all text-gray-300">{info.base}</span>.{' '}
                <button type="button" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-bold" onClick={() => onUse(info.base)}>
                    Use this link
                </button>
            </div>
        );
    }
    if (info.kind === 'github-repo') {
        return (
            <div className="text-[10px] leading-snug p-2 rounded-lg bg-amber-950/20 border border-amber-700/40" style={{ color: 'var(--pp-text-secondary)' }} data-testid="sprite-url-hint">
                This links to a whole GitHub repo. Open its sprites folder on GitHub and paste that link instead.
            </div>
        );
    }
    return null;
};
