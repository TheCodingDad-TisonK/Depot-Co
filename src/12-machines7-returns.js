//@ the returns hall (1.17.0): Hall 2 stripped of its racks and given over to returns, with a dock of its own, the belt to the intake, three inspection desks, the restock cage and the compactor
  // ── The returns hall ──────────────────────────────────────────────
  // Tyson, 2026-10-07: "returns should have a separate hall ... take an existing hall, strip it, and make it entirely about
  // returns". Hall 2, the east annex, is that hall. Its two rack rows are gone (a save that had stock in them finds it moved to
  // other rows, or on pallets on this floor). On its east wall, in line with the OUT docks, sits the returns dock: a returns
  // truck comes twice a day with a load of returns from everything you have shipped, and the outbound trucks still bring the
  // odd one back to their own doors. While the dock door is up and the power on, the belt inside the door carries the returns
  // off the trailer to the intake, where they queue. E on any of the three inspection desks inspects the next one in the queue.
  // Resaleable boxes land in the restock cage against the far wall and go back to the racks; damaged ones go in the compactor
  // at no charge. The desk by the bench in the main hall goes the day the hall opens. The packer covers all of it.
  var RET = { door: 6, dockZ: -34, beltZ: -35.0, beltX0: 34.6, beltX1: 22.2, intake: { x: 21.0, z: -35.0 }, desks: [{ x: 19.0, z: -38.2 }, { x: 23.4, z: -38.2 }, { x: 27.8, z: -38.2 }], cage: { x: 30.5, z: -43.2 }, compactor: { x: 15.5, z: -43.0 } };
  var TRUCK_RET = [9.5, 15];      // the returns truck docks at these hours, once the hall is open
  var RET_PROPS = ['retBelt', 'retIntake', 'retDesk0', 'retDesk1', 'retDesk2', 'retCage', 'retCompactor', 'retPaint', 'retSign', 'consoleRet'];
  // which side of a dock door the yard steps and the driver's landing are on: north for IN 1, OUT 3 and the returns dock (the
  // corner doors), south for the rest. The yard and the truck route both read this, so they agree (IN 1's did not until 1.17.0)
  function dockStepSide(i) { return i === 0 || i === 4 || i === 6 ? -1 : 1; }
  // a door you have: the first two inbound docks always, IN 3 with Hall 3, the returns dock with the returns hall, OUT 3 with the deck
  function doorOwned(i) { var d = DOOR_MAP[i]; if (!d) return false; return d.dir === 'in' ? (d.dock < 2 || !!S.up.hall3) : d.dir === 'ret' ? returnsHall() : dockOwned(d.dock); }
  function retWhen() { return returnsHall(); }
  // ── The belt off the trailer ──
  function retFeedWorks(t) { return !!(propInst.retBelt && S.doors[RET.door] && doorPassable(RET.door) && powered() && t && t.state === 'docked'); }
  var retFeedT = 0;
  function tickRetFeed(dt) {
    var t = truckAtDoor(RET.door); if (!retFeedWorks(t) || !t.returns || !t.returns.length) return;
    retFeedT += dt; if (retFeedT < 1.5 / speedOf(beltSpeedKey(BELTS.retBelt)) || !beltStartFree('retBelt')) return;
    var rid = t.returns[0]; if (!beltPush('retBelt', { kind: 'parcel', ret: rid, form: 'ret' })) return;
    t.returns.shift(); retFeedT = 0; sfx('click');
  }
  defBelt('retBelt', { prop: 'retBelt', path: [[0, 0], [RET.beltX1 - RET.beltX0, 0]], speedKey: 'belts' });
  // the intake: the belt's sink; a return it hands over joins the queue, and the belt backs up while the queue is full
  defMachine('retIntake', { prop: 'retIntake', inlet: [0, 0], accept: function (it) { if (it.kind !== 'parcel' || !it.ret || !powered()) return false; var D = rdesk(); if (D.queue.length >= rdeskCap()) return false; D.queue.push(it.ret); sfx('putdown'); screenDirtyAll(); hudDirty = true; return true; } });
  function retIntakePrompt() { var D = rdesk(); if (S.hand && S.hand.kind === 'return') return D.queue.length < rdeskCap() ? 'Put the return in the queue (' + D.queue.length + ' waiting)' : 'The queue is full: inspect one first'; if (S.hand || player.tool) return null; return 'Returns intake · ' + D.queue.length + ' waiting · the belt brings them in from the dock · E on an inspection desk inspects the next'; }
  function retIntakeUse() { if (S.hand && S.hand.kind === 'return') { rdeskUse(0); return; } sfx('click'); }
  // the nearest place to bin a damaged box: the bin by the bench or the compactor in the returns hall
  function binSpotFor(st) { var best = null, bd = 1e9; ['binDamaged', 'retCompactor'].forEach(function (id) { if (!propInst[id]) return; var w = propWorld(id, 0, 1.0), d = dist2(w.x, w.z, st.x, st.z); if (d < bd) { bd = d; best = { x: w.x, z: w.z }; } }); return best || (function () { var w = propWorld('binDamaged', 0, 1.0); return { x: w.x, z: w.z }; })(); }
  // ── Drawn from the save every frame ──
  // the queue stacked two abreast in the intake tray, the one under inspection on each desk's scale, the boxes on the cage's three shelves
  function drawReturnsHall(D) {
    if (propInst.retIntake) { var ia = propPlacement('retIntake').rot * Math.PI / 2; D.queue.forEach(function (id, i) { var w = propWorld('retIntake', i % 2 ? 0.36 : -0.36, 0); putParcel(w.x, 0.86 + 0.23 + Math.floor(i / 2) * 0.47, w.z, ia + (i % 2 ? 0.1 : -0.06), { kind: 'rdeskq', idx: i, k: 0 }, 'ret'); }); }
    D.s.forEach(function (st, k) { if (!st.cur || !propInst['retDesk' + k]) return; var a = propPlacement('retDesk' + k).rot * Math.PI / 2, wc = propWorld('retDesk' + k, 0.6, -0.05); putParcel(wc.x, 1.04 + 0.23, wc.z, a + 0.35, { kind: 'rdeskcur' }, 'ret'); });
    if (propInst.retCage) { var ca = propPlacement('retCage').rot * Math.PI / 2, lv = [0.135, 0.755, 1.375]; D.shelf.forEach(function (b, i) { var w = propWorld('retCage', -1.4 + (i % 8) * 0.4, 0), base = lv[Math.min(2, Math.floor(i / 8))]; if (b.damaged) putBoxDamaged(b.sku, w.x, base, w.z, ca, { kind: 'rdesk', idx: i }); else putBox(b.sku, w.x, base + BOX.h / 2, w.z, ca, { kind: 'rdesk', idx: i }); }); }
  }
  // ── The fixtures ──
  defProp('retBelt', { label: 'returns belt', cat: 'hall', abs: true, keep: true, fixed: true, x: RET.beltX0, z: RET.beltZ, rot: 0, when: retWhen, build: function (c) {
    conveyorPath(c, BELTS.retBelt.path);
    var mx = (RET.beltX1 - RET.beltX0) / 2; c.sign(['RETURNS IN'], 1.4, 0.3, mx, 2.4, 0.6, 0, { w: 448, h: 96, bg: '#1b232c', fg: '#f5b53d' }); c.sign(['RETURNS IN'], 1.4, 0.3, mx, 2.4, -0.6, Math.PI, { w: 448, h: 96, bg: '#1b232c', fg: '#f5b53d' });
    c.cyl(0.02, 2.4, MAT.steelDark, mx, 1.2, 0.6, 8).castShadow = false; c.cyl(0.02, 2.4, MAT.steelDark, mx, 1.2, -0.6, 8).castShadow = false; c.box(0.03, 0.03, 1.2, MAT.steelDark, mx, 2.4, 0);
  } });
  // the intake: a roller table at the belt's end with a deep tray the returns queue in, a scanner post, the queue count on a screen
  defProp('retIntake', { label: 'returns intake', cat: 'hall', abs: true, keep: true, fixed: true, x: RET.intake.x, z: RET.intake.z, rot: 0, when: retWhen, build: function (c, P, inst) {
    var FR = MAT.steelDark, TOP = std({ color: 0x8f98a3, roughness: 0.45, metalness: 0.35 });
    c.box(1.6, 0.06, 0.9, TOP, 0, 0.83, 0); [[-0.72, -0.38], [0.72, -0.38], [-0.72, 0.38], [0.72, 0.38]].forEach(function (o) { c.box(0.05, 0.83, 0.05, FR, o[0], 0.415, o[1]); });
    for (var rx = -0.6; rx <= 0.6; rx += 0.15) { var rl = c.cyl(0.035, 0.84, MAT.steel, rx, 0.875, 0, 10); rl.rotation.x = Math.PI / 2; }   // rollers across the top
    c.box(1.6, 0.25, 0.04, FR, 0, 0.98, 0.45); c.box(1.6, 0.25, 0.04, FR, 0, 0.98, -0.45); c.box(0.04, 0.25, 0.9, FR, -0.8, 0.98, 0);   // the tray's three sides: the belt feeds the open one
    var post = c.cyl(0.02, 2.2, FR, -0.9, 1.1, -0.5, 8); post.castShadow = false; c.box(0.22, 0.14, 0.1, MAT.black, -0.9, 1.75, -0.44); c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), -0.83, 1.8, -0.385);   // the scanner head over the tray
    var scr = touchScreen({ w: 200, h: 80, pw: 0.44, ph: 0.176, x: -0.9, y: 1.45, z: -0.44, ry: 0, parent: c.group, title: 'Returns intake', draw: function (cc, sc) { var D = rdesk(); scBg(cc, sc.w, sc.h, 'rgba(245,181,61,0.2)'); scText(cc, 10, 28, 'INTAKE · ' + D.queue.length + ' / ' + rdeskCap() + ' waiting', '#f5b53d', 14); scText(cc, 10, 54, D.queue.length ? 'E on an inspection desk' : 'the belt brings them in', '#a0acb8', 11); } }); scr.mesh.userData.propId = 'retIntake';
    c.sign(['INTAKE'], 0.7, 0.18, 0, 1.15, 0.47, 0, { w: 256, h: 72, bg: '#1b232c', fg: '#f5b53d' });
    c.solid(-0.85, 0.85, -0.5, 0.5, 0, 1.1); c.hit(1.8, 1.2, 1.1, 0, 0.6, 0, { prompt: function () { return retIntakePrompt(); }, use: function () { retIntakeUse(); } });
  } });
  RET.desks.forEach(function (d, k) { defProp('retDesk' + k, { label: 'inspection desk ' + (k + 1), cat: 'hall', abs: true, keep: true, fixed: true, x: d.x, z: d.z, rot: 0, when: retWhen, build: returnsDeskBuildFor(k, 'INSPECTION ' + (k + 1)) }); });
  // the restock cage: three mesh shelves between steel posts, 3.6 m wide, the boxes a worker takes back to the racks
  defProp('retCage', { label: 'restock cage', cat: 'hall', abs: true, keep: true, fixed: true, x: RET.cage.x, z: RET.cage.z, rot: 0, when: retWhen, build: function (c) {
    var FR = MAT.steelDark, MESH = std({ map: TEX.vmesh, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0x6a737c }), W = 3.6, Dp = 0.9, H = 2.1;
    [[-W / 2, -Dp / 2], [W / 2, -Dp / 2], [-W / 2, Dp / 2], [W / 2, Dp / 2], [0, -Dp / 2], [0, Dp / 2]].forEach(function (o) { c.box(0.06, H, 0.06, FR, o[0], H / 2, o[1]); });
    [0.1, 0.72, 1.34, 1.96].forEach(function (y) { c.box(W, 0.04, Dp, MAT.steel, 0, y, 0); c.box(W, 0.04, 0.04, FR, 0, y, -Dp / 2); c.box(W, 0.04, 0.04, FR, 0, y, Dp / 2); });
    c.plane(W, H, MESH, 0, H / 2, -Dp / 2 - 0.01, 0, 0); c.plane(Dp, H, MESH, -W / 2 - 0.01, H / 2, 0, 0, Math.PI / 2); c.plane(Dp, H, MESH, W / 2 + 0.01, H / 2, 0, 0, -Math.PI / 2);   // mesh on the back and the ends, the front open
    c.sign(['RESTOCK CAGE', 'good returns go back on the racks'], 2.2, 0.5, 0, H + 0.35, 0.02, 0, { w: 512, h: 128, bg: '#1e7a3a', fg: '#fff' }); c.box(W, 0.05, 0.05, FR, 0, H + 0.6, 0); c.box(0.03, 0.6, 0.03, FR, -1.0, H + 0.3, 0); c.box(0.03, 0.6, 0.03, FR, 1.0, H + 0.3, 0);
    c.plane(W + 0.4, 1.1, std({ color: 0x242c36, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.004, Dp / 2 + 0.6, -Math.PI / 2, 0);
    c.solid(-W / 2 - 0.05, W / 2 + 0.05, -Dp / 2 - 0.05, Dp / 2 + 0.05, 0, H);
  } });
  // the compactor: a steel body with a hopper mouth, a hydraulic ram housing on top, a hazard band and the SCRAP sign; the bin's own handlers
  defProp('retCompactor', { label: 'cardboard compactor', cat: 'hall', abs: true, keep: true, fixed: true, x: RET.compactor.x, z: RET.compactor.z, rot: 0, when: retWhen, build: function (c) {
    var BODY = std({ color: 0x3b7a3e, roughness: 0.55, metalness: 0.45 }), FR = MAT.steelDark;
    c.box(1.8, 1.7, 1.3, BODY, 0, 0.85, 0); c.box(1.9, 0.08, 1.4, FR, 0, 0.04, 0); c.box(1.9, 0.08, 1.4, FR, 0, 1.74, 0);
    c.box(1.2, 0.5, 0.8, FR, 0, 2.03, -0.1); c.cyl(0.14, 0.5, MAT.chrome, 0, 2.53, -0.1, 14); c.cyl(0.1, 0.3, FR, 0, 2.93, -0.1, 12);   // the ram housing and its cylinder
    c.box(1.0, 0.6, 0.06, MAT.black, 0, 1.2, 0.68); c.box(1.1, 0.06, 0.3, MAT.hazard, 0, 0.88, 0.75).rotation.x = 0.35; c.box(0.06, 0.6, 0.08, MAT.hazard, -0.53, 1.2, 0.69); c.box(0.06, 0.6, 0.08, MAT.hazard, 0.53, 1.2, 0.69);   // the mouth with its hazard lip
    c.box(0.3, 0.2, 0.08, FR, 0.7, 1.4, 0.68); c.box(0.06, 0.06, 0.02, glowMat(0x5fd38d, 1.2), 0.64, 1.42, 0.73); c.box(0.06, 0.06, 0.02, MAT.red, 0.76, 1.42, 0.73);   // the start and stop buttons
    c.sign(['SCRAP', 'cardboard only · damaged returns'], 1.4, 0.5, 0, 1.55, 0.68, 0, { w: 448, h: 160, bg: '#c8342a', fg: '#fff' });
    c.plane(1.6, 0.9, MAT.hazard, 0, 0.0065, 1.15, -Math.PI / 2, 0);
    c.solid(-0.95, 0.95, -0.7, 0.7, 0, 2.6); c.hit(2.0, 1.8, 1.6, 0, 0.9, 0.2, { prompt: function () { return binPrompt(); }, use: function () { binUse(); } });
  } });
  // the dock console on the east wall south of the returns dock, like every other dock's: the door, the truck, the queue
  defProp('consoleRet', { label: 'dock console RETURNS', cat: 'wall', abs: true, keep: true, fixed: true, x: HALL.x - 0.3, z: RET.dockZ + 3.4, rot: 3, when: retWhen, build: consoleBuild(6) });
  // the floor: zone names, the hazard round the compactor and the zebra from the doorway up to the inspection row
  defProp('retPaint', { label: 'returns hall floor paint', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, when: retWhen, build: function (c) {
    var lbl = function (t, x, z, w, col, ry) { var m = c.plane(w, 0.42, new THREE.MeshBasicMaterial({ map: textTex([t], { w: 512, h: 96, bg: '#8b8d8e', fg: col || '#d9a12c' }) }), x, 0.0066, z, -Math.PI / 2, 0); if (ry) m.rotation.z = ry; };
    lbl('RECEIVING', 32.2, -31.2, 2.6); lbl('INSPECTION', 23.4, -36.1, 3.0); lbl('RESTOCK', 30.5, -41.3, 2.2, '#5fd38d'); lbl('SCRAP', 15.5, -41.1, 1.8, '#ff6b5e');
    var D = HALLS.hall2.door, dcx = (D.x0 + D.x1) / 2; for (var z = -27.8; z > -31.2; z -= 0.7) c.plane(1.2, 0.35, MAT.whiteLine, dcx, 0.0065, z, -Math.PI / 2, 0);   // the zebra from the doorway walkway up into the hall
    c.plane(0.1, 3.4, MAT.yellowLine, 17.2, 0.006, -37.6, -Math.PI / 2, 0); c.plane(0.1, 3.4, MAT.yellowLine, 29.6, 0.006, -37.6, -Math.PI / 2, 0); c.plane(12.5, 0.1, MAT.yellowLine, 23.4, 0.006, -35.9, -Math.PI / 2, 0); c.plane(12.5, 0.1, MAT.yellowLine, 23.4, 0.006, -39.3, -Math.PI / 2, 0);   // the inspection row's box: from the belt's side to behind the desks
  } });
  defProp('retSign', { label: 'returns hall sign', cat: 'hall', abs: true, keep: true, fixed: true, x: 0, z: 0, rot: 0, when: retWhen, build: function (c) {
    var H = HALLS.hall2;
    c.sign(['RETURNS', 'RECEIVE · INSPECT · RESTOCK · SCRAP'], 5.2, 1.3, (H.x0 + H.x1) / 2 + 4.5, 5.0, H.z0 + 0.19, 0, { w: 768, h: 192, bg: '#1b232c', fg: '#f5b53d', size: 72 });   // on the far wall, east of the hall's own name plate (x 16 to 20) and above the clock
    c.sign(['RETURNS DOCK', 'the belt takes the returns in while the door is up'], 2.6, 0.7, H.x1 - 0.2, 5.4, RET.dockZ, -Math.PI / 2, { w: 640, h: 160, bg: '#1b232c', fg: '#eef1f5' });
  } });
  // a save that had stock in Hall 2's rows (20 and 21, 1.14 to 1.16): the boxes move to other rows, or stand on pallets on this floor
  function migrateReturnsHall() {
    var moved = 0, dropped = 0, keys = Object.keys(S.slots || {});
    keys.forEach(function (k) { var r = +k.split(',')[0]; if (r !== 20 && r !== 21) return; var sl = S.slots[k]; delete S.slots[k]; if (!sl || !sl.n) return; var key = findSlotFor(sl.sku, sl.n, 2); if (key && slotSpace(key, sl.sku) >= sl.n) { slotAdd(key, sl.sku, sl.n); if (sl.pal && S.slots[key]) S.slots[key].pal = true; moved += sl.n; } else { var b = +k.split(',')[1]; newPallet(sl.sku, sl.n, { place: 'floor', x: 13.0 + (b % 7) * 3.0, z: r === 20 ? -30.5 : -40.0, y: 0, rot: 0, wrapped: !!sl.wrapped }); dropped += sl.n; } });
    if (S.layout) { delete S.layout.rack20; delete S.layout.rack21; delete S.layout.aislehall2; }
    if (moved || dropped) logEvent('Hall 2 is the returns hall now and its racks are gone: ' + moved + ' boxes moved to other rows' + (dropped ? ', ' + dropped + ' left on pallets on its floor' : ''), '');
  }
