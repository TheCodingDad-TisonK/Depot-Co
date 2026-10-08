//@ the hall: floor, walls, dock doors, racks, office, packing bench, break corner, the yard outside; the shed when the stage is the shed
  // ── The building ──────────────────────────────────────────────────
  var doors = [];          // 0,1 inbound (west wall), 2,3 outbound (east wall): { side, z, panel, anim, control }
  var rackGroups = [null, null, null, null];
  var slotHits = {};       // key -> hit mesh
  var bayLabelTex = {};
  var world = { boardTex: null, boardCtx: null, boardMat: null, lampMeshes: [], officeLamp: null, cot: null, coffeeMachine: null, pcScreen: null };

  function slotKey(r, b, l) { return r + ',' + b + ',' + l; }
  function slotParse(key) { var p = key.split(',').map(Number); return { r: p[0], b: p[1], l: p[2] }; }
  function rackSlotPos(r, b, l) { var P = PROPS['rack' + r] ? propPlacement('rack' + r) : { x: 0, z: RACK.rows[r], rot: 0 }, a = P.rot * Math.PI / 2, lx = RACK.x0 + RACK.bayW * (b + 0.5); return { x: P.x + lx * Math.cos(a), y: RACK.levels[l] + (r === UPPER.row ? UPPER.y : 0), z: P.z - lx * Math.sin(a), ry: a }; }
  function slotName(key) { var p = slotParse(key); return rowName(p.r) + ', bay ' + (p.b + 1) + (p.l === 0 ? ', floor' : p.l === 1 ? ', shelf' : ', top'); }
  function rowName(r) { return r === UPPER.row ? 'Upper row' : isAnnexRow(r) ? HALLS[hallOfRow(r)].name + ' row ' + rowLetter(r) : 'Row ' + 'ABCDEF'[r]; }

  // 1.21.0: the building is built for the stage the page booted at (BOOT_STAGE). The shed is the same code with the hall numbers of
  // a 14 x 10 m box: one roller door, a person door, no rooms, no wing, no fire exit. The rooms were authored for the 48 m deep hall:
  // zs slides the south rooms (office, lobby) with the south wall, zn slides the break room with the north wall; X-relative numbers
  // take care of the rest.
  function buildWorld() {
    var X = HALL.x, Z = HALL.z, H = HALL.h, zs = Z - 24, zn = 24 - Z, rooms = stageHas('rooms');
    // the hall floor (the ground outside is the yard's job)
    var fl = plane(2 * X, 2 * Z, MAT.floor, 0, 0.001, 0, -Math.PI / 2); fl.receiveShadow = true;
    // walls: four, with the dock doors cut out of the west and east ones and a staff door on the west
    function wallX(x, side) {                                   // a wall along z at x, openings at the docks
      var openings = (side < 0 ? DOCKS.in : DOCKS.out).filter(function (d) { return Math.abs(d.z) < HALL.z - 1; }).map(function (d) { return { z0: d.z - DOCKS.w / 2, z1: d.z + DOCKS.w / 2, h: Math.min(DOCKS.h, H - 0.6) }; });   // IN 3 is in Hall 3's wall, not this one
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
    // the north wall: the belt opening and the doorway into the production wing (the hall stage), the fire exit (any hall), and the
    // doorways into Halls 2 and 3 (the big hall, cut from the first day and shuttered until bought), cut out of it
    var nOpen = [];
    if (stageHas('wing')) nOpen.push({ x0: WING.belt.x0, x1: WING.belt.x1, h: WING.belt.h }, { x0: WING.door.x0, x1: WING.door.x1, h: WING.door.h });
    if (rooms) nOpen.push({ x0: FIRE_X - 0.6, x1: FIRE_X + 0.6, h: 2.3 });
    if (stageHas('hallDoors')) nOpen.push({ x0: HALLS.hall2.door.x0, x1: HALLS.hall2.door.x1, h: HALLS.hall2.door.h }, { x0: HALLS.hall3.door.x0, x1: HALLS.hall3.door.x1, h: HALLS.hall3.door.h });
    nOpen.sort(function (a, b) { return a.x0 - b.x0; }); var nx = -X - 0.15;
    nOpen.forEach(function (o) { if (o.x0 > nx) { box(o.x0 - nx, H, 0.3, MAT.wall, (nx + o.x0) / 2, H / 2, -Z); solid(nx, o.x0, -Z - 0.15, -Z + 0.15); } box(o.x1 - o.x0, H - o.h, 0.3, MAT.wall, (o.x0 + o.x1) / 2, o.h + (H - o.h) / 2, -Z); solid(o.x0, o.x1, -Z - 0.15, -Z + 0.15, o.h, 9); nx = o.x1; });
    box(X + 0.15 - nx, H, 0.3, MAT.wall, (nx + X + 0.15) / 2, H / 2, -Z); solid(nx, X + 0.15, -Z - 0.15, -Z + 0.15);
    box(2 * X + 0.3, H, 0.3, MAT.wall, 0, H / 2, Z); solid(-X - 0.15, X + 0.15, Z - 0.15, Z + 0.15);
    // roof with skylight strips, and the trusses under it
    box(2 * X + 0.6, 0.3, 2 * Z + 0.6, MAT.roof, 0, H + 0.15, 0);
    plane(2 * X, 2 * Z, MAT.roofIn, 0, H - 0.01, 0, Math.PI / 2);
    SKYLIGHT_Z.forEach(function (z) { var sk = plane(2 * X - 4, 1.6, MAT.skylight, 0, H - 0.02, z, Math.PI / 2); world.lampMeshes.push(sk); });
    for (var tx = -X + 4; tx <= X - 4; tx += 8) { box(0.25, 0.6, 2 * Z - 0.4, MAT.steelDark, tx, H - 0.35, 0); }   // trusses every eight metres the whole width (nine across the 72 m)
    // high-bay lamps under the trusses: a conduit drop off the truss, the ballast box, a spun reflector and the lens in its mouth
    hallLights.forEach(function (l) { highBay(l.position.x, l.position.y + 0.3, l.position.z); });
    if (rooms) buildHallLining(); else buildShedLining();
    // floor markings: aisles, the walkway, the staging squares
    function lineX(x0, x1, z, w) { plane(x1 - x0, w || 0.1, MAT.yellowLine, (x0 + x1) / 2, 0.006, z, -Math.PI / 2); }
    function lineZ(z0, z1, x, w) { plane(w || 0.1, z1 - z0, MAT.yellowLine, x, 0.006, (z0 + z1) / 2, -Math.PI / 2); }
    function square(cx, cz, s) { lineX(cx - s / 2, cx + s / 2, cz - s / 2); lineX(cx - s / 2, cx + s / 2, cz + s / 2); lineZ(cz - s / 2, cz + s / 2, cx - s / 2); lineZ(cz - s / 2, cz + s / 2, cx + s / 2); }
    square(SPOT.stageIn.x, SPOT.stageIn.z, rooms ? 3.4 : 2.6); if (rooms) square(SPOT.stageOut.x, SPOT.stageOut.z, 3.0);   // SHIPPING stood under the sea spiral and the OUT 1 bay since 1.14: it is by OUT 2 now, between the land spiral and the bench
    if (rooms) {
      lineX(-X + 0.3, X - 7.8, 18.2 + zs); lineX(-X + 0.3, X - 7.8, 19.4 + zs);              // the pedestrian walkway along the south strip, lobby to office
      lineZ(-Z + 1.6, 18.2 + zs, FIRE_X + 0.9); lineZ(-Z + 1.6, 19.4 + zs, FIRE_X + 2.1);      // up the east side to the fire exit; the strip under the deck is the machines' since 1.14 (cells, wrapper, jack 2), so no walkway is painted along the north wall any more
      plane(1.6, 1.4, MAT.hazard, FIRE_X, 0.0065, -Z + 1.0, -Math.PI / 2);                   // keep clear in front of the fire exit
    }
    var rz0 = RACK.rows[0] - 1.0, rz1 = RACK.rows[RACK.rows.length - 1] + 1.0, rx1 = RACK.x0 + RACK.bays * RACK.bayW;
    lineZ(rz0, rz1, RACK.x0 - 0.4); lineZ(rz0, rz1, rx1 + 0.4); if (rooms) lineZ(rz0, rz1, RACK.x0 - 1.6);   // the rack block edges along the block only (the east one stood 3.4 m past the last bay, on the walkway line), and the outer line of the west walkway
    // dock doors
    DOCKS.in.forEach(function (d, i) { if (i === 2 && !S.up.hall3) return; buildDoor(doorIndex('in', i), -1, d.z); });   // IN 3 comes with Hall 3
    DOCKS.out.forEach(function (d, i) { buildDoor(doorIndex('out', i), 1, d.z); });
    if (S.up.hall2 && DOCKS.ret[0]) buildDoor(6, 1, DOCKS.ret[0].z);   // the returns dock comes with the returns hall
    // the staff door: a frame, and a ramp down to the yard outside it
    box(0.1, 2.3, 0.08, MAT.steelDark, -X, 1.15, SPOT.staffDoor.z - 0.62); box(0.1, 2.3, 0.08, MAT.steelDark, -X, 1.15, SPOT.staffDoor.z + 0.62); box(0.1, 0.08, 1.3, MAT.steelDark, -X, 2.32, SPOT.staffDoor.z);
    var ramp = box(7.2, 0.2, 2, MAT.grey, -X - 3.6, -0.7, SPOT.staffDoor.z); ramp.rotation.z = Math.atan2(1.2, 7); ramp.position.y = -0.6 - 0.1;
    box(7.2, 0.9, 0.08, MAT.steelDark, -X - 3.6, -0.25, SPOT.staffDoor.z - 1).rotation.z = Math.atan2(1.2, 7); box(7.2, 0.9, 0.08, MAT.steelDark, -X - 3.6, -0.25, SPOT.staffDoor.z + 1).rotation.z = Math.atan2(1.2, 7);
    // the rooms, the wing and their doors, by stage
    if (rooms) {
      buildOffice(); buildBench(); buildBreakRoom();
      hingedDoor('office', X - 7.5, 19.45 + zs, false, 'the office door', { window: true, swing: 1 });
      hingedDoor('lobby', -X + 4.5, 19.45 + zs, false, 'the lobby door', { window: true, swing: -1 });
      hingedDoor('break', -X + 7, -22.95 + zn, false, 'the break room door', { window: true, swing: -1 });
    }
    if (stageHas('wing')) buildWing();
    hingedDoor('staff', -X, SPOT.staffDoor.z - 0.5, false, 'the staff door', { mat: MAT.steelDark, swing: 1 });
    if (rooms) hingedDoor('exit', FIRE_X - 0.5, -Z, true, 'the fire exit', { mat: MAT.steelDark, pushbar: true, swing: 1 });   // the hinge half a leaf west of the cut's centre, so the metre of leaf fills the 1.2 m cut instead of standing half in the wall with a gap beside it
    buildYard(); buildDressing(); buildControlCabinet(); buildProps();
  }

  var HIGHBAY_REFL = std({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide });   // one reflector material for every lamp: thirty of them bake into one draw instead of thirty
  function highBay(x, y, z) {
    cyl(0.025, HALL.h - y - 0.22, MAT.steelDark, x, (HALL.h + y + 0.22) / 2, z, null, 6);   // the conduit drop from the roof to the ballast box
    box(0.34, 0.22, 0.26, MAT.steelDark, x, y + 0.11, z); box(0.1, 0.06, 0.06, MAT.black, x + 0.2, y + 0.12, z);
    var refl = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.14, 0.42, 20, 1, true), HIGHBAY_REFL); refl.position.set(x, y - 0.21, z); scene.add(refl);
    var lens = cyl(0.42, 0.03, MAT.lamp, x, y - 0.41, z, null, 20); lens.castShadow = false; world.lampMeshes.push(lens);
  }
  // a recessed troffer in a room's ceiling: a white frame and a prismatic lens that dims when the power is off
  function troffer(x, y, z, w, d) { box(w || 1.2, 0.05, d || 0.6, MAT.trim, x, y - 0.025, z).castShadow = false; var lens = box((w || 1.2) - 0.1, 0.02, (d || 0.6) - 0.1, MAT.lamp, x, y - 0.045, z); lens.castShadow = false; world.lampMeshes.push(lens); return lens; }
  // the shed inside: bare cladding on steel posts, a girt at head height, a skirting board, a bulb on a flex over the table and a tin sign
  function buildShedLining() {
    var X = HALL.x, Z = HALL.z, H = HALL.h;
    [[-X, -Z], [X, -Z], [-X, Z], [X, Z], [0, -Z], [0, Z], [-X, 0]].forEach(function (p) { var ox = p[0] === 0 ? 0 : (p[0] < 0 ? 0.2 : -0.2), oz = p[1] === 0 ? 0 : (p[1] < 0 ? 0.2 : -0.2); box(0.12, H - 0.2, 0.12, MAT.steelDark, p[0] + ox, (H - 0.2) / 2, p[1] + oz); });
    box(2 * X - 0.4, 0.08, 0.06, MAT.steelDark, 0, 2.6, -Z + 0.2); box(2 * X - 0.4, 0.08, 0.06, MAT.steelDark, 0, 2.6, Z - 0.2); box(0.06, 0.08, 2 * Z - 0.4, MAT.steelDark, X - 0.2, 2.6, 0);
    box(2 * X - 0.4, 0.12, 0.03, MAT.trim, 0, 0.06, -Z + 0.17).castShadow = false; box(2 * X - 0.4, 0.12, 0.03, MAT.trim, 0, 0.06, Z - 0.17).castShadow = false; box(0.03, 0.12, 2 * Z - 0.4, MAT.trim, X - 0.17, 0.06, 0).castShadow = false;
    sign(['DEPOT CO.', 'est. day one'], 1.6, 0.6, 0, 3.6, -Z + 0.18, 0, { w: 448, h: 160, bg: '#1b232c', fg: '#f5b53d', size: 56 });   // the first sign, hand painted on the far wall
    world.liningCuts = { cutZ: { '-1': [[SPOT.staffDoor.z - 0.65, SPOT.staffDoor.z + 0.65]].concat(DOCKS.in.map(function (d) { return [d.z - 1.8, d.z + 1.8]; })), '1': [] }, cutX: { '-1': [], '1': [] } };   // the grime strips skip the doors
  }
  // what a cladded hall looks like from inside: a painted blockwork dado to 2.4 m under a steel capping, I-section columns every
  // 8 m carrying the girts the cladding hangs on, two girts above every opening, and a cable tray round every wall. The rooms
  // have their own plaster lining, so the dado and the columns stop at their walls.
  function buildHallLining() {
    var X = HALL.x, Z = HALL.z, H = HALL.h, DH = 2.4, sd = SPOT.staffDoor.z, zs = Z - 24, zn = 24 - Z;
    var dockCut = function (d) { return [d.z - DOCKS.w / 2 - 0.3, d.z + DOCKS.w / 2 + 0.3]; };
    var cutZ = { '-1': DOCKS.in.filter(function (d) { return Math.abs(d.z) < Z - 1; }).map(dockCut).concat([[sd - 0.65, sd + 0.65], [18.4 + zs, Z], [-Z, -20.1 + zn]]), '1': DOCKS.out.filter(function (d) { return Math.abs(d.z) < Z - 1; }).map(dockCut).concat([[18.4 + zs, Z]]) };   // the docks (OUT 3 since 1.14.2: the dado and a column stood in its doorway), the staff door, the lobby, the break room; the office
    var cutX = { '-1': [[-X, -X + 7.1], [FIRE_X - 0.7, FIRE_X + 0.7]], '1': [[X - 7.6, X], [-X, -X + 4.6]] };   // the break room, the fire exit; the office, the lobby
    if (stageHas('wing')) cutX['-1'].push([WING.belt.x0 - 0.1, WING.belt.x1 + 0.1], [WING.door.x0 - 0.1, WING.door.x1 + 0.1]);
    if (stageHas('hallDoors')) cutX['-1'].push([HALLS.hall2.door.x0 - 0.1, HALLS.hall2.door.x1 + 0.1], [HALLS.hall3.door.x0 - 0.1, HALLS.hall3.door.x1 + 0.1]);   // the hall doorways too, since 1.14.1
    world.liningCuts = { cutZ: cutZ, cutX: cutX };
    function segs(a0, a1, cuts) { var out = [[a0, a1]]; cuts.forEach(function (c) { var nx = []; out.forEach(function (s) { if (c[1] <= s[0] || c[0] >= s[1]) { nx.push(s); return; } if (c[0] > s[0]) nx.push([s[0], c[0]]); if (c[1] < s[1]) nx.push([c[1], s[1]]); }); out = nx; }); return out.filter(function (s) { return s[1] - s[0] > 0.3; }); }
    function dadoMat(len) { var m = MAT.block.clone(); m.map = MAT.block.map.clone(); m.map.needsUpdate = true; m.map.repeat.set(len / 1.6, DH / 0.8); m.normalMap = MAT.block.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set(len / 1.6, DH / 0.8); return m; }
    function wall(axis, side) {
      var at = (axis === 'x' ? X : Z) * side, inward = -side, cuts = axis === 'x' ? cutZ[String(side)] : cutX[String(side)], lim = axis === 'x' ? Z : X;
      var ry = axis === 'x' ? (inward > 0 ? Math.PI / 2 : -Math.PI / 2) : (inward > 0 ? 0 : Math.PI), off = at + inward * 0.17;
      segs(-lim + 0.3, lim - 0.3, cuts).forEach(function (s) {
        var len = s[1] - s[0], mid = (s[0] + s[1]) / 2;
        if (axis === 'x') { plane(len, DH, dadoMat(len), off, DH / 2, mid, 0, ry); box(0.06, 0.05, len, MAT.steelDark, off + inward * 0.02, DH + 0.025, mid); }
        else { plane(len, DH, dadoMat(len), mid, DH / 2, off, 0, ry); box(len, 0.05, 0.06, MAT.steelDark, mid, DH + 0.025, off + inward * 0.02); }
      });
      // clerestory windows: a glazed strip between the two girts, a window every four metres, framed with a cross mullion (Tyson, 2026-10-06)
      var wy = H - 2.0, ww = 2.4, wh = 1.3, woff = at + inward * 0.2;
      for (var wp = -lim + (axis === 'x' ? 4 : 6); wp < lim - 2; wp += 4) {
        if (axis === 'z' && side < 0 && stageHas('wing')) continue;   // the production wing and the annex halls stand behind the north wall: no sky to see
        if (axis === 'x') { box(0.04, wh + 0.12, ww + 0.12, MAT.steelDark, woff - inward * 0.035, wy, wp); plane(ww, wh, MAT.skylight, woff, wy, wp, 0, ry); box(0.05, wh, 0.05, MAT.steelDark, woff + inward * 0.01, wy, wp); box(0.05, 0.05, ww, MAT.steelDark, woff + inward * 0.01, wy, wp); }
        else { box(ww + 0.12, wh + 0.12, 0.04, MAT.steelDark, wp, wy, woff - inward * 0.035); plane(ww, wh, MAT.skylight, wp, wy, woff, 0, ry); box(0.05, wh, 0.05, MAT.steelDark, wp, wy, woff + inward * 0.01); box(ww, 0.05, 0.05, MAT.steelDark, wp, wy, woff + inward * 0.01); }
      }
      // the girts and the cable tray run the whole wall; a column every 8 m, set where no door, console or sign stands
      var full = 2 * lim - 0.6, c0 = 0, g = at + inward * 0.25;
      [H - 2.8, H - 1.2].forEach(function (gy) { if (axis === 'x') box(0.06, 0.12, full, MAT.steelDark, g, gy, c0); else box(full, 0.12, 0.06, MAT.steelDark, c0, gy, g); });
      if (axis === 'x' || side > 0) { if (axis === 'x') { box(0.3, 0.08, full, MAT.steelDark, at + inward * 0.35, H - 2.4, c0); for (var ct = -lim + 1; ct < lim; ct += 2) box(0.3, 0.08, 0.04, MAT.steelDark, at + inward * 0.35, H - 2.4, ct); } else { box(full, 0.08, 0.3, MAT.steelDark, c0, H - 2.4, at + inward * 0.35); for (var ct2 = -lim + 1; ct2 < lim; ct2 += 2) box(0.04, 0.08, 0.3, MAT.steelDark, ct2, H - 2.4, at + inward * 0.35); } }
      var cols = (axis === 'x' ? [-18, -10, -2, 6, 14] : side > 0 ? [-28, -20, -12, -4, 4, 12, 20] : [-24, -16, -8, 0, 10, 22, 30]).filter(function (p) { return Math.abs(p) < lim - 1.5; });
      cols.forEach(function (p) { if (cuts.some(function (c) { return p > c[0] - 0.3 && p < c[1] + 0.3; })) return; var cx = axis === 'x' ? at + inward * 0.42 : p, cz = axis === 'x' ? p : at + inward * 0.42; column(cx, cz, axis === 'x'); });
    }
    function column(x, z, alongZ) {
      var h = H - 0.3; box(alongZ ? 0.26 : 0.02, h, alongZ ? 0.02 : 0.26, MAT.steelDark, x, h / 2, z);
      [-0.12, 0.12].forEach(function (o) { box(alongZ ? 0.02 : 0.3, h, alongZ ? 0.3 : 0.02, MAT.steelDark, x + (alongZ ? o : 0), h / 2, z + (alongZ ? 0 : o)); });
      box(0.42, 0.03, 0.42, MAT.steelDark, x, 0.015, z); [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(function (b) { cyl(0.018, 0.03, MAT.chrome, x + b[0], 0.04, z + b[1], null, 6); });
      box(0.46, 0.5, 0.46, MAT.hazard, x, 0.28, z).castShadow = false;   // the bump guard every forklift hall paints on
      solid(x - 0.16, x + 0.16, z - 0.16, z + 0.16, 0, h);
    }
    wall('x', -1); wall('x', 1); wall('z', -1); wall('z', 1);
  }
  function buildDoor(i, side, z) {
    var x = side * HALL.x, ud = i < 6 && upperOwned() && z < UPPER.z1 + 0.3, dh = Math.min(DOCKS.h, HALL.h - 0.6);   // a main-hall door under the deck strip: its fittings keep under the deck plate at 4.6 m; dh: the shed's roof is lower than a dock door
    var panel = new THREE.Mesh(boxGeo(0.12, dh, DOCKS.w), MAT.door); panel.castShadow = true; panel.receiveShadow = true;
    panel.position.set(x - side * 0.22, dh / 2, z); scene.add(panel);
    // the dock leveller: a plate from the hall edge out over the slot to the trailer bed, with a hinged lip and a hazard edge
    var lev = box(0.72, 0.05, 2.3, MAT.chequer, side * (HALL.x + 0.1), 0.0, z); lev.receiveShadow = true; box(0.2, 0.03, 2.3, MAT.hazard, side * (HALL.x + 0.5), 0.02, z).rotation.z = side * 0.12; box(0.06, 0.08, 2.3, MAT.steelDark, side * (HALL.x - 0.22), -0.02, z);
    var d = { i: i, side: side, z: z, panel: panel, anim: S.doors[i] ? 1 : 0, h: dh };
    addInter(panel, { prompt: function () { return S.doors[i] ? null : DOOR_MAP[i].dir === 'out' && !dockOwned(DOOR_MAP[i].dock) ? 'OUT 3 · air freight dock · opens with the sortation deck · E opens the shop' : (S.events.power ? 'No power: the door motor is dead' : 'Open dock door ' + dockLabel(i) + (dockLane(i) && lanesOn() ? ' (' + dockLane(i).name.toLowerCase() + ' lane)' : '') + (BOOT_STAGE === 0 ? '' : ' · the cabinet and the consoles close it')); }, use: function () { if (DOOR_MAP[i].dir === 'out' && !dockOwned(DOOR_MAP[i].dock)) { if (!driving && !pc.on) openPanel('pc', 'shop'); return; } if (!S.events.power) setDoor(i, true); else toast('No power. Flip the breaker in the office.', 'bad'); } });   // E on the shut OUT 3 goes to the shop, where the deck that opens it is sold
    // a pull cord inside, to bring a door down without walking to the cabinet
    var cord = cyl(0.01, 1.2, MAT.red, x - side * 0.35, dh - 0.6, z - DOCKS.w / 2 - 0.3, null, 4); var knob = box(0.08, 0.12, 0.08, MAT.red, x - side * 0.35, dh - 1.25, z - DOCKS.w / 2 - 0.3);
    addInter(knob, { prompt: function () { return S.doors[i] ? 'Pull the cord: close dock door ' + dockLabel(i) : null; }, use: function () { if (S.doors[i]) setDoor(i, false); } });
    // bumpers, the number outside, the leveller plate, the sign inside
    box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z - DOCKS.w / 2 + 0.3); box(0.3, 0.5, 0.3, MAT.rubber, x + side * 0.3, -0.35, z + DOCKS.w / 2 - 0.3);
    var numY = Math.min(dh + 1.3, HALL.h - 0.7), numS = Math.min(1.2, HALL.h - dh - 0.2);
    sign([DOOR_MAP[i].dir === 'ret' ? 'R' : String(DOOR_MAP[i].dock + 1)], numS, numS, x + side * 0.17, numY, z, side < 0 ? -Math.PI / 2 : Math.PI / 2, { w: 128, h: 128, bg: '#f5b53d', fg: '#1a1205' });
    plane(1.6, DOCKS.w - 0.4, MAT.hazard, x - side * 0.8, 0.008, z, -Math.PI / 2);
    var inY = ud ? dh + 0.17 : Math.min(dh + 0.6, HALL.h - 0.45);
    sign([dockLabel(i) + (dockLane(i) && lanesOn() ? ' · ' + dockLane(i).name.toUpperCase() : '')], ud ? 1.6 : 2.4, ud ? 0.3 : Math.min(0.7, HALL.h - dh - 0.1), x - side * 0.17, inY, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: DOOR_MAP[i].dir !== 'out' ? '#f5b53d' : (dockLane(i) ? dockLane(i).col : '#5fd38d') });
    doors[i] = d;
  }
  function dockLabel(i) { var d = DOOR_MAP[i]; if (!d) return '?'; if (BOOT_STAGE === 0 && d.dir === 'out') return 'the van'; return d.dir === 'ret' ? 'RETURNS' : (d.dir === 'in' ? 'IN ' : 'OUT ') + (d.dock + 1); }
  function dockLane(i) { var d = DOOR_MAP[i]; return d && d.dir === 'out' && TRUCK_OUT[d.dock] ? MODES[TRUCK_OUT[d.dock].mode] : null; }
  function setDoor(i, open) { if (S.doors[i] === open) return; if (!doors[i]) return false; if (open && DOOR_MAP[i].dir === 'out' && !dockOwned(DOOR_MAP[i].dock)) { toast('OUT 3 opens with the sortation deck.', 'bad'); return false; } S.doors[i] = open; sfx('roller'); logEvent('Dock door ' + dockLabel(i) + (open ? ' opened' : ' closed')); if (open && i < 2) introStep('door'); rebuildDyn(); return true; }
  function doorAnim(dt) {
    // the pose is applied every frame, so a door loaded open looks open without waiting for a toggle
    doors.forEach(function (d) { var t = S.doors[d.i] ? 1 : 0; if (d.anim !== t) d.anim = clamp(d.anim + (t ? dt : -dt) / 1.6, 0, 1); var sc = 1 - d.anim * 0.93, dh = d.h || DOCKS.h; d.panel.scale.y = sc; d.panel.position.y = dh - dh * sc / 2; });
  }
  function doorPassable(i) { return !!doors[i] && doors[i].anim > 0.6; }

  function buildRack(r) { if (PROPS['rack' + r]) buildProp('rack' + r); }
  // a rack row as a prop: uprights with bracing and base plates, beams with end plates, mesh decks, bay labels, slot hit volumes, the end guards
  function rackBuild(r) {
    return function (c) {
      var x0 = RACK.x0, bw = RACK.bayW, dz = RACK.depth / 2 - 0.05, nb = rowBays(r), RH = Math.min(5, HALL.h - 0.3);   // nb: the annex rows are shorter, the shed's row grows a bay a level; RH: the uprights stop under the shed roof
      for (var b = 0; b <= nb; b++) {
        var ux = x0 + b * bw;
        [-dz, dz].forEach(function (oz) { c.box(0.1, RH, 0.1, MAT.rack, ux, RH / 2, oz); c.box(0.18, 0.02, 0.18, MAT.steelDark, ux, 0.01, oz); for (var hh = 0.3; hh < RH - 0.1; hh += 0.35) c.box(0.02, 0.05, 0.06, MAT.steelDark, ux + 0.05, hh, oz); });
        for (var br = 0; br < Math.floor(RH - 0.3); br++) { var yb = 0.4 + br * 1.0; c.box(0.04, 0.04, RACK.depth - 0.1, MAT.rack, ux, yb, 0); var dg = c.box(0.04, 0.04, Math.sqrt((RACK.depth - 0.1) * (RACK.depth - 0.1) + 1.0), MAT.rack, ux, yb + 0.5, 0); dg.rotation.x = (br % 2 ? 1 : -1) * Math.atan2(1.0, RACK.depth - 0.1); }
      }
      for (var l = 1; l < RACK.levels.length; l++) {
        var y = RACK.levels[l];
        c.box(nb * bw, 0.12, 0.08, MAT.beam, x0 + nb * bw / 2, y - 0.06, -dz); c.box(nb * bw, 0.12, 0.08, MAT.beam, x0 + nb * bw / 2, y - 0.06, dz);
        for (var bp = 0; bp <= nb; bp++) { c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, -dz); c.box(0.14, 0.2, 0.1, MAT.beam, x0 + bp * bw, y - 0.06, dz); }
        for (var bb2 = 0; bb2 < nb; bb2++) { var dk = c.plane(bw - 0.2, RACK.depth - 0.2, MAT.mesh, x0 + (bb2 + 0.5) * bw, y - 0.005, 0, -Math.PI / 2, 0); dk.receiveShadow = false; c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, -0.3); c.box(bw - 0.2, 0.03, 0.03, MAT.steelDark, x0 + (bb2 + 0.5) * bw, y - 0.02, 0.3); }
      }
      for (var bb = 0; bb < nb; bb++) {
        var cx = x0 + (bb + 0.5) * bw, lbl = rowLetter(r) + (bb + 1); if (!bayLabelTex[lbl]) bayLabelTex[lbl] = textTex([lbl], { w: 128, h: 64, bg: '#1b232c', fg: '#f5b53d' });
        var lm = new THREE.MeshBasicMaterial({ map: bayLabelTex[lbl] });
        [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), lm); p.position.set(cx, RH - 0.25, s * (dz + 0.06)); p.rotation.y = s > 0 ? 0 : Math.PI; c.add(p); });
        for (var ll = 0; ll < RACK.levels.length; ll++) (function (rr, b2, l2) {
          var key = slotKey(rr, b2, l2), hh2 = l2 === 2 ? 1.6 : 1.45;
          slotHits[key] = c.hit(bw - 0.2, hh2, RACK.depth, cx, RACK.levels[l2] + hh2 / 2, 0, { slot: key, prompt: function () { return slotPrompt(key); }, use: function () { slotUse(key); } });
        })(r, bb, ll);
      }
      c.solid(x0 - 0.1, x0 + nb * bw + 0.1, -RACK.depth / 2, RACK.depth / 2, 0, RH);
      [-1, 1].forEach(function (s) { var x = s > 0 ? x0 + nb * bw + 0.3 : x0 - 0.3; c.box(0.12, 0.4, RACK.depth + 0.3, MAT.yellow, x, 0.2, 0); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, -RACK.depth / 2 - 0.1); c.box(0.12, 0.4, 0.12, MAT.yellow, x, 0.2, RACK.depth / 2 + 0.1); c.sign(['MAX LOAD', '1000 kg / level', 'ROW ' + rowLetter(r)], 0.5, 0.5, x + s * 0.06, 1.6, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, { w: 256, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 34 }); });
    };
  }
  // a painted lining on a room's outer walls: a plane just inside the cladding, skirting along the floor, a dado rail, with openings left for doors
  function lineWall(axis, at, a0, a1, h, mat, openings, inward) {
    var segs = [[a0, a1]]; (openings || []).forEach(function (o) { var out = []; segs.forEach(function (s) { if (o[1] <= s[0] || o[0] >= s[1]) { out.push(s); return; } if (o[0] > s[0]) out.push([s[0], o[0]]); if (o[1] < s[1]) out.push([o[1], s[1]]); }); segs = out; });
    var off = at + inward * 0.17, ry = axis === 'x' ? (inward > 0 ? Math.PI / 2 : -Math.PI / 2) : (inward > 0 ? 0 : Math.PI);
    function strip(w, hh, y, mid, m) { if (axis === 'x') { plane(w, hh, m, off, y, mid, 0, ry); } else { plane(w, hh, m, mid, y, off, 0, ry); } }
    segs.forEach(function (s) { var w = s[1] - s[0], mid = (s[0] + s[1]) / 2; strip(w, h, h / 2, mid, mat); var sk = axis === 'x' ? box(0.03, 0.12, w, MAT.trim, off + inward * 0.012, 0.06, mid) : box(w, 0.12, 0.03, MAT.trim, mid, 0.06, off + inward * 0.012); sk.receiveShadow = true; if (axis === 'x') box(0.025, 0.05, w, MAT.trim, off + inward * 0.01, 0.95, mid); else box(w, 0.05, 0.025, MAT.trim, mid, 0.95, off + inward * 0.01); });
    (openings || []).forEach(function (o) { if (o[2] && o[2] < h) { var w = o[1] - o[0], mid = (o[0] + o[1]) / 2; strip(w, h - o[2], o[2] + (h - o[2]) / 2, mid, mat); } });
  }
  var LINING = { lobby: std({ map: TEX.plaster, color: 0xd9e3ea, roughness: 0.85, normalMap: NRM.plaster, normalScale: new THREE.Vector2(0.3, 0.3) }), brk: std({ map: TEX.plaster, color: 0xf0e6cf, roughness: 0.85, normalMap: NRM.plaster, normalScale: new THREE.Vector2(0.3, 0.3) }), office: std({ map: TEX.plaster, color: 0xe6e8e4, roughness: 0.85, normalMap: NRM.plaster, normalScale: new THREE.Vector2(0.3, 0.3) }) };
  function buildOffice() {
    var X = HALL.x, Z = HALL.z, zs = Z - 24, x0 = X - 7.5, z0 = 18.5 + zs, h = 3.2;
    // the wall along x = x0 with a doorway, the wall along z = z0 with a window, and a ceiling
    box(0.15, h, 0.8, MAT.plaster, x0, h / 2, z0 + 0.4); box(0.15, h, Z - (20.6 + zs), MAT.plaster, x0, h / 2, 20.6 + zs + (Z - (20.6 + zs)) / 2); box(0.15, h - 2.2, 1.3, MAT.plaster, x0, 2.2 + (h - 2.2) / 2, 19.95 + zs);
    solid(x0 - 0.08, x0 + 0.08, z0, 19.3 + zs); solid(x0 - 0.08, x0 + 0.08, 20.6 + zs, Z);
    box(1.5, h, 0.15, MAT.plaster, x0 + 0.75, h / 2, z0); box(2, h, 0.15, MAT.plaster, X - 1, h / 2, z0);
    box(X - 3.5 - x0, 1.1, 0.15, MAT.plaster, (x0 + 1.5 + X - 2) / 2, 0.55, z0); box(X - 3.5 - x0, h - 2.3, 0.15, MAT.plaster, (x0 + 1.5 + X - 2) / 2, 2.3 + (h - 2.3) / 2, z0);
    box(X - 3.5 - x0, 1.2, 0.04, MAT.glass, (x0 + 1.5 + X - 2) / 2, 1.7, z0);
    solid(x0, X, z0 - 0.08, z0 + 0.08);
    box(X - x0, 0.12, Z - z0, MAT.plaster, (x0 + X) / 2, h + 0.06, (z0 + Z) / 2);
    lineWall('x', X, z0 + 0.1, Z - 0.1, h, LINING.office, [], -1); lineWall('z', Z, x0 + 0.1, X - 0.1, h, LINING.office, [], -1);
    plane(X - x0 - 0.2, Z - z0 - 0.2, MAT.tile, (x0 + X) / 2, h - 0.01, (z0 + Z) / 2, Math.PI / 2);
    world.officeLamp = troffer(X - 3.5, h, 21 + zs); troffer(x0 + 1.9, h, 22.5 + zs, 0.6, 0.6);
    // carpet tiles over the slab, skirting on the two plaster walls (the hall walls get theirs from lineWall), a bin by the desk
    roomFloor(MAT.carpet, x0 + 0.08, X - 0.16, z0 + 0.08, Z - 0.16, 1.0);
    [[z0, 19.3 + zs], [20.6 + zs, Z]].forEach(function (s) { box(0.03, 0.12, s[1] - s[0], MAT.trim, x0 + 0.09, 0.06, (s[0] + s[1]) / 2).castShadow = false; }); box(X - x0, 0.12, 0.03, MAT.trim, (x0 + X) / 2, 0.06, z0 + 0.09).castShadow = false;
    cyl(0.14, 0.3, std({ color: 0x2a2d33, roughness: 0.6 }), X - 1.2, 0.15, 19.4 + zs, null, 12, 0.12); box(0.16, 0.02, 0.16, MAT.paper, X - 1.2, 0.3, 19.4 + zs).rotation.y = 0.4;
  }
  // a room's own floor laid over the slab: the texture repeats in metres so a carpet tile is half a metre wherever it is
  function roomFloor(mat, x0, x1, z0, z1, per) {
    var m = mat.clone(); m.map = mat.map.clone(); m.map.needsUpdate = true; m.map.repeat.set((x1 - x0) / per, (z1 - z0) / per);
    if (mat.normalMap) { m.normalMap = mat.normalMap.clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set((x1 - x0) / per, (z1 - z0) / per); }
    var p = plane(x1 - x0, z1 - z0, m, (x0 + x1) / 2, 0.012, (z0 + z1) / 2, -Math.PI / 2); p.receiveShadow = true; return p;
  }

  function buildBench() {
    var bx = SPOT.bench.x, bz = SPOT.bench.z;
    // the two dock consoles by the outbound doors: dispatch a loaded truck early
  }

  // the entrance lobby (south-west corner) and the break room (north-west corner, above IN 1), both walled like the office
  function buildBreakRoom() {
    var X = HALL.x, Z = HALL.z, zs = Z - 24, zn = 24 - Z, h = 3.2;
    // the lobby: x -30..-25.5, z 18.5..24 in the big hall; its door onto the hall at z 19.45..20.45 in the east wall, a window south of it
    var x0 = -X + 4.5, z0 = 18.5 + zs;
    box(0.15, h, 0.8, MAT.plaster, x0, h / 2, z0 + 0.4); box(0.15, h - 2.2, 1.3, MAT.plaster, x0, 2.2 + (h - 2.2) / 2, 19.95 + zs);
    box(0.15, h, 0.6, MAT.plaster, x0, h / 2, 20.9 + zs); box(0.15, 1.1, 2.6, MAT.plaster, x0, 0.55, 22.5 + zs); box(0.15, h - 2.3, 2.6, MAT.plaster, x0, 2.3 + (h - 2.3) / 2, 22.5 + zs); box(0.04, 1.2, 2.6, MAT.glass, x0, 1.7, 22.5 + zs); box(0.15, h, 0.2, MAT.plaster, x0, h / 2, Z - 0.1);
    solid(x0 - 0.08, x0 + 0.08, z0, 19.3 + zs); solid(x0 - 0.08, x0 + 0.08, 20.6 + zs, Z);
    box(X + x0, h, 0.15, MAT.plaster, (-X + x0) / 2, h / 2, z0); solid(-X, x0, z0 - 0.08, z0 + 0.08);
    box(X + x0, 0.12, Z - z0, MAT.plaster, (-X + x0) / 2, h + 0.06, (z0 + Z) / 2);
    lineWall('x', -X, z0 + 0.1, Z - 0.1, h, LINING.lobby, [[SPOT.staffDoor.z - 0.65, SPOT.staffDoor.z + 0.65, 2.25]], 1); lineWall('z', Z, -X + 0.1, x0 - 0.1, h, LINING.lobby, [], -1); plane(X + x0 - 0.2, Z - z0 - 0.2, MAT.tile, (-X + x0) / 2, h - 0.01, (z0 + Z) / 2, Math.PI / 2);
    troffer(-X + 2.3, h, 21.2 + zs);
    roomFloor(MAT.vinyl, -X + 0.16, x0 - 0.08, z0 + 0.08, Z - 0.16, 1.5);
    [[z0, 19.3 + zs], [20.6 + zs, Z]].forEach(function (s) { box(0.03, 0.12, s[1] - s[0], MAT.trim, x0 - 0.09, 0.06, (s[0] + s[1]) / 2).castShadow = false; }); box(X + x0, 0.12, 0.03, MAT.trim, (-X + x0) / 2, 0.06, z0 + 0.09).castShadow = false;
    for (var bl = 0; bl < 14; bl++) box(0.02, 0.05, 2.5, MAT.trim, x0 - 0.09, 2.26 - bl * 0.08, 22.5 + zs);   // inside the lobby
    // the break room: x -30..-23, z -24..-20.2 in the big hall; its door in the east wall at z -22.95..-21.95, a window in the south wall onto the hall
    var bx = -X + 7, bz = -20.2 + zn;
    box(0.15, h, 1.05, MAT.plaster, bx, h / 2, -Z + 0.525); box(0.15, h - 2.2, 1.3, MAT.plaster, bx, 2.2 + (h - 2.2) / 2, -22.45 + zn); box(0.15, h, 1.75, MAT.plaster, bx, h / 2, bz - 0.875);
    solid(bx - 0.08, bx + 0.08, -Z, -22.95 + zn); solid(bx - 0.08, bx + 0.08, -21.95 + zn, bz);
    box(1.0, h, 0.15, MAT.plaster, -X + 0.5, h / 2, bz); box(1.2, h, 0.15, MAT.plaster, bx - 0.6, h / 2, bz);
    box(X + bx - 2.2, 1.1, 0.15, MAT.plaster, (-X + 1 + bx - 1.2) / 2, 0.55, bz); box(X + bx - 2.2, h - 2.3, 0.15, MAT.plaster, (-X + 1 + bx - 1.2) / 2, 2.3 + (h - 2.3) / 2, bz); box(X + bx - 2.2, 1.2, 0.04, MAT.glass, (-X + 1 + bx - 1.2) / 2, 1.7, bz);
    solid(-X, bx, bz - 0.08, bz + 0.08);
    box(X + bx, 0.12, Z + bz, MAT.plaster, (-X + bx) / 2, h + 0.06, (-Z + bz) / 2);
    lineWall('x', -X, -Z + 0.1, bz - 0.1, h, LINING.brk, [], 1); lineWall('z', -Z, -X + 0.1, bx - 0.1, h, LINING.brk, [], 1); plane(X + bx - 0.2, Z + bz - 0.2, MAT.tile, (-X + bx) / 2, h - 0.01, (-Z + bz) / 2, Math.PI / 2);
    troffer(-X + 3.5, h, -22.1 + zn);
    roomFloor(MAT.vinyl, -X + 0.16, bx - 0.08, -Z + 0.16, bz - 0.08, 1.5);
    [[-Z, -22.95 + zn], [-21.95 + zn, bz]].forEach(function (s) { box(0.03, 0.12, s[1] - s[0], MAT.trim, bx - 0.09, 0.06, (s[0] + s[1]) / 2).castShadow = false; }); box(X + bx, 0.12, 0.03, MAT.trim, (-X + bx) / 2, 0.06, bz - 0.09).castShadow = false;
    for (var bl2 = 0; bl2 < 14; bl2++) box(4.6, 0.05, 0.02, MAT.trim, -X + 3.6, 2.26 - bl2 * 0.08, bz - 0.09);
  }
  // the order board on the office wall: redrawn when orders change
  function drawBoard(sc) {
    var c = world.boardCtx; if (!c) return; var w = 768, h = 384; sc = sc || world.boardScreen;
    c.fillStyle = '#0d1b2a'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f5b53d'; c.font = 'bold 30px Bahnschrift, Arial, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('OPEN ORDERS', 24, 44); c.font = '22px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8'; c.textAlign = 'right'; c.fillText('Day ' + S.day + '  ' + fmtTime(S.time), w - 24, 44);
    c.textAlign = 'left';
    var all = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed'; }), per = 7, pages = Math.max(1, Math.ceil(all.length / per)), lanes = lanesOn();
    // the page: the one you wheeled to, for a while after the wheel turn; otherwise the board turns its own pages every six seconds
    var page = sc && sc.userScrollAt && worldTime - sc.userScrollAt < 12 ? clamp(sc.scroll || 0, 0, pages - 1) : (pages > 1 ? Math.floor(worldTime / 6) % pages : 0);
    if (sc) { sc.scrollMax = pages - 1; sc.scroll = page; }
    var open = all.slice(page * per, page * per + per);
    if (!all.length) { c.fillStyle = '#5fd38d'; c.font = '26px Bahnschrift, Arial, sans-serif'; c.fillText('Nothing waiting. Nice.', 24, 110); }
    open.forEach(function (o, i) {
      var y = 90 + i * 40, lane = MODES[orderMode(o)];   // the lane chip: which door the parcel leaves by (once there is more than one)
      if (lanes) { c.fillStyle = lane.col; c.beginPath(); if (c.roundRect) c.roundRect(24, y - 21, 62, 27, 6); else c.rect(24, y - 21, 62, 27); c.fill(); c.fillStyle = '#0d1b2a'; c.font = 'bold 17px Bahnschrift, Arial, sans-serif'; c.textAlign = 'center'; c.fillText(lane.name.toUpperCase(), 55, y - 1); c.textAlign = 'left'; }
      c.fillStyle = o.state === 'packed' ? '#5fd38d' : (o.rush ? '#ff6b5e' : '#eef1f5'); c.font = 'bold 22px Bahnschrift, Arial, sans-serif';
      c.fillText('#' + o.num + '  ' + clientName(o.client), lanes ? 98 : 24, y);
      c.font = '20px Bahnschrift, Arial, sans-serif'; c.fillStyle = '#a0acb8';
      c.fillText(o.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ').slice(0, 46), 330, y);
      c.textAlign = 'right'; c.fillStyle = o.state === 'packed' ? '#5fd38d' : '#f5b53d'; c.fillText(o.state === 'packed' ? 'PACKED' : 'due ' + fmtTime(o.due), w - 24, y); c.textAlign = 'left';
    });
    if (pages > 1) { c.fillStyle = '#6b7784'; c.font = '18px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText('page ' + (page + 1) + ' of ' + pages + ' · ' + all.length + ' orders · the wheel turns the page', w - 24, h - 16); c.textAlign = 'left'; }
    world.boardTex.needsUpdate = true;
  }

  // where the player stands: the hall floor, a docked trailer's floor, the ramp, or the yard
  function floorY(x, z, y) {   // y: how high the asker already is; the mezzanine deck counts only for someone up there
    var uy = upperFloorY(x, z, y); if (uy !== null) return uy;
    if ((Math.abs(x) < HALL.x && Math.abs(z) < HALL.z) || inWing(x, z) || inAnnex(x, z)) return 0;
    for (var i = 0; i < S.trucks.length; i++) { var t = S.trucks[i]; if (t.state !== 'docked' || t.van) continue; var b = trailerBounds(t); if (x > b.x0 - 0.7 && x < b.x1 + 0.7 && z > b.z0 && z < b.z1) return 0; }   // the van's bed is not a floor you walk onto: you load it from the yard
    if (x <= -HALL.x && x > -HALL.x - 7.2 && Math.abs(z - SPOT.staffDoor.z) < 1) return lerp(0, YARD_Y, (-HALL.x - x) / 7);
    return YARD_Y;
  }
  function insideHall(x, z) { return (Math.abs(x) < HALL.x && Math.abs(z) < HALL.z) || inWing(x, z) || !!inAnnex(x, z); }
