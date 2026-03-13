#!/usr/bin/env python3
"""
fetch_torvik.py — fetches T-Rank stats for all 64 bracket teams from Bart Torvik.

Endpoint:  https://barttorvik.com/{year}_team_results.json
No JS verification on this endpoint — plain curl works fine.

Outputs:
  data/torvik_stats.json   — stats keyed by ESPN team ID, merged with bracket metadata
  public/data/torvik_stats.json  — copy for the frontend

Run manually:  python scripts/fetch_torvik.py
Auto-refresh:  GitHub Actions (.github/workflows/refresh_torvik.yml) — runs daily
"""

import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT     = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PUB_DIR  = ROOT / "public" / "data"
DATA_DIR.mkdir(exist_ok=True)
PUB_DIR.mkdir(exist_ok=True)

YEAR = 2026
URL  = f"https://barttorvik.com/{YEAR}_team_results.json"
URL_GAMES = f"https://barttorvik.com/getgamestats.php?year={YEAR}&json=1"

# Torvik name -> our bracket_name mapping for names that don't match exactly
TORVIK_NAME_MAP = {
    "Ohio St.":            "Ohio State",
    "Iowa St.":            "Iowa State",
    "Michigan St.":        "Michigan State",
    "N.C. State":          "NC State",
    "Connecticut":         "UConn",
    "Wright St.":          "Wright State",
    "Utah St.":            "Utah State",
    "Portland St.":        "Portland State",
    "North Dakota St.":    "NDSU",
    "North Carolina A&T":  "NC A&T",
    "LIU":                 "Long Island",
    "Stephen F. Austin":   "SFA",
    "Mississippi":          "Ole Miss",
    "McNeese St.":          "McNeese",
    "Bethune Cookman":      "Bethune-Cookman",
    "Penn St.":             "Penn State",
    "Oklahoma St.":         "Oklahoma State",
}

# Torvik JSON field positions
FIELDS = [
    "rank", "team", "conf", "record",
    "adj_oe", "adj_oe_rank", "adj_de", "adj_de_rank",
    "barthag", "barthag_rank",
    "wins", "losses", "conf_wins", "conf_losses", "conf_record",
    "home_win_pct", "away_win_pct", "neutral_win_pct",
    "f_home_win_pct", "f_away_win_pct", "f_neutral_win_pct",
    "f_adj_oe", "f_adj_de",
    "adj_oe_raw", "adj_de_raw", "adj_oe_raw2", "adj_de_raw2",
    "proj_oe", "proj_de", "proj_oe2", "proj_de2",
    "proj_barthag", "proj_rank",
    "luck", "sos_raw", "sos_opp", "sos_nconf", "sos_rank",
    "exp", "exp_rank", "adj_tempo", "avg_poss",
    "seed", "ncaa_seed", "wab",
]


def fetch_torvik() -> dict:
    """Fetch raw Torvik JSON and return as {torvik_name: stats_dict}."""
    req = urllib.request.Request(
        URL,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Referer":    "https://barttorvik.com/",
            "Accept":     "application/json, */*",
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = json.loads(resp.read())
    except Exception as exc:
        print(f"ERROR fetching Torvik: {exc}", file=sys.stderr)
        sys.exit(1)

    out = {}
    for entry in raw:
        if not isinstance(entry, list) or len(entry) < len(FIELDS):
            continue
        row = {FIELDS[i]: entry[i] for i in range(len(FIELDS))}
        # Compute AdjEM (net efficiency margin)
        try:
            row["adj_em"] = round(float(row["adj_oe"]) - float(row["adj_de"]), 2)
        except (TypeError, ValueError):
            row["adj_em"] = None
        out[row["team"]] = row
    print(f"  Torvik: {len(out)} teams fetched")
    return out


def fetch_shooting_splits() -> dict:
    """
    Aggregate per-game box scores from getgamestats to compute team shooting splits.
    Returns {torvik_team_name: {two_p, three_p, ft_pct, efg}}.
    Box score format: [date, espn_id, team_a, team_b, fgm, fga, 3pm, 3pa, ftm, fta, ...]
    team_a stats start at index 4, team_b stats start at index 19.
    """
    req = urllib.request.Request(
        URL_GAMES,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Referer":    "https://barttorvik.com/",
            "Accept":     "application/json, */*",
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            rows = json.loads(resp.read())
    except Exception as exc:
        print(f"WARNING: Could not fetch game stats for shooting splits: {exc}", file=sys.stderr)
        return {}

    accum = {}  # team_name -> {fgm, fga, pm3, pa3, ftm, fta}
    for row in rows:
        try:
            box = json.loads(row[29])
        except (IndexError, json.JSONDecodeError, TypeError):
            continue
        if len(box) < 25:
            continue
        for team_name, offset in [(box[2], 4), (box[3], 19)]:
            if not team_name:
                continue
            a = accum.setdefault(team_name, [0,0,0,0,0,0])
            a[0] += box[offset]     # fgm
            a[1] += box[offset+1]   # fga
            a[2] += box[offset+2]   # 3pm
            a[3] += box[offset+3]   # 3pa
            a[4] += box[offset+4]   # ftm
            a[5] += box[offset+5]   # fta

    out = {}
    for team, (fgm, fga, pm3, pa3, ftm, fta) in accum.items():
        p2m = fgm - pm3
        p2a = fga - pa3
        out[team] = {
            "two_p":   round(p2m / p2a * 100, 1) if p2a else None,
            "three_p": round(pm3 / pa3 * 100, 1) if pa3 else None,
            "ft_pct":  round(ftm / fta * 100, 1) if fta else None,
            "efg":     round((fgm + 0.5 * pm3) / fga * 100, 1) if fga else None,
        }
    print(f"  Shooting splits: {len(out)} teams computed")
    return out
    path = DATA_DIR / "bracket_teams.json"
    if not path.exists():
        print(f"ERROR: {path} not found — run fetch_data.py first", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def load_bracket() -> list:
    path = DATA_DIR / "bracket_teams.json"
    if not path.exists():
        print(f"ERROR: {path} not found — run fetch_data.py first", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def merge(bracket: list, torvik: dict, splits: dict) -> dict:
    """
    Merge Torvik stats into bracket team records.
    Returns {espn_id: {bracket metadata + torvik stats}}.
    """
    # Build reverse map: bracket_name -> torvik_name
    name_to_torvik = {v: k for k, v in TORVIK_NAME_MAP.items()}

    result   = {}
    matched  = 0
    no_match = []

    for team in bracket:
        espn_id = team["espn_id"]
        bname   = team["bracket_name"]

        # Try direct match, then mapped name
        torvik_name = name_to_torvik.get(bname, bname)
        stats = torvik.get(torvik_name)

        if stats is None:
            no_match.append(bname)
            result[espn_id] = {
                "espn_id":      espn_id,
                "bracket_name": bname,
                "display_name": team["displayName"],
                "region":       team["region"],
                "seed":         team["seed"],
                "torvik":       None,
            }
        else:
            matched += 1
            result[espn_id] = {
                "espn_id":      espn_id,
                "bracket_name": bname,
                "display_name": team["displayName"],
                "region":       team["region"],
                "seed":         team["seed"],
                "torvik": {
                    "rank":          stats["rank"],
                    "record":        stats["record"],
                    "adj_oe":        round(float(stats["adj_oe"]), 1),
                    "adj_de":        round(float(stats["adj_de"]), 1),
                    "adj_em":        stats["adj_em"],
                    "barthag":       round(float(stats["barthag"]), 4),
                    "adj_tempo":     round(float(stats["adj_tempo"]), 2) if stats["adj_tempo"] else None,
                    "luck":          round(float(stats["luck"]), 3),
                    "wab":           round(float(stats["wab"]), 1),
                    "proj_barthag":  round(float(stats["proj_barthag"]), 4),
                    "sos_rank":      stats["sos_rank"],
                    "conf":          stats["conf"],
                    "two_p":         splits.get(torvik_name, {}).get("two_p"),
                    "three_p":       splits.get(torvik_name, {}).get("three_p"),
                    "ft_pct":        splits.get(torvik_name, {}).get("ft_pct"),
                    "efg":           splits.get(torvik_name, {}).get("efg"),
                },
            }

    print(f"  Matched: {matched}/{len(bracket)}")
    if no_match:
        print(f"  No match: {no_match}", file=sys.stderr)

    return result


def main():
    print(f"Fetching Torvik T-Rank stats for {YEAR}...")
    torvik  = fetch_torvik()
    splits  = fetch_shooting_splits()
    bracket = load_bracket()
    merged  = merge(bracket, torvik, splits)

    output = {
        "season":       YEAR,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "teams":        merged,
        "top_10": sorted(
            [v for v in merged.values() if v["torvik"]],
            key=lambda x: x["torvik"]["rank"]
        )[:10],
    }

    for dest in [DATA_DIR / "torvik_stats.json", PUB_DIR / "torvik_stats.json"]:
        dest.write_text(json.dumps(output, indent=2))

    print(f"  Wrote data/torvik_stats.json and public/data/torvik_stats.json")
    print(f"  Top 5 by T-Rank:")
    for t in output["top_10"][:5]:
        tv = t["torvik"]
        print(f"    #{tv['rank']:2}  {t['bracket_name']:20}  AdjEM={tv['adj_em']:+.1f}  "
              f"AdjOE={tv['adj_oe']}  AdjDE={tv['adj_de']}  barthag={tv['barthag']}")


if __name__ == "__main__":
    main()
