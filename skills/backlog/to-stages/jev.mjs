#!/usr/bin/env node
/**
 * The one way the set sends a judgement to Jev, TypeSafe's decision model:
 * given a text and questions of three kinds (yes or no, one of the answers
 * given, a place on an ordered scale), it returns a probability for each
 * answer, all questions in one request, the text read once.
 *
 * Measured on the set's own repository before it was built: over 26 sessions,
 * which of 81 tracker items each worked on, Jev answered 25 right against 21
 * for a small general model, at 0.6 s and a twentieth of the cost; over 312
 * short code spans, alone it was worse than the regex already there (it reads
 * literally), and its confidence was right at the ends (below 0.05: 125 of
 * 125; above 0.95: 50 of 51) and useless in the middle (0.5 to 0.8: 0 of 7).
 * So an answer is SETTLED only at the ends, and the rest goes back to the
 * agent, which reads that item itself. Where the end begins is the project's
 * choice (jev.sure), bound to the Jev it was measured on (jev.model): 0.9 on
 * jev-1.13 where it chose nothing, which is this set's measure, not a law, and
 * a new Jev makes it stale. replay shows, on the project's own cases, what each
 * threshold would settle and how much of that is right.
 *
 * NOTHING LEAVES UNMASKED. Every text is masked here, on every call, and
 * nothing the caller passes turns it off: secrets are removed; people, hosts,
 * addresses, commit hashes, tracker item ids and the project's own words become
 * typed placeholders (<ISSUE_1>), the same value the same placeholder within
 * one request and numbered afresh in the next, so nothing links two requests;
 * code, file names, relative paths and titles stay, since they carry the
 * signal. An item that is credential material as a whole is not sent. The
 * request is scanned again as it will be sent, and a hit sends nothing. This is
 * best-effort redaction by shape, not anonymisation.
 *
 * NOTHING IS SENT WITHOUT THE PROJECT'S CONSENT, recorded by setup in the gate
 * config under "jev"; without it, or without a key, every command says Jev is
 * unavailable and the agent does the reading itself, as before. Where the key
 * is, is this machine's and never the project's: a committed file that could
 * name a command to run would let whoever edits it run anything here. It is
 * kept in $XDG_CONFIG_HOME/shady2k-skills/jev.json (~/.config by default) as
 * {"key": {"env": name} | {"file": path} | {"command": [program, ...args]}}.
 *
 *   node jev.mjs status  [--config <gate-config>]   (found in the working copy when left out)
 *   node jev.mjs ask     [--config <gate-config>] --question <text> --options <json>
 *                        [--kind choice|check|score] [--context <text>]   < items.jsonl
 *                        (a score's --options is a JSON list of levels, lowest first)
 *   node jev.mjs replay  (same as ask; every item also carries "truth")
 *   node jev.mjs mask    [--config <gate-config>]                    < text
 *   node jev.mjs --selftest
 *
 * items.jsonl: one {"id": ..., "text": ...} per line. --options is a JSON object
 * of answer to description; a choice always gets "none" as a way out, a check
 * takes {"true": ..., "false": ...}. ask prints one JSON line per item:
 * {"id", "answer", "p", "settled"} or {"id", "sent": false, "why"}, and a
 * summary on stderr. Exit 0 done, 2 invalid use, 3 unavailable.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir, hostname, userInfo } from 'node:os';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

// How sure an answer must be to be used, and the Jev it was measured on, where
// the project has not set its own: this set's replay on jev-1.13. A project
// sets both (jev.sure, jev.model); a new Jev is never taken up silently, since
// a threshold means something only for the model it was measured on.
export const SETTLED = 0.9;
export const MODEL = 'jev-1.13';
const ROUTES = {
  // Proved against the live service when this was written.
  openrouter: { url: 'https://openrouter.ai/api/alpha/decisions', model: (m) => `typesafe/${m}` },
  // TypeSafe's own endpoint, by its documentation; setup proves it with a live call before relying on it.
  typesafe: { url: 'https://api.typesafe.ai/v1/systemone', model: (m) => m },
};
// The thresholds a replay reports side by side, so the owner chooses on numbers.
export const THRESHOLDS = [0.8, 0.9, 0.95];
// A request holds 32k tokens of text; a long item is cut to its head and tail,
// and cut again when the service still says it is too long.
const MAX_CHARS = 60000;
const PARALLEL = 8;

export class Unavailable extends Error {}
class Misuse extends Error {}
class Malformed extends Error {}
class TooSlow extends Error {}

// ---- masking -----------------------------------------------------------------

// Removed outright: what would let someone in.
const SECRETS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY(?: BLOCK)?-----|$)/g,
  /\b(?:sk-[A-Za-z0-9_-]{16,}|sk_(?:live|test)_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|hv[sbr]\.[A-Za-z0-9_-]{20,}|s\.[A-Za-z0-9]{24})\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /(\b(?:authorization|proxy-authorization)\s*[:=]\s*(?:bearer|basic|token)?\s*)[^\s'"`,;]+/gi,
  /(\bbearer\s+)[A-Za-z0-9._~+/=-]{12,}/gi,
  /(\b[\w.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|credentials?)[\w.-]*["']?\s*[:=]\s*)(?:"[^"\n]*"|'[^'\n]*'|`[^`\n]*`|[^\s'"`,;}][^\n'"`,;}]{3,})/gi,
  /(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@'"`]+:)[^\s@/'"`]+(?=@)/gi,
  /([?&](?:token|key|secret|sig|signature|password|access_token|api_key)=)[^\s&#'"`]+/gi,
];

// Kept as typed placeholders: who and where, so relations survive and identity does not.
const SHAPES = [
  // Anchored and bounded: a long run of letters would otherwise be rescanned from every position.
  ['EMAIL', /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}(?![\w.-]*:)/g],
  ['HOST', /\b[\w.-]+@[\w.-]+:(?=[\w./-])/g],
  ['URL', /\bhttps?:\/\/[^\s)>\]'"`]+/g],
  ['IP', /\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi],
  ['PHONE', /(?<![\w.-])(?:\+\d[\d ()-]{8,}\d|\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4})(?![\w.-])/g],
  ['HOME', /(?:\/home\/|\/Users\/|[A-Za-z]:\\Users\\)[^\s/\\'"`]+/g],
  ['UUID', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
  // A bare host, by the zones people name: file names (check.mjs, README.md) are not among them.
  ['HOST', /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|io|ru|dev|ai|app|co|uk|de|fr|nl|eu|info|biz|cloud|me|xyz|su|by|kz|ua|local|localhost|internal|lan|corp|home|intra|example|test|invalid|svc|cluster)\b(?![.\w-]*\/)/gi],
  ['COMMIT', /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/g],
];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const gitOut = (args) => {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); } catch { return ''; }
};

// The people this machine and the repository know by name: the person running
// it, and whoever wrote its recent commits. A name nobody recorded is not known.
function knownPeople() {
  const words = [];
  try { words.push(userInfo().username); } catch {}
  try { words.push(hostname()); } catch {}
  words.push(gitOut(['config', 'user.name']).trim(), gitOut(['config', 'user.email']).trim());
  words.push(...gitOut(['log', '-n', '500', '--format=%an%n%ae%n%cn%n%ce']).split('\n'));
  return [...new Set(words.flatMap((w) => [w.trim(), ...w.trim().split(/\s+/)]).filter((w) => w && w.length >= 3))];
}

// A pattern from the project's config runs over long texts. No check of its
// shape can promise it finishes (alternation and nesting defeat every
// heuristic), so it is run with a time limit instead, and an item it cannot
// finish in time is not sent; here it is only refused when it is not one.
export function safePattern(pattern, where) {
  const p = String(pattern);
  if (p.length > 200) throw new Misuse(`${where} is longer than 200 characters`);
  let re;
  try { re = new RegExp(p, 'g'); } catch { throw new Misuse(`${where} is not a regular expression`); }
  if (re.test('')) throw new Misuse(`${where} matches an empty text`);
  return p;
}

export const PATTERN_MS = 2000;

// Where a project pattern matches, found in a separate context that is stopped
// when it runs past its time.
function projectMatches(source, text, ms = PATTERN_MS) {
  try {
    return runInNewContext('Array.from(text.matchAll(new RegExp(source, "g")), (m) => [m.index, m[0]])', { text, source }, { timeout: ms });
  } catch (e) {
    if (e?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') throw new TooSlow(`the pattern ${source} ran past ${ms} ms`);
    throw e;
  }
}

const OURS = /<(?:[A-Z][A-Z0-9_]*_[0-9a-f]{16}|SECRET)>/g;

/**
 * A masker for one request: every value it replaces gets a placeholder with a
 * random suffix, the same for the same value inside the request and unrelated
 * to any other request. A text that already holds something shaped like a
 * placeholder has it defused first, so nothing in the input can read back as
 * a value it did not hold.
 */
export function masker({ idPattern = null, words = [], people = [], patterns = [] } = {}) {
  const seen = new Map();
  const back = new Map();
  const token = (kind, value) => {
    const key = `${kind}\u0000${value}`;
    if (!seen.has(key)) {
      let t;
      do t = `<${kind}_${randomBytes(8).toString('hex')}>`; while (back.has(t));
      seen.set(key, t);
      back.set(t, value);
    }
    return seen.get(key);
  };
  const listed = (list, kind) => [...new Set(list.map((w) => String(w).trim()).filter((w) => w.length >= 3))]
    .sort((a, b) => b.length - a.length)
    .map((w) => [kind, new RegExp(`(?<![\\p{L}\\p{N}_])${escape(w)}(?![\\p{L}\\p{N}_])`, 'giu')]);
  const project = [
    ...(idPattern ? [['ISSUE', safePattern(idPattern, 'jev.idPattern')]] : []),
    ...patterns.map(({ name, pattern }) => [String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_') || 'MASKED',
      safePattern(pattern, `jev.maskPatterns "${name}"`)]),
  ];
  const shapes = [
    ...SHAPES,
    ...listed(people, 'PERSON'),
    ...listed(words, 'PROJECT'),
  ];
  const mask = (text) => {
    let out = String(text).replace(OURS, (m) => `\u2039${m.slice(1, -1)}\u203a`);
    const ours = (m) => back.has(m) || m === '<SECRET>' || /^<[A-Z][A-Z0-9_]*_[0-9a-f]{16}>$/.test(m);
    for (const re of SECRETS) out = out.replace(re, (m, keep) => (typeof keep === 'string' && m.startsWith(keep) ? `${keep}<SECRET>` : '<SECRET>'));
    for (const [kind, source] of project) {
      let at = 0;
      let next = '';
      for (const [index, m] of projectMatches(source, out)) {
        next += out.slice(at, index) + (ours(m) ? m : token(kind, m));
        at = index + m.length;
      }
      out = next + out.slice(at);
    }
    for (const [kind, re] of shapes) out = out.replace(re, (m) => (ours(m) ? m : token(kind, m)));
    return out;
  };
  return { mask, unmask: (t) => back.get(t) ?? t };
}

// A text that is a credential as a whole is not sent at all, masked or not.
export function credentialMaterial(text) {
  const t = String(text);
  if (/-----BEGIN [A-Z ]*PRIVATE KEY(?: BLOCK)?-----/.test(t)) return 'a private key';
  const assignments = t.split('\n').filter((l) => /^\s*(?:export\s+)?[A-Z][A-Z0-9_]*\s*=\s*\S/.test(l));
  const secretish = assignments.filter((l) => /(?:PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|ACCESS_?KEY|PRIVATE|CREDENTIAL)/.test(l.split('=')[0]));
  if (assignments.length >= 3 && secretish.length >= 1 && assignments.length * 2 >= t.split('\n').filter((l) => l.trim()).length)
    return 'an environment or secrets file';
  return null;
}

// What is about to leave, looked at once more as it will be sent.
export function leaks(body) {
  const text = JSON.stringify(body);
  return SECRETS.flatMap((re) => [...text.matchAll(new RegExp(re.source, re.flags))])
    .map((m) => m[0])
    .filter((m) => !/<SECRET>$/.test(m));
}

// ---- consent, key and route ----------------------------------------------------

export function settings(config) {
  const jev = config?.jev;
  if (!jev || jev.consent !== true) throw new Unavailable('this project has not agreed to send text to Jev');
  if ('key' in jev) throw new Misuse('the Jev key\'s place belongs to the machine (jev.json), not to the project config');
  const route = ROUTES[jev.route || 'openrouter'];
  if (!route) throw new Misuse(`jev.route must be one of ${Object.keys(ROUTES).join(', ')}`);
  const sure = jev.sure ?? SETTLED;
  if (typeof sure !== 'number' || !(sure > 0.5 && sure < 1)) throw new Misuse('jev.sure is a probability above 0.5 and below 1');
  const name = jev.model ?? MODEL;
  if (typeof name !== 'string' || !/^jev-[A-Za-z0-9._-]+$/.test(name)) throw new Misuse('jev.model names a Jev, like jev-1.13');
  const s = { url: route.url, model: route.model(name), name, sure, idPattern: jev.idPattern || null, patterns: jev.maskPatterns || [],
    words: [...(config.projectWords || []), ...(config.trackerWords || [])] };
  masker(s); // refuses an unsafe pattern now, not in the middle of a batch
  return s;
}

// The project's gate config, when the caller does not name it: the one JSON
// file the working copy tracks that carries a "jev" section. Setup writes that
// section into the gate config only, so two of them is a question, not a guess.
export function findConfig({ list = () => gitOut(['ls-files', '-z', '--', '*.json']), read = (f) => readFileSync(f, 'utf8'),
  top = gitOut(['rev-parse', '--show-toplevel']).trim() } = {}) {
  if (!top) throw new Unavailable('not inside a git working copy, so there is no project config to read');
  const found = [];
  for (const file of list().split('\0').filter(Boolean)) {
    let parsed;
    try {
      const text = read(join(top, file));
      if (text.length > 1 << 20 || !text.includes('"jev"')) continue;
      parsed = JSON.parse(text);
    } catch { continue; }
    if (parsed && typeof parsed.jev === 'object' && parsed.jev && !Array.isArray(parsed.jev)) found.push(file);
  }
  if (!found.length) throw new Unavailable('this project has not agreed to send text to Jev');
  if (found.length > 1) throw new Misuse(`more than one config carries a "jev" section (${found.join(', ')}); name one with --config`);
  return join(top, found[0]);
}

// Only an absolute place outside the working copy: a relative one would be read
// from wherever the agent stands, which may be a repository anyone can edit.
export function keyPlaceFile(env = process.env, top = gitOut(['rev-parse', '--show-toplevel']).trim()) {
  const base = env.XDG_CONFIG_HOME && isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : join(homedir(), '.config');
  const file = join(base, 'shady2k-skills', 'jev.json');
  if (top && (file === top || file.startsWith(top + sep))) throw new Unavailable('the Jev key\'s place may not be inside a working copy');
  return file;
}

// Where the key is, read from this machine's file; said without its arguments,
// which may hold what the key is guarded by.
export function keyPlace({ env = process.env, read = readFileSync, top } = {}) {
  let where;
  const file = keyPlaceFile(env, top);
  try { where = JSON.parse(read(file, 'utf8')).key; } catch {
    throw new Unavailable('this machine does not say where the Jev key is');
  }
  if (!where || typeof where !== 'object') throw new Unavailable('this machine does not say where the Jev key is');
  return where;
}

const described = (where) => (where.env ? `the environment variable ${where.env}` : where.file ? `the file ${where.file}`
  : Array.isArray(where.command) ? `the command ${where.command[0]}` : 'an unknown source');

export function readKey(where, { env = process.env, run = execFileSync, read = readFileSync } = {}) {
  let key = '';
  try {
    if (where.env) key = env[where.env] || '';
    else if (where.file) key = read(String(where.file).replace(/^~(?=\/|$)/, homedir()), 'utf8');
    else if (Array.isArray(where.command) && where.command.length)
      key = run(String(where.command[0]), where.command.slice(1).map(String), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 });
    else throw new Misuse('the key takes {"env": name}, {"file": path} or {"command": [program, ...args]}');
  } catch (e) {
    if (e instanceof Misuse) throw e;
    throw new Unavailable(`the Jev key could not be read from ${described(where)}`);
  }
  key = String(key).trim();
  if (!key) throw new Unavailable(`the Jev key from ${described(where)} is empty`);
  return key;
}

// ---- asking --------------------------------------------------------------------

const cut = (text, n) => (text.length <= n ? text : `${text.slice(0, n / 2)}\n\n[... the middle is left out ...]\n\n${text.slice(-n / 2)}`);

// Jev's three kinds of question: yes or no (its "noul"), one of the answers
// given, or a place on an ordered scale. Several go in one request, asked of
// one text read once.
export function question(kind, text, options) {
  if (!text) throw new Misuse('--question is required');
  if (kind === 'score') {
    if (!Array.isArray(options) || options.length < 2 || !options.every((l) => typeof l === 'string' && l))
      throw new Misuse('a score takes at least two levels, lowest first');
    return { type: 'score', instructions: text, criteria: options.map(String) };
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Misuse('--options must be a JSON object of answer to description');
  if (kind === 'check') {
    if (!('true' in options) || !('false' in options) || Object.keys(options).length !== 2)
      throw new Misuse('a check takes exactly {"true": ..., "false": ...}');
    return { type: 'noul', instructions: text, criteria: { true: String(options.true), false: String(options.false) } };
  }
  if (kind !== 'choice') throw new Misuse('--kind is choice, check or score');
  const criteria = Object.fromEntries(Object.entries(options).map(([k, v]) => [k, String(v)]));
  if (Object.keys(criteria).length < 2) throw new Misuse('a choice needs at least two answers');
  if (!('none' in criteria)) criteria.none = 'None of the listed answers fits.';
  return { type: 'choice', instructions: text, criteria };
}

// Jev's answer read back: the answer, its probability, and whether it is settled.
export function reading(q, answer, threshold = SETTLED) {
  const unit = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
  if (!answer || typeof answer !== 'object') throw new Malformed('no answer');
  if (q.type === 'noul') {
    const p = answer.noul;
    if (!unit(p)) throw new Malformed('a check answered without a probability');
    const sure = p >= 0.5 ? p : 1 - p;
    return { answer: p >= 0.5 ? 'true' : 'false', p: sure, settled: sure >= threshold };
  }
  if (q.type === 'score') {
    // A place on the scale is taken where one level holds the probability; the
    // weighted score between levels is kept for the agent, never settled on.
    const probs = answer.probabilities;
    const n = q.criteria.length;
    if (!probs || typeof probs !== 'object' || Object.keys(probs).length !== n
      || !q.criteria.every((_, i) => unit(probs[i]))) throw new Malformed('a score without a probability for each level');
    const total = q.criteria.reduce((t, _, i) => t + probs[i], 0);
    if (Math.abs(total - 1) > 0.02) throw new Malformed('probabilities that do not add up to one');
    let top = 0;
    q.criteria.forEach((_, i) => { if (probs[i] > probs[top]) top = i; });
    const score = typeof answer.score === 'number' && Number.isFinite(answer.score) ? answer.score : null;
    return { answer: q.criteria[top], level: top, score, p: probs[top], settled: probs[top] >= threshold };
  }
  const probs = answer.probabilities;
  const given = Object.keys(q.criteria);
  if (typeof answer.choice !== 'string' || !Object.hasOwn(q.criteria, answer.choice) || !probs || typeof probs !== 'object')
    throw new Malformed('a choice outside the answers given');
  const keys = Object.keys(probs);
  if (keys.length !== given.length || !given.every((k) => Object.hasOwn(probs, k)) || !keys.every((k) => unit(probs[k])))
    throw new Malformed('probabilities that are not one for each answer given');
  const total = keys.reduce((n, k) => n + probs[k], 0);
  if (Math.abs(total - 1) > 0.02) throw new Malformed('probabilities that do not add up to one');
  const p = probs[answer.choice];
  if (keys.some((k) => probs[k] > p)) throw new Malformed('a choice that is not the most probable');
  return { answer: answer.choice, p, settled: p >= threshold };
}

// The service's own word that the request is too long: TypeSafe's
// {"detail": {"error_type": "max_tokens_exceeded"}}, bare or as OpenRouter wraps
// it in its error message. Anything else that merely mentions it is not.
export function tooLongReply(text) {
  const said = (o) => o?.detail?.error_type === 'max_tokens_exceeded';
  let outer;
  try { outer = JSON.parse(text); } catch { return false; }
  if (said(outer)) return true;
  const inner = /^HTTP 400: (\{.*\})$/s.exec(String(outer?.error?.message || ''));
  if (!inner) return false;
  try { return said(JSON.parse(inner[1])); } catch { return false; }
}

async function post(route, key, body, fetchImpl, wait = (ms) => new Promise((s) => setTimeout(s, ms))) {
  for (let attempt = 0; ; attempt++) {
    let r, text;
    try {
      r = await fetchImpl(route.url, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      text = await r.text();
    } catch {
      if (attempt >= 3) throw new Unavailable('Jev could not be reached');
      await wait(1000 * 2 ** attempt);
      continue;
    }
    if (r.ok) {
      try { return JSON.parse(text); } catch { throw new Malformed('an answer that is not JSON'); }
    }
    if (r.status === 401 || r.status === 403) throw new Unavailable('the Jev key was refused');
    if (r.status === 400 && tooLongReply(text)) return { tooLong: true };
    // The body is never printed: a service may echo what it was sent, the key included.
    if (attempt >= 3 || (r.status < 500 && r.status !== 429)) throw new Error(`Jev answered with status ${r.status}`);
    await wait(1000 * 2 ** attempt);
  }
}

/**
 * Asks the same questions of every item, all of them in one request per item,
 * so Jev reads each item once. Each item is masked in its own request; the
 * answers are unmasked on the way back, so a choice among item ids returns ids.
 * questions: [{ id, kind: choice|check|score, text, options }], options being
 * the answers (choice, check) or the levels, lowest first (score).
 */
export async function judge({ config, questions, context = '', items, fetchImpl = fetch, keyReader = () => readKey(keyPlace()),
  people = knownPeople(), maskerImpl = masker, wait }) {
  const s = settings(config);
  if (!Array.isArray(questions) || !questions.length) throw new Misuse('at least one question');
  const ids = questions.map((q, n) => String(q.id ?? `q${n + 1}`));
  if (new Set(ids).size !== ids.length) throw new Misuse('each question needs its own id');
  const compiled = questions.map((q) => question(q.kind || 'choice', q.text, q.options));
  const key = keyReader();
  let cost = 0;
  const one = async (item) => {
    const why = credentialMaterial(item.text);
    if (why) return { id: item.id, sent: false, why: `it is ${why}` };
    const m = maskerImpl({ idPattern: s.idPattern, words: s.words, people, patterns: s.patterns });
    let qs, whole, about;
    try {
      qs = Object.fromEntries(compiled.map((q0, n) => [`q${n}`, { ...q0, instructions: m.mask(q0.instructions),
        criteria: Array.isArray(q0.criteria) ? q0.criteria.map((l) => m.mask(l))
          : Object.fromEntries(Object.entries(q0.criteria).map(([k, v]) => [q0.type === 'noul' ? k : m.mask(k), m.mask(v)])) }]));
      whole = m.mask(item.text);
      about = m.mask(context);
    } catch (e) {
      if (e instanceof TooSlow) return { id: item.id, sent: false, why: `masking did not finish: ${e.message}` };
      throw e;
    }
    for (let n = MAX_CHARS; n >= MAX_CHARS / 8; n /= 2) {
      // The whole request is what must fit: the context gets a quarter of it.
      const state = context ? { context: cut(about, n / 4), item: cut(whole, n) } : { item: cut(whole, n) };
      const body = { model: s.model, state, questions: qs };
      const found = leaks(body);
      if (found.length) return { id: item.id, sent: false, why: 'masking left something that looks like a secret; nothing was sent' };
      const res = await post(s, key, body, fetchImpl, wait);
      if (res.tooLong) continue;
      cost += Number(res.usage?.cost || 0);
      const extra = { ...(whole.length > n || about.length > n / 4 ? { cut: true } : {}), ...('truth' in item ? { truth: item.truth } : {}) };
      const answers = {};
      compiled.forEach((q0, k) => {
        const q = qs[`q${k}`];
        try {
          const r = reading(q, res.answers?.[`q${k}`], s.sure);
          answers[ids[k]] = { answer: q.type === 'noul' ? r.answer : m.unmask(r.answer), p: Math.round(r.p * 1000) / 1000, settled: r.settled,
            ...(q.type === 'score' ? { level: r.level, score: r.score } : {}) };
        } catch (e) {
          if (!(e instanceof Malformed)) throw e;
          answers[ids[k]] = { answer: null, p: 0, settled: false, why: `Jev's answer was malformed: ${e.message}` };
        }
      });
      return { id: item.id, answers, ...extra };
    }
    return { id: item.id, sent: false, why: 'too long for Jev even cut to its head and tail' };
  };
  const out = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await one(items[i]);
    }
  }));
  return { items: out, cost, sure: s.sure, model: s.name, questions: ids };
}

/** One question of every item: what the set's own scripts ask. */
export async function ask({ kind = 'choice', text, options, ...rest }) {
  const r = await judge({ ...rest, questions: [{ id: 'q', kind, text, options }] });
  const answers = r.items.map((it) => (it.sent === false ? it : (({ answers: a, ...more }) => ({ ...more, ...a.q }))(it)));
  return { answers, cost: r.cost, sure: r.sure, model: r.model };
}

export function summary(answers, cost) {
  const sent = answers.filter((a) => a.sent !== false);
  const settled = sent.filter((a) => a.settled).length;
  const lines = [`${answers.length} items: Jev settled ${settled}, ${sent.length - settled} are yours to read, ${answers.length - sent.length} not sent; $${cost.toFixed(5)}`];
  if (answers.some((a) => 'truth' in a)) {
    const scored = sent.filter((a) => 'truth' in a);
    const right = (list) => list.filter((a) => [].concat(a.truth).map(String).includes(String(a.answer))).length;
    const rate = (list) => (list.length ? `${right(list)} of ${list.length}` : 'none');
    lines.push(`against the known answers: all ${rate(scored)} right; settled ${rate(scored.filter((a) => a.settled))}; `
      + `unsettled ${rate(scored.filter((a) => !a.settled))}`);
    // What each threshold would take off the agent, and at what accuracy: the
    // owner's trade-off, on this project's own cases.
    for (const t of THRESHOLDS) {
      const taken = scored.filter((a) => a.p >= t);
      lines.push(`at ${t}: Jev would settle ${taken.length} of ${scored.length}, ${rate(taken)} right`);
    }
  }
  return lines.join('\n');
}

// ---- self-test -------------------------------------------------------------------

async function selftest() {
  let failed = 0;
  const check = (name, ok, got) => {
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  jev: ${name}${ok ? '' : ` (got ${JSON.stringify(got)})`}`);
  };
  const throws = (f, type) => { try { f(); return false; } catch (e) { return e instanceof type; } };
  const m = masker({ idPattern: 'proj-[a-z0-9]+', words: ['acme-portal'], people: ['jdoe', 'Alice Smith'] });
  const source = 'proj-7xk and proj-7xk depend on proj-9aa; jdoe mailed jane@example.org from 10.1.2.3 '
    + 'in acme-portal at /home/jdoe/app, commit 4a1ad662; token=abcd1234efgh and ghp_abcdefghijklmnopqrstuvwxyz123456 '
    + 'via https://user:hunter22@db.example.com/x; password="correct horse battery staple"; '
    + 'Alice Smith deployed to db.prod.internal run 550e8400-e29b-41d4-a716-446655440000; edit src/check.mjs and README.md';
  const masked = m.mask(source);
  const ids = masked.match(/<ISSUE_[0-9a-f]{16}>/g) || [];
  check('the same id gets the same placeholder', ids.length === 3 && ids[0] === ids[1] && ids[0] !== ids[2], masked);
  check('a placeholder reads back as its value', m.unmask(ids[2]) === 'proj-9aa', ids);
  for (const [name, gone] of [['person', 'jdoe'], ['full name', 'Alice Smith'], ['email', 'jane@example.org'], ['address', '10.1.2.3'],
    ['project word', 'acme-portal'], ['commit', '4a1ad662'], ['token value', 'abcd1234efgh'], ['github token', 'ghp_abcdefghijklmnopqrstuvwxyz123456'],
    ['url password', 'hunter22'], ['quoted password', 'battery staple'], ['bare host', 'db.prod.internal'], ['uuid', '550e8400']])
    check(`a ${name} does not leave`, !masked.includes(gone), masked);
  check('file names and paths stay, they are the signal', masked.includes('src/check.mjs') && masked.includes('README.md'), masked);
  const again = masker({ idPattern: 'proj-[a-z0-9]+' }).mask('proj-9aa');
  check('the next request does not reuse a placeholder', /^<ISSUE_[0-9a-f]{16}>$/.test(again) && again !== ids[2], [again, ids[2]]);
  const twice = [masker({ idPattern: 'proj-[a-z0-9]+' }).mask('proj-9aa'), masker({ idPattern: 'proj-[a-z0-9]+' }).mask('proj-9aa')];
  check('two requests give one value unrelated placeholders', twice[0] !== twice[1], twice);
  const planted = masker({ idPattern: 'proj-[a-z0-9]+' });
  const tricked = planted.mask('proj-a said <ISSUE_1> and <ISSUE_abcdef>');
  const own = tricked.match(/<ISSUE_[0-9a-f]{16}>/g) || [];
  check('a placeholder written in the input cannot read back as a value', own.length === 1 && planted.unmask('<ISSUE_abcdef>') === '<ISSUE_abcdef>', tricked);
  check('a PGP private key is removed', !masker().mask('-----BEGIN PGP PRIVATE KEY BLOCK-----\nlQOYBF\n-----END PGP PRIVATE KEY BLOCK-----').includes('lQOYBF'));
  check('a private key is not sent', credentialMaterial('-----BEGIN RSA PRIVATE KEY-----\nMIIE\n-----END RSA PRIVATE KEY-----') !== null);
  check('an env file is not sent', credentialMaterial('DB_HOST=x\nDB_USER=y\nDB_PASSWORD=z\n') !== null);
  check('prose with one assignment is sent', credentialMaterial('Set LEVEL=debug to see more. It helps.') === null);
  check('a leak is found in the rendered request', leaks({ state: { item: 'key ghp_abcdefghijklmnopqrstuvwxyz123456' } }).length === 1);
  check('a masked request shows no leak', leaks({ state: { item: masked } }).length === 0, leaks({ state: { item: masked } }));
  const hang = masker({ patterns: [{ name: 'slow', pattern: '(a|aa)+$' }] });
  const started = Date.now();
  check('a project pattern that runs too long is stopped', throws(() => hang.mask(`${'a'.repeat(40)}!`), TooSlow) && Date.now() - started < PATTERN_MS + 1500);
  const phoned = masker().mask('Bob called 415-555-0123 at db.prod.example; password=correct horse battery');
  check('a local phone number, a test host and an unquoted multi-word password do not leave',
    !/415-555|db\.prod\.example|horse/.test(phoned), phoned);
  check('a pattern that matches nothing is refused', throws(() => safePattern('x*', 'p'), Misuse));
  check('an ordinary id pattern is accepted', typeof safePattern('proj-[a-z0-9]+(?:-[a-z0-9]+)*', 'p') === 'string');

  check('no consent, no call', throws(() => settings({ jev: { consent: false } }), Unavailable));
  check('no config entry, no call', throws(() => settings({}), Unavailable));
  check('a key place in the project config is refused', throws(() => settings({ jev: { consent: true, key: { command: ['sh'] } } }), Misuse));
  check('a broken pattern in the config is refused before any call', throws(() => settings({ jev: { consent: true, idPattern: 'proj-(' } }), Misuse));
  check('a relative config home is not trusted', keyPlaceFile({ XDG_CONFIG_HOME: '.' }, '') === join(homedir(), '.config', 'shady2k-skills', 'jev.json'));
  check('a key place inside the working copy is refused', throws(() => keyPlaceFile({ XDG_CONFIG_HOME: '/repo/cfg' }, '/repo'), Unavailable));
  check('the key place is read from the machine', keyPlace({ env: { XDG_CONFIG_HOME: '/x' }, top: '', read: (f) => (f === '/x/shady2k-skills/jev.json' ? '{"key":{"env":"K"}}' : '') }).env === 'K');
  check('no key place on the machine is unavailable', throws(() => keyPlace({ env: {}, top: '', read: () => { throw new Error('none'); } }), Unavailable));
  check('a key from the environment', readKey({ env: 'K' }, { env: { K: ' abc \n' } }) === 'abc');
  check('an empty key is unavailable', throws(() => readKey({ env: 'K' }, { env: {} }), Unavailable));
  check('a key from a command', readKey({ command: ['vault', 'read'] }, { run: () => 'xyz\n' }) === 'xyz');
  let said = '';
  try { readKey({ command: ['vault', 'read', '-token=s3cret'] }, { run: () => { throw new Error('x'); } }); } catch (e) { said = e.message; }
  check('a failed key source is named without its arguments', /vault/.test(said) && !/s3cret/.test(said), said);

  check('a choice always has a way out', 'none' in question('choice', 'q', { a: 'A', b: 'B' }).criteria);
  check('a check needs true and false', throws(() => question('check', 'q', { yes: 1, no: 0 }), Misuse));
  const cq = { type: 'choice', criteria: { a: 'A', b: 'B', none: 'N' } };
  const r1 = reading(cq, { choice: 'a', probabilities: { a: 0.97, b: 0.03, none: 0 } });
  const r2 = reading(cq, { choice: 'a', probabilities: { a: 0.7, b: 0.3, none: 0 } });
  const r3 = reading({ type: 'noul' }, { noul: 0.02 });
  check('a confident answer is settled', r1.settled, r1);
  check('the middle goes back to the agent', !r2.settled, r2);
  check('a confident no is settled as false', r3.settled && r3.answer === 'false' && r3.p === 0.98, r3);
  check('a choice at the threshold is settled', reading(cq, { choice: 'a', probabilities: { a: 0.9, b: 0.1, none: 0 } }).settled);
  check('a choice just below the threshold goes back to the agent', !reading(cq, { choice: 'a', probabilities: { a: 0.89, b: 0.11, none: 0 } }).settled);
  check('a check at either threshold is settled', reading({ type: 'noul' }, { noul: 0.9 }).settled && reading({ type: 'noul' }, { noul: 0.1 }).settled);
  check('a check just inside either threshold goes back to the agent', !reading({ type: 'noul' }, { noul: 0.89 }).settled && !reading({ type: 'noul' }, { noul: 0.11 }).settled);
  check('an answer outside the options is malformed', throws(() => reading(cq, { choice: 'zzz', probabilities: { a: 0.99 } }), Malformed));
  check('a probability out of range is malformed', throws(() => reading(cq, { choice: 'a', probabilities: { a: 7, b: 0, none: 0 } }), Malformed));
  check('probabilities for only some answers are malformed', throws(() => reading(cq, { choice: 'a', probabilities: { a: 0.99 } }), Malformed));
  check('a probability for an answer not given is malformed', throws(() => reading(cq, { choice: 'a', probabilities: { a: 0.99, b: 0.01, none: 0, extra: 0 } }), Malformed));
  check('probabilities that do not add up are malformed', throws(() => reading(cq, { choice: 'a', probabilities: { a: 0.99, b: 0.99, none: 0.99 } }), Malformed));
  check('a choice of an inherited name is malformed', throws(() => reading(cq, { choice: 'toString', probabilities: { a: 0.99, b: 0.01, none: 0 } }), Malformed));
  check('a choice that is not the most probable is malformed', throws(() => reading(cq, { choice: 'b', probabilities: { a: 0.9, b: 0.1, none: 0 } }), Malformed));
  check('"too long" is read from the service\'s own field', tooLongReply('{"error":{"message":"HTTP 400: {\\"detail\\":{\\"error_type\\":\\"max_tokens_exceeded\\"}}","code":400}}')
    && tooLongReply('{"detail":{"error_type":"max_tokens_exceeded"}}') && !tooLongReply('{"error":"see \\"error_type\\":\\"max_tokens_exceeded\\" in the docs"}'));
  check('a check without a probability is malformed', throws(() => reading({ type: 'noul' }, { noul: 'yes' }), Malformed));

  const sent = [];
  const reply = (status, body) => ({ ok: status === 200, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
  const fake = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push(body);
    const item = body.state.item;
    if (item.includes('bad-request')) return reply(400, { error: 'context must be an object' });
    if (item.includes('echo')) return reply(422, { error: `unprocessable, sent ${init.headers.Authorization}` });
    if (item.includes('refused')) return reply(401, { error: `bad key ${init.headers.Authorization}` });
    const qk = Object.keys(body.questions)[0];
    if (item.includes('garbage')) return reply(200, { answers: { [qk]: { type: 'choice', choice: 'made-up', probabilities: { 'made-up': 1 } } } });
    if (item.includes('slashed')) return reply(422, { error: `unprocessable, sent ${encodeURIComponent(init.headers.Authorization)}` });
    if (item.length > 40000) return reply(400, '{"error":{"message":"HTTP 400: {\\"detail\\":{\\"error_type\\":\\"max_tokens_exceeded\\"}}","code":400}}');
    const keys = Object.keys(body.questions[qk].criteria);
    const pick = keys.find((k) => item.includes(k)) || 'none';
    return reply(200, { answers: { [qk]: { type: 'choice', choice: pick,
      probabilities: Object.fromEntries(keys.map((k, _, all) => {
        const p = item.includes('unsure') ? 0.6 : 0.99;
        return [k, k === pick ? p : (1 - p) / (all.length - 1)];
      })) } }, usage: { cost: 0.00001 } });
  };
  const config = { jev: { consent: true, idPattern: 'proj-[a-z0-9]+' } };
  const base = { config, text: 'Which item is this about?', options: { 'proj-a1': 'Login', 'proj-b2': 'Billing' }, fetchImpl: fake, keyReader: () => 'k3y', people: [], wait: async () => {} };
  const { answers, cost } = await ask({ ...base,
    items: [{ id: 's1', text: 'worked on proj-a1 today', truth: 'proj-a1' }, { id: 's2', text: 'unsure, maybe proj-b2', truth: 'proj-a1' },
      { id: 's3', text: 'A=1\nB=2\nAPI_KEY=zzz\n' }, { id: 's4', text: `proj-b2 ${'x'.repeat(70000)}` }, { id: 's5', text: 'nothing listed here' }] });
  check('an answer comes back as the id, not its placeholder', answers[0].answer === 'proj-a1' && answers[0].settled, answers[0]);
  check('an unsure answer is not settled', answers[1].answer === 'proj-b2' && !answers[1].settled, answers[1]);
  check('credential material is not sent', answers[2].sent === false && /environment/.test(answers[2].why) && sent.every((b) => !b.state.item.includes('API_KEY')), answers[2]);
  check('a long item is cut until it fits', answers[3].answer === 'proj-b2' && answers[3].cut === true, answers[3]);
  check('"none" comes back as none', answers[4].answer === 'none', answers[4]);
  check('no id leaves in the request', sent.every((b) => !JSON.stringify(b).includes('proj-')), sent.map((b) => JSON.stringify(b)).find((x) => x.includes('proj-')));
  check('cost is summed', Math.abs(cost - 0.00004) < 1e-9, cost);
  const hugeContext = await ask({ ...base, context: `proj-a1 ${'c'.repeat(200000)}`, items: [{ id: 'c', text: 'short' }] });
  check('a long context is cut too', hugeContext.answers[0].cut === true && sent.at(-1).state.context.length < 20000, hugeContext.answers[0]);
  const garbage = await ask({ ...base, items: [{ id: 'g', text: 'garbage' }] });
  check('a malformed answer is never settled', garbage.answers[0].answer === null && !garbage.answers[0].settled, garbage.answers[0]);
  let err = null;
  try { await ask({ ...base, items: [{ id: 'b', text: 'bad-request' }] }); } catch (e) { err = e; }
  check('another 400 is an error, not "too long"', err && !(err instanceof Unavailable) && /400/.test(err.message) && sent.at(-1).state.item === 'bad-request', err?.message);
  err = null;
  try { await ask({ ...base, items: [{ id: 'r', text: 'refused' }] }); } catch (e) { err = e; }
  check('a refused key is unavailable, and not echoed', err instanceof Unavailable && !/k3y/.test(err.message), err?.message);
  err = null;
  try { await ask({ ...base, items: [{ id: 'e', text: 'echo' }] }); } catch (e) { err = e; }
  check('an error that echoes the key does not repeat it', err && /422/.test(err.message) && !/k3y/.test(err.message), err?.message);
  err = null;
  try { await ask({ ...base, keyReader: () => 'k3y/abc', items: [{ id: 'e2', text: 'slashed' }] }); } catch (e) { err = e; }
  check('nor in another spelling', err && !/k3y|abc/.test(err.message), err?.message);
  let down = 0;
  err = null;
  try { await ask({ ...base, fetchImpl: async () => { down++; throw new Error('ECONNREFUSED'); }, items: [{ id: 'n', text: 'x' }] }); } catch (e) { err = e; }
  check('an unreachable service is unavailable after retries', err instanceof Unavailable && down === 4, [err?.message, down]);
  const slow = await ask({ ...base, config: { jev: { consent: true, maskPatterns: [{ name: 'slow', pattern: '(a|aa)+$' }] } }, items: [{ id: 'z', text: `${'a'.repeat(40)}!` }] });
  check('an item a project pattern cannot mask in time is not sent', slow.answers[0].sent === false && /did not finish/.test(slow.answers[0].why), slow.answers[0]);
  const broken = await ask({ ...base, items: [{ id: 'x', text: 'key ghp_abcdefghijklmnopqrstuvwxyz123456' }], maskerImpl: () => ({ mask: (x) => x, unmask: (x) => x }) });
  check('a request the masking missed is not sent', broken.answers[0].sent === false && /secret/.test(broken.answers[0].why), broken.answers[0]);
  const sq = question('score', 'How serious?', ['harmless', 'annoying', 'blocks a release']);
  const sr = reading(sq, { score: 1.02, probabilities: { 0: 0.01, 1: 0.96, 2: 0.03 } });
  check('a score settles on the level holding the probability', sr.settled && sr.answer === 'annoying' && sr.level === 1 && sr.score === 1.02, sr);
  check('a spread score goes back to the agent', !reading(sq, { score: 0.73, probabilities: { 0: 0.28, 1: 0.71, 2: 0.01 } }).settled);
  check('a score without a probability per level is malformed', throws(() => reading(sq, { score: 1, probabilities: { 0: 1 } }), Malformed));
  check('a score needs two levels', throws(() => question('score', 'q', ['only']), Misuse));
  check('the project\'s threshold decides what is settled', !reading(cq, { choice: 'a', probabilities: { a: 0.93, b: 0.07, none: 0 } }, 0.95).settled
    && reading(cq, { choice: 'a', probabilities: { a: 0.93, b: 0.07, none: 0 } }, 0.9).settled);
  check('a threshold that is not a probability above one half is refused', throws(() => settings({ jev: { consent: true, sure: 0.4 } }), Misuse)
    && throws(() => settings({ jev: { consent: true, sure: 1 } }), Misuse));
  check('the project names its Jev, and a strange name is refused', settings({ jev: { consent: true, model: 'jev-2.0' } }).model === 'typesafe/jev-2.0'
    && settings({ jev: { consent: true, route: 'typesafe', model: 'jev-2.0' } }).model === 'jev-2.0'
    && throws(() => settings({ jev: { consent: true, model: 'gpt-5' } }), Misuse));
  check('without them, the measured defaults', settings({ jev: { consent: true } }).sure === SETTLED && settings({ jev: { consent: true } }).model === `typesafe/${MODEL}`);
  const many = [];
  const both = await judge({ ...base, config: { jev: { consent: true, sure: 0.95, model: 'jev-9.9', idPattern: 'proj-[a-z0-9]+' } },
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      many.push(body);
      return reply(200, { answers: { q0: { type: 'noul', noul: 0.97 }, q1: { type: 'score', score: 2, probabilities: { 0: 0, 1: 0.07, 2: 0.93 } } } });
    },
    questions: [{ id: 'flaky', kind: 'check', text: 'Flaky?', options: { true: 'flaky', false: 'a real bug' } },
      { id: 'sev', kind: 'score', text: 'How serious?', options: ['harmless', 'annoying', 'blocks a release'] }],
    items: [{ id: 'log', text: 'three tests timed out on a busy runner' }] });
  check('several questions go in one request per item', many.length === 1 && Object.keys(many[0].questions).length === 2
    && many[0].model === 'typesafe/jev-9.9', many);
  check('each comes back under its own id, judged by the project\'s threshold', both.items[0].answers.flaky.settled
    && both.items[0].answers.sev.answer === 'blocks a release' && !both.items[0].answers.sev.settled && both.sure === 0.95, both.items[0]);
  const replayed = summary([{ id: 1, answer: 'a', p: 0.97, settled: true, truth: 'a' }, { id: 2, answer: 'a', p: 0.85, settled: false, truth: 'b' },
    { id: 3, answer: 'b', p: 0.92, settled: true, truth: 'b' }], 0);
  check('a replay shows what each threshold would take and how right', /at 0.8: Jev would settle 3 of 3, 2 of 3 right/.test(replayed)
    && /at 0.9: Jev would settle 2 of 3, 2 of 2 right/.test(replayed) && /at 0.95: Jev would settle 1 of 3, 1 of 1 right/.test(replayed), replayed);
  const files = { 'a.json': '{"name": 1}', 'backlog/config.json': '{"jev": {"consent": true}}', 'b.json': '{"jev": 1}', 'bad.json': '{"jev": {' };
  const finding = (names) => ({ top: '/w', list: () => names.join('\0'), read: (f) => files[f.slice(3)] });
  check('the one config with a jev section is found', findConfig(finding(Object.keys(files))) === join('/w', 'backlog/config.json'),
    findConfig(finding(Object.keys(files))));
  check('none means the project has not agreed', throws(() => findConfig(finding(['a.json', 'bad.json'])), Unavailable));
  check('two are a question, not a guess', throws(() => findConfig(finding(['backlog/config.json', 'backlog/config.json'])), Misuse));
  check('outside a working copy there is none', throws(() => findConfig({ top: '', list: () => '' }), Unavailable));
  const s = summary(answers, cost);
  check('the summary counts settled, unsettled and not sent', /5 items: Jev settled 3, 1 are yours to read, 1 not sent/.test(s), s);
  check('a replay scores against the known answers', /all 1 of 2 right; settled 1 of 1; unsettled 0 of 1/.test(s), s);
  return failed ? 1 : 0;
}

// ---- command line ------------------------------------------------------------------

function parse(args) {
  const opts = { config: null, question: null, options: null, kind: 'choice', context: '' };
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i]?.replace(/^--/, '');
    if (!(k in opts) || args[i + 1] === undefined) throw new Misuse(`unknown or incomplete option ${args[i]}`);
    opts[k] = args[i + 1];
  }
  return opts;
}

const stdin = () => readFileSync(0, 'utf8');

async function main(argv) {
  const usage = 'jev.mjs status|ask|replay|mask [--config <gate-config>] [--question <text> --options <json> --kind choice|check|score --context <text>]\njev.mjs --selftest\nExit 0 done, 2 invalid use, 3 unavailable.';
  const [command, ...rest] = argv;
  if (command === '--selftest' && !rest.length) return selftest();
  try {
    if (!['status', 'ask', 'replay', 'mask'].includes(command)) throw new Misuse('unknown command');
    const opts = parse(rest);
    opts.config ||= findConfig();
    let config;
    try { config = JSON.parse(readFileSync(opts.config, 'utf8')); } catch { throw new Misuse(`${opts.config} is not a readable JSON config`); }
    if (command === 'mask') {
      const s = config.jev || {};
      console.log(masker({ idPattern: s.idPattern, patterns: s.maskPatterns || [], words: [...(config.projectWords || []), ...(config.trackerWords || [])], people: knownPeople() }).mask(stdin()));
      return 0;
    }
    const s = settings(config);
    if (command === 'status') {
      // Proved by one call about a fixed sentence: no project text leaves.
      const { answers } = await ask({ config, kind: 'check', text: 'Is the sky in this sentence blue?',
        options: { true: 'It says the sky is blue.', false: 'It does not.' }, items: [{ id: 'probe', text: 'The sky is blue.' }], people: [] });
      if (answers[0].sent === false || answers[0].answer === null) throw new Unavailable(`the proving call failed: ${answers[0].why}`);
      console.log(`available: consent recorded, key accepted by a call, route ${config.jev.route || 'openrouter'}, `
        + `${s.name}, answers taken at ${s.sure} and above`);
      return 0;
    }
    let options;
    try { options = JSON.parse(opts.options); } catch { throw new Misuse('--options must be JSON'); }
    const items = stdin().split('\n').filter((l) => l.trim()).map((l, i) => {
      let it;
      try { it = JSON.parse(l); } catch { throw new Misuse(`items line ${i + 1} is not JSON`); }
      if (typeof it.text !== 'string') throw new Misuse(`items line ${i + 1} has no "text"`);
      if (command === 'replay' && !('truth' in it)) throw new Misuse(`items line ${i + 1} has no "truth" to replay against`);
      return { id: it.id ?? i + 1, ...it };
    });
    const { answers, cost } = await ask({ config, kind: opts.kind, text: opts.question, options, context: opts.context, items });
    for (const a of answers) console.log(JSON.stringify(a));
    console.error(summary(answers, cost));
    return 0;
  } catch (e) {
    if (e instanceof Unavailable) { console.error(`Jev unavailable: ${e.message}`); return 3; }
    if (e instanceof Misuse) { console.error(`${e.message}\n${usage}`); return 2; }
    console.error(e.message);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await main(process.argv.slice(2));
