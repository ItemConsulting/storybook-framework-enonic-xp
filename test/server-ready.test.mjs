import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import test from "node:test";
import setup from "../dist/server-ready.js";

const ENV_KEY = "XP_STORYBOOK_SERVER_URL";

/** Start an HTTP server on an ephemeral port and resolve with its base URL + a stop fn. */
function startServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        stop: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

test.afterEach(() => {
  delete process.env[ENV_KEY];
});

test("no-ops when the server URL env var is unset", async () => {
  delete process.env[ENV_KEY];
  await assert.doesNotReject(setup());
});

test("resolves when the server answers a HEAD request", async () => {
  let method;
  const { url, stop } = await startServer((req, res) => {
    method = req.method;
    res.end();
  });
  try {
    process.env[ENV_KEY] = url;
    await assert.doesNotReject(setup());
    assert.equal(method, "HEAD");
  } finally {
    await stop();
  }
});

test("resolves even on a non-2xx response (reachability, not status)", async () => {
  const { url, stop } = await startServer((_req, res) => {
    res.statusCode = 404;
    res.end();
  });
  try {
    process.env[ENV_KEY] = url;
    await assert.doesNotReject(setup());
  } finally {
    await stop();
  }
});

test("throws an actionable error when the server is unreachable", async () => {
  // Bind then immediately release the port so nothing is listening on it.
  const { url, stop } = await startServer(() => {});
  await stop();
  process.env[ENV_KEY] = url;

  await assert.rejects(setup(), (err) => {
    assert.match(err.message, /Cannot reach the Enonic XP server/);
    assert.match(err.message, new RegExp(url));
    assert.ok(err.cause, "original fetch error is attached as `cause`");
    return true;
  });
});
