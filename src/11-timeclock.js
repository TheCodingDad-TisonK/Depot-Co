//@ the time clock: cards for you and the crew, clocked hours, lateness, overtime, days off, sick days, the timesheet and the pay that follows it
  // ── The time clock ────────────────────────────────────────────────
  // Nobody is paid a flat wage. The crew clock in at the reader by the staff door when they arrive and clock out when
  // they leave; the day's pay at 06:00 is their clocked hours at the hourly rate, with anything past ten hours at
  // time and a half. Punctuality is a trait: some are early, some drift in late, and a word puts them right for a while.
  var CLOCK_SPOT = { x: -19.0, z: 10.2 }, RAMP_BOTTOM = { x: -27.3, z: 12 }, SHIFT_START = 8;
  function hourly(st) { return STAFF_ROLES[st.role].wage / 10; }
  function shiftEnd(st) { return st.overtime ? 20 : 18; }
  function staffArrival(st) { return SHIFT_START + (st.arriveOff || 0) / 60; }
  function staffStatus(st) {
    if (isSunday()) return 'Sunday';
    if (st.sick) return 'called in sick'; if (st.dayOff) return 'day off';
    if (st.state === 'home' && S.time < staffArrival(st)) return 'due ' + fmtTime(staffArrival(st));
    if (st.state === 'home' && st.clockedOutAt) return 'clocked out ' + fmtTime(st.clockedOutAt);
    if (st.state === 'home') return 'not in';
    if (!st.clocked) return 'arriving';
    if (st.state === 'break') return 'on break';
    return 'in since ' + fmtTime(st.clockInAt || SHIFT_START) + (st.overtime ? ' · overtime' : '') + (st.lateToday ? ' · late' : '');
  }
  // the day's roll: who is sick, who is off, when each one will turn up
  function staffNewDay() {
    S.staff.forEach(function (st) {
      if (st.dayOffNext) { st.dayOff = true; st.dayOffNext = false; } else st.dayOff = false;
      st.sick = !st.dayOff && Math.random() < 0.04;
      if (st.punct === undefined) st.punct = randf(0.2, 1);
      var p = st.punct, r = Math.random();
      st.arriveOff = p > 0.75 ? randi(-12, -2) : p > 0.4 ? (r < 0.7 ? randi(-6, 4) : randi(6, 14)) : (r < 0.35 ? randi(-3, 3) : randi(8, 28));
      st.overtime = !!st.overtimeNext; st.overtimeNext = false;
      st.lateToday = false; st.hoursToday = 0; st.clockInAt = null; st.clockedOutAt = null; st.clocked = false; st.wordToday = false;
      if (st.sick) logEvent(st.name + ' called in sick', 'bad');
      if (st.dayOff) logEvent(st.name + ' has the day off');
      if (st.punct < 1) st.punct = clamp(st.punct - 0.01, 0.1, 1);   // a word wears off slowly
    });
  }
  // pay for yesterday from the timesheet
  function payStaffWages() {
    S.staff.forEach(function (st) {
      var h = st.hoursToday || 0, base = Math.min(h, 10), ot = Math.max(0, h - 10), amount = Math.round(hourly(st) * (base + ot * 1.5));
      if (!st.sheet) st.sheet = []; st.sheet.unshift({ day: S.day - 1, h: Math.round(h * 10) / 10, late: !!st.lateToday, sick: !!st.sick, off: !!st.dayOff, ot: Math.round(ot * 10) / 10, pay: amount }); if (st.sheet.length > 7) st.sheet.pop();
      st.hoursTotal = (st.hoursTotal || 0) + h;
      if (amount > 0) pay(-amount, 'Wages, ' + st.name + ' (' + (Math.round(h * 10) / 10) + ' h' + (ot ? ', ' + (Math.round(ot * 10) / 10) + ' h overtime' : '') + ')');
    });
  }
  function staffClockIn(st) {
    st.clocked = true; st.clockInAt = S.time; sfx('scan');
    if (S.time > SHIFT_START + 5 / 60) { st.lateToday = true; st.lateDays = (st.lateDays || 0) + 1; staffSay(st, pick(['Sorry, the ring road.', 'Late. I know. Sorry.', 'Overslept. Will not happen again.', 'Bus did not come.']), '#ff6b5e'); logEvent(st.name + ' clocked in late at ' + fmtTime(S.time), 'bad'); }
    else staffSay(st, voice(st).hi, '#5fd38d');
    screenDirtyAll();
  }
  function staffClockOut(st) { st.clocked = false; st.clockedOutAt = S.time; sfx('scan'); staffSay(st, voice(st).bye, '#a0acb8'); screenDirtyAll(); }
  function staffWord(st) {
    if (st.wordToday) { toast('You already had a word with ' + st.name + ' today.', ''); return; }
    st.wordToday = true; st.punct = clamp(st.punct + 0.35, 0, 1); sfx('click');
    staffSay(st, pick(['Understood, boss.', 'Fair enough. I will be on time.', 'Will not happen again.']), '#f5b53d'); logEvent('Had a word with ' + st.name + ' about timekeeping'); addRep(0.2);
  }

  // your own card
  function myClock(on) {
    if (on === !!S.clockedIn) return;
    if (on) { S.clockedIn = true; S.clockInAt = S.time; S.clockInDay = S.day; introStep('clockin'); S.shiftStart = { shipped: S.stats.shipped, received: S.stats.received, earned: S.stats.earned, spent: S.stats.spent }; sfx('scan'); toast('Clocked in at ' + fmtTime(S.time), 'good'); logEvent('You clocked in at ' + fmtTime(S.time)); if (S.time < 7.5) { addXp(5); toast('Early bird: +5 XP', 'rare'); } }
    else {
      var h = S.clockInDay === S.day ? S.time - S.clockInAt : (24 - S.clockInAt) + S.time, ss = S.shiftStart || S.stats;
      S.clockedIn = false; S.stats.hoursWorked = (S.stats.hoursWorked || 0) + h; sfx('scan');
      var rep = 'Shift: ' + (Math.round(h * 10) / 10) + ' h · ' + (S.stats.shipped - ss.shipped) + ' orders shipped · ' + (S.stats.received - ss.received) + ' pallets in · ' + money(S.stats.earned - ss.earned) + ' earned, ' + money(S.stats.spent - ss.spent) + ' spent';
      toast('Clocked out. ' + rep, 'good'); logEvent('You clocked out at ' + fmtTime(S.time) + '. ' + rep, 'rare'); if (h >= 8) addXp(10);
    }
    hudDirty = true; screenDirtyAll();
  }
  function myHours() { if (!S.clockedIn) return 0; return S.clockInDay === S.day ? S.time - S.clockInAt : (24 - S.clockInAt) + S.time; }

  // the reader on the wall: a touch screen with a card slot and a lamp
  var tclock = { page: 0 };
  function buildTimeClock() {
    var X = HALL.x, g = new THREE.Group(); g.position.set(-X + 0.26, 0, 10.2); scene.add(g);
    box(0.38, 0.5, 0.12, MAT.grey, 0, 1.5, 0, g); box(0.4, 0.04, 0.14, MAT.steelDark, 0, 1.76, 0, g); box(0.4, 0.04, 0.14, MAT.steelDark, 0, 1.24, 0, g);
    box(0.02, 0.03, 0.12, MAT.black, 0.07, 1.3, 0, g); var lamp = box(0.02, 0.03, 0.03, glowMat(0x39d353, 1.2), 0.07, 1.68, -0.14, g); tclock.lamp = lamp;
    box(0.08, 0.5, 0.5, MAT.steelDark, -0.02, 1.5, 0.55, g); for (var k = 0; k < 6; k++) box(0.03, 0.14, 0.06, MAT.paper, 0.04, 1.62 - (k % 3) * 0.14, 0.36 + Math.floor(k / 3) * 0.22, g);
    sign(['CLOCK IN'], 0.6, 0.16, -0.05, 1.85, 0.3, Math.PI / 2, { w: 256, h: 64, bg: '#1b232c', fg: '#eef1f5' }, g);
    touchScreen({ w: 300, h: 320, pw: 0.3, ph: 0.32, x: 0.07, y: 1.5, z: 0, ry: Math.PI / 2, parent: g, title: 'Time clock', draw: drawTimeClock });
    tclock.g = g;
  }
  function drawTimeClock(c, sc) {
    scBg(c, sc.w, sc.h, 'rgba(120,189,245,0.16)'); scHead(c, sc.w, tclock.page ? 'TIMESHEET' : 'TIME CLOCK');
    scButton(sc, 230, 8, 60, 24, tclock.page ? 'now' : 'sheet', false, function () { tclock.page = tclock.page ? 0 : 1; });
    var y = 60;
    if (!tclock.page) {
      scText(c, 12, y, 'You · ' + (S.clockedIn ? 'in since ' + fmtTime(S.clockInAt) + ' (' + (Math.round(myHours() * 10) / 10) + ' h)' : 'not clocked in'), S.clockedIn ? '#5fd38d' : '#eef1f5', 13);
      scButton(sc, 12, y + 8, 276, 32, S.clockedIn ? 'CLOCK OUT' : 'CLOCK IN', !S.clockedIn, function () { myClock(!S.clockedIn); }, '#5fd38d'); y += 54;
      if (!S.staff.length) scText(c, 12, y + 10, 'No crew yet. Hire on the office PC.', '#6b7784', 12);
      S.staff.forEach(function (st) {
        if (y > sc.h - 30) return;
        scText(c, 12, y, st.name + ' · ' + STAFF_ROLES[st.role].name, '#eef1f5', 12); scText(c, 12, y + 14, staffStatus(st) + (st.hoursToday ? ' · ' + (Math.round(st.hoursToday * 10) / 10) + ' h' : ''), st.lateToday ? '#ff6b5e' : '#a0acb8', 10);
        scButton(sc, 196, y - 10, 28, 22, 'OT', !!(st.overtime || st.overtimeNext), function () { if (S.time < 18 && !st.sick && !st.dayOff && st.clocked) st.overtime = !st.overtime; else st.overtimeNext = !st.overtimeNext; toast(st.name + (st.overtime || st.overtimeNext ? ' works till 20:00 at time and a half' : ' goes home at 18:00'), ''); }, '#f5b53d');
        scButton(sc, 228, y - 10, 30, 22, 'OFF', !!st.dayOffNext, function () { st.dayOffNext = !st.dayOffNext; toast(st.name + (st.dayOffNext ? ' has tomorrow off' : ' is in tomorrow'), ''); }, '#78bdf5');
        if (st.lateToday && !st.wordToday) scButton(sc, 262, y - 10, 28, 22, '!', true, function () { staffWord(st); }, '#ff6b5e');
        y += 34;
      });
    } else {
      scText(c, 12, y, 'Last 7 days · hours (overtime) · pay', '#a0acb8', 11); y += 18;
      S.staff.forEach(function (st) {
        if (y > sc.h - 24) return;
        var tot = (st.sheet || []).reduce(function (a, r) { return a + r.pay; }, 0), hrs = (st.sheet || []).reduce(function (a, r) { return a + r.h; }, 0), lates = (st.sheet || []).filter(function (r) { return r.late; }).length;
        scText(c, 12, y, st.name + ' · ' + (Math.round(hrs * 10) / 10) + ' h · ' + money(tot) + (lates ? ' · late ×' + lates : ''), '#eef1f5', 12); y += 14;
        scText(c, 12, y, (st.sheet || []).slice(0, 7).map(function (r) { return r.sick ? 'sick' : r.off ? 'off' : r.h + (r.ot ? '+' + r.ot : ''); }).join('  ') || 'no days yet', '#a0acb8', 10); y += 20;
      });
      scText(c, 12, sc.h - 10, 'You: ' + (Math.round((S.stats.hoursWorked || 0) * 10) / 10) + ' h on the clock all time', '#6b7784', 10);
    }
  }
  function tickTimeClock(dt) {
    if (tclock.lamp) tclock.lamp.material.emissive.setHex(S.events.power ? 0x333333 : (S.clockedIn ? 0x39d353 : 0xf5b53d));
    if (Math.floor(S.time * 12) !== tclock.q) { tclock.q = Math.floor(S.time * 12); screenDirtyAll(); }
  }
