//@ the production wing bolted onto the north wall, and the machine props: conveyors, the pack line, the moulding line, the hopper, the palletiser, the silo
  // ── The wing ──────────────────────────────────────────────────────
  // x -14..10, z -44..-24, under a 6 m roof. It shares the hall's north wall, which has a doorway with a strip curtain for people
  // and the forklift, and a low opening the main belt runs through.
  var WING = { x0: -14, x1: 10, z0: -HALL.z - 20, z1: -HALL.z, h: 6, door: { x0: 4, x1: 7.6, h: 4.2 }, belt: { x0: -5, x1: -3, h: 2.0 } };
  function inWing(x, z) { return x > WING.x0 && x < WING.x1 && z > WING.z0 && z < WING.z1; }
  function buildWing() {
    var W = WING, h = W.h, cx = (W.x0 + W.x1) / 2, cz = (W.z0 + W.z1) / 2, wx = W.x1 - W.x0, wz = W.z1 - W.z0;
    box(wx + 0.6, 1.2, wz + 0.3, MAT.grey, cx, YARD_Y + 0.6, cz - 0.15);                                   // the plinth it stands on
    plane(wx, wz, MAT.floor, cx, 0.001, cz, -Math.PI / 2);
    box(0.3, h, wz, MAT.wall, W.x0, h / 2, cz); solid(W.x0 - 0.15, W.x0 + 0.15, W.z0, W.z1);                 // west, east and north walls
    box(0.3, h, wz, MAT.wall, W.x1, h / 2, cz); solid(W.x1 - 0.15, W.x1 + 0.15, W.z0, W.z1);
    box(wx + 0.3, h, 0.3, MAT.wall, cx, h / 2, W.z0); solid(W.x0 - 0.15, W.x1 + 0.15, W.z0 - 0.15, W.z0 + 0.15);
    box(wx + 0.6, 0.3, wz + 0.6, MAT.roof, cx, h + 0.15, cz); plane(wx, wz, MAT.roofIn, cx, h - 0.01, cz, Math.PI / 2);
    [-38, -31].forEach(function (z) { var sk = plane(wx - 4, 1.4, MAT.skylight, cx, h - 0.02, z, Math.PI / 2); world.lampMeshes.push(sk); });
    for (var tz = W.z0 + 4; tz < W.z1; tz += 6) box(wx - 0.4, 0.5, 0.22, MAT.steelDark, cx, h - 0.3, tz);
    world.wingLights = []; [[-8, -39], [4, -39], [-8, -29], [4, -29]].forEach(function (p) { var m = box(0.9, 0.12, 0.5, MAT.lamp, p[0], h - 0.6, p[1]); world.lampMeshes.push(m); cyl(0.03, 0.4, MAT.steelDark, p[0], h - 0.35, p[1]); var l = new THREE.PointLight(0xfff2dc, 0.9, 26, 2); l.position.set(p[0], h - 1.2, p[1]); scene.add(l); world.wingLights.push(l); });
    // the inside face of the shared wall gets a sign over the doorway, the strip curtain, and a steel frame round the belt opening
    sign(['PRODUCTION'], 2.6, 0.6, (W.door.x0 + W.door.x1) / 2, W.door.h + 0.7, W.z1 + 0.17, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#78bdf5' });
    sign(['WAREHOUSE'], 2.6, 0.6, (W.door.x0 + W.door.x1) / 2, W.door.h + 0.7, W.z1 - 0.17, Math.PI, { w: 512, h: 128, bg: '#1b232c', fg: '#f5b53d' });
    var strip = std({ color: 0xdfe8ee, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }); strip.userData.noBake = true;
    box(W.door.x1 - W.door.x0 + 0.3, 0.12, 0.4, MAT.steelDark, (W.door.x0 + W.door.x1) / 2, W.door.h - 0.05, W.z1);
    for (var sx = W.door.x0 + 0.15; sx < W.door.x1; sx += 0.3) { var st = plane(0.28, W.door.h - 0.15, strip, sx, (W.door.h - 0.15) / 2, W.z1 + (sx * 7 % 1) * 0.02 - 0.01, 0, 0); st.rotation.y = ((sx * 13) % 1 - 0.5) * 0.08; }
    box(0.12, W.belt.h + 0.12, 0.5, MAT.yellow, W.belt.x0 - 0.06, (W.belt.h + 0.12) / 2, W.z1); box(0.12, W.belt.h + 0.12, 0.5, MAT.yellow, W.belt.x1 + 0.06, (W.belt.h + 0.12) / 2, W.z1); box(W.belt.x1 - W.belt.x0 + 0.24, 0.12, 0.5, MAT.yellow, (W.belt.x0 + W.belt.x1) / 2, W.belt.h + 0.06, W.z1);
    // floor markings: the walkway down the east side, hazard borders round the machines, a square for raw pallets
    plane(0.1, wz - 1, MAT.yellowLine, W.x1 - 1.6, 0.006, cz, -Math.PI / 2); plane(0.1, wz - 1, MAT.yellowLine, W.x1 - 0.4, 0.006, cz, -Math.PI / 2);
    [[-9.5, -33, 2.0, 2.0]].forEach(function (q) { plane(q[2], 0.08, MAT.whiteLine, q[0], 0.006, q[1] - q[3] / 2, -Math.PI / 2); plane(q[2], 0.08, MAT.whiteLine, q[0], 0.006, q[1] + q[3] / 2, -Math.PI / 2); plane(0.08, q[3], MAT.whiteLine, q[0] - q[2] / 2, 0.006, q[1], -Math.PI / 2); plane(0.08, q[3], MAT.whiteLine, q[0] + q[2] / 2, 0.006, q[1], -Math.PI / 2); });
    sign(['RAW GRANULATE'], 1.6, 0.3, -9.5, 0.008, -31.6, 0, { w: 512, h: 96, bg: 'rgba(0,0,0,0)', fg: '#eef1f5' }).rotation.x = -Math.PI / 2;
    // the pipe rack along the west wall, the compressor in the corner, a cable tray under the roof
    [1.6, 1.9, 2.2].forEach(function (py, i) { var pipe = cyl(0.06 - i * 0.012, wz - 2, i === 1 ? MAT.blue : MAT.steel, W.x0 + 0.45, py + 2.2, cz, null, 10); pipe.rotation.x = Math.PI / 2; }); for (var bz = W.z0 + 2; bz < W.z1 - 1; bz += 3) { box(0.5, 0.06, 0.06, MAT.steelDark, W.x0 + 0.4, 4.0, bz); box(0.06, 0.9, 0.06, MAT.steelDark, W.x0 + 0.62, 4.0, bz); }
    var comp = new THREE.Group(); comp.position.set(7.2, 0, -41.8); scene.add(comp); box(1.6, 0.1, 0.8, MAT.steelDark, 0, 0.05, 0, comp); var tank = cyl(0.32, 1.5, std({ color: 0x3a5f9e, roughness: 0.4, metalness: 0.5 }), 0, 0.5, 0, comp, 16); tank.rotation.z = Math.PI / 2; box(0.5, 0.45, 0.4, MAT.steelDark, 0.2, 1.05, 0, comp); cyl(0.2, 0.3, MAT.black, -0.3, 1.0, 0, comp, 12).rotation.z = Math.PI / 2; cyl(0.05, 0.03, MAT.white, 0.45, 1.2, 0.22, comp, 10).rotation.x = Math.PI / 2; cyl(0.015, 1.2, MAT.black, 0.3, 0.9, 0.4, comp, 6).rotation.x = 0.4; solid(6.3, 8.1, -42.3, -41.3, 0, 1.4);
    sign(['COMPRESSOR · HEARING PROTECTION'], 1.3, 0.14, 7.2, 1.8, -41.2, 0, { w: 512, h: 56, bg: '#1b232c', fg: '#f5b53d' });
    box(0.3, 0.04, wz - 2, MAT.steelDark, W.x1 - 1.0, h - 0.9, cz); for (var cz2 = W.z0 + 2; cz2 < W.z1; cz2 += 4) box(0.32, 0.08, 0.05, MAT.steelDark, W.x1 - 1.0, h - 0.86, cz2);
    // the ladder and the ledge up to the hopper's gauge, and the silo pipe coming in over the west wall
    var sp = cyl(0.14, 9.0, MAT.steel, -13.5, 5.6, -34, null, 12); sp.rotation.z = Math.PI / 2; cyl(0.14, 1.2, MAT.steel, -9.6, 5.0, -34, null, 12);
  }
  // ── Shared machine parts ──────────────────────────────────────────
  var MAT_MACH = { frame: std({ color: 0x3a4149, roughness: 0.5, metalness: 0.6 }), panel: std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), guard: std({ color: 0xf5b53d, roughness: 0.5, metalness: 0.3 }), blue: std({ color: 0x2f5f9e, roughness: 0.45, metalness: 0.4 }), roller: std({ color: 0x8d9298, roughness: 0.3, metalness: 0.8 }), rubber: std({ color: 0x1c1e22, roughness: 0.95 }) };
  var beltTexBase = tex(64, 64, function (c, w, h) { c.fillStyle = '#23262a'; c.fillRect(0, 0, w, h); c.fillStyle = '#2c3035'; for (var i = 0; i < 8; i++) c.fillRect(0, i * 8, w, 3); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 28, w, 4); grain(c, w, h, 300, 0.08); }, 1, 1);
  function lampStack(c, x, y, z) {
    c.cyl(0.02, 0.5, MAT_MACH.frame, x, y + 0.25, z, 6); var g = c.cyl(0.05, 0.08, glowMat(0x5fd38d, 1.4), x, y + 0.56, z, 10), a = c.cyl(0.05, 0.08, glowMat(0xf5b53d, 1.4), x, y + 0.65, z, 10), r = c.cyl(0.05, 0.08, glowMat(0xff3b2f, 1.4), x, y + 0.74, z, 10); c.cyl(0.055, 0.03, MAT.black, x, y + 0.8, z, 10);
    g.visible = false; a.visible = true; r.visible = false; return { g: g, a: a, r: r };
  }
  // a straight belt along local +z from z0 to z1 at x: frame, legs, rollers, a scrolling belt top, guide rails and a drive motor
  function conveyorBuild(c, x, z0, z1, opt) {
    opt = opt || {}; var len = z1 - z0, zc = (z0 + z1) / 2, y = BELT_Y;
    c.box(0.05, 0.1, len, MAT_MACH.frame, x - 0.34, y - 0.04, zc); c.box(0.05, 0.1, len, MAT_MACH.frame, x + 0.34, y - 0.04, zc);
    for (var lz = z0 + 0.3; lz < z1; lz += 1.2) { [-0.3, 0.3].forEach(function (lx) { c.box(0.05, y - 0.12, 0.05, MAT_MACH.frame, x + lx, (y - 0.12) / 2, lz); c.box(0.12, 0.02, 0.12, MAT_MACH.frame, x + lx, 0.01, lz); }); c.box(0.65, 0.04, 0.04, MAT_MACH.frame, x, y - 0.11, lz); }
    for (var rz = z0 + 0.12; rz < z1; rz += 0.24) { var r = c.cyl(0.035, 0.62, MAT_MACH.roller, x, y - 0.02, rz, 10); r.rotation.z = Math.PI / 2; }
    var bt = beltTexBase.clone(); bt.needsUpdate = true; bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(1, len / 0.5); var bm = std({ map: bt, roughness: 0.9 }); bm.userData.noBake = true;
    var top = c.plane(0.6, len, bm, x, y + 0.02, zc, -Math.PI / 2, 0); BELT_PLANES.push(top);
    c.box(0.03, 0.03, len, MAT_MACH.guard, x - 0.31, y + 0.12, zc); c.box(0.03, 0.03, len, MAT_MACH.guard, x + 0.31, y + 0.12, zc); for (var gz = z0 + 0.4; gz < z1; gz += 1.2) { c.box(0.03, 0.12, 0.03, MAT_MACH.guard, x - 0.31, y + 0.05, gz); c.box(0.03, 0.12, 0.03, MAT_MACH.guard, x + 0.31, y + 0.05, gz); }
    var mt = c.cyl(0.09, 0.22, MAT_MACH.blue, x + 0.48, y - 0.1, z1 - 0.25, 12); mt.rotation.z = Math.PI / 2; c.box(0.1, 0.12, 0.14, MAT.black, x + 0.6, y - 0.1, z1 - 0.25);
    if (!opt.noEye) { c.box(0.03, 0.4, 0.03, MAT_MACH.frame, x - 0.4, y + 0.2, z1 - 0.1); c.box(0.04, 0.05, 0.03, MAT.black, x - 0.4, y + 0.3, z1 - 0.1); c.box(0.02, 0.02, 0.005, glowMat(0xff3b2f, 1.2), x - 0.38, y + 0.3, z1 - 0.1); }
    c.solid(x - 0.4, x + 0.4, z0, z1, 0, 0.95);
  }
  function eStop(c, x, y, z) { c.box(0.12, 0.12, 0.03, MAT.yellow, x, y, z); c.cyl(0.035, 0.04, MAT.red, x, y, z + 0.03, 12).rotation.x = Math.PI / 2; }
  function cabinet(c, x, y, z, w, h, d) { c.box(w, h, d, MAT_MACH.panel, x, y, z); c.box(w + 0.02, 0.05, d + 0.02, MAT_MACH.frame, x, y + h / 2, z); c.box(w - 0.1, h - 0.12, 0.01, std({ color: 0xcfd4d9, roughness: 0.5 }), x, y, z + d / 2 + 0.004); c.box(0.025, 0.08, 0.02, MAT.chrome, x + w / 2 - 0.08, y, z + d / 2 + 0.015); }
  // ── The pack line prop: infeed belt, the case taper, outfeed belt, the gravity shelf
  function packLineBuild(c) {
    conveyorBuild(c, 0, 0, 2.0, { noEye: true });
    // the taper: two side frames, a bridge over the top carrying the taping head, side drive belts, flap folders at the infeed
    [-0.62, 0.62].forEach(function (x) { c.box(0.08, 1.7, 1.8, MAT_MACH.panel, x, 1.15, 2.9); c.box(0.1, 0.06, 1.84, MAT_MACH.frame, x, 0.32, 2.9); c.box(0.1, 0.06, 1.84, MAT_MACH.frame, x, 1.98, 2.9); c.box(0.1, 1.7, 0.06, MAT_MACH.frame, x, 1.15, 2.03); c.box(0.1, 1.7, 0.06, MAT_MACH.frame, x, 1.15, 3.77); });
    c.box(1.4, 0.5, 1.0, MAT_MACH.panel, 0, 2.05, 2.9); c.box(1.44, 0.04, 1.04, MAT_MACH.frame, 0, 1.82, 2.9);
    c.box(0.4, 0.5, 0.5, MAT_MACH.frame, 0, 1.55, 2.9); var roll = c.cyl(0.16, 0.08, MAT.white, 0, 1.62, 3.12, 16); roll.rotation.z = Math.PI / 2; c.cyl(0.03, 0.14, MAT.chrome, 0, 1.62, 3.12, 8).rotation.z = Math.PI / 2; var pr = c.cyl(0.04, 0.3, MAT_MACH.rubber, 0, 1.3, 2.6, 10); pr.rotation.z = Math.PI / 2; c.box(0.04, 0.3, 0.04, MAT_MACH.frame, 0, 1.45, 2.6);
    [-0.44, 0.44].forEach(function (x) { var sb = c.box(0.04, 0.3, 1.5, MAT_MACH.rubber, x, BELT_Y + 0.2, 2.9); for (var k = 0; k < 4; k++) c.cyl(0.05, 0.05, MAT_MACH.roller, x, BELT_Y + 0.2, 2.25 + k * 0.42, 10); });
    for (var rz = 2.1; rz < 3.7; rz += 0.2) { var r = c.cyl(0.035, 0.8, MAT_MACH.roller, 0, BELT_Y - 0.02, rz, 10); r.rotation.z = Math.PI / 2; }
    c.box(0.3, 0.02, 0.4, MAT_MACH.guard, -0.45, BELT_Y + 0.5, 2.15).rotation.z = 0.5; c.box(0.3, 0.02, 0.4, MAT_MACH.guard, 0.45, BELT_Y + 0.5, 2.15).rotation.z = -0.5;
    c.box(0.3, 0.2, 0.22, MAT_MACH.panel, 0.5, 1.2, 3.65); c.box(0.22, 0.01, 0.03, MAT.paper, 0.5, 1.12, 3.78);                         // the label printer at the outfeed
    c.box(1.0, 0.1, 0.05, MAT.hazard, 0, 0.9, 2.0); c.sign(['CASE TAPER 400', 'KEEP HANDS CLEAR OF THE INFEED'], 1.0, 0.2, 0, 1.6, 2.0, 0, { w: 512, h: 100, bg: '#1b232c', fg: '#eef1f5' });
    cabinet(c, 1.05, 1.0, 2.9, 0.5, 1.5, 0.3); c.box(0.5, 0.08, 0.3, MAT_MACH.frame, 1.05, 0.21, 2.9); var scr = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 1.05, y: 1.35, z: 3.06, ry: 0, parent: c.group, title: 'Pack line', draw: packScreenDraw }); scr.mesh.userData.propId = 'packline';
    eStop(c, 1.05, 0.95, 3.06); MACH.taper.lamps = lampStack(c, 1.05, 1.75, 2.9); c.cyl(0.02, 0.6, MAT.black, 1.05, 0.5, 2.75, 6);
    c.hit(1.4, 2.4, 1.8, 0, 1.2, 2.9, { prompt: function () { return packPrompt(); }, use: function () { packUse(); } });
    c.solid(-0.7, 0.7, 2.0, 3.8, 0, 2.4); c.solid(0.8, 1.3, 2.75, 3.05, 0, 1.8);
    conveyorBuild(c, 0, 3.8, 5.8, {});
    // the gravity shelf: a sloped roller bed with an end stop, where parcels wait to be picked up
    for (var sz = 5.9; sz < 7.0; sz += 0.12) { var sr = c.cyl(0.025, 0.7, MAT_MACH.roller, 0, 0.66 - (sz - 5.9) * 0.06, sz, 8); sr.rotation.z = Math.PI / 2; }
    [-0.38, 0.38].forEach(function (x) { var rail = c.box(0.04, 0.08, 1.2, MAT_MACH.frame, x, 0.64, 6.45); rail.rotation.x = 0.06; c.box(0.05, 0.55, 0.05, MAT_MACH.frame, x, 0.28, 5.95); c.box(0.05, 0.5, 0.05, MAT_MACH.frame, x, 0.25, 6.95); });
    c.box(0.8, 0.12, 0.03, MAT_MACH.guard, 0, 0.68, 7.02); c.sign(['PARCELS · TAKE FROM HERE'], 0.8, 0.12, 0, 0.5, 7.03, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#5fd38d' });
    c.solid(-0.45, 0.45, 5.8, 7.05, 0, 0.75);
  }
  // parcels on the shelf: local positions in the pack line's frame
  function shelfSlot(i) { return { lx: i % 2 ? 0.2 : -0.2, lz: 6.05 + Math.floor(i / 2) * 0.26, y: 0.66 - Math.floor(i / 2) * 0.016 + 0.2 }; }
  // ── The moulding line prop: hopper throat, heated barrel, clamp with a moving platen between tie bars, cooling fan, control cabinet, outfeed belt
  function moulderBuild(c) {
    c.box(2.4, 0.3, 4.4, MAT_MACH.frame, 0, 0.15, 0.2); c.box(2.5, 0.06, 4.5, MAT.hazard, 0, 0.33, 0.2);
    c.box(1.2, 0.8, 1.2, MAT_MACH.blue, 0, 0.75, -1.6); c.cyl(0.42, 0.5, MAT_MACH.frame, 0, 1.45, -1.6, 14, 0.2); c.cyl(0.22, 0.4, MAT_MACH.frame, 0, 1.9, -1.6, 12);     // the throat under the feed pipe
    var motor = c.cyl(0.3, 0.7, MAT_MACH.blue, 0, 0.95, -2.3, 14); motor.rotation.x = Math.PI / 2; var fan = c.cyl(0.26, 0.04, MAT.black, 0, 0.95, -2.7, 16); fan.rotation.x = Math.PI / 2;
    var barrel = c.cyl(0.24, 2.0, MAT_MACH.frame, 0, 1.0, -0.6, 16); barrel.rotation.x = Math.PI / 2; for (var hb = -1.4; hb <= 0.2; hb += 0.4) { var band = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 20), std({ color: 0x8a3b1e, roughness: 0.6, metalness: 0.4 })); band.position.set(0, 1.0, hb); c.group.add(band); }
    c.box(0.6, 0.6, 0.4, MAT_MACH.frame, 0.7, 0.75, -1.0); c.box(0.5, 0.12, 0.3, MAT.black, 0.7, 1.1, -1.0);
    // the clamp: a fixed platen at the front, a moving platen (the ram) on four tie bars, guards each side
    var tie = [[-0.55, 0.65], [0.55, 0.65], [-0.55, 1.55], [0.55, 1.55]]; tie.forEach(function (t) { var tb = c.cyl(0.04, 1.6, MAT.chrome, t[0], t[1], 1.2, 10); tb.rotation.x = Math.PI / 2; });
    c.box(1.4, 1.5, 0.22, MAT_MACH.blue, 0, 1.1, 1.95); c.box(1.4, 1.5, 0.22, MAT_MACH.blue, 0, 1.1, 0.45);
    var ram = c.box(1.2, 1.3, 0.3, MAT_MACH.panel, 0, 1.1, 1.0); c.box(0.6, 0.6, 0.1, MAT_MACH.frame, 0, 1.1, 0.85); var mould = c.box(0.7, 0.7, 0.2, MAT_MACH.frame, 0, 1.1, 1.75);
    var GL = std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide }); [-0.9, 0.9].forEach(function (x) { c.plane(1.6, 1.4, GL, x, 1.2, 1.2, 0, Math.PI / 2); c.box(0.04, 1.5, 0.04, MAT_MACH.guard, x, 1.15, 0.4); c.box(0.04, 1.5, 0.04, MAT_MACH.guard, x, 1.15, 2.0); c.box(0.04, 0.04, 1.6, MAT_MACH.guard, x, 1.9, 1.2); });
    var wheel = c.cyl(0.3, 0.06, MAT.black, -1.0, 1.0, -0.6, 16); wheel.rotation.z = Math.PI / 2; for (var bl = 0; bl < 5; bl++) { var b2 = box(0.5, 0.02, 0.08, MAT_MACH.frame, 0, 0, 0, wheel); b2.rotation.y = bl * 1.257; } c.cyl(0.32, 0.02, MAT_MACH.frame, -1.03, 1.0, -0.6, 16).rotation.z = Math.PI / 2;
    [[-0.9, 0.5, 0.2], [0.9, 0.5, 0.0], [0.9, 0.9, 1.4]].forEach(function (p) { var hs = c.cyl(0.025, 0.9, MAT.black, p[0], p[1], p[2], 6); hs.rotation.x = 0.9; });
    // the outfeed chute from the mould to the belt, and the belt
    var chute = c.box(0.7, 0.03, 1.0, MAT_MACH.roller, 0, 0.95, 2.45); chute.rotation.x = 0.25; c.box(0.03, 0.14, 1.0, MAT_MACH.guard, -0.35, 1.0, 2.45).rotation.x = 0.25; c.box(0.03, 0.14, 1.0, MAT_MACH.guard, 0.35, 1.0, 2.45).rotation.x = 0.25;
    conveyorBuild(c, 0, 2.4, 4.4, {});
    cabinet(c, 1.6, 1.0, 0.2, 0.6, 1.8, 0.4); c.box(0.6, 0.1, 0.4, MAT_MACH.frame, 1.6, 0.15, 0.2); var scr = touchScreen({ w: 400, h: 260, pw: 0.44, ph: 0.29, x: 1.6, y: 1.45, z: 0.41, ry: 0, parent: c.group, title: 'Moulding line', draw: moulderScreenDraw }); scr.mesh.userData.propId = 'moulder';
    eStop(c, 1.6, 0.95, 0.41); MACH.moulder.lamps = lampStack(c, 1.6, 1.9, 0.2); var spin = c.cyl(0.08, 0.1, glowMat(0xf5b53d, 1.0), -1.1, 2.1, -1.6, 10); c.cyl(0.02, 0.6, MAT_MACH.frame, -1.1, 1.75, -1.6, 6);
    c.sign(['MOULDING LINE 1', 'HOT SURFACES · AUTOMATIC START'], 1.2, 0.24, 0, 1.8, -2.45, Math.PI, { w: 512, h: 100, bg: '#1b232c', fg: '#eef1f5' });
    MACH.moulder.anim = { ram: ram, wheel: wheel, spin: spin };
    c.hit(2.6, 2.4, 4.6, 0, 1.2, 0.1, { prompt: function () { return moulderPrompt(); }, use: function () { moulderUse(); } });
    c.solid(-1.3, 1.3, -2.8, 2.4, 0, 2.4); c.solid(1.3, 1.95, -0.05, 0.45, 0, 2.0);
  }
  // ── The hopper prop: a cone on legs with a ladder and cage, a vibrating feeder into the pipe that runs to the moulder, a level gauge
  function hopperBuild(c) {
    [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]].forEach(function (p) { c.box(0.1, 2.4, 0.1, MAT_MACH.frame, p[0], 1.2, p[1]); c.box(0.3, 0.02, 0.3, MAT_MACH.frame, p[0], 0.01, p[1]); }); c.box(1.9, 0.08, 0.08, MAT_MACH.frame, 0, 2.38, -0.85); c.box(1.9, 0.08, 0.08, MAT_MACH.frame, 0, 2.38, 0.85); c.box(0.08, 0.08, 1.9, MAT_MACH.frame, -0.85, 2.38, 0); c.box(0.08, 0.08, 1.9, MAT_MACH.frame, 0.85, 2.38, 0);
    var cone = c.cyl(1.05, 1.3, MAT_MACH.panel, 0, 2.95, 0, 20, 0.22); var drum = c.cyl(1.05, 1.4, MAT_MACH.panel, 0, 4.3, 0, 20); var rim = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.04, 8, 28), MAT_MACH.frame); rim.position.y = 5.0; rim.rotation.x = Math.PI / 2; c.group.add(rim); c.cyl(0.9, 0.04, MAT_MACH.frame, 0, 5.02, 0, 20); c.box(1.6, 0.03, 0.3, MAT_MACH.frame, 0, 5.05, 0);
    for (var bb = 0; bb < 2; bb++) { var hb = new THREE.Mesh(new THREE.TorusGeometry(1.07, 0.03, 6, 28), MAT_MACH.frame); hb.position.y = 3.8 + bb * 0.8; hb.rotation.x = Math.PI / 2; c.group.add(hb); }
    c.cyl(0.2, 0.3, MAT_MACH.frame, 0, 2.2, 0, 12); var feeder = c.box(0.7, 0.12, 0.4, MAT_MACH.blue, 0.45, 1.9, 0, 0); feeder.rotation.z = -0.15; c.box(0.3, 0.3, 0.3, MAT.black, 0.3, 1.6, 0.0);
    var pipe = c.cyl(0.14, 4.4, MAT.steel, 2.6, 1.3, 0, 12); pipe.rotation.z = Math.PI / 2; c.cyl(0.14, 0.8, MAT.steel, 0.65, 1.5, 0, 12).rotation.z = 0.6; var elbow = c.cyl(0.14, 0.6, MAT.steel, 4.8, 1.55, 0, 12); elbow.rotation.z = -0.5;
    // the ladder with its cage, on the +z side
    [-0.2, 0.2].forEach(function (x) { c.box(0.04, 4.6, 0.04, MAT_MACH.frame, x, 2.35, 1.15); }); for (var r = 0.3; r < 4.6; r += 0.3) c.box(0.44, 0.03, 0.03, MAT_MACH.frame, 0, r, 1.15); for (var cg = 2.4; cg < 4.8; cg += 0.6) { var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.02, 6, 16, Math.PI), MAT_MACH.guard); hoop.position.set(0, cg, 1.15); hoop.rotation.x = Math.PI / 2; hoop.rotation.z = 0; c.group.add(hoop); }
    cabinet(c, -1.1, 1.2, 0.95, 0.4, 0.6, 0.2); var scr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: -1.1, y: 1.3, z: 1.06, ry: 0, parent: c.group, title: 'Hopper', draw: hopperScreenDraw }); scr.mesh.userData.propId = 'hopper';
    c.sign(['TIP POINT · PALLETS OF RAW GRANULATE ONLY'], 1.6, 0.16, 0, 0.75, -1.0, Math.PI, { w: 512, h: 56, bg: '#f5b53d', fg: '#1a1205' }); c.box(1.6, 0.06, 0.05, MAT.hazard, 0, 0.62, -1.0);
    MACH.hopper.lamps = lampStack(c, -1.1, 1.55, 0.95); MACH.hopper.anim = { feeder: feeder, tipT: 0 };
    c.hit(2.4, 2.4, 2.6, 0, 1.2, 0, { prompt: function () { return hopperPrompt(); }, use: function () { hopperUse(); } });
    c.solid(-1.0, 1.0, -1.0, 1.3, 0, 2.3);
  }
  // ── The palletiser prop: a gantry over a roller cradle, the pusher on its ram, infeed rollers off the belt, a drop zone for the finished pallet
  function palletiserBuild(c) {
    [[-1.0, -1.0], [1.0, -1.0], [-1.0, 1.0], [1.0, 1.0]].forEach(function (p) { c.box(0.12, 3.0, 0.12, MAT_MACH.frame, p[0], 1.5, p[1]); c.box(0.3, 0.02, 0.3, MAT_MACH.frame, p[0], 0.01, p[1]); });
    c.box(2.24, 0.14, 0.14, MAT_MACH.frame, 0, 3.0, -1.0); c.box(2.24, 0.14, 0.14, MAT_MACH.frame, 0, 3.0, 1.0); c.box(0.14, 0.14, 2.24, MAT_MACH.frame, -1.0, 3.0, 0); c.box(0.14, 0.14, 2.24, MAT_MACH.frame, 1.0, 3.0, 0);
    c.box(0.3, 0.3, 2.0, MAT_MACH.blue, 0, 2.85, 0); c.cyl(0.08, 0.9, MAT.chrome, 0, 2.25, 0, 10); c.box(0.9, 0.12, 0.9, MAT_MACH.panel, 0, 1.8, 0); c.cyl(0.05, 0.5, MAT_MACH.frame, 0, 2.5, 0, 8);
    for (var rz = -0.75; rz <= 0.75; rz += 0.15) { var r = c.cyl(0.03, 1.5, MAT_MACH.roller, 0, 0.3, rz, 8); r.rotation.z = Math.PI / 2; } c.box(1.6, 0.06, 0.06, MAT_MACH.frame, 0, 0.33, -0.82); c.box(1.6, 0.06, 0.06, MAT_MACH.frame, 0, 0.33, 0.82); [-0.78, 0.78].forEach(function (x) { c.box(0.06, 0.3, 1.7, MAT_MACH.frame, x, 0.18, 0); });
    for (var iz = -1.6; iz < -0.9; iz += 0.12) { var ir = c.cyl(0.03, 0.62, MAT_MACH.roller, 0, BELT_Y - 0.02, iz, 8); ir.rotation.z = Math.PI / 2; } c.box(0.05, 0.1, 0.8, MAT_MACH.frame, -0.34, BELT_Y - 0.04, -1.25); c.box(0.05, 0.1, 0.8, MAT_MACH.frame, 0.34, BELT_Y - 0.04, -1.25); c.box(0.05, 0.7, 0.05, MAT_MACH.frame, -0.3, 0.35, -1.5); c.box(0.05, 0.7, 0.05, MAT_MACH.frame, 0.3, 0.35, -1.5);
    var slide = c.box(0.7, 0.03, 0.5, MAT_MACH.roller, 0, 0.55, -0.95); slide.rotation.x = -0.5;
    [-1.15, 1.15].forEach(function (x) { c.box(0.06, 1.6, 0.06, MAT.yellow, x, 0.8, -1.1); c.box(0.02, 1.4, 0.02, glowMat(0xff3b2f, 0.6), x, 0.8, -1.06); });
    cabinet(c, 1.4, 1.0, 0.6, 0.5, 1.5, 0.3); var scr = touchScreen({ w: 300, h: 200, pw: 0.36, ph: 0.24, x: 1.4, y: 1.35, z: 0.76, ry: 0, parent: c.group, title: 'Palletiser', draw: palletiserScreenDraw }); scr.mesh.userData.propId = 'palletiser';
    eStop(c, 1.4, 0.95, 0.76); MACH.palletiser.lamps = lampStack(c, 1.4, 1.75, 0.6);
    c.box(1.6, 0.012, 1.4, MAT.hazard, 2.2, 0.006, 0); c.sign(['PALLET DROP · KEEP CLEAR'], 1.4, 0.16, 2.2, 0.008, -0.8, 0, { w: 512, h: 56, bg: 'rgba(0,0,0,0)', fg: '#f5b53d' }).rotation.x = -Math.PI / 2;
    c.sign(['PALLETISER'], 1.6, 0.4, 0, 3.3, 0, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' });
    c.hit(2.4, 3.2, 2.4, 0, 1.6, 0, { prompt: function () { return palletiserPrompt(); }, use: function () { palletiserUse(); } });
    c.solid(-1.1, 1.1, -1.1, 1.1, 0, 3); c.solid(-0.4, 0.4, -1.7, -1.1, 0, 0.9); c.solid(1.15, 1.65, 0.45, 0.75, 0, 1.8);
  }
  function beltMainBuild(c) { conveyorBuild(c, 0, 0, 11.2, {}); c.box(0.8, 0.03, 0.04, MAT.hazard, 0, 1.0, 8.5); }
  // the silo outside the west wall feeds the hopper through the pipe over the wall
  function siloBuild(c) {
    [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]].forEach(function (p) { c.box(0.16, 3.2, 0.16, MAT_MACH.frame, p[0], 1.6, p[1]); c.box(0.5, 0.05, 0.5, MAT.grey, p[0], 0.02, p[1]); });
    c.cyl(1.5, 1.6, MAT_MACH.panel, 0, 4.0, 0, 24, 0.3); c.cyl(1.5, 5.2, MAT_MACH.panel, 0, 7.4, 0, 24); c.cyl(1.5, 0.6, MAT_MACH.panel, 0, 10.3, 0, 24, 0.2); c.cyl(0.25, 0.4, MAT_MACH.frame, 0, 10.8, 0, 12);
    for (var r = 4.9; r < 10; r += 1.3) { var ring = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.04, 6, 32), MAT_MACH.frame); ring.position.y = r; ring.rotation.x = Math.PI / 2; c.group.add(ring); }
    [-0.2, 0.2].forEach(function (x) { c.box(0.05, 10, 0.05, MAT_MACH.frame, x, 5.0, 1.62); }); for (var lr = 0.4; lr < 10; lr += 0.3) c.box(0.44, 0.03, 0.03, MAT_MACH.frame, 0, lr, 1.62); for (var cg = 3; cg < 10; cg += 0.6) { var hoop = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.02, 6, 16, Math.PI), MAT_MACH.guard); hoop.position.set(0, cg, 1.62); hoop.rotation.x = Math.PI / 2; c.group.add(hoop); }
    var out = c.cyl(0.16, 2.2, MAT.steel, 1.1, 2.4, 0, 12); out.rotation.z = -0.9; c.box(0.6, 0.5, 0.4, MAT_MACH.blue, 0, 2.6, 0); c.cyl(0.12, 0.06, MAT.white, 0.8, 5.5, 1.3, 12).rotation.x = Math.PI / 2;
    c.sign(['RAW GRANULATE · 40 t'], 2.0, 0.5, 0, 6.5, 1.52, 0, { w: 512, h: 128, bg: '#1b232c', fg: '#eef1f5' }); c.box(1.2, 0.012, 1.2, MAT.hazard, 2.4, 0.006, 0);
    c.solid(-1.6, 1.6, -1.6, 1.8, -2, 12);
  }
  // ── Defaults
  defProp('packline', { label: 'pack line', cat: 'hall', abs: true, x: 26.6, z: 7.2, rot: 0, build: packLineBuild });
  defProp('moulder', { label: 'moulding line', cat: 'factory', abs: true, x: -4, z: -37, rot: 0, build: moulderBuild });
  defProp('beltMain', { label: 'main belt', cat: 'factory', abs: true, x: -4, z: -32.5, rot: 0, build: beltMainBuild });
  defProp('palletiser', { label: 'palletiser', cat: 'hall', abs: true, x: -4, z: -19.5, rot: 0, build: palletiserBuild });
  defProp('hopper', { label: 'raw hopper', cat: 'factory', abs: true, x: -9.5, z: -37, rot: 0, build: hopperBuild });
  defProp('silo', { label: 'silo', cat: 'yard', yard: true, abs: true, x: -17.5, z: -34, rot: 0, build: siloBuild });
  defProp('extWing', { label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 9.83, z: -30, rot: 3, build: extinguisherBuild });
  defProp('posterWing', { label: 'safety poster', cat: 'wall', wall: true, abs: true, x: 9.83, z: -36, rot: 3, build: posterBuild('safety', 0.7, 1.05) });
