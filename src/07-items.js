//@ boxes, pallets and parcels: the instanced meshes, the rack slots, the floor, the hand
  // ── Instanced goods ───────────────────────────────────────────────
  // Every box, pallet base and parcel in the world is one instance of three shared meshes, laid out again each
  // frame from the save state. Nothing is ever out of sync with the save because there is no second copy.
  var BOX = { w: 0.55, h: 0.42, d: 0.45 };
  var BOX_GEO = boxGeo(BOX.w, BOX.h, BOX.d), PARCEL_GEO = boxGeo(0.6, 0.46, 0.5), PALLET_GEO = boxGeo(1.2, 0.14, 1.0);
  var boxInst = {}, instSrc = { box: {}, pallet: [], parcel: [] }, instList = [];
  function mkInst(geo, mat, cap) { var im = new THREE.InstancedMesh(geo, mat, cap); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); instList.push(im); return im; }
  SKUS.forEach(function (s) { boxInst[s.id] = mkInst(BOX_GEO, CARD[s.id], 1400); boxInst[s.id].userData.sku = s.id; instSrc.box[s.id] = []; });
  var palletInst = mkInst(PALLET_GEO, MAT.wood, 400); palletInst.userData.pallet = true;
  var parcelInst = mkInst(PARCEL_GEO, MAT.parcel, 400); parcelInst.userData.parcel = true;
  var counts = {};
  function setInst(im, i, x, y, z, ry) { _e.set(0, ry || 0, 0); _q.setFromEuler(_e); _m4.compose(_v.set(x, y, z), _q, _s1); im.setMatrixAt(i, _m4); }
  function putBox(sku, x, y, z, ry, src) { var im = boxInst[sku]; if (!im) return; var i = counts[sku]++; if (i >= 1400) return; setInst(im, i, x, y, z, ry); instSrc.box[sku][i] = src; }
  function putPallet(x, y, z, ry, src) { var i = counts.pallet++; if (i >= 400) return; setInst(palletInst, i, x, y, z, ry); instSrc.pallet[i] = src; }
  function putParcel(x, y, z, ry, src) { var i = counts.parcel++; if (i >= 400) return; setInst(parcelInst, i, x, y, z, ry); instSrc.parcel[i] = src; }
  // boxes on a pallet: four to a layer, up to three layers
  function boxOffset(i, ry) { var layer = Math.floor(i / 4), k = i % 4, ox = k % 2 ? 0.29 : -0.29, oz = k < 2 ? -0.24 : 0.24; var c = Math.cos(ry || 0), s = Math.sin(ry || 0); return { x: ox * c + oz * s, z: -ox * s + oz * c, y: 0.14 + BOX.h / 2 + layer * BOX.h }; }
  function drawPalletWithBoxes(sku, n, x, y, z, ry, src) { putPallet(x, y + 0.07, z, ry, src); for (var i = 0; i < n; i++) { var o = boxOffset(i, ry); putBox(sku, x + o.x, y + o.y, z + o.z, ry, src); } }

  function palletWorld(p) {
    if (p.place === 'floor') return { x: p.x, y: p.y || 0, z: p.z, ry: p.rot || 0 };
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t) return null; return truckPalletPos(t, p.idx); }
    if (p.place === 'jack') { var jw = toolWorld('jack'); return { x: jw.x, y: 0.1, z: jw.z, ry: jw.ry }; }
    if (p.place === 'fork') { var fw = forkTip(); return { x: fw.x, y: fw.y, z: fw.z, ry: S.fork.yaw }; }
    if (p.place === 'staff') { var st = staffById(p.staff); if (!st) return null; return { x: st.x + Math.sin(st.yaw) * 0.95, y: 0.1, z: st.z + Math.cos(st.yaw) * 0.95, ry: st.yaw }; }
    return null;
  }
  function syncInstances() {
    SKUS.forEach(function (s) { counts[s.id] = 0; }); counts.pallet = 0; counts.parcel = 0;
    for (var key in S.slots) { var sl = S.slots[key]; if (!sl || !sl.n) continue; var p = slotParse(key), sp = rackSlotPos(p.r, p.b, p.l); drawPalletWithBoxes(sl.sku, sl.n, sp.x, sp.y, sp.z, 0, { kind: 'slot', key: key }); }
    S.pallets.forEach(function (pl) { var w = palletWorld(pl); if (!w) return; drawPalletWithBoxes(pl.sku, pl.n, w.x, w.y, w.z, w.ry, { kind: 'pallet', id: pl.id, carried: pl.place !== 'floor' && pl.place !== 'truck' }); });
    var bi = 0; SKUS.forEach(function (s) { var n = S.bench.boxes[s.id] || 0; for (var i = 0; i < n; i++, bi++) putBox(s.id, SPOT.bench.x + (bi % 2 ? 0.23 : -0.23), 0.94 + BOX.h / 2 + Math.floor(bi / 8) * BOX.h, SPOT.bench.z - 1.2 + (Math.floor(bi / 2) % 4) * 0.62, 0, { kind: 'bench', sku: s.id }); });
    S.bench.parcels.forEach(function (oid, i) { putParcel(SPOT.benchOut.x + (i % 2 ? 0.25 : -0.25), 0.63 + 0.23 + Math.floor(i / 4) * 0.47, SPOT.benchOut.z + (Math.floor(i / 2) % 2) * 0.6, 0, { kind: 'shelf', order: oid }); });
    S.floor.forEach(function (f, i) { if (f.kind === 'box') putBox(f.sku, f.x, f.y + BOX.h / 2, f.z, f.rot, { kind: 'floor', idx: i }); else putParcel(f.x, f.y + 0.23, f.z, f.rot, { kind: 'floor', idx: i }); });
    var cw = toolWorld('cart'); S.cart.boxes.forEach(function (sku, i) { var c = Math.cos(cw.ry), s = Math.sin(cw.ry), lx = (i % 3 - 1) * 0.42, ly = i < 3 ? 0.3 : 0.82; putBox(sku, cw.x + lx * c, ly + BOX.h / 2, cw.z - lx * s, cw.ry, { kind: 'cart', idx: i }); });
    S.trucks.forEach(function (t) { if (t.dir !== 'out') return; t.parcels.forEach(function (oid, i) { var pp = truckParcelPos(t, i); putParcel(pp.x, pp.y + 0.23, pp.z, 0, { kind: 'truck' }); }); });
    S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box') putBox(st.carry.sku, st.x + Math.sin(st.yaw) * 0.45, 1.05, st.z + Math.cos(st.yaw) * 0.45, st.yaw, { kind: 'carried' }); if (st.carry && st.carry.kind === 'parcel') putParcel(st.x + Math.sin(st.yaw) * 0.45, 1.05, st.z + Math.cos(st.yaw) * 0.45, st.yaw, { kind: 'carried' }); });
    SKUS.forEach(function (s) { var im = boxInst[s.id]; im.count = Math.min(counts[s.id], 1400); im.instanceMatrix.needsUpdate = true; });
    palletInst.count = Math.min(counts.pallet, 400); palletInst.instanceMatrix.needsUpdate = true;
    parcelInst.count = Math.min(counts.parcel, 400); parcelInst.instanceMatrix.needsUpdate = true;
  }
  function instSource(hit) { var o = hit.object; if (o.userData.sku) return instSrc.box[o.userData.sku][hit.instanceId]; if (o.userData.pallet) return instSrc.pallet[hit.instanceId]; if (o.userData.parcel) return instSrc.parcel[hit.instanceId]; return null; }

  // ── The hand ──────────────────────────────────────────────────────
  var handGroup = new THREE.Group(); camera.add(handGroup); scene.add(camera);
  var handBox = new THREE.Mesh(BOX_GEO, CARD.paint); handBox.position.set(0.38, -0.36, -0.72); handBox.rotation.set(0.15, -0.35, 0.05); handBox.visible = false; handGroup.add(handBox);
  var handParcel = new THREE.Mesh(PARCEL_GEO, MAT.parcel); handParcel.position.set(0.38, -0.36, -0.74); handParcel.rotation.set(0.15, -0.35, 0.05); handParcel.visible = false; handGroup.add(handParcel);
  function updateHandMesh() { var h = S.hand; handBox.visible = !!(h && h.kind === 'box'); handParcel.visible = !!(h && h.kind === 'parcel'); if (h && h.kind === 'box') handBox.material = CARD[h.sku] || CARD.paint; }
  function handSet(h) { S.hand = h; hudDirty = true; updateHandMesh(); }
  function handLabel() { var h = S.hand; if (!h) return null; if (h.kind === 'box') return { t: 'A box of ' + skuName(h.sku), s: 'G puts it down' }; var o = orderById(h.order); return { t: 'Parcel #' + (o ? o.num : '?'), s: o ? 'for ' + clientName(o.client) + ' · G puts it down' : '' }; }

  // ── Rack slots ────────────────────────────────────────────────────
  function slotGet(key) { return S.slots[key] || null; }
  function slotSpace(key, sku) { var s = S.slots[key]; if (!s || !s.n) return ECON.slotCap; if (s.sku !== sku) return 0; return ECON.slotCap - s.n; }
  function slotAdd(key, sku, n) { var s = S.slots[key]; if (!s || !s.n) S.slots[key] = { sku: sku, n: n }; else s.n += n; }
  function slotTake(key, n) { var s = S.slots[key]; if (!s) return 0; var k = Math.min(n, s.n); s.n -= k; if (s.n <= 0) delete S.slots[key]; return k; }
  function slotOwned(key) { return slotParse(key).r < S.up.rows; }
  function stockCount(sku) { var n = 0; for (var k in S.slots) if (S.slots[k].sku === sku) n += S.slots[k].n; return n; }
  function totalStock() { var n = 0; for (var k in S.slots) n += S.slots[k].n; return n; }
  function stockSummary() { var m = {}; for (var k in S.slots) { var s = S.slots[k]; if (!s.n) continue; m[s.sku] = (m[s.sku] || 0) + s.n; } return m; }
  function slotsWith(sku) { var out = []; for (var k in S.slots) if (S.slots[k].sku === sku && S.slots[k].n > 0) out.push(k); out.sort(function (a, b) { return slotParse(a).l - slotParse(b).l; }); return out; }
  // the best slot for n boxes of a sku: a slot that already holds that sku and has the room, else an empty one; low levels first
  function findSlotFor(sku, n, maxLevel) {
    var best = null, bestScore = -1;
    for (var r = 0; r < S.up.rows; r++) for (var b = 0; b < RACK.bays; b++) for (var l = 0; l <= maxLevel; l++) {
      var key = slotKey(r, b, l), s = S.slots[key], space = slotSpace(key, sku); if (space < n) continue;
      var score = (s && s.n ? 100 : 50) - l * 10 - b;
      if (score > bestScore) { bestScore = score; best = key; }
    }
    return best;
  }
  function slotPrompt(key) {
    var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
    if (p.l === RACK.top && !driving) return has ? skuName(s.sku) + ' × ' + s.n + ' · top level: forklift only' : 'Top level: forklift only';
    if (tool === 'cart') { if (has && S.cart.boxes.length < ECON.cartCap) return 'Pick a box of ' + skuName(s.sku) + ' onto the cart (' + s.n + ' here)'; return has ? 'Cart is full' : null; }
    if (tool === 'jack') { var jp = jackPallet(); if (jp) return p.l === 0 ? (slotSpace(key, jp.sku) >= jp.n ? 'Set the pallet into the rack' : (has ? 'Slot holds ' + skuName(s.sku) + ': no room' : null)) : 'The jack only reaches the floor level'; return has && p.l === 0 ? 'Pull the pallet out (' + Math.min(s.n, ECON.palletCap) + ' boxes)' : null; }
    if (S.hand && S.hand.kind === 'box') return slotSpace(key, S.hand.sku) > 0 ? 'Put the box on the rack' + (has ? ' (' + s.n + ' here)' : '') : 'Slot holds ' + skuName(s.sku) + ': no room';
    if (S.hand) return null;
    return has ? 'Take a box of ' + skuName(s.sku) + ' (' + s.n + ' here)' : 'Empty slot · ' + slotName(key);
  }
  function slotUse(key) {
    var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
    if (p.l === RACK.top && !driving) { toast('Too high. Use the forklift.', 'bad'); return; }
    if (tool === 'cart') { if (has && S.cart.boxes.length < ECON.cartCap) { S.cart.boxes.push(s.sku); slotTake(key, 1); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); } return; }
    if (tool === 'jack') {
      var jp = jackPallet();
      if (jp) { if (p.l !== 0) { toast('The jack only reaches the floor level.', 'bad'); return; } if (storePallet(jp, key)) { S.jack.pallet = null; sfx('crate'); addXp(XP.pallet); toast('Pallet stored · ' + slotName(key), 'good'); introStep('putaway'); } else toast('No room in that slot.', 'bad'); return; }
      if (has && p.l === 0) { var np = pullPallet(key); if (np) { np.place = 'jack'; S.jack.pallet = np.id; sfx('jack'); } }
      return;
    }
    if (S.hand && S.hand.kind === 'box') { if (slotSpace(key, S.hand.sku) > 0) { slotAdd(key, S.hand.sku, 1); handSet(null); sfx('putdown'); S.stats.putaway++; addXp(XP.box); introStep('putaway'); } else toast('No room: that slot holds ' + skuName(s.sku) + '.', 'bad'); return; }
    if (S.hand) return;
    if (has) { slotTake(key, 1); handSet({ kind: 'box', sku: s.sku }); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); }
  }

  // ── Pallets ───────────────────────────────────────────────────────
  function palletById(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) return S.pallets[i]; return null; }
  function newPallet(sku, n, props) { var p = { id: uid('pl'), sku: sku, n: n, place: 'floor', x: 0, y: 0, z: 0, rot: 0 }; for (var k in props) p[k] = props[k]; S.pallets.push(p); return p; }
  function removePallet(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) { S.pallets.splice(i, 1); return; } }
  function storePallet(p, key) { if (!slotOwned(key) || slotSpace(key, p.sku) < p.n) return false; slotAdd(key, p.sku, p.n); S.stats.putaway += p.n; removePallet(p.id); return true; }
  function pullPallet(key) { var s = S.slots[key]; if (!s || !s.n) return null; var sku = s.sku, n = Math.min(s.n, ECON.palletCap); slotTake(key, n); return newPallet(sku, n, { place: 'floor' }); }
  function jackPallet() { return S.jack.pallet ? palletById(S.jack.pallet) : null; }
  function forkPallet() { return S.fork.pallet ? palletById(S.fork.pallet) : null; }
  function palletPrompt(src) {
    var p = palletById(src.id); if (!p || src.carried) return null;
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t || t.state !== 'docked') return null; if (!t.signed) return 'Sign the delivery note with ' + t.driver + ' first'; }
    if (player.tool === 'jack') return jackPallet() ? null : 'Lift the pallet with the jack (' + p.n + ' × ' + skuName(p.sku) + ')';
    if (player.tool === 'cart') return S.cart.boxes.length < ECON.cartCap ? 'Take a box of ' + skuName(p.sku) + ' onto the cart (' + p.n + ' left)' : 'Cart is full';
    if (S.hand && S.hand.kind === 'box' && S.hand.sku === p.sku && p.n < 12) return 'Put the box back on the pallet';
    if (S.hand) return null;
    return 'Take a box of ' + skuName(p.sku) + ' off the pallet (' + p.n + ' left)';
  }
  function palletUse(src) {
    var p = palletById(src.id); if (!p || src.carried) return;
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t || t.state !== 'docked') return; if (!t.signed) { toast('Sign the delivery note with the driver first. He is by the dock outside.', 'bad'); return; } }
    if (player.tool === 'jack') { if (!jackPallet()) { if (p.place === 'truck') { onPalletLeftTruck(p); } p.place = 'jack'; S.jack.pallet = p.id; sfx('jack'); introStep('unload'); } return; }
    var take = function () { if (p.place === 'truck') onPalletLeftTruck(p); p.n--; S.stats.picked++; addXp(XP.box); if (p.n <= 0) removePallet(p.id); introStep('unload'); };
    if (player.tool === 'cart') { if (S.cart.boxes.length < ECON.cartCap) { S.cart.boxes.push(p.sku); take(); sfx('pickup'); } return; }
    if (S.hand && S.hand.kind === 'box' && S.hand.sku === p.sku && p.n < 12) { p.n++; handSet(null); sfx('putdown'); return; }
    if (S.hand) return;
    handSet({ kind: 'box', sku: p.sku }); take(); sfx('pickup');
  }

  // ── The floor ─────────────────────────────────────────────────────
  function dropAhead(item) {
    var fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    var x = player.x - fx * 0.9, z = player.z - fz * 0.9;
    if (!insideHall(x, z) && floorY(x, z) < -0.5) { x = player.x; z = player.z; }
    item.x = x; item.z = z; item.y = floorY(x, z); item.rot = player.yaw; S.floor.push(item);
  }
  function floorPrompt(src) { var f = S.floor[src.idx]; if (!f) return null; if (f.kind === 'box') { if (player.tool === 'cart') return S.cart.boxes.length < ECON.cartCap ? 'Put the box on the cart' : null; return S.hand || player.tool ? null : 'Pick up the box of ' + skuName(f.sku); } var o = orderById(f.order); return S.hand || player.tool ? null : 'Pick up parcel #' + (o ? o.num : '?'); }
  function floorUse(src) {
    var f = S.floor[src.idx]; if (!f) return;
    if (f.kind === 'box') { if (player.tool === 'cart') { if (S.cart.boxes.length >= ECON.cartCap) return; S.cart.boxes.push(f.sku); } else if (S.hand || player.tool) return; else handSet({ kind: 'box', sku: f.sku }); }
    else { if (S.hand || player.tool) return; handSet({ kind: 'parcel', order: f.order }); }
    S.floor.splice(src.idx, 1); sfx('pickup');
  }
  function putDown() {
    if (player.tool) { releaseTool(); return; }
    if (!S.hand) return;
    var h = S.hand; handSet(null);
    if (h.kind === 'box') dropAhead({ kind: 'box', sku: h.sku }); else dropAhead({ kind: 'parcel', order: h.order });
    sfx('putdown');
  }
