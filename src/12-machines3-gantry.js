//@ the gantry pickers: a crane over every rack row that picks order boxes onto the overhead pick belts, which feed the packing bench
  // ── The gantry pickers ────────────────────────────────────────────
  // Every rack row carries its own crane: two rails run the length of the row and a trolley with a telescoping mast and a gripper
  // rides them. Each crane looks at the open orders, takes a box the bench still needs out of its own row, lifts it clear of the
  // racking, runs to the east end and sets it on the overhead pick belt that passes there. Rows A to D drop on the south belt,
  // rows E and F on the north one; both belts end at the bench, so a picked box lands where a picker would have put it.
  var GANTRY_SPEED = 3.0, GANTRY_LIFT = 2.0, GANTRY_DROP_X = 46.0;
  // the pick belts run overhead at 2.4 m so the east aisle stays open, and come down to the bench at their ends
  var PICK_H = 2.4;
  // the south belt starts over row A, stays high past row D and drops to the bench; the north one starts over row F, passes row E and drops from the other side
  // both belts stay high along the row ends, cross the east corridor hung from the roof (no legs in the drive lane) and ramp down beside the bench:
  // the south one just past row D, ramping south to the bench's west inlet; the north one just past row E, ramping north to a second inlet
  // the two feeders stay high along the row ends, turn in past row D and row E and meet hung over the lane at the merge point (26.6, 5.2);
  // from there one merge belt crosses the rest of the lane on rods and ramps down to bench height at the bench's north-west corner
  var PICK_MERGE = { x: 26.6, z: 5.2 };
  var PB_S = (function () { var z0 = RACK.rows[0], yC = RACK.rows[2] - z0 + 0.8; return [[0, 0, PICK_H], [0, yC, PICK_H, 'hang'], [PICK_MERGE.x - 22, PICK_MERGE.z - z0, PICK_H, 'hang']]; })();   // hung from the roof end to end: no legs in the walk round the rack ends
  var PB_N = (function () { var z0 = RACK.rows[RACK.rows.length - 1], yC = RACK.rows[3] - z0 - 0.8; return [[0, 0, PICK_H], [0, yC, PICK_H, 'hang'], [PICK_MERGE.x - 22, PICK_MERGE.z - z0, PICK_H, 'hang']]; })();
  var PB_M = [[0, 0, PICK_H], [3.6, 0, PICK_H, 'hang'], [3.6, -1.6, 1.35, 'hang'], [3.6, -3.2, 0.2]];   // the drop is two runs: the upper one hangs high enough to walk under, so only its last 1.6 m stands on the floor beside the bench
  defBelt('pickMerge', { prop: 'pickMerge', path: PB_M, speedKey: 'pickBelt' });
  defBelt('pickBelt', { prop: 'pickBelt', path: PB_S });
  defBelt('pickBelt2', { prop: 'pickBelt2', path: PB_N, speedKey: 'pickBelt' });   // both pick belts share one dial
  function benchAccept(it) { if (it.kind !== 'box') return false; if (benchCount() >= ECON.benchCap) return false; benchAdd(it.sku, 1); sfx('putdown'); return true; }
  defMachine('benchIn', { prop: 'bench', inlets: [[-2.4, -3.2], [0, 2.3], [-1.1, 0], [1.1, 0.6], [1.1, -0.6]], accept: benchAccept });   // where the merge belt lands, and the bench's own ends and sides, so a run of pieces can feed it from any side
  for (var gr = 0; gr < RACK.rows.length; gr++) defMachine('gantry' + gr, { prop: 'gantry' + gr });
  function gantryBeltFor(r) { return r >= UPPER.row ? 'upperPick' : r >= 3 ? 'pickBelt2' : 'pickBelt'; }
  function gantryTop(r) { return r >= UPPER.row ? 3.0 : 5.0; }   // rail height in the crane's own frame: the upper crane runs under the roof
  function gantryDropLift(r) { return r >= UPPER.row ? BELT_Y + 0.6 : BELT_Y + PICK_H + 0.6; }   // the upper pick belt lies on the deck, the ground ones hang high   // rows A to C on the south belt, D and E on the north one
  function gantryRows() { var out = []; for (var r = 0; r < RACK.rows.length; r++) if (r < S.up.rows && propInst['gantry' + r]) out.push(r); if (S.up.upper && propInst.gantry5) out.push(UPPER.row); return out; }
  function gantryState(r) { r = r || 0; if (!S.gantries) S.gantries = {}; if (!S.gantries[r]) S.gantries[r] = { x: GANTRY_DROP_X, lift: 5.0, state: 'idle', sku: null, key: null, t: 0, picked: 0 }; return S.gantries[r]; }
  function gantryNeed(r) {
    var need = {}; S.orders.forEach(function (o) { if (o.state !== 'open') return; o.lines.forEach(function (l) { need[l.sku] = (need[l.sku] || 0) + l.qty; }); });
    for (var k in S.bench.boxes) need[k] = (need[k] || 0) - S.bench.boxes[k];
    var fl = pickInFlight(); for (var fk in fl) need[fk] = (need[fk] || 0) - fl[fk];   // the belts, the other cranes, the pickers' hands and their claims: see pickInFlight
    for (var sku in need) if (need[sku] > 0) { if (r === UPPER.row && groundStock(sku) > 0) continue; for (var key in S.slots) { var p = slotParse(key), s = S.slots[key]; if (p.r === r && s && s.sku === sku && s.n > 0) return { sku: sku, key: key, to: 'ground' }; } }   // the upper crane sends down only what the ground floor has none of
    return null;
  }
  function tickGantry(dt) {
    if (!S.up.gantry) return;
    if (!powered()) { gantryRows().forEach(function (r) { if (MACH['gantry' + r]) lampSet(MACH['gantry' + r], 'off'); }); return; }   // the lamps go dark in a power cut
    gantryRows().forEach(function (r) { tickGantryRow(r, dt); });
  }
  var gantryShown = {};
  function tickGantryRow(r, dt) {
    var G = gantryState(r), id = 'gantry' + r, belt = gantryBeltFor(r), top = gantryTop(r);
    if (gantryShown[r] !== G.state + (G.paused ? 'p' : '')) { gantryShown[r] = G.state + (G.paused ? 'p' : ''); if (MACH[id].screen) MACH[id].screen.dirty = true; }
    var spd = speedOf(id); var toX = function (lx, speed) { speed *= spd; var d = lx - G.x; if (Math.abs(d) <= speed * dt) { G.x = lx; return true; } G.x += Math.sign(d) * speed * dt; return false; };
    var toLift = function (y, speed) { speed *= spd; var d = y - G.lift; if (Math.abs(d) <= speed * dt) { G.lift = y; return true; } G.lift += Math.sign(d) * speed * dt; return false; };
    if (G.state === 'idle') { var job = G.paused ? null : gantryNeed(r); if (job) { G.sku = job.sku; G.key = job.key; G.to = job.to || 'ground'; var sp = slotParse(job.key); G.bayX = RACK.bayW * (sp.b + 0.5); G.level = RACK.levels[sp.l] + 0.9; G.state = 'toBay'; } else { toX(GANTRY_DROP_X, GANTRY_SPEED); toLift(top, GANTRY_LIFT); } }
    else if (G.state === 'toBay') { if (toX(G.bayX, GANTRY_SPEED)) G.state = 'down'; }
    else if (G.state === 'down') { if (toLift(G.level, GANTRY_LIFT)) { var s = S.slots[G.key]; if (s && s.sku === G.sku && s.n > 0) { slotTake(G.key, 1); s.wrapped = false; S.stats.picked++; G.state = 'up'; } else { G.sku = null; G.state = 'up'; } } }
    else if (G.state === 'up') { if (toLift(top, GANTRY_LIFT)) G.state = G.sku ? 'toDrop' : 'idle'; }
    else if (G.state === 'toDrop') { if (toX(GANTRY_DROP_X, GANTRY_SPEED)) G.state = 'lower'; }
    else if (G.state === 'lower') { if (toLift(gantryDropLift(r), GANTRY_LIFT)) G.state = 'drop'; }
    else if (G.state === 'drop') { if (propInst[BELTS[belt].prop] && beltPush(belt, { kind: 'box', sku: G.sku, to: G.to || 'ground' })) { G.picked++; S.stats.gantryPicked = (S.stats.gantryPicked || 0) + 1; sfx('click'); G.sku = null; G.state = 'up'; } }
    var m = MACH[id].anim; if (m) { m.trolley.position.x = G.x; m.mast.scale.y = Math.max(0.05, (top - G.lift) / (top - 1.0)); m.mast.position.y = -(top - G.lift) / 2; m.grip.position.y = -(top - G.lift); m.box.visible = !!G.sku && G.state !== 'toBay' && G.state !== 'down'; if (m.box.visible && G.sku) { m.box.material = CARD[G.sku] || m.box.material; } m.beacon.visible = G.state !== 'idle'; m.beacon.rotation.y = worldTime * 6; }
    lampSet(MACH[id], G.paused && G.state === 'idle' ? 'off' : G.state === 'idle' ? 'idle' : 'run');
  }
  // the control panel on each crane's cabinet: what it is doing, what its row holds, pause and reset
  function gantryRowStock(r) { var n = 0, slots = 0; for (var key in S.slots) { var p = slotParse(key), s = S.slots[key]; if (p.r === r && s && s.n > 0) { n += s.n; slots++; } } return { n: n, slots: slots }; }
  function gantryScreenDraw(r) { return function (c, sc) {
    var G = gantryState(r), st = !powered() ? 'off' : G.paused && G.state === 'idle' ? 'paused' : G.state === 'idle' ? 'ready' : 'running';
    scBg(c, sc.w, sc.h, st === 'running' ? 'rgba(95,211,141,0.18)' : st === 'paused' || st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'GANTRY ' + rowLetter(r), st.toUpperCase());
    var rs = gantryRowStock(r), pos = G.state === 'idle' ? 'parked at the belt' : G.state === 'toBay' ? 'running to bay ' + (Math.round(G.bayX / RACK.bayW - 0.5) + 1) : G.state === 'down' || G.state === 'up' ? 'at the rack' : G.state === 'toDrop' ? 'running to the belt' : 'setting down';
    scText(c, 16, 70, G.sku ? 'Picking ' + skuName(G.sku) : G.paused ? 'Held: finishing nothing' : 'Watching the orders', '#eef1f5', 16);
    scText(c, 16, 94, pos + ' · trolley ' + G.x.toFixed(1) + ' m · hook ' + G.lift.toFixed(1) + ' m', '#a0acb8', 13);
    scText(c, 16, 118, 'Row ' + rowLetter(r) + ': ' + rs.n + ' boxes in ' + rs.slots + ' slots · picked ' + G.picked, '#a0acb8', 13);
    scText(c, 16, 136, 'Belt ' + beltItems(gantryBeltFor(r)).length + ' · bench ' + benchCount() + '/' + ECON.benchCap, '#a0acb8', 13);
    speedButton(sc, 208, 152, 76, 'gantry' + r); scText(c, 212, 148, 'crane', '#6b7784', 9); speedButton(sc, 208, 116, 76, 'pickBelt'); scText(c, 212, 112, 'pick belt', '#6b7784', 9);
    scButton(sc, 16, 150, 80, 34, G.paused ? 'RESUME' : 'PAUSE', !G.paused, function () { G.paused = !G.paused; toast('Gantry ' + rowLetter(r) + (G.paused ? ' will hold after this pick' : ' running'), G.paused ? 'bad' : 'good'); }, G.paused ? '#5fd38d' : '#f5b53d');
    scButton(sc, 102, 150, 100, 34, 'RESET JOB', G.state !== 'idle', function () { if (G.state === 'idle') return; if (G.sku && /^(up|toDrop|lower|drop)$/.test(G.state)) { var back = G.key && slotSpace(G.key, G.sku) > 0 ? G.key : findSlotFor(G.sku, 1, 2); if (back) slotAdd(back, G.sku, 1); else S.floor.push({ kind: 'box', sku: G.sku, x: RACK.x0 + G.x, y: 0, z: RACK.rows[r] + 1.2, rot: 0 }); } G.sku = null; G.key = null; G.state = 'up'; sfx('hydraulic'); toast('Gantry ' + rowLetter(r) + ' dropped its job and is coming home', 'good'); }, '#ff6b5e');
  }; }
  function gantryPrompt(r) { var G = gantryState(r); return 'Gantry picker ' + rowLetter(r) + ' · ' + (!powered() ? 'no power' : G.state === 'idle' ? 'watching the orders' : G.sku ? 'picking ' + skuName(G.sku) : 'working') + ' · ' + G.picked + ' boxes picked'; }
  // the crane props follow the rack rows: buying the gantry upgrade builds one over every row you own, buying a row adds its crane
  function buildGantries() { if (!S.up.gantry) return; for (var r = 0; r < RACK.rows.length; r++) if (r < S.up.rows) buildProp('gantry' + r); buildProp('pickBelt'); buildProp('pickMerge'); if (S.up.upper) { buildProp('gantry5'); buildProp('upperPick'); } if (S.up.rows > 3) buildProp('pickBelt2'); }   // rows D and E feed the north belt, so it comes with row D
