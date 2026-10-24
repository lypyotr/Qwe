import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export async function testServer(transform = (_file, body) => body) {
  const root = process.cwd();
  const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml' };
  const server = http.createServer((req,res) => {
    const relative = new URL(req.url,'http://localhost').pathname.replace(/^\/Qwe\//,'') || 'index.html';
    const file = path.resolve(root,relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try {
      const body = transform(relative,fs.readFileSync(file,'utf8'));
      res.writeHead(200,{'content-type':mime[path.extname(file)] || 'application/octet-stream','cache-control':'no-store'});
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}/Qwe/`,close:() => new Promise(resolve => server.close(resolve))};
}

export async function blockExternal(context) {
  await context.route('**/*',route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
}
