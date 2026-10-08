//@ returns: parcels the customers send back ride in on the outbound trucks (and, with the returns hall, on a returns truck of their own); the inspection desks check them and the boxes go back on the racks or in the bin
  // ── Returns ───────────────────────────────────────────────────────
  // 1.16.0. From level 3 an outbound truck now and then brings a parcel a customer sent back: unwanted, the wrong thing, or
  // damaged in transit. Take it off the trailer (E in the trailer with empty hands) and carry it to the returns desk by the
  // bench: E on the desk queues it, E again starts the inspection, which runs by itself for a few seconds. The client pays an
  // inspection fee per return and per box. The boxes land on the desk shelves: resaleable ones go back on a rack (by hand or on
  // the cart), damaged ones go in the bin at no charge. A return left lying for a day costs reputation. A truck that leaves with
  // a return still aboard has its driver set it down inside the door. The packer fetches returns and runs the desk when the
  // bench has nothing for them, and racks or bins what comes off the shelf.
  // 1.17.0: the returns hall (12-machines7-returns.js) takes the whole operation over once it is bought: the desk by the bench
  // goes, three inspection desks share one queue fed by the belt from the returns dock, the shelf becomes the restock cage and
  // the bin a compactor. Everything here works on "stations": station 0 is the lone desk until the hall opens.
  var RETURNS = { level: UNLOCK.returns, chance: 0.3, max: 2, fee: 10, perBox: 4, deskCap: 4, shelfCap: 8, inspectSec: 5, lateHours: 24, hallDeskCap: 8, hallShelfCap: 24, truckMin: 3, truckMax: 6 };
  var RETURN_REASONS = [['unwanted', 'the customer changed their mind', 0.5], ['wrong', 'the wrong item was sent', 0.25], ['damaged', 'damaged in transit', 0.25]];
  function returnById(id) { var rs = S.returns || []; for (var i = 0; i < rs.length; i++) if (rs[i].id === id) return rs[i]; return null; }
  function returnsHall() { return !!(S.up && S.up.hall2); }
  function rdeskStations() { return returnsHall() ? 3 : 1; }
  function rdeskCap() { return returnsHall() ? RETURNS.hallDeskCap : RETURNS.deskCap; }
  function rdeskShelfCap() { return returnsHall() ? RETURNS.hallShelfCap : RETURNS.shelfCap; }
  function rdeskProp(k) { return returnsHall() ? 'retDesk' + (k || 0) : 'returnsDesk'; }
  function rdesk() {
    if (!S.rdesk) S.rdesk = { queue: [], s: [], shelf: [], done: 0 };
    var D = S.rdesk;
    if (!D.s) { D.s = [{ cur: D.cur || null, t: D.t || 0 }]; delete D.cur; delete D.t; }   // 1.16 saves had the one station in cur/t
    while (D.s.length < rdeskStations()) D.s.push({ cur: null, t: 0 });
    return D;
  }
  function rdeskFree(except) { var D = rdesk(); for (var k = 0; k < rdeskStations(); k++) { if (D.s[k].cur || !propInst[rdeskProp(k)]) continue; if (S.staff.some(function (o) { return o !== except && o.task && o.task.kind === 'retInspect' && o.task.k === k; })) continue; return k; } return -1; }
  function returnsOn() { return S.level >= RETURNS.level && (!!propInst.returnsDesk || returnsHall()); }
  function returnFee(r) { var n = 0; (r ? r.lines : []).forEach(function (l) { n += l.qty; }); return RETURNS.fee + RETURNS.perBox * n; }
  function returnLabel(r) { return 'Return #' + r.num + ' from ' + clientName(r.client); }
  // where a return is right now: on a truck, in your hand, on the floor, on the returns belt, in the queue, under inspection, in a worker's arms, or gone
  function returnPlace(id) {
    if (S.hand && S.hand.kind === 'return' && S.hand.id === id) return 'hand';
    for (var i = 0; i < S.trucks.length; i++) if ((S.trucks[i].returns || []).indexOf(id) >= 0) return 'truck';
    for (var k = 0; k < S.floor.length; k++) if (S.floor[k].kind === 'return' && S.floor[k].id === id) return 'floor';
    for (var bk in (S.belts || {})) { var arr = S.belts[bk]; for (var q = 0; q < arr.length; q++) if (arr[q].ret === id) return 'belt'; }
    var D = rdesk(); if (D.queue.indexOf(id) >= 0) return 'desk'; for (var j = 0; j < D.s.length; j++) if (D.s[j].cur === id) return 'inspecting';
    for (var s = 0; s < S.staff.length; s++) { var c = S.staff[s].carry; if (c && c.kind === 'return' && c.id === id) return 'staff'; }
    return null;
  }
  function returnPlaceText(r) { var p = returnPlace(r.id); if (p === 'truck') { var t = S.trucks.filter(function (x) { return (x.returns || []).indexOf(r.id) >= 0; })[0]; return 'on the truck at ' + (t ? dockLabel(doorIndex(t.dir, t.dock)) : '?'); } return p === 'hand' ? 'in your hands' : p === 'floor' ? 'on the floor' : p === 'belt' ? 'on the returns belt' : p === 'desk' ? (returnsHall() ? 'waiting at the intake' : 'waiting on the desk') : p === 'inspecting' ? 'being inspected' : p === 'staff' ? 'with the crew' : 'gone'; }
  function returnsPending() { return (S.returns || []).filter(function (r) { return returnPlace(r.id) !== null; }); }
  // the record of a return and its place aboard a truck; the smoke test and the schedule both make them this way
  function addReturn(t, spec) {
    var rt = { id: uid('rt'), num: spec.num, client: spec.client, mode: spec.mode || t.mode || 'land', lines: spec.lines, reason: spec.reason, why: (RETURN_REASONS.filter(function (x) { return x[0] === spec.reason; })[0] || RETURN_REASONS[0])[1], created: nowAbs(), form: spec.form || null };
    if (!S.returns) S.returns = []; S.returns.push(rt); t.returns = t.returns || []; t.returns.push(rt.id); return rt.id;
  }
  // what a truck brings back: an outbound truck one or two parcels out of its lane's recent shipments, now and then; the returns
  // truck a load of them (forceN), out of everything shipped
  function truckReturns(t, forceN) {
    if (t.dir === 'in' || !returnsOn() || S.flags.noOrders || S.flags.noReturns || isSunday()) return;
    var pool = t.dir === 'ret' ? S.shipped.slice() : S.shipped.filter(function (s) { return s.mode === t.mode || !s.mode; }); if (!pool.length) pool = S.shipped.slice();
    if (!pool.length) return; if (forceN === undefined && Math.random() > RETURNS.chance) return;
    var n = forceN !== undefined ? forceN : (Math.random() < 0.25 ? 2 : 1), cap = forceN !== undefined ? forceN : RETURNS.max;
    for (var i = 0; i < n && i < cap; i++) {
      var s = pick(pool), r = Math.random(), reason = RETURN_REASONS[0], acc = 0; for (var k = 0; k < RETURN_REASONS.length; k++) { acc += RETURN_REASONS[k][2]; if (r <= acc) { reason = RETURN_REASONS[k]; break; } }
      var lines = [];
      if (s.lines && s.lines.length) { var ln = pick(s.lines); lines.push({ sku: ln.sku, qty: clamp(randi(1, 2), 1, ln.qty) }); }
      else { var cl = CLIENTS.filter(function (c) { return c.id === s.client; })[0], likes = (cl ? cl.likes : []).filter(function (id) { return S.seenSkus.indexOf(id) >= 0 && SKU[id] && !SKU[id].raw; }); lines.push({ sku: likes.length ? pick(likes) : 'bolts', qty: randi(1, 2) }); }
      addReturn(t, { num: s.num, client: s.client, mode: s.mode || t.mode || 'land', lines: lines, reason: reason[0], form: s.form || null });
    }
    if (t.returns && t.returns.length) logEvent(t.dir === 'ret' ? 'The returns truck is coming with ' + t.returns.length + ' returns' : 'The ' + (MODES[t.mode] || MODES.land).name.toLowerCase() + ' truck brings ' + t.returns.length + ' return' + (t.returns.length > 1 ? 's' : '') + ' back');
  }
  function retTruckLoad(t) { truckReturns(t, randi(RETURNS.truckMin, RETURNS.truckMax)); }
  // ── The desks ─────────────────────────────────────────────────────
  // the working side is local +z, which the default placement turns toward the hall
  function rdeskStand(k) { var w = propWorld(rdeskProp(k || 0), 0, 1.1); return { x: w.x, z: w.z }; }
  function rdeskPrompt(k) {
    var D = rdesk(), st = D.s[k] || D.s[0], hall = returnsHall();
    if (S.hand && S.hand.kind === 'return') return D.queue.length < rdeskCap() ? 'Put the return ' + (hall ? 'in the queue' : 'on the desk') + ' (' + D.queue.length + ' waiting)' : 'The queue is full: inspect one first';
    if (S.hand || player.tool) return null;
    if (st.cur) { var rc = returnById(st.cur); return 'Inspecting return #' + (rc ? rc.num : '?') + ' · ' + Math.ceil(st.t) + ' s'; }
    if (D.queue.length) { var rq = returnById(D.queue[0]); return 'Inspect return #' + (rq ? rq.num : '?') + ' (' + D.queue.length + ' waiting) · ' + money(returnFee(rq)) + ' fee'; }
    return (hall ? 'Inspection desk ' + (k + 1) : 'Returns desk') + ' · ' + (D.shelf.length ? D.shelf.length + ' box' + (D.shelf.length > 1 ? 'es' : '') + (hall ? ' in the cage · ' : ' on the shelf · ') : '') + D.done + ' inspected · ' + (hall ? 'returns come in on the returns truck and the outbound trucks' : 'returns ride in on the outbound trucks');
  }
  function rdeskUse(k) {
    var D = rdesk(), st = D.s[k] || D.s[0], hall = returnsHall();
    if (S.hand && S.hand.kind === 'return') { if (D.queue.length >= rdeskCap()) { toast('The queue is full. Inspect one first.', 'bad'); sfx('bad'); return; } D.queue.push(S.hand.id); handSet(null); sfx('putdown'); screenDirtyAll(); hudDirty = true; return; }
    if (S.hand || player.tool) return;
    if (st.cur) { toast('Inspecting. ' + Math.ceil(st.t) + ' seconds to go.', ''); return; }
    if (!D.queue.length) { sfx('click'); toast(D.shelf.length ? 'Take the boxes off the ' + (hall ? 'restock cage' : 'shelf') + ': good ones to the racks, damaged ones to the ' + (hall ? 'compactor' : 'bin') + '.' : 'Nothing to inspect. ' + (hall ? 'Returns come in on the returns truck and the outbound trucks.' : 'Returns come in on the outbound trucks.'), ''); return; }
    if (!powered()) { toast('No power: the desk scanner is dead.', 'bad'); sfx('bad'); return; }
    rdeskStart(k);
  }
  function rdeskStart(k) { var D = rdesk(), st = D.s[k || 0]; if (!st || st.cur || !D.queue.length) return false; st.cur = D.queue.shift(); st.t = RETURNS.inspectSec; sfx('scan'); screenDirtyAll(); return true; }
  function rdeskFinish(k) {
    var D = rdesk(), st = D.s[k], r = returnById(st.cur); st.cur = null; st.t = 0; if (!r) return;
    var boxes = 0, dmg = r.reason === 'damaged', spill = 0, cap = rdeskShelfCap();
    r.lines.forEach(function (l) { for (var i = 0; i < l.qty; i++) { boxes++; if (D.shelf.length < cap) D.shelf.push({ sku: l.sku, damaged: dmg }); else { var w = propWorld(rdeskProp(k), -0.6 + spill * 0.6, 1.6); S.floor.push({ kind: 'box', sku: l.sku, damaged: dmg, x: w.x, y: 0, z: w.z, rot: 0 }); spill++; } } });
    var fee = returnFee(r); pay(fee, 'Return #' + r.num + ' inspected for ' + clientName(r.client)); D.done++; S.stats.returns = (S.stats.returns || 0) + 1; addXp(6); addRep(r.late ? 0 : 0.5);
    S.returns.splice(S.returns.indexOf(r), 1);
    sfx('cash'); toast('Return #' + r.num + ': ' + boxes + ' box' + (boxes > 1 ? 'es' : '') + (dmg ? ' damaged in transit, for the ' + (returnsHall() ? 'compactor' : 'bin') : ' resaleable, back on the racks') + ' · ' + money(fee), dmg ? '' : 'good');
    logEvent('Inspected return #' + r.num + ' from ' + clientName(r.client) + ' (' + r.why + '): ' + boxes + (dmg ? ' damaged' : ' resaleable') + ' · ' + money(fee) + (spill ? ' · the ' + (returnsHall() ? 'cage' : 'shelf') + ' was full, ' + spill + ' set down beside the desk' : ''), 'good');
    hudDirty = true; screenDirtyAll();
  }
  function tickReturns(dt) {
    if (!returnsOn()) return;
    var D = rdesk();
    for (var k = 0; k < rdeskStations(); k++) {
      var st = D.s[k], inst = propInst[rdeskProp(k)];
      if (st.cur) { if (powered()) st.t -= dt; if (st.t <= 0) rdeskFinish(k); if (inst && inst.lamp) inst.lamp.material.emissiveIntensity = 0.7 + Math.sin(worldTime * 9 + k) * 0.6; }
      else if (inst && inst.lamp) inst.lamp.material.emissiveIntensity = D.queue.length ? 1.1 : 0.12;
    }
    if (returnsHall()) tickRetFeed(dt);
    // a return left lying for a day: the client notices
    if (Math.floor(S.time * 4) !== S.flags.retQ) { S.flags.retQ = Math.floor(S.time * 4); (S.returns || []).forEach(function (r) { if (!r.late && nowAbs() > r.created + RETURNS.lateHours && returnPlace(r.id)) { r.late = true; addRep(-1); logEvent('Return #' + r.num + ' has waited a day: ' + clientName(r.client) + ' is not pleased', 'bad'); } }); }
  }
  // the boxes on the desk shelves or in the restock cage: resaleable ones go to the racks by hand or on the cart, damaged ones to the bin or the compactor
  function rdeskBoxPrompt(src) {
    var b = rdesk().shelf[src.idx]; if (!b) return null; var binName = returnsHall() ? 'compactor' : 'bin';
    if (player.tool === 'cart') return b.damaged ? 'Damaged: carry it to the ' + binName + ' by hand' : cartLoad() < ECON.cartCap ? 'Put the returned box of ' + skuName(b.sku) + ' on the cart' : 'The cart is full';
    if (S.hand || player.tool) return null;
    return b.damaged ? 'Take the damaged box (' + binName + ' it, no charge)' : 'Take the returned box of ' + skuName(b.sku) + ' (it goes back on a rack)';
  }
  function rdeskBoxUse(src) {
    var D = rdesk(), b = D.shelf[src.idx]; if (!b) return;
    if (player.tool === 'cart') { if (b.damaged || cartLoad() >= ECON.cartCap) { sfx('bad'); return; } S.cart.boxes.push(b.sku); D.shelf.splice(src.idx, 1); sfx('pickup'); hudDirty = true; screenDirtyAll(); return; }
    if (S.hand || player.tool) return;
    D.shelf.splice(src.idx, 1); handSet({ kind: 'box', sku: b.sku, damaged: !!b.damaged, ret: true }); sfx('pickup'); screenDirtyAll();
  }
  function rdeskQueuePrompt(src) { var r = returnById(rdesk().queue[src.idx]); if (!r) return null; if (S.hand || player.tool) return null; return returnLabel(r) + ' · waiting · E on ' + (returnsHall() ? 'an inspection desk' : 'the desk') + ' inspects it'; }
  // drawn from the save every frame, like everything else: the queue stacked in the tray at the near end, the one under inspection on the scale, the boxes on the two shelves
  function drawReturnsDesk() {
    var D = rdesk();
    if (returnsHall()) { drawReturnsHall(D); return; }
    if (!propInst.returnsDesk) return; var a = propPlacement('returnsDesk').rot * Math.PI / 2, W = function (lx, lz) { return propWorld('returnsDesk', lx, lz); };
    D.queue.forEach(function (id, i) { var w = W(-0.6, -0.08); putParcel(w.x, 1.03 + 0.23 + i * 0.47, w.z, a + (i % 2 ? 0.12 : -0.08), { kind: 'rdeskq', idx: i, k: 0 }, 'ret'); });
    if (D.s[0].cur) { var wc = W(0.6, -0.05); putParcel(wc.x, 1.04 + 0.23, wc.z, a + 0.35, { kind: 'rdeskcur' }, 'ret'); }
    D.shelf.forEach(function (b, i) { var w = W(-0.75 + (i % 4) * 0.5, 0.0), base = i < 4 ? 0.135 : 0.555; if (b.damaged) putBoxDamaged(b.sku, w.x, base, w.z, a, { kind: 'rdesk', idx: i }); else putBox(b.sku, w.x, base + BOX.h / 2, w.z, a, { kind: 'rdesk', idx: i }); });
  }
  // the desk: a steel-framed worktop at a metre with two shelves under it, a scale plate, a label printer, a tape gun, a clipboard,
  // a terminal on a stand at one end, a lamp that blinks while it inspects, and a hanging sign. The returns hall stands three of them.
  function returnsDeskBuildFor(k, label) { return function (c, P, inst) {
    var TOP = std({ color: 0x8f98a3, roughness: 0.45, metalness: 0.35 }), FRAME = MAT.steelDark, PLATE = std({ color: 0xcfd4d9, roughness: 0.4, metalness: 0.5 }), TAN = std({ color: 0xc9a46a, roughness: 0.8 });
    c.box(2.0, 0.05, 0.8, TOP, 0, 1.0, 0); [[-0.95, -0.35], [0.95, -0.35], [-0.95, 0.35], [0.95, 0.35]].forEach(function (o) { c.box(0.05, 1.0, 0.05, FRAME, o[0], 0.5, o[1]); });
    c.box(1.9, 0.03, 0.7, FRAME, 0, 0.12, 0); c.box(1.9, 0.03, 0.7, FRAME, 0, 0.54, 0);   // the two shelves for the opened boxes
    c.box(0.6, 0.02, 0.6, PLATE, 0.6, 1.035, -0.05); c.box(0.04, 0.26, 0.04, FRAME, 0.92, 1.16, -0.3);   // the scale plate and its readout post at the back
    var rg = new THREE.Group(); rg.position.set(0.92, 1.3, -0.3); rg.rotation.order = 'YXZ'; rg.rotation.x = -0.3; c.add(rg); box(0.18, 0.09, 0.03, MAT.black, 0, 0, 0, rg); sign(['0.00 kg'], 0.15, 0.06, 0, 0, 0.016, 0, { w: 192, h: 72, bg: '#0d1216', fg: '#5fd38d' }, rg);
    c.box(0.24, 0.13, 0.17, MAT.white, -0.82, 1.09, 0.22); c.box(0.004, 0.09, 0.07, MAT.paper, -0.69, 1.07, 0.22); c.box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), -0.76, 1.14, 0.31);   // the label printer
    var tgn = new THREE.Group(); tgn.position.set(-0.25, 1.03, 0.22); tgn.rotation.y = 0.5; c.add(tgn); box(0.03, 0.11, 0.035, MAT.red, 0, 0.06, -0.05, tgn).rotation.x = 0.35; box(0.02, 0.09, 0.13, FRAME, 0.03, 0.1, 0.03, tgn); cyl(0.055, 0.05, TAN, 0.03, 0.1, 0.055, tgn, 16).rotation.z = Math.PI / 2;   // the tape gun
    c.box(0.22, 0.012, 0.3, MAT.black, 0.12, 1.03, 0.2).rotation.y = -0.2; c.box(0.2, 0.006, 0.27, MAT.paper, 0.12, 1.04, 0.2).rotation.y = -0.2; c.box(0.08, 0.02, 0.03, FRAME, 0.12, 1.05, 0.33).rotation.y = -0.2;   // the clipboard
    c.box(0.3, 0.1, 0.3, std({ color: 0x3a4149, roughness: 0.6 }), -0.6, 1.08, -0.18);   // the parcel tray the queue stands in
    var post = c.cyl(0.02, 2.3, FRAME, 0, 1.15, -0.38, 8); post.castShadow = false; c.box(0.9, 0.03, 0.03, FRAME, 0, 2.3, -0.38);
    c.sign([label], 0.9, 0.22, 0, 2.15, -0.36, 0, { w: 384, h: 96, bg: '#1b232c', fg: '#f5b53d' }); c.sign([label], 0.9, 0.22, 0, 2.15, -0.4, Math.PI, { w: 384, h: 96, bg: '#1b232c', fg: '#f5b53d' });
    c.plane(2.2, 0.9, std({ color: 0x242c36, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }), 0, 0.004, 0.9, -Math.PI / 2, 0);   // the mat where you stand
    // the lamp over the scale: dark when idle, lit with returns waiting, blinking while it inspects (a dynamic subgroup, so the bake leaves it)
    var dyn = new THREE.Group(); dyn.userData.dynamic = true; c.add(dyn); c.box(0.03, 0.03, 0.4, FRAME, 0.6, 1.62, -0.2); c.cyl(0.02, 0.6, FRAME, 0.6, 1.32, -0.38, 8); inst.lamp = box(0.09, 0.07, 0.09, glowMat(0xf5b53d, 0.12), 0.6, 1.58, -0.02, dyn);
    // the terminal on its stand at the end, screen facing the working side
    var tg = new THREE.Group(); tg.position.set(1.35, 0, -0.05); c.add(tg);
    cyl(0.22, 0.03, FRAME, 0, 0.015, 0, tg, 16); cyl(0.2, 0.02, MAT.rubber, 0, 0.04, 0, tg, 16); cyl(0.03, 1.5, FRAME, 0, 0.78, 0, tg, 10); box(0.64, 0.5, 0.03, MAT.black, 0, 1.56, -0.03, tg); box(0.02, 0.02, 0.01, glowMat(0x5fd38d, 1.2), 0.28, 1.34, -0.01, tg);
    var scr = touchScreen({ w: 320, h: 240, res: 3, pw: 0.58, ph: 0.435, x: 0, y: 1.56, z: -0.01, ry: 0, parent: tg, title: label === 'RETURNS' ? 'Returns desk' : 'Inspection desk ' + (k + 1), draw: function (cc, sc) { rdeskScreenDraw(cc, sc, k); } }); scr.mesh.userData.propId = inst.id;
    c.solid(-1.05, 1.05, -0.45, 0.45, 0, 1.05); c.solid(1.12, 1.58, -0.3, 0.2, 0, 1.9);
    c.hit(2.2, 1.3, 1.0, 0, 0.7, 0, { prompt: function () { return rdeskPrompt(k); }, use: function () { rdeskUse(k); } });
  }; }
  function rdeskScreenDraw(c, sc, k) {
    var D = rdesk(), st = D.s[k] || D.s[0], hall = returnsHall(); scBg(c, sc.w, sc.h, 'rgba(245,181,61,0.16)'); scHead(c, sc.w, hall ? 'INSPECTION ' + (k + 1) : 'RETURNS', D.done + ' inspected');
    var y = 60;
    if (st.cur) { var r = returnById(st.cur); scText(c, 16, y, 'Inspecting #' + (r ? r.num : '?') + ' · ' + (r ? clientName(r.client).slice(0, 18) : ''), '#f5b53d', 14); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(16, y + 10, sc.w - 32, 10); c.fillStyle = '#f5b53d'; c.fillRect(16, y + 10, (sc.w - 32) * clamp(1 - st.t / RETURNS.inspectSec, 0, 1), 10); y += 36; }
    else if (D.queue.length) { var q0 = returnById(D.queue[0]); scText(c, 16, y, (q0 ? returnLabel(q0) : 'A return') + ' waiting', '#eef1f5', 14); scText(c, 16, y + 17, q0 ? q0.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · ' + q0.why : '', '#a0acb8', 11); scButton(sc, sc.w - 116, y - 14, 100, 30, 'INSPECT', powered(), function () { if (!powered()) { toast('No power.', 'bad'); return; } rdeskStart(k); }, '#5fd38d'); y += 40; }
    else { scText(c, 16, y, 'Nothing waiting', '#5fd38d', 14); scText(c, 16, y + 17, hall ? 'The belt brings them in from the returns dock' : 'Returns come in on the outbound trucks: look in the trailer', '#a0acb8', 11); y += 40; }
    if (D.queue.length > (st.cur ? 0 : 1)) { scText(c, 16, y, 'Also waiting: ' + D.queue.slice(st.cur ? 0 : 1).map(function (id) { var r2 = returnById(id); return '#' + (r2 ? r2.num : '?'); }).join(', '), '#a0acb8', 11); y += 18; }
    var good = D.shelf.filter(function (b) { return !b.damaged; }).length, bad = D.shelf.length - good;
    scText(c, 16, y + 4, (hall ? 'In the cage: ' : 'On the shelves: ') + (D.shelf.length ? good + ' resaleable' + (bad ? ', ' + bad + ' damaged' : '') : 'nothing'), D.shelf.length ? '#eef1f5' : '#6b7784', 13); y += 22;
    if (D.shelf.length) scText(c, 16, y + 2, (good ? 'good ones go back on a rack' : '') + (good && bad ? ' · ' : '') + (bad ? 'damaged ones go in the ' + (hall ? 'compactor' : 'bin') + ', no charge' : ''), '#a0acb8', 11);
    var pend = returnsPending().length - D.queue.length - D.s.filter(function (x) { return x.cur; }).length;
    scText(c, 16, sc.h - 40, pend > 0 ? pend + ' more return' + (pend > 1 ? 's' : '') + ' out there: on a truck, the belt or the floor' : 'Fee: ' + money(RETURNS.fee) + ' a return and ' + money(RETURNS.perBox) + ' a box', pend > 0 ? '#f5b53d' : '#6b7784', 11);
    scText(c, 16, sc.h - 22, 'A return left a day costs reputation', '#6b7784', 10);
  }
  defProp('returnsDesk', { label: 'returns desk', cat: 'hall', abs: true, keep: true, stage: 1, lvl: UNLOCK.returns, x: 29.4, z: 10.4, rot: 3, at: { 1: { x: 13.8, z: -5.2, rot: 0 } }, build: returnsDeskBuildFor(0, 'RETURNS'), when: function () { return !returnsHall(); } });   // west of the small hall's bench; it appears at the returns level   // between the bench and the office front, east lane side, the working side toward the hall; gone once the returns hall opens
  // ── The crew and the returns ──────────────────────────────────────
  // the packer's returns work (or whoever covers the packer): a return on the floor or aboard a docked truck with its door up
  // goes to the queue; a free desk is started; what comes off the shelf is racked or binned. Claims keep two workers off one return.
  function returnsJob(st) {
    if (!returnsOn()) return null; var D = rdesk();
    if (st && st.carry && st.carry.kind === 'return') return { kind: 'rdesk' };
    var claimed = function (id) { return S.staff.some(function (o) { return o !== st && o.task && o.task.ret === id; }); };
    if (D.queue.length < rdeskCap()) {
      for (var i = 0; i < S.floor.length; i++) { var f = S.floor[i]; if (f.kind === 'return' && insideHall(f.x, f.z) && !claimed(f.id)) return { kind: 'retFloor', ret: f.id, x: f.x, z: f.z }; }
      for (var k = 0; k < S.trucks.length; k++) { var t = S.trucks[k]; if (t.dir !== 'in' && t.state === 'docked' && S.doors[doorIndex(t.dir, t.dock)] && t.returns && t.returns.length && !claimed(t.returns[0]) && !(t.dir === 'ret' && retFeedWorks(t))) return { kind: 'retTruck', ret: t.returns[0], truck: t.id }; }   // the belt empties the returns truck by itself while it runs
    }
    if (D.queue.length && powered()) { var fk = rdeskFree(st); if (fk >= 0) return { kind: 'retInspect', k: fk }; }
    if (D.shelf.length && !S.staff.some(function (o) { return o !== st && o.task && o.task.kind === 'retShelf'; })) return { kind: 'retShelf' };
    return null;
  }
  function retQueueStand() { if (returnsHall() && propInst.retIntake) { var w = propWorld('retIntake', 0, 1.1); return { x: w.x, z: w.z }; } return rdeskStand(0); }
  function retShelfStand() { if (returnsHall() && propInst.retCage) { var w = propWorld('retCage', 0, 1.1); return { x: w.x, z: w.z }; } return rdeskStand(0); }
  function packerReturns(st, job) {
    var D = rdesk();
    if (job.kind === 'rdesk') { st.task = { kind: 'rdesk' }; staffGo(st, retQueueStand(), 'wait'); st.timer = 0.8; st.working = true; st.after = function () { if (st.carry && st.carry.kind === 'return') { if (D.queue.length < rdeskCap()) { D.queue.push(st.carry.id); sfx('putdown'); screenDirtyAll(); } else S.floor.push({ kind: 'return', id: st.carry.id, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); st.carry = null; } st.task = null; }; return; }
    if (job.kind === 'retFloor') { st.task = { kind: 'retFloor', ret: job.ret }; staffGo(st, { x: job.x, z: job.z + 0.9 }, 'wait'); st.timer = 0.7; st.working = true; st.after = function () { var k = -1; S.floor.forEach(function (f, i) { if (f.kind === 'return' && f.id === job.ret) k = i; }); if (k >= 0) { S.floor.splice(k, 1); st.carry = { kind: 'return', id: job.ret }; sfx('pickup'); } st.task = null; }; return; }
    if (job.kind === 'retTruck') { var t = truckById(job.truck); if (!t) return; st.task = { kind: 'retTruck', ret: job.ret }; staffGo(st, { x: t.x + t.side * 2.6, z: t.z }, 'wait'); st.timer = 0.9; st.working = true; st.after = function () { var tt = truckById(job.truck), k = tt ? (tt.returns || []).indexOf(job.ret) : -1; if (k >= 0) { tt.returns.splice(k, 1); st.carry = { kind: 'return', id: job.ret }; sfx('pickup'); } st.task = null; }; return; }
    if (job.kind === 'retInspect') { var dk = job.k || 0; st.task = { kind: 'retInspect', k: dk }; staffGo(st, rdeskStand(dk), 'wait'); st.timer = 1.0; st.working = true; st.after = function () { rdeskStart(dk); st.task = null; }; return; }
    if (job.kind === 'retShelf') { st.task = { kind: 'retShelf' }; staffGo(st, retShelfStand(), 'wait'); st.timer = 0.7; st.working = true; st.after = function () { var b = D.shelf.shift(); if (b) { if (b.damaged) st.carry = { kind: 'box', sku: b.sku, damaged: true, bin: true }; else { var key = findSlotFor(b.sku, 1, 1); if (key) st.carry = { kind: 'box', sku: b.sku, back: key }; else S.floor.push({ kind: 'box', sku: b.sku, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); } sfx('pickup'); screenDirtyAll(); } st.task = null; }; return; }
  }
