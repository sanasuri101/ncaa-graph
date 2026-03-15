#!/usr/bin/env python3
"""
compute_transitive.py — precomputes transitive path analysis for all 1,782
not-played pairs in the bracket field.

For each pair (A, B) that never met in the regular season, finds:
  - Common opponents where A won and B lost (favors A)
  - Common opponents where B won and A lost (favors B)
  - 2-hop chains: A beat C who beat B (favors A) or B beat C who beat A (favors B)
  - Common opponents both beat or both lost to (compare margins)

Outputs:
  data/transitive_analysis.json
  public/data/transitive_analysis.json

Run after fetch_data.py:  python scripts/compute_transitive.py
Auto-refresh:             Called from refresh.yml after ESPN fetch completes
"""

import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT     = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
PUB_DIR  = ROOT / "public" / "data"

def load_required(path):
    if not path.exists():
        print(f"ERROR: {path} not found — run fetch_data.py first", file=sys.stderr)
        sys.exit(1)
    with open(path) as f:
        return json.load(f)


def build_index(nodes_list, edges):
    nodes = {n['id']: n for n in nodes_list}
    games_between = defaultdict(list)
    for e in edges:
        games_between[(e['from'], e['to'])].append(e)
    adj_beat = defaultdict(set)
    adj_lost = defaultdict(set)
    for e in edges:
        adj_beat[e['from']].add(e['to'])
        adj_lost[e['to']].add(e['from'])
    return nodes, games_between, adj_beat, adj_lost


def get_game(games_between, winner, loser):
    gs = games_between.get((winner, loser), [])
    return sorted(gs, key=lambda g: g['date'], reverse=True)[0] if gs else None


def analyze_pair(a_id, b_id, nodes, games_between, adj_beat, adj_lost):
    a_wins   = adj_beat[a_id]
    b_wins   = adj_beat[b_id]
    a_losses = adj_lost[a_id]
    b_losses = adj_lost[b_id]
    common   = (a_wins | a_losses) & (b_wins | b_losses)

    by_common = {}

    for c in common:
        a_beat_c = c in a_wins
        b_beat_c = c in b_wins
        g_ac = get_game(games_between, a_id, c) if a_beat_c else get_game(games_between, c, a_id)
        g_bc = get_game(games_between, b_id, c) if b_beat_c else get_game(games_between, c, b_id)
        if not g_ac or not g_bc:
            continue
        a_m = g_ac['margin'] if a_beat_c else -g_ac['margin']
        b_m = g_bc['margin'] if b_beat_c else -g_bc['margin']
        rec = {
            'common_name': nodes.get(c, {}).get('label', c),
            'common_id':   c,
            'a_beat':      a_beat_c,
            'b_beat':      b_beat_c,
            'a_score':     g_ac['label'],
            'b_score':     g_bc['label'],
            'a_margin':    a_m,
            'b_margin':    b_m,
            'edge':        a_m - b_m,
            'chain':       False,
        }
        if a_beat_c and b_id in adj_beat.get(c, set()):
            g_cb = get_game(games_between, c, b_id)
            if g_cb:
                rec['chain_a']     = True
                rec['chain_desc_a'] = f"beat {rec['common_name']} ({g_ac['label']}), who beat them ({g_cb['label']})"
        if b_beat_c and a_id in adj_beat.get(c, set()):
            g_ca = get_game(games_between, c, a_id)
            if g_ca:
                rec['chain_b']     = True
                rec['chain_desc_b'] = f"beat {rec['common_name']} ({g_bc['label']}), who beat them ({g_ca['label']})"
        by_common[c] = rec

    # Pure 2-hop chains not captured above
    for c in a_wins:
        if c not in by_common and b_id in adj_beat.get(c, set()):
            g_ac = get_game(games_between, a_id, c)
            g_cb = get_game(games_between, c, b_id)
            if g_ac and g_cb:
                by_common[c] = {
                    'common_name': nodes.get(c, {}).get('label', c),
                    'common_id':   c,
                    'a_beat': True, 'b_beat': False,
                    'a_score': g_ac['label'], 'b_score': g_cb['label'],
                    'a_margin': g_ac['margin'], 'b_margin': -g_cb['margin'],
                    'edge': g_ac['margin'] + g_cb['margin'],
                    'chain': True, 'chain_a': True,
                    'chain_desc_a': f"beat {nodes.get(c,{}).get('label',c)} ({g_ac['label']}), who beat them ({g_cb['label']})",
                }
    for c in b_wins:
        if c not in by_common and a_id in adj_beat.get(c, set()):
            g_bc = get_game(games_between, b_id, c)
            g_ca = get_game(games_between, c, a_id)
            if g_bc and g_ca:
                by_common[c] = {
                    'common_name': nodes.get(c, {}).get('label', c),
                    'common_id':   c,
                    'a_beat': False, 'b_beat': True,
                    'b_score': g_bc['label'], 'a_score': g_ca['label'],
                    'b_margin': g_bc['margin'], 'a_margin': -g_ca['margin'],
                    'edge': -(g_bc['margin'] + g_ca['margin']),
                    'chain': True, 'chain_b': True,
                    'chain_desc_b': f"beat {nodes.get(c,{}).get('label',c)} ({g_bc['label']}), who beat them ({g_ca['label']})",
                }

    all_s    = list(by_common.values())
    sig_a    = sorted([s for s in all_s if s['a_beat'] and not s['b_beat']], key=lambda x: -x['edge'])
    sig_b    = sorted([s for s in all_s if s['b_beat'] and not s['a_beat']], key=lambda x: x['edge'])
    both_beat = sorted([s for s in all_s if s['a_beat'] and s['b_beat']], key=lambda x: -abs(x['edge']))
    both_lost = sorted([s for s in all_s if not s['a_beat'] and not s['b_beat']], key=lambda x: abs(x['edge']))

    n      = len(all_s)
    net    = sum(s['edge'] for s in sig_a) - sum(-s['edge'] for s in sig_b)
    conf   = min(100, int(n * 10 + abs(net) * 0.4))

    verdict = 'unclear'
    if n >= 2:
        if net > 8:    verdict = 'a'
        elif net < -8: verdict = 'b'

    return {
        'a':         sig_a[:5],
        'b':         sig_b[:5],
        'both_beat': both_beat[:4],
        'both_lost': both_lost[:4],
        'net':       net,
        'conf':      conf,
        'verdict':   verdict,
        'n':         n,
    }


def main():
    graph = load_required(DATA_DIR / "graph_data.json")
    np_pairs = graph['not_played']

    # Build a node label lookup from graph (bracket teams only)
    bracket_node_labels = {n['id']: n for n in graph['nodes']}

    # Use all_games.json for the transitive index — this includes every game each
    # bracket team played, not just games against other bracket teams.
    # That means Wisconsin vs Vanderbilt can be compared via shared non-bracket
    # opponents (e.g. both played Indiana, both played SEC/Big Ten common foes).
    all_games_path = DATA_DIR / "all_games.json"
    if all_games_path.exists():
        all_games = load_required(all_games_path)
        print(f"Using all_games.json ({len(all_games)} games) for transitive index")
    else:
        # Fallback: use graph edges only (old behaviour)
        print("WARN: all_games.json not found — falling back to bracket-only edges")
        print("      Run fetch_data.py to generate all_games.json")
        all_games = []

    # Build a synthetic edge/node structure from all_games for the index
    # Nodes: any team that appears in all_games (bracket + non-bracket)
    all_nodes = {}
    all_edges = []
    bracket_ids = set(n['id'] for n in graph['nodes'])

    for g in all_games:
        t1, t2 = g['team1_id'], g['team2_id']
        # Register both teams in node lookup (use bracket label if available)
        for tid, name in [(t1, g['team1_name']), (t2, g['team2_name'])]:
            if tid not in all_nodes:
                all_nodes[tid] = {
                    'id':    tid,
                    'label': bracket_node_labels.get(tid, {}).get('label', name),
                }
        # Only include completed games with a winner
        if g['team1_winner']:
            winner, loser = t1, t2
            ws, ls = g['team1_score'], g['team2_score']
        elif g['team2_winner']:
            winner, loser = t2, t1
            ws, ls = g['team2_score'], g['team1_score']
        else:
            continue
        try:
            margin = abs(int(ws) - int(ls))
        except (ValueError, TypeError):
            margin = 0
        all_edges.append({
            'from':   winner,
            'to':     loser,
            'margin': margin,
            'date':   g.get('date', ''),
            'label':  f"{ws}-{ls}",
        })

    # Fall back to graph edges if all_games was empty
    if not all_edges:
        all_edges = graph['edges']
        all_nodes = {n['id']: n for n in graph['nodes']}

    nodes, games_between, adj_beat, adj_lost = build_index(
        list(all_nodes.values()), all_edges
    )

    print(f"Index: {len(all_nodes)} teams, {len(all_edges)} games")
    print(f"Computing transitive analysis for {len(np_pairs)} not-played pairs...")

    trans_map = {}
    for i, np in enumerate(np_pairs):
        key = f"{np['a']}_{np['b']}"
        trans_map[key] = analyze_pair(np['a'], np['b'], nodes, games_between, adj_beat, adj_lost)
        if i % 500 == 0 and i > 0:
            print(f"  {i}/{len(np_pairs)}")

    from collections import Counter
    vd = Counter(v['verdict'] for v in trans_map.values())
    print(f"  Verdicts: {dict(vd)}")
    print(f"  3+ signals: {sum(1 for v in trans_map.values() if v['n'] >= 3)}")
    print(f"  0 signals:  {sum(1 for v in trans_map.values() if v['n'] == 0)}")

    output = {
        'meta': {
            'total_pairs': len(trans_map),
            'generated_at': datetime.now(timezone.utc).isoformat(),
        },
        'pairs': trans_map,
    }

    for dest in [DATA_DIR / "transitive_analysis.json", PUB_DIR / "transitive_analysis.json"]:
        dest.write_text(json.dumps(output, separators=(',', ':')))

    size = os.path.getsize(DATA_DIR / "transitive_analysis.json")
    print(f"  Wrote transitive_analysis.json: {size:,} bytes")


if __name__ == "__main__":
    main()
