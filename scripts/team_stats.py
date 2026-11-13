#!/usr/bin/env python3
"""
team_stats.py — efficiency and shooting stats for every D1 team, from ESPN box scores.

Called by project_field.py; not run on its own. It replaces the stats that used
to come from barttorvik.com, which refuses requests from GitHub's servers, so
the numbers stay current in the daily job.

For each game it reads the team box score (cached forever in data/boxscores.json,
one request per game) and derives:
  - possessions, offensive and defensive efficiency (points per 100 possessions),
    adjusted for opponent and home court the way KenPom/Torvik do it. The overall
    margin is then set to the team's rating from project_field.py (which also
    uses point spreads and is the better-tested number), so the box scores decide
    only how that strength splits between offense and defense, and the app shows
    one consistent measure of how good a team is.
  - the four factors on offense and defense, shooting splits, tempo, luck

Writes data/torvik_stats.json (+ public copy) and data/opp_barthag.json. The
file name and its "torvik" key are kept because the app reads them everywhere;
the "source" field says where the numbers really come from.
"""

import json
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT     = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PUB_DIR  = ROOT / "public" / "data"
SUMMARY  = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event="

HOME_EDGE   = 1.014   # a home team scores ~1.4% more per possession, and allows ~1.4% less
CONF_GAMES  = 1       # pull toward conference average, worth this many games
PYTH_EXP    = 11.5    # exponent that turns efficiency into a win probability

# Box-score line per team: FGM, FGA, 3PM, 3PA, FTM, FTA, OREB, DREB, TO
PAIRS  = ["fieldGoalsMade-fieldGoalsAttempted",
          "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
          "freeThrowsMade-freeThrowsAttempted"]
SINGLE = ["offensiveRebounds", "defensiveRebounds", "totalTurnovers"]


def fetch_box_scores(games: dict, season: int) -> dict:
    """{event_id: {team_id: [fgm, fga, tpm, tpa, ftm, fta, orb, drb, to]}}"""
    path = DATA_DIR / "boxscores.json"
    cached = json.loads(path.read_text()) if path.exists() else {}
    if cached.get("season") != season:
        cached = {"season": season, "games": {}}
    boxes = cached["games"]

    def one(gid):
        try:
            with urllib.request.urlopen(SUMMARY + gid, timeout=30) as resp:
                teams = json.loads(resp.read())["boxscore"]["teams"]
            out = {}
            for t in teams:
                stats = {s["name"]: s["displayValue"] for s in t["statistics"]}
                line = []
                for name in PAIRS:
                    made, attempted = stats[name].split("-")
                    line += [int(made), int(attempted)]
                line += [int(stats[name]) for name in SINGLE]
                out[t["team"]["id"]] = line
            return gid, out if len(out) == 2 else None
        except Exception:
            return gid, None               # no box score yet: tried again on the next run

    missing = [gid for gid in games if gid not in boxes]
    with ThreadPoolExecutor(8) as pool:
        for gid, box in pool.map(one, missing):
            if box:
                boxes[gid] = box
    path.write_text(json.dumps(cached, separators=(",", ":")))
    return boxes


def compute(games: dict, boxes: dict, teams: dict, ratings: dict) -> dict:
    """{team_id: stats} for every team with at least one box score.
    ratings: {team_id: points better than an average team per game}."""
    tot   = defaultdict(lambda: [0.0] * 22)   # own 9, opponent 9, pts, opp pts, possessions, games
    lines = defaultdict(list)                 # team -> [(opponent, off eff, def eff, court)]
    league_pts = league_poss = 0.0

    for gid, (home, away, hp, ap, neutral) in games.items():
        box = boxes.get(gid)
        if not box or home not in box or away not in box:
            continue
        h, a = box[home], box[away]
        est  = lambda s: s[1] - s[6] + s[8] + 0.475 * s[5]      # FGA - OREB + TO + 0.475*FTA
        poss = (est(h) + est(a)) / 2
        if poss <= 0:
            continue
        league_pts  += hp + ap
        league_poss += 2 * poss
        for team, opp, mine, theirs, pts, opts, court in (
            (home, away, h, a, hp, ap, 0 if neutral else 1),
            (away, home, a, h, ap, hp, 0 if neutral else -1),
        ):
            t = tot[team]
            for i in range(9):
                t[i]     += mine[i]
                t[9 + i] += theirs[i]
            t[18] += pts
            t[19] += opts
            t[20] += poss
            t[21] += 1
            lines[team].append((opp, pts / poss * 100, opts / poss * 100, court))

    if not league_poss:
        return {}
    avg = league_pts / league_poss * 100

    # Opponent- and site-adjusted efficiency, iterated to a fixed point
    members = defaultdict(list)
    for tid in lines:
        members[teams[tid]["conf"]].append(tid)
    adj_oe = {tid: avg for tid in lines}
    adj_de = {tid: avg for tid in lines}
    for _ in range(60):
        conf_oe = {c: sum(adj_oe[t] for t in ts) / len(ts) for c, ts in members.items()}
        conf_de = {c: sum(adj_de[t] for t in ts) / len(ts) for c, ts in members.items()}
        new_oe, new_de = {}, {}
        for tid, gs in lines.items():
            conf = teams[tid]["conf"]
            off = sum(o / HOME_EDGE ** court * avg / adj_de[opp] for opp, o, _, court in gs)
            dfn = sum(d * HOME_EDGE ** court * avg / adj_oe[opp] for opp, _, d, court in gs)
            new_oe[tid] = (off + CONF_GAMES * conf_oe[conf]) / (len(gs) + CONF_GAMES)
            new_de[tid] = (dfn + CONF_GAMES * conf_de[conf]) / (len(gs) + CONF_GAMES)
        adj_oe, adj_de = new_oe, new_de

    # Make the margin agree with the rating (points per game -> per 100 possessions),
    # moving offense and defense by equal amounts so the box-score lean is kept
    pace = league_poss / 2 / sum(t[21] for t in tot.values()) * 2   # possessions per game
    for tid in lines:
        shift = (ratings[tid] * 100 / pace - (adj_oe[tid] - adj_de[tid])) / 2
        adj_oe[tid] += shift
        adj_de[tid] -= shift

    pct  = lambda made, att: round(made / att * 100, 1) if att else None
    rank = {tid: i + 1 for i, tid in enumerate(sorted(ratings, key=lambda t: -ratings[t]))}
    stats = {}
    for tid, t in tot.items():
        fgm, fga, tpm, tpa, ftm, fta, orb, drb, to = t[:9]
        ofgm, ofga, otpm, otpa, oftm, ofta, oorb, odrb, oto = t[9:18]
        pts, opts, poss, n = t[18:]
        wins   = sum(1 for _, o, d, _ in lines[tid] if o > d)
        expect = pts ** PYTH_EXP / (pts ** PYTH_EXP + opts ** PYTH_EXP)
        oe, de = adj_oe[tid], adj_de[tid]
        stats[tid] = {
            "rank":          rank[tid],
            "adj_oe":        round(oe, 1),
            "adj_de":        round(de, 1),
            "adj_em":        round(oe - de, 2),
            "barthag":       round(oe ** PYTH_EXP / (oe ** PYTH_EXP + de ** PYTH_EXP), 4),
            "adj_tempo":     round(poss / n, 2),
            "luck":          round(wins / n - expect, 3),     # wins beyond what the scoring margin implies
            "two_p":         pct(fgm - tpm, fga - tpa),
            "three_p":       pct(tpm, tpa),
            "ft_pct":        pct(ftm, fta),
            "efg":           pct(fgm + 0.5 * tpm, fga),
            "tov_rate":      pct(to, poss),
            "orb_rate":      pct(orb, orb + odrb),
            "ftr":           pct(fta, fga),
            "three_pa_rate": pct(tpa, fga),
            "efg_d":         round((ofgm + 0.5 * otpm) / ofga, 4) if ofga else None,
            "tov_rate_d":    pct(oto, poss),
            "orb_rate_d":    pct(oorb, oorb + drb),
            "ftr_d":         pct(ofta, ofga),
            "three_p_d":     pct(otpm, otpa),
        }
    return stats


def write(entries: list, stats: dict, teams: dict, ratings: dict, record: dict,
          wab: dict, schedule: dict, season: int) -> None:
    """entries: the field and bubble teams from bracket_config (each has espn_id)."""
    def block(tid):
        s = stats.get(tid)
        if not s:
            return None
        opps = schedule.get(tid, [])
        return {
            **s,
            "record":   "{}-{}".format(*record[tid]),
            "conf":     teams[tid]["conf"],
            "wab":      round(wab[tid], 1),
            # average rating of opponents played, in points (higher = harder schedule)
            "sos_rank": round(sum(ratings[o] for o in opps) / len(opps), 2) if opps else None,
            "proj_barthag": None,
        }

    out_teams = {
        t["espn_id"]: {
            "espn_id":      t["espn_id"],
            "bracket_name": t["bracket_name"],
            "display_name": t["displayName"],
            "region":       t["region"],
            "seed":         t["seed"],
            "torvik":       block(t["espn_id"]),
        }
        for t in entries
    }
    output = {
        "season":       season,
        "source":       "ESPN box scores, computed by scripts/team_stats.py",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "teams":        out_teams,
        "top_10":       sorted((v for v in out_teams.values() if v["torvik"]),
                               key=lambda v: v["torvik"]["rank"])[:10],
    }
    PUB_DIR.mkdir(parents=True, exist_ok=True)
    for dest in (DATA_DIR / "torvik_stats.json", PUB_DIR / "torvik_stats.json"):
        dest.write_text(json.dumps(output, indent=2))

    # Strength of every other D1 team, for weighting wins by opponent quality
    field = {t["espn_id"] for t in entries}
    (DATA_DIR / "opp_barthag.json").write_text(json.dumps({
        "generated":   output["generated_at"],
        "opp_barthag": {tid: s["barthag"] for tid, s in stats.items() if tid not in field},
    }, separators=(",", ":")))
