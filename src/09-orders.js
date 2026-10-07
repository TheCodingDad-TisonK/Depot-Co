//@ orders: clients, order generation, the packing bench, parcels, shipping and pay
  // ── Orders ────────────────────────────────────────────────────────
  function clientName(id) { for (var i = 0; i < CLIENTS.length; i++) if (CLIENTS[i].id === id) return CLIENTS[i].name; return id || 'Walk-in'; }
  function orderById(id) { for (var i = 0; i < S.orders.length; i++) if (S.orders[i].id === id) return S.orders[i]; return null; }
  function unlockedSkus() { var tier = tierFor(S.level); return SKUS.filter(function (s) { return s.tier <= tier; }).map(function (s) { return s.id; }); }
  function openOrders() { return S.orders.filter(function (o) { return o.state === 'open'; }); }
  function activeClients() { return CLIENTS.filter(function (c) { return !c.deck || sorterOwned(); }); }   // the deck accounts wait for the sortation deck
  function dueText(abs) { var day = Math.floor(abs / 24), t = abs % 24; return fmtTime(t) + (day > S.day ? ' tomorrow' : day < S.day ? ' (overdue)' : ''); }
  function nextOutLeave(minAbs, dock) {   // the next departure from one dock (the order's lane), or from any dock you own
    for (var d = 0; d < 4; d++) for (var k = 0; k < TRUCK_OUT.length; k++) { if ((dock !== undefined && k !== dock) || !dockOwned(k)) continue; var ws = TRUCK_OUT[k].windows; for (var w = 0; w < ws.length; w++) { var abs = (S.day + d) * 24 + ws[w].leave; if (abs >= minAbs) return abs; } }
    return minAbs + 24;
  }
  // What an order may ask for: stock on site (the racks, the bench, the floor, the cart, and the pallets on a signed truck) less
  // what the open orders already claim. An order is never written for boxes that are not here, and never for boxes another
  // order is still waiting on, so two orders cannot want the same six tins and a pick is never surplus the moment it is made.
  function freeStock() {
    var free = {}; function add(sku, n) { free[sku] = (free[sku] || 0) + n; }
    for (var k in S.slots) if (S.slots[k].n) add(S.slots[k].sku, S.slots[k].n);
    for (var b in S.bench.boxes) add(b, S.bench.boxes[b]);
    S.pallets.forEach(function (p) { if (p.n <= 0 || !p.sku || (SKU[p.sku] && SKU[p.sku].raw)) return; if (p.place === 'truck') { var t = truckById(p.truck); if (!t || t.state !== 'docked' || !t.signed) return; } add(p.sku, p.n); });
    S.floor.forEach(function (f) { if (f.kind === 'box' && !f.damaged) add(f.sku, 1); });
    (S.cart && S.cart.boxes || []).forEach(function (s) { add(s, 1); });
    S.orders.forEach(function (o) { if (o.state === 'open' || o.state === 'packing') o.lines.forEach(function (l) { add(l.sku, -(l.qty - (l.packed || 0))); }); });
    return free;
  }
  // what the open orders still want that is not on the bench yet, and what sits on the bench that no open order wants
  function benchNeed() { var need = {}; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { need[l.sku] = (need[l.sku] || 0) + l.qty; }); }); for (var k in S.bench.boxes) need[k] = (need[k] || 0) - S.bench.boxes[k]; for (var q in need) if (need[q] <= 0) delete need[q]; return need; }
  function benchSurplus() { var want = {}; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { want[l.sku] = (want[l.sku] || 0) + l.qty; }); }); var sur = {}; for (var k in S.bench.boxes) { var n = S.bench.boxes[k] - (want[k] || 0); if (n > 0) sur[k] = n; } return sur; }
  function genOrder(rush) {
    var free = freeStock(), avail = unlockedSkus().filter(function (s) { return (free[s] || 0) > 0; }); if (!avail.length) return null;
    var client = S.contract && S.contract.accepted && Math.random() < 0.5 ? CLIENTS.filter(function (c) { return c.id === S.contract.client; })[0] : pick(activeClients()), pool = client.likes.filter(function (s) { return avail.indexOf(s) >= 0; }); if (!pool.length) { pool = avail; }
    var nLines = client.deck ? randi(2, 4) : randi(1, Math.min(3, 1 + Math.floor(S.level / 2) + (Math.random() < 0.35 ? 1 : 0)));   // a deck account orders two to four lines
    var lines = [], used = {};
    for (var i = 0; i < nLines; i++) {
      // what the client likes and you have free, else anything you have free; never more of a line than is free
      var liked = pool.filter(function (s) { return !used[s] && free[s] > 0; }), any = avail.filter(function (s) { return !used[s] && free[s] > 0; });
      var from = liked.length && (i === 0 || Math.random() < 0.85) ? liked : any;
      if (!from.length) break;
      var sku = pick(from); used[sku] = 1;
      var qty = client.deck ? clamp(randi(2, 8), 1, Math.min(8, free[sku])) : clamp(randi(1, 2 + Math.floor(S.level / 2)), 1, Math.min(6, free[sku])); free[sku] -= qty;
      lines.push({ sku: sku, qty: qty });
    }
    if (!lines.length) return null;
    var value = 0; lines.forEach(function (l) { value += l.qty * SKU[l.sku].val; });
    var mode = clientMode(client.id), due = rush ? nowAbs() + 2 : nextOutLeave(nowAbs() + 1.5, MODES[mode].door - 2);   // due at the next truck of its own lane
    var o = { id: uid('or'), num: S.orderSeq++, client: client.id, mode: mode, lines: lines, created: nowAbs(), due: due, state: 'open', pay: Math.round((value * ECON.margin + ECON.handling) * (mode === 'air' ? AIR_RATE : 1) * (client.deck ? DECK_RATE : 1)) * (rush ? 2 : 1), rush: !!rush, late: false, short: false };
    S.orders.push(o);
    logEvent('Order #' + o.num + ' from ' + client.name + ' (' + MODES[mode].name.toUpperCase() + ' lane, ' + dockLabel(MODES[mode].door) + '): ' + lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + (rush ? ' · RUSH, due ' + fmtTime(due) : ''), 'rare');
    sfx('chime'); rebuildBoardSoon(); introStep('order'); hudDirty = true;
    return o;
  }
  // contracts: every few days a client offers a run; every order of theirs shipped on time in the window counts
  function offerContract() {
    var client = pick(activeClients()), need = 3 + Math.floor(S.level / 2), days = 3;
    S.contract = { client: client.id, need: need, done: 0, until: (S.day + days) * 24 + 18, bonus: need * 60 + S.level * 40, penalty: 150, accepted: false, offeredDay: S.day };
    logEvent(client.name + ' offers a contract: ' + need + ' orders on time in ' + days + ' days for a ' + money(S.contract.bonus) + ' bonus. Accept it on the office PC.', 'rare'); toast('Contract offer from ' + client.name + ' on the PC', 'rare'); sfx('chime');
  }
  function contractTick() {
    var c = S.contract; if (!c) { if (S.level >= 3 && S.day >= S.nextOffer && S.time >= 9 && S.time < 9.2 && !isSunday()) offerContract(); return; }
    if (!c.accepted && S.day > c.offeredDay) { S.contract = null; S.nextOffer = S.day + 2; logEvent('The contract offer from ' + clientName(c.client) + ' lapsed'); return; }
    if (c.accepted && nowAbs() > c.until) {
      if (c.done >= c.need) { pay(c.bonus, 'Contract bonus, ' + clientName(c.client)); addRep(6); toast('Contract complete: ' + money(c.bonus) + ' bonus', 'rare'); logEvent('Contract with ' + clientName(c.client) + ' complete: ' + money(c.bonus) + ' bonus', 'rare'); sfx('fanfare'); addXp(40); }
      else { pay(-c.penalty, 'Contract penalty, ' + clientName(c.client)); addRep(-4); toast('Contract missed: ' + c.done + ' of ' + c.need + '. Penalty ' + money(c.penalty), 'bad'); logEvent('Contract with ' + clientName(c.client) + ' missed (' + c.done + ' of ' + c.need + ')', 'bad'); }
      S.contract = null; S.nextOffer = S.day + randi(2, 4);
    }
  }
  function tickOrders() {
    var n = nowAbs();
    if (Math.floor(S.time * 5) !== S.flags.ctQ) { S.flags.ctQ = Math.floor(S.time * 5); contractTick(); }
    if (S.time >= 8 && S.time < 17 && !S.events.power && !isSunday()) {
      var openN = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed'; }).length;
      var maxOpen = 3 + S.level, gap = Math.max(0.8, 2.3 - S.level * 0.12);
      // the first order waits for stock: until something is on site and signed for there is nothing a client can order
      if (S.day === 1 && !S.flags.firstOrder) { if (S.time >= 8.5 && n - (S.flags.firstTry || 0) >= 0.1) { S.flags.firstTry = n; if (genOrder(false)) { S.flags.firstOrder = 1; S.lastOrderAt = n; } } }
      else if (openN < maxOpen && n - S.lastOrderAt >= gap && !S.flags.noOrders) { S.lastOrderAt = n + randf(-0.3, 0.3); genOrder(Math.random() < 0.12 && S.level >= 3); }
    }
    for (var i = S.orders.length - 1; i >= 0; i--) {
      var o = S.orders[i];
      if ((o.state === 'open' || o.state === 'packing' || o.state === 'packed') && !o.late && n > o.due) { o.late = true; addRep(-1); logEvent('Order #' + o.num + ' is late', 'bad'); rebuildBoardSoon(); }
      if (o.state === 'open' && n > o.due + 30) { S.orders.splice(i, 1); addRep(-3); S.stats.late++; logEvent(clientName(o.client) + ' cancelled order #' + o.num, 'bad'); toast('Order #' + o.num + ' cancelled', 'bad'); rebuildBoardSoon(); }
    }
  }

  // ── The packing bench ─────────────────────────────────────────────
  function benchCount() { var n = 0; for (var k in S.bench.boxes) n += S.bench.boxes[k] || 0; return n; }
  function benchAdd(sku, n) { S.bench.boxes[sku] = (S.bench.boxes[sku] || 0) + n; }
  function benchTake(sku, n) { var k = Math.min(n, S.bench.boxes[sku] || 0); if (!k) { delete S.bench.boxes[sku]; return 0; } S.bench.boxes[sku] -= k; if (S.bench.boxes[sku] <= 0) delete S.bench.boxes[sku]; return k; }   /* a SKU the bench never held used to go undefined minus zero, NaN, and the terminal read NaN / 16 */
  // what the cart would do at the bench: the boxes the orders still want come off it, and the bench's surplus goes onto it
  function cartAtBench() { var need = benchNeed(), off = 0, on = 0, room = ECON.benchCap - benchCount(); S.cart.boxes.forEach(function (sku) { if ((need[sku] || 0) > 0 && off < room) { need[sku]--; off++; } }); var sur = benchSurplus(); for (var k in sur) on += sur[k]; on = Math.min(on, ECON.cartCap - (cartLoad() - off)); return { off: off, on: Math.max(0, on) }; }
  function benchPrompt() {
    if (player.tool === 'cart') { var c = cartAtBench(); return (c.off ? 'Unload ' + c.off + ' wanted ' + (c.off === 1 ? 'box' : 'boxes') : '') + (c.off && c.on ? ', ' : '') + (c.on ? 'take ' + c.on + ' surplus back on the cart' : '') || 'Packing bench · nothing on the cart the orders want'; }
    if (isJack(player.tool)) return null;
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'Damaged boxes do not ship: bin it';
    if (S.hand && S.hand.kind === 'box') return benchCount() < ECON.benchCap ? 'Put the box on the bench' : 'The bench is full';
    if (S.hand) return null;
    var sur = benchSurplus(), sn = 0; for (var k in sur) sn += sur[k];
    return 'Packing bench · ' + benchCount() + ' boxes · ' + openOrders().length + ' open orders' + (sn ? ' · ' + sn + ' surplus (look at a box to take it back)' : '');
  }
  function benchUse() {
    if (player.tool === 'cart') {
      // the boxes the open orders still want come off the cart; the surplus on the bench goes onto the cart, to go back on the racks
      var need = benchNeed(), off = 0, on = 0;
      for (var i = S.cart.boxes.length - 1; i >= 0; i--) { var sku = S.cart.boxes[i]; if ((need[sku] || 0) > 0 && benchCount() < ECON.benchCap) { S.cart.boxes.splice(i, 1); benchAdd(sku, 1); need[sku]--; off++; } }
      var sur = benchSurplus(); for (var k in sur) while (sur[k] > 0 && cartLoad() < ECON.cartCap) { benchTake(k, 1); S.cart.boxes.push(k); sur[k]--; on++; }
      if (off || on) { sfx('putdown'); introStep('bench'); toast((off ? off + ' onto the bench' : '') + (off && on ? ' · ' : '') + (on ? on + ' surplus onto the cart' : ''), 'good'); hudDirty = true; }
      else if (S.cart.boxes.length) toast(benchCount() >= ECON.benchCap ? 'The bench is full.' : 'No open order wants what is on the cart. Put it back on the racks.', 'bad');
      else toast('Nothing surplus on the bench.', '');
      return;
    }
    if (isJack(player.tool)) return;
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. Bin it.', 'bad'); return; }
    if (S.hand && S.hand.kind === 'box') { if (benchCount() >= ECON.benchCap) { toast('The bench is full.', 'bad'); return; } benchAdd(S.hand.sku, 1); handSet(null); sfx('putdown'); introStep('bench'); return; }
    if (S.hand) return;
    sfx('click'); toast('Look at a box on the bench and press E to take it back. The terminal at the end packs the orders.', '');
  }
  // a box on the bench is a thing you look at: E takes it back into your hand (or onto the cart)
  function benchBoxPrompt(src) {
    var sku = src.sku, sur = benchSurplus()[sku] || 0, tag = sur ? ' · surplus, no order wants it' : ' · an open order wants it';
    if (player.tool === 'cart') return cartLoad() < ECON.cartCap ? 'Put the box of ' + skuName(sku) + ' on the cart' + tag : 'The cart is full';
    if (S.hand && S.hand.kind === 'box' && !S.hand.damaged) return benchCount() < ECON.benchCap ? 'Put the box on the bench' : 'The bench is full';
    if (S.hand || player.tool) return null;
    return 'Take the box of ' + skuName(sku) + ' off the bench' + tag;
  }
  function benchBoxUse(src) {
    var sku = src.sku;
    if (player.tool === 'cart') { if (cartLoad() >= ECON.cartCap) { sfx('bad'); return; } if (benchTake(sku, 1)) { S.cart.boxes.push(sku); sfx('pickup'); hudDirty = true; } return; }
    if (S.hand && S.hand.kind === 'box' && !S.hand.damaged) { benchUse(); return; }
    if (S.hand || player.tool) return;
    if (benchTake(sku, 1)) { handSet({ kind: 'box', sku: sku }); sfx('pickup'); }
  }
  function orderNeed(o) { var tot = 0, have = 0; o.lines.forEach(function (l) { tot += l.qty; have += Math.min(l.qty, S.bench.boxes[l.sku] || 0); }); return { tot: tot, have: have }; }
  function canPack(o) { return o.state === 'open' && o.lines.every(function (l) { return (S.bench.boxes[l.sku] || 0) >= l.qty; }); }
  function canPackShort(o) { var n = orderNeed(o); return o.state === 'open' && n.have >= Math.ceil(n.tot / 2) && n.have < n.tot; }
  function shelfPrompt(src) { var o = orderById(src.order); if (player.tool === 'cart') return cartLoad() < ECON.cartCap ? 'Load parcel #' + (o ? o.num : '?') + ' onto the cart (' + cartLoadText() + ')' : 'The cart is full'; if (S.hand || player.tool) return null; return 'Pick up parcel #' + (o ? o.num : '?') + (o ? ' for ' + clientName(o.client) : ''); }
  function shelfUse(src) { if (player.tool === 'cart') { if (cartLoad() >= ECON.cartCap) { sfx('bad'); return; } var kc = S.bench.parcels.indexOf(src.order); if (kc < 0) return; S.bench.parcels.splice(kc, 1); cartParcels().push(src.order); sfx('pickup'); hudDirty = true; return; } if (S.hand || player.tool) return; var k = S.bench.parcels.indexOf(src.order); if (k < 0) return; S.bench.parcels.splice(k, 1); handSet({ kind: 'parcel', order: src.order }); sfx('pickup'); }

  // ── Shipping ──────────────────────────────────────────────────────
  function shipOrder(o, door) {   // door: the outbound door the parcel left by; the wrong lane's door pays the forwarding fee
    var late = nowAbs() > o.due, m = orderMode(o), wrong = door !== undefined && MODES[m].door !== door, amount = Math.round(o.pay * (o.short ? ECON.shortCut : 1) * (late ? ECON.lateCut : 1) * (wrong ? MODE_FEE : 1));
    if (wrong) S.stats.misrouted = (S.stats.misrouted || 0) + 1;
    pay(amount, 'Order #' + o.num + ' shipped to ' + clientName(o.client) + (late ? ' (late)' : '') + (o.short ? ' (short)' : '') + (wrong ? ' (' + m + ' parcel out of ' + dockLabel(door) + ': forwarding fee)' : ''));
    if (!late && S.contract && S.contract.accepted && S.contract.client === o.client) { S.contract.done++; feedPush('Contract: ' + S.contract.done + ' of ' + S.contract.need, 'good'); }
    addRep(late ? -1 : o.rush ? 3 : 1.5); S.stats.shipped++; if (late) S.stats.late++; addXp(XP.ship);
    o.state = 'shipped'; o.shippedAt = nowAbs(); o.paid = amount;
    for (var i = 0; i < S.orders.length; i++) if (S.orders[i] === o) { S.orders.splice(i, 1); break; }
    S.shipped.unshift({ num: o.num, client: o.client, paid: amount, late: late, short: o.short, day: S.day, mode: m, wrong: wrong }); if (S.shipped.length > 40) S.shipped.pop();
    sfx('cash'); hudDirty = true;
    return amount;
  }
  // a packed order whose parcel was lost (dropped off the dock, say) is a short ship with nothing in it: never happens by design, but the save must not keep ghosts
  function parcelExists(oid) {
    if (S.bench.parcels.indexOf(oid) >= 0) return true;
    if (S.hand && S.hand.kind === 'parcel' && S.hand.order === oid) return true;
    if (S.floor.some(function (f) { return f.kind === 'parcel' && f.order === oid; })) return true;
    if (S.trucks.some(function (t) { return t.parcels.indexOf(oid) >= 0; })) return true;
    if (S.staff.some(function (st) { return st.carry && st.carry.kind === 'parcel' && st.carry.order === oid; })) return true;
    if ((S.cart.parcels || []).indexOf(oid) >= 0) return true;
    if (S.pack && S.pack.out === oid) return true;
    for (var bk in (S.belts || {})) if (S.belts[bk].some(function (it) { return it.kind === 'parcel' && it.order === oid; })) return true;   // riding any belt, built-in or a piece
    for (var sk in (S.stage || {})) if (S.stage[sk].indexOf(oid) >= 0) return true;   // staged beside a dock loader
    return false;
  }
