// Shop demo app: one small Node.js server, no dependencies.
// It shows who answered the request and what the gateway did to it, so the
// browser makes the Gateway API behaviour visible.

import http from 'node:http';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function identity(env = process.env) {
  return {
    version: env.APP_VERSION ?? 'v1',
    label: env.APP_LABEL ?? 'stable',
    color: env.APP_COLOR ?? '#2563eb',
    pod: env.POD_NAME ?? os.hostname(),
    namespace: env.POD_NAMESPACE ?? 'local',
  };
}

export function createServer({
  env = process.env,
  publicDir = path.join(here, 'public'),
} = {}) {
  const me = identity(env);
  const indexHtml = readFileSync(path.join(publicDir, 'index.html'));

  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://backend');

    if (url.pathname === '/healthz') {
      return send(res, me, 200, 'text/plain; charset=utf-8', 'ok');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, me, 405, 'text/plain; charset=utf-8', 'method not allowed');
    }

    if (url.pathname === '/api/whoami') {
      const body = JSON.stringify(
        {
          ...me,
          method: req.method,
          path: url.pathname,
          query: url.search,
          host: req.headers.host ?? null,
          headers: req.headers,
          time: new Date().toISOString(),
        },
        null,
        2,
      );
      return send(res, me, 200, 'application/json; charset=utf-8', body);
    }

    if (url.pathname.startsWith('/api/')) {
      const body = JSON.stringify({ error: 'not found', path: url.pathname });
      return send(res, me, 404, 'application/json; charset=utf-8', body);
    }

    // Anything else is the UI. Routes like /legacy/ also land here after rewrite.
    return send(res, me, 200, 'text/html; charset=utf-8', indexHtml);
  });
}

function send(res, me, status, type, body) {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store', // so every click really goes through the gateway
    'x-app-version': me.version,
  });
  res.end(body);
}
