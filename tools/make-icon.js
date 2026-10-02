// Writes build/icon.ico from game/logo.png for the installer:  npm run icon   (needs png-to-ico from npm install)
var fs = require('fs'), path = require('path');
var pngToIco = require('png-to-ico');
var src = path.join(__dirname, '..', 'game', 'logo.png'), out = path.join(__dirname, '..', 'build');
fs.mkdirSync(out, { recursive: true });
pngToIco(src).then(function (buf) { fs.writeFileSync(path.join(out, 'icon.ico'), buf); console.log('build/icon.ico written'); }).catch(function (e) { console.error(e); process.exit(1); });
