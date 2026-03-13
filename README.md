# NCAA 2025-26 · Head-to-Head Graph

An interactive Neo4j-style graph of every regular season game played between the 64 teams in the 2026 NCAA Tournament bracket, built from live ESPN API data.

**[Live demo →](https://YOUR_USERNAME.github.io/ncaa-graph)**

---

## What it shows

- **64 bracket teams** as nodes, colored by region (East/West/South/Midwest)
- **264 inter-bracket games** as directed edges (arrow points winner → loser), labeled with the score
- **1,782 pairs** that never played — toggle "Never Met" to see the dashed edges
- Node size scales with wins against the bracket field
- Edge thickness scales with point margin

## Controls

| Control | What it does |
|---|---|
| Played / Never Met / Both | Toggle which edges are visible |
| Region filter | Show only teams + games within a selected region |
| Same Region / Cross Region | Filter edges by whether both teams share a region |
| By Region layout | Snap nodes into four quadrants by region |
| Click a node | See that team's full W-L record vs the bracket field |
| Click an edge | See game score, date, and margin |
| Search box | Jump to any team by name |

## Repo structure

```
├── public/
│   ├── index.html        # App shell
│   ├── style.css         # Styles
│   ├── app.js            # All UI logic
│   └── data/
│       └── graph_data.json   # Pre-built graph (auto-refreshed daily)
├── data/
│   ├── graph_data.json   # Source of truth (same content as public/data/)
│   ├── inter_games.json  # Raw inter-bracket game records
│   └── bracket_teams.json  # 64 teams with ESPN IDs, seeds, regions
├── scripts/
│   └── fetch_data.py     # ESPN API fetcher — run this to refresh
└── .github/
    └── workflows/
        └── refresh.yml   # Daily auto-refresh via GitHub Actions
```

## Deploy to GitHub Pages

1. Fork or clone this repo
2. Go to **Settings → Pages → Source** and set it to `main` branch, `/public` folder
3. Your site goes live at `https://YOUR_USERNAME.github.io/ncaa-graph`

The GitHub Actions workflow refreshes data automatically every morning at 6 AM UTC. You can also trigger it manually from the **Actions** tab.

## Refresh data manually

```bash
python scripts/fetch_data.py
cp data/graph_data.json public/data/graph_data.json
```

No dependencies beyond Python's standard library — the fetcher uses only `urllib.request` and `json`.

## Neo4j Cypher

The repo also includes `data/ncaa_2026.cypher` if you want to load the same data into a Neo4j instance:

```cypher
// All wins vs bracket field, ranked
MATCH (w:Team)-[:BEAT]->(l:Team)
RETURN w.name, count(*) AS wins ORDER BY wins DESC

// All pairs that never played
MATCH (a:Team), (b:Team)
WHERE a.espn_id < b.espn_id AND NOT (a)-[:BEAT]-(b)
RETURN a.name, b.name

// Full game log for a team
MATCH (t:Team {name:"Duke Blue Devils"})-[b:BEAT]->(opp)
RETURN opp.name, b.score, b.date ORDER BY b.date
```

## Data source

All game data is fetched from the [ESPN hidden API](https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b) — specifically the team schedule endpoint:

```
https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/{team_id}/schedule?season=2026
```

No API key required. ESPN does not officially support this endpoint for third-party use — use it responsibly.

## AI Scout panel

Click **AI Scout** in the top-right corner to open the panel. Three modes:

| Mode | What it does |
|---|---|
| **Stats** | Pulls 2025-26 season stats from ESPN for any bracket team (no API key needed) |
| **News** | Paste any article URL and AI reads + summarizes it; or use preset searches for bracket predictions, bubble watch, upset alerts |
| **Chat** | Free-form chat with full context about the bracket — ask about matchups, sleeper picks, regional breakdowns, anything |

### API key setup

News and Chat modes use the Anthropic API. On first use, the panel prompts you to paste your key. It is stored only in your browser's `localStorage` — never sent anywhere except directly to `api.anthropic.com`.

Get a free key at [console.anthropic.com](https://console.anthropic.com).

To reset the key: open your browser console and run `localStorage.removeItem('ANTHROPIC_KEY')`.
