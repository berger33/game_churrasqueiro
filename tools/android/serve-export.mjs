#!/usr/bin/env node
/**
 * Serves the Android/offline export over plain HTTP so a phone on the same
 * network (or the sandbox preview proxy) can open it without installing
 * anything. The APK path does not need this server: the app reads its own
 * assets. This exists for the "test it in the browser first" case.
 *
 * Usage: node tools/android/serve-export.mjs [--port 8080] [--dir build/android-webapp]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, normalize, extname, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const PORT = Number(process.env.PORT ?? arg('--port', 8080));
const DIR = resolve(ROOT, arg('--dir', 'build/android-webapp'));

if (!existsSync(join(DIR, 'index.html'))) {
  console.error(`[serve] ${DIR}/index.html not found — run \`npm run export:android\` first.`);
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  let path = decodeURIComponent(url.pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(DIR, `.${normalize(path)}`);
  if (!file.startsWith(DIR)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  const body = await readFile(file);
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Content-Length': body.length,
    // The export is regenerated per build; never let a phone test a stale bundle.
    'Cache-Control': 'no-store'
  });
  res.end(body);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[serve] CHURRASCO! playtest export on http://0.0.0.0:${PORT}`);
  console.log(`[serve] serving ${DIR}`);
});
