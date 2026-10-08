//@ the yard outside: ground, truck lanes, dock shelters, the fence and its gates, the car park, neighbours, the road and its traffic, puddles and snow on the ground
  // ── The yard ──────────────────────────────────────────────────────
  var yard = { gates: [], guards: [], traffic: [], puddles: [], flag: null, lampLenses: [], windT: 0 };   // the sky and the weather are the engine's
  function side_(s) { return s < 0 ? -1 : 1; }

  function buildYard() {
    var X = HALL.x, Z = HALL.z, F = STAGE.fence, big = BOOT_STAGE >= 2;   // 1.21.0: the yard is the stage's: its slab, its fence, its lanes; the car park, the road and the neighbours come with the stages that have them
    // the ground: grass to the horizon, the asphalt yard, the plinth the hall stands on, a lighter apron round it
    plane(600, 600, MAT.grass, 0, YARD_Y - 0.03, 0, -Math.PI / 2);
    plane(big ? 170 : 2 * F.x + 2, big ? 140 : F.z1 - F.z0 + 2, MAT.yard, 0, YARD_Y, big ? -8 : (F.z0 + F.z1) / 2, -Math.PI / 2);
    box(2 * X + 0.6, 1.2, 2 * Z + 0.6, MAT.grey, 0, YARD_Y + 0.6, 0);
    // street furniture in the slab: manhole covers, gully grates against the plinth, a kerb round the car park, wheel stops in the bays, weeds along the fence
    var IRON = std({ color: 0x2c2e31, roughness: 0.6, metalness: 0.5 });
    [[-30, -22], [8, 30], [34, 10], [-40, 26], [22, -30], [-10, 36]].filter(function (p) { return Math.abs(p[0]) < F.x - 2 && p[1] > F.z0 + 2 && p[1] < F.z1 - 2 && !(Math.abs(p[0]) < X + 1 && Math.abs(p[1]) < Z + 1); }).forEach(function (p) { cyl(0.42, 0.02, IRON, p[0], YARD_Y + 0.012, p[1], null, 20); var ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.02, 6, 24), MAT.grey); ring.rotation.x = Math.PI / 2; ring.position.set(p[0], YARD_Y + 0.012, p[1]); scene.add(ring); for (var mb = 0; mb < 2; mb++) box(0.06, 0.012, 0.3, MAT.black, p[0] + (mb ? 0.18 : -0.18), YARD_Y + 0.03, p[1]); });
    [[-X - 1.0, -11], [-X - 1.0, 11], [X + 1.0, -11], [X + 1.0, 11], [0, Z + 1.0], [-10, Z + 1.0], [10, -Z - 1.0]].forEach(function (p) { box(0.5, 0.02, 0.35, IRON, p[0], YARD_Y + 0.012, p[1]); for (var gb = 0; gb < 6; gb++) box(0.5, 0.012, 0.025, MAT.black, p[0], YARD_Y + 0.03, p[1] - 0.14 + gb * 0.056); plane(1.2, 0.8, std({ color: 0x1e2024, roughness: 0.9, transparent: true, opacity: 0.35 }), p[0], YARD_Y + 0.011, p[1], -Math.PI / 2); });
    if (stageHas('carpark')) { box(13.6, 0.12, 0.25, MAT.grey, -23.6, YARD_Y + 0.06, 34.6); box(0.25, 0.12, 6.2, MAT.grey, -30.5, YARD_Y + 0.06, 31.5); [0, 1, 2, 3, 4].forEach(function (k) { box(1.6, 0.1, 0.18, MAT.yellow, -27.65 + k * 2.7, YARD_Y + 0.05, 33.4); }); }
    var WEED = std({ color: 0x5d7a3a, roughness: 1, flatShading: true }); for (var wd = -F.x + 14; wd <= F.x - 14; wd += randf(2.5, 5)) { var wg = new THREE.Mesh(new THREE.IcosahedronGeometry(randf(0.15, 0.35), 0), WEED); wg.position.set(wd, YARD_Y + 0.08, F.z1 - 3.4 + randf(-0.3, 0.3)); wg.scale.y = 0.6; scene.add(wg); }
    buildSky({ y: YARD_Y });   // the dome, the sun and the moon, the clouds, the rain and the snow (Co Engine 26-weather)
    // the steps go on the side with room: IN 1's and OUT 3's north, the rest south, and OUT 1 has none (shelters on both sides)
    var ST = std({ map: TEX.plaster, color: 0x9a9890, roughness: 0.95 }), HR = std({ color: 0xf5b53d, roughness: 0.5, metalness: 0.4 });   // the steps' render and the handrails' paint, shared by every dock (a pair a dock was a draw a dock)
    function yardDock(d) {
      // the steps: 6 risers from the yard to the landing at hall level, outside the dock door on its +z side, with a tube handrail
      var fz = dockStepSide(d.i), sx = side_(d.side);
      if (yard.apron) yard.apron(d);   // the tyre marks and oil on the apron: set below after the boot doors are painted, so only a dock built mid-game takes this path
      if (d.i !== 2) { for (var st = 0; st < 6; st++) { box(1.1, 0.2, (6 - st) * 0.3, ST, sx * (X + 0.85), YARD_Y + 0.1 + st * 0.2, d.z + fz * 4.4 + (6 - st) * 0.15); }
      box(1.1, 1.2, 1.6, ST, sx * (X + 0.85), YARD_Y + 0.6, d.z + fz * 3.6);
      [-0.5, 0.5].forEach(function (hx) { var px = sx * (X + 0.85 + hx); cyl(0.025, 1.0, HR, px, YARD_Y + 1.7, d.z + fz * 3.0, null, 8); cyl(0.025, 1.0, HR, px, YARD_Y + 1.7, d.z + fz * 4.3, null, 8); cyl(0.025, 1.0, HR, px, YARD_Y + 0.5, d.z + fz * 6.1, null, 8); var rail = cyl(0.025, 1.5, HR, px, YARD_Y + 2.2, d.z + fz * 3.65, null, 8); rail.rotation.x = Math.PI / 2; var rail2 = cyl(0.025, 2.2, HR, px, YARD_Y + 1.6, d.z + fz * 5.2, null, 8); rail2.rotation.x = Math.PI / 2 + 0.58 * fz; });
      solid(sx * (X + 0.3), sx * (X + 1.4), d.z + fz * 2.8, d.z + fz * 6.3, YARD_Y, YARD_Y + 1.3); }
      var side = d.side, x0 = side * (X + 1), x1 = side * (F.x - 8), cx = (x0 + x1) / 2, len = Math.abs(x1 - x0);
      plane(len, 0.15, MAT.whiteLine, cx, YARD_Y + 0.012, d.z - 2.2, -Math.PI / 2); plane(len, 0.15, MAT.whiteLine, cx, YARD_Y + 0.012, d.z + 2.2, -Math.PI / 2);
      for (var x = side * (X + 8); Math.abs(x) < F.x - 10; x += side * 4) plane(2, 0.12, MAT.whiteLine, x, YARD_Y + 0.012, d.z, -Math.PI / 2);
      for (var k = 0; k < 6; k++) { var hp = plane(5, 0.14, MAT.yellowLine, side * (X + 3.5), YARD_Y + 0.013, d.z - 2 + k * 0.8, -Math.PI / 2); hp.rotation.z = side * 0.6; }
      sign([DOOR_MAP[d.i].dir === 'ret' ? 'R' : String(DOOR_MAP[d.i].dock + 1)], 2.4, 2.4, side * (X + 4), YARD_Y + 0.014, d.z - 1, 0, { w: 128, h: 128, bg: '#3b3d40', fg: '#d8dbdf' }).rotation.set(-Math.PI / 2, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2);
      // the dock shelter and its lamp
      var sx = side * (X + 0.75); box(0.5, 0.6, DOCKS.w + 1.4, MAT.rubber, sx + side * 0.25, DOCKS.h + 0.5, d.z); box(1.0, DOCKS.h + 0.8, 0.5, MAT.rubber, sx, DOCKS.h / 2 + 0.4, d.z - DOCKS.w / 2 - 0.45); box(1.0, DOCKS.h + 0.8, 0.5, MAT.rubber, sx, DOCKS.h / 2 + 0.4, d.z + DOCKS.w / 2 + 0.45);
      plane(DOCKS.w + 1.4, 0.6, MAT.hazard, side * (X + 1.26), DOCKS.h + 0.5, d.z, 0, side > 0 ? Math.PI / 2 : -Math.PI / 2);
      box(0.08, 0.08, 0.6, MAT.steelDark, side * (X + 0.6), DOCKS.h + 1.0, d.z + DOCKS.w / 2 + 1.0); var lens = box(0.3, 0.2, 0.3, glowMat(0xfff2c0, 0.2), side * (X + 0.9), DOCKS.h + 0.95, d.z + DOCKS.w / 2 + 1.0); yard.lampLenses.push(lens);
      var dl2 = new THREE.PointLight(0xfff2c0, 0, 16, 2); dl2.position.set(side * (X + 2.2), DOCKS.h + 0.5, d.z + 0.8); dl2.userData.k = 1.0; scene.add(dl2); yardLights.push(dl2);   // the apron under the shelter lamp is lit at night
    }
    yard.dock = yardDock; doors.forEach(yardDock);
    // the fence: mesh panels between posts, with a sliding gate on each truck side and the gatehouse beside it
    var FPOST = std({ color: 0x2f5d3a, roughness: 0.5, metalness: 0.5 }), FMESH = std({ map: TEX.vmesh, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0x3d6b48 }), FCONC = std({ map: TEX.plaster, color: 0x9a9890, roughness: 0.95 }), FWIRE = std({ color: 0x8e949a, roughness: 0.4, metalness: 0.8 });
    function fenceRun(x0, z0, x1, z1) {
      // ang turns a y-axis cylinder laid along z onto the run (the wires); rot turns an x-long box or plane onto it (panels, rails, boards). They differ by a quarter turn, and the panels used to take the wrong one and stand across the line
      var dx = x1 - x0, dz = z1 - z0, len = Math.sqrt(dx * dx + dz * dz), n = Math.round(len / 3), ang = Math.atan2(dx, dz), ux = dx / len, uz = dz / len, nx = uz, nz = -ux, rot = Math.atan2(-uz, ux);
      for (var i = 0; i <= n; i++) {
        var t = i / n, px = x0 + dx * t, pz = z0 + dz * t;
        box(0.08, 2.5, 0.08, FPOST, px, YARD_Y + 1.25, pz); box(0.3, 0.25, 0.3, FCONC, px, YARD_Y + 0.12, pz); box(0.12, 0.03, 0.12, FPOST, px, YARD_Y + 2.52, pz);
        var arm = box(0.04, 0.6, 0.04, FPOST, px + nx * 0.2, YARD_Y + 2.72, pz + nz * 0.2); arm.rotation.set(0, ang, -0.7, 'YXZ'); arm.position.y += 0.1;
        if (i < n) {
          var mx = x0 + dx * (t + 0.5 / n), mz = z0 + dz * (t + 0.5 / n), seg = len / n;
          var mp = plane(seg - 0.1, 2.2, FMESH, mx, YARD_Y + 1.35, mz, 0, rot); mp.receiveShadow = false;
          [0.75, 1.65].forEach(function (vy) { var fold = box(seg - 0.1, 0.06, 0.03, FPOST, mx, YARD_Y + vy, mz); fold.rotation.y = rot; });
          var gb = box(seg, 0.3, 0.05, FCONC, mx, YARD_Y + 0.15, mz); gb.rotation.y = rot; var tr = box(seg, 0.03, 0.03, FPOST, mx, YARD_Y + 2.46, mz); tr.rotation.y = rot; var br = box(seg, 0.03, 0.03, FPOST, mx, YARD_Y + 0.32, mz); br.rotation.y = rot;
        }
      }
      solid(Math.min(x0, x1) - 0.06, Math.max(x0, x1) + 0.06, Math.min(z0, z1) - 0.06, Math.max(z0, z1) + 0.06, YARD_Y, YARD_Y + 2.6);   // the fence is a fence: nobody walks through it
      [0, 1, 2].forEach(function (k) { var wy = YARD_Y + 2.62 + k * 0.17, wo = 0.22 + k * 0.14; var wire = cyl(0.006, len, FWIRE, (x0 + x1) / 2 + nx * wo, wy, (z0 + z1) / 2 + nz * wo, null, 4); wire.rotation.x = Math.PI / 2; wire.rotation.z = 0; wire.rotation.order = 'YXZ'; wire.rotation.y = ang; });
    }
    // the fence, the stage's: a run on each side with a gap where every truck lane goes through (the van's lane too, in the shed's yard),
    // and from the small hall on a barrier lane per dock with its gatehouse and guard. The lane gaps come from the dock lists, so a
    // dock the stage has not built yet has no hole in the fence waiting for it.
    fenceRun(-F.x, F.z0, F.x, F.z0); fenceRun(-F.x, F.z1, F.x, F.z1);
    function laneGaps(side) {
      var zs = (side < 0 ? DOCKS.in : DOCKS.out.concat(DOCKS.ret)).map(function (d) { return d.z; }); if (side < 0 && TRUCK_OUT[0] && TRUCK_OUT[0].van) zs.push(VAN.z);
      var gaps = zs.sort(function (a, b) { return a - b; }).map(function (z) { return [z - 3.6, z + 3.6]; }), out = [];
      gaps.forEach(function (g) { var last = out[out.length - 1]; if (last && g[0] <= last[1] + 0.1) last[1] = Math.max(last[1], g[1]); else out.push(g.slice()); });   /* lanes 8 m apart share one gap, as the two IN docks always did */
      return out;
    }
    [-1, 1].forEach(function (side) {
      var gx = side * F.x, z = F.z0; laneGaps(side).forEach(function (g) { if (g[0] > z) fenceRun(gx, z, gx, g[0]); solid(gx - 0.5, gx + 0.5, g[0], g[1], YARD_Y, YARD_Y + 1.1); z = g[1]; }); if (z < F.z1) fenceRun(gx, z, gx, F.z1);   // a waist-high bar keeps you in where the fence is open
      if (!stageHas('gates')) return;
      // a barrier lane on every dock line (the first two at most), an island between two, and the gatehouse with the guard
      var lanes = (side < 0 ? DOCKS.in : DOCKS.out).filter(function (d) { return Math.abs(d.z) < Z - 1; }).slice(0, 2);
      lanes.forEach(function (d, li) {
        var lz = d.z, post = cyl(0.1, 1.2, MAT.steelDark, gx, YARD_Y + 0.6, lz + 3.2, null, 10); box(0.5, 0.9, 0.4, MAT.hazard, gx, YARD_Y + 0.45, lz + 3.2); box(0.3, 0.35, 0.3, MAT.steelDark, gx, YARD_Y + 1.1, lz + 3.2);
        var arm = new THREE.Group(); arm.userData.dynamic = true; arm.position.set(gx, YARD_Y + 1.05, lz + 3.0); scene.add(arm);
        var bar = box(0.1, 0.1, 6.2, MAT.white, 0, 0, -3.1, arm); for (var s = 0; s < 6; s += 2) box(0.102, 0.102, 0.95, MAT.red, 0, 0, -0.5 - s, arm); box(0.16, 0.6, 0.16, MAT.black, 0, -0.1, 0.1, arm); cyl(0.04, 0.5, MAT.steelDark, 0, -0.4, -5.9, arm, 8);
        yard.gates.push({ g: arm, side: side, z: lz, open: 0 });
        cyl(0.1, 1.2, MAT.steelDark, gx, YARD_Y + 0.6, lz - 3.2, null, 10); box(0.5, 0.9, 0.4, MAT.hazard, gx, YARD_Y + 0.45, lz - 3.2);
        for (var sb = 0; sb < 3; sb++) plane(1.6, 0.5, MAT.hazard, gx + side * (6 + sb * 2.5), YARD_Y + 0.013, lz, -Math.PI / 2);   // the speed bumps
        sign([(side < 0 ? 'DOCK ' : 'OUT ') + (li + 1)], 0.9, 0.5, gx + side * 2.5, YARD_Y + 2.6, lz, side > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 128, bg: '#1b232c', fg: '#f5b53d' }); cyl(0.04, 2.6, MAT.steelDark, gx + side * 2.5, YARD_Y + 1.3, lz - 0.5, null, 6);
      });
      if (lanes.length > 1) { var iz = (lanes[0].z + lanes[1].z) / 2; box(0.6, 0.3, 2.0, MAT.grey, gx, YARD_Y + 0.15, iz); cyl(0.1, 1.0, MAT.yellow, gx, YARD_Y + 0.5, iz + 0.8, null, 10); cyl(0.1, 1.0, MAT.yellow, gx, YARD_Y + 0.5, iz - 0.8, null, 10); }
      // the gatehouse: glazed on three sides, a counter, a door at the back, a roof with an overhang, the guard inside; inside the fence line, clear of its posts
      var hx = gx - side * 1.6, hz = Math.min(6.3, F.z1 - 6); solid(hx - 1.45, hx + 1.45, hz - 1.45, hz + 1.45, YARD_Y, YARD_Y + 3);
      box(2.8, 0.2, 2.8, MAT.grey, hx, YARD_Y + 0.1, hz); box(2.8, 1.0, 0.12, MAT.plaster, hx, YARD_Y + 0.7, hz - 1.34); box(0.12, 1.0, 2.8, MAT.plaster, hx - side * 1.34, YARD_Y + 0.7, hz); box(0.12, 1.0, 2.8, MAT.plaster, hx + side * 1.34, YARD_Y + 0.7, hz); box(2.8, 2.6, 0.12, MAT.plaster, hx, YARD_Y + 1.5, hz + 1.34);
      [[0, -1.34, 0], [-1.34, 0, 1], [1.34, 0, 1]].forEach(function (wl) { var gl = box(wl[2] ? 0.04 : 2.6, 1.3, wl[2] ? 2.6 : 0.04, MAT.glass, hx + (wl[2] ? wl[0] * side : 0), YARD_Y + 1.85, hz + wl[1], null); gl.userData.noBake = true; });
      [[0, -1.34, 0], [-1.34, 0, 1], [1.34, 0, 1]].forEach(function (wl) { for (var c = -0.9; c <= 0.9; c += 0.9) cyl(0.025, 1.3, MAT.steelDark, hx + (wl[2] ? wl[0] * side : c), YARD_Y + 1.85, hz + (wl[2] ? c : wl[1]), null, 6); });
      [[-1.34, -1.34], [1.34, -1.34], [-1.34, 1.34], [1.34, 1.34]].forEach(function (cn) { box(0.12, 2.8, 0.12, MAT.steelDark, hx + cn[0] * side, YARD_Y + 1.4, hz + cn[1]); });
      box(3.6, 0.16, 3.6, MAT.roof, hx, YARD_Y + 2.88, hz); box(3.4, 0.08, 3.4, MAT.steelDark, hx, YARD_Y + 2.98, hz); box(0.9, 2.1, 0.08, MAT.steelDark, hx, YARD_Y + 1.05, hz + 1.38); box(0.08, 0.03, 0.14, MAT.chrome, hx + 0.3, YARD_Y + 1.05, hz + 1.42);
      box(2.2, 0.06, 0.5, MAT.wood, hx, YARD_Y + 1.1, hz - 0.9); box(0.3, 0.25, 0.04, MAT.black, hx - side * 0.5, YARD_Y + 1.28, hz - 0.95); box(0.12, 0.2, 0.06, MAT.black, hx + side * 0.6, YARD_Y + 1.25, hz - 0.9); cyl(0.04, 0.09, MAT.white, hx, YARD_Y + 1.17, hz - 0.8, null, 10);
      box(0.9, 0.04, 0.5, MAT.hazard, hx, YARD_Y + 3.1, hz - 1.6); var gl2 = box(0.25, 0.25, 0.25, glowMat(0xffa000, 0.8), hx, YARD_Y + 3.25, hz - 1.6); yard.lampLenses.push(gl2);
      var gll = new THREE.PointLight(0xffb040, 0, 14, 2); gll.position.set(hx, YARD_Y + 3.0, hz - 2.2); gll.userData.k = 0.9; scene.add(gll); yardLights.push(gll);
      sign(['GATE ' + (side < 0 ? 'WEST' : 'EAST')], 1.8, 0.4, hx, YARD_Y + 2.6, hz - 1.42, Math.PI, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' });
      sign(['STOP', 'REPORT TO', 'THE GATE'], 1.0, 1.0, gx + side * 10, YARD_Y + 2.2, -4, side > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 512, h: 512, bg: '#c8342a', fg: '#fff', size: 80 }); cyl(0.04, 2.2, MAT.steelDark, gx + side * 10, YARD_Y + 1.1, -4, null, 6);
      var guard = makeHuman({ vest: MAT.hivis, cap: true, capMat: MAT.black, shirt: MAT.jeans }); guard.position.set(hx, YARD_Y + 0.2, hz - 0.2); guard.userData.baseY = YARD_Y + 0.2; guard.userData.dynamic = true; guard.rotation.y = Math.PI; scene.add(guard); yard.guards.push({ g: guard, side: side });
    });
    // the staff car park, the smoking shelter, the dumpster, the flag
    if (stageHas('carpark')) { for (var b = 0; b < 7; b++) plane(0.12, 5.5, MAT.whiteLine, -29 + b * 2.7, YARD_Y + 0.012, 31, -Math.PI / 2); plane(16.2, 0.12, MAT.whiteLine, -20.9, YARD_Y + 0.012, 28.25, -Math.PI / 2); }
    if (stageHas('neighbours')) {
    // the neighbours across the fence, each with its own dock doors and a name
    [[-130, -30, 40, 9, 32, 'NORTHGATE LOGISTICS', 1], [128, -24, 44, 8, 30, 'VOLT & CO. DISTRIBUTION', 1], [-118, 106, 34, 7, 26, 'FAIRLANE FREIGHT', 0], [0, 150, 90, 12, 40, 'KESSLER WHOLESALE', 0], [136, 116, 40, 10, 30, 'PINECREST STORAGE', 0], [-44, -124, 50, 9, 28, 'LITTLE WONDERS DC', 1]].forEach(function (b) {
      var NB = std({ map: TEX.corrugated, color: pick([0xd8dcdf, 0xc9d3dc, 0xe2e0d8, 0xcfd6c9]), roughness: 0.5, metalness: 0.3, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(0.8, 0.8) }); box(b[2], b[3], b[4], NB, b[0], YARD_Y + b[3] / 2, b[1]); box(b[2] + 0.1, 1.4, b[4] + 0.1, MAT.brick, b[0], YARD_Y + 0.7, b[1]); box(b[2] + 0.12, 0.8, b[4] + 0.12, std({ color: pick([0x1f4e8c, 0xb3261e, 0x2f6b3a, 0xe0862a]), roughness: 0.5 }), b[0], YARD_Y + b[3] - 2.6, b[1]);
      for (var rib = -b[2] / 2; rib <= b[2] / 2; rib += 4) box(0.3, b[3] - 1.4, b[4] + 0.2, MAT.steelDark, b[0] + rib, YARD_Y + 1.4 + (b[3] - 1.4) / 2, b[1]);
      var face = b[6] ? -1 : 1, fz = b[1] - face * (b[4] / 2 + 0.09), fry = b[6] ? 0 : Math.PI;   // the dock face looks out, toward us
      for (var d = -b[2] / 2 + 6; d < b[2] / 2 - 4; d += 8) { var dr = plane(3.6, 4.2, MAT.door, b[0] + d, YARD_Y + 2.1, fz, 0, fry); dr.receiveShadow = false; box(4.4, 0.15, 1.6, MAT.steelDark, b[0] + d, YARD_Y + 4.6, fz - face * 0.8); box(4.4, 0.9, 0.2, MAT.hazard, b[0] + d, YARD_Y + 4.8, fz - face * 0.1); if (Math.random() < 0.45) { var tr = box(2.5, 2.7, 9, std({ color: pick([0xe9ecef, 0xc9ced3, 0xdfe3e6]), roughness: 0.5, metalness: 0.2 }), b[0] + d, YARD_Y + 2.1, fz - face * 5.2); box(2.5, 0.4, 9, MAT.steelDark, b[0] + d, YARD_Y + 0.6, fz - face * 5.2); [-0.9, 0.9].forEach(function (wx) { for (var tw = 0; tw < 2; tw++) { var tyreM = cyl(0.5, 0.3, MAT.rubber, b[0] + d + wx, YARD_Y + 0.5, fz - face * (8.2 + tw * 1.2), null, 16); tyreM.rotation.z = Math.PI / 2; } }); cyl(0.06, 1.0, MAT.steelDark, b[0] + d - 0.9, YARD_Y + 0.5, fz - face * 1.8, null, 6); cyl(0.06, 1.0, MAT.steelDark, b[0] + d + 0.9, YARD_Y + 0.5, fz - face * 1.8, null, 6); } }
      sign([b[5]], b[2] * 0.7, b[2] * 0.09, b[0], YARD_Y + b[3] - 1.2, fz - face * 0.08, fry, { w: 1024, h: 128, bg: '#2a2f36', fg: '#d8dbdf' });
      for (var u = 0; u < 3; u++) box(2.5, 1.2, 2.5, MAT.grey, b[0] - b[2] / 3 + u * b[2] / 3, YARD_Y + b[3] + 0.6, b[1] + randf(-3, 3));
      box(b[2] + 0.4, 0.5, b[4] + 0.4, MAT.steelDark, b[0], YARD_Y + b[3] + 0.2, b[1]); for (var rv = -b[2] / 2 + 5; rv < b[2] / 2; rv += 10) { cyl(0.5, 1.0, MAT.steel, b[0] + rv, YARD_Y + b[3] + 0.9, b[1] - 4, null, 12); cyl(0.65, 0.2, MAT.steelDark, b[0] + rv, YARD_Y + b[3] + 1.45, b[1] - 4, null, 12); } box(b[2] * 0.3, 3.2, 0.3, MAT.brick, b[0] + b[2] * 0.3, YARD_Y + 1.6, fz - face * 0.1);
      for (var wn = -b[2] / 2 + 2; wn < b[2] / 2 - 2; wn += 3) { var wp = plane(1.6, 1.0, MAT.glass, b[0] + wn, YARD_Y + b[3] - 2.2, fz - face * 0.02, 0, fry); wp.userData.noBake = true; }
      var dr2 = plane(1.0, 2.1, MAT.door, b[0] + b[2] * 0.3, YARD_Y + 1.05, fz - face * 0.12, 0, fry); dr2.receiveShadow = false; box(0.3, 0.1, 0.3, MAT.steelDark, b[0] + b[2] * 0.3, YARD_Y + 2.5, fz - face * 0.3); var nl = box(0.3, 0.08, 0.2, glowMat(0xfff2c0, 0.2), b[0] + b[2] * 0.3, YARD_Y + 2.42, fz - face * 0.4); yard.lampLenses.push(nl);
      for (var bo = -b[2] / 2 + 3; bo < b[2] / 2; bo += 6) cyl(0.12, 1.0, MAT.yellow, b[0] + bo, YARD_Y + 0.5, fz - face * 1.2, null, 8);
    });
    }
    if (stageHas('road')) {
    // the road: two lanes, dashes, kerbs, lamp posts, and the traffic that uses it
    var roadMat = MAT.yard.clone(); roadMat.map = TEX.asphalt.clone(); roadMat.map.needsUpdate = true; roadMat.map.wrapS = roadMat.map.wrapT = THREE.RepeatWrapping; roadMat.map.repeat.set(260 / 7, 11 / 7); if (roadMat.normalMap) { roadMat.normalMap = roadMat.normalMap.clone(); roadMat.normalMap.needsUpdate = true; roadMat.normalMap.wrapS = roadMat.normalMap.wrapT = THREE.RepeatWrapping; roadMat.normalMap.repeat.set(260 / 7, 11 / 7); }   // the yard's repeat squashed the texture across the 11 m road
    yard.roadMat = roadMat; plane(260, 11, roadMat, 0, YARD_Y + 0.01, 75, -Math.PI / 2); box(260, 0.15, 0.3, MAT.grey, 0, YARD_Y + 0.07, 69.4); box(260, 0.15, 0.3, MAT.grey, 0, YARD_Y + 0.07, 80.6);
    for (var i = -120; i < 120; i += 6) plane(3, 0.2, MAT.whiteLine, i, YARD_Y + 0.02, 75, -Math.PI / 2);
    for (var lp = -110; lp <= 110; lp += 28) { cyl(0.06, 7, MAT.steelDark, lp, YARD_Y + 3.5, 81.5, null, 8, 0.09); box(0.08, 0.08, 1.4, MAT.steelDark, lp, YARD_Y + 6.9, 80.8); var ll = box(0.5, 0.14, 0.32, glowMat(0xfff2c0, 0.2), lp, YARD_Y + 6.85, 80.2); yard.lampLenses.push(ll); }
    for (var c = 0; c < 8; c++) { var cm = carMesh(pick(CAR_COLS)); cm.userData.dynamic = true; var dir = c % 2 ? -1 : 1; cm.position.set(-130 + (c >> 1) * 65 + randf(0, 20), YARD_Y, dir > 0 ? 72.5 : 77.5); cm.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(cm); yard.traffic.push({ g: cm, dir: dir, v: dir > 0 ? 12 : 10.5 }); }   // one speed a lane: they used to drive through each other
    }
    // the yard, worked: tyre marks on the aprons where the trucks swing in and oil where they stand, pallets stacked by the inbound
    // docks, a skip by the dumpster, an empty trailer dropped on the far side, weeds along every fence line
    var yMarkTex = tex(256, 64, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 2; i++) { var g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(0,0,0,0.4)'); g.addColorStop(0.7, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 10 + i * 30, w, 12); } for (var k = 0; k < 400; k++) { c.fillStyle = 'rgba(0,0,0,' + randf(0.05, 0.25) + ')'; c.fillRect(Math.random() * w, Math.random() * h, randf(1, 3), randf(1, 2)); } });
    var yMarkMat = new THREE.MeshBasicMaterial({ map: yMarkTex, transparent: true, depthWrite: false, opacity: 0.75 }); yMarkMat.userData.noBake = true;
    var yOilTex = tex(128, 128, function (c, w, h) { c.clearRect(0, 0, w, h); for (var i = 0; i < 5; i++) { var r = randf(14, 40), x = randf(r, w - r), y = randf(r, h - r), g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(6,6,8,0.55)'); g.addColorStop(0.7, 'rgba(6,6,8,0.25)'); g.addColorStop(1, 'rgba(6,6,8,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); } });
    var yOilMat = new THREE.MeshBasicMaterial({ map: yOilTex, transparent: true, depthWrite: false }); yOilMat.userData.noBake = true;
    yard.apron = function (d) {   // kept on yard so a dock built mid-game (IN 3, the returns dock) gets its marks from yardDock at once
      for (var k = 0; k < 3; k++) { var m = plane(9, 1.5, yMarkMat, d.side * (X + 6 + k * 7.5), YARD_Y + 0.014, d.z + randf(-0.6, 0.6), -Math.PI / 2, 0); m.rotation.z = randf(-0.05, 0.05); m.renderOrder = 1; m.userData.noBake = true; }
      var o = plane(2.6, 2.6, yOilMat, d.side * (X + 9), YARD_Y + 0.015, d.z + randf(-0.8, 0.8), -Math.PI / 2, 0); o.rotation.z = randf(0, 3); o.renderOrder = 1; o.userData.noBake = true;
    }; doors.forEach(yard.apron);
    var sceneCtx = { add: function (m) { scene.add(m); return m; } };
    if (big) [[-X - 2.6, 1.2, 5], [-X - 2.6, 2.6, 7], [X + 2.6, 1.3, 4]].forEach(function (p) { for (var i = 0; i < p[2]; i++) palletModel(sceneCtx, p[0] + randf(-0.02, 0.02), YARD_Y + i * 0.128, p[1] + randf(-0.02, 0.02), randf(-0.03, 0.03)); solid(p[0] - 0.65, p[0] + 0.65, p[1] - 0.55, p[1] + 0.55, YARD_Y, YARD_Y + 1.2); });
    if (stageHas('neighbours')) {
    // the skip: a steel box with sloped ends, lifting lugs, hazard stripes, the hire firm's name, cardboard showing over the lip
    (function () { var sx = X + 7, sz = 21, SK = std({ color: 0x9a8a2a, roughness: 0.6, metalness: 0.4 }); box(3.4, 1.5, 1.7, SK, sx, YARD_Y + 0.75, sz); [-1, 1].forEach(function (e) { var end = box(1.1, 1.5, 1.7, SK, sx + e * 1.95, YARD_Y + 0.75, sz); end.rotation.z = e * 0.35; [-0.6, 0.6].forEach(function (lz) { box(0.12, 0.3, 0.12, MAT.steelDark, sx + e * 1.6, YARD_Y + 1.6, sz + lz); }); }); plane(3.4, 0.25, MAT.hazard, sx, YARD_Y + 1.42, sz + 0.86, 0, 0); plane(3.4, 0.25, MAT.hazard, sx, YARD_Y + 1.42, sz - 0.86, 0, Math.PI); sign(['HILLSIDE SKIPS · 0800 300 300'], 2.2, 0.3, sx, YARD_Y + 0.95, sz + 0.86, 0, { w: 512, h: 72, bg: '#2a2d33', fg: '#eef1f5' }); for (var cb = 0; cb < 6; cb++) { var card = box(randf(0.5, 0.9), 0.1, randf(0.4, 0.7), MAT.parcel, sx + randf(-1.2, 1.2), YARD_Y + 1.45 + cb * 0.04, sz + randf(-0.5, 0.5)); card.rotation.y = randf(0, 3); card.rotation.z = randf(-0.3, 0.3); } solid(sx - 2.4, sx + 2.4, sz - 0.9, sz + 0.9, YARD_Y, YARD_Y + 1.6); })();
    // an empty trailer dropped on its landing legs at the far side of the yard, nose to the road
    (function () { var tx = 54, tz = 46, TR = std({ map: TEX.corrugated, color: 0xdfe3e6, roughness: 0.55, metalness: 0.25, normalMap: NRM.corrugated, normalScale: new THREE.Vector2(0.8, 0.8) }); box(2.5, 2.7, 12, TR, tx, YARD_Y + 2.1, tz); box(2.5, 0.4, 12, MAT.steelDark, tx, YARD_Y + 0.6, tz); [-0.9, 0.9].forEach(function (wx) { for (var tw = 0; tw < 2; tw++) { var ty = cyl(0.5, 0.3, MAT.rubber, tx + wx, YARD_Y + 0.5, tz - 3.6 - tw * 1.3, null, 16); ty.rotation.z = Math.PI / 2; } }); cyl(0.06, 1.0, MAT.steelDark, tx - 0.9, YARD_Y + 0.5, tz + 3.8, null, 6); cyl(0.06, 1.0, MAT.steelDark, tx + 0.9, YARD_Y + 0.5, tz + 3.8, null, 6); box(2.5, 2.7, 0.08, MAT.steelDark, tx, YARD_Y + 2.1, tz + 6.0); sign(['DEPOT CO. · DROP TRAILER'], 2.0, 0.3, tx - 1.26, YARD_Y + 1.6, tz, -Math.PI / 2, { w: 512, h: 72, bg: '#1b232c', fg: '#a0acb8' }); box(0.3, 0.1, 0.3, MAT.yellow, tx - 1.0, YARD_Y + 0.05, tz - 4.9); solid(tx - 1.3, tx + 1.3, tz - 6, tz + 6.1, YARD_Y, YARD_Y + 3); })();
    }
    for (var wd2 = F.z0 + 10; wd2 <= F.z1 - 2; wd2 += randf(2.5, 5)) { [[-F.x + 0.6, wd2], [F.x - 0.6, wd2]].forEach(function (p) { var wg = new THREE.Mesh(new THREE.IcosahedronGeometry(randf(0.15, 0.35), 0), WEED); wg.position.set(p[0] + randf(-0.3, 0.3), YARD_Y + 0.08, p[1]); wg.scale.y = 0.6; scene.add(wg); }); }
    for (var wd3 = -F.x + 2; wd3 <= F.x - 2; wd3 += randf(2.5, 5)) { var wg2 = new THREE.Mesh(new THREE.IcosahedronGeometry(randf(0.15, 0.35), 0), WEED); wg2.position.set(wd3, YARD_Y + 0.08, F.z0 + 0.6 + randf(-0.3, 0.3)); wg2.scale.y = 0.6; scene.add(wg2); }
    for (var p = 0; p < 12; p++) { var pm = new THREE.Mesh(new THREE.CircleGeometry(randf(1.2, 3.2), 18), std({ color: 0x151a22, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0 })); pm.rotation.x = -Math.PI / 2; var px = 0, pz = 0, tries = 0; do { px = randf(-F.x + 4, F.x - 4); pz = randf(F.z0 + 4, Math.min(F.z1 - 4, 50)); tries++; } while (tries < 20 && Math.abs(px) < HALL.x + 3 && pz > F.z0 + 1 && pz < HALL.z + 3); pm.position.set(px, YARD_Y + 0.02, pz); pm.scale.x = randf(1, 2.2); scene.add(pm); yard.puddles.push(pm); }
  }

  var SNOW_COL = new THREE.Color(0xdfe4e9), SNOW_GRASS = new THREE.Color(0xf4f6f8);
  function tickYard(dt) {
    yard.windT += dt;
    // gates slide open while a truck is coming in or going out on that side
    yard.gates.forEach(function (g) { var want = S.trucks.some(function (t) { return t.side === g.side && Math.abs(t.z - g.z) < 2 && (t.state === 'coming' || t.state === 'leaving') && Math.abs(t.x) > 70 && Math.abs(t.x) < 100; }) ? 1 : 0; var was = g.open; g.open = lerp(g.open, want, 1 - Math.pow(0.03, dt)); if (want && was < 0.05 && g.open >= 0.05) sfx('gate'); g.g.rotation.x = g.open * 1.35; });
    yard.guards.forEach(function (gd) { var near = dist2(player.x, player.z, gd.g.position.x, gd.g.position.z) < 64; animateHuman(gd.g, dt, 'idle', 0, near ? { x: player.x, y: player.y + 1.6, z: player.z } : null, false); });
    yard.traffic.forEach(function (c) { c.g.position.x += c.dir * c.v * dt; if (c.g.position.x > 130) c.g.position.x = -130; if (c.g.position.x < -130) c.g.position.x = 130; });
    if (yard.flagMesh) { var w = S.weather ? S.weather.wind : 0.4; yard.flag.rotation.y = Math.sin(yard.windT * 0.7) * 0.3 * w; var pos = yard.flagMesh.geometry.attributes.position; for (var i = 0; i < pos.count; i++) { var x = pos.getX(i); pos.setZ(i, Math.sin(yard.windT * 4 + x * 3) * 0.08 * (0.3 + w) * x); } pos.needsUpdate = true; }
    // weather
    var W = S.weather || { kind: 'clear', wet: 0, snow: 0, wind: 0.4 };
    var raining = W.kind === 'rain' || W.kind === 'storm', snowing = W.kind === 'snow';
    yard.puddles.forEach(function (pm) { pm.material.opacity = W.wet * 0.85; });
    MAT.yard.color.setHex(0xffffff).lerp(SNOW_COL, W.snow * 0.9); MAT.grass.color.setHex(0xffffff).lerp(SNOW_GRASS, W.snow); if (yard.roadMat) yard.roadMat.color.setHex(0xffffff).lerp(SNOW_COL, W.snow * 0.9);   // the road whitens with the yard (it stayed black in a white yard); the two colours are shared, not two new ones a frame
  }
