#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateSubagentProjection } from "../collect/subagent-projection-guard.mjs";

function usage() {
  console.error("Usage: node shared/harness/validate-subagent-projection.mjs <agent_name> <handoff.json> [--persona <persona_id>]");
}

const [agentName, handoffPath, ...rest] = process.argv.slice(2);
if (!agentName || !handoffPath) {
  usage();
  process.exit(2);
}

let persona_id;
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--persona") persona_id = rest[++i];
}

const handoff = JSON.parse(readFileSync(resolve(handoffPath), "utf8"));
const result = validateSubagentProjection(agentName, handoff, { persona_id });
if (result.ok) {
  console.log(`PASS subagent projection ${agentName}`);
  process.exit(0);
}

console.error(`FAIL subagent projection ${agentName}`);
for (const error of result.errors) console.error(`  - ${error}`);
process.exit(1);
