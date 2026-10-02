// Tiny static server for playing the game in a browser: node tools/serve.js [port]
var http = require('http'), fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..', 'game'), port = +process.argv[2] || 8430;
var types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon' };
http.createServer(function (req, res) {
  var rel = decodeURIComponent(req.url.split('?')[0]); if (rel === '/') rel = '/index.html';
  var file = path.normalize(path.join(root, rel)); if (file.indexOf(root) !== 0) { res.writeHead(403); return res.end(); }
  fs.readFile(file, function (err, data) { if (err) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data); });
}).listen(port, '127.0.0.1', function () { console.log('Depot Co. at http://127.0.0.1:' + port + '/'); });
