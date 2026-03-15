#!/usr/bin/env python3
"""
make_bracket_config.py — scaffold bracket_config.json for the upcoming season.

Run this ONCE after Selection Sunday each year. It:
  1. Fetches all D1 teams from ESPN (to build the espn_id lookup table)
  2. Fetches the first weekend of tournament games to detect seeded teams
  3. Writes data/bracket_config.json with all known fields pre-filled
  4. Prints a checklist of what still needs manual entry (region assignments)

Usage:
    python scripts/make_bracket_config.py

After running:
  - Open data/bracket_config.json
  - Fill in "region" for each team: "East" | "West" | "South" | "Midwest"
  - Adjust any bracket_name values you want to shorten for display
  - Add bubble teams manually (the ~8-10 teams that just missed the field)
  - Commit the file
  - Run: python scripts/fetch_data.py && python scripts/fetch_torvik.py

The file persists across sessions — only update it when a team's seed or
region changes (rare mid-tournament), or at the start of a new season.
"""

import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT     = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

import re as _re
_REGION_RE = _re.compile(r'\\b(East|West|South|Midwest)\\s+Region\\b', _re.IGNORECASE)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept":     "application/json",
}

# ── Derive current season year ─────────────────────────────────────────────────
month       = datetime.now().month
season_year = datetime.now().year + 1 if month >= 10 else datetime.now().year
season_str  = f"{season_year - 1}-{str(season_year)[2:]}"  # e.g. "2026-27"

print(f"Building bracket_config.json for {season_str} season (tournament year {season_year})")


def fetch_json(url: str) -> dict | list | None:
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        res = urllib.request.urlopen(req, timeout=12)
        return json.loads(res.read())
    except Exception as e:
        print(f"  WARN: {url[-70:]} — {e}", file=sys.stderr)
        return None


# ── Step 1: Build ESPN ID lookup table from all D1 teams ─────────────────────
print("\nStep 1: Fetching all D1 teams from ESPN...")
espn_teams: dict[str, dict] = {}  # displayName.lower() -> team record

data = fetch_json(
    "https://site.api.espn.com/apis/site/v2/sports/basketball"
    "/mens-college-basketball/teams?limit=400"
)
if data:
    raw = data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])
    for entry in raw:
        t = entry.get("team", {})
        tid  = t.get("id", "")
        name = t.get("displayName", "")
        if tid and name:
            espn_teams[name.lower()] = {
                "espn_id":      tid,
                "displayName":  name,
                "abbreviation": t.get("abbreviation", ""),
                "color":        t.get("color", ""),
            }
    print(f"  Found {len(espn_teams)} D1 teams")
else:
    print("  ERROR: Could not fetch ESPN team list", file=sys.stderr)
    sys.exit(1)


def find_espn_team(name: str) -> dict | None:
    """Fuzzy match team name to ESPN team record."""
    key = name.lower().strip()
    # Exact match
    if key in espn_teams:
        return espn_teams[key]
    # Contains match (prefer longer key for specificity)
    candidates = [
        (k, v) for k, v in espn_teams.items()
        if key in k or k in key
    ]
    if candidates:
        candidates.sort(key=lambda x: -len(x[0]))
        return candidates[0][1]
    return None


# ── Step 2: Fetch tournament games to find seeded teams ───────────────────────
print(f"\nStep 2: Fetching {season_year} NCAA tournament games from ESPN scoreboard...")

bracket_teams: list[dict] = []
seen_ids: set[str] = set()

# Tournament runs across several weekends — scan the key dates
# Play-in: ~March 18-19, R64: ~March 20-21, R32: ~March 22-23
# We fetch a window of dates; ESPN returns scheduled+completed games
from datetime import timedelta

# Selection Sunday is typically 2nd Sunday of March
# Tournament starts ~5 days later — scan from March 15 through April 8
scan_start = datetime(season_year, 3, 15)
scan_end   = datetime(season_year, 4, 8)
scan_date  = scan_start

games_found = 0
while scan_date <= scan_end:
    date_str = scan_date.strftime("%Y%m%d")
    url = (
        f"https://site.api.espn.com/apis/site/v2/sports/basketball"
        f"/mens-college-basketball/scoreboard"
        f"?dates={date_str}&groups=100&seasontype=3"
    )
    data = fetch_json(url)
    if data:
        for event in data.get("events", []):
            comp = event.get("competitions", [{}])[0]
            for c in comp.get("competitors", []):
                tid   = c.get("team", {}).get("id", "")
                tname = c.get("team", {}).get("displayName", "")
                seed  = c.get("curatedRank", {}).get("current")
                if not tid or tid in seen_ids:
                    continue
                # Only include if seed is valid (1-16 or play-in seeds)
                if not seed or seed > 16:
                    continue
                # Parse region from game notes — present once bracket is set
                region = ""
                for note in comp.get("notes", []):
                    m = _REGION_RE.search(note.get("headline", ""))
                    if m:
                        region = m.group(1).capitalize()
                        # Normalize "Midwest" capitalisation
                        if region.lower() == "midwest":
                            region = "Midwest"
                        break

                seen_ids.add(tid)
                bracket_teams.append({
                    "bracket_name": c.get("team", {}).get("shortDisplayName",
                                    c.get("team", {}).get("name", tname)),
                    "espn_id":      tid,
                    "displayName":  tname,
                    "region":       region,   # parsed from ESPN notes automatically
                    "seed":         int(seed),
                })
                games_found += 1
    scan_date += timedelta(days=1)
    time.sleep(0.08)

print(f"  Found {len(bracket_teams)} seeded teams from {games_found} team-game entries")


# ── Step 3: Fill in any gaps — cross-reference ESPN teams list ────────────────
# If we found <68 teams (e.g. running before tournament starts), note it
if len(bracket_teams) < 60:
    print(f"\n  NOTE: Only {len(bracket_teams)} teams found.")
    print("  This script is most accurate AFTER Selection Sunday.")
    print("  Run again after the bracket is announced for complete results.")


# ── Step 4: Sort by seed then name, add region placeholder ───────────────────
bracket_teams.sort(key=lambda t: (t["seed"], t["displayName"]))


# ── Step 5: Check if existing config exists — preserve manual entries ─────────
existing_config = {}
config_path = DATA_DIR / "bracket_config.json"
if config_path.exists():
    try:
        existing_config = json.loads(config_path.read_text())
        print(f"\n  Existing bracket_config.json found (season {existing_config.get('_season')})")
        print("  Preserving region assignments and bubble teams from existing config...")
    except Exception:
        pass

# Build a lookup from existing config to preserve region assignments
existing_by_id = {
    t["espn_id"]: t
    for t in existing_config.get("bracket", []) + existing_config.get("bubble", [])
}

# Merge: prefer existing region/bracket_name if already set
for t in bracket_teams:
    existing = existing_by_id.get(t["espn_id"], {})
    if existing.get("region") and existing["region"] not in ("", "bubble"):
        t["region"] = existing["region"]
    if existing.get("bracket_name"):
        t["bracket_name"] = existing["bracket_name"]


# ── Step 6: Write config ──────────────────────────────────────────────────────
config = {
    "_comment": (
        "Update this file each year after Selection Sunday. "
        "Run 'python scripts/make_bracket_config.py' to scaffold with ESPN IDs and seeds. "
        "Then fill in 'region' for each team: East | West | South | Midwest. "
        "Add bubble teams manually in the 'bubble' array."
    ),
    "_season":       season_year,
    "_season_str":   season_str,
    "_last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    "bracket":       bracket_teams,
    "bubble":        existing_config.get("bubble", []),
}

config_path.write_text(json.dumps(config, indent=2))
print(f"\nWrote data/bracket_config.json ({len(bracket_teams)} bracket teams)")


# ── Step 7: Print checklist ───────────────────────────────────────────────────
missing_region = [t for t in bracket_teams if not t.get("region")]
print("\n" + "="*60)
print("NEXT STEPS")
print("="*60)

if missing_region:
    print(f"\n1. {len(missing_region)} teams missing region (bracket not yet announced or First Four teams):")
    print("   If the bracket has been announced and regions are still missing,")
    print("   re-run this script — ESPN updates game notes within ~30 min of the show.")
    print("\n   Still missing:")
    for t in sorted(missing_region, key=lambda x: x["seed"]):
        print(f"   #{t['seed']:2}  {t['displayName']:35}  id={t['espn_id']}")
    print("\n   If re-running doesn't help, add region manually for these teams only.")
else:
    print("\n1. All regions auto-detected from ESPN ✓")

bubble = config.get("bubble", [])
if not bubble:
    print(f"\n2. Add ~8-10 bubble teams to the 'bubble' array in bracket_config.json")
    print("   These are teams that narrowly missed the field.")
    print("   Each entry: {\"espn_id\": \"...\", \"bracket_name\": \"...\",")
    print("                \"displayName\": \"...\", \"region\": \"bubble\", \"seed\": null}")
else:
    print(f"\n2. Bubble teams: {len(bubble)} already in config ✓")

print(f"""
3. After filling in regions, run:
   python scripts/fetch_data.py
   python scripts/fetch_torvik.py
   python scripts/compute_transitive.py
   cp data/transitive_analysis.json public/data/transitive_analysis.json
   git add data/bracket_config.json data/ public/data/
   git commit -m "chore: {season_str} bracket config + data refresh"
   git push

4. Update data/injury_overrides.json with any significant injuries.
   Clear last year's entries — they don't carry over.
""")
