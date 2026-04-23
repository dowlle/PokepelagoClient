// Lightweight semver parse + compare used by the FEAT-11 "update available"
// indicator. We only care about major.minor.patch — no pre-release metadata,
// no build tags. Returns null on non-semver input so callers can fall back
// gracefully (legacy APWorlds without a version field go this path).

export function parseVersion(raw: string | null | undefined): [number, number, number] | null {
    if (!raw) return null;
    const m = raw.trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!m) return null;
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

export function compareVersions(a: string | null | undefined, b: string | null | undefined): -1 | 0 | 1 | null {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    if (!pa || !pb) return null;
    for (let i = 0; i < 3; i++) {
        if (pa[i] < pb[i]) return -1;
        if (pa[i] > pb[i]) return 1;
    }
    return 0;
}

export function formatVersion(raw: string | null | undefined): string {
    const p = parseVersion(raw);
    if (!p) return raw ?? 'unknown';
    return `v${p[0]}.${p[1]}.${p[2]}`;
}
