/**
 * The machine-readable list of what setup installs into a project, shared by
 * test/setup-lock.mjs (digest lock) and test/setup-imports.mjs (import walk).
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Files and directories every project gets: the checks and their helpers, the
// integration seed and the model and document references.
export const INSTALLED = ['check.mjs', 'check-commits.mjs', 'check-docs.mjs', 'check-present.mjs', 'check-product.mjs', 'document-format.mjs', 'time-format.mjs', 'regular-file.mjs', 'argv.mjs',
  'integration.md', 'model.md', 'documents.md', 'templates', 'adapters'];

// What setup installs only where the project chose the off-branch tracker
// layout: the mechanism, the recipes and the supervisor template. See
// test/setup-lock.mjs for why these are locked apart from the version-bound list.
export const LAYOUT = ['tracker-sync.mjs', 'trackers', 'supervisors'];

export const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).sort().flatMap((n) => walk(join(p, n))) : [p]);
