#!/usr/bin/env python3
"""
project_field.py — daily projection of the NCAA tournament field.

Reads every completed D1 game of the season from the ESPN scoreboard, rates all
D1 teams, and projects the 64-team field:
  - auto bids:  the top-rated team in each conference
  - at-large:   the best remaining teams until the field has 64
  - seeds:      1-16 by rating, placed into regions on an S-curve

Rating = average game value adjusted for opponent strength and home court (an
SRS), from this season's games only. A game's value blends two numbers:
  - the closing point spread (60%): what the betting market expected, which
    already knows about rosters, injuries and opponent quality
  - the actual scoring margin, capped (40%): what happened
Each team is also pulled toward its conference's average, worth one game.
On the first weeks of the 2024-25 and 2025-26 seasons this matched the final
top 25 for 17-18 teams, against 12-13 for margins alone.

Writes: data/bracket_config.json   (consumed by every other script)
        data/leaderboard.json, public/data/leaderboard.json
        data/spreads.json          (closing spread per game, fetched once each)

Run first in the refresh pipeline. Once the real bracket is committed for the
season (make_bracket_config.py, after Selection Sunday) this script leaves
bracket_config.json alone.
"""

import json
import sys
import time
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT     = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PUB_DIR  = ROOT / "public" / "data"
ESPN     = "https://site.api.espn.com/apis"
ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball"
SPORT    = "sports/basketball/mens-college-basketball"

FIELD_SIZE   = 64
BUBBLE_SIZE  = 8
BOARD_SIZE   = 100
REGIONS      = ["East", "West", "South", "Midwest"]
HOME_COURT   = 3.5    # points
MARGIN_CAP   = 25     # blowouts beyond this add no information
SPREAD_WEIGHT = 0.6   # share of a game's value taken from the closing spread
CONF_GAMES   = 1      # pull toward conference average, worth this many games

_today = date.today()
SEASON = _today.year + 1 if _today.month >= 10 else _today.year


def get(url: str) -> dict:
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=20) as resp:
                return json.loads(resp.read())
        except Exception as exc:
            if attempt == 3:
                sys.exit(f"ERROR: {url} — {exc}")
            time.sleep(2 * (attempt + 1))


def d1_teams(season: int) -> dict:
    """{espn_id: {name, short, conf}} for every D1 team, from conference standings."""
    data = get(f"{ESPN}/v2/{SPORT}/standings?season={season}")
    teams = {}
    for conf in data["children"]:
        for entry in conf["standings"]["entries"]:
            t = entry["team"]
            teams[t["id"]] = {
                "name":  t["displayName"],
                "short": t["shortDisplayName"],
                "location": t["location"],
                "conf":  conf["name"].replace(" Conference", ""),
            }
    return teams


def fetch_games(season: int, teams: dict, last_day: date) -> list:
    """Completed games between two D1 teams:
    {event_id: (home_id, away_id, home_pts, away_pts, neutral)}."""
    games = {}
    day = date(season - 1, 11, 1)
    while day <= last_day:
        data = get(f"{ESPN}/site/v2/{SPORT}/scoreboard?dates={day:%Y%m%d}&groups=50&limit=500")
        for event in data.get("events", []):
            comp = event["competitions"][0]
            if not comp["status"]["type"]["completed"]:
                continue
            sides = {c["homeAway"]: c for c in comp["competitors"]}
            home, away = sides["home"], sides["away"]
            if home["id"] not in teams or away["id"] not in teams:
                continue
            games[event["id"]] = (home["id"], away["id"], int(home["score"]),
                                  int(away["score"]), comp.get("neutralSite", False))
        day += timedelta(days=1)
        time.sleep(0.05)
    return games


def fetch_spreads(game_ids) -> dict:
    """{event_id: closing spread for the home team (negative = favored), or None}.
    A finished game's spread never changes, so each is fetched once and cached."""
    path = DATA_DIR / "spreads.json"
    cached = json.loads(path.read_text()) if path.exists() else {}
    if cached.get("season") != SEASON:
        cached = {"season": SEASON, "spreads": {}}
    spreads = cached["spreads"]

    def one(gid):
        try:
            url = f"{ESPN_CORE}/events/{gid}/competitions/{gid}/odds"
            with urllib.request.urlopen(url, timeout=20) as resp:
                items = json.loads(resp.read()).get("items") or [{}]
            return gid, items[0].get("spread")
        except Exception:
            return gid, "retry"            # not cached: tried again on the next run

    missing = [gid for gid in game_ids if gid not in spreads]
    with ThreadPoolExecutor(8) as pool:
        for gid, spread in pool.map(one, missing):
            if spread != "retry":
                spreads[gid] = spread
    path.write_text(json.dumps(cached, separators=(",", ":")))
    return spreads


def rate(games: dict, spreads: dict, teams: dict) -> tuple[dict, dict]:
    """Returns ({id: rating}, {id: [wins, losses]})."""
    results = defaultdict(list)          # id -> [(opponent, game value)]
    record  = {tid: [0, 0] for tid in teams}
    for gid, (home, away, hp, ap, neutral) in games.items():
        court  = 0 if neutral else HOME_COURT
        margin = max(-MARGIN_CAP, min(MARGIN_CAP, hp - ap - court))
        spread = spreads.get(gid)
        if spread is not None:
            margin = SPREAD_WEIGHT * (-spread - court) + (1 - SPREAD_WEIGHT) * margin
        results[home].append((away, margin))
        results[away].append((home, -margin))
        winner, loser = (home, away) if hp > ap else (away, home)
        record[winner][0] += 1
        record[loser][1] += 1

    members = defaultdict(list)
    for tid, t in teams.items():
        members[t["conf"]].append(tid)

    ratings = {tid: 0.0 for tid in teams}
    for _ in range(400):
        conf_avg = {c: sum(ratings[t] for t in ts) / len(ts) for c, ts in members.items()}
        new = {
            tid: (sum(m + ratings[opp] for opp, m in results[tid])
                  + CONF_GAMES * conf_avg[teams[tid]["conf"]])
                 / (len(results[tid]) + CONF_GAMES)
            for tid in teams
        }
        mean = sum(new.values()) / len(new)   # keep the D1 average at zero
        ratings = {tid: 0.5 * ratings[tid] + 0.5 * (r - mean) for tid, r in new.items()}
    return ratings, record


def project(teams: dict, ratings: dict) -> tuple[list, list, set]:
    """Returns (field, bubble, auto-bid ids); field and bubble are best first."""
    ranked = sorted(teams, key=lambda tid: -ratings[tid])
    auto, seen_confs = set(), set()
    for tid in ranked:
        if teams[tid]["conf"] not in seen_confs:
            seen_confs.add(teams[tid]["conf"])
            auto.add(tid)
    at_large = [tid for tid in ranked if tid not in auto]
    n_at_large = FIELD_SIZE - len(auto)
    field = sorted(auto | set(at_large[:n_at_large]), key=lambda tid: -ratings[tid])
    return field, at_large[n_at_large:n_at_large + BUBBLE_SIZE], auto


def main():
    config_path = DATA_DIR / "bracket_config.json"
    config = json.loads(config_path.read_text()) if config_path.exists() else {}
    if config.get("_season") == SEASON and not config.get("_projected"):
        print(f"Real {SEASON} bracket is committed — projection skipped.")
        return

    teams = d1_teams(SEASON)
    games = fetch_games(SEASON, teams, _today)
    spreads = fetch_spreads(games)
    ratings, record = rate(games, spreads, teams)
    field, bubble, auto = project(teams, ratings)
    with_line = sum(1 for gid in games if spreads.get(gid) is not None)
    print(f"{len(teams)} teams, {len(games)} games ({with_line} with a spread), {len(auto)} auto bids")

    def entry(tid, region, seed):
        return {"bracket_name": teams[tid]["short"], "espn_id": tid,
                "displayName": teams[tid]["name"], "location": teams[tid]["location"],
                "region": region, "seed": seed}

    bracket = []
    for i, tid in enumerate(field):
        line, slot = divmod(i, 4)
        region = REGIONS[slot] if line % 2 == 0 else REGIONS[3 - slot]   # S-curve
        bracket.append(entry(tid, region, line + 1))

    season_str = f"{SEASON - 1}-{str(SEASON)[2:]}"
    config_path.write_text(json.dumps({
        "_comment": "Projected field, rewritten daily by scripts/project_field.py. "
                    "After Selection Sunday run scripts/make_bracket_config.py to replace it "
                    "with the real bracket.",
        "_season": SEASON,
        "_season_str": season_str,
        "_projected": True,
        "_last_updated": f"{_today}",
        "bracket": bracket,
        "bubble": [entry(tid, "bubble", None) for tid in bubble],
    }, indent=2))

    # Leaderboard — keep yesterday's rank so the app can show movement
    board_path = DATA_DIR / "leaderboard.json"
    prev_rank = {}
    if board_path.exists():
        old = json.loads(board_path.read_text())
        if old.get("season") == SEASON:
            same_day = old.get("date") == f"{_today}"
            prev_rank = {t["espn_id"]: t["prev_rank" if same_day else "rank"] for t in old["teams"]}

    placed = {t["espn_id"]: t for t in bracket}
    ranked = sorted(teams, key=lambda tid: -ratings[tid])
    # Top of the rankings, plus auto-bid teams ranked below the cut
    shown = ranked[:BOARD_SIZE] + [tid for tid in ranked[BOARD_SIZE:] if tid in placed]
    board = [{
        "rank": ranked.index(tid) + 1, "prev_rank": prev_rank.get(tid),
        "espn_id": tid, "name": teams[tid]["short"], "conf": teams[tid]["conf"],
        "record": "{}-{}".format(*record[tid]), "rating": round(ratings[tid], 1),
        "status": ("auto" if tid in auto else "at-large" if tid in placed
                   else "bubble" if tid in bubble else "out"),
        "seed": placed.get(tid, {}).get("seed"), "region": placed.get(tid, {}).get("region"),
    } for tid in shown]

    out = json.dumps({
        "season": SEASON, "season_str": season_str, "date": f"{_today}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "games_counted": len(games), "teams": board,
    }, separators=(",", ":"))
    PUB_DIR.mkdir(parents=True, exist_ok=True)
    board_path.write_text(out)
    (PUB_DIR / "leaderboard.json").write_text(out)

    print("Top 10:")
    for t in board[:10]:
        print(f"  {t['rank']:2}  {t['name']:18} {t['record']:6} {t['rating']:+.1f}  {t['conf']}")


if __name__ == "__main__":
    main()
