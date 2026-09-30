#!/usr/bin/env node
/**
 * Jev as a tool the agent sees in its list, not a paragraph it must recall.
 *
 * An agent picks its actions from its tools; a rule in prose works only when
 * it recalls it at the moment, and over three days of runs no agent did. This
 * server is a thin face over jev.mjs, which stays the one way text reaches Jev:
 * consent, the key and masking are its, and the set's scripts keep calling it
 * directly. What this adds is the shape of the call: the agent names the pile
 * (a file cut into items, several files, or a short list) instead of reading it
 * to hand it over, and gets back only what Jev settled and what is left to read.
 *
 * MCP over stdio, newline-delimited JSON-RPC, no dependencies. The project is
 * the directory the harness starts the server in, or CLAUDE_PROJECT_DIR.
 *
 *   node jev-server.mjs            serve on stdin/stdout
 *   node jev-server.mjs --selftest
 */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ask, findConfig, summary, Unavailable } from '../skills/backlog/setup-shady2k-skills/jev.mjs';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const MAX_ITEMS = 1000;
const MAX_FILE = 16 << 20;
const EXCERPT = 160;

class Misuse extends Error {}

export const TOOL = {
  name: 'ask_each',
  title: 'Jev: one question asked of each item in a pile',
  description: [
    'Sort a pile before you read it. Jev, a fast decision model, reads each item alone and picks one of the answers you give,',
    'in seconds and for a fraction of a cent for hundreds of items; you then read only the items it was not sure of.',
    'Use it whenever you are about to open many items (about ten or more) or one long text just to answer the same question',
    'of each: which search hits are real call sites and which are mentions in comments or strings; which failing tests share',
    'one of the causes you already suspect; which files set an option; which review findings repeat one already handled;',
    'which sections of a long test, build or bench log show a failure. Write the output of a search or a run to a file and',
    'name the file here instead of reading it.',
    'Not for one judgement you can make yourself, for comparing items with each other, for counting or arithmetic, or for',
    'short literal items a pattern already decides. Answers are taken only where Jev is sure (0.9 and above); the rest come',
    'back to you. Nothing hard to reverse (closing, deleting, merging, telling the user) rests on its answer alone.',
    'It works only where the project agreed to send text to Jev; text is masked before it leaves. When it says Jev is',
    'unavailable, read for yourself and do not call it again in this session.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The one question asked of every item, e.g. "Is this line a real call of parseConfig?"' },
      answers: {
        type: 'object', additionalProperties: { type: 'string' },
        description: 'Answer name to a plain description of what it means, e.g. {"call": "a call of the function", '
          + '"mention": "a mention in a comment, string or doc"}. "none" is added as a way out. For kind "check": {"true": ..., "false": ...}.',
      },
      kind: { type: 'string', enum: ['choice', 'check'], default: 'choice', description: 'choice: pick one of the answers; check: yes or no.' },
      file: { type: 'string', description: 'A file to cut into items: search output, a log, a list. Relative to the project.' },
      split: {
        type: 'string', enum: ['line', 'blank', 'separator'], default: 'line',
        description: 'How the file is cut: each non-empty line; blocks between blank lines; or a new item at each line matching "separator".',
      },
      separator: { type: 'string', description: 'For split "separator": a regular expression; each line it matches starts an item (e.g. "^--- FAIL" or "^=== ").' },
      files: { type: 'array', items: { type: 'string' }, description: 'Several files, each one item, named by its path.' },
      items: {
        type: 'array', description: 'A short list given directly, when there is no file: strings, or {"id", "text"}.',
        items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['text'] }] },
      },
      context: { type: 'string', description: 'What every item needs to be judged, said once (e.g. what the function does).' },
      config: { type: 'string', description: 'The project\'s gate config; found in the working copy when left out.' },
    },
    required: ['question', 'answers'],
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
};

const oneLine = (text) => {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length <= EXCERPT ? s : `${s.slice(0, EXCERPT - 1)}…`;
};

// A path comes from the model, which can be steered by what it has read, so it
// is untrusted: only a regular file under the project or the temporary
// directory (where a search or a run writes its output), after links are
// resolved, and never one named as a credential store.
const CREDENTIAL = /^(?:\.ssh|\.gnupg|\.aws|\.azure|\.kube|\.docker|\.gcloud|\.password-store|\.netrc|\.npmrc|\.pypirc|\.git-credentials|\.env(?:\..+)?|id_[a-z0-9]+|.*\.(?:pem|key|p12|pfx|kdbx))$/i;

export function allowed(file, roots) {
  const parts = file.split(sep);
  if (parts.some((p) => CREDENTIAL.test(p))) return false;
  return roots.some((root) => { const rel = relative(root, file); return rel && !rel.startsWith('..') && !isAbsolute(rel); });
}

const real = (p) => { try { return realpathSync(p); } catch { return null; } };

function readText(dir, path) {
  const roots = [dir, tmpdir()].map(real).filter(Boolean);
  const file = real(isAbsolute(path) ? path : resolve(dir, path));
  if (!file) throw new Misuse(`${path} cannot be read`);
  if (!allowed(file, roots)) throw new Misuse(`${path} is outside the project and the temporary directory, or holds credentials; it is not read`);
  let size;
  try { const st = statSync(file); if (!st.isFile()) throw new Error(); size = st.size; } catch { throw new Misuse(`${path} cannot be read`); }
  if (size > MAX_FILE) throw new Misuse(`${path} is over ${MAX_FILE >> 20} MB; cut it first`);
  return readFileSync(file, 'utf8');
}

/** The pile named in the call, as items with ids that point back into it. */
export function pile(args, dir, read = readText) {
  const given = ['file', 'files', 'items'].filter((k) => args[k] !== undefined);
  if (given.length !== 1) throw new Misuse('name the pile once: "file", "files" or "items"');
  let items;
  if (args.items) {
    if (!Array.isArray(args.items)) throw new Misuse('"items" is a list');
    items = args.items.map((it, i) => (typeof it === 'string' ? { id: String(i + 1), text: it }
      : { id: String(it?.id ?? i + 1), text: typeof it?.text === 'string' ? it.text : null }));
    if (items.some((it) => it.text === null)) throw new Misuse('every item in "items" has a "text"');
  } else if (args.files) {
    if (!Array.isArray(args.files) || !args.files.length) throw new Misuse('"files" is a list of paths');
    items = args.files.map((f) => ({ id: String(f), text: read(dir, String(f)) }));
  } else {
    const lines = read(dir, String(args.file)).split(/\r?\n/);
    const split = args.split || 'line';
    items = [];
    if (split === 'line') {
      lines.forEach((l, i) => { if (l.trim()) items.push({ id: `line ${i + 1}`, text: l }); });
    } else {
      let starts;
      if (split === 'blank') starts = (l, i) => l.trim() && (i === 0 || !lines[i - 1].trim());
      else if (split === 'separator') {
        if (!args.separator) throw new Misuse('split "separator" needs "separator", a regular expression');
        let re;
        try { re = new RegExp(args.separator); } catch { throw new Misuse('"separator" is not a regular expression'); }
        starts = (l, i) => i === 0 || re.test(l);
      } else throw new Misuse('"split" is line, blank or separator');
      let from = -1;
      const close = (to) => {
        if (from < 0) return;
        const text = lines.slice(from, to).join('\n').replace(/\s+$/, '');
        if (text.trim()) items.push({ id: `lines ${from + 1}-${from + text.split('\n').length}`, text });
      };
      lines.forEach((l, i) => { if (starts(l, i)) { close(i); from = i; } });
      close(lines.length);
    }
  }
  if (!items.length) throw new Misuse('the pile is empty');
  if (items.length > MAX_ITEMS) throw new Misuse(`${items.length} items is over ${MAX_ITEMS}; narrow the search or cut coarser`);
  return items;
}

/** What the agent reads back: settled ids by answer, and the items left to it with a line of each. */
export function report(items, answers, cost) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const settled = {};
  const yours = [];
  const unsent = [];
  for (const a of answers) {
    if (a.sent === false) unsent.push(`- ${a.id}: not sent, ${a.why} — ${oneLine(byId.get(a.id)?.text || '')}`);
    else if (a.settled) (settled[a.answer] ||= []).push(a.id);
    else yours.push(`- ${a.id} (leans ${a.answer ?? 'nowhere'}, ${a.p}) — ${oneLine(byId.get(a.id)?.text || '')}`);
  }
  const out = [summary(answers, cost)];
  for (const [answer, ids] of Object.entries(settled)) out.push('', `Settled "${answer}" (${ids.length}): ${ids.join(', ')}`);
  if (yours.length) out.push('', `Yours to read (${yours.length}), Jev was not sure:`, ...yours);
  if (unsent.length) out.push('', `Not sent (${unsent.length}), read these yourself:`, ...unsent);
  return out.join('\n');
}

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * The project a call is about. Harnesses say it differently: Claude Code sets
 * CLAUDE_PROJECT_DIR; omp starts the server in the session's directory; Codex
 * starts it in the plugin (it expands no placeholder in its manifest), so there
 * the call's own workspace is read, and the shell's PWD it forwards is the last
 * resort. The plugin's own folder is never taken for the project.
 */
export function projectDir({ env = process.env, cwd = process.cwd(), meta, root = ROOT } = {}) {
  const usable = (d) => typeof d === 'string' && isAbsolute(d) && resolve(d) !== root;
  if (usable(env.CLAUDE_PROJECT_DIR)) return env.CLAUDE_PROJECT_DIR;
  const workspaces = Object.keys(meta?.['x-codex-turn-metadata']?.workspaces || {}).filter(usable);
  if (workspaces.length === 1) return workspaces[0];
  if (usable(cwd)) return cwd;
  if (usable(env.PWD)) return env.PWD;
  return null;
}

export async function call(args, { dir = process.cwd(), asker = ask, read = readText, configPath } = {}) {
  const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], isError });
  try {
    if (!args || typeof args.question !== 'string' || !args.question.trim()) throw new Misuse('"question" is required');
    if (!args.answers || typeof args.answers !== 'object' || Array.isArray(args.answers)) throw new Misuse('"answers" is an object of name to description');
    if (!dir) throw new Misuse('the project\'s directory is unknown here; pass "config" and absolute paths');
    const items = pile(args, dir, read);
    const path = args.config ? resolve(dir, args.config) : (configPath || findConfig)();
    let config;
    try { config = JSON.parse(read(dir, path)); } catch { throw new Misuse(`${path} is not a readable JSON config`); }
    const { answers, cost } = await asker({ config, kind: args.kind || 'choice', text: args.question, options: args.answers,
      context: args.context || '', items });
    return text(report(items, answers, cost));
  } catch (e) {
    if (e instanceof Unavailable) return text(`Jev is unavailable here: ${e.message}. Read the pile yourself; do not call this again in this session.`);
    if (e instanceof Misuse || e.constructor?.name === 'Misuse') return text(e.message, true);
    return text(`Jev failed: ${e.message}. Read the pile yourself.`, true);
  }
}

// ---- the protocol ----------------------------------------------------------------

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export async function handle(msg, opts) {
  const { id, method, params } = msg;
  const result = (r) => ({ jsonrpc: '2.0', id, result: r });
  const error = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (id === undefined || id === null) return null; // a notification needs no answer
  switch (method) {
    case 'initialize':
      return result({
        protocolVersion: PROTOCOLS.includes(params?.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: 'jev', version: VERSION },
        instructions: 'ask_each sorts a pile (search hits, failures, a long log, many files) by one question before you read it; '
          + 'you then read only what Jev was not sure of.',
      });
    case 'ping': return result({});
    case 'tools/list': return result({ tools: [TOOL] });
    case 'tools/call':
      if (params?.name !== TOOL.name) return error(-32602, `unknown tool ${params?.name}`);
      return result(await call(params.arguments || {}, { ...opts, dir: projectDir({ meta: params._meta }) }));
    default: return error(-32601, `method not found: ${method}`);
  }
}

function serve() {
  // jev.mjs reads the project's git (its config, the people it knows, where
  // the key may not be) from the working directory, so each call runs alone,
  // in its project.
  let queue = Promise.resolve();
  const opts = { asker: (q) => ask(q), configPath: () => findConfig() };
  const run = (msg) => {
    if (msg.method !== 'tools/call') return handle(msg, opts);
    const dir = projectDir({ meta: msg.params?._meta });
    const next = queue.then(() => { try { if (dir) process.chdir(dir); } catch {} return handle(msg, opts); });
    queue = next.catch(() => {});
    return next;
  };
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch {
        process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })}\n`);
        continue;
      }
      run(msg).then((reply) => { if (reply) process.stdout.write(`${JSON.stringify(reply)}\n`); });
    }
  });
}

// ---- self-test -------------------------------------------------------------------

async function selftest() {
  let failed = 0;
  const check = (name, ok, got) => {
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  jev-server: ${name}${ok ? '' : ` (got ${JSON.stringify(got)})`}`);
  };
  const disk = {
    'hits.txt': 'src/a.js:3: parseConfig(x)\n\nsrc/b.js:9: // parseConfig is old\n',
    'test.log': '=== RUN A\nok\n--- FAIL A\nboom\n=== RUN B\nok\n',
    'notes.md': 'first\nblock\n\n\nsecond\n',
    'cfg.json': '{"jev": {"consent": true}}',
  };
  const read = (dir, p) => { const k = p.replace(/^\/p\//, ''); if (!(k in disk)) throw new Misuse(`${p} cannot be read`); return disk[k]; };
  const ids = (args) => pile(args, '/p', read).map((it) => it.id);
  check('a file is cut by line, empty ones skipped', JSON.stringify(ids({ file: 'hits.txt' })) === '["line 1","line 3"]', ids({ file: 'hits.txt' }));
  check('by blank lines into blocks', JSON.stringify(ids({ file: 'notes.md', split: 'blank' })) === '["lines 1-2","lines 5-5"]', ids({ file: 'notes.md', split: 'blank' }));
  const sep = pile({ file: 'test.log', split: 'separator', separator: '^(===|---) ' }, '/p', read);
  check('by a separator, each match starting an item', JSON.stringify(sep.map((i) => i.id)) === '["lines 1-2","lines 3-4","lines 5-6"]'
    && sep[1].text === '--- FAIL A\nboom', sep);
  check('files are one item each, named by path', JSON.stringify(ids({ files: ['hits.txt', 'test.log'] })) === '["hits.txt","test.log"]');
  check('items given directly keep their ids', JSON.stringify(ids({ items: ['x', { id: 'k', text: 'y' }] })) === '["1","k"]');
  const misuse = (args) => { try { pile(args, '/p', read); return false; } catch (e) { return e instanceof Misuse; } };
  check('the pile is named once', misuse({ file: 'hits.txt', items: ['x'] }) && misuse({}));
  check('a separator split needs its separator', misuse({ file: 'test.log', split: 'separator' }));
  check('an empty pile is refused', misuse({ items: [] }));
  check('a pile over the limit is refused', misuse({ items: Array.from({ length: MAX_ITEMS + 1 }, () => 'x') }));

  let asked = null;
  const asker = async (q) => {
    asked = q;
    return { cost: 0.001, answers: [
      { id: 'line 1', answer: 'call', p: 0.97, settled: true },
      { id: 'line 3', answer: 'mention', p: 0.6, settled: false },
    ] };
  };
  const args = { question: 'Is this a call of parseConfig?', answers: { call: 'a call', mention: 'a mention' }, file: 'hits.txt' };
  const r = await call(args, { dir: '/p', asker, read, configPath: () => 'cfg.json' });
  const t = r.content[0].text;
  check('settled ids are listed by answer, not their text', /Settled "call" \(1\): line 1/.test(t) && !/parseConfig\(x\)/.test(t), t);
  check('what Jev was unsure of comes back with a line of it', /line 3 \(leans mention, 0.6\) — src\/b.js:9: \/\/ parseConfig is old/.test(t), t);
  check('the question reaches jev.mjs whole, with the config', asked.text === args.question && asked.config.jev.consent === true
    && asked.items.length === 2 && asked.kind === 'choice', asked);
  const off = await call(args, { dir: '/p', read, asker: async () => { throw new Unavailable('this project has not agreed to send text to Jev'); },
    configPath: () => 'cfg.json' });
  check('unavailable says to read for yourself, once', !off.isError && /unavailable here: this project has not agreed.*do not call this again/.test(off.content[0].text), off);
  const noConfig = await call(args, { dir: '/p', read, asker, configPath: () => { throw new Unavailable('this project has not agreed to send text to Jev'); } });
  check('no consented config is unavailable too', /unavailable here/.test(noConfig.content[0].text), noConfig);
  const bad = await call({ question: 'q', answers: { a: 'a', b: 'b' }, file: 'missing.txt' }, { dir: '/p', read, asker, configPath: () => 'cfg.json' });
  check('a pile that cannot be read is an error to fix', bad.isError && /missing.txt cannot be read/.test(bad.content[0].text), bad);

  check('a file in the project or the temporary directory is read', allowed('/p/src/a.go', ['/p']) && allowed('/tmp/x/hits.txt', ['/p', '/tmp']));
  check('one outside them is not', !allowed('/home/u/.bashrc', ['/p', '/tmp']) && !allowed('/p', ['/p']) && !allowed('/pq/a', ['/p']));
  check('nor a credential store inside them', !allowed('/p/.env', ['/p']) && !allowed('/p/deploy/.ssh/id_ed25519', ['/p'])
    && !allowed('/tmp/server.pem', ['/tmp']) && allowed('/p/environment.md', ['/p']));
  const ws = (...dirs) => ({ 'x-codex-turn-metadata': { workspaces: Object.fromEntries(dirs.map((d) => [d, {}])) } });
  check('Claude Code names the project', projectDir({ env: { CLAUDE_PROJECT_DIR: '/p' }, cwd: '/r', root: '/r' }) === '/p');
  check('Codex, started in the plugin, names it per call', projectDir({ env: {}, cwd: '/r', root: '/r', meta: ws('/p') }) === '/p');
  check('two workspaces are not guessed between', projectDir({ env: { PWD: '/s' }, cwd: '/r', root: '/r', meta: ws('/p', '/q') }) === '/s');
  check('omp starts it in the session\'s directory', projectDir({ env: {}, cwd: '/p', root: '/r' }) === '/p');
  check('the plugin\'s own folder is never the project', projectDir({ env: { PWD: '/r' }, cwd: '/r', root: '/r' }) === null);
  const lost = await call(args, { dir: null, read, asker, configPath: () => 'cfg.json' });
  check('without a project the call says what to pass', lost.isError && /directory is unknown/.test(lost.content[0].text), lost);
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, {});
  check('initialize answers in the client\'s protocol, with tools', init.result.protocolVersion === '2025-03-26' && init.result.capabilities.tools, init);
  const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, {});
  check('the tool is listed with its schema', list.result.tools[0].name === 'ask_each' && list.result.tools[0].inputSchema.required.includes('question'), list);
  check('a notification gets no answer', (await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, {})) === null);
  const unknown = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'other' } }, {});
  check('an unknown tool is an error', unknown.error?.code === -32602, unknown);
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--selftest') process.exitCode = await selftest();
  else serve();
}
