#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SHARED } from '../test/sync-protocol.mjs';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(p, 'utf8');
export function render(text, fragments, readSource, seen = new Set(), stack = []) {
  const result = text.replace(/\{\{include:([^{}]+)\}\}/g, (_, id) => {
    if (!Object.hasOwn(fragments, id)) throw new Error(`Unknown fragment: ${id}`);
    if (stack.includes(id)) throw new Error(`Include cycle: ${[...stack, id].join(' -> ')}`);
    if (seen.has(id)) throw new Error(`Duplicate include: ${id}`);
    seen.add(id);
    return render(readSource(fragments[id].source), fragments, readSource, seen, [...stack, id]);
  });
  if (/\{\{include/.test(result)) throw new Error('Malformed include directive');
  return result;
}
export function build(root = ROOT, check = false) {
  const catalog = JSON.parse(read(resolve(root, 'authoring/catalog.json')));
  const referencePrefix = 'skills/backlog/setup-shady2k-skills/references/';
  const shared = {...SHARED, ...Object.fromEntries(Object.keys(catalog.entries)
    .filter(p => p.startsWith(referencePrefix) && p.endsWith('.md'))
    .map(p => [`references/${p.slice(referencePrefix.length)}`, 'skills/backlog/setup-shady2k-skills']))};
  const safe = (p, prefix) => {
    if (!p.startsWith(prefix) || relative(resolve(root, prefix), resolve(root, p)).startsWith('..')) throw new Error(`Invalid path: ${p}`);
    return resolve(root, p);
  };
  for (const [id, f] of Object.entries(catalog.fragments)) {
    if (!/^[a-z0-9-]+$/.test(id) || !catalog.entries[f.owner]) throw new Error(`Invalid fragment owner/ID: ${id}`);
    safe(f.source, 'authoring/');
    render(`{{include:${id}}}`, catalog.fragments, p => read(safe(p, 'authoring/')));
  }
  const outputs = new Map();
  for (const [target, source] of Object.entries(catalog.entries)) {
    safe(target, 'skills/'); safe(source, 'authoring/');
    outputs.set(target, render(read(resolve(root, source)), catalog.fragments, p => read(safe(p, 'authoring/'))));
  }
  const walk = d => readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(resolve(d,e.name)) : [resolve(d,e.name)]);
  for (const p of walk(resolve(root,'skills')).filter(p => p.endsWith('/SKILL.md') || (relative(root,p).startsWith(referencePrefix) && p.endsWith('.md')))) {
    if (!outputs.has(relative(root,p))) throw new Error(`Entry has no template: ${relative(root,p)}`);
  }
  // Compute the same transitive closure as the existing packager, without
  // mutating outputs during --check. Validate canonical links before writing.
  for (const target of [...outputs.keys()].filter(p => p.endsWith('/SKILL.md'))) {
    const folder = dirname(target), needed = new Set();
    const follow = (from, text) => {
      for (const [, link] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g)) {
        const path = relative(resolve(root,folder),resolve(root,folder,dirname(from),link));
        if (!Object.hasOwn(shared,path)) {
          if (path.startsWith('references/') || path === 'protocol.md') throw new Error(`Unknown shared reference: ${target}: ${link}`);
          continue;
        }
        if (needed.has(path)) continue;
        needed.add(path);
        const owner = `${shared[path]}/${path}`;
        const content = outputs.get(owner) ?? read(resolve(root,owner));
        outputs.set(`${folder}/${path}`,content);
        if (path.endsWith('.md')) follow(path,content);
      }
    };
    follow('SKILL.md',outputs.get(target));
    if (check) for (const path of new Set([...Object.keys(shared), ...(() => { try { return readdirSync(resolve(root,folder,'references')).map(n => `references/${n}`); } catch { return []; } })()])) {
      if (shared[path] === folder || needed.has(path)) continue;
      try { read(resolve(root,folder,path)); } catch { continue; }
      throw new Error(`Unreached generated resource: ${folder}/${path}`);
    }
  }
  for (const [target,text] of outputs) if (target.endsWith('.md')) {
    for (const [,link] of text.replace(/```[\s\S]*?```/g,'').matchAll(/\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith('/') || /[<>{}$]/.test(link)) continue;
      const destination = relative(root,resolve(root,dirname(target),link));
      if (!outputs.has(destination) && !existsSync(resolve(root,destination))) throw new Error(`Missing local link: ${target}: ${link}`);
    }
  }
  for (const [target, text] of outputs) {
    let current; try { current = read(resolve(root,target)); } catch {}
    if (current === text) continue;
    if (check) throw new Error(`Stale generated output: ${target}; edit authoring sources, then npm run build`);
    if (Object.hasOwn(catalog.entries,target)) {
      mkdirSync(dirname(resolve(root,target)),{recursive:true});
      writeFileSync(resolve(root,target),text);
    }
  }
  return outputs;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--check')) throw new Error('Usage: build-skills.mjs [--check]');
  const check = args.includes('--check');
  const outputs = build(ROOT,check);
  // Keep the existing transitive packaging and pruning implementation.
  if (!check) {
    const result = spawnSync(process.execPath, ['test/sync-protocol.mjs'], {cwd:ROOT,stdio:'inherit'});
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.log(`${check ? 'Checked' : 'Built'} ${outputs.size} generated files`);
}
