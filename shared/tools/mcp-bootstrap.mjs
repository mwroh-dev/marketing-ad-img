import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILES = ["mcp-server.mjs", "mcp-handlers.mjs", "catalog.ts"];

function debug(...args) {
  if (process.env.MARKETING_IMG_MCP_BOOTSTRAP_DEBUG) {
    console.error("[marketing-img mcp bootstrap]", ...args);
  }
}

function sameFile(a, b) {
  if (!existsSync(a) || !existsSync(b)) return false;
  return readFileSync(a, "utf8") === readFileSync(b, "utf8");
}

export function runtimePaths(env = process.env) {
  const pluginRoot = env.CLAUDE_PLUGIN_ROOT ? resolve(env.CLAUDE_PLUGIN_ROOT) : resolve(HERE, "../..");
  const pluginData = env.CLAUDE_PLUGIN_DATA ? resolve(env.CLAUDE_PLUGIN_DATA) : resolve(pluginRoot, ".mcp-runtime");
  const runtimeRoot = resolve(pluginData, "runtime");
  return {
    pluginRoot,
    pluginData,
    runtimeRoot,
    sourceToolsDir: resolve(pluginRoot, "shared/tools"),
    runtimeToolsDir: resolve(runtimeRoot, "shared/tools"),
    packageJson: resolve(pluginRoot, "package.json"),
    packageLock: resolve(pluginRoot, "package-lock.json"),
    dataPackageJson: resolve(pluginData, "package.json"),
    dataPackageLock: resolve(pluginData, "package-lock.json"),
    tsxBin: resolve(pluginData, "node_modules/.bin/tsx"),
    serverEntry: resolve(runtimeRoot, "shared/tools/mcp-server.mjs"),
  };
}

export function copyRuntimeFiles(paths) {
  mkdirSync(paths.runtimeToolsDir, { recursive: true });
  for (const file of SOURCE_FILES) {
    copyFileSync(resolve(paths.sourceToolsDir, file), resolve(paths.runtimeToolsDir, file));
  }
}

function installNeeded(paths) {
  return !existsSync(paths.tsxBin) || !sameFile(paths.packageJson, paths.dataPackageJson) || (existsSync(paths.packageLock) && !sameFile(paths.packageLock, paths.dataPackageLock));
}

export function ensureRuntimeDependencies(paths, options = {}) {
  mkdirSync(paths.pluginData, { recursive: true });
  if (!installNeeded(paths)) return;

  copyFileSync(paths.packageJson, paths.dataPackageJson);
  const args = existsSync(paths.packageLock)
    ? ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"]
    : ["install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"];
  if (existsSync(paths.packageLock)) {
    copyFileSync(paths.packageLock, paths.dataPackageLock);
  }
  const run = options.runCommand ?? spawnSync;
  const result = run("npm", args, {
    cwd: paths.pluginData,
    encoding: "utf8",
    stdio: ["ignore", "ignore", "pipe"],
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`failed to install plugin MCP runtime dependencies: ${result.stderr || `exit ${result.status}`}`);
  }
}

export function prepareRuntime(env = process.env, options = {}) {
  const paths = runtimePaths(env);
  copyRuntimeFiles(paths);
  ensureRuntimeDependencies(paths, options);
  return paths;
}

function startServer(paths) {
  debug("starting server", paths.serverEntry, "with", paths.tsxBin);
  const child = spawn(paths.tsxBin, [paths.serverEntry], {
    cwd: paths.pluginRoot,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: paths.pluginRoot,
      CLAUDE_PLUGIN_DATA: paths.pluginData,
    },
    stdio: ["pipe", "pipe", "inherit"],
  });
  process.stdin.on("data", (chunk) => {
    debug("forward stdin chunk", chunk.length);
    child.stdin.write(chunk);
  });
  process.stdin.on("end", () => {
    debug("stdin end");
    child.stdin.end();
  });
  process.stdin.resume();
  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  child.stdin.on("error", (error) => {
    if (error.code !== "EPIPE") {
      console.error(error);
    }
  });
  child.on("exit", (code, signal) => {
    debug("child exit", code, signal);
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
}

function isEntrypoint() {
  if (!process.argv[1]) return false;
  return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(resolve(process.argv[1]));
}

if (isEntrypoint()) {
  try {
    const paths = prepareRuntime();
    if (process.argv.includes("--prepare-only")) {
      process.exit(0);
    }
    startServer(paths);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
