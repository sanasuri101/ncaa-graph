#!/usr/bin/env python3
"""
project_field.py — daily projection of the NCAA tournament field.

Reads every completed D1 game of the season from the ESPN scoreboard, rates all
D1 teams, and projects the 64-team field:
  - auto bids:  the top-rated team in each conference
  - at-large:   the best remaining teams until the field has 64
  - seeds:      1-16, placed into regions on an S-curve

At-large picks and seeds use a selection score that copies the committee. Over
14 tournaments (2011-2026) it chose about 70% on results achieved and 30% on
team quality; "wins above bubble" plus rating reproduced 92.5% of its at-large
picks, against 83% for rating alone. Early in the season a resume is mostly
noise (on past seasons it made the projection worse before January), so the
resume share starts at zero and grows to its full weight by Selection Sunday.

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
        data/torvik_stats.json     (efficiency and shooting stats, via team_stats.py)

Run first in the refresh pipeline. Once the real bracket is committed for the
season (make_bracket_config.py, after Selection Sunday) this script leaves
bracket_config.json alone but keeps the ratings in leaderboard.json current,
since the bracket view reads them.
"""

import json
import math
import sys
import time
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import team_stats

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
BUBBLE_RANK  = 45     # "bubble team" = the rating of the 45th-best team
GAME_SD      = 11.0   # spread of a game's margin around its expected value, points
RESUME_MAX   = 0.6    # resume share of the selection score on Selection Sunday
RESUME_START = 65     # days after Nov 1 when the resume starts to count (early January)
RESUME_FULL  = 134    # ... and when it reaches RESUME_MAX (mid-March)

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


def wins_above_bubble(games: dict, ratings: dict) -> dict:
    """Wins minus the wins a bubble team would expect against the same schedule."""
    bubble = sorted(ratings.values(), reverse=True)[BUBBLE_RANK - 1]
    win_prob = lambda edge: 0.5 * (1 + math.erf(edge / GAME_SD / math.sqrt(2)))
    wab = {tid: 0.0 for tid in ratings}
    for home, away, hp, ap, neutral in games.values():
        court = 0 if neutral else HOME_COURT
        wab[home] += (hp > ap) - win_prob(bubble - ratings[away] + court)
        wab[away] += (ap > hp) - win_prob(bubble - ratings[home] - court)
    return wab


def selection_score(ratings: dict, wab: dict) -> tuple[dict, float]:
    """Blend of rating and resume, each in standard deviations across D1.
    Returns ({id: score}, resume share used today)."""
    def standardize(values):
        mean = sum(values.values()) / len(values)
        sd = (sum((v - mean) ** 2 for v in values.values()) / len(values)) ** 0.5 or 1.0
        return {tid: (v - mean) / sd for tid, v in values.items()}
    day = (_today - date(SEASON - 1, 11, 1)).days
    share = RESUME_MAX * min(1.0, max(0.0, (day - RESUME_START) / (RESUME_FULL - RESUME_START)))
    z_rating, z_wab = standardize(ratings), standardize(wab)
    return {tid: (1 - share) * z_rating[tid] + share * z_wab[tid] for tid in ratings}, share


def project(teams: dict, ratings: dict, score: dict) -> tuple[list, list, set]:
    """Returns (field, bubble, auto-bid ids); field and bubble are best first."""
    auto, seen_confs = set(), set()
    for tid in sorted(teams, key=lambda tid: -ratings[tid]):
        if teams[tid]["conf"] not in seen_confs:
            seen_confs.add(teams[tid]["conf"])
            auto.add(tid)
    at_large = sorted((tid for tid in teams if tid not in auto), key=lambda tid: -score[tid])
    n_at_large = FIELD_SIZE - len(auto)
    field = sorted(auto | set(at_large[:n_at_large]), key=lambda tid: -score[tid])
    return field, at_large[n_at_large:n_at_large + BUBBLE_SIZE], auto


def main():
    config_path = DATA_DIR / "bracket_config.json"
    config = json.loads(config_path.read_text()) if config_path.exists() else {}
    real_bracket = config.get("_season") == SEASON and not config.get("_projected")

    teams = d1_teams(SEASON)
    games = fetch_games(SEASON, teams, _today)
    spreads = fetch_spreads(games)
    ratings, record = rate(games, spreads, teams)
    wab = wins_above_bubble(games, ratings)
    score, resume_share = selection_score(ratings, wab)
    with_line = sum(1 for gid in games if spreads.get(gid) is not None)
    print(f"{len(teams)} teams, {len(games)} games ({with_line} with a spread)")
    season_str = f"{SEASON - 1}-{str(SEASON)[2:]}"

    if real_bracket:
        print(f"Real {SEASON} bracket is committed — ratings updated, field left alone.")
        bracket = config["bracket"]
        bubble_entries = config.get("bubble", [])
        bubble  = [t["espn_id"] for t in bubble_entries]
        auto    = set()
    else:
        field, bubble, auto = project(teams, ratings, score)

        def entry(tid, region, seed):
            return {"bracket_name": teams[tid]["short"], "espn_id": tid,
                    "displayName": teams[tid]["name"], "location": teams[tid]["location"],
                    "region": region, "seed": seed}

        bracket = []
        for i, tid in enumerate(field):
            line, slot = divmod(i, 4)
            region = REGIONS[slot] if line % 2 == 0 else REGIONS[3 - slot]   # S-curve
            bracket.append(entry(tid, region, line + 1))
        bubble_entries = [entry(tid, "bubble", None) for tid in bubble]

        config_path.write_text(json.dumps({
            "_comment": "Projected field, rewritten daily by scripts/project_field.py. "
                        "After Selection Sunday run scripts/make_bracket_config.py to replace it "
                        "with the real bracket.",
            "_season": SEASON,
            "_season_str": season_str,
            "_projected": True,
            "_last_updated": f"{_today}",
            "bracket": bracket,
            "bubble": bubble_entries,
        }, indent=2))

    # Efficiency and shooting stats for the field, from box scores
    boxes = team_stats.fetch_box_scores(games, SEASON)
    schedule = defaultdict(list)
    for home, away, *_ in games.values():
        schedule[home].append(away)
        schedule[away].append(home)
    team_stats.write(bracket + bubble_entries, team_stats.compute(games, boxes, teams, ratings),
                     teams, ratings, record, wab, schedule, SEASON)
    print(f"Box scores: {sum(1 for gid in games if gid in boxes)} of {len(games)} games")

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
    shown = [tid for tid in ranked if ranked.index(tid) < BOARD_SIZE or tid in placed or tid in bubble]
    board = [{
        "rank": ranked.index(tid) + 1, "prev_rank": prev_rank.get(tid),
        "espn_id": tid, "name": teams[tid]["short"], "conf": teams[tid]["conf"],
        "record": "{}-{}".format(*record[tid]), "rating": round(ratings[tid], 1),
        "wab": round(wab[tid], 1),
        "status": ("auto" if tid in auto else "at-large" if tid in placed
                   else "bubble" if tid in bubble else "out"),   # after Selection Sunday every field team reads "at-large"
        "seed": placed.get(tid, {}).get("seed"), "region": placed.get(tid, {}).get("region"),
    } for tid in shown]

    out = json.dumps({
        "season": SEASON, "season_str": season_str, "date": f"{_today}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "games_counted": len(games), "resume_share": round(resume_share, 2), "teams": board,
    }, separators=(",", ":"))
    PUB_DIR.mkdir(parents=True, exist_ok=True)
    board_path.write_text(out)
    (PUB_DIR / "leaderboard.json").write_text(out)

    print("Top 10:")
    for t in board[:10]:
        print(f"  {t['rank']:2}  {t['name']:18} {t['record']:6} {t['rating']:+.1f}  {t['conf']}")


if __name__ == "__main__":
    main()
