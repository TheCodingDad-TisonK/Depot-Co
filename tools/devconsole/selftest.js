// The dev console's self test: `node tools/devconsole/selftest.js` (also run by npm test). Starts the server on a spare port,
// plays both sides against it (a fake game on the event stream, the console posting a command) and checks the round trip:
// the command reaches the game, the game's readout and result come back, the page is served. No Electron, no game.
'use strict';
const http = require('http');
const { createServer } = require('./server');

const PORT = 8439;
const out = [], errs = [];
const ok = (cond, msg) => { out.push((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) errs.push(msg); };
function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path, headers: body ? { 'Content-Type': 'application/json' } : {} }, (res) => { let s = ''; res.on('data', (c) => { s += c; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: s })); });
    r.on('error', reject); if (body) r.write(JSON.stringify(body)); r.end();
  });
}
function waitFor(fn, ms) { return new Promise((resolve, reject) => { const t0 = Date.now(); (function tick() { if (fn()) resolve(); else if (Date.now() - t0 > ms) reject(new Error('timed out')); else setTimeout(tick, 20); })(); }); }

(async () => {
  const srv = createServer({ port: PORT });
  await new Promise((resolve, reject) => srv.listen((e) => (e ? reject(e) : resolve())));
  try {
    const page = await req('GET', '/');
    ok(page.status === 200 && /DEV CONSOLE/.test(page.body), 'the console page is served');
    const pre = await req('OPTIONS', '/cmd');
    ok(pre.status === 204 && pre.headers['access-control-allow-origin'] === '*', 'CORS preflight answers for the game page');
    // a fake game on the event stream
    const events = [];
    const es = http.request({ host: '127.0.0.1', port: PORT, method: 'GET', path: '/events' }, (res) => { ok(res.statusCode === 200 && /text\/event-stream/.test(res.headers['content-type']), 'the game gets an event stream'); res.on('data', (c) => { String(c).split('\n').forEach((line) => { if (line.indexOf('data: ') === 0) { try { events.push(JSON.parse(line.slice(6))); } catch (e) {} } }); }); });
    es.end();
    await waitFor(() => srv.games.size === 1, 2000); ok(srv.games.size === 1, 'the server counts one linked game');
    // the game posts a readout
    const st = await req('POST', '/state', { version: 'test', day: 3, level: 7, bank: 1234, site: 1, siteDue: 2 });
    ok(st.status === 200, 'the game posts its readout');
    const got = await req('GET', '/state'); const gs = JSON.parse(got.body);
    ok(gs.state && gs.state.level === 7 && gs.state.bank === 1234 && gs.games === 1 && typeof gs.age === 'number', 'the console reads the readout back with its age: ' + JSON.stringify({ level: gs.state && gs.state.level, games: gs.games }));
    // the console sends a command; the game receives it over the stream
    const cmd = await req('POST', '/cmd', { name: 'setLevel', arg: 12 }); const cj = JSON.parse(cmd.body);
    ok(cmd.status === 200 && cj.ok && cj.id > 0 && cj.games === 1, 'the console posts a command and gets its id');
    await waitFor(() => events.length >= 1, 2000);
    ok(events.length === 1 && events[0].name === 'setLevel' && events[0].arg === 12 && events[0].id === cj.id, 'the game received the command over the stream: ' + JSON.stringify(events[0]));
    const bad = await req('POST', '/cmd', { arg: 1 }); ok(bad.status === 400, 'a command without a name is refused');
    // the game answers
    const rr = await req('POST', '/result', { id: cj.id, name: 'setLevel', result: 'level 12' });
    ok(rr.status === 200 && srv.results.length === 1 && srv.results[0].result === 'level 12', 'the result is kept');
    const direct = srv.send('day'); await waitFor(() => events.length >= 2, 2000);
    ok(events[1] && events[1].name === 'day' && events[1].id === direct.id, 'send() from the host reaches the game too');
    const nf = await req('GET', '/nothing'); ok(nf.status === 404, 'an unknown path is 404');
    es.destroy(); await waitFor(() => srv.games.size === 0, 2000); ok(srv.games.size === 0, 'an unlinked game is dropped from the count');
  } catch (e) { ok(false, 'exception: ' + (e && e.stack || e)); }
  await new Promise((resolve) => srv.close(() => resolve()));
  out.forEach((l) => console.log(l));
  console.log('devconsole selftest: ' + (out.length - errs.length) + ' of ' + out.length + ' checks passed');
  process.exit(errs.length ? 1 : 0);
})();
