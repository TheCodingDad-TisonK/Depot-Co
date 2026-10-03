//@ the gantry picker: a crane over row A that picks order boxes onto the pick belt, which feeds the packing bench
  // ── The gantry picker ─────────────────────────────────────────────
  // Two rails run the length of row A. A trolley with a telescoping mast and a gripper rides them: it looks at the open orders,
  // takes a box the bench still needs out of a row A slot, lifts it clear of the racking, runs to the east end and sets it on
  // the pick belt. The belt ends at the bench, so a picked box lands where a picker would have put it.
  var GANTRY_ROW = 0, GANTRY_SPEED = 3.0, GANTRY_LIFT = 2.0;
  // the pick belt runs overhead at 2.4 m so the east aisle stays open, and comes down to the bench at its end
  var PICK_H = 2.4;
  defBelt('pickBelt', { prop: 'pickBelt', path: [[0, 0, PICK_H], [0, 15.0, PICK_H], [0, 19.5, 0], [3.7, 19.5, 0]] });
  defMachine('benchIn', { prop: 'bench', inlet: [-0.8, 0], accept: function (it) { if (it.kind !== 'box') return false; if (benchCount() >= ECON.benchCap) return false; benchAdd(it.sku, 1); sfx('putdown'); return true; } });
  defMachine('gantry', { prop: 'gantry' });
  function gantryState() { if (!S.gantry) S.gantry = { x: 23.4, lift: 5.0, state: 'idle', sku: null, key: null, t: 0, picked: 0 }; return S.gantry; }
  function gantryPark() { return propInst.gantry ? propWorld('gantry', 46.0, 0) : null; }
  function gantryNeed() {
    var need = {}; S.orders.forEach(function (o) { if (o.state !== 'open') return; o.lines.forEach(function (l) { need[l.sku] = (need[l.sku] || 0) + l.qty; }); });
    for (var k in S.bench.boxes) need[k] = (need[k] || 0) - S.bench.boxes[k];
    beltItems('pickBelt').forEach(function (it) { if (it.kind === 'box') need[it.sku] = (need[it.sku] || 0) - 1; });
    var G = gantryState(); if (G.sku && G.state !== 'idle') need[G.sku] = (need[G.sku] || 0) - 1;
    S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box') need[st.carry.sku] = (need[st.carry.sku] || 0) - 1; });
    for (var sku in need) if (need[sku] > 0) { for (var key in S.slots) { var p = slotParse(key), s = S.slots[key]; if (p.r === GANTRY_ROW && s && s.sku === sku && s.n > 0) return { sku: sku, key: key }; } }
    return null;
  }
  function tickGantry(dt) {
    if (!S.up.gantry || !propInst.gantry) return;
    var G = gantryState(), P = propPlacement('gantry'), a = P.rot * Math.PI / 2;
    if (!powered()) return;
    var toX = function (lx, speed) { var d = lx - G.x; if (Math.abs(d) <= speed * dt) { G.x = lx; return true; } G.x += Math.sign(d) * speed * dt; return false; };
    var toLift = function (y, speed) { var d = y - G.lift; if (Math.abs(d) <= speed * dt) { G.lift = y; return true; } G.lift += Math.sign(d) * speed * dt; return false; };
    if (G.state === 'idle') { var job = gantryNeed(); if (job) { G.sku = job.sku; G.key = job.key; var sp = slotParse(job.key); G.bayX = RACK.bayW * (sp.b + 0.5); G.level = RACK.levels[sp.l] + 0.9; G.state = 'toBay'; } else { toX(46.0, GANTRY_SPEED); toLift(5.0, GANTRY_LIFT); } }
    else if (G.state === 'toBay') { if (toX(G.bayX, GANTRY_SPEED)) G.state = 'down'; }
    else if (G.state === 'down') { if (toLift(G.level, GANTRY_LIFT)) { var s = S.slots[G.key]; if (s && s.sku === G.sku && s.n > 0) { slotTake(G.key, 1); s.wrapped = false; S.stats.picked++; G.state = 'up'; } else { G.sku = null; G.state = 'up'; } } }
    else if (G.state === 'up') { if (toLift(5.0, GANTRY_LIFT)) G.state = G.sku ? 'toDrop' : 'idle'; }
    else if (G.state === 'toDrop') { if (toX(46.0, GANTRY_SPEED)) G.state = 'lower'; }
    else if (G.state === 'lower') { if (toLift(BELT_Y + PICK_H + 0.6, GANTRY_LIFT)) G.state = 'drop'; }
    else if (G.state === 'drop') { if (beltPush('pickBelt', { kind: 'box', sku: G.sku })) { G.picked++; S.stats.gantryPicked = (S.stats.gantryPicked || 0) + 1; sfx('click'); G.sku = null; G.state = 'up'; } }
    var m = MACH.gantry.anim; if (m) { m.trolley.position.x = G.x; m.mast.scale.y = Math.max(0.05, (5.0 - G.lift) / 4.0); m.mast.position.y = -(5.0 - G.lift) / 2; m.grip.position.y = -(5.0 - G.lift); m.box.visible = !!G.sku && G.state !== 'toBay' && G.state !== 'down'; if (m.box.visible && G.sku) { m.box.material = CARD[G.sku] || m.box.material; } m.beacon.visible = G.state !== 'idle'; m.beacon.rotation.y = worldTime * 6; }
    lampSet(MACH.gantry, G.state === 'idle' ? 'idle' : 'run');
  }
  function gantryPrompt() { var G = gantryState(); return 'Gantry picker · ' + (!powered() ? 'no power' : G.state === 'idle' ? 'watching the orders' : G.sku ? 'picking ' + skuName(G.sku) : 'working') + ' · ' + (S.stats.gantryPicked || 0) + ' boxes picked'; }
