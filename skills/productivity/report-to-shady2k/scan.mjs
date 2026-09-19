#!/usr/bin/env node
// Finds what must not leave the machine in a report draft: the project's own
// names, people, paths, addresses and secrets. It catches known shapes, not
// everything; the person reading the exact text before it is sent is the rest.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { hostname, userInfo } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGET = 'https://github.com/shady2k/skills';
const ALWAYS_ALLOWED = ['shady2k', 'skills', 'github', 'claude', 'codex'];

const PATTERNS = [
  ['email address', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-]*:)/g],
  ['home path', /(?:\/home\/|\/Users\/|[A-Za-z]:\\Users\\)[^\s/\\'"`]+/g],
  ['git remote', /\b[\w.-]+@[\w.-]+:[\w./-]+/g],
  ['URL', /\bhttps?:\/\/[^\s)>\]'"`]+/g],
  ['IP address', /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
  ['secret', /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g],
  ['commit hash', /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/g],
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function scan(text, words = [], allow = []) {
  const allowed = new Set([...ALWAYS_ALLOWED, ...allow].map((w) => w.toLowerCase()));
  const listed = [...new Set(words.map((w) => w.trim()).filter((w) => w.length >= 3 && !allowed.has(w.toLowerCase())))];
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const w of listed) {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(w)}(?=$|[^\\p{L}\\p{N}])`, 'giu');
      for (const m of line.matchAll(re)) hits.push({ line: i + 1, kind: 'listed name', match: m[0].slice(m[1].length) });
    }
    for (const [kind, re] of PATTERNS)
      for (const m of line.matchAll(re)) {
        if (kind === 'URL' && (m[0] === TARGET || m[0].startsWith(`${TARGET}/`))) continue;
        if (kind === 'IP address' && ['127.0.0.1', '0.0.0.0'].includes(m[0])) continue;
        if (allowed.has(m[0].toLowerCase())) continue;
        hits.push({ line: i + 1, kind, match: m[0] });
      }
  });
  return hits;
}

const git = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

// Names this machine and checkout reveal about the person and the project.
export function localWords() {
  const words = [];
  const top = git('rev-parse', '--show-toplevel');
  if (top) {
    words.push(basename(top));
    const pkg = join(top, 'package.json');
    if (existsSync(pkg)) try { words.push(JSON.parse(readFileSync(pkg, 'utf8')).name || ''); } catch {}
  }
  for (const url of git('remote', '-v').split('\n').map((l) => l.split(/\s+/)[1]).filter(Boolean))
    words.push(...url.replace(/\.git$/, '').split(/[/:@]/).slice(-2));
  const name = git('config', 'user.name');
  words.push(name, ...name.split(/\s+/), git('config', 'user.email'));
  try { words.push(userInfo().username); } catch {}
  words.push(hostname());
  return words.flatMap((w) => w.split(/[/@]/)).filter((w) => w && !/^[\w.-]*\.(com|org|net|io)$/.test(w));
}

function selftest() {
  const cases = [
    ['clean report', 'The setup skill listed tasks by number instead of title.', [], [], []],
    ['a listed project name', 'Setup in acme-portal failed.', ['acme-portal'], [], ['listed name']],
    ['a name inside a longer word is not a hit', 'The megaacme tool.', ['acme'], [], []],
    ['an allowed word', 'Setup in acme failed.', ['acme'], ['acme'], []],
    ['email', 'Reported by jane.doe@example.org.', [], [], ['email address']],
    ['home path', 'Config at /home/jane/work/app.json.', [], [], ['home path']],
    ['foreign URL', 'See https://tracker.example.com/T-1.', [], [], ['URL']],
    ['the target repository', `Related to ${TARGET}/issues/3.`, [], [], []],
    ['ssh remote', 'Remote git@example.com:team/app.git.', [], [], ['git remote']],
    ['IP address', 'Server 10.1.2.3 timed out.', [], [], ['IP address']],
    ['secret', 'Token ghp_abcdefghijklmnopqrstuvwxyz123456 leaked.', [], [], ['secret']],
    ['commit hash', 'Broken since 4a1ad662.', [], [], ['commit hash']],
    ['plain words are not hashes', 'A facade was added.', [], [], []],
  ];
  let failed = 0;
  for (const [name, text, words, allow, want] of cases) {
    const got = scan(text, words, allow).map((h) => h.kind).sort();
    const ok = JSON.stringify(got) === JSON.stringify([...want].sort());
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  scan: ${name}${ok ? '' : ` (got ${JSON.stringify(got)})`}`);
  }
  return failed ? 1 : 0;
}

function main(args) {
  const usage = 'scan.mjs --draft <file> [--config <gate-config.json>] [--word <w>]... [--allow <w>]...\nscan.mjs --selftest\nExit 0 clean, 1 something to remove, 2 invalid use.';
  if (args.length === 1 && args[0] === '--selftest') return selftest();
  const opts = { draft: null, config: null, word: [], allow: [] };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    if (!(key in opts) || args[i + 1] === undefined) {
      console.error(usage);
      return 2;
    }
    if (Array.isArray(opts[key])) opts[key].push(args[i + 1]);
    else opts[key] = args[i + 1];
  }
  if (!opts.draft) {
    console.error(usage);
    return 2;
  }
  let text;
  const words = [...localWords(), ...opts.word];
  try {
    text = readFileSync(opts.draft, 'utf8');
    if (opts.config) {
      const config = JSON.parse(readFileSync(opts.config, 'utf8'));
      words.push(...(config.projectWords || []), ...(config.trackerWords || []));
    }
  } catch (e) {
    console.error(e.message);
    return 2;
  }
  const hits = scan(text, words, opts.allow);
  for (const h of hits) console.log(`line ${h.line}: ${h.kind} "${h.match}"`);
  console.log(hits.length ? `${hits.length} to remove or replace` : 'clean');
  return hits.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = main(process.argv.slice(2));
