"""
fetch_rosters.py — Fetch individual player stats for all 76 bracket teams.

Uses ESPN core API:
  teams/{id}/leaders -> minutesPerGame top 8 (starters + key bench)
  athletes/{id}      -> name, pos, height, weight, experience, injuries
  athletes/{id}/statistics/0 -> per-game stats

Output: data/roster_stats.json
  {
    "{espn_id}": {
      "bracket_name": "Duke",
      "region": "East",
      "seed": 1,
      "players": [
        {
          "name": "Cooper Flagg",
          "pos": "F",
          "height": "6' 9\"",
          "weight": "205 lbs",
          "exp": "FR",
          "exp_years": 0,
          "age": null,
          "gp": 34, "gs": 34,
          "mpg": 32.1,
          "ppg": 19.1, "rpg": 7.4, "apg": 4.2,
          "spg": 1.4, "bpg": 1.4, "tov": 2.8,
          "fg": 48.2, "three_pct": 35.1, "ft_pct": 82.0,
          "per": 28.4,
          "injured": ""
        }, ...
      ]
    }
  }
"""

import json, time, sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.error import URLError

BASE    = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2026'
TIMEOUT = 10
WORKERS = 12

def fetch(url):
    req = Request(url, headers={'User-Agent': 'ncaa-graph-roster/1.0'})
    try:
        return json.loads(urlopen(req, timeout=TIMEOUT).read())
    except Exception:
        return None

def fetch_player(aid):
    """Fetch athlete info + stats in parallel. Returns (aData, sData) or (None, None)."""
    import concurrent.futures
    with ThreadPoolExecutor(max_workers=2) as ex:
        fa = ex.submit(fetch, f'{BASE}/athletes/{aid}')
        fs = ex.submit(fetch, f'{BASE}/types/2/athletes/{aid}/statistics/0')
        aData = fa.result()
        sData = fs.result()
    return aData, sData

def process_team(team, injury_overrides=None):
    tid  = team['espn_id']
    name = team['bracket_name']

    leaders_data = fetch(f'{BASE}/types/2/teams/{tid}/leaders')
    if not leaders_data:
        print(f'  SKIP {name} ({tid}): no leaders data', flush=True)
        return tid, None

    mpg_cat = next((c for c in leaders_data.get('categories', []) if c['name'] == 'minutesPerGame'), None)
    if not mpg_cat:
        print(f'  SKIP {name} ({tid}): no MPG category', flush=True)
        return tid, None

    top8 = mpg_cat.get('leaders', [])[:8]
    players = []

    # Fetch all 8 players in parallel (2 requests each = 16 concurrent)
    def fetch_one(l):
        athlete_ref = l.get('athlete', {}).get('$ref', '')
        aid = athlete_ref.split('/')[-1].split('?')[0]
        if not aid:
            return None
        aData, sData = fetch_player(aid)
        if not aData or not sData:
            return None

        # Parse athlete info
        pos      = aData.get('position', {}).get('abbreviation', '?')
        height   = aData.get('displayHeight', '')
        weight   = aData.get('displayWeight', '')
        exp_abbr = aData.get('experience', {}).get('abbreviation', '?')
        exp_yrs  = aData.get('experience', {}).get('years', 0)
        dob      = aData.get('dateOfBirth')
        age      = None
        if dob:
            try:
                from datetime import date, datetime
                bd  = datetime.strptime(dob[:10], '%Y-%m-%d').date()
                today = date.today()
                age = today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))
            except Exception:
                pass
        injuries = aData.get('injuries', [])
        inj_str  = injuries[0].get('type', {}).get('description', 'Injured') if injuries else ''

        # Parse stats
        smap = {}
        for sc in sData.get('splits', {}).get('categories', []):
            for s in sc.get('stats', []):
                smap[s['name']] = s.get('value')

        def f(key, default=0.0):
            v = smap.get(key)
            if v is None: return default
            try: return round(float(v), 1)
            except: return default

        def i(key, default=0):
            v = smap.get(key)
            if v is None: return default
            try: return int(float(v))
            except: return default

        return {
            'name':     aData.get('displayName', '?'),
            'injury_impact': '',
            'pos':      pos,
            'height':   height,
            'weight':   weight,
            'exp':      exp_abbr,
            'exp_years': exp_yrs,
            'age':      age,
            'gp':       i('gamesPlayed'),
            'gs':       i('gamesStarted'),
            'mpg':      f('avgMinutes'),
            'ppg':      f('avgPoints'),
            'rpg':      f('avgRebounds'),
            'apg':      f('avgAssists'),
            'spg':      f('avgSteals'),
            'bpg':      f('avgBlocks'),
            'tov':      f('avgTurnovers'),
            'fg':       f('fieldGoalPct'),
            'three_pct': f('threePointFieldGoalPct'),
            'ft_pct':   f('freeThrowPct'),
            'per':      f('PER'),
            'injured':  inj_str,
        }

    with ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(fetch_one, l) for l in top8]
        for fut in as_completed(futs):
            p = fut.result()
            if p:
                players.append(p)

    # Sort by MPG descending
    players.sort(key=lambda p: p['mpg'], reverse=True)

    # Cross-reference injury_overrides.json — ESPN often marks injured players as 'active'
    team_overrides = (injury_overrides or {}).get(str(tid), {})
    for p in players:
        if not p.get('injured') and team_overrides:
            pname_lower = p['name'].lower()
            override = team_overrides.get(pname_lower)
            if not override:
                last = pname_lower.split()[-1]
                override = next((v for k, v in team_overrides.items() if k.split()[-1] == last), None)
            if override:
                p['injured'] = override.get('status', 'Injured - see override')
                p['injury_impact'] = override.get('impact', '')
    print(f'  {name} ({tid}): {len(players)} players fetched', flush=True)

    return tid, {
        'bracket_name': name,
        'region':       team.get('region', ''),
        'seed':         team.get('seed'),
        'players':      players,
    }

def main():
    cfg_path      = Path(__file__).parent.parent / 'data' / 'bracket_config.json'
    out_path      = Path(__file__).parent.parent / 'data' / 'roster_stats.json'
    pub_path      = Path(__file__).parent.parent / 'public' / 'data' / 'roster_stats.json'
    overrides_path= Path(__file__).parent.parent / 'data' / 'injury_overrides.json'

    cfg    = json.loads(cfg_path.read_text())
    teams  = cfg['bracket']

    # Load injury overrides — ESPN often marks injured players as 'active'
    # Build: team_id -> { player_name_lower -> override_dict }
    injury_overrides = {}
    try:
        raw = json.loads(overrides_path.read_text())
        for tid, ov in raw.get('overrides', {}).items():
            injury_overrides[tid] = {
                p['name'].lower(): p for p in ov.get('players', [])
            }
    except Exception as e:
        print(f'Warning: injury_overrides.json: {e}')
    print(f'Fetching rosters for {len(teams)} bracket teams with {WORKERS} workers...', flush=True)

    result = {}
    t0 = time.time()

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(process_team, t, injury_overrides): t for t in teams}
        done = 0
        for fut in as_completed(futs):
            done += 1
            tid, data = fut.result()
            if data:
                result[tid] = data
            if done % 10 == 0:
                print(f'  {done}/{len(teams)} teams done ({time.time()-t0:.0f}s)', flush=True)

    elapsed = time.time() - t0
    total_players = sum(len(v['players']) for v in result.values())
    print(f'\nDone: {len(result)} teams, {total_players} players in {elapsed:.0f}s')

    payload = {
        'generated_at': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
        'teams': result,
    }

    out_path.write_text(json.dumps(payload, indent=2))
    pub_path.write_text(json.dumps(payload))  # minified for public
    print(f'Wrote: {out_path} ({out_path.stat().st_size // 1024}KB)')
    print(f'Wrote: {pub_path} ({pub_path.stat().st_size // 1024}KB)')

if __name__ == '__main__':
    main()
