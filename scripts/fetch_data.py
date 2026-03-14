#!/usr/bin/env python3
"""
fetch_data.py — pulls 2025-26 regular season + conference tournament schedules
for all 64 bracket teams from the ESPN hidden API.

Writes: data/graph_data.json, data/inter_games.json, data/recent_form.json,
        data/bracket_teams.json, public/data/graph_data.json,
        public/data/recent_form.json

Run manually:   python scripts/fetch_data.py
Auto-refresh:   GitHub Actions workflow (.github/workflows/refresh.yml)
"""

import json
import os
import subprocess
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

# ── paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

# ── 68 bracket teams (2026 Selection Sunday field) ───────────────────────────
BRACKET_TEAMS = [
    # East — Washington DC / Greenville / St. Louis pods
    {"bracket_name": "Duke",          "espn_id": "150",   "displayName": "Duke Blue Devils",           "region": "East",    "seed": 1},
    {"bracket_name": "UMBC",          "espn_id": "2378",  "displayName": "UMBC Retrievers",            "region": "East",    "seed": 16},
    {"bracket_name": "Georgia",       "espn_id": "61",    "displayName": "Georgia Bulldogs",           "region": "East",    "seed": 8},
    {"bracket_name": "TCU",           "espn_id": "2628",  "displayName": "TCU Horned Frogs",           "region": "East",    "seed": 9},
    {"bracket_name": "Wisconsin",     "espn_id": "275",   "displayName": "Wisconsin Badgers",          "region": "East",    "seed": 5},
    {"bracket_name": "High Point",    "espn_id": "2272",  "displayName": "High Point Panthers",        "region": "East",    "seed": 12},
    {"bracket_name": "Vanderbilt",    "espn_id": "238",   "displayName": "Vanderbilt Commodores",      "region": "East",    "seed": 4},
    {"bracket_name": "N Dakota St",   "espn_id": "2449",  "displayName": "North Dakota State Bison",   "region": "East",    "seed": 13},
    {"bracket_name": "Louisville",    "espn_id": "97",    "displayName": "Louisville Cardinals",       "region": "East",    "seed": 6},
    {"bracket_name": "Miami OH",      "espn_id": "193",   "displayName": "Miami (OH) RedHawks",        "region": "East",    "seed": 11},
    {"bracket_name": "Missouri",      "espn_id": "142",   "displayName": "Missouri Tigers",            "region": "East",    "seed": 11, "first_four": True},
    {"bracket_name": "Illinois",      "espn_id": "356",   "displayName": "Illinois Fighting Illini",   "region": "East",    "seed": 3},
    {"bracket_name": "Wright St",     "espn_id": "2750",  "displayName": "Wright State Raiders",       "region": "East",    "seed": 14},
    {"bracket_name": "Kentucky",      "espn_id": "96",    "displayName": "Kentucky Wildcats",          "region": "East",    "seed": 7},
    {"bracket_name": "Santa Clara",   "espn_id": "2541",  "displayName": "Santa Clara Broncos",        "region": "East",    "seed": 10},
    {"bracket_name": "Iowa State",    "espn_id": "66",    "displayName": "Iowa State Cyclones",        "region": "East",    "seed": 2},
    {"bracket_name": "Furman",        "espn_id": "231",   "displayName": "Furman Paladins",            "region": "East",    "seed": 15},
    # South — Houston / Tampa / San Diego / Oklahoma City pods
    {"bracket_name": "Florida",       "espn_id": "57",    "displayName": "Florida Gators",             "region": "South",   "seed": 1},
    {"bracket_name": "Louisiana Tech","espn_id": "2348",  "displayName": "Louisiana Tech Bulldogs",    "region": "South",   "seed": 16},
    {"bracket_name": "Southern",      "espn_id": "2582",  "displayName": "Southern Jaguars",           "region": "South",   "seed": 16, "first_four": True},
    {"bracket_name": "Ohio State",    "espn_id": "194",   "displayName": "Ohio State Buckeyes",        "region": "South",   "seed": 8},
    {"bracket_name": "Villanova",     "espn_id": "222",   "displayName": "Villanova Wildcats",         "region": "South",   "seed": 9},
    {"bracket_name": "Texas Tech",    "espn_id": "2641",  "displayName": "Texas Tech Red Raiders",     "region": "South",   "seed": 5},
    {"bracket_name": "Yale",          "espn_id": "43",    "displayName": "Yale Bulldogs",              "region": "South",   "seed": 12},
    {"bracket_name": "Virginia",      "espn_id": "258",   "displayName": "Virginia Cavaliers",         "region": "South",   "seed": 4},
    {"bracket_name": "Utah Valley",   "espn_id": "3084",  "displayName": "Utah Valley Wolverines",     "region": "South",   "seed": 13},
    {"bracket_name": "Tennessee",     "espn_id": "2633",  "displayName": "Tennessee Volunteers",       "region": "South",   "seed": 6},
    {"bracket_name": "VCU",           "espn_id": "2670",  "displayName": "VCU Rams",                   "region": "South",   "seed": 11},
    {"bracket_name": "Purdue",        "espn_id": "2509",  "displayName": "Purdue Boilermakers",        "region": "South",   "seed": 3},
    {"bracket_name": "Troy",          "espn_id": "2653",  "displayName": "Troy Trojans",               "region": "South",   "seed": 14},
    {"bracket_name": "UCLA",          "espn_id": "26",    "displayName": "UCLA Bruins",                "region": "South",   "seed": 7},
    {"bracket_name": "Texas A&M",     "espn_id": "245",   "displayName": "Texas A&M Aggies",           "region": "South",   "seed": 10},
    {"bracket_name": "Houston",       "espn_id": "248",   "displayName": "Houston Cougars",            "region": "South",   "seed": 2},
    {"bracket_name": "Long Island",   "espn_id": "112358","displayName": "Long Island University",     "region": "South",   "seed": 15},
    # Midwest — Chicago / Buffalo / Philadelphia / Oklahoma City pods
    {"bracket_name": "Michigan",      "espn_id": "130",   "displayName": "Michigan Wolverines",        "region": "Midwest", "seed": 1},
    {"bracket_name": "Idaho",         "espn_id": "70",    "displayName": "Idaho Vandals",              "region": "Midwest", "seed": 16},
    {"bracket_name": "Lehigh",        "espn_id": "2329",  "displayName": "Lehigh Mountain Hawks",      "region": "Midwest", "seed": 16, "first_four": True},
    {"bracket_name": "Clemson",       "espn_id": "228",   "displayName": "Clemson Tigers",             "region": "Midwest", "seed": 8},
    {"bracket_name": "Saint Louis",   "espn_id": "139",   "displayName": "Saint Louis Billikens",      "region": "Midwest", "seed": 9},
    {"bracket_name": "Arkansas",      "espn_id": "8",     "displayName": "Arkansas Razorbacks",        "region": "Midwest", "seed": 5},
    {"bracket_name": "Akron",         "espn_id": "2006",  "displayName": "Akron Zips",                 "region": "Midwest", "seed": 12},
    {"bracket_name": "Kansas",        "espn_id": "2305",  "displayName": "Kansas Jayhawks",            "region": "Midwest", "seed": 4},
    {"bracket_name": "Northern Iowa", "espn_id": "2460",  "displayName": "Northern Iowa Panthers",     "region": "Midwest", "seed": 13},
    {"bracket_name": "North Carolina","espn_id": "153",   "displayName": "North Carolina Tar Heels",   "region": "Midwest", "seed": 6},
    {"bracket_name": "South Florida", "espn_id": "58",    "displayName": "South Florida Bulls",        "region": "Midwest", "seed": 11},
    {"bracket_name": "Nebraska",      "espn_id": "158",   "displayName": "Nebraska Cornhuskers",       "region": "Midwest", "seed": 3},
    {"bracket_name": "Tennessee St",  "espn_id": "2634",  "displayName": "Tennessee State Tigers",     "region": "Midwest", "seed": 14},
    {"bracket_name": "Saint Mary's",  "espn_id": "2608",  "displayName": "Saint Mary's Gaels",         "region": "Midwest", "seed": 7},
    {"bracket_name": "NC State",      "espn_id": "152",   "displayName": "NC State Wolfpack",          "region": "Midwest", "seed": 10},
    {"bracket_name": "UConn",         "espn_id": "41",    "displayName": "UConn Huskies",              "region": "Midwest", "seed": 2},
    {"bracket_name": "Queens",        "espn_id": "2511",  "displayName": "Queens University Royals",   "region": "Midwest", "seed": 15},
    # West — San Jose / San Diego / Tampa / Portland / Buffalo pods
    {"bracket_name": "Arizona",       "espn_id": "12",    "displayName": "Arizona Wildcats",           "region": "West",    "seed": 1},
    {"bracket_name": "Howard",        "espn_id": "47",    "displayName": "Howard Bison",               "region": "West",    "seed": 16},
    {"bracket_name": "Utah State",    "espn_id": "328",   "displayName": "Utah State Aggies",          "region": "West",    "seed": 8},
    {"bracket_name": "Iowa",          "espn_id": "2294",  "displayName": "Iowa Hawkeyes",              "region": "West",    "seed": 9},
    {"bracket_name": "St John's",     "espn_id": "2599",  "displayName": "St. John's Red Storm",       "region": "West",    "seed": 5},
    {"bracket_name": "McNeese",       "espn_id": "2377",  "displayName": "McNeese Cowboys",            "region": "West",    "seed": 12},
    {"bracket_name": "Alabama",       "espn_id": "333",   "displayName": "Alabama Crimson Tide",       "region": "West",    "seed": 4},
    {"bracket_name": "Hofstra",       "espn_id": "2275",  "displayName": "Hofstra Pride",              "region": "West",    "seed": 13},
    {"bracket_name": "BYU",           "espn_id": "252",   "displayName": "BYU Cougars",                "region": "West",    "seed": 6},
    {"bracket_name": "SMU",           "espn_id": "2567",  "displayName": "SMU Mustangs",               "region": "West",    "seed": 11, "first_four": True},
    {"bracket_name": "Texas",         "espn_id": "251",   "displayName": "Texas Longhorns",            "region": "West",    "seed": 11, "first_four": True},
    {"bracket_name": "Gonzaga",       "espn_id": "2250",  "displayName": "Gonzaga Bulldogs",           "region": "West",    "seed": 3},
    {"bracket_name": "UC Irvine",     "espn_id": "300",   "displayName": "UC Irvine Anteaters",        "region": "West",    "seed": 14},
    {"bracket_name": "Miami",         "espn_id": "2390",  "displayName": "Miami Hurricanes",           "region": "West",    "seed": 7},
    {"bracket_name": "UCF",           "espn_id": "2116",  "displayName": "UCF Knights",                "region": "West",    "seed": 10},
    {"bracket_name": "Michigan St",   "espn_id": "127",   "displayName": "Michigan State Spartans",    "region": "West",    "seed": 2},
    {"bracket_name": "Siena",         "espn_id": "2561",  "displayName": "Siena Saints",               "region": "West",    "seed": 15},
]

# ── Bubble teams (First Four Out + Next Four Out only — others already in bracket) ──
BUBBLE_TEAMS = [
    # First Four Out
    {"bracket_name": "Oklahoma",    "espn_id": "201",  "displayName": "Oklahoma Sooners",       "region": "bubble", "seed": None},
    {"bracket_name": "Auburn",      "espn_id": "2",    "displayName": "Auburn Tigers",          "region": "bubble", "seed": None},
    {"bracket_name": "Indiana",     "espn_id": "84",   "displayName": "Indiana Hoosiers",       "region": "bubble", "seed": None},
    {"bracket_name": "New Mexico",  "espn_id": "167",  "displayName": "New Mexico Lobos",       "region": "bubble", "seed": None},
    # Next Four Out
    {"bracket_name": "San Diego St","espn_id": "21",   "displayName": "San Diego State Aztecs", "region": "bubble", "seed": None},
    {"bracket_name": "Stanford",    "espn_id": "24",   "displayName": "Stanford Cardinal",      "region": "bubble", "seed": None},
    {"bracket_name": "Cincinnati",  "espn_id": "2132", "displayName": "Cincinnati Bearcats",    "region": "bubble", "seed": None},
    {"bracket_name": "Seton Hall",  "espn_id": "2550", "displayName": "Seton Hall Pirates",     "region": "bubble", "seed": None},
]

ALL_TEAMS = BRACKET_TEAMS + BUBBLE_TEAMS

REGION_COLORS = {
    "East":    "#3B82F6",
    "West":    "#10B981",
    "South":   "#F59E0B",
    "Midwest": "#EF4444",
    "bubble":  "#8B5CF6",
}


def fetch(url: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            import urllib.request
            with urllib.request.urlopen(url, timeout=10) as resp:
                return json.loads(resp.read())
        except Exception as exc:
            if attempt == retries - 1:
                print(f"  WARN: failed to fetch {url} — {exc}", file=sys.stderr)
                return {}
            time.sleep(1)
    return {}


def extract_score(raw) -> str:
    if isinstance(raw, dict):
        return raw.get("displayValue", "")
    return str(raw) if raw is not None else ""


def fetch_all_games() -> tuple[list, list]:
    bracket_ids = {t["espn_id"] for t in ALL_TEAMS}
    all_games: dict[str, dict] = {}

    for i, team in enumerate(ALL_TEAMS):
        tid = team["espn_id"]
        url = (
            f"https://site.api.espn.com/apis/site/v2/sports/basketball"
            f"/mens-college-basketball/teams/{tid}/schedule?season=2026"
        )
        data = fetch(url)
        # seasonType 2 = regular season, 3 = postseason (conf tournaments)
        # NCAA tournament (also type 3) doesn't start until March 20, after Selection Sunday
        # So including type 3 now captures conf tourney inter-bracket games safely
        reg = [e for e in data.get("events", []) if e.get("seasonType", {}).get("type") in (2, 3)]

        for e in reg:
            gid = e["id"]
            if gid in all_games:
                continue
            comp = e["competitions"][0] if e.get("competitions") else {}
            if not comp.get("status", {}).get("type", {}).get("completed"):
                continue
            competitors = comp.get("competitors", [])
            if len(competitors) < 2:
                continue
            t1, t2 = competitors[0], competitors[1]
            all_games[gid] = {
                "id":           gid,
                "date":         e["date"][:10],
                "name":         e["name"],
                "team1_id":     t1["id"],
                "team1_name":   t1["team"]["displayName"],
                "team1_score":  extract_score(t1.get("score")),
                "team1_winner": t1.get("winner", False),
                "team2_id":     t2["id"],
                "team2_name":   t2["team"]["displayName"],
                "team2_score":  extract_score(t2.get("score")),
                "team2_winner": t2.get("winner", False),
                "neutral":      comp.get("neutralSite", False),
                "venue":        comp.get("venue", {}).get("fullName", ""),
            }

        print(f"  [{i+1:2}/{len(ALL_TEAMS)}] {team['bracket_name']:20} {len(reg)} reg-season games")
        time.sleep(0.08)

    all_list = list(all_games.values())
    inter = [g for g in all_list if g["team1_id"] in bracket_ids and g["team2_id"] in bracket_ids]
    return all_list, inter


def build_graph(inter_games: list) -> dict:
    bracket_map = {t["espn_id"]: t for t in ALL_TEAMS}

    # Per-team win/loss counts vs bracket field
    wins_count: dict[str, int] = {}
    loss_count: dict[str, int] = {}
    for g in inter_games:
        if g["team1_winner"]:
            wins_count[g["team1_id"]] = wins_count.get(g["team1_id"], 0) + 1
            loss_count[g["team2_id"]] = loss_count.get(g["team2_id"], 0) + 1
        elif g["team2_winner"]:
            wins_count[g["team2_id"]] = wins_count.get(g["team2_id"], 0) + 1
            loss_count[g["team1_id"]] = loss_count.get(g["team1_id"], 0) + 1

    nodes = []
    for t in ALL_TEAMS:
        tid = t["espn_id"]
        w = wins_count.get(tid, 0)
        l = loss_count.get(tid, 0)
        color = REGION_COLORS.get(t["region"], "#6B7280")
        nodes.append({
            "id":               tid,
            "label":            t["bracket_name"],
            "full_name":        t["displayName"],
            "region":           t["region"],
            "seed":             t["seed"],
            "wins_vs_field":    w,
            "losses_vs_field":  l,
            "size":             8 + w * 1.5,
            "color": {
                "background": color,
                "border": "#1e293b",
                "highlight": {"background": "#FFD700", "border": "#FFA500"},
            },
            "font": {"color": "#f1f5f9", "size": 10},
            "title": f"{t['displayName']}<br>Seed: {t['seed']} | {t['region']}<br>W-L vs bracket field: {w}-{l}",
        })

    edges = []
    for g in inter_games:
        if g["team1_winner"]:
            wid, lid, ws, ls = g["team1_id"], g["team2_id"], g["team1_score"], g["team2_score"]
        elif g["team2_winner"]:
            wid, lid, ws, ls = g["team2_id"], g["team1_id"], g["team2_score"], g["team1_score"]
        else:
            continue

        try:
            margin = abs(int(float(ws)) - int(float(ls)))
        except ValueError:
            margin = 0

        r1 = bracket_map.get(wid, {}).get("region", "")
        r2 = bracket_map.get(lid, {}).get("region", "")
        same = r1 == r2
        edge_color = REGION_COLORS.get(r1, "#94a3b8") if same else "#94a3b8"

        edges.append({
            "from":          wid,
            "to":            lid,
            "label":         f"{ws}-{ls}",
            "title":         f"{g['name']}<br>{g['date']}<br>Score: {ws}-{ls}<br>{'Same region' if same else 'Cross-region'}<br>Margin: {margin} pts",
            "color":         {"color": edge_color, "highlight": "#FFD700", "opacity": 0.7},
            "width":         1 + margin // 15,
            "arrows":        "to",
            "same_region":   same,
            "winner_region": r1,
            "date":          g["date"],
            "margin":        margin,
            "game_id":       g["id"],
        })

    # Not-played pairs
    played = {tuple(sorted([g["team1_id"], g["team2_id"]])) for g in inter_games}
    all_ids = [t["espn_id"] for t in ALL_TEAMS]
    not_played = [
        {"a": a, "b": b,
         "a_name": bracket_map[a]["bracket_name"],
         "b_name": bracket_map[b]["bracket_name"]}
        for i, a in enumerate(all_ids)
        for b in all_ids[i + 1:]
        if tuple(sorted([a, b])) not in played
    ]

    bracket_meta = {
        t["espn_id"]: {"bracket_name": t["bracket_name"], "region": t["region"], "seed": t["seed"]}
        for t in ALL_TEAMS
    }

    rematches = sum(1 for cnt in Counter(
        tuple(sorted([g["team1_id"], g["team2_id"]])) for g in inter_games
    ).values() if cnt > 1)

    return {
        "nodes":       nodes,
        "edges":       edges,
        "not_played":  not_played,
        "bracket_map": bracket_meta,
        "meta": {
            "total_games":    len(inter_games),
            "rematches":      rematches,
            "not_played_cnt": len(not_played),
            "season":         "2025-26",
            "generated_at":   __import__("datetime").datetime.utcnow().isoformat() + "Z",
        },
    }


def build_recent_form(all_games):
    """Compute last-10-game form for each bracket team from full game log."""
    from collections import defaultdict
    bracket_ids = {str(t["espn_id"]) for t in ALL_TEAMS}
    team_games  = defaultdict(list)

    for g in all_games:
        t1, t2 = str(g["team1_id"]), str(g["team2_id"])
        if t1 in bracket_ids:
            team_games[t1].append({
                "date": g["date"], "won": g["team1_winner"],
                "score": f"{g['team1_score']}-{g['team2_score']}",
                "opp": g["team2_name"], "opp_id": t2,
            })
        if t2 in bracket_ids:
            team_games[t2].append({
                "date": g["date"], "won": g["team2_winner"],
                "score": f"{g['team2_score']}-{g['team1_score']}",
                "opp": g["team1_name"], "opp_id": t1,
            })

    recent_form = {}
    for tid in bracket_ids:
        games  = sorted(team_games[tid], key=lambda g: g["date"])
        last10 = games[-10:]
        wins   = sum(1 for g in last10 if g["won"])
        streak = ""
        if last10:
            cur = "W" if last10[-1]["won"] else "L"
            n   = 0
            for g in reversed(last10):
                if ("W" if g["won"] else "L") == cur:
                    n += 1
                else:
                    break
            streak = f"{cur}{n}"
        recent_form[tid] = {
            "games":       last10,
            "last10":      f"{wins}-{len(last10) - wins}",
            "streak":      streak,
            "total_games": len(games),
        }
    return recent_form

def main():
    print("Fetching ESPN schedules for 64 bracket teams...")
    all_games, inter_games = fetch_all_games()

    print(f"\nTotal completed games:    {len(all_games)}")
    print(f"Inter-bracket matchups:   {len(inter_games)}")

    graph       = build_graph(inter_games)
    recent_form = build_recent_form(all_games)

    # Wrap recent_form with metadata so the UI can show a freshness timestamp
    recent_form_out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "teams": recent_form,
    }

    (DATA_DIR / "graph_data.json").write_text(json.dumps(graph, indent=2))
    (DATA_DIR / "inter_games.json").write_text(json.dumps(inter_games, indent=2))
    (DATA_DIR / "bracket_teams.json").write_text(json.dumps(BRACKET_TEAMS, indent=2))
    (DATA_DIR / "recent_form.json").write_text(json.dumps(recent_form_out, separators=(",", ":")))

    pub = DATA_DIR.parent / "public" / "data"
    pub.mkdir(parents=True, exist_ok=True)
    (pub / "recent_form.json").write_text(json.dumps(recent_form_out, separators=(",", ":")))

    print(f"Nodes: {len(graph['nodes'])}, Edges: {len(graph['edges'])}, Not-played: {len(graph['not_played'])}")
    print(f"\nWrote:\n  data/graph_data.json\n  data/inter_games.json\n  data/bracket_teams.json\n  data/recent_form.json")


if __name__ == "__main__":
    main()
