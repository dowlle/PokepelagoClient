# PROJECT_STATUS.md

## Project Identity

| Field | Value |
|---|---|
| Name | Pokepelago Client |
| Repo | `github.com/dowlle/PokepelagoClient` (public) |
| Local path | `D:\pythonProjects\PokepelagoClient` |
| Tech stack | React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 |
| Production | https://dowlle.github.io/PokepelagoClient/ |
| Beta | https://dowlle.github.io/PokepelagoClient/beta/ |
| Current version | v0.4.5 |
| Related APWorld | `D:\pythonProjects\ArchipelagoPokepelago` (Python, separate repo) |
| Related notes | Obsidian vault: `F:\Vaults\stefappelhof\11-Dev\Pokepelago` |

## Architecture Summary

- React SPA connecting to Archipelago multiworld servers via WebSocket (`archipelago.js`)
- Players guess Pokemon names to catch them; lock gates (type keys, gym badges, region passes) control which are guessable
- Two React contexts: GameContext (all game state) + TwitchContext (Twitch chat integration)
- No backend — all state in localStorage + IndexedDB. Deployed as static site to GitHub Pages
- CI: type-check, lint, npm audit. No test framework
- `src/data/pokemon_gates.ts` must stay in sync with APWorld's `data.py`

## Current State

### Recently Completed

| What | Commit | Date |
|---|---|---|
| Fix Nidoran guess matching for non-English languages | `8cc5a2f` | 2025-03-23 |
| Scroll tour target into view before measuring | `78ad4ed` | 2025-03-20 |
| Fix high-severity flatted vulnerability | `dd470cd` | 2025-03-20 |
| Fix all lint errors (87 to 0) | `65216b6` | 2025-03-20 |
| Add optional guided tour for new players | `ad886c2` | 2025-03-20 |
| Fix medium-priority issues: security, error handling, UX, accessibility | `b3210ea` | 2025-03-15 |
| Add local release script with pre-flight checks | `b908a4e` | 2025-03-15 |
| Add automated release workflow | `21ef71b` | 2025-03-13 |
| Fix traps re-firing on reconnect | `8edb061` | 2025-03-13 |
| Fix critical stone gate desync, memory leak, starter protection, crash safety | `6f6f04a` | 2025-03-13 |

### Active Bugs (from vault notes, prioritized)

**Gameplay:**
- Foongus locked behind Link Cable — should only need Grass + Poison types
- Trevenant and Gourgeist don't require Link Cable — both are trade evos
- Master Ball works on non-guessable Pokemon — should be limited to guessable only
- Goal percentage rounding: 50% and 40% both give 150 for 386 Pokemon
- Too many items in play — need to reduce to YAML-specified amount
- Diacritics truncation: "Manzai" accepts "Manza" as correct

**Client:**
- Derpymon sprites don't reset when switching games
- GIF sprites show back side instead of front
- Pokegear state persists into standalone mode
- Master Ball count display wrong after use

**Connection:**
- Insecure WebSocket error when AP server is down (misleading message)
- Ping interval race condition: socket send via `as any` with no readyState check

### Code Health

- M-1: AP password exposed in OBS overlay URL
- M-3: Twitch OAuth token has no expiry tracking
- M-6: No localStorage quota exceeded handling
- L-2: Remove unused @airbreather/archipelago.js fork
- L-11: Romaji language label shows katakana
- H-5: Enable branch protection on main and beta

## Known Design Issues

- Generation can get stuck in logic when region_lock + type_lock are combined
- Non-dexsanity gameplay balance needs work (too few items, too many locations)
- Filler item pool too static — should be dynamically sized based on YAML settings

## Completed Features (not exhaustive)

- Full zone system (10 regions: Kanto through Paldea), all lock gates
- Dexsanity mode, goal system (count/percentage/region/legendaries)
- Multi-language guessing (11 languages), guided tour
- Shiny tokens, derpemon sprites, traps (derp, release, shuffle)
- Twitch integration (IRC chat guessing, leaderboard, OBS overlay, OAuth bot)
- Game manager (profiles, auto-cleanup), connection quality monitoring
- Notification dots, request hints, guessable/guessed filters, collapsible UI

## Next Up

- Auto-submit language scoping UX improvement
- Show item descriptions in PokemonDetails
- Showdown GIF sprite color display in PokemonDetails
- Type name tooltip on colored dots (Rock vs Normal hard to distinguish)

## Specification Compliance (before upstream AP submission)

- Add metadata in apworld per AP spec
- Comply with contributing guide and adding-games doc
- Check entrance randomization logic requirement
- Review rule builder improvements

## Last Updated

**2025-03-25** — Initial creation from repo analysis + vault notes sync.
