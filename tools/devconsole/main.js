// The dev console: a small Electron window of its own (npm run devconsole). It starts the server in server.js and shows the
// console page from it. The game is a separate program; it links to this one with Ctrl+Shift+D, or when started with
// --dev-link (npm run dev). Nothing in the shipped game depends on this folder.
'use strict';
const { app, BrowserWindow, Menu } = require('electron');
const { createServer } = require('./server');
const path = require('path');

const PORT = +(process.env.DEPOT_DEV_PORT || 8432);
// A name and a user-data folder of its own, set before the single-instance lock: the lock is keyed by that folder, and run from the
// repo this file shares the game's package.json (product name Depot Co), so without this the console and the game would hold one
// lock between them and whichever started second would quit at once.
app.setName('Depot Co Dev Console'); app.setPath('userData', path.join(app.getPath('appData'), 'Depot Co Dev Console'));
let win = null, srv = null;

function open() {
  win = new BrowserWindow({ width: 1040, height: 760, minWidth: 820, minHeight: 520, backgroundColor: '#0b0f14', title: 'Depot Co. dev console', autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  Menu.setApplicationMenu(null);
  win.loadURL('http://127.0.0.1:' + PORT + '/');
  win.webContents.on('before-input-event', (event, input) => { if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') { win.webContents.toggleDevTools(); event.preventDefault(); } });
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    srv = createServer({ port: PORT });
    srv.listen((err) => {
      if (err) { console.error('devconsole: the port ' + PORT + ' is taken (' + err.message + '). Set DEPOT_DEV_PORT to another one.'); app.quit(); return; }
      console.log('devconsole: listening on http://127.0.0.1:' + PORT);
      open();
    });
  });
  app.on('window-all-closed', () => { if (srv) srv.close(); app.quit(); });
}
