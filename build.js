#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Resolve vite binary from local node_modules
const viteBin = path.join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');
if (!fs.existsSync(viteBin)) {
  console.error('ERROR: No se encontró vite en node_modules');
  console.error('Buscando en:', viteBin);
  process.exit(1);
}

const result = spawnSync('node', [viteBin, 'build', '--config', 'vite.config.mjs'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env }
});
process.exit(result.status);