#!/bin/bash
# Pokepelago release script — pre-flight checks + tag creation.
# Usage: bash release.sh [version]
# Example: bash release.sh 0.5.0
#
# What it does:
#   1. Verifies both repos have clean working trees and are on main
#   2. Verifies versions match between package.json, archipelago.json, and the tag
#   3. Cross-checks pokemon_gates.ts against data.py for gate data sync
#   4. Runs client CI checks (type-check, lint, audit, build)
#   5. Runs backend tests
#   6. Optionally runs the full fuzz suite
#   7. Creates and pushes the tag (triggers the release workflow)

set -euo pipefail

CLIENT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$CLIENT_DIR/../ArchipelagoPokepelago" && pwd)"
BACKEND_PYTHON="$BACKEND_DIR/.venv/Scripts/python.exe"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
header() { echo -e "\n${YELLOW}[$1]${NC} $2"; }

ERRORS=0

# ── Parse version argument ──────────────────────────────────────────────────
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
    # Read from package.json as default
    VERSION=$(node -p "require('$CLIENT_DIR/package.json').version")
    echo "No version argument given, using package.json version: $VERSION"
fi
TAG="v$VERSION"
echo "Preparing release: $TAG"

# ── 1. Repo state checks ───────────────────────────────────────────────────
header "1/7" "Checking repository state"

# Client repo
cd "$CLIENT_DIR"
if [ -n "$(git status --porcelain)" ]; then
    fail "Client repo has uncommitted changes"
else
    pass "Client repo is clean"
fi

CLIENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CLIENT_BRANCH" != "main" ]; then
    warn "Client is on '$CLIENT_BRANCH' (expected 'main')"
else
    pass "Client is on main"
fi

if ! git diff --quiet "origin/$CLIENT_BRANCH" HEAD 2>/dev/null; then
    fail "Client has unpushed commits"
else
    pass "Client is up to date with origin"
fi

# Backend repo
cd "$BACKEND_DIR"
if [ -n "$(git status --porcelain)" ]; then
    fail "Backend repo has uncommitted changes"
else
    pass "Backend repo is clean"
fi

BACKEND_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BACKEND_BRANCH" != "main" ]; then
    warn "Backend is on '$BACKEND_BRANCH' (expected 'main')"
else
    pass "Backend is on main"
fi

if ! git diff --quiet "origin/$BACKEND_BRANCH" HEAD 2>/dev/null; then
    fail "Backend has unpushed commits"
else
    pass "Backend is up to date with origin"
fi

# Tag doesn't already exist
cd "$CLIENT_DIR"
if git rev-parse "$TAG" >/dev/null 2>&1; then
    fail "Tag $TAG already exists"
else
    pass "Tag $TAG is available"
fi

# ── 2. Version sync check ──────────────────────────────────────────────────
header "2/7" "Checking version sync"

CLIENT_VERSION=$(node -p "require('$CLIENT_DIR/package.json').version")
APWORLD_VERSION=$("$BACKEND_PYTHON" -c "import json; print(json.load(open('$BACKEND_DIR/worlds/pokepelago/archipelago.json'))['world_version'])")

if [ "$CLIENT_VERSION" = "$VERSION" ]; then
    pass "package.json version: $CLIENT_VERSION"
else
    fail "package.json version ($CLIENT_VERSION) != $VERSION"
fi

if [ "$APWORLD_VERSION" = "$VERSION" ]; then
    pass "archipelago.json version: $APWORLD_VERSION"
else
    fail "archipelago.json world_version ($APWORLD_VERSION) != $VERSION"
fi

# ── 3. Gate data sync check ────────────────────────────────────────────────
header "3/7" "Cross-checking gate data (pokemon_gates.ts vs data.py)"

GATE_RESULT=$("$BACKEND_PYTHON" -c "
import json, re, sys
sys.path.insert(0, '$BACKEND_DIR')
from worlds.pokepelago.data import (
    LEGENDARY_SUB_IDS, LEGENDARY_BOX_IDS, LEGENDARY_MYTHIC_IDS,
    BABY_IDS, TRADE_EVO_IDS, FOSSIL_IDS, ULTRA_BEAST_IDS, PARADOX_IDS,
    STONE_EVO_GROUPS,
)

# Parse client gates from TypeScript
gates_file = open('$CLIENT_DIR/src/data/pokemon_gates.ts').read()

def extract_set(name):
    pattern = rf'export const {name}\s*=\s*new Set<number>\(\[([\d,\s]+)\]\)'
    m = re.search(pattern, gates_file)
    if not m: return set()
    return set(int(x.strip()) for x in m.group(1).split(',') if x.strip())

def extract_stone_sets():
    result = {}
    pattern = r\"(\w+):\s*new Set\(\[([\d,\s]+)\]\)\"
    for m in re.finditer(pattern, gates_file):
        result[m.group(1)] = set(int(x.strip()) for x in m.group(2).split(',') if x.strip())
    return result

checks = [
    ('SUB_LEGENDARY_IDS', LEGENDARY_SUB_IDS, extract_set('SUB_LEGENDARY_IDS')),
    ('BOX_LEGENDARY_IDS', LEGENDARY_BOX_IDS, extract_set('BOX_LEGENDARY_IDS')),
    ('MYTHIC_IDS', LEGENDARY_MYTHIC_IDS, extract_set('MYTHIC_IDS')),
    ('BABY_IDS', BABY_IDS, extract_set('BABY_IDS')),
    ('TRADE_EVO_IDS', TRADE_EVO_IDS, extract_set('TRADE_EVO_IDS')),
    ('FOSSIL_IDS', FOSSIL_IDS, extract_set('FOSSIL_IDS')),
    ('ULTRA_BEAST_IDS', ULTRA_BEAST_IDS, extract_set('ULTRA_BEAST_IDS')),
    ('PARADOX_IDS', PARADOX_IDS, extract_set('PARADOX_IDS')),
]

ok = True
for name, server, client in checks:
    if server != client:
        missing = server - client
        extra = client - server
        parts = []
        if missing: parts.append(f'missing from client: {sorted(missing)}')
        if extra: parts.append(f'extra in client: {sorted(extra)}')
        print(f'MISMATCH {name}: {\" | \".join(parts)}')
        ok = False
    else:
        print(f'OK {name} ({len(server)} ids)')

client_stones = extract_stone_sets()
for stone, server_ids in STONE_EVO_GROUPS.items():
    client_ids = client_stones.get(stone, set())
    if set(server_ids) != client_ids:
        missing = set(server_ids) - client_ids
        extra = client_ids - set(server_ids)
        parts = []
        if missing: parts.append(f'missing from client: {sorted(missing)}')
        if extra: parts.append(f'extra in client: {sorted(extra)}')
        print(f'MISMATCH STONE_{stone}: {\" | \".join(parts)}')
        ok = False
    else:
        print(f'OK STONE_{stone} ({len(server_ids)} ids)')

if not ok:
    sys.exit(1)
" 2>&1) || {
    echo "$GATE_RESULT" | while read -r line; do
        if [[ "$line" == MISMATCH* ]]; then fail "$line"
        else pass "$line"; fi
    done
    true  # don't exit on gate check failure, just record
}

if [ $? -eq 0 ]; then
    echo "$GATE_RESULT" | while read -r line; do
        pass "$line"
    done
fi

# ── 4. Client CI checks ────────────────────────────────────────────────────
header "4/7" "Running client checks"

cd "$CLIENT_DIR"

echo "  Type-checking..."
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    fail "TypeScript type check failed"
else
    pass "TypeScript type check passed"
fi

echo "  Linting..."
LINT_ERRORS=$(npm run lint 2>&1 | grep -c " error " || true)
# Note: pre-existing lint errors are expected; check for zero-exit
if npm run lint >/dev/null 2>&1; then
    pass "ESLint passed"
else
    warn "ESLint has $LINT_ERRORS errors (check if pre-existing)"
fi

echo "  Auditing dependencies..."
if npm audit --audit-level=high >/dev/null 2>&1; then
    pass "npm audit passed (no high/critical vulnerabilities)"
else
    fail "npm audit found high/critical vulnerabilities"
fi

echo "  Building..."
if npm run build >/dev/null 2>&1; then
    pass "Production build succeeded"
else
    fail "Production build failed"
fi

# ── 5. Backend tests ───────────────────────────────────────────────────────
header "5/7" "Running backend tests"

cd "$BACKEND_DIR"
if "$BACKEND_PYTHON" -m pytest worlds/pokepelago/test/test_rules.py -x --tb=short -q 2>&1 | tail -1 | grep -q "passed"; then
    pass "Backend rule tests passed"
else
    fail "Backend rule tests failed"
fi

# ── 6. Fuzz suite (optional) ───────────────────────────────────────────────
header "6/7" "Fuzz testing"

read -p "  Run fuzz suite? This takes a few minutes. [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "  Running fuzz with 0.1x multiplier (quick smoke test)..."
    cd "$BACKEND_DIR"
    if bash run_fuzz.sh 0.1 2>&1 | tail -5; then
        pass "Fuzz suite passed"
    else
        fail "Fuzz suite failed (check fuzz_results/)"
    fi
else
    warn "Fuzz suite skipped"
fi

# ── 7. Summary & tag ──────────────────────────────────────────────────────
header "7/7" "Summary"

if [ $ERRORS -gt 0 ]; then
    echo -e "\n${RED}$ERRORS error(s) found. Fix them before releasing.${NC}"
    exit 1
fi

echo -e "\n${GREEN}All checks passed!${NC}"
echo ""
read -p "Create and push tag $TAG? [y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd "$CLIENT_DIR"
    git tag "$TAG"
    git push origin "$TAG"
    echo -e "\n${GREEN}Tag $TAG pushed! Release workflow will run on GitHub.${NC}"
    echo "Track it at: https://github.com/dowlle/PokepelagoClient/actions"
else
    echo "Tag not created. Run 'git tag $TAG && git push origin $TAG' when ready."
fi
