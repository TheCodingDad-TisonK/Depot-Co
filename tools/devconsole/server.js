// The dev console's server: a small Node http server on 127.0.0.1 that the game links to (src/14-devlink.js) and the console
// window reads from. No dependencies. Two sides talk to it:
//   the game    GET  /events   a server-sent event stream; every command the console sends arrives here as one JSON event
//               POST /state    the readout of the save, once a second while linked
//               POST /result   what a command did, by id
//   the console GET  /         the console page (index.html beside this file)
//               GET  /state    the last readout the game posted, with how long ago
//               GET  /ui       a server-sent event stream of readouts and results, so the page never polls
//               POST /cmd      { name, arg }: queued to every linked game, answered with the command id
// Every route answers CORS headers, because the game page is file:// or http://localhost and the console page is the server's own.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

function createServer(opts) {
  opts = opts || {};
  const port = opts.port || 8432, host = opts.host || '127.0.0.1';
  const games = new Set(), uis = new Set();
  let state = null, stateAt = 0, seq = 0;
  const results = [], log = [];
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' };
  function json(res, code, body) { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, CORS)); res.end(JSON.stringify(body)); }
  function sse(res, set) { res.writeHead(200, Object.assign({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }, CORS)); res.write(': hello\n\n'); set.add(res); res.on('close', () => { set.delete(res); }); }
  function push(set, event, data) { const text = (event ? 'event: ' + event + '\n' : '') + 'data: ' + JSON.stringify(data) + '\n\n'; for (const r of set) { try { r.write(text); } catch (e) { set.delete(r); } } }
  function body(req, cb) { let s = ''; req.on('data', (c) => { s += c; if (s.length > 1e6) req.destroy(); }); req.on('end', () => { try { cb(null, s ? JSON.parse(s) : {}); } catch (e) { cb(e); } }); }
  function note(kind, text) { const row = { t: Date.now(), kind, text }; log.push(row); if (log.length > 200) log.shift(); push(uis, 'log', row); }
  // a command to every linked game: the console's POST /cmd, or send() from the host program
  function send(name, arg) { const cmd = { id: ++seq, name: String(name), arg: arg === undefined ? null : arg, at: Date.now() }; push(games, null, cmd); note('cmd', name + (arg !== undefined && arg !== null ? ' ' + arg : '') + (games.size ? '' : ' (no game linked)')); return cmd; }
  const page = path.join(__dirname, 'index.html');
  const server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
    if (req.method === 'GET' && url === '/events') { sse(res, games); note('link', 'a game linked'); push(uis, 'games', { n: games.size }); res.on('close', () => { note('link', 'a game unlinked'); push(uis, 'games', { n: games.size }); }); return; }
    if (req.method === 'GET' && url === '/ui') { sse(res, uis); if (state) push(uis, 'state', { state, age: Date.now() - stateAt }); push(uis, 'games', { n: games.size }); return; }
    if (req.method === 'GET' && url === '/state') { json(res, 200, { state, age: state ? Date.now() - stateAt : null, games: games.size, results: results.slice(-20), log: log.slice(-50) }); return; }
    if (req.method === 'POST' && url === '/state') { body(req, (err, b) => { if (err) { json(res, 400, { error: 'bad json' }); return; } state = b; stateAt = Date.now(); push(uis, 'state', { state, age: 0 }); json(res, 200, { ok: true }); }); return; }
    if (req.method === 'POST' && url === '/result') { body(req, (err, b) => { if (err) { json(res, 400, { error: 'bad json' }); return; } results.push(b); if (results.length > 100) results.shift(); note('result', (b.name || '?') + ': ' + (b.result || '')); push(uis, 'result', b); json(res, 200, { ok: true }); }); return; }
    if (req.method === 'POST' && url === '/cmd') { body(req, (err, b) => { if (err || !b || !b.name) { json(res, 400, { error: 'a command needs a name' }); return; } const cmd = send(b.name, b.arg); json(res, 200, { ok: true, id: cmd.id, games: games.size }); }); return; }
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) { fs.readFile(page, (err, data) => { if (err) { res.writeHead(500); res.end('index.html missing'); return; } res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(data); }); return; }
    res.writeHead(404, CORS); res.end('not found');
  });
  return { server, port, host, send, games, uis, get state() { return state; }, get stateAt() { return stateAt; }, results, log,
    listen(cb) { server.listen(port, host, () => { if (cb) cb(null, port); }); server.on('error', (e) => { if (cb) cb(e); }); return server; },
    close(cb) { for (const r of games) { try { r.end(); } catch (e) {} } for (const r of uis) { try { r.end(); } catch (e) {} } games.clear(); uis.clear(); server.close(cb); } };
}

module.exports = { createServer };
if (require.main === module) { const s = createServer({ port: +(process.argv[2] || 8432) }); s.listen((err, port) => { if (err) { console.error('devconsole: ' + err.message); process.exit(1); } console.log('devconsole: http://127.0.0.1:' + port + ' (the game links with Ctrl+Shift+D)'); }); }
