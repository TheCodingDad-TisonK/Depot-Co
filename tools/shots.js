// Playtest camera: boots the game in a hidden Electron window, visits a list of viewpoints and saves a PNG of each.
//   electron tools/shots.js <outDir> [only]        only: a substring of the shot names to take
// Each shot: { name, x, z, yaw, pitch, time, pre } where pre is JavaScript run in the page first (sets up a scene).
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
  { name: '01-spawn', x: -14, z: 9.5, yaw: -Math.PI / 2, pitch: 0, time: 6.2 },
  { name: '02-breakroom', x: -13.2, z: 10, yaw: Math.PI / 2 - 0.5, pitch: -0.05, time: 10 },
  { name: '03-breakroom-cot', x: -15.5, z: 9.3, yaw: 2.6, pitch: -0.1, time: 10 },
  { name: '04-staffdoor', x: -17.5, z: 11.9, yaw: Math.PI / 2, pitch: 0, time: 10 },
  { name: '05-hall-from-breakdoor', x: -12.2, z: 10, yaw: -Math.PI / 2 + 0.6, pitch: -0.05, time: 10 },
  { name: '06-receiving', x: -16, z: -1, yaw: 0.5, pitch: 0, time: 7.4, pre: 'T.setTime(7.3); T.run(28);' },
  { name: '07-dock-in1-truck', x: -17.5, z: -6.5, yaw: Math.PI / 2 + 0.3, pitch: 0, time: 7.8, pre: 'T.setDoor(0, true); T.run(3);' },
  { name: '08-driver-outside', x: -22.5, z: -4, yaw: Math.PI / 2 - 0.8, pitch: -0.1, time: 7.9 },
  { name: '09-inside-trailer', x: -22, z: -8, yaw: Math.PI / 2, pitch: -0.1, time: 7.9 },
  { name: '10-jack-cart', x: -15.2, z: 2.3, yaw: Math.PI - 0.3, pitch: -0.3, time: 9 },
  { name: '11-aisle', x: -13.5, z: 0, yaw: -Math.PI / 2, pitch: 0, time: 9 },
  { name: '12-rack-closeup', x: -8, z: -3.2, yaw: Math.PI - 0.3, pitch: 0.1, time: 9, pre: 'S.slots["0,1,0"]={sku:"paint",n:8}; S.slots["0,1,1"]={sku:"bolts",n:12}; S.slots["0,2,0"]={sku:"cereal",n:4};' },
  { name: '13-forklift', x: 2.5, z: 12.2, yaw: 0.9, pitch: -0.2, time: 9, pre: 'S.up.fork=true;' },
  { name: '14-forklift-driving', x: 0, z: 10.5, yaw: 0, pitch: 0, time: 9, pre: 'S.fork.x=-2; S.fork.z=4; S.fork.yaw=-Math.PI/2; T.startDrive();' , post: 'T.stopDrive();' },
  { name: '15-bench', x: 14.8, z: 5.2, yaw: -Math.PI / 2 - 0.2, pitch: -0.15, time: 9, pre: 'T.benchAdd("paint",3); T.benchAdd("lamps",2); S.bench.parcels.push("x1","x2");' },
  { name: '16-office', x: 13.2, z: 10, yaw: -Math.PI / 2 - 0.6, pitch: -0.05, time: 9, pre: 'S.hdoors.office.open=true; T.run(2);' },
  { name: '17-office-desk', x: 16.5, z: 10.5, yaw: Math.PI - 0.3, pitch: -0.2, time: 9 },
  { name: '18-control-cabinet', x: 11.4, z: 12.6, yaw: -Math.PI / 2, pitch: 0, time: 9 },
  { name: '19-wrapper-baler', x: 1, z: -9.5, yaw: Math.PI + 0.4, pitch: 0, time: 9 },
  { name: '20-out-dock', x: 15.5, z: -3, yaw: -Math.PI / 2 - 0.4, pitch: 0, time: 10.8, pre: 'T.setTime(10.5); T.run(28); T.setDoor(2,true); T.run(3);' },
  { name: '21-north-wall', x: 0, z: -8.5, yaw: Math.PI, pitch: 0.15, time: 11 },
  { name: '22-hall-wide', x: 13, z: 12.5, yaw: Math.PI / 2 + 0.7, pitch: -0.05, time: 11 },
  { name: '23-yard-west', x: -34, z: -14, yaw: -Math.PI / 2 + 0.5, pitch: 0.05, time: 16.5 },
  { name: '24-yard-gate', x: -70, z: 0, yaw: Math.PI / 2 + 0.3, pitch: 0, time: 16.5 },
  { name: '25-carpark', x: -6, z: 28, yaw: 0.6, pitch: -0.05, time: 16.5 },
  { name: '26-front-sign', x: 0, z: 30, yaw: Math.PI, pitch: 0.2, time: 16.5 },
  { name: '27-night-hall', x: -13.5, z: 0, yaw: -Math.PI / 2, pitch: 0, time: 22.5 },
  { name: '28-night-yard', x: -30, z: 10, yaw: -Math.PI / 2 + 0.4, pitch: 0.1, time: 23 },
  { name: '29-rain', x: -24, z: -2, yaw: Math.PI / 2 - 0.5, pitch: 0.1, time: 14, pre: 'S.weather={kind:"storm",wet:1,snow:0,wind:1,until:9999}; T.run(2);' },
  { name: '30-snow', x: -24, z: -2, yaw: Math.PI / 2 - 0.5, pitch: 0.1, time: 14, pre: 'S.weather={kind:"snow",wet:0,snow:1,wind:0.5,until:9999}; T.run(2);', post: 'S.weather={kind:"clear",wet:0,snow:0,wind:0.3,until:9999};' },
  { name: '31-staff', x: 14, z: 1, yaw: Math.PI / 2 + 0.6, pitch: 0, time: 9.5, pre: 'S.level=3; S.bank+=5000; T.hireStaff("receiver"); T.hireStaff("picker"); T.hireStaff("packer"); S.staff.forEach(function(s,i){s.state="idle"; s.x=12.5+i*0.9; s.z=3+i*0.4; s.yaw=-1.6;}); T.run(0.5);' },
  { name: '32-scanner', x: -13.5, z: 0, yaw: -Math.PI / 2, pitch: 0, time: 9.5, pre: 'T.scanToggle(true);', post: 'T.scanToggle(false);' },
  { name: '33-pc-panel', x: 16, z: 10.5, yaw: Math.PI, pitch: 0, time: 9.5, pre: 'T.openPanel("pc","shop");', post: 'T.closePanel();' },
  { name: '34-menu', x: -13.5, z: 0, yaw: -Math.PI / 2, pitch: 0, time: 9.5, pre: 'document.getElementById("dc-mainmenu").hidden=false;', post: 'document.getElementById("dc-mainmenu").hidden=true;' }
];

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 720, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true } });
  win.webContents.setFrameRate(30);
  const errors = [];
  win.webContents.on('console-message', (e, level, msg) => { if (level >= 2 && !/Electron Security Warning/.test(msg)) errors.push(msg); });
  await win.loadFile(path.join(__dirname, '..', 'game', 'index.html'));
  await new Promise((r) => setTimeout(r, 1500));
  await win.webContents.executeJavaScript('document.getElementById("dc-splash").hidden = true; document.getElementById("dc-mainmenu").hidden = true; window.DEPOT.enter(); window.T = window.DEPOT.T; window.S = window.DEPOT.T.S; S.intro.off = true; document.exitPointerLock && document.exitPointerLock(); "ok"', true);
  for (const s of SHOTS) {
    if (only && !s.name.toLowerCase().includes(only)) continue;
    try {
      await win.webContents.executeJavaScript('(function(){ ' + (s.pre || '') + ' T.setTime(' + s.time + '); T.player.x=' + s.x + '; T.player.z=' + s.z + '; T.player.y=T.floorY(' + s.x + ',' + s.z + '); T.player.yaw=' + s.yaw + '; T.player.pitch=' + (s.pitch || 0) + '; T.player.vy=0; return "ok"; })()', true);
      await new Promise((r) => setTimeout(r, 700));
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(outDir, s.name + '.png'), img.toPNG());
      if (s.post) await win.webContents.executeJavaScript('(function(){ ' + s.post + ' return "ok"; })()', true);
      console.log('shot ' + s.name);
    } catch (e) { console.log('shot ' + s.name + ' FAILED: ' + (e && e.message || e)); }
  }
  if (errors.length) console.log('page errors:\n  ' + errors.join('\n  '));
  app.exit(0);
});
