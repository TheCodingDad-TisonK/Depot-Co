//@ the office PC: a real monitor on the desk. E at the desk sits you down in front of it; its apps are drawn on the screen and tapped with the crosshair
  // ── The office PC ─────────────────────────────────────────────────
  var pc = { on: false, app: 'home', scroll: 0, saved: null, look: { yaw: 0, pitch: 0 }, screen: null };
  var PC_APPS = [['home', '🏠', 'Desktop'], ['orders', '📦', 'Orders'], ['contracts', '📝', 'Contracts'], ['shop', '🛒', 'Shop'], ['staff', '👷', 'Staff'], ['bank', '🏦', 'Bank'], ['stock', '🗄', 'Stock'], ['factory', '🏭', 'Production'], ['plant', '⚙', 'Plant'], ['stats', '📊', 'Stats']];
  // every machine on one page: status, dial, and the one button each has on its own screen (pause, clear a jam, start, eject, bale, hold)
  function plantRows() {
    var rows = [], pct = function (key) { return Math.round(speedOf(key) * 100) + '%'; };
    var dialRow = function (name, key) { rows.push({ text: '   ' + name + ' dial', sub: 'tap to step the speed', right: pct(key), key: key, dialOnly: true, btn: { label: pct(key) + ' ▸', on: true, act: function () { speedCycle(key); }, col: '#78bdf5' } }); };
    var add = function (name, status, sub, key, action) { rows.push({ text: name + '  ·  ' + status, sub: sub, right: key ? pct(key) : '', key: key, hi: status === 'run' || status === 'running' || status === 'sorting', btnIsDial: !action && !!key, btn: action || (key ? { label: pct(key) + ' ▸', on: true, act: function () { speedCycle(key); }, col: '#78bdf5' } : null) }); if (action && key) dialRow(name, key); };
    if (propInst.packline) add('Pack line', packStatus(), packPrompt(), 'packline', S.pack.jam ? { label: 'CLEAR JAM', on: true, act: packUse, col: '#ff6b5e' } : S.up.plantAuto ? { label: S.pack.auto === false ? 'AUTO OFF' : 'AUTO ON', on: true, act: function () { S.pack.auto = S.pack.auto === false; sfx('click'); }, col: S.pack.auto === false ? '#f5b53d' : '#5fd38d' } : null);
    var surP = surplusCount(); if (surP) rows.push({ text: 'Bench surplus  ·  ' + surP + ' box' + (surP > 1 ? 'es' : ''), sub: 'boxes no open order wants, on the bench or loose on the floor', hi: true, btn: { label: 'RETURN ALL', on: true, act: function () { returnSurplus(); }, col: '#f5b53d' } });
    if (propInst.moulder) add('Moulding line', factoryStatus(), moulderPrompt(), 'moulder', { label: S.factory.jam ? 'CLEAR JAM' : S.factory.on ? 'STOP' : 'START', on: true, act: moulderUse, col: S.factory.jam ? '#ff6b5e' : S.factory.on ? '#f5b53d' : '#5fd38d' });
    if (propInst.palletiser) add('Palletiser', S.pal.n ? 'run' : 'idle', palletiserPrompt(), 'beltMain', { label: 'EJECT', on: S.pal.n > 0, act: palletiserUse, col: '#f5b53d' });
    if (propInst.baler) add('Baler', balerStatus(), balerPrompt(), 'baler', { label: 'BALE', on: S.baler.card >= BALE_NEED && !S.baler.t, act: balerUse, col: '#f5b53d' });
    if (propInst.wrapper) add('Stretch wrapper', wrapperStatus(), 'film ' + S.wrap.film + ' pallets · wrapped ' + S.wrap.wrapped, 'wrapper', null);
    if (S.up.agv && propInst.agvDock) { var A = agvState(); add('AGV-1', A.paused && A.state === 'idle' ? 'paused' : A.state, agvPrompt(), 'agv', { label: A.paused ? 'RESUME' : 'PAUSE', on: true, act: function () { A.paused = !A.paused; sfx('click'); }, col: A.paused ? '#5fd38d' : '#f5b53d' }); }
    if (S.up.gantry) { gantryRows().forEach(function (r) { var G = gantryState(r); add('Gantry ' + (r >= UPPER.row ? 'upper' : 'ABCDEF'[r]), G.paused && G.state === 'idle' ? 'paused' : G.state, gantryPrompt(r), 'gantry' + r, { label: G.paused ? 'RESUME' : 'PAUSE', on: true, act: function () { G.paused = !G.paused; sfx('click'); }, col: G.paused ? '#5fd38d' : '#f5b53d' }); }); dialRow('Pick belts', 'pickBelt'); }
    for (var lid in LOADER_DOORS) if (propInst[lid]) add('Dock loader ' + dockLabel(LOADER_DOORS[lid]), dockLoaderStatus(LOADER_DOORS[lid]), dockLoaderPrompt(LOADER_DOORS[lid]) + ' · ' + stageOf(lid).length + ' in the bay', null, null);
    if (S.up.shipbelt && propInst.shipBelt) dialRow('Shipping belt', 'shipBelt');
    if (upperOwned() && propInst.lift) { var L = liftState(); add('Goods lift', L.state, 'lifted ' + (S.stats.lifted || 0) + ' pallets · racked upstairs ' + (S.stats.upperIn || 0), null, { label: L.hold ? 'RELEASE' : 'HOLD', on: true, act: function () { L.hold = !L.hold; sfx('click'); }, col: L.hold ? '#5fd38d' : '#f5b53d' }); }
    if (sorterOwned() && propInst.spine) { var Z = sortState(); add('Sortation deck', SORT.cells.some(function (cd) { return Z.cells[cd.mode].q.length; }) ? 'sorting' : 'ready', 'read ' + Z.scanned + ' · sorted ' + Z.sorted + ' · turntable ' + Z.table.length + (S.up.deckNight ? ' · night shift on' : ''), 'sorter', null); }
    if (!rows.length) rows.push({ text: 'No machines yet', sub: 'the pack line comes with the bench; the rest is in the shop', col: '#a0acb8' });
    return rows;
  }
  function openPc() {
    if (pc.on || driving) return;
    if (S.events.power) { toast('No power.', 'bad'); return; }
    pc.on = true; pc.app = pc.app || 'home'; pc.scroll = 0; pc.look.yaw = 0; pc.look.pitch = 0;
    pc.saved = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch };
    if (player.tool) releaseTool(); scanToggle(false);
    sfx('click'); introStep('pc'); screenDirtyAll(); hudDirty = true;
    $('h-drive').hidden = false; $('h-drive').innerHTML = 'Office PC · aim at a button and <b>E</b> taps it · mouse wheel scrolls a list · <b>Esc</b> or <b>WASD</b> stands up';
  }
  function closePc() { if (!pc.on) return; pc.on = false; $('h-drive').hidden = true; if (pc.saved) { player.x = pc.saved.x; player.z = pc.saved.z; player.yaw = pc.saved.yaw; player.pitch = pc.saved.pitch; } sfx('click'); hudDirty = true; }
  // where to sit: in front of the desk prop, facing the monitor
  function pcSeat() { var P = propPlacement('desk'), a = P.rot * Math.PI / 2, lx = 0, lz = -0.5; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a), yaw: a + Math.PI }; }
  function pcCamera() { var s = pcSeat(); camera.position.set(s.x, 1.33, s.z); camera.rotation.set(-0.06 + pc.look.pitch, s.yaw + pc.look.yaw, 0, 'YXZ'); player.x = s.x; player.z = s.z; }
  function pcRows(sc, rows, y0, rowH) {
    var c = sc.ctx, maxRows = Math.floor((sc.h - y0 - 90) / rowH), start = clamp(pc.scroll, 0, Math.max(0, rows.length - maxRows)), y = y0;   // 90: the two-row taskbar
    pc.scroll = start;
    rows.slice(start, start + maxRows).forEach(function (r) {
      c.fillStyle = r.hi ? 'rgba(245,181,61,0.1)' : 'rgba(255,255,255,0.04)'; c.fillRect(16, y, sc.w - 32, rowH - 6);
      if (r.sw) { c.fillStyle = r.sw; c.fillRect(24, y + 10, 10, 10); }
      scText(c, r.sw ? 42 : 26, y + 19, String(r.text).slice(0, 70), r.col || '#eef1f5', 14); if (r.sub) scText(c, r.sw ? 42 : 26, y + 36, String(r.sub).slice(0, 96), '#a0acb8', 11);
      if (r.right !== undefined) { c.fillStyle = r.rcol || '#f5b53d'; c.font = 'bold 14px Bahnschrift, Arial, sans-serif'; c.textAlign = 'right'; c.fillText(String(r.right), sc.w - (r.btn ? 130 : 26), y + 19); c.textAlign = 'left'; }
      if (r.btn) scButton(sc, sc.w - 118, y + 6, 96, rowH - 18, r.btn.label, !!r.btn.on, r.btn.act, r.btn.col);
      y += rowH;
    });
    if (rows.length > maxRows) { scButton(sc, sc.w - 60, y0 - 34, 20, 22, '▲', false, function () { pc.scroll = Math.max(0, pc.scroll - 1); }); scButton(sc, sc.w - 36, y0 - 34, 20, 22, '▼', false, function () { pc.scroll = pc.scroll + 1; }); c.fillStyle = '#6b7784'; c.font = '11px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText((start + 1) + '-' + Math.min(rows.length, start + maxRows) + ' of ' + rows.length, sc.w - 66, y0 - 18); c.textAlign = 'left'; }
    if (!rows.length) scText(c, 26, y0 + 24, 'Nothing here.', '#6b7784', 14);
  }
  function drawPc(c, sc) {
    var w = sc.w, h = sc.h;
    if (S.events.power) { c.fillStyle = '#05080a'; c.fillRect(0, 0, w, h); return; }
    scBg(c, w, h, 'rgba(120,189,245,0.18)');
    // the taskbar
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, h - 84, w, 84);   // two rows of five since the Plant app: ten in one row left the last one a sliver
    var perRow = Math.ceil(PC_APPS.length / 2), bw = Math.floor((w - 16 - 8 * (perRow - 1)) / perRow);
    PC_APPS.forEach(function (a, i) { var row = Math.floor(i / perRow), col = i % perRow; scButton(sc, 8 + col * (bw + 8), h - 80 + row * 40, bw, 34, a[1] + ' ' + a[2], pc.app === a[0], function () { pc.app = a[0]; pc.scroll = 0; }, '#78bdf5'); });
    c.fillStyle = '#a0acb8'; c.font = '12px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText('Day ' + S.day + ' · ' + fmtTime(S.time), w - 10, 14); c.textAlign = 'left';
    var app = pc.app;
    if (app === 'home') {
      scText(c, 24, 48, 'DEPOT OS', '#f5b53d', 34); scText(c, 24, 72, 'Depot Co. · ' + (S.weather ? S.weather.kind : 'clear') + ' · ' + SEASONS[season()] + (isSunday() ? ' · Sunday, closed' : ''), '#a0acb8', 14);
      var kp = [['Bank', money(S.bank)], ['Open orders', String(openOrders().length)], ['In stock', totalStock() + ' boxes'], ['Reputation', String(Math.round(S.rep))], ['Level', S.level + ' · ' + S.xp + '/' + XP_FOR(S.level)], ['Crew', S.staff.length + ' (' + S.staff.filter(function (s) { return s.clocked; }).length + ' on the clock)']];
      kp.forEach(function (k, i) { var x = 24 + (i % 3) * 250, y = 100 + Math.floor(i / 3) * 90; c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, y, 234, 76); scText(c, x + 14, y + 26, k[0].toUpperCase(), '#6b7784', 11); scText(c, x + 14, y + 58, k[1], '#eef1f5', 24); });
      var last = S.log.slice(0, 5); scText(c, 24, 300, 'RECENT', '#6b7784', 11); last.forEach(function (l, i) { scText(c, 24, 322 + i * 20, 'D' + l.day + ' ' + l.t + '  ' + l.msg.slice(0, 90), l.kind === 'bad' ? '#ff6b5e' : l.kind === 'good' ? '#5fd38d' : '#eef1f5', 12); });
    } else if (app === 'orders') {
      scHead(c, w, 'ORDERS', openOrders().length + ' open');
      var rows = S.orders.slice().sort(function (a, b) { return a.due - b.due; }).map(function (o) { return { text: '#' + o.num + '  ' + clientName(o.client) + (o.rush ? '  RUSH' : '') + (o.late ? '  LATE' : ''), sub: o.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · due ' + dueText(o.due) + ' · ' + o.state, right: money(o.pay), col: o.late || o.rush ? '#ff6b5e' : '#eef1f5', hi: o.state !== 'open' }; });
      returnsPending().forEach(function (r) { rows.push({ text: 'RETURN #' + r.num + '  ' + clientName(r.client), sub: r.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · ' + r.why + ' · ' + returnPlaceText(r), right: money(returnFee(r)), rcol: '#f5b53d', col: r.late ? '#ff6b5e' : '#f5b53d' }); });
      S.shipped.slice(0, 6).forEach(function (s) { rows.push({ text: 'shipped #' + s.num + '  ' + clientName(s.client) + (s.late ? '  late' : '') + (s.short ? '  short' : ''), sub: 'day ' + s.day, right: money(s.paid), rcol: '#5fd38d', col: '#a0acb8' }); });
      pcRows(sc, rows, 60, 46);
    } else if (app === 'contracts') {
      scHead(c, w, 'CONTRACTS'); var ct = S.contract, rows2 = [];
      if (!ct) rows2.push({ text: 'No offer on the table', sub: S.level < 3 ? 'Reach level 3 and the clients start asking.' : 'Next offer around day ' + S.nextOffer + '.' });
      else if (!ct.accepted) { rows2.push({ text: clientName(ct.client) + ' offers a contract', sub: ct.need + ' orders on time by ' + dueText(ct.until) + ' · bonus ' + money(ct.bonus) + ' · penalty ' + money(ct.penalty), btn: { label: 'ACCEPT', on: true, act: function () { ct.accepted = true; sfx('chime'); toast('Contract accepted', 'good'); logEvent('Accepted the contract from ' + clientName(ct.client), 'good'); }, col: '#5fd38d' }, hi: true }); rows2.push({ text: 'Decline', sub: 'The next offer comes in a couple of days.', btn: { label: 'DECLINE', on: false, act: function () { logEvent('Declined the contract from ' + clientName(ct.client)); S.contract = null; S.nextOffer = S.day + 2; } } }); }
      else rows2.push({ text: clientName(ct.client) + ' · ' + ct.done + ' of ' + ct.need + ' on time', sub: 'until ' + dueText(ct.until) + ' · bonus ' + money(ct.bonus) + ' · penalty ' + money(ct.penalty), right: Math.round(100 * ct.done / ct.need) + '%', hi: true });
      rows2.push({ text: 'How it works', sub: 'Every order of theirs shipped on time in the window counts. Miss the number and the penalty is taken. Contract clients order more while it runs.', col: '#a0acb8' });
      pcRows(sc, rows2, 60, 50);
    } else if (app === 'shop') {
      scHead(c, w, 'SHOP', money(S.bank) + ' · level ' + S.level);
      var rows3 = UPGRADES.map(function (u) { var rowN = /^row(\d)$/.test(u.id) ? +u.id.slice(3) : 0, owned = rowN ? S.up.rows >= rowN : !!S.up[u.id]; var needs = rowN && S.up.rows < rowN - 1 ? 'needs the previous row' : u.needs && !S.up[u.needs] ? 'needs ' + upgradeName(u.needs).toLowerCase() : S.level < u.lvl ? 'level ' + u.lvl : S.bank < u.price ? 'not enough money' : ''; return { text: u.name + (owned ? '  ·  owned' : ''), sub: (needs ? needs + ' · ' : '') + u.desc, right: money(u.price), btn: owned ? null : { label: !needs ? 'BUY' : needs === 'not enough money' ? 'NO MONEY' : 'LOCKED', on: !needs, act: function () { if (!needs) buyUpgrade(u.id); }, col: '#5fd38d' } }; });
      pcRows(sc, rows3, 60, 50);
    } else if (app === 'staff') {
      scHead(c, w, 'STAFF', S.staff.length + ' of ' + staffCap());
      var rows4 = Object.keys(STAFF_ROLES).map(function (r) { var d = STAFF_ROLES[r], locked = S.level < d.lvl || (d.needs && !S.up[d.needs]); return { text: 'Hire a ' + d.name.toLowerCase() + '  ·  ' + money(d.wage / 10) + '/h', sub: d.desc, btn: { label: locked ? (S.level < d.lvl ? 'LEVEL ' + d.lvl : 'NEEDS FORK') : S.staff.length >= staffCap() ? 'FULL' : 'HIRE', on: !locked && S.staff.length < staffCap(), act: function () { if (!locked && S.staff.length < staffCap()) { hireStaff(r); toast('Hired a ' + d.name.toLowerCase(), 'good'); } }, col: '#5fd38d' } }; });
      S.staff.forEach(function (st) { var sheet = st.sheet || [], hrs = sheet.reduce(function (a, r) { return a + r.h; }, 0), paid = sheet.reduce(function (a, r) { return a + r.pay; }, 0), open = pc.staffOpen === st.id;
        rows4.push({ text: st.name + '  ·  ' + STAFF_ROLES[st.role].name + (st.cross && STAFF_ROLES[st.cross] ? ' (+' + STAFF_ROLES[st.cross].name.toLowerCase() + ')' : '') + '  ·  ' + staffStatus(st), sub: 'today ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h · last 7 days ' + (Math.round(hrs * 10) / 10) + ' h, ' + money(paid) + ' · ' + punctWord(st) + ' (' + Math.round((st.punct || 0.5) * 100) + '%)' + (st.lateToday ? ' · late today' : '') + ' · ' + (st.shift || 'day') + ' shift' + (st.trained ? ' · trained' : '') + (st.raise ? ' · raised' : ''), hi: !!st.clocked, btn: { label: open ? 'CLOSE ▴' : 'OPTIONS ▸', on: open, act: function () { pc.staffOpen = open ? null : st.id; pc.confirm = null; }, col: '#78bdf5' } });
        if (!open) return;   // one row a worker unless their options are open (five rows each made eight crew forty rows of scrolling)
        rows4.push({ text: '   shift: ' + (st.shift || 'day') + (st.shiftNext ? ' (' + st.shiftNext + ' from tomorrow)' : ''), sub: 'shift ' + fmtTime(shiftStart(st)) + ' to ' + fmtTime(shiftOf(st).end) + ' · day, early or late; the change takes effect tomorrow', col: '#a0acb8', btn: { label: 'SHIFT ▸', on: true, act: function () { staffShiftCycle(st); }, col: '#78bdf5' } });
        rows4.push({ text: '   ' + (st.trained ? 'trained' : 'training course · $' + TRAIN_PRICE), sub: st.trained ? 'walks a fifth faster and finishes every task step a third sooner' : 'quicker on their feet and at every task', col: '#a0acb8', btn: { label: st.trained ? 'DONE' : 'TRAIN', on: !st.trained && S.bank >= TRAIN_PRICE, act: function () { staffTrain(st); }, col: '#5fd38d' } });
        rows4.push({ text: '   ' + (st.raise ? 'on the raised rate' : 'a raise · $' + RAISE_PRICE), sub: st.raise ? money(hourly(st)) + ' an hour, on time every day' : '10% more an hour, and timekeeping stops being a problem', col: '#a0acb8', btn: { label: st.raise ? 'DONE' : 'RAISE', on: !st.raise && S.bank >= RAISE_PRICE, act: function () { staffRaise(st); }, col: '#5fd38d' } });
        rows4.push({ text: '   second role' + (st.cross && STAFF_ROLES[st.cross] ? ' · ' + STAFF_ROLES[st.cross].name.toLowerCase() : ' · $' + CROSS_PRICE + ' once'), sub: 'covers the other job when their own queue is empty; tap to choose the role', col: '#a0acb8', btn: { label: st.cross ? 'NEXT ▸' : 'CHOOSE', on: st.crossPaid || S.bank >= CROSS_PRICE, act: function () { staffCrossCycle(st); }, col: '#78bdf5' } });
        rows4.push({ text: '   let ' + st.name + ' go', sub: 'the hours worked today are paid on the way out · tap twice', col: '#a0acb8', btn: { label: 'LET GO', on: false, act: function () { if (pc.confirm !== st.id) { pc.confirm = st.id; toast('Tap LET GO again to let ' + st.name + ' go', 'bad'); return; } pc.confirm = null; pc.staffOpen = null; fireStaff(st.id); }, col: '#ff6b5e' } }); });
      pcRows(sc, rows4, 60, 50);
    } else if (app === 'plant') {
      scHead(c, w, 'PLANT', powered() ? 'mains ok' : 'NO POWER');
      pcRows(sc, plantRows(), 60, 50);
    } else if (app === 'bank') {
      scHead(c, w, 'BANK', money(S.bank));
      var rows5 = [
        { text: 'Loan', sub: S.loan > 0 ? money(S.loan) + ' outstanding · 1.5% a day (' + money(Math.round(S.loan * 0.015)) + ')' : 'Borrow $5,000 at 1.5% a day from level 2. Repay when you can.', right: S.loan > 0 ? money(S.loan) : '', btn: S.loan > 0 ? { label: 'REPAY', on: S.bank > 0, act: function () { var amt = Math.min(S.loan, Math.max(0, S.bank)); if (amt > 0) { S.loan -= amt; pay(-amt, 'Loan repayment'); sfx('cash'); toast('Repaid ' + money(amt), 'good'); } }, col: '#5fd38d' } : { label: 'BORROW', on: S.level >= 2, act: function () { if (S.level >= 2 && S.loan <= 0) { S.loan = 5000; pay(5000, 'Bank loan'); sfx('cash'); toast('$5,000 in the bank. 1.5% a day.', 'good'); } }, col: '#f5b53d' } },
        { text: 'Theft insurance', sub: '$40 a day. Pays 80% of the value of anything that walks off at night.', right: S.insured ? 'insured' : '', btn: { label: S.insured ? 'CANCEL' : 'INSURE', on: !S.insured, act: function () { S.insured = !S.insured; toast(S.insured ? 'Insured from tonight' : 'Insurance cancelled', ''); }, col: '#78bdf5' } },
        { text: 'Earned ' + money(S.stats.earned) + '  ·  spent ' + money(S.stats.spent) + '  ·  fines ' + money(S.stats.fines), sub: 'daily costs: rent ' + money(ECON.rent) + ' + the crew by the hour' + (S.insured ? ' + $40 insurance' : '') + (S.loan ? ' + loan interest' : ''), col: '#a0acb8' }
      ];
      S.ledger.slice(0, 8).forEach(function (l) { rows5.push({ text: l.why, sub: 'day ' + l.day + ' · ' + l.t, right: money(l.n), rcol: l.n < 0 ? '#ff6b5e' : '#5fd38d', col: '#a0acb8' }); });
      pcRows(sc, rows5, 60, 48);
    } else if (app === 'stock') {
      var sum = stockSummary(), keys = Object.keys(sum).sort(); scHead(c, w, 'STOCK', totalStock() + ' boxes · ' + Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length + '/' + slotTotal() + ' slots');
      var rows6 = keys.map(function (k) { var need = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === k) need += l.qty; }); }); return { sw: SKU[k].col, text: skuName(k) + '  ·  ' + money(SKU[k].val) + ' each', sub: slotsWith(k).map(slotName).slice(0, 4).join(', '), right: sum[k] + (need ? '  (' + need + ' needed)' : ''), rcol: need > sum[k] ? '#ff6b5e' : '#f5b53d' }; });
      pcRows(sc, rows6, 60, 44);
    } else if (app === 'factory') {
      var F = S.factory; scHead(c, w, 'PRODUCTION', factoryStatus().toUpperCase());
      var rowsF = [
        { text: 'Hopper: ' + F.raw + ' / ' + HOPPER_CAP + ' units of raw granulate', sub: 'A pallet of 8 sacks is ' + 8 * RAW_PER_SACK + ' units, one unit a box. Tip pallets in at the hopper in the production wing.', right: F.rawOrdered ? F.rawOrdered + ' on order' : '', btn: { label: 'ORDER $' + ECON.rawPrice, on: S.bank >= ECON.rawPrice, act: function () { if (S.bank < ECON.rawPrice) { sfx('bad'); return; } pay(-ECON.rawPrice, 'Raw granulate, one pallet'); F.rawOrdered++; sfx('cash'); toast('A pallet of raw granulate comes with the next inbound truck', 'good'); } } },
        { text: 'Moulding line: ' + (F.on ? 'running' : 'stopped') + ' · ' + skuName(F.product), sub: FACTORY_RATE + ' s a box · made ' + F.made + ' so far · boxes go by belt to the palletiser in the hall', btn: { label: F.on ? 'STOP' : 'START', on: true, act: function () { moulderUse(); }, col: F.on ? '#ff6b5e' : '#5fd38d' } }
      ];
      ownSkus().forEach(function (s) { rowsF.push({ sw: s.col, text: s.name + ' · ' + money(s.val) + ' a box to the clients', sub: 'in stock ' + stockCount(s.id) + (s.tier > tierFor(S.level) ? ' · clients ask for it from level ' + (s.tier === 2 ? 2 : 4) : ''), btn: { label: F.product === s.id ? 'SELECTED' : 'SELECT', on: F.product !== s.id, act: function () { F.product = s.id; sfx('click'); } } }); });
      rowsF.push({ text: 'Baler: ' + S.baler.card + ' / ' + BALE_NEED + ' cardboard · ' + S.baler.bales + ' bales waiting · ' + S.baler.made + ' made', sub: 'Binned boxes and packing offcuts fill it. Outbound trucks take bales at ' + money(BALE_PRICE) + ' each. Wrapper film left: ' + S.wrap.film + '.', col: '#a0acb8' });
      rowsF.push({ text: 'Pallets finished by the palletiser: ' + (S.stats.palletised || 0) + ' · parcels off the pack line: ' + S.pack.made, sub: 'Finished pallets drop beside the palletiser; rack them like any delivery. Clients start ordering your own goods once they have seen them.', col: '#a0acb8' });
      pcRows(sc, rowsF, 60, 50);
    } else if (app === 'stats') {
      scHead(c, w, 'STATS', 'day ' + S.day); var st2 = S.stats;
      var rows7 = [['Pallets received', st2.received], ['Boxes put away', st2.putaway], ['Boxes picked', st2.picked], ['Orders packed', st2.packed], ['Orders shipped', st2.shipped], ['Late', st2.late], ['Pallets refused', st2.lost], ['Boxes stolen', st2.stolen || 0], ['Returns inspected', st2.returns || 0], ['Damaged boxes binned', S.binned || 0], ['Your hours on the clock', Math.round((st2.hoursWorked || 0) * 10) / 10], ['Reputation', Math.round(S.rep)], ['Level', S.level]].map(function (k) { return { text: k[0], right: String(k[1]) }; });
      pcRows(sc, reportRows().concat(rows7), 60, 40);   // the last seven day reports first, then the lifetime counts
    }
  }
  function tickPc(dt) {
    if (!pc.on) return;
    pcCamera();
    if (pc.screen && Math.floor(worldTime * 2) !== pc.q) { pc.q = Math.floor(worldTime * 2); pc.screen.dirty = true; }
    var k = player.keys; if (k.KeyW || k.KeyA || k.KeyS || k.KeyD) closePc();
  }
