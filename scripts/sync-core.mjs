#!/usr/bin/env node
/** Sync core/ engine to tenant site repos */
import { cpSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = join(root, 'core');
const targets = [
  join(root, '..', 'yachts.astranov.eu', 'core'),
  join(root, '..', 'frogschool.astranov.eu', 'core'),
  join(root, '..', 'Astranov', 'src', 'match-core'),
];

for (const t of targets) {
  if (!existsSync(dirname(t))) continue;
  mkdirSync(t, { recursive: true });
  for (const f of readdirSync(core)) {
    if (f.endsWith('.js') || f.endsWith('.css')) {
      cpSync(join(core, f), join(t, f), { force: true });
    }
  }
  console.log('Synced core →', t);
}