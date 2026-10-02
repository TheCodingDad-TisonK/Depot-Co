// Builds game/depot.js from the parts in src/.
//
// The game ships as ONE file inside ONE closure, so any static host can serve game/ as it is. The parts
// exist so the code can be read and changed a system at a time. Never edit game/depot.js by hand: edit
// src/ and run `npm run build`.
//
//   src/NN-name.js   joined in file-name order
//   //@ ...          at column 0: a note for the reader, left out of the build
//
// Usage:  node tools/build-game.js            build
//         node tools/build-game.js --check    exit 1 if game/depot.js differs from what src/ builds
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'game', 'depot.js');

function parts() { return fs.readdirSync(SRC).filter((n) => /^\d\d-.*\.js$/.test(n)).sort(); }

function build() {
  const problems = [];
  const names = parts();
  const text = names.map((n) => fs.readFileSync(path.join(SRC, n), 'utf8')).join('');
  const js = text.split('\n').filter((line) => !/^\/\/@/.test(line)).join('\n');
  // one closure means a second `function foo(` silently replaces the first: refuse to build that
  const seen = {};
  (js.match(/^  function [A-Za-z0-9_$]+\(/gm) || []).forEach((d) => { const n = d.slice(11, -1); seen[n] = (seen[n] || 0) + 1; });
  Object.keys(seen).filter((n) => seen[n] > 1).forEach((n) => problems.push('function ' + n + ' is declared ' + seen[n] + ' times at the top level'));
  return { js, names, problems };
}

function main() {
  const check = process.argv.includes('--check');
  const r = build();
  if (r.problems.length) { console.error('build-game: ' + r.problems.join('\n  ')); process.exit(1); }
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
  if (check) {
    if (cur !== r.js) { console.error('build-game: game/depot.js is not what src/ builds. Edit src/, then run npm run build.'); process.exit(1); }
    console.log('build-game: game/depot.js matches src/ (' + r.names.length + ' parts)');
  } else if (cur !== r.js) { fs.writeFileSync(OUT, r.js); console.log('build-game: wrote game/depot.js (' + r.names.length + ' parts, ' + r.js.split('\n').length + ' lines)'); }
  else console.log('build-game: game/depot.js already up to date');
}

if (require.main === module) main();
module.exports = { build, parts };
