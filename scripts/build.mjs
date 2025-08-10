#!/usr/bin/env node
import { mkdirSync, rmSync, cpSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

function clean() {
  try { rmSync(dist, { recursive: true, force: true }); } catch(_) {}
}
function ensure() { mkdirSync(dist, { recursive: true }); }

function copyPublic() {
  const pub = resolve(root, 'public');
  cpSync(pub, dist, { recursive: true });
}
function copySource() {
  // Inline main.js into index.html for a single-file style deploy, while still keeping a separate file.
  const indexPath = resolve(dist, 'index.html');
  let html = readFileSync(indexPath, 'utf8');
  const srcPath = resolve(root, 'src', 'main.js');
  const js = readFileSync(srcPath, 'utf8');
  // Replace external script tag path with relative path inside dist
  html = html.replace('../src/main.js', 'main.js');
  writeFileSync(indexPath, html, 'utf8');
  cpSync(srcPath, resolve(dist, 'main.js'));
}

clean();
ensure();
copyPublic();
copySource();

console.log('Build complete: dist/');
