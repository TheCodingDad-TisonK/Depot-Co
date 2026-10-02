//@ the log, toasts and the generated sound effects
  // ── Log / toast / sound ───────────────────────────────────────────
  function logEvent(msg, kind) {
    S.log.unshift({ day: S.day, t: fmtTime(S.time), msg: msg, kind: kind || '' });
    if (S.log.length > 60) S.log.pop();
    feedPush(msg, kind);
  }
  function feedPush(msg, kind) {
    var feed = $('h-feed'); if (!feed) return;
    var d = document.createElement('div'); d.className = kind || '';
    d.innerHTML = '<span class="t">' + fmtTime(S.time) + '</span>' + msg;
    feed.appendChild(d);
    while (feed.children.length > 6) feed.removeChild(feed.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 14000);
  }
  function toast(msg, kind) {
    var box = $('h-toasts'); if (!box) return;
    var d = document.createElement('div'); d.className = kind || ''; d.innerHTML = msg; box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 2600);
    if (kind === 'bad') sfx('bad'); else if (kind === 'rare') sfx('rare'); else sfx('ok');
  }
  var AC = null, sfxBus = null;
  function audio() { if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); sfxBus = AC.createGain(); sfxBus.gain.value = SET.vol; sfxBus.connect(AC.destination); } if (AC.state === 'suspended') AC.resume(); return AC; }
  // small synth helpers: everything is generated, no audio files
  function sTone(type, f0, t, dur, gain, opts) { opts = opts || {}; var o = AC.createOscillator(), gn = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (opts.f1) o.frequency.exponentialRampToValueAtTime(opts.f1, t + dur); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(gain, t + (opts.attack || 0.008)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); var dest = sfxBus; if (opts.lp) { var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; gn.connect(f); f.connect(dest); } else gn.connect(dest); o.connect(gn); o.start(t); o.stop(t + dur + 0.05); }
  function sNoise(t, dur, gain, opts) { opts = opts || {}; var len = Math.floor(AC.sampleRate * dur); var buf = AC.createBuffer(1, len, AC.sampleRate); var d = buf.getChannelData(0); for (var i = 0; i < len; i++) { var env = opts.shape === 'swell' ? Math.sin(i / len * Math.PI) : opts.shape === 'flat' ? 1 : (1 - i / len); d[i] = (Math.random() * 2 - 1) * env; } var src = AC.createBufferSource(); src.buffer = buf; var f = AC.createBiquadFilter(); f.type = opts.type || 'highpass'; f.frequency.value = opts.freq || 4000; if (opts.q) f.Q.value = opts.q; var gn = AC.createGain(); gn.gain.setValueAtTime(gain, t); if (opts.fade) gn.gain.exponentialRampToValueAtTime(0.0001, t + dur); src.connect(f); f.connect(gn); gn.connect(sfxBus); src.start(t); }
  function sThud(t, f, gain, dur) { sTone('sine', f, t, dur || 0.12, gain, { f1: f * 0.5 }); sNoise(t, 0.05, gain * 0.5, { type: 'lowpass', freq: 600 }); }
  function sBeep(t, f, dur, gain) { sTone('square', f, t, dur || 0.08, gain || 0.05, { lp: 3000 }); }
  var SFX = {
    ok:      function (t) { sTone('sine', 520, t, 0.07, 0.07); sTone('sine', 780, t + 0.07, 0.1, 0.07); },
    bad:     function (t) { sTone('sawtooth', 220, t, 0.14, 0.05, { lp: 1200 }); sTone('sawtooth', 160, t + 0.12, 0.16, 0.05, { lp: 1000 }); },
    rare:    function (t) { [660, 880, 1320, 1760].forEach(function (f, i) { sTone('sine', f, t + i * 0.07, 0.16, 0.07); }); },
    click:   function (t) { sTone('sine', 900, t, 0.03, 0.06); sNoise(t, 0.02, 0.05, { freq: 5000 }); },
    cash:    function (t) { [1175, 1568, 2093, 2637].forEach(function (f, i) { sTone('sine', f, t + i * 0.045, 0.14, 0.06); }); sNoise(t, 0.12, 0.08, { freq: 7000, fade: true }); },
    pickup:  function (t) { sNoise(t, 0.05, 0.08, { type: 'lowpass', freq: 1800 }); sTone('sine', 300, t, 0.08, 0.05, { f1: 200 }); },
    putdown: function (t) { sThud(t, 180, 0.09, 0.12); sNoise(t, 0.04, 0.05, { type: 'lowpass', freq: 1500 }); },
    crate:   function (t) { sThud(t, 120, 0.14, 0.18); sNoise(t + 0.02, 0.1, 0.08, { type: 'lowpass', freq: 900, fade: true }); },
    step:    function (t, o) { var f = o === 'steel' ? 200 : o === 'outside' ? 110 : 130; sThud(t, f, 0.035, 0.07); if (o === 'steel') sNoise(t, 0.03, 0.03, { freq: 3000 }); if (o === 'outside') sNoise(t, 0.06, 0.04, { type: 'bandpass', freq: 1200, q: 0.5 }); },
    roller:  function (t) { for (var i = 0; i < 14; i++) { sNoise(t + i * 0.085, 0.07, 0.07, { type: 'lowpass', freq: 500 + (i % 2) * 300 }); sTone('square', 60 + (i % 3) * 8, t + i * 0.085, 0.08, 0.02, { lp: 300 }); } sThud(t + 1.25, 90, 0.1, 0.15); },
    scan:    function (t) { sBeep(t, 2200, 0.06, 0.04); },
    tape:    function (t) { sNoise(t, 0.35, 0.12, { type: 'bandpass', freq: 2200, q: 0.8, shape: 'flat', fade: true }); sNoise(t + 0.4, 0.08, 0.1, { freq: 3000 }); },
    jack:    function (t) { for (var i = 0; i < 3; i++) { sTone('sawtooth', 140, t + i * 0.18, 0.12, 0.03, { f1: 110, lp: 500 }); sNoise(t + i * 0.18 + 0.1, 0.04, 0.05, { type: 'lowpass', freq: 800 }); } },
    forklift:function (t) { for (var i = 0; i < 12; i++) sTone('sawtooth', 70 + Math.sin(i * 0.9) * 5, t + i * 0.1, 0.12, 0.025, { lp: 260 }); },
    hydraulic:function (t) { sNoise(t, 0.5, 0.05, { type: 'bandpass', freq: 600, q: 1.2, shape: 'flat', fade: true }); sTone('sine', 90, t, 0.5, 0.03, { f1: 120 }); },
    truck:   function (t) { for (var i = 0; i < 30; i++) sTone('sawtooth', 48 + Math.sin(i * 0.6) * 5, t + i * 0.1, 0.12, 0.03, { lp: 200 }); sNoise(t, 3, 0.03, { type: 'lowpass', freq: 260, shape: 'flat' }); },
    airbrake:function (t) { sNoise(t, 0.7, 0.14, { freq: 3500, shape: 'flat', fade: true }); },
    horn:    function (t) { sTone('sawtooth', 220, t, 0.5, 0.05, { lp: 1200 }); sTone('sawtooth', 277, t, 0.5, 0.04, { lp: 1200 }); },
    bell:    function (t) { sTone('sine', 2093, t, 0.6, 0.06); sTone('sine', 2637, t + 0.005, 0.5, 0.04); sTone('sine', 3136, t + 0.01, 0.4, 0.02); },
    chime:   function (t) { [523, 659, 784, 1047].forEach(function (f, i) { sTone('sine', f, t + i * 0.16, 0.6, 0.05); }); },
    door:    function (t) { sTone('sawtooth', 180, t, 0.35, 0.02, { f1: 260, lp: 700 }); sThud(t + 0.38, 220, 0.07, 0.08); sNoise(t + 0.38, 0.03, 0.06, { freq: 3000 }); },
    coffee:  function (t) { sNoise(t, 0.9, 0.06, { type: 'bandpass', freq: 400, q: 0.8, shape: 'flat', fade: true }); sNoise(t + 1.0, 1.2, 0.07, { type: 'bandpass', freq: 3500, q: 0.4, shape: 'swell' }); sTone('sine', 1500, t + 2.2, 0.15, 0.04); },
    power:   function (t) { sTone('sawtooth', 120, t, 0.6, 0.05, { f1: 30, lp: 400 }); sNoise(t, 0.3, 0.06, { type: 'lowpass', freq: 500, fade: true }); },
    breaker: function (t) { sThud(t, 320, 0.08, 0.05); sTone('square', 60, t + 0.1, 0.4, 0.02, { lp: 200 }); sTone('sine', 1200, t + 0.5, 0.1, 0.03); },
    sleep:   function (t) { [440, 392, 349, 330].forEach(function (f, i) { sTone('sine', f, t + i * 0.3, 0.5, 0.04); }); },
    levelup: function (t) { [523, 659, 784, 1047, 1319].forEach(function (f, i) { sTone('triangle', f, t + i * 0.1, 0.4, 0.06); }); sNoise(t + 0.5, 0.4, 0.05, { freq: 6000, fade: true }); },
    siren:   function (t) { for (var i = 0; i < 4; i++) sTone('sine', i % 2 ? 640 : 860, t + i * 0.32, 0.31, 0.05); },
    gate:    function (t) { sTone('sawtooth', 320, t, 0.9, 0.02, { f1: 260, lp: 1200 }); sTone('sawtooth', 480, t + 0.05, 0.8, 0.012, { f1: 380, lp: 1500 }); sThud(t + 1.0, 400, 0.05, 0.06); },
    lock:    function (t) { sThud(t, 400, 0.06, 0.05); sNoise(t + 0.05, 0.04, 0.08, { freq: 3500 }); sTone('sine', 1800, t + 0.1, 0.08, 0.03); },
    unlock:  function (t) { sNoise(t, 0.05, 0.08, { freq: 3000 }); sThud(t + 0.08, 300, 0.07, 0.06); },
    flap:    function (t) { for (var i = 0; i < 6; i++) sNoise(t + i * 0.09, 0.05, 0.08, { type: 'bandpass', freq: 900 + i * 100, q: 0.8 }); },
    vend:    function (t) { sBeep(t, 1200, 0.05, 0.03); sTone('square', 80, t + 0.15, 0.25, 0.03, { lp: 400 }); sThud(t + 0.5, 140, 0.12, 0.15); sNoise(t + 0.5, 0.15, 0.08, { type: 'lowpass', freq: 1200, fade: true }); },
    thunder: function (t) { sNoise(t, 2.6, 0.5, { type: 'lowpass', freq: 220, shape: 'swell', fade: true }); sTone('sine', 45, t + 0.1, 2.0, 0.12, { f1: 28 }); sNoise(t + 0.6, 1.4, 0.2, { type: 'lowpass', freq: 400, fade: true }); },
    beepback:function (t) { sBeep(t, 1100, 0.14, 0.05); },
    fanfare: function (t) { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { sTone('triangle', f, t + i * 0.12, 0.3, 0.06); }); },
    glass:   function (t) { for (var i = 0; i < 8; i++) sTone('sine', 2400 + Math.random() * 2400, t + i * 0.03, 0.08, 0.03); sNoise(t, 0.2, 0.1, { freq: 5000, fade: true }); }
  };
  function sfx(kind, opt) {
    if (!SET.sound) return;
    try { audio(); if (sfxBus) sfxBus.gain.value = SET.vol; var fn = SFX[kind] || SFX.click; fn(AC.currentTime, opt); } catch (e) {}
  }
