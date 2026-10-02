//@ the yard outside: ground, truck lanes, dock shelters, the fence and its gates, the car park, neighbours, the road and its traffic, sky, weather
  // ── The yard ──────────────────────────────────────────────────────
  var yard = { gates: [], guards: [], traffic: [], clouds: [], sunDisc: null, moon: null, puddles: [], rain: null, snow: null, flag: null, lampLenses: [], windT: 0 };
  var CAR_COLS = [0xb8322a, 0x2c5f9e, 0xd8dbdf, 0x2a2d33, 0x7a8691, 0xe0a02a, 0x4f6a3a];
  function carMesh(col) {
    var g = new THREE.Group(), paint = std({ color: col, roughness: 0.35, metalness: 0.5 });
    box(4.2, 0.55, 1.8, paint, 0, 0.55, 0, g); box(2.3, 0.6, 1.65, paint, -0.2, 1.1, 0, g);
    box(0.05, 0.5, 1.5, MAT.glass, 0.98, 1.1, 0, g).rotation.z = -0.5; box(0.05, 0.5, 1.5, MAT.glass, -1.38, 1.1, 0, g).rotation.z = 0.5; box(2.0, 0.45, 0.04, MAT.glass, -0.2, 1.1, 0.83, g); box(2.0, 0.45, 0.04, MAT.glass, -0.2, 1.1, -0.83, g);
    [[1.4, 0.95], [1.4, -0.95], [-1.4, 0.95], [-1.4, -0.95]].forEach(function (p) { var w = cyl(0.33, 0.22, MAT.rubber, p[0], 0.33, p[1], g, 14); w.rotation.x = Math.PI / 2; cyl(0.18, 0.23, MAT.chrome, p[0], 0.33, p[1], g, 10).rotation.x = Math.PI / 2; });
    box(0.06, 0.14, 0.3, MAT.lamp, 2.1, 0.6, 0.6, g); box(0.06, 0.14, 0.3, MAT.lamp, 2.1, 0.6, -0.6, g); box(0.06, 0.12, 0.3, MAT.red, -2.1, 0.6, 0.6, g); box(0.06, 0.12, 0.3, MAT.red, -2.1, 0.6, -0.6, g);
    box(0.1, 0.16, 1.9, MAT.plastic, 2.12, 0.4, 0, g); box(0.1, 0.16, 1.9, MAT.plastic, -2.12, 0.4, 0, g); box(0.02, 0.1, 0.4, MAT.white, 2.18, 0.42, 0, g); box(0.02, 0.1, 0.4, MAT.white, -2.18, 0.42, 0, g); box(0.08, 0.06, 0.16, MAT.black, 0.7, 1.15, 0.9, g); box(0.08, 0.06, 0.16, MAT.black, 0.7, 1.15, -0.9, g); box(0.1, 0.05, 1.2, MAT.chrome, -0.2, 1.42, 0, g);
    box(0.4, 0.08, 1.2, MAT.black, -1.0, 0.28, 0, g); cyl(0.02, 0.4, MAT.black, -0.9, 1.5, 0.3, g, 4);
    return g;
  }
  function tree(x, z, s) {
    s = s || 1; cyl(0.12 * s, 2.6 * s, std({ color: 0x5b4634, roughness: 1 }), x, YARD_Y + 1.3 * s, z, null, 8, 0.18 * s);
    [[0, 3.2, 0, 1.3], [0.7, 2.7, 0.4, 0.9], [-0.6, 2.9, -0.5, 1.0], [0.1, 4.0, 0.2, 0.8]].forEach(function (b, i) { sphere(b[3] * s, std({ color: [0x3f6f2e, 0x5c8f44, 0x45752f, 0x6f9a4a][i], roughness: 1 }), x + b[0] * s, YARD_Y + b[1] * s, z + b[2] * s); });
  }
  function cloudTex() { return tex(256, 128, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 14; i++) { var r = randf(18, 42), x = randf(r, w - r), y = randf(r * 0.6, h - r * 0.6); var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } }); }
  function discTex(col) { return tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, col); g.addColorStop(0.45, col); g.addColorStop(0.6, 'rgba(255,240,200,0.35)'); g.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); }

  function buildYard() {
    var X = HALL.x, Z = HALL.z;
    // the ground: grass to the horizon, the asphalt yard, the plinth the hall stands on, a lighter apron round it
    plane(600, 600, MAT.grass, 0, YARD_Y - 0.03, 0, -Math.PI / 2);
    plane(170, 124, MAT.yard, 0, YARD_Y, 0, -Math.PI / 2);
    box(2 * X + 0.6, 1.2, 2 * Z + 0.6, MAT.grey, 0, YARD_Y + 0.6, 0);
    // truck lanes to every dock: edge lines, a centre dash, and a hatched keep-clear apron
    doors.forEach(function (d) {
      var side = d.side, x0 = side * (X + 1), x1 = side * 76, cx = (x0 + x1) / 2, len = Math.abs(x1 - x0);
      plane(len, 0.15, MAT.whiteLine, cx, YARD_Y + 0.012, d.z - 2.2, -Math.PI / 2); plane(len, 0.15, MAT.whiteLine, cx, YARD_Y + 0.012, d.z + 2.2, -Math.PI / 2);
      for (var x = side * (X + 8); Math.abs(x) < 74; x += side * 4) plane(2, 0.12, MAT.whiteLine, x, YARD_Y + 0.012, d.z, -Math.PI / 2);
      for (var k = 0; k < 6; k++) { var hp = plane(5, 0.14, MAT.yellowLine, side * (X + 3.5), YARD_Y + 0.013, d.z - 2 + k * 0.8, -Math.PI / 2); hp.rotation.z = side * 0.6; }
      sign([String(d.i % 2 + 1)], 2.4, 2.4, side * (X + 4), YARD_Y + 0.014, d.z - 1, 0, { w: 128, h: 128, bg: '#3b3d40', fg: '#d8dbdf' }).rotation.set(-Math.PI / 2, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      // the dock shelter and its lamp
      var sx = side * (X + 0.75); box(0.5, 0.6, DOCKS.w + 1.4, MAT.rubber, sx + side * 0.25, DOCKS.h + 0.5, d.z); box(1.0, DOCKS.h + 0.8, 0.5, MAT.rubber, sx, DOCKS.h / 2 + 0.4, d.z - DOCKS.w / 2 - 0.45); box(1.0, DOCKS.h + 0.8, 0.5, MAT.rubber, sx, DOCKS.h / 2 + 0.4, d.z + DOCKS.w / 2 + 0.45);
      plane(DOCKS.w + 1.4, 0.6, MAT.hazard, side * (X + 0.26), DOCKS.h + 0.5, d.z, 0, side > 0 ? Math.PI / 2 : -Math.PI / 2);
      box(0.08, 0.08, 0.6, MAT.steelDark, side * (X + 0.6), DOCKS.h + 1.0, d.z + DOCKS.w / 2 + 1.0); var lens = box(0.3, 0.2, 0.3, glowMat(0xfff2c0, 0.2), side * (X + 0.9), DOCKS.h + 0.95, d.z + DOCKS.w / 2 + 1.0); yard.lampLenses.push(lens);
    });
    // the fence: mesh panels between posts, with a sliding gate on each truck side and the gatehouse beside it
    function fenceRun(x0, z0, x1, z1) { var dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz), n = Math.round(len / 4), ang = Math.atan2(dx, dz); for (var i = 0; i <= n; i++) { var t = i / n, px = x0 + dx * t, pz = z0 + dz * t; cyl(0.05, 2.3, MAT.steelDark, px, YARD_Y + 1.15, pz, null, 6); box(0.24, 0.12, 0.24, MAT.grey, px, YARD_Y + 0.06, pz); cyl(0.06, 0.02, MAT.black, px, YARD_Y + 2.31, pz, null, 6); if (i < n) { var mp = plane(len / n, 2.1, MAT.mesh, x0 + dx * (t + 0.5 / n), YARD_Y + 1.1, z0 + dz * (t + 0.5 / n), 0, ang); mp.receiveShadow = false; } } box(Math.abs(dx) || 0.05, 0.05, Math.abs(dz) || 0.05, MAT.steelDark, (x0 + x1) / 2, YARD_Y + 2.25, (z0 + z1) / 2); }
    fenceRun(-84, -60, 84, -60); fenceRun(-84, 60, 84, 60);
    [-1, 1].forEach(function (side) {
      var gx = side * 84; fenceRun(gx, -60, gx, -11.5); fenceRun(gx, 3.5, gx, 60);
      // two barrier lanes, an island between them, and the gatehouse with the guard
      [[-8, 'IN'], [0, 'OUT']].forEach(function (lane) {
        var lz = lane[0], post = cyl(0.1, 1.2, MAT.steelDark, gx, YARD_Y + 0.6, lz + 3.2, null, 10); box(0.5, 0.9, 0.4, MAT.hazard, gx, YARD_Y + 0.45, lz + 3.2); box(0.3, 0.35, 0.3, MAT.steelDark, gx, YARD_Y + 1.1, lz + 3.2);
        var arm = new THREE.Group(); arm.userData.dynamic = true; arm.position.set(gx, YARD_Y + 1.05, lz + 3.0); scene.add(arm);
        var bar = box(0.1, 0.1, 6.2, MAT.white, 0, 0, -3.1, arm); for (var s = 0; s < 6; s += 2) box(0.102, 0.102, 0.95, MAT.red, 0, 0, -0.5 - s, arm); box(0.16, 0.6, 0.16, MAT.black, 0, -0.1, 0.1, arm); cyl(0.04, 0.5, MAT.steelDark, 0, -0.4, -5.9, arm, 8);
        yard.gates.push({ g: arm, side: side, z: lz, open: 0 });
        cyl(0.1, 1.2, MAT.steelDark, gx, YARD_Y + 0.6, lz - 3.2, null, 10); box(0.5, 0.9, 0.4, MAT.hazard, gx, YARD_Y + 0.45, lz - 3.2);
        for (var sb = 0; sb < 3; sb++) plane(1.6, 0.5, MAT.hazard, gx + side * (6 + sb * 2.5), YARD_Y + 0.013, lz, -Math.PI / 2);   // the speed bumps
        sign([lane[1]], 0.9, 0.5, gx + side * 2.5, YARD_Y + 2.6, lz, side > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 128, bg: '#1b232c', fg: '#f5b53d' }); cyl(0.04, 2.6, MAT.steelDark, gx + side * 2.5, YARD_Y + 1.3, lz - 0.5, null, 6);
      });
      box(0.6, 0.3, 4.2, MAT.grey, gx, YARD_Y + 0.15, -4); cyl(0.1, 1.0, MAT.yellow, gx, YARD_Y + 0.5, -2.2, null, 10); cyl(0.1, 1.0, MAT.yellow, gx, YARD_Y + 0.5, -5.8, null, 10);
      // the gatehouse: glazed on three sides, a counter, a door at the back, a roof with an overhang, the guard inside
      var hx = gx - side * 0.2, hz = 6.3;
      box(2.8, 0.2, 2.8, MAT.grey, hx, YARD_Y + 0.1, hz); box(2.8, 1.0, 0.12, MAT.plaster, hx, YARD_Y + 0.7, hz - 1.34); box(0.12, 1.0, 2.8, MAT.plaster, hx - side * 1.34, YARD_Y + 0.7, hz); box(0.12, 1.0, 2.8, MAT.plaster, hx + side * 1.34, YARD_Y + 0.7, hz); box(2.8, 2.6, 0.12, MAT.plaster, hx, YARD_Y + 1.5, hz + 1.34);
      [[0, -1.34, 0], [-1.34, 0, 1], [1.34, 0, 1]].forEach(function (wl) { var gl = box(wl[2] ? 0.04 : 2.6, 1.3, wl[2] ? 2.6 : 0.04, MAT.glass, hx + (wl[2] ? wl[0] * side : 0), YARD_Y + 1.85, hz + wl[1], null); gl.userData.noBake = true; });
      [[0, -1.34, 0], [-1.34, 0, 1], [1.34, 0, 1]].forEach(function (wl) { for (var c = -0.9; c <= 0.9; c += 0.9) cyl(0.025, 1.3, MAT.steelDark, hx + (wl[2] ? wl[0] * side : c), YARD_Y + 1.85, hz + (wl[2] ? c : wl[1]), null, 6); });
      [[-1.34, -1.34], [1.34, -1.34], [-1.34, 1.34], [1.34, 1.34]].forEach(function (cn) { box(0.12, 2.8, 0.12, MAT.steelDark, hx + cn[0] * side, YARD_Y + 1.4, hz + cn[1]); });
      box(3.6, 0.16, 3.6, MAT.roof, hx, YARD_Y + 2.88, hz); box(3.4, 0.08, 3.4, MAT.steelDark, hx, YARD_Y + 2.98, hz); box(0.9, 2.1, 0.08, MAT.steelDark, hx, YARD_Y + 1.05, hz + 1.36); box(0.08, 0.03, 0.14, MAT.chrome, hx + 0.3, YARD_Y + 1.05, hz + 1.42);
      box(2.2, 0.06, 0.5, MAT.wood, hx, YARD_Y + 1.1, hz - 0.9); box(0.3, 0.25, 0.04, MAT.black, hx - side * 0.5, YARD_Y + 1.28, hz - 0.95); box(0.12, 0.2, 0.06, MAT.black, hx + side * 0.6, YARD_Y + 1.25, hz - 0.9); cyl(0.04, 0.09, MAT.white, hx, YARD_Y + 1.17, hz - 0.8, null, 10);
      box(0.9, 0.04, 0.5, MAT.hazard, hx, YARD_Y + 3.1, hz - 1.6); var gl2 = box(0.25, 0.25, 0.25, glowMat(0xffa000, 0.8), hx, YARD_Y + 3.25, hz - 1.6); yard.lampLenses.push(gl2);
      sign(['GATE ' + (side < 0 ? 'WEST' : 'EAST')], 1.8, 0.4, hx, YARD_Y + 2.6, hz - 1.42, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' });
      sign(['STOP', 'REPORT TO THE GATE'], 1.0, 1.0, gx + side * 10, YARD_Y + 2.2, -4, side > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#c8342a', fg: '#fff', size: 52 }); cyl(0.04, 2.2, MAT.steelDark, gx + side * 10, YARD_Y + 1.1, -4, null, 6);
      var guard = makeHuman({ vest: MAT.hivis, cap: true, capMat: MAT.black, shirt: MAT.jeans }); guard.position.set(hx, YARD_Y, hz - 0.2); guard.rotation.y = Math.PI; scene.add(guard); yard.guards.push({ g: guard, side: side });
    });
    // the staff car park, the smoking shelter, the dumpster, the flag
    for (var b = 0; b < 7; b++) plane(0.12, 5.5, MAT.whiteLine, -19 + b * 2.7, YARD_Y + 0.012, 21, -Math.PI / 2);
    plane(16.2, 0.12, MAT.whiteLine, -10.9, YARD_Y + 0.012, 18.25, -Math.PI / 2);
    [0, 1, 3, 4].forEach(function (k) { var c = carMesh(CAR_COLS[k % CAR_COLS.length]); c.position.set(-17.65 + k * 2.7, YARD_Y, 21.5); c.rotation.y = Math.PI / 2 + randf(-0.04, 0.04); scene.add(c); });
    cyl(0.04, 2.4, MAT.steelDark, -2, YARD_Y + 1.2, 18.5, null, 6); sign(['STAFF', 'PARKING'], 0.9, 0.6, -2, YARD_Y + 2.5, 18.5, 0, { w: 256, h: 160, bg: '#2c5f9e', fg: '#fff' });
    [[-24, 17], [-24, 21], [-21, 17], [-21, 21]].forEach(function (p) { cyl(0.05, 2.4, MAT.steelDark, p[0], YARD_Y + 1.2, p[1], null, 6); });
    box(3.6, 0.06, 4.6, MAT.glass, -22.5, YARD_Y + 2.45, 19); for (var sl = 0; sl < 4; sl++) box(1.8, 0.04, 0.07, MAT.wood, -22.5, YARD_Y + 0.45, 20.46 + sl * 0.09); box(1.8, 0.04, 0.3, MAT.wood, -22.5, YARD_Y + 0.85, 20.76).rotation.x = -0.2; cyl(0.1, 0.5, MAT.steelDark, -21.0, YARD_Y + 0.25, 18.2, null, 10); cyl(0.11, 0.03, std({ color: 0x8a8a8a, roughness: 0.5 }), -21.0, YARD_Y + 0.52, 18.2, null, 10); [[-23.2], [-21.8]].forEach(function (p) { box(0.06, 0.45, 0.4, MAT.steelDark, p[0], YARD_Y + 0.22, 20.6); });
    cyl(0.12, 0.9, MAT.steelDark, -24.3, YARD_Y + 0.45, 17.4, null, 10); sign(['SMOKING', 'AREA'], 0.8, 0.5, -22.5, YARD_Y + 2.2, 16.8, 0, { w: 256, h: 160, bg: '#1b232c', fg: '#a0acb8' });
    box(1.8, 1.3, 1.2, std({ color: 0x2f5a3a, roughness: 0.7, metalness: 0.3 }), 24, YARD_Y + 0.65, 18); var dl = box(1.9, 0.08, 1.3, MAT.black, 24, YARD_Y + 1.33, 18); dl.rotation.x = -0.35; dl.position.z = 17.8; dl.position.y = YARD_Y + 1.52; [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]].forEach(function (w) { cyl(0.08, 0.06, MAT.black, 24 + w[0], YARD_Y + 0.08, 18 + w[1], null, 10).rotation.z = Math.PI / 2; }); box(0.1, 0.1, 0.4, MAT.steelDark, 23.05, YARD_Y + 0.9, 18); box(0.1, 0.1, 0.4, MAT.steelDark, 24.95, YARD_Y + 0.9, 18); sign(['CARDBOARD', 'ONLY'], 1.2, 0.5, 24, YARD_Y + 0.9, 17.38, Math.PI, { w: 256, h: 128, bg: '#2f5a3a', fg: '#fff' });
    cyl(0.05, 9, MAT.chrome, 10, YARD_Y + 4.5, 19, null, 8, 0.07); sphere(0.1, MAT.yellow, 10, YARD_Y + 9.05, 19);
    var fg = new THREE.Group(); fg.position.set(10, YARD_Y + 8.3, 19); scene.add(fg); yard.flag = fg;
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 8, 2), new THREE.MeshStandardMaterial({ map: textTex(['DEPOT CO.'], { w: 256, h: 160, bg: '#f5b53d', fg: '#1b232c' }), side: THREE.DoubleSide, roughness: 0.9 })); flag.position.set(0.82, 0, 0); fg.add(flag); yard.flagMesh = flag;
    for (var t = -56; t <= 56; t += 14) { tree(t, -56, randf(0.8, 1.2)); tree(t + 7, 56, randf(0.8, 1.2)); }
    tree(-30, 24, 1.1); tree(30, 26, 0.9);
    // the neighbours across the fence, each with its own dock doors and a name
    [[-130, -30, 40, 9, 32, 'NORTHGATE LOGISTICS', 0], [128, -24, 44, 8, 30, 'VOLT & CO. DISTRIBUTION', 0], [-118, 70, 34, 7, 26, 'FAIRLANE FREIGHT', 1], [0, 150, 90, 12, 40, 'KESSLER WHOLESALE', 1], [136, 82, 40, 10, 30, 'PINECREST STORAGE', 1], [-44, -124, 50, 9, 28, 'LITTLE WONDERS DC', 0]].forEach(function (b) {
      box(b[2], b[3], b[4], MAT.wall, b[0], YARD_Y + b[3] / 2, b[1]);
      var face = b[6] ? -1 : 1, fz = b[1] - face * (b[4] / 2 + 0.05), fry = b[6] ? Math.PI : 0;
      for (var d = -b[2] / 2 + 6; d < b[2] / 2 - 4; d += 8) { var dr = plane(3.6, 4.2, MAT.door, b[0] + d, YARD_Y + 2.1, fz, 0, fry); dr.receiveShadow = false; }
      sign([b[5]], b[2] * 0.7, b[2] * 0.09, b[0], YARD_Y + b[3] - 1.2, fz, fry, { w: 1024, h: 128, bg: '#2a2f36', fg: '#d8dbdf' });
      for (var u = 0; u < 3; u++) box(2.5, 1.2, 2.5, MAT.grey, b[0] - b[2] / 3 + u * b[2] / 3, YARD_Y + b[3] + 0.6, b[1] + randf(-3, 3));
      box(b[2] + 0.4, 0.5, b[4] + 0.4, MAT.steelDark, b[0], YARD_Y + b[3] + 0.2, b[1]); box(b[2] * 0.3, 3.2, 0.3, MAT.brick, b[0] + b[2] * 0.3, YARD_Y + 1.6, fz - face * 0.1);
      for (var wn = -b[2] / 2 + 2; wn < b[2] / 2 - 2; wn += 3) { var wp = plane(1.6, 1.0, MAT.glass, b[0] + wn, YARD_Y + b[3] - 2.2, fz - face * 0.02, 0, fry); wp.userData.noBake = true; }
      var dr2 = plane(1.0, 2.1, MAT.door, b[0] + b[2] * 0.3, YARD_Y + 1.05, fz - face * 0.12, 0, fry); dr2.receiveShadow = false; box(0.3, 0.1, 0.3, MAT.steelDark, b[0] + b[2] * 0.3, YARD_Y + 2.5, fz - face * 0.3); var nl = box(0.3, 0.08, 0.2, glowMat(0xfff2c0, 0.2), b[0] + b[2] * 0.3, YARD_Y + 2.42, fz - face * 0.4); yard.lampLenses.push(nl);
      for (var bo = -b[2] / 2 + 3; bo < b[2] / 2; bo += 6) cyl(0.12, 1.0, MAT.yellow, b[0] + bo, YARD_Y + 0.5, fz - face * 1.2, null, 8);
    });
    // the road: two lanes, dashes, kerbs, lamp posts, and the traffic that uses it
    plane(260, 11, MAT.yard, 0, YARD_Y + 0.01, 75, -Math.PI / 2); box(260, 0.15, 0.3, MAT.grey, 0, YARD_Y + 0.07, 69.4); box(260, 0.15, 0.3, MAT.grey, 0, YARD_Y + 0.07, 80.6);
    for (var i = -120; i < 120; i += 6) plane(3, 0.2, MAT.whiteLine, i, YARD_Y + 0.02, 75, -Math.PI / 2);
    for (var lp = -110; lp <= 110; lp += 28) { cyl(0.06, 7, MAT.steelDark, lp, YARD_Y + 3.5, 81.5, null, 8, 0.09); box(0.08, 0.08, 1.4, MAT.steelDark, lp, YARD_Y + 6.9, 80.8); var ll = box(0.5, 0.14, 0.32, glowMat(0xfff2c0, 0.2), lp, YARD_Y + 6.85, 80.2); yard.lampLenses.push(ll); }
    for (var c = 0; c < 8; c++) { var cm = carMesh(pick(CAR_COLS)); var dir = c % 2 ? -1 : 1; cm.position.set(randf(-120, 120), YARD_Y, dir > 0 ? 72.5 : 77.5); cm.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(cm); yard.traffic.push({ g: cm, dir: dir, v: randf(9, 14) }); }
    // the sky: a sun, a moon, clouds; the weather: puddles, rain, snow
    var sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(255,244,214,1)'), transparent: true, depthWrite: false, fog: false })); sunSp.scale.set(26, 26, 1); scene.add(sunSp); yard.sunDisc = sunSp;
    var moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex('rgba(225,230,240,0.9)'), transparent: true, depthWrite: false, fog: false })); moonSp.scale.set(12, 12, 1); scene.add(moonSp); yard.moon = moonSp;
    var ct = cloudTex();
    for (var k = 0; k < 10; k++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, opacity: 0.85, fog: false })); var s = randf(50, 90); sp.scale.set(s, s * 0.5, 1); sp.position.set(randf(-200, 200), randf(70, 100), randf(-200, 200)); scene.add(sp); yard.clouds.push({ sp: sp, v: randf(0.6, 1.4) }); }
    for (var p = 0; p < 12; p++) { var pm = new THREE.Mesh(new THREE.CircleGeometry(randf(1.2, 3.2), 18), std({ color: 0x151a22, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0 })); pm.rotation.x = -Math.PI / 2; pm.position.set(randf(-70, 70), YARD_Y + 0.02, randf(-50, 50)); pm.scale.x = randf(1, 2.2); scene.add(pm); yard.puddles.push(pm); }
    var streak = tex(16, 64, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(210,225,240,0)'); g.addColorStop(0.5, 'rgba(210,225,240,0.9)'); g.addColorStop(1, 'rgba(210,225,240,0)'); c.fillStyle = g; c.fillRect(6, 0, 4, h); });
    var flake = tex(32, 32, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    var mkPoints = function (n, size, map, range) { var geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3); for (var i = 0; i < n; i++) { pos[i * 3] = randf(-range, range); pos[i * 3 + 1] = randf(0, 16); pos[i * 3 + 2] = randf(-range, range); } geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); var pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: map, size: size, transparent: true, opacity: 0.85, depthWrite: false, alphaTest: 0.05 })); pts.visible = false; pts.frustumCulled = false; scene.add(pts); return pts; };
    yard.rain = mkPoints(6000, 0.55, streak, 24); yard.snow = mkPoints(3000, 0.22, flake, 30);
  }

  function tickYard(dt) {
    yard.windT += dt;
    // gates slide open while a truck is coming in or going out on that side
    yard.gates.forEach(function (g) { var want = S.trucks.some(function (t) { return t.side === g.side && Math.abs(t.z - g.z) < 2 && (t.state === 'coming' || t.state === 'leaving') && Math.abs(t.x) > 62 && Math.abs(t.x) < 100; }) ? 1 : 0; var was = g.open; g.open = lerp(g.open, want, 1 - Math.pow(0.03, dt)); if (want && was < 0.05 && g.open >= 0.05) sfx('gate'); g.g.rotation.x = -g.open * 1.35; });
    yard.guards.forEach(function (gd) { var near = dist2(player.x, player.z, gd.g.position.x, gd.g.position.z) < 64; animateHuman(gd.g, dt, 'idle', 0, near ? { x: player.x, y: player.y + 1.6, z: player.z } : null, false); });
    yard.traffic.forEach(function (c) { c.g.position.x += c.dir * c.v * dt; if (c.g.position.x > 130) c.g.position.x = -130; if (c.g.position.x < -130) c.g.position.x = 130; });
    if (yard.flagMesh) { var w = S.weather ? S.weather.wind : 0.4; yard.flag.rotation.y = Math.sin(yard.windT * 0.7) * 0.3 * w; var pos = yard.flagMesh.geometry.attributes.position; for (var i = 0; i < pos.count; i++) { var x = pos.getX(i); pos.setZ(i, Math.sin(yard.windT * 4 + x * 3) * 0.08 * (0.3 + w) * x); } pos.needsUpdate = true; }
    yard.clouds.forEach(function (c) { c.sp.position.x += c.v * dt * (S.weather ? 0.5 + S.weather.wind : 1); if (c.sp.position.x > 240) c.sp.position.x = -240; });
    // the sun and the moon ride opposite each other
    if (yard.sunDisc) { _v.copy(sun.position).normalize(); yard.sunDisc.position.copy(_v).multiplyScalar(200).add(camera.position); yard.sunDisc.material.opacity = clamp(_v.y * 4, 0, 1); yard.moon.position.copy(_v).multiplyScalar(-200).add(camera.position); yard.moon.position.y = Math.abs(yard.moon.position.y - camera.position.y) + camera.position.y + 20; yard.moon.material.opacity = clamp(-_v.y * 3 + 0.4, 0, 0.9); }
    // weather
    var W = S.weather || { kind: 'clear', wet: 0, snow: 0, wind: 0.4 };
    var raining = W.kind === 'rain' || W.kind === 'storm', snowing = W.kind === 'snow';
    yard.rain.visible = raining; yard.snow.visible = snowing;
    if (raining) { var p = yard.rain.geometry.attributes.position.array, px = player.x, pz = player.z; for (var r = 0; r < p.length; r += 3) { p[r + 1] -= (9 + (W.kind === 'storm' ? 4 : 0)) * dt; var inHall = Math.abs(p[r]) < HALL.x && Math.abs(p[r + 2]) < HALL.z, roofY = inHall ? HALL.h + 0.3 : YARD_Y; if (!inHall) for (var tk = 0; tk < S.trucks.length; tk++) { var tb = trailerBounds(S.trucks[tk]); if (p[r] > tb.x0 - 3.5 && p[r] < tb.x1 + 3.5 && p[r + 2] > tb.z0 - 0.4 && p[r + 2] < tb.z1 + 0.4) { roofY = TRAILER.h + 0.1; break; } } if (p[r + 1] < roofY || Math.abs(p[r] - px) > 26 || Math.abs(p[r + 2] - pz) > 26) { p[r] = px + randf(-24, 24); p[r + 1] = randf(6, 16); p[r + 2] = pz + randf(-24, 24); } } yard.rain.geometry.attributes.position.needsUpdate = true; }
    if (snowing) { var q = yard.snow.geometry.attributes.position.array, qx = player.x, qz = player.z; for (var s = 0; s < q.length; s += 3) { q[s + 1] -= 1.3 * dt; q[s] += Math.sin(yard.windT + s) * 0.4 * dt; var inH = Math.abs(q[s]) < HALL.x && Math.abs(q[s + 2]) < HALL.z; if (q[s + 1] < (inH ? HALL.h + 0.3 : YARD_Y) || Math.abs(q[s] - qx) > 32 || Math.abs(q[s + 2] - qz) > 32) { q[s] = qx + randf(-30, 30); q[s + 1] = randf(6, 16); q[s + 2] = qz + randf(-30, 30); } } yard.snow.geometry.attributes.position.needsUpdate = true; }
    yard.puddles.forEach(function (pm) { pm.material.opacity = W.wet * 0.85; });
    var snowCol = 0xdfe4e9; MAT.yard.color.setHex(0xffffff).lerp(new THREE.Color(snowCol), W.snow * 0.9); MAT.grass.color.setHex(0xffffff).lerp(new THREE.Color(0xf4f6f8), W.snow);
    var overcast = raining ? 0.75 : snowing ? 0.6 : W.kind === 'overcast' ? 0.5 : 0;
    yard.clouds.forEach(function (c) { c.sp.material.color.setScalar(1 - overcast * 0.55); c.sp.material.opacity = 0.5 + overcast * 0.5; });
  }
