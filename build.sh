#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
node node_modules/vite/bin/vite.js build --config vite.config.mjs