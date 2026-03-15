#!/usr/bin/env python3
"""
fetch_injuries.py — daily injury intelligence for bracket teams

Outputs:
  data/injury_news.json     — ESPN news items flagged as injury-related per team
  data/injury_report.json   — merged view: manual overrides + auto-detected flags

Run:  python scripts/fetch_injuries.py
Auto: added to GitHub Actions refresh workflow
"""

import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT     = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept":     "application/json",
    "Referer":    "https://www.espn.com/",
}

# Tight patterns — must reference a specific injury type or status, not just "miss a shot"
INJURY_PATTERNS = [
    r"\binjur",
    r"\bfractur",
    r"\btorn\s+\w{2,5}l\b",   # torn ACL / MCL / PCL
    r"\bacl\b", r"\bmcl\b",
    r"\bsurger",
    r"\bout\s+for\s+(?:the\s+)?(?:season|remainder|tournament|indefinitely)",
    r"\bout\s+indefinitely",
    r"\bseason.ending",
    r"\bbroken\s+\w+\b",
    r"\bconcussion",
    r"\bsprained?\b",
    r"\bstress\s+fracture",
]

def is_injury_headline(headline: str, description: str = "") -> bool:
    text = (headline + " " + description).lower()
    return any(re.search(p, text) for p in INJURY_PATTERNS)

def fetch_json(url: str, retries: int = 2) -> dict | None:
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            res = urllib.request.urlopen(req, timeout=10)
            return json.loads(res.read())
        except Exception as e:
            if attempt < retries:
                time.sleep(1)
            else:
                print(f"  WARN: {url[-70:]} — {e}", file=sys.stderr)
    return None

# ── Load bracket teams ────────────────────────────────────────────────────────
with open(DATA_DIR / "bracket_teams.json") as f:
    bracket = json.load(f)

bracket_teams = [t for t in bracket if t["region"] != "bubble"]
id_to_team    = {t["espn_id"]: t for t in bracket_teams}
bracket_ids   = set(id_to_team.keys())

# ── Scan ESPN NCAAB news ──────────────────────────────────────────────────────
print("Scanning ESPN NCAAB news for injury headlines...")
injury_news: dict[str, list] = {}

def process_article(article: dict):
    headline = article.get("headline", "")
    desc     = article.get("description", "")
    if not is_injury_headline(headline, desc):
        return
    # Get team IDs from article categories
    team_ids = [
        str(c["teamId"])
        for c in article.get("categories", [])
        if c.get("teamId") and str(c["teamId"]) in bracket_ids
    ]
    if not team_ids:
        return
    entry = {
        "headline":    headline,
        "description": desc[:200],
        "published":   article.get("published", "")[:10],
        "url":         (article.get("links") or {}).get("web", {}).get("href", ""),
    }
    for tid in set(team_ids):
        injury_news.setdefault(tid, []).append(entry)

# General NCAAB feed — catches most inter-team injury stories
for page in range(1, 4):
    url  = f"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/news?limit=50&page={page}"
    data = fetch_json(url)
    if not data:
        break
    articles = data.get("articles", [])
    if not articles:
        break
    for a in articles:
        process_article(a)
    time.sleep(0.3)

print(f"  General scan: {len(injury_news)} bracket teams flagged")

# Per-team scan for key injured teams not yet caught
# ── Load manual overrides ─────────────────────────────────────────────────────
overrides_path = DATA_DIR / "injury_overrides.json"
overrides      = {}
if overrides_path.exists():
    with open(overrides_path) as f:
        overrides = json.load(f).get("overrides", {})

# Derive priority from teams that already have manual overrides
# — those are the ones most likely to need fresh news scans
priority = list(overrides.keys())
for espn_id in priority:
    url  = f"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/news?team={espn_id}&limit=15"
    data = fetch_json(url)
    if not data:
        continue
    for a in data.get("articles", []):
        process_article(a)
    time.sleep(0.3)

# ── Write injury_news.json ────────────────────────────────────────────────────
news_out = {
    "generated_at":  datetime.now(timezone.utc).isoformat(),
    "flagged_teams": len(injury_news),
    "teams": {
        espn_id: {
            "bracket_name": id_to_team[espn_id]["bracket_name"],
            "region":       id_to_team[espn_id]["region"],
            "seed":         id_to_team[espn_id]["seed"],
            "articles":     sorted(articles, key=lambda a: a["published"], reverse=True)[:5],
        }
        for espn_id, articles in injury_news.items()
    },
}
with open(DATA_DIR / "injury_news.json", "w") as f:
    json.dump(news_out, f, indent=2)

# ── Build merged injury_report.json ──────────────────────────────────────────
report = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "teams":        {},
}

all_flagged = set(injury_news.keys()) | set(overrides.keys())
for espn_id in all_flagged:
    if espn_id not in id_to_team:
        continue
    team     = id_to_team[espn_id]
    override = overrides.get(espn_id, {})
    news     = injury_news.get(espn_id, [])
    report["teams"][espn_id] = {
        "bracket_name":   team["bracket_name"],
        "region":         team["region"],
        "seed":           team["seed"],
        "adj_em_penalty": override.get("adj_em_penalty", 0),
        "players":        override.get("players", []),
        "notes":          override.get("notes", ""),
        "override_date":  override.get("updated", ""),
        "news_flags":     news[:3],
        "has_override":   espn_id in overrides,
        "has_news_flag":  espn_id in injury_news,
    }

with open(DATA_DIR / "injury_report.json", "w") as f:
    json.dump(report, f, indent=2)

# ── Print summary ─────────────────────────────────────────────────────────────
print(f"  Wrote injury_news.json    — {len(injury_news)} teams with news flags")
print(f"  Wrote injury_report.json  — {len(report['teams'])} teams total")

print("\n=== TEAMS WITH ACTIVE INJURY OVERRIDES ===")
for espn_id, entry in sorted(report["teams"].items(), key=lambda x: x[1].get("seed", 99)):
    if not entry["has_override"]:
        continue
    penalty = entry["adj_em_penalty"]
    players = [p["name"] for p in entry.get("players", [])]
    print(f"  {entry['bracket_name']:20} ({entry['region']:8} #{entry['seed']:2}) "
          f"AdjEM -{penalty:.1f}  |  {', '.join(players)}")

if injury_news:
    print("\n=== AUTO-DETECTED INJURY NEWS (no override yet) ===")
    for espn_id, articles in injury_news.items():
        if espn_id in overrides:
            continue
        team = id_to_team.get(espn_id, {})
        print(f"\n  {team.get('bracket_name','?')} ({team.get('region','?')} #{team.get('seed','?')}):")
        for a in articles[:2]:
            print(f"    [{a['published']}] {a['headline'][:80]}")

