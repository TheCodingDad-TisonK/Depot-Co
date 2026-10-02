//@ the living world: seasons and weather, rain ambience and thunder, the break-room radio, the forklift battery, the stretch wrapper
  // ── Seasons and weather ───────────────────────────────────────────
  var SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  function season() { return Math.floor(((S.day - 1) % 28) / 7); }
  function isSunday() { return S.day % 7 === 0; }
  var weatherFlash = 0;
  function pickWeather(first) {
    var s = season(), r = Math.random(), kind;
    if (s === 3) kind = r < 0.32 ? 'snow' : r < 0.62 ? 'overcast' : r < 0.9 ? 'clear' : 'rain';
    else if (s === 1) kind = r < 0.6 ? 'clear' : r < 0.78 ? 'overcast' : r < 0.9 ? 'rain' : 'storm';
    else kind = r < 0.42 ? 'clear' : r < 0.68 ? 'overcast' : r < 0.9 ? 'rain' : 'storm';
    var prev = S.weather ? S.weather.kind : null;
    S.weather = { kind: kind, wet: S.weather ? S.weather.wet : 0, snow: S.weather ? S.weather.snow : 0, wind: kind === 'storm' ? randf(0.8, 1.2) : kind === 'clear' ? randf(0.1, 0.4) : randf(0.3, 0.7), until: nowAbs() + randf(2.5, 8) };
    if (!first && prev !== kind) {
      var msg = kind === 'rain' ? 'Rain on the roof.' : kind === 'storm' ? 'A storm is rolling in. Mind the dock doors.' : kind === 'snow' ? 'Snow. The yard will be slow.' : kind === 'overcast' ? 'Clouds have come over.' : 'The sky has cleared.';
      logEvent(msg, kind === 'storm' ? 'bad' : '');
    }
  }
  function tickWeatherState(dt) {
    if (!S.weather) pickWeather(true);
    var W = S.weather;
    if (nowAbs() > W.until) pickWeather(false);
    var raining = W.kind === 'rain' || W.kind === 'storm';
    W.wet = clamp(W.wet + (raining ? dt / 50 : -dt / 260), 0, 1);
    W.snow = clamp(W.snow + (W.kind === 'snow' ? dt / 90 : season() === 3 ? -dt / 1200 : -dt / 200), 0, 1);
    if (W.kind === 'storm' && Math.random() < dt * 0.06) { weatherFlash = 1; var delay = randf(300, 1800); setTimeout(function () { sfx('thunder'); }, delay); }
    weatherFlash *= Math.max(0, 1 - 6 * dt);
    ambience(raining ? (insideHall(player.x, player.z) ? 0.05 : 0.14) * (W.kind === 'storm' ? 1.4 : 1) : 0);
  }
  // a looping band of filtered noise is the rain; its level follows whether you are under the roof
  var amb = { gain: null, src: null, want: 0 };
  function ambience(level) {
    amb.want = level;
    if (!AC) return;
    if (!amb.src) { var len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; var src = AC.createBufferSource(); src.buffer = buf; src.loop = true; var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; var g = AC.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(sfxBus); src.start(); amb.src = src; amb.gain = g; }
    amb.gain.gain.setTargetAtTime(SET.sound ? level : 0, AC.currentTime, 0.4);
  }

  // ── The radio ─────────────────────────────────────────────────────
  // Three stations, every note synthesized: a chord progression, a bass line, hats and a kick, at the station's tempo.
  var STATIONS = [
    { name: 'Depot FM', bpm: 92, wave: 'triangle', root: 220, chords: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]], bass: [0, 0, 7, 5], hat: [1, 0, 1, 1, 1, 0, 1, 1], kick: [1, 0, 0, 0, 1, 0, 1, 0] },
    { name: 'Night Drive', bpm: 118, wave: 'sawtooth', root: 196, chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]], bass: [0, 0, 0, 3], hat: [1, 1, 1, 1, 1, 1, 1, 1], kick: [1, 0, 0, 0, 1, 0, 0, 0] },
    { name: 'Country 101', bpm: 104, wave: 'square', root: 247, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], bass: [0, 7, 5, 7], hat: [0, 1, 0, 1, 0, 1, 0, 1], kick: [1, 0, 1, 0, 1, 0, 1, 0] }
  ];
  var radio = { next: 0, step: 0, gain: null, timer: null };
  function radioPrompt() { if (S.events.power) return 'The radio is off: no power'; return S.radio && S.radio.on ? 'Radio: ' + STATIONS[S.radio.station].name + ' · next station' : 'Switch the radio on'; }
  function radioUse() {
    if (S.events.power) { toast('No power.', 'bad'); return; }
    if (!S.radio) S.radio = { on: false, station: 0 };
    if (!S.radio.on) { S.radio.on = true; S.radio.station = 0; } else if (S.radio.station < STATIONS.length - 1) S.radio.station++; else S.radio.on = false;
    sfx('click'); toast(S.radio.on ? '📻 ' + STATIONS[S.radio.station].name : 'Radio off', ''); audio(); radioStart();
  }
  function radioStart() { if (!AC) return; if (!radio.gain) { radio.gain = AC.createGain(); radio.gain.gain.value = 0; radio.gain.connect(sfxBus); } if (!radio.timer) { radio.next = AC.currentTime + 0.1; radio.step = 0; radio.timer = setInterval(radioSchedule, 120); } }
  function radioSchedule() {
    if (!AC || !S.radio || !S.radio.on || S.events.power) { if (radio.gain) radio.gain.gain.setTargetAtTime(0, AC ? AC.currentTime : 0, 0.3); return; }
    var st = STATIONS[S.radio.station], beat = 60 / st.bpm, sixteenth = beat / 4;
    while (radio.next < AC.currentTime + 0.35) {
      var t = radio.next, i = radio.step, bar = Math.floor(i / 16) % st.chords.length, chord = st.chords[bar], semi = function (n) { return st.root * Math.pow(2, n / 12); };
      if (i % 8 === 0) chord.forEach(function (n, k) { rTone(st.wave, semi(n) * (k === 2 ? 1 : 1), t, sixteenth * 7.5, 0.05, 1800); });
      if (i % 4 === 0) rTone('sine', semi(st.bass[Math.floor(i / 4) % 4] - 24), t, beat * 0.9, 0.12, 400);
      if (st.hat[i % 8]) rNoise(t, 0.03, 0.04, 6000);
      if (st.kick[i % 8]) { rTone('sine', 110, t, 0.14, 0.18, null, 40); }
      if (i % 16 === 14 && Math.random() < 0.5) rTone(st.wave, semi(chord[1] + 12), t, sixteenth * 2, 0.04, 2400);
      radio.next += sixteenth; radio.step++;
    }
  }
  function rTone(type, f0, t, dur, gain, lp, f1) { var o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); var dest = radio.gain; if (lp) { var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); f.connect(dest); } else g.connect(dest); o.connect(g); o.start(t); o.stop(t + dur + 0.05); }
  function rNoise(t, dur, gain, freq) { var len = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len); var src = AC.createBufferSource(); src.buffer = buf; var f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq; var g = AC.createGain(); g.gain.value = gain; src.connect(f); f.connect(g); g.connect(radio.gain); src.start(t); }
  function tickRadio() {
    if (!AC || !radio.gain) return;
    var on = S.radio && S.radio.on && !S.events.power && SET.sound;
    var d = dress.radio ? Math.sqrt(dist2(player.x, player.z, dress.radio.position.x, dress.radio.position.z)) : 99;
    var g = on ? clamp(1 - d / 16, 0, 1) * 0.5 * (insideHall(player.x, player.z) ? 1 : 0.25) : 0;
    radio.gain.gain.setTargetAtTime(g, AC.currentTime, 0.2);
  }

  // ── The forklift battery ──────────────────────────────────────────
  function forkCharging() { return !!S.up.fork && !driving && Math.abs(S.fork.x - SPOT.fork.x) < 1.6 && S.fork.z > SPOT.fork.z - 1.9 && S.fork.batt < 1; }
  function tickBattery(dt) {
    if (!S.up.fork) return;
    if (S.fork.batt === undefined) S.fork.batt = 1;
    if (driving && Math.abs(forkSpeed) > 0.1) { S.fork.batt = clamp(S.fork.batt - dt / 1500, 0, 1); if (S.fork.batt <= 0 && !S.flags.battDead) { S.flags.battDead = 1; toast('Forklift battery flat. Push it to the charger.', 'bad'); } }
    else if (forkCharging() && !S.events.power) { S.fork.batt = clamp(S.fork.batt + dt / 110, 0, 1); if (S.fork.batt >= 1 && S.flags.battDead) { S.flags.battDead = 0; toast('Forklift charged.', 'good'); } }
  }

  // ── The stretch wrapper ───────────────────────────────────────────
  // A wrapped pallet keeps its boxes on the forks round a fast corner; an unwrapped one sheds them. Wrap film is $2 a pallet.
  var wrapper = { t: 0, pallet: null };
  function wrapperBusy() { return wrapper.t > 0; }
  function wrapperPrompt() {
    if (wrapperBusy()) return 'Wrapping… ' + Math.ceil(wrapper.t) + ' s';
    if (S.events.power) return 'The wrapper is off: no power';
    var p = jackPallet(); if (player.tool === 'jack' && p) return p.wrapped ? 'That pallet is already wrapped' : 'Wrap the pallet ($2)';
    return 'Stretch wrapper · bring a pallet on the jack';
  }
  function wrapperUse() {
    if (wrapperBusy() || S.events.power) return;
    var p = jackPallet(); if (!(player.tool === 'jack' && p) || p.wrapped) { sfx('bad'); return; }
    if (S.bank < 2) { toast('No money for film.', 'bad'); return; }
    pay(-2, 'Stretch film'); wrapper.t = 5; wrapper.pallet = p.id; sfx('hydraulic'); addXp(3);
  }
  var wrapInst = null;
  function tickWrapper(dt) {
    if (wrapper.t > 0) { wrapper.t -= dt; if (wrapper.t <= 0) { wrapper.t = 0; var p = palletById(wrapper.pallet); if (p) { p.wrapped = true; toast('Pallet wrapped', 'good'); sfx('tape'); burst(dress.wrapper.position.x, 1, dress.wrapper.position.z, 0xffffff, 10, 'out'); } } }
    if (!wrapInst) { var filmTex = tex(128, 256, function (c, w, h) { c.fillStyle = 'rgba(235,240,245,0.55)'; c.fillRect(0, 0, w, h); for (var i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,' + randf(0.05, 0.25) + ')'; c.fillRect(Math.random() * w, 0, randf(1, 4), h); } for (var y = 0; y < h; y += 34) { c.fillStyle = 'rgba(200,210,220,0.35)'; c.fillRect(0, y, w, 3); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(0, y + 4, w, 1); } }, 2, 1); wrapInst = new THREE.InstancedMesh(boxGeo(1.27, 1.0, 1.07), new THREE.MeshPhysicalMaterial({ map: filmTex, transparent: true, opacity: 0.55, roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1, depthWrite: false, side: THREE.DoubleSide }), 120); wrapInst.count = 0; wrapInst.frustumCulled = false; wrapInst.renderOrder = 1; scene.add(wrapInst); }
    var n = 0; S.pallets.forEach(function (p) { if (!p.wrapped || n >= 120) return; var w = palletWorld(p); if (!w) return; var hgt = Math.ceil(p.n / 4) * BOX.h + 0.02; _e.set(0, w.ry, 0); _q.setFromEuler(_e); _v2.set(1, hgt, 1); _m4.compose(_v.set(w.x, w.y + 0.14 + hgt / 2 - 0.01, w.z), _q, _v2); wrapInst.setMatrixAt(n++, _m4); });
    wrapInst.count = n; wrapInst.instanceMatrix.needsUpdate = true;
  }

  function tickLife(dt) {
    if (!ui.started || ui.blocked()) return;
    tickWeatherState(dt); tickRadio(); tickBattery(dt); tickWrapper(dt);
  }
