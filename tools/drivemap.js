// Drive map: `node tools/drivemap.js` (via electron). Boots the game with every upgrade and all six rack rows, then
// samples the hall on a one metre grid and prints where the forklift (collision radius 1.0 m) can stand.
// '#' blocked, '.' clear, 'R' a rack row, 'W' outside the hall. Rows are z from north (-) to south (+), columns are x.
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'depotco-map-')));
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

const SCENARIO = `(async () => {
  const T = window.DEPOT.T, S = T.S; window.DEPOT.enter();
  S.up.rows = 6; S.up.fork = true; S.up.cart = true; S.up.shipbelt = true; S.up.agv = true; S.up.gantry = true; S.up.dock2 = true;
  for (let r = 0; r < 6; r++) T.buildProp('rack' + r); T.buildProp('shipBelt'); T.buildProp('dockLoader2'); T.buildProp('agvDock'); T.buildGantries(); T.run(0.5);
  const R = 1.0, lines = [], solids = T.solids.filter((s) => s.y0 < 1.6);
  const blocked = (x, z) => { for (const s of solids) if (x > s.x0 - R && x < s.x1 + R && z > s.z0 - R && z < s.z1 + R) return s; return null; };
  const rowsZ = T.RACK.rows;
  let header = '      '; for (let x = -35; x <= 35; x++) header += (x % 10 === 0 ? String(Math.abs(x) / 10) : (x % 5 === 0 ? '+' : ' ')); lines.push(header);
  for (let z = -23; z <= 23; z++) {
    let row = String(z).padStart(4) + ' |';
    for (let x = -35; x <= 35; x++) {
      const inRack = rowsZ.some((rz) => Math.abs(z - rz) < 0.9) && x >= -24 && x <= 21;
      const b = blocked(x, z); row += inRack ? 'R' : b ? (b.prop ? b.prop[0] : '#') : '.';
    }
    lines.push(row);
  }
  // name the blockers in each corner strip, so the map can be read
  const corners = { NW: [-29, -20, -23, -19], NE: [20, 29, -23, -19], SW: [-29, -20, 19, 23], SE: [20, 29, 19, 23], W: [-29, -25, -18, 18], E: [22, 29, -18, 18] };
  const who = {}; for (const k in corners) { const c = corners[k], names = {}; for (let x = c[0]; x <= c[1]; x++) for (let z = c[2]; z <= c[3]; z++) { const b = blocked(x, z); if (b) names[b.prop || ('solid ' + [b.x0, b.x1, b.z0, b.z1].map((v) => +v.toFixed(1)).join(','))] = (names[b.prop || 'x'] || 0) + 1; } who[k] = Object.keys(names).slice(0, 12); }
  return { lines, who };
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 720, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: true } });
  await win.loadFile(path.join(__dirname, '..', 'game', 'index.html'));
  await new Promise((r) => setTimeout(r, 1500));
  let result;
  try { result = await win.webContents.executeJavaScript(SCENARIO, true); } catch (e) { result = { lines: ['threw: ' + (e && e.message || e)], who: {} }; }
  result.lines.forEach((l) => console.log(l));
  for (const k in result.who) console.log(k + ': ' + result.who[k].join(' | '));
  app.exit(0);
});
