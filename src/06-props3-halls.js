//@ the annex halls (1.14.0): three more halls bought one after another, each with rack rows of its own; Hall 3 brings a third inbound dock
  // ── The annex halls ───────────────────────────────────────────────
  // Tyson's third expansion ask, 2026-10-06: "3 new halls and everything that comes with it". They hang off the north side like the
  // production wing, so the docks on the east and west walls and the truck lanes stay where they are. Hall 2 stands east of the wing,
  // Hall 3 west of it with an inbound dock of its own (IN 3) on the west wall, Hall 4 behind the wing, reached through the wing's
  // north wall. Each is a steel-framed box with its floor, roof, skylights, high bays, two rack rows and a doorway into the hall it
  // opens off, cut into that wall from the first day and shuttered until the hall is bought. The rows are plain storage: pickers,
  // the forklift, the AGV and the receivers use them; the cranes stay over the main rows. Rows are numbered from 20 so the main
  // rows (0 to 4) and the deck row (5) keep their meaning.
  var HALLS = {
    hall2: { name: 'Hall 2', x0: 10.0, x1: HALL.x, z0: -44, z1: -HALL.z, door: { x0: 17.0, x1: 20.6, h: 4.2, z: -HALL.z }, rows: [20, 21], rowZ: [-30, -37], rowX0: 12.5, bays: 7, lights: [[15, -39], [23, -39], [31, -39], [15, -29], [23, -29], [31, -29]] },
    hall3: { name: 'Hall 3', x0: -HALL.x, x1: -14.0, z0: -44, z1: -HALL.z, door: { x0: -28.5, x1: -26.0, h: 3.6, z: -HALL.z }, rows: [22, 23], rowZ: [-29.5, -38.5], rowX0: -33.0, bays: 5, lights: [[-31, -39], [-23, -39], [-17, -39], [-31, -29], [-23, -29], [-17, -29]], dockIn: 2 },
    hall4: { name: 'Hall 4', x0: -14, x1: 10, z0: -64, z1: -44, door: { x0: 5.0, x1: 8.6, h: 4.2, z: -44 }, rows: [24, 25], rowZ: [-50.5, -57.5], rowX0: -12.5, bays: 7, lights: [[-8, -59], [0, -59], [8, -59], [-8, -49], [0, -49], [8, -49]] }
  };
  var HALL_OF_ROW = {}; for (var hk in HALLS) HALLS[hk].rows.forEach(function (r) { HALL_OF_ROW[r] = hk; });
  function hallOwned(id) { return !!(S.up && S.up[id]); }
  function hallOfRow(r) { return HALL_OF_ROW[r] || null; }
  function isAnnexRow(r) { return r >= 20; }
  function annexRowOwned(r) { var h = hallOfRow(r); return !!h && hallOwned(h); }
  function rowBays(r) { var h = hallOfRow(r); return h ? HALLS[h].bays : RACK.bays; }
  function rowLetter(r) { if (r === UPPER.row) return 'U'; if (isAnnexRow(r)) return 'HIJKLM'[r - 20]; return 'ABCDEF'[r]; }
  // the rows a walker, the forklift or the AGV can reach: the main rows you own and the rows of the halls you own
  function groundRows() { var out = []; for (var r = 0; r < S.up.rows; r++) out.push(r); for (var h in HALLS) if (hallOwned(h)) HALLS[h].rows.forEach(function (r) { out.push(r); }); return out; }
  function slotTotal() { var n = 0; groundRows().forEach(function (r) { n += rowBays(r) * RACK.levels.length; }); if (upperOwned()) n += RACK.bays * UPPER.levels; return n; }
  function inRectH(x, z, H) { return x > H.x0 && x < H.x1 && z > H.z0 && z < H.z1; }
  function inAnnex(x, z) { for (var h in HALLS) if (hallOwned(h) && inRectH(x, z, HALLS[h])) return h; return null; }
  function inAnyAnnexFootprint(x, z) { for (var h in HALLS) if (inRectH(x, z, HALLS[h])) return h; return null; }
  // where a walker may stand: the main hall, the halls you own, and the wing once Hall 4 opens behind it (all inset from their walls)
  function insideWalk(x, z) {
    var m = 0.35;
    if (Math.abs(x) < HALL.x - m && Math.abs(z) < HALL.z - m) return true;
    for (var h in HALLS) { var H = HALLS[h]; if (hallOwned(h) && x > H.x0 + m && x < H.x1 - m && z > H.z0 + m && z < H.z1 - m) return true; }
    if (hallOwned('hall4') && x > WING.x0 + m && x < WING.x1 - m && z > WING.z0 + m && z < WING.z1 - m) return true;
    return false;
  }
  // ── The build ─────────────────────────────────────────────────────
  // ── The build: a steel box dressed like the main hall ─────────────
  // Every inside face gets the main hall's lining: the block dado with its rail, the two girts, the cable tray, an I-beam column
  // with a bump guard every eight metres, a clerestory window every four on the outside walls. Over it the roof with its trusses,
  // skylights and vents; outside, the gutter and downpipes. The doorway gets jambs, a lintel, a strip curtain, the way-out sign.
  function hallSegs(a0, a1, cuts) { var out = [[a0, a1]]; cuts.forEach(function (cc) { var nx = []; out.forEach(function (s) { if (cc[1] <= s[0] || cc[0] >= s[1]) { nx.push(s); return; } if (cc[0] > s[0]) nx.push([s[0], cc[0]]); if (cc[1] < s[1]) nx.push([cc[1], s[1]]); }); out = nx; }); return out.filter(function (s) { return s[1] - s[0] > 0.3; }); }
  function hallDado(len, DH) { var m = MAT.block.clone(); m.map = MAT.block.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(len / 1.6, DH / 0.8); m.normalMap = MAT.block.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set(len / 1.6, DH / 0.8); return m; }
  function hallColumn(c, x, z, alongZ) {
    var FR = MAT.steelDark, h = HALL.h - 0.3; c.box(alongZ ? 0.26 : 0.02, h, alongZ ? 0.02 : 0.26, FR, x, h / 2, z);
    [-0.12, 0.12].forEach(function (o) { c.box(alongZ ? 0.02 : 0.3, h, alongZ ? 0.3 : 0.02, FR, x + (alongZ ? o : 0), h / 2, z + (alongZ ? 0 : o)); });
    c.box(0.42, 0.03, 0.42, FR, x, 0.015, z); [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(function (b) { c.cyl(0.018, 0.03, MAT.chrome, x + b[0], 0.04, z + b[1], 6); });
    c.box(0.46, 0.5, 0.46, MAT.hazard, x, 0.28, z).castShadow = false; c.solid(x - 0.16, x + 0.16, z - 0.16, z + 0.16, 0, h);
  }
  // one inside face: axis 'x' is a wall along z standing at x = at; axis 'z' a wall along x at z = at; inward points into the hall
  function hallFace(c, axis, at, inward, a0, a1, cuts, opts) {
    var FR = MAT.steelDark, DH = 2.4, ry = axis === 'x' ? (inward > 0 ? Math.PI / 2 : -Math.PI / 2) : (inward > 0 ? 0 : Math.PI), off = at + inward * 0.17, full = a1 - a0, c0 = (a0 + a1) / 2;
    hallSegs(a0 + 0.3, a1 - 0.3, cuts).forEach(function (s) { var len = s[1] - s[0], mid = (s[0] + s[1]) / 2; if (axis === 'x') { c.plane(len, DH, hallDado(len, DH), off, DH / 2, mid, 0, ry); c.box(0.06, 0.05, len, FR, off + inward * 0.02, DH + 0.025, mid); } else { c.plane(len, DH, hallDado(len, DH), mid, DH / 2, off, 0, ry); c.box(len, 0.05, 0.06, FR, mid, DH + 0.025, off + inward * 0.02); } });
    var g = at + inward * 0.22; [5.2, 6.8].forEach(function (gy) { if (axis === 'x') c.box(0.06, 0.12, full, FR, g, gy, c0); else c.box(full, 0.12, 0.06, FR, c0, gy, g); });
    if (opts.tray) { var ty = at + inward * 0.35; if (axis === 'x') { c.box(0.3, 0.08, full - 1, FR, ty, 5.6, c0); for (var t = a0 + 1; t < a1; t += 2) c.box(0.3, 0.08, 0.04, FR, ty, 5.6, t); } else { c.box(full - 1, 0.08, 0.3, FR, c0, 5.6, ty); for (var t2 = a0 + 1; t2 < a1; t2 += 2) c.box(0.04, 0.08, 0.3, FR, t2, 5.6, ty); } }
    for (var p = a0 + 4; p < a1 - 1; p += 8) { if (cuts.some(function (cc) { return p > cc[0] - 0.6 && p < cc[1] + 0.6; })) continue; hallColumn(c, axis === 'x' ? at + inward * 0.42 : p, axis === 'x' ? p : at + inward * 0.42, axis === 'x'); }
    if (opts.windows) { var wy = 6.0, ww = 2.4, wh = 1.3, woff = at + inward * 0.2; for (var wp = a0 + 4; wp < a1 - 2; wp += 4) { if (cuts.some(function (cc) { return wp > cc[0] - 1.5 && wp < cc[1] + 1.5; })) continue; if (axis === 'x') { c.box(0.04, wh + 0.12, ww + 0.12, FR, woff - inward * 0.02, wy, wp); c.plane(ww, wh, MAT.skylight, woff, wy, wp, 0, ry); c.box(0.05, wh, 0.05, FR, woff + inward * 0.01, wy, wp); c.box(0.05, 0.05, ww, FR, woff + inward * 0.01, wy, wp); } else { c.box(ww + 0.12, wh + 0.12, 0.04, FR, wp, wy, woff - inward * 0.02); c.plane(ww, wh, MAT.skylight, wp, wy, woff, 0, ry); c.box(0.05, wh, 0.05, FR, wp, wy, woff + inward * 0.01); c.box(ww, 0.05, 0.05, FR, wp, wy, woff + inward * 0.01); } } }
  }
  function hallBuild(id) { return function (c) {
    var H = HALLS[id], h = HALL.h, cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2, wx = H.x1 - H.x0, wz = H.z1 - H.z0, FR = MAT.steelDark, D = H.door;
    var ownW = id !== 'hall2', ownE = id !== 'hall3';   // Hall 2 leans on the wing's east wall, Hall 3 on its west wall; those stand already
    c.box(wx + 0.6, 1.2, wz + 0.3, MAT.grey, cx, YARD_Y + 0.6, cz - 0.15);   // the plinth
    var fl = c.plane(wx, wz, MAT.floor, cx, 0.001, cz, -Math.PI / 2, 0); fl.receiveShadow = true;
    c.plane(wx - 0.4, 0.12, MAT.trim, cx, 0.06, H.z0 + 0.16, 0, 0);   // the skirting line along the far wall
    var wallSeg = function (axis, at, a0, a1, y0, y1) { var len = a1 - a0, mid = (a0 + a1) / 2, hh = y1 - y0; if (len <= 0.01 || hh <= 0.01) return; if (axis === 'x') { c.box(len, hh, 0.3, MAT.wall, mid, y0 + hh / 2, at); c.solid(a0, a1, at - 0.15, at + 0.15, y0 === 0 ? -1 : y0, y1 + 1); } else { c.box(0.3, hh, len, MAT.wall, at, y0 + hh / 2, mid); c.solid(at - 0.15, at + 0.15, a0, a1, y0 === 0 ? -1 : y0, y1 + 1); } };
    wallSeg('x', H.z0, H.x0 - 0.15, H.x1 + 0.15, 0, h);   // the far wall
    var dockCut = id === 'hall3' ? [DOCKS.in[2].z - DOCKS.w / 2, DOCKS.in[2].z + DOCKS.w / 2] : null;
    if (ownW) { if (dockCut) { wallSeg('z', H.x0, H.z0, dockCut[0], 0, h); wallSeg('z', H.x0, dockCut[0], dockCut[1], DOCKS.h, h); wallSeg('z', H.x0, dockCut[1], H.z1, 0, h); } else wallSeg('z', H.x0, H.z0, H.z1, 0, h); }
    if (ownE) wallSeg('z', H.x1, H.z0, H.z1, 0, h);
    // the roof: slab, inner face, three skylight strips, trusses along z, purlins across, two roof vents
    c.box(wx + 0.6, 0.3, wz + 0.6, MAT.roof, cx, h + 0.15, cz); c.plane(wx, wz, MAT.roofIn, cx, h - 0.01, cz, Math.PI / 2, 0);
    [H.z0 + 4.5, cz, H.z1 - 4.5].forEach(function (z) { var sk = c.plane(wx - 4, 1.4, MAT.skylight, cx, h - 0.02, z, Math.PI / 2, 0); world.lampMeshes.push(sk); });
    for (var tx = Math.ceil((H.x0 + 2) / 8) * 8; tx < H.x1 - 1; tx += 8) c.box(0.25, 0.6, wz - 0.4, FR, tx, h - 0.35, cz);
    for (var pz = H.z0 + 3; pz < H.z1 - 1; pz += 4) c.box(wx - 0.4, 0.12, 0.12, FR, cx, h - 0.1, pz);
    [cx - wx / 4, cx + wx / 4].forEach(function (vx) { c.cyl(0.45, 0.6, MAT.steel, vx, h + 0.6, cz, 12); c.cyl(0.6, 0.15, FR, vx, h + 0.95, cz, 12); });
    H.lights.forEach(function (p, i) { highBay(p[0], 7.0, p[1]); var l = new THREE.PointLight(i % 3 === 2 ? 0xf3f0ff : 0xffeacc, 0.55, 28, 2); l.position.set(p[0], 7.3, p[1]); l.userData.warm = i % 3 !== 2; scene.add(l); hallLights.push(l); });
    // the inside faces: the far wall with the tray and windows, the wall it opens off with the doorway cut, the two sides
    var dcut = [D.x0 - 0.1, D.x1 + 0.1];
    hallFace(c, 'z', H.z0, 1, H.x0, H.x1, [], { windows: true, tray: true });
    hallFace(c, 'z', H.z1, -1, H.x0, H.x1, [dcut], { windows: false });
    hallFace(c, 'x', H.x0, 1, H.z0, H.z1, dockCut ? [dockCut] : [], { windows: ownW });
    hallFace(c, 'x', H.x1, -1, H.z0, H.z1, [], { windows: ownE });
    // the doorway: jambs and a lintel, a strip curtain, the hall's name over it on both sides, the way out inside, bollards, hazard strips
    var dcx = (D.x0 + D.x1) / 2, dz = D.z, dw = D.x1 - D.x0, strip = std({ color: 0xdfe8ee, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }); strip.userData.noBake = true;
    [D.x0 - 0.1, D.x1 + 0.1].forEach(function (jx) { c.box(0.2, D.h, 0.5, FR, jx, D.h / 2, dz); }); c.box(dw + 0.4, 0.14, 0.5, FR, dcx, D.h - 0.04, dz);
    for (var sx2 = D.x0 + 0.15; sx2 < D.x1; sx2 += 0.3) { var st = c.plane(0.28, D.h - 0.2, strip, sx2, (D.h - 0.2) / 2, dz + (sx2 * 7 % 1) * 0.02 - 0.01, 0, 0); st.rotation.y = ((sx2 * 13) % 1 - 0.5) * 0.08; }
    c.sign([H.name.toUpperCase()], 2.0, 0.5, dcx, D.h + 0.55, dz + 0.3, 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.sign(['WAY OUT  →  MAIN HALL'], 1.8, 0.4, dcx, D.h + 0.55, dz - 0.3, Math.PI, { w: 512, h: 112, bg: '#1e7a3a', fg: '#fff' });
    [D.x0 - 0.6, D.x1 + 0.6].forEach(function (bx) { [dz - 0.9, dz + 0.9].forEach(function (bz) { c.cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, 10); c.cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, 10); c.solid(bx - 0.12, bx + 0.12, bz - 0.12, bz + 0.12, 0, 1.0); }); });
    c.plane(dw, 1.6, MAT.hazard, dcx, 0.0065, dz - 0.9, -Math.PI / 2, 0); c.plane(dw, 1.6, MAT.hazard, dcx, 0.0065, dz + 0.9, -Math.PI / 2, 0);
    // floor markings: the rack block edges, the walkway along the wall you come in by, the hall's name painted at the doorway
    var rx0 = H.rowX0 - 0.4, rx1 = H.rowX0 + H.bays * RACK.bayW + 0.4; c.plane(0.1, wz - 1, MAT.yellowLine, rx0, 0.006, cz, -Math.PI / 2, 0); c.plane(0.1, wz - 1, MAT.yellowLine, rx1, 0.006, cz, -Math.PI / 2, 0);
    c.plane(wx - 1, 0.1, MAT.yellowLine, cx, 0.006, H.z1 - 1.6, -Math.PI / 2, 0); c.plane(wx - 1, 0.1, MAT.yellowLine, cx, 0.006, H.z1 - 2.8, -Math.PI / 2, 0);
    var lbl = new THREE.MeshBasicMaterial({ map: textTex([H.name.toUpperCase()], { w: 512, h: 128, bg: '#8b8d8e', fg: '#d9a12c' }) }); c.plane(2.2, 0.55, lbl, dcx, 0.0066, dz - 2.2, -Math.PI / 2, 0);
    if (id === 'hall3') { c.plane(1.6, DOCKS.w - 0.4, MAT.hazard, H.x0 + 0.8, 0.008, DOCKS.in[2].z, -Math.PI / 2, 0); [-1, 1].forEach(function (s) { var bz = DOCKS.in[2].z + s * (DOCKS.w / 2 + 0.5); c.cyl(0.11, 1.0, MAT.yellow, H.x0 + 1.0, 0.5, bz, 10); c.cyl(0.14, 0.05, MAT.black, H.x0 + 1.0, 0.025, bz, 10); }); }
    // outside: the gutter and downpipes on the far wall, gutters down the sides, the painted name high on the far wall inside
    c.box(wx + 0.4, 0.16, 0.16, FR, cx, h - 0.05, H.z0 - 0.25); [H.x0 + 1, H.x1 - 1].forEach(function (dx) { c.cyl(0.07, h + 1.1, FR, dx, (h - 1.2) / 2 + 0.05, H.z0 - 0.25, 8); });
    if (ownW) { c.box(0.16, 0.16, wz, FR, H.x0 - 0.25, h - 0.05, cz); c.cyl(0.07, h + 1.1, FR, H.x0 - 0.25, (h - 1.2) / 2 + 0.05, H.z1 - 2, 8); } if (ownE) { c.box(0.16, 0.16, wz, FR, H.x1 + 0.25, h - 0.05, cz); c.cyl(0.07, h + 1.1, FR, H.x1 + 0.25, (h - 1.2) / 2 + 0.05, H.z1 - 2, 8); }
    c.sign([H.name.toUpperCase(), 'DEPOT CO.'], 4.0, 1.2, cx, 4.3, H.z0 + 0.17, 0, { w: 512, h: 160, bg: '#1b232c', fg: '#f5b53d' });
  }; }
  // the shutter in a doorway the hall has not been bought for yet: a closed roller door and its sign
  function shutterBuild(id) { return function (c) {
    if (hallOwned(id)) return;
    var D = HALLS[id].door, w = D.x1 - D.x0, cx = (D.x0 + D.x1) / 2;
    c.box(w, D.h, 0.12, MAT.door, cx, D.h / 2, D.z); for (var y = 0.5; y < D.h; y += 0.5) c.box(w, 0.04, 0.14, MAT.steelDark, cx, y, D.z);
    c.sign([HALLS[id].name.toUpperCase(), 'in the shop'], 1.6, 0.5, cx, D.h / 2, D.z + 0.08, 0, { w: 448, h: 128, bg: '#1b232c', fg: '#a0acb8' }); c.sign([HALLS[id].name.toUpperCase()], 1.6, 0.5, cx, D.h / 2, D.z - 0.08, Math.PI, { w: 448, h: 128, bg: '#1b232c', fg: '#a0acb8' });
    c.solid(D.x0 - 0.1, D.x1 + 0.1, D.z - 0.2, D.z + 0.2, 0, D.h);
    c.hit(w, D.h, 0.5, cx, D.h / 2, D.z, { prompt: function () { var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; return HALLS[id].name + ' · ' + (u ? money(u.price) + ' in the shop' : 'not open') + (u && u.needs && !S.up[u.needs] ? ' · needs ' + upgradeName(u.needs).toLowerCase() : ''); }, use: function () { sfx('click'); } });
  }; }
  for (var hid in HALLS) (function (id) {
    var H = HALLS[id];
    defProp(id, { label: H.name, cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, build: hallBuild(id), when: function () { return hallOwned(id); } });
    defProp('shut' + id, { label: H.name + ' shutter', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, build: shutterBuild(id) });
    H.rows.forEach(function (r, k) { defProp('rack' + r, { label: H.name + ' rack row ' + 'HIJKLM'[r - 20], cat: 'hall', abs: true, keep: true, fixed: true, x: H.rowX0 - RACK.x0, z: H.rowZ[k], rot: 0, build: rackBuild(r), when: function () { return hallOwned(id); } }); });
  })(hid);
  for (var hfid in HALLS) (function (id) {
    var H = HALLS[id], when = function () { return hallOwned(id); }, cx = (H.x0 + H.x1) / 2, D = H.door;
    defProp('ext' + id, { label: H.name + ' extinguisher', cat: 'wall', wall: true, abs: true, keep: true, x: H.x1 - 2.5, z: H.z0 + 0.17, rot: 0, build: extinguisherBuild, when: when });
    defProp('posterExit' + id, { label: H.name + ' fire-exit poster', cat: 'wall', wall: true, abs: true, keep: true, x: D.x1 + 1.6, z: D.z - 0.17, rot: 2, build: posterBuild('exit', 0.6, 0.9), when: when });
    defProp('posterSmoke' + id, { label: H.name + ' no-smoking poster', cat: 'wall', wall: true, abs: true, keep: true, x: H.x0 + 2.5, z: H.z0 + 0.17, rot: 0, build: posterBuild('smoke', 0.6, 0.8), when: when });
    defProp('clock' + id, { label: H.name + ' clock', cat: 'wall', wall: true, abs: true, keep: true, x: cx + 3.2, z: H.z0 + 0.3, rot: 0, build: function (c) { var f = clockBuild(0.4); f(c); }, when: when });
    defProp('aisle' + id, { label: H.name + ' aisle sign', cat: 'hall', abs: true, keep: true, fixed: true, x: cx, z: (H.rowZ[0] + H.rowZ[1]) / 2, rot: 0, build: aisleSignBuild(H.name.toUpperCase() + ' · ' + 'HIJKLM'[H.rows[0] - 20] + ' / ' + 'HIJKLM'[H.rows[1] - 20]), when: when });
  })(hfid);
  defProp('consoleIn2', { label: 'dock console IN 3', cat: 'wall', wall: true, abs: true, x: -29.7, z: -31.5, rot: 1, build: consoleBuild(5), when: function () { return hallOwned('hall3'); } });
  // buying a hall: it stands, its rows stand, its shutter goes, Hall 3 gets its dock door and lane, the silo moves out of Hall 3's way
  function buildHall(id) {
    var H = HALLS[id];
    if (id === 'hall3') { var sp = propPlacement('silo'); if (inRectH(sp.x, sp.z, H) || (sp.x > H.x0 - 3 && sp.x < H.x1 + 3 && sp.z > H.z0 - 3 && sp.z < H.z1 + 3)) { S.layout.silo = { x: -26, z: -50, rot: 0 }; buildProp('silo'); } if (!doors[5]) { buildDoor(5, -1, DOCKS.in[2].z); if (yard.dock) yard.dock(doors[5]); } buildProp('consoleIn2'); }
    buildProp(id); H.rows.forEach(function (r) { buildProp('rack' + r); }); buildProp('shut' + id); ['ext', 'posterExit', 'posterSmoke', 'clock', 'aisle'].forEach(function (k) { buildProp(k + id); });
    NAV.dirty = true; shadowDirty = true; beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); }
    logEvent(H.name + ' is open: ' + H.rows.length + ' rack rows of ' + H.bays + ' bays' + (id === 'hall3' ? ', and IN 3 on its west wall' : ''), 'good');
  }
