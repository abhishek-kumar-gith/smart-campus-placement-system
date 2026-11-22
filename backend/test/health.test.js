const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

test('health endpoint is available', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
  const body = await response.json();
  server.close();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.status, 'ok');
});
