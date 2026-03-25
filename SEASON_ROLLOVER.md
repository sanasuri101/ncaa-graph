# Season Rollover Checklist

Run these steps after Selection Sunday each year (~third Sunday of March).

## One-time setup (takes ~15 minutes)

### 1. Rebuild bracket config
```bash
python scripts/make_bracket_config.py
# Review data/bracket_config.json — confirm 68 teams, regions, seeds
```

### 2. Clear injury overrides
```bash
echo '{"overrides":{}}' > data/injury_overrides.json
# Rebuild manually as injuries are confirmed pre-tournament
```

### 3. Update year in frontend files (2 files, ~30 seconds)
```
public/index.html  — 4 occurrences of the year (title, brand-year, splash-title, loading-text)
public/app.js      — 1 occurrence ("2026 NCAA Bracket" header)
```

### 4. Confirm tournament start date propagates
The `tourney_start` field in `graph_data.json` is computed automatically by `fetch_data.py`
as the third Thursday of March. After running the first data refresh post-Selection Sunday,
verify `data/graph_data.json` meta contains the correct `tourney_start` date.

## What updates automatically (no action needed)
- `fetch_data.py` — season year computed from current date
- `fetch_torvik.py` — YEAR computed from current date  
- `fetch_odds.py` — season year computed from current date
- `fetch_rosters.py` — season year computed from current date
- `api/ai.js` — "Today is..." now dynamic (America/New_York)
- `api/ai.js` — tournament date filter reads from `graph_data.json` meta
- `api/bracket.js` — same tournament date filter

## Daily refresh (GitHub Actions — no action needed)
Runs at 6am UTC and 6pm UTC:
- ESPN game results → alive team set updated automatically
- Torvik efficiency stats → AdjEM, four factors, Barthag current
- ESPN odds + BPI → moneylines, spreads current  
- Injury news → ESPN headlines current
- Roster stats → player PPG/RPG current
- Transitive analysis → recomputed from fresh game data

## What still requires human judgment
- `injury_overrides.json` — AdjEM penalties require judgment call
  (e.g. "Foster out for season = -4 AdjEM" is a human estimate, not computable)
- Bracket config verification — confirm seeds/regions match official bracket
