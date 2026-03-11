// ================================================================
// 2025-26 NCAA Regular Season - 64 Bracket Teams Head-to-Head
// Source: ESPN API  |  264 games  |  234 matchups
// ================================================================

// --- Constraints ---
CREATE CONSTRAINT team_id IF NOT EXISTS FOR (t:Team) REQUIRE t.espn_id IS UNIQUE;
CREATE CONSTRAINT game_id IF NOT EXISTS FOR (g:Game) REQUIRE g.id IS UNIQUE;

// --- Team Nodes ---
MERGE (:Team {espn_id: "150", name: "Duke Blue Devils", bracket_name: "Duke", region: "East", seed: 1});
MERGE (:Team {espn_id: "127", name: "Michigan State Spartans", bracket_name: "Michigan State", region: "East", seed: 2});
MERGE (:Team {espn_id: "66", name: "Iowa State Cyclones", bracket_name: "Iowa State", region: "East", seed: 3});
MERGE (:Team {espn_id: "2641", name: "Texas Tech Red Raiders", bracket_name: "Texas Tech", region: "East", seed: 4});
MERGE (:Team {espn_id: "8", name: "Arkansas Razorbacks", bracket_name: "Arkansas", region: "East", seed: 5});
MERGE (:Team {espn_id: "275", name: "Wisconsin Badgers", bracket_name: "Wisconsin", region: "East", seed: 6});
MERGE (:Team {espn_id: "222", name: "Villanova Wildcats", bracket_name: "Villanova", region: "East", seed: 7});
MERGE (:Team {espn_id: "61", name: "Georgia Bulldogs", bracket_name: "Georgia", region: "East", seed: 8});
MERGE (:Team {espn_id: "194", name: "Ohio State Buckeyes", bracket_name: "Ohio State", region: "East", seed: 9});
MERGE (:Team {espn_id: "152", name: "NC State Wolfpack", bracket_name: "NC State", region: "East", seed: 10});
MERGE (:Team {espn_id: "2567", name: "SMU Mustangs", bracket_name: "SMU", region: "East", seed: 11});
MERGE (:Team {espn_id: "58", name: "South Florida Bulls", bracket_name: "South Florida", region: "East", seed: 12});
MERGE (:Team {espn_id: "2617", name: "Stephen F. Austin Lumberjacks", bracket_name: "SFA", region: "East", seed: 13});
MERGE (:Team {espn_id: "2750", name: "Wright State Raiders", bracket_name: "Wright State", region: "East", seed: 14});
MERGE (:Team {espn_id: "2429", name: "Charlotte 49ers", bracket_name: "Queens", region: "East", seed: 15});
MERGE (:Team {espn_id: "2378", name: "UMBC Retrievers", bracket_name: "UMBC", region: "East", seed: 16});
MERGE (:Team {espn_id: "130", name: "Michigan Wolverines", bracket_name: "Michigan", region: "Midwest", seed: 1});
MERGE (:Team {espn_id: "41", name: "UConn Huskies", bracket_name: "UConn", region: "Midwest", seed: 2});
MERGE (:Team {espn_id: "2509", name: "Purdue Boilermakers", bracket_name: "Purdue", region: "Midwest", seed: 3});
MERGE (:Team {espn_id: "153", name: "North Carolina Tar Heels", bracket_name: "North Carolina", region: "Midwest", seed: 4});
MERGE (:Team {espn_id: "238", name: "Vanderbilt Commodores", bracket_name: "Vanderbilt", region: "Midwest", seed: 5});
MERGE (:Team {espn_id: "96", name: "Kentucky Wildcats", bracket_name: "Kentucky", region: "Midwest", seed: 7});
MERGE (:Team {espn_id: "228", name: "Clemson Tigers", bracket_name: "Clemson", region: "Midwest", seed: 8});
MERGE (:Team {espn_id: "139", name: "Saint Louis Billikens", bracket_name: "Saint Louis", region: "Midwest", seed: 9});
MERGE (:Team {espn_id: "2294", name: "Iowa Hawkeyes", bracket_name: "Iowa", region: "Midwest", seed: 10});
MERGE (:Team {espn_id: "2272", name: "High Point Panthers", bracket_name: "High Point", region: "Midwest", seed: 12});
MERGE (:Team {espn_id: "193", name: "Miami (OH) RedHawks", bracket_name: "Miami OH", region: "Midwest", seed: 13});
MERGE (:Team {espn_id: "2275", name: "Hofstra Pride", bracket_name: "Hofstra", region: "Midwest", seed: 14});
MERGE (:Team {espn_id: "2771", name: "Merrimack Warriors", bracket_name: "Merrimack", region: "Midwest", seed: 15});
MERGE (:Team {espn_id: "2329", name: "Lehigh Mountain Hawks", bracket_name: "Lehigh", region: "Midwest", seed: 16});
MERGE (:Team {espn_id: "57", name: "Florida Gators", bracket_name: "Florida", region: "South", seed: 1});
MERGE (:Team {espn_id: "248", name: "Houston Cougars", bracket_name: "Houston", region: "South", seed: 2});
MERGE (:Team {espn_id: "158", name: "Nebraska Cornhuskers", bracket_name: "Nebraska", region: "South", seed: 3});
MERGE (:Team {espn_id: "258", name: "Virginia Cavaliers", bracket_name: "Virginia", region: "South", seed: 4});
MERGE (:Team {espn_id: "2599", name: "St. John's Red Storm", bracket_name: "St. John's", region: "South", seed: 5});
MERGE (:Team {espn_id: "97", name: "Louisville Cardinals", bracket_name: "Louisville", region: "South", seed: 6});
MERGE (:Team {espn_id: "2608", name: "Saint Mary's Gaels", bracket_name: "Saint Mary's", region: "South", seed: 7});
MERGE (:Team {espn_id: "328", name: "Utah State Aggies", bracket_name: "Utah State", region: "South", seed: 8});
MERGE (:Team {espn_id: "2628", name: "TCU Horned Frogs", bracket_name: "TCU", region: "South", seed: 9});
MERGE (:Team {espn_id: "142", name: "Missouri Tigers", bracket_name: "Missouri", region: "South", seed: 10});
MERGE (:Team {espn_id: "2670", name: "VCU Rams", bracket_name: "VCU", region: "South", seed: 11});
MERGE (:Team {espn_id: "43", name: "Yale Bulldogs", bracket_name: "Yale", region: "South", seed: 12});
MERGE (:Team {espn_id: "2335", name: "Liberty Flames", bracket_name: "Liberty", region: "South", seed: 13});
MERGE (:Team {espn_id: "300", name: "UC Irvine Anteaters", bracket_name: "UC Irvine", region: "South", seed: 14});
MERGE (:Team {espn_id: "2502", name: "Portland State Vikings", bracket_name: "Portland State", region: "South", seed: 15});
MERGE (:Team {espn_id: "231", name: "Furman Paladins", bracket_name: "Furman", region: "South", seed: 16});
MERGE (:Team {espn_id: "12", name: "Arizona Wildcats", bracket_name: "Arizona", region: "West", seed: 1});
MERGE (:Team {espn_id: "356", name: "Illinois Fighting Illini", bracket_name: "Illinois", region: "West", seed: 2});
MERGE (:Team {espn_id: "333", name: "Alabama Crimson Tide", bracket_name: "Alabama", region: "West", seed: 3});
MERGE (:Team {espn_id: "245", name: "Texas A&M Aggies", bracket_name: "Texas A&M", region: "West", seed: 4});
MERGE (:Team {espn_id: "2305", name: "Kansas Jayhawks", bracket_name: "Kansas", region: "West", seed: 4});
MERGE (:Team {espn_id: "2633", name: "Tennessee Volunteers", bracket_name: "Tennessee", region: "West", seed: 5});
MERGE (:Team {espn_id: "252", name: "BYU Cougars", bracket_name: "BYU", region: "West", seed: 6});
MERGE (:Team {espn_id: "2390", name: "Miami Hurricanes", bracket_name: "Miami FL", region: "West", seed: 7});
MERGE (:Team {espn_id: "26", name: "UCLA Bruins", bracket_name: "UCLA", region: "West", seed: 8});
MERGE (:Team {espn_id: "3084", name: "Utah Valley Wolverines", bracket_name: "Utah Valley", region: "West", seed: 9});
MERGE (:Team {espn_id: "251", name: "Texas Longhorns", bracket_name: "Texas", region: "West", seed: 10});
MERGE (:Team {espn_id: "2116", name: "UCF Knights", bracket_name: "UCF", region: "West", seed: 11});
MERGE (:Team {espn_id: "2460", name: "Northern Iowa Panthers", bracket_name: "Northern Iowa", region: "West", seed: 11});
MERGE (:Team {espn_id: "2250", name: "Gonzaga Bulldogs", bracket_name: "Gonzaga", region: "West", seed: 13});
MERGE (:Team {espn_id: "2449", name: "North Dakota State Bison", bracket_name: "NDSU", region: "West", seed: 13});
MERGE (:Team {espn_id: "2653", name: "Troy Trojans", bracket_name: "Troy", region: "West", seed: 14});
MERGE (:Team {espn_id: "112358", name: "Long Island University Sharks", bracket_name: "Long Island", region: "West", seed: 16});
MERGE (:Team {espn_id: "2448", name: "North Carolina A&T Aggies", bracket_name: "NC A&T", region: "West", seed: 16});

// --- Games & Relationships ---
// (winner)-[:BEAT {score, date, home_away}]->(loser)
// (team)-[:PLAYED {score, date, result}]->(game)<-[:PLAYED]-(team)

// Texas Longhorns at Duke Blue Devils
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "251"})
MERGE (g:Game {id: "401817228"}) ON CREATE SET
  g.name = "Texas Longhorns at Duke Blue Devils",
  g.date = "2025-11-05",
  g.score = "{'value': 75.0, 'displayValue': '75'}-{'value': 60.0, 'displayValue': '60'}",
  g.neutral = true,
  g.venue = "Spectrum Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 75.0, 'displayValue': '75'}-{'value': 60.0, 'displayValue': '60'}", date: "2025-11-05", neutral: true}]->(l);

// Kansas Jayhawks at Duke Blue Devils
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "2305"})
MERGE (g:Game {id: "401817232"}) ON CREATE SET
  g.name = "Kansas Jayhawks at Duke Blue Devils",
  g.date = "2025-11-19",
  g.score = "{'value': 78.0, 'displayValue': '78'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = true,
  g.venue = "Madison Square Garden"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 78.0, 'displayValue': '78'}-{'value': 66.0, 'displayValue': '66'}", date: "2025-11-19", neutral: true}]->(l);

// Duke Blue Devils at Arkansas Razorbacks
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "8"})
MERGE (g:Game {id: "401817234"}) ON CREATE SET
  g.name = "Duke Blue Devils at Arkansas Razorbacks",
  g.date = "2025-11-28",
  g.score = "{'value': 80.0, 'displayValue': '80'}-{'value': 71.0, 'displayValue': '71'}",
  g.neutral = true,
  g.venue = "United Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 80.0, 'displayValue': '80'}-{'value': 71.0, 'displayValue': '71'}", date: "2025-11-28", neutral: true}]->(l);

// Florida Gators at Duke Blue Devils
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "57"})
MERGE (g:Game {id: "401806364"}) ON CREATE SET
  g.name = "Florida Gators at Duke Blue Devils",
  g.date = "2025-12-03",
  g.score = "{'value': 67.0, 'displayValue': '67'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = false,
  g.venue = "Cameron Indoor Stadium"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 67.0, 'displayValue': '67'}-{'value': 66.0, 'displayValue': '66'}", date: "2025-12-03", neutral: false}]->(l);

// Duke Blue Devils at Michigan State Spartans
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "127"})
MERGE (g:Game {id: "401817235"}) ON CREATE SET
  g.name = "Duke Blue Devils at Michigan State Spartans",
  g.date = "2025-12-06",
  g.score = "{'value': 66.0, 'displayValue': '66'}-{'value': 60.0, 'displayValue': '60'}",
  g.neutral = false,
  g.venue = "Breslin Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 66.0, 'displayValue': '66'}-{'value': 60.0, 'displayValue': '60'}", date: "2025-12-06", neutral: false}]->(l);

// Texas Tech Red Raiders at Duke Blue Devils
MATCH (w:Team {espn_id: "2641"}), (l:Team {espn_id: "150"})
MERGE (g:Game {id: "401817237"}) ON CREATE SET
  g.name = "Texas Tech Red Raiders at Duke Blue Devils",
  g.date = "2025-12-21",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 81.0, 'displayValue': '81'}",
  g.neutral = true,
  g.venue = "Madison Square Garden"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 81.0, 'displayValue': '81'}", date: "2025-12-21", neutral: true}]->(l);

// Duke Blue Devils at Louisville Cardinals
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "97"})
MERGE (g:Game {id: "401820650"}) ON CREATE SET
  g.name = "Duke Blue Devils at Louisville Cardinals",
  g.date = "2026-01-07",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 73.0, 'displayValue': '73'}",
  g.neutral = false,
  g.venue = "KFC Yum! Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 73.0, 'displayValue': '73'}", date: "2026-01-07", neutral: false}]->(l);

// SMU Mustangs at Duke Blue Devils
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "2567"})
MERGE (g:Game {id: "401820657"}) ON CREATE SET
  g.name = "SMU Mustangs at Duke Blue Devils",
  g.date = "2026-01-10",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 75.0, 'displayValue': '75'}",
  g.neutral = false,
  g.venue = "Cameron Indoor Stadium"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 75.0, 'displayValue': '75'}", date: "2026-01-10", neutral: false}]->(l);

// Louisville Cardinals at Duke Blue Devils
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "97"})
MERGE (g:Game {id: "401820698"}) ON CREATE SET
  g.name = "Louisville Cardinals at Duke Blue Devils",
  g.date = "2026-01-27",
  g.score = "{'value': 83.0, 'displayValue': '83'}-{'value': 52.0, 'displayValue': '52'}",
  g.neutral = false,
  g.venue = "Cameron Indoor Stadium"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 83.0, 'displayValue': '83'}-{'value': 52.0, 'displayValue': '52'}", date: "2026-01-27", neutral: false}]->(l);

// Duke Blue Devils at North Carolina Tar Heels
MATCH (w:Team {espn_id: "153"}), (l:Team {espn_id: "150"})
MERGE (g:Game {id: "401820724"}) ON CREATE SET
  g.name = "Duke Blue Devils at North Carolina Tar Heels",
  g.date = "2026-02-07",
  g.score = "{'value': 71.0, 'displayValue': '71'}-{'value': 68.0, 'displayValue': '68'}",
  g.neutral = false,
  g.venue = "Dean E. Smith Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 71.0, 'displayValue': '71'}-{'value': 68.0, 'displayValue': '68'}", date: "2026-02-07", neutral: false}]->(l);

// Clemson Tigers at Duke Blue Devils
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "228"})
MERGE (g:Game {id: "401820740"}) ON CREATE SET
  g.name = "Clemson Tigers at Duke Blue Devils",
  g.date = "2026-02-14",
  g.score = "{'value': 67.0, 'displayValue': '67'}-{'value': 54.0, 'displayValue': '54'}",
  g.neutral = false,
  g.venue = "Cameron Indoor Stadium"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 67.0, 'displayValue': '67'}-{'value': 54.0, 'displayValue': '54'}", date: "2026-02-14", neutral: false}]->(l);

// Michigan Wolverines at Duke Blue Devils
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "130"})
MERGE (g:Game {id: "401817238"}) ON CREATE SET
  g.name = "Michigan Wolverines at Duke Blue Devils",
  g.date = "2026-02-21",
  g.score = "{'value': 68.0, 'displayValue': '68'}-{'value': 63.0, 'displayValue': '63'}",
  g.neutral = true,
  g.venue = "Capital One Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 68.0, 'displayValue': '68'}-{'value': 63.0, 'displayValue': '63'}", date: "2026-02-21", neutral: true}]->(l);

// Virginia Cavaliers at Duke Blue Devils
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "258"})
MERGE (g:Game {id: "401820771"}) ON CREATE SET
  g.name = "Virginia Cavaliers at Duke Blue Devils",
  g.date = "2026-02-28",
  g.score = "{'value': 77.0, 'displayValue': '77'}-{'value': 51.0, 'displayValue': '51'}",
  g.neutral = false,
  g.venue = "Cameron Indoor Stadium"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 77.0, 'displayValue': '77'}-{'value': 51.0, 'displayValue': '51'}", date: "2026-02-28", neutral: false}]->(l);

// Duke Blue Devils at NC State Wolfpack
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "152"})
MERGE (g:Game {id: "401820778"}) ON CREATE SET
  g.name = "Duke Blue Devils at NC State Wolfpack",
  g.date = "2026-03-03",
  g.score = "{'value': 93.0, 'displayValue': '93'}-{'value': 64.0, 'displayValue': '64'}",
  g.neutral = false,
  g.venue = "Lenovo Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 93.0, 'displayValue': '93'}-{'value': 64.0, 'displayValue': '64'}", date: "2026-03-03", neutral: false}]->(l);

// North Carolina Tar Heels at Duke Blue Devils
MATCH (w:Team {espn_id: "150"}), (l:Team {espn_id: "153"})
MERGE (g:Game {id: "401820788"}) ON CREATE SET
  g.name = "North Carolina Tar Heels at Duke Blue Devils",
  g.date = "2026-03-07",
  g.score = "{'value': 76.0, 'displayValue': '76'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = false,
  g.venue = "Cameron Indoor Stadium"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 76.0, 'displayValue': '76'}-{'value': 61.0, 'displayValue': '61'}", date: "2026-03-07", neutral: false}]->(l);

// UMBC Retrievers at South Florida Bulls
MATCH (w:Team {espn_id: "58"}), (l:Team {espn_id: "2378"})
MERGE (g:Game {id: "401826057"}) ON CREATE SET
  g.name = "UMBC Retrievers at South Florida Bulls",
  g.date = "2025-12-21",
  g.score = "{'value': 94.0, 'displayValue': '94'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Yuengling Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 94.0, 'displayValue': '94'}-{'value': 69.0, 'displayValue': '69'}", date: "2025-12-21", neutral: false}]->(l);

// Clemson Tigers at Georgia Bulldogs
MATCH (w:Team {espn_id: "228"}), (l:Team {espn_id: "61"})
MERGE (g:Game {id: "401831230"}) ON CREATE SET
  g.name = "Clemson Tigers at Georgia Bulldogs",
  g.date = "2025-11-23",
  g.score = "{'value': 97.0, 'displayValue': '97'}-{'value': 94.0, 'displayValue': '94'}",
  g.neutral = true,
  g.venue = "TD Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 97.0, 'displayValue': '97'}-{'value': 94.0, 'displayValue': '94'}", date: "2025-11-23", neutral: true}]->(l);

// Long Island University Sharks at Georgia Bulldogs
MATCH (w:Team {espn_id: "61"}), (l:Team {espn_id: "112358"})
MERGE (g:Game {id: "401812364"}) ON CREATE SET
  g.name = "Long Island University Sharks at Georgia Bulldogs",
  g.date = "2025-12-30",
  g.score = "{'value': 89.0, 'displayValue': '89'}-{'value': 74.0, 'displayValue': '74'}",
  g.neutral = false,
  g.venue = "Stegeman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 89.0, 'displayValue': '89'}-{'value': 74.0, 'displayValue': '74'}", date: "2025-12-30", neutral: false}]->(l);

// Georgia Bulldogs at Florida Gators
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "61"})
MERGE (g:Game {id: "401808153"}) ON CREATE SET
  g.name = "Georgia Bulldogs at Florida Gators",
  g.date = "2026-01-07",
  g.score = "{'value': 92.0, 'displayValue': '92'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = false,
  g.venue = "Stephen C. O'Connell Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 92.0, 'displayValue': '92'}-{'value': 77.0, 'displayValue': '77'}", date: "2026-01-07", neutral: false}]->(l);

// Arkansas Razorbacks at Georgia Bulldogs
MATCH (w:Team {espn_id: "61"}), (l:Team {espn_id: "8"})
MERGE (g:Game {id: "401808178"}) ON CREATE SET
  g.name = "Arkansas Razorbacks at Georgia Bulldogs",
  g.date = "2026-01-17",
  g.score = "{'value': 90.0, 'displayValue': '90'}-{'value': 76.0, 'displayValue': '76'}",
  g.neutral = false,
  g.venue = "Stegeman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 90.0, 'displayValue': '90'}-{'value': 76.0, 'displayValue': '76'}", date: "2026-01-17", neutral: false}]->(l);

// Georgia Bulldogs at Missouri Tigers
MATCH (w:Team {espn_id: "61"}), (l:Team {espn_id: "142"})
MERGE (g:Game {id: "401808190"}) ON CREATE SET
  g.name = "Georgia Bulldogs at Missouri Tigers",
  g.date = "2026-01-21",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 72.0, 'displayValue': '72'}",
  g.neutral = false,
  g.venue = "Mizzou Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 72.0, 'displayValue': '72'}", date: "2026-01-21", neutral: false}]->(l);

// Georgia Bulldogs at Texas Longhorns
MATCH (w:Team {espn_id: "251"}), (l:Team {espn_id: "61"})
MERGE (g:Game {id: "401808198"}) ON CREATE SET
  g.name = "Georgia Bulldogs at Texas Longhorns",
  g.date = "2026-01-24",
  g.score = "{'value': 87.0, 'displayValue': '87'}-{'value': 67.0, 'displayValue': '67'}",
  g.neutral = false,
  g.venue = "Moody Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 87.0, 'displayValue': '87'}-{'value': 67.0, 'displayValue': '67'}", date: "2026-01-24", neutral: false}]->(l);

// Tennessee Volunteers at Georgia Bulldogs
MATCH (w:Team {espn_id: "2633"}), (l:Team {espn_id: "61"})
MERGE (g:Game {id: "401808201"}) ON CREATE SET
  g.name = "Tennessee Volunteers at Georgia Bulldogs",
  g.date = "2026-01-29",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 85.0, 'displayValue': '85'}",
  g.neutral = false,
  g.venue = "Stegeman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 85.0, 'displayValue': '85'}", date: "2026-01-29", neutral: false}]->(l);

// Texas A&M Aggies at Georgia Bulldogs
MATCH (w:Team {espn_id: "245"}), (l:Team {espn_id: "61"})
MERGE (g:Game {id: "401808209"}) ON CREATE SET
  g.name = "Texas A&M Aggies at Georgia Bulldogs",
  g.date = "2026-01-31",
  g.score = "{'value': 92.0, 'displayValue': '92'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = false,
  g.venue = "Stegeman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 92.0, 'displayValue': '92'}-{'value': 77.0, 'displayValue': '77'}", date: "2026-01-31", neutral: false}]->(l);

// Florida Gators at Georgia Bulldogs
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "61"})
MERGE (g:Game {id: "401808230"}) ON CREATE SET
  g.name = "Florida Gators at Georgia Bulldogs",
  g.date = "2026-02-12",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = false,
  g.venue = "Stegeman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 66.0, 'displayValue': '66'}", date: "2026-02-12", neutral: false}]->(l);

// Georgia Bulldogs at Kentucky Wildcats
MATCH (w:Team {espn_id: "61"}), (l:Team {espn_id: "96"})
MERGE (g:Game {id: "401808245"}) ON CREATE SET
  g.name = "Georgia Bulldogs at Kentucky Wildcats",
  g.date = "2026-02-18",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 78.0, 'displayValue': '78'}",
  g.neutral = false,
  g.venue = "Rupp Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 78.0, 'displayValue': '78'}", date: "2026-02-18", neutral: false}]->(l);

// Texas Longhorns at Georgia Bulldogs
MATCH (w:Team {espn_id: "61"}), (l:Team {espn_id: "251"})
MERGE (g:Game {id: "401808251"}) ON CREATE SET
  g.name = "Texas Longhorns at Georgia Bulldogs",
  g.date = "2026-02-21",
  g.score = "{'value': 91.0, 'displayValue': '91'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "Stegeman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 91.0, 'displayValue': '91'}-{'value': 80.0, 'displayValue': '80'}", date: "2026-02-21", neutral: false}]->(l);

// Georgia Bulldogs at Vanderbilt Commodores
MATCH (w:Team {espn_id: "238"}), (l:Team {espn_id: "61"})
MERGE (g:Game {id: "401808261"}) ON CREATE SET
  g.name = "Georgia Bulldogs at Vanderbilt Commodores",
  g.date = "2026-02-26",
  g.score = "{'value': 88.0, 'displayValue': '88'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "Memorial Gymnasium (TN)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 88.0, 'displayValue': '88'}-{'value': 80.0, 'displayValue': '80'}", date: "2026-02-26", neutral: false}]->(l);

// Alabama Crimson Tide at Georgia Bulldogs
MATCH (w:Team {espn_id: "61"}), (l:Team {espn_id: "333"})
MERGE (g:Game {id: "401808277"}) ON CREATE SET
  g.name = "Alabama Crimson Tide at Georgia Bulldogs",
  g.date = "2026-03-03",
  g.score = "{'value': 98.0, 'displayValue': '98'}-{'value': 88.0, 'displayValue': '88'}",
  g.neutral = false,
  g.venue = "Stegeman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 98.0, 'displayValue': '98'}-{'value': 88.0, 'displayValue': '88'}", date: "2026-03-03", neutral: false}]->(l);

// Illinois Fighting Illini at Ohio State Buckeyes
MATCH (w:Team {espn_id: "356"}), (l:Team {espn_id: "194"})
MERGE (g:Game {id: "401825404"}) ON CREATE SET
  g.name = "Illinois Fighting Illini at Ohio State Buckeyes",
  g.date = "2025-12-10",
  g.score = "{'value': 88.0, 'displayValue': '88'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "Value City Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 88.0, 'displayValue': '88'}-{'value': 80.0, 'displayValue': '80'}", date: "2025-12-10", neutral: false}]->(l);

// North Carolina Tar Heels at Ohio State Buckeyes
MATCH (w:Team {espn_id: "153"}), (l:Team {espn_id: "194"})
MERGE (g:Game {id: "401809307"}) ON CREATE SET
  g.name = "North Carolina Tar Heels at Ohio State Buckeyes",
  g.date = "2025-12-20",
  g.score = "{'value': 71.0, 'displayValue': '71'}-{'value': 70.0, 'displayValue': '70'}",
  g.neutral = true,
  g.venue = "State Farm Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 71.0, 'displayValue': '71'}-{'value': 70.0, 'displayValue': '70'}", date: "2025-12-20", neutral: true}]->(l);

// Nebraska Cornhuskers at Ohio State Buckeyes
MATCH (w:Team {espn_id: "158"}), (l:Team {espn_id: "194"})
MERGE (g:Game {id: "401825420"}) ON CREATE SET
  g.name = "Nebraska Cornhuskers at Ohio State Buckeyes",
  g.date = "2026-01-05",
  g.score = "{'value': 72.0, 'displayValue': '72'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Value City Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 72.0, 'displayValue': '72'}-{'value': 69.0, 'displayValue': '69'}", date: "2026-01-05", neutral: false}]->(l);

// UCLA Bruins at Ohio State Buckeyes
MATCH (w:Team {espn_id: "194"}), (l:Team {espn_id: "26"})
MERGE (g:Game {id: "401825449"}) ON CREATE SET
  g.name = "UCLA Bruins at Ohio State Buckeyes",
  g.date = "2026-01-17",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 74.0, 'displayValue': '74'}",
  g.neutral = false,
  g.venue = "Value City Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 74.0, 'displayValue': '74'}", date: "2026-01-17", neutral: false}]->(l);

// Ohio State Buckeyes at Michigan Wolverines
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "194"})
MERGE (g:Game {id: "401825464"}) ON CREATE SET
  g.name = "Ohio State Buckeyes at Michigan Wolverines",
  g.date = "2026-01-24",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 62.0, 'displayValue': '62'}",
  g.neutral = false,
  g.venue = "Crisler Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 62.0, 'displayValue': '62'}", date: "2026-01-24", neutral: false}]->(l);

// Ohio State Buckeyes at Wisconsin Badgers
MATCH (w:Team {espn_id: "275"}), (l:Team {espn_id: "194"})
MERGE (g:Game {id: "401825485"}) ON CREATE SET
  g.name = "Ohio State Buckeyes at Wisconsin Badgers",
  g.date = "2026-01-31",
  g.score = "{'value': 92.0, 'displayValue': '92'}-{'value': 82.0, 'displayValue': '82'}",
  g.neutral = false,
  g.venue = "Kohl Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 92.0, 'displayValue': '92'}-{'value': 82.0, 'displayValue': '82'}", date: "2026-01-31", neutral: false}]->(l);

// Michigan Wolverines at Ohio State Buckeyes
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "194"})
MERGE (g:Game {id: "401825503"}) ON CREATE SET
  g.name = "Michigan Wolverines at Ohio State Buckeyes",
  g.date = "2026-02-08",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = false,
  g.venue = "Value City Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 61.0, 'displayValue': '61'}", date: "2026-02-08", neutral: false}]->(l);

// Virginia Cavaliers at Ohio State Buckeyes
MATCH (w:Team {espn_id: "258"}), (l:Team {espn_id: "194"})
MERGE (g:Game {id: "401817516"}) ON CREATE SET
  g.name = "Virginia Cavaliers at Ohio State Buckeyes",
  g.date = "2026-02-15",
  g.score = "{'value': 70.0, 'displayValue': '70'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = true,
  g.venue = "Bridgestone Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 70.0, 'displayValue': '70'}-{'value': 66.0, 'displayValue': '66'}", date: "2026-02-15", neutral: true}]->(l);

// Wisconsin Badgers at Ohio State Buckeyes
MATCH (w:Team {espn_id: "194"}), (l:Team {espn_id: "275"})
MERGE (g:Game {id: "401825522"}) ON CREATE SET
  g.name = "Wisconsin Badgers at Ohio State Buckeyes",
  g.date = "2026-02-18",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Value City Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 69.0, 'displayValue': '69'}", date: "2026-02-18", neutral: false}]->(l);

// Ohio State Buckeyes at Michigan State Spartans
MATCH (w:Team {espn_id: "127"}), (l:Team {espn_id: "194"})
MERGE (g:Game {id: "401825534"}) ON CREATE SET
  g.name = "Ohio State Buckeyes at Michigan State Spartans",
  g.date = "2026-02-22",
  g.score = "{'value': 66.0, 'displayValue': '66'}-{'value': 60.0, 'displayValue': '60'}",
  g.neutral = false,
  g.venue = "Breslin Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 66.0, 'displayValue': '66'}-{'value': 60.0, 'displayValue': '60'}", date: "2026-02-22", neutral: false}]->(l);

// Ohio State Buckeyes at Iowa Hawkeyes
MATCH (w:Team {espn_id: "2294"}), (l:Team {espn_id: "194"})
MERGE (g:Game {id: "401825540"}) ON CREATE SET
  g.name = "Ohio State Buckeyes at Iowa Hawkeyes",
  g.date = "2026-02-26",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 57.0, 'displayValue': '57'}",
  g.neutral = false,
  g.venue = "Carver-Hawkeye Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 57.0, 'displayValue': '57'}", date: "2026-02-26", neutral: false}]->(l);

// Purdue Boilermakers at Ohio State Buckeyes
MATCH (w:Team {espn_id: "194"}), (l:Team {espn_id: "2509"})
MERGE (g:Game {id: "401825552"}) ON CREATE SET
  g.name = "Purdue Boilermakers at Ohio State Buckeyes",
  g.date = "2026-03-01",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 74.0, 'displayValue': '74'}",
  g.neutral = false,
  g.venue = "Value City Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 74.0, 'displayValue': '74'}", date: "2026-03-01", neutral: false}]->(l);

// Arkansas Razorbacks at Michigan State Spartans
MATCH (w:Team {espn_id: "127"}), (l:Team {espn_id: "8"})
MERGE (g:Game {id: "401826785"}) ON CREATE SET
  g.name = "Arkansas Razorbacks at Michigan State Spartans",
  g.date = "2025-11-09",
  g.score = "{'value': 69.0, 'displayValue': '69'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = false,
  g.venue = "Breslin Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 69.0, 'displayValue': '69'}-{'value': 66.0, 'displayValue': '66'}", date: "2025-11-09", neutral: false}]->(l);

// Louisville Cardinals at Arkansas Razorbacks
MATCH (w:Team {espn_id: "8"}), (l:Team {espn_id: "97"})
MERGE (g:Game {id: "401806374"}) ON CREATE SET
  g.name = "Louisville Cardinals at Arkansas Razorbacks",
  g.date = "2025-12-04",
  g.score = "{'value': 89.0, 'displayValue': '89'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "Bud Walton Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 89.0, 'displayValue': '89'}-{'value': 80.0, 'displayValue': '80'}", date: "2025-12-04", neutral: false}]->(l);

// Texas Tech Red Raiders at Arkansas Razorbacks
MATCH (w:Team {espn_id: "8"}), (l:Team {espn_id: "2641"})
MERGE (g:Game {id: "401826789"}) ON CREATE SET
  g.name = "Texas Tech Red Raiders at Arkansas Razorbacks",
  g.date = "2025-12-13",
  g.score = "{'value': 93.0, 'displayValue': '93'}-{'value': 86.0, 'displayValue': '86'}",
  g.neutral = true,
  g.venue = "American Airlines Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 93.0, 'displayValue': '93'}-{'value': 86.0, 'displayValue': '86'}", date: "2025-12-13", neutral: true}]->(l);

// Houston Cougars at Arkansas Razorbacks
MATCH (w:Team {espn_id: "248"}), (l:Team {espn_id: "8"})
MERGE (g:Game {id: "401820294"}) ON CREATE SET
  g.name = "Houston Cougars at Arkansas Razorbacks",
  g.date = "2025-12-20",
  g.score = "{'value': 94.0, 'displayValue': '94'}-{'value': 85.0, 'displayValue': '85'}",
  g.neutral = true,
  g.venue = "Prudential Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 94.0, 'displayValue': '94'}-{'value': 85.0, 'displayValue': '85'}", date: "2025-12-20", neutral: true}]->(l);

// Tennessee Volunteers at Arkansas Razorbacks
MATCH (w:Team {espn_id: "8"}), (l:Team {espn_id: "2633"})
MERGE (g:Game {id: "401808145"}) ON CREATE SET
  g.name = "Tennessee Volunteers at Arkansas Razorbacks",
  g.date = "2026-01-03",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 75.0, 'displayValue': '75'}",
  g.neutral = false,
  g.venue = "Bud Walton Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 75.0, 'displayValue': '75'}", date: "2026-01-03", neutral: false}]->(l);

// Vanderbilt Commodores at Arkansas Razorbacks
MATCH (w:Team {espn_id: "8"}), (l:Team {espn_id: "238"})
MERGE (g:Game {id: "401808188"}) ON CREATE SET
  g.name = "Vanderbilt Commodores at Arkansas Razorbacks",
  g.date = "2026-01-21",
  g.score = "{'value': 93.0, 'displayValue': '93'}-{'value': 68.0, 'displayValue': '68'}",
  g.neutral = false,
  g.venue = "Bud Walton Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 93.0, 'displayValue': '93'}-{'value': 68.0, 'displayValue': '68'}", date: "2026-01-21", neutral: false}]->(l);

// Kentucky Wildcats at Arkansas Razorbacks
MATCH (w:Team {espn_id: "96"}), (l:Team {espn_id: "8"})
MERGE (g:Game {id: "401808207"}) ON CREATE SET
  g.name = "Kentucky Wildcats at Arkansas Razorbacks",
  g.date = "2026-01-31",
  g.score = "{'value': 85.0, 'displayValue': '85'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = false,
  g.venue = "Bud Walton Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 85.0, 'displayValue': '85'}-{'value': 77.0, 'displayValue': '77'}", date: "2026-01-31", neutral: false}]->(l);

// Arkansas Razorbacks at Alabama Crimson Tide
MATCH (w:Team {espn_id: "333"}), (l:Team {espn_id: "8"})
MERGE (g:Game {id: "401808244"}) ON CREATE SET
  g.name = "Arkansas Razorbacks at Alabama Crimson Tide",
  g.date = "2026-02-19",
  g.score = "{'value': 117.0, 'displayValue': '117'}-{'value': 115.0, 'displayValue': '115'}",
  g.neutral = false,
  g.venue = "Coleman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 117.0, 'displayValue': '117'}-{'value': 115.0, 'displayValue': '115'}", date: "2026-02-19", neutral: false}]->(l);

// Missouri Tigers at Arkansas Razorbacks
MATCH (w:Team {espn_id: "8"}), (l:Team {espn_id: "142"})
MERGE (g:Game {id: "401808249"}) ON CREATE SET
  g.name = "Missouri Tigers at Arkansas Razorbacks",
  g.date = "2026-02-21",
  g.score = "{'value': 94.0, 'displayValue': '94'}-{'value': 86.0, 'displayValue': '86'}",
  g.neutral = false,
  g.venue = "Bud Walton Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 94.0, 'displayValue': '94'}-{'value': 86.0, 'displayValue': '86'}", date: "2026-02-21", neutral: false}]->(l);

// Texas A&M Aggies at Arkansas Razorbacks
MATCH (w:Team {espn_id: "8"}), (l:Team {espn_id: "245"})
MERGE (g:Game {id: "401808259"}) ON CREATE SET
  g.name = "Texas A&M Aggies at Arkansas Razorbacks",
  g.date = "2026-02-26",
  g.score = "{'value': 99.0, 'displayValue': '99'}-{'value': 84.0, 'displayValue': '84'}",
  g.neutral = false,
  g.venue = "Bud Walton Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 99.0, 'displayValue': '99'}-{'value': 84.0, 'displayValue': '84'}", date: "2026-02-26", neutral: false}]->(l);

// Arkansas Razorbacks at Florida Gators
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "8"})
MERGE (g:Game {id: "401808266"}) ON CREATE SET
  g.name = "Arkansas Razorbacks at Florida Gators",
  g.date = "2026-03-01",
  g.score = "{'value': 111.0, 'displayValue': '111'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = false,
  g.venue = "Stephen C. O'Connell Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 111.0, 'displayValue': '111'}-{'value': 77.0, 'displayValue': '77'}", date: "2026-03-01", neutral: false}]->(l);

// Texas Longhorns at Arkansas Razorbacks
MATCH (w:Team {espn_id: "8"}), (l:Team {espn_id: "251"})
MERGE (g:Game {id: "401808273"}) ON CREATE SET
  g.name = "Texas Longhorns at Arkansas Razorbacks",
  g.date = "2026-03-05",
  g.score = "{'value': 105.0, 'displayValue': '105'}-{'value': 85.0, 'displayValue': '85'}",
  g.neutral = false,
  g.venue = "Bud Walton Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 105.0, 'displayValue': '105'}-{'value': 85.0, 'displayValue': '85'}", date: "2026-03-05", neutral: false}]->(l);

// Arkansas Razorbacks at Missouri Tigers
MATCH (w:Team {espn_id: "8"}), (l:Team {espn_id: "142"})
MERGE (g:Game {id: "401808285"}) ON CREATE SET
  g.name = "Arkansas Razorbacks at Missouri Tigers",
  g.date = "2026-03-07",
  g.score = "{'value': 88.0, 'displayValue': '88'}-{'value': 84.0, 'displayValue': '84'}",
  g.neutral = false,
  g.venue = "Mizzou Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 88.0, 'displayValue': '88'}-{'value': 84.0, 'displayValue': '84'}", date: "2026-03-07", neutral: false}]->(l);

// South Florida Bulls at VCU Rams
MATCH (w:Team {espn_id: "2670"}), (l:Team {espn_id: "58"})
MERGE (g:Game {id: "401822738"}) ON CREATE SET
  g.name = "South Florida Bulls at VCU Rams",
  g.date = "2025-11-26",
  g.score = "{'value': 78.0, 'displayValue': '78'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = true,
  g.venue = "Imperial Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 78.0, 'displayValue': '78'}-{'value': 66.0, 'displayValue': '66'}", date: "2025-11-26", neutral: true}]->(l);

// Utah State Aggies at South Florida Bulls
MATCH (w:Team {espn_id: "58"}), (l:Team {espn_id: "328"})
MERGE (g:Game {id: "401826835"}) ON CREATE SET
  g.name = "Utah State Aggies at South Florida Bulls",
  g.date = "2025-12-05",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = false,
  g.venue = "Yuengling Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 61.0, 'displayValue': '61'}", date: "2025-12-05", neutral: false}]->(l);

// South Florida Bulls at Alabama Crimson Tide
MATCH (w:Team {espn_id: "333"}), (l:Team {espn_id: "58"})
MERGE (g:Game {id: "401812267"}) ON CREATE SET
  g.name = "South Florida Bulls at Alabama Crimson Tide",
  g.date = "2025-12-18",
  g.score = "{'value': 104.0, 'displayValue': '104'}-{'value': 93.0, 'displayValue': '93'}",
  g.neutral = false,
  g.venue = "Coleman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 104.0, 'displayValue': '104'}-{'value': 93.0, 'displayValue': '93'}", date: "2025-12-18", neutral: false}]->(l);

// Charlotte 49ers at South Florida Bulls
MATCH (w:Team {espn_id: "58"}), (l:Team {espn_id: "2429"})
MERGE (g:Game {id: "401828263"}) ON CREATE SET
  g.name = "Charlotte 49ers at South Florida Bulls",
  g.date = "2026-03-08",
  g.score = "{'value': 83.0, 'displayValue': '83'}-{'value': 60.0, 'displayValue': '60'}",
  g.neutral = false,
  g.venue = "Yuengling Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 83.0, 'displayValue': '83'}-{'value': 60.0, 'displayValue': '60'}", date: "2026-03-08", neutral: false}]->(l);

// Texas Tech Red Raiders at Illinois Fighting Illini
MATCH (w:Team {espn_id: "356"}), (l:Team {espn_id: "2641"})
MERGE (g:Game {id: "401811097"}) ON CREATE SET
  g.name = "Texas Tech Red Raiders at Illinois Fighting Illini",
  g.date = "2025-11-12",
  g.score = "{'value': 81.0, 'displayValue': '81'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = false,
  g.venue = "State Farm Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 81.0, 'displayValue': '81'}-{'value': 77.0, 'displayValue': '77'}", date: "2025-11-12", neutral: false}]->(l);

// Texas Tech Red Raiders at Purdue Boilermakers
MATCH (w:Team {espn_id: "2509"}), (l:Team {espn_id: "2641"})
MERGE (g:Game {id: "401823637"}) ON CREATE SET
  g.name = "Texas Tech Red Raiders at Purdue Boilermakers",
  g.date = "2025-11-22",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 56.0, 'displayValue': '56'}",
  g.neutral = true,
  g.venue = "Baha Mar Convention Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 56.0, 'displayValue': '56'}", date: "2025-11-22", neutral: true}]->(l);

// Texas Tech Red Raiders at Houston Cougars
MATCH (w:Team {espn_id: "248"}), (l:Team {espn_id: "2641"})
MERGE (g:Game {id: "401827600"}) ON CREATE SET
  g.name = "Texas Tech Red Raiders at Houston Cougars",
  g.date = "2026-01-07",
  g.score = "{'value': 69.0, 'displayValue': '69'}-{'value': 65.0, 'displayValue': '65'}",
  g.neutral = false,
  g.venue = "Fertitta Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 69.0, 'displayValue': '69'}-{'value': 65.0, 'displayValue': '65'}", date: "2026-01-07", neutral: false}]->(l);

// BYU Cougars at Texas Tech Red Raiders
MATCH (w:Team {espn_id: "2641"}), (l:Team {espn_id: "252"})
MERGE (g:Game {id: "401827628"}) ON CREATE SET
  g.name = "BYU Cougars at Texas Tech Red Raiders",
  g.date = "2026-01-18",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 71.0, 'displayValue': '71'}",
  g.neutral = false,
  g.venue = "United Supermarkets Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 71.0, 'displayValue': '71'}", date: "2026-01-18", neutral: false}]->(l);

// Houston Cougars at Texas Tech Red Raiders
MATCH (w:Team {espn_id: "2641"}), (l:Team {espn_id: "248"})
MERGE (g:Game {id: "401827646"}) ON CREATE SET
  g.name = "Houston Cougars at Texas Tech Red Raiders",
  g.date = "2026-01-24",
  g.score = "{'value': 90.0, 'displayValue': '90'}-{'value': 86.0, 'displayValue': '86'}",
  g.neutral = false,
  g.venue = "United Supermarkets Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 90.0, 'displayValue': '90'}-{'value': 86.0, 'displayValue': '86'}", date: "2026-01-24", neutral: false}]->(l);

// Texas Tech Red Raiders at UCF Knights
MATCH (w:Team {espn_id: "2116"}), (l:Team {espn_id: "2641"})
MERGE (g:Game {id: "401827653"}) ON CREATE SET
  g.name = "Texas Tech Red Raiders at UCF Knights",
  g.date = "2026-01-31",
  g.score = "{'value': 88.0, 'displayValue': '88'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "Addition Financial Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 88.0, 'displayValue': '88'}-{'value': 80.0, 'displayValue': '80'}", date: "2026-01-31", neutral: false}]->(l);

// Kansas Jayhawks at Texas Tech Red Raiders
MATCH (w:Team {espn_id: "2305"}), (l:Team {espn_id: "2641"})
MERGE (g:Game {id: "401820817"}) ON CREATE SET
  g.name = "Kansas Jayhawks at Texas Tech Red Raiders",
  g.date = "2026-02-03",
  g.score = "{'value': 64.0, 'displayValue': '64'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = false,
  g.venue = "United Supermarkets Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 64.0, 'displayValue': '64'}-{'value': 61.0, 'displayValue': '61'}", date: "2026-02-03", neutral: false}]->(l);

// Texas Tech Red Raiders at Arizona Wildcats
MATCH (w:Team {espn_id: "2641"}), (l:Team {espn_id: "12"})
MERGE (g:Game {id: "401827679"}) ON CREATE SET
  g.name = "Texas Tech Red Raiders at Arizona Wildcats",
  g.date = "2026-02-14",
  g.score = "{'value': 78.0, 'displayValue': '78'}-{'value': 75.0, 'displayValue': '75'}",
  g.neutral = false,
  g.venue = "McKale Center at ALKEME Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 78.0, 'displayValue': '78'}-{'value': 75.0, 'displayValue': '75'}", date: "2026-02-14", neutral: false}]->(l);

// Texas Tech Red Raiders at Iowa State Cyclones
MATCH (w:Team {espn_id: "2641"}), (l:Team {espn_id: "66"})
MERGE (g:Game {id: "401827712"}) ON CREATE SET
  g.name = "Texas Tech Red Raiders at Iowa State Cyclones",
  g.date = "2026-02-28",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 73.0, 'displayValue': '73'}",
  g.neutral = false,
  g.venue = "Hilton Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 73.0, 'displayValue': '73'}", date: "2026-02-28", neutral: false}]->(l);

// TCU Horned Frogs at Texas Tech Red Raiders
MATCH (w:Team {espn_id: "2628"}), (l:Team {espn_id: "2641"})
MERGE (g:Game {id: "401827719"}) ON CREATE SET
  g.name = "TCU Horned Frogs at Texas Tech Red Raiders",
  g.date = "2026-03-04",
  g.score = "{'value': 73.0, 'displayValue': '73'}-{'value': 65.0, 'displayValue': '65'}",
  g.neutral = false,
  g.venue = "United Supermarkets Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 73.0, 'displayValue': '73'}-{'value': 65.0, 'displayValue': '65'}", date: "2026-03-04", neutral: false}]->(l);

// Texas Tech Red Raiders at BYU Cougars
MATCH (w:Team {espn_id: "252"}), (l:Team {espn_id: "2641"})
MERGE (g:Game {id: "401827724"}) ON CREATE SET
  g.name = "Texas Tech Red Raiders at BYU Cougars",
  g.date = "2026-03-08",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 76.0, 'displayValue': '76'}",
  g.neutral = false,
  g.venue = "Marriott Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 76.0, 'displayValue': '76'}", date: "2026-03-08", neutral: false}]->(l);

// Wisconsin Badgers at BYU Cougars
MATCH (w:Team {espn_id: "252"}), (l:Team {espn_id: "275"})
MERGE (g:Game {id: "401819836"}) ON CREATE SET
  g.name = "Wisconsin Badgers at BYU Cougars",
  g.date = "2025-11-21",
  g.score = "{'value': 98.0, 'displayValue': '98'}-{'value': 70.0, 'displayValue': '70'}",
  g.neutral = false,
  g.venue = "Delta Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 98.0, 'displayValue': '98'}-{'value': 70.0, 'displayValue': '70'}", date: "2025-11-21", neutral: false}]->(l);

// Wisconsin Badgers at TCU Horned Frogs
MATCH (w:Team {espn_id: "2628"}), (l:Team {espn_id: "275"})
MERGE (g:Game {id: "401831224"}) ON CREATE SET
  g.name = "Wisconsin Badgers at TCU Horned Frogs",
  g.date = "2025-11-28",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 63.0, 'displayValue': '63'}",
  g.neutral = true,
  g.venue = "Jenny Craig Pavilion"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 63.0, 'displayValue': '63'}", date: "2025-11-28", neutral: true}]->(l);

// Wisconsin Badgers at Nebraska Cornhuskers
MATCH (w:Team {espn_id: "158"}), (l:Team {espn_id: "275"})
MERGE (g:Game {id: "401825405"}) ON CREATE SET
  g.name = "Wisconsin Badgers at Nebraska Cornhuskers",
  g.date = "2025-12-11",
  g.score = "{'value': 90.0, 'displayValue': '90'}-{'value': 60.0, 'displayValue': '60'}",
  g.neutral = false,
  g.venue = "Pinnacle Bank Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 90.0, 'displayValue': '90'}-{'value': 60.0, 'displayValue': '60'}", date: "2025-12-11", neutral: false}]->(l);

// Wisconsin Badgers at Villanova Wildcats
MATCH (w:Team {espn_id: "222"}), (l:Team {espn_id: "275"})
MERGE (g:Game {id: "401823567"}) ON CREATE SET
  g.name = "Wisconsin Badgers at Villanova Wildcats",
  g.date = "2025-12-20",
  g.score = "{'value': 76.0, 'displayValue': '76'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = true,
  g.venue = "Fiserv Forum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 76.0, 'displayValue': '76'}-{'value': 66.0, 'displayValue': '66'}", date: "2025-12-20", neutral: true}]->(l);

// Purdue Boilermakers at Wisconsin Badgers
MATCH (w:Team {espn_id: "2509"}), (l:Team {espn_id: "275"})
MERGE (g:Game {id: "401825417"}) ON CREATE SET
  g.name = "Purdue Boilermakers at Wisconsin Badgers",
  g.date = "2026-01-04",
  g.score = "{'value': 89.0, 'displayValue': '89'}-{'value': 73.0, 'displayValue': '73'}",
  g.neutral = false,
  g.venue = "Kohl Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 89.0, 'displayValue': '89'}-{'value': 73.0, 'displayValue': '73'}", date: "2026-01-04", neutral: false}]->(l);

// UCLA Bruins at Wisconsin Badgers
MATCH (w:Team {espn_id: "275"}), (l:Team {espn_id: "26"})
MERGE (g:Game {id: "401825424"}) ON CREATE SET
  g.name = "UCLA Bruins at Wisconsin Badgers",
  g.date = "2026-01-07",
  g.score = "{'value': 80.0, 'displayValue': '80'}-{'value': 72.0, 'displayValue': '72'}",
  g.neutral = false,
  g.venue = "Kohl Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 80.0, 'displayValue': '80'}-{'value': 72.0, 'displayValue': '72'}", date: "2026-01-07", neutral: false}]->(l);

// Wisconsin Badgers at Michigan Wolverines
MATCH (w:Team {espn_id: "275"}), (l:Team {espn_id: "130"})
MERGE (g:Game {id: "401825432"}) ON CREATE SET
  g.name = "Wisconsin Badgers at Michigan Wolverines",
  g.date = "2026-01-10",
  g.score = "{'value': 91.0, 'displayValue': '91'}-{'value': 88.0, 'displayValue': '88'}",
  g.neutral = false,
  g.venue = "Crisler Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 91.0, 'displayValue': '91'}-{'value': 88.0, 'displayValue': '88'}", date: "2026-01-10", neutral: false}]->(l);

// Wisconsin Badgers at Illinois Fighting Illini
MATCH (w:Team {espn_id: "275"}), (l:Team {espn_id: "356"})
MERGE (g:Game {id: "401825506"}) ON CREATE SET
  g.name = "Wisconsin Badgers at Illinois Fighting Illini",
  g.date = "2026-02-11",
  g.score = "{'value': 92.0, 'displayValue': '92'}-{'value': 90.0, 'displayValue': '90'}",
  g.neutral = false,
  g.venue = "State Farm Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 92.0, 'displayValue': '92'}-{'value': 90.0, 'displayValue': '90'}", date: "2026-02-11", neutral: false}]->(l);

// Michigan State Spartans at Wisconsin Badgers
MATCH (w:Team {espn_id: "275"}), (l:Team {espn_id: "127"})
MERGE (g:Game {id: "401825512"}) ON CREATE SET
  g.name = "Michigan State Spartans at Wisconsin Badgers",
  g.date = "2026-02-14",
  g.score = "{'value': 92.0, 'displayValue': '92'}-{'value': 71.0, 'displayValue': '71'}",
  g.neutral = false,
  g.venue = "Kohl Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 92.0, 'displayValue': '92'}-{'value': 71.0, 'displayValue': '71'}", date: "2026-02-14", neutral: false}]->(l);

// Iowa Hawkeyes at Wisconsin Badgers
MATCH (w:Team {espn_id: "275"}), (l:Team {espn_id: "2294"})
MERGE (g:Game {id: "401825535"}) ON CREATE SET
  g.name = "Iowa Hawkeyes at Wisconsin Badgers",
  g.date = "2026-02-22",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 71.0, 'displayValue': '71'}",
  g.neutral = false,
  g.venue = "Kohl Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 71.0, 'displayValue': '71'}", date: "2026-02-22", neutral: false}]->(l);

// Wisconsin Badgers at Purdue Boilermakers
MATCH (w:Team {espn_id: "275"}), (l:Team {espn_id: "2509"})
MERGE (g:Game {id: "401825565"}) ON CREATE SET
  g.name = "Wisconsin Badgers at Purdue Boilermakers",
  g.date = "2026-03-07",
  g.score = "{'value': 97.0, 'displayValue': '97'}-{'value': 93.0, 'displayValue': '93'}",
  g.neutral = false,
  g.venue = "Mackey Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 97.0, 'displayValue': '97'}-{'value': 93.0, 'displayValue': '93'}", date: "2026-03-07", neutral: false}]->(l);

// SMU Mustangs at Vanderbilt Commodores
MATCH (w:Team {espn_id: "238"}), (l:Team {espn_id: "2567"})
MERGE (g:Game {id: "401806375"}) ON CREATE SET
  g.name = "SMU Mustangs at Vanderbilt Commodores",
  g.date = "2025-12-04",
  g.score = "{'value': 88.0, 'displayValue': '88'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Memorial Gymnasium (TN)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 88.0, 'displayValue': '88'}-{'value': 69.0, 'displayValue': '69'}", date: "2025-12-04", neutral: false}]->(l);

// Texas A&M Aggies at SMU Mustangs
MATCH (w:Team {espn_id: "2567"}), (l:Team {espn_id: "245"})
MERGE (g:Game {id: "401817460"}) ON CREATE SET
  g.name = "Texas A&M Aggies at SMU Mustangs",
  g.date = "2025-12-07",
  g.score = "{'value': 93.0, 'displayValue': '93'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = true,
  g.venue = "College Park Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 93.0, 'displayValue': '93'}-{'value': 80.0, 'displayValue': '80'}", date: "2025-12-07", neutral: true}]->(l);

// North Carolina Tar Heels at SMU Mustangs
MATCH (w:Team {espn_id: "2567"}), (l:Team {espn_id: "153"})
MERGE (g:Game {id: "401820648"}) ON CREATE SET
  g.name = "North Carolina Tar Heels at SMU Mustangs",
  g.date = "2026-01-03",
  g.score = "{'value': 97.0, 'displayValue': '97'}-{'value': 83.0, 'displayValue': '83'}",
  g.neutral = false,
  g.venue = "Moody Coliseum (Dallas)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 97.0, 'displayValue': '97'}-{'value': 83.0, 'displayValue': '83'}", date: "2026-01-03", neutral: false}]->(l);

// SMU Mustangs at Clemson Tigers
MATCH (w:Team {espn_id: "228"}), (l:Team {espn_id: "2567"})
MERGE (g:Game {id: "401820652"}) ON CREATE SET
  g.name = "SMU Mustangs at Clemson Tigers",
  g.date = "2026-01-08",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 70.0, 'displayValue': '70'}",
  g.neutral = false,
  g.venue = "Littlejohn Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 70.0, 'displayValue': '70'}", date: "2026-01-08", neutral: false}]->(l);

// Virginia Cavaliers at SMU Mustangs
MATCH (w:Team {espn_id: "258"}), (l:Team {espn_id: "2567"})
MERGE (g:Game {id: "401820680"}) ON CREATE SET
  g.name = "Virginia Cavaliers at SMU Mustangs",
  g.date = "2026-01-17",
  g.score = "{'value': 72.0, 'displayValue': '72'}-{'value': 68.0, 'displayValue': '68'}",
  g.neutral = false,
  g.venue = "Moody Coliseum (Dallas)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 72.0, 'displayValue': '72'}-{'value': 68.0, 'displayValue': '68'}", date: "2026-01-17", neutral: false}]->(l);

// SMU Mustangs at Louisville Cardinals
MATCH (w:Team {espn_id: "97"}), (l:Team {espn_id: "2567"})
MERGE (g:Game {id: "401820710"}) ON CREATE SET
  g.name = "SMU Mustangs at Louisville Cardinals",
  g.date = "2026-01-31",
  g.score = "{'value': 88.0, 'displayValue': '88'}-{'value': 74.0, 'displayValue': '74'}",
  g.neutral = false,
  g.venue = "KFC Yum! Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 88.0, 'displayValue': '88'}-{'value': 74.0, 'displayValue': '74'}", date: "2026-01-31", neutral: false}]->(l);

// NC State Wolfpack at SMU Mustangs
MATCH (w:Team {espn_id: "152"}), (l:Team {espn_id: "2567"})
MERGE (g:Game {id: "401820719"}) ON CREATE SET
  g.name = "NC State Wolfpack at SMU Mustangs",
  g.date = "2026-02-04",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 83.0, 'displayValue': '83'}",
  g.neutral = false,
  g.venue = "Moody Coliseum (Dallas)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 83.0, 'displayValue': '83'}", date: "2026-02-04", neutral: false}]->(l);

// Louisville Cardinals at SMU Mustangs
MATCH (w:Team {espn_id: "2567"}), (l:Team {espn_id: "97"})
MERGE (g:Game {id: "401820749"}) ON CREATE SET
  g.name = "Louisville Cardinals at SMU Mustangs",
  g.date = "2026-02-18",
  g.score = "{'value': 95.0, 'displayValue': '95'}-{'value': 85.0, 'displayValue': '85'}",
  g.neutral = false,
  g.venue = "Moody Coliseum (Dallas)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 95.0, 'displayValue': '95'}-{'value': 85.0, 'displayValue': '85'}", date: "2026-02-18", neutral: false}]->(l);

// Miami Hurricanes at SMU Mustangs
MATCH (w:Team {espn_id: "2390"}), (l:Team {espn_id: "2567"})
MERGE (g:Game {id: "401820784"}) ON CREATE SET
  g.name = "Miami Hurricanes at SMU Mustangs",
  g.date = "2026-03-05",
  g.score = "{'value': 77.0, 'displayValue': '77'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Moody Coliseum (Dallas)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 77.0, 'displayValue': '77'}-{'value': 69.0, 'displayValue': '69'}", date: "2026-03-05", neutral: false}]->(l);

// Iowa State Cyclones at St. John's Red Storm
MATCH (w:Team {espn_id: "66"}), (l:Team {espn_id: "2599"})
MERGE (g:Game {id: "401819874"}) ON CREATE SET
  g.name = "Iowa State Cyclones at St. John's Red Storm",
  g.date = "2025-11-24",
  g.score = "{'value': 83.0, 'displayValue': '83'}-{'value': 82.0, 'displayValue': '82'}",
  g.neutral = true,
  g.venue = "Michelob ULTRA Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 83.0, 'displayValue': '83'}-{'value': 82.0, 'displayValue': '82'}", date: "2025-11-24", neutral: true}]->(l);

// Iowa State Cyclones at Purdue Boilermakers
MATCH (w:Team {espn_id: "66"}), (l:Team {espn_id: "2509"})
MERGE (g:Game {id: "401819877"}) ON CREATE SET
  g.name = "Iowa State Cyclones at Purdue Boilermakers",
  g.date = "2025-12-06",
  g.score = "{'value': 81.0, 'displayValue': '81'}-{'value': 58.0, 'displayValue': '58'}",
  g.neutral = false,
  g.venue = "Mackey Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 81.0, 'displayValue': '81'}-{'value': 58.0, 'displayValue': '58'}", date: "2025-12-06", neutral: false}]->(l);

// Iowa Hawkeyes at Iowa State Cyclones
MATCH (w:Team {espn_id: "66"}), (l:Team {espn_id: "2294"})
MERGE (g:Game {id: "401819878"}) ON CREATE SET
  g.name = "Iowa Hawkeyes at Iowa State Cyclones",
  g.date = "2025-12-12",
  g.score = "{'value': 66.0, 'displayValue': '66'}-{'value': 62.0, 'displayValue': '62'}",
  g.neutral = false,
  g.venue = "Hilton Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 66.0, 'displayValue': '66'}-{'value': 62.0, 'displayValue': '62'}", date: "2025-12-12", neutral: false}]->(l);

// Iowa State Cyclones at Kansas Jayhawks
MATCH (w:Team {espn_id: "2305"}), (l:Team {espn_id: "66"})
MERGE (g:Game {id: "401827617"}) ON CREATE SET
  g.name = "Iowa State Cyclones at Kansas Jayhawks",
  g.date = "2026-01-14",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 63.0, 'displayValue': '63'}",
  g.neutral = false,
  g.venue = "Allen Fieldhouse"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 63.0, 'displayValue': '63'}", date: "2026-01-14", neutral: false}]->(l);

// UCF Knights at Iowa State Cyclones
MATCH (w:Team {espn_id: "66"}), (l:Team {espn_id: "2116"})
MERGE (g:Game {id: "401827634"}) ON CREATE SET
  g.name = "UCF Knights at Iowa State Cyclones",
  g.date = "2026-01-21",
  g.score = "{'value': 87.0, 'displayValue': '87'}-{'value': 57.0, 'displayValue': '57'}",
  g.neutral = false,
  g.venue = "Hilton Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 87.0, 'displayValue': '87'}-{'value': 57.0, 'displayValue': '57'}", date: "2026-01-21", neutral: false}]->(l);

// Iowa State Cyclones at TCU Horned Frogs
MATCH (w:Team {espn_id: "2628"}), (l:Team {espn_id: "66"})
MERGE (g:Game {id: "401827675"}) ON CREATE SET
  g.name = "Iowa State Cyclones at TCU Horned Frogs",
  g.date = "2026-02-11",
  g.score = "{'value': 62.0, 'displayValue': '62'}-{'value': 55.0, 'displayValue': '55'}",
  g.neutral = false,
  g.venue = "Schollmaier Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 62.0, 'displayValue': '62'}-{'value': 55.0, 'displayValue': '55'}", date: "2026-02-11", neutral: false}]->(l);

// Kansas Jayhawks at Iowa State Cyclones
MATCH (w:Team {espn_id: "66"}), (l:Team {espn_id: "2305"})
MERGE (g:Game {id: "401827682"}) ON CREATE SET
  g.name = "Kansas Jayhawks at Iowa State Cyclones",
  g.date = "2026-02-14",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 56.0, 'displayValue': '56'}",
  g.neutral = false,
  g.venue = "Hilton Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 56.0, 'displayValue': '56'}", date: "2026-02-14", neutral: false}]->(l);

// Houston Cougars at Iowa State Cyclones
MATCH (w:Team {espn_id: "66"}), (l:Team {espn_id: "248"})
MERGE (g:Game {id: "401820819"}) ON CREATE SET
  g.name = "Houston Cougars at Iowa State Cyclones",
  g.date = "2026-02-17",
  g.score = "{'value': 70.0, 'displayValue': '70'}-{'value': 67.0, 'displayValue': '67'}",
  g.neutral = false,
  g.venue = "Hilton Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 70.0, 'displayValue': '70'}-{'value': 67.0, 'displayValue': '67'}", date: "2026-02-17", neutral: false}]->(l);

// Iowa State Cyclones at BYU Cougars
MATCH (w:Team {espn_id: "252"}), (l:Team {espn_id: "66"})
MERGE (g:Game {id: "401827693"}) ON CREATE SET
  g.name = "Iowa State Cyclones at BYU Cougars",
  g.date = "2026-02-22",
  g.score = "{'value': 79.0, 'displayValue': '79'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Marriott Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 79.0, 'displayValue': '79'}-{'value': 69.0, 'displayValue': '69'}", date: "2026-02-22", neutral: false}]->(l);

// Iowa State Cyclones at Arizona Wildcats
MATCH (w:Team {espn_id: "12"}), (l:Team {espn_id: "66"})
MERGE (g:Game {id: "401820821"}) ON CREATE SET
  g.name = "Iowa State Cyclones at Arizona Wildcats",
  g.date = "2026-03-03",
  g.score = "{'value': 73.0, 'displayValue': '73'}-{'value': 57.0, 'displayValue': '57'}",
  g.neutral = false,
  g.venue = "McKale Center at ALKEME Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 73.0, 'displayValue': '73'}-{'value': 57.0, 'displayValue': '57'}", date: "2026-03-03", neutral: false}]->(l);

// Miami (OH) RedHawks at Wright State Raiders
MATCH (w:Team {espn_id: "193"}), (l:Team {espn_id: "2750"})
MERGE (g:Game {id: "401823413"}) ON CREATE SET
  g.name = "Miami (OH) RedHawks at Wright State Raiders",
  g.date = "2025-12-17",
  g.score = "{'value': 83.0, 'displayValue': '83'}-{'value': 76.0, 'displayValue': '76'}",
  g.neutral = false,
  g.venue = "Nutter Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 83.0, 'displayValue': '83'}-{'value': 76.0, 'displayValue': '76'}", date: "2025-12-17", neutral: false}]->(l);

// Villanova Wildcats at BYU Cougars
MATCH (w:Team {espn_id: "252"}), (l:Team {espn_id: "222"})
MERGE (g:Game {id: "401819834"}) ON CREATE SET
  g.name = "Villanova Wildcats at BYU Cougars",
  g.date = "2025-11-04",
  g.score = "{'value': 71.0, 'displayValue': '71'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = true,
  g.venue = "T-Mobile Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 71.0, 'displayValue': '71'}-{'value': 66.0, 'displayValue': '66'}", date: "2025-11-04", neutral: true}]->(l);

// Villanova Wildcats at Michigan Wolverines
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "222"})
MERGE (g:Game {id: "401823566"}) ON CREATE SET
  g.name = "Villanova Wildcats at Michigan Wolverines",
  g.date = "2025-12-09",
  g.score = "{'value': 89.0, 'displayValue': '89'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = false,
  g.venue = "Crisler Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 89.0, 'displayValue': '89'}-{'value': 61.0, 'displayValue': '61'}", date: "2025-12-09", neutral: false}]->(l);

// St. John's Red Storm at Villanova Wildcats
MATCH (w:Team {espn_id: "2599"}), (l:Team {espn_id: "222"})
MERGE (g:Game {id: "401822905"}) ON CREATE SET
  g.name = "St. John's Red Storm at Villanova Wildcats",
  g.date = "2026-01-18",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 79.0, 'displayValue': '79'}",
  g.neutral = false,
  g.venue = "Xfinity Mobile Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 79.0, 'displayValue': '79'}", date: "2026-01-18", neutral: false}]->(l);

// Villanova Wildcats at UConn Huskies
MATCH (w:Team {espn_id: "41"}), (l:Team {espn_id: "222"})
MERGE (g:Game {id: "401822913"}) ON CREATE SET
  g.name = "Villanova Wildcats at UConn Huskies",
  g.date = "2026-01-24",
  g.score = "{'value': 75.0, 'displayValue': '75'}-{'value': 67.0, 'displayValue': '67'}",
  g.neutral = false,
  g.venue = "PeoplesBank Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 75.0, 'displayValue': '75'}-{'value': 67.0, 'displayValue': '67'}", date: "2026-01-24", neutral: false}]->(l);

// UConn Huskies at Villanova Wildcats
MATCH (w:Team {espn_id: "41"}), (l:Team {espn_id: "222"})
MERGE (g:Game {id: "401822953"}) ON CREATE SET
  g.name = "UConn Huskies at Villanova Wildcats",
  g.date = "2026-02-21",
  g.score = "{'value': 73.0, 'displayValue': '73'}-{'value': 63.0, 'displayValue': '63'}",
  g.neutral = false,
  g.venue = "Xfinity Mobile Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 73.0, 'displayValue': '73'}-{'value': 63.0, 'displayValue': '63'}", date: "2026-02-21", neutral: false}]->(l);

// Villanova Wildcats at St. John's Red Storm
MATCH (w:Team {espn_id: "2599"}), (l:Team {espn_id: "222"})
MERGE (g:Game {id: "401822962"}) ON CREATE SET
  g.name = "Villanova Wildcats at St. John's Red Storm",
  g.date = "2026-03-01",
  g.score = "{'value': 89.0, 'displayValue': '89'}-{'value': 57.0, 'displayValue': '57'}",
  g.neutral = false,
  g.venue = "Madison Square Garden"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 89.0, 'displayValue': '89'}-{'value': 57.0, 'displayValue': '57'}", date: "2026-03-01", neutral: false}]->(l);

// VCU Rams at NC State Wolfpack
MATCH (w:Team {espn_id: "152"}), (l:Team {espn_id: "2670"})
MERGE (g:Game {id: "401817255"}) ON CREATE SET
  g.name = "VCU Rams at NC State Wolfpack",
  g.date = "2025-11-18",
  g.score = "{'value': 85.0, 'displayValue': '85'}-{'value': 79.0, 'displayValue': '79'}",
  g.neutral = false,
  g.venue = "Lenovo Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 85.0, 'displayValue': '85'}-{'value': 79.0, 'displayValue': '79'}", date: "2025-11-18", neutral: false}]->(l);

// NC State Wolfpack at Texas Longhorns
MATCH (w:Team {espn_id: "251"}), (l:Team {espn_id: "152"})
MERGE (g:Game {id: "401831202"}) ON CREATE SET
  g.name = "NC State Wolfpack at Texas Longhorns",
  g.date = "2025-11-27",
  g.score = "{'value': 102.0, 'displayValue': '102'}-{'value': 97.0, 'displayValue': '97'}",
  g.neutral = true,
  g.venue = "Lahaina Civic Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 102.0, 'displayValue': '102'}-{'value': 97.0, 'displayValue': '97'}", date: "2025-11-27", neutral: true}]->(l);

// Liberty Flames at NC State Wolfpack
MATCH (w:Team {espn_id: "152"}), (l:Team {espn_id: "2335"})
MERGE (g:Game {id: "401817258"}) ON CREATE SET
  g.name = "Liberty Flames at NC State Wolfpack",
  g.date = "2025-12-11",
  g.score = "{'value': 85.0, 'displayValue': '85'}-{'value': 45.0, 'displayValue': '45'}",
  g.neutral = false,
  g.venue = "Lenovo Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 85.0, 'displayValue': '85'}-{'value': 45.0, 'displayValue': '45'}", date: "2025-12-11", neutral: false}]->(l);

// Kansas Jayhawks at NC State Wolfpack
MATCH (w:Team {espn_id: "2305"}), (l:Team {espn_id: "152"})
MERGE (g:Game {id: "401817259"}) ON CREATE SET
  g.name = "Kansas Jayhawks at NC State Wolfpack",
  g.date = "2025-12-13",
  g.score = "{'value': 77.0, 'displayValue': '77'}-{'value': 76.0, 'displayValue': '76'}",
  g.neutral = false,
  g.venue = "Lenovo Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 77.0, 'displayValue': '77'}-{'value': 76.0, 'displayValue': '76'}", date: "2025-12-13", neutral: false}]->(l);

// Virginia Cavaliers at NC State Wolfpack
MATCH (w:Team {espn_id: "258"}), (l:Team {espn_id: "152"})
MERGE (g:Game {id: "401820646"}) ON CREATE SET
  g.name = "Virginia Cavaliers at NC State Wolfpack",
  g.date = "2026-01-03",
  g.score = "{'value': 76.0, 'displayValue': '76'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = false,
  g.venue = "Lenovo Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 76.0, 'displayValue': '76'}-{'value': 61.0, 'displayValue': '61'}", date: "2026-01-03", neutral: false}]->(l);

// NC State Wolfpack at Clemson Tigers
MATCH (w:Team {espn_id: "152"}), (l:Team {espn_id: "228"})
MERGE (g:Game {id: "401820685"}) ON CREATE SET
  g.name = "NC State Wolfpack at Clemson Tigers",
  g.date = "2026-01-21",
  g.score = "{'value': 80.0, 'displayValue': '80'}-{'value': 76.0, 'displayValue': '76'}",
  g.neutral = false,
  g.venue = "Littlejohn Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 80.0, 'displayValue': '80'}-{'value': 76.0, 'displayValue': '76'}", date: "2026-01-21", neutral: false}]->(l);

// NC State Wolfpack at Louisville Cardinals
MATCH (w:Team {espn_id: "97"}), (l:Team {espn_id: "152"})
MERGE (g:Game {id: "401820730"}) ON CREATE SET
  g.name = "NC State Wolfpack at Louisville Cardinals",
  g.date = "2026-02-10",
  g.score = "{'value': 118.0, 'displayValue': '118'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = false,
  g.venue = "KFC Yum! Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 118.0, 'displayValue': '118'}-{'value': 77.0, 'displayValue': '77'}", date: "2026-02-10", neutral: false}]->(l);

// Miami Hurricanes at NC State Wolfpack
MATCH (w:Team {espn_id: "2390"}), (l:Team {espn_id: "152"})
MERGE (g:Game {id: "401820741"}) ON CREATE SET
  g.name = "Miami Hurricanes at NC State Wolfpack",
  g.date = "2026-02-14",
  g.score = "{'value': 77.0, 'displayValue': '77'}-{'value': 76.0, 'displayValue': '76'}",
  g.neutral = false,
  g.venue = "Lenovo Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 77.0, 'displayValue': '77'}-{'value': 76.0, 'displayValue': '76'}", date: "2026-02-14", neutral: false}]->(l);

// North Carolina Tar Heels at NC State Wolfpack
MATCH (w:Team {espn_id: "152"}), (l:Team {espn_id: "153"})
MERGE (g:Game {id: "401820752"}) ON CREATE SET
  g.name = "North Carolina Tar Heels at NC State Wolfpack",
  g.date = "2026-02-18",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 58.0, 'displayValue': '58'}",
  g.neutral = false,
  g.venue = "Lenovo Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 58.0, 'displayValue': '58'}", date: "2026-02-18", neutral: false}]->(l);

// NC State Wolfpack at Virginia Cavaliers
MATCH (w:Team {espn_id: "258"}), (l:Team {espn_id: "152"})
MERGE (g:Game {id: "401820763"}) ON CREATE SET
  g.name = "NC State Wolfpack at Virginia Cavaliers",
  g.date = "2026-02-25",
  g.score = "{'value': 90.0, 'displayValue': '90'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = false,
  g.venue = "John Paul Jones Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 90.0, 'displayValue': '90'}-{'value': 61.0, 'displayValue': '61'}", date: "2026-02-25", neutral: false}]->(l);

// Michigan State Spartans at Kentucky Wildcats
MATCH (w:Team {espn_id: "127"}), (l:Team {espn_id: "96"})
MERGE (g:Game {id: "401827221"}) ON CREATE SET
  g.name = "Michigan State Spartans at Kentucky Wildcats",
  g.date = "2025-11-18",
  g.score = "{'value': 83.0, 'displayValue': '83'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = true,
  g.venue = "Madison Square Garden"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 83.0, 'displayValue': '83'}-{'value': 66.0, 'displayValue': '66'}", date: "2025-11-18", neutral: true}]->(l);

// Michigan State Spartans at North Carolina Tar Heels
MATCH (w:Team {espn_id: "127"}), (l:Team {espn_id: "153"})
MERGE (g:Game {id: "401817267"}) ON CREATE SET
  g.name = "Michigan State Spartans at North Carolina Tar Heels",
  g.date = "2025-11-27",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 58.0, 'displayValue': '58'}",
  g.neutral = true,
  g.venue = "Suncoast Credit Union Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 58.0, 'displayValue': '58'}", date: "2025-11-27", neutral: true}]->(l);

// Iowa Hawkeyes at Michigan State Spartans
MATCH (w:Team {espn_id: "127"}), (l:Team {espn_id: "2294"})
MERGE (g:Game {id: "401825392"}) ON CREATE SET
  g.name = "Iowa Hawkeyes at Michigan State Spartans",
  g.date = "2025-12-03",
  g.score = "{'value': 71.0, 'displayValue': '71'}-{'value': 52.0, 'displayValue': '52'}",
  g.neutral = false,
  g.venue = "Breslin Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 71.0, 'displayValue': '71'}-{'value': 52.0, 'displayValue': '52'}", date: "2025-12-03", neutral: false}]->(l);

// Michigan State Spartans at Nebraska Cornhuskers
MATCH (w:Team {espn_id: "158"}), (l:Team {espn_id: "127"})
MERGE (g:Game {id: "401825412"}) ON CREATE SET
  g.name = "Michigan State Spartans at Nebraska Cornhuskers",
  g.date = "2026-01-03",
  g.score = "{'value': 58.0, 'displayValue': '58'}-{'value': 56.0, 'displayValue': '56'}",
  g.neutral = false,
  g.venue = "Pinnacle Bank Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 58.0, 'displayValue': '58'}-{'value': 56.0, 'displayValue': '56'}", date: "2026-01-03", neutral: false}]->(l);

// Michigan Wolverines at Michigan State Spartans
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "127"})
MERGE (g:Game {id: "401825481"}) ON CREATE SET
  g.name = "Michigan Wolverines at Michigan State Spartans",
  g.date = "2026-01-31",
  g.score = "{'value': 83.0, 'displayValue': '83'}-{'value': 71.0, 'displayValue': '71'}",
  g.neutral = false,
  g.venue = "Breslin Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 83.0, 'displayValue': '83'}-{'value': 71.0, 'displayValue': '71'}", date: "2026-01-31", neutral: false}]->(l);

// Illinois Fighting Illini at Michigan State Spartans
MATCH (w:Team {espn_id: "127"}), (l:Team {espn_id: "356"})
MERGE (g:Game {id: "401830778"}) ON CREATE SET
  g.name = "Illinois Fighting Illini at Michigan State Spartans",
  g.date = "2026-02-08",
  g.score = "{'value': 85.0, 'displayValue': '85'}-{'value': 82.0, 'displayValue': '82'}",
  g.neutral = false,
  g.venue = "Breslin Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 85.0, 'displayValue': '85'}-{'value': 82.0, 'displayValue': '82'}", date: "2026-02-08", neutral: false}]->(l);

// UCLA Bruins at Michigan State Spartans
MATCH (w:Team {espn_id: "127"}), (l:Team {espn_id: "26"})
MERGE (g:Game {id: "401825521"}) ON CREATE SET
  g.name = "UCLA Bruins at Michigan State Spartans",
  g.date = "2026-02-18",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 59.0, 'displayValue': '59'}",
  g.neutral = false,
  g.venue = "Breslin Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 59.0, 'displayValue': '59'}", date: "2026-02-18", neutral: false}]->(l);

// Michigan State Spartans at Purdue Boilermakers
MATCH (w:Team {espn_id: "127"}), (l:Team {espn_id: "2509"})
MERGE (g:Game {id: "401825543"}) ON CREATE SET
  g.name = "Michigan State Spartans at Purdue Boilermakers",
  g.date = "2026-02-27",
  g.score = "{'value': 76.0, 'displayValue': '76'}-{'value': 74.0, 'displayValue': '74'}",
  g.neutral = false,
  g.venue = "Mackey Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 76.0, 'displayValue': '76'}-{'value': 74.0, 'displayValue': '74'}", date: "2026-02-27", neutral: false}]->(l);

// Michigan State Spartans at Michigan Wolverines
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "127"})
MERGE (g:Game {id: "401825568"}) ON CREATE SET
  g.name = "Michigan State Spartans at Michigan Wolverines",
  g.date = "2026-03-08",
  g.score = "{'value': 90.0, 'displayValue': '90'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "Crisler Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 90.0, 'displayValue': '90'}-{'value': 80.0, 'displayValue': '80'}", date: "2026-03-08", neutral: false}]->(l);

// North Carolina A&T Aggies at Charlotte 49ers
MATCH (w:Team {espn_id: "2429"}), (l:Team {espn_id: "2448"})
MERGE (g:Game {id: "401820801"}) ON CREATE SET
  g.name = "North Carolina A&T Aggies at Charlotte 49ers",
  g.date = "2025-12-03",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 57.0, 'displayValue': '57'}",
  g.neutral = false,
  g.venue = "Halton Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 57.0, 'displayValue': '57'}", date: "2025-12-03", neutral: false}]->(l);

// Utah State Aggies at Charlotte 49ers
MATCH (w:Team {espn_id: "328"}), (l:Team {espn_id: "2429"})
MERGE (g:Game {id: "401820802"}) ON CREATE SET
  g.name = "Utah State Aggies at Charlotte 49ers",
  g.date = "2025-12-07",
  g.score = "{'value': 79.0, 'displayValue': '79'}-{'value': 53.0, 'displayValue': '53'}",
  g.neutral = false,
  g.venue = "Halton Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 79.0, 'displayValue': '79'}-{'value': 53.0, 'displayValue': '53'}", date: "2025-12-07", neutral: false}]->(l);

// Florida Gators at Arizona Wildcats
MATCH (w:Team {espn_id: "12"}), (l:Team {espn_id: "57"})
MERGE (g:Game {id: "401826885"}) ON CREATE SET
  g.name = "Florida Gators at Arizona Wildcats",
  g.date = "2025-11-04",
  g.score = "{'value': 93.0, 'displayValue': '93'}-{'value': 87.0, 'displayValue': '87'}",
  g.neutral = true,
  g.venue = "T-Mobile Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 93.0, 'displayValue': '93'}-{'value': 87.0, 'displayValue': '87'}", date: "2025-11-04", neutral: true}]->(l);

// Miami Hurricanes at Florida Gators
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "2390"})
MERGE (g:Game {id: "401809416"}) ON CREATE SET
  g.name = "Miami Hurricanes at Florida Gators",
  g.date = "2025-11-17",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 68.0, 'displayValue': '68'}",
  g.neutral = true,
  g.venue = "Veterans Memorial Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 68.0, 'displayValue': '68'}", date: "2025-11-17", neutral: true}]->(l);

// Merrimack Warriors at Florida Gators
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "2771"})
MERGE (g:Game {id: "401827489"}) ON CREATE SET
  g.name = "Merrimack Warriors at Florida Gators",
  g.date = "2025-11-22",
  g.score = "{'value': 80.0, 'displayValue': '80'}-{'value': 45.0, 'displayValue': '45'}",
  g.neutral = false,
  g.venue = "Stephen C. O'Connell Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 80.0, 'displayValue': '80'}-{'value': 45.0, 'displayValue': '45'}", date: "2025-11-22", neutral: false}]->(l);

// TCU Horned Frogs at Florida Gators
MATCH (w:Team {espn_id: "2628"}), (l:Team {espn_id: "57"})
MERGE (g:Game {id: "401809047"}) ON CREATE SET
  g.name = "TCU Horned Frogs at Florida Gators",
  g.date = "2025-11-27",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = true,
  g.venue = "Jenny Craig Pavilion"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 80.0, 'displayValue': '80'}", date: "2025-11-27", neutral: true}]->(l);

// Florida Gators at UConn Huskies
MATCH (w:Team {espn_id: "41"}), (l:Team {espn_id: "57"})
MERGE (g:Game {id: "401812793"}) ON CREATE SET
  g.name = "Florida Gators at UConn Huskies",
  g.date = "2025-12-10",
  g.score = "{'value': 77.0, 'displayValue': '77'}-{'value': 73.0, 'displayValue': '73'}",
  g.neutral = true,
  g.venue = "Madison Square Garden"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 77.0, 'displayValue': '77'}-{'value': 73.0, 'displayValue': '73'}", date: "2025-12-10", neutral: true}]->(l);

// Florida Gators at Missouri Tigers
MATCH (w:Team {espn_id: "142"}), (l:Team {espn_id: "57"})
MERGE (g:Game {id: "401808147"}) ON CREATE SET
  g.name = "Florida Gators at Missouri Tigers",
  g.date = "2026-01-04",
  g.score = "{'value': 76.0, 'displayValue': '76'}-{'value': 74.0, 'displayValue': '74'}",
  g.neutral = false,
  g.venue = "Mizzou Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 76.0, 'displayValue': '76'}-{'value': 74.0, 'displayValue': '74'}", date: "2026-01-04", neutral: false}]->(l);

// Tennessee Volunteers at Florida Gators
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "2633"})
MERGE (g:Game {id: "401808162"}) ON CREATE SET
  g.name = "Tennessee Volunteers at Florida Gators",
  g.date = "2026-01-10",
  g.score = "{'value': 91.0, 'displayValue': '91'}-{'value': 67.0, 'displayValue': '67'}",
  g.neutral = false,
  g.venue = "Stephen C. O'Connell Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 91.0, 'displayValue': '91'}-{'value': 67.0, 'displayValue': '67'}", date: "2026-01-10", neutral: false}]->(l);

// Florida Gators at Vanderbilt Commodores
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "238"})
MERGE (g:Game {id: "401808182"}) ON CREATE SET
  g.name = "Florida Gators at Vanderbilt Commodores",
  g.date = "2026-01-17",
  g.score = "{'value': 98.0, 'displayValue': '98'}-{'value': 94.0, 'displayValue': '94'}",
  g.neutral = false,
  g.venue = "Memorial Gymnasium (TN)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 98.0, 'displayValue': '98'}-{'value': 94.0, 'displayValue': '94'}", date: "2026-01-17", neutral: false}]->(l);

// Alabama Crimson Tide at Florida Gators
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "333"})
MERGE (g:Game {id: "401808208"}) ON CREATE SET
  g.name = "Alabama Crimson Tide at Florida Gators",
  g.date = "2026-02-01",
  g.score = "{'value': 100.0, 'displayValue': '100'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = false,
  g.venue = "Stephen C. O'Connell Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 100.0, 'displayValue': '100'}-{'value': 77.0, 'displayValue': '77'}", date: "2026-02-01", neutral: false}]->(l);

// Florida Gators at Texas A&M Aggies
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "245"})
MERGE (g:Game {id: "401808224"}) ON CREATE SET
  g.name = "Florida Gators at Texas A&M Aggies",
  g.date = "2026-02-08",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 67.0, 'displayValue': '67'}",
  g.neutral = false,
  g.venue = "Reed Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 67.0, 'displayValue': '67'}", date: "2026-02-08", neutral: false}]->(l);

// Kentucky Wildcats at Florida Gators
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "96"})
MERGE (g:Game {id: "401808234"}) ON CREATE SET
  g.name = "Kentucky Wildcats at Florida Gators",
  g.date = "2026-02-14",
  g.score = "{'value': 92.0, 'displayValue': '92'}-{'value': 83.0, 'displayValue': '83'}",
  g.neutral = false,
  g.venue = "Stephen C. O'Connell Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 92.0, 'displayValue': '92'}-{'value': 83.0, 'displayValue': '83'}", date: "2026-02-14", neutral: false}]->(l);

// Florida Gators at Texas Longhorns
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "251"})
MERGE (g:Game {id: "401808264"}) ON CREATE SET
  g.name = "Florida Gators at Texas Longhorns",
  g.date = "2026-02-26",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 71.0, 'displayValue': '71'}",
  g.neutral = false,
  g.venue = "Moody Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 71.0, 'displayValue': '71'}", date: "2026-02-26", neutral: false}]->(l);

// Florida Gators at Kentucky Wildcats
MATCH (w:Team {espn_id: "57"}), (l:Team {espn_id: "96"})
MERGE (g:Game {id: "401808281"}) ON CREATE SET
  g.name = "Florida Gators at Kentucky Wildcats",
  g.date = "2026-03-07",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = false,
  g.venue = "Rupp Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 77.0, 'displayValue': '77'}", date: "2026-03-07", neutral: false}]->(l);

// Furman Paladins at High Point Panthers
MATCH (w:Team {espn_id: "2272"}), (l:Team {espn_id: "231"})
MERGE (g:Game {id: "401824867"}) ON CREATE SET
  g.name = "Furman Paladins at High Point Panthers",
  g.date = "2025-11-03",
  g.score = "{'value': 97.0, 'displayValue': '97'}-{'value': 71.0, 'displayValue': '71'}",
  g.neutral = true,
  g.venue = "Rock Hill Sports & Event Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 97.0, 'displayValue': '97'}-{'value': 71.0, 'displayValue': '71'}", date: "2025-11-03", neutral: true}]->(l);

// Troy Trojans at Furman Paladins
MATCH (w:Team {espn_id: "2653"}), (l:Team {espn_id: "231"})
MERGE (g:Game {id: "401824868"}) ON CREATE SET
  g.name = "Troy Trojans at Furman Paladins",
  g.date = "2025-11-08",
  g.score = "{'value': 64.0, 'displayValue': '64'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = false,
  g.venue = "Timmons Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 64.0, 'displayValue': '64'}-{'value': 61.0, 'displayValue': '61'}", date: "2025-11-08", neutral: false}]->(l);

// Furman Paladins at Northern Iowa Panthers
MATCH (w:Team {espn_id: "2460"}), (l:Team {espn_id: "231"})
MERGE (g:Game {id: "401820543"}) ON CREATE SET
  g.name = "Furman Paladins at Northern Iowa Panthers",
  g.date = "2025-11-15",
  g.score = "{'value': 70.0, 'displayValue': '70'}-{'value': 54.0, 'displayValue': '54'}",
  g.neutral = false,
  g.venue = "McLeod Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 70.0, 'displayValue': '70'}-{'value': 54.0, 'displayValue': '54'}", date: "2025-11-15", neutral: false}]->(l);

// VCU Rams at Utah State Aggies
MATCH (w:Team {espn_id: "328"}), (l:Team {espn_id: "2670"})
MERGE (g:Game {id: "401822735"}) ON CREATE SET
  g.name = "VCU Rams at Utah State Aggies",
  g.date = "2025-11-08",
  g.score = "{'value': 80.0, 'displayValue': '80'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = true,
  g.venue = "Comerica Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 80.0, 'displayValue': '80'}-{'value': 77.0, 'displayValue': '77'}", date: "2025-11-08", neutral: true}]->(l);

// Michigan Wolverines at TCU Horned Frogs
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "2628"})
MERGE (g:Game {id: "401812252"}) ON CREATE SET
  g.name = "Michigan Wolverines at TCU Horned Frogs",
  g.date = "2025-11-15",
  g.score = "{'value': 67.0, 'displayValue': '67'}-{'value': 63.0, 'displayValue': '63'}",
  g.neutral = false,
  g.venue = "Schollmaier Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 67.0, 'displayValue': '67'}-{'value': 63.0, 'displayValue': '63'}", date: "2025-11-15", neutral: false}]->(l);

// TCU Horned Frogs at Kansas Jayhawks
MATCH (w:Team {espn_id: "2305"}), (l:Team {espn_id: "2628"})
MERGE (g:Game {id: "401827601"}) ON CREATE SET
  g.name = "TCU Horned Frogs at Kansas Jayhawks",
  g.date = "2026-01-07",
  g.score = "{'value': 104.0, 'displayValue': '104'}-{'value': 100.0, 'displayValue': '100'}",
  g.neutral = false,
  g.venue = "Allen Fieldhouse"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 104.0, 'displayValue': '104'}-{'value': 100.0, 'displayValue': '100'}", date: "2026-01-07", neutral: false}]->(l);

// Arizona Wildcats at TCU Horned Frogs
MATCH (w:Team {espn_id: "12"}), (l:Team {espn_id: "2628"})
MERGE (g:Game {id: "401827612"}) ON CREATE SET
  g.name = "Arizona Wildcats at TCU Horned Frogs",
  g.date = "2026-01-10",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 73.0, 'displayValue': '73'}",
  g.neutral = false,
  g.venue = "Schollmaier Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 73.0, 'displayValue': '73'}", date: "2026-01-10", neutral: false}]->(l);

// TCU Horned Frogs at BYU Cougars
MATCH (w:Team {espn_id: "252"}), (l:Team {espn_id: "2628"})
MERGE (g:Game {id: "401827620"}) ON CREATE SET
  g.name = "TCU Horned Frogs at BYU Cougars",
  g.date = "2026-01-15",
  g.score = "{'value': 76.0, 'displayValue': '76'}-{'value': 70.0, 'displayValue': '70'}",
  g.neutral = false,
  g.venue = "Marriott Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 76.0, 'displayValue': '76'}-{'value': 70.0, 'displayValue': '70'}", date: "2026-01-15", neutral: false}]->(l);

// Houston Cougars at TCU Horned Frogs
MATCH (w:Team {espn_id: "248"}), (l:Team {espn_id: "2628"})
MERGE (g:Game {id: "401827650"}) ON CREATE SET
  g.name = "Houston Cougars at TCU Horned Frogs",
  g.date = "2026-01-29",
  g.score = "{'value': 79.0, 'displayValue': '79'}-{'value': 70.0, 'displayValue': '70'}",
  g.neutral = false,
  g.venue = "Schollmaier Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 79.0, 'displayValue': '79'}-{'value': 70.0, 'displayValue': '70'}", date: "2026-01-29", neutral: false}]->(l);

// TCU Horned Frogs at UCF Knights
MATCH (w:Team {espn_id: "2116"}), (l:Team {espn_id: "2628"})
MERGE (g:Game {id: "401827687"}) ON CREATE SET
  g.name = "TCU Horned Frogs at UCF Knights",
  g.date = "2026-02-18",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 71.0, 'displayValue': '71'}",
  g.neutral = false,
  g.venue = "Addition Financial Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 71.0, 'displayValue': '71'}", date: "2026-02-18", neutral: false}]->(l);

// Alabama Crimson Tide at St. John's Red Storm
MATCH (w:Team {espn_id: "333"}), (l:Team {espn_id: "2599"})
MERGE (g:Game {id: "401812261"}) ON CREATE SET
  g.name = "Alabama Crimson Tide at St. John's Red Storm",
  g.date = "2025-11-08",
  g.score = "{'value': 103.0, 'displayValue': '103'}-{'value': 96.0, 'displayValue': '96'}",
  g.neutral = false,
  g.venue = "Madison Square Garden"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 103.0, 'displayValue': '103'}-{'value': 96.0, 'displayValue': '96'}", date: "2025-11-08", neutral: false}]->(l);

// St. John's Red Storm at Kentucky Wildcats
MATCH (w:Team {espn_id: "96"}), (l:Team {espn_id: "2599"})
MERGE (g:Game {id: "401809306"}) ON CREATE SET
  g.name = "St. John's Red Storm at Kentucky Wildcats",
  g.date = "2025-12-20",
  g.score = "{'value': 78.0, 'displayValue': '78'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = true,
  g.venue = "State Farm Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 78.0, 'displayValue': '78'}-{'value': 66.0, 'displayValue': '66'}", date: "2025-12-20", neutral: true}]->(l);

// UConn Huskies at St. John's Red Storm
MATCH (w:Team {espn_id: "2599"}), (l:Team {espn_id: "41"})
MERGE (g:Game {id: "401822932"}) ON CREATE SET
  g.name = "UConn Huskies at St. John's Red Storm",
  g.date = "2026-02-07",
  g.score = "{'value': 81.0, 'displayValue': '81'}-{'value': 72.0, 'displayValue': '72'}",
  g.neutral = false,
  g.venue = "Madison Square Garden"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 81.0, 'displayValue': '81'}-{'value': 72.0, 'displayValue': '72'}", date: "2026-02-07", neutral: false}]->(l);

// St. John's Red Storm at UConn Huskies
MATCH (w:Team {espn_id: "41"}), (l:Team {espn_id: "2599"})
MERGE (g:Game {id: "401822959"}) ON CREATE SET
  g.name = "St. John's Red Storm at UConn Huskies",
  g.date = "2026-02-26",
  g.score = "{'value': 72.0, 'displayValue': '72'}-{'value': 40.0, 'displayValue': '40'}",
  g.neutral = false,
  g.venue = "PeoplesBank Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 72.0, 'displayValue': '72'}-{'value': 40.0, 'displayValue': '40'}", date: "2026-02-26", neutral: false}]->(l);

// Yale Bulldogs at Alabama Crimson Tide
MATCH (w:Team {espn_id: "333"}), (l:Team {espn_id: "43"})
MERGE (g:Game {id: "401812269"}) ON CREATE SET
  g.name = "Yale Bulldogs at Alabama Crimson Tide",
  g.date = "2025-12-30",
  g.score = "{'value': 102.0, 'displayValue': '102'}-{'value': 78.0, 'displayValue': '78'}",
  g.neutral = false,
  g.venue = "Coleman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 102.0, 'displayValue': '102'}-{'value': 78.0, 'displayValue': '78'}", date: "2025-12-30", neutral: false}]->(l);

// Virginia Cavaliers at Texas Longhorns
MATCH (w:Team {espn_id: "258"}), (l:Team {espn_id: "251"})
MERGE (g:Game {id: "401806379"}) ON CREATE SET
  g.name = "Virginia Cavaliers at Texas Longhorns",
  g.date = "2025-12-04",
  g.score = "{'value': 88.0, 'displayValue': '88'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Moody Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 88.0, 'displayValue': '88'}-{'value': 69.0, 'displayValue': '69'}", date: "2025-12-04", neutral: false}]->(l);

// Virginia Cavaliers at Louisville Cardinals
MATCH (w:Team {espn_id: "258"}), (l:Team {espn_id: "97"})
MERGE (g:Game {id: "401820669"}) ON CREATE SET
  g.name = "Virginia Cavaliers at Louisville Cardinals",
  g.date = "2026-01-14",
  g.score = "{'value': 79.0, 'displayValue': '79'}-{'value': 70.0, 'displayValue': '70'}",
  g.neutral = false,
  g.venue = "KFC Yum! Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 79.0, 'displayValue': '79'}-{'value': 70.0, 'displayValue': '70'}", date: "2026-01-14", neutral: false}]->(l);

// North Carolina Tar Heels at Virginia Cavaliers
MATCH (w:Team {espn_id: "153"}), (l:Team {espn_id: "258"})
MERGE (g:Game {id: "401820697"}) ON CREATE SET
  g.name = "North Carolina Tar Heels at Virginia Cavaliers",
  g.date = "2026-01-24",
  g.score = "{'value': 85.0, 'displayValue': '85'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "John Paul Jones Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 85.0, 'displayValue': '85'}-{'value': 80.0, 'displayValue': '80'}", date: "2026-01-24", neutral: false}]->(l);

// Miami Hurricanes at Virginia Cavaliers
MATCH (w:Team {espn_id: "258"}), (l:Team {espn_id: "2390"})
MERGE (g:Game {id: "401820760"}) ON CREATE SET
  g.name = "Miami Hurricanes at Virginia Cavaliers",
  g.date = "2026-02-21",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 83.0, 'displayValue': '83'}",
  g.neutral = false,
  g.venue = "John Paul Jones Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 83.0, 'displayValue': '83'}", date: "2026-02-21", neutral: false}]->(l);

// Kentucky Wildcats at Louisville Cardinals
MATCH (w:Team {espn_id: "97"}), (l:Team {espn_id: "96"})
MERGE (g:Game {id: "401817241"}) ON CREATE SET
  g.name = "Kentucky Wildcats at Louisville Cardinals",
  g.date = "2025-11-12",
  g.score = "{'value': 96.0, 'displayValue': '96'}-{'value': 88.0, 'displayValue': '88'}",
  g.neutral = false,
  g.venue = "KFC Yum! Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 96.0, 'displayValue': '96'}-{'value': 88.0, 'displayValue': '88'}", date: "2025-11-12", neutral: false}]->(l);

// Louisville Cardinals at Tennessee Volunteers
MATCH (w:Team {espn_id: "2633"}), (l:Team {espn_id: "97"})
MERGE (g:Game {id: "401817248"}) ON CREATE SET
  g.name = "Louisville Cardinals at Tennessee Volunteers",
  g.date = "2025-12-17",
  g.score = "{'value': 83.0, 'displayValue': '83'}-{'value': 62.0, 'displayValue': '62'}",
  g.neutral = false,
  g.venue = "Food City Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 83.0, 'displayValue': '83'}-{'value': 62.0, 'displayValue': '62'}", date: "2025-12-17", neutral: false}]->(l);

// Louisville Cardinals at North Carolina Tar Heels
MATCH (w:Team {espn_id: "153"}), (l:Team {espn_id: "97"})
MERGE (g:Game {id: "401820762"}) ON CREATE SET
  g.name = "Louisville Cardinals at North Carolina Tar Heels",
  g.date = "2026-02-24",
  g.score = "{'value': 77.0, 'displayValue': '77'}-{'value': 74.0, 'displayValue': '74'}",
  g.neutral = false,
  g.venue = "Dean E. Smith Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 77.0, 'displayValue': '77'}-{'value': 74.0, 'displayValue': '74'}", date: "2026-02-24", neutral: false}]->(l);

// Louisville Cardinals at Clemson Tigers
MATCH (w:Team {espn_id: "228"}), (l:Team {espn_id: "97"})
MERGE (g:Game {id: "401820770"}) ON CREATE SET
  g.name = "Louisville Cardinals at Clemson Tigers",
  g.date = "2026-02-28",
  g.score = "{'value': 80.0, 'displayValue': '80'}-{'value': 75.0, 'displayValue': '75'}",
  g.neutral = false,
  g.venue = "Littlejohn Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 80.0, 'displayValue': '80'}-{'value': 75.0, 'displayValue': '75'}", date: "2026-02-28", neutral: false}]->(l);

// Louisville Cardinals at Miami Hurricanes
MATCH (w:Team {espn_id: "97"}), (l:Team {espn_id: "2390"})
MERGE (g:Game {id: "401820790"}) ON CREATE SET
  g.name = "Louisville Cardinals at Miami Hurricanes",
  g.date = "2026-03-07",
  g.score = "{'value': 92.0, 'displayValue': '92'}-{'value': 89.0, 'displayValue': '89'}",
  g.neutral = false,
  g.venue = "Watsco Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 92.0, 'displayValue': '92'}-{'value': 89.0, 'displayValue': '89'}", date: "2026-03-07", neutral: false}]->(l);

// VCU Rams at Vanderbilt Commodores
MATCH (w:Team {espn_id: "238"}), (l:Team {espn_id: "2670"})
MERGE (g:Game {id: "401830752"}) ON CREATE SET
  g.name = "VCU Rams at Vanderbilt Commodores",
  g.date = "2025-11-27",
  g.score = "{'value': 89.0, 'displayValue': '89'}-{'value': 74.0, 'displayValue': '74'}",
  g.neutral = true,
  g.venue = "Imperial Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 89.0, 'displayValue': '89'}-{'value': 74.0, 'displayValue': '74'}", date: "2025-11-27", neutral: true}]->(l);

// Saint Louis Billikens at VCU Rams
MATCH (w:Team {espn_id: "139"}), (l:Team {espn_id: "2670"})
MERGE (g:Game {id: "401828362"}) ON CREATE SET
  g.name = "Saint Louis Billikens at VCU Rams",
  g.date = "2026-01-08",
  g.score = "{'value': 71.0, 'displayValue': '71'}-{'value': 62.0, 'displayValue': '62'}",
  g.neutral = false,
  g.venue = "Siegel Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 71.0, 'displayValue': '71'}-{'value': 62.0, 'displayValue': '62'}", date: "2026-01-08", neutral: false}]->(l);

// VCU Rams at Saint Louis Billikens
MATCH (w:Team {espn_id: "139"}), (l:Team {espn_id: "2670"})
MERGE (g:Game {id: "401828437"}) ON CREATE SET
  g.name = "VCU Rams at Saint Louis Billikens",
  g.date = "2026-02-21",
  g.score = "{'value': 88.0, 'displayValue': '88'}-{'value': 75.0, 'displayValue': '75'}",
  g.neutral = false,
  g.venue = "Chaifetz Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 88.0, 'displayValue': '88'}-{'value': 75.0, 'displayValue': '75'}", date: "2026-02-21", neutral: false}]->(l);

// Nebraska Cornhuskers at Illinois Fighting Illini
MATCH (w:Team {espn_id: "158"}), (l:Team {espn_id: "356"})
MERGE (g:Game {id: "401825407"}) ON CREATE SET
  g.name = "Nebraska Cornhuskers at Illinois Fighting Illini",
  g.date = "2025-12-13",
  g.score = "{'value': 83.0, 'displayValue': '83'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "State Farm Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 83.0, 'displayValue': '83'}-{'value': 80.0, 'displayValue': '80'}", date: "2025-12-13", neutral: false}]->(l);

// Nebraska Cornhuskers at Michigan Wolverines
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "158"})
MERGE (g:Game {id: "401825474"}) ON CREATE SET
  g.name = "Nebraska Cornhuskers at Michigan Wolverines",
  g.date = "2026-01-28",
  g.score = "{'value': 75.0, 'displayValue': '75'}-{'value': 72.0, 'displayValue': '72'}",
  g.neutral = false,
  g.venue = "Crisler Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 75.0, 'displayValue': '75'}-{'value': 72.0, 'displayValue': '72'}", date: "2026-01-28", neutral: false}]->(l);

// Illinois Fighting Illini at Nebraska Cornhuskers
MATCH (w:Team {espn_id: "356"}), (l:Team {espn_id: "158"})
MERGE (g:Game {id: "401825487"}) ON CREATE SET
  g.name = "Illinois Fighting Illini at Nebraska Cornhuskers",
  g.date = "2026-02-01",
  g.score = "{'value': 78.0, 'displayValue': '78'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Pinnacle Bank Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 78.0, 'displayValue': '78'}-{'value': 69.0, 'displayValue': '69'}", date: "2026-02-01", neutral: false}]->(l);

// Purdue Boilermakers at Nebraska Cornhuskers
MATCH (w:Team {espn_id: "2509"}), (l:Team {espn_id: "158"})
MERGE (g:Game {id: "401825507"}) ON CREATE SET
  g.name = "Purdue Boilermakers at Nebraska Cornhuskers",
  g.date = "2026-02-11",
  g.score = "{'value': 80.0, 'displayValue': '80'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = false,
  g.venue = "Pinnacle Bank Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 80.0, 'displayValue': '80'}-{'value': 77.0, 'displayValue': '77'}", date: "2026-02-11", neutral: false}]->(l);

// Nebraska Cornhuskers at Iowa Hawkeyes
MATCH (w:Team {espn_id: "2294"}), (l:Team {espn_id: "158"})
MERGE (g:Game {id: "401825520"}) ON CREATE SET
  g.name = "Nebraska Cornhuskers at Iowa Hawkeyes",
  g.date = "2026-02-18",
  g.score = "{'value': 57.0, 'displayValue': '57'}-{'value': 52.0, 'displayValue': '52'}",
  g.neutral = false,
  g.venue = "Carver-Hawkeye Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 57.0, 'displayValue': '57'}-{'value': 52.0, 'displayValue': '52'}", date: "2026-02-18", neutral: false}]->(l);

// Nebraska Cornhuskers at UCLA Bruins
MATCH (w:Team {espn_id: "26"}), (l:Team {espn_id: "158"})
MERGE (g:Game {id: "401825554"}) ON CREATE SET
  g.name = "Nebraska Cornhuskers at UCLA Bruins",
  g.date = "2026-03-04",
  g.score = "{'value': 72.0, 'displayValue': '72'}-{'value': 52.0, 'displayValue': '52'}",
  g.neutral = false,
  g.venue = "Pauley Pavilion"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 72.0, 'displayValue': '72'}-{'value': 52.0, 'displayValue': '52'}", date: "2026-03-04", neutral: false}]->(l);

// Iowa Hawkeyes at Nebraska Cornhuskers
MATCH (w:Team {espn_id: "158"}), (l:Team {espn_id: "2294"})
MERGE (g:Game {id: "401825569"}) ON CREATE SET
  g.name = "Iowa Hawkeyes at Nebraska Cornhuskers",
  g.date = "2026-03-08",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 75.0, 'displayValue': '75'}",
  g.neutral = false,
  g.venue = "Pinnacle Bank Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 75.0, 'displayValue': '75'}", date: "2026-03-08", neutral: false}]->(l);

// UC Irvine Anteaters at Utah Valley Wolverines
MATCH (w:Team {espn_id: "3084"}), (l:Team {espn_id: "300"})
MERGE (g:Game {id: "401826949"}) ON CREATE SET
  g.name = "UC Irvine Anteaters at Utah Valley Wolverines",
  g.date = "2025-11-20",
  g.score = "{'value': 79.0, 'displayValue': '79'}-{'value': 72.0, 'displayValue': '72'}",
  g.neutral = false,
  g.venue = "UCCU Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 79.0, 'displayValue': '79'}-{'value': 72.0, 'displayValue': '72'}", date: "2025-11-20", neutral: false}]->(l);

// Northern Iowa Panthers at UC Irvine Anteaters
MATCH (w:Team {espn_id: "2460"}), (l:Team {espn_id: "300"})
MERGE (g:Game {id: "401820545"}) ON CREATE SET
  g.name = "Northern Iowa Panthers at UC Irvine Anteaters",
  g.date = "2025-11-23",
  g.score = "{'value': 70.0, 'displayValue': '70'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Bren Events Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 70.0, 'displayValue': '70'}-{'value': 69.0, 'displayValue': '69'}", date: "2025-11-23", neutral: false}]->(l);

// UC Irvine Anteaters at North Dakota State Bison
MATCH (w:Team {espn_id: "300"}), (l:Team {espn_id: "2449"})
MERGE (g:Game {id: "401829465"}) ON CREATE SET
  g.name = "UC Irvine Anteaters at North Dakota State Bison",
  g.date = "2025-12-22",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 73.0, 'displayValue': '73'}",
  g.neutral = true,
  g.venue = "Don Haskins Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 73.0, 'displayValue': '73'}", date: "2025-12-22", neutral: true}]->(l);

// Saint Mary's Gaels at Vanderbilt Commodores
MATCH (w:Team {espn_id: "238"}), (l:Team {espn_id: "2608"})
MERGE (g:Game {id: "401830879"}) ON CREATE SET
  g.name = "Saint Mary's Gaels at Vanderbilt Commodores",
  g.date = "2025-11-28",
  g.score = "{'value': 96.0, 'displayValue': '96'}-{'value': 71.0, 'displayValue': '71'}",
  g.neutral = true,
  g.venue = "Imperial Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 96.0, 'displayValue': '96'}-{'value': 71.0, 'displayValue': '71'}", date: "2025-11-28", neutral: true}]->(l);

// Northern Iowa Panthers at Saint Mary's Gaels
MATCH (w:Team {espn_id: "2608"}), (l:Team {espn_id: "2460"})
MERGE (g:Game {id: "401820549"}) ON CREATE SET
  g.name = "Northern Iowa Panthers at Saint Mary's Gaels",
  g.date = "2025-12-23",
  g.score = "{'value': 63.0, 'displayValue': '63'}-{'value': 58.0, 'displayValue': '58'}",
  g.neutral = false,
  g.venue = "University Credit Union Pavilion"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 63.0, 'displayValue': '63'}-{'value': 58.0, 'displayValue': '58'}", date: "2025-12-23", neutral: false}]->(l);

// Saint Mary's Gaels at Gonzaga Bulldogs
MATCH (w:Team {espn_id: "2250"}), (l:Team {espn_id: "2608"})
MERGE (g:Game {id: "401829225"}) ON CREATE SET
  g.name = "Saint Mary's Gaels at Gonzaga Bulldogs",
  g.date = "2026-02-01",
  g.score = "{'value': 73.0, 'displayValue': '73'}-{'value': 65.0, 'displayValue': '65'}",
  g.neutral = false,
  g.venue = "McCarthey Athletic Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 73.0, 'displayValue': '73'}-{'value': 65.0, 'displayValue': '65'}", date: "2026-02-01", neutral: false}]->(l);

// Gonzaga Bulldogs at Saint Mary's Gaels
MATCH (w:Team {espn_id: "2608"}), (l:Team {espn_id: "2250"})
MERGE (g:Game {id: "401829265"}) ON CREATE SET
  g.name = "Gonzaga Bulldogs at Saint Mary's Gaels",
  g.date = "2026-03-01",
  g.score = "{'value': 70.0, 'displayValue': '70'}-{'value': 59.0, 'displayValue': '59'}",
  g.neutral = false,
  g.venue = "University Credit Union Pavilion"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 70.0, 'displayValue': '70'}-{'value': 59.0, 'displayValue': '59'}", date: "2026-03-01", neutral: false}]->(l);

// Missouri Tigers at Kansas Jayhawks
MATCH (w:Team {espn_id: "2305"}), (l:Team {espn_id: "142"})
MERGE (g:Game {id: "401819885"}) ON CREATE SET
  g.name = "Missouri Tigers at Kansas Jayhawks",
  g.date = "2025-12-07",
  g.score = "{'value': 80.0, 'displayValue': '80'}-{'value': 60.0, 'displayValue': '60'}",
  g.neutral = true,
  g.venue = "T-Mobile Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 80.0, 'displayValue': '80'}-{'value': 60.0, 'displayValue': '60'}", date: "2025-12-07", neutral: true}]->(l);

// Missouri Tigers at Illinois Fighting Illini
MATCH (w:Team {espn_id: "356"}), (l:Team {espn_id: "142"})
MERGE (g:Game {id: "401811100"}) ON CREATE SET
  g.name = "Missouri Tigers at Illinois Fighting Illini",
  g.date = "2025-12-23",
  g.score = "{'value': 91.0, 'displayValue': '91'}-{'value': 48.0, 'displayValue': '48'}",
  g.neutral = true,
  g.venue = "Enterprise Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 91.0, 'displayValue': '91'}-{'value': 48.0, 'displayValue': '48'}", date: "2025-12-23", neutral: true}]->(l);

// Missouri Tigers at Kentucky Wildcats
MATCH (w:Team {espn_id: "142"}), (l:Team {espn_id: "96"})
MERGE (g:Game {id: "401808157"}) ON CREATE SET
  g.name = "Missouri Tigers at Kentucky Wildcats",
  g.date = "2026-01-08",
  g.score = "{'value': 73.0, 'displayValue': '73'}-{'value': 68.0, 'displayValue': '68'}",
  g.neutral = false,
  g.venue = "Rupp Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 73.0, 'displayValue': '73'}-{'value': 68.0, 'displayValue': '68'}", date: "2026-01-08", neutral: false}]->(l);

// Missouri Tigers at Alabama Crimson Tide
MATCH (w:Team {espn_id: "333"}), (l:Team {espn_id: "142"})
MERGE (g:Game {id: "401808204"}) ON CREATE SET
  g.name = "Missouri Tigers at Alabama Crimson Tide",
  g.date = "2026-01-28",
  g.score = "{'value': 90.0, 'displayValue': '90'}-{'value': 64.0, 'displayValue': '64'}",
  g.neutral = false,
  g.venue = "Coleman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 90.0, 'displayValue': '90'}-{'value': 64.0, 'displayValue': '64'}", date: "2026-01-28", neutral: false}]->(l);

// Missouri Tigers at Texas A&M Aggies
MATCH (w:Team {espn_id: "142"}), (l:Team {espn_id: "245"})
MERGE (g:Game {id: "401808228"}) ON CREATE SET
  g.name = "Missouri Tigers at Texas A&M Aggies",
  g.date = "2026-02-12",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 85.0, 'displayValue': '85'}",
  g.neutral = false,
  g.venue = "Reed Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 85.0, 'displayValue': '85'}", date: "2026-02-12", neutral: false}]->(l);

// Texas Longhorns at Missouri Tigers
MATCH (w:Team {espn_id: "251"}), (l:Team {espn_id: "142"})
MERGE (g:Game {id: "401808236"}) ON CREATE SET
  g.name = "Texas Longhorns at Missouri Tigers",
  g.date = "2026-02-15",
  g.score = "{'value': 85.0, 'displayValue': '85'}-{'value': 68.0, 'displayValue': '68'}",
  g.neutral = false,
  g.venue = "Mizzou Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 85.0, 'displayValue': '85'}-{'value': 68.0, 'displayValue': '68'}", date: "2026-02-15", neutral: false}]->(l);

// Vanderbilt Commodores at Missouri Tigers
MATCH (w:Team {espn_id: "142"}), (l:Team {espn_id: "238"})
MERGE (g:Game {id: "401808246"}) ON CREATE SET
  g.name = "Vanderbilt Commodores at Missouri Tigers",
  g.date = "2026-02-19",
  g.score = "{'value': 81.0, 'displayValue': '81'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "Mizzou Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 81.0, 'displayValue': '81'}-{'value': 80.0, 'displayValue': '80'}", date: "2026-02-19", neutral: false}]->(l);

// Tennessee Volunteers at Missouri Tigers
MATCH (w:Team {espn_id: "142"}), (l:Team {espn_id: "2633"})
MERGE (g:Game {id: "401808257"}) ON CREATE SET
  g.name = "Tennessee Volunteers at Missouri Tigers",
  g.date = "2026-02-25",
  g.score = "{'value': 73.0, 'displayValue': '73'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Mizzou Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 73.0, 'displayValue': '73'}-{'value': 69.0, 'displayValue': '69'}", date: "2026-02-25", neutral: false}]->(l);

// Lehigh Mountain Hawks at Houston Cougars
MATCH (w:Team {espn_id: "248"}), (l:Team {espn_id: "2329"})
MERGE (g:Game {id: "401824809"}) ON CREATE SET
  g.name = "Lehigh Mountain Hawks at Houston Cougars",
  g.date = "2025-11-04",
  g.score = "{'value': 75.0, 'displayValue': '75'}-{'value': 57.0, 'displayValue': '57'}",
  g.neutral = false,
  g.venue = "Fertitta Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 75.0, 'displayValue': '75'}-{'value': 57.0, 'displayValue': '57'}", date: "2025-11-04", neutral: false}]->(l);

// Tennessee Volunteers at Houston Cougars
MATCH (w:Team {espn_id: "2633"}), (l:Team {espn_id: "248"})
MERGE (g:Game {id: "401824812"}) ON CREATE SET
  g.name = "Tennessee Volunteers at Houston Cougars",
  g.date = "2025-11-25",
  g.score = "{'value': 76.0, 'displayValue': '76'}-{'value': 73.0, 'displayValue': '73'}",
  g.neutral = true,
  g.venue = "MGM Grand Garden Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 76.0, 'displayValue': '76'}-{'value': 73.0, 'displayValue': '73'}", date: "2025-11-25", neutral: true}]->(l);

// UCF Knights at Houston Cougars
MATCH (w:Team {espn_id: "248"}), (l:Team {espn_id: "2116"})
MERGE (g:Game {id: "401827661"}) ON CREATE SET
  g.name = "UCF Knights at Houston Cougars",
  g.date = "2026-02-05",
  g.score = "{'value': 79.0, 'displayValue': '79'}-{'value': 55.0, 'displayValue': '55'}",
  g.neutral = false,
  g.venue = "Fertitta Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 79.0, 'displayValue': '79'}-{'value': 55.0, 'displayValue': '55'}", date: "2026-02-05", neutral: false}]->(l);

// Houston Cougars at BYU Cougars
MATCH (w:Team {espn_id: "248"}), (l:Team {espn_id: "252"})
MERGE (g:Game {id: "401827666"}) ON CREATE SET
  g.name = "Houston Cougars at BYU Cougars",
  g.date = "2026-02-08",
  g.score = "{'value': 77.0, 'displayValue': '77'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = false,
  g.venue = "Marriott Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 77.0, 'displayValue': '77'}-{'value': 66.0, 'displayValue': '66'}", date: "2026-02-08", neutral: false}]->(l);

// Arizona Wildcats at Houston Cougars
MATCH (w:Team {espn_id: "12"}), (l:Team {espn_id: "248"})
MERGE (g:Game {id: "401827695"}) ON CREATE SET
  g.name = "Arizona Wildcats at Houston Cougars",
  g.date = "2026-02-21",
  g.score = "{'value': 73.0, 'displayValue': '73'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = false,
  g.venue = "Fertitta Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 73.0, 'displayValue': '73'}-{'value': 66.0, 'displayValue': '66'}", date: "2026-02-21", neutral: false}]->(l);

// Houston Cougars at Kansas Jayhawks
MATCH (w:Team {espn_id: "2305"}), (l:Team {espn_id: "248"})
MERGE (g:Game {id: "401820820"}) ON CREATE SET
  g.name = "Houston Cougars at Kansas Jayhawks",
  g.date = "2026-02-24",
  g.score = "{'value': 69.0, 'displayValue': '69'}-{'value': 56.0, 'displayValue': '56'}",
  g.neutral = false,
  g.venue = "Allen Fieldhouse"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 69.0, 'displayValue': '69'}-{'value': 56.0, 'displayValue': '56'}", date: "2026-02-24", neutral: false}]->(l);

// Gonzaga Bulldogs at Michigan Wolverines
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "2250"})
MERGE (g:Game {id: "401831214"}) ON CREATE SET
  g.name = "Gonzaga Bulldogs at Michigan Wolverines",
  g.date = "2025-11-27",
  g.score = "{'value': 101.0, 'displayValue': '101'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = true,
  g.venue = "MGM Grand Garden Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 101.0, 'displayValue': '101'}-{'value': 61.0, 'displayValue': '61'}", date: "2025-11-27", neutral: true}]->(l);

// UCLA Bruins at Michigan Wolverines
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "26"})
MERGE (g:Game {id: "401825514"}) ON CREATE SET
  g.name = "UCLA Bruins at Michigan Wolverines",
  g.date = "2026-02-14",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 56.0, 'displayValue': '56'}",
  g.neutral = false,
  g.venue = "Crisler Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 56.0, 'displayValue': '56'}", date: "2026-02-14", neutral: false}]->(l);

// Michigan Wolverines at Purdue Boilermakers
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "2509"})
MERGE (g:Game {id: "401825524"}) ON CREATE SET
  g.name = "Michigan Wolverines at Purdue Boilermakers",
  g.date = "2026-02-17",
  g.score = "{'value': 91.0, 'displayValue': '91'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "Mackey Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 91.0, 'displayValue': '91'}-{'value': 80.0, 'displayValue': '80'}", date: "2026-02-17", neutral: false}]->(l);

// Michigan Wolverines at Illinois Fighting Illini
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "356"})
MERGE (g:Game {id: "401825544"}) ON CREATE SET
  g.name = "Michigan Wolverines at Illinois Fighting Illini",
  g.date = "2026-02-28",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 70.0, 'displayValue': '70'}",
  g.neutral = false,
  g.venue = "State Farm Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 70.0, 'displayValue': '70'}", date: "2026-02-28", neutral: false}]->(l);

// Michigan Wolverines at Iowa Hawkeyes
MATCH (w:Team {espn_id: "130"}), (l:Team {espn_id: "2294"})
MERGE (g:Game {id: "401825560"}) ON CREATE SET
  g.name = "Michigan Wolverines at Iowa Hawkeyes",
  g.date = "2026-03-06",
  g.score = "{'value': 71.0, 'displayValue': '71'}-{'value': 68.0, 'displayValue': '68'}",
  g.neutral = false,
  g.venue = "Carver-Hawkeye Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 71.0, 'displayValue': '71'}-{'value': 68.0, 'displayValue': '68'}", date: "2026-03-06", neutral: false}]->(l);

// Long Island University Sharks at Lehigh Mountain Hawks
MATCH (w:Team {espn_id: "112358"}), (l:Team {espn_id: "2329"})
MERGE (g:Game {id: "401812360"}) ON CREATE SET
  g.name = "Long Island University Sharks at Lehigh Mountain Hawks",
  g.date = "2025-12-06",
  g.score = "{'value': 87.0, 'displayValue': '87'}-{'value': 82.0, 'displayValue': '82'}",
  g.neutral = false,
  g.venue = "Stabler Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 87.0, 'displayValue': '87'}-{'value': 82.0, 'displayValue': '82'}", date: "2025-12-06", neutral: false}]->(l);

// Clemson Tigers at Alabama Crimson Tide
MATCH (w:Team {espn_id: "333"}), (l:Team {espn_id: "228"})
MERGE (g:Game {id: "401806376"}) ON CREATE SET
  g.name = "Clemson Tigers at Alabama Crimson Tide",
  g.date = "2025-12-04",
  g.score = "{'value': 90.0, 'displayValue': '90'}-{'value': 84.0, 'displayValue': '84'}",
  g.neutral = false,
  g.venue = "Coleman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 90.0, 'displayValue': '90'}-{'value': 84.0, 'displayValue': '84'}", date: "2025-12-04", neutral: false}]->(l);

// Clemson Tigers at BYU Cougars
MATCH (w:Team {espn_id: "252"}), (l:Team {espn_id: "228"})
MERGE (g:Game {id: "401812923"}) ON CREATE SET
  g.name = "Clemson Tigers at BYU Cougars",
  g.date = "2025-12-09",
  g.score = "{'value': 67.0, 'displayValue': '67'}-{'value': 64.0, 'displayValue': '64'}",
  g.neutral = true,
  g.venue = "Madison Square Garden"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 67.0, 'displayValue': '67'}-{'value': 64.0, 'displayValue': '64'}", date: "2025-12-09", neutral: true}]->(l);

// Miami Hurricanes at Clemson Tigers
MATCH (w:Team {espn_id: "228"}), (l:Team {espn_id: "2390"})
MERGE (g:Game {id: "401820676"}) ON CREATE SET
  g.name = "Miami Hurricanes at Clemson Tigers",
  g.date = "2026-01-17",
  g.score = "{'value': 69.0, 'displayValue': '69'}-{'value': 59.0, 'displayValue': '59'}",
  g.neutral = false,
  g.venue = "Littlejohn Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 69.0, 'displayValue': '69'}-{'value': 59.0, 'displayValue': '59'}", date: "2026-01-17", neutral: false}]->(l);

// Clemson Tigers at North Carolina Tar Heels
MATCH (w:Team {espn_id: "153"}), (l:Team {espn_id: "228"})
MERGE (g:Game {id: "401820779"}) ON CREATE SET
  g.name = "Clemson Tigers at North Carolina Tar Heels",
  g.date = "2026-03-04",
  g.score = "{'value': 67.0, 'displayValue': '67'}-{'value': 63.0, 'displayValue': '63'}",
  g.neutral = false,
  g.venue = "Dean E. Smith Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 67.0, 'displayValue': '67'}-{'value': 63.0, 'displayValue': '63'}", date: "2026-03-04", neutral: false}]->(l);

// Vanderbilt Commodores at UCF Knights
MATCH (w:Team {espn_id: "238"}), (l:Team {espn_id: "2116"})
MERGE (g:Game {id: "401824824"}) ON CREATE SET
  g.name = "Vanderbilt Commodores at UCF Knights",
  g.date = "2025-11-08",
  g.score = "{'value': 105.0, 'displayValue': '105'}-{'value': 93.0, 'displayValue': '93'}",
  g.neutral = false,
  g.venue = "Addition Financial Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 105.0, 'displayValue': '105'}-{'value': 93.0, 'displayValue': '93'}", date: "2025-11-08", neutral: false}]->(l);

// Alabama Crimson Tide at Vanderbilt Commodores
MATCH (w:Team {espn_id: "238"}), (l:Team {espn_id: "333"})
MERGE (g:Game {id: "401808155"}) ON CREATE SET
  g.name = "Alabama Crimson Tide at Vanderbilt Commodores",
  g.date = "2026-01-08",
  g.score = "{'value': 96.0, 'displayValue': '96'}-{'value': 90.0, 'displayValue': '90'}",
  g.neutral = false,
  g.venue = "Memorial Gymnasium (TN)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 96.0, 'displayValue': '96'}-{'value': 90.0, 'displayValue': '90'}", date: "2026-01-08", neutral: false}]->(l);

// Vanderbilt Commodores at Texas Longhorns
MATCH (w:Team {espn_id: "251"}), (l:Team {espn_id: "238"})
MERGE (g:Game {id: "401808176"}) ON CREATE SET
  g.name = "Vanderbilt Commodores at Texas Longhorns",
  g.date = "2026-01-15",
  g.score = "{'value': 80.0, 'displayValue': '80'}-{'value': 64.0, 'displayValue': '64'}",
  g.neutral = false,
  g.venue = "Moody Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 80.0, 'displayValue': '80'}-{'value': 64.0, 'displayValue': '64'}", date: "2026-01-15", neutral: false}]->(l);

// Kentucky Wildcats at Vanderbilt Commodores
MATCH (w:Team {espn_id: "238"}), (l:Team {espn_id: "96"})
MERGE (g:Game {id: "401808205"}) ON CREATE SET
  g.name = "Kentucky Wildcats at Vanderbilt Commodores",
  g.date = "2026-01-28",
  g.score = "{'value': 80.0, 'displayValue': '80'}-{'value': 55.0, 'displayValue': '55'}",
  g.neutral = false,
  g.venue = "Memorial Gymnasium (TN)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 80.0, 'displayValue': '80'}-{'value': 55.0, 'displayValue': '55'}", date: "2026-01-28", neutral: false}]->(l);

// Texas A&M Aggies at Vanderbilt Commodores
MATCH (w:Team {espn_id: "238"}), (l:Team {espn_id: "245"})
MERGE (g:Game {id: "401808238"}) ON CREATE SET
  g.name = "Texas A&M Aggies at Vanderbilt Commodores",
  g.date = "2026-02-14",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Memorial Gymnasium (TN)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 69.0, 'displayValue': '69'}", date: "2026-02-14", neutral: false}]->(l);

// Tennessee Volunteers at Vanderbilt Commodores
MATCH (w:Team {espn_id: "2633"}), (l:Team {espn_id: "238"})
MERGE (g:Game {id: "401808255"}) ON CREATE SET
  g.name = "Tennessee Volunteers at Vanderbilt Commodores",
  g.date = "2026-02-21",
  g.score = "{'value': 69.0, 'displayValue': '69'}-{'value': 65.0, 'displayValue': '65'}",
  g.neutral = false,
  g.venue = "Memorial Gymnasium (TN)"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 69.0, 'displayValue': '69'}-{'value': 65.0, 'displayValue': '65'}", date: "2026-02-21", neutral: false}]->(l);

// Vanderbilt Commodores at Kentucky Wildcats
MATCH (w:Team {espn_id: "96"}), (l:Team {espn_id: "238"})
MERGE (g:Game {id: "401808268"}) ON CREATE SET
  g.name = "Vanderbilt Commodores at Kentucky Wildcats",
  g.date = "2026-02-28",
  g.score = "{'value': 91.0, 'displayValue': '91'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = false,
  g.venue = "Rupp Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 91.0, 'displayValue': '91'}-{'value': 77.0, 'displayValue': '77'}", date: "2026-02-28", neutral: false}]->(l);

// Vanderbilt Commodores at Tennessee Volunteers
MATCH (w:Team {espn_id: "238"}), (l:Team {espn_id: "2633"})
MERGE (g:Game {id: "401808286"}) ON CREATE SET
  g.name = "Vanderbilt Commodores at Tennessee Volunteers",
  g.date = "2026-03-07",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 82.0, 'displayValue': '82'}",
  g.neutral = false,
  g.venue = "Food City Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 82.0, 'displayValue': '82'}", date: "2026-03-07", neutral: false}]->(l);

// Kansas Jayhawks at North Carolina Tar Heels
MATCH (w:Team {espn_id: "153"}), (l:Team {espn_id: "2305"})
MERGE (g:Game {id: "401817263"}) ON CREATE SET
  g.name = "Kansas Jayhawks at North Carolina Tar Heels",
  g.date = "2025-11-08",
  g.score = "{'value': 87.0, 'displayValue': '87'}-{'value': 74.0, 'displayValue': '74'}",
  g.neutral = false,
  g.venue = "Dean E. Smith Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 87.0, 'displayValue': '87'}-{'value': 74.0, 'displayValue': '74'}", date: "2025-11-08", neutral: false}]->(l);

// North Carolina Tar Heels at Kentucky Wildcats
MATCH (w:Team {espn_id: "153"}), (l:Team {espn_id: "96"})
MERGE (g:Game {id: "401806365"}) ON CREATE SET
  g.name = "North Carolina Tar Heels at Kentucky Wildcats",
  g.date = "2025-12-03",
  g.score = "{'value': 67.0, 'displayValue': '67'}-{'value': 64.0, 'displayValue': '64'}",
  g.neutral = false,
  g.venue = "Rupp Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 67.0, 'displayValue': '67'}-{'value': 64.0, 'displayValue': '64'}", date: "2025-12-03", neutral: false}]->(l);

// North Carolina Tar Heels at Miami Hurricanes
MATCH (w:Team {espn_id: "2390"}), (l:Team {espn_id: "153"})
MERGE (g:Game {id: "401820731"}) ON CREATE SET
  g.name = "North Carolina Tar Heels at Miami Hurricanes",
  g.date = "2026-02-11",
  g.score = "{'value': 75.0, 'displayValue': '75'}-{'value': 66.0, 'displayValue': '66'}",
  g.neutral = false,
  g.venue = "Watsco Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 75.0, 'displayValue': '75'}-{'value': 66.0, 'displayValue': '66'}", date: "2026-02-11", neutral: false}]->(l);

// Purdue Boilermakers at Alabama Crimson Tide
MATCH (w:Team {espn_id: "2509"}), (l:Team {espn_id: "333"})
MERGE (g:Game {id: "401812262"}) ON CREATE SET
  g.name = "Purdue Boilermakers at Alabama Crimson Tide",
  g.date = "2025-11-14",
  g.score = "{'value': 87.0, 'displayValue': '87'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "Coleman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 87.0, 'displayValue': '87'}-{'value': 80.0, 'displayValue': '80'}", date: "2025-11-14", neutral: false}]->(l);

// Iowa Hawkeyes at Purdue Boilermakers
MATCH (w:Team {espn_id: "2509"}), (l:Team {espn_id: "2294"})
MERGE (g:Game {id: "401825444"}) ON CREATE SET
  g.name = "Iowa Hawkeyes at Purdue Boilermakers",
  g.date = "2026-01-14",
  g.score = "{'value': 79.0, 'displayValue': '79'}-{'value': 72.0, 'displayValue': '72'}",
  g.neutral = false,
  g.venue = "Mackey Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 79.0, 'displayValue': '79'}-{'value': 72.0, 'displayValue': '72'}", date: "2026-01-14", neutral: false}]->(l);

// Purdue Boilermakers at UCLA Bruins
MATCH (w:Team {espn_id: "26"}), (l:Team {espn_id: "2509"})
MERGE (g:Game {id: "401825459"}) ON CREATE SET
  g.name = "Purdue Boilermakers at UCLA Bruins",
  g.date = "2026-01-21",
  g.score = "{'value': 69.0, 'displayValue': '69'}-{'value': 67.0, 'displayValue': '67'}",
  g.neutral = false,
  g.venue = "Pauley Pavilion"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 69.0, 'displayValue': '69'}-{'value': 67.0, 'displayValue': '67'}", date: "2026-01-21", neutral: false}]->(l);

// Illinois Fighting Illini at Purdue Boilermakers
MATCH (w:Team {espn_id: "356"}), (l:Team {espn_id: "2509"})
MERGE (g:Game {id: "401825468"}) ON CREATE SET
  g.name = "Illinois Fighting Illini at Purdue Boilermakers",
  g.date = "2026-01-24",
  g.score = "{'value': 88.0, 'displayValue': '88'}-{'value': 82.0, 'displayValue': '82'}",
  g.neutral = false,
  g.venue = "Mackey Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 88.0, 'displayValue': '88'}-{'value': 82.0, 'displayValue': '82'}", date: "2026-01-24", neutral: false}]->(l);

// Purdue Boilermakers at Iowa Hawkeyes
MATCH (w:Team {espn_id: "2509"}), (l:Team {espn_id: "2294"})
MERGE (g:Game {id: "401825513"}) ON CREATE SET
  g.name = "Purdue Boilermakers at Iowa Hawkeyes",
  g.date = "2026-02-14",
  g.score = "{'value': 78.0, 'displayValue': '78'}-{'value': 57.0, 'displayValue': '57'}",
  g.neutral = false,
  g.venue = "Carver-Hawkeye Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 78.0, 'displayValue': '78'}-{'value': 57.0, 'displayValue': '57'}", date: "2026-02-14", neutral: false}]->(l);

// Hofstra Pride at UCF Knights
MATCH (w:Team {espn_id: "2116"}), (l:Team {espn_id: "2275"})
MERGE (g:Game {id: "401824823"}) ON CREATE SET
  g.name = "Hofstra Pride at UCF Knights",
  g.date = "2025-11-04",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 78.0, 'displayValue': '78'}",
  g.neutral = false,
  g.venue = "Addition Financial Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 78.0, 'displayValue': '78'}", date: "2025-11-04", neutral: false}]->(l);

// Merrimack Warriors at Hofstra Pride
MATCH (w:Team {espn_id: "2275"}), (l:Team {espn_id: "2771"})
MERGE (g:Game {id: "401826905"}) ON CREATE SET
  g.name = "Merrimack Warriors at Hofstra Pride",
  g.date = "2025-11-29",
  g.score = "{'value': 78.0, 'displayValue': '78'}-{'value': 58.0, 'displayValue': '58'}",
  g.neutral = true,
  g.venue = "The Palestra"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 78.0, 'displayValue': '78'}-{'value': 58.0, 'displayValue': '58'}", date: "2025-11-29", neutral: true}]->(l);

// Hofstra Pride at North Carolina A&T Aggies
MATCH (w:Team {espn_id: "2448"}), (l:Team {espn_id: "2275"})
MERGE (g:Game {id: "401812025"}) ON CREATE SET
  g.name = "Hofstra Pride at North Carolina A&T Aggies",
  g.date = "2026-01-23",
  g.score = "{'value': 79.0, 'displayValue': '79'}-{'value': 78.0, 'displayValue': '78'}",
  g.neutral = false,
  g.venue = "Corbett Sports Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 79.0, 'displayValue': '79'}-{'value': 78.0, 'displayValue': '78'}", date: "2026-01-23", neutral: false}]->(l);

// Gonzaga Bulldogs at Kentucky Wildcats
MATCH (w:Team {espn_id: "2250"}), (l:Team {espn_id: "96"})
MERGE (g:Game {id: "401824034"}) ON CREATE SET
  g.name = "Gonzaga Bulldogs at Kentucky Wildcats",
  g.date = "2025-12-06",
  g.score = "{'value': 94.0, 'displayValue': '94'}-{'value': 59.0, 'displayValue': '59'}",
  g.neutral = true,
  g.venue = "Bridgestone Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 94.0, 'displayValue': '94'}-{'value': 59.0, 'displayValue': '59'}", date: "2025-12-06", neutral: true}]->(l);

// Kentucky Wildcats at Alabama Crimson Tide
MATCH (w:Team {espn_id: "333"}), (l:Team {espn_id: "96"})
MERGE (g:Game {id: "401808152"}) ON CREATE SET
  g.name = "Kentucky Wildcats at Alabama Crimson Tide",
  g.date = "2026-01-03",
  g.score = "{'value': 89.0, 'displayValue': '89'}-{'value': 74.0, 'displayValue': '74'}",
  g.neutral = false,
  g.venue = "Coleman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 89.0, 'displayValue': '89'}-{'value': 74.0, 'displayValue': '74'}", date: "2026-01-03", neutral: false}]->(l);

// Kentucky Wildcats at Tennessee Volunteers
MATCH (w:Team {espn_id: "96"}), (l:Team {espn_id: "2633"})
MERGE (g:Game {id: "401808181"}) ON CREATE SET
  g.name = "Kentucky Wildcats at Tennessee Volunteers",
  g.date = "2026-01-17",
  g.score = "{'value': 80.0, 'displayValue': '80'}-{'value': 78.0, 'displayValue': '78'}",
  g.neutral = false,
  g.venue = "Food City Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 80.0, 'displayValue': '80'}-{'value': 78.0, 'displayValue': '78'}", date: "2026-01-17", neutral: false}]->(l);

// Texas Longhorns at Kentucky Wildcats
MATCH (w:Team {espn_id: "96"}), (l:Team {espn_id: "251"})
MERGE (g:Game {id: "401808185"}) ON CREATE SET
  g.name = "Texas Longhorns at Kentucky Wildcats",
  g.date = "2026-01-22",
  g.score = "{'value': 85.0, 'displayValue': '85'}-{'value': 80.0, 'displayValue': '80'}",
  g.neutral = false,
  g.venue = "Rupp Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 85.0, 'displayValue': '85'}-{'value': 80.0, 'displayValue': '80'}", date: "2026-01-22", neutral: false}]->(l);

// Tennessee Volunteers at Kentucky Wildcats
MATCH (w:Team {espn_id: "96"}), (l:Team {espn_id: "2633"})
MERGE (g:Game {id: "401808220"}) ON CREATE SET
  g.name = "Tennessee Volunteers at Kentucky Wildcats",
  g.date = "2026-02-08",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 71.0, 'displayValue': '71'}",
  g.neutral = false,
  g.venue = "Rupp Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 71.0, 'displayValue': '71'}", date: "2026-02-08", neutral: false}]->(l);

// Kentucky Wildcats at Texas A&M Aggies
MATCH (w:Team {espn_id: "245"}), (l:Team {espn_id: "96"})
MERGE (g:Game {id: "401808275"}) ON CREATE SET
  g.name = "Kentucky Wildcats at Texas A&M Aggies",
  g.date = "2026-03-04",
  g.score = "{'value': 96.0, 'displayValue': '96'}-{'value': 85.0, 'displayValue': '85'}",
  g.neutral = false,
  g.venue = "Reed Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 96.0, 'displayValue': '96'}-{'value': 85.0, 'displayValue': '85'}", date: "2026-03-04", neutral: false}]->(l);

// UCLA Bruins at Iowa Hawkeyes
MATCH (w:Team {espn_id: "2294"}), (l:Team {espn_id: "26"})
MERGE (g:Game {id: "401825414"}) ON CREATE SET
  g.name = "UCLA Bruins at Iowa Hawkeyes",
  g.date = "2026-01-03",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = false,
  g.venue = "Carver-Hawkeye Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 61.0, 'displayValue': '61'}", date: "2026-01-03", neutral: false}]->(l);

// Illinois Fighting Illini at Iowa Hawkeyes
MATCH (w:Team {espn_id: "356"}), (l:Team {espn_id: "2294"})
MERGE (g:Game {id: "401825435"}) ON CREATE SET
  g.name = "Illinois Fighting Illini at Iowa Hawkeyes",
  g.date = "2026-01-11",
  g.score = "{'value': 75.0, 'displayValue': '75'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Carver-Hawkeye Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 75.0, 'displayValue': '75'}-{'value': 69.0, 'displayValue': '69'}", date: "2026-01-11", neutral: false}]->(l);

// BYU Cougars at UConn Huskies
MATCH (w:Team {espn_id: "41"}), (l:Team {espn_id: "252"})
MERGE (g:Game {id: "401812788"}) ON CREATE SET
  g.name = "BYU Cougars at UConn Huskies",
  g.date = "2025-11-16",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 84.0, 'displayValue': '84'}",
  g.neutral = true,
  g.venue = "TD Garden"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 84.0, 'displayValue': '84'}", date: "2025-11-16", neutral: true}]->(l);

// Arizona Wildcats at UConn Huskies
MATCH (w:Team {espn_id: "12"}), (l:Team {espn_id: "41"})
MERGE (g:Game {id: "401812789"}) ON CREATE SET
  g.name = "Arizona Wildcats at UConn Huskies",
  g.date = "2025-11-20",
  g.score = "{'value': 71.0, 'displayValue': '71'}-{'value': 67.0, 'displayValue': '67'}",
  g.neutral = false,
  g.venue = "Gampel Pavilion"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 71.0, 'displayValue': '71'}-{'value': 67.0, 'displayValue': '67'}", date: "2025-11-20", neutral: false}]->(l);

// Illinois Fighting Illini at UConn Huskies
MATCH (w:Team {espn_id: "41"}), (l:Team {espn_id: "356"})
MERGE (g:Game {id: "401811096"}) ON CREATE SET
  g.name = "Illinois Fighting Illini at UConn Huskies",
  g.date = "2025-11-28",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = true,
  g.venue = "Madison Square Garden"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 61.0, 'displayValue': '61'}", date: "2025-11-28", neutral: true}]->(l);

// UConn Huskies at Kansas Jayhawks
MATCH (w:Team {espn_id: "41"}), (l:Team {espn_id: "2305"})
MERGE (g:Game {id: "401812791"}) ON CREATE SET
  g.name = "UConn Huskies at Kansas Jayhawks",
  g.date = "2025-12-03",
  g.score = "{'value': 61.0, 'displayValue': '61'}-{'value': 56.0, 'displayValue': '56'}",
  g.neutral = false,
  g.venue = "Allen Fieldhouse"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 61.0, 'displayValue': '61'}-{'value': 56.0, 'displayValue': '56'}", date: "2025-12-03", neutral: false}]->(l);

// Texas Longhorns at UConn Huskies
MATCH (w:Team {espn_id: "41"}), (l:Team {espn_id: "251"})
MERGE (g:Game {id: "401812794"}) ON CREATE SET
  g.name = "Texas Longhorns at UConn Huskies",
  g.date = "2025-12-13",
  g.score = "{'value': 71.0, 'displayValue': '71'}-{'value': 63.0, 'displayValue': '63'}",
  g.neutral = false,
  g.venue = "PeoplesBank Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 71.0, 'displayValue': '71'}-{'value': 63.0, 'displayValue': '63'}", date: "2025-12-13", neutral: false}]->(l);

// Arizona Wildcats at UCLA Bruins
MATCH (w:Team {espn_id: "12"}), (l:Team {espn_id: "26"})
MERGE (g:Game {id: "401813759"}) ON CREATE SET
  g.name = "Arizona Wildcats at UCLA Bruins",
  g.date = "2025-11-15",
  g.score = "{'value': 69.0, 'displayValue': '69'}-{'value': 65.0, 'displayValue': '65'}",
  g.neutral = true,
  g.venue = "Intuit Dome"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 69.0, 'displayValue': '69'}-{'value': 65.0, 'displayValue': '65'}", date: "2025-11-15", neutral: true}]->(l);

// Arizona Wildcats at Alabama Crimson Tide
MATCH (w:Team {espn_id: "12"}), (l:Team {espn_id: "333"})
MERGE (g:Game {id: "401812266"}) ON CREATE SET
  g.name = "Arizona Wildcats at Alabama Crimson Tide",
  g.date = "2025-12-14",
  g.score = "{'value': 96.0, 'displayValue': '96'}-{'value': 75.0, 'displayValue': '75'}",
  g.neutral = true,
  g.venue = "Legacy Arena at BJCC"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 96.0, 'displayValue': '96'}-{'value': 75.0, 'displayValue': '75'}", date: "2025-12-14", neutral: true}]->(l);

// Arizona Wildcats at UCF Knights
MATCH (w:Team {espn_id: "12"}), (l:Team {espn_id: "2116"})
MERGE (g:Game {id: "401827625"}) ON CREATE SET
  g.name = "Arizona Wildcats at UCF Knights",
  g.date = "2026-01-17",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 77.0, 'displayValue': '77'}",
  g.neutral = false,
  g.venue = "Addition Financial Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 77.0, 'displayValue': '77'}", date: "2026-01-17", neutral: false}]->(l);

// Arizona Wildcats at BYU Cougars
MATCH (w:Team {espn_id: "12"}), (l:Team {espn_id: "252"})
MERGE (g:Game {id: "401820816"}) ON CREATE SET
  g.name = "Arizona Wildcats at BYU Cougars",
  g.date = "2026-01-27",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 83.0, 'displayValue': '83'}",
  g.neutral = false,
  g.venue = "Marriott Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 83.0, 'displayValue': '83'}", date: "2026-01-27", neutral: false}]->(l);

// Arizona Wildcats at Kansas Jayhawks
MATCH (w:Team {espn_id: "2305"}), (l:Team {espn_id: "12"})
MERGE (g:Game {id: "401820818"}) ON CREATE SET
  g.name = "Arizona Wildcats at Kansas Jayhawks",
  g.date = "2026-02-10",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 78.0, 'displayValue': '78'}",
  g.neutral = false,
  g.venue = "Allen Fieldhouse"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 78.0, 'displayValue': '78'}", date: "2026-02-10", neutral: false}]->(l);

// BYU Cougars at Arizona Wildcats
MATCH (w:Team {espn_id: "12"}), (l:Team {espn_id: "252"})
MERGE (g:Game {id: "401827689"}) ON CREATE SET
  g.name = "BYU Cougars at Arizona Wildcats",
  g.date = "2026-02-19",
  g.score = "{'value': 75.0, 'displayValue': '75'}-{'value': 68.0, 'displayValue': '68'}",
  g.neutral = false,
  g.venue = "McKale Center at ALKEME Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 75.0, 'displayValue': '75'}-{'value': 68.0, 'displayValue': '68'}", date: "2026-02-19", neutral: false}]->(l);

// Kansas Jayhawks at Arizona Wildcats
MATCH (w:Team {espn_id: "12"}), (l:Team {espn_id: "2305"})
MERGE (g:Game {id: "401827707"}) ON CREATE SET
  g.name = "Kansas Jayhawks at Arizona Wildcats",
  g.date = "2026-02-28",
  g.score = "{'value': 84.0, 'displayValue': '84'}-{'value': 61.0, 'displayValue': '61'}",
  g.neutral = false,
  g.venue = "McKale Center at ALKEME Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 84.0, 'displayValue': '84'}-{'value': 61.0, 'displayValue': '61'}", date: "2026-02-28", neutral: false}]->(l);

// Long Island University Sharks at Illinois Fighting Illini
MATCH (w:Team {espn_id: "356"}), (l:Team {espn_id: "112358"})
MERGE (g:Game {id: "401812356"}) ON CREATE SET
  g.name = "Long Island University Sharks at Illinois Fighting Illini",
  g.date = "2025-11-22",
  g.score = "{'value': 98.0, 'displayValue': '98'}-{'value': 58.0, 'displayValue': '58'}",
  g.neutral = false,
  g.venue = "State Farm Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 98.0, 'displayValue': '98'}-{'value': 58.0, 'displayValue': '58'}", date: "2025-11-22", neutral: false}]->(l);

// UCLA Bruins at Gonzaga Bulldogs
MATCH (w:Team {espn_id: "2250"}), (l:Team {espn_id: "26"})
MERGE (g:Game {id: "401813763"}) ON CREATE SET
  g.name = "UCLA Bruins at Gonzaga Bulldogs",
  g.date = "2025-12-14",
  g.score = "{'value': 82.0, 'displayValue': '82'}-{'value': 72.0, 'displayValue': '72'}",
  g.neutral = true,
  g.venue = "Climate Pledge Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 82.0, 'displayValue': '82'}-{'value': 72.0, 'displayValue': '72'}", date: "2025-12-14", neutral: true}]->(l);

// Illinois Fighting Illini at UCLA Bruins
MATCH (w:Team {espn_id: "26"}), (l:Team {espn_id: "356"})
MERGE (g:Game {id: "401825532"}) ON CREATE SET
  g.name = "Illinois Fighting Illini at UCLA Bruins",
  g.date = "2026-02-22",
  g.score = "{'value': 95.0, 'displayValue': '95'}-{'value': 94.0, 'displayValue': '94'}",
  g.neutral = false,
  g.venue = "Pauley Pavilion"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 95.0, 'displayValue': '95'}-{'value': 94.0, 'displayValue': '94'}", date: "2026-02-22", neutral: false}]->(l);

// Kansas Jayhawks at Tennessee Volunteers
MATCH (w:Team {espn_id: "2305"}), (l:Team {espn_id: "2633"})
MERGE (g:Game {id: "401831215"}) ON CREATE SET
  g.name = "Kansas Jayhawks at Tennessee Volunteers",
  g.date = "2025-11-27",
  g.score = "{'value': 81.0, 'displayValue': '81'}-{'value': 76.0, 'displayValue': '76'}",
  g.neutral = true,
  g.venue = "MGM Grand Garden Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 81.0, 'displayValue': '81'}-{'value': 76.0, 'displayValue': '76'}", date: "2025-11-27", neutral: true}]->(l);

// Illinois Fighting Illini at Tennessee Volunteers
MATCH (w:Team {espn_id: "356"}), (l:Team {espn_id: "2633"})
MERGE (g:Game {id: "401811099"}) ON CREATE SET
  g.name = "Illinois Fighting Illini at Tennessee Volunteers",
  g.date = "2025-12-07",
  g.score = "{'value': 75.0, 'displayValue': '75'}-{'value': 62.0, 'displayValue': '62'}",
  g.neutral = true,
  g.venue = "Bridgestone Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 75.0, 'displayValue': '75'}-{'value': 62.0, 'displayValue': '62'}", date: "2025-12-07", neutral: true}]->(l);

// Texas Longhorns at Tennessee Volunteers
MATCH (w:Team {espn_id: "2633"}), (l:Team {espn_id: "251"})
MERGE (g:Game {id: "401808160"}) ON CREATE SET
  g.name = "Texas Longhorns at Tennessee Volunteers",
  g.date = "2026-01-07",
  g.score = "{'value': 85.0, 'displayValue': '85'}-{'value': 71.0, 'displayValue': '71'}",
  g.neutral = false,
  g.venue = "Food City Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 85.0, 'displayValue': '85'}-{'value': 71.0, 'displayValue': '71'}", date: "2026-01-07", neutral: false}]->(l);

// Texas A&M Aggies at Tennessee Volunteers
MATCH (w:Team {espn_id: "2633"}), (l:Team {espn_id: "245"})
MERGE (g:Game {id: "401808175"}) ON CREATE SET
  g.name = "Texas A&M Aggies at Tennessee Volunteers",
  g.date = "2026-01-14",
  g.score = "{'value': 87.0, 'displayValue': '87'}-{'value': 82.0, 'displayValue': '82'}",
  g.neutral = false,
  g.venue = "Food City Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 87.0, 'displayValue': '87'}-{'value': 82.0, 'displayValue': '82'}", date: "2026-01-14", neutral: false}]->(l);

// Tennessee Volunteers at Alabama Crimson Tide
MATCH (w:Team {espn_id: "2633"}), (l:Team {espn_id: "333"})
MERGE (g:Game {id: "401808199"}) ON CREATE SET
  g.name = "Tennessee Volunteers at Alabama Crimson Tide",
  g.date = "2026-01-25",
  g.score = "{'value': 79.0, 'displayValue': '79'}-{'value': 73.0, 'displayValue': '73'}",
  g.neutral = false,
  g.venue = "Coleman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 79.0, 'displayValue': '79'}-{'value': 73.0, 'displayValue': '73'}", date: "2026-01-25", neutral: false}]->(l);

// Alabama Crimson Tide at Tennessee Volunteers
MATCH (w:Team {espn_id: "333"}), (l:Team {espn_id: "2633"})
MERGE (g:Game {id: "401808271"}) ON CREATE SET
  g.name = "Alabama Crimson Tide at Tennessee Volunteers",
  g.date = "2026-02-28",
  g.score = "{'value': 71.0, 'displayValue': '71'}-{'value': 69.0, 'displayValue': '69'}",
  g.neutral = false,
  g.venue = "Food City Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 71.0, 'displayValue': '71'}-{'value': 69.0, 'displayValue': '69'}", date: "2026-02-28", neutral: false}]->(l);

// UCF Knights at Texas A&M Aggies
MATCH (w:Team {espn_id: "2116"}), (l:Team {espn_id: "245"})
MERGE (g:Game {id: "401824826"}) ON CREATE SET
  g.name = "UCF Knights at Texas A&M Aggies",
  g.date = "2025-11-15",
  g.score = "{'value': 86.0, 'displayValue': '86'}-{'value': 74.0, 'displayValue': '74'}",
  g.neutral = false,
  g.venue = "Reed Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 86.0, 'displayValue': '86'}-{'value': 74.0, 'displayValue': '74'}", date: "2025-11-15", neutral: false}]->(l);

// Texas A&M Aggies at Texas Longhorns
MATCH (w:Team {espn_id: "245"}), (l:Team {espn_id: "251"})
MERGE (g:Game {id: "401808183"}) ON CREATE SET
  g.name = "Texas A&M Aggies at Texas Longhorns",
  g.date = "2026-01-17",
  g.score = "{'value': 74.0, 'displayValue': '74'}-{'value': 70.0, 'displayValue': '70'}",
  g.neutral = false,
  g.venue = "Moody Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 74.0, 'displayValue': '74'}-{'value': 70.0, 'displayValue': '70'}", date: "2026-01-17", neutral: false}]->(l);

// Texas A&M Aggies at Alabama Crimson Tide
MATCH (w:Team {espn_id: "333"}), (l:Team {espn_id: "245"})
MERGE (g:Game {id: "401808215"}) ON CREATE SET
  g.name = "Texas A&M Aggies at Alabama Crimson Tide",
  g.date = "2026-02-05",
  g.score = "{'value': 100.0, 'displayValue': '100'}-{'value': 97.0, 'displayValue': '97'}",
  g.neutral = false,
  g.venue = "Coleman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 100.0, 'displayValue': '100'}-{'value': 97.0, 'displayValue': '97'}", date: "2026-02-05", neutral: false}]->(l);

// Texas Longhorns at Texas A&M Aggies
MATCH (w:Team {espn_id: "251"}), (l:Team {espn_id: "245"})
MERGE (g:Game {id: "401808272"}) ON CREATE SET
  g.name = "Texas Longhorns at Texas A&M Aggies",
  g.date = "2026-02-28",
  g.score = "{'value': 76.0, 'displayValue': '76'}-{'value': 70.0, 'displayValue': '70'}",
  g.neutral = false,
  g.venue = "Reed Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 76.0, 'displayValue': '76'}-{'value': 70.0, 'displayValue': '70'}", date: "2026-02-28", neutral: false}]->(l);

// Gonzaga Bulldogs at Alabama Crimson Tide
MATCH (w:Team {espn_id: "2250"}), (l:Team {espn_id: "333"})
MERGE (g:Game {id: "401812263"}) ON CREATE SET
  g.name = "Gonzaga Bulldogs at Alabama Crimson Tide",
  g.date = "2025-11-25",
  g.score = "{'value': 95.0, 'displayValue': '95'}-{'value': 85.0, 'displayValue': '85'}",
  g.neutral = true,
  g.venue = "MGM Grand Garden Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 95.0, 'displayValue': '95'}-{'value': 85.0, 'displayValue': '85'}", date: "2025-11-25", neutral: true}]->(l);

// BYU Cougars at Miami Hurricanes
MATCH (w:Team {espn_id: "252"}), (l:Team {espn_id: "2390"})
MERGE (g:Game {id: "401809419"}) ON CREATE SET
  g.name = "BYU Cougars at Miami Hurricanes",
  g.date = "2025-11-27",
  g.score = "{'value': 72.0, 'displayValue': '72'}-{'value': 62.0, 'displayValue': '62'}",
  g.neutral = true,
  g.venue = "State Farm Field House"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 72.0, 'displayValue': '72'}-{'value': 62.0, 'displayValue': '62'}", date: "2025-11-27", neutral: true}]->(l);

// BYU Cougars at Kansas Jayhawks
MATCH (w:Team {espn_id: "2305"}), (l:Team {espn_id: "252"})
MERGE (g:Game {id: "401827655"}) ON CREATE SET
  g.name = "BYU Cougars at Kansas Jayhawks",
  g.date = "2026-01-31",
  g.score = "{'value': 90.0, 'displayValue': '90'}-{'value': 82.0, 'displayValue': '82'}",
  g.neutral = false,
  g.venue = "Allen Fieldhouse"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 90.0, 'displayValue': '90'}-{'value': 82.0, 'displayValue': '82'}", date: "2026-01-31", neutral: false}]->(l);

// UCF Knights at BYU Cougars
MATCH (w:Team {espn_id: "2116"}), (l:Team {espn_id: "252"})
MERGE (g:Game {id: "401827701"}) ON CREATE SET
  g.name = "UCF Knights at BYU Cougars",
  g.date = "2026-02-25",
  g.score = "{'value': 97.0, 'displayValue': '97'}-{'value': 84.0, 'displayValue': '84'}",
  g.neutral = false,
  g.venue = "Marriott Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 97.0, 'displayValue': '97'}-{'value': 84.0, 'displayValue': '84'}", date: "2026-02-25", neutral: false}]->(l);

// Kansas Jayhawks at UCF Knights
MATCH (w:Team {espn_id: "2116"}), (l:Team {espn_id: "2305"})
MERGE (g:Game {id: "401827594"}) ON CREATE SET
  g.name = "Kansas Jayhawks at UCF Knights",
  g.date = "2026-01-03",
  g.score = "{'value': 81.0, 'displayValue': '81'}-{'value': 75.0, 'displayValue': '75'}",
  g.neutral = false,
  g.venue = "Addition Financial Arena"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 81.0, 'displayValue': '81'}-{'value': 75.0, 'displayValue': '75'}", date: "2026-01-03", neutral: false}]->(l);

// Alabama Crimson Tide at Illinois Fighting Illini
MATCH (w:Team {espn_id: "333"}), (l:Team {espn_id: "356"})
MERGE (g:Game {id: "401811098"}) ON CREATE SET
  g.name = "Alabama Crimson Tide at Illinois Fighting Illini",
  g.date = "2025-11-20",
  g.score = "{'value': 90.0, 'displayValue': '90'}-{'value': 86.0, 'displayValue': '86'}",
  g.neutral = true,
  g.venue = "United Center"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 90.0, 'displayValue': '90'}-{'value': 86.0, 'displayValue': '86'}", date: "2025-11-20", neutral: true}]->(l);

// Texas Longhorns at Alabama Crimson Tide
MATCH (w:Team {espn_id: "251"}), (l:Team {espn_id: "333"})
MERGE (g:Game {id: "401808168"}) ON CREATE SET
  g.name = "Texas Longhorns at Alabama Crimson Tide",
  g.date = "2026-01-11",
  g.score = "{'value': 92.0, 'displayValue': '92'}-{'value': 88.0, 'displayValue': '88'}",
  g.neutral = false,
  g.venue = "Coleman Coliseum"
WITH g, w, l
MERGE (w)-[:WON_GAME]->(g)
MERGE (l)-[:LOST_GAME]->(g)
MERGE (w)-[:BEAT {score: "{'value': 92.0, 'displayValue': '92'}-{'value': 88.0, 'displayValue': '88'}", date: "2026-01-11", neutral: false}]->(l);


// ================================================================
// Useful Queries
// ================================================================

// All head-to-head results between bracket teams:
// MATCH (w:Team)-[b:BEAT]->(l:Team) RETURN w.name, b.score, l.name, b.date ORDER BY b.date

// Teams that NEVER played each other (missing edges):
// MATCH (a:Team), (b:Team)
// WHERE a.espn_id < b.espn_id
// AND NOT (a)-[:BEAT]-(b)
// RETURN a.name, b.name

// Win count vs bracket field:
// MATCH (w:Team)-[:BEAT]->(l:Team)
// RETURN w.name, count(*) AS wins ORDER BY wins DESC

// All games for Duke:
// MATCH (t:Team {name:"Duke Blue Devils"})-[b:BEAT|BEAT*..1]->(opp)
// RETURN t.name, b, opp.name

// Same-region matchups only:
// MATCH (a:Team)-[b:BEAT]->(l:Team)
// WHERE a.region = l.region
// RETURN a.name, a.region, b.score, l.name ORDER BY a.region