"""
Generate src/data/pokemon_names.json from the PokeAPI.

Fetches pokemon-species 1-1025 and extracts all localized names.
Output format: { "pokemonId": { "languageCode": "name" } }

Usage:
    python scripts/generate_pokemon_names.py

Requires: requests  (pip install requests)
"""

import json
import sys
import time
import threading
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Please install requests: pip install requests")

BASE_URL = "https://pokeapi.co/api/v2/pokemon-species/{}"
OUT_PATH = Path(__file__).parent.parent / "src" / "data" / "pokemon_names.json"
TOTAL = 1025
WORKERS = 20     # concurrent threads
RETRY_WAIT = 2   # seconds between retries

result: dict[str, dict[str, str]] = {}
lock = threading.Lock()
errors: list[int] = []


def fetch_species(pid: int, session: requests.Session) -> None:
    for attempt in range(5):
        try:
            r = session.get(BASE_URL.format(pid), timeout=10)
            r.raise_for_status()
            data = r.json()
            names: dict[str, str] = {}
            for entry in data.get("names", []):
                lang_code = entry["language"]["name"]
                names[lang_code] = entry["name"]
            with lock:
                result[str(pid)] = names
            return
        except Exception as e:
            if attempt < 4:
                time.sleep(RETRY_WAIT * (attempt + 1))
            else:
                print(f"  ERROR pid={pid}: {e}", flush=True)
                with lock:
                    errors.append(pid)


def run_workers(ids: list[int]) -> None:
    from concurrent.futures import ThreadPoolExecutor
    session = requests.Session()
    done = 0

    def task(pid: int) -> None:
        nonlocal done
        fetch_species(pid, session)
        with lock:
            done += 1
        if done % 50 == 0 or done == TOTAL:
            print(f"  {done}/{TOTAL} fetched...", flush=True)

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        ex.map(task, ids)


def main() -> None:
    print(f"Fetching {TOTAL} Pokémon species from PokeAPI...")
    ids = list(range(1, TOTAL + 1))
    run_workers(ids)

    if errors:
        print(f"\nRetrying {len(errors)} failed IDs: {errors}")
        run_workers(errors)

    if len(result) < TOTAL:
        print(f"WARNING: only got {len(result)}/{TOTAL} entries")

    # Sort by numeric ID for a stable, readable file
    sorted_result = {str(k): result[str(k)] for k in range(1, TOTAL + 1) if str(k) in result}

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(sorted_result, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\nDone. Written {len(sorted_result)} Pokémon to {OUT_PATH}")

    # Show which language codes were found (for reference)
    all_langs: set[str] = set()
    for names in sorted_result.values():
        all_langs.update(names.keys())
    print(f"Language codes found: {sorted(all_langs)}")


if __name__ == "__main__":
    main()
