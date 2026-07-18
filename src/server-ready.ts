// Vitest `globalSetup` guard for the Storybook Vitest project (see `./vitest`).
//
// The `@storybook/server` renderer draws every story by fetching its HTML from a running XP
// server. If that server is down, each story fails with an opaque fetch/render error. This
// pings the server once up front and fails with an actionable message instead.
//
// The URL comes from `XP_STORYBOOK_SERVER_URL`, which `defineXpStorybookProject` sets from its
// `serverUrl` option. Without it, the guard is a no-op.

const TIMEOUT_MS = 5000;

export default async function setup(): Promise<void> {
  const url = process.env.XP_STORYBOOK_SERVER_URL;
  if (!url) return;

  try {
    // A HEAD request is enough — any HTTP response (even a 404) proves the server is reachable;
    // only a network-level failure means it's down. The XP renderer on the other end handles HEAD.
    await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (cause) {
    throw new Error(
      [
        `Cannot reach the Enonic XP server at ${url}.`,
        "",
        "@storybook/addon-vitest renders @storybook/server stories by fetching their HTML from",
        "this server, so it must be running while the tests execute. Start your XP dev server",
        "(e.g. `enonic project dev`) and make sure it responds at the URL above, then re-run the",
        "tests. Set `serverUrl` in defineXpStorybookProject() if it lives elsewhere.",
      ].join("\n"),
      { cause },
    );
  }
}
