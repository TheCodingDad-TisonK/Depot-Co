//@ the office PC: a real monitor on the desk. E at the desk sits you down in front of it; its apps are drawn on the screen and tapped with the crosshair
  // ── The office PC ─────────────────────────────────────────────────
  var pc = { on: false, app: 'home', scroll: 0, saved: null, look: { yaw: 0, pitch: 0 }, screen: null };
  var PC_APPS = [['home', '🏠', 'Desktop'], ['orders', '📦', 'Orders'], ['contracts', '📝', 'Contracts'], ['shop', '🛒', 'Shop'], ['staff', '👷', 'Staff'], ['bank', '🏦', 'Bank'], ['stock', '🗄', 'Stock'], ['factory', '🏭', 'Production'], ['stats', '📊', 'Stats']];
  function openPc() {
    if (pc.on || driving) return;
    if (S.events.power) { toast('No power.', 'bad'); return; }
    pc.on = true; pc.app = pc.app || 'home'; pc.scroll = 0; pc.look.yaw = 0; pc.look.pitch = 0;
    pc.saved = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch };
    if (player.tool) releaseTool();
    sfx('click'); introStep('pc'); screenDirtyAll(); hudDirty = true;
    $('h-drive').hidden = false; $('h-drive').innerHTML = 'Office PC · aim at a button and <b>E</b> taps it · mouse wheel scrolls a list · <b>Esc</b> or <b>WASD</b> stands up';
  }
  function closePc() { if (!pc.on) return; pc.on = false; $('h-drive').hidden = true; if (pc.saved) { player.x = pc.saved.x; player.z = pc.saved.z; player.yaw = pc.saved.yaw; player.pitch = pc.saved.pitch; } sfx('click'); hudDirty = true; }
  // where to sit: in front of the desk prop, facing the monitor
  function pcSeat() { var P = propPlacement('desk'), a = P.rot * Math.PI / 2, lx = 0, lz = -0.5; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a), yaw: a + Math.PI }; }
  function pcCamera() { var s = pcSeat(); camera.position.set(s.x, 1.33, s.z); camera.rotation.set(-0.06 + pc.look.pitch, s.yaw + pc.look.yaw, 0, 'YXZ'); player.x = s.x; player.z = s.z; }
  function pcRows(sc, rows, y0, rowH) {
    var c = sc.ctx, maxRows = Math.floor((sc.h - y0 - 50) / rowH), start = clamp(pc.scroll, 0, Math.max(0, rows.length - maxRows)), y = y0;
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
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, h - 44, w, 44);
    PC_APPS.forEach(function (a, i) { scButton(sc, 8 + i * 98, h - 38, 92, 32, a[1] + ' ' + a[2], pc.app === a[0], function () { pc.app = a[0]; pc.scroll = 0; }, '#78bdf5'); });
    c.fillStyle = '#a0acb8'; c.font = '13px Bahnschrift, Arial'; c.textAlign = 'right'; c.fillText('Day ' + S.day + ' · ' + fmtTime(S.time), w - 10, h - 16); c.textAlign = 'left';
    var app = pc.app;
    if (app === 'home') {
      scText(c, 24, 48, 'DEPOT OS', '#f5b53d', 34); scText(c, 24, 72, 'Depot Co. · ' + (S.weather ? S.weather.kind : 'clear') + ' · ' + SEASONS[season()] + (isSunday() ? ' · Sunday, closed' : ''), '#a0acb8', 14);
      var kp = [['Bank', money(S.bank)], ['Open orders', String(openOrders().length)], ['In stock', totalStock() + ' boxes'], ['Reputation', String(Math.round(S.rep))], ['Level', S.level + ' · ' + S.xp + '/' + XP_FOR(S.level)], ['Crew', S.staff.length + ' (' + S.staff.filter(function (s) { return s.clocked; }).length + ' on the clock)']];
      kp.forEach(function (k, i) { var x = 24 + (i % 3) * 250, y = 100 + Math.floor(i / 3) * 90; c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, y, 234, 76); scText(c, x + 14, y + 26, k[0].toUpperCase(), '#6b7784', 11); scText(c, x + 14, y + 58, k[1], '#eef1f5', 24); });
      var last = S.log.slice(0, 5); scText(c, 24, 300, 'RECENT', '#6b7784', 11); last.forEach(function (l, i) { scText(c, 24, 322 + i * 20, 'D' + l.day + ' ' + l.t + '  ' + l.msg.slice(0, 90), l.kind === 'bad' ? '#ff6b5e' : l.kind === 'good' ? '#5fd38d' : '#eef1f5', 12); });
    } else if (app === 'orders') {
      scHead(c, w, 'ORDERS', openOrders().length + ' open');
      var rows = S.orders.slice().sort(function (a, b) { return a.due - b.due; }).map(function (o) { return { text: '#' + o.num + '  ' + clientName(o.client) + (o.rush ? '  RUSH' : '') + (o.late ? '  LATE' : ''), sub: o.lines.map(function (l) { return l.qty + '× ' + skuName(l.sku); }).join(', ') + ' · due ' + dueText(o.due) + ' · ' + o.state, right: money(o.pay), col: o.late || o.rush ? '#ff6b5e' : '#eef1f5', hi: o.state !== 'open' }; });
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
      var rows3 = UPGRADES.map(function (u) { var rowN = /^row(\d)$/.test(u.id) ? +u.id.slice(3) : 0, owned = rowN ? S.up.rows >= rowN : !!S.up[u.id]; var needs = rowN && S.up.rows < rowN - 1 ? 'needs the previous row' : S.level < u.lvl ? 'level ' + u.lvl : S.bank < u.price ? 'not enough money' : ''; return { text: u.name + (owned ? '  ·  owned' : ''), sub: u.desc, right: money(u.price), btn: owned ? null : { label: needs ? needs.toUpperCase().slice(0, 14) : 'BUY', on: !needs, act: function () { if (!needs) buyUpgrade(u.id); }, col: '#5fd38d' } }; });
      pcRows(sc, rows3, 60, 50);
    } else if (app === 'staff') {
      scHead(c, w, 'STAFF', S.staff.length + ' of 5');
      var rows4 = Object.keys(STAFF_ROLES).map(function (r) { var d = STAFF_ROLES[r], locked = S.level < d.lvl || (d.needs && !S.up[d.needs]); return { text: 'Hire a ' + d.name.toLowerCase() + '  ·  ' + money(d.wage / 10) + '/h', sub: d.desc, btn: { label: locked ? (S.level < d.lvl ? 'LEVEL ' + d.lvl : 'NEEDS THE FORKLIFT') : S.staff.length >= 5 ? 'FULL' : 'HIRE', on: !locked && S.staff.length < 5, act: function () { if (!locked && S.staff.length < 5) { hireStaff(r); toast('Hired a ' + d.name.toLowerCase(), 'good'); } }, col: '#5fd38d' } }; });
      S.staff.forEach(function (st) { var sheet = st.sheet || [], hrs = sheet.reduce(function (a, r) { return a + r.h; }, 0), paid = sheet.reduce(function (a, r) { return a + r.pay; }, 0); rows4.push({ text: st.name + '  ·  ' + STAFF_ROLES[st.role].name + '  ·  ' + staffStatus(st), sub: 'today ' + (Math.round((st.hoursToday || 0) * 10) / 10) + ' h · last 7 days ' + (Math.round(hrs * 10) / 10) + ' h, ' + money(paid) + ' · punctuality ' + Math.round((st.punct || 0.5) * 100) + '%' + (st.lateToday ? ' · late today' : ''), hi: !!st.clocked, btn: { label: 'LET GO', on: false, act: function () { fireStaff(st.id); }, col: '#ff6b5e' } }); });
      pcRows(sc, rows4, 60, 50);
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
      var sum = stockSummary(), keys = Object.keys(sum).sort(); scHead(c, w, 'STOCK', totalStock() + ' boxes · ' + Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }).length + '/' + (S.up.rows * RACK.bays * RACK.levels.length) + ' slots');
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
      var rows7 = [['Pallets received', st2.received], ['Boxes put away', st2.putaway], ['Boxes picked', st2.picked], ['Orders packed', st2.packed], ['Orders shipped', st2.shipped], ['Late', st2.late], ['Pallets refused', st2.lost], ['Damaged boxes binned', S.binned || 0], ['Your hours on the clock', Math.round((st2.hoursWorked || 0) * 10) / 10], ['Reputation', Math.round(S.rep)], ['Level', S.level]].map(function (k) { return { text: k[0], right: String(k[1]) }; });
      pcRows(sc, rows7, 60, 34);
    }
  }
  function tickPc(dt) {
    if (!pc.on) return;
    pcCamera();
    if (pc.screen && Math.floor(worldTime * 2) !== pc.q) { pc.q = Math.floor(worldTime * 2); pc.screen.dirty = true; }
    var k = player.keys; if (k.KeyW || k.KeyA || k.KeyS || k.KeyD) closePc();
  }
