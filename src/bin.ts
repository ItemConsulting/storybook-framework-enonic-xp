#!/usr/bin/env node
// Command line entry point: `npx @itemconsulting/storybook-framework-enonic-xp init`.

import { parseArgs } from "node:util";
import { init } from "./init.js";

const HELP = `Usage: npx @itemconsulting/storybook-framework-enonic-xp@latest init [options]

Set up Storybook with the Enonic XP framework in the current XP project.

Options:
  --skip-install  Write the config files only; print the install command instead of running it
  --skip-tests    Leave out @storybook/addon-vitest and the Vitest setup
  -h, --help      Show this help
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "skip-install": { type: "boolean", default: false },
    "skip-tests": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command] = positionals;

if (values.help || command !== "init") {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

try {
  await init({
    cwd: process.cwd(),
    skipInstall: values["skip-install"],
    skipTests: values["skip-tests"],
  });
} catch (error) {
  console.error(`\n✖ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
