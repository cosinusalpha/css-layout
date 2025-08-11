#!/usr/bin/env node
import http from 'http';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, join, resolve } from 'path';

const root = resolve(process.cwd());
const pubDir = join(root, 'public');
const port = process.env.PORT || 5173;

function mapPath(urlPath) {
  if (urlPath === '/' || urlPath === '/index.html') {
    return join(pubDir, 'index.html');
  }
  let candidate = join(root, urlPath.replace(/^\//,''));
  if (existsSync(candidate)) return candidate;
  candidate = join(pubDir, urlPath.replace(/^\//,''));
  if (existsSync(candidate)) return candidate;
  return null;
}

const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json' };

http.createServer(async (req,res) => {
  try {
    const path = mapPath(req.url.split('?')[0]);
    if (!path) { res.statusCode = 404; res.end('Not found'); return; }
    const data = await readFile(path);
    const type = mime[extname(path)] || 'text/plain';
    res.setHeader('Content-Type', type);
    res.end(data);
  } catch (e) {
    res.statusCode = 500; res.end('Server error');
  }
}).listen(port, () => console.log(`Dev server running http://127.0.0.1:${port}`));
