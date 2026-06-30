#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export CLAUDE_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$ROOT}"
export CLAUDE_PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$ROOT/.mcp-runtime}"

exec claude "$@"
