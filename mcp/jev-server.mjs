#!/usr/bin/env node
/**
 * Jev as a tool the agent sees in its list, not a paragraph it must recall.
 *
 * An agent picks its actions from its tools; a rule in prose works only when
 * it recalls it at the moment, and over three days of runs no agent did. This
 * server is a thin face over jev.mjs, which stays the one way text reaches Jev:
 * consent, the key, masking, the project's threshold and its Jev are its, and
 * the set's scripts keep calling it directly. What this adds is the shape of
 * the call: several questions of Jev's three kinds at once, about one long
 * text or each item of a pile the agent names (a file cut into items, several
 * files, a short list) instead of reading it to hand it over; and back only what
 * Jev settled and what is left to read.
 *
 * MCP over stdio, newline-delimited JSON-RPC, no dependencies.
 *
 *   node jev-server.mjs            serve on stdin/stdout
 *   node jev-server.mjs --selftest
 */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findConfig, judge, Unavailable } from '../skills/backlog/setup-shady2k-skills/jev.mjs';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const MAX_ITEMS = 1000;
const MAX_QUESTIONS = 16;
const MAX_FILE = 16 << 20;
const EXCERPT = 160;

class Misuse extends Error {}

export const TOOL = {
  name: 'jev',
  title: 'Jev: fast typed judgements over a pile or a long text',
  description: [
    'Jev, a fast decision model, reads a text and answers your questions about it from answers you define: yes or no,',
    'one of your options, or a place on an ordered scale. Several questions in one call, about a second, a fraction of a cent.',
    'Ask it about a pile (search hits, failing tests, review findings, files, sections of a log) to get every item\'s answers',
    'without reading the items, or about one long text you would otherwise read whole. Write the output of a search or a run',
    'to a file and name the file. You get back what Jev is sure of, and the items it was not, to read yourself.',
    'Not for a short judgement you can make at once, for comparing items with each other, or for arithmetic.',
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array', minItems: 1, maxItems: MAX_QUESTIONS,
        description: 'Asked of every item, all in one request. Each question states its full meaning on its own.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Your name for it, for reading the answers.' },
            type: { type: 'string', enum: ['check', 'choice', 'score'], description: 'check: yes or no; choice: one of "answers"; score: a place on "levels".' },
            question: { type: 'string', description: 'e.g. "Is this line a real call of parseConfig?"' },
            answers: {
              type: 'object', additionalProperties: { type: 'string' },
              description: 'choice: answer name to what it means, e.g. {"call": "a call", "mention": "a mention in a comment or string"}; '
                + '"none" is added. check, optional: {"true": ..., "false": ...}.',
            },
            levels: { type: 'array', items: { type: 'string' }, description: 'score: at least two levels, lowest first.' },
          },
          required: ['type', 'question'],
        },
      },
      file: { type: 'string', description: 'A file: search output, a log, a list, a long text.' },
      split: {
        type: 'string', default: 'line',
        description: 'How the file is cut into items: "line" (each non-empty line), "blank" (blocks between blank lines), '
          + '"whole" (the file is one text), or a regular expression: each line it matches starts an item (e.g. "^--- FAIL").',
      },
      files: { type: 'array', items: { type: 'string' }, description: 'Several files, each one item.' },
      items: {
        type: 'array', description: 'A short list given directly: strings, or {"id", "text"}.',
        items: { anyOf: [{ type: 'string' }, { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['text'] }] },
      },
      context: { type: 'string', description: 'What every item needs to be judged, said once.' },
    },
    required: ['questions'],
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
  if (given.length !== 1) throw new Misuse('name what Jev reads once: "file", "files" or "items"');
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
    const whole = read(dir, String(args.file));
    const split = args.split || 'line';
    const lines = whole.split(/\r?\n/);
    items = [];
    if (split === 'whole') {
      if (whole.trim()) items.push({ id: basename(String(args.file)), text: whole });
    } else if (split === 'line') {
      lines.forEach((l, i) => { if (l.trim()) items.push({ id: `line ${i + 1}`, text: l }); });
    } else {
      let starts;
      if (split === 'blank') starts = (l, i) => l.trim() && (i === 0 || !lines[i - 1].trim());
      else {
        let re;
        try { re = new RegExp(split); } catch { throw new Misuse('"split" is line, blank, whole or a regular expression'); }
        starts = (l, i) => i === 0 || re.test(l);
      }
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
  if (!items.length) throw new Misuse('there is nothing to read');
  if (items.length > MAX_ITEMS) throw new Misuse(`${items.length} items is over ${MAX_ITEMS}; narrow the search or cut coarser`);
  return items;
}

/** The questions as jev.mjs takes them. */
export function asked(list) {
  if (!Array.isArray(list) || !list.length) throw new Misuse('"questions" is a list of at least one question');
  if (list.length > MAX_QUESTIONS) throw new Misuse(`at most ${MAX_QUESTIONS} questions in one call`);
  return list.map((q, n) => {
    const id = String(q?.id || `q${n + 1}`);
    if (typeof q?.question !== 'string' || !q.question.trim()) throw new Misuse(`question ${id} has no "question"`);
    if (q.type === 'score') return { id, kind: 'score', text: q.question, options: q.levels };
    if (q.type === 'check') return { id, kind: 'check', text: q.question, options: q.answers || { true: 'yes', false: 'no' } };
    if (q.type === 'choice') {
      if (!q.answers || typeof q.answers !== 'object' || Array.isArray(q.answers)) throw new Misuse(`question ${id}: a choice takes "answers", name to meaning`);
      return { id, kind: 'choice', text: q.question, options: q.answers };
    }
    throw new Misuse(`question ${id}: "type" is check, choice or score`);
  });
}

const shown = (a) => (a.level !== undefined ? `${a.level}: ${oneLine(a.answer).slice(0, 40)}` : a.answer);

/** What the agent reads back: per question, settled item ids by answer and the unsure ones; then the items left to read. */
export function report(items, questions, result) {
  const byId = new Map(items.map((it) => [it.id, it]));
  const sent = result.items.filter((it) => it.sent !== false);
  const unsent = result.items.filter((it) => it.sent === false);
  const toRead = new Set();
  let settledCount = 0;
  const blocks = questions.map((q) => {
    const settled = new Map();
    const unsure = [];
    for (const it of sent) {
      const a = it.answers[q.id];
      if (a.settled) { settledCount++; (settled.get(shown(a)) || settled.set(shown(a), []).get(shown(a))).push(it.id); }
      else { toRead.add(it.id); unsure.push(`${it.id} leans ${a.answer === null ? 'nowhere' : shown(a)} (${a.p})`); }
    }
    const kind = { check: 'yes or no', choice: 'choice', score: 'scale' }[q.kind];
    const lines = [`${q.id} (${kind}): ${q.text}`];
    for (const [answer, ids] of settled) lines.push(`  ${answer} (${ids.length}): ${ids.join(', ')}`);
    if (unsure.length) lines.push(`  unsure (${unsure.length}): ${unsure.join('; ')}`);
    return lines.join('\n');
  });
  const out = [`${items.length} item${items.length === 1 ? '' : 's'} x ${questions.length} question${questions.length === 1 ? '' : 's'}: `
    + `${settledCount} of ${sent.length * questions.length} answers settled; $${result.cost.toFixed(5)}. `
    + `${result.model}, answers taken at ${result.sure} and above (the project's threshold).`, '', ...blocks];
  if (toRead.size) out.push('', `Read these yourself (${toRead.size}):`, ...[...toRead].map((id) => `- ${id} — ${oneLine(byId.get(id)?.text || '')}`));
  if (unsent.length) out.push('', `Not sent (${unsent.length}), read these yourself:`, ...unsent.map((it) => `- ${it.id}: ${it.why} — ${oneLine(byId.get(it.id)?.text || '')}`));
  out.push('', 'Use only the settled answers. Nothing hard to reverse (closing, deleting, merging, telling the user) rests on them alone.');
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

export async function call(args, { dir = process.cwd(), asker = judge, read = readText, configPath } = {}) {
  const text = (t, isError = false) => ({ content: [{ type: 'text', text: t }], isError });
  try {
    const questions = asked(args?.questions);
    if (!dir) throw new Misuse('the project\'s directory is unknown here; give absolute paths');
    const items = pile(args, dir, read);
    const path = (configPath || findConfig)();
    let config;
    try { config = JSON.parse(read(dir, path)); } catch { throw new Misuse(`${path} is not a readable JSON config`); }
    const result = await asker({ config, questions, context: args.context || '', items });
    return text(report(items, questions, result));
  } catch (e) {
    if (e instanceof Unavailable) return text(`Jev is unavailable here: ${e.message}. Read for yourself; do not call this again in this session.`);
    if (e instanceof Misuse || e.constructor?.name === 'Misuse') return text(e.message, true);
    return text(`Jev failed: ${e.message}. Read for yourself.`, true);
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
        instructions: 'jev answers typed questions (yes or no, one of your options, a place on a scale) about each item of a pile or one long text '
          + 'you name by file, so you read only what it was not sure of.',
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
  const opts = { asker: (q) => judge(q), configPath: () => findConfig() };
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
  const sep = pile({ file: 'test.log', split: '^(===|---) ' }, '/p', read);
  check('by a separator, each match starting an item', JSON.stringify(sep.map((i) => i.id)) === '["lines 1-2","lines 3-4","lines 5-6"]'
    && sep[1].text === '--- FAIL A\nboom', sep);
  check('a whole file is one text', JSON.stringify(ids({ file: 'test.log', split: 'whole' })) === '["test.log"]');
  check('files are one item each, named by path', JSON.stringify(ids({ files: ['hits.txt', 'test.log'] })) === '["hits.txt","test.log"]');
  check('items given directly keep their ids', JSON.stringify(ids({ items: ['x', { id: 'k', text: 'y' }] })) === '["1","k"]');
  const misuse = (args) => { try { pile(args, '/p', read); return false; } catch (e) { return e instanceof Misuse; } };
  check('the pile is named once', misuse({ file: 'hits.txt', items: ['x'] }) && misuse({}));
  check('a split that is no regular expression is refused', misuse({ file: 'test.log', split: '(' }));
  check('an empty pile is refused', misuse({ items: [] }));
  check('a pile over the limit is refused', misuse({ items: Array.from({ length: MAX_ITEMS + 1 }, () => 'x') }));

  const qs = (list) => { try { return asked(list); } catch (e) { return e instanceof Misuse ? null : e; } };
  const three = qs([{ id: 'kind', type: 'choice', question: 'What is it?', answers: { call: 'a call', mention: 'a mention' } },
    { type: 'check', question: 'In a test?' }, { id: 'sev', type: 'score', question: 'How risky?', levels: ['low', 'high'] }]);
  check('the three kinds reach jev.mjs, a check with yes and no by default', three && three[1].id === 'q2'
    && JSON.stringify(three.map((q) => q.kind)) === '["choice","check","score"]' && three[1].options.true === 'yes' && three[2].options.length === 2, three);
  check('a question without its kind, text or answers is refused', qs([]) === null && qs([{ type: 'guess', question: 'q' }]) === null
    && qs([{ type: 'choice', question: 'q' }]) === null && qs([{ type: 'check' }]) === null);

  let got = null;
  const asker = async (q) => {
    got = q;
    return { cost: 0.001, sure: 0.9, model: 'jev-1.13', items: [
      { id: 'line 1', answers: { kind: { answer: 'call', p: 0.97, settled: true }, sev: { answer: 'high', level: 1, score: 0.95, p: 0.95, settled: true } } },
      { id: 'line 3', answers: { kind: { answer: 'mention', p: 0.6, settled: false }, sev: { answer: 'low', level: 0, score: 0.02, p: 0.98, settled: true } } },
    ] };
  };
  const args = { questions: [{ id: 'kind', type: 'choice', question: 'Is this a call of parseConfig?', answers: { call: 'a call', mention: 'a mention' } },
    { id: 'sev', type: 'score', question: 'How risky is a change here?', levels: ['low', 'high'] }], file: 'hits.txt' };
  const r = await call(args, { dir: '/p', asker, read, configPath: () => 'cfg.json' });
  const t = r.content[0].text;
  check('each question lists its settled ids by answer, not their text', /kind \(choice\): Is this a call[^\n]*\n  call \(1\): line 1/.test(t)
    && /sev \(scale\)[^\n]*\n  1: high \(1\): line 1\n  0: low \(1\): line 3/.test(t) && !/parseConfig\(x\)/.test(t), t);
  check('what Jev was unsure of comes back once, with a line of it', /unsure \(1\): line 3 leans mention \(0.6\)/.test(t)
    && /Read these yourself \(1\):\n- line 3 — src\/b.js:9: \/\/ parseConfig is old/.test(t), t);
  check('the answer says the threshold and the Jev it was judged by', /3 of 4 answers settled.*jev-1.13, answers taken at 0.9/.test(t), t);
  check('the questions reach jev.mjs with the config', got.questions.length === 2 && got.config.jev.consent === true && got.items.length === 2, got);
  const off = await call(args, { dir: '/p', read, asker: async () => { throw new Unavailable('this project has not agreed to send text to Jev'); },
    configPath: () => 'cfg.json' });
  check('unavailable says to read for yourself, once', !off.isError && /unavailable here: this project has not agreed.*do not call this again/.test(off.content[0].text), off);
  const noConfig = await call(args, { dir: '/p', read, asker, configPath: () => { throw new Unavailable('this project has not agreed to send text to Jev'); } });
  check('no consented config is unavailable too', /unavailable here/.test(noConfig.content[0].text), noConfig);
  const bad = await call({ ...args, file: 'missing.txt' }, { dir: '/p', read, asker, configPath: () => 'cfg.json' });
  check('a file that cannot be read is an error to fix', bad.isError && /missing.txt cannot be read/.test(bad.content[0].text), bad);

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
  check('the tool is listed with its schema', list.result.tools[0].name === 'jev' && list.result.tools[0].inputSchema.required.includes('questions'), list);
  check('a notification gets no answer', (await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, {})) === null);
  const unknown = await handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'other' } }, {});
  check('an unknown tool is an error', unknown.error?.code === -32602, unknown);
  return failed ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--selftest') process.exitCode = await selftest();
  else serve();
}
