// Exact prose only. Existing repetitions are review debt, not permission to
// delete semantic rules. Installed outputs and examples are never inputs.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { ROOT } from './build-skills.mjs';

export function duplicates(root = ROOT) {
  const catalog = JSON.parse(readFileSync(resolve(root, 'authoring/catalog.json'), 'utf8'));
  const blocks = new Map();
  for (const path of [...Object.values(catalog.entries), ...Object.values(catalog.fragments).map(f => f.source)]) {
    const text = readFileSync(resolve(root, path), 'utf8').replace(/```[\s\S]*?```/g, '');
    for (
      const block of new Set(
        text
          .split(/\n\s*\n/)
          .filter(b => b.length >= 120 && !b.startsWith('#') && !b.includes('{{include:'))
      )
    ) {
      const id = createHash('sha256').update(block).digest('hex');
      blocks.set(id, [...(blocks.get(id) || []), path]);
    }
  }
  return Object.fromEntries(
    [...blocks]
      .filter(([, paths]) => paths.length > 1)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, paths]) => [id, paths.sort()])
  );
}

const baseline = JSON.parse(readFileSync(resolve(ROOT, 'authoring/duplicate-baseline.json'), 'utf8'));
for (const [id, paths] of Object.entries(duplicates())) {
  if (JSON.stringify(paths) !== JSON.stringify(baseline.blocks[id]))
    throw new Error(`New authored duplication (${id}): ${paths.join(', ')}`);
}
console.log('Authoring duplicate baseline checked');
