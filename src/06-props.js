//@ props: every movable thing is a definition with a default spot; build mode (F2) moves, turns, removes, restores and adds them
  // ── The prop system ───────────────────────────────────────────────
  // A prop is built by defProp(id, { label, x, z, rot, cat, wall, price, build(ctx, P) }). Its placement is the default from the
  // definition unless S.layout[id] overrides it. Bought extras live in S.custom as { id, type, x, z, rot }. Rotation is in quarter
  // turns. Each prop builds into its own group, so moving it is: remove the instance, build it again at the new spot.
  var PROPS = {}, PROP_ORDER = [], propInst = {};
  function defProp(id, def) { def.id = id; PROPS[id] = def; PROP_ORDER.push(id); }
  function propDef(id) { if (PROPS[id]) return PROPS[id]; var c = customById(id); return c ? PROPS[c.type] : null; }
  function customById(id) { return (S.custom || []).filter(function (c) { return c.id === id; })[0] || null; }
  function propPlacement(id) {
    var d = PROPS[id], c = customById(id), o = (S.layout && S.layout[id]) || {};
    if (c) return { x: typeof o.x === 'number' ? o.x : c.x, z: typeof o.z === 'number' ? o.z : c.z, rot: typeof o.rot === 'number' ? o.rot : (c.rot || 0), hidden: !!o.hidden, custom: true };
    return { x: typeof o.x === 'number' ? o.x : d.x, z: typeof o.z === 'number' ? o.z : d.z, rot: typeof o.rot === 'number' ? o.rot : (d.rot || 0), hidden: !!o.hidden, custom: false };
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
    dress.clocks = dress.clocks.filter(function (c) { return !c.group || !inGroup(c.group); }); screens.forEach(function (s, k) { if (inGroup(s.mesh)) screens.splice(k, 1); });
    for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1);
    delete propInst[id]; NAV.dirty = true;
  }
  function buildProp(id) {
    removePropInst(id);
    var def = propDef(id); if (!def) return null;
    var P = propPlacement(id), g = new THREE.Group(); g.userData.propId = id; g.position.set(P.x, propGroundY(P.x, P.z), P.z); g.rotation.y = P.rot * Math.PI / 2;
    var ctx = propCtx(g, id), inst = { id: id, g: g, P: P, ctx: ctx };
    propInst[id] = inst;
    if (!P.hidden) {
      def.build(ctx, P, inst);
      g.traverse(function (o) { if (o.isMesh) o.userData.propId = id; });
      ctx.obstacles.forEach(function (o) { var r = rotAABB(o, P.rot); solids.push({ x0: P.x + r.x0, x1: P.x + r.x1, z0: P.z + r.z0, z1: P.z + r.z1, y0: o.y0, y1: o.y1, prop: id }); });
      if (def.after) def.after(ctx, P, inst);
      if (!def.wall && ctx.obstacles.length) { var fx0 = 1e9, fx1 = -1e9, fz0 = 1e9, fz1 = -1e9; ctx.obstacles.forEach(function (o) { fx0 = Math.min(fx0, o.x0); fx1 = Math.max(fx1, o.x1); fz0 = Math.min(fz0, o.z0); fz1 = Math.max(fz1, o.z1); }); groundBlob((fx1 - fx0) * 1.5 + 0.3, (fz1 - fz0) * 1.5 + 0.3, (fx0 + fx1) / 2, (fz0 + fz1) / 2, g, 0); }
    }
    scene.add(g); NAV.dirty = true; shadowDirty = true;
    return inst;
  }
  function buildProps() { PROP_ORDER.forEach(function (id) { if (!PROPS[id].extra && (!PROPS[id].when || PROPS[id].when())) buildProp(id); }); (S.custom || []).forEach(function (c) { if (PROPS[c.type]) buildProp(c.id); }); }
  function propGroundY(x, z) { if (insideHall(x, z)) return 0; for (var i = 0; i < S.trucks.length; i++) { var t = S.trucks[i]; if (t.state === 'docked') { var b = trailerBounds(t); if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return 0; } } return YARD_Y; }
  function propIdOf(obj) { for (var o = obj; o; o = o.parent) if (o.userData && o.userData.propId) return o.userData.propId; return null; }

  // ── Build mode ────────────────────────────────────────────────────
  var edit = { on: false, grabbed: null, helper: null, snap: true, wallAim: null };
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
    WALLS.push({ a: 'x', v: 12.42, n: -1, z0: 8.5, z1: Z }, { a: 'x', v: 12.58, n: 1, z0: 8.5, z1: Z }, { a: 'z', v: 8.42, n: -1, x0: 12.5, x1: X }, { a: 'z', v: 8.58, n: 1, x0: 12.5, x1: X });
    WALLS.push({ a: 'x', v: -15.58, n: 1, z0: 8.5, z1: Z }, { a: 'x', v: -15.42, n: -1, z0: 8.5, z1: Z }, { a: 'z', v: 8.42, n: -1, x0: -X, x1: -15.5 }, { a: 'z', v: 8.58, n: 1, x0: -X, x1: -15.5 });
    WALLS.push({ a: 'x', v: -13.08, n: 1, z0: -Z, z1: -10.2 }, { a: 'x', v: -12.92, n: -1, z0: -Z, z1: -10.2 }, { a: 'z', v: -10.28, n: -1, x0: -X, x1: -13 }, { a: 'z', v: -10.12, n: 1, x0: -X, x1: -13 });
    return WALLS;
  }
  function editAim(def) {
    ray.setFromCamera(centre, camera);
    var dir = ray.ray.direction, o = ray.ray.origin, y = Math.max(YARD_Y, floorY(player.x, player.z)), pt;
    var t = (y - o.y) / dir.y;
    if (dir.y < -0.05 && t > 0 && t < 10) pt = o.clone().add(dir.clone().multiplyScalar(t));
    else { var flat = dir.clone(); flat.y = 0; flat.normalize(); pt = o.clone().add(flat.multiplyScalar(2.6)); pt.y = y; }
    var sn = function (v) { return edit.snap ? Math.round(v * 20) / 20 : v; };
    if (def.wall) {
      var best = null, bd = 2.5;
      wallPlanes().forEach(function (w) { var d = w.a === 'x' ? Math.abs(pt.x - w.v) : Math.abs(pt.z - w.v); var within = w.a === 'x' ? (pt.z > w.z0 && pt.z < w.z1) : (pt.x > w.x0 && pt.x < w.x1); if (within && d < bd) { bd = d; best = w; } });
      if (best) { if (best.a === 'x') return { x: best.v, z: sn(pt.z), rot: best.n > 0 ? 1 : 3, wall: true }; return { x: sn(pt.x), z: best.v, rot: best.n > 0 ? 0 : 2, wall: true }; }
    }
    var lim = def.yard ? 80 : HALL.x - 0.4, limz = def.yard ? 60 : HALL.z - 0.4;
    return { x: clamp(sn(pt.x), -lim, lim), z: clamp(sn(pt.z), -limz, limz), rot: null, wall: false };
  }
  function editTick() {
    if (!edit.on) return;
    if (edit.grabbed) {
      var inst = propInst[edit.grabbed]; if (!inst) { edit.grabbed = null; return; }
      var def = propDef(edit.grabbed), aim = editAim(def);
      inst.g.position.set(aim.x, propGroundY(aim.x, aim.z), aim.z); if (aim.rot !== null && def.wall) { inst.P.rot = aim.rot; inst.g.rotation.y = aim.rot * Math.PI / 2; }
      editHelper(inst.g, 0xf5b53d);
    } else if (focus && focus.editId && propInst[focus.editId]) editHelper(propInst[focus.editId].g, 0x5fd38d);
    else editHelper(null);
  }
  function editGrab(id) {
    if (edit.grabbed || !propInst[id]) return;
    var def = propDef(id); if (def.fixed) { toast('That one stays where it is.', 'bad'); return; }
    edit.grabbed = id; for (var i = solids.length - 1; i >= 0; i--) if (solids[i].prop === id) solids.splice(i, 1); NAV.dirty = true;
    propInst[id].g.traverse(function (o) { if (o.isMesh && o.material && o.material.clone && !o.userData.ghosted) { o.userData.origMat = o.material; o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.5; o.material.depthWrite = false; o.castShadow = false; o.userData.ghosted = true; } });
    sfx('pickup'); toast('Carrying the ' + propLabel(id) + ' · E places · R turns · Esc drops it back', '');
  }
  function editDrop(cancel) {
    var id = edit.grabbed; if (!id) return; edit.grabbed = null;
    var inst = propInst[id];
    if (!cancel && inst) { if (!S.layout) S.layout = {}; S.layout[id] = { x: Math.round(inst.g.position.x * 100) / 100, z: Math.round(inst.g.position.z * 100) / 100, rot: inst.P.rot }; sfx('putdown'); toast('Placed the ' + propLabel(id), 'good'); }
    buildProp(id); editHelper(null); save();
  }
  function editRotate(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id || !propInst[id]) return;
    var inst = propInst[id], def = propDef(id); if (def.wall && !edit.grabbed) { toast('Wall pieces face the wall.', ''); return; }
    inst.P.rot = (inst.P.rot + 1) % 4; inst.g.rotation.y = inst.P.rot * Math.PI / 2; sfx('click');
    if (!edit.grabbed) { if (!S.layout) S.layout = {}; S.layout[id] = { x: inst.g.position.x, z: inst.g.position.z, rot: inst.P.rot }; buildProp(id); save(); }
  }
  function editReset(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id) return;
    if (edit.grabbed) edit.grabbed = null;
    if (S.layout) delete S.layout[id]; buildProp(id); editHelper(null); sfx('ok'); toast('Put the ' + propLabel(id) + ' back where it started', 'good'); save();
  }
  function editRemove(pid) {
    var id = pid || edit.grabbed || (focus && focus.editId); if (!id) return;
    var c = customById(id);
    if (edit.grabbed) edit.grabbed = null;
    if (c) { var def = PROPS[c.type]; S.custom.splice(S.custom.indexOf(c), 1); removePropInst(id); if (def && def.price) { pay(Math.round(def.price / 2), 'Sold back: ' + def.label); toast('Sold the ' + def.label + ' back for half', ''); } }
    else { if (!S.layout) S.layout = {}; S.layout[id] = S.layout[id] || {}; S.layout[id].hidden = true; buildProp(id); toast('Removed the ' + propLabel(id) + ' (the catalogue brings it back)', ''); }
    editHelper(null); sfx('bad'); save();
  }
  function editRestore(id) { if (S.layout && S.layout[id]) { delete S.layout[id].hidden; } buildProp(id); sfx('ok'); toast('The ' + propLabel(id) + ' is back', 'good'); save(); }
  function editBuy(type) {
    var def = PROPS[type]; if (!def || !def.extra) return;
    if (def.price && S.bank < def.price) { toast('That costs ' + money(def.price) + ' and you have ' + money(S.bank), 'bad'); return; }
    if (def.price) pay(-def.price, 'Bought: ' + def.label);
    if (!S.custom) S.custom = [];
    var aim = editAim(def), c = { id: uid('cp'), type: type, x: aim.x, z: aim.z, rot: aim.rot || 0 }; S.custom.push(c);
    buildProp(c.id); closePanel(); editGrab(c.id); toast('Carrying the ' + def.label + ' · aim and press E', '');
  }
  // the catalogue (C): removed props to bring back, and extras to buy
  var CAT_GROUPS = [['room', '🛋 Break room and office'], ['hall', '🏭 The hall'], ['wall', '🖼 On the wall'], ['yard', '🌳 The yard']];
  function catalogueHtml() {
    var h = '<p>Build mode. Press <kbd>E</kbd> on a prop to carry it, <kbd>R</kbd> to turn it, <kbd>Backspace</kbd> to put it back where it started, <kbd>Del</kbd> to remove it. Bought extras sell back for half.</p>';
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
  function chairBuild(c) { c.box(0.42, 0.04, 0.42, CHAIR_RED, 0, 0.46, 0); c.box(0.42, 0.38, 0.03, CHAIR_RED, 0, 0.72, -0.2); [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (l) { c.cyl(0.014, 0.46, MAT.chrome, l[0], 0.23, l[1], 6); }); c.cyl(0.014, 0.3, MAT.chrome, -0.18, 0.62, -0.2, 6); c.cyl(0.014, 0.3, MAT.chrome, 0.18, 0.62, -0.2, 6); c.solid(-0.22, 0.22, -0.22, 0.22, 0, 0.5); }
  function tableBuild(c) { c.box(0.9, 0.06, 0.9, MAT.wood, 0, 0.75, 0); [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]].forEach(function (o) { c.cyl(0.025, 0.75, MAT.chrome, o[0], 0.375, o[1], 8); }); c.cyl(0.05, 0.1, MAT.white, 0.2, 0.83, -0.1, 10); c.box(0.14, 0.02, 0.2, MAT.paper, -0.2, 0.79, 0.2); c.cyl(0.04, 0.12, std({ color: 0xb8322a, roughness: 0.3, metalness: 0.4 }), 0.3, 0.84, 0.25, 10); c.solid(-0.47, 0.47, -0.47, 0.47, 0, 0.8); }
  function lockerBuild(c) {
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
    c.box(1.9, 0.12, 0.9, MAT.steelDark, 0, 0.3, 0); c.box(1.85, 0.18, 0.85, MAT.blue, 0, 0.45, 0); c.box(0.5, 0.12, 0.42, MAT.white, -0.62, 0.6, 0).rotation.z = 0.08; c.box(0.6, 0.1, 0.8, std({ color: 0x6b2b2b, roughness: 1 }), 0.55, 0.58, 0); c.box(0.6, 0.04, 0.8, std({ color: 0x5a2424, roughness: 1 }), 0.55, 0.65, 0);
    [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(function (o) { c.box(0.05, 0.3, 0.05, MAT.steelDark, o[0], 0.15, o[1]); });
    c.box(1.95, 0.05, 0.05, MAT.steelDark, 0, 0.5, -0.47); c.box(1.95, 0.05, 0.05, MAT.steelDark, 0, 0.5, 0.47); c.box(0.05, 0.4, 0.95, MAT.steelDark, -0.97, 0.45, 0); c.box(0.05, 0.6, 0.95, MAT.steelDark, 0.97, 0.55, 0);
    c.solid(-0.95, 0.95, -0.45, 0.45, 0, 0.7); c.hit(1.9, 0.6, 0.9, 0, 0.5, 0, { prompt: function () { return cotPrompt(); }, use: function () { sleepNow(); } });
  }
  function coffeeBuild(c) {
    c.box(1.4, 0.9, 0.6, MAT.grey, 0, 0.45, 0); c.box(1.44, 0.04, 0.64, MAT.white, 0, 0.92, 0); c.solid(-0.7, 0.7, -0.3, 0.3, 0, 1);
    c.box(0.35, 0.5, 0.35, MAT.black, -0.35, 1.19, -0.05); c.box(0.3, 0.08, 0.1, MAT.red, -0.35, 1.34, 0.15); c.plane(0.12, 0.08, MAT.screen, -0.35, 1.24, 0.13, 0, 0); c.box(0.3, 0.02, 0.2, MAT.chrome, -0.35, 0.95, 0.15); c.box(0.06, 0.08, 0.06, MAT.black, -0.35, 1.04, 0.13); c.cyl(0.035, 0.09, MAT.white, -0.35, 0.995, 0.15, 10); c.cyl(0.09, 0.14, MAT.glass, -0.35, 1.49, -0.1, 12); c.cyl(0.07, 0.1, std({ color: 0x4a2c1a, roughness: 1 }), -0.35, 1.46, -0.1, 10);
    c.hit(0.5, 0.6, 0.5, -0.35, 1.19, -0.05, { prompt: function () { return S.events.power ? 'The coffee machine is off' : (buff.coffeeUntil > S.time && buff.coffeeDay === S.day ? 'Coffee is still working' : 'Have a coffee (walk faster for an hour)'); }, use: function () { drinkCoffee(); } });
    c.cyl(0.08, 0.2, MAT.chrome, 0.1, 1.04, -0.1, 12); c.cyl(0.02, 0.1, MAT.chrome, 0.17, 1.07, -0.04, 6).rotation.z = -0.8; c.cyl(0.045, 0.1, MAT.white, 0.25, 0.99, 0.12, 10); c.cyl(0.045, 0.1, MAT.red, 0.35, 0.99, 0.02, 10);
    c.box(0.5, 0.3, 0.38, MAT.black, 0.42, 1.09, -0.08); c.plane(0.3, 0.16, MAT.glass, 0.42, 1.11, 0.115, 0, 0); c.box(0.06, 0.1, 0.02, MAT.black, 0.62, 1.09, 0.12);
    var rg = new THREE.Group(); rg.position.set(-0.05, 1.02, 0.1); c.add(rg); dress.radio = rg; rg.userData.worldOf = c.group;
    box(0.36, 0.16, 0.14, MAT.plastic, 0, 0, 0, rg); plane(0.12, 0.1, MAT.rubberMat, -0.09, 0.0, 0.071, 0, 0, rg); plane(0.12, 0.04, glowMat(0xf5b53d, 0.3), 0.09, 0.02, 0.071, 0, 0, rg); cyl(0.005, 0.35, MAT.chrome, 0.15, 0.22, 0, rg, 4).rotation.z = -0.3;
    c.hit(0.4, 0.2, 0.2, -0.05, 1.02, 0.1, { prompt: function () { return radioPrompt(); }, use: function () { radioUse(); } });
  }
  function vendingBuild(c) {
    c.box(0.95, 1.9, 0.8, MAT.blue, 0, 0.95, 0); c.plane(0.6, 1.1, glowMat(0x9ad0ff, 0.35), -0.1, 1.15, 0.41, 0, 0); for (var vr = 0; vr < 4; vr++) for (var vc = 0; vc < 3; vc++) c.box(0.12, 0.16, 0.08, [MAT.red, MAT.green, MAT.yellow, MAT.white][(vr + vc) % 4], -0.3 + vc * 0.2, 0.75 + vr * 0.25, 0.38);
    var gf = c.box(0.62, 1.14, 0.01, MAT.glass, -0.1, 1.15, 0.425); gf.userData.noBake = true; c.box(0.6, 0.02, 0.6, glowMat(0xdfe9ff, 0.5), -0.1, 1.72, 0.1); c.box(0.22, 0.4, 0.02, MAT.steelDark, 0.3, 1.25, 0.42); c.box(0.03, 0.06, 0.01, MAT.black, 0.3, 1.38, 0.432); for (var kp = 0; kp < 6; kp++) c.box(0.03, 0.03, 0.01, MAT.white, 0.24 + (kp % 3) * 0.05, 1.2 - Math.floor(kp / 3) * 0.05, 0.432); c.box(0.5, 0.2, 0.02, MAT.black, -0.1, 0.33, 0.425); c.box(0.44, 0.03, 0.02, MAT.chrome, -0.1, 0.42, 0.432);
    c.sign(['SNACKS'], 0.7, 0.2, -0.1, 1.8, 0.42, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' }); c.solid(-0.5, 0.5, -0.4, 0.4, 0, 2);
    dress.vending = c.hit(1.0, 1.9, 0.9, 0, 0.95, 0, { prompt: function () { return S.events.power ? 'The vending machine is dark' : 'Buy a snack ($3): walk faster for half an hour'; }, use: function () { buySnack(); } });
  }
  function fridgeBuild(c) { c.box(0.7, 1.75, 0.7, MAT.white, 0, 0.875, 0); c.box(0.03, 0.4, 0.03, MAT.chrome, -0.3, 1.2, 0.37); c.box(0.03, 0.3, 0.03, MAT.chrome, -0.3, 0.5, 0.37); c.box(0.7, 0.1, 0.02, MAT.black, 0, 0.05, 0.36); c.box(0.12, 0.14, 0.004, MAT.paper, 0.15, 1.5, 0.36); c.box(0.02, 0.02, 0.01, MAT.red, 0.15, 1.58, 0.365); c.solid(-0.37, 0.37, -0.37, 0.37, 0, 2); }
  function coolerBuild(c) { c.box(0.4, 1.0, 0.4, MAT.white, 0, 0.5, 0); c.cyl(0.12, 0.3, MAT.glass, 0, 1.15, 0, 12); c.cyl(0.1, 0.06, MAT.blue, 0, 1.33, 0, 12); c.box(0.03, 0.05, 0.04, MAT.blue, -0.06, 0.95, 0.21); c.box(0.03, 0.05, 0.04, MAT.red, 0.06, 0.95, 0.21); c.box(0.06, 0.2, 0.06, MAT.white, 0.26, 1.05, 0); c.solid(-0.22, 0.22, -0.22, 0.22, 0, 1.4); }
  function hooksBuild(c) { c.box(1.9, 0.04, 0.12, MAT.wood, 0, 1.82, 0); for (var hk = 0; hk < 4; hk++) { var hx = -0.68 + hk * 0.45; c.cyl(0.015, 0.1, MAT.chrome, hx, 1.75, 0.05, 6).rotation.x = Math.PI / 2; if (hk !== 2) { c.box(0.36, 0.5, 0.06, hk === 1 ? MAT.hivisOrange : MAT.hivis, hx, 1.45, 0.06); c.box(0.1, 0.06, 0.07, MAT.hivis, hx, 1.72, 0.06); } } }
  function noticeBuild(c) { c.box(1.6, 1.0, 0.04, MAT.wood, 0, 1.9, 0); c.plane(1.5, 0.9, MAT.cork, 0, 1.9, 0.025, 0, 0); c.sign(['TRUCKS', 'IN 07:30 · 13:30', 'OUT 10:30-12 · 16-18'], 0.9, 0.5, -0.25, 2.05, 0.03, 0, { w: 512, h: 320, bg: '#f5f1e6', fg: '#1b232c', size: 56 }); [[0.45, 1.75, -0.1], [-0.1, 1.6, 0.15], [0.55, 1.65, 0.05]].forEach(function (n) { var nb = c.box(0.22, 0.28, 0.004, MAT.paper, n[0], n[1], 0.03); nb.rotation.z = n[2]; c.cyl(0.01, 0.01, MAT.red, n[0], n[1] + 0.12, 0.035, 8).rotation.x = Math.PI / 2; }); }
  function calendarBuild(c) { c.box(0.4, 0.5, 0.02, MAT.paper, 0, 2.6, 0); c.sign(['OCTOBER', '', '1  2  3  4  5  6  7', '8  9 10 11 12 13 14'], 0.36, 0.44, 0, 2.6, 0.012, 0, { w: 256, h: 320, bg: '#f3efe4', fg: '#1b232c', size: 34 }); }
  function clockBuild(r) { return function (c) { var g = new THREE.Group(); g.position.set(0, 2.7, 0.02); c.add(g); var face = cyl(r, 0.03, MAT.white, 0, 0, 0, g, 32); face.rotation.x = Math.PI / 2; var rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 32), MAT.steelDark); g.add(rim); for (var i = 0; i < 12; i++) { var t = box(i % 3 ? 0.015 : 0.03, i % 3 ? 0.04 : 0.07, 0.01, MAT.black, Math.sin(i / 12 * 6.283) * (r - 0.07), Math.cos(i / 12 * 6.283) * (r - 0.07), 0.02, g); t.rotation.z = -i / 12 * 6.283; } var hh = new THREE.Group(), mh = new THREE.Group(); hh.position.z = 0.025; mh.position.z = 0.03; g.add(hh); g.add(mh); box(0.035, r * 0.55, 0.01, MAT.black, 0, r * 0.22, 0, hh); box(0.025, r * 0.85, 0.01, MAT.black, 0, r * 0.37, 0, mh); cyl(0.03, 0.02, MAT.red, 0, 0, 0.035, g, 10).rotation.x = Math.PI / 2; g.userData.dynamic = true; dress.clocks.push({ h: hh, m: mh, group: c.group }); }; }
  function posterBuild(kind, w, h) { return function (c) { c.poster(kind, w, h, 0, 2.0, 0.01, 0); var fw = w + 0.06, fh = h + 0.06; c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 + fh / 2, 0); c.box(fw, 0.03, 0.03, MAT.black, 0, 2.0 - fh / 2, 0); c.box(0.03, fh, 0.03, MAT.black, -fw / 2, 2.0, 0); c.box(0.03, fh, 0.03, MAT.black, fw / 2, 2.0, 0); }; }
  function extinguisherBuild(c) { c.cyl(0.08, 0.5, MAT.red, 0, 1.0, 0.12, 12); c.cyl(0.05, 0.08, MAT.black, 0, 1.28, 0.12, 10); c.box(0.03, 0.12, 0.1, MAT.black, 0, 1.36, 0.14); c.cyl(0.012, 0.42, MAT.black, 0.08, 1.0, 0.15, 6).rotation.z = 0.15; c.cyl(0.02, 0.07, MAT.black, 0.11, 0.79, 0.17, 8, 0.03); c.cyl(0.025, 0.02, MAT.white, 0.0, 1.3, 0.21, 10).rotation.x = Math.PI / 2; c.box(0.1, 0.1, 0.002, MAT.paper, 0, 1.0, 0.202); c.box(0.2, 0.04, 0.1, MAT.steelDark, 0, 0.72, 0.05); c.sign(['FIRE'], 0.3, 0.12, 0, 1.6, 0.04, 0, { w: 128, h: 48, bg: '#c8342a', fg: '#fff' }); }
  function firstAidBuild(c) { c.box(0.3, 0.3, 0.1, MAT.white, 0, 1.7, 0.05); c.box(0.18, 0.05, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.05, 0.18, 0.02, MAT.green, 0, 1.7, 0.11); c.box(0.12, 0.02, 0.02, MAT.chrome, 0, 1.87, 0.05); }
  function binPrompt() { if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'Bin the damaged box'; if (S.hand && S.hand.kind === 'box') return 'That box is fine: it belongs on a rack'; return 'The bin · ' + (S.binned || 0) + ' damaged boxes written off'; }
  function binUse() { if (!(S.hand && S.hand.kind === 'box' && S.hand.damaged)) { sfx('click'); return; } var sku = S.hand.sku; handSet(null); S.binned = (S.binned || 0) + 1; var cost = Math.round(SKU[sku].val * 0.5); pay(-cost, 'Written off: a damaged box of ' + skuName(sku)); addRep(-0.5); sfx('crate'); toast('Binned. The client charges ' + money(cost) + ' for it.', 'bad'); logEvent('A damaged box of ' + skuName(sku) + ' went in the bin (' + money(cost) + ')', 'bad'); }
  function binBuild(c) { var bin = c.cyl(0.3, 0.85, MAT.red, 0, 0.47, 0, 4, 0.25); bin.rotation.y = Math.PI / 4; var lid = c.box(0.56, 0.05, 0.56, std({ color: 0x8e2420, roughness: 0.7 }), 0, 0.92, 0); lid.rotation.y = Math.PI / 4; c.box(0.08, 0.03, 0.5, MAT.black, 0.22, 0.95, 0); c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, -0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.09, 0.05, MAT.black, -0.2, 0.09, 0.22, 12).rotation.x = Math.PI / 2; c.cyl(0.015, 0.5, MAT.steelDark, -0.2, 0.09, 0, 6).rotation.x = Math.PI / 2; c.solid(-0.3, 0.3, -0.3, 0.3, 0, 1); c.hit(0.7, 0.9, 0.7, 0, 0.45, 0, { prompt: function () { return binPrompt(); }, use: function () { binUse(); } }); c.sign(['DAMAGED', 'GOODS'], 0.5, 0.3, 0, 1.1, 0.0, 0, { w: 256, h: 128, bg: '#c8342a', fg: '#fff' }); }
  function broomBuild(c) { var broom = c.cyl(0.014, 1.3, MAT.wood, 0.02, 0.72, 0, 6); broom.rotation.z = 0.22; c.box(0.3, 0.06, 0.06, MAT.plastic, 0.18, 0.1, 0); c.box(0.3, 0.06, 0.05, std({ color: 0x8a7a55, roughness: 1 }), 0.18, 0.04, 0); c.cyl(0.02, 0.04, MAT.red, -0.13, 1.36, 0, 8); }
  function wetFloorBuild(c) { var face = new THREE.MeshBasicMaterial({ map: textTex(['CAUTION', 'WET FLOOR'], { w: 192, h: 256, bg: '#f5b53d', fg: '#111', size: 34 }) }); [-1, 1].forEach(function (s) { var pg = new THREE.Group(); pg.position.set(0, 0.72, 0); pg.rotation.x = s * 0.32; c.add(pg); box(0.34, 0.72, 0.012, MAT.yellow, 0, -0.36, s * 0.006, pg); var f = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.6), face); f.position.set(0, -0.38, s * 0.014); f.rotation.y = s > 0 ? 0 : Math.PI; pg.add(f); box(0.02, 0.72, 0.02, MAT.black, -0.17, -0.36, s * 0.01, pg); box(0.02, 0.72, 0.02, MAT.black, 0.17, -0.36, s * 0.01, pg); box(0.34, 0.03, 0.02, MAT.black, 0, -0.72, s * 0.012, pg); }); c.cyl(0.012, 0.36, MAT.black, 0, 0.72, 0, 8).rotation.z = Math.PI / 2; c.box(0.1, 0.03, 0.02, MAT.black, 0, 0.75, 0); }
  // a real wooden pallet: three bearers, seven top boards with gaps, three bottom boards
  function palletModel(c, x, y, z, ry) { var g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; c.add(g); [-0.5, 0, 0.5].forEach(function (bz) { box(1.2, 0.08, 0.1, MAT.wood, 0, 0.065, bz, g); box(1.2, 0.022, 0.1, MAT.wood, 0, 0.011, bz, g); }); for (var i = 0; i < 7; i++) box(i === 0 || i === 6 ? 0.14 : 0.1, 0.022, 1.0, MAT.wood, -0.53 + i * 0.1766, 0.116, 0, g); return g; }
  function emptiesBuild(c) { for (var i = 0; i < 8; i++) palletModel(c, randf(-0.02, 0.02), i * 0.128, randf(-0.02, 0.02), randf(-0.03, 0.03)); c.box(0.08, 0.02, 1.1, MAT.hazard, -0.58, 1.04, 0); c.sign(['EMPTIES'], 1.2, 0.3, 0, 1.6, 0.6, 0, { w: 256, h: 64, bg: '#2a2f36', fg: '#a0acb8' }); c.solid(-0.62, 0.62, -0.52, 0.52, 0, 1.2); }
  // a vertical baler: a tall steel cabinet, the loading door with its window at chest height, the bale door below with a
  // handle and hinges, the ram cylinder on top, a control box on the side, hazard stripes, and a strapped bale beside it
  function balerBuild(c) {
    var GRN = std({ color: 0x2f7a3a, roughness: 0.55, metalness: 0.3 }), DRK = MAT.steelDark;
    c.box(1.2, 2.5, 0.9, GRN, 0, 1.25, 0); c.box(1.3, 0.08, 1.0, DRK, 0, 0.04, 0); c.box(1.3, 0.06, 1.0, DRK, 0, 2.53, 0);
    c.box(0.06, 2.5, 0.06, DRK, -0.6, 1.25, 0.45); c.box(0.06, 2.5, 0.06, DRK, 0.6, 1.25, 0.45); c.box(1.2, 0.06, 0.06, DRK, 0, 1.52, 0.47); c.box(1.2, 0.06, 0.06, DRK, 0, 0.7, 0.47);
    c.box(1.0, 0.7, 0.05, GRN, 0, 1.95, 0.47); var win = c.box(0.5, 0.3, 0.02, MAT.glass, 0, 2.0, 0.5); win.userData.noBake = true; c.box(0.08, 0.3, 0.04, MAT.chrome, 0.42, 1.95, 0.5); c.box(0.03, 0.08, 0.06, DRK, -0.5, 1.75, 0.5); c.box(0.03, 0.08, 0.06, DRK, -0.5, 2.2, 0.5);
    c.box(1.0, 0.72, 0.05, GRN, 0, 1.11, 0.47); c.box(0.4, 0.04, 0.06, MAT.chrome, 0.2, 1.3, 0.51); c.box(0.03, 0.1, 0.06, DRK, -0.5, 0.85, 0.5); c.box(0.03, 0.1, 0.06, DRK, -0.5, 1.35, 0.5);
    c.box(1.0, 0.1, 0.05, MAT.hazard, 0, 1.52, 0.49); c.sign(['CRUSH HAZARD · KEEP HANDS CLEAR'], 0.9, 0.09, 0, 0.62, 0.49, 0, { w: 512, h: 48, bg: '#f5b53d', fg: '#1a1205' });
    c.cyl(0.16, 0.8, MAT.chrome, 0, 2.95, 0, 16); c.cyl(0.22, 0.25, DRK, 0, 2.7, 0, 16); c.cyl(0.06, 0.5, MAT.black, 0.4, 2.75, -0.2, 8).rotation.x = 0.6; c.cyl(0.06, 0.5, MAT.black, -0.4, 2.75, -0.2, 8).rotation.x = 0.6;
    c.box(0.3, 0.45, 0.14, MAT.grey, 0.78, 1.6, 0.2); c.plane(0.16, 0.08, MAT.screen, 0.78, 1.72, 0.275, 0, 0); c.cyl(0.03, 0.02, glowMat(0x39d353, 1.2), 0.72, 1.55, 0.275, 10).rotation.x = Math.PI / 2; c.cyl(0.03, 0.02, glowMat(0xff3b30, 0.6), 0.84, 1.55, 0.275, 10).rotation.x = Math.PI / 2; c.box(0.1, 0.1, 0.03, MAT.red, 0.78, 1.42, 0.275); c.cyl(0.012, 0.9, MAT.black, 0.78, 2.1, 0.1, 6);
    c.sign(['BALER', 'cardboard only'], 0.8, 0.3, 0, 2.35, 0.5, 0, { w: 256, h: 96, bg: '#1b232c', fg: '#5fd38d', size: 34 });
    var bale = c.box(1.0, 0.8, 0.8, MAT.parcel, 1.55, 0.4, 0.1); for (var s = 0; s < 3; s++) { c.box(1.02, 0.02, 0.03, MAT.steelDark, 1.55, 0.81, -0.2 + s * 0.3); c.box(0.03, 0.82, 1.02 * 0 + 0.8, MAT.steelDark, 1.05, 0.4, 0.1 - 0.0); }
    c.solid(-0.65, 0.65, -0.5, 0.5, 0, 2.6); c.solid(1.0, 2.1, -0.35, 0.55, 0, 1);
  }
  function wrapperBuild(c, P, inst) {
    var wg = c.group; wg.userData.dynamic = true; dress.wrapper = wg;
    var tt = c.cyl(0.95, 0.1, MAT.steelDark, 0, 0.05, 0, 32); dress.turntable = tt; plane(1.7, 1.7, MAT.rubberMat, 0, 0.101, 0, -Math.PI / 2, 0, tt); for (var tk = 0; tk < 8; tk++) box(0.04, 0.02, 0.5, MAT.yellow, Math.sin(tk / 8 * 6.283) * 0.7, 0.105, Math.cos(tk / 8 * 6.283) * 0.7, tt).rotation.y = tk / 8 * 6.283;
    var rp = c.box(1.2, 0.1, 0.9, MAT.steelDark, 0, 0.03, 1.35); rp.rotation.x = 0.11; c.box(0.35, 2.7, 0.35, MAT.blue, 0, 1.35, -1.15); c.box(0.45, 0.12, 0.45, MAT.steelDark, 0, 0.06, -1.15); c.box(0.1, 2.5, 0.05, MAT.chrome, -0.1, 1.4, -0.95); c.box(0.1, 2.5, 0.05, MAT.chrome, 0.1, 1.4, -0.95);
    var carr = new THREE.Group(); carr.position.set(0, 1.0, -0.8); wg.add(carr); dress.wrapCarriage = carr; box(0.5, 0.4, 0.3, MAT.steelDark, 0, 0, 0, carr); cyl(0.14, 0.52, MAT.white, 0.35, 0, 0.1, carr, 14); cyl(0.02, 0.6, MAT.chrome, 0.35, 0, 0.1, carr, 6); cyl(0.05, 0.3, MAT.rubber, -0.3, 0, 0.1, carr, 8);
    c.box(0.32, 0.45, 0.15, MAT.grey, 0, 2.0, -0.86); c.plane(0.2, 0.12, MAT.screen, 0, 2.1, -0.78, 0, 0); c.box(0.05, 0.05, 0.03, MAT.green, -0.08, 1.88, -0.78); c.box(0.05, 0.05, 0.03, MAT.red, 0.08, 1.88, -0.78); c.sign(['START'], 0.12, 0.05, -0.08, 1.82, -0.78, 0, { w: 128, h: 48, bg: '#1b232c', fg: '#5fd38d' });
    c.sign(['STRETCH WRAP'], 1.2, 0.25, 0, 2.5, -0.9, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#78bdf5' }); c.solid(-1, 1, -1.4, 1.0, 0, 3);
    c.hit(1.0, 2.4, 0.8, 0, 1.2, -1.05, { prompt: function () { return wrapperPrompt(); }, use: function () { wrapperUse(); } });
  }
  function hoseBuild(c) { var reel = c.cyl(0.32, 0.12, MAT.red, 0, 1.5, 0.08, 24); reel.rotation.x = Math.PI / 2; c.cyl(0.05, 0.3, MAT.steelDark, 0, 1.5, 0.0, 8).rotation.x = Math.PI / 2; for (var hr = 0; hr < 5; hr++) { var ring = new THREE.Mesh(new THREE.TorusGeometry(0.12 + hr * 0.035, 0.012, 6, 24), MAT.red); ring.position.set(0, 1.5, 0.16); c.add(ring); } c.cyl(0.015, 0.25, MAT.red, 0.3, 1.25, 0.08, 6).rotation.z = 0.4; c.cyl(0.03, 0.08, MAT.chrome, 0.38, 1.12, 0.08, 8, 0.018); c.sign(['HOSE REEL'], 0.7, 0.16, 0, 2.0, 0.01, 0, { w: 256, h: 64, bg: '#c8342a', fg: '#fff' }); }
  function plantBuild(c) { c.cyl(0.16, 0.3, MAT.plastic, 0, 0.15, 0, 12, 0.13); [[0, 0.5, 0, 0.22], [0.12, 0.62, 0.08, 0.16], [-0.1, 0.66, -0.06, 0.14], [0.02, 0.78, 0.05, 0.12]].forEach(function (s) { c.sphere(s[3], MAT.green, s[0], s[1], s[2]); }); c.solid(-0.18, 0.18, -0.18, 0.18, 0, 0.5); }
  function deskBuild(c) {
    c.box(2.2, 0.06, 0.8, MAT.wood, 0, 0.75, 0); [[-1, -0.3], [1, -0.3], [-1, 0.3], [1, 0.3]].forEach(function (o) { c.box(0.05, 0.75, 0.05, MAT.steelDark, o[0] * 1.05, 0.375, o[1]); }); c.solid(-1.1, 1.1, -0.4, 0.4, 0, 0.8);
    c.box(0.45, 0.6, 0.6, MAT.grey, -0.75, 0.3, 0); for (var dw = 0; dw < 3; dw++) c.box(0.03, 0.03, 0.2, MAT.chrome, -0.52, 0.12 + dw * 0.18, 0);
    c.box(0.3, 0.05, 0.25, MAT.steelDark, 0, 0.8, 0.2); c.cyl(0.03, 0.25, MAT.steelDark, 0, 0.9, 0.25, 8); c.box(0.8, 0.5, 0.04, MAT.black, 0, 1.25, 0.25);
    pc.screen = touchScreen({ w: 800, h: 500, pw: 0.74, ph: 0.46, x: 0, y: 1.25, z: 0.225, ry: Math.PI, parent: c.group, title: 'Office PC', draw: drawPc });
    c.box(0.6, 0.004, 0.4, std({ color: 0x1f2a36, roughness: 1 }), -0.1, 0.783, -0.15); for (var kr = 0; kr < 3; kr++) for (var kc = 0; kc < 10; kc++) c.box(0.03, 0.012, 0.03, std({ color: 0x4a515b, roughness: 0.6 }), -0.3 + kc * 0.042, 0.822, -0.22 + kr * 0.04);
    c.box(0.06, 0.03, 0.1, MAT.black, 0.5, 0.8, -0.18); c.box(0.2, 0.06, 0.16, MAT.black, -0.75, 0.81, 0.26); c.cyl(0.012, 0.18, MAT.black, -0.75, 0.9, 0.26, 6).rotation.z = Math.PI / 2; c.cyl(0.03, 0.09, MAT.black, 0.9, 0.82, -0.05, 8); c.cyl(0.004, 0.14, MAT.blue, 0.9, 0.9, -0.05, 4).rotation.z = 0.2; c.cyl(0.04, 0.09, MAT.white, 0.7, 0.82, -0.1, 10); c.box(0.2, 0.01, 0.28, MAT.paper, -0.75, 0.785, -0.1);
    c.hit(1.2, 0.9, 0.5, 0, 0.5, -0.1, { prompt: function () { return pc.on ? null : (S.events.power ? 'The PC is off: no power' : 'Sit down at the PC'); }, use: function () { openPc(); } });
  }
  function officeChairBuild(c) { c.box(0.5, 0.06, 0.5, MAT.fabric, 0, 0.53, 0); c.box(0.5, 0.5, 0.06, MAT.fabric, 0, 0.78, -0.25); c.cyl(0.04, 0.5, MAT.steelDark, 0, 0.25, 0, 8); for (var sp = 0; sp < 5; sp++) { var leg = c.box(0.04, 0.03, 0.28, MAT.black, Math.sin(sp / 5 * 6.283) * 0.14, 0.04, Math.cos(sp / 5 * 6.283) * 0.14); leg.rotation.y = sp / 5 * 6.283; c.cyl(0.03, 0.02, MAT.black, Math.sin(sp / 5 * 6.283) * 0.27, 0.03, Math.cos(sp / 5 * 6.283) * 0.27, 8).rotation.x = Math.PI / 2; } c.box(0.04, 0.3, 0.3, MAT.black, -0.26, 0.68, 0); c.box(0.04, 0.3, 0.3, MAT.black, 0.26, 0.68, 0); c.solid(-0.28, 0.28, -0.28, 0.28, 0, 0.6); }
  function cabinetsBuild(c) { [-0.3, 0.3].forEach(function (cx2) { c.box(0.5, 1.3, 0.6, MAT.grey, cx2, 0.65, 0); for (var cd = 0; cd < 3; cd++) { c.box(0.5, 0.36, 0.02, MAT.steelDark, cx2, 0.25 + cd * 0.4, 0.31); c.box(0.14, 0.03, 0.02, MAT.chrome, cx2, 0.33 + cd * 0.4, 0.32); c.box(0.16, 0.06, 0.003, MAT.paper, cx2, 0.2 + cd * 0.4, 0.32); } }); c.box(0.5, 0.25, 0.4, MAT.grey, 0.3, 1.42, 0); c.box(0.4, 0.03, 0.3, MAT.white, 0.3, 1.56, 0.05); c.solid(-0.6, 0.6, -0.35, 0.35, 0, 1.6); }
  function coatStandBuild(c) {
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
    c.box(0.25, 0.12, 0.12, MAT.red, -0.3, 1.0, -1.3); c.cyl(0.07, 0.1, MAT.white, -0.3, 1.02, -1.3, 10); c.box(0.3, 0.05, 0.3, MAT.steelDark, 0.25, 0.965, -1.35); c.plane(0.2, 0.1, MAT.screen, 0.25, 1.0, -1.2, -0.6, 0); c.cyl(0.02, 0.9, MAT.steelDark, -0.4, 1.4, 1.4, 8); c.box(0.3, 0.08, 0.15, MAT.lamp, -0.3, 1.85, 1.4);
    c.box(0.22, 0.14, 0.18, MAT.white, 0.25, 1.01, 0.6); c.box(0.18, 0.01, 0.1, MAT.paper, 0.25, 1.09, 0.72); c.box(0.12, 0.02, 0.03, MAT.yellow, -0.2, 0.955, 0.2).rotation.y = 0.4;
    c.hit(1.1, 1.2, 3.2, 0, 1.4, 0, { prompt: function () { return benchPrompt(); }, use: function () { benchUse(); } });
    c.sign(['PACKING'], 1.8, 0.5, 0.3, 2.6, 0, -Math.PI / 2, { w: 512, h: 128, bg: '#1b232c', fg: '#5fd38d' });
    // the parcel shelf beyond the far end
    c.box(1.0, 0.06, 1.5, MAT.steelDark, 0, 0.6, 2.3); [[-0.45, 1.6], [0.45, 1.6], [-0.45, 3.0], [0.45, 3.0]].forEach(function (o) { c.box(0.05, 0.6, 0.05, MAT.steelDark, o[0], 0.3, o[1]); }); c.solid(-0.5, 0.5, 1.5, 3.1, 0, 0.7);
    // the terminal on an arm at the near end
    c.box(0.26, 0.03, 0.2, MAT.steelDark, 0.3, 0.955, -1.3); c.cyl(0.025, 0.5, MAT.steelDark, 0.3, 1.2, -1.3, 8); c.box(0.36, 0.04, 0.04, MAT.steelDark, 0.14, 1.45, -1.3); c.box(0.04, 0.4, 0.56, MAT.black, -0.02, 1.45, -1.3);
    var scr = touchScreen({ w: 400, h: 300, pw: 0.5, ph: 0.36, x: -0.045, y: 1.45, z: -1.3, ry: -Math.PI / 2, parent: c.group, title: 'Bench terminal', draw: benchScreenDraw }); scr.mesh.userData.propId = 'bench';
    // the stool
    c.cyl(0.17, 0.04, MAT.black, -1.0, 0.65, -0.4, 16); c.cyl(0.02, 0.6, MAT.chrome, -1.0, 0.32, -0.4, 8); c.cyl(0.2, 0.03, MAT.steelDark, -1.0, 0.03, -0.4, 16);
  }
  function benchScreenDraw(c, sc) {
    scBg(c, sc.w, sc.h); scHead(c, sc.w, 'PACKING', benchCount() + ' / ' + ECON.benchCap + ' on the bench');
    var os = openOrders().sort(function (a, b2) { return (b2.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b2.due; }).slice(0, 4), y = 56;
    if (!os.length) scText(c, 16, 76, 'No open orders.', '#a0acb8', 14);
    os.forEach(function (o) { var n = orderNeed(o); scText(c, 16, y + 12, '#' + o.num + ' ' + clientName(o.client).slice(0, 16) + (o.rush ? ' RUSH' : '') + (o.late ? ' LATE' : ''), o.late || o.rush ? '#ff6b5e' : '#eef1f5', 13); scText(c, 16, y + 28, o.lines.map(function (l) { return Math.min(l.qty, S.bench.boxes[l.sku] || 0) + '/' + l.qty + ' ' + skuName(l.sku).slice(0, 12); }).join(' · ').slice(0, 44), '#a0acb8', 11); var can = canPack(o), short = canPackShort(o); scButton(sc, 300, y + 4, 86, 32, can ? 'PACK' : short ? 'SHORT' : n.have + '/' + n.tot, can || short, function () { if (packOrder(o)) toast('Packed #' + o.num, 'good'); }, can ? '#5fd38d' : '#f5b53d'); y += 46; });
    scText(c, 16, 290, 'E on the bench with empty hands opens the full list', '#6b7784', 10);
  }
  // yard props (the shelter, dumpster, flag and parking sign)
  function shelterBuild(c) { [[-1.5, -2], [-1.5, 2], [1.5, -2], [1.5, 2]].forEach(function (p) { c.cyl(0.05, 2.4, MAT.steelDark, p[0], 1.2, p[1], 6); }); c.box(3.6, 0.06, 4.6, MAT.glass, 0, 2.45, 0); for (var sl = 0; sl < 4; sl++) c.box(1.8, 0.04, 0.07, MAT.wood, 0, 0.45, 1.46 + sl * 0.09); c.box(1.8, 0.04, 0.3, MAT.wood, 0, 0.85, 1.76).rotation.x = -0.2; [[-0.7], [0.7]].forEach(function (p) { c.box(0.06, 0.45, 0.4, MAT.steelDark, p[0], 0.22, 1.6); }); c.cyl(0.12, 0.9, MAT.steelDark, -1.8, 0.45, -1.6, 10); c.cyl(0.1, 0.5, MAT.steelDark, 1.5, 0.25, -0.8, 10); c.cyl(0.11, 0.03, std({ color: 0x8a8a8a, roughness: 0.5 }), 1.5, 0.52, -0.8, 10); c.sign(['SMOKING', 'AREA'], 0.8, 0.5, 0, 2.2, -2.2, 0, { w: 256, h: 160, bg: '#1b232c', fg: '#a0acb8' }); c.solid(-1.6, 1.6, -2.1, 2.1, -2, 0.3); }
  function dumpsterBuild(c) { c.box(1.8, 1.3, 1.2, std({ color: 0x2f5a3a, roughness: 0.7, metalness: 0.3 }), 0, 0.65, 0); var dl = c.box(1.9, 0.08, 1.3, MAT.black, 0, 1.52, -0.2); dl.rotation.x = -0.35; [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]].forEach(function (w) { c.cyl(0.08, 0.06, MAT.black, w[0], 0.08, w[1], 10).rotation.z = Math.PI / 2; }); c.box(0.1, 0.1, 0.4, MAT.steelDark, -0.95, 0.9, 0); c.box(0.1, 0.1, 0.4, MAT.steelDark, 0.95, 0.9, 0); c.sign(['CARDBOARD', 'ONLY'], 1.2, 0.5, 0, 0.9, -0.62, Math.PI, { w: 256, h: 128, bg: '#2f5a3a', fg: '#fff' }); c.solid(-0.95, 0.95, -0.65, 0.65, -2, 2); }
  function flagBuild(c) { c.cyl(0.05, 9, MAT.chrome, 0, 4.5, 0, 8, 0.07); c.sphere(0.1, MAT.yellow, 0, 9.05, 0); var fg = new THREE.Group(); fg.position.set(0, 8.3, 0); fg.userData.dynamic = true; c.add(fg); yard.flag = fg; var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 8, 2), new THREE.MeshStandardMaterial({ map: textTex(['DEPOT CO.'], { w: 256, h: 160, bg: '#f5b53d', fg: '#1b232c' }), side: THREE.DoubleSide, roughness: 0.9 })); flag.position.set(0.82, 0, 0); fg.add(flag); yard.flagMesh = flag; }
  function parkingSignBuild(c) { c.cyl(0.04, 2.4, MAT.steelDark, 0, 1.2, 0, 6); c.sign(['STAFF', 'PARKING'], 0.9, 0.6, 0, 2.5, 0, 0, { w: 256, h: 160, bg: '#2c5f9e', fg: '#fff' }); }
  function treeBuild(c) { var s = 1; c.cyl(0.12 * s, 2.6 * s, std({ color: 0x5b4634, roughness: 1 }), 0, 1.3 * s, 0, 8, 0.18 * s); [[0, 3.2, 0, 1.3], [0.7, 2.7, 0.4, 0.9], [-0.6, 2.9, -0.5, 1.0], [0.1, 4.0, 0.2, 0.8]].forEach(function (b, i) { c.sphere(b[3] * s, std({ color: [0x3f6f2e, 0x5c8f44, 0x45752f, 0x6f9a4a][i], roughness: 1 }), b[0] * s, b[1] * s, b[2] * s); }); c.solid(-0.2, 0.2, -0.2, 0.2, -2, 2); }
  function bollardBuild(c) { c.cyl(0.11, 1.0, MAT.yellow, 0, 0.5, 0, 10); c.cyl(0.14, 0.05, MAT.black, 0, 0.025, 0, 10); c.solid(-0.12, 0.12, -0.12, 0.12, -2, 1); }
  function benchSeatBuild(c) { for (var sl = 0; sl < 4; sl++) c.box(1.6, 0.04, 0.07, MAT.wood, 0, 0.45, -0.14 + sl * 0.09); c.box(1.6, 0.04, 0.3, MAT.wood, 0, 0.85, 0.16).rotation.x = -0.2; [[-0.65], [0.65]].forEach(function (p) { c.box(0.06, 0.45, 0.4, MAT.steelDark, p[0], 0.22, 0); c.box(0.06, 0.5, 0.06, MAT.steelDark, p[0], 0.65, 0.18); }); c.solid(-0.8, 0.8, -0.25, 0.25, -2, 1); }

  // stations and fabric that move too
  function timeclockBuild(c) {
    c.box(0.38, 0.5, 0.12, MAT.grey, 0, 1.5, 0); c.box(0.4, 0.04, 0.14, MAT.steelDark, 0, 1.76, 0); c.box(0.4, 0.04, 0.14, MAT.steelDark, 0, 1.24, 0);
    c.box(0.12, 0.03, 0.02, MAT.black, 0, 1.3, 0.07); tclock.lamp = c.box(0.03, 0.03, 0.02, glowMat(0x39d353, 1.2), 0.14, 1.68, 0.07);
    c.box(0.5, 0.5, 0.08, MAT.steelDark, 0.55, 1.5, -0.02); for (var k = 0; k < 6; k++) c.box(0.06, 0.14, 0.03, MAT.paper, 0.36 + Math.floor(k / 3) * 0.22, 1.62 - (k % 3) * 0.14, 0.04);
    c.sign(['CLOCK IN'], 0.6, 0.16, 0.3, 1.85, 0.0, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#eef1f5' });
    touchScreen({ w: 300, h: 320, pw: 0.3, ph: 0.32, x: 0, y: 1.5, z: 0.07, ry: 0, parent: c.group, title: 'Time clock', draw: drawTimeClock });
  }
  function consoleBuild(di) { return function (c) {
    var inbound = di < 2, k = di % 2;
    c.box(0.5, 0.6, 0.12, MAT.steelDark, 0, 1.45, 0); c.box(0.54, 0.04, 0.14, inbound ? MAT.hazard : MAT.yellow, 0, 1.77, 0); c.cyl(0.012, 1.0, MAT.black, 0, 0.65, -0.03, 6);
    touchScreen({ w: 320, h: 240, pw: 0.4, ph: 0.3, x: 0, y: 1.47, z: 0.065, ry: 0, parent: c.group, title: 'Dock console ' + dockLabel(di), draw: function (cc, sc) {
      scBg(cc, sc.w, sc.h, inbound ? 'rgba(245,181,61,0.16)' : 'rgba(95,211,141,0.16)'); scHead(cc, sc.w, 'DOCK ' + dockLabel(di));
      var t = truckAtDoor(di);
      if (inbound) {
        if (t) { var left = S.pallets.filter(function (q) { return q.place === 'truck' && q.truck === t.id; }).length; scText(cc, 16, 66, 'Truck docked · ' + t.driver + ' · ' + clientName(t.client), '#f5b53d', 14); scText(cc, 16, 86, left + ' of ' + t.pallets.length + ' pallets still on it · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scText(cc, 16, 106, t.signed ? 'Delivery note signed' : 'NOT SIGNED: see the driver outside', t.signed ? '#5fd38d' : '#ff6b5e', 13); }
        else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, 'Inbound slots: ' + TRUCK_IN.map(fmtTime).join(' and ') + (S.up.dock2 || k === 0 ? '' : ' (buy the second bay)'), '#eef1f5', 13); }
        scButton(sc, 16, 128, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
        var pending = S.pallets.filter(function (q) { return q.place === 'floor'; }).length; scButton(sc, 164, 128, 140, 40, pending + ' on the floor', false, function () { scanToggle(true); scanPage(1); });
      } else {
        var nxt = TRUCK_OUT[k];
        if (t) { scText(cc, 16, 66, 'Truck docked · ' + t.driver, '#5fd38d', 15); scText(cc, 16, 86, t.parcels.length + ' parcel' + (t.parcels.length === 1 ? '' : 's') + ' loaded · leaves ' + fmtTime(t.leave), '#eef1f5', 13); scButton(sc, 16, 104, 288, 44, t.parcels.length ? 'DISPATCH NOW' : 'nothing loaded', t.parcels.length > 0, function () { consoleUse(di); }, '#5fd38d'); }
        else { scText(cc, 16, 66, 'No truck at the door', '#a0acb8', 15); scText(cc, 16, 86, 'Next: ' + fmtTime(nxt.arrive) + ' to ' + fmtTime(nxt.leave), '#eef1f5', 13); }
        scButton(sc, 16, 160, 140, 40, S.doors[di] ? 'Close door' : 'Open door', !!S.doors[di], function () { if (S.events.power) { toast('No power.', 'bad'); return; } setDoor(di, !S.doors[di]); });
        var packed = S.orders.filter(function (o) { return o.state === 'packed'; }).length; scButton(sc, 164, 160, 140, 40, packed + ' packed waiting', false, function () { scanToggle(true); scanPage(0); });
      }
      scText(cc, 16, 226, S.events.power ? 'NO POWER' : 'mains ok', S.events.power ? '#ff6b5e' : '#5fd38d', 11);
    } });
    c.sign(['DOCK ' + dockLabel(di)], 0.7, 0.18, 0, 1.95, 0.0, 0, { w: 256, h: 64, bg: '#1b232c', fg: inbound ? '#f5b53d' : '#5fd38d' });
  }; }
  function breakerBuild(c) { var brk = c.box(0.4, 0.6, 0.12, MAT.grey, 0, 1.5, 0); c.box(0.06, 0.12, 0.03, MAT.red, 0, 1.5, 0.07); c.hit(0.5, 0.7, 0.2, 0, 1.5, 0.05, { prompt: function () { return S.events.power ? 'Reset the breaker' : 'Breaker panel (power is on)'; }, use: function () { flipBreaker(); } }); c.sign(['MAIN BREAKER'], 0.6, 0.15, 0, 1.9, 0.01, 0, { w: 256, h: 64, bg: '#f5b53d', fg: '#1a1205' }); }
  function boardBuild(c) {
    var cv = document.createElement('canvas'); cv.width = 768; cv.height = 384; world.boardCtx = cv.getContext('2d');
    world.boardTex = new THREE.CanvasTexture(cv); world.boardTex.encoding = THREE.sRGBEncoding; world.boardMat = new THREE.MeshBasicMaterial({ map: world.boardTex });
    c.cyl(0.03, 2.8, MAT.steelDark, -1.0, 5.6, 0, 6); c.cyl(0.03, 2.8, MAT.steelDark, 1.0, 5.6, 0, 6); c.box(3.1, 0.06, 0.1, MAT.steelDark, 0, 4.2, 0);
    c.box(3.1, 1.6, 0.08, MAT.black, 0, 3.35, 0); var board = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); board.position.set(0, 3.35, 0.05); c.add(board); var back = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.5), world.boardMat); back.position.set(0, 3.35, -0.05); back.rotation.y = Math.PI; c.add(back); drawBoard();
  }
  function chargerBuildOld(c) {
    c.box(0.5, 1.2, 0.3, MAT.grey, 0, 0.6, 0); dress.charger = c.box(0.06, 0.06, 0.04, glowMat(0x5fd38d, 1.2), 0, 1.0, 0.17); c.cyl(0.02, 1.6, MAT.black, 0.3, 0.4, 0.25, 6).rotation.x = -0.9; c.sign(['CHARGER'], 0.6, 0.16, 0, 1.35, 0.17, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#5fd38d' });
    c.plane(0.3, 0.12, glowMat(0x5fd38d, 0.4), 0, 0.85, 0.17, 0, 0); c.box(0.1, 0.06, 0.05, MAT.black, 0.3, 0.6, 0.25); c.solid(-0.25, 0.25, -0.15, 0.15, 0, 1.3);
    // the forklift bay in front of it
    var w = 2.6, d = 3.6, cz = 2.1; [[0, cz - d / 2, w, 0.08], [0, cz + d / 2, w, 0.08], [-w / 2, cz, 0.08, d], [w / 2, cz, 0.08, d]].forEach(function (ln) { c.plane(ln[2], ln[3], MAT.yellowLine, ln[0], 0.0062, ln[1], -Math.PI / 2, 0); }); c.plane(w * 0.8, 0.35, new THREE.MeshBasicMaterial({ map: textTex(['FORKLIFT'], { w: 512, h: 96, bg: '#8b8d8e', fg: '#d9a12c' }) }), 0, 0.0066, cz - d / 2 + 0.3, -Math.PI / 2, 0);
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
  // the jack's own charger by its bay: a small wall unit, one reel, one plug post
  function jackChargerBuild(c) {
    c.box(0.4, 0.5, 0.2, std({ color: 0x8b949c, roughness: 0.5, metalness: 0.4 }), 0, 1.35, -0.08); c.box(0.44, 0.03, 0.24, MAT.steelDark, 0, 1.61, -0.08);
    for (var vv = 0; vv < 4; vv++) c.box(0.26, 0.012, 0.02, MAT.black, 0, 1.5 - vv * 0.04, 0.03); c.box(0.05, 0.05, 0.02, glowMat(0x5fd38d, 1.2), 0.12, 1.22, 0.03); c.box(0.05, 0.05, 0.02, glowMat(0xf5b53d, 0.6), -0.12, 1.22, 0.03);
    c.sign(['JACK CHARGER'], 0.4, 0.08, 0, 1.72, 0.03, 0, { w: 256, h: 48, bg: '#1b232c', fg: '#5fd38d' });
    var reel = c.cyl(0.11, 0.1, MAT.black, 0, 0.8, -0.05, 16); reel.rotation.x = Math.PI / 2; c.cyl(0.04, 0.12, MAT.steelDark, 0, 0.8, -0.05, 10).rotation.x = Math.PI / 2; var cab = c.cyl(0.015, 0.8, MAT.black, 0.1, 0.4, 0.3, 6); cab.rotation.x = 1.1;
    c.box(0.16, 0.55, 0.16, MAT.steelDark, 0.25, 0.275, 0.55); c.box(0.2, 0.04, 0.2, MAT.yellow, 0.25, 0.57, 0.55); c.box(0.08, 0.07, 0.06, MAT.red, 0.25, 0.45, 0.64); c.sign(['JACK'], 0.16, 0.04, 0.25, 0.3, 0.64, 0, { w: 256, h: 64, bg: '#1b232c', fg: '#eef1f5' });
    c.solid(-0.22, 0.4, -0.2, 0.65, 0, 1.8);
    c.hit(0.6, 1.2, 0.4, 0, 1.2, 0.05, { prompt: function () { return cablePrompt('jack'); }, use: function () { cableUse('jack'); } });
  }
  function lampPostBuild(c) { c.cyl(0.08, 7.5, MAT.steelDark, 0, 3.75, 0, 8, 0.11); c.box(0.6, 0.2, 0.3, MAT.steelDark, 0, 7.65, 0); var lens = c.box(0.5, 0.04, 0.24, glowMat(0xffd9a0, 0.2), 0, 7.53, 0); yard.lampLenses.push(lens); var l = new THREE.PointLight(0xffd9a0, 0.0, 30, 2); l.position.set(0, 7.7, 0); c.add(l); yardLights.push(l); c.box(0.3, 0.2, 0.3, MAT.grey, 0, 0.1, 0); c.solid(-0.15, 0.15, -0.15, 0.15, -2, 2); }
  function carBuild(k) { return function (c) { c.add(carMesh(typeof k === "number" ? CAR_COLS[k % CAR_COLS.length] : k)); c.solid(-2.2, 2.2, -1.0, 1.0, -2, 1.5); }; }
  function paintedBuild(c) { c.sign(['DEPOT CO.'], 9, 1.6, 0, 4.4, 0.01, 0, { w: 1024, h: 192, bg: '#1b232c', fg: '#f5b53d' }); c.sign(['RECEIVE · STORE · PICK · SHIP'], 7, 0.5, 0, 3.3, 0.01, 0, { w: 1024, h: 96, bg: '#1b232c', fg: '#a0acb8' }); }
  function aisleSignBuild(text) { return function (c) { c.sign([text], 2.2, 0.5, 0, 5.4, 0, 0, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.sign([text], 2.2, 0.5, 0, 5.4, 0, Math.PI, { w: 512, h: 128, bg: '#2c5f9e', fg: '#fff' }); c.cyl(0.006, 1.3, MAT.steelDark, -0.9, 6.3, 0, 4); c.cyl(0.006, 1.3, MAT.steelDark, 0.9, 6.3, 0, 4); }; }

  // ── Default layout ────────────────────────────────────────────────
  for (var rr = 0; rr < 4; rr++) (function (r) { defProp('rack' + r, { label: 'rack row ' + 'ABCD'[r], cat: 'hall', x: 0, z: RACK.rows[r], rot: 0, build: rackBuild(r), when: function () { return r < S.up.rows; } }); })(rr);
  defProp('timeclock', { label: 'time clock', cat: 'wall', wall: true, x: -19.74, z: 10.2, rot: 1, build: timeclockBuild });
  defProp('cabinet', { label: 'control cabinet', cat: 'wall', wall: true, x: 12.42, z: 12.6, rot: 3, build: cabinetBuild });
  defProp('consoleIn0', { label: 'dock console IN 1', cat: 'wall', wall: true, x: -19.7, z: -5.5, rot: 1, build: consoleBuild(0) });
  defProp('consoleIn1', { label: 'dock console IN 2', cat: 'wall', wall: true, x: -19.7, z: 2.5, rot: 1, build: consoleBuild(1) });
  defProp('console0', { label: 'dock console OUT 1', cat: 'wall', wall: true, x: 19.7, z: -5.5, rot: 3, build: consoleBuild(2) });
  defProp('console1', { label: 'dock console OUT 2', cat: 'wall', wall: true, x: 19.7, z: 2.5, rot: 3, build: consoleBuild(3) });
  defProp('breaker', { label: 'breaker panel', cat: 'wall', wall: true, x: 19.79, z: 9.6, rot: 3, build: breakerBuild });
  defProp('board', { label: 'order board', cat: 'hall', x: 16.2, z: 7.4, rot: 2, build: boardBuild });
  defProp('charger', { label: 'forklift charging point', cat: 'wall', wall: true, x: 0, z: 13.83, rot: 2, build: chargerBuild });
  defProp('jackCharger', { label: 'jack charger', cat: 'wall', wall: true, x: -19.83, z: 4.0, rot: 1, build: jackChargerBuild });
  defProp('painted', { label: 'painted name', cat: 'wall', wall: true, x: 0, z: -13.83, rot: 0, build: paintedBuild });
  [['aisleAB', -4, 'AISLE  A · B'], ['aisleBC', 0, 'AISLE  B · C'], ['aisleCD', 4, 'AISLE  C · D']].forEach(function (a) { defProp(a[0], { label: 'aisle sign', cat: 'hall', x: 0, z: a[1], rot: 0, build: aisleSignBuild(a[2]) }); });
  [[-30, -12], [-30, 10], [30, -12], [30, 10]].forEach(function (p, i) { defProp('lamp' + i, { label: 'lamp post', cat: 'yard', yard: true, x: p[0], z: p[1], rot: 0, build: lampPostBuild }); });
  [0, 1, 3, 4].forEach(function (k, i) { defProp('car' + i, { label: 'parked car', cat: 'yard', yard: true, x: -17.65 + k * 2.7, z: 21.5, rot: 1, build: carBuild(k) }); });
  var treeN = 0; for (var tx = -56; tx <= 56; tx += 14) { defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: tx, z: -56, rot: 0, build: treeBuild }); defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: tx + 7, z: 56, rot: 0, build: treeBuild }); }
  defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: -30, z: 24, rot: 0, build: treeBuild }); defProp('tree' + (treeN++), { label: 'tree', cat: 'yard', yard: true, x: 30, z: 26, rot: 0, build: treeBuild });
  defProp('xLampPost', { extra: true, label: 'lamp post', ico: '💡', cat: 'yard', yard: true, price: 350, desc: 'Lights the yard at night.', build: lampPostBuild });
  defProp('xCar', { extra: true, label: 'parked car', ico: '🚗', cat: 'yard', yard: true, price: 0, desc: 'Somebody is in.', build: function (c) { carBuild(pick(CAR_COLS))(c); } });
  defProp('xAisleSign', { extra: true, label: 'aisle sign', ico: '🪧', cat: 'hall', price: 40, desc: 'Hangs from the roof.', build: aisleSignBuild('AISLE') });

  // The entrance lobby (x -20 to -15.5, z 8.5 to 14): the staff door on the west wall at z 12, the lobby door east at z 10.
  // The time clock, lockers and hooks live here. The break room is the north-west corner (x -20 to -13, z -14 to -10.2), above IN 1.
  defProp('lockers', { label: 'lockers', cat: 'room', x: -18.4, z: 13.55, rot: 0, build: lockerBuild });
  defProp('hooks', { label: 'coat hooks', cat: 'room', wall: true, x: -16.6, z: 13.83, rot: 2, build: hooksBuild });
  defProp('notice', { label: 'notice board', cat: 'wall', wall: true, x: -17.5, z: 8.59, rot: 0, build: noticeBuild });
  defProp('firstAid', { label: 'first-aid box', cat: 'wall', wall: true, x: -15.6, z: 13.0, rot: 3, build: firstAidBuild });
  defProp('extBreak', { label: 'fire extinguisher', cat: 'wall', wall: true, x: -19.83, z: 13.2, rot: 1, build: extinguisherBuild });
  defProp('posterRota', { label: 'rota poster', cat: 'wall', wall: true, x: -19.83, z: 9.2, rot: 1, build: posterBuild('rota', 0.6, 0.9) });
  defProp('posterSmoke', { label: 'no-smoking poster', cat: 'wall', wall: true, x: -15.6, z: 11.0, rot: 3, build: posterBuild('nosmoking', 0.6, 0.9) });
  defProp('lobbySeat', { label: 'bench seat', cat: 'room', x: -17.8, z: 9.1, rot: 0, build: benchSeatBuild });
  defProp('cot', { label: 'cot', cat: 'room', x: -15.0, z: -13.45, rot: 0, build: cotBuild });
  defProp('vending', { label: 'vending machine', cat: 'room', x: -13.6, z: -11.4, rot: 1, build: vendingBuild });
  defProp('coffee', { label: 'coffee counter', cat: 'room', x: -19.5, z: -12.2, rot: 1, build: coffeeBuild });
  defProp('fridge', { label: 'fridge', cat: 'room', x: -19.5, z: -13.5, rot: 1, build: fridgeBuild });
  defProp('cooler', { label: 'water cooler', cat: 'room', x: -19.6, z: -10.7, rot: 1, build: coolerBuild });
  defProp('table', { label: 'table', cat: 'room', x: -16.6, z: -11.6, rot: 0, build: tableBuild });
  defProp('chair1', { label: 'chair', cat: 'room', x: -17.35, z: -11.6, rot: 3, build: chairBuild });
  defProp('chair2', { label: 'chair', cat: 'room', x: -15.85, z: -11.6, rot: 1, build: chairBuild });
  defProp('chair3', { label: 'chair', cat: 'room', x: -16.6, z: -12.35, rot: 0, build: chairBuild });
  defProp('calendar', { label: 'calendar', cat: 'wall', wall: true, x: -17.6, z: -13.83, rot: 0, build: calendarBuild });
  defProp('clockBreak', { label: 'wall clock', cat: 'wall', wall: true, x: -18.4, z: -13.83, rot: 0, build: clockBuild(0.28) });
  defProp('posterHands', { label: 'wash-hands poster', cat: 'wall', wall: true, x: -16.5, z: -13.83, rot: 0, build: posterBuild('hands', 0.5, 0.75) });
  defProp('plantBreak', { label: 'potted plant', cat: 'room', x: -13.5, z: -13.5, rot: 0, build: plantBuild });
  // the office
  defProp('desk', { label: 'office desk', cat: 'room', x: 17.5, z: 12.4, rot: 0, build: deskBuild });
  defProp('officeChair', { label: 'office chair', cat: 'room', x: 17.5, z: 11.6, rot: 0, build: officeChairBuild });
  defProp('cabinets', { label: 'filing cabinets', cat: 'room', x: 19.3, z: 13.5, rot: 0, build: cabinetsBuild });
  defProp('plant', { label: 'potted plant', cat: 'room', x: 13.2, z: 13.4, rot: 0, build: plantBuild });
  defProp('coatStand', { label: 'coat stand', cat: 'room', x: 13.0, z: 9.0, rot: 0, build: coatStandBuild });
  defProp('kpi', { label: 'whiteboard', cat: 'wall', wall: true, x: 19.83, z: 11.5, rot: 3, build: kpiBuild });
  defProp('certificate', { label: 'certificate', cat: 'wall', wall: true, x: 19.83, z: 13.3, rot: 3, build: certificateBuild });
  defProp('posterSafety', { label: 'safety poster', cat: 'wall', wall: true, x: 16.5, z: 13.83, rot: 2, build: posterBuild('safety', 0.6, 0.9) });
  // the hall
  defProp('bench', { label: 'packing bench', cat: 'hall', x: 16.6, z: 5.2, rot: 0, build: benchBuild });
  defProp('binDamaged', { label: 'damaged-goods bin', cat: 'hall', x: 14.3, z: 2.6, rot: 0, build: binBuild });
  defProp('broom', { label: 'broom', cat: 'hall', x: 14.7, z: 3.3, rot: 0, build: broomBuild });
  defProp('wetFloor', { label: 'wet-floor sign', cat: 'hall', x: 13.4, z: 7.6, rot: 1, build: wetFloorBuild });
  defProp('empties', { label: 'stack of empty pallets', cat: 'hall', x: -11.2, z: -12.6, rot: 0, build: emptiesBuild });
  defProp('baler', { label: 'baler', cat: 'hall', x: -7.5, z: -13.2, rot: 0, build: balerBuild });
  defProp('wrapper', { label: 'stretch wrapper', cat: 'hall', x: 8, z: -12.3, rot: 0, build: wrapperBuild });
  defProp('hose', { label: 'hose reel', cat: 'wall', wall: true, x: 0, z: -13.83, rot: 0, build: hoseBuild });
  defProp('extNW', { label: 'fire extinguisher', cat: 'wall', wall: true, x: -19.83, z: -12, rot: 1, build: extinguisherBuild });
  defProp('extNE', { label: 'fire extinguisher', cat: 'wall', wall: true, x: 19.83, z: -12, rot: 3, build: extinguisherBuild });
  defProp('extBench', { label: 'fire extinguisher', cat: 'wall', wall: true, x: 12.42, z: 6.5, rot: 3, build: extinguisherBuild });
  defProp('clockHall', { label: 'hall clock', cat: 'wall', wall: true, x: 0, z: -13.7, rot: 0, build: function (c) { var f = clockBuild(0.5); f(c); c.group.children[c.group.children.length - 1].position.y = 5.8 - 2.7 + 2.7; } });
  defProp('posterLift', { label: 'lifting poster', cat: 'wall', wall: true, x: -19.83, z: -4, rot: 1, build: posterBuild('lifting', 0.7, 1.05) });
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
