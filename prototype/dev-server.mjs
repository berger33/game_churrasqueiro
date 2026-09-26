/**
 * Design-verification prototype dev server.
 *
 * Serves the prototype on 0.0.0.0 so it works behind the sandbox preview proxy,
 * bundles `src/main.ts` with esbuild on demand, and exposes the REAL data tables
 * from `shared/data` — the prototype reads exactly what the Unity client will read.
 *
 * It is intentionally tiny: no framework, no HMR magic, no build config to drift.
 */
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { build } from 'esbuild';

const ROOT = join(import.meta.dirname, '..');
const PROTO = join(ROOT, 'prototype');
const SHARED = join(ROOT, 'shared', 'data');
const L10N = join(ROOT, 'shared', 'l10n');
const OUT = join(PROTO, 'dist');
const PORT = Number(process.env.PORT ?? 5173);
const HOST = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.ico': 'image/x-icon'
};

let building = null;

async function bundle() {
  if (building) return building;
  building = (async () => {
    const t0 = Date.now();
    await mkdir(OUT, { recursive: true });
    await build({
      entryPoints: [join(PROTO, 'src', 'main.ts')],
      bundle: true,
      format: 'esm',
      target: ['es2022'],
      outfile: join(OUT, 'bundle.js'),
      sourcemap: 'inline',
      logLevel: 'warning',
      define: { 'process.env.NODE_ENV': '"development"' }
    });
    console.log(`[proto] bundled in ${Date.now() - t0} ms`);
  })();
  try {
    await building;
  } finally {
    building = null;
  }
}

async function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'Cross-Origin-Opener-Policy': 'same-origin'
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let path = decodeURIComponent(url.pathname);

  try {
    // The data layer: same files the Unity client imports.
    if (path.startsWith('/data/')) {
      const file = join(SHARED, normalize(path.slice('/data/'.length)));
      if (!file.startsWith(SHARED)) return send(res, 403, 'forbidden', 'text/plain');
      if (!existsSync(file)) return send(res, 404, 'not found', 'text/plain');
      return send(res, 200, await readFile(file), MIME['.json']);
    }

    // Localisation tables: same files the Unity client loads.
    if (path.startsWith('/l10n/')) {
      const file = join(L10N, normalize(path.slice('/l10n/'.length)));
      if (!file.startsWith(L10N)) return send(res, 403, 'forbidden', 'text/plain');
      if (!existsSync(file)) return send(res, 404, 'not found', 'text/plain');
      return send(res, 200, await readFile(file), MIME['.json']);
    }

    // Audio assets — real foley + 3400K music (Assets/Audio -> /audio and /public/audio)
    if (path.startsWith('/audio/') || path.startsWith('/public/audio/')) {
      const rel = path.startsWith('/public/audio/') ? path.slice('/public/audio/'.length) : path.slice('/audio/'.length);
      const file = join(ROOT, 'Assets', 'Audio', normalize(rel));
      const rootAudio = join(ROOT, 'Assets', 'Audio');
      if (!file.startsWith(rootAudio)) return send(res, 403, 'forbidden', 'text/plain');
      if (!existsSync(file)) return send(res, 404, 'not found', 'text/plain');
      return send(res, 200, await readFile(file), MIME[extname(file)] ?? 'application/octet-stream');
    }

    if (path === '/' || path === '/index.html') {
      return send(res, 200, await readFile(join(PROTO, 'index.html')), MIME['.html']);
    }

    if (path === '/bundle.js') {
      await bundle();
      return send(res, 200, await readFile(join(OUT, 'bundle.js')), MIME['.js']);
    }

    if (path === '/healthz') return send(res, 200, 'ok', 'text/plain');

    const file = join(PROTO, normalize(path));
    if (!file.startsWith(PROTO)) return send(res, 403, 'forbidden', 'text/plain');
    const st = await stat(file).catch(() => null);
    if (st?.isFile()) return send(res, 200, await readFile(file), MIME[extname(file)] ?? 'application/octet-stream');

    return send(res, 404, 'not found', 'text/plain');
  } catch (err) {
    console.error('[proto] error', err);
    return send(res, 500, String(err), 'text/plain');
  }
});

await bundle();
server.listen(PORT, HOST, () => {
  console.log(`[proto] CHURRASCO! design-verification prototype`);
  console.log(`[proto] listening on http://${HOST}:${PORT}`);
  console.log(`[proto] data served from ${SHARED}`);
});

// Rebundle on source change (crude but dependency-free).
let lastMtime = 0;
setInterval(async () => {
  try {
    const st = await stat(join(PROTO, 'src', 'main.ts'));
    if (st.mtimeMs > lastMtime) {
      lastMtime = st.mtimeMs;
      await bundle();
    }
  } catch {
    /* ignore */
  }
}, 1500);
