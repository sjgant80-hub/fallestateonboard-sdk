// scripts/parity.mjs · every block of src/onboard.js, minus the word `export`, must appear in the live
// FallEstateOnboard page byte for byte. Default: the published page on GitHub; or pass a local path. Exits 1 on drift.
import { readFileSync } from 'node:fs';
const page = (process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : await (await fetch('https://raw.githubusercontent.com/sjgant80-hub/fallestateonboard/master/index.html')).text()).replace(/\r\n/g, '\n');
const mod = readFileSync(new URL('../src/onboard.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const blocks = mod.split('\n\n').filter((b) => b.startsWith('export ')).map((b) => b.slice('export '.length).trimEnd());
const drift = blocks.filter((b) => !page.includes(b)).map((b) => b.split('\n')[0].slice(0, 70));
if (!blocks.length) { console.error('PARITY: no blocks found in src/onboard.js'); process.exit(1); }
if (drift.length) { console.error('PARITY FAILED: the live page no longer carries:\n  ' + drift.join('\n  ')); process.exit(1); }
console.log('parity: all ' + blocks.length + ' blocks of src/onboard.js are the live page\'s own code, byte for byte');
