#!/usr/bin/env python3
"""
fetch_odds.py — pulls betting odds, BPI predictions, and futures from ESPN's
hidden API for all bracket team tournament games.

Three ESPN endpoints (no API key required):
  1. pickcenter in game summary  — spread, O/U, moneylines, opening line
  2. sports.core predictor       — BPI win probability (bakes in travel/rest/site)
  3. sports.core futures         — regional and championship outright odds

Writes:
  data/espn_odds.json
  public/data/espn_odds.json

Run manually:   python scripts/fetch_odds.py
Auto-refresh:   GitHub Actions (refresh.yml) — runs after fetch_data.py
"""

import json
import sys
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

ROOT     = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PUB_DIR  = ROOT / "public" / "data"
DATA_DIR.mkdir(exist_ok=True)
PUB_DIR.mkdir(parents=True, exist_ok=True)

SITE_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball"
CORE_BASE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball"


def fetch(url: str, retries: int = 3) -> dict:
    import urllib.request
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url, timeout=12) as resp:
                return json.loads(resp.read())
        except Exception as exc:
            if attempt == retries - 1:
                print(f"  WARN: failed {url} — {exc}", file=sys.stderr)
                return {}
            time.sleep(1.5)
    return {}


def american_to_implied_prob(american: int) -> float:
    """Convert American moneyline to implied win probability (0-100)."""
    if american is None:
        return None
    try:
        a = int(american)
        if a > 0:
            return round(100 / (a + 100) * 100, 1)
        else:
            return round(abs(a) / (abs(a) + 100) * 100, 1)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def load_bracket_config() -> tuple[list, dict]:
    cfg_path = DATA_DIR / "bracket_config.json"
    if not cfg_path.exists():
        print("ERROR: data/bracket_config.json not found", file=sys.stderr)
        sys.exit(1)
    cfg = json.loads(cfg_path.read_text())
    teams = cfg["bracket"]
    # Build espn_id → bracket_name lookup
    id_to_name = {t["espn_id"]: t["bracket_name"] for t in teams}
    return teams, id_to_name


def fetch_tournament_game_ids(teams: list) -> list[dict]:
    """
    Fetch all NCAA tournament game IDs for bracket teams.
    seasonType 3 = postseason (covers conf tourney + NCAA tournament).
    We filter to games from March 17+ (First Four start) to capture only
    NCAA tournament games.
    """
    from datetime import datetime as _dt

    # NCAA tournament starts March 17, 2026 (First Four)
    # Tournament start: third Thursday of March in current year
    _yr = datetime.now().year
    _d  = datetime(year=_yr, month=3, day=1)
    _thursdays = 0
    while _d.month == 3:
        if _d.weekday() == 3:  # Thursday
            _thursdays += 1
        if _thursdays == 3:
            break
        _d += __import__("datetime").timedelta(days=1)
    TOURNEY_START = _d.strftime("%Y-%m-%d")

    team_ids = {t["espn_id"] for t in teams}
    seen_ids: set[str] = set()
    games: list[dict] = []

    # Pull schedule for each bracket team, season type 3 (postseason)
    for team in teams:
        tid = team["espn_id"]
        url = (
            f"https://site.api.espn.com/apis/site/v2/sports/basketball"
            f"/mens-college-basketball/teams/{tid}/schedule?season={datetime.now().year}&seasontype=3"
        )
        data = fetch(url)
        for e in data.get("events", []):
            gid = e.get("id", "")
            if not gid or gid in seen_ids:
                continue
            date = e.get("date", "")[:10]
            if date < TOURNEY_START:
                continue
            comp = (e.get("competitions") or [{}])[0]
            competitors = comp.get("competitors", [])
            if len(competitors) < 2:
                continue

            t1, t2 = competitors[0], competitors[1]
            t1_id, t2_id = str(t1.get("id", "")), str(t2.get("id", ""))

            # Include game if either team is in our bracket
            if t1_id not in team_ids and t2_id not in team_ids:
                continue

            seen_ids.add(gid)
            completed = comp.get("status", {}).get("type", {}).get("completed", False)

            games.append({
                "game_id":    gid,
                "date":       date,
                "name":       e.get("name", ""),
                "home_id":    t1_id if t1.get("homeAway") == "home" else t2_id,
                "away_id":    t1_id if t1.get("homeAway") == "away" else t2_id,
                "home_name":  t1["team"]["displayName"] if t1.get("homeAway") == "home" else t2["team"]["displayName"],
                "away_name":  t1["team"]["displayName"] if t1.get("homeAway") == "away" else t2["team"]["displayName"],
                "completed":  completed,
                "neutral":    comp.get("neutralSite", False),
            })

        time.sleep(0.08)

    # Sort by date
    games.sort(key=lambda g: g["date"])
    return games


def fetch_game_odds(game_id: str) -> Optional[dict]:
    """
    Pull DraftKings spread + moneyline + O/U for a game.
    Uses sports.core.api.espn.com odds endpoint (richer than pickcenter).
    Falls back to pickcenter in summary endpoint.
    """
    # Primary: sports.core odds endpoint
    url = f"{CORE_BASE}/events/{game_id}/competitions/{game_id}/odds"
    data = fetch(url)

    items = data.get("items", [])
    if not items:
        # Fallback: pickcenter in summary
        summary_url = f"{SITE_BASE}/summary?event={game_id}&region=us&lang=en&contentorigin=espn"
        summary = fetch(summary_url)
        pc = summary.get("pickcenter", [])
        if not pc:
            return None
        item = pc[0]
        home_odds = item.get("homeTeamOdds", {})
        away_odds = item.get("awayTeamOdds", {})
        return {
            "source":           "pickcenter",
            "provider":         item.get("provider", {}).get("name", ""),
            "spread":           item.get("spread"),
            "over_under":       item.get("overUnder"),
            "over_odds":        item.get("overOdds"),
            "under_odds":       item.get("underOdds"),
            "home_moneyline":   home_odds.get("moneyLine"),
            "away_moneyline":   away_odds.get("moneyLine"),
            "home_implied_pct": american_to_implied_prob(home_odds.get("moneyLine")),
            "away_implied_pct": american_to_implied_prob(away_odds.get("moneyLine")),
            "open_home_ml":     None,
            "open_away_ml":     None,
            "line_movement":    None,
        }

    item = items[0]
    home_odds = item.get("homeTeamOdds", {})
    away_odds = item.get("awayTeamOdds", {})

    # Opening line
    open_home = home_odds.get("open", {}).get("moneyLine", {}).get("american")
    open_away = away_odds.get("open", {}).get("moneyLine", {}).get("american")

    # Current moneyline
    cur_home_ml = home_odds.get("moneyLine")
    cur_away_ml = away_odds.get("moneyLine")

    # Line movement: positive = home team got more expensive since open
    # (sharp money moved toward home), negative = money moved toward away
    movement = None
    if open_home is not None and cur_home_ml is not None:
        try:
            open_p  = american_to_implied_prob(int(str(open_home).replace("+", "")))
            close_p = american_to_implied_prob(int(str(cur_home_ml).replace("+", "")))
            if open_p is not None and close_p is not None:
                movement = round(close_p - open_p, 1)
        except (ValueError, TypeError):
            pass

    return {
        "source":           "core_odds",
        "provider":         item.get("provider", {}).get("name", ""),
        "spread":           item.get("spread"),
        "over_under":       item.get("overUnder"),
        "over_odds":        item.get("overOdds"),
        "under_odds":       item.get("underOdds"),
        "home_moneyline":   cur_home_ml,
        "away_moneyline":   cur_away_ml,
        "home_implied_pct": american_to_implied_prob(cur_home_ml),
        "away_implied_pct": american_to_implied_prob(cur_away_ml),
        "open_home_ml":     open_home,
        "open_away_ml":     open_away,
        "line_movement":    movement,   # pts of implied prob shift toward home since open
    }


def fetch_bpi(game_id: str) -> Optional[dict]:
    """
    Pull ESPN BPI predictor for a game.
    Returns win probability, predicted margin, matchup quality.
    BPI already bakes in: opponent strength, pace, site, travel distance,
    day's rest, altitude. Updates daily.
    """
    url = f"{CORE_BASE}/events/{game_id}/competitions/{game_id}/predictor"
    data = fetch(url)

    if not data or "homeTeam" not in data:
        return None

    def get_stat(team_data: dict, name: str) -> Optional[float]:
        for s in team_data.get("statistics", []):
            if s.get("name") == name:
                v = s.get("value")
                return float(v) if v is not None else None
        return None

    home = data.get("homeTeam", {})
    away = data.get("awayTeam", {})

    home_win_pct = get_stat(home, "teampredwinpct")
    away_win_pct = get_stat(away, "teampredwinpct")
    matchup_q    = get_stat(home, "matchupquality")
    pred_margin  = get_stat(home, "teampredmov")

    if home_win_pct is None:
        return None

    return {
        "home_bpi_win_pct":  round(home_win_pct, 1) if home_win_pct is not None else None,
        "away_bpi_win_pct":  round(away_win_pct, 1) if away_win_pct is not None else None,
        "bpi_pred_margin":   round(pred_margin, 1)  if pred_margin  is not None else None,
        "matchup_quality":   round(matchup_q,   1)  if matchup_q    is not None else None,
        "last_modified":     data.get("lastModified", ""),
    }


def fetch_futures(id_to_name: dict) -> dict:
    """
    Pull regional and national championship futures from ESPN.
    Returns per-team odds keyed by bracket_name (lowercase).
    """
    url = f"{CORE_BASE}/seasons/{datetime.now().year}/futures"
    data = fetch(url)

    result: dict[str, dict] = {}

    for market in data.get("items", []):
        market_name = market.get("displayName", "")
        # Detect market type
        if "championship" in market_name.lower() or "national" in market_name.lower():
            market_type = "championship"
        elif "region" in market_name.lower():
            # Extract region name: "NCAA(B) - West Region" → "West"
            parts = market_name.split("-")
            region_raw = parts[-1].strip().replace("Region", "").strip() if len(parts) > 1 else market_name
            market_type = f"region_{region_raw.lower()}"
        else:
            market_type = market_name.lower().replace(" ", "_")

        for book_entry in market.get("futures", []):
            for book in book_entry.get("books", []):
                # Resolve ESPN team ID from $ref
                team_ref  = book.get("team", {}).get("$ref", "")
                ml_str    = book.get("value", "")

                # Extract ESPN team ID from ref URL
                # e.g. ".../seasons/2026/teams/12?lang=en&region=us"
                espn_id = None
                if "/teams/" in team_ref:
                    try:
                        after_teams = team_ref.split("/teams/")[1]
                        espn_id     = after_teams.split("?")[0].strip()
                    except IndexError:
                        pass

                if not espn_id or espn_id not in id_to_name:
                    continue

                team_key = id_to_name[espn_id].lower()
                implied  = american_to_implied_prob(int(ml_str.replace("+", ""))) if ml_str else None

                if team_key not in result:
                    result[team_key] = {"espn_id": espn_id, "markets": {}}
                result[team_key]["markets"][market_type] = {
                    "moneyline":    ml_str,
                    "implied_pct":  implied,
                }

    return result


def main():
    print("Loading bracket config...")
    teams, id_to_name = load_bracket_config()
    print(f"  {len(teams)} bracket teams")

    print("\nFetching NCAA tournament game IDs...")
    games = fetch_tournament_game_ids(teams)
    print(f"  Found {len(games)} tournament games")

    games_out: dict[str, dict] = {}
    for i, game in enumerate(games):
        gid  = game["game_id"]
        name = game["name"]
        print(f"  [{i+1:2}/{len(games)}] {name}")

        # Fetch odds and BPI in sequence (same game, avoid hammering in parallel)
        odds = fetch_game_odds(gid)
        bpi  = fetch_bpi(gid)
        time.sleep(0.15)

        games_out[gid] = {
            **game,
            "odds": odds,
            "bpi":  bpi,
        }

    print("\nFetching futures (regional + championship outright odds)...")
    futures = fetch_futures(id_to_name)
    print(f"  Got futures for {len(futures)} teams")

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "games":        games_out,
        "futures":      futures,
    }

    (DATA_DIR / "espn_odds.json").write_text(json.dumps(output, indent=2))
    (PUB_DIR  / "espn_odds.json").write_text(json.dumps(output, separators=(",", ":")))

    print(f"\nWrote:")
    print(f"  data/espn_odds.json      ({len(games_out)} games, {len(futures)} futures teams)")
    print(f"  public/data/espn_odds.json")


if __name__ == "__main__":
    main()
