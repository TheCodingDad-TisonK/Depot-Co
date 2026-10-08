//@ the sortation deck (1.14.0): every parcel rides a spiral up to the mezzanine, a scanner reads its lane, three cells pack it for the sea, the land or the air, and spirals drop it into the right dock loader
  // ── The sortation deck ────────────────────────────────────────────
  // Tyson's brief, 2026-10-06: OUT 1 ships by sea, OUT 2 by land and a third dock by air, with a proper system that sorts the
  // parcels by the three, and after the pack line every parcel goes up to the deck to be sorted and packed for its lane.
  // The parts, in the order a parcel meets them: the pack line shelf feeds a spiral conveyor up to deck height beside it; an
  // overhead run carries the parcel north along the east lane onto the deck; the scanner arch reads the order's lane; the spine
  // runs west along the north face of the upper row past three packing cells, one a lane: a cell takes a parcel of its lane off
  // the spine, crates it (sea), straps it (land) or bags it (air) and sets it on the collector, which runs east along the north
  // wall and turns south to the spiral well, where gates kick the air and the sea parcels down their spirals into the OUT 3 and
  // the OUT 1 loaders; the land parcels ride on over the deck edge, down the east wall and down a third spiral into the OUT 2
  // loader. A parcel that finds its cell full rides to the end of the spine, waits on the turntable there and goes round again.
  // Nothing up here needs a hand. The lanes exist without the deck (the dock consoles and the board say which door each order
  // wants, a parcel out of the wrong door pays a forwarding fee); the deck is what makes them run themselves, and it opens OUT 3.
  var SORT = {
    spineZ: -20.7, spineX0: 25.2, spineX1: -12.4,          // the spine: west along the upper row's north face
    collZ: -23.2, collX0: -7.0, collX1: 29.0, collX: 29.4, // the collector: east along the north wall, then south along x 29.4 past the well and over the deck edge, down the east lane
    cells: [{ mode: 'sea', x: 16.0 }, { mode: 'land', x: 6.0 }, { mode: 'air', x: -4.0 }], cellZ: -21.72, liftX: 1.25, liftT: 2.4,   // liftX: the parcel lift beside each cell (local x); liftT: seconds up to the collector   // against the spine, so the corridor along the wall stays 1.3 m clear
    table: { x: -13.4, z: -20.7 }, inX: 25.5, scanZ: -19.4, up: 2.0,                                         // up: how high the overhead runs ride above the deck
    walk: [{ id: 'walk1', x: 22.0, z: -17.2, rot: 0 }, { id: 'walk2', x: 23.35, z: -20.7, rot: 1 }],         // step-overs: over the upper pick belt, over the spine's east end
    well: { x0: 31.0, x1: 33.4, z0: -20.5, z1: -18.1 },    // the spiral well through the deck, railed: the air spiral comes down here
    spiral: { sea: { x: 31.6, z: -11.1 }, air: { x: 32.2, z: -19.3 }, land: { x: 30.4, z: -3.2 }, up: { x: 30.6, z: 14.3 }, r: 1.0 },   // sea: in the OUT 1 apron, south of the deck edge; air: through the well; land: by OUT 2
    gates: { air: -19.3, sea: -13.9 },                      // where on the collector's south run the gates kick east (the sea gate at the deck's last row, its bridge runs out over the edge)
    jack2: { x: 27.0, z: -23.0 },                           // jack 2's bay moves out from under the spirals to the north wall
    cellTime: { sea: 7, land: 4, air: 5 }
  };
  var LOADER_DOORS = { dockLoader1: 2, dockLoader2: 3, dockLoader3: 4 };
  function sorterOwned() { return !!(S.up && S.up.sorter && S.up.upper); }
  function sortState() { if (!S.sort) S.sort = { cells: {}, table: [], scanned: 0, sorted: 0, count: { sea: 0, land: 0, air: 0 }, last: null, tableT: 0 }; var Z = S.sort; SORT.cells.forEach(function (c) { if (!Z.cells[c.mode]) Z.cells[c.mode] = { q: [], t: 0, made: 0 }; }); if (!Z.count) Z.count = { sea: 0, land: 0, air: 0 }; return Z; }
  // the helix: points every 22.5 degrees from angle a0, dir +1 anticlockwise seen from above, y from yTop to yBot; flagged so the belt builder leaves off legs and hangers
  function spiralPts(cx, cz, r, a0, turns, dir, yTop, yBot) { var n = Math.max(4, Math.round(turns * 16)), pts = []; for (var k = 0; k <= n; k++) { var a = a0 + dir * Math.PI * 2 * turns * k / n; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, yTop + (yBot - yTop) * k / n, 'spiral']); } return pts; }
  function spiralDress(c, cx, cz, r, yTop, yBot) {
    var FR = MAT_MACH.frame, lo = Math.min(yTop, yBot), hi = Math.max(yTop, yBot);
    c.cyl(0.22, hi - lo + 1.2, FR, cx, lo + (hi - lo + 1.2) / 2, cz, 16); c.cyl(0.5, 0.08, FR, cx, lo + 0.04, cz, 20); c.cyl(0.26, 0.5, MAT_MACH.blue, cx, hi + 1.0, cz, 16);
    for (var k = 0; k < 32; k++) { var a = Math.PI * 2 * k / 32, ox = cx + Math.cos(a) * (r + 0.46), oz = cz + Math.sin(a) * (r + 0.46); var post = c.box(0.04, hi - lo + 1.2, 0.04, FR, ox, lo + (hi - lo + 1.2) / 2, oz); post.rotation.y = -a; if (k % 4 === 0) { c.box(0.06, 0.06, 0.06, MAT.yellow, ox, hi + 0.9, oz); } }
    c.plane(2 * r + 1.2, 2 * r + 1.2, MAT.hazard, cx, lo + 0.012, cz, -Math.PI / 2, 0).material = MAT.hazard;
    c.solid(cx - r - 0.5, cx + r + 0.5, cz - r - 0.5, cz + r + 0.5, lo, hi + 0.8);
  }
  // ── The paths ─────────────────────────────────────────────────────
  var Y = UPPER.y, R = SORT.spiral.r;
  var SORT_UP = [[32.6, 14.3, 0], [32.6, 15.3, 0]].concat(spiralPts(SORT.spiral.up.x, SORT.spiral.up.z, R, Math.PI / 2, 2, 1, 0, Y), [[26.1, 15.3, Y, 'hang'], [SORT.inX, 14.7, Y, 'hang'], [SORT.inX, -6.0, Y, 'hang'], [SORT.inX, -11.5, Y + SORT.up, 'hang'], [SORT.inX, -15.5, Y + SORT.up, 'hang'], [SORT.inX, -20.2, Y, 'hang']]);   // off the shelf, two turns up, west, north along the east lane, up again before the deck so it crosses the walkway overhead, and down onto the spine
  var SORT_SPINE = [[SORT.spineX0, SORT.spineZ, Y], [SORT.spineX1, SORT.spineZ, Y, 'hang']];
  var SORT_COLL = [[SORT.collX0, SORT.collZ, Y + SORT.up], [27.0, SORT.collZ, Y + SORT.up, 'hang'], [SORT.collX1, SORT.collZ, Y + 1.15, 'hang'], [SORT.collX, SORT.collZ + 0.4, Y + 1.0, 'hang'], [SORT.collX, -19.9, Y, 'hang'], [SORT.collX, SORT.spiral.land.z - R, Y, 'hang']]   // overhead along the wall (the corridor runs under it), down to deck level before the gates, then straight south along the east lane at deck height
    .concat(spiralPts(SORT.spiral.land.x, SORT.spiral.land.z, R, Math.PI, 2.5, -1, Y, 0).slice(1), [[33.0, SORT.spiral.land.z, 0, 'spiral']]);   // the land spiral is the collector's own end: two and a half turns down, then east into the OUT 2 shipping bay
  function gateSpiral(mode) {   // down into the shipping bay of the lane
    var sp = SORT.spiral[mode], z = SORT.gates[mode];
    if (mode === 'air') return [[SORT.collX + 0.4, z, Y], [sp.x - 0.9, z + R - 0.1, Y, 'hang']].concat(spiralPts(sp.x, sp.z, R, Math.PI / 2, 2.25, -1, Y, 0), [[sp.x + R, sp.z + 0.6, 0, 'spiral']]);   // through the well, two and a quarter turns, a step north into the OUT 3 bay
    return [[SORT.collX + 0.4, z, Y], [30.6, -12.9, Y, 'hang']].concat(spiralPts(sp.x, sp.z, R, -Math.PI / 2, 2, 1, Y, 0), [[33.0, -11.7, 0, 'spiral']]);   // out over the deck edge into the apron, two turns down, east into the OUT 1 bay
  }
  defBelt('sortUp', { prop: 'sortUp', path: SORT_UP, speedKey: 'sorter', rate: 3 });
  defBelt('spine', { prop: 'spine', path: SORT_SPINE, speedKey: 'sorter', rate: 3 });
  defBelt('collector', { prop: 'collector', path: SORT_COLL, speedKey: 'sorter', rate: 3 });
  defBelt('spiralSea', { prop: 'spiralSea', path: gateSpiral('sea'), speedKey: 'sorter', rate: 3 });
  defBelt('spiralAir', { prop: 'spiralAir', path: gateSpiral('air'), speedKey: 'sorter', rate: 3 });
  // ── The machines on the registry ──────────────────────────────────
  defMachine('sortTable', { prop: 'sortTable', inlets: [[0, 0]], accept: function (it) { var Z = sortState(); if (it.kind !== 'parcel' || Z.table.length >= 6 || !powered()) return false; Z.table.push({ kind: 'parcel', order: it.order, mode: it.mode, laps: (it.laps || 0) + 1 }); sfx('putdown'); return true; } });
  SORT.cells.forEach(function (cd) { defMachine('cell' + cd.mode, { prop: 'cell' + cd.mode }); });
  function orderMode(o) { if (!o) return 'land'; if (o.mode && MODES[o.mode]) return o.mode; return clientMode(o.client); }
  function clientMode(cid) { var c = CLIENTS.filter(function (x) { return x.id === cid; })[0], m = c && c.mode || 'land'; if (m === 'air' && !sorterOwned()) m = 'land'; return m; }
  function modeOfParcel(it) { if (it.mode && MODES[it.mode]) return it.mode; var o = it.order ? orderById(it.order) : null; return o ? orderMode(o) : 'land'; }
  function beltInsert(id, item, d) { var items = beltItems(id), gap = beltGapOf(item); for (var i = 0; i < items.length; i++) if (Math.abs(items[i].d - d) < gap) return false; item.d = d; items.push(item); return true; }
  function beltD(id, x, z) { var b = BELTS[id], L = beltLen(b), best = 0, bd = 1e9; for (var d = 0; d <= L; d += 0.1) { var w = beltPoint(b, d), q = dist2(w.x, w.z, x, z); if (q < bd) { bd = q; best = d; } } return best; }
  var sortD = null;
  function sortMeasure() { if (!propInst.spine || !propInst.collector) { sortD = null; return; } sortD = { cell: {}, coll: {}, gate: {} }; SORT.cells.forEach(function (c) { sortD.cell[c.mode] = beltD('spine', c.x, SORT.spineZ); sortD.coll[c.mode] = beltD('collector', c.x + SORT.liftX, SORT.collZ); }); for (var g in SORT.gates) sortD.gate[g] = beltD('collector', SORT.collX, SORT.gates[g]); }
  function tickSorter(dt) {
    if (!sorterOwned() || !propInst.spine || !propInst.collector) return;
    if (!sortD) sortMeasure();
    var Z = sortState(), spd = speedOf('sorter');
    // the scanner: a parcel coming onto the spine is read, and the board of the panel remembers it
    beltItems('spine').forEach(function (it) { if (it.kind === 'parcel' && !it.mode) { it.mode = modeOfParcel(it); Z.scanned++; var o = it.order ? orderById(it.order) : null; Z.last = { num: o ? o.num : '?', mode: it.mode, client: o ? clientName(o.client) : '' }; if (sortScreen) sortScreen.dirty = true; } });
    if (!powered()) { SORT.cells.forEach(function (cd) { if (MACH['cell' + cd.mode]) lampSet(MACH['cell' + cd.mode], 'off'); }); if (MACH.sortTable) lampSet(MACH.sortTable, 'off'); return; }
    var spine = beltItems('spine'), i, it;
    // the cells: take a parcel of their lane off the spine, work on it, set it on the collector
    SORT.cells.forEach(function (cd) {
      var cell = Z.cells[cd.mode], dC = sortD.cell[cd.mode];
      if (cell.q.length < 2) for (i = spine.length - 1; i >= 0; i--) { it = spine[i]; if (it.kind === 'parcel' && it.mode === cd.mode && Math.abs(it.d - dC) < 0.35) { spine.splice(i, 1); cell.q.push({ order: it.order, mode: it.mode, t: 0 }); sfx('click'); if (sortScreen) sortScreen.dirty = true; break; } }
      // the job: work for the lane's time, then the parcel rides the lift beside the cell up to the bridge belt, which runs it onto the collector
      if (cell.q.length) { var job = cell.q[0]; if (job.t < SORT.cellTime[cd.mode]) { job.t += dt * spd; if (job.t >= SORT.cellTime[cd.mode]) { var o = job.order ? orderById(job.order) : null; if (o) o.form = MODES[cd.mode].form; job.lift = 0; sfx('tape'); } }
        else { job.lift = (job.lift || 0) + dt * spd; if (job.lift >= SORT.liftT && beltPush('cellOut' + cd.mode, { kind: 'parcel', order: job.order, mode: cd.mode, form: MODES[cd.mode].form })) { cell.q.shift(); cell.made++; Z.sorted++; Z.count[cd.mode] = (Z.count[cd.mode] || 0) + 1; S.stats.sorted = (S.stats.sorted || 0) + 1; if (sortScreen) sortScreen.dirty = true; } } }
      var M = MACH['cell' + cd.mode]; if (M && M.liftPlat) { var j0 = cell.q[0], fr = j0 && j0.lift !== undefined ? Math.min(1, j0.lift / SORT.liftT) : 0; M.liftPlat.position.y = BELT_Y - 0.1 + SORT.up * fr; }
      // the bridge belt's end: onto the collector overhead, when there is a gap
      var ob = beltItems('cellOut' + cd.mode), obL = BELTS['cellOut' + cd.mode] ? beltLen(BELTS['cellOut' + cd.mode]) : 0; for (i = ob.length - 1; i >= 0; i--) { it = ob[i]; if (it.d >= obL - 0.01 && beltInsert('collector', { kind: 'parcel', order: it.order, mode: it.mode, form: it.form }, sortD.coll[cd.mode])) ob.splice(i, 1); }
      if (MACH['cell' + cd.mode]) lampSet(MACH['cell' + cd.mode], cell.q.length ? 'run' : 'idle');
    });
    // the gates: a parcel of the lane passing the gate goes down its spiral
    var coll = beltItems('collector');
    for (var g in SORT.gates) { var dG = sortD.gate[g], to = g === 'sea' ? 'spiralSea' : 'spiralAir'; if (!propInst[to]) continue; for (i = coll.length - 1; i >= 0; i--) { it = coll[i]; if (it.kind === 'parcel' && it.mode === g && Math.abs(it.d - dG) < 0.35) { if (beltPush(to, { kind: 'parcel', order: it.order, mode: it.mode, form: it.form })) { coll.splice(i, 1); sfx('click'); } else it.d = Math.min(it.d, dG); break; } } }   // held at the gate while its spiral is backed up
    // the turntable at the end of the spine: whatever found its cell full goes round again
    if (Z.table.length) { Z.tableT += dt; if (Z.tableT > 2.5 && beltStartFree('spine')) { Z.tableT = 0; var back = Z.table.shift(); beltPush('spine', back); } }
    if (MACH.sortTable) lampSet(MACH.sortTable, Z.table.length ? 'run' : 'idle');
  }
  // the parcels inside the cells and on the turntable are drawn with the instanced parcels, from syncInstances
  function drawSorterItems() {
    drawStaged(); if (!sorterOwned()) return; var Z = sortState();
    SORT.cells.forEach(function (cd) { if (!propInst['cell' + cd.mode]) return; var cell = Z.cells[cd.mode]; cell.q.forEach(function (job, i) { var done = job.t >= SORT.cellTime[cd.mode]; if (i === 0 && done) { var fr = Math.min(1, (job.lift || 0) / SORT.liftT); putParcel(cd.x + SORT.liftX, Y + BELT_Y + 0.17 + SORT.up * fr, SORT.cellZ, 0, { kind: 'cell' }, MODES[cd.mode].form); } else putParcel(cd.x + (i ? -0.95 : 0), Y + 1.02, SORT.cellZ, 0, { kind: 'cell' }, null); }); });
    if (propInst.sortTable) Z.table.forEach(function (it, i) { var a = i * 1.05; putParcel(SORT.table.x + Math.cos(a) * 0.55, Y + 0.98, SORT.table.z + Math.sin(a) * 0.55, a, { kind: 'cell' }, it.form); });
  }
  // ── Staging at the loaders ────────────────────────────────────────
  // A loader with no truck at its door no longer stops its belt: it stages up to nine parcels beside itself and pushes them into
  // the next truck of its lane that docks with the door up. The deck's night shift fills these stages while you sleep.
  // The shipping bays (Tyson, 2026-10-06: the parcels must not land in front of the door by magic; a place where they sit). One a dock:
  // a three-lane gravity flow rack beside the loader, nine parcels, with a painted bay round it. The spirals and the shipping belt end
  // in the bays, never in the loaders; the loader takes from its bay, one parcel every second and a bit, while a truck of its lane
  // is docked with the door up. A parcel in a bay can be taken by hand. The bays are keyed by their loader in the save (S.stage).
  var STAGE_CAP = 9, BAY = { x0: 33.4, len: 1.8, lanes: 3, deep: 3, pitch: 0.62, step: 0.6, h: 0.55, at: { dockLoader1: { prop: 'bay1', z0: -12.1 }, dockLoader2: { prop: 'bay2', z0: -4.1 }, dockLoader3: { prop: 'bay3', z0: -19.56 } } }, STAGE_AT = BAY.at, stageT = {};   // every bay on the open side of its loader
  function bayLoader(prop) { for (var id in BAY.at) if (BAY.at[id].prop === prop) return id; return null; }
  function stageOf(id) { if (!S.stage) S.stage = {}; if (!S.stage[id]) S.stage[id] = []; return S.stage[id]; }
  function stageSpot(id, i) { var a = BAY.at[id], lane = i % BAY.lanes, depth = Math.floor(i / BAY.lanes); return { x: BAY.x0 + BAY.len - 0.32 - depth * BAY.step, z: a.z0 + 0.31 + lane * BAY.pitch, y: BAY.h }; }
  function stagePush(id, oid) { var st = stageOf(id); if (st.length >= STAGE_CAP || st.indexOf(oid) >= 0) return false; st.push(oid); return true; }
  function stagePrompt(src) { var o = orderById(src.order); if (S.hand || player.tool) return null; return 'Take parcel #' + (o ? o.num : '?') + ' out of the ' + dockLabel(LOADER_DOORS[src.loader]) + ' shipping bay'; }
  function stageUse(src) { if (S.hand || player.tool) return; var st = stageOf(src.loader), i = st.indexOf(src.order); if (i < 0) return; st.splice(i, 1); handSet({ kind: 'parcel', order: src.order }); sfx('pickup'); }
  function drawStaged() { for (var id in BAY.at) { if (!propInst[BAY.at[id].prop]) continue; stageOf(id).forEach(function (oid, i) { var p = stageSpot(id, i), o = orderById(oid); putParcel(p.x, p.y + 0.23, p.z, 0, { kind: 'stage', loader: id, order: oid }, o && o.form); }); } }
  function bayBuild(id) { return function (c) {
    var DG = MAT_MACH.frame, L = BAY.len, W = BAY.lanes * BAY.pitch, lane = MODES[TRUCK_OUT[LOADER_DOORS[id] - 2].mode], LC = new THREE.Color(lane.col), PM = std({ color: LC, roughness: 0.5, metalness: 0.3 });
    [[0.05, 0.05], [L - 0.05, 0.05], [0.05, W - 0.05], [L - 0.05, W - 0.05]].forEach(function (p) { c.box(0.08, BAY.h + 0.5, 0.08, DG, p[0], (BAY.h + 0.5) / 2, p[1]); c.box(0.16, 0.02, 0.16, DG, p[0], 0.01, p[1]); });
    c.box(L, 0.05, 0.05, DG, L / 2, BAY.h - 0.1, 0.03); c.box(L, 0.05, 0.05, DG, L / 2, BAY.h - 0.1, W - 0.03); c.box(0.05, 0.05, W, DG, 0.03, BAY.h - 0.1, W / 2); c.box(0.05, 0.05, W, DG, L - 0.03, BAY.h - 0.1, W / 2);
    for (var k = 0; k < BAY.lanes; k++) { var lz = 0.31 + k * BAY.pitch; var bed = c.box(L - 0.1, 0.03, 0.5, MAT_MACH.roller, L / 2, BAY.h - 0.03, lz); bed.rotation.z = -0.04; for (var rx = 0.15; rx < L - 0.1; rx += 0.15) { var sk = c.cyl(0.03, 0.46, MAT.chrome, rx, BAY.h - 0.02 + (L / 2 - rx) * 0.04, lz, 8); sk.rotation.x = Math.PI / 2; } c.box(L - 0.1, 0.1, 0.02, MAT_MACH.guard, L / 2, BAY.h + 0.05, lz - 0.3); c.box(L - 0.1, 0.1, 0.02, MAT_MACH.guard, L / 2, BAY.h + 0.05, lz + 0.3); c.box(0.04, 0.2, 0.46, PM, L - 0.06, BAY.h + 0.06, lz); }
    c.box(0.06, 0.5, W, DG, L + 0.02, BAY.h + 0.7, W / 2); c.sign([lane.name.toUpperCase() + ' SHIPPING BAY', dockLabel(LOADER_DOORS[id]) + ' · ' + lane.haulier], W - 0.1, 0.42, L + 0.06, BAY.h + 0.7, W / 2, -Math.PI / 2, { w: 640, h: 128, bg: '#1b232c', fg: lane.col });
    c.plane(L + 0.8, 0.1, MAT.yellowLine, L / 2, 0.006, -0.3, -Math.PI / 2, 0); c.plane(L + 0.8, 0.1, MAT.yellowLine, L / 2, 0.006, W + 0.3, -Math.PI / 2, 0); c.plane(0.1, W + 0.7, MAT.yellowLine, -0.35, 0.006, W / 2, -Math.PI / 2, 0);
    var lbl = new THREE.MeshBasicMaterial({ map: textTex(['BAY ' + (LOADER_DOORS[id] - 1) + ' · ' + lane.name.toUpperCase()], { w: 512, h: 128, bg: '#3b3d40', fg: lane.col }) }); c.plane(1.6, 0.4, lbl, L / 2, 0.0066, -0.7, -Math.PI / 2, 0);
    MACH['bay' + (LOADER_DOORS[id] - 1)].lamps = lampStack(c, L + 0.02, BAY.h + 1.0, W - 0.1);
    c.hit(0.3, 1.6, W + 0.2, L + 0.1, 0.8, W / 2, { prompt: function () { var n = stageOf(id).length, t = truckAtDoor(LOADER_DOORS[id]); return lane.name + ' shipping bay ' + dockLabel(LOADER_DOORS[id]) + ' · ' + n + ' of ' + STAGE_CAP + ' parcels' + (t && S.doors[LOADER_DOORS[id]] ? ' · the loader is taking them aboard' : ' · waiting for the ' + lane.name.toLowerCase() + ' truck'); }, use: function () { sfx('click'); } });
    c.solid(-0.05, L + 0.1, -0.05, W + 0.05, 0, 1.1);
  }; }
  // the bays on the registry: a belt that ends at a bay's west face drops its parcel into the bay
  [['dockLoader1', 'bay1'], ['dockLoader2', 'bay2'], ['dockLoader3', 'bay3']].forEach(function (pr) { defMachine(pr[1], { prop: pr[1], inlets: [[0, 0.93]], accept: function (it) { if (it.kind !== 'parcel' || !powered()) return false; var o = orderById(it.order); if (!o) return true; if (!stagePush(pr[0], o.id)) return false; if (it.form && !o.form) o.form = it.form; sfx('putdown'); return true; } }); });
  defProp('bay1', { label: 'shipping bay OUT 1', cat: 'hall', abs: true, keep: true, fixed: true, x: BAY.x0, z: BAY.at.dockLoader1.z0, rot: 0, build: bayBuild('dockLoader1'), when: function () { return !!S.up.sorter; } });
  defProp('bay2', { label: 'shipping bay OUT 2', cat: 'hall', abs: true, keep: true, fixed: true, x: BAY.x0, z: BAY.at.dockLoader2.z0, rot: 0, build: bayBuild('dockLoader2'), when: function () { return !!S.up.shipbelt || !!S.up.sorter; } });
  defProp('bay3', { label: 'shipping bay OUT 3', cat: 'hall', abs: true, keep: true, fixed: true, x: BAY.x0, z: BAY.at.dockLoader3.z0, rot: 0, build: bayBuild('dockLoader3'), when: function () { return !!S.up.sorter; } });
  function tickStaging(dt) {
    for (var id in STAGE_AT) {
      var st = stageOf(id); if (!st.length || !propInst[id] || !powered()) { if (MACH[BAY.at[id].prop]) lampSet(MACH[BAY.at[id].prop], !powered() ? 'off' : 'idle'); continue; } var door = LOADER_DOORS[id], t = truckAtDoor(door); if (MACH[BAY.at[id].prop]) lampSet(MACH[BAY.at[id].prop], t && S.doors[door] ? 'run' : 'idle'); if (!t || !S.doors[door] || !doorPassable(door)) continue;
      stageT[id] = (stageT[id] || 0) + dt; if (stageT[id] < 1.2) continue; stageT[id] = 0;
      var oid = st.shift(), o = orderById(oid); if (!o) continue; t.parcels.push(o.id); o.state = 'loaded'; laneWarn(o, t); sfx('crate'); addXp(XP.ship); rebuildBoardSoon(); S.stats.autoLoaded = (S.stats.autoLoaded || 0) + 1; if (MACH[id].anim) MACH[id].anim.pushT = 1.2;
    }
  }
  // the night shift: at bedtime every parcel on the shelf and on the deck is sorted and staged at the loader of its lane
  function deckNightRun() {
    if (!S.up.deckNight || !sorterOwned() || !propInst.spine || S.events.power) return 0;
    // seen: already past the scanner; done: already counted out of its cell. Neither is counted twice.
    var Z = sortState(), list = [], n = { sea: 0, land: 0, air: 0 }, take = function (oid, seen, done) { var o = orderById(oid); if (o) list.push({ o: o, seen: !!seen, done: !!done }); };
    S.bench.parcels.splice(0).forEach(function (oid) { take(oid, false, false); });
    ['sortUp', 'spine', 'collector', 'spiralSea', 'spiralAir', 'cellOutsea', 'cellOutland', 'cellOutair'].forEach(function (b) { if (!BELTS[b]) return; var items = beltItems(b); for (var i = items.length - 1; i >= 0; i--) if (items[i].kind === 'parcel') { if (items[i].order) take(items[i].order, b !== 'sortUp', b !== 'sortUp' && b !== 'spine'); items.splice(i, 1); } });
    SORT.cells.forEach(function (cd) { Z.cells[cd.mode].q.splice(0).forEach(function (j) { if (j.order) take(j.order, true, false); }); }); Z.table.splice(0).forEach(function (it) { if (it.order) take(it.order, true, false); });
    var left = [];
    list.forEach(function (e) { var o = e.o, m = orderMode(o), id = { sea: 'dockLoader1', land: 'dockLoader2', air: 'dockLoader3' }[m]; o.form = MODES[m].form; if (stagePush(id, o.id)) { n[m]++; if (!e.seen) Z.scanned++; if (!e.done) { Z.sorted++; Z.count[m] = (Z.count[m] || 0) + 1; S.stats.sorted = (S.stats.sorted || 0) + 1; } } else left.push(o); });
    left.forEach(function (o) { if (S.bench.parcels.length < 12) S.bench.parcels.push(o.id); else S.floor.push({ kind: 'parcel', order: o.id, x: 31.2 + Math.random() * 0.8, y: 0, z: 16.4 + Math.random() * 0.8, rot: 0 }); });
    var tot = n.sea + n.land + n.air; if (tot) logEvent('Night shift on the deck: ' + tot + ' parcel' + (tot > 1 ? 's' : '') + ' sorted and waiting in the shipping bays (sea ' + n.sea + ', land ' + n.land + ', air ' + n.air + ')', 'good');
    return tot;
  }
  // ── The screens ───────────────────────────────────────────────────
  var sortScreen = null;
  function sortScreenDraw(c, sc) {
    var Z = sortState(), busy = SORT.cells.some(function (cd) { return Z.cells[cd.mode].q.length; }), st = !powered() ? 'off' : busy ? 'sorting' : 'ready';
    scBg(c, sc.w, sc.h, st === 'sorting' ? 'rgba(95,211,141,0.18)' : st === 'off' ? 'rgba(255,107,94,0.22)' : 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'SORTATION DECK', st.toUpperCase());
    scText(c, 16, 62, Z.last ? 'Last read: #' + Z.last.num + ' ' + Z.last.client.slice(0, 16) + ' → ' + MODES[Z.last.mode].name.toUpperCase() : 'Waiting for the first parcel up the spiral', '#eef1f5', 13);
    scText(c, 16, 82, 'Read ' + Z.scanned + ' · sorted ' + Z.sorted + ' · sea ' + Z.count.sea + ' · land ' + Z.count.land + ' · air ' + Z.count.air, '#a0acb8', 12);
    SORT.cells.forEach(function (cd, i) { var cell = Z.cells[cd.mode], j = cell.q[0], o = j && j.order ? orderById(j.order) : null; c.fillStyle = MODES[cd.mode].col; c.fillRect(16, 96 + i * 20, 8, 14); scText(c, 32, 108 + i * 20, MODES[cd.mode].name.toUpperCase() + ' cell · ' + (j ? (o ? '#' + o.num + ' ' : '') + MODES[cd.mode].verb + (cell.q.length > 1 ? ' · 1 waiting' : '') : 'free') + ' · ' + cell.made + ' done', j ? '#eef1f5' : '#a0acb8', 12); });
    scText(c, 16, 170, 'Turntable: ' + Z.table.length + ' going round again · spine ' + beltItems('spine').length + ' · collector ' + beltItems('collector').length, '#a0acb8', 11);
    speedButton(sc, 208, 182, 76, 'sorter'); scText(c, 212, 178, 'deck belts', '#6b7784', 9);
    scButton(sc, 16, 180, 120, 30, 'LANES', true, function () { toast('Sea goes out at OUT 1, land at OUT 2, air at OUT 3. The board shows each order\'s lane.', ''); }, '#78bdf5');
  }
  // ── The builds ────────────────────────────────────────────────────
  // ── Step-overs ───────────────────────────────────────────────────
  // A steel stair up, a chequer platform a metre over the belt, a stair down: the way across a deck belt. The platform is floor
  // (walkoverY feeds upperFloorY), the rails are solid, and a deck belt's own solid stops below the platform (conveyorPath).
  var WALKOVERS = {}, WO = { h: 1.0, pl: 1.6, pw: 1.6, run: 0.9 };
  function walkoverY(x, z) {
    for (var id in WALKOVERS) { var P = WALKOVERS[id], a = P.rot * Math.PI / 2, dx = x - P.x, dz = z - P.z, lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a); if (Math.abs(lz) > WO.pw / 2) continue; var ax = Math.abs(lx); if (ax <= WO.pl / 2) return WO.h; if (ax <= WO.pl / 2 + WO.run) return WO.h * (WO.pl / 2 + WO.run - ax) / WO.run; }
    return null;
  }
  function walkoverBuild(c) {
    var DG = MAT_MACH.frame, CH = MAT.chequer, H = WO.h, PW = WO.pw, PL = WO.pl, RUN = WO.run, slope = Math.atan2(H, RUN), sl = Math.hypot(RUN, H);
    c.box(PL, 0.06, PW, CH, 0, H - 0.03, 0); [-1, 1].forEach(function (q) { c.box(PL, 0.1, 0.05, MAT.hazard, 0, H - 0.08, q * (PW / 2 - 0.02)); });
    [-1, 1].forEach(function (s) {
      for (var k = 0; k < 2; k++) { var tx = s * (PL / 2 + 0.15 + k * 0.3), ty = H * (2 - k) / 3; c.box(0.3, 0.05, PW - 0.1, CH, tx, ty - 0.025, 0); c.box(0.04, H / 3, PW - 0.1, DG, tx - s * 0.15, ty + H / 6, 0); }
      c.box(0.04, H / 3, PW - 0.1, DG, s * (PL / 2 + 0.75), H / 6, 0);
      [-1, 1].forEach(function (q) { var st = c.box(sl, 0.16, 0.05, DG, s * (PL / 2 + RUN / 2), H / 2 - 0.05, q * (PW / 2 - 0.02)); st.rotation.z = -s * slope; c.cyl(0.02, 1.0, MAT.chrome, s * (PL / 2 + RUN), 0.5, q * PW / 2, 8); var hr = c.box(sl, 0.04, 0.04, MAT.chrome, s * (PL / 2 + RUN / 2), H / 2 + 1.0, q * PW / 2); hr.rotation.z = -s * slope; });
    });
    [[-PL / 2 + 0.1, -PW / 2 + 0.1], [PL / 2 - 0.1, -PW / 2 + 0.1], [-PL / 2 + 0.1, PW / 2 - 0.1], [PL / 2 - 0.1, PW / 2 - 0.1]].forEach(function (p) { c.box(0.06, H - 0.06, 0.06, DG, p[0], (H - 0.06) / 2, p[1]); c.box(0.14, 0.02, 0.14, DG, p[0], 0.01, p[1]); });
    [-1, 1].forEach(function (q) { c.cyl(0.02, 1.0, MAT.chrome, -PL / 2, H + 0.5, q * PW / 2, 8); c.cyl(0.02, 1.0, MAT.chrome, PL / 2, H + 0.5, q * PW / 2, 8); c.box(PL, 0.04, 0.04, MAT.chrome, 0, H + 1.0, q * PW / 2); c.box(PL, 0.04, 0.04, MAT.chrome, 0, H + 0.5, q * PW / 2); c.solid(-PL / 2 - RUN, PL / 2 + RUN, q * PW / 2 - 0.05, q * PW / 2 + 0.05, 0, H + 1.1); });
    c.sign(['STEP OVER'], 0.6, 0.12, 0, H + 1.12, PW / 2 + 0.01, 0, { w: 256, h: 56, bg: '#f5b53d', fg: '#1a1205' }); c.sign(['STEP OVER'], 0.6, 0.12, 0, H + 1.12, -PW / 2 - 0.01, Math.PI, { w: 256, h: 56, bg: '#f5b53d', fg: '#1a1205' });
  }
  function cellBuild(cd) { return function (c) {
    var LG = MAT_MACH.panel, DG = MAT_MACH.frame, col = new THREE.Color(MODES[cd.mode].col), PM = std({ color: col, roughness: 0.5, metalness: 0.3 });
    [[-0.7, -0.55], [0.7, -0.55], [-0.7, 0.55], [0.7, 0.55]].forEach(function (p) { c.box(0.08, 0.7, 0.08, DG, p[0], 0.35, p[1]); c.box(0.18, 0.03, 0.18, DG, p[0], 0.015, p[1]); });
    c.box(1.6, 0.14, 1.3, DG, 0, 0.78, 0); for (var rx = -0.7; rx < 0.75; rx += 0.2) { var r = c.cyl(0.035, 1.2, MAT_MACH.roller, rx, BELT_Y - 0.02, 0, 10); r.rotation.x = Math.PI / 2; }
    var hood = new THREE.Mesh(bevelGeo(1.5, 0.9, 1.1, 0.04), LG); hood.position.set(0, 1.5, 0); hood.castShadow = true; c.group.add(hood); c.box(1.52, 0.06, 1.12, PM, 0, 1.97, 0); c.box(1.52, 0.04, 1.12, MAT.hazard, 0, 0.87, 0);
    c.plane(0.9, 0.4, std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.4 }), 0, 1.45, 0.56, 0, 0); c.plane(0.9, 0.4, std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.4 }), 0, 1.45, -0.56, 0, Math.PI);
    if (cd.mode === 'sea') { c.box(0.5, 0.5, 0.08, MAT.wood, 0.95, 1.3, 0); c.box(0.5, 0.5, 0.08, MAT.wood, 1.0, 1.3, 0.1); } else if (cd.mode === 'land') { var roll = c.cyl(0.14, 0.1, MAT.black, 0.95, 1.3, 0, 16); roll.rotation.x = Math.PI / 2; } else { c.box(0.4, 0.5, 0.06, MAT.white, 0.95, 1.3, 0); c.box(0.4, 0.06, 0.06, MAT.red, 0.95, 1.5, 0.01); }
    c.sign([MODES[cd.mode].name.toUpperCase() + ' CELL', MODES[cd.mode].pack], 1.3, 0.3, 0, 1.78, 0.57, 0, { w: 448, h: 100, bg: '#1b232c', fg: MODES[cd.mode].col }); c.sign([MODES[cd.mode].name.toUpperCase() + ' CELL'], 1.3, 0.2, 0, 1.78, -0.57, Math.PI, { w: 448, h: 64, bg: '#1b232c', fg: MODES[cd.mode].col });
    MACH['cell' + cd.mode].lamps = lampStack(c, 0.6, 1.98, 0.3);
    c.hit(1.8, 2.2, 1.5, 0, 1.1, 0, { prompt: function () { var cell = sortState().cells[cd.mode], j = cell.q[0], o = j && j.order ? orderById(j.order) : null; return MODES[cd.mode].name + ' cell · ' + (!powered() ? 'no power' : j ? (j.lift !== undefined ? 'lifting' : MODES[cd.mode].verb) + (o ? ' #' + o.num : '') : 'waiting for a ' + cd.mode + ' parcel') + ' · ' + cell.made + ' done'; }, use: function () { sfx('click'); } });
    // the parcel lift: two masts beside the cell, a platform that rides up to the bridge belt, a guard on the aisle side
    var LX = SORT.liftX, LH = SORT.up + BELT_Y + 0.3; [-0.38, 0.38].forEach(function (mz) { c.box(0.08, LH, 0.08, DG, LX + 0.3, LH / 2, mz); c.box(0.2, 0.02, 0.2, DG, LX + 0.3, 0.01, mz); }); c.box(0.1, 0.1, 0.9, DG, LX + 0.3, LH, 0); c.box(0.06, 0.06, 0.06, glowMat(0xf5b53d, 1.2), LX + 0.3, LH + 0.08, 0);
    var plat = new THREE.Group(); plat.userData.dynamic = true; plat.position.set(LX, BELT_Y - 0.1, 0); c.group.add(plat); box(0.7, 0.05, 0.7, MAT.chequer, 0, 0, 0, plat); box(0.08, 0.3, 0.7, DG, 0.33, 0.15, 0, plat); box(0.7, 0.04, 0.04, MAT.hazard, 0, 0.02, -0.35, plat); box(0.7, 0.04, 0.04, MAT.hazard, 0, 0.02, 0.35, plat); MACH['cell' + cd.mode].liftPlat = plat;
    c.plane(0.8, LH - 0.2, MAT.mesh, LX, LH / 2, 0.42, 0, 0); c.sign(['PARCEL LIFT'], 0.5, 0.1, LX, LH - 0.1, 0.43, 0, { w: 256, h: 56, bg: '#1b232c', fg: '#f5b53d' });
    c.solid(-0.8, 0.8, -0.65, 0.65, 0, 2.1); c.solid(LX - 0.4, LX + 0.4, -0.45, 0.45, 0, LH + 0.2);
  }; }
  function sortTableBuild(c) {   // not tableBuild: that name is the canteen table in 06-props, and the later declaration won, so the break room got a turntable (1.18.1)
    var DG = MAT_MACH.frame; c.cyl(0.9, 0.08, DG, 0, BELT_Y - 0.06, 0, 32); c.cyl(0.86, 0.03, MAT_MACH.roller, 0, BELT_Y, 0, 32); c.cyl(0.25, BELT_Y - 0.1, DG, 0, (BELT_Y - 0.1) / 2, 0, 16);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.025, 8, 40), MAT_MACH.guard); ring.rotation.x = Math.PI / 2; ring.position.y = BELT_Y + 0.14; c.group.add(ring); for (var k = 0; k < 8; k++) { var a = k / 8 * Math.PI * 2; if (k === 0) continue; c.box(0.03, 0.14, 0.03, DG, Math.cos(a) * 0.95, BELT_Y + 0.07, Math.sin(a) * 0.95); }
    c.box(0.3, 0.5, 0.2, DG, -1.1, 0.9, 0.0); MACH.sortTable.lamps = lampStack(c, -1.1, 1.15, 0); c.sign(['TURNTABLE', 'round again'], 0.6, 0.2, -1.26, 0.8, 0, -Math.PI / 2, { w: 256, h: 96, bg: '#1b232c', fg: '#eef1f5' });
    c.hit(2.0, 1.4, 2.0, 0, 0.7, 0, { prompt: function () { var Z = sortState(); return 'Turntable · ' + (Z.table.length ? Z.table.length + ' parcel' + (Z.table.length > 1 ? 's' : '') + ' waiting to go round again' : 'empty'); }, use: function () { sfx('click'); } });
    c.solid(-1.0, 1.0, -1.0, 1.0, 0, 1.0);
  }
  function scannerBuild(c) {
    var DG = MAT_MACH.frame, LG = MAT_MACH.panel;
    [-0.75, 0.75].forEach(function (x) { c.box(0.1, 2.3, 0.1, DG, x, 1.15, 0); c.box(0.24, 0.03, 0.24, DG, x, 0.015, 0); }); c.box(1.7, 0.16, 0.3, DG, 0, 2.3, 0);
    c.box(0.6, 0.12, 0.2, MAT.black, 0, 2.18, 0); c.box(0.5, 0.02, 0.02, glowMat(0xff3b2f, 1.6), 0, 2.11, 0); c.box(0.02, 1.3, 0.02, glowMat(0xff3b2f, 0.8), -0.72, 1.35, 0.06); c.box(0.02, 1.3, 0.02, glowMat(0xff3b2f, 0.8), 0.72, 1.35, 0.06);
    c.sign(['SCAN · LANE READ'], 1.0, 0.16, 0, 2.48, 0.16, 0, { w: 384, h: 64, bg: '#1b232c', fg: '#f5b53d' });
    cabinet(c, -1.25, 1.35, 0.0, 0.5, 0.7, 0.26); sortScreen = touchScreen({ w: 300, h: 220, pw: 0.42, ph: 0.31, x: -1.25, y: 1.42, z: 0.135, ry: 0, parent: c.group, title: 'Sortation deck', draw: sortScreenDraw }); sortScreen.mesh.userData.propId = 'scanner'; eStop(c, -1.05, 0.9, 0.135);
    c.hit(0.6, 1.6, 0.4, -1.25, 1.0, 0, { prompt: function () { return 'Sortation panel'; }, use: function () { sfx('click'); } });
    c.solid(-1.5, -1.0, -0.15, 0.15, 0, 1.9); c.solid(-0.82, -0.68, -0.08, 0.08, 0, 2.4); c.solid(0.68, 0.82, -0.08, 0.08, 0, 2.4);
  }
  function gateBuild(mode) { return function (c) {
    var DG = MAT_MACH.frame; c.box(0.3, 0.9, 0.3, DG, 0, 0.45, 0); c.box(0.5, 0.08, 0.5, DG, 0, 0.04, 0); var arm = c.box(0.9, 0.06, 0.06, MAT.yellow, 0.45, BELT_Y + 0.62, 0); arm.rotation.y = 0;
    c.box(0.06, 0.3, 0.5, std({ color: new THREE.Color(MODES[mode].col), roughness: 0.5 }), 0.9, BELT_Y + 0.62, 0); c.sign([MODES[mode].name.toUpperCase() + ' GATE'], 0.5, 0.14, 0, 1.05, 0.16, 0, { w: 256, h: 64, bg: '#1b232c', fg: MODES[mode].col });
    c.hit(0.5, 1.2, 0.5, 0, 0.6, 0, { prompt: function () { return MODES[mode].name + ' gate · kicks ' + mode + ' parcels down the spiral to ' + dockLabel(MODES[mode].door); }, use: function () { sfx('click'); } }); c.solid(-0.2, 0.2, -0.2, 0.2, 0, 1.0);
  }; }
  // ── The props ─────────────────────────────────────────────────────
  var SF = { cat: 'hall', abs: true, keep: true, fixed: true, rot: 0, when: sorterOwned };
  function sdef(id, extra) { var d = { label: extra.label, cat: SF.cat, abs: SF.abs, keep: SF.keep, fixed: SF.fixed, rot: 0, when: SF.when, x: extra.x || 0, z: extra.z || 0, build: extra.build, after: extra.after }; defProp(id, d); }
  sdef('sortUp', { label: 'parcel spiral and overhead run', build: function (c) { conveyorPath(c, BELTS.sortUp.path); spiralDress(c, SORT.spiral.up.x, SORT.spiral.up.z, R, Y, 0); c.sign(['UP TO THE SORTER'], 0.9, 0.14, 31.4, 1.3, 15.9, 0, { w: 320, h: 64, bg: '#1b232c', fg: '#f5b53d' }); c.sign(['PARCELS · TO THE DECK'], 1.2, 0.18, SORT.inX + 0.5, Y + 1.5, 0, Math.PI / 2, { w: 384, h: 64, bg: '#1b232c', fg: '#f5b53d' }); } });
  sdef('spine', { label: 'sorter spine', build: function (c) { conveyorPath(c, BELTS.spine.path); c.sign(['SORTER SPINE · KEEP CLEAR'], 1.6, 0.2, 10, Y + 1.5, SORT.spineZ + 0.5, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#f5b53d' }); } });
  sdef('collector', { label: 'collector and land spiral', build: function (c) { conveyorPath(c, BELTS.collector.path); spiralDress(c, SORT.spiral.land.x, SORT.spiral.land.z, R, Y, 0); c.sign(['LAND · DOWN TO OUT 2'], 1.0, 0.14, 29.95, Y + 1.2, -9.0, Math.PI / 2, { w: 320, h: 64, bg: '#1b232c', fg: MODES.land.col }); c.sign(['COLLECTOR · TO THE DOCKS'], 1.4, 0.18, 10, Y + 1.5, SORT.collZ + 0.5, 0, { w: 448, h: 64, bg: '#1b232c', fg: '#5fd38d' }); } });
  sdef('spiralSea', { label: 'sea spiral', build: function (c) { conveyorPath(c, BELTS.spiralSea.path); spiralDress(c, SORT.spiral.sea.x, SORT.spiral.sea.z, R, Y, 0); c.sign(['SEA · DOWN TO OUT 1'], 0.9, 0.14, SORT.spiral.sea.x, 1.6, SORT.spiral.sea.z + R + 0.5, 0, { w: 320, h: 64, bg: '#1b232c', fg: MODES.sea.col }); } });
  sdef('spiralAir', { label: 'air spiral', build: function (c) { conveyorPath(c, BELTS.spiralAir.path); spiralDress(c, SORT.spiral.air.x, SORT.spiral.air.z, R, Y, 0); c.sign(['AIR · DOWN TO OUT 3'], 0.9, 0.14, 32.2, 1.6, SORT.spiral.air.z - R - 0.5, Math.PI, { w: 320, h: 64, bg: '#1b232c', fg: MODES.air.col }); } });
  SORT.cells.forEach(function (cd) { sdef('cell' + cd.mode, { label: cd.mode + ' packing cell', x: cd.x, z: SORT.cellZ, build: cellBuild(cd), after: raiseToDeck }); defBelt('cellOut' + cd.mode, { prop: 'cellOut' + cd.mode, path: [[SORT.liftX, 0, Y + SORT.up], [SORT.liftX, SORT.collZ - SORT.cellZ, Y + SORT.up, 'hang']], speedKey: 'sorter', rate: 2, noSink: true }); sdef('cellOut' + cd.mode, { label: cd.mode + ' cell bridge belt', x: cd.x, z: SORT.cellZ, build: function (c) { conveyorPath(c, BELTS['cellOut' + cd.mode].path); } }); });   // the bridge belt from the lift head to the collector, over the corridor
  sdef('sortTable', { label: 'sorter turntable', x: SORT.table.x, z: SORT.table.z, build: sortTableBuild, after: raiseToDeck });
  sdef('scanner', { label: 'scanner arch', x: SORT.inX, z: SORT.scanZ, build: scannerBuild, after: raiseToDeck });
  sdef('gateSea', { label: 'sea gate', x: SORT.collX - 0.7, z: SORT.gates.sea, build: gateBuild('sea'), after: raiseToDeck });
  sdef('gateAir', { label: 'air gate', x: SORT.collX - 0.7, z: SORT.gates.air, build: gateBuild('air'), after: raiseToDeck });
  SORT.walk.forEach(function (w) { defProp(w.id, { label: 'step-over', cat: 'hall', abs: true, keep: true, fixed: true, x: w.x, z: w.z, rot: w.rot, build: walkoverBuild, after: function (ctx, P, inst) { raiseToDeck(ctx, P, inst); WALKOVERS[inst.id] = P; }, when: sorterOwned }); });
  // the deck's hole for the spirals and the railing gaps the belts pass through, read by the mezzanine build
  function sorterHoles() { return sorterOwned() ? [{ x0: SORT.well.x0, x1: SORT.well.x1, z0: SORT.well.z0, z1: SORT.well.z1 }] : []; }
  function sorterEdgeGaps() { var g = [[22 - 0.7, 22 + 0.7]]; if (sorterOwned()) g.push([SORT.collX - 0.7, 32.3]); return g; }   // the collector and the sea bridge cross the railing; the parcel run clears it by two metres
  function sorterWellRails(c) {
    if (!sorterOwned()) return; var w = SORT.well;
    railRun(c, w.x0, w.x1, w.z0 - 0.12, 'x', Y); railRun(c, w.x0, w.x1, w.z1 + 0.12, 'x', Y); railRun(c, w.z0 - 0.12, w.z1 + 0.12, w.x1 + 0.12, 'z', Y);
    railRun(c, w.z0 - 0.12, w.z1 + 0.12, w.x0 - 0.12, 'z', Y, [[SORT.gates.air - 0.5, SORT.gates.air + 1.4]]);
    c.sign(['SPIRAL WELL', 'keep clear'], 0.9, 0.3, (w.x0 + w.x1) / 2, Y + 1.5, w.z0 - 0.2, Math.PI, { w: 320, h: 100, bg: '#1b232c', fg: '#ff6b5e' });
  }
  function inSorterWell(x, z) { return sorterOwned() && x > SORT.well.x0 && x < SORT.well.x1 && z > SORT.well.z0 && z < SORT.well.z1; }
  // jack 2's bay: out from under the spirals to the north wall, for a save that owns the deck
  function sorterSpots() { if (!S.up.sorter) return; var old = { x: SPOT.jack2.x, z: SPOT.jack2.z }; SPOT.jack2 = { x: SORT.jack2.x, z: SORT.jack2.z }; if (S.jack2 && Math.abs(S.jack2.x - old.x) < 3 && Math.abs(S.jack2.z - old.z) < 3) { S.jack2.x = SPOT.jack2.x; S.jack2.z = SPOT.jack2.z; S.jack2.rot = Math.PI; } }
  function buildSorter() {
    sorterSpots(); repaintJack2Bay();
    // the shipping belt gives way: its parcels go back on the shelf, or the floor if the shelf is full
    if (propInst.shipBelt) { beltItems('shipBelt').forEach(function (it) { if (it.kind === 'parcel' && it.order) { if (S.bench.parcels.length < 12) S.bench.parcels.push(it.order); else S.floor.push({ kind: 'parcel', order: it.order, x: 31.5, y: 0, z: 16.5, rot: 0 }); } }); beltItems('shipBelt').length = 0; removePropInst('shipBelt'); }
    buildProp('mezz'); buildProp('upperPick');
    ['dockLoader1', 'dockLoader2', 'dockLoader3', 'bay1', 'bay2', 'bay3', 'sortUp', 'spine', 'collector', 'spiralSea', 'spiralAir', 'cellsea', 'cellland', 'cellair', 'cellOutsea', 'cellOutland', 'cellOutair', 'sortTable', 'scanner', 'gateSea', 'gateAir', 'walk1', 'walk2'].forEach(function (id) { buildProp(id); });
    if (!S.speed) S.speed = {}; if (S.speed.sorter === undefined) S.speed.sorter = 1;
    sortD = null; beltsChanged(); if (!edit.on) { unbakeStatic(); bakeStatic(); } rebuildBoardSoon();
  }
