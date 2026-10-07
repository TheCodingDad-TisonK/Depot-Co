//@ props: every movable thing is a definition with a default spot; build mode (F2) moves, turns, removes, restores and adds them
  // ── The prop system ───────────────────────────────────────────────
  // A prop is built by defProp(id, { label, x, z, rot, cat, wall, price, build(ctx, P) }). Its placement is the default from the
  // definition unless S.layout[id] overrides it. Bought extras live in S.custom as { id, type, x, z, rot }. Rotation is in quarter
  // turns. Each prop builds into its own group, so moving it is: remove the instance, build it again at the new spot.
  var PROPS = {}, PROP_ORDER = [], propInst = {};
  // defaults were authored for the 40 x 28 hall; the hall grew by 10 m on every side, so anything near a wall follows its wall
  function grown(v) { return Math.abs(v) >= 8 ? v + (v < 0 ? -HALL_GROW : HALL_GROW) : v; }
  var HALL_GROW = 10;   // the first growth (40 to 60 m wide); the second is wallX in the config
  function defProp(id, def) {
    if (!def.abs && typeof def.x === 'number') { def.x = grown(def.x); def.z = grown(def.z); }
    if (typeof def.x === 'number' && !def.keep && !/^gantry/.test(id)) def.x = wallX(def.x, def.z, !!def.yard);   // the side walls moved out: wall-side props follow
    def.id = id; PROPS[id] = def; PROP_ORDER.push(id); }
  function propDef(id) { if (PROPS[id]) return PROPS[id]; var c = customById(id); return c ? PROPS[c.type] : null; }
  function customById(id) { return (S.custom || []).filter(function (c) { return c.id === id; })[0] || null; }
  function propPlacement(id) {
    var d = PROPS[id], c = customById(id), o = (S.layout && S.layout[id]) || {};
    if (c) return { x: typeof o.x === 'number' ? o.x : c.x, z: typeof o.z === 'number' ? o.z : c.z, rot: typeof o.rot === 'number' ? o.rot : (c.rot || 0), h: typeof o.h === 'number' ? o.h : (c.h || 0), hidden: !!o.hidden, custom: true };
    return { x: typeof o.x === 'number' ? o.x : d.x, z: typeof o.z === 'number' ? o.z : d.z, rot: typeof o.rot === 'number' ? o.rot : (d.rot || 0), h: o.h || 0, hidden: !!o.hidden, custom: false };
  }
  function propLabel(id) { var d = propDef(id); return d ? d.label : id; }
  function rotAABB(o, rot) {
    var pts = [[o.x0, o.z0], [o.x1, o.z0], [o.x0, o.z1], [o.x1, o.z1]], a = rot * Math.PI / 2, c = Math.cos(a), s = Math.sin(a), xs = [], zs = [];
    pts.forEach(function (p) { xs.push(p[0] * c + p[1] * s); zs.push(-p[0] * s + p[1] * c); });
    return { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), z0: Math.min.apply(null, zs), z1: Math.max.apply(null, zs) };
  }
  function propCtx(g, id) {
    var obs = [];
    var ctx = {
      group: g, obstacles: obs,
      box: function (w, h, d, mat, x, y, z) { return box(w, h, d, mat, x, y, z, g); },
      cyl: function (r, h, mat, x, y, z, seg, rb) { return cyl(r, h, mat, x, y, z, g, seg, rb); },
      sphere: function (r, mat, x, y, z) { return sphere(r, mat, x, y, z, g); },
      plane: function (w, h, mat, x, y, z, rx, ry) { return plane(w, h, mat, x, y, z, rx, ry, g); },
      sign: function (lines, w, h, x, y, z, ry, opt) { return sign(lines, w, h, x, y, z, ry, opt, g); },
      poster: function (kind, w, h, x, y, z, ry) { return poster(kind, w, h, x, y, z, ry, g); },
      hit: function (w, h, d, x, y, z, def) { var m = hitBox(w, h, d, x, y, z, def, g); m.userData.propId = id; return m; },
      solid: function (x0, x1, z0, z1, y0, y1) { obs.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: y0 === undefined ? -1 : y0, y1: y1 === undefined ? 3 : y1 }); },
      add: function (m) { g.add(m); return m; }
    };
    return ctx;
  }
  function removePropInst(id) {
    var inst = propInst[id]; if (!inst) return;
    inst.g.traverse(function (o) { var k = inter.indexOf(o); if (k >= 0) inter.splice(k, 1); if (o.isMesh && o.geometry && !o.userData.sharedGeo) { /* geometry from boxGeo is cached and shared: do not dispose */ } });
    scene.remove(inst.g);
    var inGroup = function (o) { for (var p = o; p; p = p.parent) if (p === inst.g) return true; return false; };
    yard.lampLenses = yard.lampLenses.filter(function (l) { return !inGroup(l); }); for (var yl = yardLights.length - 1; yl >= 0; yl--) if (inGroup(yardLights[yl])) yardLights.splice(yl, 1);
    dress.clocks = dress.clocks.filter(function (c) { return !c.group || !inGroup(c.group); }); for (var si = screens.length - 1; si >= 0; si--) if (inGroup(screens[si].mesh)) screens.splice(si, 1);
    BELT_PLANES = BELT_PLANES.filter(function (p) { return !inGroup(p); });
    for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1);
    delete propInst[id]; NAV.dirty = true; beltsChanged();
  }
  // a belt piece that is going for good: whatever rides it is set down on the floor where it was
  function beltSpill(id) {
    var b = BELTS[id]; if (!b) return; var placed = !!(customById(id) || PROPS[id]);   // no record any more: set them down at your feet rather than ask a missing prop where it stood
    beltItems(id).forEach(function (it) { var w = placed ? beltPoint(b, it.d) : { x: player.x, z: player.z, ry: player.yaw }; if (it.kind === 'box') S.floor.push({ kind: 'box', sku: it.sku, x: w.x, y: floorY(w.x, w.z), z: w.z, rot: w.ry }); else if (it.kind === 'parcel' && it.order) S.floor.push({ kind: 'parcel', order: it.order, x: w.x, y: floorY(w.x, w.z), z: w.z, rot: w.ry }); });
    beltItems(id).length = 0;
    delete S.belts[id]; delete BELTS[id]; beltsChanged();
  }
  function buildProp(id) {
    removePropInst(id);
    var def = propDef(id); if (!def) return null;
    var P = propPlacement(id), g = new THREE.Group(); g.userData.propId = id; g.position.set(P.x, typeof def.y === 'number' ? def.y : propGroundY(P.x, P.z), P.z); g.rotation.y = P.rot * Math.PI / 2;   // a def may fix its height: an annex rack's origin falls outside its hall
    var ctx = propCtx(g, id), inst = { id: id, g: g, P: P, ctx: ctx };
    if (!P.hidden) propInst[id] = inst;   // a removed prop is not on the list: nothing then counts a hidden machine as standing
    if (!P.hidden) {
      def.build(ctx, P, inst);
      if (def.beltPath) { var bh = P.h || 0; BELTS[id] = { id: id, prop: id, path: def.beltPath.map(function (p) { return [p[0], p[1], (p[2] || 0) + bh, p[3]]; }), speedKey: 'belts', piece: true }; }
      g.traverse(function (o) { if (o.isMesh) o.userData.propId = id; });
      ctx.obstacles.forEach(function (o) { var r = rotAABB(o, P.rot); solids.push({ x0: P.x + r.x0, x1: P.x + r.x1, z0: P.z + r.z0, z1: P.z + r.z1, y0: o.y0, y1: o.y1, prop: id }); });
      if (def.after) def.after(ctx, P, inst);
      if (!def.wall && !def.fixed && !/^rack/.test(id) && ctx.obstacles.length) { var fx0 = 1e9, fx1 = -1e9, fz0 = 1e9, fz1 = -1e9; ctx.obstacles.forEach(function (o) { fx0 = Math.min(fx0, o.x0); fx1 = Math.max(fx1, o.x1); fz0 = Math.min(fz0, o.z0); fz1 = Math.max(fz1, o.z1); }); groundBlob((fx1 - fx0) * 1.5 + 0.3, (fz1 - fz0) * 1.5 + 0.3, (fx0 + fx1) / 2, (fz0 + fz1) / 2, g, 0); }
    }
    scene.add(g); NAV.dirty = true; shadowDirty = true; beltsChanged();
    return inst;
  }
  function buildProps() { PROP_ORDER.forEach(function (id) { if (!PROPS[id].extra && (!PROPS[id].when || PROPS[id].when())) buildProp(id); }); (S.custom || []).forEach(function (c) { if (PROPS[c.type]) buildProp(c.id); }); }
  function propGroundY(x, z) { if (insideHall(x, z)) return 0; for (var i = 0; i < S.trucks.length; i++) { var t = S.trucks[i]; if (t.state === 'docked') { var b = trailerBounds(t); if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return 0; } } return YARD_Y; }
  function propIdOf(obj) { for (var o = obj; o; o = o.parent) if (o.userData && o.userData.propId) return o.userData.propId; return null; }

  // ── Build mode ────────────────────────────────────────────────────
  var edit = { on: false, grabbed: null, helper: null, snap: true, wallAim: null, snapCycle: 0, grabRot: 0 };   // snapCycle: which snap (or free heading) R has walked to for the carried belt piece
  function editToggle() {
    if (edit.grabbed) editDrop(true);
    edit.on = !edit.on;
    var eb = $('h-edit'); if (eb) { eb.hidden = !edit.on; }
    if (edit.on) { unbakeStatic(); focus = null; toast('🛠️ Build mode: aim at a prop and E grabs it · R turns · Backspace puts it back · Del removes · C is the catalogue · F2 done', ''); }
    else { if (edit.helper) { scene.remove(edit.helper); edit.helper = null; } bakeStatic(); save(); toast('Layout saved', 'good'); }
    sfx('click'); hudDirty = true;
  }
  function editHelper(obj, col) {
    if (!obj) { if (edit.helper) edit.helper.visible = false; return; }
    if (edit.helper && edit.helper.userData.col !== col) { scene.remove(edit.helper); edit.helper = null; }
    if (!edit.helper) { edit.helper = new THREE.BoxHelper(obj, col); edit.helper.userData.col = col; scene.add(edit.helper); }
    edit.helper.visible = true; edit.helper.setFromObject(obj);
  }
  // where the carried prop goes: the point on the floor the player aims at, or 2.6 m ahead; wall props sit on the nearest wall face
  var WALLS = [];
  function wallPlanes() {
    if (WALLS.length) return WALLS;
    var X = HALL.x, Z = HALL.z;
    WALLS.push({ a: 'x', v: -X + 0.17, n: 1, z0: -Z, z1: Z }, { a: 'x', v: X - 0.17, n: -1, z0: -Z, z1: Z }, { a: 'z', v: -Z + 0.17, n: 1, x0: -X, x1: X }, { a: 'z', v: Z - 0.17, n: -1, x0: -X, x1: X });
    WALLS.push({ a: 'x', v: X - 7.58, n: -1, z0: 18.5, z1: Z }, { a: 'x', v: X - 7.42, n: 1, z0: 18.5, z1: Z }, { a: 'z', v: 18.42, n: -1, x0: X - 7.5, x1: X }, { a: 'z', v: 18.58, n: 1, x0: X - 7.5, x1: X });
    WALLS.push({ a: 'x', v: -X + 4.42, n: 1, z0: 18.5, z1: Z }, { a: 'x', v: -X + 4.58, n: -1, z0: 18.5, z1: Z }, { a: 'z', v: 18.42, n: -1, x0: -X, x1: -X + 4.5 }, { a: 'z', v: 18.58, n: 1, x0: -X, x1: -X + 4.5 });
    WALLS.push({ a: 'x', v: -X + 6.92, n: 1, z0: -Z, z1: -20.2 }, { a: 'x', v: -X + 7.08, n: -1, z0: -Z, z1: -20.2 }, { a: 'z', v: -20.28, n: -1, x0: -X, x1: -X + 7 }, { a: 'z', v: -20.12, n: 1, x0: -X, x1: -X + 7 });
    return WALLS;
  }
  function editAim(def) {
    ray.setFromCamera(centre, camera);
    var dir = ray.ray.direction, o = ray.ray.origin, y = Math.max(YARD_Y, floorY(player.x, player.z)), pt;
    var t = (y - o.y) / dir.y;
    if (dir.y < -0.05 && t > 0 && t < 10) pt = o.clone().add(dir.clone().multiplyScalar(t));
    else { var flat = dir.clone(); flat.y = 0; flat.normalize(); pt = o.clone().add(flat.multiplyScalar(2.6)); pt.y = y; }
    var sn = function (v) { return edit.snap ? Math.round(v * 20) / 20 : v; };
    if (def.beltPath) { var bs = beltSnap(def, pt, edit.grabbed); edit.snapText = bs ? bs.text : ''; if (bs) return bs; }
    if (def.wall) {
      var best = null, bd = 2.5;
      wallPlanes().forEach(function (w) { var d = w.a === 'x' ? Math.abs(pt.x - w.v) : Math.abs(pt.z - w.v); var within = w.a === 'x' ? (pt.z > w.z0 && pt.z < w.z1) : (pt.x > w.x0 && pt.x < w.x1); if (within && d < bd) { bd = d; best = w; } });
      if (best) { if (best.a === 'x') return { x: best.v, z: sn(pt.z), rot: best.n > 0 ? 1 : 3, wall: true }; return { x: sn(pt.x), z: best.v, rot: best.n > 0 ? 0 : 2, wall: true }; }
    }
    if (!def.yard && insideHall(pt.x, pt.z)) return { x: sn(pt.x), z: sn(pt.z), rot: null, wall: false };   // the wing and the annex halls are rooms too
    var lim = def.yard ? 80 : HALL.x - 0.4, limz = def.yard ? 60 : HALL.z - 0.4;
    return { x: clamp(sn(pt.x), -lim, lim), z: clamp(sn(pt.z), -limz, limz), rot: null, wall: false };
  }
  // Where a carried belt piece snaps. Anchors are gathered fresh each time: free belt ends, machine outlets, the parcel shelf
  // and the inbound doors feed a piece (its start goes there); free belt starts, machine inlets, the outbound doors and the
  // rack bays take from a piece (its end goes there). The nearest anchor within two metres of the aim wins; the piece turns
  // to run with it, and climbs or drops to its height. A belt end that already feeds something, or a start already fed, is skipped.
  function beltSnap(def, pt, selfId) {
    var R2 = REACH * REACH, A = [], X = HALL.x, Z = HALL.z;
    for (var k in BELTS) { var b = BELTS[k]; if (k === selfId || !propInst[b.prop]) continue; var e = beltPoint(b, beltLen(b)), s = beltPoint(b, 0); if (!b.noSink && !beltSink(b)) A.push({ x: e.x, z: e.z, y: e.y, dir: e.ry, feeds: true, what: 'the ' + beltLabel(b) }); if (!beltFeeder(b)) A.push({ x: s.x, z: s.z, y: s.y, dir: s.ry, feeds: false, what: 'the ' + beltLabel(b) }); }
    for (var mk in MACH) { var mc = MACH[mk]; if (mc.door !== undefined) continue; machinePoints(mc, 'out').forEach(function (p) { A.push({ x: p.x, z: p.z, y: BELT_Y, dir: null, feeds: true, what: 'the ' + propLabel(mc.prop) }); }); if (mc.accept) machinePoints(mc, 'in').forEach(function (p) { A.push({ x: p.x, z: p.z, y: BELT_Y, dir: null, feeds: false, what: 'the ' + propLabel(mc.prop) }); }); }
    if (propInst.packline) { var sh = propWorld('packline', 0, 7.0); A.push({ x: sh.x, z: sh.z, y: BELT_Y, dir: sh.a, feeds: true, what: 'the parcel shelf' }); }
    for (var di = 0; di < DOOR_MAP.length; di++) { if (!doors[di]) continue; var at = doorInside(di); A.push({ x: at[0], z: at[1], y: BELT_Y, dir: Math.PI / 2, feeds: DOOR_MAP[di].dir === 'in', what: 'dock door ' + dockLabel(di) }); }
    var gRows = groundRows(); for (var gri = 0; gri < gRows.length; gri++) for (var bb = 0; bb < rowBays(gRows[gri]); bb++) { var r = gRows[gri], sp = rackSlotPos(r, bb, 0), a = sp.ry || 0; [-1, 1].forEach(function (f) { A.push({ x: sp.x + Math.sin(a) * f * 1.1, z: sp.z + Math.cos(a) * f * 1.1, y: BELT_Y, dir: f > 0 ? a + Math.PI : a, feeds: false, what: slotName(slotKey(r, bb, 0)) }); }); }
    // every anchor within 2.2 m of the aim, nearest first. R walks this list and then the four free headings, so a piece is never
    // stuck on the wrong anchor: it used to take the nearest only, and R did nothing while snapped (a piece into OUT 1 kept
    // landing the wrong way round, Tyson 2026-10-06).
    var near = A.filter(function (an) { return dist2(pt.x, pt.z, an.x, an.z) < 2.2 * 2.2; }).sort(function (p1, p2) { return dist2(pt.x, pt.z, p1.x, p1.z) - dist2(pt.x, pt.z, p2.x, p2.z); });
    var n = near.length, span = n + 4, pick = (((edit.snapCycle || 0) % span) + span) % span, sn = function (v) { return edit.snap ? Math.round(v * 20) / 20 : v; };
    if (pick >= n) { var fr = ((edit.grabRot || 0) + pick - n) % 4, lim = HALL.x - 0.4, limz = HALL.z - 0.4, inRoom = insideHall(pt.x, pt.z); return { x: inRoom ? sn(pt.x) : clamp(sn(pt.x), -lim, lim), z: inRoom ? sn(pt.z) : clamp(sn(pt.z), -limz, limz), rot: fr, wall: false, text: 'Free · runs ' + ['south', 'east', 'north', 'west'][fr] + ' · E places · R turns' + (n ? ', then snaps again' : '') }; }
    var best = near[pick], step = ' · E places · R: ' + (n > 1 ? 'snap ' + (pick + 1) + ' of ' + n + ', next, then free' : 'free placing');
    var path = def.beltPath, last = path[path.length - 1], prev = path[path.length - 2], endDir = Math.atan2(last[0] - prev[0], last[1] - prev[1]), cur = propInst[selfId] ? propInst[selfId].P.rot : 0, q = Math.PI / 2;
    function wrap4(k) { return ((Math.round(k) % 4) + 4) % 4; }
    if (best.feeds) { var rot = best.dir === null ? cur : wrap4(best.dir / q); return { x: best.x, z: best.z, rot: rot, h: Math.round((best.y - BELT_Y) * 100) / 100, wall: false, text: 'Snapped: takes from ' + best.what + step }; }
    var rot2 = best.dir === null ? cur : wrap4((best.dir - endDir) / q), a2 = rot2 * q, ex = last[0] * Math.cos(a2) + last[1] * Math.sin(a2), ez = -last[0] * Math.sin(a2) + last[1] * Math.cos(a2);
    return { x: best.x - ex, z: best.z - ez, rot: rot2, h: Math.round((best.y - BELT_Y - (last[2] || 0)) * 100) / 100, wall: false, text: 'Snapped: feeds ' + best.what + step };
  }
  function ghostProp(id) { propInst[id].g.traverse(function (o) { if (o.isMesh && o.material && o.material.clone && !o.userData.ghosted) { o.userData.origMat = o.material; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.material.depthWrite = false; o.castShadow = false; o.userData.ghosted = true; } }); }
  function editTick() {
    if (!edit.on) return;
    if (edit.grabbed) {
      var inst = propInst[edit.grabbed]; if (!inst) { edit.grabbed = null; return; }
      var def = propDef(edit.grabbed), aim = editAim(def);
      // a belt piece snapped at another height is rebuilt at that height, legs and all, while it is still being carried
      if (def.beltPath && typeof aim.h === 'number' && Math.abs((inst.P.h || 0) - aim.h) > 0.01) { var cc = customById(edit.grabbed); if (cc) cc.h = aim.h; if (S.layout && S.layout[edit.grabbed]) S.layout[edit.grabbed].h = aim.h; buildProp(edit.grabbed); inst = propInst[edit.grabbed]; inst.P.h = aim.h; for (var si = solids.length - 1; si >= 0; si--) if (solids[si].prop === edit.grabbed) solids.splice(si, 1); ghostProp(edit.grabbed); }
      inst.g.position.set(aim.x, propGroundY(aim.x, aim.z), aim.z); if (aim.rot !== null && (def.wall || def.beltPath)) { inst.P.rot = aim.rot; inst.g.rotation.y = aim.rot * Math.PI / 2; }
      editHelper(inst.g, 0xf5b53d);
    } else if (focus && focus.editId && propInst[focus.editId]) editHelper(propInst[focus.editId].g, 0x5fd38d);
    else editHelper(null);
  }
  function editGrab(id) {
    if (edit.grabbed || !propInst[id]) return;
    var def = propDef(id); if (def.fixed) { toast('That one stays where it is.', 'bad'); return; }
    edit.grabbed = id; edit.snapText = ''; edit.snapCycle = 0; edit.grabRot = propInst[id].P.rot || 0; for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1); NAV.dirty = true;
    ghostProp(id);
    sfx('pickup'); toast('Carrying the ' + propLabel(id) + ' · E places · R turns · Esc drops it back' + (def.beltPath ? ' · it snaps to belt ends, machines, doors and rack bays' : ''), '');
  }
  function editDrop(cancel) {
    var id = edit.grabbed; if (!id) return; edit.grabbed = null; edit.snapText = '';
    var inst = propInst[id], def = propDef(id);
    if (!cancel && inst) { if (!S.layout) S.layout = {}; S.layout[id] = { x: Math.round(inst.g.position.x * 100) / 100, z: Math.round(inst.g.position.z * 100) / 100, rot: inst.P.rot, h: inst.P.h || 0 }; sfx('putdown'); }
    buildProp(id); editHelper(null); save();
    if (!cancel && inst) { if (def && def.beltPath && BELTS[id]) { var fd = feederLabel(beltFeeder(BELTS[id])), sk = sinkLabel(beltSink(BELTS[id])); toast('Placed the ' + propLabel(id) + (fd ? ' · takes from ' + fd : ' · nothing feeds it yet') + (sk ? ' · feeds ' + sk : ' · ends in the open'), fd || sk ? 'good' : ''); } else toast('Placed the ' + propLabel(id), 'good'); }
  }
  function editRotate(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id || !propInst[id]) return;
    var inst = propInst[id], def = propDef(id); if (def && def.fixed) { toast('That one stays where it is.', 'bad'); return; } if (def.wall && !edit.grabbed) { toast('Wall pieces face the wall.', ''); return; }
    if (edit.grabbed && def.beltPath) { edit.snapCycle++; sfx('click'); return; }   // a carried belt piece: R walks the snaps near the aim, then the four free headings; beltSnap applies it
    inst.P.rot = (inst.P.rot + 1) % 4; inst.g.rotation.y = inst.P.rot * Math.PI / 2; sfx('click');
    if (!edit.grabbed) { if (!S.layout) S.layout = {}; S.layout[id] = { x: inst.g.position.x, z: inst.g.position.z, rot: inst.P.rot }; buildProp(id); save(); }
  }
  function editReset(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id) return; if (propDef(id) && propDef(id).fixed) { toast('That one stays where it is.', 'bad'); return; }
    if (edit.grabbed) edit.grabbed = null;
    if (S.layout) delete S.layout[id]; buildProp(id); editHelper(null); sfx('ok'); toast('Put the ' + propLabel(id) + ' back where it started', 'good'); save();
  }
  function editRemove(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id) return; if (propDef(id) && propDef(id).fixed) { toast('That one stays where it is.', 'bad'); return; }
    var c = customById(id);
    if (edit.grabbed) edit.grabbed = null;
    if (c) { var def = PROPS[c.type]; if (def && def.beltPath) beltSpill(id); S.custom.splice(S.custom.indexOf(c), 1); removePropInst(id); if (def && def.beltPath) { delete BELTS[id]; if (S.belts) delete S.belts[id]; } if (def && def.price) { pay(Math.round(def.price / 2), 'Sold back: ' + def.label); toast('Sold the ' + def.label + ' back for half', ''); } }
    else { if (!S.layout) S.layout = {}; S.layout[id] = S.layout[id] || {}; S.layout[id].hidden = true; buildProp(id); toast('Removed the ' + propLabel(id) + ' (the catalogue brings it back)', ''); }
    editHelper(null); sfx('bad'); save();
  }
  function editRestore(id) { if (S.layout && S.layout[id]) { delete S.layout[id].hidden; } buildProp(id); sfx('ok'); toast('The ' + propLabel(id) + ' is back', 'good'); save(); }
  function editBuy(type) {
    var def = PROPS[type]; if (!def || !def.extra) return;
    if (def.price && S.bank < def.price) { toast('That costs ' + money(def.price) + ' and you have ' + money(S.bank), 'bad'); return; }
    if (def.price) pay(-def.price, 'Bought: ' + def.label);
    if (!S.custom) S.custom = [];
    var aim = editAim(def), c = { id: uid('cp'), type: type, x: aim.x, z: aim.z, rot: aim.rot || 0, h: aim.h || 0 }; S.custom.push(c);
    buildProp(c.id); closePanel(); editGrab(c.id); toast('Carrying the ' + def.label + ' · aim and press E', '');
  }
  // the catalogue (C): removed props to bring back, and extras to buy
  var CAT_GROUPS = [['belt', '🛤 Conveyors: lay a line from parts. A piece snaps to belt ends, machines, dock doors and rack bays as you carry it.'], ['room', '🛋 Break room and office'], ['hall', '🏭 The hall'], ['wall', '🖼 On the wall'], ['yard', '🌳 The yard']];
  function catalogueHtml() {
    var h = '<p>Build mode. Press <kbd>E</kbd> on a prop to carry it, <kbd>R</kbd> to turn it (a carried belt piece first walks through the snap points near your aim, then turns freely), <kbd>Backspace</kbd> to put it back where it started, <kbd>Del</kbd> to remove it. Bought extras sell back for half.</p>';
    var hidden = PROP_ORDER.filter(function (id) { return !PROPS[id].extra && propPlacement(id).hidden; });
    if (hidden.length) h += '<h3>Removed</h3><div class="dc-grid">' + hidden.map(function (id) { return '<div class="dc-card"><div class="body"><b>' + esc(PROPS[id].label) + '</b></div>' + btn('restore', id, 'Bring back', 'primary') + '</div>'; }).join('') + '</div>';
    CAT_GROUPS.forEach(function (gr) {
      var items = PROP_ORDER.filter(function (id) { return PROPS[id].extra && PROPS[id].cat === gr[0]; }); if (!items.length) return;
      h += '<h3>' + gr[1] + '</h3><div class="dc-grid">' + items.map(function (id) { var d = PROPS[id]; return '<div class="dc-card"><div class="body"><b>' + (d.ico || '') + ' ' + esc(d.label) + '</b><small>' + esc(d.desc || '') + '</small></div><div style="text-align:right"><div class="price">' + (d.price ? money(d.price) : 'free') + '</div>' + btn('buy', id, 'Add', 'primary', d.price > S.bank) + '</div></div>'; }).join('') + '</div>';
    });
    return h;
  }

  // ── Static bake: props are merged too, and come apart again for build mode ───
  function unbakeStatic() { baked.meshes.forEach(function (m) { scene.remove(m); m.geometry.dispose(); }); baked.meshes = []; baked.draws = 0; baked.hidden = 0; scene.traverse(function (o) { if (o.userData.bakedAway) { o.visible = true; o.userData.bakedAway = false; } }); }

  // ── The definitions ───────────────────────────────────────────────
  // Local coordinates: the prop's origin is on the floor at the middle of its footprint; +z is its front. rot turns it in quarters.
  var CHAIR_RED = std({ color: 0xc8342a, roughness: 0.6 });
  function chairBuild(c) {
    var shell = new THREE.Mesh(bevelGeo(0.44, 0.05, 0.44, 0.02), CHAIR_RED); shell.position.set(0, 0.46, 0); shell.castShadow = true; c.group.add(shell);
    var back = new THREE.Mesh(bevelGeo(0.42, 0.4, 0.04, 0.02), CHAIR_RED); back.position.set(0, 0.72, -0.2); back.rotation.x = -0.12; c.group.add(back);
    [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (l) { c.cyl(0.014, 0.44, MAT.chrome, l[0], 0.22, l[1], 8); c.cyl(0.02, 0.012, MAT.black, l[0], 0.006, l[1], 8); });
    c.cyl(0.012, 0.36, MAT.chrome, 0, 0.26, -0.18, 6).rotation.z = Math.PI / 2; c.cyl(0.012, 0.36, MAT.chrome, 0, 0.26, 0.18, 6).rotation.z = Math.PI / 2;
    c.cyl(0.012, 0.3, MAT.chrome, -0.18, 0.62, -0.2, 6); c.cyl(0.012, 0.3, MAT.chrome, 0.18, 0.62, -0.2, 6); c.solid(-0.22, 0.22, -0.22, 0.22, 0, 0.5);
  }  function tableBuild(c) {
    var top = new THREE.Mesh(bevelGeo(1.0, 0.05, 1.0, 0.015), std({ color: 0xd7cbb0, roughness: 0.5, map: TEX.wood, normalMap: NRM.wood })); top.position.set(0, 0.75, 0); top.castShadow = true; c.group.add(top); c.box(1.02, 0.02, 1.02, MAT.black, 0, 0.72, 0);
    c.box(0.9, 0.05, 0.05, MAT_MACH.frame, 0, 0.69, -0.42); c.box(0.9, 0.05, 0.05, MAT_MACH.frame, 0, 0.69, 0.42); [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]].forEach(function (o) { c.box(0.05, 0.7, 0.05, MAT_MACH.frame, o[0], 0.35, o[1]); c.cyl(0.03, 0.01, MAT.black, o[0], 0.005, o[1], 8); });
    c.cyl(0.045, 0.1, MAT.white, 0.25, 0.83, -0.15, 12); c.cyl(0.035, 0.08, std({ color: 0x4a2c1a, roughness: 1 }), 0.25, 0.84, -0.15, 10); c.box(0.2, 0.012, 0.28, MAT.paper, -0.22, 0.785, 0.15); c.box(0.18, 0.004, 0.26, std({ color: 0xe8e2cc, roughness: 1 }), -0.2, 0.794, 0.17);
    c.cyl(0.04, 0.12, std({ color: 0xb8322a, roughness: 0.3, metalness: 0.4 }), 0.3, 0.84, 0.25, 10); c.box(0.12, 0.04, 0.08, std({ color: 0xf2b705, roughness: 0.6 }), -0.3, 0.8, -0.3); c.cyl(0.006, 0.14, MAT.black, 0.0, 0.78, 0.35, 6).rotation.z = Math.PI / 2;
    c.solid(-0.5, 0.5, -0.5, 0.5, 0, 0.8);
  }  function lockerBuild(c) {
    var LK = std({ color: 0x6f7b86, roughness: 0.5, metalness: 0.4 }), LD = std({ color: 0x5a6670, roughness: 0.5, metalness: 0.4 });
    c.box(1.24, 0.08, 0.5, MAT.black, 0, 0.04, 0); c.box(1.24, 1.82, 0.48, LK, 0, 0.99, -0.02); c.box(1.26, 0.04, 0.5, LK, 0, 1.92, -0.02);
    [-0.31, 0.31].forEach(function (lx, i) {
      c.box(0.56, 1.7, 0.03, LD, lx, 0.99, 0.23);
      for (var vv = 0; vv < 4; vv++) { c.box(0.34, 0.012, 0.015, MAT.black, lx, 1.68 - vv * 0.035, 0.245); c.box(0.34, 0.012, 0.015, MAT.black, lx, 0.42 - vv * 0.035, 0.245); }
      c.box(0.03, 0.1, 0.025, MAT.chrome, lx + 0.22, 1.0, 0.25); c.box(0.05, 0.03, 0.02, MAT.chrome, lx + 0.22, 1.1, 0.25); var hasp = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), MAT.chrome); hasp.position.set(lx + 0.22, 1.13, 0.26); c.add(hasp);
      c.box(0.2, 0.06, 0.012, MAT.white, lx, 1.8, 0.248); c.sign([String(i + 1)], 0.08, 0.05, lx, 1.8, 0.256, 0, { w: 64, h: 40, bg: '#ffffff', fg: '#1b232c' });
    });
    c.box(0.03, 1.7, 0.03, LK, 0, 0.99, 0.235);
    c.solid(-0.65, 0.65, -0.28, 0.28, 0, 2);
  }
  function cotBuild(c) {
    var FR = MAT_MACH.frame; [[-0.9, -0.42], [0.9, -0.42], [-0.9, 0.42], [0.9, 0.42]].forEach(function (o) { c.box(0.05, 0.42, 0.05, FR, o[0], 0.21, o[1]); c.cyl(0.03, 0.012, MAT.black, o[0], 0.006, o[1], 8); });
    c.box(1.9, 0.05, 0.05, FR, 0, 0.42, -0.44); c.box(1.9, 0.05, 0.05, FR, 0, 0.42, 0.44); c.box(0.05, 0.05, 0.9, FR, -0.92, 0.42, 0); c.box(0.05, 0.05, 0.9, FR, 0.92, 0.42, 0); for (var sl = -0.8; sl <= 0.8; sl += 0.2) c.box(0.03, 0.02, 0.86, FR, sl, 0.43, 0);
    c.box(0.05, 0.5, 0.05, FR, -0.92, 0.65, -0.44); c.box(0.05, 0.5, 0.05, FR, -0.92, 0.65, 0.44); c.box(0.05, 0.05, 0.93, FR, -0.92, 0.9, 0); c.box(0.05, 0.3, 0.05, FR, 0.92, 0.55, -0.44); c.box(0.05, 0.3, 0.05, FR, 0.92, 0.55, 0.44); c.box(0.05, 0.05, 0.93, FR, 0.92, 0.7, 0);
    var mat = new THREE.Mesh(bevelGeo(1.84, 0.16, 0.84, 0.05), std({ color: 0x3c6ea6, roughness: 0.9 })); mat.position.set(0, 0.53, 0); mat.castShadow = true; c.group.add(mat); c.box(1.84, 0.01, 0.84, std({ color: 0x325c8a, roughness: 0.9 }), 0, 0.53, 0);
    var pil = new THREE.Mesh(bevelGeo(0.5, 0.12, 0.4, 0.05), MAT.white); pil.position.set(-0.6, 0.66, 0); pil.rotation.z = 0.06; c.group.add(pil);
    var bl = new THREE.Mesh(bevelGeo(0.7, 0.1, 0.8, 0.03), std({ color: 0x6b2b2b, roughness: 1 })); bl.position.set(0.5, 0.65, 0); c.group.add(bl); c.box(0.7, 0.012, 0.8, std({ color: 0x8a3b3b, roughness: 1 }), 0.5, 0.71, 0); c.box(0.02, 0.1, 0.8, std({ color: 0x5a2424, roughness: 1 }), 0.16, 0.65, 0);
    c.sign(['FIRST AID COT'], 0.6, 0.12, 0, 0.96, -0.47, 0, { w: 256, h: 56, bg: '#1b232c', fg: '#eef1f5' });
    c.hit(2.0, 1.0, 1.0, 0, 0.5, 0, { prompt: function () { return cotPrompt(); }, use: function () { sleepNow(); } });
    c.solid(-0.95, 0.95, -0.47, 0.47, 0, 0.9);
  }  function coffeeBuild(c) {
    var CAB = std({ color: 0xcfd5d2, roughness: 0.6 }), DOOR = std({ color: 0xbfc6c3, roughness: 0.55 }); c.box(1.36, 0.1, 0.52, MAT.black, 0, 0.05, -0.03); c.box(1.4, 0.8, 0.6, CAB, 0, 0.5, 0); [-0.47, 0, 0.47].forEach(function (dx) { var d = new THREE.Mesh(bevelGeo(0.42, 0.66, 0.02, 0.01), DOOR); d.position.set(dx, 0.5, 0.31); c.group.add(d); c.box(0.02, 0.12, 0.03, MAT.chrome, dx + 0.15, 0.7, 0.33); }); var top = new THREE.Mesh(bevelGeo(1.46, 0.04, 0.66, 0.012), std({ color: 0x3a3e45, roughness: 0.35 })); top.position.set(0, 0.92, 0); c.group.add(top); c.box(1.46, 0.08, 0.03, CAB, 0, 0.98, -0.31);
    c.box(0.34, 0.03, 0.3, MAT.chrome, 0.42, 0.935, -0.02); c.box(0.3, 0.12, 0.26, MAT.steel, 0.42, 0.88, -0.02); var tap = c.cyl(0.012, 0.22, MAT.chrome, 0.42, 1.02, -0.18, 8); var tap2 = c.cyl(0.01, 0.16, MAT.chrome, 0.42, 1.12, -0.11, 8); tap2.rotation.x = Math.PI / 2; c.box(0.05, 0.015, 0.03, MAT.chrome, 0.48, 1.0, -0.18); c.box(0.1, 0.06, 0.02, MAT.plastic, 0.42, 1.02, -0.3); c.cyl(0.03, 0.12, std({ color: 0x4caf50, roughness: 0.5 }), 0.62, 1.0, -0.2, 10);
    c.solid(-0.7, 0.7, -0.3, 0.3, 0, 1);
    var CM = new THREE.MeshPhysicalMaterial({ color: 0x1c1e22, roughness: 0.3, metalness: 0.4, clearcoat: 0.8 });
    var cm = new THREE.Mesh(bevelGeo(0.42, 0.42, 0.36, 0.03), CM); cm.position.set(-0.35, 1.15, -0.06); cm.castShadow = true; c.group.add(cm); c.box(0.44, 0.03, 0.38, MAT.chrome, -0.35, 1.37, -0.06); c.cyl(0.09, 0.16, MAT.glass, -0.35, 1.47, -0.12, 14); c.cyl(0.07, 0.12, std({ color: 0x4a2c1a, roughness: 1 }), -0.35, 1.45, -0.12, 12);
    c.box(0.3, 0.025, 0.16, MAT.chrome, -0.35, 0.955, 0.16); for (var dr = 0; dr < 6; dr++) c.box(0.26, 0.005, 0.01, MAT.black, -0.35, 0.97, 0.1 + dr * 0.024); c.cyl(0.03, 0.06, MAT.chrome, -0.35, 1.0, 0.1, 12); c.cyl(0.02, 0.12, MAT.chrome, -0.35, 0.97, 0.16, 8).rotation.x = Math.PI / 2; c.cyl(0.012, 0.07, MAT.black, -0.35, 0.97, 0.23, 8).rotation.x = Math.PI / 2;
    c.cyl(0.035, 0.09, MAT.white, -0.35, 0.995, 0.16, 12); c.cyl(0.015, 0.2, MAT.chrome, -0.14, 1.0, 0.1, 8).rotation.x = 0.6; c.plane(0.14, 0.08, MAT.screen, -0.35, 1.26, 0.125, 0, 0); c.box(0.03, 0.03, 0.01, MAT.green, -0.42, 1.18, 0.125); c.box(0.03, 0.03, 0.01, MAT.red, -0.28, 1.18, 0.125); c.box(0.06, 0.012, 0.012, MAT.chrome, -0.35, 1.08, 0.125);
    c.cyl(0.035, 0.08, MAT.white, -0.55, 1.41, -0.1, 10); c.cyl(0.035, 0.08, MAT.white, -0.47, 1.41, -0.14, 10); c.cyl(0.035, 0.08, MAT.white, -0.22, 1.41, -0.14, 10);
    c.hit(0.5, 0.6, 0.5, -0.35, 1.19, -0.05, { prompt: function () { return S.events.power ? 'The coffee machine is off' : (buff.coffeeUntil > S.time && buff.coffeeDay === S.day ? 'Coffee is still working' : 'Have a coffee (walk faster for an hour)'); }, use: function () { drinkCoffee(); } });
    c.cyl(0.08, 0.2, MAT.chrome, 0.1, 1.04, -0.1, 12); c.cyl(0.02, 0.1, MAT.chrome, 0.17, 1.07, -0.04, 6).rotation.z = -0.8; c.cyl(0.045, 0.1, MAT.white, 0.25, 0.99, 0.12, 10); c.cyl(0.045, 0.1, MAT.red, 0.35, 0.99, 0.02, 10);
    c.box(0.5, 0.3, 0.38, MAT.black, 0.42, 1.09, -0.08); c.plane(0.3, 0.16, MAT.glass, 0.42, 1.11, 0.115, 0, 0); c.box(0.06, 0.1, 0.02, MAT.black, 0.62, 1.09, 0.12);
    var rg = new THREE.Group(); rg.position.set(-0.05, 1.02, 0.1); c.add(rg); dress.radio = rg; rg.userData.worldOf = c.group;
    box(0.36, 0.16, 0.14, MAT.plastic, 0, 0, 0, rg); plane(0.12, 0.1, MAT.rubberMat, -0.09, 0.0, 0.071, 0, 0, rg); plane(0.12, 0.04, glowMat(0xf5b53d, 0.3), 0.09, 0.02, 0.071, 0, 0, rg); cyl(0.005, 0.35, MAT.chrome, 0.15, 0.22, 0, rg, 4).rotation.z = -0.3;
    c.hit(0.4, 0.2, 0.2, -0.05, 1.02, 0.1, { prompt: function () { return radioPrompt(); }, use: function () { radioUse(); } });
  }
  function vendingBuild(c) {
    var BODY = new THREE.MeshPhysicalMaterial({ color: 0x1f4e8c, roughness: 0.35, metalness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 });
    var body = new THREE.Mesh(bevelGeo(0.96, 1.9, 0.8, 0.03), BODY); body.position.set(0, 0.97, 0); body.castShadow = true; c.group.add(body); c.box(0.98, 0.08, 0.82, MAT.black, 0, 0.04, 0); [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]].forEach(function (f) { c.cyl(0.03, 0.03, MAT.black, f[0], 0.015, f[1], 8); });
    c.box(0.66, 1.2, 0.3, MAT.black, -0.1, 1.17, 0.26); c.plane(0.6, 1.1, glowMat(0x9ad0ff, 0.35), -0.1, 1.15, 0.405, 0, 0);
    for (var vr = 0; vr < 4; vr++) { c.box(0.6, 0.012, 0.28, MAT.chrome, -0.1, 0.7 + vr * 0.25, 0.27); for (var vc = 0; vc < 4; vc++) { var pm = std({ color: [0xd14a3a, 0x5fd38d, 0xf0b94d, 0x3fa7d6, 0xf2f2f2][(vr + vc) % 5], roughness: 0.5 }); c.box(0.09, 0.14, 0.08, pm, -0.33 + vc * 0.15, 0.78 + vr * 0.25, 0.3); c.cyl(0.015, 0.26, MAT.chrome, -0.26 + vc * 0.15, 0.72 + vr * 0.25, 0.3, 6).rotation.x = Math.PI / 2; } }
    var gf = c.box(0.64, 1.16, 0.01, MAT.glass, -0.1, 1.15, 0.415); gf.userData.noBake = true; c.box(0.6, 0.02, 0.3, glowMat(0xdfe9ff, 0.5), -0.1, 1.73, 0.26);
    c.box(0.22, 0.5, 0.02, MAT.black, 0.33, 1.3, 0.405); c.plane(0.16, 0.08, MAT.screen, 0.33, 1.48, 0.416, 0, 0); c.box(0.04, 0.06, 0.012, MAT.chrome, 0.33, 1.36, 0.414); c.box(0.03, 0.01, 0.012, MAT.black, 0.33, 1.36, 0.42);
    for (var kp = 0; kp < 12; kp++) c.box(0.035, 0.035, 0.01, MAT.white, 0.26 + (kp % 3) * 0.05, 1.26 - Math.floor(kp / 3) * 0.045, 0.416);
    c.box(0.56, 0.22, 0.04, MAT.black, -0.1, 0.33, 0.405); c.box(0.5, 0.16, 0.02, std({ color: 0x3a3e45, roughness: 0.4, metalness: 0.4 }), -0.1, 0.33, 0.425); c.box(0.44, 0.03, 0.02, MAT.chrome, -0.1, 0.44, 0.432);
    c.sign(['SNACKS'], 0.7, 0.2, -0.1, 1.82, 0.405, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' }); c.sign(['COLD DRINKS · CRISPS · BARS'], 0.76, 0.1, 0, 1.96, 0.405, 0, { w: 512, h: 64, bg: '#1b232c', fg: '#eef1f5' }); c.plane(0.7, 1.4, std({ color: 0x163b6b, roughness: 0.5 }), 0.485, 1.0, 0, 0, Math.PI / 2);
    c.solid(-0.5, 0.5, -0.4, 0.4, 0, 2);
    dress.vending = c.hit(1.0, 1.9, 0.9, 0, 0.95, 0, { prompt: function () { return S.events.power ? 'The vending machine is dark' : 'Buy a snack ($3): walk faster for half an hour'; }, use: function () { buySnack(); } });
  }  function fridgeBuild(c) {
    var FW = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f0, roughness: 0.3, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.2 }); var body = new THREE.Mesh(bevelGeo(0.7, 1.72, 0.68, 0.03), FW); body.position.set(0, 0.96, -0.02); body.castShadow = true; c.group.add(body);
    var dl = new THREE.Mesh(bevelGeo(0.66, 0.52, 0.03, 0.012), FW); dl.position.set(0, 1.56, 0.335); c.group.add(dl); var dl2 = new THREE.Mesh(bevelGeo(0.66, 1.1, 0.03, 0.012), FW); dl2.position.set(0, 0.72, 0.335); c.group.add(dl2); c.box(0.66, 0.01, 0.02, MAT.black, 0, 1.29, 0.345);
    c.box(0.025, 0.4, 0.03, MAT.chrome, -0.28, 1.56, 0.37); c.box(0.025, 0.8, 0.03, MAT.chrome, -0.28, 0.75, 0.37); c.box(0.7, 0.1, 0.02, MAT.black, 0, 0.05, 0.34); for (var gv = 0; gv < 6; gv++) c.box(0.08, 0.06, 0.01, MAT.plastic, -0.25 + gv * 0.1, 0.05, 0.345);
    c.box(0.12, 0.14, 0.004, MAT.paper, 0.15, 1.0, 0.355); c.cyl(0.015, 0.008, MAT.red, 0.15, 1.085, 0.357, 10).rotation.x = Math.PI / 2; c.box(0.1, 0.1, 0.004, std({ color: 0x3b7dd8, roughness: 0.6 }), -0.1, 0.9, 0.355); c.box(0.3, 0.05, 0.004, std({ color: 0x9aa4ad, roughness: 0.5, metalness: 0.5 }), 0, 1.75, 0.355);
    c.solid(-0.37, 0.37, -0.37, 0.37, 0, 2);
  }
  function coolerBuild(c) {
    var CW = std({ color: 0xe9ecef, roughness: 0.45 }); var cab = new THREE.Mesh(bevelGeo(0.38, 0.98, 0.38, 0.02), CW); cab.position.set(0, 0.49, 0); cab.castShadow = true; c.group.add(cab); c.box(0.4, 0.06, 0.4, std({ color: 0x5b6672, roughness: 0.6 }), 0, 1.01, 0); c.box(0.3, 0.02, 0.02, MAT.black, 0, 0.78, 0.19); c.box(0.26, 0.03, 0.12, MAT.plastic, 0, 0.72, 0.14); for (var dr = 0; dr < 5; dr++) c.box(0.24, 0.004, 0.012, MAT.black, 0, 0.74, 0.09 + dr * 0.022);
    c.box(0.03, 0.04, 0.03, MAT.blue, -0.06, 0.84, 0.2); c.box(0.03, 0.04, 0.03, MAT.red, 0.06, 0.84, 0.2); c.cyl(0.006, 0.03, MAT.black, -0.06, 0.835, 0.22, 6); c.cyl(0.006, 0.03, MAT.black, 0.06, 0.835, 0.22, 6);
    var WB = std({ color: 0xbfe3f2, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45 }), WT = std({ color: 0x7fc4e8, roughness: 0.1, transparent: true, opacity: 0.6 }); c.cyl(0.13, 0.44, WB, 0, 1.28, 0, 16); c.cyl(0.124, 0.26, WT, 0, 1.19, 0, 16); c.cyl(0.08, 0.06, WB, 0, 1.53, 0, 14, 0.13); c.cyl(0.05, 0.04, MAT.blue, 0, 1.58, 0, 12); c.sphere(0.02, std({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.6 }), 0.04, 1.26, 0.03);
    c.box(0.08, 0.24, 0.08, CW, 0.23, 0.9, 0); c.cyl(0.03, 0.08, MAT.white, 0.23, 1.06, 0, 10); c.solid(-0.22, 0.22, -0.22, 0.22, 0, 1.6);
  }
  function hooksBuild(c) { c.box(1.9, 0.04, 0.12, MAT.wood, 0, 1.82, 0); for (var hk = 0; hk < 4; hk++) { var hx = -0.68 + hk * 0.45; c.cyl(0.015, 0.1, MAT.chrome, hx, 1.75, 0.05, 6).rotation.x = Math.PI / 2; if (hk !== 2) { c.box(0.36, 0.5, 0.06, hk === 1 ? MAT.hivisOrange : MAT.hivis, hx, 1.45, 0.06); c.box(0.1, 0.06, 0.07, MAT.hivis, hx, 1.72, 0.06); } } }
  function noticeBuild(c) { c.box(1.6, 1.0, 0.04, MAT.wood, 0, 1.9, 0); c.plane(1.5, 0.9, MAT.cork, 0, 1.9, 0.025, 0, 0); c.sign(['TRUCKS', 'IN ' + TRUCK_IN.map(fmtTime).join(' · '), 'SEA ' + TRUCK_OUT[0].windows.map(function (w) { return fmtTime(w.arrive); }).join(' · '), 'LAND ' + TRUCK_OUT[1].windows.map(function (w) { return fmtTime(w.arrive); }).join(' · '), 'AIR ' + TRUCK_OUT[2].windows.map(function (w) { return fmtTime(w.arrive); }).join(' · ')], 0.9, 0.5, -0.25, 2.05, 0.03, 0, { w: 512, h: 320, bg: '#f5f1e6', fg: '#1b232c', size: 40 }); [[0.45, 1.75, -0.1], [-0.1, 1.6, 0.15], [0.55, 1.65, 0.05]].forEach(function (n) { var nb = c.box(0.22, 0.28, 0.004, MAT.paper, n[0], n[1], 0.03); nb.rotation.z = n[2]; c.cyl(0.01, 0.01, MAT.red, n[0], n[1] + 0.12, 0.035, 8).rotation.x = Math.PI / 2; }); }
  function calendarBuild(c) { c.box(0.4, 0.5, 0.02, MAT.paper, 0, 1.7, 0); c.sign(['OCTOBER', '', '1  2  3  4  5  6  7', '8  9 10 11 12 13 14'], 0.36, 0.44, 0, 1.7, 0.012, 0, { w: 256, h: 320, bg: '#f3efe4', fg: '#1b232c', size: 28 }); }
  function clockBuild(r) { return function (c) { var g = new THREE.Group(); g.position.set(0, 2.7, 0.02); c.add(g); var face = cyl(r, 0.03, MAT.white, 0, 0, 0, g, 32); face.rotation.x = Math.PI / 2; var rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 32), MAT.steelDark); g.add(rim); for (var i = 0; i < 12; i++) { var t = box(i % 3 ? 0.015 : 0.03, i % 3 ? 0.04 : 0.07, 0.01, MAT.black, Math.sin(i / 12 * 6.283) * (r - 0.07), Math.cos(i / 12 * 6.283) * (r - 0.07), 0.02, g); t.rotation.z = -i / 12 * 6.283; } var hh = new THREE.Group(), mh = new THREE.Group(); hh.position.z = 0.025; mh.position.z = 0.03; g.add(hh); g.add(mh); box(0.035, r * 0.55, 0.01, MAT.black, 0, r * 0.22, 0, hh); box(0.025, r * 0.85, 0.01, MAT.black, 0, r * 0.37, 0, mh); cyl(0.03, 0.02, MAT.red, 0, 0, 0.035, g, 10).rotation.x = Math.PI / 2; g.userData.dynamic = true; dress.clocks.push({ h: hh, m: mh, group: c.group }); }; }
  // a framed poster: the print on a white mount, a sheet of glass over it that catches the lamps at an angle, a black frame round the lot
  function posterBuild(kind, w, h) { return function (c) { c.box(w + 0.05, h + 0.05, 0.012, MAT.white, 0, 2.0, 0.002).castShadow = false; c.poster(kind, w - 0.04, h - 0.04, 0, 2.0, 0.01, 0); var gl = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.05, h + 0.05), MAT.screenGlass); gl.position.set(0, 2.0, 0.016); gl.renderOrder = 2; c.add(gl); var fw = w + 0.08, fh = h + 0.08; c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 + fh / 2, 0.004); c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 - fh / 2, 0.004); c.box(0.03, fh, 0.03, MAT.black, -fw / 2, 2.0, 0.004); c.box(0.03, fh, 0.03, MAT.black, fw / 2, 2.0, 0.004); }; }
  function extinguisherBuild(c) { c.cyl(0.08, 0.5, MAT.red, 0, 1.0, 0.12, 12); c.cyl(0.05, 0.08, MAT.black, 0, 1.28, 0.12, 10); c.box(0.03, 0.12, 0.1, MAT.black, 0, 1.36, 0.14); c.cyl(0.012, 0.42, MAT.black, 0.08, 1.0, 0.15, 6).rotation.z = 0.15; c.cyl(0.02, 0.07, MAT.black, 0.11, 0.79, 0.17, 8, 0.03); c.cyl(0.025, 0.02, MAT.white, 0.0, 1.3, 0.21, 10).rotation.x = Math.PI / 2; c.box(0.1, 0.1, 0.002, MAT.paper, 0, 1.0, 0.202); c.box(0.2, 0.04, 0.1, MAT.steelDark, 0, 0.72, 0.05); c.sign(['FIRE'], 0.3, 0.12, 0, 1.6, 0.04, 0, { w: 128, h: 48, bg: '#c8342a', fg: '#fff' }); }
  function firstAidBuild(c) { c.box(0.3, 0.3, 0.1, MAT.white, 0, 1.7, 0.05); c.box(0.18, 0.05, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.05, 0.18, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.12, 0.02, 0.02, MAT.chrome, 0, 1.87, 0.05); }
  function binPrompt() { var bp = isJack(player.tool) ? jackPallet() : null; if (bp && bp.n > 0) return 'Write off the whole pallet (' + bp.n + ' × ' + skuName(bp.sku) + ', ' + money(Math.round(SKU[bp.sku].val * 0.5 * bp.n)) + ')'; if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return S.hand.ret ? 'Bin the damaged return (no charge)' : 'Bin the damaged box'; if (S.hand && S.hand.kind === 'box') return 'That box is fine: it belongs on a rack'; return 'The bin · ' + (S.binned || 0) + ' damaged boxes written off'; }
  function binUse() { var bp = isJack(player.tool) ? jackPallet() : null; if (bp && bp.n > 0) { var n = bp.n, bsku = bp.sku, bcost = Math.round(SKU[bsku].val * 0.5 * n); bp.n = 0; bp.wrapped = false; S.binned = (S.binned || 0) + n; addWaste(2 * n); pay(-bcost, 'Written off: ' + n + ' × ' + skuName(bsku)); addRep(-0.5 * Math.min(n, 4)); sfx('crate'); toast('Pallet written off: ' + n + ' boxes, ' + money(bcost) + '. The pallet is empty again.', 'bad'); logEvent(n + ' boxes of ' + skuName(bsku) + ' went in the bin off a pallet (' + money(bcost) + ')', 'bad'); hudDirty = true; return; }
    if (!(S.hand && S.hand.kind === 'box' && S.hand.damaged)) { sfx('click'); return; } var sku = S.hand.sku, ret = !!S.hand.ret; handSet(null); S.binned = (S.binned || 0) + 1; addWaste(2);
    if (ret) { sfx('crate'); toast('Binned. A damaged return: nothing to pay.', ''); logEvent('A damaged return of ' + skuName(sku) + ' went in the bin'); return; }
    var cost = Math.round(SKU[sku].val * 0.5); pay(-cost, 'Written off: a damaged box of ' + skuName(sku)); addRep(-0.5); sfx('crate'); toast('Binned. The client charges ' + money(cost) + ' for it.', 'bad'); logEvent('A damaged box of ' + skuName(sku) + ' went in the bin (' + money(cost) + ')', 'bad'); }
  function binBuild(c) { c.box(0.46, 0.85, 0.5, MAT.red, 0, 0.47, 0); c.box(0.52, 0.05, 0.56, std({ color: 0x8e2420, roughness: 0.7 }), 0, 0.92, 0); c.box(0.08, 0.03, 0.5, MAT.black, 0.22, 0.95, 0); c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, -0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, 0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.015, 0.5, MAT.steelDark, -0.2, 0.09, 0, 6).rotation.x = Math.PI / 2; c.solid(-0.3, 0.3, -0.3, 0.3, 0, 1); c.hit(0.7, 0.9, 0.7, 0, 0.45, 0, { prompt: function () { return binPrompt(); }, use: function () { binUse(); } }); c.sign(['DAMAGED', 'GOODS'], 0.5, 0.3, 0, 1.1, 0.0, 0, { w: 256, h: 128, bg: '#c8342a', fg: '#fff' }); }
  function broomBuild(c) { var broom = c.cyl(0.014, 1.3, MAT.wood, 0.02, 0.72, 0, 6); broom.rotation.z = 0.22; c.box(0.3, 0.06, 0.06, MAT.plastic, 0.18, 0.1, 0); c.box(0.3, 0.06, 0.05, std({ color: 0x8a7a55, roughness: 1 }), 0.18, 0.04, 0); c.cyl(0.02, 0.04, MAT.red, -0.13, 1.36, 0, 8); }
  function wetFloorBuild(c) { var face = new THREE.MeshBasicMaterial({ map: textTex(['CAUTION', 'WET FLOOR'], { w: 192, h: 256, bg: '#f5b53d', fg: '#111', size: 34 }) }); [-1, 1].forEach(function (s) { var pg = new THREE.Group(); pg.position.set(0, 0.72, 0); pg.rotation.x = s * 0.32; c.add(pg); box(0.34, 0.72, 0.012, MAT.yellow, 0, -0.36, s * 0.006, pg); var f = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.6), face); f.position.set(0, -0.38, s * 0.014); f.rotation.y = s > 0 ? 0 : Math.PI; pg.add(f); box(0.02, 0.72, 0.02, MAT.black, -0.17, -0.36, s * 0.01, pg); box(0.02, 0.72, 0.02, MAT.black, 0.17, -0.36, s * 0.01, pg); box(0.34, 0.03, 0.02, MAT.black, 0, -0.72, s * 0.012, pg); }); c.cyl(0.012, 0.36, MAT.black, 0, 0.72, 0, 8).rotation.z = Math.PI / 2; c.box(0.1, 0.03, 0.02, MAT.black, 0, 0.75, 0); }
  // a real wooden pallet: three bearers, seven top boards with gaps, three bottom boards
  function palletModel(c, x, y, z, ry) { var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; c.add(g); [-0.5, 0, 0.5].forEach(function (bz) { box(1.2, 0.08, 0.1, MAT.wood, 0, 0.065, bz, g); box(1.2, 0.022, 0.1, MAT.wood, 0, 0.011, bz, g); }); for (var i = 0; i < 7; i++) box(i === 0 || i === 6 ? 0.14 : 0.1, 0.022, 1.0, MAT.wood, -0.53 + i * 0.1766, 0.116, 0, g); return g; }
  function emptiesBuild(c) {
    for (var i = 0; i < 9; i++) palletModel(c, randf(-0.015, 0.015), i * 0.128, randf(-0.015, 0.015), randf(-0.02, 0.02));
    var mk = std({ color: 0xf0b400, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }); c.plane(1.5, 0.05, mk, 0, 0.004, 0.7, -Math.PI / 2, 0); c.plane(1.5, 0.05, mk, 0, 0.004, -0.7, -Math.PI / 2, 0); c.plane(0.05, 1.45, mk, 0.75, 0.004, 0, -Math.PI / 2, 0); c.plane(0.05, 1.45, mk, -0.75, 0.004, 0, -Math.PI / 2, 0);
    c.cyl(0.02, 1.5, MAT.steel, 1.05, 0.75, 0.75, 8); c.cyl(0.14, 0.04, MAT.steel, 1.05, 0.02, 0.75, 14); c.sign(['EMPTY', 'PALLETS'], 0.5, 0.3, 1.05, 1.5, 0.75, 0, { w: 256, h: 150, bg: '#1b232c', fg: '#f0b400' }); c.sign(['EMPTY', 'PALLETS'], 0.5, 0.3, 1.05, 1.5, 0.75, Math.PI, { w: 256, h: 150, bg: '#1b232c', fg: '#f0b400' });
    c.hit(1.4, 1.6, 1.3, 0, 0.8, 0, { prompt: function () { var jp = isJack(player.tool) ? jackPallet() : null; if (jp && jp.n === 0) return 'Stack the empty pallet here (' + (S.emptiesN || 0) + ' stacked)'; if (isJack(player.tool) && !jp) return (S.emptiesN || 0) > 0 ? 'Take an empty pallet onto the jack (' + S.emptiesN + ' stacked)' : 'No empty pallets left on the stack'; return 'Empty pallets · ' + (S.emptiesN || 0) + ' stacked · bring empties here on the jack, or take one for loose boxes'; },
      use: function () { if (!isJack(player.tool)) { sfx('click'); return; } var tl = jackTool(), jp = jackPallet(); if (jp && jp.n === 0) { removePallet(jp.id); S[tl].pallet = null; S.emptiesN = (S.emptiesN || 0) + 1; sfx('putdown'); addXp(1); toast('Empty pallet stacked', ''); hudDirty = true; return; } if (!jp && (S.emptiesN || 0) > 0) { var np = newPallet(null, 0, { place: 'jack', jack: tl }); S[tl].pallet = np.id; S.emptiesN--; sfx('jack'); toast('Empty pallet on the jack: put loose boxes on it by hand', ''); hudDirty = true; return; } sfx('bad'); } });
    c.solid(-0.62, 0.62, -0.52, 0.52, 0, 1.2); c.solid(0.9, 1.2, 0.6, 0.9, 0, 1.7);
  }
  // a vertical baler: a tall steel cabinet, the loading door with its window at chest height, the bale door below with a
  // handle and hinges, the ram cylinder on top, a control box on the side, hazard stripes, and a strapped bale beside it
  function balerBuild(c) {
    var GRN = std({ color: 0x2f7a3a, roughness: 0.55, metalness: 0.3 }), DRK = MAT_MACH.frame, dyn = new THREE.Group(); dyn.userData.dynamic = true; c.group.add(dyn);
    // the body: a vertical baler with a chamber door, a window, the ram head above, the power pack at the side
    c.box(1.3, 0.1, 1.0, DRK, 0, 0.05, 0); c.box(1.2, 2.6, 0.9, GRN, 0, 1.4, 0); c.box(1.3, 0.08, 1.0, DRK, 0, 2.74, 0);
    [-0.62, 0.62].forEach(function (x) { c.box(0.06, 2.7, 0.06, DRK, x, 1.4, 0.45); c.box(0.06, 2.7, 0.06, DRK, x, 1.4, -0.45); });
    c.box(1.2, 0.06, 0.06, DRK, 0, 1.6, 0.47); c.box(1.2, 0.06, 0.06, DRK, 0, 0.75, 0.47);
    var door = c.box(1.04, 0.78, 0.06, GRN, 0, 2.06, 0.47); var win = c.box(0.5, 0.3, 0.02, MAT.glass, 0, 2.12, 0.51); win.userData.noBake = true; c.box(0.1, 0.34, 0.05, MAT.chrome, 0.44, 2.06, 0.52); c.box(0.03, 0.1, 0.07, DRK, -0.5, 1.8, 0.5); c.box(0.03, 0.1, 0.07, DRK, -0.5, 2.3, 0.5);
    c.box(1.04, 0.78, 0.06, GRN, 0, 1.16, 0.47); c.box(0.5, 0.05, 0.07, MAT.chrome, 0.2, 1.4, 0.52); c.box(0.03, 0.1, 0.07, DRK, -0.5, 0.92, 0.5); c.box(0.03, 0.1, 0.07, DRK, -0.5, 1.4, 0.5); c.box(0.4, 0.04, 0.03, MAT.black, 0, 1.05, 0.51);
    c.box(1.1, 0.1, 0.05, MAT.hazard, 0, 1.6, 0.5); c.sign(['CRUSH HAZARD · KEEP HANDS CLEAR'], 0.9, 0.09, 0, 0.68, 0.5, 0, { w: 512, h: 48, bg: '#f5b53d', fg: '#1a1205' });
    c.cyl(0.18, 0.9, MAT.chrome, 0, 3.2, 0, 16); c.cyl(0.26, 0.3, DRK, 0, 2.9, 0, 16); var ram = cyl(0.12, 0.6, MAT.chrome, 0, 3.6, 0, dyn, 12); c.box(0.5, 0.06, 0.5, DRK, 0, 3.68, 0);
    c.box(0.5, 0.9, 0.5, DRK, -0.95, 0.5, -0.1); var pm = c.cyl(0.18, 0.5, MAT_MACH.blue, -0.95, 1.2, -0.1, 14); c.cyl(0.14, 0.4, DRK, -0.95, 1.5, -0.1, 12); [[-0.95, 2.6, 0.1, 0.5], [-0.8, 2.0, 0.3, -0.3]].forEach(function (h) { var hs = c.cyl(0.025, 1.4, MAT.black, h[0], h[1], h[2], 6); hs.rotation.x = h[3]; });
    c.cyl(0.05, 0.03, MAT.white, -0.72, 0.8, 0.16, 10).rotation.x = Math.PI / 2;
    // the control cabinet on the right: screen, lamp stack, E-stop
    cabinet(c, 0.88, 1.45, 0.05, 0.4, 0.9, 0.22); var scr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.88, y: 1.62, z: 0.17, ry: 0, parent: c.group, title: 'Baler', draw: balerScreenDraw }); scr.mesh.userData.propId = 'baler';
    eStop(c, 0.88, 1.2, 0.17); MACH.baler.lamps = lampStack(c, 0.88, 1.95, 0.05);
    c.sign(['BALER', 'cardboard only'], 0.8, 0.3, 0, 2.5, 0.5, 0, { w: 256, h: 96, bg: '#1b232c', fg: '#5fd38d', size: 34 });
    // the finished bales stack beside it: strapped cardboard blocks, shown by count
    var bales = []; for (var k = 0; k < 3; k++) { var bg = new THREE.Group(); bg.position.set(1.75, 0.4 + (k === 2 ? 0.82 : 0), k === 1 ? 0.95 : 0.05); bg.visible = false; dyn.add(bg); box(1.0, 0.8, 0.8, MAT.parcel, 0, 0, 0, bg); for (var s = 0; s < 3; s++) { box(1.02, 0.02, 0.03, MAT.steelDark, 0, 0.405, -0.3 + s * 0.3, bg); box(1.02, 0.02, 0.03, MAT.steelDark, 0, -0.405, -0.3 + s * 0.3, bg); box(0.03, 0.82, 0.03, MAT.steelDark, 0.505, 0, -0.3 + s * 0.3, bg); box(0.03, 0.82, 0.03, MAT.steelDark, -0.505, 0, -0.3 + s * 0.3, bg); } bales.push(bg); }
    MACH.baler.anim = { ram: ram, bales: bales };
    c.hit(1.4, 2.8, 1.0, 0, 1.4, 0, { prompt: function () { return balerPrompt(); }, use: function () { balerUse(); } });
    c.solid(-1.25, 1.1, -0.5, 0.55, 0, 2.8); c.solid(1.2, 2.3, -0.4, 1.4, 0, 1.0);
  }
  function wrapperBuild(c, P, inst) {
    var wg = c.group; wg.userData.dynamic = true; dress.wrapper = wg;
    var tt = c.cyl(0.95, 0.1, MAT.steelDark, 0, 0.05, 0, 32); dress.turntable = tt; plane(1.7, 1.7, MAT.rubberMat, 0, 0.101, 0, -Math.PI / 2, 0, tt); for (var tk = 0; tk < 8; tk++) box(0.04, 0.02, 0.5, MAT.yellow, Math.sin(tk / 8 * 6.283) * 0.7, 0.105, Math.cos(tk / 8 * 6.283) * 0.7, tt).rotation.y = tk / 8 * 6.283;
    var rp = c.box(1.2, 0.1, 0.9, MAT.steelDark, 0, 0.03, 1.35); rp.rotation.x = 0.11; c.box(0.35, 2.7, 0.35, MAT.blue, 0, 1.35, -1.15); c.box(0.45, 0.12, 0.45, MAT.steelDark, 0, 0.06, -1.15); c.box(0.1, 2.5, 0.05, MAT.chrome, -0.1, 1.4, -0.95); c.box(0.1, 2.5, 0.05, MAT.chrome, 0.1, 1.4, -0.95);
    var carr = new THREE.Group(); carr.position.set(0, 1.0, -0.8); wg.add(carr); dress.wrapCarriage = carr; box(0.5, 0.4, 0.3, MAT.steelDark, 0, 0, 0, carr); cyl(0.14, 0.52, MAT.white, 0.35, 0, 0.1, carr, 14); cyl(0.02, 0.6, MAT.chrome, 0.35, 0, 0.1, carr, 6); cyl(0.05, 0.3, MAT.rubber, -0.3, 0, 0.1, carr, 8);
    cabinet(c, 0.75, 1.45, -1.15, 0.4, 0.9, 0.22); var wscr = touchScreen({ w: 240, h: 170, pw: 0.3, ph: 0.21, x: 0.75, y: 1.62, z: -1.03, ry: 0, parent: c.group, title: 'Stretch wrapper', draw: wrapperScreenDraw }); wscr.mesh.userData.propId = 'wrapper'; eStop(c, 0.75, 1.2, -1.03); MACH.wrapper.lamps = lampStack(c, 0.75, 1.95, -1.15); c.cyl(0.02, 0.5, MAT.black, 0.55, 1.1, -1.15, 6);
    c.sign(['STRETCH WRAP'], 1.2, 0.25, 0, 2.5, -0.9, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#78bdf5' }); c.solid(-1, 1, -1.4, 1.0, 0, 3);
    c.hit(1.0, 2.4, 0.8, 0, 1.2, -1.05, { prompt: function () { return wrapperPrompt(); }, use: function () { wrapperUse(); } });
  }
  function hoseBuild(c) { var reel = c.cyl(0.32, 0.12, MAT.red, 0, 1.5, 0.08, 24); reel.rotation.x = Math.PI / 2; c.cyl(0.05, 0.3, MAT.steelDark, 0, 1.5, 0.0, 8).rotation.x = Math.PI / 2; for (var hr = 0; hr < 5; hr++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(0.12 + hr * 0.035, 0.012, 6, 24), MAT.red); ring.position.set(0, 1.5, 0.16); c.add(ring); } c.cyl(0.015, 0.25, MAT.red, 0.3, 1.25, 0.08, 6).rotation.z = 0.4; c.cyl(0.03, 0.08, MAT.chrome, 0.38, 1.12, 0.08, 8, 0.018); c.sign(['HOSE REEL'], 0.7, 0.16, 0, 2.0, 0.01, 0, { w: 256, h: 64, bg: '#c8342a', fg: '#fff' }); }
  var leafTex = tex(64, 128, function (c, w, h) { c.clearRect(0, 0, w, h); var g = c.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#2f6a2a'); g.addColorStop(1, '#8ad474'); c.fillStyle = g; c.beginPath(); c.moveTo(32, 128); c.quadraticCurveTo(0, 70, 32, 4); c.quadraticCurveTo(64, 70, 32, 128); c.fill(); c.strokeStyle = 'rgba(220,255,200,0.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(32, 124); c.lineTo(32, 10); c.stroke(); });
  var leafMat = std({ map: leafTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  function plantBuild(c) {
    var pot = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.11, 0), new THREE.Vector2(0.14, 0.02), new THREE.Vector2(0.17, 0.28), new THREE.Vector2(0.19, 0.3), new THREE.Vector2(0.17, 0.32), new THREE.Vector2(0.15, 0.3)], 16), std({ color: 0xa65e3a, roughness: 0.9 })); pot.castShadow = true; c.group.add(pot);
    c.cyl(0.15, 0.02, std({ color: 0x3a2a1c, roughness: 1 }), 0, 0.29, 0, 14);
    for (var i = 0; i < 11; i++) { var a = i / 11 * 6.283, lg = new THREE.Group(); lg.position.set(0, 0.3, 0); lg.rotation.y = a; c.group.add(lg); var st = cyl(0.006, 0.35 + (i % 3) * 0.12, MAT.green, 0, 0.17 + (i % 3) * 0.06, 0.03, lg, 5); st.rotation.x = 0.5 + (i % 2) * 0.2; var lf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.34), leafMat); lf.position.set(0, 0.42 + (i % 3) * 0.12, 0.2 + (i % 2) * 0.08); lf.rotation.x = -0.9 + (i % 3) * 0.2; lg.add(lf); }
    c.solid(-0.18, 0.18, -0.18, 0.18, 0, 0.5);
  }
  function deskBuild(c) {
    var top = new THREE.Mesh(bevelGeo(2.2, 0.05, 0.8, 0.015), std({ color: 0xd7cbb0, roughness: 0.5, map: TEX.wood, normalMap: NRM.wood })); top.position.set(0, 0.75, 0); top.castShadow = true; top.receiveShadow = true; c.group.add(top);
    c.box(2.1, 0.5, 0.03, std({ color: 0x9aa4ad, roughness: 0.6 }), 0, 0.45, 0.36); [[-1.0, 0.0], [1.0, 0.0]].forEach(function (o) { c.box(0.05, 0.72, 0.7, MAT_MACH.frame, o[0] * 1.05, 0.36, 0); }); c.cyl(0.03, 0.02, MAT.black, 0.6, 0.76, -0.3, 10);
    var ped = new THREE.Mesh(bevelGeo(0.45, 0.66, 0.6, 0.02), std({ color: 0xcfd4d9, roughness: 0.5 })); ped.position.set(-0.75, 0.37, 0); c.group.add(ped); for (var dw = 0; dw < 3; dw++) { c.box(0.4, 0.19, 0.012, std({ color: 0xbfc6cc, roughness: 0.5 }), -0.75, 0.15 + dw * 0.21, -0.31); c.box(0.12, 0.02, 0.025, MAT.chrome, -0.75, 0.22 + dw * 0.21, 0.32); }
    c.cyl(0.14, 0.02, MAT_MACH.frame, 0, 0.785, 0.2, 14); c.cyl(0.025, 0.3, MAT_MACH.frame, 0, 0.93, 0.22, 8); var bez = new THREE.Mesh(bevelGeo(0.82, 0.52, 0.03, 0.01), MAT.black); bez.position.set(0, 1.25, 0.25); c.group.add(bez);
    pc.screen = touchScreen({ w: 800, h: 500, pw: 0.74, ph: 0.46, x: 0, y: 1.25, z: 0.225, ry: Math.PI, parent: c.group, title: 'Office PC', draw: drawPc });
    c.box(0.62, 0.012, 0.42, std({ color: 0x1f2a36, roughness: 1 }), -0.1, 0.785, -0.15); for (var kr = 0; kr < 4; kr++) for (var kc = 0; kc < 12; kc++) c.box(0.032, 0.012, 0.03, std({ color: 0x4a515b, roughness: 0.6 }), -0.34 + kc * 0.044, 0.82, -0.26 + kr * 0.05);
    var mouse = new THREE.Mesh(bevelGeo(0.06, 0.03, 0.1, 0.012), MAT.black); mouse.position.set(0.5, 0.8, -0.18); c.group.add(mouse); c.box(0.2, 0.06, 0.16, MAT.black, -0.75, 0.81, 0.26); c.cyl(0.012, 0.18, MAT.black, -0.75, 0.9, 0.26, 6).rotation.z = Math.PI / 2;
    c.cyl(0.03, 0.09, MAT.black, 0.9, 0.82, -0.05, 8); c.cyl(0.004, 0.14, MAT.blue, 0.9, 0.9, -0.05, 4).rotation.z = 0.2; c.cyl(0.04, 0.09, MAT.white, 0.7, 0.82, -0.1, 10); c.box(0.2, 0.01, 0.28, MAT.paper, -0.75, 0.785, -0.1); c.box(0.18, 0.012, 0.26, MAT.paper, -0.72, 0.795, -0.08).rotation.y = 0.1;
    c.cyl(0.02, 0.4, MAT_MACH.frame, 0.95, 0.98, 0.25, 8).rotation.z = -0.3; c.cyl(0.07, 0.1, MAT_MACH.frame, 0.84, 1.17, 0.25, 12, 0.03); c.cyl(0.05, 0.02, glowMat(0xfff2c0, 0.6), 0.84, 1.12, 0.25, 12);
    var dl = new THREE.PointLight(0xfff2c0, 0.3, 3.5, 2); dl.position.set(0.84, 1.05, 0.25); c.add(dl);   // the desk lamp's pool on the desk
    c.sign(['DEPOT CO. · OFFICE'], 0.5, 0.06, -0.75, 0.56, -0.32, Math.PI, { w: 512, h: 64, bg: '#eef1f5', fg: '#1b232c' });
    c.hit(1.2, 0.9, 0.5, 0, 0.5, -0.1, { prompt: function () { return pc.on ? null : (S.events.power ? 'The PC is off: no power' : 'Sit down at the PC'); }, use: function () { openPc(); } });
    c.solid(-1.1, 1.1, -0.4, 0.4, 0, 0.8);
  }  function officeChairBuild(c) {
    var seat = new THREE.Mesh(bevelGeo(0.5, 0.08, 0.5, 0.04), MAT.fabric); seat.position.set(0, 0.52, 0); seat.castShadow = true; c.group.add(seat);
    var back = new THREE.Mesh(bevelGeo(0.48, 0.52, 0.06, 0.03), MAT.fabric); back.position.set(0, 0.84, -0.26); back.rotation.x = -0.1; c.group.add(back); c.box(0.4, 0.4, 0.01, std({ color: 0x1f2630, roughness: 0.9 }), 0, 0.86, -0.22).rotation.x = -0.1; c.box(0.3, 0.14, 0.04, MAT.fabric, 0, 1.18, -0.3);
    c.cyl(0.03, 0.3, MAT.chrome, 0, 0.33, 0, 10); c.cyl(0.045, 0.2, MAT.black, 0, 0.18, 0, 10); c.box(0.3, 0.03, 0.3, MAT.black, 0, 0.47, 0); c.box(0.06, 0.03, 0.08, MAT.black, 0.18, 0.44, 0.1);
    for (var sp = 0; sp < 5; sp++) { var a = sp / 5 * 6.283, leg = c.box(0.05, 0.035, 0.3, MAT.black, Math.sin(a) * 0.15, 0.05, Math.cos(a) * 0.15); leg.rotation.y = a; var cs = c.cyl(0.03, 0.025, MAT.black, Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3, 8); cs.rotation.x = Math.PI / 2; cs.rotation.z = a; }
    [-0.28, 0.28].forEach(function (x) { c.box(0.04, 0.18, 0.04, MAT.black, x, 0.6, -0.05); c.box(0.06, 0.03, 0.3, MAT.black, x, 0.7, 0); });
    c.solid(-0.3, 0.3, -0.3, 0.3, 0, 0.6);
  }  function cabinetsBuild(c) {
    var CAB = std({ color: 0xcfd4d9, roughness: 0.5 }), DRW = std({ color: 0xbfc6cc, roughness: 0.5 });
    [-0.3, 0.3].forEach(function (cx2) { var body = new THREE.Mesh(bevelGeo(0.5, 1.3, 0.6, 0.02), CAB); body.position.set(cx2, 0.65, 0); body.castShadow = true; c.group.add(body); c.box(0.5, 0.06, 0.6, MAT.black, cx2, 0.03, 0); for (var cd = 0; cd < 3; cd++) { var d = new THREE.Mesh(bevelGeo(0.44, 0.36, 0.02, 0.01), DRW); d.position.set(cx2, 0.28 + cd * 0.4, 0.31); c.group.add(d); c.box(0.14, 0.025, 0.03, MAT.chrome, cx2, 0.4 + cd * 0.4, 0.33); c.box(0.16, 0.05, 0.004, MAT.paper, cx2, 0.2 + cd * 0.4, 0.323); c.box(0.17, 0.06, 0.002, MAT.chrome, cx2, 0.2 + cd * 0.4, 0.322); } c.box(0.02, 0.1, 0.02, MAT.chrome, cx2 + 0.2, 1.22, 0.31); });
    c.box(0.5, 0.25, 0.4, CAB, 0.3, 1.42, 0); c.box(0.4, 0.03, 0.3, MAT.white, 0.3, 1.56, 0.05); c.box(0.3, 0.02, 0.2, MAT.paper, 0.3, 1.58, 0.05); c.cyl(0.08, 0.1, std({ color: 0x4a7d33, roughness: 0.9 }), -0.3, 1.36, 0, 10, 0.06); c.sphere(0.12, std({ color: 0x5c8f44, roughness: 1, flatShading: true }), -0.3, 1.5, 0);
    c.solid(-0.6, 0.6, -0.35, 0.35, 0, 1.6);
  }  function coatStandBuild(c) {
    c.cyl(0.028, 1.75, MAT.steelDark, 0, 0.875, 0, 10); c.cyl(0.22, 0.03, MAT.steelDark, 0, 0.015, 0, 16); c.sphere(0.03, MAT.chrome, 0, 1.76, 0);
    for (var k = 0; k < 4; k++) { var a = k * Math.PI / 2, hk = new THREE.Group(); hk.position.set(0, 1.62, 0); hk.rotation.y = a; c.add(hk); var arm = cyl(0.01, 0.2, MAT.chrome, 0, 0.04, 0.1, hk, 6); arm.rotation.x = Math.PI / 2 - 0.4; sphere(0.018, MAT.chrome, 0, 0.1, 0.18, hk); var low = cyl(0.01, 0.18, MAT.chrome, 0, -0.5, 0.09, hk, 6); low.rotation.x = Math.PI / 2 - 0.5; sphere(0.016, MAT.chrome, 0, -0.45, 0.16, hk); }
    var coat = c.box(0.38, 0.7, 0.12, MAT.jeans, 0.18, 1.3, 0.02); coat.rotation.y = 0.5; c.box(0.2, 0.08, 0.1, MAT.jeans, 0.3, 1.66, 0.12); var scarf = c.box(0.06, 0.5, 0.06, MAT.red, -0.1, 1.4, -0.16); scarf.rotation.y = -0.4;
    c.solid(-0.22, 0.22, -0.22, 0.22, 0, 1.8);
  }
  function kpiBuild(c) { var kb = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), kpiBoard()); kb.position.set(0, 2.0, 0.03); c.add(kb); c.box(1.68, 1.08, 0.04, MAT.chrome, 0, 2.0, 0.0); }
  function certificateBuild(c) { c.box(0.3, 0.4, 0.02, MAT.wood, 0, 2.4, 0); c.sign(['CERTIFICATE', 'of registration', 'Depot Co. · 3PL'], 0.26, 0.36, 0, 2.4, 0.012, 0, { w: 192, h: 256, bg: '#f3efe4', fg: '#1b232c', size: 22 }); }
  function benchBuild(c, P) {
    SPOT.bench = { x: P.x, z: P.z }; SPOT.benchOut = { x: P.x + Math.sin(P.rot * Math.PI / 2) * 2.0, z: P.z + Math.cos(P.rot * Math.PI / 2) * 2.0 };
    c.box(1.0, 0.08, 3.2, MAT.wood, 0, 0.9, 0); [[-0.45, -1.5], [0.45, -1.5], [-0.45, 1.5], [0.45, 1.5]].forEach(function (o) { c.box(0.06, 0.9, 0.06, MAT.steelDark, o[0], 0.45, o[1]); }); c.box(0.9, 0.04, 3.0, MAT.steelDark, 0, 0.3, 0); c.solid(-0.5, 0.5, -1.6, 1.6, 0, 1);
    // the kit lives at the two ends: the box stacks take local z -0.95 to 1.3, and anything under them was never seen
    var TAN = std({ color: 0xc9a46a, roughness: 0.8 }), CARD = std({ color: 0xb08a5a, roughness: 1 }), TRAY = std({ color: 0x3a4149, roughness: 0.6 });
    // near end: a platform scale with its readout turned to the worker
    c.box(0.3, 0.03, 0.3, MAT.steelDark, 0.28, 0.955, -1.2); c.box(0.26, 0.012, 0.26, std({ color: 0xcfd4d9, roughness: 0.4, metalness: 0.5 }), 0.28, 0.976, -1.2); c.box(0.04, 0.24, 0.04, MAT.steelDark, 0.42, 1.09, -1.2);
    var sgp = new THREE.Group(); sgp.position.set(0.4, 1.23, -1.2); sgp.rotation.order = 'YXZ'; sgp.rotation.y = -Math.PI / 2; sgp.rotation.x = -0.25; c.add(sgp); box(0.18, 0.09, 0.03, MAT.black, 0, 0, 0, sgp); sign(['0.00 kg'], 0.15, 0.06, 0, 0, 0.016, 0, { w: 192, h: 72, bg: '#0d1216', fg: '#5fd38d' }, sgp);
    // a tape gun standing on its head, two spare rolls beside it
    var tgn = new THREE.Group(); tgn.position.set(-0.2, 0.94, -1.12); tgn.rotation.y = 0.6; c.add(tgn); box(0.03, 0.11, 0.035, MAT.red, 0, 0.06, -0.05, tgn).rotation.x = 0.35; box(0.02, 0.09, 0.13, MAT.steelDark, 0.03, 0.1, 0.03, tgn); cyl(0.055, 0.05, TAN, 0.03, 0.1, 0.055, tgn, 16).rotation.z = Math.PI / 2; box(0.05, 0.02, 0.05, MAT.steelDark, 0.03, 0.01, 0.11, tgn); cyl(0.012, 0.05, MAT.rubber, 0.03, 0.012, 0.085, tgn, 8).rotation.z = Math.PI / 2;
    c.cyl(0.055, 0.048, TAN, 0.06, 0.964, -1.48, 16); c.cyl(0.055, 0.048, TAN, 0.08, 1.012, -1.47, 16).rotation.y = 0.4; c.cyl(0.03, 0.05, MAT.white, 0.06, 1.012, -1.48, 12);
    // a parts tray: box cutter, marker, a roll of labels
    c.box(0.26, 0.03, 0.18, TRAY, -0.3, 0.955, -1.45); c.box(0.23, 0.014, 0.15, MAT.black, -0.3, 0.972, -1.45); c.box(0.14, 0.02, 0.03, MAT.yellow, -0.33, 0.99, -1.48).rotation.y = 0.3; c.cyl(0.008, 0.14, MAT.black, -0.27, 0.988, -1.41, 8).rotation.z = Math.PI / 2; c.cyl(0.03, 0.04, MAT.white, -0.22, 1.0, -1.49, 12);
    // the label printer at the near corner, a strip of labels hanging out toward the worker
    c.box(0.2, 0.12, 0.16, MAT.white, 0.28, 1.0, -1.5); c.box(0.21, 0.02, 0.17, std({ color: 0x8b949c, roughness: 0.5 }), 0.28, 0.95, -1.5); c.box(0.004, 0.09, 0.07, MAT.paper, 0.17, 0.985, -1.5); c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.2, 1.05, -1.42);
    // far end: the task lamp and a roll of bubble wrap on a rod between two brackets
    c.cyl(0.02, 0.9, MAT.steelDark, -0.4, 1.4, 1.4, 8); c.box(0.3, 0.08, 0.15, MAT.lamp, -0.3, 1.85, 1.4);
    [-0.3, 0.3].forEach(function (bx) { c.box(0.03, 0.3, 0.03, MAT.steelDark, bx, 1.09, 1.5); c.box(0.08, 0.02, 0.08, MAT.steelDark, bx, 0.95, 1.5); }); c.cyl(0.012, 0.66, MAT.chrome, 0, 1.25, 1.5, 8).rotation.z = Math.PI / 2;
    c.cyl(0.11, 0.5, std({ color: 0xe6ecf2, roughness: 0.35, transparent: true, opacity: 0.85 }), 0, 1.25, 1.5, 18).rotation.z = Math.PI / 2; c.plane(0.48, 0.26, std({ color: 0xe6ecf2, roughness: 0.35, transparent: true, opacity: 0.7, side: THREE.DoubleSide }), 0, 1.07, 1.615, 0, 0);
    // the shelf below: flat cardboard and a bale of folded boxes
    c.box(0.7, 0.12, 0.8, CARD, 0, 0.38, -0.6); c.box(0.66, 0.02, 0.76, TAN, 0, 0.45, -0.6); c.box(0.6, 0.09, 0.7, CARD, 0.02, 0.365, 0.7).rotation.y = 0.05; c.box(0.02, 0.1, 0.72, MAT.black, -0.2, 0.37, 0.7); c.box(0.02, 0.1, 0.72, MAT.black, 0.2, 0.37, 0.7);
    var tl = new THREE.PointLight(0xfff0d0, 0.45, 5, 2); tl.position.set(-0.3, 1.7, 1.4); c.add(tl);   // the task lamp lights the far end of the bench
    c.hit(1.1, 1.2, 3.2, 0, 1.4, 0, { prompt: function () { return benchPrompt(); }, use: function () { benchUse(); } });
    // the terminal: a floor stand on the east corner past the near end, screen at 1.7 m turned to face the working side across the
    // end of the bench, so it clears the box stacks and never stands in the walkway. It used to hang over the bench top at 1.45 m,
    // where two layers of boxes hid it and the bench's own hit box took the focus.
    var tg = new THREE.Group(); tg.position.set(0.35, 0, -2.0); tg.rotation.y = -Math.PI * 3 / 8; c.add(tg);
    cyl(0.28, 0.03, MAT.steelDark, 0, 0.015, -0.04, tg, 20); cyl(0.24, 0.02, MAT.rubber, 0, 0.04, -0.04, tg, 20); cyl(0.035, 1.72, MAT.steelDark, 0, 0.89, -0.08, tg, 10); box(0.14, 0.2, 0.07, MAT.steelDark, 0, 1.75, -0.06, tg);
    box(1.0, 0.76, 0.03, MAT.black, 0, 1.75, -0.02, tg); box(0.5, 0.02, 0.14, MAT.steelDark, 0, 1.3, 0.02, tg); box(0.06, 0.04, 0.12, MAT.black, 0.14, 1.33, 0.02, tg); box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.46, 1.44, 0.0, tg);
    var scr = touchScreen({ w: 400, h: 300, res: 3, pw: 0.9, ph: 0.675, x: 0, y: 1.75, z: 0, ry: 0, parent: tg, title: 'Bench terminal', draw: benchScreenDraw }); scr.mesh.userData.propId = 'bench'; scr.scrollable = true; scr.scroll = 0;
    c.solid(0.1, 0.6, -2.25, -1.75, 0, 2.3);
    // the stool
    c.cyl(0.17, 0.04, MAT.black, -1.0, 0.65, -0.4, 16); c.cyl(0.02, 0.6, MAT.chrome, -1.0, 0.32, -0.4, 8); c.cyl(0.2, 0.03, MAT.steelDark, -1.0, 0.03, -0.4, 16);
  }
  function benchScreenDraw(c, sc) {
    var allO = openOrders().sort(function (a, b2) { return (b2.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b2.due; }); sc.scrollMax = Math.max(0, allO.length - 4); sc.scroll = clamp(sc.scroll || 0, 0, sc.scrollMax);
    scBg(c, sc.w, sc.h); scHead(c, sc.w, 'PACKING', benchCount() + ' / ' + ECON.benchCap + ' on the bench · ' + allO.length + ' open');
    var os = allO.slice(sc.scroll, sc.scroll + 4), y = 56;
    if (!os.length) scText(c, 16, 76, 'No open orders.', '#a0acb8', 14);
    os.forEach(function (o) { var n = orderNeed(o); scText(c, 16, y + 12, '#' + o.num + ' ' + clientName(o.client).slice(0, 16) + (o.rush ? ' RUSH' : '') + (o.late ? ' LATE' : ''), o.late || o.rush ? '#ff6b5e' : '#eef1f5', 13); scText(c, 16, y + 28, o.lines.map(function (l) { return Math.min(l.qty, S.bench.boxes[l.sku] || 0) + '/' + l.qty + ' ' + skuName(l.sku).slice(0, 12); }).join(' · ').slice(0, 44), '#a0acb8', 11); var can = canPack(o), short = canPackShort(o); scButton(sc, 300, y + 4, 86, 32, can ? 'PACK' : short ? 'SHORT' : n.have + '/' + n.tot, can || short, function () { if (packOrder(o)) toast('Packed #' + o.num, 'good'); }, can ? '#5fd38d' : '#f5b53d'); y += 46; });
    if (sc.scrollMax > 0) { scText(c, 16, 290, 'Orders ' + (sc.scroll + 1) + ' to ' + Math.min(allO.length, sc.scroll + 4) + ' of ' + allO.length + ' · wheel scrolls', '#6b7784', 10); scButton(sc, 300, 262, 40, 26, 'UP', sc.scroll > 0, function () { sc.scroll = Math.max(0, sc.scroll - 1); }, '#f5b53d'); scButton(sc, 346, 262, 40, 26, 'DOWN', sc.scroll < sc.scrollMax, function () { sc.scroll = Math.min(sc.scrollMax, sc.scroll + 1); }, '#f5b53d'); }
    else scText(c, 16, 290, 'Look at a box on the bench to take it back · the cart takes surplus', '#6b7784', 10);
    var surN = surplusCount(); scButton(sc, 116, 258, 118, 26, surN ? 'RETURN ' + surN + ' SURPLUS' : 'NO SURPLUS', surN > 0, function () { returnSurplus(); }, '#f5b53d');
    if (S.up.plantAuto) { var autoOn = !S.pack || S.pack.auto !== false; scButton(sc, 16, 258, 92, 26, 'AUTO ' + (autoOn ? 'ON' : 'OFF'), true, function () { if (!S.pack) return; S.pack.auto = autoOn ? false : true; toast('Pack line auto-start ' + (autoOn ? 'off' : 'on'), autoOn ? 'bad' : 'good'); }, autoOn ? '#5fd38d' : '#ff6b5e'); }
  }
  // yard props (the shelter, dumpster, flag and parking sign)
  function shelterBuild(c) {
    var FR = std({ color: 0x3a4149, roughness: 0.5, metalness: 0.6 }), GL = std({ color: 0x9fc4d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    [[-1.7, -2.2], [-1.7, 2.2], [1.7, -2.2], [1.7, 2.2]].forEach(function (p) { c.box(0.08, 2.5, 0.08, FR, p[0], 1.25, p[1]); c.box(0.2, 0.02, 0.2, FR, p[0], 0.01, p[1]); });
    c.box(3.6, 0.06, 4.6, FR, 0, 2.5, 0); c.box(3.8, 0.04, 4.8, std({ color: 0x2a2f35, roughness: 0.7 }), 0, 2.56, 0); c.box(3.8, 0.1, 0.06, FR, 0, 2.5, 2.4); c.box(3.8, 0.1, 0.06, FR, 0, 2.5, -2.4); c.box(0.06, 0.1, 4.8, FR, -1.9, 2.5, 0); c.box(0.06, 0.1, 4.8, FR, 1.9, 2.5, 0);
    c.plane(4.4, 2.3, GL, -1.7, 1.3, 0, 0, Math.PI / 2); c.plane(1.6, 2.3, GL, -0.9, 1.3, -2.2, 0, 0); c.plane(1.6, 2.3, GL, 0.9, 1.3, -2.2, 0, 0); c.box(0.08, 2.5, 0.08, FR, -1.7, 1.25, 0); c.box(0.06, 0.06, 4.4, FR, -1.7, 0.95, 0); c.box(3.4, 0.06, 0.06, FR, 0, 0.95, -2.2);
    for (var sl = 0; sl < 5; sl++) c.box(2.4, 0.04, 0.08, MAT.wood, 0, 0.46, -1.9 + sl * 0.095); for (var sb = 0; sb < 3; sb++) { var bb = c.box(2.4, 0.04, 0.09, MAT.wood, 0, 0.7 + sb * 0.12, -2.04 - sb * 0.04); bb.rotation.x = -0.2; } [-1.0, 1.0].forEach(function (bx) { c.box(0.05, 0.44, 0.44, FR, bx, 0.22, -1.72); c.box(0.05, 0.5, 0.06, FR, bx, 0.75, -2.08).rotation.x = -0.2; });
    c.cyl(0.11, 1.0, FR, 1.3, 0.5, 1.6, 12); c.cyl(0.13, 0.08, FR, 1.3, 1.02, 1.6, 12); c.cyl(0.1, 0.02, std({ color: 0x8a8a8a, roughness: 0.5 }), 1.3, 1.065, 1.6, 12); c.cyl(0.14, 0.02, FR, 1.3, 0.01, 1.6, 12);
    c.sign(['SMOKING AREA', 'please use the ashtray'], 0.9, 0.3, 0, 2.05, -2.17, 0, { w: 384, h: 128, bg: '#1b232c', fg: '#a0acb8' }); c.sign(['NO SMOKING', 'beyond this shelter'], 0.9, 0.3, -1.67, 2.05, 0, Math.PI / 2, { w: 384, h: 128, bg: '#1b232c', fg: '#a0acb8' });
    c.solid(-1.8, -1.6, -2.3, 2.3, 0, 2.6); c.solid(-1.8, 1.8, -2.3, -2.1, 0, 2.6); c.solid(-1.3, 1.3, -2.1, -1.5, 0, 1.0); c.solid(1.1, 1.5, 1.4, 1.8, 0, 1.1);
  }
  function dumpsterBuild(c) { c.box(1.8, 1.3, 1.2, std({ color: 0x2f5a3a, roughness: 0.7, metalness: 0.3 }), 0, 0.65, 0); var dl = c.box(1.9, 0.08, 1.3, MAT.black, 0, 1.52, -0.2); dl.rotation.x = -0.35; [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]].forEach(function (w) { c.cyl(0.08, 0.06, MAT.black, w[0], 0.08, w[1], 10).rotation.z = Math.PI / 2; }); c.box(0.1, 0.1, 0.4, MAT.steelDark, -0.95, 0.9, 0); c.box(0.1, 0.1, 0.4, MAT.steelDark, 0.95, 0.9, 0); c.sign(['CARDBOARD', 'ONLY'], 1.2, 0.5, 0, 0.9, -0.62, Math.PI, { w: 256, h: 128, bg: '#2f5a3a', fg: '#fff' }); c.solid(-0.95, 0.95, -0.65, 0.65, -2, 2); }
  function flagBuild(c) { c.cyl(0.05, 9, MAT.chrome, 0, 4.5, 0, 8, 0.07); c.sphere(0.1, MAT.yellow, 0, 9.05, 0); var fg = new THREE.Group(); fg.position.set(0, 8.3, 0); fg.userData.dynamic = true; c.add(fg); yard.flag = fg; var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 8, 2), new THREE.MeshStandardMaterial({ map: textTex(['DEPOT CO.'], { w: 256, h: 160, bg: '#f5b53d', fg: '#1b232c' }), side: THREE.DoubleSide, roughness: 0.9 })); flag.position.set(0.82, 0, 0); fg.add(flag); yard.flagMesh = flag; }
  function parkingSignBuild(c) { c.cyl(0.04, 2.4, MAT.steelDark, 0, 1.2, 0, 6); c.sign(['STAFF', 'PARKING'], 0.9, 0.6, 0, 2.5, 0, 0, { w: 256, h: 160, bg: '#2c5f9e', fg: '#fff' }); }
  // a low-poly tree: a tapered trunk with bark, two limbs, and a canopy of jittered icosahedra in three greens, flat shaded
  var BARK = std({ color: 0x5a4634, roughness: 1, normalMap: NRM.wood, normalScale: new THREE.Vector2(0.8, 0.8) });
  var LEAF = [std({ color: 0x3f6f2e, roughness: 1, flatShading: true }), std({ color: 0x5c8f44, roughness: 1, flatShading: true }), std({ color: 0x4a7d33, roughness: 1, flatShading: true })];
  function canopy(c, r, x, y, z, mat) { var g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position; for (var i = 0; i < p.count; i++) { var k = 1 + (Math.random() - 0.5) * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * (0.8 + Math.random() * 0.3), p.getZ(i) * k); } g.computeVertexNormals(); var m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; c.group.add(m); return m; }
  function treeBuild(c) {
    var s = randf(0.85, 1.25), lean = randf(-0.06, 0.06);
    var trunk = c.cyl(0.11 * s, 2.8 * s, BARK, 0, 1.4 * s, 0, 9, 0.2 * s); trunk.rotation.z = lean;
    var l1 = c.cyl(0.05 * s, 1.1 * s, BARK, 0.35 * s, 2.5 * s, 0.1 * s, 6, 0.09 * s); l1.rotation.z = -0.7; var l2 = c.cyl(0.05 * s, 0.9 * s, BARK, -0.3 * s, 2.7 * s, -0.2 * s, 6, 0.08 * s); l2.rotation.z = 0.8; l2.rotation.x = 0.4;
    canopy(c, 1.35 * s, 0, 3.4 * s, 0, LEAF[0]); canopy(c, 1.0 * s, 0.8 * s, 3.0 * s, 0.4 * s, LEAF[1]); canopy(c, 0.95 * s, -0.75 * s, 3.2 * s, -0.5 * s, LEAF[2]); canopy(c, 0.8 * s, 0.1 * s, 4.3 * s, 0.1 * s, LEAF[1]); canopy(c, 0.7 * s, -0.2 * s, 2.6 * s, 0.8 * s, LEAF[0]);
    c.solid(-0.2, 0.2, -0.2, 0.2, -2, 2);
  }
  function bollardBuild(c) { c.cyl(0.11, 1.0, MAT.yellow, 0, 0.5, 0, 10); c.cyl(0.14, 0.05, MAT.black, 0, 0.025, 0, 10); c.solid(-0.12, 0.12, -0.12, 0.12, -2, 1); }
  function benchSeatBuild(c) { for (var sl = 0; sl < 4; sl++) c.box(1.6, 0.04, 0.07, MAT.wood, 0, 0.45, -0.14 + sl * 0.09); c.box(1.6, 0.04, 0.3, MAT.wood, 0, 0.85, 0.16).rotation.x = -0.2; [[-0.65], [0.65]].forEach(function (p) { c.box(0.06, 0.45, 0.4, MAT.steelDark, p[0], 0.22, 0); c.box(0.06, 0.5, 0.06, MAT.steelDark, p[0], 0.65, 0.18); }); c.solid(-0.8, 0.8, -0.25, 0.25, -2, 1); }

  // stations and fabric that move too
  function timeclockBuild(c) {
    var LG = std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 }), DG = MAT_MACH.frame;
    var hous = new THREE.Mesh(bevelGeo(0.4, 0.56, 0.12, 0.02), LG); hous.position.set(0, 1.5, 0); hous.castShadow = true; c.group.add(hous); c.box(0.42, 0.03, 0.14, DG, 0, 1.79, 0); c.box(0.42, 0.03, 0.14, DG, 0, 1.21, 0);
    c.box(0.34, 0.36, 0.01, MAT.black, 0, 1.52, 0.05); c.box(0.14, 0.012, 0.03, MAT.black, 0, 1.28, 0.07); c.box(0.12, 0.004, 0.01, MAT.chrome, 0, 1.283, 0.08); tclock.lamp = c.box(0.03, 0.03, 0.02, glowMat(0x39d353, 1.2), 0.15, 1.72, 0.065); c.box(0.03, 0.03, 0.02, glowMat(0xff3b2f, 0.3), -0.15, 1.72, 0.065);
    c.box(0.5, 0.56, 0.08, DG, 0.58, 1.5, -0.02); c.box(0.48, 0.02, 0.06, LG, 0.58, 1.75, 0.0); for (var k = 0; k < 8; k++) { c.box(0.07, 0.15, 0.03, MAT.paper, 0.4 + Math.floor(k / 4) * 0.12 + 0.06 * (k % 2 ? 0 : 0), 1.62 - (k % 4) * 0.13, 0.04); } c.box(0.5, 0.02, 0.03, DG, 0.58, 1.26, 0.03);
    c.sign(['CLOCK IN · CLOCK OUT'], 0.86, 0.14, 0.3, 1.9, 0.0, 0, { w: 384, h: 64, bg: '#1b232c', fg: '#eef1f5' }); c.sign(['CARDS'], 0.3, 0.08, 0.58, 1.19, 0.05, 0, { w: 128, h: 40, bg: '#f5b53d', fg: '#1a1205' });
    c.cyl(0.012, 0.6, MAT.black, 0.18, 1.0, 0.0, 6);
    touchScreen({ w: 300, h: 320, pw: 0.3, ph: 0.32, x: 0, y: 1.5, z: 0.07, ry: 0, parent: c.group, title: 'Time clock', draw: drawTimeClock });
  }  function consoleBuild(di) { return function (c) {
    var inbound = DOOR_MAP[di].dir === 'in', k = DOOR_MAP[di].dock, lane = inbound ? null : MODES[TRUCK_OUT[k].mode];
    var hous = new THREE.Mesh(bevelGeo(0.5, 0.62, 0.12, 0.02), std({ color: 0xd9dde2, roughness: 0.45, metalness: 0.2 })); hous.position.set(0, 1.45, 0); hous.castShadow = true; c.group.add(hous); c.box(0.44, 0.34, 0.01, MAT.black, 0, 1.47, 0.05); c.box(0.54, 0.04, 0.14, inbound ? MAT.hazard : MAT.yellow, 0, 1.78, 0); c.box(0.54, 0.04, 0.14, MAT_MACH.frame, 0, 1.12, 0); c.cyl(0.012, 1.0, MAT.black, 0, 0.6, -0.03, 6); c.cyl(0.03, 0.03, MAT.red, -0.17, 1.22, 0.07, 10).rotation.x = Math.PI / 2; c.box(0.05, 0.05, 0.02, MAT.yellow, -0.17, 1.22, 0.06); c.box(0.03, 0.03, 0.02, glowMat(0x5fd38d, 1.0), 0.17, 1.22, 0.065); c.box(0.08, 0.06, 0.04, MAT_MACH.frame, 0, 1.08, -0.02);
    touchScreen({ w: 320, h: 240, pw: 0.4, ph: 0.3, x: 0, y: 1.47, z: 0.065, ry: 0, parent: c.group, title: 'Dock console ' + dockLabel(di), draw: function (cc, sc) {
      scBg(cc, sc.w, sc.h, inbound ? 'rgba(245,181,61,0.16)' : 'rgba(95,211,141,0.16)'); scHead(cc, sc.w, 'DOCK ' + dockLabel(di), lane ? lane.name.toUpperCase() + ' LANE' : undefined);
      var t = truckAtDoor(di);
      if (inbound) {
        if (t) { var left = S.pallets.filter(function (q) { return q.place === 'truck' && q.truck === t.id; }).length; scText(cc, 16, 66, 'Truck docked · ' + t.driver + ' · ' + clientName(t.client), '#f5b53d', 14); scText(cc, 16, 86, left + ' of ' + t.pallets.length + ' pallets still on it · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scText(cc, 16, 106, t.signed ? 'Delivery note signed' : 'NOT SIGNED: see the driver outside', t.signed ? '#5fd38d' : '#ff6b5e', 13); }
        else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, 'Inbound slots: ' + TRUCK_IN.map(fmtTime).join(' and ') + (S.up.dock2 || k !== 1 ? '' : ' (buy the second bay)'), '#eef1f5', 13); }
        scButton(sc, 16, 128, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
        var pending = S.pallets.filter(function (q) { return q.place === 'floor'; }).length; scButton(sc, 164, 128, 140, 40, pending + ' on the floor', false, function () { scanToggle(true); scanPage(3); });
        if (t && !t.signed) scButton(sc, 16, 176, 288, 36, 'SIGN THE DELIVERY NOTE', true, function () { signTruck(t); var dm = truckMeshes[t.id]; if (dm && dm.driver) say(dm.driver, pick(DRIVER_LINES.signed), '#5fd38d'); }, '#5fd38d');   // from the console, no walk to the driver
      } else {
        var nxt = outNext(k);
        if (!dockOwned(k)) { scText(cc, 16, 66, 'Not in service', '#ff6b5e', 15); scText(cc, 16, 86, 'The air dock opens with the sortation deck (shop)', '#eef1f5', 13); }
        else if (t) { scText(cc, 16, 66, 'Truck docked · ' + t.driver, '#5fd38d', 15); scText(cc, 16, 86, t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scButton(sc, 16, 104, 288, 44, t.parcels.length ? 'DISPATCH NOW' : 'nothing loaded', t.parcels.length > 0, function () { consoleUse(di); }, '#5fd38d'); }
        else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, (isSunday() ? 'Closed Sunday · ' : 'Next: ' + fmtTime(nxt.arrive) + ' to ' + fmtTime(nxt.leave) + (nxt.tomorrow ? ' tomorrow' : '')) + ' · ' + outWindows(k).map(function (w) { return fmtTime(w.arrive); }).join(' and ') + ' daily', '#eef1f5', 13); }
        scButton(sc, 16, 160, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
        var packed = S.orders.filter(function (o) { return o.state === 'packed' && orderMode(o) === lane.id; }).length; scButton(sc, 164, 160, 140, 40, packed + ' ' + lane.name.toLowerCase() + ' packed', false, function () { scanToggle(true); scanPage(5); });
        scText(cc, 16, 212, (S.stats.misrouted || 0) + ' parcels out of the wrong door so far', '#a0acb8', 11);
      }
      scText(cc, 16, 226, S.events.power ? 'NO POWER' : 'mains ok', S.events.power ? '#ff6b5e' : '#5fd38d', 11);
    } });
    c.sign(['DOCK ' + dockLabel(di)], 0.7, 0.18, 0, 1.95, 0.0, 0, { w: 256, h: 64, bg: '#1b232c', fg: inbound ? '#f5b53d' : '#5fd38d' });
  }; }
  function breakerBuild(c) {
    var LG = std({ color: 0xb9bec4, roughness: 0.45, metalness: 0.3 }); var box2 = new THREE.Mesh(bevelGeo(0.46, 0.7, 0.14, 0.02), LG); box2.position.set(0, 1.5, 0); box2.castShadow = true; c.group.add(box2);
    c.box(0.4, 0.62, 0.012, std({ color: 0xcfd4d9, roughness: 0.5 }), 0, 1.5, 0.075); c.box(0.025, 0.08, 0.02, MAT.chrome, 0.16, 1.5, 0.085); c.box(0.4, 0.02, 0.016, MAT_MACH.frame, 0, 1.2, 0.075);
    c.box(0.1, 0.22, 0.03, MAT.black, 0, 1.52, 0.09); c.box(0.06, 0.12, 0.04, MAT.red, 0, 1.55, 0.11); c.box(0.03, 0.03, 0.02, glowMat(0x5fd38d, 1.0), -0.12, 1.7, 0.085); c.box(0.08, 0.06, 0.002, MAT.paper, 0.1, 1.7, 0.082);
    c.sign(['⚡ DANGER 400 V'], 0.3, 0.07, 0, 1.32, 0.085, 0, { w: 256, h: 56, bg: '#f5b53d', fg: '#1a1205' }); c.cyl(0.02, 0.5, MAT.black, -0.1, 2.1, -0.02, 6); c.cyl(0.02, 0.5, MAT.black, 0.1, 2.1, -0.02, 6);
    c.hit(0.5, 0.7, 0.2, 0, 1.5, 0.05, { prompt: function () { return S.events.power ? 'Reset the breaker' : 'Breaker panel (power is on)'; }, use: function () { flipBreaker(); } }); c.sign(['MAIN BREAKER'], 0.6, 0.15, 0, 1.95, 0.01, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' });
  }  function boardBuild(c) {
    var cv = document.createElement('canvas'); cv.width = 768; cv.height = 384; world.boardCtx = cv.getContext('2d');
    world.boardTex = new THREE.CanvasTexture(cv); world.boardTex.encoding = THREE.sRGBEncoding; world.boardMat = new THREE.MeshBasicMaterial({ map: world.boardTex });
    c.cyl(0.03, 2.8, MAT.steelDark, -1.0, 5.6, 0, 6); c.cyl(0.03, 2.8, MAT.steelDark, 1.0, 5.6, 0, 6); c.box(3.1, 0.06, 0.1, MAT.steelDark, 0, 4.2, 0);
    c.box(3.1, 1.6, 0.08, MAT.black, 0, 3.35, 0); var board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); board.position.set(0, 3.35, 0.05); c.add(board); var back = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); back.position.set(0, 3.35, -0.05); back.rotation.y = Math.PI; c.add(back);
    // on the screens list so the wheel pages it when you look up at it and it redraws itself as its pages turn; no buttons, so no E prompt
    world.boardScreen = { w: 768, h: 384, ctx: world.boardCtx, tex: world.boardTex, mesh: board, zones: [], draw: function (cx, sc) { drawBoard(sc); }, cur: null, ripple: 0, title: 'Order board', dirty: true, scrollable: true, scroll: 0, scrollMax: 0, autoPage: true }; screens.push(world.boardScreen);
    drawBoard();
  }
  function chargerBuild(c) {
    var CB = std({ color: 0x8b949c, roughness: 0.5, metalness: 0.4 });
    c.box(0.9, 1.1, 0.32, CB, 0, 1.55, -0.14); c.box(0.94, 0.04, 0.36, MAT.steelDark, 0, 2.12, -0.14); c.box(0.94, 0.04, 0.36, MAT.steelDark, 0, 0.98, -0.14);
    for (var vv = 0; vv < 6; vv++) c.box(0.3, 0.012, 0.02, MAT.black, -0.22, 1.9 - vv * 0.04, 0.03); for (var vw = 0; vw < 6; vw++) c.box(0.3, 0.012, 0.02, MAT.black, 0.22, 1.9 - vw * 0.04, 0.03);
    dress.charger = c.box(0.06, 0.06, 0.02, glowMat(0x5fd38d, 1.2), -0.35, 1.3, 0.03); 
    c.sign(['CHARGING POINT'], 0.8, 0.14, 0, 2.0, 0.03, 0, { w: 512, h: 96, bg: '#1b232c', fg: '#5fd38d' }); c.sign(['24 V · ISOLATE BEFORE SERVICE'], 0.8, 0.07, 0, 1.08, 0.03, 0, { w: 512, h: 48, bg: '#f5b53d', fg: '#1a1205' });
    [-0.28].forEach(function (rx) { var reel = c.cyl(0.14, 0.12, MAT.black, rx, 0.75, -0.1, 16); reel.rotation.x = Math.PI / 2; c.cyl(0.05, 0.14, MAT.steelDark, rx, 0.75, -0.1, 10).rotation.x = Math.PI / 2; var cab = c.cyl(0.018, 0.9, MAT.black, rx, 0.35, 0.3, 6); cab.rotation.x = 1.1; });
    c.box(0.18, 0.6, 0.18, MAT.steelDark, -0.5, 0.3, 0.55); c.box(0.22, 0.04, 0.22, MAT.yellow, -0.5, 0.62, 0.55); c.box(0.1, 0.08, 0.06, MAT.red, -0.5, 0.5, 0.65); c.box(0.1, 0.08, 0.06, MAT.blue, -0.5, 0.36, 0.65);
    c.sign(['FORKLIFT'], 0.2, 0.05, -0.5, 0.28, 0.65, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#eef1f5' });
    c.box(1.1, 0.03, 0.08, MAT.hazard, 0, 0.015, 0.2); c.solid(-0.5, 0.5, -0.3, 0.7, 0, 2.2);
    c.hit(1.0, 1.3, 0.5, 0, 1.5, 0.05, { prompt: function () { return cablePrompt('fork'); }, use: function () { cableUse('fork'); } });
    touchScreen({ w: 200, h: 80, pw: 0.4, ph: 0.16, x: 0.05, y: 1.3, z: 0.035, ry: 0, parent: c.group, title: 'Charger display', draw: function (cc, sc) { scBg(cc, sc.w, sc.h, 'rgba(95,211,141,0.2)'); var b = Math.round((S.fork.batt === undefined ? 1 : S.fork.batt) * 100); scText(cc, 10, 30, S.fork.plugged ? (b >= 100 ? 'FORKLIFT · FULL' : 'CHARGING · ' + b + '%') : 'FORKLIFT · ' + b + '% · unplugged', S.fork.plugged ? '#5fd38d' : '#f5b53d', 18); cc.fillStyle = 'rgba(255,255,255,0.12)'; cc.fillRect(10, 48, 180, 14); cc.fillStyle = b < 20 ? '#ff6b5e' : '#5fd38d'; cc.fillRect(10, 48, 1.8 * b, 14); } });
    var w = 2.6, d = 3.6, cz = 2.8; [[0, cz - d / 2, w, 0.08], [0, cz + d / 2, w, 0.08], [-w / 2, cz, 0.08, d], [w / 2, cz, 0.08, d]].forEach(function (ln) { c.plane(ln[2], ln[3], MAT.yellowLine, ln[0], 0.0062, ln[1], -Math.PI / 2, 0); }); c.plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex(['FORKLIFT'], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), 0, 0.0066, cz - d / 2 + 0.3, -Math.PI / 2, 0);
  }
  function lampPostBuild(c) { c.cyl(0.08, 7.5, MAT.steelDark, 0, 3.75, 0, 8, 0.11); c.box(0.6, 0.2, 0.3, MAT.steelDark, 0, 7.65, 0); var lens = c.box(0.5, 0.04, 0.24, glowMat(0xffd9a0, 0.2), 0, 7.53, 0); yard.lampLenses.push(lens); var l = new THREE.PointLight(0xffd9a0, 0.0, 36, 2); l.position.set(0, 7.4, 0); l.userData.k = 1.4; c.add(l); yardLights.push(l); c.box(0.3, 0.2, 0.3, MAT.grey, 0, 0.1, 0); c.solid(-0.15, 0.15, -0.15, 0.15, -2, 2); }
  function carBuild(k) { return function (c) { c.add(carMesh(typeof k === "number" ? CAR_COLS[k % CAR_COLS.length] : k)); c.solid(-2.2, 2.2, -1.0, 1.0, -2, 1.5); }; }
  function paintedBuild(c) { c.sign(['DEPOT CO.'], 9, 1.6, 0, 4.4, 0.01, 0, { w: 1024, h: 192, bg: '#1b232c', fg: '#f5b53d', plate: false }); c.sign(['RECEIVE · STORE · PICK · SHIP'], 7, 0.5, 0, 3.3, 0.01, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8', plate: false }); }
  function aisleSignBuild(text) { return function (c) { c.sign([text], 2.2, 0.5, 0, 5.4, 0, 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.sign([text], 2.2, 0.5, 0, 5.4, 0, Math.PI, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.cyl(0.006, 1.3, MAT.steelDark, -0.9, 6.3, 0, 4); c.cyl(0.006, 1.3, MAT.steelDark, 0.9, 6.3, 0, 4); }; }

  // ── Default layout ────────────────────────────────────────────────
  for (var rr = 0; rr < RACK.rows.length; rr++) (function (r) { defProp('rack' + r, { label: 'rack row ' + 'ABCDEF'[r], cat: 'hall', abs: true, x: 0, z: RACK.rows[r], rot: 0, build: rackBuild(r), when: function () { return r < S.up.rows; } }); })(rr);
  defProp('timeclock', { label: 'time clock', cat: 'wall', wall: true, x: -19.74, z: 10.6, rot: 1, build: timeclockBuild });   // its card rack clear of the rota poster
  defProp('cabinet', { label: 'control cabinet', cat: 'wall', wall: true, x: 12.42, z: 12.6, rot: 3, build: cabinetBuild });
  defProp('consoleIn0', { label: 'dock console IN 1', cat: 'wall', wall: true, abs: true, x: -29.7, z: -11.5, rot: 1, build: consoleBuild(0) });
  defProp('consoleIn1', { label: 'dock console IN 2', cat: 'wall', wall: true, abs: true, x: -29.7, z: -3.5, rot: 1, build: consoleBuild(1) });
  defProp('console0', { label: 'dock console OUT 1', cat: 'wall', wall: true, abs: true, x: 29.7, z: -9.6, rot: 3, build: consoleBuild(2) });   // south of the OUT 1 shipping bay
  defProp('console1', { label: 'dock console OUT 2', cat: 'wall', wall: true, abs: true, x: 29.7, z: -8.5, rot: 3, build: consoleBuild(3) });
  defProp('console2', { label: 'dock console OUT 3', cat: 'wall', wall: true, abs: true, x: 34.6, z: -23.83, rot: 0, build: consoleBuild(4) });   // on the north wall by the OUT 3 door: the east wall there is behind the spirals and the loaders
  defProp('breaker', { label: 'breaker panel', cat: 'wall', wall: true, x: 19.79, z: 9.6, rot: 3, build: breakerBuild });
  defProp('board', { label: 'order board', cat: 'hall', x: 16.2, z: 7.4, rot: 2, build: boardBuild });
  defProp('charger', { label: 'forklift charging point', cat: 'wall', wall: true, x: 0, z: 13.83, rot: 2, build: chargerBuild });
  defProp('painted', { label: 'painted name', cat: 'wall', wall: true, abs: true, keep: true, x: 28.5, z: -23.83, rot: 0, build: paintedBuild });   // east of the Hall 2 doorway, which cut through it at x 17
  [['aisleAB', -7.6, 'AISLE  A · B'], ['aisleBC', -1.0, 'AISLE  B · C'], ['aisleCD', 5.6, 'AISLE  C · D'], ['aisleDE', 12.2, 'AISLE  D · E']].forEach(function (a) { defProp(a[0], { label: 'aisle sign', cat: 'hall', abs: true, x: 0, z: a[1], rot: 0, build: aisleSignBuild(a[2]) }); });
  [[-30, -12], [-30, 10], [30, -15.5], [30, 10]].forEach(function (p, i) { defProp('lamp' + i, { label: 'lamp post', cat: 'yard', yard: true, x: p[0], z: p[1], rot: 0, build: lampPostBuild }); });
  [0, 1, 3, 4].forEach(function (k, i) { defProp('car' + i, { label: 'parked car', cat: 'yard', yard: true, abs: true, x: -27.65 + k * 2.7, z: 31.5, rot: 1, build: carBuild(k) }); });
  var treeN = 0; for (var tx = -56; tx <= 56; tx += 14) { defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: tx, z: -64, rot: 0, build: treeBuild }); defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: tx + 7, z: 56, rot: 0, build: treeBuild }); }
  defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: -30, z: 24, rot: 0, build: treeBuild }); defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: 30, z: 26, rot: 0, build: treeBuild });
  defProp('xLampPost', { extra: true, label: 'lamp post', ico: '💡', cat: 'yard', yard: true, price: 350, desc: 'Lights the yard at night.', build: lampPostBuild });
  defProp('xCar', { extra: true, label: 'parked car', ico: '🚗', cat: 'yard', yard: true, price: 0, desc: 'Somebody is in.', build: function (c) { carBuild(pick(CAR_COLS))(c); } });
  defProp('xAisleSign', { extra: true, label: 'aisle sign', ico: '🪧', cat: 'hall', price: 40, desc: 'Hangs from the roof.', build: aisleSignBuild('AISLE') });

  // The entrance lobby (x -30 to -25.5, z 18.5 to 24): the staff door on the west wall at z 22, the lobby door east at z 20.
  // The time clock, lockers and hooks live here. The break room is the north-west corner (x -30 to -23, z -24 to -20.2), above IN 1.
  defProp('lockers', { label: 'lockers', cat: 'room', x: -18.4, z: 13.55, rot: 2, build: lockerBuild });
  defProp('hooks', { label: 'coat hooks', cat: 'room', wall: true, x: -16.6, z: 13.83, rot: 2, build: hooksBuild });
  defProp('notice', { label: 'notice board', cat: 'wall', wall: true, x: -17.5, z: 8.59, rot: 0, build: noticeBuild });
  defProp('firstAid', { label: 'first-aid box', cat: 'wall', wall: true, abs: true, x: -25.6, z: 22.9, rot: 3, build: firstAidBuild });
  defProp('extBreak', { label: 'fire extinguisher', cat: 'wall', wall: true, x: -19.83, z: 13.2, rot: 1, build: extinguisherBuild });
  defProp('posterRota', { label: 'rota poster', cat: 'wall', wall: true, x: -19.83, z: 9.2, rot: 1, build: posterBuild('rota', 0.6, 0.9) });
  defProp('posterSmoke', { label: 'no-smoking poster', cat: 'wall', wall: true, x: -15.6, z: 11.0, rot: 3, build: posterBuild('nosmoking', 0.6, 0.9) });
  defProp('lobbySeat', { label: 'bench seat', cat: 'room', x: -17.8, z: 9.1, rot: 2, build: benchSeatBuild });
  defProp('cot', { label: 'cot', cat: 'room', x: -15.0, z: -13.3, rot: 0, build: cotBuild });
  defProp('vending', { label: 'vending machine', cat: 'room', x: -13.6, z: -11.4, rot: 3, build: vendingBuild });
  defProp('coffee', { label: 'coffee counter', cat: 'room', x: -19.5, z: -12.2, rot: 1, build: coffeeBuild });
  defProp('fridge', { label: 'fridge', cat: 'room', x: -19.5, z: -13.5, rot: 1, build: fridgeBuild });
  defProp('cooler', { label: 'water cooler', cat: 'room', x: -19.6, z: -10.7, rot: 1, build: coolerBuild });
  defProp('table', { label: 'table', cat: 'room', x: -16.6, z: -11.6, rot: 0, build: tableBuild });
  defProp('chair1', { label: 'chair', cat: 'room', x: -17.35, z: -11.6, rot: 1, build: chairBuild });
  defProp('chair2', { label: 'chair', cat: 'room', x: -15.85, z: -11.6, rot: 3, build: chairBuild });
  defProp('chair3', { label: 'chair', cat: 'room', x: -16.6, z: -12.35, rot: 0, build: chairBuild });
  defProp('calendar', { label: 'calendar', cat: 'wall', wall: true, x: -17.6, z: -13.83, rot: 0, build: calendarBuild });
  defProp('clockBreak', { label: 'wall clock', cat: 'wall', wall: true, x: -18.4, z: -13.83, rot: 0, build: clockBuild(0.28) });
  defProp('posterHands', { label: 'wash-hands poster', cat: 'wall', wall: true, x: -16.5, z: -13.83, rot: 0, build: posterBuild('hands', 0.5, 0.75) });
  defProp('plantBreak', { label: 'potted plant', cat: 'room', x: -13.5, z: -13.5, rot: 0, build: plantBuild });
  // the office
  defProp('desk', { label: 'office desk', cat: 'room', x: 17.5, z: 12.4, rot: 0, build: deskBuild });
  defProp('officeChair', { label: 'office chair', cat: 'room', x: 17.5, z: 11.6, rot: 0, build: officeChairBuild });
  defProp('cabinets', { label: 'filing cabinets', cat: 'room', x: 19.3, z: 13.5, rot: 2, build: cabinetsBuild });
  defProp('plant', { label: 'potted plant', cat: 'room', x: 13.2, z: 13.4, rot: 0, build: plantBuild });
  defProp('coatStand', { label: 'coat stand', cat: 'room', x: 13.0, z: 9.0, rot: 0, build: coatStandBuild });
  defProp('kpi', { label: 'whiteboard', cat: 'wall', wall: true, x: 19.83, z: 11.5, rot: 3, build: kpiBuild });
  defProp('certificate', { label: 'certificate', cat: 'wall', wall: true, x: 19.83, z: 13.3, rot: 3, build: certificateBuild });
  defProp('posterSafety', { label: 'safety poster', cat: 'wall', wall: true, x: 16.5, z: 13.83, rot: 2, build: posterBuild('safety', 0.6, 0.9) });
  // the hall
  defProp('bench', { label: 'packing bench', cat: 'hall', x: 16.6, z: 5.2, rot: 0, build: benchBuild });
  defProp('binDamaged', { label: 'damaged-goods bin', cat: 'hall', x: 13.3, z: 2.4, rot: 0, build: binBuild });
  defProp('broom', { label: 'broom', cat: 'hall', x: 13.0, z: 3.0, rot: 0, build: broomBuild });
  defProp('wetFloor', { label: 'wet-floor sign', cat: 'hall', x: 13.4, z: 7.6, rot: 1, build: wetFloorBuild });
  defProp('empties', { label: 'stack of empty pallets', cat: 'hall', abs: true, keep: true, x: -12.5, z: -21.0, rot: 0, build: emptiesBuild });   // east of the mezzanine stair, which stood over the old spot
  defProp('baler', { label: 'baler', cat: 'hall', x: -7.5, z: -13.2, rot: 0, build: balerBuild });
  defProp('wrapper', { label: 'stretch wrapper', cat: 'hall', abs: true, x: 14, z: -22.3, rot: 0, build: wrapperBuild });
  defProp('hose', { label: 'hose reel', cat: 'wall', wall: true, abs: true, x: -10.5, z: -23.83, rot: 0, build: hoseBuild });
  defProp('extNW', { label: 'fire extinguisher', cat: 'wall', wall: true, x: -19.83, z: -11.2, rot: 1, build: extinguisherBuild });
  defProp('extNE', { label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 35.83, z: -16.4, rot: 3, build: extinguisherBuild });
  defProp('extBench', { label: 'fire extinguisher', cat: 'wall', wall: true, abs: true, x: 29.83, z: 16.5, rot: 3, build: extinguisherBuild });   // z 6.5 until 1.13.1: the shipping belt now runs along that stretch of wall
  defProp('clockHall', { label: 'hall clock', cat: 'wall', wall: true, abs: true, x: 12, z: -23.7, rot: 0, build: function (c) { var f = clockBuild(0.5); f(c); c.group.children[c.group.children.length - 1].position.y = 5.8 - 2.7 + 2.7; } });
  defProp('posterLift', { label: 'lifting poster', cat: 'wall', wall: true, abs: true, x: -29.83, z: 2, rot: 1, build: posterBuild('lifting', 0.7, 1.05) });
  defProp('posterFork', { label: 'forklift poster', cat: 'wall', wall: true, x: 2.2, z: 13.83, rot: 2, build: posterBuild('forklift', 0.7, 1.05) });
  defProp('posterStack', { label: 'pallet-rules poster', cat: 'wall', wall: true, x: -6, z: 13.83, rot: 2, build: posterBuild('stacking', 0.7, 1.05) });
  defProp('posterOffice', { label: 'safety poster', cat: 'wall', wall: true, x: 12.42, z: 11.5, rot: 3, build: posterBuild('safety', 0.7, 1.05) });
  defProp('posterExit', { label: 'fire-exit poster', cat: 'wall', wall: true, x: 15.2, z: -13.83, rot: 0, build: posterBuild('exit', 0.6, 0.9) });
  // the yard
  defProp('shelter', { label: 'smoking shelter', cat: 'yard', yard: true, x: -22.5, z: 19, rot: 0, build: shelterBuild });
  defProp('dumpster', { label: 'dumpster', cat: 'yard', yard: true, x: 24, z: 18, rot: 0, build: dumpsterBuild });
  defProp('flag', { label: 'flag pole', cat: 'yard', yard: true, x: 10, z: 19, rot: 0, build: flagBuild });
  defProp('parkingSign', { label: 'parking sign', cat: 'yard', yard: true, x: -2, z: 18.5, rot: 0, build: parkingSignBuild });
  // extras to buy from the catalogue
  defProp('xChair', { extra: true, label: 'chair', ico: '🪑', cat: 'room', price: 25, desc: 'A canteen chair.', build: chairBuild });
  defProp('xTable', { extra: true, label: 'table', ico: '🪵', cat: 'room', price: 60, desc: 'A square canteen table.', build: tableBuild });
  defProp('xLockers', { extra: true, label: 'lockers', ico: '🗄️', cat: 'room', price: 120, desc: 'Two more lockers.', build: lockerBuild });
  defProp('xPlant', { extra: true, label: 'potted plant', ico: '🌿', cat: 'room', price: 40, desc: 'Something green.', build: plantBuild });
  defProp('xCooler', { extra: true, label: 'water cooler', ico: '🥤', cat: 'room', price: 90, desc: 'Another cooler.', build: coolerBuild });
  defProp('xCot', { extra: true, label: 'cot', ico: '🛏️', cat: 'room', price: 150, desc: 'A second place to sleep.', build: cotBuild });
  defProp('xOfficeChair', { extra: true, label: 'office chair', ico: '💺', cat: 'room', price: 80, desc: 'Swivels.', build: officeChairBuild });
  defProp('xCabinets', { extra: true, label: 'filing cabinets', ico: '🗂️', cat: 'room', price: 110, desc: 'Paperwork storage.', build: cabinetsBuild });
  defProp('xBin', { extra: true, label: 'wheelie bin', ico: '🗑️', cat: 'hall', price: 20, desc: 'Takes damaged boxes too.', build: binBuild });
  defProp('xWetFloor', { extra: true, label: 'wet-floor sign', ico: '⚠️', cat: 'hall', price: 10, desc: 'For appearances.', build: wetFloorBuild });
  defProp('xEmpties', { extra: true, label: 'stack of empty pallets', ico: '🪵', cat: 'hall', price: 0, desc: 'Dressing.', build: emptiesBuild });
  defProp('xBollard', { extra: true, label: 'bollard', ico: '🟡', cat: 'hall', price: 30, desc: 'Guards a corner.', build: bollardBuild });
  defProp('xExt', { extra: true, label: 'fire extinguisher', ico: '🧯', cat: 'wall', wall: true, price: 60, desc: 'On the wall.', build: extinguisherBuild });
  defProp('xClock', { extra: true, label: 'wall clock', ico: '🕒', cat: 'wall', wall: true, price: 25, desc: 'Keeps game time.', build: clockBuild(0.32) });
  defProp('xNotice', { extra: true, label: 'notice board', ico: '📌', cat: 'wall', wall: true, price: 30, desc: 'Cork and pins.', build: noticeBuild });
  POSTER_KINDS.forEach(function (k) { defProp('xPoster_' + k, { extra: true, label: k + ' poster', ico: '🖼️', cat: 'wall', wall: true, price: 15, desc: 'Framed.', build: posterBuild(k, 0.6, 0.9) }); });
  defProp('xFirstAid', { extra: true, label: 'first-aid box', ico: '🩹', cat: 'wall', wall: true, price: 35, desc: 'The inspector likes one.', build: firstAidBuild });
  defProp('xTree', { extra: true, label: 'tree', ico: '🌳', cat: 'yard', yard: true, price: 80, desc: 'For the yard.', build: treeBuild });
  defProp('xBenchSeat', { extra: true, label: 'bench seat', ico: '🪑', cat: 'yard', yard: true, price: 70, desc: 'Slatted.', build: benchSeatBuild });
  defProp('xYardBollard', { extra: true, label: 'bollard', ico: '🟡', cat: 'yard', yard: true, price: 30, desc: 'Yellow steel.', build: bollardBuild });
  defProp('xShelter', { extra: true, label: 'smoking shelter', ico: '🚬', cat: 'yard', yard: true, price: 400, desc: 'Roof and a bench.', build: shelterBuild });
  defProp('xDumpster', { extra: true, label: 'dumpster', ico: '♻️', cat: 'yard', yard: true, price: 150, desc: 'Cardboard only.', build: dumpsterBuild });
