// Sirf apne computer par (ya Render par) chalane ke liye. Vercel is file ko istemal nahi karta.
const http = require('http');
const fs = require('fs');
const path = require('path');
const api = require('./api/index.js');

const PUB = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };

http
  .createServer((req, res) => {
    const p = new URL(req.url, 'http://x').pathname;
    if (p === '/api' || p === '/api/') return api(req, res);
    let f = p === '/' ? '/index.html' : p === '/admin' ? '/admin.html' : p;
    f = path.normalize(path.join(PUB, f));
    if (!f.startsWith(PUB)) { res.statusCode = 403; return res.end(); }
    fs.readFile(f, (e, b) => {
      if (e) { res.statusCode = 404; return res.end('404'); }
      res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
      res.end(b);
    });
  })
  .listen(process.env.PORT || 3000, () => console.log('Chal raha hai: http://localhost:' + (process.env.PORT || 3000)));
