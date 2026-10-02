// A small lint gate for game/*.js, run by `npm run check` before the syntax checks. No dependencies, no network.
// It fails the check (exit code 1) and prints file:line for each of these:
//   control   a control character other than tab or newline (a CR is allowed only as part of a CRLF line end).
//             A raw NUL once made grep treat depot.js as a binary file.
//   comment   a // comment holding a literal backslash-n. Someone meant a line break, but a line comment runs to the
//             real end of the line, so every statement after it on that line silently stops running.
//   dash      an em dash or an en dash inside a string literal. Player-facing text uses plain punctuation.
// Strings, comments, template literals and regular expression literals are told apart with a small scanner, so a
// dash in a comment or a quote inside a regex does not count.
var fs = require('fs'), path = require('path');

var ROOT = path.join(__dirname, '..');
var DIR = path.join(ROOT, 'game');
var KEYWORDS_BEFORE_REGEX = { 'return': 1, 'typeof': 1, 'instanceof': 1, 'in': 1, 'of': 1, 'new': 1, 'delete': 1, 'void': 1, 'throw': 1, 'case': 1, 'do': 1, 'else': 1, 'yield': 1, 'await': 1 };

function isIdentChar(c) { return /[A-Za-z0-9_$]/.test(c) || c > '\u007f'; }

function scan(file, text, out) {
  var rel = path.relative(ROOT, file).split(path.sep).join('/');
  var seen = {};
  function report(rule, line, msg) { var key = rule + ':' + line; if (seen[key]) return; seen[key] = true; out.push({ file: rel, line: line, rule: rule, msg: msg }); }

  // control characters, on the raw text
  var line = 1, i, c, code;
  for (i = 0; i < text.length; i++) {
    code = text.charCodeAt(i);
    if (code === 10) { line++; continue; }
    if (code === 9) continue;
    if (code === 13 && text.charCodeAt(i + 1) === 10) continue;
    if (code < 32 || code === 127) report('control', line, 'control character U+' + ('000' + code.toString(16).toUpperCase()).slice(-4));
  }

  // strings, comments and regex literals
  var n = text.length, state = 'code', quote = '', stack = [], last = '', lastWord = '';
  line = 1; i = 0;
  while (i < n) {
    c = text[i];
    if (c === '\n') line++;
    if (state === 'code') {
      if (c === '/' && text[i + 1] === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && text[i + 1] === '*') { state = 'block'; i += 2; continue; }
      if (c === '\'' || c === '"') { state = 'string'; quote = c; i++; continue; }
      if (c === '`') { state = 'template'; i++; continue; }
      if (c === '/') {
        var regex = last === '' || (last === 'word' ? !!KEYWORDS_BEFORE_REGEX[lastWord] : last !== 'num' && last !== 'str' && last !== ')' && last !== ']');   // after a value it divides, anywhere else it starts a regex
        if (regex) { state = 'regex'; i++; continue; }
        last = '/'; i++; continue;
      }
      if (c === '{') { if (stack.length) stack[stack.length - 1]++; last = '{'; i++; continue; }
      if (c === '}') {
        if (stack.length && stack[stack.length - 1] === 0) { stack.pop(); state = 'template'; i++; continue; }   // the end of a ${ } inside a template
        if (stack.length) stack[stack.length - 1]--;
        last = '}'; i++; continue;
      }
      if (/\s/.test(c)) { i++; continue; }
      if (isIdentChar(c)) {
        var j = i; while (j < n && isIdentChar(text[j])) j++;
        var word = text.slice(i, j); last = /^[0-9]/.test(word) ? 'num' : 'word'; lastWord = word; i = j; continue;
      }
      last = c; i++; continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; i++; continue; }
      if (c === '\\' && text[i + 1] === 'n') report('comment', line, 'a // comment holds a literal \\n: the rest of this line is part of the comment and never runs');
      i++; continue;
    }
    if (state === 'block') {
      if (c === '*' && text[i + 1] === '/') { state = 'code'; i += 2; continue; }
      i++; continue;
    }
    if (state === 'string' || state === 'template') {
      if (c === '\\') { if (text[i + 1] === '\n') line++; i += 2; continue; }
      if (c === '\u2014' || c === '\u2013') report('dash', line, (c === '\u2014' ? 'em' : 'en') + ' dash in a string literal');
      if (state === 'string' && c === quote) { state = 'code'; last = 'str'; i++; continue; }
      if (state === 'string' && c === '\n') { state = 'code'; i++; continue; }   // an unterminated string: stop at the line end rather than swallow the file
      if (state === 'template' && c === '`') { state = 'code'; last = 'str'; i++; continue; }
      if (state === 'template' && c === '$' && text[i + 1] === '{') { stack.push(0); state = 'code'; last = ''; i += 2; continue; }
      i++; continue;
    }
    if (state === 'regex') {
      if (c === '\\') { i += 2; continue; }
      if (c === '[') { state = 'regexClass'; i++; continue; }
      if (c === '/') { state = 'code'; last = 'str'; i++; while (i < n && /[a-z]/i.test(text[i])) i++; continue; }
      if (c === '\n') { state = 'code'; i++; continue; }   // not a regex after all: never carry the mistake past the line
      i++; continue;
    }
    if (state === 'regexClass') {
      if (c === '\\') { i += 2; continue; }
      if (c === ']') { state = 'regex'; i++; continue; }
      if (c === '\n') { state = 'code'; i++; continue; }
      i++; continue;
    }
  }
  if (state === 'block' || state === 'template') out.push({ file: rel, line: line, rule: 'scan', msg: 'the file ends inside a ' + (state === 'block' ? 'block comment' : 'template literal') });
}

var files = fs.readdirSync(DIR).filter(function (f) { return /\.js$/.test(f); }).sort().map(function (f) { return path.join(DIR, f); });
var found = [];
files.forEach(function (f) { scan(f, fs.readFileSync(f, 'utf8'), found); });

if (!found.length) { console.log('lint-gate: ' + files.length + ' files in game/ are clean'); process.exit(0); }
var counts = {};
found.sort(function (a, b) { return a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line; });
found.forEach(function (f) { counts[f.rule] = (counts[f.rule] || 0) + 1; console.log(f.file + ':' + f.line + ': [' + f.rule + '] ' + f.msg); });
console.log('lint-gate: failed, ' + Object.keys(counts).map(function (k) { return counts[k] + ' ' + k; }).join(', '));
process.exit(1);
