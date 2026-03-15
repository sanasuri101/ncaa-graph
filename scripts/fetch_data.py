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

# ── Load bracket field from config (updated once per year after Selection Sunday) ──
# Edit data/bracket_config.json after Selection Sunday each year.
# Run scripts/make_bracket_config.py to scaffold next year's config automatically.
_config_path = ROOT / "data" / "bracket_config.json"
if not _config_path.exists():
    print("ERROR: data/bracket_config.json not found.", file=sys.stderr)
    print("  Run: python scripts/make_bracket_config.py", file=sys.stderr)
    sys.exit(1)

with open(_config_path) as _f:
    _cfg = json.load(_f)

BRACKET_TEAMS = _cfg["bracket"]
BUBBLE_TEAMS  = _cfg.get("bubble", [])
ALL_TEAMS     = BRACKET_TEAMS + BUBBLE_TEAMS

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


from datetime import datetime as _now_dt
_m = _now_dt.now().month
season_year = _now_dt.now().year + 1 if _m >= 10 else _now_dt.now().year

def fetch_all_games() -> tuple[list, list]:
    bracket_ids = {t["espn_id"] for t in ALL_TEAMS}
    all_games: dict[str, dict] = {}

    for i, team in enumerate(ALL_TEAMS):
        tid = team["espn_id"]
        url = (
            f"https://site.api.espn.com/apis/site/v2/sports/basketball"
            f"/mens-college-basketball/teams/{tid}/schedule?season={season_year}"
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
            "season":         f"{season_year-1}-{str(season_year)[2:]}",
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

    # Keep not_played in graph for app — do NOT pop it before writing public/data
    not_played_data = graph["not_played"]
    not_played_out  = {"not_played": not_played_data}

    # Write data/ files (full copies for reference)
    (DATA_DIR / "graph_data.json").write_text(json.dumps(graph, separators=(",", ":")))
    (DATA_DIR / "not_played.json").write_text(json.dumps(not_played_out, separators=(",", ":")))
    (DATA_DIR / "inter_games.json").write_text(json.dumps(inter_games, indent=2))
    (DATA_DIR / "all_games.json").write_text(json.dumps(all_games, indent=2))
    (DATA_DIR / "bracket_teams.json").write_text(json.dumps(BRACKET_TEAMS, indent=2))
    (DATA_DIR / "recent_form.json").write_text(json.dumps(recent_form_out, separators=(",", ":")))

    pub = DATA_DIR.parent / "public" / "data"
    pub.mkdir(parents=True, exist_ok=True)
    # Write graph_data to public — strip a_name/b_name from not_played (not used by app, saves ~110KB)
    pub_graph = dict(graph)
    pub_graph["not_played"] = [{"a": x["a"], "b": x["b"]} for x in graph["not_played"]]
    (pub / "graph_data.json").write_text(json.dumps(pub_graph, separators=(",", ":")))
    (pub / "recent_form.json").write_text(json.dumps(recent_form_out, separators=(",", ":")))
    (pub / "not_played.json").write_text(json.dumps(not_played_out, separators=(",", ":")))

    print(f"Nodes: {len(graph['nodes'])}, Edges: {len(graph['edges'])}, Not-played: {len(not_played_data)}")
    print(f"\nWrote:\n  data/graph_data.json\n  data/not_played.json\n  data/inter_games.json\n  data/all_games.json\n  data/bracket_teams.json\n  data/recent_form.json")


if __name__ == "__main__":
    main()
