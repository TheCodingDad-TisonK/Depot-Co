//@ the hall: floor, walls, dock doors, racks, office, packing bench, break corner, the yard outside
  // ── The building ──────────────────────────────────────────────────
  var doors = [];          // 0,1 inbound (west wall), 2,3 outbound (east wall): { side, z, panel, anim, control }
  var rackGroups = [null, null, null, null];
  var slotHits = {};       // key -> hit mesh
  var bayLabelTex = {};
  var world = { boardTex: null, boardCtx: null, boardMat: null, lampMeshes: [], officeLamp: null, cot: null, coffeeMachine: null, pcScreen: null };

  function slotKey(r, b, l) { return r + ',' + b + ',' + l; }
  function slotParse(key) { var p = key.split(',').map(Number); return { r: p[0], b: p[1], l: p[2] }; }
  function rackSlotPos(r, b, l) { var P = PROPS['rack' + r] ? propPlacement('rack' + r) : { x: 0, z: RACK.rows[r], rot: 0 }, a = P.rot * Math.PI / 2, lx = RACK.x0 + RACK.bayW * (b + 0.5); return { x: P.x + lx * Math.cos(a), y: RACK.levels[l], z: P.z - lx * Math.sin(a), ry: a }; }
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
    // the pallet racks the player owns
    buildOffice(); buildBench(); buildBreakRoom();
    hingedDoor('office', 12.5, 9.45, false, 'the office door', { window: true, swing: 1 });
    hingedDoor('lobby', -15.5, 9.45, false, 'the lobby door', { window: true, swing: -1 });
    hingedDoor('break', -13, -12.95, false, 'the break room door', { window: true, swing: -1 });
    hingedDoor('staff', -X, SPOT.staffDoor.z - 0.5, false, 'the staff door', { mat: MAT.steelDark, swing: 1 });
    hingedDoor('exit', 13.5, -Z, true, 'the fire exit', { mat: MAT.steelDark, pushbar: true, swing: 1 });
    buildYard(); buildDressing(); buildControlCabinet(); buildProps();
  }

  function buildDoor(i, side, z) {
    var x = side * HALL.x;
    var panel = new THREE.Mesh(boxGeo(0.12, DOCKS.h, DOCKS.w), MAT.door); panel.castShadow = true; panel.receiveShadow = true;
    panel.position.set(x - side * 0.22, DOCKS.h / 2, z); scene.add(panel);
    var d = { i: i, side: side, z: z, panel: panel, anim: S.doors[i] ? 1 : 0 };
    addInter(panel, { prompt: function () { return S.doors[i] ? null : (S.events.power ? 'No power: the door motor is dead' : 'Open dock door ' + dockLabel(i) + ' · the cabinet and the consoles close it'); }, use: function () { if (!S.events.power) setDoor(i, true); else toast('No power. Flip the breaker in the office.', 'bad'); } });
    // a pull cord inside, to bring a door down without walking to the cabinet
    var cord = cyl(0.01, 1.2, MAT.red, x - side * 0.35, DOCKS.h - 0.6, z - DOCKS.w / 2 - 0.3, null, 4); var knob = box(0.08, 0.12, 0.08, MAT.red, x - side * 0.35, DOCKS.h - 1.25, z - DOCKS.w / 2 - 0.3);
    addInter(knob, { prompt: function () { return S.doors[i] ? 'Pull the cord: close dock door ' + dockLabel(i) : null; }, use: function () { if (S.doors[i]) setDoor(i, false); } });
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

  function buildRack(r) { if (PROPS['rack' + r]) buildProp('rack' + r); }
  // a rack row as a prop: uprights with bracing and base plates, beams with end plates, mesh decks, bay labels, slot hit volumes, the end guards
  function rackBuild(r) {
    return function (c) {
      var x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05;
      for (var b = 0; b <= RACK.bays; b++) {
        var ux = x0 + b * bw;
        [-dz, dz].forEach(function (oz) { c.box(0.1, 5, 0.1, MAT.rack, ux, 2.5, oz); c.box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, oz); for (var hh = 0.3; hh < 4.9; hh += 0.35) c.box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, oz); });
        for (var br = 0; br < 5; br++) { var yb = 0.4 + br * 1.0; c.box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, 0); var dg = c.box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, 0); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
      }
      for (var l = 1; l < RACK.levels.length; l++) {
        var y = RACK.levels[l];
        c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, -dz); c.box(RACK.bays * bw, 0.12, 0.08, MAT.beam, x0 + RACK.bays * bw / 2, y - 0.06, dz);
        for (var bp = 0; bp <= RACK.bays; bp++) { c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, -dz); c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, dz); }
        for (var bb2 = 0; bb2 < RACK.bays; bb2++) { var dk = c.plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, 0, -Math.PI / 2, 0); dk.receiveShadow = false; c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, -0.3); c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, 0.3); }
      }
      for (var bb = 0; bb < RACK.bays; bb++) {
        var cx = x0 + (bb + 0.5) * bw, lbl = 'ABCD'[r] + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#f5b53d' });
        var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
        [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, 4.75, s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; c.add(p); });
        for (var ll = 0; ll < RACK.levels.length; ll++) (function (rr, b2, l2) {
          var key = slotKey(rr, b2, l2), hh2 = l2 === 2 ? 1.6 : 1.45;
          slotHits[key] = c.hit(bw - 0.2, hh2, RACK.depth, cx, RACK.levels[l2] + hh2 / 2, 0, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } });
        })(r, bb, ll);
      }
      c.solid(x0 - 0.1, x0 + RACK.bays * bw + 0.1, -RACK.depth / 2, RACK.depth / 2, 0, 5);
      [-1, 1].forEach(function (s) { var x = s > 0 ? x0 + RACK.bays * bw + 0.3 : x0 - 0.3; c.box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, 0); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, -RACK.depth / 2 - 0.1); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, RACK.depth / 2 + 0.1); c.sign(['MAX LOAD', '1000 kg / level', 'row ' + 'ABCD'[r]], 0.5, 0.5, x + s * 0.06, 1.6, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 34 }); });
    };
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
  }

  function buildBench() {
    var bx = SPOT.bench.x, bz = SPOT.bench.z;
    // the two dock consoles by the outbound doors: dispatch a loaded truck early
  }

  // the entrance lobby (south-west corner) and the break room (north-west corner, above IN 1), both walled like the office
  function buildBreakRoom() {
    var X = HALL.x, Z = HALL.z, h = 3.2;
    // the lobby: x -20..-15.5, z 8.5..14; its door onto the hall at z 9.45..10.45 in the east wall, a window south of it
    var x0 = -15.5, z0 = 8.5;
    box(0.15, h, 0.8, MAT.plaster, x0, h / 2, z0 + 0.4); box(0.15, h - 2.2, 1.3, MAT.plaster, x0, 2.2 + (h - 2.2) / 2, 9.95);
    box(0.15, h, 0.6, MAT.plaster, x0, h / 2, 10.9); box(0.15, 1.1, 2.6, MAT.plaster, x0, 0.55, 12.5); box(0.15, h - 2.3, 2.6, MAT.plaster, x0, 2.3 + (h - 2.3) / 2, 12.5); box(0.04, 1.2, 2.6, MAT.glass, x0, 1.7, 12.5); box(0.15, h, 0.2, MAT.plaster, x0, h / 2, Z - 0.1);
    solid(x0 - 0.08, x0 + 0.08, z0, 9.3); solid(x0 - 0.08, x0 + 0.08, 10.6, Z);
    box(X + x0, h, 0.15, MAT.plaster, (-X + x0) / 2, h / 2, z0); solid(-X, x0, z0 - 0.08, z0 + 0.08);
    box(X + x0, 0.12, Z - z0, MAT.plaster, (-X + x0) / 2, h + 0.06, (z0 + Z) / 2); plane(X + x0 - 0.2, Z - z0 - 0.2, MAT.tile, (-X + x0) / 2, h - 0.01, (z0 + Z) / 2, Math.PI / 2);
    box(1.2, 0.08, 0.3, MAT.lamp, -17.7, h - 0.05, 11.2);
    for (var bl = 0; bl < 14; bl++) box(0.02, 0.05, 2.5, MAT.trim, x0 + 0.09, 2.26 - bl * 0.08, 12.5);
    sign(['LOBBY'], 1.2, 0.45, x0 + 0.09, 2.6, 9.95, Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' });
    // the break room: x -20..-13, z -14..-10.2; its door in the east wall at z -12.95..-11.95, a window in the south wall onto the hall
    var bx = -13, bz = -10.2;
    box(0.15, h, 1.05, MAT.plaster, bx, h / 2, -Z + 0.525); box(0.15, h - 2.2, 1.3, MAT.plaster, bx, 2.2 + (h - 2.2) / 2, -12.45); box(0.15, h, 1.6, MAT.plaster, bx, h / 2, bz - 0.8);
    solid(bx - 0.08, bx + 0.08, -Z, -12.95); solid(bx - 0.08, bx + 0.08, -11.95, bz);
    box(1.0, h, 0.15, MAT.plaster, -X + 0.5, h / 2, bz); box(1.2, h, 0.15, MAT.plaster, bx - 0.6, h / 2, bz);
    box(X + bx - 2.2, 1.1, 0.15, MAT.plaster, (-X + 1 + bx - 1.2) / 2, 0.55, bz); box(X + bx - 2.2, h - 2.3, 0.15, MAT.plaster, (-X + 1 + bx - 1.2) / 2, 2.3 + (h - 2.3) / 2, bz); box(X + bx - 2.2, 1.2, 0.04, MAT.glass, (-X + 1 + bx - 1.2) / 2, 1.7, bz);
    solid(-X, bx, bz - 0.08, bz + 0.08);
    box(X + bx, 0.12, Z + bz, MAT.plaster, (-X + bx) / 2, h + 0.06, (-Z + bz) / 2); plane(X + bx - 0.2, Z + bz - 0.2, MAT.tile, (-X + bx) / 2, h - 0.01, (-Z + bz) / 2, Math.PI / 2);
    box(1.2, 0.08, 0.3, MAT.lamp, -16.5, h - 0.05, -12.1);
    for (var bl2 = 0; bl2 < 14; bl2++) box(4.6, 0.05, 0.02, MAT.trim, -16.4, 2.26 - bl2 * 0.08, bz - 0.09);
    sign(['BREAK ROOM'], 1.6, 0.45, bx + 0.09, 2.6, -12.45, Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' });
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
