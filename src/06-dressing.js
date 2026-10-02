//@ the hall's dressing: everything that makes it look worked in, none of it load-bearing for the simulation
  // ── Dressing ──────────────────────────────────────────────────────
  var dress = { fans: [], clocks: [], dockLamps: [], wrapper: null, kpiCtx: null, kpiTex: null, vending: null, radio: null, flag: null, charger: null };

  function wallClock(x, y, z, ry, r) {
    r = r || 0.32; var g = new THREE.Group(); g.userData.dynamic = true; g.position.set(x, y, z); g.rotation.y = ry || 0; scene.add(g);
    var face = cyl(r, 0.03, MAT.white, 0, 0, 0, g, 32); face.rotation.x = Math.PI / 2;
    var rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 32), MAT.steelDark); g.add(rim);
    for (var i = 0; i < 12; i++) { var t = box(i % 3 ? 0.015 : 0.03, i % 3 ? 0.04 : 0.07, 0.01, MAT.black, Math.sin(i / 12 * 6.283) * (r - 0.07), Math.cos(i / 12 * 6.283) * (r - 0.07), 0.02, g); t.rotation.z = -i / 12 * 6.283; }
    var hh = new THREE.Group(), mh = new THREE.Group(); hh.position.z = 0.025; mh.position.z = 0.03; g.add(hh); g.add(mh);
    box(0.035, r * 0.55, 0.01, MAT.black, 0, r * 0.22, 0, hh); box(0.025, r * 0.85, 0.01, MAT.black, 0, r * 0.37, 0, mh);
    cyl(0.03, 0.02, MAT.red, 0, 0, 0.035, g, 10).rotation.x = Math.PI / 2;
    dress.clocks.push({ h: hh, m: mh });
  }
  function tickClocks() { dress.clocks.forEach(function (c) { c.h.rotation.z = -(S.time / 12) * 6.283; c.m.rotation.z = -(S.time % 1) * 6.283; }); }

  function fireExtinguisher(x, z, ry) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; scene.add(g);
    cyl(0.08, 0.5, MAT.red, 0, 1.0, 0, g, 12); cyl(0.05, 0.08, MAT.black, 0, 1.28, 0, g, 10); box(0.03, 0.12, 0.1, MAT.black, 0, 1.36, 0.02, g); cyl(0.01, 0.3, MAT.black, 0.06, 1.05, 0.06, g, 6).rotation.x = 0.4;
    box(0.2, 0.04, 0.1, MAT.steelDark, 0, 0.72, -0.07, g);
    sign(['FIRE'], 0.3, 0.12, 0, 1.6, -0.08, 0, { w: 128, h: 48, bg: '#c8342a', fg: '#fff' }, g);
  }
  function kpiBoard() {
    var c = document.createElement('canvas'); c.width = 512; c.height = 320; dress.kpiCtx = c.getContext('2d');
    dress.kpiTex = new THREE.CanvasTexture(c); dress.kpiTex.encoding = THREE.sRGBEncoding;
    drawKpi();
    return new THREE.MeshBasicMaterial({ map: dress.kpiTex });
  }
  function drawKpi() {
    var c = dress.kpiCtx; if (!c) return; var w = 512, h = 320;
    c.fillStyle = '#f4f4f2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2c5f9e'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#2c5f9e'; c.font = 'bold 30px "Segoe Print", "Comic Sans MS", cursive'; c.textAlign = 'left'; c.fillText('THIS WEEK', 24, 48);
    var tot = S.stats.shipped || 0, late = S.stats.late || 0, ontime = tot ? Math.round(100 * (tot - late) / tot) : 100;
    var rows = [['on time', ontime + '%'], ['shipped', String(tot)], ['received', (S.stats.received || 0) + ' pallets'], ['in stock', totalStock() + ' boxes'], ['rep', String(Math.round(S.rep))]];
    c.font = '26px "Segoe Print", "Comic Sans MS", cursive';
    rows.forEach(function (r, i) { c.fillStyle = i === 0 ? (ontime >= 90 ? '#2f9e44' : '#c8342a') : '#1b232c'; c.fillText(r[0], 30, 96 + i * 42); c.textAlign = 'right'; c.fillText(r[1], w - 30, 96 + i * 42); c.textAlign = 'left'; });
    c.strokeStyle = '#c8342a'; c.lineWidth = 3; c.beginPath(); c.moveTo(30, 60); c.lineTo(w - 30, 60); c.stroke();
    c.fillStyle = '#c8342a'; c.font = '20px "Segoe Print", "Comic Sans MS", cursive'; c.fillText('close the dock doors at night!!', 30, h - 24);
    dress.kpiTex.needsUpdate = true;
  }

  function buildDressing() {
    var X = HALL.x, Z = HALL.z, H = HALL.h;
    // pilasters on the long walls, and bollards guarding every dock door
    [-12, -4, 4, 12].forEach(function (x) { box(0.4, H, 0.4, MAT.steelDark, x, H / 2, -Z + 0.35); box(0.4, H, 0.4, MAT.steelDark, x, H / 2, Z - 0.35); });
    doors.forEach(function (d) { [-1, 1].forEach(function (s) { var bx = d.side * (X - 1.0), bz = d.z + s * (DOCKS.w / 2 + 0.5); cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, null, 10); cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, null, 10); }); });
    // the north wall: cable tray, sprinkler main, extractor fans, the exit door, the big clock, the painted name
    box(2 * X - 1, 0.08, 0.3, MAT.steelDark, 0, 5.6, -Z + 0.35); for (var cx = -18; cx <= 18; cx += 2) box(0.04, 0.08, 0.3, MAT.steelDark, cx, 5.6, -Z + 0.35);
    [-9.5, 9.5].forEach(function (z) { var p = cyl(0.07, 2 * X - 2, MAT.red, 0, 6.45, z, null, 10); p.rotation.z = Math.PI / 2; for (var sx = -16; sx <= 16; sx += 4) { cyl(0.025, 0.18, MAT.steelDark, sx, 6.3, z, null, 6); sphere(0.03, MAT.chrome, sx, 6.2, z); } });
    [-15, 15].forEach(function (x) {
      var g = new THREE.Group(); g.userData.dynamic = true; g.position.set(x, 5.4, -Z + 0.4); scene.add(g);
      var housing = cyl(0.62, 0.3, MAT.steelDark, 0, 0, 0, g, 24); housing.rotation.x = Math.PI / 2;
      var hub = new THREE.Group(); hub.position.z = 0.17; g.add(hub); cyl(0.08, 0.12, MAT.plastic, 0, 0, 0, hub, 10).rotation.x = Math.PI / 2;
      for (var b = 0; b < 4; b++) { var bl = box(0.16, 0.5, 0.02, MAT.plastic, 0, 0.28, 0, hub); bl.rotation.z = b * Math.PI / 2; bl.position.set(Math.sin(b * Math.PI / 2) * -0.28, Math.cos(b * Math.PI / 2) * 0.28, 0); bl.rotation.y = 0.5; }
      for (var r = 0; r < 5; r++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(0.15 + r * 0.11, 0.008, 6, 24), MAT.steelDark); ring.position.z = 0.26; g.add(ring); }
      dress.fans.push(hub);
    });
    var exitSign = function (x, y, z, ry) { var m = sign(['EXIT'], 0.5, 0.2, x, y, z, ry, { w: 256, h: 96, bg: '#1f7a3a', fg: '#dfffe8' }); var b = box(0.54, 0.24, 0.04, MAT.exit, x, y, z + (ry ? 0 : 0.03), null); b.rotation.y = ry || 0; if (ry) b.position.x += ry > 0 ? -0.03 : 0.03; m.renderOrder = 1; };
    exitSign(14, 2.6, -Z + 0.2, 0); exitSign(-X + 0.2, 2.6, SPOT.staffDoor.z, Math.PI / 2); poster('exit', 0.6, 0.9, 15.2, 1.9, -Z + 0.17, 0);
    wallClock(0, 5.8, -Z + 0.3, 0, 0.5);
    sign(['DEPOT CO.'], 9, 1.6, 0, 4.4, -Z + 0.17, 0, { w: 1024, h: 192, bg: '#1b232c', fg: '#f5b53d' });
    sign(['RECEIVE · STORE · PICK · SHIP'], 7, 0.5, 0, 3.3, -Z + 0.17, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8' });
    // the rack block: end guards, load labels, aisle signs hanging from the roof, the walkway crossings at both ends
    [[-4, 'AISLE  A · B'], [0, 'AISLE  B · C'], [4, 'AISLE  C · D']].forEach(function (a) {
      sign([a[1]], 2.2, 0.5, 0, 5.4, a[0], 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); sign([a[1]], 2.2, 0.5, 0, 5.4, a[0], Math.PI, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' });
      cyl(0.006, 1.3, MAT.steelDark, -0.9, 6.3, a[0], null, 4); cyl(0.006, 1.3, MAT.steelDark, 0.9, 6.3, a[0], null, 4);
    });
    [-13.6, 13.6].forEach(function (x) { for (var z = -7; z <= 7; z += 0.7) plane(1.2, 0.35, MAT.whiteLine, x, 0.0065, z, -Math.PI / 2); });
    // dock lights beside every door, a wheel-chock pair inside, the lifting poster between the inbound doors
    doors.forEach(function (d) {
      var x = d.side * (X - 0.3), z = d.z - DOCKS.w / 2 - 0.5;
      box(0.5, 0.06, 0.06, MAT.steelDark, x + d.side * -0.2, 4.6, z); var lamp = box(0.18, 0.18, 0.18, glowMat(0xffb020, 0.4), x - d.side * 0.5, 4.5, z); dress.dockLamps.push({ m: lamp, door: d.i });
      box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.3); box(0.35, 0.15, 0.2, MAT.rubber, d.side * (X - 1.6), 0.075, d.z + DOCKS.w / 2 - 0.6);
    });
    poster('lifting', 0.7, 1.05, -X + 0.17, 2.0, -4, Math.PI / 2); poster('forklift', 0.7, 1.05, 2.2, 2.0, Z - 0.17, Math.PI); poster('stacking', 0.7, 1.05, -6, 2.0, Z - 0.17, Math.PI);
    poster('safety', 0.7, 1.05, 12.42, 1.9, 11.5, -Math.PI / 2); poster('nosmoking', 0.6, 0.9, -X + 0.17, 2.0, 9.2, Math.PI / 2);
    // fire points, the hose reel, the first-aid box
    fireExtinguisher(-X + 0.35, -12, Math.PI / 2); fireExtinguisher(X - 0.35, -12, -Math.PI / 2); fireExtinguisher(13.2, 6.5, -Math.PI / 2); fireExtinguisher(-X + 0.35, 13.2, Math.PI / 2);
    var reel = cyl(0.32, 0.12, MAT.red, 0, 1.5, -Z + 0.3, null, 24); reel.rotation.x = Math.PI / 2; cyl(0.05, 0.3, MAT.steelDark, 0, 1.5, -Z + 0.22, null, 8).rotation.x = Math.PI / 2; sign(['HOSE REEL'], 0.7, 0.16, 0, 2.0, -Z + 0.17, 0, { w: 256, h: 64, bg: '#c8342a', fg: '#fff' });
    box(0.3, 0.3, 0.1, MAT.white, -14.3, 1.7, Z - 0.22); box(0.18, 0.05, 0.02, MAT.green, -14.3, 1.7, Z - 0.28); box(0.05, 0.18, 0.02, MAT.green, -14.3, 1.7, Z - 0.28);
    // receiving: a stack of empties, the baler and a bale; shipping: the stretch wrapper, a bin, a broom, a wet-floor sign
    for (var i = 0; i < 9; i++) box(1.2, 0.14, 1.0, MAT.wood, -17.6 + (i % 2) * 0.03, 0.07 + i * 0.145, -11.6 + (i % 3) * 0.02);
    sign(['EMPTIES'], 1.2, 0.3, -17.6, 1.6, -11.0, 0, { w: 256, h: 64, bg: '#2a2f36', fg: '#a0acb8' });
    // the cardboard baler: a steel chamber on a frame, the loading door with its handle, the ram cylinder on top, a control box with lamps
    box(1.3, 2.2, 1.1, MAT.green, -8, 1.1, -12.9); box(1.4, 0.1, 1.2, MAT.steelDark, -8, 0.05, -12.9); box(1.4, 0.08, 1.2, MAT.steelDark, -8, 2.24, -12.9);
    box(0.9, 0.9, 0.06, MAT.steelDark, -8, 0.9, -12.32); box(0.08, 0.5, 0.05, MAT.chrome, -7.65, 0.9, -12.27); box(0.9, 0.06, 0.06, MAT.hazard, -8, 1.4, -12.32); box(0.9, 0.5, 0.06, MAT.plastic, -8, 1.75, -12.32);
    cyl(0.14, 0.7, MAT.chrome, -8, 2.6, -12.9, null, 14); cyl(0.2, 0.3, MAT.steelDark, -8, 2.4, -12.9, null, 14); cyl(0.06, 0.5, MAT.black, -7.6, 2.5, -13.2, null, 8).rotation.x = 0.4;
    box(0.32, 0.42, 0.12, MAT.grey, -7.15, 1.7, -12.36); [[0xff3b30, -0.08], [0x39d353, 0.08]].forEach(function (lp) { var l = cyl(0.025, 0.02, glowMat(lp[0], 1.2), -7.15 + lp[1], 1.82, -12.29, null, 10); l.rotation.x = Math.PI / 2; }); box(0.06, 0.06, 0.03, MAT.red, -7.15, 1.62, -12.29); box(0.06, 0.06, 0.03, MAT.green, -7.05, 1.62, -12.29);
    sign(['BALER', 'cardboard only'], 0.9, 0.3, -8, 2.05, -12.33, 0, { w: 256, h: 96, bg: '#1b232c', fg: '#5fd38d', size: 34 }); sign(['CRUSH HAZARD'], 0.8, 0.14, -8, 0.3, -12.33, 0, { w: 256, h: 48, bg: '#f5b53d', fg: '#1a1205' });
    solid(-8.7, -7.3, -13.5, -12.3); box(1.0, 0.8, 0.8, MAT.parcel, -6.2, 0.4, -12.8); solid(-6.7, -5.7, -13.2, -12.4);
    var wg = new THREE.Group(); wg.userData.dynamic = true; wg.position.set(8, 0, -12.3); scene.add(wg); dress.wrapper = wg;
    // the stretch wrapper: a turntable with a ramp and chequer plate, the mast with its carriage and film roll, the control box
    var tt = cyl(0.95, 0.1, MAT.steelDark, 0, 0.05, 0, wg, 32); dress.turntable = tt; plane(1.7, 1.7, MAT.rubberMat, 0, 0.101, 0, -Math.PI / 2, 0, tt); for (var tk = 0; tk < 8; tk++) box(0.04, 0.02, 0.5, MAT.yellow, Math.sin(tk / 8 * 6.283) * 0.7, 0.105, Math.cos(tk / 8 * 6.283) * 0.7, tt).rotation.y = tk / 8 * 6.283;
    var rp = box(1.2, 0.1, 0.9, MAT.steelDark, 0, 0.03, 1.35, wg); rp.rotation.x = 0.11; box(0.35, 2.7, 0.35, MAT.blue, 0, 1.35, -1.15, wg); box(0.45, 0.12, 0.45, MAT.steelDark, 0, 0.06, -1.15, wg); box(0.1, 2.5, 0.05, MAT.chrome, -0.1, 1.4, -0.95, wg); box(0.1, 2.5, 0.05, MAT.chrome, 0.1, 1.4, -0.95, wg);
    var carr = new THREE.Group(); carr.position.set(0, 1.0, -0.8); wg.add(carr); dress.wrapCarriage = carr; box(0.5, 0.4, 0.3, MAT.steelDark, 0, 0, 0, carr); cyl(0.14, 0.52, MAT.white, 0.35, 0, 0.1, carr, 14); cyl(0.02, 0.6, MAT.chrome, 0.35, 0, 0.1, carr, 6); cyl(0.05, 0.3, MAT.rubber, -0.3, 0, 0.1, carr, 8);
    box(0.32, 0.45, 0.15, MAT.grey, 0, 2.0, -0.86, wg); plane(0.2, 0.12, MAT.screen, 0, 2.1, -0.78, 0, 0, wg); box(0.05, 0.05, 0.03, MAT.green, -0.08, 1.88, -0.78, wg); box(0.05, 0.05, 0.03, MAT.red, 0.08, 1.88, -0.78, wg); sign(['START'], 0.12, 0.05, -0.08, 1.82, -0.78, 0, { w: 128, h: 48, bg: '#1b232c', fg: '#5fd38d' }, wg);
    sign(['STRETCH WRAP'], 1.2, 0.25, 0, 2.5, -0.9, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#78bdf5' }, wg); solid(7, 9, -13.7, -11.3);
    hitBox(1.0, 2.4, 0.8, 0, 1.2, -1.05, { prompt: function () { return wrapperPrompt(); }, use: function () { wrapperUse(); } }, wg);
    cyl(0.3, 0.8, MAT.grey, 14.3, 0.4, 2.6, null, 16); cyl(0.32, 0.05, MAT.black, 14.3, 0.82, 2.6, null, 16); solid(14, 14.6, 2.3, 2.9);
    var broom = cyl(0.015, 1.3, MAT.wood, 14.6, 0.7, 2.95, null, 6); broom.rotation.z = 0.25; box(0.25, 0.08, 0.05, MAT.plastic, 14.75, 0.08, 2.95);
    [[-1, 0.3], [1, 0.3]].forEach(function (o) { var p = plane(0.4, 0.7, new THREE.MeshBasicMaterial({ map: textTex(['WET', 'FLOOR'], { w: 128, h: 192, bg: '#f5b53d', fg: '#111', size: 44 }), side: THREE.DoubleSide }), 12.0 + o[0] * 0.12, 0.35, 10.6, 0, o[0] * 0.3); p.rotation.x = o[0] * -0.25; });
    // the forklift bay, the tool bays and the charger on the south wall
    var bay = function (cx, cz, w, d, label) { plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz - d / 2, -Math.PI / 2); plane(w, 0.08, MAT.yellowLine, cx, 0.0062, cz + d / 2, -Math.PI / 2); plane(0.08, d, MAT.yellowLine, cx - w / 2, 0.0062, cz, -Math.PI / 2); plane(0.08, d, MAT.yellowLine, cx + w / 2, 0.0062, cz, -Math.PI / 2); plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex([label], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), cx, 0.0066, cz + d / 2 - 0.3, -Math.PI / 2); };
    bay(SPOT.fork.x, SPOT.fork.z, 2.6, 3.6, 'FORKLIFT'); bay(SPOT.jack.x, SPOT.jack.z, 1.6, 2.2, 'JACK'); bay(SPOT.cart.x, SPOT.cart.z, 1.8, 1.4, 'CART');
    var chg = box(0.5, 1.2, 0.3, MAT.grey, 0, 0.6, Z - 0.35); dress.charger = box(0.06, 0.06, 0.04, glowMat(0x5fd38d, 1.2), 0, 1.0, Z - 0.52); cyl(0.02, 1.6, MAT.black, 0.3, 0.4, Z - 0.6, null, 6).rotation.x = 0.9; sign(['CHARGER'], 0.6, 0.16, 0, 1.35, Z - 0.52, Math.PI, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' });
    // by the staff door: the time clock, the card rack, a rubber mat, coat hooks with vests
    box(0.3, 0.4, 0.12, MAT.grey, -X + 0.26, 1.5, 10.2); plane(0.16, 0.08, MAT.screen, -X + 0.33, 1.58, 10.2, 0, Math.PI / 2); box(0.03, 0.03, 0.08, MAT.red, -X + 0.33, 1.4, 10.2);
    box(0.08, 0.5, 0.5, MAT.steelDark, -X + 0.24, 1.5, 10.75); for (var k = 0; k < 6; k++) box(0.03, 0.14, 0.06, MAT.paper, -X + 0.3, 1.62 - (k % 3) * 0.14, 10.56 + Math.floor(k / 3) * 0.22);
    sign(['CLOCK IN'], 0.6, 0.16, -X + 0.21, 1.85, 10.5, Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#eef1f5' });
    plane(1.4, 1.0, MAT.rubberMat, -X + 1.1, 0.004, SPOT.staffDoor.z, -Math.PI / 2);
    for (var hk = 0; hk < 4; hk++) { var hx = -16.8 + hk * 0.45; cyl(0.015, 0.1, MAT.chrome, hx, 1.75, Z - 0.24, null, 6).rotation.x = Math.PI / 2; if (hk !== 2) { box(0.36, 0.5, 0.06, hk === 1 ? MAT.hivisOrange : MAT.hivis, hx, 1.45, Z - 0.3); box(0.1, 0.06, 0.07, MAT.hivis, hx, 1.72, Z - 0.3); } }
    box(1.9, 0.04, 0.12, MAT.wood, -16.1, 1.82, Z - 0.26);
    // the break room: vending machine, fridge, microwave and kettle, the radio, a wall clock, a calendar, posters
    var vg = new THREE.Group(); vg.position.set(-13.2, 0, 13.4); scene.add(vg);
    box(0.95, 1.9, 0.8, MAT.blue, 0, 0.95, 0, vg); plane(0.6, 1.1, glowMat(0x9ad0ff, 0.35), -0.1, 1.15, -0.41, 0, Math.PI, vg); for (var vr = 0; vr < 4; vr++) for (var vc = 0; vc < 3; vc++) box(0.12, 0.16, 0.08, [MAT.red, MAT.green, MAT.yellow, MAT.white][(vr + vc) % 4], -0.3 + vc * 0.2, 0.75 + vr * 0.25, -0.38, vg);
    box(0.25, 0.9, 0.04, MAT.black, 0.3, 1.1, -0.41, vg); box(0.5, 0.25, 0.04, MAT.black, -0.1, 0.35, -0.41, vg); solid(-13.7, -12.7, 13, 13.8);
    dress.vending = hitBox(1.0, 1.9, 0.9, 0, 0.95, 0, { prompt: function () { return S.events.power ? 'The vending machine is dark' : 'Buy a snack ($3): walk faster for half an hour'; }, use: function () { buySnack(); } }, vg);
    sign(['SNACKS'], 0.7, 0.2, -0.1, 1.8, -0.42, Math.PI, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' }, vg);
    box(0.5, 0.3, 0.38, MAT.black, SPOT.coffee.x + 0.9, 1.05, SPOT.coffee.z - 0.05); plane(0.14, 0.1, MAT.screen, SPOT.coffee.x + 0.9, 1.08, SPOT.coffee.z + 0.15, 0, 0); cyl(0.08, 0.2, MAT.chrome, SPOT.coffee.x - 0.5, 1.0, SPOT.coffee.z, null, 12); cyl(0.045, 0.1, MAT.white, SPOT.coffee.x - 0.3, 0.95, SPOT.coffee.z + 0.15, null, 10); cyl(0.045, 0.1, MAT.red, SPOT.coffee.x - 0.2, 0.95, SPOT.coffee.z + 0.05, null, 10);
    var rg = new THREE.Group(); rg.position.set(SPOT.coffee.x + 0.45, 0.98, SPOT.coffee.z - 0.1); scene.add(rg); dress.radio = rg;
    box(0.36, 0.16, 0.14, MAT.plastic, 0, 0, 0, rg); plane(0.12, 0.1, MAT.rubberMat, -0.09, 0.0, 0.071, 0, 0, rg); plane(0.12, 0.04, glowMat(0xf5b53d, 0.3), 0.09, 0.02, 0.071, 0, 0, rg); cyl(0.005, 0.35, MAT.chrome, 0.15, 0.22, 0, rg, 4).rotation.z = -0.3; cyl(0.02, 0.02, MAT.black, 0.09, -0.04, 0.072, rg, 8).rotation.x = Math.PI / 2;
    hitBox(0.4, 0.2, 0.2, 0, 0, 0, { prompt: function () { return radioPrompt(); }, use: function () { radioUse(); } }, rg);
    wallClock(-15.6, 2.7, Z - 0.3, Math.PI, 0.28);
    box(0.4, 0.5, 0.02, MAT.paper, -14.6, 2.6, Z - 0.26); sign(['OCTOBER', '', '1  2  3  4  5  6  7', '8  9 10 11 12 13 14'], 0.36, 0.44, -14.6, 2.6, Z - 0.28, Math.PI, { w: 256, h: 320, bg: '#f3efe4', fg: '#1b232c', size: 34 });
    poster('rota', 0.6, 0.9, -12.6, 2.0, 11.0, -Math.PI / 2); poster('hands', 0.5, 0.75, -18.6, 2.6, Z - 0.17, Math.PI);
    // the office: a plant, a printer, a coat stand, blinds, the whiteboard, a certificate, desk clutter
    cyl(0.16, 0.3, MAT.plastic, 13.2, 0.15, 13.4, null, 12, 0.13); [[0, 0.5, 0, 0.22], [0.12, 0.62, 0.08, 0.16], [-0.1, 0.66, -0.06, 0.14], [0.02, 0.78, 0.05, 0.12]].forEach(function (s) { sphere(s[3], MAT.green, 13.2 + s[0], s[1], 13.4 + s[2]); });
    box(0.5, 0.25, 0.4, MAT.grey, 19.3, 1.42, 13.5); box(0.4, 0.03, 0.3, MAT.white, 19.3, 1.56, 13.45); cyl(0.03, 1.7, MAT.steelDark, 13.0, 0.85, 9.0, null, 8); [0, 1, 2].forEach(function (k) { cyl(0.012, 0.25, MAT.steelDark, 13.0, 1.6, 9.0, null, 4).rotation.z = Math.PI / 2 + k * 2.09; }); box(0.4, 0.45, 0.1, MAT.jeans, 13.05, 1.3, 9.1);
    for (var bl = 0; bl < 14; bl++) box(5.4, 0.05, 0.02, MAT.trim, 16.1, 2.26 - bl * 0.08, 8.58);
    var kb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), kpiBoard()); kb.position.set(19.78, 2.0, 11.5); kb.rotation.y = -Math.PI / 2; scene.add(kb); box(0.04, 1.08, 1.68, MAT.chrome, 19.82, 2.0, 11.5);
    box(0.02, 0.4, 0.3, MAT.wood, 19.8, 2.4, 13.3); sign(['CERTIFICATE', 'of registration', 'Depot Co. · 3PL'], 0.26, 0.36, 19.78, 2.4, 13.3, -Math.PI / 2, { w: 192, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 22 });
    cyl(0.04, 0.09, MAT.white, SPOT.pc.x + 0.7, 0.82, SPOT.pc.z + 0.5, null, 10); box(0.2, 0.01, 0.28, MAT.paper, SPOT.pc.x - 0.75, 0.785, SPOT.pc.z + 0.5); box(0.18, 0.08, 0.12, MAT.black, SPOT.pc.x + 0.8, 0.82, SPOT.pc.z + 0.85); cyl(0.01, 0.2, MAT.black, SPOT.pc.x + 0.8, 0.93, SPOT.pc.z + 0.85, null, 6).rotation.x = 0.6;
    poster('safety', 0.6, 0.9, 16.5, 2.1, Z - 0.17, Math.PI);
    // the crossing where the walkway meets the dock aprons, and the pedestrian route into the office
    plane(1.4, 0.08, MAT.yellowLine, 12.5, 0.0062, 9.95, -Math.PI / 2);
  }
  function rackEnds(r) {
    var z = RACK.rows[r];
    [-1, 1].forEach(function (s) {
      var x = s > 0 ? RACK.x0 + RACK.bays * RACK.bayW + 0.3 : RACK.x0 - 0.3;
      box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, z); box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, z - RACK.depth / 2 - 0.1); box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, z + RACK.depth / 2 + 0.1);
      sign(['MAX LOAD', '1000 kg / level', 'row ' + 'ABCD'[r]], 0.5, 0.5, x + s * 0.06, 1.6, z, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 34 });
    });
  }
  function buySnack() {
    if (S.events.power) { toast('No power.', 'bad'); return; }
    if (S.bank < 3) { toast('No change on you.', 'bad'); return; }
    pay(-3, 'Snack from the machine'); buff.snackDay = S.day; buff.snackUntil = S.time + 0.5; sfx('vend'); toast('Crisps. Faster for half an hour.', 'good'); burst(dress.vending.parent.position.x, 0.5, dress.vending.parent.position.z - 0.5, 0xf5b53d, 8, 'down');
  }
  function tickDressing(dt) {
    var power = !S.events.power;
    dress.fans.forEach(function (f) { f.rotation.z += dt * (power ? 9 : 0.5); });
    if (dress.turntable) dress.turntable.rotation.y += dt * (wrapperBusy() ? 1.4 : 0);
    if (dress.wrapCarriage) dress.wrapCarriage.position.y = wrapperBusy() ? 0.5 + Math.abs(Math.sin(worldTime * 0.9)) * 1.0 : 1.0;
    dress.dockLamps.forEach(function (l) { var d = doors[l.door]; var coming = S.trucks.some(function (t) { return (t.dir === 'in' ? t.dock : 2 + t.dock) === d.i && (t.state === 'coming' || t.state === 'leaving'); }); l.m.material.emissiveIntensity = coming ? (Math.sin(worldTime * 8) > 0 ? 2.2 : 0.2) : (S.doors[d.i] ? 1.2 : 0.2); });
    if (dress.charger) dress.charger.material.emissiveIntensity = power ? (forkCharging() ? (Math.sin(worldTime * 3) > 0 ? 1.5 : 0.4) : 1) : 0;
    tickClocks();
  }
