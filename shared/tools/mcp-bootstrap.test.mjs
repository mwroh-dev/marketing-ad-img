import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { ensureRuntimeDependencies, forwardStreamWithBackpressure } from "./mcp-bootstrap.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");

function writeExecutable(path, content) {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

test("MCP bootstrap prepares plugin-data runtime without requiring plugin-root node_modules", () => {
  const pluginRoot = mkdtempSync(`${tmpdir()}/marketing-img-plugin-root-`);
  const pluginData = mkdtempSync(`${tmpdir()}/marketing-img-plugin-data-`);
  const fakeBin = mkdtempSync(`${tmpdir()}/marketing-img-fake-bin-`);
  mkdirSync(resolve(pluginRoot, "shared/tools"), { recursive: true });
  mkdirSync(resolve(pluginRoot, ".claude-plugin"), { recursive: true });
  for (const file of ["mcp-bootstrap.mjs", "mcp-server.mjs", "mcp-handlers.mjs", "mcp-runtime-registry.mjs", "catalog.ts", "definitions.ts", "types.ts"]) {
    writeFileSync(resolve(pluginRoot, "shared/tools", file), readFileSync(resolve(ROOT, "shared/tools", file), "utf8"));
  }
  writeFileSync(resolve(pluginRoot, "package.json"), readFileSync(resolve(ROOT, "package.json"), "utf8"));
  writeFileSync(resolve(pluginRoot, "package-lock.json"), readFileSync(resolve(ROOT, "package-lock.json"), "utf8"));
  writeExecutable(
    resolve(fakeBin, "npm"),
    `#!/bin/sh
set -eu
printf '%s\\n' "$@" > npm-args.txt
mkdir -p node_modules/.bin
printf '#!/bin/sh\\n' > node_modules/.bin/tsx
chmod +x node_modules/.bin/tsx
`,
  );

  const result = spawnSync(process.execPath, [resolve(pluginRoot, "shared/tools/mcp-bootstrap.mjs"), "--prepare-only"], {
    cwd: pluginRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_PLUGIN_DATA: pluginData,
      PATH: `${fakeBin}:${process.env.PATH}`,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(existsSync(resolve(pluginRoot, "node_modules")), false);
  assert.equal(existsSync(resolve(pluginData, "node_modules/.bin/tsx")), true);
  assert.equal(existsSync(resolve(pluginData, "runtime/shared/tools/mcp-server.mjs")), true);
  assert.equal(existsSync(resolve(pluginData, "runtime/shared/tools/mcp-handlers.mjs")), true);
  assert.equal(existsSync(resolve(pluginData, "runtime/shared/tools/mcp-runtime-registry.mjs")), true);
  assert.equal(existsSync(resolve(pluginData, "runtime/shared/tools/catalog.ts")), true);
  assert.equal(existsSync(resolve(pluginData, "runtime/shared/tools/definitions.ts")), true);
  assert.equal(existsSync(resolve(pluginData, "runtime/shared/tools/types.ts")), true);
  assert.equal(readFileSync(resolve(pluginData, "package.json"), "utf8"), readFileSync(resolve(pluginRoot, "package.json"), "utf8"));
  const npmArgs = readFileSync(resolve(pluginData, "npm-args.txt"), "utf8");
  assert.match(npmArgs, /--omit=dev/);
  assert.doesNotMatch(npmArgs, /--omit=optional/);
});

test("MCP bootstrap reports npm execution failures clearly", () => {
  const pluginRoot = mkdtempSync(`${tmpdir()}/marketing-img-plugin-root-`);
  const pluginData = mkdtempSync(`${tmpdir()}/marketing-img-plugin-data-`);
  writeFileSync(resolve(pluginRoot, "package.json"), "{}\n");

  assert.throws(
    () =>
      ensureRuntimeDependencies(
        {
          pluginData,
          tsxBin: resolve(pluginData, "node_modules/.bin/tsx"),
          packageJson: resolve(pluginRoot, "package.json"),
          packageLock: resolve(pluginRoot, "package-lock.json"),
          dataPackageJson: resolve(pluginData, "package.json"),
          dataPackageLock: resolve(pluginData, "package-lock.json"),
        },
        {
          runCommand: () => ({
            status: null,
            error: new Error("spawn npm ENOENT"),
          }),
        },
      ),
    /npm command failed to execute .*spawn npm ENOENT/,
  );
});

test("MCP bootstrap pauses stdin while child stdin applies backpressure", () => {
  const source = new EventEmitter();
  const sink = new EventEmitter();
  const events = [];
  source.pause = () => events.push("pause");
  source.resume = () => events.push("resume");
  sink.write = () => false;

  forwardStreamWithBackpressure(source, sink, () => {});
  source.emit("data", Buffer.from("payload"));
  assert.deepEqual(events, ["resume", "pause"]);

  sink.emit("drain");
  assert.deepEqual(events, ["resume", "pause", "resume"]);

  source.emit("end");
  assert.deepEqual(events, ["resume", "pause", "resume"]);
});
