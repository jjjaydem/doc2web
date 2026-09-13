/* Local production preview only. Render serves dist as a Static Site. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(path.join(root, 'index.html'))) throw Error('Run npm run build before starting the preview.');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
http.createServer((request, response) => {
  let file;
  try {
    const url = new URL(request.url, 'http://localhost');
    file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep) || !fs.statSync(file).isFile()) throw Error('Not found');
  } catch { response.writeHead(404); response.end('Not found'); return; }
  response.writeHead(200, {
    'Content-Type': types[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
  fs.createReadStream(file).pipe(response);
}).listen(Number(process.env.PORT || 8000), '127.0.0.1', () => console.log(`CMS Studio preview: http://127.0.0.1:${process.env.PORT || 8000}`));
