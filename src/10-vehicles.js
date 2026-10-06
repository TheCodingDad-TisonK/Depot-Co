//@ the pallet jack, the picking cart and the forklift
  // ── Tools you push: the jack and the cart ─────────────────────────
  var jackMesh = null, jackMeshes = {}, cartMesh = null, forkM = null, driving = false, forkSpeed = 0, forkLook = { yaw: 0, pitch: 0 }, jackModel = null;
  function isJack(t) { return t === 'jack' || t === 'jack2'; }
  function jackTool() { return isJack(player.tool) ? player.tool : 'jack'; }
  function toolWorld(tool) {
    if (player.tool === tool) return { x: player.x - Math.sin(player.yaw) * 1.15, z: player.z - Math.cos(player.yaw) * 1.15, ry: player.yaw + Math.PI };
    var t = S[tool]; return { x: t.x, z: t.z, ry: t.rot || 0 };
  }
  function buildTools() {
    // ── the pallet jack: forks either side of the origin (where the pallet sits), the pump body and the tiller behind (local -z)
    var buildJack = function (tool, noHit) { var j = new THREE.Group(); j.userData.dynamic = true; scene.add(j); if (!noHit) jackMeshes[tool] = j;   /* noHit: a jack a receiver pushes, not one you can grab */
    var JO = std({ color: 0xe8701a, roughness: 0.45, metalness: 0.35 });
    [-0.3, 0.3].forEach(function (x) {
      box(0.16, 0.06, 1.1, JO, x, 0.095, 0.0, j); var tip = box(0.16, 0.06, 0.16, JO, x, 0.075, 0.62, j); tip.rotation.x = 0.35;
      cyl(0.035, 0.12, MAT.rubber, x, 0.04, 0.42, j, 10).rotation.z = Math.PI / 2; cyl(0.035, 0.12, MAT.rubber, x, 0.04, 0.12, j, 10).rotation.z = Math.PI / 2;
      box(0.16, 0.16, 0.08, JO, x, 0.16, -0.55, j);
    });
    box(0.5, 0.36, 0.3, JO, 0, 0.3, -0.66, j); box(0.54, 0.04, 0.34, MAT.steelDark, 0, 0.5, -0.66, j);
    cyl(0.055, 0.26, MAT.chrome, 0, 0.42, -0.6, j, 12); cyl(0.07, 0.1, MAT.steelDark, 0, 0.58, -0.6, j, 12);
    [-0.17, 0.17].forEach(function (x) { cyl(0.09, 0.07, MAT.rubber, x, 0.09, -0.76, j, 14).rotation.z = Math.PI / 2; cyl(0.05, 0.075, MAT.chrome, x, 0.09, -0.76, j, 10).rotation.z = Math.PI / 2; });
    var tiller = new THREE.Group(); tiller.position.set(0, 0.5, -0.78); tiller.rotation.x = -0.55; j.add(tiller); j.userData.tiller = tiller;
    cyl(0.025, 1.0, MAT.steelDark, 0, 0.5, 0, tiller, 10); box(0.44, 0.06, 0.07, MAT.rubber, 0, 1.0, 0, tiller); box(0.05, 0.05, 0.05, MAT.rubber, -0.2, 1.0, 0, tiller); box(0.05, 0.05, 0.05, MAT.rubber, 0.2, 1.0, 0, tiller);
    box(0.08, 0.03, 0.1, MAT.red, 0, 0.95, 0.06, tiller); cyl(0.04, 0.08, MAT.steelDark, 0, 0.0, 0, tiller, 10);
    sign(['2500 kg'], 0.3, 0.1, 0, 0.3, -0.5, 0, { w: 256, h: 80, bg: '#1b232c', fg: '#f5b53d' }, j);
    groundBlob(0.9, 1.7, 0, -0.1, j, 0);
    if (!noHit) hitBox(1.0, 1.3, 1.9, 0, 0.6, -0.25, { prompt: function () { return toolPrompt(tool); }, use: function () { grabTool(tool); } }, j); return j; };
    jackModel = buildJack; jackMesh = buildJack('jack'); buildJack('jack2');
    // ── the picking cart: a tubular frame, two mesh shelves, a push loop, four casters and a clipboard
    var c = new THREE.Group(); c.userData.dynamic = true; scene.add(c); cartMesh = c;
    [[-0.62, -0.3], [0.62, -0.3], [-0.62, 0.3], [0.62, 0.3]].forEach(function (o) { cyl(0.018, 0.96, MAT.chrome, o[0], 0.56, o[1], c, 8); box(0.05, 0.08, 0.05, MAT.steelDark, o[0], 0.1, o[1], c); var cw = cyl(0.045, 0.03, MAT.rubber, o[0], 0.045, o[1] + 0.03, c, 12); cw.rotation.z = Math.PI / 2; });
    [0.3, 0.82].forEach(function (y) { box(1.3, 0.025, 0.66, MAT.steelDark, 0, y - 0.012, 0, c); var m = plane(1.26, 0.62, MAT.mesh, 0, y + 0.002, 0, -Math.PI / 2, 0, c); m.receiveShadow = false; box(1.3, 0.05, 0.02, MAT.chrome, 0, y + 0.02, 0.32, c); box(1.3, 0.05, 0.02, MAT.chrome, 0, y + 0.02, -0.32, c); });
    cyl(0.018, 0.35, MAT.chrome, -0.62, 1.2, -0.3, c, 8); cyl(0.018, 0.35, MAT.chrome, 0.62, 1.2, -0.3, c, 8); cyl(0.02, 1.3, MAT.rubber, 0, 1.38, -0.3, c, 8).rotation.z = Math.PI / 2;
    box(0.22, 0.3, 0.02, MAT.plastic, 0.45, 1.1, -0.29, c); box(0.2, 0.26, 0.01, MAT.paper, 0.45, 1.1, -0.275, c);
    groundBlob(1.7, 1.1, 0, 0, c, 0);
    hitBox(1.4, 1.4, 0.8, 0, 0.7, 0, { prompt: function () { return toolPrompt('cart'); }, use: function () { grabTool('cart'); }, alt: function () { cartHandSwap(); } }, c);
    // ── the forklift: a counterbalance electric truck. Rounded shells, treaded tyres, an I-section mast with chains and
    // hoses, a proper seat and column, a dashboard with gauges, the overhead guard as one bent tube, decals and plates.
    var f = new THREE.Group(); f.userData.dynamic = true; scene.add(f);
    var FY = MAT.forkYellow, FD = MAT.black, FS = MAT.steelDark;
    var rb = function (w, h, d, r, mat, x, y, z, parent) { var m = new THREE.Mesh(bevelGeo(w, h, d, r), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (parent || f).add(m); return m; };
    var tyre = function (r, w, x, y, z, parent) {
      var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.z = Math.PI / 2; (parent || f).add(g);
      var RUB = std({ color: 0x1a1b1d, roughness: 0.95 }), RIM = std({ color: 0x8d9298, roughness: 0.35, metalness: 0.7 }), GROOVE = std({ color: 0x0c0d0e, roughness: 1 });
      cyl(r, w, RUB, 0, 0, 0, g, 36); var sw1 = new THREE.Mesh(new THREE.TorusGeometry(r - 0.025, 0.012, 6, 36), RUB); sw1.position.y = w / 2 + 0.004; sw1.rotation.x = Math.PI / 2; g.add(sw1); var sw2 = sw1.clone(); sw2.position.y = -w / 2 - 0.004; g.add(sw2);
      for (var t = 0; t < 24; t++) { var a = t / 24 * 6.283, gr = box(0.014, w * 0.8, 0.02, GROOVE, 0, 0, 0, g); gr.position.set(Math.cos(a) * (r + 0.002), 0, Math.sin(a) * (r + 0.002)); gr.rotation.y = -a; gr.rotation.z = (t % 2 ? 0.35 : -0.35); }
      var cg = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 5, 36), GROOVE); cg.rotation.x = Math.PI / 2; g.add(cg);
      cyl(r * 0.62, w + 0.02, RIM, 0, 0, 0, g, 24); cyl(r * 0.5, w + 0.06, std({ color: 0x5f656b, roughness: 0.4, metalness: 0.7 }), 0, 0, 0, g, 24); cyl(r * 0.18, w + 0.09, FD, 0, 0, 0, g, 12);
      for (var n = 0; n < 6; n++) { var bx = Math.cos(n / 6 * 6.283) * r * 0.36, bz = Math.sin(n / 6 * 6.283) * r * 0.36; var bolt = cyl(0.014, w + 0.1, MAT.chrome, bx, 0, bz, g, 6); var bh = cyl(0.028, 0.012, std({ color: 0x3a3e44, roughness: 0.5, metalness: 0.6 }), bx, 0, bz, g, 8); bh.position.y = 0; }
      return g;
    };
    rb(1.12, 0.5, 1.95, 0.05, FY, 0, 0.5, -0.25); rb(1.1, 0.9, 0.62, 0.1, FD, 0, 0.62, -1.18); rb(0.9, 0.28, 0.5, 0.05, FY, 0, 1.2, -1.15);
    rb(0.9, 0.42, 0.7, 0.04, FS, 0, 0.97, -0.5); rb(0.92, 0.03, 0.72, 0.01, MAT.plastic, 0, 1.195, -0.5); rb(0.3, 0.05, 0.04, 0.01, MAT.chrome, 0, 1.0, -0.14); box(1.12, 0.03, 0.6, MAT.chequer, 0, 0.76, 0.3, f);
    rb(0.3, 0.03, 0.18, 0.01, FD, -0.2, 0.78, 0.25).rotation.x = -0.3; rb(0.3, 0.03, 0.18, 0.01, FD, 0.2, 0.78, 0.25).rotation.x = -0.3;
    // the operator's compartment: a contoured seat on a suspension with a belt, armrest and lever bank, the column with its
    // shroud and a wheel with spokes and a spinner knob, a moulded dash with the cluster, key switch, horn and direction lever,
    // pedals and a parking brake on the floor plate
    var SEAT = std({ color: 0x1f2630, roughness: 0.9 }), SEAT2 = std({ color: 0x2b3542, roughness: 0.9 });
    rb(0.5, 0.08, 0.5, 0.03, FS, 0, 1.22, -0.5); rb(0.3, 0.12, 0.3, 0.02, FD, 0, 1.15, -0.5);
    rb(0.5, 0.12, 0.5, 0.05, SEAT, 0, 1.32, -0.5); rb(0.1, 0.16, 0.5, 0.04, SEAT2, -0.22, 1.35, -0.5); rb(0.1, 0.16, 0.5, 0.04, SEAT2, 0.22, 1.35, -0.5);
    var bk = rb(0.5, 0.6, 0.12, 0.05, SEAT, 0, 1.66, -0.78); bk.rotation.x = -0.15; var bk2 = rb(0.12, 0.5, 0.14, 0.04, SEAT2, -0.2, 1.66, -0.77); bk2.rotation.x = -0.15; var bk3 = rb(0.12, 0.5, 0.14, 0.04, SEAT2, 0.2, 1.66, -0.77); bk3.rotation.x = -0.15; rb(0.3, 0.16, 0.12, 0.04, SEAT, 0, 2.02, -0.84);
    var belt = box(0.05, 0.7, 0.01, MAT.hivisOrange, 0.1, 1.6, -0.7, f); belt.rotation.z = 0.45; box(0.06, 0.04, 0.03, MAT.chrome, -0.16, 1.36, -0.45, f);
    rb(0.08, 0.05, 0.36, 0.02, FD, -0.34, 1.46, -0.5); rb(0.08, 0.05, 0.36, 0.02, FD, 0.34, 1.46, -0.5);
    // the lever bank on the right: lift, tilt and sideshift, with a label plate
    rb(0.16, 0.1, 0.32, 0.02, FS, -0.47, 1.26, -0.05); [-0.1, 0, 0.1].forEach(function (lz, i) { var lv = cyl(0.01, 0.2, MAT.chrome, -0.47, 1.4, lz, f, 6); lv.rotation.x = -0.25 + i * 0.1; sphere(0.02, i === 0 ? MAT.red : FD, -0.47, 1.49, lz - 0.05 + i * 0.02, f); });
    sign(['LIFT · TILT · SHIFT'], 0.26, 0.04, -0.47, 1.32, 0.12, 0, { w: 256, h: 40, bg: '#1b232c', fg: '#eef1f5' }, f);
    // the column: a shroud from the dash to the wheel, the wheel ahead of and below the eyes, tilted back to the driver
    var colGrp = new THREE.Group(); colGrp.position.set(0, 1.08, 0.2); colGrp.rotation.x = -0.62; f.add(colGrp);
    cyl(0.045, 0.42, FS, 0, 0.21, 0, colGrp, 12, 0.06); cyl(0.07, 0.1, FD, 0, 0.1, 0, colGrp, 12, 0.09);
    var wheel = new THREE.Group(); wheel.position.set(0, 0.44, 0); colGrp.add(wheel);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 10, 28), MAT.rubber); rim.rotation.x = Math.PI / 2; wheel.add(rim);
    [0, 1, 2].forEach(function (s) { var sp = box(0.26, 0.012, 0.03, FD, 0, 0, 0, wheel); sp.rotation.y = s * 1.05; }); cyl(0.045, 0.03, FD, 0, 0, 0, wheel, 10); cyl(0.012, 0.05, MAT.chrome, 0.11, 0.03, 0.08, wheel, 6); sphere(0.02, FD, 0.11, 0.06, 0.08, wheel);
    var dirLever = cyl(0.008, 0.14, FD, 0.08, 0.28, 0.0, colGrp, 6); dirLever.rotation.z = -1.2; sphere(0.014, FD, 0.17, 0.3, 0, colGrp);
    // the dash: a moulded cowl ahead of the column, the cluster, a key switch, the horn, a rocker, the hour meter
    rb(0.6, 0.2, 0.26, 0.05, FS, 0, 1.12, 0.42); var cowl = rb(0.56, 0.12, 0.22, 0.04, FD, 0, 1.25, 0.4); cowl.rotation.x = 0.3;
    rb(0.1, 0.16, 0.06, 0.01, FD, 0, 1.36, 0.5); var clg = new THREE.Group(); clg.position.set(0, 1.46, 0.52); clg.rotation.order = 'YXZ'; clg.rotation.y = Math.PI; clg.rotation.x = 0.3; f.add(clg); rb(0.36, 0.16, 0.05, 0.015, FD, 0, 0, -0.03, clg); var clMat = new THREE.MeshBasicMaterial({ map: textTex(['24V ▮▮▮▮▮▮▯▯   0.0 km/h', '⏱ 0412.6 h   ⚠ ✓'], { w: 512, h: 160, bg: '#0d1216', fg: '#5fd38d', size: 30 }), side: THREE.DoubleSide }); var cl = plane(0.3, 0.1, clMat, 0, 0, 0.001, 0, 0, clg); cl.userData.noBake = true;
    cyl(0.018, 0.02, MAT.chrome, -0.2, 1.24, 0.29, f, 10).rotation.x = -1.2; box(0.012, 0.03, 0.004, MAT.black, -0.2, 1.255, 0.285, f); cyl(0.022, 0.012, MAT.red, 0.2, 1.24, 0.29, f, 12).rotation.x = -1.2; box(0.03, 0.02, 0.01, FD, -0.12, 1.22, 0.3, f); box(0.03, 0.02, 0.01, MAT.green, -0.12, 1.2, 0.3, f);
    sign(['HORN'], 0.06, 0.016, 0.2, 1.21, 0.31, 0, { w: 128, h: 32, bg: '#1b232c', fg: '#eef1f5' }, f);
    // the floor: pedals and the parking brake
    box(0.12, 0.012, 0.08, MAT.rubber, 0.12, 0.78, 0.3, f).rotation.x = -0.35; box(0.12, 0.012, 0.08, MAT.rubber, -0.08, 0.78, 0.3, f).rotation.x = -0.35; var pb = cyl(0.01, 0.22, FD, -0.3, 0.88, 0.1, f, 6); pb.rotation.x = -0.5; box(0.05, 0.03, 0.06, MAT.red, -0.3, 0.98, 0.15, f);
    var guardPts = [[-0.52, 0.9, 0.5], [-0.52, 2.2, 0.5], [-0.52, 2.4, 0.3], [-0.52, 2.4, -0.85], [-0.52, 2.2, -1.05], [-0.52, 0.9, -1.05]];
    [-1, 1].forEach(function (s) { var pts = guardPts.map(function (p) { return new THREE.Vector3(p[0] * s, p[1], p[2]); }); var tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2), 40, 0.035, 8, false), FD); tube.castShadow = true; f.add(tube); });
    // the guard roof: four round cross tubes and two runners, a round base for the beacon
    [-0.95, -0.5, -0.05, 0.4].forEach(function (cb) { cyl(0.032, 1.06, FD, 0, 2.4, cb, f, 10).rotation.z = Math.PI / 2; }); [-0.3, 0.3].forEach(function (rx) { cyl(0.02, 1.4, FD, rx, 2.42, -0.27, f, 8).rotation.x = Math.PI / 2; }); cyl(0.09, 0.03, FD, 0, 2.44, -0.3, f, 14);
    cyl(0.07, 0.14, glowMat(0xffa000, 0.6), 0, 2.53, -0.3, f, 12); var beaconLens = box(0.03, 0.12, 0.14, glowMat(0xffd060, 2.5), 0.06, 2.53, -0.3, f);
    var iShape = new THREE.Shape(); iShape.moveTo(-0.05, -0.08); iShape.lineTo(0.05, -0.08); iShape.lineTo(0.05, -0.05); iShape.lineTo(0.015, -0.05); iShape.lineTo(0.015, 0.05); iShape.lineTo(0.05, 0.05); iShape.lineTo(0.05, 0.08); iShape.lineTo(-0.05, 0.08); iShape.lineTo(-0.05, 0.05); iShape.lineTo(-0.015, 0.05); iShape.lineTo(-0.015, -0.05); iShape.lineTo(-0.05, -0.05); iShape.closePath();
    var iGeo = new THREE.ExtrudeGeometry(iShape, { depth: 2.7, bevelEnabled: false }); iGeo.rotateX(-Math.PI / 2);
    [-0.5, 0.5].forEach(function (x) { var ch = new THREE.Mesh(iGeo, FS); ch.position.set(x, 0.1, 0.62); ch.castShadow = true; f.add(ch); box(0.08, 2.45, 0.1, MAT.chrome, x * 0.84, 1.5, 0.63, f); });
    box(1.1, 0.08, 0.16, FS, 0, 2.78, 0.62, f); box(1.1, 0.08, 0.16, FS, 0, 0.14, 0.62, f); cyl(0.05, 2.3, MAT.chrome, 0, 1.3, 0.56, f, 10);
    var chainTex = tex(16, 64, function (c, w, h) { c.fillStyle = '#2a2a2a'; c.fillRect(0, 0, w, h); c.fillStyle = '#8a8a8a'; for (var y = 0; y < h; y += 8) c.fillRect(3, y + 1, 10, 5); }, 1, 20); var chainMat = std({ map: chainTex, roughness: 0.5, metalness: 0.7 });
    [-0.2, 0.2].forEach(function (x) { var cm = box(0.04, 2.4, 0.015, chainMat, x, 1.45, 0.7, f); cm.userData.noBake = true; });
    var hosePts = [new THREE.Vector3(0.3, 0.9, 0.4), new THREE.Vector3(0.5, 1.4, 0.5), new THREE.Vector3(0.52, 2.0, 0.62), new THREE.Vector3(0.35, 2.3, 0.7)]; var hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePts), 20, 0.018, 6, false), MAT.rubber); f.add(hose); var hose2 = hose.clone(); hose2.scale.x = -1; f.add(hose2);
    var car = new THREE.Group(); f.add(car);
    rb(0.95, 0.5, 0.06, 0.02, FS, 0, 0.3, 0.72, car); for (var lb = -0.4; lb <= 0.4; lb += 0.2) cyl(0.015, 0.9, FS, lb, 0.95, 0.72, car, 6); box(0.95, 0.03, 0.03, FS, 0, 1.4, 0.72, car); box(0.95, 0.03, 0.03, FS, 0, 1.0, 0.72, car); box(0.95, 0.04, 0.04, MAT.hazard, 0, 1.42, 0.72, car);
    [-0.3, 0.3].forEach(function (x) { rb(0.12, 0.05, 1.15, 0.01, FS, x, 0.03, 1.33, car); rb(0.12, 0.42, 0.05, 0.01, FS, x, 0.26, 0.77, car); var ft = box(0.12, 0.05, 0.1, FS, x, 0.02, 1.92, car); ft.rotation.x = 0.3; });
    tyre(0.34, 0.26, -0.58, 0.34, 0.45); tyre(0.34, 0.26, 0.58, 0.34, 0.45); tyre(0.27, 0.2, -0.47, 0.27, -1.0); tyre(0.27, 0.2, 0.47, 0.27, -1.0);
    rb(0.5, 0.24, 0.1, 0.03, FD, -0.56, 0.72, 0.45); rb(0.5, 0.24, 0.1, 0.03, FD, 0.56, 0.72, 0.45); rb(0.4, 0.2, 0.1, 0.03, FD, -0.5, 0.6, -1.0); rb(0.4, 0.2, 0.1, 0.03, FD, 0.5, 0.6, -1.0);
    box(0.14, 0.1, 0.06, MAT.lamp, -0.45, 1.0, 0.72, f); box(0.14, 0.1, 0.06, MAT.lamp, 0.45, 1.0, 0.72, f); box(0.12, 0.08, 0.05, glowMat(0xff2a1a, 0.8), -0.4, 0.75, -1.5, f); box(0.12, 0.08, 0.05, glowMat(0xff2a1a, 0.8), 0.4, 0.75, -1.5, f);
    sign(['DC-01'], 0.3, 0.09, 0, 0.55, -1.51, Math.PI, { w: 256, h: 80, bg: '#f5f1e6', fg: '#1b232c' }, f); sign(['DEPOT CO.'], 0.6, 0.14, 0, 0.9, -1.51, Math.PI, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' }, f);
    sign(['2.5 t', 'max 3.3 m'], 0.3, 0.16, -0.57, 0.5, -0.4, -Math.PI / 2, { w: 256, h: 128, bg: '#1b232c', fg: '#f5b53d', size: 40 }, f); sign(['ELECTRIC'], 0.4, 0.08, 0.57, 0.5, -0.5, Math.PI / 2, { w: 256, h: 64, bg: '#f2b705', fg: '#1a1205' }, f);
    cyl(0.04, 0.3, MAT.red, 0.5, 1.4, -1.15, f, 10); box(0.03, 0.12, 0.1, MAT.chrome, -0.6, 1.9, 0.1, f); cyl(0.01, 0.3, FS, -0.6, 1.95, 0.05, f, 4).rotation.z = 0.3;
    groundBlob(2.0, 2.9, 0, -0.2, f, 0);
    hitBox(1.1, 1.4, 1.4, 0, 1.2, -0.3, { prompt: function () { if (!S.up.fork) return null; if (player.tool === 'cable') return 'Plug the forklift in'; if (S.fork.plugged) return 'Forklift on charge · unplug at the charger · E drives off anyway'; return S.hand || player.tool ? 'Hands full' : 'Drive the forklift'; }, use: function () { if (player.tool === 'cable') { cablePlugInto('fork'); return; } startDrive(); } }, f);
    forkM = { g: f, car: car, beacon: beaconLens, wheel: wheel };
    placeTools();
  }
  // the cart's load: boxes on it plus parcels on it, against one capacity
  function cartParcels() { if (!S.cart.parcels) S.cart.parcels = []; return S.cart.parcels; }
  function cartLoad() { return S.cart.boxes.length + cartParcels().length; }
  function cartLoadText() { var b = S.cart.boxes.length, p = cartParcels().length; return (b ? b + (b === 1 ? ' box' : ' boxes') : '') + (b && p ? ', ' : '') + (p ? p + (p === 1 ? ' parcel' : ' parcels') : '') || 'empty'; }
  // G at the parked cart: what you hold goes on it, empty hands take the top box (or parcel) off it
  function cartHandSwap() { if (player.tool || driving) return; if (S.hand) { if (S.hand.kind === 'parcel') { if (cartLoad() >= ECON.cartCap) { toast('The cart is full.', 'bad'); sfx('bad'); return; } cartParcels().push(S.hand.order); handSet(null); sfx('putdown'); hudDirty = true; return; } if (S.hand.kind !== 'box' || S.hand.damaged) { toast('Only good boxes ride the cart.', 'bad'); return; } if (cartLoad() >= ECON.cartCap) { toast('The cart is full.', 'bad'); sfx('bad'); return; } S.cart.boxes.push(S.hand.sku); handSet(null); sfx('putdown'); hudDirty = true; return; } if (S.cart.boxes.length) { handSet({ kind: 'box', sku: S.cart.boxes.pop() }); sfx('pickup'); hudDirty = true; return; } if (cartParcels().length) { handSet({ kind: 'parcel', order: cartParcels().pop() }); sfx('pickup'); hudDirty = true; return; } sfx('click'); }
  function toolPrompt(tool) { if (tool === 'cart' && !S.up.cart) return null; if (player.tool) return null; if (S.hand) return tool === 'cart' && ((S.hand.kind === 'box' && !S.hand.damaged) || S.hand.kind === 'parcel') ? (cartLoad() < ECON.cartCap ? 'G puts the ' + (S.hand.kind === 'parcel' ? 'parcel' : 'box') + ' on the cart (' + cartLoadText() + ')' : 'The cart is full') : 'Hands full'; if (driving) return null; return isJack(tool) ? 'Grab pallet jack ' + (tool === 'jack2' ? '2 (OUT)' : '1 (IN)') : 'Grab the picking cart' + (cartLoad() ? ' (' + cartLoadText() + ') · G takes one off' : ''); }
  function grabTool(tool) { if (player.tool || S.hand || driving) return; if (tool === 'cart' && !S.up.cart) return; player.tool = tool; sfx('pickup'); hudDirty = true; introStep(tool); }
  function releaseTool() { if (!player.tool) return; if (player.tool === 'cable') { player.tool = null; sfx('putdown'); toast('Cable hung back', ''); hudDirty = true; return; } var w = toolWorld(player.tool), tm = isJack(player.tool) ? jackMeshes[player.tool] : cartMesh; if (tm && tm.userData.towRy !== undefined) { w.ry = tm.userData.towRy; w.x = tm.position.x; w.z = tm.position.z; } var t = S[player.tool]; t.x = w.x; t.z = w.z; t.rot = w.ry; player.tool = null; sfx('putdown'); hudDirty = true; }
  function placeTools(dt) {
    var ease = 1 - Math.exp(-(dt || 1 / 60) * 6);
    // a towed tool trails the player: its heading eases toward the player's, so a look round does not whip it about
    var towed = function (tool, mesh) { var w = toolWorld(tool); if (player.tool === tool) { var cur = mesh.userData.towRy === undefined ? w.ry : mesh.userData.towRy, d = Math.atan2(Math.sin(w.ry - cur), Math.cos(w.ry - cur)); cur += d * ease; mesh.userData.towRy = cur; w.ry = cur; w.x = player.x + Math.sin(cur) * 1.15; w.z = player.z + Math.cos(cur) * 1.15; } else mesh.userData.towRy = undefined; mesh.position.set(w.x, floorY(w.x, w.z), w.z); mesh.rotation.y = w.ry; };
    towed('jack', jackMesh); towed('jack2', jackMeshes.jack2); towed('cart', cartMesh); cartMesh.visible = !!S.up.cart;
    forkM.g.position.set(S.fork.x, floorY(S.fork.x, S.fork.z), S.fork.z); forkM.g.rotation.y = S.fork.yaw; forkM.car.position.y = S.fork.lift; forkM.g.visible = !!S.up.fork; if (forkM.beacon) { forkM.beacon.visible = driving || !!staffDriving(); forkM.beacon.rotation.y = worldTime * 6; } if (forkM.wheel) { var k2 = player.keys, steer2 = driving ? ((k2.KeyA ? 1 : 0) - (k2.KeyD ? 1 : 0)) : 0; forkM.wheel.rotation.y = lerp(forkM.wheel.rotation.y, steer2 * 1.4, ease * 2); }
  }

  // ── The forklift ──────────────────────────────────────────────────
  function forkTip() { return { x: S.fork.x + Math.sin(S.fork.yaw) * 1.5, y: S.fork.lift, z: S.fork.z + Math.cos(S.fork.yaw) * 1.5 }; }
  function startDrive() {
    if (!S.up.fork || S.hand || player.tool || driving) return;
    var drv = staffDriving(); if (drv) { toast(drv.name + ' is on the forklift. They park it when the job is done.', 'bad'); sfx('bad'); return; }
    if (S.fork.plugged) cableUnplugFork('You drove off with the charger plugged in. The plug came out.');
    driving = true; forkSpeed = 0; forkLook.yaw = 0; forkLook.pitch = -0.14; sfx('forklift'); introStep('fork'); hudDirty = true;
    $('h-drive').hidden = false;
  }
  function stopDrive() {
    if (!driving) return;
    driving = false; forkSpeed = 0; $('h-drive').hidden = true; hudDirty = true;
    // step off on the left side; if that is blocked, the right side; if both, behind
    var c = Math.cos(S.fork.yaw), s = Math.sin(S.fork.yaw);
    var spots = [[-c * 1.4, s * 1.4], [c * 1.4, -s * 1.4], [-s * 2.2, -c * 2.2]];
    for (var i = 0; i < spots.length; i++) { var x = S.fork.x + spots[i][0], z = S.fork.z + spots[i][1]; if (!collides(x, z, true) && floorY(x, z) > -0.5) { player.x = x; player.z = z; player.y = floorY(x, z); player.yaw = S.fork.yaw + Math.PI; return; } }
    player.x = S.fork.x; player.z = S.fork.z;
  }
  // an obstacle the truck is already inside (it has to nose up to the wrapper, the racks and the docks) cannot block it, so it can always back out
  function forkCollides(x, z) {
    var r = 1.0, cx = S.fork.x, cz = S.fork.z;
    if (floorY(x, z) < -0.5) return true;
    var all = solids.concat(dyn);
    for (var i = 0; i < all.length; i++) { var s = all[i]; if (s.fork) continue; if (s.y0 > 2.5) continue; if (x > s.x0 - r && x < s.x1 + r && z > s.z0 - r && z < s.z1 + r) { var already = cx > s.x0 - r && cx < s.x1 + r && cz > s.z0 - r && cz < s.z1 + r; if (!already) return true; var dxn = Math.max(s.x0 - x, 0, x - s.x1), dzn = Math.max(s.z0 - z, 0, z - s.z1), dxc = Math.max(s.x0 - cx, 0, cx - s.x1), dzc = Math.max(s.z0 - cz, 0, cz - s.z1); if (dxn + dzn < dxc + dzc - 0.001) return true; } }
    return false;
  }
  var FORK_GEARS = [0.6, 1.0, 1.5];   // top-speed multipliers: creep, normal, fast
  function forkGearCycle() { var F = S.fork; F.gear = ((F.gear || 1) % 3) + 1; sfx('click'); toast('Gear ' + F.gear + (F.gear === 3 ? ': fast. Mind unwrapped loads on the corners.' : F.gear === 1 ? ': creep' : ''), ''); hudDirty = true; }
  function updateFork(dt) {
    var k = player.keys, F = S.fork;
    var throttle = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), batt = F.batt === undefined ? 1 : F.batt, cap = batt <= 0 ? 0.15 : batt < 0.15 ? 0.5 : 1;
    var gear = F.gear || 1, gm = FORK_GEARS[gear - 1];
    if (throttle) forkSpeed = clamp(forkSpeed + throttle * 3.2 * gm * dt, -2.6 * cap, 4.2 * gm * cap); else forkSpeed *= Math.max(0, 1 - 3 * dt);
    if (throttle && batt <= 0 && !forkLook.flatSaid) { forkLook.flatSaid = true; toast('Flat battery: crawl mode. Park it in its bay by the charger.', 'bad'); }
    // an unwrapped load sheds a box on a fast corner
    var p0 = forkPallet();
    if (p0 && !p0.wrapped && p0.n > 0 && (k.KeyA || k.KeyD) && Math.abs(forkSpeed) > 3.2 && Math.random() < dt * 0.9) { p0.n--; var tip0 = forkTip(); S.floor.push({ kind: 'box', sku: p0.sku, x: tip0.x + randf(-0.8, 0.8), y: floorY(tip0.x, tip0.z), z: tip0.z + randf(-0.8, 0.8), rot: Math.random() * 6, damaged: Math.random() < 0.5 }); sfx('crate'); burst(tip0.x, tip0.y + 0.5, tip0.z, 0xc69c6d, 10, 'out'); toast('A box fell off the load. Wrap pallets before you move them.', 'bad'); if (p0.n <= 0) { removePallet(p0.id); F.pallet = null; } }
    if (forkSpeed < -0.3 && Math.floor(worldTime * 2) !== forkLook.beepT) { forkLook.beepT = Math.floor(worldTime * 2); sfx('beepback'); }
    if (k.Space) forkSpeed *= Math.max(0, 1 - 8 * dt);
    if (Math.abs(forkSpeed) < 0.02) forkSpeed = 0;
    var steer = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0);
    if (steer && forkSpeed) F.yaw += steer * 1.5 * dt * clamp(forkSpeed / 1.5, -1, 1);
    var nx = F.x + Math.sin(F.yaw) * forkSpeed * dt, nz = F.z + Math.cos(F.yaw) * forkSpeed * dt;
    if (!forkCollides(nx, nz)) { F.x = nx; F.z = nz; } else forkSpeed = 0;
    var lift = (k.KeyR ? 1 : 0) - (k.KeyF ? 1 : 0);
    if (lift) { F.lift = clamp(F.lift + lift * 1.1 * dt, 0.1, 3.7); if (!forkLook.hyd) { forkLook.hyd = true; sfx('hydraulic'); } } else forkLook.hyd = false;
    if (forkSpeed && Math.random() < dt * 1.5) sfx('forklift');
    var p = forkPallet();
    $('h-drive').innerHTML = '<b>W/S</b> drive · <b>A/D</b> steer · <b>R/F</b> forks at ' + F.lift.toFixed(1) + ' m · <b>E</b> ' + (p ? 'set the pallet down' : 'lift a pallet') + ' · <b>G</b> get off · battery <b>' + Math.round((F.batt === undefined ? 1 : F.batt) * 100) + '%</b> · <b>Shift</b> gear <b>' + (F.gear || 1) + '</b>' + (p && !p.wrapped ? ' · <span style="color:var(--amber)">unwrapped load</span>' : '');
  }
  function forkUse() {
    var tip = forkTip(), F = S.fork, p = forkPallet();
    if (p) {
      var key = slotNear(tip.x, tip.z, F.lift);
      if (key) { if (storePallet(p, key)) { F.pallet = null; sfx('crate'); addXp(XP.pallet); toast('Pallet stored · ' + slotName(key), 'good'); introStep('putaway'); } else toast('No room in ' + slotName(key) + '.', 'bad'); return; }
      if (F.lift < 0.5) { if (floorY(tip.x, tip.z) < -0.5) { toast('Not over the edge.', 'bad'); return; } p.place = 'floor'; p.x = tip.x; p.z = tip.z; p.y = floorY(tip.x, tip.z); p.rot = F.yaw; F.pallet = null; sfx('crate'); return; }
      toast('Lower the forks, or line them up with a rack slot.', 'bad'); return;
    }
    // lift a pallet off the floor or out of a truck
    var best = null, bd = 1.3;
    S.pallets.forEach(function (q) { if (q.place !== 'floor' && q.place !== 'truck') return; var w = palletWorld(q); if (!w) return; if (q.place === 'truck') { var t = truckById(q.truck); if (!t || t.state !== 'docked' || !t.signed) return; } var d = Math.sqrt(dist2(w.x, w.z, tip.x, tip.z)); if (d < bd && Math.abs(w.y - F.lift) < 0.5) { bd = d; best = q; } });
    if (best) { if (best.place === 'truck') onPalletLeftTruck(best); best.place = 'fork'; F.pallet = best.id; sfx('hydraulic'); introStep('unload'); return; }
    var key2 = slotNear(tip.x, tip.z, F.lift);
    if (key2 && S.slots[key2] && S.slots[key2].n) { var np = pullPallet(key2); if (np) { np.place = 'fork'; F.pallet = np.id; sfx('hydraulic'); } return; }
    if (key2 && S.slots[key2] && S.slots[key2].pal) { var s2 = S.slots[key2]; delete S.slots[key2]; var ep = newPallet(s2.sku, 0, { place: 'fork' }); F.pallet = ep.id; sfx('hydraulic'); return; }
    toast('Nothing on the forks. Line them up with a pallet at this height.', 'bad');
  }
  function slotNear(x, z, lift) {
    var best = null, bd = 1.2;
    for (var r = 0; r < S.up.rows; r++) for (var b = 0; b < RACK.bays; b++) for (var l = 0; l < RACK.levels.length; l++) {
      var sp = rackSlotPos(r, b, l); if (Math.abs(sp.y - lift) > 0.5) continue;
      var d = Math.sqrt(dist2(sp.x, sp.z, x, z)); if (d < bd) { bd = d; best = slotKey(r, b, l); }
    }
    return best;
  }
