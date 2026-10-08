//@ the time clock: cards for you and the crew, clocked hours, lateness, overtime, days off, sick days, the timesheet and the pay that follows it
  // ── The time clock ────────────────────────────────────────────────
  // Nobody is paid a flat wage. The crew clock in at the reader by the staff door when they arrive and clock out when
  // they leave; the day's pay at the day roll is their clocked hours at the hourly rate, with anything past ten hours at
  // time and a half. Punctuality is a trait: some are early, some drift in late, and a word puts them right for a while.
  var RAMP_BOTTOM = { x: -HALL.x - 7.3, z: SPOT.staffDoor.z }, SHIFT_START = 8;   // the foot of the ramp outside the staff door, whichever wall that is in
  // the staff options (1.14.0): a shift pattern, a training course, a raise that fixes timekeeping, a second role, a bigger crew at level 7
  var STAFF_SHIFTS = { early: { start: 6, end: 16 }, day: { start: 8, end: 18 }, late: { start: 12, end: 22 } }, TRAIN_PRICE = 400, CROSS_PRICE = 350, RAISE_PRICE = 250;
  function staffOption(what) { return unlocked(what); }   // shifts, training, raise, cross: each on the ladder
  function shiftOf(st) { return STAFF_SHIFTS[st.shift] || STAFF_SHIFTS.day; }
  function shiftStart(st) { return shiftOf(st).start; }
  function hourly(st) { return STAFF_ROLES[st.role].wage / 10 * (st.raise ? 1.1 : 1); }
  function shiftEnd(st) { var e = shiftOf(st).end; return st.overtime ? Math.min(DAY_END, e + 2) : e; }
  function staffArrival(st) { return shiftStart(st) + (st.arriveOff || 0) / 60; }
  function staffCap() { return staffCapAt(S.level); }   // the ladder's heads by level (1.21.0)
  function staffTrain(st) { if (st.trained) return; if (!unlocked('training')) { toast('Training courses come at level ' + UNLOCK.training + '.', 'bad'); return; } if (S.bank < TRAIN_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-TRAIN_PRICE, 'Training course, ' + st.name); st.trained = true; sfx('cash'); toast(st.name + ' is trained: quicker on their feet and at every task', 'good'); logEvent(st.name + ' finished the ' + STAFF_ROLES[st.role].name.toLowerCase() + ' course', 'good'); }
  function staffRaise(st) { if (st.raise) return; if (!unlocked('raise')) { toast('Raises come at level ' + UNLOCK.raise + '.', 'bad'); return; } if (S.bank < RAISE_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-RAISE_PRICE, 'Raise for ' + st.name); st.raise = true; st.punct = 1; if ((st.arriveOff || 0) > 0) st.arriveOff = 0; sfx('cash'); staffSay(st, pick(['Cheers, boss.', 'I will not let you down.', 'Appreciated.']), '#5fd38d'); logEvent(st.name + ' got a raise: 10% more an hour, and on time from now on', 'good'); }
  // a new shift pattern starts tomorrow for anyone who has been in today (a day worker put on early at 16:00 used to clock out on the spot and drop what they held); someone not yet in today takes it now
  function staffShiftCycle(st) { if (!unlocked('shifts')) { toast('Shift patterns come at level ' + UNLOCK.shifts + '.', 'bad'); return; } var order = ['day', 'early', 'late'], cur = st.shiftNext || st.shift || 'day', nx = order[(order.indexOf(cur) + 1) % 3], now = st.state === 'home' && !st.clocked && !st.clockedOutAt; if (now) { st.shift = nx; st.shiftNext = null; } else st.shiftNext = nx; var sh = STAFF_SHIFTS[nx]; sfx('click'); toast(st.name + ' moves to the ' + nx + ' shift' + (now ? '' : ' from tomorrow') + ' (' + fmtTime(sh.start) + ' to ' + fmtTime(sh.end) + ')', 'good'); logEvent(st.name + ' moves to the ' + nx + ' shift' + (now ? '' : ' from tomorrow')); }
  function staffCrossCycle(st) {
    if (!unlocked('cross')) { toast('Second roles come at level ' + UNLOCK.cross + '.', 'bad'); return; }
    var roles = Object.keys(STAFF_ROLES).filter(function (r) { return r !== st.role && !(STAFF_ROLES[r].needs && !S.up[STAFF_ROLES[r].needs]); }); if (!roles.length) return;
    var i = roles.indexOf(st.cross || ''), next = i < 0 ? roles[0] : i + 1 < roles.length ? roles[i + 1] : null;
    if (next && !st.crossPaid) { if (S.bank < CROSS_PRICE) { toast('Not enough money.', 'bad'); return; } pay(-CROSS_PRICE, 'Cross-training, ' + st.name); st.crossPaid = true; }
    st.cross = next; if (st.state === 'idle') st.task = null; sfx('click');   // a worker mid-task keeps it: dropping a fetch or a pick orphaned the claim
    var cm = staffMeshes[st.id], wantJack = st.role === 'receiver' || st.cross === 'receiver';
    if (cm && wantJack && !cm.userData.jack && jackModel) cm.userData.jack = jackModel('staffjack', true);
    if (cm && !wantJack && cm.userData.jack) { scene.remove(cm.userData.jack); cm.userData.jack = null; st.jackParked = false; st.jackAt = null; }
    toast(next ? st.name + ' also covers ' + STAFF_ROLES[next].name.toLowerCase() + ' work when their own queue is empty' : st.name + ' sticks to ' + STAFF_ROLES[st.role].name.toLowerCase() + ' work', 'good');
  }
  function staffStatus(st) {
    if (isSunday()) return 'Sunday';
    if (st.sick) return 'called in sick'; if (st.dayOff) return 'day off';
    if (st.state === 'home' && S.time < staffArrival(st)) return 'due ' + fmtTime(staffArrival(st));
    if (st.state === 'home' && st.clockedOutAt) return 'clocked out ' + fmtTime(st.clockedOutAt);
    if (st.state === 'home') return 'not in';
    if (!st.clocked) return 'arriving';
    if (st.state === 'break') return 'on break';
    return 'in since ' + fmtTime(st.clockInAt || shiftStart(st)) + (st.overtime ? ' · overtime' : '') + (st.lateToday ? ' · late' : '');
  }
  // the day's roll: who is sick, who is off, when each one will turn up
  function staffNewDay() {
    S.staff.forEach(function (st) {
      if (st.state !== 'home') { staffDropAll(st); st.state = 'home'; } if (hasJack(st)) { st.jackParked = true; st.jackAt = jackHome(st); }   // the jacks stand in their row overnight, wherever the day left them   // whoever was still in at the roll (a sleep at 17:00, a late shift at midnight) goes home now, or they stand frozen from then on
      if (st.shiftNext) { st.shift = st.shiftNext; st.shiftNext = null; }
      if (st.dayOffNext && !isSunday()) { st.dayOff = true; st.dayOffNext = false; } else st.dayOff = false;   // a day off booked for a Sunday keeps for Monday
      st.sick = !st.dayOff && Math.random() < 0.04;
      if (st.punct === undefined) st.punct = randf(0.2, 1); if (st.raise) st.punct = 1;   // a raise keeps them on time for good
      var p = st.punct, r = Math.random();
      st.arriveOff = p > 0.75 ? randi(-12, -2) : p > 0.4 ? (r < 0.7 ? randi(-6, 4) : randi(6, 14)) : (r < 0.35 ? randi(-3, 3) : randi(8, 28));
      st.overtime = !!st.overtimeNext; st.overtimeNext = false;
      st.said = 0; st.lateToday = false; st.hoursToday = 0; st.clockInAt = null; st.clockedOutAt = null; st.clocked = false; st.wordToday = false; st.leaving = false; st.leavingWait = false;
      if (st.sick) logEvent(st.name + ' called in sick', 'bad');
      if (st.dayOff) logEvent(st.name + ' has the day off');
      if (st.punct < 1 && !st.raise) st.punct = clamp(st.punct - 0.01, 0.1, 1);   // a word wears off slowly
    });
  }
  // pay for yesterday from the timesheet
  function payStaffWages() {
    S.staff.forEach(function (st) {
      var h = st.hoursToday || 0, base = Math.min(h, 10.25), ot = Math.max(0, h - 10.25), amount = Math.round(hourly(st) * (base + ot * 1.5));   // a quarter hour's grace: an early arrival and the clock-out walk are on the clock too
      if (!st.sheet) st.sheet = []; st.sheet.unshift({ day: S.day - 1, h: Math.round(h * 10) / 10, late: !!st.lateToday, sick: !!st.sick, off: !!st.dayOff, ot: Math.round(ot * 10) / 10, pay: amount }); if (st.sheet.length > 7) st.sheet.pop();
      st.hoursTotal = (st.hoursTotal || 0) + h;
      if (amount > 0) pay(-amount, 'Wages, ' + st.name + ' (' + (Math.round(h * 10) / 10) + ' h' + (ot ? ', ' + (Math.round(ot * 10) / 10) + ' h overtime' : '') + ')');
    });
  }
  function staffClockIn(st) {
    st.clocked = true; st.clockInAt = S.time; sfx('scan');
    if (S.time > shiftStart(st) + 5 / 60 && st.hiredDay !== S.day) { st.lateToday = true; st.lateDays = (st.lateDays || 0) + 1; staffSay(st, pick(['Sorry, the ring road.', 'Late. I know. Sorry.', 'Overslept. Will not happen again.', 'Bus did not come.']), '#ff6b5e'); logEvent(st.name + ' clocked in late at ' + fmtTime(S.time), 'bad'); }
    else staffSay(st, voice(st).hi, '#5fd38d');
    screenDirtyAll();
  }
  function staffClockOut(st) { st.clocked = false; st.clockedOutAt = S.time; sfx('scan'); staffSay(st, voice(st).bye, '#a0acb8'); screenDirtyAll(); }
  function staffWord(st) {
    if (st.wordToday) { toast('You already had a word with ' + st.name + ' today.', ''); return; }
    st.wordToday = true; st.punct = clamp(st.punct + 0.35, 0, 0.99); sfx('click');   // short of the raise's pinned 1: a word wears off, a raise does not
    staffSay(st, pick(['Understood, boss.', 'Fair enough. I will be on time.', 'Will not happen again.']), '#f5b53d'); logEvent('Had a word with ' + st.name + ' about timekeeping'); if (S.wordRepDay !== S.day) { S.wordRepDay = S.day; addRep(0.2); }
  }

  // your own card
  function myClock(on) {
    if (on === !!S.clockedIn) return;
    if (on) { S.clockedIn = true; S.clockInAt = S.time; S.clockInDay = S.day; introStep('clockin'); S.shiftStart = { shipped: S.stats.shipped, received: S.stats.received, earned: S.stats.earned, spent: S.stats.spent }; sfx('scan'); toast('Clocked in at ' + fmtTime(S.time), 'good'); logEvent('You clocked in at ' + fmtTime(S.time)); if (S.time < 7.5 && S.time >= DAY_START && S.earlyDay !== S.day) { S.earlyDay = S.day; addXp(5); toast('Early bird: +5 XP', 'rare'); } }
    else {
      var h = S.clockInDay === S.day ? S.time - S.clockInAt : (24 - S.clockInAt) + S.time, ss = S.shiftStart || S.stats;
      S.clockedIn = false; S.stats.hoursWorked = (S.stats.hoursWorked || 0) + h; sfx('scan');
      var rep = 'Shift: ' + (Math.round(h * 10) / 10) + ' h · ' + (S.stats.shipped - ss.shipped) + ' orders shipped · ' + (S.stats.received - ss.received) + ' pallets in · ' + money(S.stats.earned - ss.earned) + ' earned, ' + money(S.stats.spent - ss.spent) + ' spent';
      toast('Clocked out. ' + rep, 'good'); logEvent('You clocked out at ' + fmtTime(S.time) + '. ' + rep, 'rare'); if (h >= 8) addXp(10);
    }
    hudDirty = true; screenDirtyAll();
  }
  function myHours() { if (!S.clockedIn) return 0; return S.clockInDay === S.day ? S.time - S.clockInAt : (24 - S.clockInAt) + S.time; }

  // the reader on the wall (built by the timeclock prop in 06-props): a touch screen with a card slot and a lamp
  var tclock = { page: 0 };
  function buildTimeClockOld() {   // the 1.x version, kept only until the prop version has been through a release; unused
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
        var otOk = shiftOf(st).end < DAY_END; scButton(sc, 196, y - 10, 28, 22, 'OT', !!(st.overtime || st.overtimeNext), function () { if (!otOk) { toast('The late shift already ends at closing time.', ''); return; } if (st.clocked && !st.sick && !st.dayOff) st.overtime = !st.overtime; else st.overtimeNext = !st.overtimeNext; var e = STAFF_SHIFTS[st.shiftNext || st.shift || 'day'].end; toast(st.name + (st.overtime || st.overtimeNext ? ' works till ' + fmtTime(Math.min(DAY_END, e + 2)) + ' at time and a half' : ' goes home at ' + fmtTime(e)), ''); }, '#f5b53d');
        scButton(sc, 228, y - 10, 30, 22, 'OFF', !!st.dayOffNext, function () { st.dayOffNext = !st.dayOffNext; toast(st.name + (st.dayOffNext ? ' has tomorrow off' : ' is in tomorrow'), ''); }, '#78bdf5');
        if (st.lateToday && !st.wordToday) scButton(sc, 262, y - 10, 28, 22, '!', true, function () { staffWord(st); }, '#ff6b5e');
        y += 27;   // eight rows fit the screen since the crew grew to eight
      });
    } else {
      scText(c, 12, y, 'Last 7 days · hours (overtime) · pay', '#a0acb8', 11); y += 18;
      S.staff.forEach(function (st) {
        if (y > sc.h - 24) return;
        var tot = (st.sheet || []).reduce(function (a, r) { return a + r.pay; }, 0), hrs = (st.sheet || []).reduce(function (a, r) { return a + r.h; }, 0), lates = (st.sheet || []).filter(function (r) { return r.late; }).length;
        scText(c, 12, y, st.name + ' · ' + (Math.round(hrs * 10) / 10) + ' h · ' + money(tot) + (lates ? ' · late ×' + lates : ''), '#eef1f5', 12); y += 14;
        scText(c, 12, y, (st.sheet || []).slice(0, 7).map(function (r) { return r.sick ? 'sick' : r.off ? 'off' : (Math.round((r.h - r.ot) * 10) / 10) + (r.ot ? '+' + r.ot : ''); }).join('  ') || 'no days yet', '#a0acb8', 10); y += 20;
      });
      scText(c, 12, sc.h - 10, 'You: ' + (Math.round((S.stats.hoursWorked || 0) * 10) / 10) + ' h on the clock all time', '#6b7784', 10);
    }
  }
  function tickTimeClock(dt) {
    if (tclock.lamp) tclock.lamp.material.emissive.setHex(S.events.power ? 0x333333 : (S.clockedIn ? 0x39d353 : 0xf5b53d));
    if (Math.floor(S.time * 12) !== tclock.q) { tclock.q = Math.floor(S.time * 12); screenDirtyAll(); }
  }
