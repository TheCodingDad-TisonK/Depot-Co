//@ the mezzanine (1.14.0): a goods lift by the IN docks, a steel deck over the receiving strip, an upper rack row with a crane of its own, a feed belt from the lift head and a pick belt down a chute into the south pick belt
  // ── The upper level ───────────────────────────────────────────────
  // The deck sits over the open strip between the inbound docks and the north wall (z -24 to -13.5), the one part of the hall
  // with no crane above it, at 4.6 m: clear of the 4.2 m dock doors. A pallet set in the lift goes up by itself, rolls onto the
  // feed belt, and the row's intake racks it. The upper crane picks for orders onto the upper pick belt, which drops down a chute
  // into the south pick belt, so boxes from upstairs reach the merge and the bench like any other pick. The stair runs along the
  // north wall under the deck and comes up through it. Nothing up there needs a worker: the crew stay on the ground floor, and
  // slot row 5 is theirs to ignore (the picker's slot search filters it). Tyson's brief, 2026-10-06: "the automated floor gets its
  // orders via a lift near the IN side; I place the pallet in the lift and send it up; from there the automated part starts."
  var UPPER = { y: 4.6, z0: -HALL.z + 0.3, z1: -13.5, rowZ: -19.0, row: 5, levels: 2, rise: 8,
    lift: { x: -31.0, z: -15.5 }, shaft: { x0: -32.2, x1: -29.8, z0: -16.7, z1: -14.3 },   // on the deck's south edge by IN 1, east of the first jack's bay at (-33.8, -18); the north-west corner is the break room
    stair: { x0: -25.6, x1: -16.0, z0: -23.4, z1: -21.8 }, well: { x0: -25.6, x1: -20.8 } };   // the well: the part of the stair that comes up through the deck
  function upperOwned() { return !!(S.up && S.up.upper); }
  function inRect(x, z, r) { return x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1; }
  function stairY(x) { return clamp((UPPER.stair.x1 - x) / (UPPER.stair.x1 - UPPER.stair.x0), 0, 1) * UPPER.y; }
  // the floor height the upper level gives a point, or null when it has nothing to say. The deck counts only for someone already
  // up there (y above 2.6), so the strip below it stays walkable; the stair counts for everyone, which keeps the crew off it.
  function upperFloorY(x, z, y) {
    if (!upperOwned() || !propInst.mezz) return null;
    if (inRect(x, z, UPPER.stair)) { if ((y || 0) > 2.6 && x > UPPER.well.x1) return UPPER.y; return stairY(x); }
    if ((y || 0) > 2.6) { var wo = walkoverY(x, z); if (wo !== null) return UPPER.y + wo; }   // the step-overs' stairs and platforms
    if ((y || 0) > 2.6 && Math.abs(x) < HALL.x - 0.2 && z > UPPER.z0 - 0.3 && z < UPPER.z1 && !inRect(x, z, UPPER.shaft) && !inSorterWell(x, z)) return UPPER.y;
    return null;
  }
  function isUpperRow(r) { return r === UPPER.row; }
  function upperRowsOwned() { return upperOwned() ? 1 : 0; }
  // the first upper slot with room: a part-filled slot of the same SKU first, then an empty one
  function upperSlotFor(sku, n) {
    for (var pass = 0; pass < 2; pass++) for (var r = UPPER.row; r < UPPER.row + upperRowsOwned(); r++) for (var l = 0; l < UPPER.levels; l++) for (var b = 0; b < RACK.bays; b++) {
      var k = slotKey(r, b, l), s = S.slots[k];
      if (pass === 0 ? (s && s.n > 0 && s.sku === sku && slotSpace(k, sku) >= n) : ((!s || !s.n) && slotSpace(k, sku) >= n)) return k;
    }
    return null;
  }
  // props raised onto the deck: the group goes up, and so do the solids the build registered
  function raiseToDeck(ctx, P, inst) { inst.g.position.y = UPPER.y; for (var i = 0; i < solids.length; i++) if (solids[i].prop === inst.id) { solids[i].y0 += UPPER.y; solids[i].y1 += UPPER.y; } }

  // ── The goods lift ────────────────────────────────────────────────
  var liftM = null, liftScreen = null, liftShown = '';
  function liftState() { if (!S.lift) S.lift = { pallet: null, pos: 0, state: 'down' }; return S.lift; }
  function liftPrompt() {
    var L = liftState(), jp = isJack(player.tool) ? jackPallet() : null, lp = L.pallet ? palletById(L.pallet) : null;
    if (!powered()) return 'Goods lift · no power';
    if (L.state !== 'down') return 'Goods lift · ' + (L.state === 'rising' ? 'going up' : L.state === 'up' ? 'unloading upstairs' : 'coming down');
    if (jp && !lp) return jp.n <= 0 ? 'An empty pallet has no business upstairs' : SKU[jp.sku] && SKU[jp.sku].raw ? 'Granulate goes to the hopper, not upstairs' : !upperSlotFor(jp.sku, jp.n) ? 'No room on the upper row for this pallet' : 'Set the pallet in the lift (it goes up by itself)';
    if (lp && !jp && isJack(player.tool)) return 'Take the pallet back out of the lift';
    return lp ? 'Goods lift · pallet of ' + lp.n + ' × ' + skuName(lp.sku) + (L.hold ? ' held at the floor' : ' about to go up') : 'Goods lift · empty, at the floor';
  }
  function liftUse() {
    var L = liftState(), jt = jackTool(), jp = isJack(player.tool) ? jackPallet() : null, lp = L.pallet ? palletById(L.pallet) : null;
    if (!powered() || L.state !== 'down') { sfx('bad'); return; }
    if (jp && !lp) { if (jp.n <= 0 || (SKU[jp.sku] && SKU[jp.sku].raw) || !upperSlotFor(jp.sku, jp.n)) { toast(jp.n <= 0 ? 'An empty pallet has no business upstairs.' : SKU[jp.sku] && SKU[jp.sku].raw ? 'Granulate goes to the hopper, not upstairs.' : 'No room on the upper row for this pallet.', 'bad'); sfx('bad'); return; } jp.place = 'lift'; S[jt].pallet = null; L.pallet = jp.id; L.wait = 1.5; sfx('crate'); toast('Pallet in the lift · it goes up by itself', 'good'); return; }
    if (lp && !jp && isJack(player.tool)) { lp.place = 'jack'; lp.jack = jt; S[jt].pallet = lp.id; L.pallet = null; sfx('jack'); return; }
    sfx('click');
  }
  // the forklift: forks over the lift floor with a pallet on them set it in (forkUse asks this before setting a pallet on the floor)
  function liftTakesFork(tipX, tipZ, p) {
    var L = liftState(); if (!upperOwned() || !propInst.lift || L.state !== 'down' || L.pallet || !powered()) return false;
    if (dist2(tipX, tipZ, UPPER.lift.x, UPPER.lift.z) > 1.3 * 1.3) return false;
    if (p.n <= 0 || (SKU[p.sku] && SKU[p.sku].raw) || !upperSlotFor(p.sku, p.n)) { toast('The lift will not take that pallet: ' + (p.n <= 0 ? 'it is empty.' : SKU[p.sku] && SKU[p.sku].raw ? 'granulate goes to the hopper.' : 'no room on the upper row.'), 'bad'); return false; }
    p.place = 'lift'; S.fork.pallet = null; L.pallet = p.id; L.wait = 1.5; sfx('crate'); toast('Pallet in the lift · it goes up by itself', 'good'); return true;
  }
  function tickLift(dt) {
    if (!upperOwned() || !propInst.lift) return;
    var L = liftState(), p = L.pallet ? palletById(L.pallet) : null; if (L.pallet && !p) L.pallet = null;
    if (powered()) {
      if (L.state === 'down') { if (p && !L.hold) { L.wait = (L.wait === undefined ? 1.5 : L.wait) - dt; if (L.wait <= 0) { L.state = 'rising'; sfx('hydraulic'); } } }
      else if (L.state === 'rising') { L.pos = Math.min(1, L.pos + dt / UPPER.rise); if (L.pos >= 1) L.state = 'up'; }
      else if (L.state === 'up') { if (!p) L.state = 'lowering'; else if (propInst.upperFeed && beltPush('upperFeed', { kind: 'pallet', sku: p.sku, n: p.n, wrapped: !!p.wrapped })) { removePallet(p.id); L.pallet = null; S.stats.lifted = (S.stats.lifted || 0) + 1; sfx('crate'); L.state = 'lowering'; } }
      else if (L.state === 'lowering') { L.pos = Math.max(0, L.pos - dt / UPPER.rise); if (L.pos <= 0) { L.state = 'down'; L.wait = 1.5; } }
    }
    if (liftM) liftM.position.y = L.pos * UPPER.y;
    if (liftScreen) { var key = L.state + '|' + (p ? p.id : '') + '|' + Math.round(L.pos * 20) + '|' + (L.hold ? 'h' : ''); if (liftShown !== key) { liftShown = key; liftScreen.dirty = true; } }
  }
  function liftScreenDraw(c, sc) {
    var L = liftState(), p = L.pallet ? palletById(L.pallet) : null, st = !powered() ? 'off' : L.state === 'down' ? (p ? (L.hold ? 'held' : 'loaded') : 'ready') : L.state;
    scBg(c, sc.w, sc.h, st === 'rising' || st === 'lowering' || st === 'up' ? 'rgba(95,211,141,0.18)' : st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'GOODS LIFT', st.toUpperCase());
    scText(c, 12, 62, p ? 'Pallet: ' + p.n + ' × ' + skuName(p.sku) : 'Platform empty', '#eef1f5', 14);
    scText(c, 12, 84, L.state === 'down' ? (p ? (L.hold ? 'Held at the floor' : 'Going up in a moment') : 'At the floor · a jack or the forklift sets a pallet in') : L.state === 'rising' ? 'Going up · ' + Math.round(L.pos * 100) + '%' : L.state === 'up' ? 'Upstairs · rolling it onto the feed belt' : 'Coming down · ' + Math.round((1 - L.pos) * 100) + '%', '#a0acb8', 11);
    scText(c, 12, 104, 'Lifted so far: ' + (S.stats.lifted || 0) + ' pallets · upstairs racked ' + (S.stats.upperIn || 0), '#a0acb8', 11);
    scButton(sc, 12, 122, 100, 30, 'SEND NOW', L.state === 'down' && !!p, function () { if (L.state === 'down' && p) { L.hold = false; L.state = 'rising'; sfx('hydraulic'); } }, '#5fd38d');
    scButton(sc, 124, 122, 100, 30, L.hold ? 'RELEASE' : 'HOLD', true, function () { L.hold = !L.hold; }, L.hold ? '#5fd38d' : '#f5b53d');
  }
  function liftBuild(c) {
    var FR = MAT_MACH.frame;
    // four posts and cross members, mesh guards on three sides, a gate bar across the open east side at the floor
    [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(function (p) { c.box(0.12, 5.6, 0.12, FR, p[0], 2.8, p[1]); c.box(0.3, 0.03, 0.3, FR, p[0], 0.015, p[1]); });
    [2.6, 5.5].forEach(function (y) { c.box(2.52, 0.1, 0.1, FR, 0, y, -1.2); c.box(2.52, 0.1, 0.1, FR, 0, y, 1.2); c.box(0.1, 0.1, 2.52, FR, -1.2, y, 0); if (y > 5) c.box(0.1, 0.1, 2.52, FR, 1.2, y, 0); });
    c.plane(2.4, 5.4, MAT.mesh, -1.19, 2.8, 0, 0, Math.PI / 2); c.plane(2.4, 5.4, MAT.mesh, 0, 2.8, -1.19, 0, 0); c.plane(2.4, 5.4, MAT.mesh, 0, 2.8, 1.19, 0, Math.PI);
    c.box(0.08, 0.08, 2.3, MAT.hazard, 1.2, 1.0, 0); c.box(0.08, 0.08, 2.3, MAT.hazard, 1.2, 0.5, 0);
    c.solid(-1.3, -1.1, -1.3, 1.3, 0, 5.6); c.solid(-1.3, 1.3, -1.3, -1.1, 0, 5.6); c.solid(-1.3, 1.3, 1.1, 1.3, 0, 5.6); c.solid(1.1, 1.3, -1.1, 1.1, 0, 1.3); c.solid(1.1, 1.3, -1.1, 1.1, UPPER.y, UPPER.y + 1.1); c.box(0.08, 0.08, 2.3, MAT.hazard, 1.2, UPPER.y + 1.0, 0);
    // the platform: a plate on powered rollers, hazard-striped edges; it rides up to the deck
    var plat = new THREE.Group(); plat.userData.dynamic = true; c.add(plat); liftM = plat;
    box(2.2, 0.12, 2.2, MAT.steelDark, 0, 0.06, 0, plat); for (var rz = -0.8; rz <= 0.81; rz += 0.4) cyl(0.03, 2.0, MAT_MACH.roller, 0, 0.15, rz, plat, 8).rotation.z = Math.PI / 2;
    box(2.2, 0.04, 0.04, MAT.hazard, 0, 0.14, -1.08, plat); box(2.2, 0.04, 0.04, MAT.hazard, 0, 0.14, 1.08, plat); box(0.04, 0.04, 2.2, MAT.hazard, -1.08, 0.14, 0, plat);
    cyl(0.06, 5.6, FR, -1.0, 2.8, 0, c.group, 10); cyl(0.06, 5.6, FR, 1.0, 2.8, 0, c.group, 10);   // the guide rails the platform rides
    // the console on the south post, facing the hall side you walk up from; a lamp at the top
    cabinet(c, 0.9, 1.45, 1.21, 0.4, 0.6, 0.22); liftScreen = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.9, y: 1.5, z: 1.335, ry: 0, parent: c.group, title: 'Goods lift', draw: liftScreenDraw }); liftScreen.mesh.userData.propId = 'lift';
    c.box(0.06, 0.06, 0.06, glowMat(0xff3b2f, 1.5), 1.2, 5.3, 0);
    c.sign(['GOODS LIFT', 'pallets only · goes up by itself'], 1.2, 0.3, 1.22, 2.2, 0, Math.PI / 2, { w: 384, h: 96, bg: '#1b232c', fg: '#f5b53d' });
    c.hit(2.8, 2.6, 2.8, 0, 1.3, 0, { prompt: function () { return liftPrompt(); }, use: function () { liftUse(); } });
  }

  // ── The deck, the stair, the upper row and its belts ─────────────
  function railRun(c, a0, a1, at, axis, y, gaps) {
    if (gaps && gaps.length) { var cuts = gaps.slice().sort(function (p, q) { return p[0] - q[0]; }), s0 = a0; cuts.forEach(function (g) { if (g[0] > s0) railRun(c, s0, Math.min(g[0], a1), at, axis, y); s0 = Math.max(s0, g[1]); }); if (s0 < a1) railRun(c, s0, a1, at, axis, y); return; }   // gaps: where a belt crosses the rail
    var len = a1 - a0, mid = (a0 + a1) / 2; if (len < 0.3) return;
    for (var p = a0 + 0.2; p <= a1 - 0.1; p += 1.5) { if (axis === 'x') c.cyl(0.025, 1.1, MAT.chrome, p, y + 0.55, at, 8); else c.cyl(0.025, 1.1, MAT.chrome, at, y + 0.55, p, 8); }
    [0.55, 1.1].forEach(function (ry) { if (axis === 'x') c.box(len, 0.04, 0.04, MAT.chrome, mid, y + ry, at); else c.box(0.04, 0.04, len, MAT.chrome, at, y + ry, mid); });
    if (axis === 'x') { c.box(len, 0.12, 0.03, MAT.yellow, mid, y + 0.06, at); c.solid(a0, a1, at - 0.12, at + 0.12, y, y + 1.3); } else { c.box(0.03, 0.12, len, MAT.yellow, at, y + 0.06, mid); c.solid(at - 0.12, at + 0.12, a0, a1, y, y + 1.3); }
  }
  function mezzBuild(c) {
    var DK = std({ color: 0x5c656f, roughness: 0.55, metalness: 0.55 }), FR = MAT_MACH.frame, Y = UPPER.y, X = HALL.x - 0.2, z0 = UPPER.z0, z1 = UPPER.z1, sh = UPPER.shaft, stw = UPPER.stair, well = UPPER.well;
    var plate = function (x0, x1, za, zb) { if (x1 - x0 < 0.05 || zb - za < 0.05) return; c.box(x1 - x0, 0.12, zb - za, DK, (x0 + x1) / 2, Y - 0.06, (za + zb) / 2); };
    // plates: the deck rectangle in z bands at every hole edge, each band laid in x around the holes open in it (the shaft, the stairwell)
    var holes = [{ x0: sh.x0, x1: sh.x1, z0: sh.z0, z1: sh.z1 }, { x0: well.x0, x1: well.x1, z0: stw.z0, z1: stw.z1 }].concat(sorterHoles()), zs = [z0, z1]; holes.forEach(function (h) { zs.push(h.z0, h.z1); }); zs = zs.filter(function (v) { return v >= z0 && v <= z1; }).sort(function (p, q) { return p - q; });
    for (var bi = 0; bi + 1 < zs.length; bi++) { var za = zs[bi], zb = zs[bi + 1]; if (zb - za < 0.05) continue; var zm = (za + zb) / 2, xs = [-X, X]; holes.forEach(function (h) { if (zm > h.z0 && zm < h.z1) xs.push(h.x0, h.x1); }); xs.sort(function (p, q) { return p - q; }); for (var xi = 0; xi + 1 < xs.length; xi++) { var xm = (xs[xi] + xs[xi + 1]) / 2, inHole = holes.some(function (h) { return zm > h.z0 && zm < h.z1 && xm > h.x0 && xm < h.x1; }); if (!inHole) plate(xs[xi], xs[xi + 1], za, zb); } }
    // the edge beam, the south railing, and the railings round the stairwell
    c.box(2 * X, 0.4, 0.2, FR, 0, Y - 0.32, z1 + 0.1);
    railRun(c, -X, X, z1 - 0.12, 'x', Y, sorterEdgeGaps()); sorterWellRails(c); railRun(c, well.x0, well.x1, stw.z1 + 0.12, 'x', Y); railRun(c, stw.z0, stw.z1 + 0.24, well.x1 + 0.12, 'z', Y);
    // columns under the south edge every twelve metres, bump guards at the foot
    for (var cx = -24; cx <= 30; cx += 12) { c.box(0.35, Y - 0.12, 0.35, FR, cx, (Y - 0.12) / 2, z1 - 0.35); c.box(0.5, 0.5, 0.5, MAT.hazard, cx, 0.25, z1 - 0.35); c.solid(cx - 0.25, cx + 0.25, z1 - 0.6, z1 - 0.1, 0, Y); }
    // lamps under the deck, so the receiving strip is not a cave; a few on the deck
    [-24, 0, 24].forEach(function (lx) { var pl = new THREE.PointLight(0xfff0d0, 0.55, 11, 2); pl.position.set(lx, Y - 0.4, (z0 + z1) / 2); c.add(pl); c.box(0.5, 0.08, 0.5, MAT.lamp, lx, Y - 0.16, (z0 + z1) / 2); });
    // the stair: treads along the north wall rising westward, risers, two stringers, a handrail on the open side
    var n = 24, run = (stw.x1 - stw.x0) / n, rise = Y / n, zc = (stw.z0 + stw.z1) / 2, w = stw.z1 - stw.z0;
    for (var i = 0; i < n; i++) { var tx = stw.x1 - (i + 0.5) * run, ty = (i + 1) * rise; c.box(run, 0.06, w - 0.1, DK, tx, ty - 0.03, zc); c.box(0.04, rise, w - 0.1, FR, tx + run / 2 - 0.02, ty - rise / 2 - 0.03, zc); }
    var ang = Math.atan2(Y, stw.x1 - stw.x0), len = Math.hypot(Y, stw.x1 - stw.x0), mx = (stw.x0 + stw.x1) / 2;
    [stw.z0 + 0.05, stw.z1 - 0.05].forEach(function (sz) { c.box(len, 0.28, 0.06, FR, mx, Y / 2 - 0.08, sz).rotation.z = -ang; });
    c.box(len, 0.04, 0.04, MAT.chrome, mx, Y / 2 + 0.95, stw.z1 + 0.06).rotation.z = -ang;
    for (var hp = 1; hp < n; hp += 4) c.cyl(0.018, 0.95, MAT.chrome, stw.x1 - (hp + 0.5) * run, (hp + 1) * rise + 0.47, stw.z1 + 0.06, 6);
    c.solid(stw.x0, stw.x1, stw.z0, stw.z1, -3, -0.5);   // below the floor: the crew's grid sees it and routes round the stair, you never meet it
    c.solid(stw.x0, stw.x1 + 0.3, stw.z1, stw.z1 + 0.25, 0, Y + 1.0);   // the open side of the stair is railed from the floor up
    c.solid(-X, X, z0 - 0.4, z0, Y, Y + 3);   // the north wall at deck height
    c.sign(['MEZZANINE', 'stair · pallets go by the goods lift'], 1.4, 0.4, stw.x1 + 0.9, 2.2, stw.z1 + 0.14, 0, { w: 448, h: 128, bg: '#1b232c', fg: '#f5b53d' });
  }
  // the upper rack row: the ground row's build with two levels and uprights that stop under the roof (the group is raised by raiseToDeck)
  function upperRackBuild(c) {
    var x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05, H = 3.2, r = UPPER.row;
    for (var b = 0; b <= RACK.bays; b++) {
      var ux = x0 + b * bw;
      [-dz, dz].forEach(function (oz) { c.box(0.1, H, 0.1, MAT.rack, ux, H / 2, oz); c.box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, oz); for (var hh = 0.3; hh < H - 0.1; hh += 0.35) c.box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, oz); });
      for (var br = 0; br < 3; br++) { var yb = 0.4 + br * 1.0; c.box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, 0); var dg = c.box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, 0); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
    }
    var y = RACK.levels[1];
    c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, -dz); c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, dz);
    for (var bp = 0; bp <= RACK.bays; bp++) { c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, -dz); c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, dz); }
    for (var bb2 = 0; bb2 < RACK.bays; bb2++) { var dk = c.plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, 0, -Math.PI / 2, 0); dk.receiveShadow = false; }
    for (var bb = 0; bb < RACK.bays; bb++) {
      var cx = x0 + (bb + 0.5) * bw, lbl = 'U' + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#5fd38d' });
      var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
      [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, H - 0.3, s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; c.add(p); });
      for (var ll = 0; ll < UPPER.levels; ll++) (function (b2, l2) { var key = slotKey(r, b2, l2); slotHits[key] = c.hit(bw - 0.2, 1.45, RACK.depth, cx, RACK.levels[l2] + 0.725, 0, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } }); })(bb, ll);
    }
    c.solid(x0 - 0.1, x0 + RACK.bays * bw + 0.1, -RACK.depth / 2, RACK.depth / 2, 0, H);
    [-1, 1].forEach(function (s) { var x = s > 0 ? x0 + RACK.bays * bw + 0.3 : x0 - 0.3; c.box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, 0); c.sign(['UPPER ROW', 'automatic', 'keep clear'], 0.5, 0.5, x + s * 0.06, 1.6, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 26 }); });
  }
  defBelt('upperFeed', { prop: 'upperFeed', path: [[0, 0, UPPER.y], [3.4, 0, UPPER.y, 'hang'], [3.4, UPPER.rowZ - UPPER.lift.z, UPPER.y, 'hang']], speedKey: 'belts' });   // east off the lift head, then north to the row's west end
  defBelt('upperPick', { prop: 'upperPick', path: [[0, 0, UPPER.y], [0, 4.6, UPPER.y, 'hang']], speedKey: 'pickBelt' });   // along the row end to the chute at the deck edge
  defBelt('upperChute', { prop: 'upperChute', path: [[0, 0, UPPER.y], [0, 2.0, PICK_H, 'hang']], speedKey: 'pickBelt' });   // off the deck edge down into the south pick belt's start
  defMachine('gantry5', { prop: 'gantry5' });
  defMachine('upperIn', { prop: 'rack5', inlets: [[RACK.x0 - 1.4, 0]], accept: function (it) {   // where the feed belt ends, past the row's west end
    if (it.kind !== 'pallet') return false; var key = upperSlotFor(it.sku, it.n); if (!key) return false;
    slotAdd(key, it.sku, it.n); S.slots[key].pal = true; S.slots[key].wrapped = !!it.wrapped; S.stats.putaway += it.n; S.stats.upperIn = (S.stats.upperIn || 0) + 1; sfx('crate'); return true;
  } });
  defProp('mezz', { label: 'mezzanine', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, build: mezzBuild, when: upperOwned });
  defProp('lift', { label: 'goods lift', cat: 'hall', abs: true, keep: true, fixed: true, x: UPPER.lift.x, z: UPPER.lift.z, rot: 0, build: liftBuild, when: upperOwned });
  defProp('rack5', { label: 'upper rack row', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: UPPER.rowZ, rot: 0, build: upperRackBuild, after: raiseToDeck, when: upperOwned });
  defProp('gantry5', { label: 'upper gantry picker', cat: 'hall', abs: true, keep: true, fixed: true, x: -24, z: UPPER.rowZ, rot: 0, build: gantryBuild(UPPER.row), after: raiseToDeck, when: upperOwned });
  defProp('upperFeed', { label: 'lift feed belt', cat: 'hall', abs: true, keep: true, fixed: true, x: UPPER.lift.x + 1.4, z: UPPER.lift.z, rot: 0, build: function (c) { conveyorPath(c, BELTS.upperFeed.path); }, when: upperOwned });
  defProp('upperPick', { label: 'upper pick belt', cat: 'hall', abs: true, keep: true, fixed: true, x: 22.0, z: UPPER.rowZ, rot: 0, build: function (c) { conveyorPath(c, BELTS.upperPick.path); c.sign(['TO THE CHUTE'], 0.9, 0.14, 0.5, UPPER.y + 1.3, 3.8, Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }, when: upperOwned });
  defProp('upperChute', { label: 'upper chute', cat: 'hall', abs: true, keep: true, fixed: true, x: 22.0, z: UPPER.z1 - 0.1, rot: 0, build: function (c) { conveyorPath(c, BELTS.upperChute.path); c.sign(['DOWN TO THE PICK LINE'], 0.9, 0.14, 0.5, UPPER.y + 1.0, 0.6, Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' }); }, when: upperOwned });

  function groundStock(sku) { var n = 0; for (var k in S.slots) { var s = S.slots[k]; if (s && s.n > 0 && s.sku === sku && slotParse(k).r !== UPPER.row) n += s.n; } return n; }
  function buildUpper() { ['mezz', 'lift', 'rack5', 'gantry5', 'upperFeed', 'upperPick', 'upperChute'].forEach(function (id) { buildProp(id); }); if (S.up.sorter) buildSorter(); else { beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); } } }
