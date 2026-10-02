// Renders game/logo-256.png, game/logo.png and game/wordmark.png with a hidden Electron window:  electron tools/render-brand.js
// Everything is drawn on a canvas, so the brand needs no source image.
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const DRAW = `(() => {
  function logo(size) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), s = size / 256;
    x.scale(s, s);
    // rounded slate tile
    x.fillStyle = '#1b232c'; roundRect(x, 8, 8, 240, 240, 48); x.fill();
    x.strokeStyle = '#f5b53d'; x.lineWidth = 6; roundRect(x, 8, 8, 240, 240, 48); x.stroke();
    // an isometric cardboard box, amber, with a label
    const cx = 128, cy = 140;
    x.fillStyle = '#f5b53d'; x.beginPath(); x.moveTo(cx, cy - 72); x.lineTo(cx + 70, cy - 36); x.lineTo(cx, cy); x.lineTo(cx - 70, cy - 36); x.closePath(); x.fill();
    x.fillStyle = '#c8891f'; x.beginPath(); x.moveTo(cx - 70, cy - 36); x.lineTo(cx, cy); x.lineTo(cx, cy + 76); x.lineTo(cx - 70, cy + 40); x.closePath(); x.fill();
    x.fillStyle = '#e0a02a'; x.beginPath(); x.moveTo(cx + 70, cy - 36); x.lineTo(cx, cy); x.lineTo(cx, cy + 76); x.lineTo(cx + 70, cy + 40); x.closePath(); x.fill();
    x.strokeStyle = '#1b232c'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, cy + 76); x.moveTo(cx, cy); x.lineTo(cx - 70, cy - 36); x.moveTo(cx, cy); x.lineTo(cx + 70, cy - 36); x.stroke();
    // tape along the top seam, and a white label on the right face
    x.strokeStyle = 'rgba(27,35,44,0.35)'; x.lineWidth = 8; x.beginPath(); x.moveTo(cx - 35, cy - 54); x.lineTo(cx + 35, cy - 18); x.stroke();
    x.fillStyle = '#f3f4f6'; x.beginPath(); x.moveTo(cx + 18, cy + 8); x.lineTo(cx + 54, cy - 10); x.lineTo(cx + 54, cy + 22); x.lineTo(cx + 18, cy + 40); x.closePath(); x.fill();
    x.fillStyle = '#1b232c'; for (let i = 0; i < 7; i++) { x.fillRect(cx + 23 + i * 4.3, cy + 14 - i * 2.2, i % 3 ? 1.6 : 2.6, 14); }
    return c.toDataURL('image/png');
  }
  function wordmark() {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 320; const x = c.getContext('2d');
    x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.font = 'bold 190px Bahnschrift, "Segoe UI", Arial, sans-serif';
    x.shadowColor = 'rgba(245,181,61,0.35)'; x.shadowBlur = 40;
    x.fillStyle = '#f3f4f6'; x.fillText('DEPOT', 40, 220);
    const w = x.measureText('DEPOT ').width;
    x.fillStyle = '#f5b53d'; x.fillText('CO.', 40 + w, 220);
    x.shadowBlur = 0; x.font = '600 40px Bahnschrift, "Segoe UI", Arial, sans-serif'; x.fillStyle = '#a0acb8';
    x.fillText('FIRST-PERSON WAREHOUSE SIMULATOR', 46, 285);
    return c.toDataURL('image/png');
  }
  function roundRect(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
  return { logo256: logo(256), logo1024: logo(1024), wordmark: wordmark() };
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } });
  await win.loadURL('data:text/html,<html><body></body></html>');
  const r = await win.webContents.executeJavaScript(DRAW, true);
  const out = path.join(__dirname, '..', 'game');
  const write = (name, dataUrl) => { fs.writeFileSync(path.join(out, name), Buffer.from(dataUrl.split(',')[1], 'base64')); console.log('wrote game/' + name); };
  write('logo-256.png', r.logo256); write('logo.png', r.logo1024); write('wordmark.png', r.wordmark);
  app.exit(0);
});
