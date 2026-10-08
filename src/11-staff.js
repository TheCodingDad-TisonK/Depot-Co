//@ people: the route finder's shape, the three staff roles and their voices, hiring, the day's work (the rig and the router are the engine's)
  // ── People and the route finder ───────────────────────────────────
  // the rig, the faces, the walking and the speech are the engine's (Co Engine 22-people); so is the route finder (25-nav), which the
  // depot sizes over the hall and the dock aprons, north to z -66 for the annex halls and the wing. Staff carry keys, so hinged
  // doors never block them; outside the halls a walker may cross the staff door's ramp and a docked trailer
  navSetup({ x0: -HALL.x - 14, z0: -HALL.z - 42, width: 2 * HALL.x + 28, depth: 2 * HALL.z + 44, cell: 0.4 });
  GAME.navPass = function (x, z) {
    if (x <= -HALL.x + 0.6 && x > -HALL.x - 7.6 && Math.abs(z - SPOT.staffDoor.z) < 0.8) return true;
    for (var k = 0; k < S.trucks.length; k++) { var t = S.trucks[k]; if (t.state !== 'docked' || t.van) continue; var tb = trailerBounds(t); if (x > tb.x0 - 0.3 && x < tb.x1 - 0.6 && z > tb.z0 + 0.3 && z < tb.z1 - 0.3) return true; if (Math.abs(z - t.z) < 1.0 && ((t.side < 0 && x < -HALL.x + 0.5 && x > tb.x0) || (t.side > 0 && x > HALL.x - 0.5 && x < tb.x1))) return true; }
    return false;
  };
  function slotStand(key) { var p = slotParse(key), sp = rackSlotPos(p.r, p.b, p.l), a = sp.ry || 0, nx = Math.sin(a), nz = Math.cos(a); var A = { x: sp.x + nx * 1.4, z: sp.z + nz * 1.4 }, B = { x: sp.x - nx * 1.4, z: sp.z - nz * 1.4 }; if (NAV.dirty || !NAV.grid) navBuild(); var ca = navCell(A), cb = navCell(B); if (navOpen(ca.i, ca.j)) return A; if (navOpen(cb.i, cb.j)) return B; return A; }

  // ── Staff ─────────────────────────────────────────────────────────
  var staffMeshes = {};
  var VOICE = {
    Jo:   { hi: 'Morning, boss. What have we got?', bye: 'That is me done. See you tomorrow.', onit: 'On it.', full: 'Bench is full, boss.', nospace: 'No rack space for this one.', idle: ['Quiet one today.', 'Did you see the game last night?', 'Coffee machine is on the blink again.', 'That truck driver never stops talking.'], brk: 'Lunch. Back in a bit.' },
    Mika: { hi: 'Right. Clocking in.', bye: 'Home time.', onit: 'Yep.', full: 'Bench. Full.', nospace: 'Nowhere to put it.', idle: ['Hm.', 'Could use a second jack.', 'Rain again.', 'Row C needs sorting.'], brk: 'Break.' },
    Sam:  { hi: 'Alright mate, what is the plan?', bye: 'Cheers, see you tomorrow mate.', onit: 'Leave it with me.', full: 'Bench is rammed, mate.', nospace: 'Racks are chocka, mate.', idle: ['Fancy a brew after this?', 'Those tyres weigh a ton.', 'Reckon it will rain?', 'New lad on the gate is alright.'], brk: 'Sarnie time.' },
    Ravi: { hi: 'Good morning. Ready when you are.', bye: 'Have a good evening.', onit: 'Certainly.', full: 'The bench cannot take any more.', nospace: 'There is no slot for this line.', idle: ['The orders are picking up.', 'I counted row A twice. It is right.', 'Lovely day for it.', 'The inspector is due soon, I think.'], brk: 'I will take my break now.' },
    Lena: { hi: 'Hey. Let us get it moving.', bye: 'Done for today. Night.', onit: 'Got it.', full: 'Bench is maxed.', nospace: 'Zero slots left for that.', idle: ['Forklift beeps are stuck in my head.', 'Who left the dock open?', 'I like the new sign.', 'Need more tape at the bench.'], brk: 'Lunch!' },
    Ada:  { hi: 'Morning all.', bye: 'Off home.', onit: 'Sure.', full: 'No room on the bench.', nospace: 'Racks are full for that line.', idle: ['Peaceful.', 'Trucks are late today.', 'Nice and tidy, that row.', 'I will sort the empties later.'], brk: 'Tea break.' },
    Theo: { hi: 'Yo. Clocking in.', bye: 'Peace.', onit: 'Say less.', full: 'Bench is packed out.', nospace: 'Nowhere for it, chief.', idle: ['Radio is decent today.', 'Who ordered forty lamps?', 'Yard is slippy.', 'Pigeons are back.'], brk: 'Food.' },
    Nour: { hi: 'Good morning. Shall we?', bye: 'Goodnight, everyone.', onit: 'Of course.', full: 'The bench is full, I am afraid.', nospace: 'No rack space for this pallet.', idle: ['The clients are happy this week.', 'I rewrote the pick list.', 'It is cold in here.', 'Nice work on that order.'], brk: 'Lunch time.' }
  };
  function voice(st) { return VOICE[st.name] || VOICE.Jo; }
  function staffSay(st, text, col) { var m = staffMeshes[st.id]; if (m && m.visible) say(m, text, col); }
  function staffById(id) { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].id === id) return S.staff[i]; return null; }
  function onBreak(st) { var b = shiftStart(st) + 4; return S.time >= b && S.time < b + breakLen(); }   // four hours into their own shift; half an hour bare, down to a quarter with the rooms furnished (breakLen, 06-props4-furniture)
  function hireStaff(role) {
    var def = STAFF_ROLES[role]; if (!def) return;
    if (S.level < def.lvl) { toast('A ' + def.name.toLowerCase() + ' can be hired from level ' + def.lvl + '.', 'bad'); return; } if (S.staff.length >= staffCap()) { toast('The crew is ' + staffCap() + ' at this level: it grows as you level.', 'bad'); return; }   // the ladder gates the hire itself, not only the buttons (1.21.0)
    if (def.needs && !S.up[def.needs]) { toast('Buy the forklift first: a driver needs something to drive.', 'bad'); return; }
    var used = S.staff.map(function (s) { return s.name; }), free = STAFF_NAMES.filter(function (n) { return used.indexOf(n) < 0; }), name = free.length ? free[S.nextStaffName++ % free.length] : STAFF_NAMES[S.nextStaffName++ % STAFF_NAMES.length];   // no two Jos
    var st = { id: uid('st'), name: name, role: role, x: SPOT.spawn.x, z: SPOT.spawn.z, yaw: 0, state: 'home', path: [], timer: 0, carry: null, task: null, hiredDay: S.day, look: { skin: pick(SKINS), hair: pick(HAIRS), style: pick(['short', 'long', 'bun', 'bald', 'short']) }, said: 0, punct: randf(0.2, 1), arriveOff: 0, hoursToday: 0, sheet: [] };
    S.staff.push(st); buildStaffMesh(st); logEvent('Hired ' + name + ' as ' + def.name.toLowerCase() + '. Paid ' + money(def.wage / 10) + ' an hour from the time clock, time and a half past ten hours.', 'good'); hudDirty = true; if (S.time < 17 && !isSunday()) { st.state = 'home'; st.arriveOff = Math.max(0, Math.round((S.time + 0.15 - SHIFT_START) * 60)); }   // hired before the shift: they come in at the start, not in the night
  }
  function fireStaff(id) {
    var st = staffById(id); if (!st) return;
    staffDropAll(st); var fh = st.hoursToday || 0; if (fh > 0.05 && st.clocked !== undefined) { var fpay = Math.round(hourly(st) * (Math.min(fh, 10.25) + Math.max(0, fh - 10.25) * 1.5)); if (fpay > 0) pay(-fpay, 'Final pay, ' + st.name + ' (' + (Math.round(fh * 10) / 10) + ' h)'); }   // the hours worked today are paid on the way out
    var m = staffMeshes[id]; if (m) { if (m.userData.jack) scene.remove(m.userData.jack); if (m.userData.hit) { var hi = inter.indexOf(m.userData.hit); if (hi >= 0) inter.splice(hi, 1); } scene.remove(m); delete staffMeshes[id]; }
    S.staff.splice(S.staff.indexOf(st), 1); logEvent(st.name + ' let go'); hudDirty = true;
  }
  function buildStaffMesh(st) {
    var vest = st.role === 'receiver' ? MAT.hivisOrange : st.role === 'picker' ? MAT.hivis : st.role === 'driver' ? MAT.hivis : MAT.green;
    var look = st.look || {};
    var g = makeHuman({ skin: look.skin, hair: look.hair, style: look.style, vest: vest, hardhat: st.role === 'receiver' || st.role === 'driver' ? (st.role === 'driver' ? MAT.yellow : MAT.white) : null, name: st.name }); g.userData.dynamic = true; g.position.set(st.x, 0, st.z); scene.add(g); staffMeshes[st.id] = g;
    if (hasJack(st) && jackModel) g.userData.jack = jackModel('staffjack', true);
    g.userData.hit = hitBox(0.7, 1.9, 0.7, 0, 0.95, 0, { staffId: st.id, prompt: function () { return staffPrompt(st); }, use: function () { staffUse(st); } }, g);   // look at a worker: name, job, status, timekeeping   // a receiver has a pallet jack of their own: pushed under the pallet, towed behind them when empty
  }
  // the receiver's jack. Loaded: pushed ahead with the tiller lowered to 31 degrees, so its grip meets both hands half a metre in
  // front at hip height. Empty and walking: towed behind on one trailing arm, tiller at 20 degrees, the grip in that hand just
  // behind the hip; its heading eases after the figure so a turn does not whip it round. Standing: parked behind them, tiller
  // sprung up. The distances are STAFF_JACK; the tiller is 1 m long on a pivot 0.78 m behind the jack's origin at 0.5 m.
  function jackFollow(st, m, onJack, dt, walking) {
    var j = m.userData.jack; if (!j) return; var u = j.userData, parked = !!(st.jackParked && st.jackAt), ease = 1 - Math.exp(-(dt || 1 / 60) * 6);
    j.visible = parked || m.visible;   // a parked jack stays in the hall while its owner is on a break, at the clock or at home
    var tilt = parked ? -0.3 : onJack ? -1.025 : walking ? -1.213 : -0.3;
    if (u.tilt === undefined) u.tilt = tilt; else u.tilt += (tilt - u.tilt) * ease; if (u.tiller) u.tiller.rotation.x = u.tilt;
    if (parked) { j.position.set(st.jackAt.x, floorY(st.jackAt.x, st.jackAt.z), st.jackAt.z); j.rotation.y = st.jackAt.ry || 0; return; }
    var fy = floorY(st.x, st.z);
    if (onJack) { u.towRy = undefined; u.towD = undefined; j.position.set(st.x + Math.sin(st.yaw) * STAFF_JACK.push, fy, st.z + Math.cos(st.yaw) * STAFF_JACK.push); j.rotation.y = st.yaw; }
    else {
      var want = walking ? STAFF_JACK.tow : STAFF_JACK.park, cur = u.towRy === undefined ? st.yaw : u.towRy, d = Math.atan2(Math.sin(st.yaw - cur), Math.cos(st.yaw - cur)); cur += d * ease; u.towRy = cur;
      u.towD = u.towD === undefined ? want : u.towD + (want - u.towD) * ease;
      j.position.set(st.x - Math.sin(cur) * u.towD, fy, st.z - Math.cos(cur) * u.towD); j.rotation.y = cur + Math.PI;
    }
    st.jackAt = { x: j.position.x, z: j.position.z, ry: j.rotation.y };   // where it would stay if they walked off now
  }
  function staffDriving() { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].state === 'drive') return S.staff[i]; return null; }
  function staffDropAll(st) {
    if (st.state === 'drive') driverDismount(st);
    S.pallets.forEach(function (p) { if (p.place === 'staff' && p.staff === st.id) { p.place = 'floor'; p.x = st.x; p.z = st.z; p.y = floorY(p.x, p.z); p.rot = st.yaw; p.staff = null; } });   // a pallet on the jack is set down where the worker stands (two metres ahead put it inside the rack they were facing)
    if (st.carry) {
      var cy = st.carry, bk = cy.kind === 'box' && !cy.damaged ? findSlotFor(cy.sku, 1, 1) : null;
      if (cy.kind === 'box') { if (bk) slotAdd(bk, cy.sku, 1); else S.floor.push({ kind: 'box', sku: cy.sku, damaged: !!cy.damaged, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); }
      else if (cy.kind === 'return') { if (rdesk().queue.length < rdeskCap()) rdesk().queue.push(cy.id); else S.floor.push({ kind: 'return', id: cy.id, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); }
      else if (orderById(cy.order) && S.bench.parcels.length < shelfCap()) S.bench.parcels.push(cy.order);
      else if (orderById(cy.order)) S.floor.push({ kind: 'parcel', order: cy.order, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw });
      st.carry = null;
    }
    st.task = null; st.state = 'idle'; st.path = [];
  }
  function staffGo(st, to, then) { st.path = route({ x: st.x, z: st.z }, to); st.state = 'walk'; st.then = then; }
  function staffWalk(st, dt) {
    if (!st.path.length) { st.state = st.then || 'idle'; st.then = null; return; }
    var t = st.path[0], dx = t.x - st.x, dz = t.z - st.z, d = Math.sqrt(dx * dx + dz * dz), sp = (st.carry || S.pallets.some(function (p) { return p.place === 'staff' && p.staff === st.id; }) ? 1.6 : 1.9) * (st.trained ? 1.2 : 1) * dt;   // a trained worker walks a fifth faster
    if (d <= sp) { st.x = t.x; st.z = t.z; st.path.shift(); if (!st.path.length) { st.state = st.then || 'idle'; st.then = null; } return; }
    st.x += dx / d * sp; st.z += dz / d * sp;
    var want = Math.atan2(dx, dz), diff = want - st.yaw; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI; st.yaw += diff * Math.min(1, 10 * dt);
  }
  // boxes already on their way to the bench, by SKU: on the pick belts and the merge, in a crane's grab, in a picker's hands, or
  // claimed by a picker walking to the slot. The cranes and the pickers both subtract this, so neither fetches a box the other
  // already has in hand. A box being carried back to the racks is not on its way to the bench.
  function pickInFlight() {
    var n = {}, add = function (sku) { n[sku] = (n[sku] || 0) + 1; };
    ['pickBelt', 'pickBelt2', 'pickMerge', 'upperPick', 'upperChute'].forEach(function (bid) { if (BELTS[bid]) beltItems(bid).forEach(function (it) { if (it.kind === 'box') add(it.sku); }); });
    if (S.up.gantry) gantryRows().forEach(function (r) { var G = gantryState(r); if (G.sku && G.state !== 'idle') add(G.sku); });
    S.staff.forEach(function (st) { if (st.carry && st.carry.kind === 'box') { if (!st.carry.back && !st.carry.bin) add(st.carry.sku); } else if (st.task && st.task.kind === 'pick') add(st.task.sku); });
    return n;
  }
  function skuDemand(sku) {
    var need = 0; S.orders.forEach(function (o) { if (o.state === 'open') o.lines.forEach(function (l) { if (l.sku === sku) need += l.qty; }); });
    need -= (S.bench.boxes[sku] || 0);
    need -= pickInFlight()[sku] || 0;
    return need;
  }
  function tickStaff(dt) {
    S.staff.forEach(function (st) {
      var m = staffMeshes[st.id]; if (!m) { buildStaffMesh(st); m = staffMeshes[st.id]; }
      if (st.punct === undefined) { st.punct = randf(0.2, 1); st.arriveOff = st.arriveOff || 0; }   // an old save: a value, not a new day (staffNewDay sent everyone home unpaid on the first tick)
      var brk = onBreak(st), off = isSunday() || st.sick || st.dayOff, end = shiftEnd(st);
      if (off && !st.clocked && st.state !== 'home' && st.state !== 'gone' && !(st.state === 'walk' && st.then === 'gone')) { staffDropAll(st); if (hasJack(st)) { st.jackParked = true; st.jackAt = jackHome(st); } st.state = 'walk'; st.then = 'gone'; st.path = route({ x: st.x, z: st.z }, RAMP_BOTTOM); return; }   // Tyson's save had two unclocked workers idling at their spots on a Sunday
      if (!off && !st.clocked && !st.clockedOutAt && st.state === 'idle' && S.time >= staffArrival(st) && S.time < end - 0.5) { st.state = 'walk'; st.then = 'clockin'; st.path = route({ x: st.x, z: st.z }, clockStand()); }
      // not here: at home until the arrival time, then the walk in from the yard to the clock
      if (st.state === 'home') {
        m.visible = false; jackFollow(st, m, false, dt, false); st.x = RAMP_BOTTOM.x; st.z = RAMP_BOTTOM.z;   // the jack stays parked in the hall overnight
        if (!off && !st.clockedOutAt && S.time >= staffArrival(st) && S.time < end - 0.5) { st.state = 'walk'; st.then = 'clockin'; st.path = route({ x: st.x, z: st.z }, clockStand()); }
        return;
      }
      if (st.state === 'gone') { st.state = 'home'; m.visible = false; return; }
      m.visible = true;
      var onJack = S.pallets.some(function (p) { return p.place === 'staff' && p.staff === st.id; }), carrying = !!st.carry || onJack;
      // the clock at both ends of the shift
      if (st.state === 'clockin') { staffWait(st, 1.4, function () { staffClockIn(st); st.state = 'idle'; }, true); st.state = 'wait'; st.yaw = clockFaceYaw(); }
      // a pallet being set into a rack finishes first, or it is dropped half through the rack face
      // planned once: a walker already on the way, at the clock, or in the clock-out wait is left alone (re-planning every tick from a clipped door jamb bounced them in the doorway for hours)
      if (st.clocked && S.time >= end && st.state !== 'clockout' && st.state !== 'parkJack' && st.state !== 'drive' && !(st.state === 'walk' && (st.then === 'clockout' || st.then === 'parkJack')) && !(st.state === 'wait' && st.leavingWait) && !(st.state === 'wait' && st.task && st.task.kind === 'store')) {
        staffDropAll(st); var jm0 = staffMeshes[st.id];
        if (jm0 && jm0.userData.jack && !st.jackParked) { st.state = 'walk'; st.then = 'parkJack'; st.path = route({ x: st.x, z: st.z }, jackHome(st)); }   // the jack goes to its slot by the wall first
        else { st.jackParked = true; st.state = 'walk'; st.then = 'clockout'; st.path = route({ x: st.x, z: st.z }, clockStand()); }
        st.leaving = true;
      }
      if (st.state === 'parkJack') { st.jackAt = jackHome(st); st.jackParked = true; st.state = 'walk'; st.then = 'clockout'; st.path = route({ x: st.x, z: st.z }, clockStand()); st.leaving = true; }
      if (st.state === 'clockout') { st.leavingWait = true; staffWait(st, 1.2, function () { staffClockOut(st); st.leavingWait = false; st.state = 'walk'; st.then = 'gone'; st.path = route({ x: st.x, z: st.z }, RAMP_BOTTOM); st.leaving = true; }, true); st.state = 'wait'; st.yaw = clockFaceYaw(); }
      if (st.clocked) st.hoursToday = (st.hoursToday || 0) + dt / HOUR_SEC;
      var working = st.clocked && S.time < end;   // on the clock and inside the shift. Not the old st.leaving flag: set at every shift end since 1.4.0 and never cleared, it kept a worker idle at the clock from their second morning on
      if (working && brk && !carrying && st.state !== 'break' && st.state !== 'walk' && st.state !== 'wait' && st.state !== 'drive') { st.task = null; st.jackParked = true; staffSay(st, voice(st).brk, '#a0acb8'); staffGo(st, breakSpot(), 'break'); }
      if (!brk && st.state === 'break') st.state = 'idle';
      // the driver: at the forklift, climbs on; on it, the forklift does the walking and the figure sits on the seat
      if (st.state === 'mountFork') { if (!S.up.fork || driving || (staffDriving() && staffDriving() !== st) || dist2(player.x, player.z, S.fork.x, S.fork.z) < 6.5) { st.state = 'idle'; st.task = null; } else { if (S.fork.plugged) cableUnplugFork(st.name + ' drove off with the charger plugged in. The plug came out.'); st.jackParked = true; st.state = 'drive'; st.drive = { phase: st.task && st.task.park ? 'park' : st.task && st.task.held ? 'toSlot' : 'toPallet', path: null }; sfx('forklift'); } }   // a pallet already on the forks is the job
      if (st.state === 'drive') { driveTick(st, dt); var fy = floorY(S.fork.x, S.fork.z); m.position.set(S.fork.x - Math.sin(S.fork.yaw) * 0.42, fy + 0.56, S.fork.z - Math.cos(S.fork.yaw) * 0.42); m.userData.baseY = fy + 0.56; m.rotation.y = S.fork.yaw; st.x = S.fork.x - Math.sin(S.fork.yaw) * 1.7; st.z = S.fork.z - Math.cos(S.fork.yaw) * 1.7; st.yaw = S.fork.yaw; animateHuman(m, dt, 'sit', 0, null, false); jackFollow(st, m, false, dt, false); return; }
      var mode = st.state === 'walk' ? 'walk' : st.state === 'wait' ? (st.working ? 'work' : 'wait') : 'idle';
      if (st.state === 'walk') staffWalk(st, dt);
      else if (st.state === 'wait') { st.timer -= dt * (st.trained ? 1.5 : 1); if (st.timer <= 0) { st.state = 'idle'; st.working = false; if (st.after) { var f = st.after; st.after = null; f(); } } }
      else if (st.state === 'break') { /* standing in the break room */ }
      else if (st.state === 'idle' && working) roleThink(st);
      if ((st.state === 'idle' || st.state === 'break') && Math.random() < dt / 22 && S.time - (st.said || 0) > 0.4) { st.said = S.time; staffSay(st, pick(voice(st).idle), '#a0acb8'); }
      m.position.set(st.x, floorY(st.x, st.z), st.z); m.userData.baseY = m.position.y; m.rotation.y = st.yaw;
      var near = dist2(st.x, st.z, player.x, player.z) < 36;
      animateHuman(m, dt, mode, 1.9, near && st.state !== 'walk' ? { x: player.x, y: player.y + 1.6, z: player.z } : null, onJack ? 'jack' : carrying ? true : (m.userData.jack && mode === 'walk' ? 'tow' : false));
      jackFollow(st, m, onJack, dt, mode === 'walk');
    });
  }
  // which role's work a worker does now: their own, or their second role when their own queue is empty and the other has work
  var THINK = { receiver: receiverThink, picker: pickerThink, driver: driverThink, packer: packerThink };
  function roleHasWork(role) {
    if (role === 'receiver') return S.trucks.some(function (t) { return t.dir === 'in' && t.state === 'docked' && t.signed && S.doors[doorIndex('in', t.dock)] && S.pallets.some(function (p) { return p.place === 'truck' && p.truck === t.id && p.n > 0; }); });
    if (role === 'picker') { var need = benchNeed(); for (var k in need) if (need[k] > 0 && slotsWith(k).some(function (q) { var sp = slotParse(q); return sp.l < RACK.top && sp.r !== UPPER.row; })) return true; return false; }   // stock a walker can reach, not the top level or the upper row
    if (role === 'packer') { if (openOrders().some(canPack)) return true; var dk = S.trucks.filter(function (x) { return x.dir === 'out' && x.state === 'docked' && S.doors[doorIndex('out', x.dock)]; }); if (dk.length && S.bench.parcels.some(function (oid) { var oo = orderById(oid); return oo && dk.some(function (x) { return !lanesOn() || modeDoor(orderMode(oo)) === doorIndex('out', x.dock); }); })) return true; return !!returnsJob(null); }   // a parcel counts only with the truck of its lane in
    if (role === 'driver') return !!S.up.fork && !!driverJob();
    return false;
  }
  function roleThink(st) {
    // whatever is in hand finishes first, whichever role picked it up: a pallet on the jack is racked, a box or parcel goes where it was going
    if (S.pallets.some(function (p) { return p.place === 'staff' && p.staff === st.id; })) { receiverThink(st); return; }
    if (st.carry) { (st.carry.kind === 'parcel' || st.carry.kind === 'return' || st.carry.bin ? packerThink : pickerThink)(st); return; }
    var r = st.role; if (st.cross && THINK[st.cross] && !roleHasWork(r) && roleHasWork(st.cross)) r = st.cross;
    if (r !== 'receiver') { var jm = staffMeshes[st.id]; if (jm && jm.userData.jack && !st.jackParked && st.jackAt) st.jackParked = true; }   // the jack stays where it is while they do other work; receiverThink walks them back to it
    THINK[r](st);
  }
  // ── The forklift driver ───────────────────────────────────────────
  // Takes the pallets left on the hall floor (receiving, the palletiser drop, wherever you set one down) to a rack slot on any
  // level, the top shelf included, which nobody on foot can reach. Keeps clear of the AGV's square and of you: a pallet you are
  // standing by is yours, and the forklift is never taken while you are next to it or on it.
  function driverSpot() { return { x: SPOT.fork.x + 2.2, z: SPOT.fork.z + 1.2 }; }
  function driverJob() {
    var A = S.agv, pu = propInst.agvDock ? propWorld('agvDock', 0, 2.6) : null, wr = propInst.wrapper ? propWorld('wrapper', 0, 0) : null, best = null, bd = 1e9;
    S.pallets.forEach(function (p) {
      if (p.place !== 'floor' || p.n <= 0 || !insideHall(p.x, p.z) || (SKU[p.sku] && SKU[p.sku].raw)) return;
      if (A && A.target === p.id && A.state !== 'idle') return; if (pu && dist2(p.x, p.z, pu.x, pu.z) < 2.6) return; if (wr && dist2(p.x, p.z, wr.x, wr.z) < 2.6) return; if (dist2(p.x, p.z, player.x, player.z) < 9) return;
      if (S.staff.some(function (o) { return o.task && o.task.pallet === p.id; })) return;
      var key = findSlotFor(p.sku, p.n, 2); if (!key) return;
      var d = dist2(p.x, p.z, S.fork.x, S.fork.z); if (d < bd) { bd = d; best = { pallet: p, key: key }; }
    });
    return best;
  }
  function driverThink(st) {
    if (!S.up.fork) { if (Math.random() < 0.004) staffSay(st, 'Nothing to drive yet.', '#a0acb8'); idleAt(st, driverSpot()); return; }
    if (driving || staffDriving() || dist2(player.x, player.z, S.fork.x, S.fork.z) < 6.5) { idleAt(st, driverSpot()); return; }
    // a pallet you left on the forks is the first job: it goes to a rack, not under the next one
    var held = S.fork.pallet ? palletById(S.fork.pallet) : null;
    if (held) { var hk = held.n > 0 ? findSlotFor(held.sku, held.n, 2) : null; if (!hk) { st.task = { kind: 'drive', pallet: held.id, held: true, park: true }; staffGo(st, { x: S.fork.x - Math.sin(S.fork.yaw) * 1.6, z: S.fork.z - Math.cos(S.fork.yaw) * 1.6 }, 'mountFork'); return; } st.task = { kind: 'drive', pallet: held.id, key: hk, held: true }; staffGo(st, { x: S.fork.x - Math.sin(S.fork.yaw) * 1.6, z: S.fork.z - Math.cos(S.fork.yaw) * 1.6 }, 'mountFork'); return; }
    var job = driverJob(); if (!job) { idleAt(st, driverSpot()); return; }
    st.task = { kind: 'drive', pallet: job.pallet.id, key: job.key }; if (Math.random() < 0.5) staffSay(st, voice(st).onit, '#5fd38d');
    staffGo(st, { x: S.fork.x - Math.sin(S.fork.yaw) * 1.6, z: S.fork.z - Math.cos(S.fork.yaw) * 1.6 }, 'mountFork');
  }
  function forkFollow(D, dt) {
    if (!D.path || !D.path.length) return true;
    var t = D.path[0], dx = t.x - S.fork.x, dz = t.z - S.fork.z, d = Math.hypot(dx, dz), want = Math.atan2(dx, dz), diff = Math.atan2(Math.sin(want - S.fork.yaw), Math.cos(want - S.fork.yaw));
    S.fork.yaw = Math.atan2(Math.sin(S.fork.yaw + clamp(diff, -2.2 * dt, 2.2 * dt)), Math.cos(S.fork.yaw + clamp(diff, -2.2 * dt, 2.2 * dt))); if (Math.abs(diff) > 0.5) return false;   // turns on the spot before it moves off, the way a counterbalance truck is driven; the heading is kept wrapped
    var sp = 2.4 * dt; S.fork.batt = clamp((S.fork.batt === undefined ? 1 : S.fork.batt) - dt / 1500, 0, 1);   // the crew's driving drinks the battery like yours
    if (d <= sp) { S.fork.x = t.x; S.fork.z = t.z; D.path.shift(); return !D.path.length; }
    S.fork.x += dx / d * sp; S.fork.z += dz / d * sp; return false;
  }
  function forkTurnTo(want, dt) { var diff = Math.atan2(Math.sin(want - S.fork.yaw), Math.cos(want - S.fork.yaw)); if (Math.abs(diff) < 0.04) { S.fork.yaw = want; return true; } S.fork.yaw += clamp(diff, -2.2 * dt, 2.2 * dt); return false; }
  function driveTick(st, dt) {
    var D = st.drive, p = st.task ? palletById(st.task.pallet) : null;
    if (!D) { driverDismount(st); return; }
    if (D.phase === 'toPallet') {
      if (!p || p.place !== 'floor') { D.phase = 'park'; D.path = null; return; }
      if (!D.path) { var dx = p.x - S.fork.x, dz = p.z - S.fork.z, dl = Math.hypot(dx, dz) || 1; D.path = route({ x: S.fork.x, z: S.fork.z }, { x: p.x - dx / dl * 1.7, z: p.z - dz / dl * 1.7 }); }
      if (forkFollow(D, dt) && forkTurnTo(Math.atan2(p.x - S.fork.x, p.z - S.fork.z), dt)) { p.place = 'fork'; S.fork.pallet = p.id; S.fork.lift = 0.3; sfx('jack'); D.phase = 'toSlot'; D.path = null; }
    } else if (D.phase === 'toSlot') {
      if (!p || p.place !== 'fork') { D.phase = 'park'; D.path = null; return; }
      if (!D.path) D.path = route({ x: S.fork.x, z: S.fork.z }, slotStand(st.task.key));
      if (forkFollow(D, dt)) { var sp = slotParse(st.task.key), spos = rackSlotPos(sp.r, sp.b, sp.l); if (forkTurnTo(Math.atan2(spos.x - S.fork.x, spos.z - S.fork.z), dt)) { D.phase = 'lift'; D.liftTo = RACK.levels[sp.l] + 0.15; } }
    } else if (D.phase === 'lift') {
      S.fork.lift = Math.min(D.liftTo, S.fork.lift + 0.9 * dt);
      if (S.fork.lift >= D.liftTo - 0.001) {
        var ok = p && storePallet(p, st.task.key); if (!ok && p) { var k2 = findSlotFor(p.sku, p.n, 2); ok = k2 && storePallet(p, k2); }
        if (ok) { S.stats.putaway++; sfx('crate'); addXp(XP.pallet); } else if (p) { staffSay(st, voice(st).nospace, '#ff6b5e'); S.fork.lift = 0.3; D.phase = 'park'; D.path = null; return; }   // no room anywhere: the pallet rides back to the bay and is set down there, not inside the rack
        if (ok || p) S.fork.pallet = null; D.phase = 'lower';
      }
    } else if (D.phase === 'lower') {
      S.fork.lift = Math.max(0.1, S.fork.lift - 0.9 * dt);
      if (S.fork.lift <= 0.1001) { st.task = null; var job = !driving && dist2(player.x, player.z, S.fork.x, S.fork.z) > 6.5 ? driverJob() : null; if (job) { st.task = { kind: 'drive', pallet: job.pallet.id, key: job.key }; D.phase = 'toPallet'; D.path = null; } else { D.phase = 'park'; D.path = null; } }
    } else if (D.phase === 'park') {
      if (!D.path) D.path = route({ x: S.fork.x, z: S.fork.z }, { x: SPOT.fork.x, z: SPOT.fork.z });
      if (forkFollow(D, dt) && forkTurnTo(Math.PI, dt)) driverDismount(st);
    } else driverDismount(st);
  }
  function driverDismount(st) {
    var p = S.fork.pallet ? palletById(S.fork.pallet) : null;
    if (p && st.task && st.task.pallet === p.id) { var ft = forkTip(); p.place = 'floor'; p.x = ft.x; p.z = ft.z; p.y = 0; p.rot = S.fork.yaw; S.fork.pallet = null; }
    if (!S.fork.pallet) S.fork.lift = Math.min(S.fork.lift, 0.3);
    st.drive = null; st.task = null; st.state = 'idle'; st.x = S.fork.x - Math.sin(S.fork.yaw) * 1.7; st.z = S.fork.z - Math.cos(S.fork.yaw) * 1.7; st.yaw = S.fork.yaw;
  }
  function benchSide(lz) { var P = PROPS.bench ? propPlacement('bench') : { x: SPOT.bench.x, z: SPOT.bench.z, rot: 0 }, a = P.rot * Math.PI / 2, lx = -1.0; return { x: P.x + lx * Math.cos(a) + lz * Math.sin(a), z: P.z - lx * Math.sin(a) + lz * Math.cos(a) }; }
  function clockStand() { var P = propPlacement('timeclock'), a = P.rot * Math.PI / 2; return { x: P.x + Math.sin(a) * 1.0, z: P.z + Math.cos(a) * 1.0 }; }
  function clockFaceYaw() { var P = propPlacement('timeclock'); return P.rot * Math.PI / 2 + Math.PI; }
  // a worker's place in their role's line-up, and an idle spot of their own from it: three receivers idling on the same point looked
  // like one figure with three jacks fanned out behind it (the jack parks behind its owner along their own heading)
  // the crew's jacks park in a row along the west wall north of the cart bay, one slot a jack by the owner's place in the line-up.
  // Until 1.18.0 a jack was left wherever its owner stood at clock-out, and three receivers' jacks ended up piled on one idle spot.
  var JACK_HOME = BOOT_STAGE === 0 ? { x: -3.9, z0: 4.1, step: 0 } : { x: -HALL.x + 1.3, z0: BOOT_STAGE >= 2 ? 11.4 : -2.0, step: 1.5 };   // the shed: one spot by the player's own jack; the small hall: along the west wall north of IN 1
  function breakSpot() { return stageHas('rooms') ? { x: -HALL.x + 3.7 + randf(-1, 1), z: 2.8 - HALL.z + randf(-0.4, 0.4) } : { x: 2.6 + randf(-0.6, 0.6), z: 1.2 + randf(-0.3, 0.3) }; }   // the break room (z -21.2 in the big hall is 2.8 m in from the north wall), or by the shed table
  function hasJack(st) { return st.role === 'receiver' || st.cross === 'receiver'; }
  function jackRank(st, list) { var n = 0; list = list || S.staff; for (var i = 0; i < list.length; i++) { var o = list[i]; if (o === st) return n; if (hasJack(o)) n++; } return n; }
  function jackHome(st, list) { var k = jackRank(st, list); return { x: JACK_HOME.x, z: JACK_HOME.z0 + k * JACK_HOME.step, ry: -Math.PI / 2 }; }   // pointing west: the owner's stand is east of it, on open floor
  // a worker can be looked at: who they are, what they are doing, how they keep time; E has a word with one who came in late
  function punctWord(st) { var p = st.punct === undefined ? 0.6 : st.punct; return p >= 0.75 ? 'reliable' : p >= 0.4 ? 'fair timekeeper' : 'poor timekeeper'; }
  function staffPrompt(st) { return st.name + ' · ' + STAFF_ROLES[st.role].name.toLowerCase() + (st.cross && STAFF_ROLES[st.cross] ? ' (and ' + STAFF_ROLES[st.cross].name.toLowerCase() + ')' : '') + ' · ' + staffStatus(st) + ' · ' + punctWord(st) + (st.lateToday && !st.wordToday ? ' · E: have a word about the time' : ''); }
  function staffUse(st) { if (st.lateToday && !st.wordToday) { staffWord(st); staffSay(st, pick(['Sorry, boss. Will not happen again.', 'Yes, I know. Sorry.', 'Alarm did not go off. Sorry.']), '#a0acb8'); return; } staffSay(st, pick(voice(st).idle), '#a0acb8'); sfx('click'); }
  function staffRank(st) { var n = 0; for (var i = 0; i < S.staff.length; i++) { var o = S.staff[i]; if (o === st) return n; if (o.role === st.role) n++; } return n; }
  function spreadSpot(st, base, step, row) { var k = staffRank(st), a = k % 3, b = Math.floor(k / 3); return { x: base.x + step.x * a + row.x * b, z: base.z + step.z * a + row.z * b }; }
  function staffWait(st, sec, after, working) { st.state = 'wait'; st.timer = sec; st.after = after; st.working = !!working; }
  function idleAt(st, spot) { if (dist2(st.x, st.z, spot.x, spot.z) > 1) { staffGo(st, spot, 'wait'); st.timer = 1.5; } else staffWait(st, 1.5 + Math.random()); }
  function receiverThink(st) {
    var carrying = S.pallets.filter(function (p) { return p.place === 'staff' && p.staff === st.id; })[0];
    // the jack was left somewhere (a break, the clock, overnight): walk back to where they stood with it before anything else
    if (st.jackParked && !carrying) { var ja = st.jackAt, stand = ja ? { x: ja.x - Math.sin(ja.ry || 0) * STAFF_JACK.park, z: ja.z - Math.cos(ja.ry || 0) * STAFF_JACK.park } : null; if (!stand || dist2(st.x, st.z, stand.x, stand.z) < 1.44) { st.jackParked = false; } else { st.task = { kind: 'jack' }; staffGo(st, stand, 'wait'); st.timer = 0.4; st.working = true; st.after = function () { st.jackParked = false; st.task = null; }; return; } }
    if (carrying) {
      var key = findSlotFor(carrying.sku, carrying.n, 1);
      if (!key) { carrying.place = 'floor'; carrying.x = SPOT.stageIn.x + randf(-1, 1); carrying.z = SPOT.stageIn.z + randf(-1, 1); carrying.y = 0; carrying.rot = 0; staffSay(st, voice(st).nospace, '#ff6b5e'); logEvent(st.name + ' found no rack space: pallet left in receiving', 'bad'); st.task = null; return; }
      st.task = { kind: 'store', pallet: carrying.id, key: key };
      staffGo(st, slotStand(key), 'wait'); st.timer = 1.4; st.working = true; st.after = function () { var p = palletById(carrying.id); if (!p) return; if (!storePallet(p, key)) { var k2 = findSlotFor(p.sku, p.n, 1); if (!k2 || !storePallet(p, k2)) { p.place = 'floor'; p.x = st.x; p.z = st.z; p.y = 0; } } else { sfx('crate'); addXp(XP.pallet); } st.task = null; };
      return;
    }
    var pickP = null;
    for (var i = 0; i < S.pallets.length; i++) { var p = S.pallets[i]; if (p.place !== 'truck' || p.n <= 0) continue; var t = truckById(p.truck); if (!t || t.state !== 'docked' || !S.doors[doorIndex('in', t.dock)] || !t.signed) continue; if (S.staff.some(function (o) { return o !== st && o.task && o.task.pallet === p.id; })) continue; pickP = p; break; }
    if (!pickP) { idleAt(st, spreadSpot(st, { x: SPOT.stageIn.x - 1.8, z: SPOT.stageIn.z + 2.6 }, { x: 1.8, z: 0 }, { x: 0, z: 1.6 })); return; }
    var w = truckPalletPos(truckById(pickP.truck), pickP.idx), tr = truckById(pickP.truck);
    st.task = { kind: 'fetch', pallet: pickP.id }; if (Math.random() < 0.5) staffSay(st, voice(st).onit, '#5fd38d');
    staffGo(st, { x: w.x, z: w.z + (w.z > tr.z ? -1.0 : 1.0) }, 'wait'); st.timer = 1.4; st.working = true;
    st.after = function () { var p = palletById(pickP.id); if (!p || p.place !== 'truck') { st.task = null; return; } onPalletLeftTruck(p); p.place = 'staff'; p.staff = st.id; sfx('jack'); st.task = null; };
  }
  // a box being taken back to the racks: to the slot chosen for it, and onto the rack (the picker's surplus, the packer's returns)
  function carryBack(st) {
    var bk = st.carry.back, bsku = st.carry.sku;
    staffGo(st, slotStand(bk), 'wait'); st.timer = 1.0; st.working = true;
    st.after = function () { if (!st.carry) return; var k = slotSpace(bk, bsku) > 0 ? bk : findSlotFor(bsku, 1, 1); if (k) { slotAdd(k, bsku, 1); st.carry = null; sfx('putdown'); S.stats.putaway++; } else { S.floor.push({ kind: 'box', sku: bsku, x: st.x, y: floorY(st.x, st.z), z: st.z, rot: st.yaw }); st.carry = null; staffSay(st, voice(st).nospace, '#ff6b5e'); } st.task = null; };
  }
  // a damaged box to the bin by the bench: no charge, the return was the customer's
  function carryToBin(st) { var w = binSpotFor(st); staffGo(st, { x: w.x, z: w.z }, 'wait'); st.timer = 0.6; st.working = true; st.after = function () { if (st.carry && st.carry.kind === 'box') { S.binned = (S.binned || 0) + 1; addWaste(2); st.carry = null; sfx('crate'); } st.task = null; }; }
  function pickerThink(st) {
    if (st.carry && st.carry.bin) { carryToBin(st); return; }
    if (st.carry && st.carry.back) { carryBack(st); return; }
    if (st.carry) {
      staffGo(st, benchSide(0), 'wait'); st.timer = 0.8; st.working = true;
      st.after = function () { if (!st.carry) return; if (benchCount() < benchCapNow()) { benchAdd(st.carry.sku, 1); st.carry = null; sfx('putdown'); addXp(XP.box); } else { staffSay(st, voice(st).full, '#ff6b5e'); staffWait(st, 3); } st.task = null; };
      return;
    }
    var want = null;
    var orders = openOrders().slice().sort(function (a, b) { return (b.rush ? 1 : 0) - (a.rush ? 1 : 0) || a.due - b.due; });
    for (var i = 0; i < orders.length && !want; i++) orders[i].lines.forEach(function (l) { if (want) return; if (skuDemand(l.sku) > 0) { var keys = slotsWith(l.sku).filter(function (k) { var sp = slotParse(k); return sp.l < RACK.top && sp.r !== UPPER.row; });   /* the upper row is the upper crane's; the annex rows are a walker's since 1.17.0 */ if (keys.length) { keys.sort(function (a, b) { var A = slotStand(a), B = slotStand(b); return dist2(A.x, A.z, st.x, st.z) - dist2(B.x, B.z, st.x, st.z); }); want = { sku: l.sku, key: keys[0] }; } } });   // the nearest slot that holds it, not the first in rack order
    if (!want) {
      // nothing to pick: a box on the bench that no open order wants goes back on the racks, one at a time
      var sur = benchSurplus(), rsku = null; for (var sk in sur) if (sur[sk] > 0) { rsku = sk; break; }
      var rkey = rsku ? findSlotFor(rsku, 1, 1) : null;
      if (rkey && !S.staff.some(function (o) { return o !== st && o.task && o.task.kind === 'return'; })) { st.task = { kind: 'return', sku: rsku, key: rkey }; staffGo(st, benchSide(0), 'wait'); st.timer = 0.8; st.working = true; st.after = function () { if (benchTake(rsku, 1)) { st.carry = { kind: 'box', sku: rsku, back: rkey }; sfx('pickup'); } else st.task = null; }; return; }
      idleAt(st, spreadSpot(st, { x: SPOT.bench.x - 2.0, z: SPOT.bench.z - 2.6 }, { x: 0, z: -1.2 }, { x: -1.4, z: 0 })); return;
    }
    st.task = { kind: 'pick', sku: want.sku, key: want.key };
    staffGo(st, slotStand(want.key), 'wait'); st.timer = 1.0; st.working = true;
    st.after = function () { var s = S.slots[want.key]; if (s && s.sku === want.sku && s.n > 0) { slotTake(want.key, 1); st.carry = { kind: 'box', sku: want.sku }; S.stats.picked++; sfx('pickup'); } st.task = null; };
  }
  function packerThink(st) {
    if (st.carry && st.carry.kind === 'return') { packerReturns(st, { kind: 'rdesk' }); return; }
    if (st.carry && st.carry.kind === 'box') { if (st.carry.bin) carryToBin(st); else if (st.carry.back) carryBack(st); else pickerThink(st); return; }
    if (st.carry && st.carry.kind === 'parcel') {
      var co = orderById(st.carry.order), t = S.trucks.filter(function (x) { return x.dir === 'out' && x.state === 'docked' && !x.van && S.doors[doorIndex('out', x.dock)] && (!co || !lanesOn() || modeDoor(orderMode(co)) === doorIndex('out', x.dock)); })[0];   // the truck of the parcel's lane, never the wrong door
      if (!t) { if (S.bench.parcels.length >= shelfCap()) { staffWait(st, 2); return; } staffGo(st, benchSide(2.3), 'wait'); st.timer = 0.7; st.working = true; st.after = function () { if (st.carry && st.carry.kind === 'parcel') { S.bench.parcels.push(st.carry.order); st.carry = null; sfx('putdown'); } }; return; }   // the truck has gone: back on the shelf, not held all shift
      staffGo(st, { x: t.x + t.side * 1.6, z: t.z }, 'wait'); st.timer = 0.9; st.working = true;
      st.after = function () { if (!st.carry) return; var tt = truckById(t.id); var o = orderById(st.carry.order); if (tt && tt.state === 'docked' && o) { tt.parcels.push(o.id); o.state = 'loaded'; sfx('crate'); addXp(XP.ship); rebuildBoardSoon(); st.carry = null; } else { staffWait(st, 2); } };
      return;
    }
    var packable = openOrders().filter(canPack).sort(function (a, b) { return a.due - b.due; })[0];
    if (packable) {
      staffGo(st, benchSide(0.8), 'wait'); st.timer = 2.8; st.working = true;
      st.after = function () { if (canPack(packable)) { packOrder(packable); } };
      return;
    }
    var docked = S.trucks.filter(function (x) { return x.dir === 'out' && x.state === 'docked' && !x.van && S.doors[doorIndex('out', x.dock)]; }), forLane = function (oid) { var oo = orderById(oid); return oo && docked.some(function (x) { return !lanesOn() || modeDoor(orderMode(oo)) === doorIndex('out', x.dock); }); };
    var truck = docked.length && S.bench.parcels.some(forLane) ? docked[0] : null;
    if (truck && S.bench.parcels.length) {
      staffGo(st, benchSide(2.3), 'wait'); st.timer = 0.7; st.working = true;
      st.after = function () { var oid = S.bench.parcels.filter(forLane)[0]; if (oid) { S.bench.parcels.splice(S.bench.parcels.indexOf(oid), 1); st.carry = { kind: 'parcel', order: oid }; sfx('pickup'); } };
      return;
    }
    var rj = returnsJob(st); if (rj) { packerReturns(st, rj); return; }
    idleAt(st, spreadSpot(st, { x: SPOT.bench.x - 1.8, z: SPOT.bench.z + 2.2 }, { x: 0, z: 1.2 }, { x: -1.4, z: 0 }));
  }
