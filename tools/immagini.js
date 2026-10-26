#!/usr/bin/env node
/* Genera con Chromium le immagini dell'app installata, tutte dalla stessa figura:

  node tools/immagini.js

  img/icona-192.png, img/icona-512.png   icone di manifest.webmanifest
  img/avvio/<larghezza>x<altezza>.png     immagini di avvio di iOS (apple-touch-startup-image)

Le immagini di avvio riproducono la schermata di caricamento di index.html (fondo --color-bg,
figura di 120 punti al centro), così il passaggio avvio → caricamento → scheda non salta.
Stampa i tag <link> da mettere nella <head> esterna di index.html e in quella del template.
*/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BG = '#161826';
const SIZE = 120;  // lato della figura nella schermata di caricamento, in punti
const FIG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${BG}"></rect><circle cx="50" cy="30" r="8" fill="none" stroke="#e4e7f5" stroke-width="4"></circle><path d="M50 38V62M50 46L36 56M50 46L64 56M50 62L40 78M50 62L60 78" stroke="#e4e7f5" stroke-width="4" stroke-linecap="round" fill="none"></path><path d="M64 56L84 22" stroke="#9184d9" stroke-width="3" stroke-linecap="round"></path><circle cx="84" cy="22" r="4" fill="#9184d9"></circle></svg>`;

// iPhone in verticale: punti (larghezza × altezza) e densità.
const DEVICES = [
  [320, 568, 2],  // SE 1ª generazione
  [375, 667, 2],  // 6, 7, 8, SE 2ª e 3ª generazione
  [414, 736, 3],  // 6 Plus, 7 Plus, 8 Plus
  [375, 812, 3],  // X, XS, 11 Pro, 12 mini, 13 mini
  [414, 896, 2],  // XR, 11
  [414, 896, 3],  // XS Max, 11 Pro Max
  [390, 844, 3],  // 12, 12 Pro, 13, 13 Pro, 14, 16e
  [428, 926, 3],  // 12 Pro Max, 13 Pro Max, 14 Plus
  [393, 852, 3],  // 14 Pro, 15, 15 Pro, 16
  [430, 932, 3],  // 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [402, 874, 3],  // 16 Pro, 17, 17 Pro
  [420, 912, 3],  // Air
  [440, 956, 3],  // 16 Pro Max, 17 Pro Max
];

const startupFile = ([w, h, r]) => `img/avvio/${w * r}x${h * r}.png`;
const startupTag = d => `<link rel="apple-touch-startup-image" media="screen and (device-width: ${d[0]}px) and (device-height: ${d[1]}px) and (-webkit-device-pixel-ratio: ${d[2]}) and (orientation: portrait)" href="${startupFile(d)}">`;

async function shot(browser, w, h, r, html, file) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: r });
  const pg = await ctx.newPage();
  await pg.setContent(`<!doctype html><style>*{margin:0}html,body{width:100%;height:100%;background:${BG}}
    body{display:flex;align-items:center;justify-content:center}svg{display:block}</style>${html}`);
  fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
  await pg.screenshot({ path: path.join(ROOT, file) });
  await ctx.close();
  console.error('scritta', file);
}

async function main() {
  const browser = await chromium.launch();
  for (const n of [192, 512]) await shot(browser, n, n, 1, FIG.replace('<svg ', `<svg width="${n}" height="${n}" `), `img/icona-${n}.png`);
  for (const d of DEVICES) await shot(browser, d[0], d[1], d[2], FIG.replace('<svg ', `<svg width="${SIZE}" height="${SIZE}" `), startupFile(d));
  await browser.close();
  console.log(DEVICES.map(startupTag).join('\n'));
}

if (require.main === module) main();
module.exports = { DEVICES, startupFile, startupTag, SIZE, BG };
