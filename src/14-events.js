//@ the clock, the day roll, lighting by the hour, sleeping, coffee, power cuts, the inspector, the prowler, levels, the guided intro
  // ── Time ──────────────────────────────────────────────────────────
  function tickTime(dt) {
    var night = S.time >= DAY_END || S.time < DAY_START;
    var before = S.time;
    S.time += dt / HOUR_SEC * (night ? NIGHT_SPEED : 1);
    if (S.time >= 24) { S.time -= 24; newDay(); }
    if (Math.floor(before) !== Math.floor(S.time)) hudDirty = true;
    if (before < 23 && S.time >= 23) prowlerCheck();
  }
  function newDay() {
    S.day++; S.stats.days++;
    pay(-ECON.rent, 'Rent, day ' + S.day);
    payStaffWages(); staffNewDay(); if (S.clockedIn) { myClock(false); logEvent('The clock ran past midnight: you were clocked out automatically'); }
    if (S.loan > 0) { var interest = Math.round(S.loan * 0.015); pay(-interest, 'Loan interest (1.5%)'); }
    if (S.insured) pay(-40, 'Insurance premium');
    if (isSunday()) { toast('Sunday. The depot is closed: no trucks, no orders.', ''); logEvent('Sunday. Nothing moves today. A good day to sleep through.'); }
    for (var f in S.flags) if (/^(in|out)\d+-/.test(f) && +f.replace(/^(in|out)/, '').split('-')[0] < S.day - 1) delete S.flags[f];
    S.events.inspected = false; S.events.prowled = false;
    logEvent('Day ' + S.day + '. Rent and wages paid.', 'rare'); toast('Day ' + S.day, 'rare'); rebuildBoardSoon(); hudDirty = true; save();
    if (S.bank < -600) { toast('The bank is getting nervous: ' + money(S.bank), 'bad'); }
  }
  function cotPrompt() { return S.time >= 17 || S.time < DAY_START ? 'Sleep until morning (rent and wages are due)' : 'Too early to sleep: the cot is for after 17:00'; }
  function sleepNow() {
    if (!(S.time >= 17 || S.time < DAY_START)) { toast('Too early. Come back after 17:00.', 'bad'); return; }
    sfx('sleep'); logEvent('Slept in the break room');
    S.trucks.slice().forEach(function (t) { if (t.state === 'docked') truckLeave(t, 'night'); });
    S.trucks.slice().forEach(function (t) { removeTruckMesh(t.id); }); S.trucks = [];
    if (S.time >= 17) { S.time = DAY_START; newDay(); } else S.time = DAY_START;
    S.events.power = false; buff.coffeeUntil = 0;
    var fade = $('dc-start'); fade.classList.add('show'); fade.hidden = false; fade.style.opacity = '1'; fade.style.transition = 'none';
    setTimeout(function () { fade.style.transition = 'opacity .9s'; fade.style.opacity = '0'; setTimeout(function () { fade.hidden = true; fade.style.opacity = ''; fade.style.transition = ''; }, 900); }, 400);
  }
  function drinkCoffee() {
    if (S.events.power) { toast('No power.', 'bad'); return; }
    if (buff.coffeeDay === S.day && buff.coffeeUntil > S.time) { toast('You are already wired.', ''); return; }
    buff.coffeeDay = S.day; buff.coffeeUntil = S.time + 1; sfx('coffee'); toast('Coffee. Faster for an hour.', 'good');
  }

  // ── Lighting by the hour ──────────────────────────────────────────
  var skyNight = new THREE.Color(0x0b1020), skyDawn = new THREE.Color(0xd9916b), skyDay = new THREE.Color(0x8fb0d4), skyTmp = new THREE.Color();
  var lightT = 0;
  function lighting(dt) {
    lightT += dt; if (lightT < 0.1) return; lightT = 0;
    var t = S.time, day = clamp((t - 5.5) / 1.5, 0, 1) * clamp((21.5 - t) / 1.5, 0, 1), dawn = Math.max(0, 1 - Math.abs(t - 6.5) / 1.5) + Math.max(0, 1 - Math.abs(t - 20.5) / 1.5);
    var az = Math.PI * (t - 6) / 16, elev = Math.sin(Math.PI * clamp((t - 6) / 16, 0, 1));
    var W = S.weather || { kind: 'clear' }, overcast = W.kind === 'overcast' ? 0.45 : W.kind === 'rain' ? 0.65 : W.kind === 'storm' ? 0.85 : W.kind === 'snow' ? 0.55 : 0;
    sun.position.set(Math.cos(az) * 60, 8 + elev * 80, 30 + Math.sin(az) * 20); sun.intensity = Math.max(0, elev) * 1.15 * (0.6 + 0.4 * day) * (1 - overcast * 0.8) + weatherFlash * 2.5;
    sun.color.setHSL(0.09, dawn * 0.6 * (1 - overcast), 0.95 - dawn * 0.15);
    skyTmp.copy(skyNight).lerp(skyDay, day); if (dawn > 0) skyTmp.lerp(skyDawn, dawn * 0.5 * (1 - day * 0.3));
    if (overcast) skyTmp.lerp(new THREE.Color(0x6b7482), overcast * day * 0.8); if (weatherFlash > 0.05) skyTmp.lerp(new THREE.Color(0xffffff), weatherFlash * 0.7);
    scene.background.copy(skyTmp); scene.fog.color.copy(skyTmp); if (yard.sky) { yard.sky.uniforms.top.value.copy(skyTmp).multiplyScalar(0.62 + overcast * 0.25); yard.sky.uniforms.mid.value.copy(skyTmp); yard.sky.uniforms.bot.value.copy(skyTmp).lerp(new THREE.Color(0xffffff), 0.4 * (1 - overcast * 0.5)); } scene.fog.near = 70 - overcast * 30; scene.fog.far = 190 - overcast * 90;
    hemi.intensity = 0.12 + day * 0.35 * (1 - overcast * 0.5) + weatherFlash;
    if (dress.shaftMat) { dress.shaftMat.opacity = 0.16 * day * (1 - overcast * 0.9); if (dress.dust) dress.dust.material.opacity = 0.15 + 0.4 * day * (1 - overcast * 0.6); }
    yard.lampLenses.forEach(function (l) { l.material.emissiveIntensity = day < 0.5 && !S.events.power && !S.flags.yardOff ? 1.6 : 0.15; });
    var power = !S.events.power, lamps = power && !S.flags.lightsOff ? (S.up.lights ? 0.8 : 0.55) : 0;
    hallLights.forEach(function (l) { l.intensity = lamps; });
    officeLight.intensity = power ? 0.5 : 0;
    MAT.lamp.color.setHex(power ? 0xfff6e4 : 0x3a3a3a); MAT.skylight.color.setHex(0xffffff); MAT.skylight.color.multiplyScalar(0.25 + day * 0.75);
    yardLights.forEach(function (l) { l.intensity = day < 0.5 && power && !S.flags.yardOff ? 0.6 : 0; });
    if (world.pcScreen) world.pcScreen.visible = power;
    shadowT += 0.1; if (shadowDirty || shadowT > 4) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowT = 0; }
  }

  // ── Events ────────────────────────────────────────────────────────
  var evT = 0;
  function tickEvents(dt) {
    evT += dt; if (evT < 1) return; var step = evT; evT = 0;
    if (S.events.power) { if (S.time >= S.events.powerUntil) { S.events.power = false; toast('The power is back.', 'good'); logEvent('Power restored by the grid'); sfx('breaker'); } }
    else if (S.level >= 2 && S.time >= 9 && S.time < 16 && Math.random() < step / HOUR_SEC * 0.05) { S.events.power = true; S.events.powerUntil = S.time + 1.5; toast('Power cut! The breaker is in the office.', 'bad'); logEvent('Power cut. Doors, PC and the coffee machine are dead until the breaker is reset.', 'bad'); sfx('power'); }
    if (!S.events.inspected && S.day >= S.events.nextInspect && S.time >= 10 && S.time < 10.5) inspection();
    if (boardT > 0) { boardT -= step; if (boardT <= 0) { boardT = 0; drawBoard(); } }
    if (S.time >= 8 && S.time < 18 && Math.floor(S.time * 4) !== S.flags.boardQ) { S.flags.boardQ = Math.floor(S.time * 4); drawBoard(); }
  }
  function flipBreaker() {
    if (S.events.power) { S.events.power = false; sfx('breaker'); toast('Power restored.', 'good'); logEvent('Breaker reset', 'good'); addXp(4); }
    else { sfx('click'); toast('The power is on. Leave it be.', ''); }
  }
  function inspection() {
    S.events.inspected = true; S.events.nextInspect = S.day + randi(4, 6);
    var loose = S.floor.length, openDoors = doors.filter(function (d) { return S.doors[d.i] && !truckAtDoor(d.i); }).length;
    var fine = (loose > 4 ? 150 + (loose - 4) * 20 : 0) + openDoors * 40;
    if (S.up.lights) fine = Math.round(fine / 2);
    if (fine) { pay(-fine, 'Safety inspection fine'); S.stats.fines += fine; addRep(-2); toast('Inspector: ' + (loose > 4 ? loose + ' things on the floor. ' : '') + (openDoors ? openDoors + ' door' + (openDoors > 1 ? 's' : '') + ' open with no truck. ' : '') + 'Fine ' + money(fine), 'bad'); logEvent('Safety inspection: fined ' + money(fine), 'bad'); sfx('siren'); }
    else { addRep(3); toast('Inspector: clean floor, tidy docks. Well done.', 'good'); logEvent('Safety inspection passed', 'good'); addXp(10); }
  }
  function prowlerCheck() {
    if (S.events.prowled) return; S.events.prowled = true;
    var open = doors.filter(function (d) { return S.doors[d.i] && !truckAtDoor(d.i); });
    if (!open.length) { var unl = hdoors.filter(function (d) { return (d.id === 'staff' || d.id === 'exit') && !hd(d.id).locked; }); if (unl.length && Math.random() < 0.5) { var keys2 = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }); if (!keys2.length) return; var key2 = pick(keys2), sku2 = S.slots[key2].sku, n2 = slotTake(key2, randi(1, 3)); S.stats.lost += n2; addRep(-2); sfx('glass'); toast('Someone slipped in through ' + unl[0].label + ' and took ' + n2 + ' boxes. Lock up at night.', 'bad'); logEvent(n2 + ' boxes of ' + skuName(sku2) + ' taken through the unlocked ' + unl[0].label + '. Shift+E locks a door; the control cabinet locks them all.', 'bad'); } return; }
    var keys = Object.keys(S.slots).filter(function (k) { return S.slots[k].n > 0; }); if (!keys.length) return;
    var key = pick(keys), sku = S.slots[key].sku, n = slotTake(key, randi(2, 6));
    S.stats.lost += n; addRep(-3); sfx('glass');
    if (S.insured) { var refund = Math.round(n * SKU[sku].val * 0.8); pay(refund, 'Insurance payout, ' + n + ' boxes'); toast('Insurance paid ' + money(refund) + ' for the loss', 'good'); }
    toast('Someone walked off with ' + n + ' boxes through the open door at ' + dockLabel(open[0].i), 'bad'); logEvent(n + ' boxes of ' + skuName(sku) + ' stolen through the open door at ' + dockLabel(open[0].i) + '. Close the doors at night.', 'bad');
  }
  function onLevelUp() {
    sfx('levelup'); toast('Level ' + S.level + '!', 'rare');
    var what = S.level === 2 ? 'New lines from the clients; the forklift, a third rack row, the LED high bays and the roadside sign are in the shop.' : S.level === 3 ? 'You can hire a receiver and a picker on the office PC. Second inbound bay and fourth row in the shop. Rush orders start.' : S.level === 4 ? 'Packers for hire, and the clients send trainers and drills.' : S.level === 7 ? 'Televisions and tyre sets: the big-ticket lines.' : 'Bigger orders and bigger loads.';
    logEvent('Level ' + S.level + '. ' + what, 'rare');
  }

  // ── The guided intro ──────────────────────────────────────────────
  var INTRO = [
    ['clockin', 'You start in the entrance lobby. Press <b>E</b> on the <b>time clock</b> on the wall beside the staff door and clock in: it keeps your hours.'],
    ['door', 'Go through the lobby door into the hall and walk to dock <b>IN 1</b> on the west wall. Press E on the roll door, or use the console beside it. The first truck docks at 07:30.'],
    ['sign', 'When the truck is in and the dock door is up, the driver walks in and waits beside the door. Press <b>E</b> on him to sign the delivery note. Nothing comes off until you do.'],
    ['unload', 'Walk into the trailer. Take a box off a pallet with <b>E</b>, or grab the pallet jack from its bay by the receiving square and lift a whole pallet.'],
    ['putaway', 'Put it on a rack: look at a slot and press <b>E</b>. Row A, floor level, is nearest. A slot holds 12 boxes of one line.'],
    ['scanner', 'Press <b>Tab</b>. The scanner in your hand lists the orders, what is still on the truck, and where every line is stored.'],
    ['order', 'Orders arrive from 08:30 on the office PC (sit down at the desk), the wall board and the scanner. Wait for the first one.'],
    ['pick', 'Take the boxes the order needs off the rack (<b>E</b> on the slot). One box per trip until you buy the cart.'],
    ['bench', 'Carry them to the <b>packing bench</b> on the east side and press E to put them down.'],
    ['pack', 'With empty hands press <b>E</b> on the bench, or use the terminal on it, and pack the order. The parcel appears on the shelf beside it.'],
    ['load', 'Pick the parcel up, open dock <b>OUT 1</b> from its console, walk into the outbound trailer and press E. The truck waits there from 10:30 to 12:00.'],
    ['dispatch', 'Press E on the <b>DISPATCH</b> button of the OUT 1 console to send the truck now, or let it leave on schedule. You are paid when it goes.']
  ];
  function introStep(key) {
    if (!S.intro || S.intro.done) return;
    S.intro.did = S.intro.did || {};
    if (S.intro.did[key]) return;
    S.intro.did[key] = 1;
    var i = introIndex();
    if (i >= INTRO.length) { S.intro.done = true; pay(400, 'Intro bonus'); toast('Intro done: $400 bonus. The depot is yours.', 'rare'); logEvent('Guided intro finished. $400 bonus.', 'rare'); sfx('chime'); }
    else if (INTRO[i][0] !== key) { /* a step done out of order still counts */ }
    hudDirty = true;
  }
  function introIndex() { var d = S.intro.did || {}; for (var i = 0; i < INTRO.length; i++) if (!d[INTRO[i][0]]) return i; return INTRO.length; }
  function introText() {
    if (!S.intro || S.intro.done || S.intro.off) return '';
    var i = introIndex(); if (i >= INTRO.length) return '';
    return '<b>Step ' + (i + 1) + ' of ' + INTRO.length + '</b> · ' + INTRO[i][1];
  }
