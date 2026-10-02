//@ the HUD, the hand scanner, the office PC and bench panels, the pause menu, the guide
  // ── HUD ───────────────────────────────────────────────────────────
  var hudT = 0, lastClock = '';
  function updateHud(dt) {
    hudT += dt; if (!hudDirty && hudT < 0.25) return; hudT = 0; hudDirty = false;
    $('h-cash').textContent = money(S.bank); $('h-cash').style.color = S.bank < 0 ? 'var(--red)' : '';
    var open = S.orders.filter(function (o) { return o.state === 'open'; }).length, packed = S.orders.filter(function (o) { return o.state === 'packed'; }).length;
    $('h-orders').textContent = open + (packed ? ' + ' + packed + ' packed' : '');
    $('h-stock').textContent = totalStock() + ' boxes';
    $('h-rep').textContent = Math.round(S.rep);
    $('h-lvl').textContent = 'Level ' + S.level; $('h-xp').textContent = S.xp + ' / ' + XP_FOR(S.level); $('h-xpbar').style.width = (100 * S.xp / XP_FOR(S.level)) + '%';
    $('h-day').textContent = 'Day ' + S.day + (S.time >= DAY_END || S.time < DAY_START ? ' · night' : ''); $('h-clock').textContent = fmtTime(S.time);
    var ev = $('h-event'); if (S.events.power) { ev.hidden = false; ev.textContent = '⚡ Power cut: reset the breaker in the office'; } else ev.hidden = true;
    var held = $('h-held'), hl = handLabel();
    if (player.tool === 'cable' || player.tool === 'jcable') { held.hidden = false; held.innerHTML = 'Charging cable (' + (player.tool === 'cable' ? 'forklift' : 'jack') + ')<small>E on the ' + (player.tool === 'cable' ? 'forklift' : 'jack') + ' plugs it in · G hangs it back</small>'; }
    else if (player.tool) { held.hidden = false; held.innerHTML = (player.tool === 'jack' ? 'Pallet jack' + (jackPallet() ? ' · ' + jackPallet().n + ' × ' + skuName(jackPallet().sku) : ' (empty)') : 'Picking cart · ' + S.cart.boxes.length + ' / ' + ECON.cartCap + ' boxes') + '<small>G lets go</small>'; }
    else if (hl) { held.hidden = false; held.innerHTML = esc(hl.t) + '<small>' + esc(hl.s) + '</small>'; }
    else held.hidden = true;
    $('h-objective').innerHTML = introText();
  }
  function updatePrompt() {
    var p = $('h-prompt');
    if (driving || !focusText) { p.hidden = true; return; }
    p.hidden = false; p.innerHTML = '<b>E</b>' + esc(focusText);
  }

  // ── The hand scanner (Tab) ────────────────────────────────────────
  var scan = { page: 0 };
  var SCAN_PAGES = ['Orders', 'Putaway', 'Stock', 'Day'];
  function scanToggle(on) { if (on && driving) return; ui.scanOpen = on; if (on) { sfx('scan'); introStep('scanner'); drawScanner(); } }
  function scanPage(i) { scan.page = i; sfx('click'); drawScanner(); }
  function sw(sku) { return '<span class="sw" style="background:' + SKU[sku].col + '"></span>'; }
  function renderScan() {
    if (!ui.scanOpen || true) return;   // the HTML scanner is retired: the device in your hand draws its own display
    $('dc-scan-tabs').innerHTML = SCAN_PAGES.map(function (n, i) { return '<button class="' + (i === scan.page ? 'on' : '') + '" data-page="' + i + '">' + (i + 1) + ' ' + n + '</button>'; }).join('');
    $('dc-scan-title').textContent = 'Scanner · ' + SCAN_PAGES[scan.page];
    var h = '';
    if (scan.page === 0) {
      var os = S.orders.filter(function (o) { return o.state === 'open' || o.state === 'packed' || o.state === 'loaded'; }).sort(function (a, b) { return a.due - b.due; });
      if (!os.length) h = '<div class="dc-empty">No orders yet. They arrive from 08:30 on working days.</div>';
      os.forEach(function (o) {
        h += '<div class="dc-sec">#' + o.num + ' · ' + esc(clientName(o.client)) + ' · due ' + dueText(o.due) + (o.rush ? ' · <span style="color:var(--red)">RUSH</span>' : '') + (o.late ? ' · <span style="color:var(--red)">LATE</span>' : '') + ' · ' + money(o.pay) + (o.state !== 'open' ? ' · ' + o.state.toUpperCase() : '') + '</div>';
        if (o.state === 'open') o.lines.forEach(function (l) { var have = Math.min(l.qty, S.bench.boxes[l.sku] || 0), where = slotsWith(l.sku).filter(function (k) { return slotParse(k).l < RACK.top; }).slice(0, 2).map(slotName).join(' · '); h += '<div class="dc-row' + (have >= l.qty ? ' done' : '') + '">' + sw(l.sku) + '<div class="n">' + esc(skuName(l.sku)) + '<small>' + (where || (stockCount(l.sku) ? 'only on the top level' : 'not in stock')) + '</small></div><div class="q' + (have >= l.qty ? ' ok' : '') + '">' + have + ' / ' + l.qty + '</div></div>'; });
      });
    } else if (scan.page === 1) {
      var any = false;
      S.trucks.forEach(function (t) { if (t.dir !== 'in' || t.state !== 'docked') return; var ps = S.pallets.filter(function (p) { return p.place === 'truck' && p.truck === t.id; }); any = true; h += '<div class="dc-sec">Truck at ' + dockLabel(t.dock) + ' · ' + ps.length + ' pallets left · leaves ' + fmtTime(t.leave) + (S.doors[t.dock] ? '' : ' · <span style="color:var(--amber)">door closed</span>') + '</div>'; ps.forEach(function (p) { var k = findSlotFor(p.sku, p.n, 1); h += '<div class="dc-row">' + sw(p.sku) + '<div class="n">' + p.n + ' × ' + esc(skuName(p.sku)) + '<small>' + (k ? 'Suggested: ' + slotName(k) : 'No rack space for a whole pallet') + '</small></div></div>'; }); });
      var fl = S.pallets.filter(function (p) { return p.place === 'floor'; });
      if (fl.length) { any = true; h += '<div class="dc-sec">Pallets on the floor</div>'; fl.forEach(function (p) { var k = findSlotFor(p.sku, p.n, 1); h += '<div class="dc-row">' + sw(p.sku) + '<div class="n">' + p.n + ' × ' + esc(skuName(p.sku)) + '<small>' + (k ? 'Suggested: ' + slotName(k) : 'No rack space for a whole pallet') + '</small></div></div>'; }); }
      if (S.floor.length) { any = true; h += '<div class="dc-sec">Loose on the floor: ' + S.floor.length + ' item' + (S.floor.length > 1 ? 's' : '') + ' (the inspector counts these)</div>'; }
      if (!any) h = '<div class="dc-empty">Nothing waiting to be put away.<br>Inbound trucks dock at ' + TRUCK_IN.map(fmtTime).join(' and ') + '.</div>';
    } else if (scan.page === 2) {
      var sum = stockSummary(), keys = Object.keys(sum).sort(function (a, b) { return sum[b] - sum[a]; });
      var slotsTotal = S.up.rows * RACK.bays * RACK.levels.length, used = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length;
      h += '<div class="dc-sec">' + used + ' of ' + slotsTotal + ' slots in use · ' + totalStock() + ' boxes</div>';
      if (!keys.length) h += '<div class="dc-empty">The racks are empty.</div>';
      keys.forEach(function (k) { h += '<div class="dc-row">' + sw(k) + '<div class="n">' + esc(skuName(k)) + '<small>' + slotsWith(k).map(slotName).slice(0, 3).join(' · ') + (slotsWith(k).length > 3 ? ' +' + (slotsWith(k).length - 3) : '') + '</small></div><div class="q ok">' + sum[k] + '</div></div>'; });
    } else {
      h += '<div class="dc-sec">Day ' + S.day + ' · ' + fmtTime(S.time) + ' · level ' + S.level + ' · rep ' + Math.round(S.rep) + '</div>';
      h += '<div class="dc-row"><div class="n">Inbound trucks<small>' + TRUCK_IN.map(fmtTime).join(' and ') + (S.up.dock2 ? ' at both bays' : ' at IN 1') + ' · they wait ' + TRUCK_WAIT + ' hours</small></div></div>';
      h += '<div class="dc-row"><div class="n">Outbound trucks<small>' + TRUCK_OUT.map(function (w, i) { return 'OUT ' + (i + 1) + ': ' + fmtTime(w.arrive) + ' to ' + fmtTime(w.leave); }).join(' · ') + '</small></div></div>';
      S.trucks.forEach(function (t) { h += '<div class="dc-row hi"><div class="n">' + (t.dir === 'in' ? 'Inbound' : 'Outbound') + ' at ' + dockLabel(t.dir === 'in' ? t.dock : 2 + t.dock) + ' · ' + t.state + '<small>' + (t.dir === 'in' ? t.pallets.length + ' pallets from ' + esc(clientName(t.client)) : t.parcels.length + ' parcels loaded') + ' · leaves ' + fmtTime(t.leave) + '</small></div></div>'; });
      h += '<div class="dc-sec">Costs tonight</div><div class="dc-row"><div class="n">Rent<small>charged at 06:00</small></div><div class="q">' + money(ECON.rent) + '</div></div>';
      S.staff.forEach(function (st) { h += '<div class="dc-row"><div class="n">' + esc(st.name) + ' · ' + STAFF_ROLES[st.role].name + '<small>' + (staffOnShift() ? st.state : 'off shift, 08:00 to 18:00') + '</small></div><div class="q">' + money(STAFF_ROLES[st.role].wage) + '</div></div>'; });
    }
    $('dc-scan-body').innerHTML = h;
  }
  $('dc-scan-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-page]'); if (b) scanPage(+b.getAttribute('data-page')); });

  // ── Panels ────────────────────────────────────────────────────────
  var panel = { kind: null, tab: null };
  var PC_TABS = [['orders', 'Orders'], ['contracts', 'Contracts'], ['shop', 'Shop'], ['staff', 'Staff'], ['finance', 'Bank'], ['stock', 'Stock'], ['stats', 'Stats']];
  function openPanel(kind, tab) {
    panel.kind = kind; panel.tab = tab || (kind === 'pc' ? 'orders' : null); ui.panelOpen = true; $('dc-panel').hidden = false; scanToggle(false);
    ui.suppressMenu = true; try { document.exitPointerLock(); } catch (e) {}
    renderPanel(); sfx('click');
  }
  function closePanel() { if (!ui.panelOpen) return; ui.panelOpen = false; $('dc-panel').hidden = true; panel.kind = null; hudDirty = true; lockPointer(); }
  function renderPanel() {
    if (!ui.panelOpen) return;
    var title = panel.kind === 'pc' ? 'Office PC · Depot OS' : panel.kind === 'catalogue' ? 'Catalogue · build mode' : panel.kind === 'dev' ? 'Dev console (F8)' : 'Packing bench';
    $('dc-panel-title').textContent = title;
    $('dc-panel-tabs').innerHTML = panel.kind === 'pc' ? PC_TABS.map(function (t) { return '<button class="' + (t[0] === panel.tab ? 'on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') : '';
    $('dc-panel-body').innerHTML = panel.kind === 'pc' ? pcHtml(panel.tab) : panel.kind === 'catalogue' ? catalogueHtml() : panel.kind === 'dev' ? devHtml() : benchHtml();
  }
  function btn(act, arg, label, cls, disabled) { return '<button class="dc-btn small ' + (cls || '') + '" data-act="' + act + '" data-arg="' + esc(arg == null ? '' : arg) + '"' + (disabled ? ' disabled' : '') + '>' + label + '</button>'; }
  function orderCard(o, withPack) {
    var n = orderNeed(o);
    var lines = o.lines.map(function (l) { var have = Math.min(l.qty, S.bench.boxes[l.sku] || 0); return '<span class="dc-tag ' + (have >= l.qty ? 'good' : '') + '">' + l.qty + '× ' + esc(skuName(l.sku)) + (withPack ? ' · ' + have + '/' + l.qty : '') + '</span>'; }).join(' ');
    var tags = (o.rush ? '<span class="dc-tag bad">RUSH</span>' : '') + (o.late ? '<span class="dc-tag bad">LATE</span>' : '') + (o.state !== 'open' ? '<span class="dc-tag good">' + o.state.toUpperCase() + '</span>' : '');
    var acts = '';
    if (withPack && o.state === 'open') acts = canPack(o) ? btn('pack', o.id, '📦 Pack', 'primary') : canPackShort(o) ? btn('pack', o.id, 'Pack short (' + n.have + '/' + n.tot + ')', '') : '<span class="dc-tag warn">' + n.have + '/' + n.tot + ' on the bench</span>';
    return '<div class="dc-card' + (o.rush ? ' hi' : '') + '"><div class="body"><b>#' + o.num + ' · ' + esc(clientName(o.client)) + '</b> ' + tags + '<small>due ' + dueText(o.due) + ' · pays ' + money(o.pay) + '</small><div style="margin-top:4px">' + lines + '</div></div><div>' + acts + '</div></div>';
  }
  function pcHtml(tab) {
    var h = '';
    if (tab === 'orders') {
      var os = S.orders.slice().sort(function (a, b) { return a.due - b.due; });
      h += '<h3>Open orders (' + os.length + ')</h3>' + (os.length ? os.map(function (o) { return orderCard(o, false); }).join('') : '<p>Nothing open. Orders arrive between 08:00 and 17:00; more clients send more as your level rises.</p>');
      h += '<h3>Recently shipped</h3>' + (S.shipped.length ? '<table><tr><th>Order</th><th>Client</th><th>Day</th><th class="r">Paid</th></tr>' + S.shipped.slice(0, 12).map(function (s) { return '<tr><td>#' + s.num + (s.late ? ' <span class="dc-tag bad">late</span>' : '') + (s.short ? ' <span class="dc-tag warn">short</span>' : '') + '</td><td>' + esc(clientName(s.client)) + '</td><td>' + s.day + '</td><td class="r">' + money(s.paid) + '</td></tr>'; }).join('') + '</table>' : '<p>Nothing shipped yet.</p>');
    } else if (tab === 'contracts') {
      var c = S.contract;
      h += '<p>A client offers a run of orders. Ship every one of theirs on time inside the window and the bonus is yours; miss the count and there is a penalty. Offers come from level 3, every few days.</p>';
      if (!c) h += '<div class="dc-card"><div class="body"><b>No offer on the table</b><small>' + (S.level < 3 ? 'Reach level 3.' : 'Next offer around day ' + S.nextOffer + '.') + '</small></div></div>';
      else if (!c.accepted) h += '<div class="dc-card hi"><div class="body"><b>' + esc(clientName(c.client)) + '</b><small>' + c.need + ' orders on time by ' + dueText(c.until) + ' · bonus ' + money(c.bonus) + ' · penalty ' + money(c.penalty) + '</small></div>' + btn('accept', '', 'Accept', 'primary') + btn('decline', '', 'Decline', '') + '</div>';
      else h += '<div class="dc-card hi"><div class="body"><b>' + esc(clientName(c.client)) + ' · ' + c.done + ' of ' + c.need + '</b><small>until ' + dueText(c.until) + ' · bonus ' + money(c.bonus) + '</small><div class="dc-bar"><span style="width:' + Math.round(100 * c.done / c.need) + '%"></span></div></div></div>';
    } else if (tab === 'shop') {
      h += '<p>Bank: <b style="color:var(--cash)">' + money(S.bank) + '</b> · level ' + S.level + '. Everything is delivered and fitted at once.</p><div class="dc-grid">';
      UPGRADES.forEach(function (u) {
        var owned = u.id === 'row3' ? S.up.rows >= 3 : u.id === 'row4' ? S.up.rows >= 4 : !!S.up[u.id];
        var needs = u.id === 'row4' && S.up.rows < 3 ? 'Needs the third row first' : S.level < u.lvl ? 'Level ' + u.lvl : S.bank < u.price ? 'Not enough money' : '';
        h += '<div class="dc-card"><div class="body"><b>' + esc(u.name) + '</b><small>' + esc(u.desc) + '</small></div><div style="text-align:right"><div class="price">' + money(u.price) + '</div>' + (owned ? '<span class="dc-tag good">Owned</span>' : btn('buy', u.id, 'Buy', 'primary', !!needs) + (needs ? '<small style="display:block;color:var(--muted)">' + needs + '</small>' : '')) + '</div></div>';
      });
      h += '</div>';
    } else if (tab === 'staff') {
      h += '<p>Staff clock in at 08:00 and out at 18:00 (20:00 on overtime) and are paid at 06:00 for the hours on the clock, time and a half past ten. They need the dock doors opened for them: that stays your job.</p>';
      h += '<div class="dc-grid">' + Object.keys(STAFF_ROLES).map(function (r) { var d = STAFF_ROLES[r], locked = S.level < d.lvl, n = S.staff.filter(function (s) { return s.role === r; }).length; return '<div class="dc-card"><div class="body"><b>' + d.name + '</b>' + (n ? '<span class="dc-tag good">' + n + ' hired</span>' : '') + '<small>' + esc(d.desc) + '</small></div><div style="text-align:right"><div class="price">' + money(d.wage) + '/day</div>' + btn('hire', r, 'Hire', 'primary', locked || S.staff.length >= 5) + (locked ? '<small style="display:block;color:var(--muted)">Level ' + d.lvl + '</small>' : '') + '</div></div>'; }).join('') + '</div>';
      if (S.staff.length) h += '<h3>Your crew</h3>' + S.staff.map(function (st) { var sheet = st.sheet || [], hrs = sheet.reduce(function (a, r) { return a + r.h; }, 0), paid = sheet.reduce(function (a, r) { return a + r.pay; }, 0), lates = sheet.filter(function (r) { return r.late; }).length; return '<div class="dc-card"><div class="body"><b>' + esc(st.name) + '</b> · ' + STAFF_ROLES[st.role].name + ' · ' + money(hourly(st)) + '/h' + (st.lateToday ? ' <span class="dc-tag bad">late today</span>' : '') + (st.overtime ? ' <span class="dc-tag warn">overtime</span>' : '') + '<small>' + staffStatus(st) + ' · today ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h · last 7 days ' + (Math.round(hrs * 10) / 10) + ' h, ' + money(paid) + (lates ? ', late ×' + lates : '') + ' · punctuality ' + Math.round((st.punct || 0.5) * 100) + '%</small></div>' + btn('fire', st.id, 'Let go', 'danger') + '</div>'; }).join('');
      h += '<p>Hours come from the time clock by the staff door: nobody is paid for a day they did not clock in. Overtime, days off and a word about lateness are on the clock itself.</p>';
    } else if (tab === 'finance') {
      h += '<div class="dc-kpis"><div class="dc-kpi"><div class="k">Bank</div><div class="v" style="color:var(--cash)">' + money(S.bank) + '</div></div><div class="dc-kpi"><div class="k">Earned</div><div class="v">' + money(S.stats.earned) + '</div></div><div class="dc-kpi"><div class="k">Spent</div><div class="v">' + money(S.stats.spent) + '</div></div><div class="dc-kpi"><div class="k">Fines</div><div class="v">' + money(S.stats.fines) + '</div></div><div class="dc-kpi"><div class="k">Daily costs</div><div class="v">' + money(ECON.rent + S.staff.reduce(function (a, s) { return a + STAFF_ROLES[s.role].wage; }, 0)) + '</div></div></div>';
      h += '<h3>The bank</h3><div class="dc-grid"><div class="dc-card"><div class="body"><b>Loan</b><small>' + (S.loan > 0 ? money(S.loan) + ' outstanding · 1.5% a day (' + money(Math.round(S.loan * 0.015)) + ')' : 'Borrow $5,000 at 1.5% a day. Repay when you can.') + '</small></div>' + (S.loan > 0 ? btn('repay', '', 'Repay ' + money(Math.min(S.loan, Math.max(0, S.bank))), 'primary', S.bank <= 0) : btn('borrow', '', 'Borrow $5,000', 'primary', S.level < 2)) + '</div>' +
        '<div class="dc-card"><div class="body"><b>Theft insurance</b><small>$40 a day. Pays 80% of the value of anything that walks off at night.</small></div>' + btn('insure', '', S.insured ? 'Cancel' : 'Insure', S.insured ? '' : 'primary') + '</div></div>';
      h += '<table><tr><th>Day</th><th>Time</th><th>What</th><th class="r">Amount</th></tr>' + S.ledger.slice(0, 30).map(function (l) { return '<tr><td>' + l.day + '</td><td>' + l.t + '</td><td>' + esc(l.why) + '</td><td class="r" style="color:' + (l.n < 0 ? 'var(--red)' : 'var(--green)') + '">' + money(l.n) + '</td></tr>'; }).join('') + '</table>';
    } else if (tab === 'stock') {
      var sum = stockSummary(), keys = Object.keys(sum).sort();
      h += '<p>' + totalStock() + ' boxes on ' + S.up.rows + ' rows · ' + Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length + ' of ' + (S.up.rows * RACK.bays * RACK.levels.length) + ' slots used. A slot holds up to ' + ECON.slotCap + ' boxes of one line.</p>';
      h += '<table><tr><th>Line</th><th>Value each</th><th>Slots</th><th class="r">Boxes</th><th class="r">Needed by orders</th></tr>' + (keys.length ? keys.map(function (k) { var need = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === k) need += l.qty; }); }); return '<tr><td>' + sw(k) + ' ' + esc(skuName(k)) + '</td><td>' + money(SKU[k].val) + '</td><td>' + slotsWith(k).map(slotName).join(', ') + '</td><td class="r">' + sum[k] + '</td><td class="r">' + need + '</td></tr>'; }).join('') : '<tr><td colspan="5">Empty racks.</td></tr>') + '</table>';
    } else {
      var st = S.stats;
      h += '<div class="dc-kpis">' + [['Days', st.days + 1], ['Pallets received', st.received], ['Boxes put away', st.putaway], ['Boxes picked', st.picked], ['Orders packed', st.packed], ['Orders shipped', st.shipped], ['Late', st.late], ['Pallets refused', st.lost], ['Reputation', Math.round(S.rep)], ['Level', S.level]].map(function (k) { return '<div class="dc-kpi"><div class="k">' + k[0] + '</div><div class="v">' + k[1] + '</div></div>'; }).join('') + '</div>';
      h += '<h3>Recent log</h3>' + S.log.slice(0, 20).map(function (l) { return '<div style="color:var(--muted);font-size:13px"><span style="color:var(--faint);font-family:var(--mono)">D' + l.day + ' ' + l.t + '</span> ' + esc(l.msg) + '</div>'; }).join('');
    }
    return h;
  }
  function benchHtml() {
    var h = '', os = openOrders().sort(function (a, b) { return (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b.due; });
    h += '<h3>Orders to pack</h3>' + (os.length ? os.map(function (o) { return orderCard(o, true); }).join('') : '<p>No open orders. Boxes you leave here stay on the bench.</p>');
    var keys = Object.keys(S.bench.boxes).filter(function (k) { return S.bench.boxes[k] > 0; });
    h += '<h3>On the bench (' + benchCount() + ' / ' + ECON.benchCap + ')</h3>' + (keys.length ? keys.map(function (k) { return '<div class="dc-card"><div class="body">' + sw(k) + ' <b>' + esc(skuName(k)) + '</b> × ' + S.bench.boxes[k] + '</div>' + btn('takeback', k, 'Take one back', '', !!S.hand) + '</div>'; }).join('') : '<p>Nothing on the bench. Bring boxes from the racks, or unload a cart here.</p>');
    if (S.bench.parcels.length) h += '<h3>Parcels on the shelf</h3><p>' + S.bench.parcels.map(function (id) { var o = orderById(id); return o ? '#' + o.num + ' for ' + esc(clientName(o.client)) : ''; }).join(' · ') + '</p>';
    return h;
  }
  function devHtml() {
    var B = function (a, l) { return btn('dev:' + a, '', l, ''); };
    return '<p>For testing. Nothing here is hidden from the save.</p>' +
      '<h3>Money and progress</h3><div class="dc-menu-row">' + B('cash', '+ $1,000') + B('cash10', '+ $10,000') + B('level', '+1 level') + B('rep', 'Rep +20') + B('unlock', 'Unlock every upgrade') + B('intro', 'Finish the intro') + '</div>' +
      '<h3>Time and weather</h3><div class="dc-menu-row">' + B('t6', '06:00') + B('t7', '07:20') + B('t10', '10:20') + B('t13', '13:20') + B('t17', '17:00') + B('t22', '22:00') + B('day', 'Next day') + '</div><div class="dc-menu-row">' + B('clear', 'Clear') + B('rain', 'Rain') + B('storm', 'Storm') + B('snow', 'Snow') + B('power', 'Toggle power cut') + '</div>' +
      '<h3>Trucks and orders</h3><div class="dc-menu-row">' + B('truckin', 'Inbound truck now') + B('truckout', 'Outbound truck now') + B('order', 'New order') + B('rush', 'Rush order') + B('contract', 'Contract offer') + '</div>' +
      '<h3>Stock and crew</h3><div class="dc-menu-row">' + B('fill', 'Fill the racks') + B('clearfloor', 'Clear the floor') + B('hire', 'Hire the three') + B('fire', 'Let everyone go') + B('fork', 'Forklift here') + '</div>' +
      '<h3>Teleport</h3><div class="dc-menu-row">' + B('tpIn', 'IN 1') + B('tpOut', 'OUT 1') + B('tpBench', 'Bench') + B('tpOffice', 'Office') + B('tpBreak', 'Break room') + B('tpYard', 'Yard') + B('tpGate', 'West gate') + '</div>';
  }
  function devAct(a) {
    var tp = function (x, z) { closePanel(); player.x = x; player.z = z; player.y = floorY(x, z); player.vy = 0; };
    if (a === 'cash') pay(1000, 'Dev'); else if (a === 'cash10') pay(10000, 'Dev'); else if (a === 'level') addXp(XP_FOR(S.level) - S.xp); else if (a === 'rep') addRep(20);
    else if (a === 'unlock') { S.up.cart = S.up.fork = S.up.lights = S.up.dock2 = S.up.sign = true; while (S.up.rows < 4) { S.up.rows++; buildRack(S.up.rows - 1); } placeTools(); }
    else if (a === 'intro') { S.intro.done = true; }
    else if (a === 't6') S.time = 6; else if (a === 't7') S.time = 7.33; else if (a === 't10') S.time = 10.33; else if (a === 't13') S.time = 13.33; else if (a === 't17') S.time = 17; else if (a === 't22') S.time = 22;
    else if (a === 'day') { S.time = 6; newDay(); }
    else if (a === 'clear' || a === 'rain' || a === 'storm' || a === 'snow') { S.weather = { kind: a, wet: a === 'rain' || a === 'storm' ? 1 : 0, snow: a === 'snow' ? 1 : 0, wind: a === 'storm' ? 1 : 0.4, until: nowAbs() + 6 }; }
    else if (a === 'power') { S.events.power = !S.events.power; S.events.powerUntil = S.time + 2; }
    else if (a === 'truckin') { if (!truckAtDoor(0) && !S.trucks.some(function (t) { return t.dir === 'in' && t.dock === 0 && t.state !== 'leaving'; })) spawnTruck('in', 0, S.time + TRUCK_WAIT); }
    else if (a === 'truckout') { if (!S.trucks.some(function (t) { return t.dir === 'out' && t.dock === 0 && t.state !== 'leaving'; })) spawnTruck('out', 0, S.time + 1.5); }
    else if (a === 'order') genOrder(false); else if (a === 'rush') genOrder(true); else if (a === 'contract') { S.contract = null; S.level = Math.max(S.level, 3); offerContract(); }
    else if (a === 'fill') { for (var r = 0; r < S.up.rows; r++) for (var bb = 0; bb < RACK.bays; bb++) for (var l = 0; l < 2; l++) { var k = slotKey(r, bb, l); if (!S.slots[k] || !S.slots[k].n) { var s = pick(unlockedSkus()); S.slots[k] = { sku: s, n: 8 }; if (S.seenSkus.indexOf(s) < 0) S.seenSkus.push(s); } } }
    else if (a === 'clearfloor') { S.floor = []; }
    else if (a === 'hire') { S.level = Math.max(S.level, 4); ['receiver', 'picker', 'packer'].forEach(function (r) { if (!S.staff.some(function (s) { return s.role === r; })) hireStaff(r); }); }
    else if (a === 'fire') { S.staff.slice().forEach(function (s) { fireStaff(s.id); }); }
    else if (a === 'fork') { S.up.fork = true; S.fork.x = player.x - Math.sin(player.yaw) * 2.5; S.fork.z = player.z - Math.cos(player.yaw) * 2.5; S.fork.batt = 1; placeTools(); }
    else if (a === 'tpIn') tp(-16.5, -8); else if (a === 'tpOut') tp(16.5, -8); else if (a === 'tpBench') tp(15.2, 5.2); else if (a === 'tpOffice') tp(15, 10.5); else if (a === 'tpBreak') tp(-16.5, -11.5); else if (a === 'tpYard') { tp(-30, 5); player.y = YARD_Y; } else if (a === 'tpGate') { tp(-72, -2); player.y = YARD_Y; }
    sfx('click'); hudDirty = true; rebuildBoardSoon(); screenDirtyAll(); if (ui.panelOpen) renderPanel();
  }
  function panelAct(act, arg) {
    if (act.indexOf('dev:') === 0) { devAct(act.slice(4)); return; }
    if (act === 'pack') { var o = orderById(arg); if (o && packOrder(o)) toast('Packed #' + o.num, 'good'); }
    else if (act === 'takeback') { if (!S.hand && benchTake(arg, 1)) { handSet({ kind: 'box', sku: arg }); sfx('pickup'); } }
    else if (act === 'buy' && panel.kind !== 'catalogue') buyUpgrade(arg);
    else if (act === 'hire') { var d = STAFF_ROLES[arg]; if (d && S.level >= d.lvl && S.staff.length < 5) { hireStaff(arg); toast('Hired a ' + d.name.toLowerCase(), 'good'); } }
    else if (act === 'fire') fireStaff(arg);
    else if (act === 'accept') { if (S.contract) { S.contract.accepted = true; sfx('chime'); toast('Contract accepted', 'good'); logEvent('Accepted the contract from ' + clientName(S.contract.client), 'good'); } }
    else if (act === 'decline') { if (S.contract) { logEvent('Declined the contract from ' + clientName(S.contract.client)); S.contract = null; S.nextOffer = S.day + 2; } }
    else if (act === 'borrow') { if (S.level >= 2 && S.loan <= 0) { S.loan = 5000; pay(5000, 'Bank loan'); sfx('cash'); toast('$5,000 in the bank. 1.5% a day.', 'good'); } }
    else if (act === 'repay') { var amt = Math.min(S.loan, Math.max(0, S.bank)); if (amt > 0) { S.loan -= amt; pay(-amt, 'Loan repayment'); sfx('cash'); toast('Repaid ' + money(amt), 'good'); } }
    else if (act === 'restore') { editRestore(arg); }
    else if (act === 'buy' && panel.kind === 'catalogue') { editBuy(arg); return; }
    else if (act === 'insure') { S.insured = !S.insured; toast(S.insured ? 'Insured from tonight' : 'Insurance cancelled', ''); }
    renderPanel(); hudDirty = true;
  }
  function buyUpgrade(id) {
    var u = UPGRADES.filter(function (x) { return x.id === id; })[0]; if (!u) return;
    var owned = id === 'row3' ? S.up.rows >= 3 : id === 'row4' ? S.up.rows >= 4 : !!S.up[id];
    if (owned || S.level < u.lvl || S.bank < u.price || (id === 'row4' && S.up.rows < 3)) { sfx('bad'); return; }
    pay(-u.price, 'Bought ' + u.name);
    if (id === 'row3') { S.up.rows = 3; buildRack(2); } else if (id === 'row4') { S.up.rows = 4; buildRack(3); } else S.up[id] = true;
    if (id === 'row3' || id === 'row4') { if (edit.on) {} else { unbakeStatic(); bakeStatic(); } }
    if (id === 'lights') hallLights.forEach(function (l) { l.distance = 30; });
    toast(u.name + ' bought', 'good'); logEvent('Bought ' + u.name + ' for ' + money(u.price), 'good'); sfx('cash'); save();
  }
  $('dc-panel-body').addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (!b || b.disabled) return; panelAct(b.getAttribute('data-act'), b.getAttribute('data-arg')); });
  $('dc-panel-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (!b) return; panel.tab = b.getAttribute('data-tab'); sfx('click'); renderPanel(); });
  $('dc-panel-close').addEventListener('click', closePanel);

  // ── Pause menu ────────────────────────────────────────────────────
  function openMenu() { if (ui.menuOpen) return; ui.menuOpen = true; $('dc-menu').hidden = false; $('dc-menu-body').hidden = true; scanToggle(false); ui.suppressMenu = true; try { document.exitPointerLock(); } catch (e) {} save(); }
  function closeMenu() { if (!ui.menuOpen) return; ui.menuOpen = false; $('dc-menu').hidden = true; lockPointer(); }
  function menuBody(html) { var b = $('dc-menu-body'); b.hidden = false; b.innerHTML = html; }
  $('dc-menu').addEventListener('click', function (e) {
    var b = e.target.closest('[data-menu]'); if (!b) return; var k = b.getAttribute('data-menu'); sfx('click');
    if (k === 'resume') closeMenu();
    else if (k === 'edit') { closeMenu(); if (!edit.on) editToggle(); }
    else if (k === 'settings') menuBody(settingsHtml());
    else if (k === 'guide') menuBody('<div class="dc-how">' + guideHtml() + '</div>');
    else if (k === 'stats') menuBody(pcHtml('stats'));
    else if (k === 'saves') menuBody('<p style="color:var(--muted)">This save as text. Copy it somewhere safe, or paste one in and load it.</p><textarea class="dc-ta" id="dc-save-ta">' + esc(JSON.stringify(S)) + '</textarea><div class="dc-menu-row"><button data-menu="download">⬇ Download .json</button><button data-menu="import" class="primary">Load what is pasted</button></div>');
    else if (k === 'download') { var blob = new Blob([JSON.stringify(S)], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'depot-co-slot' + BOOT_SLOT + '-day' + S.day + '.json'; a.click(); }
    else if (k === 'import') { try { var s = JSON.parse($('dc-save-ta').value); if (!s || typeof s.bank !== 'number') throw new Error('not a save'); localStorage.setItem(SAVE, JSON.stringify(s)); sessionStorage.setItem('depotco-skip-splash', '1'); sessionStorage.setItem('depotco-autoplay', '1'); location.reload(); } catch (err) { toast('That is not a Depot Co. save.', 'bad'); } }
    else if (k === 'reset') { if (b.getAttribute('data-sure') !== '1') { b.setAttribute('data-sure', '1'); b.textContent = 'Really reset slot ' + BOOT_SLOT + '? Click again'; setTimeout(function () { b.removeAttribute('data-sure'); b.textContent = '⟲ Reset this save'; }, 3000); return; } wipe(); try { sessionStorage.setItem('depotco-skip-splash', '1'); } catch (err) {} location.reload(); }
    else if (k === 'quit') { save(); try { sessionStorage.setItem('depotco-skip-splash', '1'); } catch (err) {} location.reload(); }
  });
  function settingsHtml() {
    return '<div class="dc-form">' +
      '<label><span>Mouse sensitivity</span><input type="range" min="0.3" max="2.5" step="0.1" value="' + SET.sens + '" data-set="sens"></label>' +
      '<label><span>Invert Y</span><input type="checkbox" ' + (SET.invertY ? 'checked' : '') + ' data-set="invertY"></label>' +
      '<label><span>Field of view</span><input type="range" min="60" max="100" step="1" value="' + SET.fov + '" data-set="fov"></label>' +
      '<label><span>Quality</span><select data-set="quality"><option value="high"' + (SET.quality === 'high' ? ' selected' : '') + '>High</option><option value="medium"' + (SET.quality === 'medium' ? ' selected' : '') + '>Medium</option><option value="low"' + (SET.quality === 'low' ? ' selected' : '') + '>Low (no shadows)</option></select></label>' +
      '<label><span>Sound</span><input type="checkbox" ' + (SET.sound ? 'checked' : '') + ' data-set="sound"></label>' +
      '<label><span>Volume</span><input type="range" min="0" max="1" step="0.05" value="' + SET.vol + '" data-set="vol"></label>' +
      '<label><span>Show FPS (F3)</span><input type="checkbox" ' + (SET.fps ? 'checked' : '') + ' data-set="fps"></label>' +
      '<label><span>Guided intro</span><input type="checkbox" ' + (!S.intro.off ? 'checked' : '') + ' data-set="intro"></label>' +
      '</div>';
  }
  $('dc-menu-body').addEventListener('input', function (e) {
    var el = e.target, k = el.getAttribute('data-set'); if (!k) return;
    if (k === 'intro') { S.intro.off = !el.checked; hudDirty = true; return; }
    SET[k] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : +el.value;
    saveSettings(); applySettings();
  });
  function applySettings() {
    camera.fov = SET.fov; camera.updateProjectionMatrix();
    var pr = SET.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : SET.quality === 'medium' ? 1 : 0.75;
    renderer.setPixelRatio(pr); renderer.shadowMap.enabled = SET.quality !== 'low'; sun.castShadow = SET.quality !== 'low';
    scene.traverse(function (o) { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
    shadowDirty = true; $('h-fps').hidden = !SET.fps; if (sfxBus) sfxBus.gain.value = SET.vol;
  }
  function screenshot() {
    try { renderer.render(scene, camera); canvas.toBlob(function (b) { if (!b) return; var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'depot-co-' + Date.now() + '.png'; a.click(); toast('Screenshot saved', 'good'); }, 'image/png'); } catch (e) {}
  }

  // ── The guide ─────────────────────────────────────────────────────
  function guideHtml() {
    return '<h3>What you do</h3><p>You run a small third-party warehouse. Clients send stock on trucks, you store it on the racks, their customers order from it, and you pick, pack and ship those orders out again. You are paid a fee for every pallet you receive and a cut of every order you ship on time.</p>' +
      '<h3>Controls</h3><p><kbd>WASD</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump · <kbd>E</kbd> use, pick up, put on · <kbd>G</kbd> put down or let go · <kbd>Tab</kbd> the hand scanner · <kbd>1</kbd>-<kbd>4</kbd> scanner pages · <kbd>Esc</kbd> pause · <kbd>F3</kbd> FPS · <kbd>F12</kbd> screenshot · <kbd>F11</kbd> fullscreen.</p>' +
      '<h3>Receiving</h3><p>Inbound trucks dock at IN 1 (and IN 2 once you buy the second bay) at 07:30 and 13:30. Open the dock door, walk into the trailer and take boxes off the pallets by hand, or grab the pallet jack and lift a whole pallet. A truck waits three hours; whatever is still on it goes back, unpaid, and the client remembers.</p>' +
      '<h3>Racks</h3><p>Every slot holds up to 12 boxes of one line. The floor and shelf levels are hand-reachable; the top level needs the forklift. Look at a slot and press E to put a box on or take one off. The jack sets a whole pallet into a floor-level slot.</p>' +
      '<h3>Orders</h3><p>Orders arrive between 08:00 and 17:00 on the office PC, the wall board and the scanner. Each one lists lines and a due time, which is the departure of an outbound truck. Pick the boxes, put them on the packing bench, press E on the bench with empty hands and pack. The parcel appears on the shelf beside the bench.</p>' +
      '<h3>Shipping</h3><p>Outbound trucks wait at OUT 1 from 10:30 to 12:00 and OUT 2 from 16:00 to 18:00. Open the door, carry the parcel into the trailer and press E. Press E on the dock console to send a loaded truck early. You are paid when it leaves. Late orders pay half; a short order pays 60%.</p>' +
      '<h3>Doors and the cabinet</h3><p>The office, break room, staff entrance and fire exit have doors: <kbd>E</kbd> opens, <kbd>Shift+E</kbd> locks. The control cabinet by the office door switches the lights, every dock door, and night mode, which locks the lot. Unlocked at night means stock walks.</p>' +
      '<h3>Drivers</h3><p>Sign the delivery note with the driver (<kbd>E</kbd> on him by the dock outside) before anything comes off the truck. He will nag after two hours.</p>' +
      '<h3>Tools</h3><p>The pallet jack is yours from day one. The picking cart (shop) holds six boxes and picks straight off the racks. The forklift (shop, level 2) drives with WASD, lifts with R and F, and takes pallets to the top level. G gets off. It runs on a battery: take the cable off the charging point on the south wall, walk it to the forklift and E plugs it in; it charges only while plugged, and driving off pulls the plug. The jack has its own small charger by its bay. Flat, the forklift crawls. Wrap a pallet at the stretch wrapper before you drive it round corners, or it sheds boxes.</p>' +
      '<h3>Staff and the time clock</h3><p>From level 3 you can hire a receiver, a picker and a packer on the office PC. They walk in from the yard, clock in at the reader by the staff door, work, clock out at 18:00 and leave. Pay is their clocked hours at the hourly rate, time and a half past ten hours, paid at 06:00. Some drift in late: the clock screen lets you have a word, put them on overtime till 20:00, or give them tomorrow off. They call in sick now and then. You can clock in too: your hours are tracked and you get a shift report when you clock out. They will not open dock doors: that stays your job.</p>' +
      '<h3>Trouble</h3><p>Power cuts stop the doors, the PC and new orders until you reset the breaker in the office. An inspector drops in now and then and fines you for boxes left on the floor. Leave a dock door open at night with no truck in it and stock walks off. Sleep on the cot in the break room to skip to the next morning, which charges rent and wages.</p>' +
      '<h3>Weather and Sundays</h3><p>Seasons of seven days, rain, storms, snow. Sunday is closed: sleep through it. The break-room radio has three stations.</p>' +
      '<h3>Contracts and the bank</h3><p>From level 3 a client offers a contract now and then: a number of their orders on time inside a window, for a bonus; miss it and there is a penalty. The bank lends $5,000 at 1.5% a day from level 2, and theft insurance at $40 a day pays most of what walks off at night.</p>' +
      '<h3>Damaged goods</h3><p>A box dropped mid-air or shed off the forklift can be damaged. It cannot go on a rack or the bench: carry it to the bin by the packing bench and the client charges half its value.</p>' +
      '<h3>Build mode</h3><p><kbd>F2</kbd> is build mode. Aim at any piece of furniture, a machine, a poster or a sign and <kbd>E</kbd> grabs it; it follows your aim, <kbd>R</kbd> turns it a quarter, <kbd>E</kbd> puts it down, <kbd>Esc</kbd> drops it back. <kbd>Backspace</kbd> puts a piece back where it started, <kbd>Del</kbd> removes it. <kbd>C</kbd> opens the catalogue: removed pieces to bring back, and extras to buy. The layout saves when you leave build mode.</p>' +
      '<h3>Dev console</h3><p><kbd>F8</kbd> opens a cheat menu: money, levels, the clock, weather, trucks, orders, stock, crew, teleports. For testing; it writes straight into the save.</p>' +
      '<h3>Tips</h3><p>Keep one slot per line and the scanner tells you where everything is. Pack before the truck arrives, not after. Coffee makes you faster for an hour. Reputation brings more and bigger orders.</p>';
  }
