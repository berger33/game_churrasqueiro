#!/usr/bin/env node
/**
 * Android playtest export — turns the design-verification prototype into a
 * self-contained web app that runs with no server at all.
 *
 * `prototype/dev-server.mjs` serves `/data`, `/l10n`, `/audio` and `/assets/art`
 * from the repository at runtime. A phone that installs the game has no such
 * server, so this script copies exactly those trees next to the bundle and
 * writes an `index.html` that fits the whole screen, uses bundled fonts (no
 * Google Fonts request) and registers a service worker for offline reloads.
 *
 * The result is consumed by two delivery paths, and both share this one tree:
 *   - `android-shell/` (WebView APK, assets/ = this tree),
 *   - a plain static host (phone browser / "add to home screen"), see
 *     `tools/android/serve-export.mjs`.
 *
 * Every path the bundle asks for is checked against the exported tree; the
 * script exits non-zero listing what is missing rather than shipping an app
 * that silently loses its art or its audio.
 *
 * Usage: node tools/android/export-webapp.mjs [--no-minify] [--out <dir>]
 */
import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const argv = process.argv.slice(2);
const MINIFY = !argv.includes('--no-minify');
const outFlag = argv.indexOf('--out');
const OUT = outFlag >= 0 ? join(ROOT, argv[outFlag + 1]) : join(ROOT, 'build', 'android-webapp');

/** Fonts the prototype asks for, by family and weight (see `prototype/src/theme.ts`). */
const FONTS = [
  ['baloo-2', 'Baloo 2', [400, 600, 700, 800]],
  ['nunito', 'Nunito', [400, 600, 700, 800, 900]]
];

const MIME_HINT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2'
};

async function copyDir(from, to, filter = () => true) {
  if (!existsSync(from)) throw new Error(`missing source directory: ${from}`);
  await mkdir(to, { recursive: true });
  await cp(from, to, {
    recursive: true,
    filter: (src) => (src.startsWith(from) ? filter(src) : true)
  });
}

/** `.meta` files are Unity's; nothing else is welcome in an app bundle. */
const keepRuntime = (p) => !p.endsWith('.meta');

async function writeFonts() {
  const dir = join(OUT, 'fonts');
  await mkdir(dir, { recursive: true });
  const faces = [];
  let bytes = 0;
  for (const [slug, family, weights] of FONTS) {
    for (const weight of weights) {
      const src = join(ROOT, 'node_modules', `@fontsource/${slug}`, 'files', `${slug}-latin-${weight}-normal.woff2`);
      if (!existsSync(src)) {
        throw new Error(
          `missing ${src}\nRun \`npm ci\` (the font packages are devDependencies) before exporting.`
        );
      }
      const buf = await readFile(src);
      bytes += buf.length;
      const file = `${slug}-${weight}.woff2`;
      await writeFile(join(dir, file), buf);
      faces.push(
        `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
          `src:url('/fonts/${file}') format('woff2')}`
      );
    }
  }
  return { css: faces.join('\n'), bytes };
}

function indexHtml(fontCss) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<meta name="theme-color" content="#0A0705" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="description" content="CHURRASCO! O Mestre da Brasa — build de teste em aparelho real." />
<title>CHURRASCO! O Mestre da Brasa</title>
<style>
${fontCss}
:root {
  --carvao: #1C1512; --cinza: #3A2E28; --madeira: #7A4A2A;
  --creme: #F4E7D3; --offwhite: #FBF5EC; --brasa: #E0561F; --chama: #F2A63B;
}
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
html, body {
  height: 100%; background: #0A0705; color: var(--creme);
  font-family: "Nunito", "Segoe UI", system-ui, -apple-system, sans-serif;
  overscroll-behavior: none; touch-action: none; overflow: hidden;
  user-select: none; -webkit-user-select: none;
}
#app {
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  background: radial-gradient(ellipse at 50% 8%, #2A1A11 0%, #140D08 45%, #0A0705 100%);
}
#stage { position: relative; z-index: 1; }
canvas { display: block; }
#boot {
  position: fixed; inset: 0; z-index: 9; display: flex; flex-direction: column; gap: 14px;
  align-items: center; justify-content: center; background: #0A0705;
  transition: opacity .45s ease; font-weight: 700; letter-spacing: .04em;
}
#boot.hide { opacity: 0; pointer-events: none; }
#boot .flame { font-size: 44px; animation: pulse 1.1s ease-in-out infinite; }
#boot .label { font-size: 13px; color: rgba(244,231,211,.72); text-transform: uppercase; }
@keyframes pulse { 0%,100% { transform: scale(1); opacity: .85 } 50% { transform: scale(1.14); opacity: 1 } }
#fatal {
  position: fixed; inset: 0; z-index: 10; display: none; padding: 28px;
  flex-direction: column; gap: 12px; align-items: center; justify-content: center;
  background: #120b08; text-align: center; font-size: 14px; line-height: 1.5;
}
#fatal code { font-size: 11px; color: #F2A63B; word-break: break-word; max-width: 90vw; }
</style>
</head>
<body>
<div id="app"><div id="stage"><canvas id="c"></canvas></div></div>
<div id="boot"><div class="flame">🔥</div><div class="label">Acendendo a brasa…</div></div>
<div id="fatal">
  <div style="font-size:34px">🔥</div>
  <div><strong>Não deu para acender a brasa.</strong></div>
  <div>Feche o app e abra de novo. Se repetir, mande o texto abaixo.</div>
  <code id="fatal-why"></code>
</div>
<script>
  // Full-bleed playtest fit: let the 420x780 design box grow until it fills the
  // screen (the prototype caps it at 1.35x, which letterboxes a tablet and any
  // tall phone). Runs before the module so the game reads it in its first
  // resize(); the backing store stays at the prototype's dprcap default of 2,
  // so this changes the framing and not the fill rate. Append &dprcap=1.5 (or
  // lower) to trade sharpness for frames if a device drops them.
  var boot = document.getElementById('boot');
  try {
    var q = new URLSearchParams(location.search);
    if (!q.has('maxscale')) {
      q.set('maxscale', '9');
      history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash);
    }
  } catch (err) { /* file:// or exotic host: keep the prototype framing */ }
  window.addEventListener('error', function (e) {
    document.getElementById('fatal-why').textContent = String(e.message || e.error || e);
    document.getElementById('fatal').style.display = 'flex';
  });
  window.addEventListener('unhandledrejection', function (e) {
    document.getElementById('fatal-why').textContent = String((e.reason && e.reason.stack) || e.reason || e);
    document.getElementById('fatal').style.display = 'flex';
  });
  window.__churrascoBoot = function () { boot.classList.add('hide'); };
  // Offline reloads in a browser (the APK shell intercepts its own requests, and
  // a service worker there would only add a second cache to reason about).
  if ('serviceWorker' in navigator && location.hostname !== 'appassets.androidplatform.net' && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
</script>
<script type="module">
  // This overlay only covers module load + the first data parse; the game paints
  // its own splash (see main.ts) and exposes the live screen for harnesses, which
  // is the earliest honest "a frame exists" signal.
  import '/bundle.js';
  var waited = 0;
  var poll = setInterval(function () {
    waited += 60;
    if (window.__churrascoScreen || waited > 4000) {
      clearInterval(poll);
      boot.classList.add('hide');
    }
  }, 60);
</script>
</body>
</html>
`;
}

const SW_JS = `/* Offline shell for the phone-browser playtest. Cache-first: every file is
   versioned by the deploy, so a stale hit is cheaper than a network round trip. */
const CACHE = 'churrasco-playtest-v1';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const shell = await cache.match('/index.html');
        if (shell) return shell;
        throw err;
      }
    })
  );
});
`;

/**
 * Every quoted absolute path the bundle requests, so a missing tree fails the export.
 *
 * `/audio/` is the canonical prefix (`prototype/dev-server.mjs` serves it from
 * `Assets/Audio`); the `/public/audio/` variants are probe candidates in
 * `prototype/src/audio.ts` that the runtime skips when they 404, so they are
 * allowed to be absent here.
 */
const OPTIONAL = new Set(['/public/audio/manifest.json', '/prototype/public/audio/manifest.json']);
function requestedPaths(bundleSource) {
  const found = new Set();
  const re = /['"`](\/[A-Za-z0-9._@/-]+\.(?:json|wav|webp|png|woff2|js|css))['"`]/g;
  for (const m of bundleSource.matchAll(re)) if (!OPTIONAL.has(m[1])) found.add(m[1]);
  return [...found];
}

async function main() {
  const started = Date.now();
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // 1. the game code, one file, no dev-server imports.
  await build({
    entryPoints: [join(ROOT, 'prototype', 'src', 'main.ts')],
    bundle: true,
    format: 'esm',
    target: ['es2022'],
    outfile: join(OUT, 'bundle.js'),
    minify: MINIFY,
    legalComments: 'none',
    logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"production"' }
  });

  // 2. the data the rules read: shared/data and shared/l10n are the source of truth.
  await copyDir(join(ROOT, 'shared', 'data'), join(OUT, 'data'), keepRuntime);
  await copyDir(join(ROOT, 'shared', 'l10n'), join(OUT, 'l10n'), keepRuntime);

  // 3. real foley + music, straight from Assets/Audio.
  await copyDir(join(ROOT, 'Assets', 'Audio'), join(OUT, 'audio'), keepRuntime);

  // 4. approved sprites (prototype/assets/art is committed on purpose: a fresh
  //    clone renders the approved art without running build-runtime).
  await copyDir(join(ROOT, 'prototype', 'assets'), join(OUT, 'assets'), keepRuntime);

  // 5. fonts, bundled: a phone in a barbecue joint has no bandwidth to spare.
  const fonts = await writeFonts();

  // 6. the shell itself.
  await writeFile(join(OUT, 'index.html'), indexHtml(fonts.css));
  await writeFile(join(OUT, 'sw.js'), SW_JS);

  const icons = join(OUT, 'icons');
  await mkdir(icons, { recursive: true });
  const icon512 = join(ROOT, 'store-assets', 'icon', 'icon-512.png');
  const icon1024 = join(ROOT, 'store-assets', 'icon', 'icon-1024.png');
  if (existsSync(icon512)) await cp(icon512, join(icons, 'icon-512.png'));
  if (existsSync(icon1024)) await cp(icon1024, join(icons, 'icon-1024.png'));
  await writeFile(
    join(OUT, 'manifest.webmanifest'),
    JSON.stringify(
      {
        name: 'CHURRASCO! O Mestre da Brasa',
        short_name: 'CHURRASCO!',
        description: 'Build de teste em aparelho real.',
        lang: 'pt-BR',
        start_url: '/index.html',
        scope: '/',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#0A0705',
        theme_color: '#0A0705',
        icons: [
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' }
        ]
      },
      null,
      2
    ) + '\n'
  );

  // 7. verify: a bundle that fetches a file the tree does not have is a silent
  //    art/audio loss on the device, which is exactly what a playtest cannot have.
  const bundle = await readFile(join(OUT, 'bundle.js'), 'utf8');
  const found = requestedPaths(bundle);
  const missing = [];
  for (const p of found) {
    const target = join(OUT, p.replace(/^\//, ''));
    if (!existsSync(target)) missing.push(p);
  }
  const required = [
    'index.html',
    'bundle.js',
    'sw.js',
    'manifest.webmanifest',
    'data/levels.json',
    'data/analytics.json',
    'l10n/pt-BR.json',
    'audio/manifest.json',
    'assets/art/index.json',
    'fonts/nunito-700.woff2'
  ];
  for (const p of required) if (!existsSync(join(OUT, p))) missing.push(p);

  const sprites = JSON.parse(await readFile(join(OUT, 'assets', 'art', 'index.json'), 'utf8'));
  const spriteMissing = Object.values(sprites.sprites)
    .map((s) => join(OUT, 'assets', 'art', s.file))
    .filter((f) => !existsSync(f));
  if (spriteMissing.length) missing.push(...spriteMissing.map((f) => `${f.replace(`${OUT}/`, '')}`));

  // The audio manifest is what a missing file would silently turn into a silent
  // cue (the synth fallback hides it), so every listed wav has to be here.
  const audioManifest = JSON.parse(await readFile(join(OUT, 'audio', 'manifest.json'), 'utf8'));
  const wavs = new Set();
  const walk = (node) => {
    if (typeof node === 'string') { if (node.endsWith('.wav')) wavs.add(node); return; }
    if (node && typeof node === 'object') for (const v of Object.values(node)) walk(v);
  };
  walk(audioManifest);
  for (const wav of wavs) if (!existsSync(join(OUT, 'audio', wav))) missing.push(`audio/${wav}`);

  const size = async (dir = OUT) => {
    let total = 0;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) total += await size(p);
      else total += (await stat(p)).size;
    }
    return total;
  };
  const totalBytes = await size();

  if (missing.length) {
    console.error(`[export] ✗ the bundle asks for ${missing.length} file(s) the export does not have:`);
    for (const p of missing.slice(0, 25)) console.error(`  - ${p}`);
    process.exit(1);
  }

  console.log(`[export] CHURRASCO! Android web app → ${OUT}`);
  console.log(`[export]   bundle      ${(bundle.length / 1024).toFixed(0)} KB ${MINIFY ? '(minified)' : '(readable)'}`);
  console.log(`[export]   sprites     ${Object.keys(sprites.sprites).length} approved`);
  console.log(`[export]   fonts       ${fonts.css.split('@font-face').length - 1} faces, ${(fonts.bytes / 1024).toFixed(0)} KB`);
  console.log(`[export]   total       ${(totalBytes / 1048576).toFixed(1)} MB, ${found.length} referenced paths verified`);
  console.log(`[export]   done in     ${Date.now() - started} ms`);
  console.log('[export] serve it with: node tools/android/serve-export.mjs');
}

await main();
