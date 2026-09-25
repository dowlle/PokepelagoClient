// Turns sprite pipeline state into the one reason the Sprites settings tab
// shows a player (#41). Pure so the classification is unit-tested; the
// inputs come from uiSettings, useSpriteManager, services/spriteHealth and
// services/spriteUrlCache.

import type { SpriteHealthSnapshot, SpriteUrlTestResult } from '../services/spriteHealth';
import { normalizeSpriteRepoUrl } from './pokesprite';

export type SpriteProblem =
    | 'sprites-off'   // "Enable Custom Sprites" unticked: the grid shows no sprites at all
    | 'no-source'     // nothing to load sprites from
    | 'bad-url'       // the repo URL field holds something that cannot be a sprite folder
    | 'not-found'     // the URL answers, but there is no sprite there (404)
    | 'unreachable'   // blocked, offline, or the site did not answer
    | 'stuck'         // sprite cache entries that never finished
    | 'some-missing'; // the source works but some sprites failed

export type SpriteSourceState = 'ok' | 'checking' | 'unused' | SpriteProblem;

export interface SpriteDiagnosisInput {
    enableSprites: boolean;
    spriteSet: 'normal' | 'derpemon';
    localCount: number;
    repoUrl: string;
    // Result of testing one sprite from repoUrl; null while the test runs.
    repoTest: SpriteUrlTestResult | null;
    health: SpriteHealthSnapshot;
    cache: { stalledCount: number; emptyCount: number };
}

export interface SpriteDiagnosis {
    // The main reason sprites are missing, or null when nothing is wrong.
    problem: SpriteProblem | null;
    sources: {
        local: SpriteSourceState;
        repo: SpriteSourceState;
        derpemon: SpriteSourceState;
    };
}

function repoState(input: SpriteDiagnosisInput): SpriteSourceState {
    const info = normalizeSpriteRepoUrl(input.repoUrl);
    if (info.kind === 'empty') return 'unused';
    if (info.kind === 'invalid' || info.kind === 'github-repo') return 'bad-url';
    const { loaded, failed } = input.health.repo;
    switch (input.repoTest) {
        case 'not-found': return 'not-found';
        case 'http-error':
        case 'unreachable': return 'unreachable';
        case null: return loaded > 0 || failed > 0 ? countsState(loaded, failed) : 'checking';
        case 'ok': return countsState(loaded, failed);
    }
}

function countsState(loaded: number, failed: number): SpriteSourceState {
    if (failed === 0) return 'ok';
    // Everything the grid tried failed although the test sprite loaded (or
    // is still being tested): most likely the connection dropped.
    return loaded === 0 ? 'unreachable' : 'some-missing';
}

export function diagnoseSprites(input: SpriteDiagnosisInput): SpriteDiagnosis {
    const { health } = input;
    const sources: SpriteDiagnosis['sources'] = {
        local: input.localCount > 0 ? countsState(health.local.loaded, health.local.failed) : 'unused',
        repo: repoState(input),
        derpemon: input.spriteSet === 'derpemon' ? countsState(health.derpemon.loaded, health.derpemon.failed) : 'unused',
    };

    let problem: SpriteProblem | null = null;
    if (!input.enableSprites) {
        problem = 'sprites-off';
    } else if (sources.local === 'unused' && sources.repo === 'unused' && sources.derpemon === 'unused') {
        problem = 'no-source';
    } else if (isProblem(sources.repo) && sources.repo !== 'some-missing') {
        // A broken repo URL is the main reason even with local imports, since
        // it is the fallback for every sprite the import does not cover.
        problem = sources.repo;
    } else if (input.cache.stalledCount > 0) {
        problem = 'stuck';
    } else if (input.repoUrl && input.cache.emptyCount > 0) {
        // With a repo URL set every sprite resolves to a URL, so a cached
        // "no sprite" is left over from before the URL was set.
        problem = 'stuck';
    } else {
        problem = [sources.local, sources.repo, sources.derpemon].find(isProblem) ?? null;
    }
    return { problem, sources };
}

function isProblem(state: SpriteSourceState): state is SpriteProblem {
    return state !== 'ok' && state !== 'checking' && state !== 'unused';
}
