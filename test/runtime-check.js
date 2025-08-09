// Simple runtime check using JSDOM to load index.html and main.js
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import path from 'path';
import url from 'url';

const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(projectRoot, 'public', 'index.html');
let html = readFileSync(htmlPath, 'utf8');

// Adjust script src for JSDOM (it loads relative to the HTML file location)
// We'll inline the JS instead for simplicity.
const jsPath = path.join(projectRoot, 'src', 'main.js');
const jsCode = readFileSync(jsPath, 'utf8');
html = html.replace('<script src="../src/main.js"></script>', `<script>${jsCode}</script>`);

const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true });

const errors = [];
const originalError = console.error;
const originalWarn = console.warn;
console.error = (...args) => { errors.push({ type: 'error', args }); originalError(...args); };
console.warn = (...args) => { errors.push({ type: 'warn', args }); originalWarn(...args); };

function wait(ms){ return new Promise(r=>setTimeout(r, ms)); }

(async () => {
  // Give scripts time to execute
  await wait(50);
  const app = dom.window.document.getElementById('app');
  if(!app) {
    errors.push({ type: 'error', args: ['#app container not rendered'] });
  }
  if(errors.length){
    console.log('RUNTIME_CHECK_FAILED');
    console.log(JSON.stringify(errors, null, 2));
    process.exitCode = 1;
  } else {
    console.log('RUNTIME_CHECK_OK');
  }
})();
