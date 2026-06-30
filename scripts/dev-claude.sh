#!/usr/bin/env bash
set -euo pipefail

ROOT="$(node -e 'const fs = require("fs"); const path = require("path"); console.log(path.dirname(path.dirname(fs.realpathSync(process.argv[1]))));' "${BASH_SOURCE[0]}")"

export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$ROOT}"
export CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$ROOT/.mcp-runtime}"

exec claude "$@"
