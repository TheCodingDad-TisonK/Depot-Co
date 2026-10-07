// Playtest camera: boots the game in a hidden Electron window, visits a list of viewpoints and saves a PNG of each.
//   electron tools/shots.js <outDir> [only]        only: a substring of the shot names to take
// Each shot: { name, x, z, y, yaw, pitch, time, pre, post, wait } where pre and post are JavaScript run in the page before and after, y fixes the
// eye height (the deck), and wait is the settle time in ms (longer for a shot that builds something heavy).
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'depotco-shots-')));
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const outDir = process.argv[2] || path.join(os.tmpdir(), 'depot-shots'), only = (process.argv[3] || '').toLowerCase();
fs.mkdirSync(outDir, { recursive: true });

const SHOTS = [
  { name: '01-lobby', x: -34.6, z: 21.2, yaw: -Math.PI / 2 - 0.4, pitch: 0, time: 6.2 },
  { name: '02-breakroom', x: -30.3, z: -21.2, yaw: Math.PI / 2 - 0.3, pitch: -0.05, time: 10 },
  { name: '03-hall-from-lobby', x: -30.5, z: 19.2, yaw: -Math.PI / 2 + 0.5, pitch: -0.05, time: 10 },
  { name: '06-receiving', x: -24, z: -8, yaw: 0.5, pitch: 0, time: 7.4, pre: 'T.setTime(7.3); T.run(28);' },
  { name: '07-dock-in1-truck', x: -32.5, z: -11.5, yaw: Math.PI / 2 + 0.3, pitch: 0, time: 7.8, pre: 'T.setDoor(0, true); T.run(3);' },
  { name: '08-driver-outside', x: -40, z: -11, yaw: Math.PI / 2 - 0.8, pitch: -0.1, time: 7.9 },
  { name: '09-inside-trailer', x: -40, z: -14, yaw: Math.PI / 2, pitch: -0.1, time: 7.9 },
  { name: '11-aisle', x: -22, z: -7.6, yaw: -Math.PI / 2, pitch: 0, time: 9 },
  { name: '12-rack-closeup', x: -8, z: -8.4, yaw: 0, pitch: 0.1, time: 9, pre: 'S.slots["0,5,0"]={sku:"paint",n:8,pal:true}; S.slots["0,5,1"]={sku:"bolts",n:12,pal:true}; S.slots["0,6,0"]={sku:"cereal",n:4,pal:true};' },
  { name: '13-forklift', x: 3, z: 17.5, yaw: 0.9, pitch: -0.2, time: 9, pre: 'S.up.fork=true;' },
  { name: '15-bench', x: 29.2, z: 5.2, yaw: -Math.PI / 2 - 0.2, pitch: -0.15, time: 9, pre: 'T.benchAdd("paint",3); T.benchAdd("lamps",2);' },
  { name: '15b-returns-desk', x: 26.6, z: 10.4, yaw: -Math.PI / 2, pitch: -0.12, time: 9, pre: 'S.level=Math.max(S.level,3); var rt=T.spawnTruck("out",1,23); rt.x=T.HALL.x+0.4; var rid=T.addReturn(rt,{num:12,client:"grocer",mode:"land",lines:[{sku:"cereal",qty:2}],reason:"unwanted"}); rt.returns.length=0; T.rdesk().queue.push(rid); T.rdesk().shelf.push({sku:"paint"},{sku:"lamps",damaged:true}); T.run(0.1);' },
  { name: '16-office', x: 27.8, z: 20.4, yaw: -Math.PI / 2 - 0.5, pitch: -0.05, time: 9, pre: 'S.hdoors.office.open=true; T.run(2);' },
  { name: '17-office-desk', x: 33.5, z: 20.6, yaw: Math.PI, pitch: -0.2, time: 9 },
  { name: '18-control-cabinet', x: 27.0, z: 22.6, yaw: -Math.PI / 2, pitch: 0, time: 9 },
  { name: '19-wrapper', x: 14, z: -18.6, yaw: 0, pitch: 0, time: 9 },
  { name: '20-out-dock', x: 30, z: -8.5, yaw: -Math.PI / 2 - 0.4, pitch: 0, time: 10.8, pre: 'T.setTime(10.5); T.run(28); T.setDoor(2, true); T.run(3);' },
  { name: '21-north-wall', x: 0, z: -14, yaw: 0, pitch: 0.15, time: 11 },
  { name: '22-hall-wide', x: 30, z: 17, yaw: Math.PI / 2 + 0.7, pitch: -0.05, time: 11 },
  { name: '23-yard-west', x: -46, z: -8, yaw: -Math.PI / 2, pitch: 0.05, time: 16.5 },
  { name: '24-yard-gate', x: -70, z: -10, yaw: Math.PI / 2 + 0.3, pitch: 0, time: 16.5 },
  { name: '25-carpark', x: -10, z: 30, yaw: 0.6, pitch: -0.05, time: 16.5 },
  { name: '26-front-sign', x: 0, z: 33, yaw: 0, pitch: 0.2, time: 16.5 },
  { name: '27-night-hall', x: -20, z: -1, yaw: -Math.PI / 2, pitch: 0, time: 22.5 },
  { name: '28-night-yard', x: -40, z: 10, yaw: -Math.PI / 2 + 0.4, pitch: 0.1, time: 23 },
  { name: '29-rain', x: -30, z: -2, yaw: Math.PI / 2 - 0.5, pitch: 0.1, time: 14, pre: 'S.weather={kind:"storm",wet:1,snow:0,wind:1,until:9999}; T.run(2);' },
  { name: '30-snow', x: -30, z: -2, yaw: Math.PI / 2 - 0.5, pitch: 0.1, time: 14, pre: 'S.weather={kind:"snow",wet:0,snow:1,wind:0.5,until:9999}; T.run(2);', post: 'S.weather={kind:"clear",wet:0,snow:0,wind:0.3,until:9999};' },
  { name: '31-staff', x: 29, z: 1, yaw: Math.PI / 2 + 0.6, pitch: 0, time: 9.5, pre: 'S.level=Math.max(S.level,4); S.bank+=5000; T.hireStaff("receiver"); T.hireStaff("picker"); T.hireStaff("packer"); S.staff.forEach(function(s,i){s.state="idle"; s.clocked=true; s.x=26.5+i*0.9; s.z=3+i*0.4; s.yaw=-1.6;}); T.run(0.5);' },
  { name: '32-scanner', x: -20, z: 0, yaw: -Math.PI / 2, pitch: 0, time: 9.5, pre: 'T.scanToggle(true); T.scanPage(0);', post: 'T.scanToggle(false);' },
  { name: '32b-scanner-map', x: -20, z: 0, yaw: -Math.PI / 2, pitch: 0, time: 9.5, pre: 'T.scanToggle(true); T.scanPage(T.MAP_PAGE);', post: 'T.scanPage(0); T.scanToggle(false);' },
  { name: '32c-day-report', x: -20, z: 0, yaw: -Math.PI / 2, pitch: 0, time: 6.1, pre: 'T.closeDay(); S.stats.shipped+=3; S.stats.earned+=540; S.stats.spent+=210; S.stats.received+=5; T.closeDay();', post: 'document.getElementById("h-report").hidden = true;' },
  { name: '33-pc-panel', x: 33.5, z: 20.6, yaw: Math.PI, pitch: 0, time: 9.5, pre: 'T.openPanel("pc","shop");', post: 'T.closePanel();' },
  { name: '34-menu', x: -20, z: 0, yaw: -Math.PI / 2, pitch: 0, time: 9.5, pre: 'document.getElementById("dc-mainmenu").hidden=false;', post: 'document.getElementById("dc-mainmenu").hidden=true;' },
  { name: '35-deck', x: 2, z: -19.2, y: 4.6, yaw: Math.PI / 2 + 0.4, pitch: -0.1, time: 11, wait: 90000, pre: 'S.bank+=60000; S.level=Math.max(S.level,8); S.events.power=false; ["gantry","upper","sorter"].forEach(function(u){ if(!S.up[u]) T.buyUpgrade(u); }); T.run(0.2);' },
  { name: '38-rh-returns-dock', x: 30.5, z: -31.0, y: 0, yaw: -1.9, pitch: -0.05, time: 11, wait: 90000, pre: 'S.bank+=60000; S.level=Math.max(S.level,8); ["fork","hall2"].forEach(function(u){ if(!S.up[u]) T.buyUpgrade(u); }); S.events.power=false; T.run(0.2); var rt = T.spawnTruck("ret", 0, 23); rt.x = T.HALL.x + 0.4; T.run(3); T.setDoor(6, true); T.run(4); while (rt.returns.length < 4) T.addReturn(rt, { num: 90 + rt.returns.length, client: "grocer", mode: "land", lines: [{ sku: "bolts", qty: 1 }], reason: "unwanted" }); T.run(12);' },
  { name: '39-rh-inspection-desks', x: 23.4, z: -33.4, y: 0, yaw: 0, pitch: -0.1, time: 11, wait: 90000, pre: 'T.rdesk().queue.length = 0; var rt2 = S.trucks.filter(function (t) { return t.dir === "ret"; })[0]; if (rt2) { while (T.rdesk().queue.length < 3) T.rdesk().queue.push(T.addReturn(rt2, { num: 95 + T.rdesk().queue.length, client: "grocer", mode: "land", lines: [{ sku: "cereal", qty: 2 }], reason: "unwanted" })); rt2.returns.length = 0; } T.rdeskStart(1); T.run(0.5);' },
  { name: '40-rh-restock-cage', x: 30.5, z: -39.8, y: 0, yaw: 0, pitch: -0.02, time: 11, wait: 90000, pre: 'var D = T.rdesk(); while (D.shelf.length < 11) D.shelf.push({ sku: D.shelf.length % 3 ? "cereal" : "books", damaged: D.shelf.length % 5 === 4 }); T.run(0.2);' },
  { name: '41-rh-yard-returns-lane', x: 50, z: -40, y: 0, yaw: -2.3, pitch: -0.08, time: 11, wait: 90000 },
  { name: '36-rh-hall2', x: 19, z: -26, y: 0, yaw: 0, pitch: 0, time: 11, wait: 90000, pre: 'S.bank+=60000; S.level=Math.max(S.level,8); ["fork","hall2","hall3"].forEach(function(u){ if(!S.up[u]) T.buyUpgrade(u); }); T.run(0.2);' },
  { name: '37-photo-aerial', x: 0, z: 0, yaw: 0, pitch: 0, time: 15, wait: 20000, pre: 'T.photoToggle(true); T.photo.x=58; T.photo.y=30; T.photo.z=52; T.photo.yaw=0.84; T.photo.pitch=-0.5;', post: 'T.photoToggle(false);' }
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 720, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true } });
  win.webContents.setFrameRate(30);
  const errors = [];
  win.webContents.on('console-message', (e, level, msg) => { if (level >= 2 && !/Electron Security Warning/.test(msg)) errors.push(msg); });
  await win.loadFile(path.join(__dirname, '..', 'game', 'index.html'));
  await new Promise((r) => setTimeout(r, 1500));
  // headless there is no pointer lock, and losing it opens the pause menu: suppress that, and close the menu if it opened anyway
  await win.webContents.executeJavaScript('document.getElementById("dc-splash").hidden = true; document.getElementById("dc-mainmenu").hidden = true; window.DEPOT.enter(); window.T = window.DEPOT.T; window.S = window.DEPOT.T.S; S.intro.off = true; T.ui.suppressMenu = true; document.exitPointerLock && document.exitPointerLock(); window.__f = 0; (function tick() { window.__f++; requestAnimationFrame(tick); })(); "ok"', true);   // __f counts painted frames, so a shot is captured after the page really drew its new state
  await new Promise((r) => setTimeout(r, 300));
  const unpause = 'document.getElementById("dc-mainmenu").hidden = true; if (T.ui.menuOpen) document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true })); if (T.ui.menuOpen) { T.ui.menuOpen = false; document.getElementById("dc-menu").hidden = true; }';
  await win.webContents.executeJavaScript(unpause + ' "ok"', true);
  for (const s of SHOTS) {
    if (only && !s.name.toLowerCase().includes(only)) continue;
    try {
      const f0 = await win.webContents.executeJavaScript('(function(){ ' + unpause + ' ' + (s.pre || '') + ' T.setTime(' + s.time + '); T.player.x=' + s.x + '; T.player.z=' + s.z + '; T.player.y=T.floorY(' + s.x + ',' + s.z + '); T.player.yaw=' + s.yaw + '; T.player.pitch=' + (s.pitch || 0) + '; T.player.vy=0; ' + unpause + ' return window.__f; })()', true);
      // wait for three painted frames after the setup, up to s.wait (default 8 s): a shot that builds something heavy (the deck, a hall) blocks the renderer for a while, and capturing on a fixed timer returned the previous shot's frame
      const t0 = Date.now(), maxWait = s.wait || 8000; await new Promise((r) => setTimeout(r, 700));
      while (Date.now() - t0 < maxWait) { const f = await win.webContents.executeJavaScript('window.__f', true); if (f >= f0 + 3) break; await new Promise((r) => setTimeout(r, 250)); }
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(outDir, s.name + '.png'), img.toPNG());
      if (s.post) await win.webContents.executeJavaScript('(function(){ ' + s.post + ' return "ok"; })()', true);
      console.log('shot ' + s.name);
    } catch (e) { console.log('shot ' + s.name + ' FAILED: ' + (e && e.message || e)); }
  }
  if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '));
  app.exit(0);
});
