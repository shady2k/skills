#!/usr/bin/env node
/**
 * The fake tracker's recipe with one more declared state file, `fake/policy.json`,
 * which no tracker command writes: the field's shape, where a declared state file
 * was added to the recipe after revisions were already recorded, so an older
 * commit of the store holds no copy of it. Used by the proof that a file a commit
 * truly does not hold reads as absent - never as a read that failed (#skills-by6c).
 *
 * Everything else is the fake's own recipe: the same commands, the same file.
 */
import def from './recipe.mjs';

export default {
  ...def,
  name: 'fake-policy',
  tracker: 'fake',
  stateFiles: [...def.stateFiles, 'fake/policy.json'],
};
