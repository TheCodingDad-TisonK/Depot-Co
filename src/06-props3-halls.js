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
    hall2: { name: 'Hall 2', x0: 10.3, x1: HALL.x, z0: -44, z1: -HALL.z, door: { x0: 17.0, x1: 20.6, h: 4.2, z: -HALL.z }, rows: [20, 21], rowZ: [-30, -37], rowX0: 12.5, bays: 7, lights: [[17, -29], [30, -29], [17, -39], [30, -39]] },
    hall3: { name: 'Hall 3', x0: -HALL.x, x1: -14.3, z0: -44, z1: -HALL.z, door: { x0: -28.5, x1: -26.0, h: 3.6, z: -HALL.z }, rows: [22, 23], rowZ: [-29.5, -38.5], rowX0: -33.0, bays: 5, lights: [[-30, -29], [-19, -29], [-30, -39], [-19, -39]], dockIn: 2 },
    hall4: { name: 'Hall 4', x0: -14, x1: 10, z0: -64, z1: -44, door: { x0: 5.0, x1: 8.6, h: 4.2, z: -44 }, rows: [24, 25], rowZ: [-50.5, -57.5], rowX0: -12.5, bays: 7, lights: [[-7, -49], [4, -49], [-7, -59], [4, -59]] }
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
  function hallBuild(id) { return function (c) {
    var H = HALLS[id], h = HALL.h, cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2, wx = H.x1 - H.x0, wz = H.z1 - H.z0, FR = MAT.steelDark;
    c.box(wx + 0.6, 1.2, wz + 0.3, MAT.grey, cx, YARD_Y + 0.6, cz - 0.15);   // the plinth
    var fl = c.plane(wx, wz, MAT.floor, cx, 0.001, cz, -Math.PI / 2, 0); fl.receiveShadow = true;
    // walls: the one it opens off already stands (the main north wall, or the wing's); the others are its own, with the dock cut out of Hall 3's west wall
    var wallSeg = function (axis, at, a0, a1, y0, y1) { var len = a1 - a0, mid = (a0 + a1) / 2, hh = y1 - y0; if (len <= 0.01 || hh <= 0.01) return; if (axis === 'x') { c.box(len, hh, 0.3, MAT.wall, mid, y0 + hh / 2, at); c.solid(a0, a1, at - 0.15, at + 0.15, y0 === 0 ? -1 : y0, y1 + 1); } else { c.box(0.3, hh, len, MAT.wall, at, y0 + hh / 2, mid); c.solid(at - 0.15, at + 0.15, a0, a1, y0 === 0 ? -1 : y0, y1 + 1); } };
    if (id !== 'hall4') wallSeg('x', H.z0, H.x0 - 0.15, H.x1 + 0.15, 0, h); else wallSeg('x', H.z0, H.x0 - 0.15, H.x1 + 0.15, 0, h);   // the north wall
    // the side walls: Hall 3's west wall carries IN 3; the east wall of Hall 2 continues the main east wall; the inner walls stand against the wing's
    var sides = id === 'hall2' ? [[H.x0, []], [H.x1, []]] : id === 'hall3' ? [[H.x0, [{ z0: DOCKS.in[2].z - DOCKS.w / 2, z1: DOCKS.in[2].z + DOCKS.w / 2, h: DOCKS.h }]], [H.x1, []]] : [[H.x0, []], [H.x1, []]];
    sides.forEach(function (sd) { var x = sd[0], z = H.z0; sd[1].forEach(function (o) { wallSeg('z', x, z, o.z0, 0, h); wallSeg('z', x, o.z0, o.z1, o.h, h); z = o.z1; }); wallSeg('z', x, z, H.z1, 0, h); });
    // roof, skylights, trusses, high bays
    c.box(wx + 0.6, 0.3, wz + 0.6, MAT.roof, cx, h + 0.15, cz); c.plane(wx, wz, MAT.roofIn, cx, h - 0.01, cz, Math.PI / 2, 0);
    [H.z0 + 5, H.z0 + 12, H.z0 + 17].forEach(function (z) { if (z < H.z1 - 1) { var sk = c.plane(wx - 4, 1.4, MAT.skylight, cx, h - 0.02, z, Math.PI / 2, 0); world.lampMeshes.push(sk); } });
    for (var tz = H.z0 + 4; tz < H.z1 - 1; tz += 6) c.box(wx - 0.4, 0.5, 0.22, FR, cx, h - 0.3, tz);
    H.lights.forEach(function (p, i) { highBay(p[0], 7.3 - 0.3, p[1]); var l = new THREE.PointLight(i % 3 === 2 ? 0xf3f0ff : 0xffeacc, 0.55, 28, 2); l.position.set(p[0], 7.3, p[1]); l.userData.warm = i % 3 !== 2; scene.add(l); hallLights.push(l); });
    // the doorway: a lintel on the inside, a sign both sides, bollards, a hazard strip on the floor
    var D = H.door, dz = D.z, dcx = (D.x0 + D.x1) / 2, inside = id === 'hall4' ? -1 : 1;   // inside: which way the hall it opens off lies (+z for the main hall, -z... no: Hall 4 opens off the wing which lies at larger z)
    c.box(D.x1 - D.x0 + 0.4, 0.14, 0.44, FR, dcx, D.h - 0.04, dz);
    c.sign([H.name.toUpperCase()], 2.0, 0.5, dcx, D.h + 0.55, dz + 0.17, 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.sign([H.name.toUpperCase(), 'to the main hall'], 2.0, 0.5, dcx, D.h + 0.55, dz - 0.17, Math.PI, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' });
    [D.x0 - 0.5, D.x1 + 0.5].forEach(function (bx) { [dz - 0.9, dz + 0.9].forEach(function (bz) { c.cyl(0.11, 1.0, MAT.yellow, bx, 0.5, bz, 10); c.cyl(0.14, 0.05, MAT.black, bx, 0.025, bz, 10); c.solid(bx - 0.12, bx + 0.12, bz - 0.12, bz + 0.12, 0, 1.0); }); });
    c.plane(D.x1 - D.x0, 1.6, MAT.hazard, dcx, 0.0065, dz - 0.9, -Math.PI / 2, 0); c.plane(D.x1 - D.x0, 1.6, MAT.hazard, dcx, 0.0065, dz + 0.9, -Math.PI / 2, 0);
    // floor markings: the rack block edges and a walkway along the inner wall; a hall sign high on the north wall
    var rx0 = H.rowX0 - 0.4, rx1 = H.rowX0 + H.bays * RACK.bayW + 0.4; c.plane(0.1, wz - 1, MAT.yellowLine, rx0, 0.006, cz, -Math.PI / 2, 0); c.plane(0.1, wz - 1, MAT.yellowLine, rx1, 0.006, cz, -Math.PI / 2, 0);
    c.sign([H.name.toUpperCase(), 'DEPOT CO.'], 4.0, 1.2, cx, 5.6, H.z0 + 0.17, 0, { w: 512, h: 160, bg: '#1b232c', fg: '#f5b53d' });
    if (id === 'hall3') { c.plane(1.6, DOCKS.w - 0.4, MAT.hazard, H.x0 + 0.8, 0.008, DOCKS.in[2].z, -Math.PI / 2, 0); }
    void inside;
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
  defProp('consoleIn2', { label: 'dock console IN 3', cat: 'wall', wall: true, abs: true, x: -29.7, z: -31.5, rot: 1, build: consoleBuild(5), when: function () { return hallOwned('hall3'); } });
  // buying a hall: it stands, its rows stand, its shutter goes, Hall 3 gets its dock door and lane, the silo moves out of Hall 3's way
  function buildHall(id) {
    var H = HALLS[id];
    if (id === 'hall3') { var sp = propPlacement('silo'); if (inRectH(sp.x, sp.z, H) || (sp.x > H.x0 - 3 && sp.x < H.x1 + 3 && sp.z > H.z0 - 3 && sp.z < H.z1 + 3)) { S.layout.silo = { x: -26, z: -50, rot: 0 }; buildProp('silo'); } if (!doors[5]) { buildDoor(5, -1, DOCKS.in[2].z); if (yard.dock) yard.dock(doors[5]); } buildProp('consoleIn2'); }
    buildProp(id); H.rows.forEach(function (r) { buildProp('rack' + r); }); buildProp('shut' + id);
    NAV.dirty = true; shadowDirty = true; beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); }
    logEvent(H.name + ' is open: ' + H.rows.length + ' rack rows of ' + H.bays + ' bays' + (id === 'hall3' ? ', and IN 3 on its west wall' : ''), 'good');
  }
