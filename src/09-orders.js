//@ orders: clients, order generation, the packing bench, parcels, shipping and pay
  // ── Orders ────────────────────────────────────────────────────────
  function clientName(id) { for (var i = 0; i < CLIENTS.length; i++) if (CLIENTS[i].id === id) return CLIENTS[i].name; return id || 'Walk-in'; }
  function orderById(id) { for (var i = 0; i < S.orders.length; i++) if (S.orders[i].id === id) return S.orders[i]; return null; }
  function unlockedSkus() { var tier = tierFor(S.level); return SKUS.filter(function (s) { return s.tier <= tier; }).map(function (s) { return s.id; }); }
  function openOrders() { return S.orders.filter(function (o) { return o.state === 'open'; }); }
  function dueText(abs) { var day = Math.floor(abs / 24), t = abs % 24; return fmtTime(t) + (day > S.day ? ' tomorrow' : day < S.day ? ' (overdue)' : ''); }
  function nextOutLeave(minAbs) {
    for (var d = 0; d < 3; d++) for (var k = 0; k < TRUCK_OUT.length; k++) { var abs = (S.day + d) * 24 + TRUCK_OUT[k].leave; if (abs >= minAbs) return abs; }
    return minAbs + 24;
  }
  function genOrder(rush) {
    var avail = unlockedSkus().filter(function (s) { return S.seenSkus.indexOf(s) >= 0; }); if (!avail.length) avail = unlockedSkus();
    var inStock = avail.filter(function (s) { return stockCount(s) > 0; });
    var client = S.contract && S.contract.accepted && Math.random() < 0.5 ? CLIENTS.filter(function (c) { return c.id === S.contract.client; })[0] : pick(CLIENTS), pool = client.likes.filter(function (s) { return avail.indexOf(s) >= 0; }); if (!pool.length) { pool = avail; }
    var nLines = randi(1, Math.min(3, 1 + Math.floor(S.level / 2) + (Math.random() < 0.35 ? 1 : 0)));
    var lines = [], used = {};
    for (var i = 0; i < nLines; i++) {
      // what the client likes and you stock, else anything you stock, else (rarely, and never for the first line) what the client likes
      var likedStocked = pool.filter(function (s) { return inStock.indexOf(s) >= 0 && !used[s]; }), anyStocked = inStock.filter(function (s) { return !used[s]; }), liked = pool.filter(function (s) { return !used[s]; });
      var from = likedStocked.length ? likedStocked : anyStocked.length && (i === 0 || Math.random() < 0.85) ? anyStocked : liked;
      if (!from.length) break;
      var sku = pick(from); used[sku] = 1;
      lines.push({ sku: sku, qty: clamp(randi(1, 2 + Math.floor(S.level / 2)), 1, 6) });
    }
    if (!lines.length) return null;
    var value = 0; lines.forEach(function (l) { value += l.qty * SKU[l.sku].val; });
    var due = rush ? nowAbs() + 2 : nextOutLeave(nowAbs() + 1.5);
    var o = { id: uid('or'), num: S.orderSeq++, client: client.id, lines: lines, created: nowAbs(), due: due, state: 'open', pay: Math.round(value * ECON.margin + ECON.handling) * (rush ? 2 : 1), rush: !!rush, late: false, short: false };
    S.orders.push(o);
    logEvent('Order #' + o.num + ' from ' + client.name + ': ' + lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + (rush ? ' · RUSH, due ' + fmtTime(due) : ''), 'rare');
    sfx('chime'); rebuildBoardSoon(); introStep('order'); hudDirty = true;
    return o;
  }
  // contracts: every few days a client offers a run; every order of theirs shipped on time in the window counts
  function offerContract() {
    var client = pick(CLIENTS), need = 3 + Math.floor(S.level / 2), days = 3;
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
      if (S.day === 1 && !S.flags.firstOrder && S.time >= 8.5) { S.flags.firstOrder = 1; S.lastOrderAt = n; genOrder(false); }
      else if (openN < maxOpen && n - S.lastOrderAt >= gap) { S.lastOrderAt = n + randf(-0.3, 0.3); genOrder(Math.random() < 0.12 && S.level >= 3); }
    }
    for (var i = S.orders.length - 1; i >= 0; i--) {
      var o = S.orders[i];
      if ((o.state === 'open' || o.state === 'packing' || o.state === 'packed') && !o.late && n > o.due) { o.late = true; addRep(-2); logEvent('Order #' + o.num + ' is late', 'bad'); rebuildBoardSoon(); }
      if (o.state === 'open' && n > o.due + 30) { S.orders.splice(i, 1); addRep(-5); S.stats.late++; logEvent(clientName(o.client) + ' cancelled order #' + o.num, 'bad'); toast('Order #' + o.num + ' cancelled', 'bad'); rebuildBoardSoon(); }
    }
  }

  // ── The packing bench ─────────────────────────────────────────────
  function benchCount() { var n = 0; for (var k in S.bench.boxes) n += S.bench.boxes[k]; return n; }
  function benchAdd(sku, n) { S.bench.boxes[sku] = (S.bench.boxes[sku] || 0) + n; }
  function benchTake(sku, n) { var k = Math.min(n, S.bench.boxes[sku] || 0); S.bench.boxes[sku] -= k; if (S.bench.boxes[sku] <= 0) delete S.bench.boxes[sku]; return k; }
  function benchPrompt() {
    if (player.tool === 'cart') return S.cart.boxes.length ? 'Unload the cart onto the bench (' + S.cart.boxes.length + ' boxes)' : 'Packing bench';
    if (player.tool === 'jack') return null;
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) return 'Damaged boxes do not ship: bin it';
    if (S.hand && S.hand.kind === 'box') return benchCount() < ECON.benchCap ? 'Put the box on the bench' : 'The bench is full';
    if (S.hand) return null;
    return 'Packing bench · ' + benchCount() + ' boxes · ' + openOrders().length + ' open orders';
  }
  function benchUse() {
    if (player.tool === 'cart') { var moved = 0; while (S.cart.boxes.length && benchCount() < ECON.benchCap) { benchAdd(S.cart.boxes.pop(), 1); moved++; } if (moved) { sfx('putdown'); introStep('bench'); } else if (S.cart.boxes.length) toast('The bench is full.', 'bad'); return; }
    if (player.tool === 'jack') return;
    if (S.hand && S.hand.kind === 'box' && S.hand.damaged) { toast('Damaged. Bin it.', 'bad'); return; }
    if (S.hand && S.hand.kind === 'box') { if (benchCount() >= ECON.benchCap) { toast('The bench is full.', 'bad'); return; } benchAdd(S.hand.sku, 1); handSet(null); sfx('putdown'); introStep('bench'); return; }
    if (S.hand) return;
    openPanel('bench');
  }
  function orderNeed(o) { var tot = 0, have = 0; o.lines.forEach(function (l) { tot += l.qty; have += Math.min(l.qty, S.bench.boxes[l.sku] || 0); }); return { tot: tot, have: have }; }
  function canPack(o) { return o.state === 'open' && o.lines.every(function (l) { return (S.bench.boxes[l.sku] || 0) >= l.qty; }); }
  function canPackShort(o) { var n = orderNeed(o); return o.state === 'open' && n.have >= Math.ceil(n.tot / 2) && n.have < n.tot; }
  function shelfPrompt(src) { var o = orderById(src.order); if (S.hand || player.tool) return null; return 'Pick up parcel #' + (o ? o.num : '?') + (o ? ' for ' + clientName(o.client) : ''); }
  function shelfUse(src) { if (S.hand || player.tool) return; var k = S.bench.parcels.indexOf(src.order); if (k < 0) return; S.bench.parcels.splice(k, 1); handSet({ kind: 'parcel', order: src.order }); sfx('pickup'); }

  // ── Shipping ──────────────────────────────────────────────────────
  function shipOrder(o) {
    var late = nowAbs() > o.due, amount = Math.round(o.pay * (o.short ? ECON.shortCut : 1) * (late ? ECON.lateCut : 1));
    pay(amount, 'Order #' + o.num + ' shipped to ' + clientName(o.client) + (late ? ' (late)' : '') + (o.short ? ' (short)' : ''));
    if (!late && S.contract && S.contract.accepted && S.contract.client === o.client) { S.contract.done++; feedPush('Contract: ' + S.contract.done + ' of ' + S.contract.need, 'good'); }
    addRep(late ? -1 : o.rush ? 3 : 1.5); S.stats.shipped++; if (late) S.stats.late++; addXp(XP.ship);
    o.state = 'shipped'; o.shippedAt = nowAbs(); o.paid = amount;
    for (var i = 0; i < S.orders.length; i++) if (S.orders[i] === o) { S.orders.splice(i, 1); break; }
    S.shipped.unshift({ num: o.num, client: o.client, paid: amount, late: late, short: o.short, day: S.day }); if (S.shipped.length > 40) S.shipped.pop();
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
    return false;
  }
