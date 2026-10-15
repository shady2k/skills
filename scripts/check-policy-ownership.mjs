#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './build-skills.mjs';

const normalize = text => text.replace(/\s+/g, ' ').trim();
const literalPattern = text => normalize(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function policyInputs(root = ROOT) {
  const catalog = JSON.parse(readFileSync(resolve(root, 'authoring/catalog.json'), 'utf8'));
  return Object.fromEntries(
    [...new Set([...Object.values(catalog.entries), ...Object.values(catalog.fragments).map(f => f.source)])].map(
      path => [path, readFileSync(resolve(root, path), 'utf8')]
    )
  );
}

export function checkPolicies(texts, manifest) {
  const errors = [];
  for (const group of manifest.groups) {
    const owner = normalize(texts[group.owner] ?? '');
    for (const required of group.required)
      if (!owner.includes(normalize(required)))
        errors.push(`${group.id}: lost condition at ${group.owner}: ${required}`);
    const patterns = [...new Set([...group.exclusive, ...group.required.map(literalPattern)])];
    for (const pattern of patterns) {
      if ([...owner.matchAll(new RegExp(pattern, 'g'))].length !== 1)
        errors.push(`${group.id}: policy definition must occur once in its owner: ${pattern}`);
    }
    for (const pattern of patterns)
      for (const [path, text] of Object.entries(texts)) {
        if (path !== group.owner && new RegExp(pattern).test(normalize(text)))
          errors.push(`${group.id}: repeated policy outside owner: ${path}`);
      }
    for (const [path, required] of Object.entries(group.consumers))
      for (const value of required) {
        if (!normalize(texts[path] ?? '').includes(normalize(value)))
          errors.push(`${group.id}: lost link or distinct step condition at ${path}: ${value}`);
      }
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, 'authoring/policy-ownership.json'), 'utf8'));
  const errors = checkPolicies(policyInputs(), manifest);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`Checked ${manifest.groups.length} policy owners and distinct consumer conditions`);
}
