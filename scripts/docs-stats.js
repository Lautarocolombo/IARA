#!/usr/bin/env node
// Script para generar estadísticas dinámicas del README
// Uso: node scripts/docs-stats.js

const fs = require('fs');
const path = require('path');

function countFiles(dir, ext) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      count += countFiles(fullPath, ext);
    } else if (ext && file.endsWith(ext)) {
      count++;
    } else if (!ext) {
      count++;
    }
  }
  return count;
}

function countLinesInTestFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      total += countLinesInTestFiles(fullPath);
    } else if (file.endsWith('.test.js') || file.endsWith('.spec.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      // Contar líneas con 'test(' o 'it('
      const matches = content.match(/^\s*(test|it)\(/gm);
      if (matches) total += matches.length;
    }
  }
  return total;
}

function getGitStats() {
  try {
    const { execSync } = require('child_process');
    const commits = execSync('git log --oneline --all | wc -l', { encoding: 'utf8' }).trim();
    const branches = execSync('git branch -a | wc -l', { encoding: 'utf8' }).trim();
    const contributors = execSync('git shortlog -sn --all | wc -l', { encoding: 'utf8' }).trim();
    return { commits, branches, contributors };
  } catch {
    return { commits: 'N/A', branches: 'N/A', contributors: 'N/A' };
  }
}

const frontendJsDir = path.join(__dirname, '..', 'frontend', 'js');
const backendSrcDir = path.join(__dirname, '..', 'backend', 'src');
const testsDir = path.join(__dirname, '..', 'tests');
const frontendTestsDir = path.join(__dirname, '..', 'frontend', 'tests');
const backendTestsDir = path.join(__dirname, '..', 'backend', 'tests');

const stats = {
  frontend: {
    jsFiles: countFiles(frontendJsDir, '.js'),
    jsLines: (() => {
      let lines = 0;
      if (fs.existsSync(frontendJsDir)) {
        const files = fs.readdirSync(frontendJsDir);
        for (const file of files) {
          if (file.endsWith('.js')) {
            lines += fs.readFileSync(path.join(frontendJsDir, file), 'utf8').split('\n').length;
          }
        }
      }
      return lines;
    })(),
    pages: countFiles(path.join(__dirname, '..', 'frontend', 'pages'), '.html'),
    cssFiles: countFiles(path.join(__dirname, '..', 'frontend', 'css'), '.css'),
  },
  backend: {
    jsFiles: countFiles(backendSrcDir, '.js'),
    jsLines: (() => {
      let lines = 0;
      if (fs.existsSync(backendSrcDir)) {
        const files = fs.readdirSync(backendSrcDir, { recursive: true });
        for (const file of files) {
          if (file.endsWith('.js')) {
            const fullPath = path.join(backendSrcDir, file);
            if (fs.existsSync(fullPath)) {
              lines += fs.readFileSync(fullPath, 'utf8').split('\n').length;
            }
          }
        }
      }
      return lines;
    })(),
    controllers: countFiles(path.join(backendSrcDir, 'controllers'), '.js'),
    routes: countFiles(path.join(backendSrcDir, 'routes'), '.js'),
    middleware: countFiles(path.join(backendSrcDir, 'middleware'), '.js'),
    libs: countFiles(path.join(backendSrcDir, 'lib'), '.js'),
  },
  tests: {
    frontendUnit: countLinesInTestFiles(testsDir) + countLinesInTestFiles(frontendTestsDir),
    backendUnit: countLinesInTestFiles(backendTestsDir),
    totalUnit: countLinesInTestFiles(testsDir) + countLinesInTestFiles(frontendTestsDir) + countLinesInTestFiles(backendTestsDir),
  },
  git: getGitStats(),
};

console.log('## Estadísticas del proyecto (generadas automáticamente)');
console.log('');
console.log('| Métrica | Valor |');
console.log('|---------|-------|');
console.log(`| Archivos JS frontend | ${stats.frontend.jsFiles} |`);
console.log(`| Líneas JS frontend | ${stats.frontend.jsLines.toLocaleString()} |`);
console.log(`| Páginas HTML | ${stats.frontend.pages} |`);
console.log(`| Archivos CSS | ${stats.frontend.cssFiles} |`);
console.log(`| Archivos JS backend | ${stats.backend.jsFiles} |`);
console.log(`| Líneas JS backend | ${stats.backend.jsLines.toLocaleString()} |`);
console.log(`| Controladores | ${stats.backend.controllers} |`);
console.log(`| Rutas | ${stats.backend.routes} |`);
console.log(`| Middlewares | ${stats.backend.middleware} |`);
console.log(`| Librerías | ${stats.backend.libs} |`);
console.log(`| Tests unitarios frontend | ${stats.tests.frontendUnit} |`);
console.log(`| Tests unitarios backend | ${stats.tests.backendUnit} |`);
console.log(`| **Total tests unitarios** | **${stats.tests.totalUnit}** |`);
console.log(`| Commits totales | ${stats.git.commits} |`);
console.log(`| Ramas | ${stats.git.branches} |`);
console.log(`| Contribuyentes | ${stats.git.contributors} |`);
console.log('');
console.log('---');
console.log('*Generado con `npm run docs:stats` — no editar manualmente*');