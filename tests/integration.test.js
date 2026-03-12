/**
 * integration.test.js — NCAA Graph integration tests
 * Run: node tests/integration.test.js
 */
const fs   = require('fs');
const path = require('path');

let passed = 0, failed = 0;
const errors = [];

function assert(condition, label) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; errors.push(label); }
}

function load(relPath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8'));
}

let graph, torvik, trans, form, bracket;

console.log('\n1. Data files load');
try { graph   = load('public/data/graph_data.json');          assert(true, 'graph_data.json'); }
catch(e) { assert(false, `graph_data.json: ${e.message}`); }
try { torvik  = load('public/data/torvik_stats.json');        assert(true, 'torvik_stats.json'); }
catch(e) { assert(false, `torvik_stats.json: ${e.message}`); }
try { trans   = load('public/data/transitive_analysis.json'); assert(true, 'transitive_analysis.json'); }
catch(e) { assert(false, `transitive_analysis.json: ${e.message}`); }
try { form    = load('public/data/recent_form.json');         assert(true, 'recent_form.json'); }
catch(e) { assert(false, `recent_form.json: ${e.message}`); }
try { bracket = load('data/bracket_teams.json');              assert(true, 'bracket_teams.json'); }
catch(e) { assert(false, `bracket_teams.json: ${e.message}`); }

console.log('\n2. Graph structure');
assert(graph?.nodes?.length === 64, `64 nodes (got ${graph?.nodes?.length})`);
assert(graph?.edges?.length === 265, `265 edges (got ${graph?.edges?.length})`);
const n0 = graph?.nodes?.[0];
['id','full_name','seed','region','wins_vs_field','losses_vs_field'].forEach(f =>
  assert(n0?.[f] != null, `node has ${f}`)
);
const e0 = graph?.edges?.[0];
['from','to','label','margin','date'].forEach(f =>
  assert(e0?.[f] != null, `edge has ${f}`)
);
const selfLoops = (graph?.edges ?? []).filter(e => e.from === e.to);
assert(selfLoops.length === 0, 'no self-loop edges');
// Rematches are expected (30 in 2025-26) — check for triple+ duplicates only
const edgeKeyCounts = {};
(graph?.edges ?? []).forEach(e => {
  const k = [e.from, e.to].sort().join('_');
  edgeKeyCounts[k] = (edgeKeyCounts[k] || 0) + 1;
});
const tripleEdges = Object.entries(edgeKeyCounts).filter(([,v]) => v > 2);
assert(tripleEdges.length === 0, `no triple+ duplicate edges (found: ${tripleEdges.length})`);

console.log('\n3. Torvik stats');
assert(torvik?.teams != null, 'torvik.teams exists');
const bracketIds = new Set((graph?.nodes ?? []).map(n => n.id));
const missing = [...bracketIds].filter(id => !torvik?.teams?.[id]);
assert(missing.length === 0, `all 64 teams in torvik (missing: ${missing.join(', ')||'none'})`);
const tv0 = Object.values(torvik?.teams ?? {})[0]?.torvik;
['adj_oe','adj_de','adj_em','rank'].forEach(f =>
  assert(tv0?.[f] != null, `torvik entry has ${f}`)
);

console.log('\n4. Transitive analysis');
assert(trans?.meta?.total_pairs === 1781, `meta.total_pairs = 1781 (got ${trans?.meta?.total_pairs})`);
const pairCount = Object.keys(trans?.pairs ?? {}).length;
assert(pairCount === 1781, `1781 pair entries (got ${pairCount})`);
const badKeys = Object.keys(trans?.pairs ?? {}).filter(k => !/^\d+_\d+$/.test(k));
assert(badKeys.length === 0, `all keys are "id_id" format`);
const p0 = Object.values(trans?.pairs ?? {})[1];
['a','b','both_beat','both_lost'].forEach(f =>
  assert(Array.isArray(p0?.[f]), `pair has ${f} array`)
);
assert(p0?.verdict != null, 'pair has verdict');

console.log('\n5. Paths lookup — not-played pairs resolvable');
const ids = (graph?.nodes ?? []).map(n => n.id);
let lookupFails = 0, checked = 0;
outer: for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const played = (graph?.edges ?? []).some(e =>
      (e.from === ids[i] && e.to === ids[j]) || (e.from === ids[j] && e.to === ids[i])
    );
    if (!played) {
      const found = trans?.pairs?.[`${ids[i]}_${ids[j]}`] || trans?.pairs?.[`${ids[j]}_${ids[i]}`];
      if (!found) lookupFails++;
    }
    if (++checked >= 300) break outer;
  }
}
assert(lookupFails === 0, `all sampled not-played pairs in transitive data (${lookupFails} misses / 300 checked)`);

console.log('\n6. Bracket teams ESPN IDs');
assert(bracket?.length === 64, `64 bracket entries (got ${bracket?.length})`);
const espnIds = (bracket ?? []).map(t => t.espn_id);
assert(new Set(espnIds).size === espnIds.length, 'no duplicate ESPN IDs');
assert((bracket ?? []).every(t => t.espn_id && t.bracket_name && t.seed && t.region), 'all entries have required fields');
const spotCheck = { Duke:'150', Michigan:'130', Houston:'248', Arizona:'12', Queens:'2511' };
for (const [name, id] of Object.entries(spotCheck)) {
  const t = (bracket ?? []).find(t => t.bracket_name === name);
  assert(t?.espn_id === id, `${name} espn_id = ${id} (got ${t?.espn_id})`);
}

console.log('\n7. Recent form');
assert(form != null && typeof form === 'object', 'recent_form is object');
assert(Object.keys(form).length > 0, `form has entries (got ${Object.keys(form).length})`);
const f0 = Object.values(form)[0];
assert(Array.isArray(f0?.games), 'form entries have games array');
assert(typeof f0?.last10 === 'string', 'form entries have last10 string (e.g. "9-1")');
assert(f0?.streak != null, 'form entries have streak');

console.log('\n' + '─'.repeat(40));
console.log(`${passed} passed  ${failed} failed`);
if (errors.length) { errors.forEach(e => console.error(`  ✗ ${e}`)); process.exit(1); }
else { console.log('All tests passed ✓\n'); process.exit(0); }
