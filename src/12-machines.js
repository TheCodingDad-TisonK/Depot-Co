//@ the machines: a registry with inlets, outlets and status lamps, the conveyor belts that join them, the pack line, the moulding line, the hopper and the palletiser
  // ── Machines ──────────────────────────────────────────────────────
  // Every machine is a prop with an inlet point and an outlet point in its own frame, a status (off, idle, run, jam) and a lamp
  // stack. Belts are props with a path; an item that reaches the end of a belt goes into whatever has an inlet within reach of
  // that end, another belt or a machine. So the player can move a machine in build mode and the line still works if the pieces
  // still touch, and stops with a pile-up at the gap if they do not.
  var MACH = {}, BELTS = {}, BELT_PLANES = [];
  var BELT_SPEED = 0.5, BELT_GAP = 0.45, BELT_Y = 0.75, REACH = 1.3;
  // every machine has a speed dial on its screen: 50 to 200 percent, kept per machine in S.speed
  var SPEED_STEPS = [0.5, 0.75, 1, 1.5, 2];
  function speedOf(key) { var v = S.speed && S.speed[key]; return typeof v === 'number' ? v : 1; }
  function speedSteps() { return S.up.plantTune ? SPEED_STEPS.concat([2.5, 3]) : SPEED_STEPS; }   // the plant tune-up opens 250 and 300%
  function speedCycle(key) { if (!S.speed) S.speed = {}; var steps = speedSteps(), i = steps.indexOf(speedOf(key)); S.speed[key] = steps[(i + 1) % steps.length]; sfx('click'); screenDirtyAll(); }
  function speedButton(sc, x, y, w, key, label) { var pct = Math.round(speedOf(key) * 100) + '%'; scButton(sc, x, y, w, 30, w < 80 ? pct : (label || 'SPD') + ' ' + pct, true, function () { speedCycle(key); }, '#78bdf5'); }
  function beltSpeedKey(b) { return b.speedKey || b.prop; }
  function defMachine(id, m) { m.id = id; m.lamps = null; MACH[id] = m; }
  var PROP_SPEED = {};   // prop id -> the dial and the rate its belt planes scroll with (a curve's segments share the prop's)
  function defBelt(id, b) { b.id = id; BELTS[id] = b; PROP_SPEED[b.prop] = { key: b.speedKey || b.prop, rate: b.rate || 1 }; }
  function propWorld(prop, lx, lz) { var P = propPlacement(prop), a = P.rot * Math.PI / 2; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a), a: a }; }
  function beltLen(b) { var p = b.path, n = 0; for (var i = 1; i < p.length; i++) n += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return n; }
  function beltPoint(b, d) {   // the world point d metres along the belt
    var p = b.path, rem = d; for (var i = 1; i < p.length; i++) { var seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (rem <= seg || i === p.length - 1) { var t = seg > 0 ? clamp(rem / seg, 0, 1) : 0; var w = propWorld(b.prop, lerp(p[i - 1][0], p[i][0], t), lerp(p[i - 1][1], p[i][1], t)); w.ry = w.a + Math.atan2(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); w.y = BELT_Y + lerp(p[i - 1][2] || 0, p[i][2] || 0, t); return w; } rem -= seg; }
    var w0 = propWorld(b.prop, p[0][0], p[0][1]); w0.y = BELT_Y + (p[0][2] || 0); w0.ry = w0.a + (p.length > 1 ? Math.atan2(p[1][0] - p[0][0], p[1][1] - p[0][1]) : 0); return w0;
  }
  function beltItems(id) { if (!S.belts) S.belts = {}; if (!S.belts[id]) S.belts[id] = []; return S.belts[id]; }
  function beltGapOf(it) { return it && it.kind === 'pallet' ? 1.3 : BELT_GAP; }   // a pallet is a metre and a bit long
  function beltStartFree(id) { var it = beltItems(id); return !it.length || it[it.length - 1].d > beltGapOf(it[it.length - 1]); }
  function beltPush(id, item) { var b = BELTS[id]; if (b && edit.grabbed === b.prop) return false; if (!beltStartFree(id)) return false; item.d = 0; beltItems(id).push(item); return true; }   // a piece being carried in build mode takes nothing
  // Where a machine takes items in and lets them out, in the world: its inlet points (one or several, in its own frame), or a
  // fixed place for a machine that is not a prop (a dock door). A machine whose prop is not built has no points.
  function machinePoints(mc, which) {
    var pts = [], list = which === 'in' ? (mc.inlets || (mc.inlet ? [mc.inlet] : [])) : (mc.outlets || (mc.outlet ? [mc.outlet] : []));
    if (mc.atFn && which === 'in') { var a = mc.atFn(); if (a) pts.push({ x: a[0], z: a[1] }); }
    if (mc.prop) { if (!PROPS[mc.prop] || !propInst[mc.prop]) return pts; list.forEach(function (p) { pts.push(propWorld(mc.prop, p[0], p[1])); }); }
    return pts;
  }
  // What sits at a belt's far end: a machine whose inlet is within reach, else another belt whose start is, else a rack slot the
  // end stops at (the box goes straight onto the rack). Worked out once and kept until a prop is built or removed, because a
  // belt end only moves when build mode moves something.
  var sinkCache = {}; function beltsChanged() { sinkCache = {}; }
  function beltSink(b) {
    if (sinkCache[b.id] !== undefined) return sinkCache[b.id];
    if (b.noSink) return (sinkCache[b.id] = null);
    var end = beltPoint(b, beltLen(b)), out = null, R2 = REACH * REACH;
    for (var mk in MACH) { var mc = MACH[mk]; if (!mc.accept) continue; var pts = machinePoints(mc, 'in'); for (var i = 0; i < pts.length; i++) if (dist2(end.x, end.z, pts[i].x, pts[i].z) < R2) { out = { machine: mc }; break; } if (out) break; }
    if (!out) for (var k in BELTS) { if (k === b.id) continue; var ob = BELTS[k]; if (!propInst[ob.prop]) continue; var s = beltPoint(ob, 0); if (dist2(end.x, end.z, s.x, s.z) < R2 && Math.abs(end.y - s.y) < 0.7) { out = { belt: ob }; break; } }
    if (!out) { var best = null, bd = R2; for (var r = 0; r < S.up.rows; r++) for (var bb = 0; bb < RACK.bays; bb++) for (var l = 0; l <= 1; l++) { var sp = rackSlotPos(r, bb, l), d = dist2(end.x, end.z, sp.x, sp.z); if (d < bd && Math.abs(end.y - (sp.y + 0.6)) < 1.6) { bd = d; best = slotKey(r, bb, l); } } if (best) out = { slot: best }; }
    sinkCache[b.id] = out || null; return out;
  }
  // what feeds a belt at its start: a belt whose end sinks into it, a machine outlet, the parcel shelf, or an inbound dock door
  function beltFeeder(b) {
    var s = beltPoint(b, 0), R2 = REACH * REACH;
    for (var k in BELTS) { if (k === b.id) continue; var ob = BELTS[k]; if (!propInst[ob.prop]) continue; var sk = beltSink(ob); if (sk && sk.belt === b) return { belt: ob }; }
    for (var mk in MACH) { var mc = MACH[mk]; var pts = machinePoints(mc, 'out'); for (var i = 0; i < pts.length; i++) if (dist2(s.x, s.z, pts[i].x, pts[i].z) < R2) return { machine: mc }; }
    if (propInst.packline) { var sh = propWorld('packline', 0, 7.0); if (dist2(s.x, s.z, sh.x, sh.z) < R2) return { shelf: true }; }
    for (var i2 = 0; i2 < DOOR_MAP.length; i2++) { if (DOOR_MAP[i2].dir !== 'in' || !doors[i2]) continue; var at = doorInside(i2); if (dist2(s.x, s.z, at[0], at[1]) < R2 * 1.5) return { door: i2 }; }
    return null;
  }
  function beltLabel(b) { return propLabel(b.prop); }
  function sinkLabel(sk) { if (!sk) return null; if (sk.belt) return 'the ' + beltLabel(sk.belt); if (sk.slot) return slotName(sk.slot); var mc = sk.machine; return mc.door !== undefined ? 'dock door ' + dockLabel(mc.door) : 'the ' + propLabel(mc.prop); }
  function feederLabel(fd) { if (!fd) return null; if (fd.belt) return 'the ' + beltLabel(fd.belt); if (fd.shelf) return 'the parcel shelf'; if (fd.door !== undefined) return 'dock door ' + dockLabel(fd.door); return 'the ' + propLabel(fd.machine.prop); }
  // ── The dock doors on the registry ──
  // An outbound door with a truck in takes parcels off a belt that ends at it. An inbound door with a signed truck in feeds the
  // boxes off its pallets onto a belt that starts at it, one every second or so. So a run of pieces from a rack bay to OUT 1 is a
  // loading line and a run from IN 2 to a rack bay is an unloading line, with nothing bought but the pieces.
  function doorInside(i) { var d = doors[i]; return d ? [d.side * (HALL.x - 1.2), d.z] : null; }
  for (var dmi = 0; dmi < DOOR_MAP.length; dmi++) (function (i) {
    defMachine('door' + i, { door: i, atFn: function () { return doorInside(i); }, accept: DOOR_MAP[i].dir !== 'out' ? null : function (it) {
      if (it.kind !== 'parcel' || !powered()) return false;
      var t = truckAtDoor(i); if (!t || !S.doors[i] || !doorPassable(i)) return false;
      var o = orderById(it.order); if (!o) return true;
      t.parcels.push(o.id); o.state = 'loaded'; sfx('crate'); addXp(XP.ship); rebuildBoardSoon(); S.stats.autoLoaded = (S.stats.autoLoaded || 0) + 1; return true;
    } });
  })(dmi);
  var dockFeedT = {};
  function tickDockFeed(dt) {
    if (!powered()) return;
    for (var i = 0; i < DOOR_MAP.length; i++) {
      if (DOOR_MAP[i].dir !== 'in' || !doors[i]) continue; var t = truckAtDoor(i); if (!t || !t.signed || !S.doors[i] || !doorPassable(i)) continue;
      var at = doorInside(i), fed = null; if (!at) continue;
      for (var k in BELTS) { var b = BELTS[k]; if (!propInst[b.prop] || edit.grabbed === b.prop) continue; var s = beltPoint(b, 0); if (dist2(s.x, s.z, at[0], at[1]) < REACH * REACH * 1.5) { fed = b; break; } }
      if (!fed) continue;
      dockFeedT[i] = (dockFeedT[i] || 0) + dt; if (dockFeedT[i] < 1.2 / speedOf(beltSpeedKey(fed)) || !beltStartFree(fed.id)) continue;
      var p = null; for (var q = 0; q < S.pallets.length; q++) { var pp = S.pallets[q]; if (pp.place === 'truck' && pp.truck === t.id && pp.n > 0 && !(SKU[pp.sku] && SKU[pp.sku].raw)) { p = pp; break; } }
      if (!p) continue;
      if (!beltPush(fed.id, { kind: 'box', sku: p.sku })) continue;   // the box leaves the pallet only once it is on the belt
      if (!p.received) { p.received = true; t.unloaded++; S.stats.received++; pay(ECON.receiveFee, 'Receiving fee, pallet of ' + skuName(p.sku)); addXp(XP.pallet); feedPush('Received a pallet of ' + skuName(p.sku) + ' off the belt · +' + money(ECON.receiveFee), 'good'); }   // the fee is earned when the first box comes off; the pallet stays aboard until it is empty
      p.n--; p.wrapped = false; dockFeedT[i] = 0; S.stats.picked++;
      if (p.n <= 0) { p.n = 0; }
    }
  }
  function machineOutBelt(m) { if (!m.outlet) return null; var w = propWorld(m.prop, m.outlet[0], m.outlet[1]); for (var k in BELTS) { if (!propInst[BELTS[k].prop]) continue; var s = beltPoint(BELTS[k], 0); if (dist2(w.x, w.z, s.x, s.z) < REACH * REACH) return BELTS[k]; } return null; }
  function powered() { return !S.events.power; }
  function tickBelts(dt) {
    for (var k in BELTS) {
      var b = BELTS[k]; if (!propInst[b.prop] || edit.grabbed === b.prop) continue; var items = beltItems(k), L = beltLen(b), sink = beltSink(b);   // a carried piece stands still
      items.sort(function (p, q) { return q.d - p.d; });   // front of the belt first
      var ahead = Infinity;
      for (var i = 0; i < items.length; i++) {
        var it = items[i], max = Math.min(ahead - beltGapOf(it), L);
        if (powered()) it.d = Math.min(it.d + BELT_SPEED * (b.rate || 1) * speedOf(beltSpeedKey(b)) * dt, max);   // rate: the deck belts run three times a floor belt
        if (it.d >= L - 0.001 && sink) {
          var taken = false;
          if (sink.belt) taken = beltPush(sink.belt.id, it); else if (sink.machine && sink.machine.accept) taken = sink.machine.accept(it); else if (sink.slot && it.kind === 'box' && slotSpace(sink.slot, it.sku) > 0) { slotAdd(sink.slot, it.sku, 1); S.stats.putaway++; taken = true; }
          if (taken) { items.splice(i, 1); i--; continue; }
        }
        ahead = it.d;
      }
    }
    BELT_PLANES.forEach(function (pl) { if (!powered()) return; var pk = pl.userData.speedKey || '', ps = PROP_SPEED[pk]; pl.material.map.offset.y += BELT_SPEED * (ps ? ps.rate * speedOf(ps.key) : speedOf(/^pick/.test(pk) ? 'pickBelt' : pk)) * dt / 0.5; });   // stripes run with the items, towards local +z
  }
  // belt items are drawn with the instanced boxes and parcels, inside syncInstances
  function drawBeltItems() {
    for (var k in BELTS) { var b = BELTS[k]; if (!propInst[b.prop]) continue; beltItems(k).forEach(function (it) { var w = beltPoint(b, it.d); var src = { kind: 'belt', belt: k, item: it }; if (it.kind === 'parcel') putParcel(w.x, w.y + 0.23, w.z, w.ry, src, it.form); else if (it.kind === 'pallet') drawPalletWithBoxes(it.sku, it.n, w.x, w.y + 0.02, w.z, w.ry, src); else putBox(it.sku, w.x, w.y + BOX.h / 2, w.z, w.ry, src); }); }
    if (S.pal && S.pal.n > 0 && propInst.palletiser) { var cw = propWorld('palletiser', 0, 0); drawPalletWithBoxes(S.pal.sku, S.pal.n, cw.x, 0.42, cw.z, cw.a, { kind: 'palletiser' }); }
  }
  // a box or a parcel riding a belt can be lifted off by hand
  function beltItemPrompt(src) { if (S.hand) return null; var it = src.item; if (it.kind === 'pallet') return null; if (it.kind === 'box') return 'Take the box of ' + skuName(it.sku) + ' off the belt'; if (it.kind === 'parcel' && it.order) return 'Take the parcel off the belt'; if (it.kind === 'parcel' && it.ret) { var rr = returnById(it.ret); return 'Take return #' + (rr ? rr.num : '?') + ' off the belt'; } return null; }
  function beltItemUse(src) { if (S.hand) return; var arr = beltItems(src.belt), i = arr.indexOf(src.item); if (i < 0) return; var it = arr[i]; if (it.kind === 'box') handSet({ kind: 'box', sku: it.sku }); else if (it.kind === 'parcel' && it.order) handSet({ kind: 'parcel', order: it.order }); else if (it.kind === 'parcel' && it.ret) handSet({ kind: 'return', id: it.ret }); else return; arr.splice(i, 1); sfx('pickup'); }
  function lampSet(m, status) { if (!m.lamps) return; m.lamps.g.visible = status === 'run'; m.lamps.a.visible = status === 'idle'; m.lamps.r.visible = status === 'jam' || status === 'off'; }

  // ── The pack line: the bench feeds boxes onto the infeed, the case taper closes the order into one parcel, the outfeed drops it on the shelf
  defBelt('packIn', { prop: 'packline', path: [[0, 0], [0, 2.0]] });
  defBelt('packOut', { prop: 'packline', path: [[0, 3.8], [0, 5.8]], noSink: true });   // its parcels drop onto the shelf, never onto a belt laid at the shelf
  defMachine('taper', { prop: 'packline', inlet: [0, 2.0], outlet: [0, 3.8],
    accept: function (it) { var j = S.pack.job; if (!j || it.kind !== 'box' || !powered() || S.pack.jam) return false; j.inMach++; sfx('click'); return true; } });
  function packStatus() { if (!powered()) return 'off'; if (S.pack.jam) return 'jam'; return S.pack.job ? 'run' : 'idle'; }
  function packOrder(o) {
    if (o.state !== 'open') return false;
    var n = orderNeed(o); if (n.have < Math.ceil(n.tot / 2)) return false;
    var boxes = []; o.lines.forEach(function (l) { l.packed = benchTake(l.sku, l.qty); for (var i = 0; i < l.packed; i++) boxes.push(l.sku); });
    o.short = n.have < n.tot; o.state = 'packing'; S.pack.queue.push({ order: o.id, boxes: boxes, fed: 0, inMach: 0, t: 0 });
    sfx('click'); rebuildBoardSoon(); logEvent('Order #' + o.num + ' released to the pack line' + (o.short ? ' (short)' : ''));
    return true;
  }
  function packFinish(oid) {
    var o = orderById(oid); if (!o) return;
    o.state = 'packed'; o.packedAt = nowAbs(); S.bench.parcels.push(o.id); S.pack.made++;
    S.stats.packed++; addXp(XP.pack); sfx('tape'); addWaste(1); rebuildBoardSoon(); introStep('pack'); logEvent('Packed order #' + o.num + (o.short ? ' (short)' : ''), 'good');
  }
  function tickPack(dt) {
    if (!S.pack) S.pack = { queue: [], job: null, jam: false, made: 0, feedT: 0, out: null };
    var P = S.pack;
    // the automation suite: with the line idle, any order the bench can complete is started by itself every couple of seconds
    if (S.up.plantAuto && P.auto !== false && powered() && !P.job && !P.queue.length && !P.jam && !P.out) { P.autoT = (P.autoT || 0) + dt; if (P.autoT > 2) { P.autoT = 0; var ao = openOrders().filter(canPack).sort(function (a, b) { return (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b.due; })[0]; if (ao && packOrder(ao)) toast('Pack line started #' + ao.num + ' by itself', ''); } }
    if (!P.job && P.queue.length) P.job = P.queue.shift();
    var j = P.job;
    if (j && !orderById(j.order)) { P.job = null; return; }
    if (powered() && !P.jam && j) {
      // feed the next box onto the infeed every 1.3 s
      P.feedT += dt; if (j.fed < j.boxes.length && P.feedT >= 1.3 && beltPush('packIn', { kind: 'box', sku: j.boxes[j.fed] })) { j.fed++; P.feedT = 0; }
      // every box in: the taper runs 3 s, then a parcel comes out on the outfeed
      if (j.inMach >= j.boxes.length) { j.t += dt * speedOf('packline'); if (j.t >= 3 && !P.out) { if (Math.random() < 0.05 * speedOf('packline') * (S.up.plantAuto ? 0 : S.up.plantTune ? 0.5 : 1)) { P.jam = true; toast('The pack line has jammed. Press E on it to clear it.', 'bad'); sfx('bad'); return; } P.out = j.order; sfx('hydraulic'); P.job = null; } }
    }
    if (P.out && powered() && !P.jam && beltPush('packOut', { kind: 'parcel', order: P.out })) P.out = null;
    // the outfeed end: the parcel drops onto the shelf when there is room
    var outs = beltItems('packOut'), L = beltLen(BELTS.packOut);
    for (var i = outs.length - 1; i >= 0; i--) { if (outs[i].d >= L - 0.001 && S.bench.parcels.length < 12) { packFinish(outs[i].order); outs.splice(i, 1); } }
    lampSet(MACH.taper, packStatus());
  }
  function packPrompt() { if (S.pack.jam) return 'Clear the jam on the pack line'; if (!powered()) return 'Pack line · no power'; var j = S.pack.job; return 'Pack line · ' + (j ? 'packing order #' + (orderById(j.order) || { num: '?' }).num + ' · ' + j.inMach + '/' + j.boxes.length : S.pack.queue.length ? S.pack.queue.length + ' waiting' : 'idle') + ' · ' + S.pack.made + ' parcels made'; }
  function packUse() { if (S.pack.jam) { S.pack.jam = false; sfx('hydraulic'); toast('Jam cleared', 'good'); addXp(2); screenDirtyAll(); return; } openPanel('bench'); }
  function packScreenDraw(c, sc) {
    var st = packStatus(); scBg(c, sc.w, sc.h, st === 'jam' ? 'rgba(255,107,94,0.25)' : 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'CASE TAPER', st.toUpperCase());
    var j = S.pack.job, o = j ? orderById(j.order) : null;
    scText(c, 16, 70, o ? 'Order #' + o.num + ' · ' + clientName(o.client) : 'No job', '#eef1f5', 16);
    scText(c, 16, 94, j ? 'Boxes in: ' + j.inMach + ' / ' + j.boxes.length + (j.inMach >= j.boxes.length ? ' · taping ' + Math.max(0, 3 - j.t).toFixed(1) + ' s' : '') : S.pack.queue.length + ' in the queue', '#a0acb8', 13);
    scText(c, 16, 118, 'Parcels made: ' + S.pack.made + ' · shelf ' + S.bench.parcels.length + '/12', '#a0acb8', 13);
    if (S.pack.jam) scButton(sc, 16, 140, 150, 34, 'CLEAR JAM', true, function () { packUse(); }, '#ff6b5e');
    speedButton(sc, 176, 142, 108, 'packline'); if (speedOf('packline') > 1 && !S.up.plantAuto) scText(c, 176, 188, 'fast: jams more', '#ff6b5e', 10);
  }

  // ── The moulding line: raw granulate from the hopper becomes own-brand boxes on the outfeed
  var FACTORY_RATE = 8;   // seconds per box
  function ownSkus() { return SKUS.filter(function (s) { return s.own; }); }
  defMachine('moulder', { prop: 'moulder', outlet: [0, 2.4] });
  defBelt('moulderOut', { prop: 'moulder', path: [[0, 2.4], [0, 4.4]] });
  defBelt('beltMain', { prop: 'beltMain', path: [[0, 0], [0, 10.4]] });   // from the wing through the north wall to the palletiser
  function factoryStatus() { var F = S.factory; if (!powered()) return 'off'; if (F.jam) return 'jam'; return F.on && F.raw > 0 ? 'run' : 'idle'; }
  function tickFactory(dt) {
    var F = S.factory; if (!F) return;
    if (!propInst.moulder) return;
    if (powered() && F.on && !F.jam && F.raw > 0) {
      F.t += dt * speedOf('moulder');
      if (F.t >= FACTORY_RATE) { if (beltPush('moulderOut', { kind: 'box', sku: F.product })) { F.t = 0; F.raw--; F.made++; S.stats.made = (S.stats.made || 0) + 1; if (S.seenSkus.indexOf(F.product) < 0) S.seenSkus.push(F.product); if (Math.random() < 0.02) { F.jam = true; toast('The moulding line has jammed. Press E on it to clear it.', 'bad'); sfx('bad'); } } }
      if (F.raw <= 0) { F.on = false; toast('The hopper is empty: the moulding line stopped.', 'bad'); screenDirtyAll(); }
    }
    if (MACH.moulder.anim) { var a = MACH.moulder.anim, run = factoryStatus() === 'run'; var open = run ? 0.5 + 0.5 * Math.cos(F.t / FACTORY_RATE * Math.PI * 2) : 1; a.ram.position.z = 1.0 + 0.45 * open; a.wheel.rotation.x += (run ? 9 : 0) * dt; a.spin.rotation.y += (run ? 6 : 0) * dt; }
    lampSet(MACH.moulder, factoryStatus());
  }
  function moulderPrompt() { var F = S.factory; if (F.jam) return 'Clear the jam on the moulding line'; return 'Moulding line · ' + (F.on ? 'running' : 'stopped') + ' · ' + skuName(F.product) + ' · hopper ' + F.raw + ' · made ' + F.made; }
  function moulderUse() { var F = S.factory; if (F.jam) { F.jam = false; sfx('hydraulic'); toast('Jam cleared', 'good'); addXp(2); screenDirtyAll(); return; } if (!powered()) { toast('No power.', 'bad'); return; } F.on = !F.on; sfx('click'); if (F.on && F.raw <= 0) { F.on = false; toast('The hopper is empty. Tip a pallet of raw granulate in first.', 'bad'); } screenDirtyAll(); }
  function moulderScreenDraw(c, sc) {
    var F = S.factory, st = factoryStatus(); scBg(c, sc.w, sc.h, st === 'jam' ? 'rgba(255,107,94,0.25)' : 'rgba(120,189,245,0.18)'); scHead(c, sc.w, 'MOULDING LINE', st.toUpperCase());
    scText(c, 16, 66, 'Hopper ' + F.raw + ' / ' + HOPPER_CAP + ' units' + (F.raw ? ' · a unit a box' : ' · EMPTY'), F.raw ? '#eef1f5' : '#ff6b5e', 14);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, 76, sc.w - 32, 10); c.fillStyle = F.raw > 40 ? '#5fd38d' : '#f5b53d'; c.fillRect(16, 76, (sc.w - 32) * clamp(F.raw / HOPPER_CAP, 0, 1), 10);
    scText(c, 16, 108, 'Product', '#6b7784', 11);
    ownSkus().forEach(function (s, i) { scButton(sc, 16 + i * 124, 116, 118, 30, s.name.replace('Depot Co. ', ''), F.product === s.id, function () { F.product = s.id; sfx('click'); }, '#78bdf5'); });
    scButton(sc, 16, 160, 110, 34, F.on ? 'STOP' : 'START', F.on, function () { moulderUse(); }, F.on ? '#ff6b5e' : '#5fd38d');
    if (F.jam) scButton(sc, 136, 160, 120, 34, 'CLEAR JAM', true, function () { moulderUse(); }, '#ff6b5e');
    speedButton(sc, 270, 162, 110, 'moulder');
    scText(c, 16, 220, 'Made ' + F.made + ' · ' + (FACTORY_RATE / speedOf('moulder')).toFixed(0) + ' s a box · one unit of granulate each · the dial also drives its belt', '#a0acb8', 12);
    scText(c, 16, 240, 'Boxes go down the belt to the palletiser in the hall.', '#6b7784', 11);
  }

  // ── The hopper: a pallet of raw granulate on the jack or the forks tips into it
  var RAW_PER_SACK = 5, HOPPER_CAP = 400;
  defMachine('hopper', { prop: 'hopper' });
  function rawPalletInHand() { var p = isJack(player.tool) ? jackPallet() : driving ? forkPallet() : null; return p && p.sku === 'raw' ? p : null; }
  function hopperPrompt() { var p = rawPalletInHand(); if (p) return S.factory.raw + p.n * RAW_PER_SACK > HOPPER_CAP ? 'No room in the hopper for this pallet (' + (HOPPER_CAP - S.factory.raw) + ' units free)' : 'Tip the granulate into the hopper (+' + p.n * RAW_PER_SACK + ')'; return 'Raw hopper · ' + S.factory.raw + ' / ' + HOPPER_CAP + ' units' + (isJack(player.tool) || driving ? ' · bring a pallet of raw granulate' : ''); }
  function hopperUse() {
    var p = rawPalletInHand(); if (!p) { sfx('bad'); return; } if (S.factory.raw + p.n * RAW_PER_SACK > HOPPER_CAP) { toast('The hopper has room for ' + (HOPPER_CAP - S.factory.raw) + ' units; this pallet is ' + p.n * RAW_PER_SACK + '.', 'bad'); sfx('bad'); return; }
    S.factory.raw = Math.min(HOPPER_CAP, S.factory.raw + p.n * RAW_PER_SACK);
    for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === p.id) { S.pallets.splice(i, 1); break; }
    if (S.jack.pallet === p.id) S.jack.pallet = null; if (S.jack2 && S.jack2.pallet === p.id) S.jack2.pallet = null; if (S.fork.pallet === p.id) S.fork.pallet = null;
    S.pallets.push(newPalletObj('empty')); sfx('hydraulic'); addXp(4); toast('Granulate tipped in: hopper at ' + S.factory.raw, 'good'); logEvent('Tipped a pallet of raw granulate into the hopper'); screenDirtyAll(); hudDirty = true;
    if (MACH.hopper.anim) MACH.hopper.anim.tipT = 1.5;
  }
  // the tipped pallet comes back empty: it lands beside the hopper as an empty pallet the jack can take away
  function newPalletObj() { var w = propWorld('hopper', 1.8, 0.4); for (var k = 1; k < 5 && S.pallets.some(function (q) { return q.place === 'floor' && dist2(q.x, q.z, w.x, w.z) < 1; }); k++) w = propWorld('hopper', 1.8 + k * 1.3, 0.4); return { id: uid('pl'), sku: 'raw', n: 0, place: 'floor', x: w.x, y: 0, z: w.z, rot: w.a }; }
  function hopperScreenDraw(c, sc) { var F = S.factory; scBg(c, sc.w, sc.h, 'rgba(245,181,61,0.18)'); scHead(c, sc.w, 'HOPPER', F.raw + ' / ' + HOPPER_CAP); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(20, 50, 40, 100); c.fillStyle = '#f5b53d'; var hh = 100 * clamp(F.raw / HOPPER_CAP, 0, 1); c.fillRect(20, 150 - hh, 40, hh); scText(c, 76, 80, 'Raw granulate', '#eef1f5', 14); scText(c, 76, 102, 'A pallet of 8 sacks is ' + 8 * RAW_PER_SACK + ' units.', '#a0acb8', 11); scText(c, 76, 120, 'Order pallets on the office PC.', '#a0acb8', 11); }

  // ── The palletiser: boxes off the main belt stack on a pallet; eight boxes, or a change of product, ejects it to the floor
  defMachine('palletiser', { prop: 'palletiser', inlet: [0, -1.6],
    accept: function (it) { if (it.kind !== 'box' || !powered()) return false; var P = S.pal; if (P.n > 0 && P.sku !== it.sku) { if (palletiserBlocked()) return false; palletiserEject(); } if (P.n >= 8 || (P.n >= 7 && palletiserBlocked())) return false; P.sku = it.sku; P.n++; sfx('click'); if (P.n >= 8) palletiserEject(); return true; } });
  function palletiserBlocked() { var w = propWorld('palletiser', 2.2, 0); return S.pallets.some(function (q) { return q.place === 'floor' && dist2(q.x, q.z, w.x, w.z) < 1; }); }   // a pallet still on the apron
  function palletiserEject() {
    var P = S.pal; if (!P.n) return; var w = propWorld('palletiser', 2.2, 0);
    newPallet(P.sku, P.n, { place: 'floor', x: w.x, z: w.z, rot: w.a, y: 0 }); if (S.seenSkus.indexOf(P.sku) < 0) S.seenSkus.push(P.sku); S.stats.palletised = (S.stats.palletised || 0) + 1;
    logEvent('The palletiser finished a pallet of ' + P.n + ' × ' + skuName(P.sku), 'good'); sfx('hydraulic'); addXp(6); P.sku = null; P.n = 0; screenDirtyAll();
  }
  function palletiserPrompt() { var P = S.pal; return 'Palletiser · ' + (P.n ? P.n + ' × ' + skuName(P.sku) + ' on the pallet · E ejects it' : 'waiting for boxes'); }
  function palletiserUse() { if (S.pal.n) palletiserEject(); else sfx('bad'); }
  function palletiserScreenDraw(c, sc) { var P = S.pal; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'PALLETISER', powered() ? (P.n ? 'STACKING' : 'READY') : 'OFF'); scText(c, 16, 70, P.n ? P.n + ' / 8 · ' + skuName(P.sku) : 'Empty pallet in the cradle', '#eef1f5', 16); for (var i = 0; i < 8; i++) { c.fillStyle = i < P.n ? '#5fd38d' : 'rgba(255,255,255,0.1)'; c.fillRect(16 + i * 30, 86, 24, 24); } speedButton(sc, 148, 125, 136, 'beltMain', 'BELT'); scButton(sc, 16, 124, 120, 32, 'EJECT', P.n > 0, function () { palletiserUse(); }); scText(c, 16, 180, 'Pallets made: ' + (S.stats.palletised || 0), '#a0acb8', 12); lampSet(MACH.palletiser, powered() ? (P.n ? 'run' : 'idle') : 'off'); }

  // ── The baler: cardboard from binned boxes and packing offcuts fills the chamber; ten units make a bale; outbound trucks take the bales away for cash
  var BALE_NEED = 10, BALE_PRICE = 18;
  defMachine('baler', { prop: 'baler' });
  function balerStatus() { if (!powered()) return 'off'; return S.baler.t > 0 ? 'run' : 'idle'; }
  function addWaste(n) { if (!S.baler) S.baler = { card: 0, bales: 0, t: 0, made: 0 }; S.baler.card += n; screenDirtyAll(); }
  function balerPrompt() { var B = S.baler; if (B.t > 0) return 'Baling… ' + Math.ceil(B.t) + ' s'; if (!powered()) return 'Baler · no power'; return 'Baler · ' + B.card + ' / ' + BALE_NEED + ' cardboard in the chamber' + (B.card >= BALE_NEED ? ' · E makes a bale' : '') + (B.bales ? ' · ' + B.bales + ' bale' + (B.bales > 1 ? 's' : '') + ' waiting for a truck' : ''); }
  function balerUse() { var B = S.baler; if (B.t > 0 || !powered()) { sfx('bad'); return; } if (B.card < BALE_NEED) { toast('Not enough cardboard yet: ' + B.card + ' of ' + BALE_NEED + '. Binned boxes and packing offcuts fill it.', ''); sfx('bad'); return; } B.t = 8; B.card -= BALE_NEED; sfx('hydraulic'); addXp(3); screenDirtyAll(); }
  function tickBaler(dt) {
    if (!S.baler) S.baler = { card: 0, bales: 0, t: 0, made: 0 }; var B = S.baler;
    if (B.t > 0 && powered()) { B.t -= dt * speedOf('baler'); if (B.t <= 0) { B.t = 0; B.bales++; B.made++; sfx('crate'); toast('Bale made. Outbound trucks take them away at ' + money(BALE_PRICE) + ' each.', 'good'); logEvent('The baler made a bale of cardboard'); screenDirtyAll(); } }
    var a = MACH.baler.anim; if (a) { a.ram.position.y = 3.6 - (B.t > 0 ? Math.abs(Math.sin((8 - B.t) / 8 * Math.PI * 2)) * 0.5 : 0); a.bales.forEach(function (bg, i) { bg.visible = i < B.bales; }); }
    lampSet(MACH.baler, balerStatus());
  }
  function balerScreenDraw(c, sc) { var B = S.baler; scBg(c, sc.w, sc.h, 'rgba(95,211,141,0.18)'); scHead(c, sc.w, 'BALER', balerStatus().toUpperCase()); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, 46, sc.w - 32, 12); c.fillStyle = B.card >= BALE_NEED ? '#5fd38d' : '#f5b53d'; c.fillRect(16, 46, (sc.w - 32) * clamp(B.card / BALE_NEED, 0, 1), 12); scText(c, 16, 80, 'Chamber ' + B.card + ' / ' + BALE_NEED, '#eef1f5', 14); scText(c, 16, 100, 'Bales waiting ' + B.bales + ' · made ' + B.made, '#a0acb8', 12); speedButton(sc, 134, 117, 90, 'baler'); scButton(sc, 16, 116, 110, 32, B.t > 0 ? Math.ceil(B.t) + ' s' : 'BALE', B.card >= BALE_NEED && !B.t, function () { balerUse(); }); scText(c, 16, 162, 'Trucks pay ' + money(BALE_PRICE) + ' a bale', '#6b7784', 11); }
  // the bales leave with every outbound truck
  function sellBales(t) { var B = S.baler; if (!B || !B.bales || t.dir !== 'out') return; var n = Math.min(4, B.bales); B.bales -= n; pay(n * BALE_PRICE, 'Cardboard bales collected, ' + n); logEvent(t.driver + ' took ' + n + ' bale' + (n > 1 ? 's' : '') + ' of cardboard: ' + money(n * BALE_PRICE), 'good'); screenDirtyAll(); }

  // ── The wrapper on the registry: status lamps, a screen, and a film roll that runs out
  var FILM_ROLL = 20, FILM_PRICE = 30;
  defMachine('wrapper', { prop: 'wrapper' });
  function wrapperStatus() { if (!powered()) return 'off'; if (!S.wrap || S.wrap.film <= 0) return 'jam'; return wrapperBusy() ? 'run' : 'idle'; }
  function wrapperScreenDraw(c, sc) { var W2 = S.wrap; scBg(c, sc.w, sc.h, 'rgba(120,189,245,0.18)'); scHead(c, sc.w, 'STRETCH WRAP', wrapperStatus() === 'jam' ? 'NO FILM' : wrapperStatus().toUpperCase()); scText(c, 16, 70, wrapperBusy() ? 'Wrapping… ' + Math.ceil(wrapper.t) + ' s' : 'Bring a pallet on the jack', '#eef1f5', 14); scText(c, 16, 92, 'Film left: ' + W2.film + ' pallets · wrapped ' + W2.wrapped, W2.film > 3 ? '#a0acb8' : '#ff6b5e', 12); speedButton(sc, 172, 111, 56, 'wrapper'); scButton(sc, 16, 110, 150, 32, 'NEW ROLL $' + FILM_PRICE, W2.film < FILM_ROLL && S.bank >= FILM_PRICE, function () { if (S.bank < FILM_PRICE) { sfx('bad'); return; } pay(-FILM_PRICE, 'Stretch film roll'); W2.film = FILM_ROLL; sfx('click'); toast('New film roll fitted', 'good'); }); }

  function tickMachines(dt) {
    if (!S.wrap) S.wrap = { film: FILM_ROLL, wrapped: 0 };
    tickBaler(dt); lampSet(MACH.wrapper, wrapperStatus()); tickAutomation(dt);
    if (!S.pack) S.pack = { queue: [], job: null, jam: false, made: 0, feedT: 0, out: null };
    if (!S.factory) S.factory = { raw: 0, product: 'dccrate', on: false, made: 0, rawOrdered: 0, t: 0, jam: false };
    if (!S.pal) S.pal = { sku: null, n: 0 };
    tickBelts(dt); tickDockFeed(dt); tickPack(dt); tickFactory(dt); tickLift(dt); tickSorter(dt);
    if (MACH.hopper.anim && MACH.hopper.anim.tipT > 0) { var h = MACH.hopper.anim; h.tipT -= dt; h.feeder.position.x = Math.sin(worldTime * 40) * 0.01 * (h.tipT > 0 ? 1 : 0); }
    lampSet(MACH.palletiser, powered() ? (S.pal.n ? 'run' : 'idle') : 'off');
    if (world.wingLights) world.wingLights.forEach(function (l) { l.intensity = powered() ? 0.9 : 0; });
  }
