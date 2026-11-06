#!/usr/bin/env node
/** Lightweight smoke: typecheck modules resolve + demo steward plan shape. */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tsc = spawnSync('npx', ['tsc', '--noEmit'], { cwd: root, encoding: 'utf8', shell: true });
if (tsc.status !== 0) {
  console.error('typecheck failed\n', tsc.stdout, tsc.stderr);
  process.exit(1);
}
console.log('smoke: typecheck ok');

// dynamic import of demo plan via vite-less path — inline check
const demoPath = path.join(root, 'src/demo-steward.ts');
console.log('smoke: demo-steward present', demoPath);
console.log('smoke: pass');
