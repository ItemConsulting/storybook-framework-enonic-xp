import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import test from "node:test";
import { CLIENT_SIDE_GLOBALS, fetchStoryHtml, parameters } from "../dist/preview.js";

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

/** How the Storybook preview iframe calls the renderer: no portable-story flag. */
const storyContext = { globals: {} };

/** How `@storybook/addon-vitest` calls it: stories are composed as portable stories. */
const testContext = { globals: {}, parameters: { __isPortableStory: true } };

/** Silence and capture `console.error` for the UI path, which logs instead of throwing. */
function captureConsoleError() {
  const original = console.error;
  const messages = [];
  console.error = (...args) => messages.push(args.join(" "));
  return {
    messages,
    restore: () => {
      console.error = original;
    },
  };
}

test("is registered as the default fetchStoryHtml parameter", () => {
  assert.equal(parameters.server.fetchStoryHtml, fetchStoryHtml);
});

test("returns the body on a 2xx response", async () => {
  const { url, stop } = await startServer((_req, res) => {
    res.statusCode = 200;
    res.end("<p>hello</p>");
  });
  try {
    assert.equal(await fetchStoryHtml(url, "my-story", {}, storyContext), "<p>hello</p>");
  } finally {
    await stop();
  }
});

test("sends the story id as the path, plus globals and params as query string", async () => {
  let requestUrl;
  const { url, stop } = await startServer((req, res) => {
    requestUrl = req.url;
    res.end("ok");
  });
  try {
    await fetchStoryHtml(url, "parts-title--title", { displayName: "Hi" }, { globals: { locale: "no" } });
    const { pathname, searchParams } = new URL(requestUrl, url);
    assert.equal(pathname, "/parts-title--title");
    assert.equal(searchParams.get("locale"), "no");
    assert.equal(searchParams.get("displayName"), "Hi");
  } finally {
    await stop();
  }
});

test("sends object globals as JSON instead of [object Object]", async () => {
  let requestUrl;
  const { url, stop } = await startServer((req, res) => {
    requestUrl = req.url;
    res.end("ok");
  });
  try {
    const globals = { theme: { value: "dark", contrast: false }, tags: ["a", "b"], highContrast: false, zoom: 2 };
    await fetchStoryHtml(url, "s", {}, { globals });
    const { searchParams } = new URL(requestUrl, url);
    assert.deepEqual(JSON.parse(searchParams.get("theme")), { value: "dark", contrast: false });
    assert.deepEqual(JSON.parse(searchParams.get("tags")), ["a", "b"]);
    assert.equal(searchParams.get("highContrast"), "false");
    assert.equal(searchParams.get("zoom"), "2");
  } finally {
    await stop();
  }
});

test("leaves out globals and params that are undefined or null", async () => {
  let requestUrl;
  const { url, stop } = await startServer((req, res) => {
    requestUrl = req.url;
    res.end("ok");
  });
  try {
    await fetchStoryHtml(url, "s", { text: undefined, title: "Hi" }, { globals: { vision: undefined, theme: null } });
    assert.deepEqual([...new URL(requestUrl, url).searchParams.keys()], ["title"]);
  } finally {
    await stop();
  }
});

test("does not send the globals of Storybook's client-side addons", async () => {
  let requestUrl;
  const { url, stop } = await startServer((req, res) => {
    requestUrl = req.url;
    res.end("ok");
  });
  try {
    const globals = {
      a11y: { manual: false },
      backgrounds: { value: "dark" },
      measureEnabled: false,
      outline: false,
      viewport: { value: "mobile1" },
      vision: "blurred",
      locale: "no",
    };
    await fetchStoryHtml(url, "s", {}, { globals });
    assert.deepEqual([...new URL(requestUrl, url).searchParams.keys()], ["locale"]);
  } finally {
    await stop();
  }
});

test("parameters.server.excludeGlobals replaces the list of globals that are not sent", async () => {
  let requestUrl;
  const { url, stop } = await startServer((req, res) => {
    requestUrl = req.url;
    res.end("ok");
  });
  try {
    const context = {
      globals: { backgrounds: { value: "dark" }, locale: "no" },
      parameters: { server: { excludeGlobals: ["locale"] } },
    };
    await fetchStoryHtml(url, "s", {}, context);
    assert.deepEqual([...new URL(requestUrl, url).searchParams.keys()], ["backgrounds"]);
  } finally {
    await stop();
  }
});

test("exports the default list of client-side globals", () => {
  assert.ok(CLIENT_SIDE_GLOBALS.includes("backgrounds"));
  assert.ok(CLIENT_SIDE_GLOBALS.includes("viewport"));
  assert.ok(CLIENT_SIDE_GLOBALS.includes("a11y"));
});

test("params override globals of the same name, as in the renderer's default", async () => {
  let requestUrl;
  const { url, stop } = await startServer((req, res) => {
    requestUrl = req.url;
    res.end("ok");
  });
  try {
    await fetchStoryHtml(url, "s", { locale: "en" }, { globals: { locale: "no" } });
    assert.equal(new URL(requestUrl, url).searchParams.get("locale"), "en");
  } finally {
    await stop();
  }
});

test("rejects on a 500 and quotes the XP error message", async () => {
  const { url, stop } = await startServer((_req, res) => {
    res.statusCode = 500;
    // Shape XP uses for a FreeMarker failure.
    res.end('<pre style="white-space: pre-wrap;">Index 0 out of bounds for length 0</pre>');
  });
  try {
    await assert.rejects(fetchStoryHtml(url, "parts-arrangement--arrangement", {}, testContext), (error) => {
      assert.match(error.message, /500/);
      assert.match(error.message, /parts-arrangement--arrangement/);
      // Tags stripped so the actual message is readable.
      assert.match(error.message, /Index 0 out of bounds for length 0/);
      assert.doesNotMatch(error.message, /<pre/);
      return true;
    });
  } finally {
    await stop();
  }
});

test("omits the query string from the reported request, keeping the error readable", async () => {
  const { url, stop } = await startServer((_req, res) => {
    res.statusCode = 500;
    res.end("boom");
  });
  try {
    // A story arg big enough to bury the message if it were echoed back verbatim.
    const params = { processSteps: "x".repeat(5000), displayName: "Hi" };
    await assert.rejects(fetchStoryHtml(url, "s", params, testContext), (error) => {
      assert.doesNotMatch(error.message, /xxxxx/);
      assert.match(error.message, /\(2 query parameters\)/);
      assert.match(error.message, new RegExp(`${url}/s`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      return true;
    });
  } finally {
    await stop();
  }
});

test("rejects on a 404", async () => {
  const { url, stop } = await startServer((_req, res) => {
    res.statusCode = 404;
    res.end("Not found");
  });
  try {
    await assert.rejects(fetchStoryHtml(url, "missing", {}, testContext), /404/);
  } finally {
    await stop();
  }
});

test("reports an empty error body rather than quoting nothing", async () => {
  const { url, stop } = await startServer((_req, res) => {
    res.statusCode = 502;
    res.end("");
  });
  try {
    await assert.rejects(fetchStoryHtml(url, "s", {}, testContext), /\(empty body\)/);
  } finally {
    await stop();
  }
});

test("truncates a very long error body", async () => {
  const { url, stop } = await startServer((_req, res) => {
    res.statusCode = 500;
    res.end("x".repeat(5000));
  });
  try {
    await assert.rejects(fetchStoryHtml(url, "s", {}, testContext), (error) => {
      assert.match(error.message, /…/);
      assert.ok(error.message.length < 1000, `error message unexpectedly long: ${error.message.length}`);
      return true;
    });
  } finally {
    await stop();
  }
});

test("in the Storybook UI, renders the error body instead of throwing", async () => {
  const errorPage = '<pre style="white-space: pre-wrap;">FreeMarker template error: isAdministrationSite2</pre>';
  const { url, stop } = await startServer((_req, res) => {
    res.statusCode = 500;
    res.end(errorPage);
  });
  const console_ = captureConsoleError();
  try {
    // Body returned verbatim — tags intact — so the canvas shows the full XP error page.
    assert.equal(await fetchStoryHtml(url, "parts-arrangement--arrangement", {}, storyContext), errorPage);
  } finally {
    console_.restore();
    await stop();
  }
});

test("in the Storybook UI, still reports the failure on the console", async () => {
  const { url, stop } = await startServer((_req, res) => {
    res.statusCode = 500;
    res.end('<pre style="white-space: pre-wrap;">Index 0 out of bounds for length 0</pre>');
  });
  const console_ = captureConsoleError();
  try {
    await fetchStoryHtml(url, "parts-arrangement--arrangement", {}, storyContext);
    console_.restore();
    assert.equal(console_.messages.length, 1);
    assert.match(console_.messages[0], /500/);
    assert.match(console_.messages[0], /Index 0 out of bounds for length 0/);
  } finally {
    console_.restore();
    await stop();
  }
});

test("a 2xx response never logs, in either context", async () => {
  const { url, stop } = await startServer((_req, res) => {
    res.end("<p>fine</p>");
  });
  const console_ = captureConsoleError();
  try {
    await fetchStoryHtml(url, "s", {}, storyContext);
    await fetchStoryHtml(url, "s", {}, testContext);
    console_.restore();
    assert.deepEqual(console_.messages, []);
  } finally {
    console_.restore();
    await stop();
  }
});
