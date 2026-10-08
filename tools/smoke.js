// The smoke test: `npm test`. Boots the real game (game/index.html) in a hidden Electron window and climbs the ladder across
// reloads: the shed scenario plays a fresh save to level 5 and sleeps, which books the small hall; the runner reloads the page the
// way the game would and the small-hall scenario carries on with that save, and so on to the far end. A seventh scenario seeds a
// 1.20-style save and checks the migration. Any page error fails the run. The scenario texts live in tools/smoke-*.js; the shared
// prologue (ok, mkOrder, climbTo) is in tools/smoke-lib.js. One rule for every scenario: no backslash-quote inside the template literal.
//   electron tools/smoke.js            the whole ladder
//   electron tools/smoke.js big stage=3   one scenario, seeded at its stage (shed needs no seed)
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const lib = require('./smoke-lib');

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';   // the dev-mode CSP notice is not a game error
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'depotco-test-')));   // never the player's saves
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
if (process.env.CI) app.disableHardwareAcceleration();

const PAGE = path.join(__dirname, '..', 'game', 'index.html');
// a 1.20 save: no site field, the 72 m hall, the returns hall owned
const OLD_SAVE = { ver: 1, day: 12, time: 6, bank: 4000, xp: 10, level: 9, rep: 30, hall: 5, up: { rows: 4, cart: true, fork: true, lights: false, dock2: true, sign: false, shipbelt: false, agv: false, gantry: false, upper: true, sorter: true, hall2: true, hall3: false, hall4: false }, slots: { '0,3,0': { sku: 'paint', n: 7, pal: true } }, staff: [{ id: 'st-old-1', name: 'Jo', role: 'picker', x: -30, z: 20, yaw: 0, state: 'home', path: [], timer: 0, carry: null, task: null, hiredDay: 2, look: {}, said: 0, punct: 0.8, arriveOff: 0, hoursToday: 0, sheet: [] }], intro: { step: 12, done: true, off: false }, doors: [false, false, false, false, false, false, false], stage: {}, flags: {}, orders: [], shipped: [], trucks: [], pallets: [], floor: [] };
const SCENARIOS = [
  { name: 'the shed', file: './smoke-shed.js', fresh: true },
  { name: 'the small hall', file: './smoke-small.js', stage: 1 },
  { name: 'the hall', file: './smoke-hall.js', stage: 2 },
  { name: 'the big hall', file: './smoke-big.js', stage: 3 },
  { name: 'the annexes', file: './smoke-annex.js', stage: 4 },
  { name: 'the far end', file: './smoke-far.js', stage: 5 },
  { name: 'a 1.20 save', file: './smoke-old.js', seed: OLD_SAVE }
];
const args = process.argv.slice(2), only = args.filter((a) => !/=/.test(a) && !/^--/.test(a));

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 720, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true } });
  const pageErrors = [];
  win.webContents.on('console-message', (e, level, msg, line, src) => { if (level >= 2 && !/Electron Security Warning/.test(msg)) pageErrors.push(msg + ' @ ' + String(src).split('/').pop() + ':' + line); });
  win.webContents.on('render-process-gone', (e, d) => { pageErrors.push('renderer gone: ' + d.reason); });
  let total = 0, failed = 0;
  const fileArg = (args.filter((a) => /^file=/.test(a))[0] || '').slice(5), stageArg = +((args.filter((a) => /^stage=/.test(a))[0] || 'stage=3').slice(6));
  const list = fileArg ? [{ name: fileArg, file: path.resolve(fileArg), stage: stageArg }] : only.length ? SCENARIOS.filter((s) => only.some((o) => s.file.indexOf(o) >= 0)) : SCENARIOS;   // file=<scenario.js> stage=<n>: one scenario file at a stage, for bisecting a hang
  for (let i = 0; i < list.length; i++) {
    const sc = list[i], body = require(sc.file);
    // the page boots with the save in slot 1: nothing (the shed), what the scenario before left, or a seed
    await win.loadFile(PAGE);
    let seed = sc.seed ? JSON.stringify(sc.seed) : null;
    if (!seed && (i === 0 || only.length || fileArg) && sc.stage) seed = JSON.stringify({ site: sc.stage, siteDue: sc.stage, level: [1, 5, 10, 15, 20, 25][sc.stage], bank: 5000, up: { rows: 2 } });   // a scenario run on its own boots a bare save of its stage
    if (seed || sc.fresh) { await win.webContents.executeJavaScript(seed ? 'localStorage.setItem("depotco-slot1", ' + JSON.stringify(seed) + '); 1' : 'localStorage.removeItem("depotco-slot1"); 1'); await win.loadFile(PAGE); }
    await new Promise((r) => setTimeout(r, 1200));
    const errsBefore = pageErrors.length, t0 = Date.now();
    let result;
    try { result = await Promise.race([win.webContents.executeJavaScript(lib.wrap(body), true), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), +(process.env.SMOKE_TIMEOUT || 240000)))]); }
    catch (e) { let partial = null; try { partial = await Promise.race([win.webContents.executeJavaScript('window.__smoke && { out: window.__smoke.out.slice(-6), n: window.__smoke.out.length }', true), new Promise((r) => setTimeout(() => r(null), 3000))]); } catch (e2) {} result = { out: partial ? ['info stopped after ' + partial.n + ' checks; the last: ' + partial.out.join(' | ')] : [], errs: ['scenario threw: ' + (e && e.message || e)] }; }
    console.log('-- ' + sc.name + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
    result.out.forEach((l) => console.log('  ' + l));
    result.errs.filter((e) => /^scenario threw/.test(e)).forEach((l) => console.log('  ' + l));
    pageErrors.slice(errsBefore).forEach((l) => console.log('  PAGE ' + l));
    total += result.out.filter((l) => /^ok/.test(l)).length; failed += result.errs.length + (pageErrors.length - errsBefore);
    if (!result.pending && i < list.length - 1 && !list[i + 1].seed && !only.length) console.log('  note: no rebuild pending; the next scenario boots the save as it stands');
  }
  console.log(failed ? 'smoke: FAILED (' + failed + ') with ' + total + ' checks passed' : 'smoke: all ' + total + ' checks passed across ' + list.length + ' scenarios');
  app.exit(failed ? 1 : 0);
});
