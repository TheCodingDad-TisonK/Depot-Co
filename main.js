// The Electron shell for Depot Co.: one window, no browser chrome, the game loaded from ./game. The shell is Co Engine's
// (node_modules/co-engine/shell/main.js); everything it needs is in co.json beside this file. The game itself is plain
// HTML + JavaScript and also runs from any static web server.
require('co-engine/shell/main.js')(__dirname);
