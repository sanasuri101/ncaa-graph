# NCAA Bracket Intelligence

A daily projection of the NCAA men's tournament field, a head-to-head graph of the projected
teams, a bracket simulator and an AI assistant, built on ESPN's public data.

## What it does

| View | What it shows |
|---|---|
| **Field** | Leaderboard of the top 100 teams with rating, wins above bubble, and the projected 64-team field with seeds and regions. Updated twice a day. |
| **Graph** | Every game played between the projected field teams (arrow points winner → loser) and the pairs that have not met. |
| **Bracket** | Simulated bracket. First-round games show the rating edge in points and highlight games where the rating favours the lower seed. |
| **AI Scout** | Chat assistant grounded in the data files. Answers about field teams and the top 100 outside it. |
| **Odds / Rankings / Stats** | Tournament odds once games are scheduled, rankings within the field, per-team stats. |

## How the projection works

`scripts/project_field.py` runs first in the daily refresh.

1. **Rating.** Every completed Division I game this season is read from the ESPN scoreboard. A
   game's value is 60% the closing point spread and 40% the actual margin (capped at 25),
   adjusted for opponent strength and home court. Each team is pulled toward its conference
   average by one game's worth. No data from earlier seasons is used.
2. **Field.** The top-rated team in each conference gets an auto bid. The remaining places go to
   the best teams by a selection score that blends rating with wins above bubble. The résumé
   share is zero until early January and grows to 60% by Selection Sunday.
3. **Seeds and regions.** Seeds 1–16 by selection score, placed on an S-curve.

4. **Team stats.** From each game's ESPN box score: possessions, offensive and defensive
   efficiency, the four factors on both ends, shooting splits, tempo and close-game luck. The
   overall efficiency margin is set to the rating above, so the box scores decide only how a
   team's strength splits between offense and defense.

It writes `data/bracket_config.json` (marked `"_projected": true`), `data/leaderboard.json`,
`data/spreads.json`, `data/boxscores.json` and `data/torvik_stats.json` (the file keeps its old
name; its `source` field says the numbers are computed here). Every other script reads `bracket_config.json`, so the whole app follows
the projection. After Selection Sunday the real bracket replaces it; see `SEASON_ROLLOVER.md`.

### Evidence behind the choices

Measured on past seasons, with models scored on years they had not seen:

- Blending spreads into the rating matched 17–18 of the final top 25 after nine days of a
  season, against 12–13 for margins alone.
- Over 14 tournaments (2011–2026) the committee's at-large picks were reproduced 83% by team
  strength, 90% by wins above bubble, and 92.5% by a 70/30 blend of the two.
- In 215 first-round games between seeds 5–12, the seed picked 55% of winners and the rating
  60%. When they disagreed, the lower seed won 58%.
- Style matchups, three-point reliance, experience, height, late-season form and momentum did
  not predict tournament results beyond the rating, so the simulator has no adjustment for them.

## Repo structure

```
├── public/                 # Static site (index.html, app.js, leaderboard.js, bracket.js, …)
│   └── data/               # JSON the browser loads; rewritten by the refresh job
├── api/                    # Vercel serverless functions
│   ├── bracket.js          #   bracket simulation
│   ├── ai.js, analyze.js   #   AI Scout (Groq, needs GROQ_KEY)
│   └── data.js             #   data access shared by the assistant
├── scripts/                # Python data pipeline (standard library only)
│   ├── project_field.py    #   rating, projected field, leaderboard
│   ├── fetch_data.py       #   games between field teams → graph
│   ├── team_stats.py       #   efficiency and shooting stats from box scores (used by project_field)
│   ├── fetch_odds.py, fetch_injuries.py, fetch_rosters.py, compute_transitive.py
│   └── make_bracket_config.py   # real bracket, after Selection Sunday
├── data/                   # Source data files
├── tests/                  # Integration tests against a frozen snapshot in tests/fixtures
└── .github/workflows/      # refresh.yml (twice daily), test.yml, pages.yml
```

## Running it

```bash
npm install
```

```bash
npm test
```

Refresh the data by hand, in pipeline order:

```bash
python scripts/project_field.py
```

```bash
python scripts/fetch_data.py
```

```bash
python scripts/compute_transitive.py
```

## Deployment

The bracket simulator and AI Scout are serverless functions under `api/`, so the full app runs
on Vercel. Set `GROQ_KEY` in the Vercel project for the assistant. The model defaults to
`openai/gpt-oss-120b`; set `GROQ_MODEL` to change it when Groq retires a model. The GitHub Pages workflow
publishes `public/` only; on Pages the Field, Graph and Stats views work but the bracket
simulator and assistant do not.

## Known limits

- **AI endpoint protection is best-effort.** `/api/ai` and `/api/analyze` only accept requests
  from the app's own origin and limit each IP to 12 a minute (`api/_guard.js`). The counter is
  per server instance, so a determined flood needs a shared store or a spending cap on the
  Groq key.
- **ESPN's API is unofficial.** No key is needed, but it is not a supported interface.
