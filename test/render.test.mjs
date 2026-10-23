import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import test from "node:test";

// `simulatePageLoad` and `simulateDOMContentLoaded` from `storybook/preview-api` read the global
// `document` when the module is loaded, so this stub has to exist before `dist/preview.js` is
// imported. They only append a scripts container and dispatch DOMContentLoaded.
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({}),
  createEvent: () => ({ initEvent() {} }),
  dispatchEvent() {},
  body: { appendChild() {} },
};

const { renderToCanvas } = await import("../dist/preview.js");

/** Start a server that answers with a numbered snippet, so each fetch is distinguishable. */
function startServer() {
  return new Promise((resolve) => {
    const requests = [];
    const server = createServer((req, res) => {
      requests.push(req.url);
      res.end(`<p>render ${requests.length}</p>`);
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        stop: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

function createCanvas() {
  return {
    innerHTML: "",
    firstChild: null,
    appendChild() {},
    querySelectorAll: () => [],
  };
}

/** A render context like the one Storybook passes, for a story with the given args and globals. */
function createContext(url, { args = {}, globals = {}, forceRemount = false } = {}) {
  return {
    id: "part-title--title",
    title: "Part/Title",
    name: "Title",
    forceRemount,
    showMain() {},
    showError(error) {
      throw new Error(error.title);
    },
    storyFn() {},
    storyContext: {
      args,
      argTypes: {},
      globals,
      parameters: { server: { url, id: "site/parts/title/title.ftlh", params: { xpAppName: "com.example" } } },
    },
  };
}

test("renders the fetched HTML into the canvas", async () => {
  const { url, requests, stop } = await startServer();
  try {
    const canvas = createCanvas();
    await renderToCanvas(createContext(url, { args: { title: "Hi" }, forceRemount: true }), canvas);

    assert.equal(canvas.innerHTML, "<p>render 1</p>");
    const { pathname, searchParams } = new URL(requests[0], url);
    assert.equal(pathname, "/site/parts/title/title.ftlh");
    assert.equal(searchParams.get("title"), "Hi");
    assert.equal(searchParams.get("xpAppName"), "com.example");
  } finally {
    await stop();
  }
});

test("does not fetch again when only a client-side global changed", async () => {
  const { url, requests, stop } = await startServer();
  try {
    const canvas = createCanvas();
    await renderToCanvas(createContext(url, { forceRemount: true }), canvas);
    await renderToCanvas(createContext(url, { globals: { backgrounds: { value: "dark" } } }), canvas);
    await renderToCanvas(createContext(url, { globals: { viewport: { value: "mobile1" }, outline: true } }), canvas);

    assert.equal(requests.length, 1);
    assert.equal(canvas.innerHTML, "<p>render 1</p>");
  } finally {
    await stop();
  }
});

test("fetches again when the args change", async () => {
  const { url, requests, stop } = await startServer();
  try {
    const canvas = createCanvas();
    await renderToCanvas(createContext(url, { args: { title: "Hi" }, forceRemount: true }), canvas);
    await renderToCanvas(createContext(url, { args: { title: "Hello" } }), canvas);

    assert.equal(requests.length, 2);
    assert.equal(canvas.innerHTML, "<p>render 2</p>");
  } finally {
    await stop();
  }
});

test("fetches again when a global that is sent to XP changes", async () => {
  const { url, requests, stop } = await startServer();
  try {
    const canvas = createCanvas();
    await renderToCanvas(createContext(url, { globals: { locale: "no" }, forceRemount: true }), canvas);
    await renderToCanvas(createContext(url, { globals: { locale: "en" } }), canvas);

    assert.equal(requests.length, 2);
    assert.equal(new URL(requests[1], url).searchParams.get("locale"), "en");
  } finally {
    await stop();
  }
});

test("fetches again on a remount, even when nothing changed", async () => {
  const { url, requests, stop } = await startServer();
  try {
    const canvas = createCanvas();
    await renderToCanvas(createContext(url, { forceRemount: true }), canvas);
    await renderToCanvas(createContext(url, { forceRemount: true }), canvas);

    assert.equal(requests.length, 2);
  } finally {
    await stop();
  }
});

test("tracks each canvas separately", async () => {
  const { url, requests, stop } = await startServer();
  try {
    await renderToCanvas(createContext(url), createCanvas());
    await renderToCanvas(createContext(url), createCanvas());

    assert.equal(requests.length, 2);
  } finally {
    await stop();
  }
});

test("uses a fetchStoryHtml set in the parameters", async () => {
  const canvas = createCanvas();
  const context = createContext("http://unused.invalid");
  context.storyContext.parameters.server.fetchStoryHtml = async (_url, path) => `<p>custom ${path}</p>`;

  await renderToCanvas(context, canvas);
  assert.equal(canvas.innerHTML, "<p>custom site/parts/title/title.ftlh</p>");
});
