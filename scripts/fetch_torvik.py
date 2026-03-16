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

from datetime import datetime as _dt
_month = _dt.now().month
YEAR = _dt.now().year + 1 if _month >= 10 else _dt.now().year
URL  = f"https://barttorvik.com/{YEAR}_team_results.json"
URL_GAMES = f"https://barttorvik.com/getgamestats.php?year={YEAR}&json=1"

# Torvik name -> our bracket_name mapping for names that don't match exactly
TORVIK_NAME_MAP = {
    "Ohio St.":            "Ohio State",
    "Iowa St.":            "Iowa State",
    "Michigan St.":        "Michigan St",
    "N.C. State":          "NC State",
    "Connecticut":         "UConn",
    "Wright St.":          "Wright St",
    "Utah St.":            "Utah State",
    "Portland St.":        "Portland State",
    "North Dakota St.":    "N Dakota St",
    "North Carolina A&T":  "NC A&T",
    "LIU":                 "Long Island",
    "Stephen F. Austin":   "SFA",
    "Mississippi":          "Ole Miss",
    "McNeese St.":          "McNeese",
    "Bethune Cookman":      "Bethune-Cookman",
    "Penn St.":             "Penn State",
    "Oklahoma St.":         "Oklahoma State",
    "St. John's":           "St John's",
    "Tennessee St.":        "Tennessee St",
    "Miami FL":             "Miami",
    "San Diego St.":        "San Diego St",
    "Kennesaw St.":         "Kennesaw St",
    "Prairie View A&M":     "Prairie View",
    "Cal Baptist":          "CA Baptist",
    "Hawaii":               "Hawai'i",
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
        with urllib.request.urlopen(req, timeout=90) as resp:
            rows = json.loads(resp.read())
    except Exception as exc:
        print(f"WARNING: Could not fetch game stats for shooting splits: {exc}", file=sys.stderr)
        print(f"  Shooting splits will be unavailable this run.", file=sys.stderr)
        return {}

    # Accumulate: [fgm, fga, pm3, pa3, ftm, fta, oreb, dreb, tov, opp_oreb, opp_dreb, opp_fga, opp_fta, games]
    accum = {}
    for row in rows:
        try:
            box = json.loads(row[29])
        except (IndexError, json.JSONDecodeError, TypeError):
            continue
        if len(box) < 34:
            continue
        # box offsets: team_a=4, team_b=19
        # [offset+0]=FGM [+1]=FGA [+2]=3PM [+3]=3PA [+4]=FTM [+5]=FTA
        # [+6]=OREB [+7]=DREB [+8]=REB [+9]=AST [+10]=TO [+11]=STL [+12]=BLK [+13]=PF [+14]=PTS
        for (team_name, offset, opp_offset) in [(box[2], 4, 19), (box[3], 19, 4)]:
            if not team_name:
                continue
            try:
                a = accum.setdefault(team_name, [0]*14)
                a[0]  += box[offset]       # fgm
                a[1]  += box[offset+1]     # fga
                a[2]  += box[offset+2]     # 3pm
                a[3]  += box[offset+3]     # 3pa
                a[4]  += box[offset+4]     # ftm
                a[5]  += box[offset+5]     # fta
                a[6]  += box[offset+6]     # oreb
                a[7]  += box[offset+7]     # dreb
                a[8]  += box[offset+10]    # tov (TO is at +10)
                a[9]  += box[opp_offset+6] # opp oreb (for dreb% calc)
                a[10] += box[opp_offset+7] # opp dreb
                a[11] += box[opp_offset+1] # opp fga
                a[12] += box[opp_offset+5] # opp fta
                a[13] += 1                 # games
            except (IndexError, TypeError):
                continue

    out = {}
    for team, a in accum.items():
        fgm, fga, pm3, pa3, ftm, fta, oreb, dreb, tov, opp_oreb, opp_dreb, opp_fga, opp_fta, games = a
        p2m = fgm - pm3
        p2a = fga - pa3
        # TOV rate = TOV / (FGA + 0.44*FTA + TOV) -- Dean Oliver formula
        poss = fga + 0.44 * fta + tov
        # ORB rate = OREB / (OREB + opp_DREB)
        orb_denom = oreb + opp_dreb
        # FTR = FTA / FGA
        # 3PA rate = 3PA / FGA
        out[team] = {
            "two_p":        round(p2m / p2a * 100, 1) if p2a else None,
            "three_p":      round(pm3 / pa3 * 100, 1) if pa3 else None,
            "ft_pct":       round(ftm / fta * 100, 1) if fta else None,
            "efg":          round((fgm + 0.5 * pm3) / fga * 100, 1) if fga else None,
            "tov_rate":     round(tov / poss * 100, 1) if poss else None,
            "orb_rate":     round(oreb / orb_denom * 100, 1) if orb_denom else None,
            "ftr":          round(fta / fga * 100, 1) if fga else None,
            "three_pa_rate": round(pa3 / fga * 100, 1) if fga else None,
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
        bracket = json.load(f)

    # Also include bubble teams from bracket_config.json so they get Torvik stats
    cfg_path = DATA_DIR / "bracket_config.json"
    if cfg_path.exists():
        with open(cfg_path) as f:
            cfg = json.load(f)
        bubble = cfg.get("bubble", [])
        bracket_ids = {str(t["espn_id"]) for t in bracket}
        for t in bubble:
            if str(t["espn_id"]) not in bracket_ids:
                bracket.append(t)

    return bracket


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
                    "tov_rate":      splits.get(torvik_name, {}).get("tov_rate"),
                    "orb_rate":      splits.get(torvik_name, {}).get("orb_rate"),
                    "ftr":           splits.get(torvik_name, {}).get("ftr"),
                    "three_pa_rate": splits.get(torvik_name, {}).get("three_pa_rate"),
                    "efg_d":         round(float(stats["f_adj_de"]), 4) if stats.get("f_adj_de") else None,
                    "recent_win_pct": round(float(stats["exp"]), 3) if stats.get("exp") else None,
                    "recent_margin":  round(float(stats["avg_poss"]), 1) if stats.get("avg_poss") else None,
                    "quad1_record":   stats.get("conf_record"),
                    "net_rank":       int(stats["ncaa_seed"]) if stats.get("ncaa_seed") else None,
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

    # ── Build opp_barthag.json: ESPN_ID -> barthag for non-bracket opponents ──
    # Used by bracket.js quality-weighted decay to weight wins by opponent strength
    import re as _re

    def _strip_mascot(s):
        s = s.lower().strip()
        words = s.split()
        for n in [3, 2, 1]:
            if len(words) <= n:
                continue
            school = " ".join(words[:-n])
            if school in torvik_by_lower:
                return school
        return s

    def _torvik_variants(name):
        n = name.lower()
        yield n
        yield n.replace("state", "st.")
        yield n.replace("state", "st")
        yield n.replace("st.", "state")
        yield n.replace(" & ", " and ")
        yield _re.sub(r"\bnorth ", "n. ", n)
        yield _re.sub(r"\bsouth ", "s. ", n)

    # Build full torvik name -> barthag map
    # Re-fetch raw Torvik JSON for the full team list (all 365 teams, not just bracket)
    try:
        _req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(_req, timeout=20) as _resp:
            _raw = json.loads(_resp.read())
        torvik_by_lower = {row[1].lower(): float(row[8]) for row in _raw if len(row) > 8}
    except Exception:
        torvik_by_lower = {}

    # Load all game participants
    all_games_path = DATA_DIR / "all_games.json"
    opp_barthag = {}
    if all_games_path.exists():
        all_games_data = json.loads(all_games_path.read_text())
        bracket_id_set = {str(t["espn_id"]) for t in bracket}
        id_to_display  = {}
        for g in all_games_data:
            id_to_display[g["team1_id"]] = g["team1_name"]
            id_to_display[g["team2_id"]] = g["team2_name"]

        for espn_id, display_name in id_to_display.items():
            if espn_id in bracket_id_set:
                continue
            school = _strip_mascot(display_name)
            for variant in _torvik_variants(school):
                if variant in torvik_by_lower:
                    opp_barthag[espn_id] = round(torvik_by_lower[variant], 4)
                    break

    (DATA_DIR / "opp_barthag.json").write_text(
        json.dumps({"generated": datetime.now(timezone.utc).isoformat(), "opp_barthag": opp_barthag},
                   separators=(",", ":"))
    )
    print(f"  Wrote data/opp_barthag.json ({len(opp_barthag)} non-bracket opponent mappings)")
    print(f"  Top 5 by T-Rank:")
    for t in output["top_10"][:5]:
        tv = t["torvik"]
        print(f"    #{tv['rank']:2}  {t['bracket_name']:20}  AdjEM={tv['adj_em']:+.1f}  "
              f"AdjOE={tv['adj_oe']}  AdjDE={tv['adj_de']}  barthag={tv['barthag']}")


if __name__ == "__main__":
    main()
