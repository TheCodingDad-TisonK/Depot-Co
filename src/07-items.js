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
  // the sortation deck's forms: a sea crate, a strapped land parcel, an air bag; one instanced mesh each, looked at like any parcel
  var CRATE_GEO = boxGeo(0.72, 0.56, 0.6), FORM_INST = { crate: mkInst(CRATE_GEO, MAT.crate, 200), strap: mkInst(PARCEL_GEO, MAT.strapped, 200), pouch: mkInst(PARCEL_GEO, MAT.airbox, 200) };
  for (var fk in FORM_INST) { FORM_INST[fk].userData.parcelForm = fk; instSrc[fk] = []; }
  var counts = {};
  function setInst(im, i, x, y, z, ry) { _e.set(0, ry || 0, 0); _q.setFromEuler(_e); _m4.compose(_v.set(x, y, z), _q, _s1); im.setMatrixAt(i, _m4); }
  function putBox(sku, x, y, z, ry, src) { var im = boxInst[sku]; if (!im) return; var i = counts[sku]++; if (i >= 1400) return; setInst(im, i, x, y, z, ry); instSrc.box[sku][i] = src; }
  function putPallet(x, y, z, ry, src) { var i = counts.pallet++; if (i >= 400) return; setInst(palletInst, i, x, y, z, ry); instSrc.pallet[i] = src; }
  function putParcel(x, y, z, ry, src, form) { if (form && FORM_INST[form]) { var j = counts[form]++; if (j >= 200) return; setInst(FORM_INST[form], j, x, y + (form === 'crate' ? 0.05 : 0), z, ry); instSrc[form][j] = src; return; } var i = counts.parcel++; if (i >= 400) return; setInst(parcelInst, i, x, y, z, ry); instSrc.parcel[i] = src; }
  // boxes on a pallet: four to a layer, up to three layers
  function boxOffset(i, ry) { var layer = Math.floor(i / 4), k = i % 4, ox = k % 2 ? 0.29 : -0.29, oz = k < 2 ? -0.24 : 0.24; var c = Math.cos(ry || 0), s = Math.sin(ry || 0); return { x: ox * c + oz * s, z: -ox * s + oz * c, y: 0.14 + BOX.h / 2 + layer * BOX.h }; }
  function drawPalletWithBoxes(sku, n, x, y, z, ry, src) { putPallet(x, y + 0.07, z, ry, src); for (var i = 0; i < n; i++) { var o = boxOffset(i, ry); putBox(sku, x + o.x, y + o.y, z + o.z, ry, src); } }

  function palletWorld(p) {
    if (p.place === 'floor') return { x: p.x, y: p.y || 0, z: p.z, ry: p.rot || 0 };
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t) return null; return truckPalletPos(t, p.idx); }
    if (p.place === 'jack') { var jw = toolWorld(p.jack || 'jack'); return { x: jw.x, y: 0.1, z: jw.z, ry: jw.ry }; }
    if (p.place === 'fork') { var fw = forkTip(); return { x: fw.x, y: fw.y, z: fw.z, ry: S.fork.yaw }; }
    if (p.place === 'staff') { var st = staffById(p.staff); if (!st) return null; return { x: st.x + Math.sin(st.yaw) * STAFF_JACK.push, y: 0.1, z: st.z + Math.cos(st.yaw) * STAFF_JACK.push, ry: st.yaw }; }   /* on the forks of the jack they push, see jackFollow */
    if (p.place === 'lift') { var LL = liftState(); return { x: UPPER.lift.x, y: LL.pos * UPPER.y + 0.2, z: UPPER.lift.z, ry: 0 }; }
    if (p.place === 'agv') { var A = S.agv; if (!A) return null; return { x: A.x + Math.sin(A.yaw) * 1.0, y: 0.18, z: A.z + Math.cos(A.yaw) * 1.0, ry: A.yaw }; }
    return null;
  }
  function syncInstances() {
    SKUS.forEach(function (s) { counts[s.id] = 0; }); counts.pallet = 0; counts.parcel = 0; counts.crate = 0; counts.strap = 0; counts.pouch = 0;
    for (var key in S.slots) { var sl = S.slots[key]; if (!sl || (!sl.n && !sl.pal)) continue; var p = slotParse(key), sp = rackSlotPos(p.r, p.b, p.l); drawPalletWithBoxes(sl.sku, sl.n, sp.x, sp.y, sp.z, sp.ry || 0, { kind: 'slot', key: key }); }
    S.pallets.forEach(function (pl) { var w = palletWorld(pl); if (!w) return; drawPalletWithBoxes(pl.sku, pl.n, w.x, w.y, w.z, w.ry, { kind: 'pallet', id: pl.id, carried: pl.place !== 'floor' && pl.place !== 'truck' }); });
    // the bench and its shelf follow the bench prop: box positions are local to it, clear of the terminal at its near end
    var BP = PROPS.bench ? propPlacement('bench') : { x: SPOT.bench.x, z: SPOT.bench.z, rot: 0 }, ba = BP.rot * Math.PI / 2, bc = Math.cos(ba), bs = Math.sin(ba);
    var benchW = function (lx, lz) { return { x: BP.x + lx * bc + lz * bs, z: BP.z - lx * bs + lz * bc }; };
    var bi = 0; SKUS.forEach(function (s) { var n = S.bench.boxes[s.id] || 0; for (var i = 0; i < n; i++, bi++) { var w = benchW(bi % 2 ? 0.23 : -0.23, -0.72 + (Math.floor(bi / 2) % 4) * 0.6); putBox(s.id, w.x, 0.94 + BOX.h / 2 + Math.floor(bi / 8) * BOX.h, w.z, ba, { kind: 'bench', sku: s.id }); } });
    var LP = PROPS.packline ? propPlacement('packline') : BP, la = LP.rot * Math.PI / 2, lc = Math.cos(la), ls = Math.sin(la);
    S.bench.parcels.forEach(function (oid, i) { var s = shelfSlot(i); putParcel(LP.x + s.lx * lc + s.lz * ls, s.y, LP.z - s.lx * ls + s.lz * lc, la, { kind: 'shelf', order: oid }, parcelForm(oid)); });
    drawBeltItems(); drawSorterItems();
    S.floor.forEach(function (f, i) { if (f.kind === 'box') { if (f.damaged) { var im = boxInst[f.sku]; if (im) { var ii = counts[f.sku]++; if (ii < 1400) { _e.set(0, f.rot, 0.35); _q.setFromEuler(_e); _v2.set(1, 0.72, 1.08); _m4.compose(_v.set(f.x, f.y + BOX.h * 0.36, f.z), _q, _v2); im.setMatrixAt(ii, _m4); instSrc.box[f.sku][ii] = { kind: 'floor', idx: i }; } } } else putBox(f.sku, f.x, f.y + BOX.h / 2, f.z, f.rot, { kind: 'floor', idx: i }); } else putParcel(f.x, f.y + 0.23, f.z, f.rot, { kind: 'floor', idx: i }, parcelForm(f.order)); });
    var cw = toolWorld('cart'), cartY = [0.3, 0.82, 1.34]; S.cart.boxes.forEach(function (sku, i) { var c = Math.cos(cw.ry), s = Math.sin(cw.ry), lx = (i % 4 - 1.5) * 0.4, ly = cartY[Math.floor(i / 4)] || 1.34; putBox(sku, cw.x + lx * c, ly + BOX.h / 2, cw.z - lx * s, cw.ry, { kind: 'cart', idx: i }); });
    (S.cart.parcels || []).forEach(function (oid, j) { var i = S.cart.boxes.length + j; if (i >= ECON.cartCap) return; var c = Math.cos(cw.ry), s = Math.sin(cw.ry), lx = (i % 4 - 1.5) * 0.4, ly = cartY[Math.floor(i / 4)] || 1.34; putParcel(cw.x + lx * c, ly + 0.2, cw.z - lx * s, cw.ry, { kind: 'cart', idx: i }, parcelForm(oid)); });
    S.trucks.forEach(function (t) { if (t.dir !== 'out') return; t.parcels.forEach(function (oid, i) { var pp = truckParcelPos(t, i), po = orderById(oid); putParcel(pp.x, pp.y + 0.23, pp.z, 0, { kind: 'truck' }, po && po.form); }); });
    S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box') putBox(st.carry.sku, st.x + Math.sin(st.yaw) * 0.45, 1.05, st.z + Math.cos(st.yaw) * 0.45, st.yaw, { kind: 'carried' }); if (st.carry && st.carry.kind === 'parcel') putParcel(st.x + Math.sin(st.yaw) * 0.45, 1.05, st.z + Math.cos(st.yaw) * 0.45, st.yaw, { kind: 'carried' }, parcelForm(st.carry.order)); });
    SKUS.forEach(function (s) { var im = boxInst[s.id]; im.count = Math.min(counts[s.id], 1400); im.instanceMatrix.needsUpdate = true; });
    palletInst.count = Math.min(counts.pallet, 400); palletInst.instanceMatrix.needsUpdate = true;
    parcelInst.count = Math.min(counts.parcel, 400); parcelInst.instanceMatrix.needsUpdate = true;
    for (var fk2 in FORM_INST) { FORM_INST[fk2].count = Math.min(counts[fk2], 200); FORM_INST[fk2].instanceMatrix.needsUpdate = true; }
  }
  function instSource(hit) { var o = hit.object; if (o.userData.sku) return instSrc.box[o.userData.sku][hit.instanceId]; if (o.userData.pallet) return instSrc.pallet[hit.instanceId]; if (o.userData.parcel) return instSrc.parcel[hit.instanceId]; if (o.userData.parcelForm) return instSrc[o.userData.parcelForm][hit.instanceId]; return null; }

  // ── The hand ──────────────────────────────────────────────────────
  var handGroup = new THREE.Group(); handGroup.userData.dynamic = true; camera.add(handGroup); scene.add(camera);   // never baked: it rides on the camera
  var handBox = new THREE.Mesh(BOX_GEO, CARD.paint); handBox.position.set(0.38, -0.36, -0.72); handBox.rotation.set(0.15, -0.35, 0.05); handBox.visible = false; handGroup.add(handBox);
  var handParcel = new THREE.Mesh(PARCEL_GEO, MAT.parcel); handParcel.position.set(0.38, -0.36, -0.74); handParcel.rotation.set(0.15, -0.35, 0.05); handParcel.visible = false; handGroup.add(handParcel);
  var handPlug = new THREE.Group(); handPlug.position.set(0.34, -0.3, -0.6); handPlug.rotation.set(0.2, -0.3, 0); handPlug.visible = false; handGroup.add(handPlug);
  box(0.06, 0.06, 0.14, MAT.black, 0, 0, 0, handPlug); box(0.08, 0.08, 0.04, MAT.red, 0, 0, 0.09, handPlug); cyl(0.012, 0.3, MAT.black, 0, -0.1, -0.1, handPlug, 6).rotation.x = 0.8;
  function parcelForm(oid) { var o = oid ? orderById(oid) : null; return o && o.form || null; }   // the crate, strap or bag the deck gave it, kept on the order
  function formMat(f) { return f === 'crate' ? MAT.crate : f === 'strap' ? MAT.strapped : f === 'pouch' ? MAT.airbox : MAT.parcel; }
  function updateHandMesh() { var h = S.hand; handBox.visible = !!(h && h.kind === 'box'); handParcel.visible = !!(h && h.kind === 'parcel'); if (h && h.kind === 'box') handBox.material = CARD[h.sku] || CARD.paint; if (h && h.kind === 'parcel') handParcel.material = formMat(parcelForm(h.order)); }
  function handSet(h) { S.hand = h; hudDirty = true; updateHandMesh(); }
  function handLabel() { var h = S.hand; if (!h) return null; if (h.kind === 'box') return { t: (h.damaged ? 'A damaged box of ' : 'A box of ') + skuName(h.sku), s: h.damaged ? 'bin it by the bench' : 'G puts it down' }; var o = orderById(h.order); return { t: 'Parcel #' + (o ? o.num : '?'), s: o ? 'for ' + clientName(o.client) + ' · G puts it down' : '' }; }

  // ── Rack slots ────────────────────────────────────────────────────
  function slotGet(key) { return S.slots[key] || null; }
  function slotSpace(key, sku) { var s = S.slots[key]; if (!s || !s.n) return ECON.slotCap; if (s.sku !== sku) return 0; return ECON.slotCap - s.n; }
  function slotAdd(key, sku, n) { var s = S.slots[key]; if (!s || !s.n) S.slots[key] = { sku: sku, n: n, pal: !!(s && s.pal) }; else s.n += n; }
  function slotTake(key, n) { var s = S.slots[key]; if (!s) return 0; var k = Math.min(n, s.n); s.n -= k; if (s.n <= 0) { if (s.pal) s.n = 0; else delete S.slots[key]; } return k; }   // a slot that held a pallet keeps the empty pallet
  function slotOwned(key) { var r = slotParse(key).r; return r < S.up.rows || (r === UPPER.row && upperRowsOwned() > 0) || annexRowOwned(r); }
  function stockCount(sku) { var n = 0; for (var k in S.slots) if (S.slots[k].sku === sku) n += S.slots[k].n; return n; }
  function totalStock() { var n = 0; for (var k in S.slots) n += S.slots[k].n; return n; }
  function stockSummary() { var m = {}; for (var k in S.slots) { var s = S.slots[k]; if (!s.n) continue; m[s.sku] = (m[s.sku] || 0) + s.n; } return m; }
  function slotsWith(sku) { var out = []; for (var k in S.slots) if (S.slots[k].sku === sku && S.slots[k].n > 0) out.push(k); out.sort(function (a, b) { return slotParse(a).l - slotParse(b).l; }); return out; }
  // the best slot for n boxes of a sku: a slot that already holds that sku and has the room, else an empty one; low levels first
  function findSlotFor(sku, n, maxLevel) {
    var best = null, bestScore = -1;
    var rows = groundRows();   // the main rows you own and the rows of the halls you own; the main rows fill first
    for (var ri = 0; ri < rows.length; ri++) for (var b = 0; b < rowBays(rows[ri]); b++) for (var l = 0; l <= maxLevel; l++) {
      var r = rows[ri], key = slotKey(r, b, l), s = S.slots[key], space = slotSpace(key, sku); if (space < n) continue;
      var score = (s && s.n ? 100 : 50) - l * 10 - b - (isAnnexRow(r) ? 30 : 0);
      if (score > bestScore) { bestScore = score; best = key; }
    }
    return best;
  }
  function jackReach(l) { return l <= (S.up.jackLift ? 1 : 0); }   // the floor level by hand; the second level too with the high-lift stacker; the top is forklift work
  function jackReachText() { return S.up.jackLift ? 'The stacker reaches the second level, not the top' : 'The jack only reaches the floor level'; }
  function slotPrompt(key) {
    var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
    if (p.l === RACK.top && !driving) return has ? skuName(s.sku) + ' × ' + s.n + ' · top level: forklift only' : 'Top level: forklift only';
    if (tool === 'cart') { if (has && cartLoad() < ECON.cartCap) return 'Pick a box of ' + skuName(s.sku) + ' onto the cart (' + s.n + ' here)'; return has ? 'Cart is full' : null; }
    if (tool === 'jack') { var jp = jackPallet(); if (jp) return jackReach(p.l) ? (slotSpace(key, jp.sku) >= jp.n ? 'Set the pallet into the rack' : (has ? 'Slot holds ' + skuName(s.sku) + ': no room' : null)) : jackReachText(); return has && jackReach(p.l) ? 'Pull the pallet out (' + Math.min(s.n, ECON.palletCap) + ' boxes)' : (s && s.pal && jackReach(p.l) ? 'Take the empty pallet out' : null); }
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'A damaged box does not go on the rack: bin it';
    if (S.hand && S.hand.kind === 'box') return slotSpace(key, S.hand.sku) > 0 ? 'Put the box on the rack' + (has ? ' (' + s.n + ' here)' : '') : 'Slot holds ' + skuName(s.sku) + ': no room';
    if (S.hand) return null;
    return has ? 'Take a box of ' + skuName(s.sku) + ' (' + s.n + ' here)' : 'Empty slot · ' + slotName(key);
  }
  function slotUse(key) {
    var p = slotParse(key), s = S.slots[key], has = s && s.n > 0, tool = player.tool;
    if (p.l === RACK.top && !driving) { toast('Too high. Use the forklift.', 'bad'); return; }
    if (tool === 'cart') { if (has && cartLoad() < ECON.cartCap) { S.cart.boxes.push(s.sku); slotTake(key, 1); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); } return; }
    if (isJack(tool)) {
      var jp = jackPallet(tool);
      if (jp) { if (!jackReach(p.l)) { toast(jackReachText() + '.', 'bad'); return; } if (storePallet(jp, key)) { S[tool].pallet = null; sfx('crate'); addXp(XP.pallet); toast('Pallet stored · ' + slotName(key), 'good'); introStep('putaway'); } else toast('No room in that slot.', 'bad'); return; }
      if (has && jackReach(p.l)) { var np = pullPallet(key); if (np) { np.place = 'jack'; np.jack = tool; S[tool].pallet = np.id; sfx('jack'); } }
      else if (s && s.pal && jackReach(p.l)) { delete S.slots[key]; var ep = newPallet(s.sku, 0, { place: 'jack', jack: tool }); S[tool].pallet = ep.id; sfx('jack'); }
      return;
    }
    if (!S.hand && has && s.wrapped) s.wrapped = false;   // cutting the film to take a box
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. The bin is by the bench.', 'bad'); return; }
    if (S.hand && S.hand.kind === 'box') { if (slotSpace(key, S.hand.sku) > 0) { slotAdd(key, S.hand.sku, 1); handSet(null); sfx('putdown'); S.stats.putaway++; addXp(XP.box); introStep('putaway'); } else toast('No room: that slot holds ' + skuName(s.sku) + '.', 'bad'); return; }
    if (S.hand) return;
    if (has) { slotTake(key, 1); handSet({ kind: 'box', sku: s.sku }); sfx('pickup'); S.stats.picked++; addXp(XP.box); introStep('pick'); }
  }

  // ── Pallets ───────────────────────────────────────────────────────
  function palletById(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) return S.pallets[i]; return null; }
  function newPallet(sku, n, props) { var p = { id: uid('pl'), sku: sku, n: n, place: 'floor', x: 0, y: 0, z: 0, rot: 0 }; for (var k in props) p[k] = props[k]; S.pallets.push(p); return p; }
  function removePallet(id) { for (var i = 0; i < S.pallets.length; i++) if (S.pallets[i].id === id) { S.pallets.splice(i, 1); return; } }
  function storePallet(p, key) { if (!slotOwned(key) || slotSpace(key, p.sku) < p.n) return false; slotAdd(key, p.sku, p.n); S.slots[key].pal = true; S.slots[key].wrapped = !!p.wrapped; S.stats.putaway += p.n; removePallet(p.id); return true; }
  function pullPallet(key) { var s = S.slots[key]; if (!s || !s.n) return null; var sku = s.sku, n = Math.min(s.n, ECON.palletCap), wrapped = !!s.wrapped; slotTake(key, n); if (S.slots[key] && S.slots[key].n <= 0) delete S.slots[key]; return newPallet(sku, n, { place: 'floor', wrapped: wrapped }); }   // the pallet under the boxes goes with them; an empty one used to stay behind, to be pulled again and again
  function jackPallet(tool) { var t = tool || jackTool(), js = S[t]; return js && js.pallet ? palletById(js.pallet) : null; }
  function forkPallet() { return S.fork.pallet ? palletById(S.fork.pallet) : null; }
  // what the cart could put on this pallet: boxes of the pallet's line, or of the line the cart holds most of when the pallet is empty
  function cartUnloadable(p) { var cb = S.cart.boxes; if (!cb.length || p.n >= 12) return { n: 0 }; var sku = p.sku; if (p.n === 0) { var cnt = {}; cb.forEach(function (s) { cnt[s] = (cnt[s] || 0) + 1; }); sku = null; for (var k in cnt) if (!sku || cnt[k] > cnt[sku]) sku = k; } var n = cb.filter(function (s) { return s === sku; }).length; return { n: Math.min(n, 12 - p.n), sku: sku }; }
  function palletPrompt(src) {
    var p = palletById(src.id); if (!p || src.carried) return null;
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t || t.state !== 'docked') return null; if (!t.signed) return 'Sign the delivery note with ' + t.driver + ' first'; }
    if (isJack(player.tool)) return jackPallet() ? null : (p.n > 0 ? 'Lift the pallet with the jack (' + p.n + ' × ' + skuName(p.sku) + ')' : 'Lift the empty pallet with the jack');
    if (player.tool === 'cart') { var cu = cartUnloadable(p); if (cu.n) return 'Unload ' + cu.n + ' × ' + skuName(cu.sku) + ' from the cart onto the pallet'; if (p.n === 0) return 'Empty pallet · boxes on the cart go onto it'; return cartLoad() < ECON.cartCap ? 'Take a box of ' + skuName(p.sku) + ' onto the cart (' + p.n + ' left)' : 'Cart is full'; }
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return p.n === 0 ? 'A damaged box does not go on a pallet: bin it' : null;
    if (S.hand && S.hand.kind === 'box' && (p.n === 0 || S.hand.sku === p.sku) && p.n < 12) return p.n === 0 ? 'Put the box on the empty pallet' : 'Put the box back on the pallet';
    if (S.hand) return null;
    if (p.n === 0) return 'Empty pallet' + (p.place === 'floor' ? ' · the jack lifts it, loose boxes go on it by hand' : '');
    return 'Take a box of ' + skuName(p.sku) + ' off the pallet (' + p.n + ' left)';
  }
  function palletUse(src) {
    var p = palletById(src.id); if (!p || src.carried) return;
    if (p.place === 'truck') { var t = truckById(p.truck); if (!t || t.state !== 'docked') return; if (!t.signed) { toast('Sign the delivery note with the driver first. He is by the dock outside.', 'bad'); return; } }
    if (isJack(player.tool)) { if (!jackPallet()) { if (p.place === 'truck') { onPalletLeftTruck(p); } var jt = jackTool(); p.place = 'jack'; p.jack = jt; S[jt].pallet = p.id; sfx('jack'); introStep('unload'); } return; }
    var take = function () { if (p.place === 'truck') onPalletLeftTruck(p); p.n--; p.wrapped = false; S.stats.picked++; addXp(XP.box); if (p.n <= 0) { p.n = 0; if (p.place === 'truck') toast('That pallet is empty: take it out with the jack, or the truck takes it back', ''); } introStep('unload'); };
    if (player.tool === 'cart') { var cu2 = cartUnloadable(p); if (cu2.n) { for (var ci = S.cart.boxes.length - 1; ci >= 0 && p.n < 12; ci--) if (S.cart.boxes[ci] === cu2.sku) { S.cart.boxes.splice(ci, 1); p.sku = cu2.sku; p.n++; } sfx('putdown'); hudDirty = true; return; } if (p.n === 0) { sfx('click'); return; } if (cartLoad() < ECON.cartCap) { S.cart.boxes.push(p.sku); take(); sfx('pickup'); } return; }
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. The bin is by the bench.', 'bad'); return; }
    if (S.hand && S.hand.kind === 'box' && (p.n === 0 || S.hand.sku === p.sku) && p.n < 12) { if (p.n === 0) p.sku = S.hand.sku; p.n++; handSet(null); sfx('putdown'); return; }
    if (S.hand) return;
    if (p.n === 0) { sfx('click'); return; }
    handSet({ kind: 'box', sku: p.sku }); take(); sfx('pickup');
  }

  // ── The floor ─────────────────────────────────────────────────────
  // the drop marker: while you hold a box or a parcel, a ghost of it and a ring on the floor show where G will set it down
  var dropMarker = (function () { var g = new THREE.Group(); g.userData.dynamic = true; g.visible = false; scene.add(g); var mk = function (col) { return new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false }); }; var ok = mk(0x5fd38d), bad = mk(0xff6b5e); var box = new THREE.Mesh(BOX_GEO, ok); box.renderOrder = 3; g.add(box); var par = new THREE.Mesh(PARCEL_GEO, ok); par.renderOrder = 3; g.add(par); var ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.5, 28), ok); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; ring.renderOrder = 3; g.add(ring); return { g: g, box: box, par: par, ring: ring, ok: ok, bad: bad }; })();
  function dropPoint() { var fx = Math.sin(player.yaw), fz = Math.cos(player.yaw), x = player.x - fx * 0.9, z = player.z - fz * 0.9, good = true; if (!insideHall(x, z) && floorY(x, z) < -0.5) { x = player.x; z = player.z; good = false; } return { x: x, z: z, y: floorY(x, z), good: good }; }
  function updateDropMarker() { var h = S.hand, show = !!h && ui.started && !driving && !edit.on && !pc.on; dropMarker.g.visible = show; if (!show) return; var d = dropPoint(), m = d.good ? dropMarker.ok : dropMarker.bad, pulse = 0.28 + 0.12 * Math.sin(worldTime * 5); m.opacity = pulse; dropMarker.box.material = dropMarker.par.material = dropMarker.ring.material = m; dropMarker.box.visible = h.kind === 'box'; dropMarker.par.visible = h.kind === 'parcel'; dropMarker.g.position.set(d.x, d.y, d.z); dropMarker.g.rotation.y = player.yaw; dropMarker.box.position.y = BOX.h / 2; dropMarker.par.position.y = 0.2; }
  function dropAhead(item) {
    var d = dropPoint(); item.x = d.x; item.z = d.z; item.y = d.y; item.rot = player.yaw; S.floor.push(item);
  }
  function floorPrompt(src) { var f = S.floor[src.idx]; if (!f) return null; if (f.kind === 'box') { if (player.tool === 'cart') return cartLoad() < ECON.cartCap && !f.damaged ? 'Put the box on the cart' : null; return S.hand || player.tool ? null : (f.damaged ? 'Pick up the damaged box (it goes in the bin)' : 'Pick up the box of ' + skuName(f.sku)); } var o = orderById(f.order); return S.hand || player.tool ? null : 'Pick up parcel #' + (o ? o.num : '?'); }
  function floorUse(src) {
    var f = S.floor[src.idx]; if (!f) return;
    if (f.kind === 'box') { if (player.tool === 'cart') { if (f.damaged) { toast('Damaged: carry it to the bin by hand.', 'bad'); return; } if (S.cart.boxes.length >= ECON.cartCap) return; S.cart.boxes.push(f.sku); } else if (S.hand || player.tool) return; else handSet({ kind: 'box', sku: f.sku, damaged: !!f.damaged }); }
    else { if (S.hand || player.tool) return; handSet({ kind: 'parcel', order: f.order }); }
    S.floor.splice(src.idx, 1); sfx('pickup');
  }
  function putDown() {
    if (player.tool) { releaseTool(); return; }
    if (!S.hand) return;
    var h = S.hand; handSet(null);
    if (h.kind === 'box') { var dmg = h.damaged || (!player.grounded && Math.random() < 0.6); if (dmg && !h.damaged) { toast('That box landed badly.', 'bad'); burst(player.x, 0.4, player.z, 0xc69c6d, 10, 'out'); sfx('crate'); } dropAhead({ kind: 'box', sku: h.sku, damaged: dmg }); } else dropAhead({ kind: 'parcel', order: h.order });
    sfx('putdown');
  }
