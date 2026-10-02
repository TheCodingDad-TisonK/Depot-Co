//@ the hall: floor, walls, dock doors, racks, office, packing bench, break corner, the yard outside
  // ── The building ──────────────────────────────────────────────────
  var doors = [];          // 0,1 inbound (west wall), 2,3 outbound (east wall): { side, z, panel, anim, control }
  var rackGroups = [null, null, null, null];
  var slotHits = {};       // key -> hit mesh
  var bayLabelTex = {};
  var world = { boardTex: null, boardCtx: null, boardMat: null, lampMeshes: [], officeLamp: null, cot: null, coffeeMachine: null, pcScreen: null };

  function slotKey(r, b, l) { return r + ',' + b + ',' + l; }
  function slotParse(key) { var p = key.split(',').map(Number); return { r: p[0], b: p[1], l: p[2] }; }
  function rackSlotPos(r, b, l) { return { x: RACK.x0 + RACK.bayW * (b + 0.5), y: RACK.levels[l], z: RACK.rows[r] }; }
  function slotName(key) { var p = slotParse(key); return 'Row ' + 'ABCD'[p.r] + ', bay ' + (p.b + 1) + (p.l === 0 ? ', floor' : p.l === 1 ? ', shelf' : ', top'); }
  function rowName(r) { return 'Row ' + 'ABCD'[r]; }

  function buildWorld() {
    var X = HALL.x, Z = HALL.z, H = HALL.h;
    // the hall floor (the ground outside is the yard's job)
    var fl = plane(2 * X, 2 * Z, MAT.floor, 0, 0.001, 0, -Math.PI / 2); fl.receiveShadow = true;
    plane(2 * X - 0.4, 0.12, MAT.trim, 0, 0.06, -Z + 0.16, 0, 0); plane(2 * X - 0.4, 0.12, MAT.trim, 0, 0.06, Z - 0.16, 0, Math.PI);   // the skirting line where wall meets slab
    // walls: four, with the dock doors cut out of the west and east ones and a staff door on the west
    function wallX(x, side) {                                   // a wall along z at x, openings at the docks
      var openings = (side < 0 ? DOCKS.in : DOCKS.out).map(function (d) { return { z0: d.z - DOCKS.w / 2, z1: d.z + DOCKS.w / 2, h: DOCKS.h }; });
      if (side < 0) openings.push({ z0: SPOT.staffDoor.z - 0.6, z1: SPOT.staffDoor.z + 0.6, h: 2.3 });
      openings.sort(function (a, b) { return a.z0 - b.z0; });
      var z = -Z;
      openings.forEach(function (o) {
        if (o.z0 > z) { box(0.3, H, o.z0 - z, MAT.wall, x, H / 2, (z + o.z0) / 2); solid(x - 0.15, x + 0.15, z, o.z0); }
        box(0.3, H - o.h, o.z1 - o.z0, MAT.wall, x, o.h + (H - o.h) / 2, (o.z0 + o.z1) / 2); solid(x - 0.15, x + 0.15, o.z0, o.z1, o.h, 9);
        z = o.z1;
      });
      if (z < Z) { box(0.3, H, Z - z, MAT.wall, x, H / 2, (z + Z) / 2); solid(x - 0.15, x + 0.15, z, Z); }
    }
    wallX(-X, -1); wallX(X, 1);
    // the north wall has the fire exit cut out of it at x 13.4 to 14.6
    box(X + 13.4 + 0.15, H, 0.3, MAT.wall, (-X - 0.15 + 13.4) / 2, H / 2, -Z); solid(-X - 0.15, 13.4, -Z - 0.15, -Z + 0.15);
    box(X - 14.6 + 0.15, H, 0.3, MAT.wall, (14.6 + X + 0.15) / 2, H / 2, -Z); solid(14.6, X + 0.15, -Z - 0.15, -Z + 0.15);
    box(1.2, H - 2.3, 0.3, MAT.wall, 14, 2.3 + (H - 2.3) / 2, -Z); solid(13.4, 14.6, -Z - 0.15, -Z + 0.15, 2.3, 9);
    box(2 * X + 0.3, H, 0.3, MAT.wall, 0, H / 2, Z); solid(-X - 0.15, X + 0.15, Z - 0.15, Z + 0.15);
    // roof with skylight strips, and the trusses under it
    box(2 * X + 0.6, 0.3, 2 * Z + 0.6, MAT.roof, 0, H + 0.15, 0);
    plane(2 * X, 2 * Z, MAT.roofIn, 0, H - 0.01, 0, Math.PI / 2);
    [-7, 0, 7].forEach(function (z) { var sk = plane(2 * X - 4, 1.6, MAT.skylight, 0, H - 0.02, z, Math.PI / 2); world.lampMeshes.push(sk); });
    for (var tx = -16; tx <= 16; tx += 8) { box(0.25, 0.6, 2 * Z - 0.4, MAT.steelDark, tx, H - 0.35, 0); }
    // high-bay lamps under the trusses
    hallLights.forEach(function (l) { var m = box(0.9, 0.12, 0.5, MAT.lamp, l.position.x, l.position.y + 0.3, l.position.z); world.lampMeshes.push(m); cyl(0.03, 0.4, MAT.steelDark, l.position.x, l.position.y + 0.55, l.position.z); });
    // floor markings: aisles, the walkway, the staging squares
    function lineX(x0, x1, z, w) { plane(x1 - x0, w || 0.1, MAT.yellowLine, (x0 + x1) / 2, 0.006, z, -Math.PI / 2); }
    function lineZ(z0, z1, x, w) { plane(w || 0.1, z1 - z0, MAT.yellowLine, x, 0.006, (z0 + z1) / 2, -Math.PI / 2); }
    function square(cx, cz, s) { lineX(cx - s / 2, cx + s / 2, cz - s / 2); lineX(cx - s / 2, cx + s / 2, cz + s / 2); lineZ(cz - s / 2, cz + s / 2, cx - s / 2); lineZ(cz - s / 2, cz + s / 2, cx + s / 2); }
    square(SPOT.stageIn.x, SPOT.stageIn.z, 3.4); square(SPOT.stageOut.x, SPOT.stageOut.z, 3.4);
    lineX(-X + 0.3, 12.2, 8.2); lineX(-X + 0.3, 12.2, 9.4);                       // the pedestrian walkway along the south strip
    lineZ(-Z + 0.3, Z - 0.3, -12.9); lineZ(-Z + 0.3, Z - 0.3, 12.9);              // the rack block edges
    plane(2.6, 0.9, new THREE.MeshBasicMaterial({ map: textTex(['RECEIVING'], { w: 512, h: 128, bg: '#2a2f36', fg: '#f5b53d' }) }), SPOT.stageIn.x, 0.007, SPOT.stageIn.z + 2.2, -Math.PI / 2);
    plane(2.6, 0.9, new THREE.MeshBasicMaterial({ map: textTex(['SHIPPING'], { w: 512, h: 128, bg: '#2a2f36', fg: '#5fd38d' }) }), SPOT.stageOut.x, 0.007, SPOT.stageOut.z + 2.2, -Math.PI / 2);
    // dock doors
    DOCKS.in.forEach(function (d, i) { buildDoor(i, -1, d.z); });
    DOCKS.out.forEach(function (d, i) { buildDoor(2 + i, 1, d.z); });
    // the staff door: a frame, and a ramp down to the yard outside it
    box(0.1, 2.3, 0.08, MAT.steelDark, -X, 1.15, SPOT.staffDoor.z - 0.62); box(0.1, 2.3, 0.08, MAT.steelDark, -X, 1.15, SPOT.staffDoor.z + 0.62); box(0.1, 0.08, 1.3, MAT.steelDark, -X, 2.32, SPOT.staffDoor.z);
    var ramp = box(7.2, 0.2, 2, MAT.grey, -X - 3.6, -0.7, SPOT.staffDoor.z); ramp.rotation.z = Math.atan2(1.2, 7); ramp.position.y = -0.6 - 0.1;
    box(7.2, 0.9, 0.08, MAT.steelDark, -X - 3.6, -0.25, SPOT.staffDoor.z - 1).rotation.z = Math.atan2(1.2, 7); box(7.2, 0.9, 0.08, MAT.steelDark, -X - 3.6, -0.25, SPOT.staffDoor.z + 1).rotation.z = Math.atan2(1.2, 7);
    sign(['STAFF'], 1.2, 0.4, -X - 0.16, 2.7, SPOT.staffDoor.z, -Math.PI / 2, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' });
    // the sign on the road side, and the dock faces
    sign(['DEPOT CO.'], 12, 2.6, 0, 5, Z + 0.17, 0, { w: 1024, h: 224, bg: '#1b232c', fg: '#f5b53d', border: '#f5b53d' });
    sign(['3PL · STORAGE · FULFILMENT'], 10, 0.8, 0, 3.2, Z + 0.17, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8' });
    // the yard lamp posts (the lights themselves live in 05-three)
    yardLights.forEach(function (l) { cyl(0.08, 7.5, MAT.steelDark, l.position.x, YARD_Y + 3.75, l.position.z, null, 8, 0.11); box(0.6, 0.2, 0.3, MAT.steelDark, l.position.x, l.position.y + 0.15, l.position.z); var lens = box(0.5, 0.04, 0.24, glowMat(0xffd9a0, 0.2), l.position.x, l.position.y + 0.03, l.position.z); yard.lampLenses.push(lens); });
    // the pallet racks the player owns
    for (var r = 0; r < 4; r++) if (r < S.up.rows) buildRack(r);
    buildOffice(); buildBench(); buildBreakRoom(); buildBreakCorner();
    hingedDoor('office', 12.5, 9.45, false, 'the office door', { window: true, swing: 1 });
    hingedDoor('break', -12.5, 9.45, false, 'the break room door', { window: true, swing: -1 });
    hingedDoor('staff', -X, SPOT.staffDoor.z - 0.5, false, 'the staff door', { mat: MAT.steelDark, swing: 1 });
    hingedDoor('exit', 13.5, -Z, true, 'the fire exit', { mat: MAT.steelDark, pushbar: true, swing: 1 });
    buildYard(); buildDressing(); buildControlCabinet();
  }

  function buildDoor(i, side, z) {
    var x = side * HALL.x;
    var panel = new THREE.Mesh(boxGeo(0.12, DOCKS.h, DOCKS.w), MAT.door); panel.castShadow = true; panel.receiveShadow = true;
    panel.position.set(x - side * 0.22, DOCKS.h / 2, z); scene.add(panel);
    var d = { i: i, side: side, z: z, panel: panel, anim: S.doors[i] ? 1 : 0 };
    addInter(panel, { prompt: function () { return S.doors[i] ? null : (S.events.power ? 'No power: the door motor is dead' : 'Open dock door ' + dockLabel(i)); }, use: function () { if (!S.events.power) setDoor(i, true); else toast('No power. Flip the breaker in the office.', 'bad'); } });
    // the push-button box beside the door
    var ctl = box(0.1, 0.3, 0.2, MAT.steelDark, x - side * 0.2, 1.3, z + DOCKS.w / 2 + 0.4);
    box(0.04, 0.08, 0.08, MAT.green, x - side * 0.26, 1.36, z + DOCKS.w / 2 + 0.4); box(0.04, 0.08, 0.08, MAT.red, x - side * 0.26, 1.24, z + DOCKS.w / 2 + 0.4);
    addInter(ctl, { prompt: function () { return S.events.power ? 'No power' : (S.doors[i] ? 'Close dock door ' + dockLabel(i) : 'Open dock door ' + dockLabel(i)); }, use: function () { if (S.events.power) { toast('No power. Flip the breaker in the office.', 'bad'); return; } setDoor(i, !S.doors[i]); } });
    // bumpers, the number outside, the leveller plate, the sign inside
    box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z - DOCKS.w / 2 + 0.3); box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z + DOCKS.w / 2 - 0.3);
    sign([String(i % 2 + 1)], 1.2, 1.2, x + side * 0.17, DOCKS.h + 1.3, z, side < 0 ? -Math.PI / 2 : Math.PI / 2, { w: 128, h: 128, bg: '#f5b53d', fg: '#1a1205' });
    plane(1.6, DOCKS.w - 0.4, MAT.hazard, x - side * 0.8, 0.008, z, -Math.PI / 2);
    sign([i < 2 ? 'IN ' + (i % 2 + 1) : 'OUT ' + (i % 2 + 1)], 2.4, 0.7, x - side * 0.17, DOCKS.h + 0.6, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: i < 2 ? '#f5b53d' : '#5fd38d' });
    doors[i] = d;
  }
  function dockLabel(i) { return (i < 2 ? 'IN ' : 'OUT ') + (i % 2 + 1); }
  function setDoor(i, open) { if (S.doors[i] === open) return; S.doors[i] = open; sfx('roller'); logEvent('Dock door ' + dockLabel(i) + (open ? ' opened' : ' closed')); if (open && i < 2) introStep('door'); rebuildDyn(); }
  function doorAnim(dt) {
    doors.forEach(function (d) { var t = S.doors[d.i] ? 1 : 0; if (d.anim === t) return; d.anim = clamp(d.anim + (t ? dt : -dt) / 1.6, 0, 1); var sc = 1 - d.anim * 0.93; d.panel.scale.y = sc; d.panel.position.y = DOCKS.h - DOCKS.h * sc / 2; });
  }
  function doorPassable(i) { return doors[i].anim > 0.6; }

  function buildRack(r) {
    if (rackGroups[r]) return;
    var g = new THREE.Group(); scene.add(g); rackGroups[r] = g;
    var z = RACK.rows[r], x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05;
    for (var b = 0; b <= RACK.bays; b++) {
      var ux = x0 + b * bw;
      [-dz, dz].forEach(function (oz) { box(0.1, 5, 0.1, MAT.rack, ux, 2.5, z + oz, g); box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, z + oz, g); for (var hh = 0.3; hh < 4.9; hh += 0.35) box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, z + oz, g); });
      for (var br = 0; br < 5; br++) { var yb = 0.4 + br * 1.0; box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, z, g); var dg = box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, z, g); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
    }
    for (var l = 1; l < RACK.levels.length; l++) {
      var y = RACK.levels[l];
      box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, z - dz, g); box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, z + dz, g);
      for (var bp = 0; bp <= RACK.bays; bp++) { box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, z - dz, g); box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, z + dz, g); }
      for (var bb2 = 0; bb2 < RACK.bays; bb2++) { var dk = plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, z, -Math.PI / 2, 0, g); dk.receiveShadow = false; box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, z - 0.3, g); box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, z + 0.3, g); }
    }
    for (var bb = 0; bb < RACK.bays; bb++) {
      var cx = x0 + (bb + 0.5) * bw;
      var lbl = 'ABCD'[r] + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#f5b53d' });
      var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
      [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, 4.75, z + s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; g.add(p); });
      for (var ll = 0; ll < RACK.levels.length; ll++) (function (rr, b2, l2) {
        var key = slotKey(rr, b2, l2), sp = rackSlotPos(rr, b2, l2), hh = l2 === 2 ? 1.6 : 1.45;
        slotHits[key] = hitBox(bw - 0.2, hh, RACK.depth, sp.x, sp.y + hh / 2, sp.z, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } }, g);
      })(r, bb, ll);
    }
    solid(x0 - 0.1, x0 + RACK.bays * bw + 0.1, z - RACK.depth / 2, z + RACK.depth / 2);
    rackEnds(r); NAV.dirty = true;
    shadowDirty = true;
  }

  function buildOffice() {
    var x0 = 12.5, z0 = 8.5, X = HALL.x, Z = HALL.z, h = 3.2;
    // the wall along x = x0 with a doorway, the wall along z = z0 with a window, and a ceiling
    box(0.15, h, 0.8, MAT.plaster, x0, h / 2, z0 + 0.4); box(0.15, h, Z - 10.6, MAT.plaster, x0, h / 2, 10.6 + (Z - 10.6) / 2); box(0.15, h - 2.2, 1.3, MAT.plaster, x0, 2.2 + (h - 2.2) / 2, 9.95);
    solid(x0 - 0.08, x0 + 0.08, z0, 9.3); solid(x0 - 0.08, x0 + 0.08, 10.6, Z);
    box(1.5, h, 0.15, MAT.plaster, x0 + 0.75, h / 2, z0); box(2, h, 0.15, MAT.plaster, X - 1, h / 2, z0);
    box(X - 1.5 - x0, 1.1, 0.15, MAT.plaster, (x0 + 1.5 + X - 2) / 2, 0.55, z0); box(X - 1.5 - x0, h - 2.3, 0.15, MAT.plaster, (x0 + 1.5 + X - 2) / 2, 2.3 + (h - 2.3) / 2, z0);
    box(X - 1.5 - x0, 1.2, 0.04, MAT.glass, (x0 + 1.5 + X - 2) / 2, 1.7, z0);
    solid(x0, X, z0 - 0.08, z0 + 0.08);
    box(X - x0, 0.12, Z - z0, MAT.plaster, (x0 + X) / 2, h + 0.06, (z0 + Z) / 2);
    plane(X - x0 - 0.2, Z - z0 - 0.2, MAT.tile, (x0 + X) / 2, h - 0.01, (z0 + Z) / 2, Math.PI / 2);
    var lamp = box(1.2, 0.08, 0.3, MAT.lamp, 16.5, h - 0.05, 11); world.officeLamp = lamp;
    sign(['OFFICE'], 1.4, 0.45, x0 - 0.09, 2.6, 9.95, -Math.PI / 2, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' });
    // desk, chair, PC, cabinet
    box(2.2, 0.06, 0.8, MAT.wood, SPOT.pc.x, 0.75, SPOT.pc.z + 0.6); [[-1, -0.3], [1, -0.3], [-1, 0.3], [1, 0.3]].forEach(function (o) { box(0.05, 0.75, 0.05, MAT.steelDark, SPOT.pc.x + o[0] * 1.05, 0.375, SPOT.pc.z + 0.6 + o[1]); });
    solid(SPOT.pc.x - 1.1, SPOT.pc.x + 1.1, SPOT.pc.z + 0.2, SPOT.pc.z + 1);
    box(0.3, 0.05, 0.25, MAT.steelDark, SPOT.pc.x, 0.8, SPOT.pc.z + 0.8); cyl(0.03, 0.25, MAT.steelDark, SPOT.pc.x, 0.9, SPOT.pc.z + 0.85);
    var mon = box(0.8, 0.5, 0.04, MAT.black, SPOT.pc.x, 1.25, SPOT.pc.z + 0.85);
    world.pcScreen = plane(0.74, 0.44, new THREE.MeshBasicMaterial({ map: textTex(['DEPOT OS', 'press E'], { w: 256, h: 160, bg: '#0d1b2a', fg: '#78bdf5', size: 40 }) }), SPOT.pc.x, 1.25, SPOT.pc.z + 0.825, 0, Math.PI);
    box(0.45, 0.03, 0.15, MAT.steelDark, SPOT.pc.x - 0.1, 0.8, SPOT.pc.z + 0.45); box(0.1, 0.03, 0.06, MAT.steelDark, SPOT.pc.x + 0.5, 0.8, SPOT.pc.z + 0.45);
    hitBox(1.2, 1.0, 0.6, SPOT.pc.x, 1.1, SPOT.pc.z + 0.7, { prompt: function () { return S.events.power ? 'The PC is off: no power' : 'Use the office PC'; }, use: function () { if (S.events.power) { toast('No power.', 'bad'); return; } openPc(); } });
    box(0.5, 0.06, 0.5, MAT.black, SPOT.pc.x, 0.5, SPOT.pc.z - 0.2); cyl(0.04, 0.5, MAT.steelDark, SPOT.pc.x, 0.25, SPOT.pc.z - 0.2); box(0.5, 0.5, 0.06, MAT.black, SPOT.pc.x, 0.78, SPOT.pc.z - 0.45);
    box(0.5, 1.3, 0.6, MAT.grey, 19.6, 0.65, 13.5); box(0.5, 1.3, 0.6, MAT.grey, 19.0, 0.65, 13.5);
    solid(18.7, 19.9, 13.1, 14);
    // the breaker panel on the east wall
    var brk = box(0.12, 0.6, 0.4, MAT.grey, HALL.x - 0.21, 1.5, SPOT.breaker.z); box(0.03, 0.12, 0.06, MAT.red, HALL.x - 0.28, 1.5, SPOT.breaker.z);
    addInter(brk, { prompt: function () { return S.events.power ? 'Reset the breaker' : 'Breaker panel (power is on)'; }, use: function () { flipBreaker(); } });
    sign(['MAIN BREAKER'], 0.6, 0.15, HALL.x - 0.22, 1.9, SPOT.breaker.z, -Math.PI / 2, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' });
    // the order board: a wall screen the whole hall can read, on the office's north wall facing the floor
    var c = document.createElement('canvas'); c.width = 768; c.height = 384; world.boardCtx = c.getContext('2d');
    world.boardTex = new THREE.CanvasTexture(c); world.boardTex.encoding = THREE.sRGBEncoding; world.boardMat = new THREE.MeshBasicMaterial({ map: world.boardTex });
    box(3.1, 1.6, 0.08, MAT.black, 16.2, 2.1, z0 - 0.12);
    var board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); board.position.set(16.2, 2.1, z0 - 0.17); board.rotation.y = Math.PI; scene.add(board);
    drawBoard();
  }

  function buildBench() {
    var bx = SPOT.bench.x, bz = SPOT.bench.z;
    box(1.0, 0.08, 3.2, MAT.wood, bx, 0.9, bz); [[-0.45, -1.5], [0.45, -1.5], [-0.45, 1.5], [0.45, 1.5]].forEach(function (o) { box(0.06, 0.9, 0.06, MAT.steelDark, bx + o[0], 0.45, bz + o[1]); });
    box(0.9, 0.04, 3.0, MAT.steelDark, bx, 0.3, bz);
    solid(bx - 0.5, bx + 0.5, bz - 1.6, bz + 1.6);
    box(0.25, 0.12, 0.12, MAT.red, bx - 0.3, 1.0, bz - 1.3); cyl(0.07, 0.1, MAT.white, bx - 0.3, 1.02, bz - 1.3);   // tape gun
    box(0.3, 0.05, 0.3, MAT.steelDark, bx + 0.25, 0.965, bz - 1.35); plane(0.2, 0.1, MAT.screen, bx + 0.25, 1.0, bz - 1.2, -0.6);   // scale
    cyl(0.02, 0.9, MAT.steelDark, bx - 0.4, 1.4, bz + 1.4); box(0.3, 0.08, 0.15, MAT.lamp, bx - 0.3, 1.85, bz + 1.4);   // lamp
    hitBox(1.1, 1.2, 3.2, bx, 1.4, bz, { prompt: function () { return benchPrompt(); }, use: function () { benchUse(); } });
    sign(['PACKING'], 1.8, 0.5, bx + 0.3, 2.6, bz, -Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' });
    // the parcel shelf: packed orders wait here until they go out
    var ox = SPOT.benchOut.x, oz = SPOT.benchOut.z;
    box(1.0, 0.06, 1.5, MAT.steelDark, ox, 0.6, oz + 0.3); [[-0.45, -0.4], [0.45, -0.4], [-0.45, 1.0], [0.45, 1.0]].forEach(function (o) { box(0.05, 0.6, 0.05, MAT.steelDark, ox + o[0], 0.3, oz + o[1]); });
    solid(ox - 0.5, ox + 0.5, oz - 0.5, oz + 1.1);
    // the two dock consoles by the outbound doors: dispatch a loaded truck early
    [SPOT.console0, SPOT.console1].forEach(function (p, i) {
      box(0.1, 0.5, 0.4, MAT.steelDark, p.x, 1.4, p.z); var scr = plane(0.3, 0.2, MAT.screen, p.x - 0.06, 1.5, p.z, 0, -Math.PI / 2);
      hitBox(0.3, 0.6, 0.5, p.x - 0.05, 1.4, p.z, { prompt: function () { return consolePrompt(2 + i); }, use: function () { consoleUse(2 + i); } });
      sign(['DOCK ' + dockLabel(2 + i)], 0.7, 0.18, p.x - 0.12, 1.85, p.z, -Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' });
    });
  }

  // the break room: the south-west corner, walled off like the office, with a window onto the floor and a door
  function buildBreakRoom() {
    var x0 = -12.5, z0 = 8.5, X = HALL.x, Z = HALL.z, h = 3.2;
    box(0.15, h, 0.8, MAT.plaster, x0, h / 2, z0 + 0.4); box(0.15, h - 2.2, 1.3, MAT.plaster, x0, 2.2 + (h - 2.2) / 2, 9.95);
    box(0.15, h, 0.6, MAT.plaster, x0, h / 2, 10.9); box(0.15, 1.1, 2.6, MAT.plaster, x0, 0.55, 12.5); box(0.15, h - 2.3, 2.6, MAT.plaster, x0, 2.3 + (h - 2.3) / 2, 12.5); box(0.04, 1.2, 2.6, MAT.glass, x0, 1.7, 12.5); box(0.15, h, 0.2, MAT.plaster, x0, h / 2, Z - 0.1);
    solid(x0 - 0.08, x0 + 0.08, z0, 9.3); solid(x0 - 0.08, x0 + 0.08, 10.6, Z);
    box(X + x0, h, 0.15, MAT.plaster, (-X + x0) / 2, h / 2, z0); solid(-X, x0, z0 - 0.08, z0 + 0.08);
    box(X + x0, 0.12, Z - z0, MAT.plaster, (-X + x0) / 2, h + 0.06, (z0 + Z) / 2);
    plane(X + x0 - 0.2, Z - z0 - 0.2, MAT.tile, (-X + x0) / 2, h - 0.01, (z0 + Z) / 2, Math.PI / 2);
    box(1.2, 0.08, 0.3, MAT.lamp, -16.5, h - 0.05, 11);
    for (var bl = 0; bl < 14; bl++) box(0.02, 0.05, 2.5, MAT.trim, x0 + 0.09, 2.26 - bl * 0.08, 12.5);
    sign(['BREAK ROOM'], 1.6, 0.45, x0 + 0.09, 2.6, 9.95, Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' });
    box(0.7, 1.75, 0.7, MAT.white, -16, 0.875, 9.0); box(0.03, 0.4, 0.03, MAT.chrome, -16.3, 1.2, 9.37); box(0.03, 0.3, 0.03, MAT.chrome, -16.3, 0.5, 9.37); solid(-16.4, -15.6, 8.6, 9.4);
  }
  function buildBreakCorner() {
    // a cot, a coffee machine on a counter, a locker, a water cooler, a fire extinguisher by the door
    var c = SPOT.cot;
    box(1.9, 0.12, 0.9, MAT.steelDark, c.x, 0.3, c.z); box(1.85, 0.18, 0.85, MAT.blue, c.x, 0.45, c.z); box(0.5, 0.1, 0.4, MAT.white, c.x - 0.6, 0.6, c.z);
    [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(function (o) { box(0.05, 0.3, 0.05, MAT.steelDark, c.x + o[0], 0.15, c.z + o[1]); });
    solid(c.x - 0.95, c.x + 0.95, c.z - 0.45, c.z + 0.45);
    world.cot = hitBox(1.9, 0.6, 0.9, c.x, 0.5, c.z, { prompt: function () { return cotPrompt(); }, use: function () { sleepNow(); } });
    var k = SPOT.coffee;
    box(1.4, 0.9, 0.6, MAT.grey, k.x, 0.45, k.z); solid(k.x - 0.7, k.x + 0.7, k.z - 0.3, k.z + 0.3);
    box(0.35, 0.5, 0.35, MAT.black, k.x, 1.15, k.z); box(0.3, 0.08, 0.1, MAT.red, k.x, 1.3, k.z + 0.2); plane(0.12, 0.08, MAT.screen, k.x, 1.2, k.z + 0.18);
    world.coffeeMachine = hitBox(0.5, 0.6, 0.5, k.x, 1.15, k.z, { prompt: function () { return S.events.power ? 'The coffee machine is off' : (buff.coffeeUntil > S.time && buff.coffeeDay === S.day ? 'Coffee is still working' : 'Have a coffee (walk faster for an hour)'); }, use: function () { drinkCoffee(); } });
    box(0.5, 0.6, 0.5, MAT.white, k.x + 0.5, 1.1, k.z); cyl(0.12, 0.3, MAT.glass, k.x + 0.5, 1.5, k.z);   // water cooler
    box(0.6, 1.8, 0.5, MAT.grey, -18.4, 0.9, 13.6); box(0.6, 1.8, 0.5, MAT.grey, -17.7, 0.9, 13.6); solid(-18.7, -17.4, 13.3, 14);
    box(0.9, 0.06, 0.9, MAT.wood, -14.5, 0.75, 12.5); cyl(0.04, 0.75, MAT.steelDark, -14.5, 0.375, 12.5); [[-0.6, 0], [0.6, 0]].forEach(function (o) { box(0.4, 0.04, 0.4, MAT.red, -14.5 + o[0], 0.45, 12.5 + o[1]); cyl(0.03, 0.45, MAT.steelDark, -14.5 + o[0], 0.22, 12.5 + o[1]); });
    
    sign(['BREAK ROOM'], 1.6, 0.45, -19.78, 2.6, 11, Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' });
    // a notice board with the day's schedule
    box(1.6, 1.0, 0.04, MAT.wood, -16.5, 1.9, 13.78);
    sign(['TRUCKS', 'IN 07:30 · 13:30', 'OUT 10:30-12 · 16-18'], 1.5, 0.9, -16.5, 1.9, 13.75, Math.PI, { w: 512, h: 320, bg: '#f5f1e6', fg: '#1b232c', size: 56 });
  }

  // the order board on the office wall: redrawn when orders change
  function drawBoard() {
    var c = world.boardCtx; if (!c) return; var w = 768, h = 384;
    c.fillStyle = '#0d1b2a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f5b53d'; c.font = 'bold 30px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('OPEN ORDERS', 24, 44); c.font = '22px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8'; c.textAlign = 'right'; c.fillText('Day ' + S.day + '  ' + fmtTime(S.time), w - 24, 44);
    c.textAlign = 'left';
    var open = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed'; }).slice(0, 7);
    if (!open.length) { c.fillStyle = '#5fd38d'; c.font = '26px Bahnschrift, Arial, sans-serif'; c.fillText('Nothing waiting. Nice.', 24, 110); }
    open.forEach(function (o, i) {
      var y = 90 + i * 40; c.fillStyle = o.state === 'packed' ? '#5fd38d' : (o.rush ? '#ff6b5e' : '#eef1f5'); c.font = 'bold 24px Bahnschrift, Arial, sans-serif';
      c.fillText('#' + o.num + '  ' + clientName(o.client), 24, y);
      c.font = '20px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8';
      c.fillText(o.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ').slice(0, 46), 330, y);
      c.textAlign = 'right'; c.fillStyle = o.state === 'packed' ? '#5fd38d' : '#f5b53d'; c.fillText(o.state === 'packed' ? 'PACKED' : 'due ' + fmtTime(o.due), w - 24, y); c.textAlign = 'left';
    });
    world.boardTex.needsUpdate = true;
  }

  // where the player stands: the hall floor, a docked trailer's floor, the ramp, or the yard
  function floorY(x, z) {
    if (Math.abs(x) < HALL.x && Math.abs(z) < HALL.z) return 0;
    for (var i = 0; i < S.trucks.length; i++) { var t = S.trucks[i]; if (t.state !== 'docked') continue; var b = trailerBounds(t); if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return 0; }
    if (x <= -HALL.x && x > -HALL.x - 7.2 && Math.abs(z - SPOT.staffDoor.z) < 1) return lerp(0, YARD_Y, (-HALL.x - x) / 7);
    return YARD_Y;
  }
  function insideHall(x, z) { return Math.abs(x) < HALL.x && Math.abs(z) < HALL.z; }
