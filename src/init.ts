// `init` command: set up Storybook with this framework in an existing Enonic XP project.
//
// Writes the config files, adds the npm scripts and installs the dependencies — the same setup
// `storybook init` does for other frameworks. No `preview.ts` is written: the framework's own
// preview annotations already point every story at the xp-storybook app.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { getGradleProperty } from "./gradle-properties.js";

export type InitOptions = {
  /** Root of the XP project. */
  cwd: string;
  /** Write the files only, without installing dependencies or the Playwright browser. */
  skipInstall?: boolean;
  /** Leave out `@storybook/addon-vitest` and the Vitest setup. */
  skipTests?: boolean;
  log?: (message: string) => void;
};

type PackageJson = {
  name?: string;
  version?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const FRAMEWORK = "@itemconsulting/storybook-framework-enonic-xp";

const SCRIPTS = {
  storybook: "storybook dev -p 6006",
  "build-storybook": "storybook build",
};

const GITIGNORE_ENTRIES = ["*storybook.log", "storybook-static"];

/** This package's own `package.json`, which holds the versions it is built and tested against. */
function readOwnPackageJson(): PackageJson {
  return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
}

/**
 * The packages to install, at the versions this framework is tested with. The ranges come from its
 * own `devDependencies`, so they follow the framework's releases without a list to keep in sync.
 */
export function getDependencies(skipTests = false): string[] {
  const own = readOwnPackageJson();
  const dev = own.devDependencies ?? {};
  const storybook = dev.storybook;

  const dependencies = [
    `${FRAMEWORK}@^${own.version}`,
    `storybook@${storybook}`,
    `vite@${dev.vite}`,
    `@storybook/addon-docs@${storybook}`,
    `@storybook/addon-a11y@${storybook}`,
    `@storybook/addon-links@${storybook}`,
  ];

  if (!skipTests) {
    dependencies.push(
      `@storybook/addon-vitest@${dev["@storybook/addon-vitest"]}`,
      `vitest@${dev.vitest}`,
      `@vitest/browser-playwright@${dev["@vitest/browser-playwright"]}`,
      `playwright@${own.peerDependencies?.playwright}`,
    );
  }

  return dependencies;
}

/** The package manager the project already uses, going by its lockfile. */
export function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) return "bun";
  return "npm";
}

function installCommand(packageManager: PackageManager, packages: string[]): [string, string[]] {
  switch (packageManager) {
    case "pnpm":
      return ["pnpm", ["add", "-D", ...packages]];
    case "yarn":
      return ["yarn", ["add", "-D", ...packages]];
    case "bun":
      return ["bun", ["add", "-d", ...packages]];
    default:
      return ["npm", ["install", "-D", ...packages]];
  }
}

function execCommand(packageManager: PackageManager, args: string[]): [string, string[]] {
  switch (packageManager) {
    case "pnpm":
      return ["pnpm", ["exec", ...args]];
    case "yarn":
      return ["yarn", args];
    case "bun":
      return ["bunx", args];
    default:
      return ["npx", args];
  }
}

function run(command: string, args: string[], cwd: string): void {
  // A shell is needed on Windows to run the package managers' `.cmd` shims. cmd.exe reads the `^`
  // in a version range as an escape character, so quote every argument there.
  const windows = process.platform === "win32";
  const result = spawnSync(command, windows ? args.map((arg) => `"${arg}"`) : args, {
    cwd,
    stdio: "inherit",
    shell: windows,
  });
  if (result.status !== 0) {
    throw new Error(`\`${command} ${args.join(" ")}\` failed${result.error ? `: ${result.error.message}` : ""}.`);
  }
}

function mainTs(staticDirs: string[], skipTests: boolean): string {
  const addons = ["@storybook/addon-links", "@storybook/addon-a11y", "@storybook/addon-docs"];
  if (!skipTests) addons.push("@storybook/addon-vitest");

  return `import type { StorybookConfig } from "${FRAMEWORK}";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.ts"],
  addons: [
${addons.map((addon) => `    "${addon}",`).join("\n")}
  ],${staticDirs.length > 0 ? `\n  staticDirs: [${staticDirs.map((dir) => `"${dir}"`).join(", ")}],` : ""}
  framework: {
    name: "${FRAMEWORK}",
    options: {},
  },
};

export default config;
`;
}

const STORYBOOK_TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "skipLibCheck": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "noImplicitAny": true,
    "lib": ["dom", "ES2022"],
    "types": ["${FRAMEWORK}", "vite/client"]
  },
  "exclude": ["build/*"]
}
`;

const VITEST_CONFIG = `import { defineXpStorybookProject } from "${FRAMEWORK}/vitest";
import { defineConfig } from "vitest/config";

// The async callback form works whether or not your project is ESM (\`"type": "module"\`).
export default defineConfig(async () => ({
  test: {
    projects: [await defineXpStorybookProject()],
  },
}));
`;

/** Set up Storybook in the XP project at `options.cwd`. Existing files are left as they are. */
export async function init(options: InitOptions): Promise<void> {
  const { cwd, skipInstall = false, skipTests = false, log = console.log } = options;

  const writeIfMissing = (path: string, content: string): void => {
    const file = join(cwd, path);
    if (existsSync(file)) {
      log(`- Skipped ${path}, it already exists`);
      return;
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    log(`✔ Created ${path}`);
  };

  // The framework refuses to start without `appName`, so stop here, before anything is written,
  // rather than leave a setup that fails on its first run.
  const gradleProperties = join(cwd, "gradle.properties");
  const appName = existsSync(gradleProperties)
    ? getGradleProperty("appName", readFileSync(gradleProperties, "utf-8"))
    : undefined;

  if (!existsSync(join(cwd, "build.gradle")) && !existsSync(gradleProperties)) {
    throw new Error(`${cwd} does not look like an Enonic XP project (no build.gradle or gradle.properties).`);
  }

  if (!appName) {
    throw new Error(
      `Could not read "appName" from ${gradleProperties}.\n\n` +
        `The framework tells the xp-storybook app which installed application to render templates from, so ` +
        `Storybook will not start without it. Add it to gradle.properties, e.g.\n\n` +
        `    appName = com.example.myapp\n\n` +
        `An XP library has no application of its own: run this in an application that includes the library ` +
        `instead (see the ${FRAMEWORK} README).`,
    );
  }

  // package.json: create a minimal one if the project has none, and add the scripts.
  const packageJsonPath = join(cwd, "package.json");
  const packageJson: PackageJson = existsSync(packageJsonPath)
    ? JSON.parse(readFileSync(packageJsonPath, "utf-8"))
    : { name: basename(cwd), private: true };

  packageJson.scripts ??= {};
  let packageJsonChanged = !existsSync(packageJsonPath);
  for (const [name, command] of Object.entries(SCRIPTS)) {
    if (packageJson.scripts[name]) {
      log(`- Skipped the "${name}" script, it already exists`);
    } else {
      packageJson.scripts[name] = command;
      packageJsonChanged = true;
      log(`✔ Added the "${name}" script`);
    }
  }
  if (packageJsonChanged) {
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  }

  // Config files.
  const assetsDir = "src/main/resources/assets";
  writeIfMissing(".storybook/main.ts", mainTs(existsSync(join(cwd, assetsDir)) ? [`../${assetsDir}`] : [], skipTests));
  writeIfMissing(".storybook/tsconfig.json", STORYBOOK_TSCONFIG);
  if (!skipTests) writeIfMissing("vitest.config.ts", VITEST_CONFIG);

  // .gitignore: Storybook's debug log and the output of `build-storybook`.
  const gitignorePath = join(cwd, ".gitignore");
  const gitignore = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf-8") : "";
  const existing = new Set(gitignore.split(/\r?\n/).map((line) => line.trim()));
  const missing = GITIGNORE_ENTRIES.filter((entry) => !existing.has(entry));
  if (missing.length > 0) {
    const separator = gitignore === "" || gitignore.endsWith("\n") ? "" : "\n";
    writeFileSync(gitignorePath, `${gitignore}${separator}\n# Storybook\n${missing.join("\n")}\n`);
    log(`✔ Added ${missing.join(", ")} to .gitignore`);
  }

  // Dependencies.
  const packageManager = detectPackageManager(cwd);
  const dependencies = getDependencies(skipTests);

  if (skipInstall) {
    const [command, args] = installCommand(packageManager, dependencies);
    log(`- Skipped installing dependencies. Install them with:\n\n    ${command} ${args.join(" ")}\n`);
  } else {
    log(`\nInstalling dependencies with ${packageManager}…\n`);
    run(...installCommand(packageManager, dependencies), cwd);

    if (!skipTests) {
      log("\nInstalling Chromium for the Storybook tests…\n");
      run(...execCommand(packageManager, ["playwright", "install", "chromium"]), cwd);
    }
  }

  log(`
Storybook is set up. Next:

  1. Install the xp-storybook app in your sandbox: https://market.enonic.com/vendors/item-consulting-as/storybook
  2. Deploy your app in dev mode, so edited templates are served from disk:  enonic project dev
  3. Start Storybook:  ${packageManager} run storybook
  4. Add "${FRAMEWORK}" to "compilerOptions.types" in the tsconfig.json that covers your
     *.stories.ts files, so that \`import id from "./my-part.ftl"\` type checks.

How to write stories: https://github.com/ItemConsulting/storybook-framework-enonic-xp#writing-stories
`);
}
