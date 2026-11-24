import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../app.js';

async function start(overrides = {}) {
  const server = createServer({
    env: {
      APP_VERSION: 'v9',
      APP_LABEL: 'test',
      APP_COLOR: '#000000',
      POD_NAME: 'pod-x',
      POD_NAMESPACE: 'lab',
      ...overrides,
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('/api/whoami reports identity and the path the app received', async () => {
  const app = await start();
  try {
    const res = await fetch(`${app.base}/api/whoami?x=1`, {
      headers: { 'x-lab-route': 'rewrite' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-app-version'), 'v9');
    assert.equal(res.headers.get('cache-control'), 'no-store');

    const body = await res.json();
    assert.equal(body.version, 'v9');
    assert.equal(body.label, 'test');
    assert.equal(body.color, '#000000');
    assert.equal(body.pod, 'pod-x');
    assert.equal(body.namespace, 'lab');
    assert.equal(body.path, '/api/whoami');
    assert.equal(body.query, '?x=1');
    assert.equal(body.headers['x-lab-route'], 'rewrite');
  } finally {
    await app.close();
  }
});

test('the UI is served at / and at any non-API path', async () => {
  const app = await start();
  try {
    for (const p of ['/', '/legacy/', '/anything/else']) {
      const res = await fetch(`${app.base}${p}`);
      assert.equal(res.status, 200, p);
      assert.match(res.headers.get('content-type'), /text\/html/, p);
      assert.match(await res.text(), /Gateway API Lab/, p);
    }
  } finally {
    await app.close();
  }
});

test('unknown /api paths return JSON 404', async () => {
  const app = await start();
  try {
    const res = await fetch(`${app.base}/api/nope`);
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error, 'not found');
  } finally {
    await app.close();
  }
});

test('/healthz is ok for readiness probes', async () => {
  const app = await start();
  try {
    const res = await fetch(`${app.base}/healthz`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'ok');
  } finally {
    await app.close();
  }
});

test('non-GET methods are rejected', async () => {
  const app = await start();
  try {
    const res = await fetch(`${app.base}/api/whoami`, { method: 'POST', body: 'x' });
    assert.equal(res.status, 405);
  } finally {
    await app.close();
  }
});
