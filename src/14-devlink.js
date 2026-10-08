//@ the dev console link (1.21.0): the game side of the little standalone console in tools/devconsole
  // ── The dev console link ──────────────────────────────────────────
  // The F8 cheat panel is gone. In its place a separate little Electron program (npm run devconsole) runs a local server on
  // 127.0.0.1:8432. The game links to it only when told: Ctrl+Shift+D, or started with --dev-link (the page gets ?dev=1). While
  // linked it posts a readout of the save once a second and takes commands over a server-sent event stream; every command goes
  // through devCommand, the same code the tests call. The HUD shows LINKED. Nothing here runs in an unlinked game.
  var DEV_PORT = 8432, devLink = { on: false, es: null, t: 0, sent: 0, got: 0, fails: 0, last: '', manualOff: false, probeT: 0 };
  // In the desktop app the game also looks for the console by itself: every five seconds while unlinked it asks 127.0.0.1:8432 once,
  // and links when something answers. So opening the console and the game in either order is enough; the key is for the browser,
  // and for unlinking, after which the game stops looking until the key is pressed again. Never in the tests: a refused connection is a page error there.
  var DEV_AUTO = /Electron/i.test(navigator.userAgent);
  function devProbe() {
    try { var opt = { mode: 'cors', cache: 'no-store' }; if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) opt.signal = AbortSignal.timeout(800);
      fetch('http://127.0.0.1:' + DEV_PORT + '/state', opt).then(function (r) { if (r.ok && !devLink.on && !devLink.manualOff) devLinkToggle(); }).catch(function () {}); } catch (e) {}
  }
  function devState() {
    return { version: window.DEPOT_VERSION || 'dev', day: S.day, time: Math.round(S.time * 100) / 100, clock: fmtTime(S.time), bank: S.bank, level: S.level, xp: S.xp, xpFor: XP_FOR(S.level), cap: LEVEL_CAP, rep: Math.round(S.rep * 10) / 10,
      site: S.site, siteDue: S.siteDue, stage: BOOT_STAGE, stageName: stageName(BOOT_STAGE), next: nextLevelText(), weather: S.weather ? S.weather.kind : 'clear', power: !S.events.power,
      orders: S.orders.filter(function (o) { return o.state === 'open'; }).length, packed: S.orders.filter(function (o) { return o.state === 'packed'; }).length, late: S.orders.filter(function (o) { return o.late && o.state !== 'shipped'; }).length,
      stock: totalStock(), trucks: S.trucks.map(function (t) { return (t.van ? 'van' : t.dir) + ' ' + dockLabel(doorIndex(t.dir, t.dock)) + ' ' + t.state; }), staff: S.staff.map(function (st) { return st.name + ' (' + st.role + ') ' + staffStatus(st); }),
      up: Object.keys(S.up).filter(function (k) { return S.up[k] === true; }), rows: S.up.rows, player: { x: Math.round(player.x * 10) / 10, z: Math.round(player.z * 10) / 10 }, intro: S.intro && !S.intro.done ? introIndex() + ' of ' + INTRO.length : 'done', commands: DEV_COMMANDS };
  }
  function devLinkBadge() { var b = $('h-devlink'); if (!b) return; b.hidden = !devLink.on; b.textContent = devLink.on ? (devLink.es && devLink.es.readyState === 1 ? 'LINKED · dev console' : 'LINKING...') : ''; }
  function devLinkToggle() {
    if (devLink.on) { devLink.manualOff = true; devLinkStop('Dev console unlinked. Ctrl+Shift+D links again.'); return; }
    devLink.manualOff = false;
    if (typeof EventSource === 'undefined') { toast('No EventSource in this browser: the dev console cannot link.', 'bad'); return; }
    devLink.on = true; devLink.fails = 0;
    try { var es = new EventSource('http://127.0.0.1:' + DEV_PORT + '/events'); devLink.es = es;
      es.onopen = function () { devLink.fails = 0; devLinkBadge(); toast('Dev console linked', 'good'); };
      es.onmessage = function (ev) { var cmd; try { cmd = JSON.parse(ev.data); } catch (e) { return; } if (!cmd || !cmd.name) return; devLink.got++; var res = devCommand(cmd.name, cmd.arg); devLink.last = cmd.name + ': ' + res; devPost('/result', { id: cmd.id, name: cmd.name, result: res }); };
      es.onerror = function () { devLink.fails++; devLinkBadge(); if (devLink.fails === 1) toast('Dev console not answering on 127.0.0.1:' + DEV_PORT + '. Start it with npm run devconsole; the game keeps trying.', ''); if (devLink.fails > 30) devLinkStop('Dev console: gave up after 30 tries'); };
    } catch (e) { devLinkStop('Dev console: could not open the link'); return; }
    devLinkBadge(); logEvent('Dev console link opened. Ctrl+Shift+D unlinks.');
  }
  function devLinkStop(why) { if (devLink.es) { try { devLink.es.close(); } catch (e) {} } devLink.es = null; devLink.on = false; devLinkBadge(); if (why) toast(why, ''); }
  function devPost(path, body) { try { fetch('http://127.0.0.1:' + DEV_PORT + path, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).then(function () { devLink.sent++; }).catch(function () {}); } catch (e) {} }
  function tickDevLink(dt) {
    if (!devLink.on) { if (!DEV_AUTO || devLink.manualOff || ui.testing) return; devLink.probeT += dt; if (devLink.probeT < 5) return; devLink.probeT = 0; devProbe(); return; }
    devLink.t += dt; if (devLink.t < 1) return; devLink.t = 0; if (devLink.es && devLink.es.readyState === 1) devPost('/state', devState());
  }
