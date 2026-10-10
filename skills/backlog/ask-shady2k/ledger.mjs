#!/usr/bin/env node
/**
 * The project's time ledger: every session that worked on this project, split
 * by who spent the time and on what.
 *
 * Every number here is either read from what a harness recorded or measured
 * from its stamps, and says which; what a record does not carry is unknown,
 * never zero. A session's minutes are laid out on its own clock as intervals:
 * the model generating, a tool running, a question waiting on the owner, the
 * rest of an agent's turn, and the gaps between turns. Where they overlap,
 * one wins by a fixed order, so the buckets always add up to the clock. The
 * only judgement left is where the owner answering becomes the owner away.
 *
 * take-task owns this file; the skills that link it carry copies.
 */
import { execFileSync } from 'node:child_process';
import {
  closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, readSync,
  realpathSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// A gap before the owner's message this long is him reading and answering;
// longer than this, he was somewhere else and the agent was simply stopped.
// A question the agent put to him is held to the same line.
export const ANSWER_MINUTES = 10;
// A session whose last record is this recent may still be running; it is
// counted up to that record and no further.
const OPEN_MINUTES = 15;

export class Usage extends Error {}

const claudeHome = () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const codexHome = () => process.env.CODEX_HOME || join(homedir(), '.codex');
// pi, omp and prime-agent keep sessions in one layout, each in its own home.
// omp kept pi's variables for its folders, so a folder they name is pi's when
// pi runs this (pi alone tells its tools which session they are in) and omp's
// otherwise; the other one is in its own home.
const piNamed = () => process.env.PI_CODING_AGENT_SESSION_DIR
  || (process.env.PI_CODING_AGENT_DIR ? join(process.env.PI_CODING_AGENT_DIR, 'sessions') : null);
const inPi = () => !!process.env.PI_SESSION_ID;
const ompSessions = () => (!inPi() && piNamed()) || join(homedir(), '.omp', 'agent', 'sessions');
const piSessions = () => (inPi() && piNamed()) || join(homedir(), '.pi', 'agent', 'sessions');
const primeSessions = () => process.env.PRIME_AGENT_SESSION_DIR || process.env.PRIME_AGENT_CODING_AGENT_SESSION_DIR
  || join(process.env.PRIME_AGENT_CODING_AGENT_DIR || join(homedir(), '.prime', 'agent'), 'sessions');
// The harnesses that write pi's shape of session, and where each keeps them.
const PI_FAMILY = { omp: ompSessions, pi: piSessions, 'prime-agent': primeSessions };

// ---- the agents: one adapter per harness -------------------------------------

// What a harness cannot do here is said where a person reads it, never guessed
// at: a session the set cannot read is refused by name, not counted as no time.
export class Unsupported extends Usage {}

/**
 * The set asks every agent the same three things, and one adapter per harness
 * answers them. This is the contract each entry satisfies; the self-test holds
 * every entry to it, so an adapter added later cannot quietly answer less.
 *
 *   name           the harness as a person reads it.
 *   env            the environment variables this harness names its session
 *                  with, most specific first; empty where it tells its tools
 *                  nothing, and --harness with --session is the only way.
 *                  `agentEnv` names the agent itself where the harness has
 *                  one, since one session may run several agents; `identity`
 *                  is then 'agent', and 'session' where one session is one
 *                  agent and only the session is known.
 *   current(env)   this process's own session, from those variables alone:
 *                  {id, agent}, or null where the harness says nothing. The
 *                  shared current() asks each adapter in turn and refuses a
 *                  harness this copy cannot read, so no record is written
 *                  naming one.
 *   sessions()     the transcript references this harness left on this machine,
 *                  each {path, mtimeMs, name, sub?, parent?}: `sub` is the
 *                  sidecar the reader needs, `parent` the session the layout
 *                  says started it. Read, never measured.
 *   transcripts(sid)  the paths whose file really holds that session, so a
 *                  name that merely contains the id is not one: the layout
 *                  confirms it where it can, and the caller decodes the file
 *                  and keeps only the raw record whose id is the one asked for.
 *   subagents(sid)    the sessions this one started, as references with the id
 *                  the harness gives them, DIRECT children only; a harness
 *                  that keeps them nowhere this can see has no subagentList
 *                  and is refused by subagents(), never answered empty.
 *   subagentList   how those children are found, or null where the harness
 *                  keeps them nowhere this can see.
 *   read(ref)      the raw record of one reference, read but not measured.
 *   location(path) where it ran and which repository it recorded.
 *   lateHints(path) what only a later line of the transcript says about its
 *                  working copy, where the harness writes that.
 *   limits         what this harness cannot do here, in the words a person
 *                  reads when the set asks for it.
 *
 * A harness with no entry is refused with `unsupported here: ...` by
 * `adapter()`, so no caller invents its own wording and nothing falls through
 * to another harness's reader.
 */
export const ADAPTERS = {
  'claude-code': {
    name: 'Claude Code',
    env: ['CLAUDE_CODE_SESSION_ID'],
    agentEnv: null,
    current: (env) => (env.CLAUDE_CODE_SESSION_ID ? { id: env.CLAUDE_CODE_SESSION_ID, agent: null } : null),
    sessions: claudeSessions,
    transcripts: claudeTranscripts,
    subagents: claudeSubagents,
    subagentList: 'the subagents folder of the session that started them',
    read: (ref) => readClaude(ref.path, ref.sub ?? null),
    location: (path) => ({ cwd: head(path).find((d) => d.cwd)?.cwd || null, hints: {} }),
    lateHints: laterHints,
    limits: 'tell a worker apart from its coordinator: an in-process subagent is given its coordinator\'s session id, so only the session is known, and the worker records nothing of its own',
  },
  codex: {
    name: 'Codex',
    env: ['CODEX_THREAD_ID', 'CODEX_SESSION_ID'],
    agentEnv: null,
    current: (env) => { const id = env.CODEX_THREAD_ID || env.CODEX_SESSION_ID; return id ? { id, agent: null } : null; },
    sessions: codexSessions,
    transcripts: codexTranscripts,
    subagents: codexSubagents,
    subagentList: 'the parent session each rollout names',
    read: (ref) => readCodex(ref.path),
    location: (path) => {
      const meta = head(path).find((d) => d.type === 'session_meta')?.payload || {};
      return { cwd: meta.cwd || null, hints: { remote: meta.git?.repository_url || null } };
    },
    lateHints: null,
    limits: null,
  },
  omp: {
    name: 'omp',
    env: [],
    agentEnv: null,
    current: () => null,
    sessions: () => piShapeSessions('omp', ompSessions),
    transcripts: (sid) => piShapeTranscripts('omp', ompSessions, sid),
    subagents: (sid) => piShapeSubagents('omp', ompSessions, sid),
    subagentList: 'the folder of the session that started them',
    read: (ref) => readPi(ref.path, { harness: 'omp', parent: ref.parent ?? null }),
    location: (path) => piShapeLocation(path),
    lateHints: null,
    limits: 'name its own session: it is told with --harness and --session',
  },
  pi: {
    name: 'Pi',
    env: ['PI_SESSION_ID'],
    agentEnv: null,
    current: (env) => (env.PI_SESSION_ID ? { id: env.PI_SESSION_ID, agent: null } : null),
    sessions: () => piShapeSessions('pi', piSessions),
    transcripts: (sid) => piShapeTranscripts('pi', piSessions, sid),
    subagents: () => [],
    subagentList: null,
    read: (ref) => readPi(ref.path, { harness: 'pi' }),
    location: (path) => piShapeLocation(path),
    lateHints: null,
    limits: 'list a session\'s subagents: it keeps them nowhere this copy can see',
  },
  'prime-agent': {
    name: 'Prime Agent',
    env: [],
    agentEnv: null,
    current: () => null,
    sessions: () => piShapeSessions('prime-agent', primeSessions),
    transcripts: (sid) => piShapeTranscripts('prime-agent', primeSessions, sid),
    subagents: primeSubagentsOf,
    subagentList: 'the parent session each one names, among its artifacts',
    read: (ref) => readPi(ref.path, { harness: 'prime-agent', parent: ref.parent ?? null }),
    location: (path) => piShapeLocation(path),
    lateHints: null,
    limits: 'name its own session: it is told with --harness and --session',
  },
};

/**
 * What an adapter knows of the agent: the session alone where one session may
 * run several agents, and the agent within it where the harness names one.
 */
export const identityOf = (a) => (a.agentEnv ? 'agent' : 'session');

/** Every harness this copy of the set reads. */
export const adapterNames = () => Object.keys(ADAPTERS);

/** Whether this copy of the set has an adapter for a harness at all. */
export const hasAdapter = (harness) => Object.prototype.hasOwnProperty.call(ADAPTERS, harness);

/**
 * The adapter of a harness, or a refusal that says what is missing. Callers
 * never fall through to another harness's reader, and never report a harness
 * they cannot read as a session whose time is merely unknown.
 */
export function adapter(harness) {
  if (!hasAdapter(harness))
    throw new Unsupported(`unsupported here: no transcript adapter for ${harness}; this copy of the set reads ${adapterNames().join(', ')}`);
  return ADAPTERS[harness];
}

/** The environment variables any adapter reads the current session from. */
export const sessionEnvVars = () => Object.values(ADAPTERS).flatMap((a) => [...a.env, ...(a.agentEnv ? [a.agentEnv] : [])]);

/**
 * Who is running this, from what the harness itself says: the session this
 * process is in, and the agent within it where the harness names one. An
 * explicit --harness and --session come first, since omp and Prime Agent tell
 * their tools neither, and a harness this copy cannot read is refused there
 * rather than written into a record nobody here can ever measure. Returns null
 * where the harness says nothing about itself.
 */
export function current({ harness = null, session = null, env = process.env } = {}) {
  if (harness && session) {
    adapter(harness);
    return { harness, id: session, key: `${harness}:${session}`, agent: null };
  }
  for (const [name, a] of Object.entries(ADAPTERS)) {
    const me = a.current(env);
    if (me) return { harness: name, id: me.id, key: `${name}:${me.id}`, agent: me.agent ?? null };
  }
  return null;
}

/**
 * The sessions a session started, where the harness keeps them apart. A
 * harness whose children this copy cannot see has no list to give, and says so
 * rather than answering that there are none.
 */
export function subagents(harness, sid) {
  const a = adapter(harness);
  if (!a.subagentList) throw new Unsupported(`unsupported here: ${a.name} keeps no list of a session's subagents this copy can see`);
  if (!sid) return [];
  return a.subagents(sid).map((r) => ({ harness, id: r.id ?? null, path: r.path, parent: r.parent ?? sid }));
}

/** What this copy of the set reads, and what each harness cannot do here. */
export function describeAdapters() {
  const out = [];
  for (const [harness, a] of Object.entries(ADAPTERS)) {
    const reads = ['a session\'s transcript'];
    reads.push(a.env.length ? 'the current session' : 'the current session only with --harness and --session');
    reads.push(a.subagentList ? 'a session\'s subagents' : 'no list of a session\'s subagents');
    reads.push(identityOf(a) === 'agent' ? 'the agent within the session as well as the session' : 'the session (the agent within it is not told apart, where the harness runs several)');
    out.push(`${a.name} (${harness})`, `  reads: ${reads.join('; ')}`);
    if (a.limits) out.push(`  cannot: ${a.limits}`);
  }
  out.push('', 'A harness with no adapter is refused by name ("unsupported here: what is missing"),',
    'never read as a session whose time is unknown.');
  return out.join('\n');
}

const parseTime = (s) => (typeof s === 'number' ? s : s ? Date.parse(s) : NaN);
const minutes = (ms) => ms / 60e3;

// ---- dates, in the owner's own time ----------------------------------------

// A bare date is a day on this machine's clock, not in UTC: --since takes its
// first minute and --until its last. Anything with a time is read as written.
export function parseWhen(s, { end = false } = {}) {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (day) return new Date(+day[1], +day[2] - 1, +day[3] + (end ? 1 : 0)).getTime();
  return Date.parse(s);
}

export function localStamp(ms, { time = true } = {}) {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const zone = `${off >= 0 ? '+' : '-'}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return time ? `${date} ${p(d.getHours())}:${p(d.getMinutes())} ${zone}` : date;
}

// ---- intervals -------------------------------------------------------------

export function union(list) {
  const s = list.filter((x) => x.end > x.start).map((x) => ({ start: x.start, end: x.end })).sort((a, b) => a.start - b.start);
  const out = [];
  for (const x of s) {
    const last = out.at(-1);
    if (last && x.start <= last.end) last.end = Math.max(last.end, x.end);
    else out.push(x);
  }
  return out;
}
export const span = (list) => list.reduce((n, x) => n + (x.end - x.start), 0);
const clipTo = (list, windows) => union(list.flatMap((x) =>
  windows.map((w) => ({ start: Math.max(x.start, w.start), end: Math.min(x.end, w.end) }))));
// What of a is not in b; both are unions.
export function minus(a, b) {
  const out = [];
  for (const x of a) {
    let pieces = [{ ...x }];
    for (const y of b) pieces = pieces.flatMap((p) => (y.end <= p.start || y.start >= p.end ? [p]
      : [{ start: p.start, end: y.start }, { start: y.end, end: p.end }].filter((q) => q.end > q.start)));
    out.push(...pieces);
  }
  return out;
}

// ---- which repository a working directory is -------------------------------

const gitCache = new Map();
function git(args, cwd) {
  const key = `${cwd}\0${args.join('\0')}`;
  if (!gitCache.has(key)) {
    let out = null;
    try {
      out = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch { /* not a repository, or git is absent */ }
    gitCache.set(key, out);
  }
  return gitCache.get(key);
}
const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
const commonDir = (cwd) => {
  if (!cwd || !existsSync(cwd)) return null;
  const c = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  return c ? real(c) : null;
};
// A remote spelled any way (ssh, https, with or without .git) is one name.
export const remoteKey = (url) => (url ? String(url).trim().toLowerCase()
  .replace(/^[a-z+]+:\/\//, '').replace(/^[^@/]+@/, '').replace(/:(?!\d)/, '/').replace(/\.git\/?$/, '').replace(/\/$/, '') : null);
const remotesOf = (common) => {
  const out = git(['--git-dir', common, 'config', '--get-regexp', '^remote\\..*\\.url$'], dirname(common)) || '';
  return out.split('\n').map((l) => remoteKey(l.split(/\s+/)[1])).filter(Boolean);
};
const under = (path, root) => !!path && !!root && (path === root || path.startsWith(root.endsWith(sep) ? root : root + sep));

// The project's name: the one given, else that of the checkout given with
// --repo, else that of the checkout this runs in. A name and a checkout that
// disagree are two different projects, and nothing is counted for either.
export function projectName(given, repo) {
  if (repo) {
    const c = commonDir(resolve(repo));
    if (!c) throw new Usage(`--repo ${repo} is not a git checkout`);
    const name = basename(dirname(c));
    if (given && given !== name) throw new Usage(`--repo ${repo} is a checkout of ${name}, not of ${given}`);
    return name;
  }
  if (given) return given;
  const common = commonDir(process.cwd());
  if (!common) throw new Usage('not in a git checkout: pass --project <name>');
  return basename(dirname(common));
}

/**
 * What the project is, as git knows it: its repository (the common git
 * directory every working copy of it shares), its remotes, its checkout, the
 * working copies git has registered for it (deleted ones included, until
 * they are pruned), and the folders those copies are kept in. A session
 * belongs by these, never by what its folder happens to be called.
 */
export function identify(project, { repo, cwds = [] } = {}) {
  const commons = new Set();
  const tryDir = (d) => { const c = commonDir(d); if (c && basename(dirname(c)) === project) commons.add(c); };
  if (repo) {
    const c = commonDir(repo);
    if (!c) throw new Usage(`--repo ${repo} is not a git checkout`);
    if (basename(dirname(c)) !== project) throw new Usage(`--repo ${repo} is a checkout of ${basename(dirname(c))}, not of ${project}`);
    commons.add(c);
  } else {
    tryDir(process.cwd());
    // Run from elsewhere: the project is the repository of the sessions whose
    // working copy is named after it and is still on disk.
    if (!commons.size) for (const d of cwds) if (d.split(sep).includes(project)) tryDir(d);
  }
  const id = { project, commons, remotes: new Set(), checkouts: [], registered: [], roots: new Set() };
  for (const c of commons) {
    for (const r of remotesOf(c)) id.remotes.add(r);
    if (basename(c) === '.git') id.checkouts.push(dirname(c));
    const wt = join(c, 'worktrees');
    if (existsSync(wt))
      for (const n of readdirSync(wt)) {
        try { id.registered.push(dirname(readFileSync(join(wt, n, 'gitdir'), 'utf8').trim())); } catch { /* half-made */ }
      }
  }
  for (const p of id.registered) learnRoot(id, p);
  return id;
}

// A folder of working copies is a root when it is kept for this project
// alone, which its name says. A folder that also holds other repositories is
// not, however many copies of this one sit in it; one inside the checkout
// needs no root, since the checkout already answers for what is inside it.
function learnRoot(id, path) {
  const parent = dirname(path);
  if (basename(parent) === id.project && !id.checkouts.some((c) => under(parent, c))) id.roots.add(parent);
}

/**
 * Whether a session ran in this project, and on what evidence. A working
 * directory still on disk answers through git; one that is gone answers
 * through what was recorded about it: git's own list of the project's
 * working copies, the repository the session's harness wrote down, the
 * checkout a worktree was made from, or a folder kept for this project's
 * copies. With none of these it is not counted, and is counted as unknown.
 */
export function belongsTo(id, cwd, hints = {}, { roots = true } = {}) {
  if (!cwd) return { yes: false };
  const path = resolve(cwd);
  if (existsSync(path)) {
    const c = commonDir(path);
    if (!c) return { yes: false };
    if (id.commons.has(c)) return { yes: true, by: 'repository' };
    if (remotesOf(c).some((r) => id.remotes.has(r))) return { yes: true, by: 'remote' };
    return { yes: false };
  }
  if (id.registered.some((r) => under(path, r))) return { yes: true, by: 'registered working copy' };
  if (id.checkouts.some((c) => under(path, c))) return { yes: true, by: 'inside the checkout' };
  if (hints.remote) return id.remotes.has(remoteKey(hints.remote)) ? { yes: true, by: 'recorded repository' } : { yes: false };
  if (hints.repository && [...id.remotes].some((r) => r.endsWith(`/${String(hints.repository).toLowerCase()}`)))
    return { yes: true, by: 'recorded repository' };
  if (hints.origin && hints.origin !== cwd) {
    const o = belongsTo(id, hints.origin, {}, { roots: false });
    if (o.yes) return { yes: true, by: 'made from the checkout' };
  }
  if (roots && [...id.roots].some((r) => under(path, r))) return { yes: true, by: 'folder of working copies' };
  return { yes: false, unknown: true };
}

// ---- what a turn was spent on ----------------------------------------------

// Tools say what the agent was doing better than its prose does: a turn that
// ends in an edit was writing code, one that ends in a search was reading it.
const TOOLS = {
  develop: ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'apply_patch'],
  analyze: ['Read', 'Grep', 'Glob', 'ToolSearch', 'WebFetch', 'WebSearch', 'ReadMcpResourceTool', 'ListMcpResourcesTool', 'Skill', 'LSP', 'view_image'],
  delegate: ['Agent', 'Task', 'Workflow', 'SendMessage', 'ListAgents', 'TaskStop', 'TaskOutput', 'wait', 'wait_agent',
    'spawn_agent', 'send_input', 'send_message', 'followup_task', 'list_agents', 'close_agent'],
  ask: ['AskUserQuestion', 'ExitPlanMode', 'request_user_input', 'request_user_input_async'],
  plan: ['TodoWrite', 'EnterPlanMode', 'TaskCreate', 'TaskUpdate', 'TaskList', 'update_plan'],
  wait: ['Monitor', 'sleep'],
};
// Order matters. The forge before git, git's writes before a write through
// the shell (a commit message is a heredoc), a formatter before the checks
// (eslint --fix writes), the checks and builds before plain reading.
const Q = '(?:^|[\\s;|&(`\'"])';
let SHELL_WRITE;
const SHELL = [
  ['ci', /\bgh\s+(run|workflow)\b|\bgh\s+pr\s+checks\b/],
  ['git', /\bgit(\s+-[cC]\s+\S+|\s+--?[\w-]+(=\S+)?)*\s+(commit|push|merge|rebase|cherry-pick|tag|am|revert|reset|switch|checkout|worktree\s+(add|remove))\b|\bgh\s+pr\s+(create|merge|edit|close)\b/],
  ['develop', /\b(gofmt\s+-w|goimports\s+-w|prettier\s+(--write|-w)|cargo\s+fmt|rustfmt|black|isort|ruff\s+format|eslint\s+[^|;&]*--fix|biome\s+(format|check)\s+[^|;&]*--write)\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(format|fmt)\b/],
  ['test', /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|check|lint|typecheck)(:\S+)?\b|\b(pytest|jest|vitest|mocha|clippy|tsc|eslint|ruff|mypy|shellcheck|golangci-lint)\b|\b(go|cargo)\s+(test|check|clippy|vet)\b|\bmake\s+(test|check|lint)\b|--selftest\b|\bnode\s+--test\b|\bplugin\s+validate\b/],
  ['build', /\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b|\b(go|cargo)\s+build\b|\b(webpack|vite\s+build|docker\s+(build|compose)|make)\b/],
  // Writing a file through the shell is still writing it, and reading one
  // through the shell is still reading it.
  ['develop', SHELL_WRITE = /<<-?\s*['"]?[A-Za-z_]+|(?<![=\-<>2&])>\s*[^|&\s>]+\.[A-Za-z]{1,5}\b|\b(sed|perl)\s+-i\b|\bapply_patch\b|\btee\s|\b(mv|cp|rm|mkdir|touch|chmod)\s+-?[\w./]/],
  ['analyze', new RegExp(`${Q}(cat|sed|head|tail|less|ls|find|grep|rg|wc|jq|diff|tree|git|gh|awk|stat|file|pwd|nl|sort|uniq|du)\\s`)],
];
// A prime-agent call is a Python cell: the helpers it calls and the shell it
// runs say what it was for, and Python writing or reading a file is that.
const PRIME_CALLS = [
  ['delegate', /\brlm\.(spawn|list_subagents|delete_subagent|create_session)\s*\(|\b(list_subagents|delete_subagent)\s*\(/],
];
const PY_WRITES = /\b(write_text|write_bytes|edit)\s*\(|\bopen\([^)]*,\s*(mode\s*=\s*)?['"][wax]b?\+?['"]/;
const PY_READS = /\b(read_text|read_bytes|listdir|glob|open|read)\s*\(/;
// A Codex call is a little program; what it calls says what it was for.
const CODEX_CALLS = [
  ['ask', /\brequest_user_input/],
  ['delegate', /\b(spawn_agent|wait_agent|send_input|followup_task|list_agents|close_agent)\b/],
  ['develop', /\bapply_patch\b/],
  ['plan', /\bupdate_plan\b/],
];

export function category(name, input) {
  const text = typeof input === 'string' ? input : String(input?.command ?? input?.cmd ?? input?.code ?? '');
  if (name === 'ipython') {
    for (const [kind, re] of PRIME_CALLS) if (re.test(text)) return kind;
    for (const [kind, re] of SHELL) {
      if (re === SHELL_WRITE && PY_WRITES.test(text)) return 'develop';
      if (re.test(text)) return kind;
    }
    return PY_READS.test(text) ? 'analyze' : 'shell';
  }
  if (name === 'exec' || name === 'exec_command' || name === 'shell' || name === 'Bash' || name === 'local_shell') {
    if (name === 'exec') for (const [kind, re] of CODEX_CALLS) if (re.test(text)) return kind;
    for (const [kind, re] of SHELL) if (re.test(text)) return kind;
    return 'shell';
  }
  for (const [kind, names] of Object.entries(TOOLS)) if (names.includes(name)) return kind;
  return String(name).startsWith('mcp__') ? 'analyze' : 'shell';
}

// What a generation was for: the strongest thing it went on to do.
const RANK = ['develop', 'test', 'build', 'ci', 'git', 'delegate', 'analyze', 'plan', 'ask', 'wait', 'shell'];
const strongest = (kinds) => RANK.find((k) => kinds.includes(k)) || 'reply';

// ---- the phases of the work ------------------------------------------------

// A skill of this set that led a turn names that turn's phase. A skill that is
// not a phase of the work (a notification, a search of past sessions) names
// nothing.
export const PHASES = {
  'ask-shady2k': 'orient',
  brainstorming: 'explore',
  'to-research': 'explore',
  'model-domain': 'explore',
  'define-product': 'plan',
  'to-spec': 'plan',
  'to-stages': 'plan',
  'to-prototype': 'plan',
  'to-backlog': 'plan',
  'to-milestone': 'plan',
  'groom-backlog': 'plan',
  'take-task': 'build',
  'diagnose-bug': 'debug',
  'close-out': 'wrap',
  handoff: 'wrap',
  'report-to-shady2k': 'wrap',
  'setup-shady2k-skills': 'setup',
};
export const PHASE_NAMES = ['orient', 'explore', 'plan', 'build', 'debug', 'wrap', 'setup', 'unattributed'];
const phaseOf = (skill) => (skill ? PHASES[String(skill).split(':').pop()] : undefined);
const SKILL_READ = new RegExp(`(?:^|[/\\s"'])(${Object.keys(PHASES).join('|')})/SKILL\\.md`);

// A turn's phase comes from evidence in that turn and nowhere else: the owner
// speaking starts a turn with no phase. A skill of the set that leads it names
// it. Making or checking the product (writing, formatting, testing, building,
// committing, CI) is building, even inside a turn a talking skill leads, and
// the talking skill's name comes back for what that turn does next. Without a
// skill, only the making itself is building: what an agent read or said
// around it is unattributed, since nothing in the record says what for. Where
// the session runs does not say either.
const TALK = new Set(['orient', 'explore', 'plan', 'wrap']);
const MAKING = new Set(['develop', 'test', 'build', 'ci', 'git']);
function phaser() {
  let skill;
  return {
    owner() { skill = undefined; },
    skill(p) { if (p) skill = p; },
    of(kind) {
      if (skill && !TALK.has(skill)) return skill;
      if (MAKING.has(kind)) return 'build';
      return skill || 'unattributed';
    },
    get now() { return skill || 'unattributed'; },
  };
}

// ---- reading a session -----------------------------------------------------

function rows(path) {
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch { /* a half-written line is not a fact */ }
  }
  return out;
}

// The first lines only: enough to know where a session ran.
function head(path, bytes = 262144) {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    const out = [];
    for (const line of buf.subarray(0, n).toString('utf8').split('\n').slice(0, 60)) {
      try { out.push(JSON.parse(line)); } catch { /* cut or half-written */ }
    }
    return out;
  } finally { closeSync(fd); }
}

// The owner's own message. Anything else on the user's side is the harness
// speaking for him or for another agent, and costs him nothing.
const HARNESS_TEXT = /^\s*(<task-notification>|<local-command-|<bash-stdout>|<bash-stderr>|<command-stdout>|<system-reminder>|\[Request interrupted|This session is being continued|Caveat:)/;
function ownerSaid(d, text) {
  if (d.isSidechain) return false;
  if (d.origin) return d.origin.kind === 'human';
  if (d.isMeta) return false;
  return !!text && !HARNESS_TEXT.test(text);
}

const noTokens = () => ({ input: 0, output: 0, thinking: 0, cacheRead: 0 });

/**
 * A Claude Code transcript. Its turns carry their durations; its record of
 * cost ("cost-state") carries the model's and the tools' totals, what it cost
 * and the lines written. That record belongs to the harness's process, not to
 * one transcript: it is used only where it starts with this transcript and
 * nothing follows it, and its clock only where it agrees with the stamps.
 * A subagent keeps a transcript of its own and no cost record: its cost is in
 * the record of the session that started it.
 */
export function readClaude(path, sub = null) {
  const all = rows(path);
  const use = new Map();
  const msgKinds = new Map();
  const turns = [];
  const owner = [];
  const gens = [];
  const pairs = [];
  const hints = {};
  const tokens = noTokens();
  const seenUsage = new Set();
  const msgSkill = new Map();
  let cost = null;
  let costAt = -1;
  let lastActivity = -1;
  let cwd = null;
  let sessionId = null;
  let prev = NaN;

  all.forEach((d, i) => {
    if (d.type === 'cost-state') { cost = d; costAt = i; return; }
    if (d.type === 'worktree-state' && d.worktreeSession?.originalCwd) hints.origin ||= d.worktreeSession.originalCwd;
    if (d.type === 'pr-link' && d.prRepository) hints.repository ||= d.prRepository;
    cwd ||= d.cwd || null;
    sessionId ||= d.sessionId || null;
    const at = parseTime(d.timestamp);
    if (!Number.isFinite(at)) return;
    if (d.type === 'system' && d.subtype === 'turn_duration' && d.durationMs > 0) {
      turns.push({ start: at - d.durationMs, end: at });
      return;
    }
    if (d.type !== 'assistant' && d.type !== 'user') return;
    lastActivity = i;
    const content = d.message?.content;
    const parts = Array.isArray(content) ? content : [];
    if (d.type === 'assistant') {
      const calls = parts.filter((p) => p.type === 'tool_use');
      const mid = d.message?.id || `row${i}`;
      if (phaseOf(d.attributionSkill)) msgSkill.set(mid, phaseOf(d.attributionSkill));
      const kinds = msgKinds.get(mid) || [];
      kinds.push(...calls.map((c) => category(c.name, c.input)));
      msgKinds.set(mid, kinds);
      const u = d.message?.usage;
      if (u && !seenUsage.has(mid)) {
        seenUsage.add(mid);
        tokens.input += u.input_tokens || 0;
        tokens.output += u.output_tokens || 0;
        tokens.cacheRead += u.cache_read_input_tokens || 0;
      }
      const g = { start: prev, end: at, mid, phase: null, model: d.message?.model || null };
      gens.push(g);
      for (const c of calls) use.set(c.id, { at, name: c.name, input: c.input, gen: g });
      prev = at;
      return;
    }
    const results = parts.filter((p) => p.type === 'tool_result');
    if (results.length) {
      for (const r of results) {
        const u = use.get(r.tool_use_id);
        if (!u) continue;
        const kind = category(u.name, u.input);
        pairs.push({ start: u.at, end: at, kind, name: u.name, id: r.tool_use_id, gen: u.gen });
        use.delete(r.tool_use_id);
      }
      prev = at;
      return;
    }
    const text = typeof content === 'string' ? content : parts.filter((p) => p.type === 'text').map((p) => p.text).join('\n');
    if (ownerSaid(d, text)) { owner.push({ at }); gens.push({ owner: true, at }); }
    prev = at;
  });

  // A generation is named by what its message went on to do, and its phase
  // by the evidence of its turn up to that point.
  const replay = phaser();
  const ordered = [];
  for (const g of gens) {
    if (g.owner) { replay.owner(); continue; }
    replay.skill(msgSkill.get(g.mid));
    g.kind = strongest(msgKinds.get(g.mid) || []);
    g.phase = replay.of(g.kind);
    ordered.push(g);
  }
  for (const p of pairs) p.phase = p.gen.phase;

  const stamps = all.map((d) => parseTime(d.timestamp)).filter(Number.isFinite);
  if (!stamps.length) return null;
  const first = stamps.reduce((a, b) => Math.min(a, b));
  const last = stamps.reduce((a, b) => Math.max(a, b));
  const raw = {
    harness: 'claude-code', schema: 'claude', path, cwd, hints,
    id: sub ? sub.agentId : basename(path, '.jsonl'),
    parent: sub ? sessionId : null, parentTool: sub?.toolUseId || null,
    first, last, turns, owner, gens: ordered.filter((g) => Number.isFinite(g.start)), pairs,
    totals: null, costUSD: null, linesAdded: null, linesRemoved: null,
    costIn: sub ? 'parent' : 'unknown', tokens: sub ? null : (seenUsage.size ? tokens : null), tokensFrom: 'stamps',
    harnessClock: null,
  };
  if (!sub && cost) {
    const start = parseTime(cost.startTime);
    const startsHere = Number.isFinite(start) && Math.abs(start - first) <= 120e3;
    const final = costAt > lastActivity;
    if (startsHere && final) {
      raw.totals = { modelMs: cost.totalAPIDuration, toolMs: cost.totalToolDuration };
      raw.costUSD = typeof cost.totalCostUSD === 'number' ? cost.totalCostUSD : null;
      raw.linesAdded = typeof cost.totalLinesAdded === 'number' ? cost.totalLinesAdded : null;
      raw.linesRemoved = typeof cost.totalLinesRemoved === 'number' ? cost.totalLinesRemoved : null;
      raw.costIn = raw.costUSD === null ? 'unknown' : 'own';
      const mu = Object.values(cost.modelUsage || {});
      if (mu.length) {
        raw.tokens = mu.reduce((t, m) => ({
          input: t.input + (m.inputTokens || 0), output: t.output + (m.outputTokens || 0),
          thinking: t.thinking + (m.thinkingTokens || 0), cacheRead: t.cacheRead + (m.cacheReadInputTokens || 0),
        }), noTokens());
        raw.tokensFrom = 'harness';
      }
      // The record's clock runs until the record was written, which can be
      // long after the transcript's last line: it is kept only where it
      // agrees with the stamps, and the stamps are the clock either way.
      if (typeof cost.totalDuration === 'number') {
        const stampsSpan = last - start;
        raw.harnessClock = Math.abs(cost.totalDuration - stampsSpan) <= Math.max(60e3, stampsSpan * 0.02) ? 'agrees' : 'disagrees';
      }
    } else raw.costNote = startsHere ? 'the cost record was written before the session ended' : 'the cost record is another session\'s';
  }
  return raw;
}

// The injected context Codex puts on the user's side of a conversation.
const CODEX_INJECTED = /^\s*(# AGENTS\.md instructions|<environment_context>|<user_instructions>|<recommended_plugins>|<skill>|<turn_aborted>|<subagent_notification>|<user_shell_command>)/;

/**
 * A Codex rollout. Two shapes are read. The older one says the owner spoke
 * with an event (user_message) and the agent answered with another
 * (agent_message); the current one says the same with conversation items
 * (item_completed of a UserMessage, response_item messages with roles).
 * Both mark turns with task_started and task_complete. Codex keeps no cost and
 * no count of lines changed: those are unknown, not zero.
 */
export function readCodex(path) {
  const all = rows(path);
  const meta = all.find((d) => d.type === 'session_meta')?.payload || {};
  const source = meta.source;
  const spawned = source && typeof source === 'object' && source.subagent;
  const legacyOwner = all.some((d) => d.type === 'event_msg' && d.payload?.type === 'user_message');
  const itemOwner = all.some((d) => d.payload?.type === 'item_completed' && d.payload?.item?.type === 'UserMessage');
  const roleMessages = all.some((d) => d.type === 'response_item' && d.payload?.type === 'message');
  const schema = legacyOwner ? 'codex-events' : itemOwner ? 'codex-items' : roleMessages ? 'codex-messages' : 'codex-unknown';

  const use = new Map();
  const cells = new Map();
  const turns = [];
  const owner = [];
  const gens = [];
  const pairs = [];
  const phase = phaser();
  let tokens = null;
  let open = null;
  let prev = NaN;
  let lastAt = NaN;
  // The model of the turn, from its turn_context when the record holds one;
  // every turn resets it.
  let turnModel = null;
  const endTurn = (at) => { turnModel = null; if (open) { turns.push({ start: open.start, end: at }); open = null; } };

  for (const d of all) {
    const at = parseTime(d.timestamp);
    const p = d.payload || {};
    if (!Number.isFinite(at)) continue;
    if (d.type === 'turn_context' && typeof p.model === 'string') { turnModel = p.model; continue; }
    // A task is a turn: what an earlier one showed says nothing about it.
    if (p.type === 'task_started') { endTurn(lastAt); open = { start: at }; phase.owner(); gens.push({ owner: true, at }); prev = at; lastAt = at; continue; }
    if (p.type === 'task_complete' || p.type === 'turn_aborted') { endTurn(at); lastAt = at; continue; }
    if (p.type === 'token_count' && p.info?.total_token_usage) {
      const t = p.info.total_token_usage;
      tokens = { input: t.input_tokens || 0, output: t.output_tokens || 0, thinking: t.reasoning_output_tokens || 0, cacheRead: t.cached_input_tokens || 0 };
      continue;
    }
    let ownerHere = false;
    if (!spawned) {
      if (schema === 'codex-events') ownerHere = d.type === 'event_msg' && p.type === 'user_message';
      else if (schema === 'codex-items') ownerHere = p.type === 'item_completed' && p.item?.type === 'UserMessage';
      else if (d.type === 'response_item' && p.type === 'message' && p.role === 'user') {
        const text = (p.content || []).map((c) => c.text || '').join('');
        ownerHere = !!text && !CODEX_INJECTED.test(text);
      }
    }
    if (ownerHere) { owner.push({ at }); phase.owner(); gens.push({ owner: true, at }); prev = at; lastAt = at; continue; }
    if (d.type !== 'response_item' && !(d.type === 'event_msg' && p.type === 'agent_message')) continue;
    lastAt = at;
    if (p.type === 'custom_tool_call' || p.type === 'function_call') {
      const input = p.input ?? p.arguments ?? '';
      const text = typeof input === 'string' ? input : JSON.stringify(input);
      const m = SKILL_READ.exec(text);
      if (m) phase.skill(PHASES[m[1]]);
      // Waiting on a script cell that is still running is more of that
      // script, not a wait on another agent.
      const cell = p.name === 'wait' && /"cell_id"\s*:\s*"?(\d+)/.exec(text);
      const kind = cell ? cells.get(cell[1]) || 'shell' : category(p.name, text);
      const g = { start: prev, end: at, kind, phase: phase.of(kind), model: turnModel };
      gens.push(g);
      use.set(p.call_id, { at, name: p.name, kind, gen: g, escalated: /require_escalated/.test(text) });
      prev = at;
    } else if (p.type === 'custom_tool_call_output' || p.type === 'function_call_output') {
      const u = use.get(p.call_id);
      if (u) {
        const out = typeof p.output === 'string' ? p.output : JSON.stringify(p.output ?? '');
        const cell = /cell ID (\d+)/.exec(out);
        if (cell) cells.set(cell[1], u.kind);
        // A call reports how long it ran. Where it took longer than that to
        // come back, the rest was a wait: for the owner's approval when it
        // asked for one (held to the same line as any question), otherwise
        // on the harness.
        const ran = /Wall time:?\s*([\d.]+)\s*s/i.exec(out);
        const base = { name: u.name, id: p.call_id, gen: u.gen, phase: u.gen.phase };
        const cut = ran ? at - Number(ran[1]) * 1e3 : u.at;
        if (ran && cut > u.at + 1e3) {
          pairs.push({ ...base, start: u.at, end: cut, kind: u.escalated ? 'ask' : 'wait' });
          pairs.push({ ...base, start: cut, end: at, kind: u.kind });
        } else pairs.push({ ...base, start: u.at, end: at, kind: u.kind });
        use.delete(p.call_id);
      }
      prev = at;
    } else if (p.type === 'reasoning' || (p.type === 'message' && p.role === 'assistant') || p.type === 'agent_message') {
      gens.push(p.type === 'reasoning' ? { start: prev, end: at, kind: null, phase: null, model: turnModel } : { start: prev, end: at, kind: 'reply', phase: phase.now, model: turnModel });
      prev = at;
    }
  }
  endTurn(lastAt);

  // Reasoning is named by what it went on to do in its turn, like any
  // generation; reasoning that led to nothing is a reply.
  let next = { kind: 'reply', phase: phase.now };
  for (let i = gens.length - 1; i >= 0; i--) {
    const g = gens[i];
    if (g.owner) { next = { kind: 'reply', phase: 'unattributed' }; continue; }
    if (g.kind === null) { g.kind = next.kind; g.phase = next.phase; } else next = g;
  }

  const stamps = all.map((d) => parseTime(d.timestamp)).filter(Number.isFinite);
  if (!stamps.length) return null;
  const threadId = meta.id || basename(path, '.jsonl').replace(/^rollout-[\dT-]+-/, '');
  return {
    harness: 'codex', schema, path, cwd: meta.cwd || null, id: threadId,
    hints: { remote: meta.git?.repository_url || null },
    parent: spawned?.thread_spawn?.parent_thread_id || null, parentTool: null,
    first: stamps.reduce((a, b) => Math.min(a, b)), last: stamps.reduce((a, b) => Math.max(a, b)),
    turns, owner, gens: gens.filter((g) => !g.owner && Number.isFinite(g.start)), pairs,
    totals: null, costUSD: null, linesAdded: null, linesRemoved: null, costIn: 'unknown',
    tokens, tokensFrom: 'stamps', harnessClock: null,
  };
}

// pi and its descendants name their tools in lower case; read as the
// harnesses the tables know. prime-agent's one tool, a Python cell, is read
// by what the cell does.
const PI_TOOLS = { bash: 'Bash', read: 'Read', edit: 'Edit', write: 'Write', grep: 'Grep', glob: 'Glob', find: 'Glob', ls: 'Glob', task: 'Task', ask: 'AskUserQuestion', todo: 'TodoWrite', web_search: 'WebSearch', vibe_spawn: 'Agent', vibe_send: 'SendMessage', vibe_wait: 'wait', vibe_list: 'ListAgents',
  ask_user_question: 'AskUserQuestion', get_subagent_result: 'wait', fetch_content: 'WebFetch' };

/**
 * A session in pi's shape: pi's own, omp's or prime-agent's. Every model call
 * carries when it started, its tokens and its cost, and the record of it when
 * it ended (omp also writes its end into the call); every tool call its result,
 * and in omp its start. A turn runs from a message on the user's side to the
 * model's last answer in it. Who is on the user's side is whoever drives the
 * pane, the owner or a coordinator; a subagent's messages are its parent's,
 * and never the owner's. An omp subagent keeps its transcript in its parent's
 * folder; a prime-agent subagent keeps its own among its parent's artifacts,
 * names its parent's, and its parent records what it cost.
 */
export function readPi(path, { harness = 'pi', parent: given = null } = {}) {
  const all = rows(path);
  const meta = all.find((d) => d.type === 'session') || {};
  const parent = given || (harness === 'prime-agent' && meta.parentSession ? basename(meta.parentSession, '.jsonl') : null);
  // Its parent's record holds a prime-agent subagent's cost, already counted.
  const costInParent = harness === 'prime-agent' && !!parent;
  const use = new Map();
  const turns = [];
  const owner = [];
  const gens = [];
  const pairs = [];
  const phase = phaser();
  const tokens = noTokens();
  let usage = false;
  let costUSD = 0;
  let priced = false;
  let open = null;
  let lastAt = NaN;
  const endTurn = (at) => { if (open && at > open.start) turns.push({ start: open.start, end: at }); open = null; };

  for (const d of all) {
    const at = parseTime(d.timestamp);
    if (!Number.isFinite(at)) continue;
    if (d.type === 'child_usage_attributed' && d.childUsage) {
      const u = d.childUsage;
      usage = true;
      tokens.input += u.input || 0;
      tokens.output += u.output || 0;
      tokens.cacheRead += u.cacheRead || 0;
      if (typeof u.cost?.total === 'number') { costUSD += u.cost.total; priced = true; }
      continue;
    }
    if (d.type === 'custom' && d.customType === 'tool_execution_start') {
      const u = use.get(d.data?.toolCallId);
      const started = parseTime(d.data?.startedAt);
      if (u && Number.isFinite(started)) u.start = started;
      continue;
    }
    if (d.type !== 'message') continue;
    const m = d.message || {};
    const parts = Array.isArray(m.content) ? m.content : [];
    if (m.role === 'user') {
      endTurn(lastAt);
      open = { start: at };
      phase.owner();
      if (!parent) { owner.push({ at }); gens.push({ owner: true, at }); }
      lastAt = at;
      continue;
    }
    if (m.role === 'assistant') {
      const start = parseTime(m.timestamp);
      const end = Math.max(at, parseTime(m.completedAt) || at);
      const from = Number.isFinite(start) && start <= end ? start : end;
      open ||= { start: from };
      if (m.usage) {
        usage = true;
        tokens.input += m.usage.input || 0;
        tokens.output += m.usage.output || 0;
        tokens.thinking += m.usage.reasoningTokens || m.usage.reasoning || 0;
        tokens.cacheRead += m.usage.cacheRead || 0;
        if (typeof m.usage.cost?.total === 'number') { costUSD += m.usage.cost.total; priced = true; }
      }
      const calls = parts.filter((c) => c.type === 'toolCall');
      for (const c of calls) {
        const hit = SKILL_READ.exec(JSON.stringify(c.arguments ?? ''));
        if (hit) phase.skill(PHASES[hit[1]]);
      }
      const kinds = calls.map((c) => category(PI_TOOLS[c.name] || c.name, c.arguments));
      const kind = strongest(kinds);
      const g = { start: from, end, kind, phase: phase.of(kind), model: m.model || null };
      gens.push(g);
      calls.forEach((c, k) => use.set(c.id, { start: end, name: c.name, kind: kinds[k], gen: g }));
      if (m.stopReason !== 'toolUse') endTurn(end);
      lastAt = end;
      continue;
    }
    if (m.role === 'toolResult') {
      const u = use.get(m.toolCallId);
      if (u) {
        pairs.push({ start: Math.min(u.start, at), end: at, kind: u.kind, name: u.name, id: m.toolCallId, gen: u.gen, phase: u.gen.phase });
        use.delete(m.toolCallId);
      }
      lastAt = at;
    }
  }
  endTurn(lastAt);

  const stamps = all.map((d) => parseTime(d.timestamp)).filter(Number.isFinite);
  if (!stamps.length) return null;
  return {
    harness, schema: harness, path, cwd: meta.cwd || null, hints: { remote: meta.git?.repoUrl || null },
    id: meta.id || basename(path, '.jsonl').replace(/^.*_/, ''),
    parent, parentTool: null,
    first: stamps.reduce((a, b) => Math.min(a, b)), last: stamps.reduce((a, b) => Math.max(a, b)),
    turns, owner, gens: gens.filter((g) => !g.owner && Number.isFinite(g.start)), pairs,
    totals: null, costUSD: priced && !costInParent ? costUSD : null, linesAdded: null, linesRemoved: null,
    costIn: costInParent ? 'parent' : priced ? 'own' : 'unknown',
    tokens: usage && !costInParent ? tokens : null, tokensFrom: 'harness', harnessClock: null,
  };
}
export const readOmp = (path, parent = null) => readPi(path, { harness: 'omp', parent });

// ---- the buckets -----------------------------------------------------------

// Where records of different things overlap, the more specific wins: a
// question waiting on the owner over the tool that asked it, a tool over the
// generation around it, a generation over the rest of its turn. What is left
// of a turn is coordination: hooks, permission prompts, waiting on a
// subagent or a worker this session started, whose own minutes are counted
// in its own session and not again here.
const PRIORITY = { ask: 1, tool: 2, wait: 3, model: 4, turn: 5 };

/**
 * One session's minutes inside the given windows (the whole session when none
 * are given): the model, tools, coordination, the owner answering, the owner
 * away, and nobody. They add up to the session's clock inside the windows,
 * exactly, because every instant is counted once.
 */
// A session's model minutes, when its record names a model for the model
// generating; what no record names is kept under "(not recorded)". The
// minutes already carry whatever the harness's own totals took out.
const MODELS_UNNAMED = '(not recorded)';
const modelsOf = (laid) => {
  const models = {};
  for (const g of laid) {
    if (g.bucket !== 'model' || !(g.ms > 0)) continue;
    const name = g.model || MODELS_UNNAMED;
    models[name] = (models[name] || 0) + g.ms;
    }
  const minutes = (ms) => ms / 60e3;
  return Object.fromEntries(Object.entries(models).sort((a, b) => b[1] - a[1]).map(([k, ms]) => [k, minutes(ms)]));
};
export function measure(raw, { answerMinutes = ANSWER_MINUTES, windows = null, now = Date.now() } = {}) {
  const lo = raw.first;
  const hi = raw.last;
  const wins = union((windows || [{ start: -Infinity, end: Infinity }])
    .map((w) => ({ start: Math.max(lo, w.start), end: Math.min(hi, w.end) })));
  const whole = (wins.length === 1 && wins[0].start === lo && wins[0].end === hi) || (lo === hi && !windows);
  const cap = answerMinutes * 60e3;
  const within = (at) => wins.some((w) => at >= w.start && at <= w.end);
  const inWin = raw.owner.filter((m) => within(m.at));
  if (!wins.length && !(lo === hi && (!windows || windows.some((w) => lo >= w.start && lo <= w.end)))) return null;

  const ivs = [];
  for (const p of raw.pairs) {
    if (p.kind === 'ask') ivs.push({ ...p, label: 'ask', owner: p.end - p.start <= cap ? 'answer' : 'away' });
    else if (p.kind === 'delegate' || p.kind === 'wait') ivs.push({ ...p, label: 'wait' });
    else ivs.push({ ...p, label: 'tool' });
  }
  for (const g of raw.gens) ivs.push({ start: g.start, end: g.end, label: 'model', kind: g.kind, phase: g.phase, model: g.model || null });
  for (const t of raw.turns) ivs.push({ start: t.start, end: t.end, label: 'turn', kind: 'coordination', phase: null });

  // Lay every interval on the clock and let the most specific one covering
  // each stretch have it.
  const edges = [];
  ivs.forEach((v, i) => {
    const s = Math.max(v.start, lo);
    const e = Math.min(v.end, hi);
    if (e > s) { edges.push([s, 1, i]); edges.push([e, -1, i]); }
  });
  for (const w of wins) { edges.push([w.start, 0, -1]); edges.push([w.end, 0, -1]); }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const active = new Set();
  const segs = [];
  let last = null;
  for (const [at, delta, i] of edges) {
    if (last !== null && at > last) {
      let best = null;
      for (const j of active) {
        const v = ivs[j];
        if (!best || PRIORITY[v.label] < PRIORITY[best.label] || (PRIORITY[v.label] === PRIORITY[best.label] && v.start > best.start)) best = v;
      }
      segs.push({ start: last, end: at, v: best });
    }
    if (delta === 1) active.add(i);
    else if (delta === -1) active.delete(i);
    last = at;
  }
  // A stretch no record of its own covers takes the phase of the work before
  // it: the rest of a turn, and a gap after it.
  const buckets = { model: 0, tool: 0, coordination: 0, answer: 0, away: 0, idle: 0 };
  const phases = {};
  const occupied = [];
  const activeIvs = [];
  const laid = []; // what filled the clock, piece by piece: the statistics
  // views read this, as the day by the hour and the heat of the days.
  const put = (phase, bucket, kind, ivs, model = null) => {
    for (const { start, end } of ivs) {
      const ms = end - start;
      if (!(ms > 0)) continue;
      buckets[bucket] += ms;
      const p = (phases[phase] ||= { model: 0, tool: 0, coordination: 0, answer: 0, away: 0, idle: 0, model_kinds: {}, tool_kinds: {} });
      p[bucket] += ms;
      if (bucket === 'model' || bucket === 'tool') p[`${bucket}_kinds`][kind] = (p[`${bucket}_kinds`][kind] || 0) + ms;
      laid.push({ start, end, ms, phase, bucket, kind, model });
    }
  };
  const merged = [];
  for (const s of segs) {
    const before = merged.at(-1);
    if (before && before.v === s.v && before.end === s.start) before.end = s.end;
    else merged.push({ ...s });
  }
  let phaseSoFar = 'unattributed';
  for (const s of merged) {
    const inside = clipTo([s], wins);
    const ms = span(inside);
    const v = s.v;
    if (v?.phase) phaseSoFar = v.phase;
    const phase = v?.phase || phaseSoFar;
    if (!v) {
      // Between turns. A gap that ends where the owner spoke is his; a gap
      // no message of his ends is nobody's. A harness may open the turn a few
      // seconds before it writes down the message that opened it.
      const spoke = raw.owner.some((m) => m.at > s.start && m.at <= s.end + 30e3);
      if (spoke) {
        const bucket = s.end - s.start <= cap ? 'answer' : 'away';
        put(phase, bucket, bucket, inside);
        if (bucket === 'answer') occupied.push(...inside);
      } else put(phase, 'idle', 'idle', inside);
      continue;
    }
    if (v.label === 'ask') {
      put(phase, v.owner, v.owner, inside);
      if (v.owner === 'answer') occupied.push(...inside);
      continue;
    }
    occupied.push(...inside);
    if (v.label !== 'wait') activeIvs.push(...inside);
    if (v.label === 'tool' || v.label === 'model') put(phase, v.label, v.kind, inside, v.model || null);
    else put(phase, 'coordination', v.kind || 'coordination', inside);
  }

  // The harness's own totals, where it kept them for exactly this session,
  // narrow what the stamps say: the time between two records is not all API
  // time or all tool time (a permission prompt sits inside a tool call), and
  // what is taken out stays in the turn as coordination. They never widen
  // it, since a total larger than the stretches it could have happened in is
  // a total of something else; and a window cannot cut them, so a session
  // the windows cut keeps what its stamps say.
  const exact = { wall: 'stamps', model: 'stamps', tool: 'stamps', owner: 'estimate' };
  const measuredModel = buckets.model;
  const measuredTool = buckets.tool;
  if (whole && raw.totals) {
    const askMs = raw.pairs.filter((p) => p.kind === 'ask').reduce((n, p) => n + (p.end - p.start), 0);
    const nonAsk = raw.pairs.filter((p) => p.kind !== 'ask').reduce((n, p) => n + (p.end - p.start), 0);
    let th = raw.totals.toolMs;
    // A question is in the harness's tool total only if that total is larger
    // than every other call put together: then the excess can be nothing else.
    if (typeof th === 'number' && th > nonAsk) th -= Math.min(askMs, th - nonAsk);
    const narrow = (bucket, to) => {
      const from = buckets[bucket];
      if (typeof to !== 'number' || !(from > 0) || to > from) return false;
      const f = to / from;
      for (const p of Object.values(phases)) {
        p.coordination += p[bucket] * (1 - f);
        p[bucket] *= f;
        for (const k of Object.keys(p[`${bucket}_kinds`])) p[`${bucket}_kinds`][k] *= f;
      }
      // What a piece of the clock gave to the narrowed bucket, it now shares
      // with coordination, in the same proportion.
      for (let i = laid.length - 1; i >= 0; i--) {
        const g = laid[i];
        if (g.bucket !== bucket) continue;
        if (g.ms * (1 - f) > 1e-9) laid.splice(i + 1, 0, { ...g, bucket: 'coordination', kind: 'coordination', ms: g.ms * (1 - f), model: null });
        g.ms *= f;
      }
      buckets.coordination += from - to;
      buckets[bucket] = to;
      return true;
    };
    if (narrow('model', raw.totals.modelMs)) exact.model = 'harness';
    if (narrow('tool', th)) exact.tool = 'harness';
  }
  const kinds = {};
  for (const p of Object.values(phases)) {
    p.kinds = {};
    for (const [k, ms] of [...Object.entries(p.model_kinds), ...Object.entries(p.tool_kinds)]) {
      p.kinds[k] = (p.kinds[k] || 0) + ms;
      kinds[k] = (kinds[k] || 0) + ms;
    }
  }
  const wallMs = span(wins) || 0;
  const sum = Object.values(buckets).reduce((a, b) => a + b, 0);

  return {
    id: raw.id, harness: raw.harness, schema: raw.schema, path: raw.path, cwd: raw.cwd, role: raw.role,
    parent: raw.parent, by: raw.by,
    startMs: wins.length ? wins[0].start : lo, endMs: wins.length ? wins.at(-1).end : hi,
    startedAt: localStamp(wins.length ? wins[0].start : lo), endedAt: localStamp(wins.length ? wins.at(-1).end : hi),
    whole, open: now - raw.last < OPEN_MINUTES * 60e3,
    exact, harnessClock: raw.harnessClock,
    conserves: Math.abs(sum - wallMs) < 1,
    ownerMessages: inWin.length,
    turns: raw.turns.length,
    wallMinutes: minutes(wallMs),
    modelMinutes: minutes(buckets.model),
    toolMinutes: minutes(buckets.tool),
    coordinationMinutes: minutes(buckets.coordination),
    answerMinutes: minutes(buckets.answer),
    awayMinutes: minutes(buckets.away),
    idleMinutes: minutes(buckets.idle),
    measuredModelMinutes: minutes(measuredModel),
    measuredToolMinutes: minutes(measuredTool),
    kinds: Object.fromEntries(Object.entries(kinds).map(([k, ms]) => [k, minutes(ms)])),
    phases: Object.fromEntries(Object.entries(phases).map(([p, v]) => [p, {
      model: minutes(v.model), tool: minutes(v.tool), coordination: minutes(v.coordination),
      answer: minutes(v.answer), away: minutes(v.away), idle: minutes(v.idle),
      kinds: Object.fromEntries(Object.entries(v.kinds).map(([k, ms]) => [k, minutes(ms)])),
    }])),
    // What the model generating was named, where the record names it, in
    // minutes already narrowed with the bucket; a generation the record
    // names no model for is (not recorded), not lost.
    segments: laid,
    models: modelsOf(laid),
    // Stretches of the clock: the agent working, for how many ran at once;
    // and anything a forecast covers (working, waiting inside a turn, the
    // owner answering), for how long a run occupied.
    active: union(activeIvs),
    occupied: union(occupied),
    // What the harness counted can only be had whole; a session the windows
    // cut has none of it here.
    costUSD: whole ? raw.costUSD : null,
    linesAdded: whole ? raw.linesAdded : null,
    linesRemoved: whole ? raw.linesRemoved : null,
    tokens: whole ? raw.tokens : null,
    costIn: whole ? raw.costIn : 'cut',
    costNote: raw.costNote || null,
  };
}

// ---- finding the sessions --------------------------------------------------

function* files(root, depth) {
  if (!existsSync(root) || depth < 0) return;
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    let st;
    try { st = statSync(path); } catch { continue; }
    if (st.isDirectory()) yield* files(path, depth - 1);
    else if (entry.endsWith('.jsonl')) yield { path, mtimeMs: st.mtimeMs, name: entry };
  }
}

// A prime-agent subagent keeps its transcript among its parent's artifacts,
// <home>/session-artifacts/<parent>/sub-<handle>/<id>.jsonl, and a subagent's
// own subagents one sub- folder deeper. The other JSON lines kept there name
// no session, so they place nowhere.
const primeArtifacts = () => join(dirname(primeSessions()), 'session-artifacts');
function* primeSubagents() {
  const root = primeArtifacts();
  for (const f of files(root, 8)) {
    const parts = f.path.slice(root.length + 1).split(sep);
    if (parts.length >= 3 && parts.slice(1, -1).every((p) => p.startsWith('sub-'))) yield f;
  }
}

// Where a session in pi's shape ran, and what repository it recorded.
// A session file's first line, read without the rest of it: the id a session
// in pi's shape holds is there, and a lookup must not read a whole transcript
// to learn which session it is.
const firstRow = (path) => {
  let fd;
  try {
    fd = openSync(path, 'r');
    const buf = Buffer.alloc(8192);
    const n = readSync(fd, buf, 0, 8192, 0);
    return JSON.parse(String(buf.slice(0, n)).split('\n')[0] || '{}');
  } catch { return {}; } finally { if (fd !== undefined) try { closeSync(fd); } catch { /* gone */ } }
};

const piShapeLocation = (path) => {
  const meta = head(path).find((d) => d.type === 'session') || {};
  return { cwd: meta.cwd || null, hints: { remote: meta.git?.repoUrl || null } };
};

// A gone working copy may have said more later in its transcript: which
// checkout it was made from, which repository its pull request went to.
function laterHints(path) {
  const hints = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.includes('"worktree-state"') && !line.includes('"pr-link"')) continue;
    try {
      const d = JSON.parse(line);
      if (d.worktreeSession?.originalCwd) hints.origin ||= d.worktreeSession.originalCwd;
      if (d.prRepository) hints.repository ||= d.prRepository;
    } catch { /* keep looking */ }
  }
  return hints;
}

// ---- what each harness leaves on this machine --------------------------------
// One set of readers per harness, called only through the adapters above: where
// a session's transcript is, which files a session id names, and which sessions
// it started.

// Claude Code: <home>/projects/<working copy>/<session>.jsonl, and a subagent of
// a session in <session>/subagents/<agent>.jsonl, with a sidecar beside it that
// says which tool call started it.
const claudeSub = (path) => {
  const sub = { agentId: basename(path, '.jsonl') };
  try { Object.assign(sub, JSON.parse(readFileSync(path.replace(/\.jsonl$/, '.meta.json'), 'utf8'))); } catch { /* no meta */ }
  return sub;
};

function claudeSessions() {
  const out = [];
  const root = join(claudeHome(), 'projects');
  if (!existsSync(root)) return out;
  for (const dir of readdirSync(root))
    for (const f of files(join(root, dir), 2)) {
      const parts = f.path.slice(join(root, dir).length + 1).split(sep);
      if (parts.length === 1) out.push(f);
      else if (parts.length === 3 && parts[1] === 'subagents') out.push({ ...f, sub: claudeSub(f.path) });
    }
  return out;
}

function claudeTranscripts(sid) {
  const out = [];
  const root = join(claudeHome(), 'projects');
  if (existsSync(root)) for (const dir of readdirSync(root)) if (existsSync(join(root, dir, `${sid}.jsonl`))) out.push({ path: join(root, dir, `${sid}.jsonl`) });
  return out;
}

function claudeSubagents(sid) {
  const out = [];
  for (const ref of claudeTranscripts(sid)) {
    const dir = join(dirname(ref.path), sid, 'subagents');
    if (!existsSync(dir)) continue;
    for (const f of files(dir, 1)) out.push({ ...f, id: basename(f.path, '.jsonl'), parent: sid, sub: claudeSub(f.path) });
  }
  return out;
}

// Codex: <home>/sessions/<year>/<month>/<day>/rollout-*.jsonl. A subagent is a
// rollout of its own that names, in its first line, the thread that started it.
function codexSessions() {
  return [...files(join(codexHome(), 'sessions'), 4)];
}

function codexTranscripts(sid) {
  const out = [];
  for (const f of files(join(codexHome(), 'sessions'), 4)) {
    if (!f.name.includes(sid)) continue;
    // A rollout's name carries its id, but a name that merely contains it is
    // another session's: the id the file really holds decides.
    const meta = head(f.path).find((d) => d.type === 'session_meta')?.payload || {};
    const id = meta.id || basename(f.path, '.jsonl').replace(/^rollout-[\dT-]+-/, '');
    if (id === sid) out.push({ path: f.path });
  }
  return out;
}

function codexSubagents(sid) {
  const out = [];
  for (const f of codexSessions()) {
    const meta = head(f.path).find((d) => d.type === 'session_meta')?.payload || {};
    if ((meta.source?.subagent?.thread_spawn?.parent_thread_id || null) !== sid) continue;
    out.push({ ...f, id: meta.id || basename(f.path, '.jsonl').replace(/^rollout-[\dT-]+-/, ''), parent: sid });
  }
  return out;
}

// pi, omp and Prime Agent: <home>/<folder>/<stamp>_<id>.jsonl, omp's subagents in
// <folder>/<stamp>_<id>/, and Prime's among the artifacts of the session that
// started them, one sub- folder deeper for each of theirs.
function piShapeSessions(harness, home) {
  const out = [];
  const root = home();
  for (const f of files(root, 2)) {
    const parts = f.path.slice(root.length + 1).split(sep);
    if (harness === 'prime-agent' ? parts.length === 1 : parts.length === 2) out.push(f);
    else if (harness === 'omp' && parts.length === 3) out.push({ ...f, parent: parts[1].replace(/^.*_/, '') });
  }
  if (harness === 'prime-agent') for (const f of primeSubagents()) out.push(f);
  return out;
}

// The id a session in pi's shape really holds: its own first line, or what its
// name says where the first line does not name it.
const piShapeId = (path) => {
  const row = firstRow(path);
  return (row.type === 'session' && row.id) || basename(path, '.jsonl').replace(/^.*_/, '');
};

function piShapeTranscripts(harness, home, sid) {
  const out = [];
  const root = home();
  for (const f of files(root, harness === 'omp' ? 2 : 1)) {
    const parts = f.path.slice(root.length + 1).split(sep);
    if (parts.length === 3 && harness !== 'omp') continue;
    // The id the file really holds decides, wherever the file sits: a name that
    // merely looks like the session's is another session's, and omp keeps a
    // subagent's transcript in the folder of the session that started it, with
    // its own id in its first line and nothing of it in its name.
    if (piShapeId(f.path) !== sid) continue;
    // The folder says which session started it, and a child read without that
    // is read as a session of its own, with its parent's messages as the
    // owner's: the reference carries it.
    out.push(parts.length === 3 ? { path: f.path, parent: parts[1].replace(/^.*_/, '') } : { path: f.path });
  }
  if (harness === 'prime-agent') for (const f of primeSubagents()) if (piShapeId(f.path) === sid) out.push({ path: f.path });
  return out;
}

function piShapeSubagents(harness, home, sid) {
  if (harness !== 'omp') return [];
  const out = [];
  const root = home();
  for (const f of files(root, 2)) {
    const parts = f.path.slice(root.length + 1).split(sep);
    if (parts.length !== 3 || parts[1].replace(/^.*_/, '') !== sid) continue;
    // The child's own id is in its first line, not in the file's name.
    const meta = head(f.path).find((d) => d.type === 'session') || {};
    out.push({ ...f, id: meta.id || basename(f.path, '.jsonl').replace(/^.*_/, ''), parent: sid });
  }
  return out;
}

// A Prime Agent subagent names the session that started it in its own first
// line; the folder above it says which session's artifacts it was kept among,
// which is not the same thing for one started by a subagent in turn.
function primeSubagentsOf(sid) {
  const out = [];
  for (const f of primeSubagents()) {
    const meta = head(f.path).find((d) => d.type === 'session') || {};
    if (!meta.parentSession || basename(meta.parentSession, '.jsonl') !== sid) continue;
    out.push({ ...f, id: basename(f.path, '.jsonl'), parent: sid });
  }
  return out;
}

const splitKey = (key) => {
  const at = String(key).indexOf(':');
  return { harness: String(key).slice(0, at), sid: String(key).slice(at + 1) };
};

const namesItem = (item) => new RegExp(`(?<![\\w.-])${item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-]|\\.\\w)`);

/**
 * A session's transcript found by its id alone, for a record on an item that
 * already names the session. Its working copy is gone and sat where nothing
 * places it, so the folder cannot say whose it is; the transcript naming the
 * item is the evidence instead, or, where the project agreed to Jev and it
 * was sure, Jev's judgement that the session worked on the item (`judged`
 * holds those, as "key TAB item"). One whose working copy is still on disk is
 * placed by git and never by this.
 */
export function transcriptOf(key, item, { judged = null } = {}) {
  const { harness, sid } = splitKey(key);
  if (!sid || !item || !hasAdapter(harness)) return null;
  const a = ADAPTERS[harness];
  const named = namesItem(item);
  const byJev = judged?.has(`${key}\t${item}`);
  for (const ref of a.transcripts(sid)) {
    try {
      const { cwd } = a.location(ref.path);
      if (cwd && existsSync(resolve(cwd))) continue;
      const by = named.test(readFileSync(ref.path, 'utf8')) ? 'names the item' : byJev ? 'Jev judged it the item\'s' : null;
      if (!by) continue;
      const raw = a.read(ref);
      if (raw && raw.id === sid && (by === 'names the item' || !raw.parent)) return Object.assign(raw, { by, role: 'side copy' });
    } catch { /* unreadable */ }
  }
  return null;
}

/**
 * The transcripts `transcriptOf` would take but for the item not being named in
 * them: a gone working copy's, of this session. These are the ones worth
 * asking Jev about; everything else is already settled by git or by the text.
 */
export function unnamedTranscripts(key, item) {
  const { harness, sid } = splitKey(key);
  if (!sid || !item || !hasAdapter(harness)) return [];
  const a = ADAPTERS[harness];
  const named = namesItem(item);
  const out = [];
  for (const ref of a.transcripts(sid)) {
    try {
      const { cwd } = a.location(ref.path);
      if (cwd && existsSync(resolve(cwd))) continue;
      if (named.test(readFileSync(ref.path, 'utf8'))) continue;
      // Only the session itself: a file that merely has its id in its name,
      // or a subagent of it, is another transcript.
      const raw = a.read(ref);
      if (raw && raw.id === sid && !raw.parent) out.push({ harness, path: ref.path });
    } catch { /* unreadable */ }
  }
  return out;
}

/**
 * What the owner and the agent said to each other in a transcript, without
 * the tools' input and output or what the harness put on the owner's side:
 * the part a reader, or Jev, judges the work by. A very long one keeps its
 * beginning and its end, where the work is taken and handed in.
 */
export const CONVERSATION_CHARS = 240000;
export function conversationOf(path, max = CONVERSATION_CHARS) {
  const said = [];
  const blocks = (content) => (typeof content === 'string' ? [content]
    : Array.isArray(content) ? content.filter((b) => ['text', 'input_text', 'output_text'].includes(b?.type) && typeof b.text === 'string').map((b) => b.text) : []);
  const all = rows(path);
  // A Codex rollout says each message twice, as an event and as an item; the events are read where they exist.
  const events = all.some((d) => d.type === 'event_msg' && (d.payload?.type === 'user_message' || d.payload?.type === 'agent_message'));
  for (const d of all) {
    if (d.isSidechain || d.isMeta) continue;
    const p = d.payload || {};
    let who = null;
    let texts = [];
    if (d.type === 'user' || d.type === 'assistant') { who = d.type; texts = blocks(d.message?.content); }
    else if (d.type === 'message' && ['user', 'assistant'].includes(d.message?.role)) { who = d.message.role; texts = blocks(d.message.content); }
    else if (events && d.type === 'event_msg' && (p.type === 'user_message' || p.type === 'agent_message')) { who = p.type === 'user_message' ? 'user' : 'assistant'; texts = [String(p.message ?? '')]; }
    else if (!events && d.type === 'response_item' && p.type === 'message' && ['user', 'assistant'].includes(p.role)) { who = p.role; texts = blocks(p.content); }
    for (const x of texts) {
      if (!x.trim()) continue;
      if (who === 'user' && (HARNESS_TEXT.test(x) || CODEX_INJECTED.test(x) || /^\s*<command-/.test(x))) continue;
      said.push(`${who === 'user' ? 'OWNER' : 'AGENT'}: ${x}`);
    }
  }
  const text = said.join('\n\n');
  return text.length <= max ? text : `${text.slice(0, max / 2)}\n\n[... the middle of the session is left out ...]\n\n${text.slice(-max / 2)}`;
}

/**
 * Every session of this project that any harness left on this machine, read
 * but not yet measured. Claude's and omp's subagents are read from the folder
 * of the session that started them; Codex's are sessions of their own that
 * name their parent.
 */
export function collect(project, { since, until, repo } = {}) {
  const candidates = [];
  for (const [harness, a] of Object.entries(ADAPTERS))
    for (const c of a.sessions()) candidates.push({ ...c, harness });

  const seen = [];
  for (const c of candidates) {
    if (since && c.mtimeMs < since) continue;
    try { seen.push({ ...c, ...ADAPTERS[c.harness].location(c.path) }); } catch { /* unreadable */ }
  }
  const id = identify(project, { repo, cwds: [...new Set(seen.map((c) => c.cwd).filter(Boolean))] });
  if (!id.commons.size) throw new Usage(`no repository of ${project} found: run from its checkout or pass --repo <path>`);

  // Two passes: what the evidence settles first, then the gone copies that
  // sat in a folder the first pass showed is kept for this project's copies.
  const judged = seen.map((c) => {
    let v = belongsTo(id, c.cwd, c.hints, { roots: false });
    if (!v.yes && v.unknown && ADAPTERS[c.harness].lateHints) {
      c.hints = { ...c.hints, ...ADAPTERS[c.harness].lateHints(c.path) };
      v = belongsTo(id, c.cwd, c.hints, { roots: false });
    }
    if (v.yes && c.cwd) learnRoot(id, resolve(c.cwd));
    return { c, v };
  });
  const out = [];
  let unresolved = 0;
  const unresolvedCwds = new Set();
  for (const { c, v: first } of judged) {
    const v = first.yes ? first : belongsTo(id, c.cwd, c.hints);
    if (!v.yes) {
      if (v.unknown && c.cwd && c.cwd.split(sep).some((p) => p === project || p.startsWith(project))) { unresolved++; unresolvedCwds.add(c.cwd); }
      continue;
    }
    let raw;
    try { raw = ADAPTERS[c.harness].read(c); } catch { continue; }
    if (!raw) continue;
    if (since && raw.last < since) continue;
    if (until && raw.first > until) continue;
    raw.by = v.by;
    const cwd = c.cwd ? resolve(c.cwd) : null;
    raw.role = raw.parent ? 'subagent' : id.checkouts.includes(cwd) ? 'checkout' : 'side copy';
    out.push(raw);
  }
  // A subagent's cost is in its parent's record, when that record is known.
  const byId = new Map(out.map((r) => [r.id, r]));
  for (const r of out) if (r.costIn === 'parent' && byId.get(r.parent)?.costIn !== 'own') r.costIn = 'unknown';
  out.unresolved = unresolved;
  out.unresolvedCwds = [...unresolvedCwds];
  out.identity = id;
  return out;
}

export function findSessions(project, { since, until, answerMinutes, repo, raws } = {}) {
  const all = raws || collect(project, { since, until, repo });
  const windows = since || until ? [{ start: since ?? -Infinity, end: until ?? Infinity }] : null;
  const out = all.map((r) => measure(r, { answerMinutes: answerMinutes ?? ANSWER_MINUTES, windows }))
    .filter(Boolean).sort((a, b) => a.startMs - b.startMs);
  out.unresolved = all.unresolved || 0;
  return out;
}

// ---- adding them up --------------------------------------------------------

const round = (n) => Math.round(n * 10) / 10;
const hours = (m) => round(m / 60);

// How many sessions were working at once: each session's working stretches,
// already one union per session so that its nested turns count once, laid
// over each other. A session waiting on its owner or on a subagent it
// started is not working; the subagent is.
export function threads(sessions) {
  const edges = [];
  for (const s of sessions) for (const b of s.active) { edges.push([b.start, 1]); edges.push([b.end, -1]); }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let open = 0;
  let peak = 0;
  let weighted = 0;
  let spanMs = 0;
  let last = null;
  for (const [at, delta] of edges) {
    if (open > 0 && last !== null) { weighted += open * (at - last); spanMs += at - last; }
    open += delta;
    peak = Math.max(peak, open);
    last = at;
  }
  return { peak, average: spanMs ? round(weighted / spanMs) : 0, busyHours: hours(minutes(spanMs)) };
}

// A figure some sessions do not carry: the sum over those that do, and how
// many do not.
function known(sessions, f, { parentCounts = false } = {}) {
  let total = 0;
  let missing = 0;
  for (const s of sessions) {
    const v = f(s);
    if (v === null || v === undefined) { if (!(parentCounts && s.costIn === 'parent')) missing++; } else total += v;
  }
  return { total, missing };
}

export function ledger(project, opts = {}) {
  const since = opts.since ? parseWhen(opts.since) : undefined;
  const until = opts.until ? parseWhen(opts.until, { end: true }) : undefined;
  const sessions = opts.sessions || findSessions(project, { since, until, answerMinutes: opts['answer-minutes'], repo: opts.repo });
  const sum = (f) => sessions.reduce((n, s) => n + f(s), 0);
  const kinds = {};
  const phases = {};
  for (const s of sessions) {
    for (const [k, m] of Object.entries(s.kinds)) kinds[k] = (kinds[k] || 0) + m;
    for (const [p, v] of Object.entries(s.phases)) {
      const t = (phases[p] ||= { model: 0, tool: 0, coordination: 0, answer: 0, away: 0, idle: 0, kinds: {} });
      for (const b of ['model', 'tool', 'coordination', 'answer', 'away', 'idle']) t[b] += v[b];
      for (const [k, m] of Object.entries(v.kinds)) t.kinds[k] = (t.kinds[k] || 0) + m;
    }
  }
  const cost = known(sessions, (s) => s.costUSD, { parentCounts: true });
  const added = known(sessions, (s) => s.linesAdded, { parentCounts: true });
  const removed = known(sessions, (s) => s.linesRemoved, { parentCounts: true });
  const tok = known(sessions, (s) => (s.tokens ? s.tokens.output : null), { parentCounts: true });
  const work = (v) => v.model + v.tool + v.answer;
  const clock = sum((s) => s.wallMinutes);
  const buckets = sum((s) => s.modelMinutes + s.toolMinutes + s.coordinationMinutes + s.answerMinutes + s.awayMinutes + s.idleMinutes);
  return {
    project,
    from: sessions.length ? localStamp(Math.min(...sessions.map((s) => s.startMs))) : null,
    to: sessions.length ? localStamp(Math.max(...sessions.map((s) => s.endMs))) : null,
    window: { since: since ? localStamp(since) : null, until: until ? localStamp(until) : null },
    sessions: sessions.length,
    inCheckout: sessions.filter((s) => s.role === 'checkout').length,
    inSideCopies: sessions.filter((s) => s.role === 'side copy').length,
    subagents: sessions.filter((s) => s.role === 'subagent').length,
    cut: sessions.filter((s) => !s.whole).length,
    open: sessions.filter((s) => s.open).length,
    unresolved: sessions.unresolved || 0,
    fromStamps: { model: sessions.filter((s) => s.exact.model !== 'harness').length, tool: sessions.filter((s) => s.exact.tool !== 'harness').length },
    harnessClockDisagrees: sessions.filter((s) => s.harnessClock === 'disagrees').length,
    conserves: sessions.every((s) => s.conserves) && Math.abs(buckets - clock) < 0.01,
    clockHours: hours(clock),
    workHours: hours(sum((s) => s.modelMinutes + s.toolMinutes + s.answerMinutes)),
    model: hours(sum((s) => s.modelMinutes)),
    tools: hours(sum((s) => s.toolMinutes)),
    answering: hours(sum((s) => s.answerMinutes)),
    coordination: hours(sum((s) => s.coordinationMinutes)),
    away: hours(sum((s) => s.awayMinutes)),
    idle: hours(sum((s) => s.idleMinutes)),
    ownerMessages: sum((s) => s.ownerMessages),
    kinds: Object.fromEntries(Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, m]) => [k, hours(m)])),
    phases: Object.fromEntries(PHASE_NAMES.filter((p) => phases[p]).map((p) => [p, {
      workHours: hours(work(phases[p])),
      model: hours(phases[p].model), tools: hours(phases[p].tool),
      answering: hours(phases[p].answer), coordination: hours(phases[p].coordination),
      kinds: Object.fromEntries(Object.entries(phases[p].kinds).sort((a, b) => b[1] - a[1]).map(([k, m]) => [k, hours(m)])),
    }])),
    threads: threads(sessions),
    costUSD: round(cost.total), costUnknown: cost.missing,
    linesAdded: added.total, linesRemoved: removed.total, linesUnknown: Math.max(added.missing, removed.missing),
    tokens: { output: tok.total, unknown: tok.missing },
  };
}

// ---- saying it -------------------------------------------------------------

const row = (label, value, width = 30) => `  ${label.padEnd(width)}${value}`;
const named = (kinds) => Object.entries(kinds).filter(([, h]) => h >= 0.05).map(([k, h]) => `${k} ${h}`).join(', ') || 'nothing measured';

export function describeLedger(l) {
  if (!l.sessions) return `No session of ${l.project} was found on this machine.`;
  const out = [
    `${l.project}, ${l.from} to ${l.to}: ${l.sessions} session(s), ${l.inCheckout} in the checkout, ` +
      `${l.inSideCopies} in other working copies, ${l.subagents} subagent(s); ${l.clockHours} h on their clocks, added up.`,
    '',
    `Work, ${l.workHours} h:`,
    row('the model generating', `${l.model} h`),
    row('tools running', `${l.tools} h`),
    row('the owner answering', `${l.answering} h over ${l.ownerMessages} message(s)`),
    'Inside the agents\' turns, in a forecast but not work:',
    row('coordination and waiting', `${l.coordination} h (on subagents, workers, hooks, prompts)`),
    'In no forecast:',
    row('the owner away', `${l.away} h`),
    row('nobody: between turns', `${l.idle} h (the session waiting on a notification, or on nothing)`),
    l.conserves ? 'These add up to the clock.' : 'THESE DO NOT ADD UP TO THE CLOCK: a record could not be laid out.',
    '',
    `What the agents did (hours): ${named(l.kinds)}`,
    '',
    'By phase, work only (hours):',
    ...Object.entries(l.phases).map(([p, v]) =>
      row(p, `${v.workHours}  (model ${v.model}, tools ${v.tools}, answering ${v.answering}) ${named(v.kinds)}`, 14)),
    '',
    `At once: ${l.threads.peak} session(s) working at the peak, ${l.threads.average} on average over ${l.threads.busyHours} h with any working.`,
    `Cost $${l.costUSD}${l.costUnknown ? ` (${l.costUnknown} session(s) carry no cost and are not in it)` : ''}; ` +
      `${l.linesAdded} line(s) written and ${l.linesRemoved} removed${l.linesUnknown ? ` (${l.linesUnknown} session(s) carry no count of lines)` : ''}; ` +
      `${l.tokens.output} token(s) out${l.tokens.unknown ? ` (${l.tokens.unknown} session(s) without a count)` : ''}.`,
  ];
  if (l.fromStamps.model || l.fromStamps.tool)
    out.push(`The model's and tools' minutes of ${Math.max(l.fromStamps.model, l.fromStamps.tool)} session(s) are measured from their stamps; the rest are the harness's own totals.`);
  if (l.harnessClockDisagrees) out.push(`${l.harnessClockDisagrees} session(s) kept a clock of their own that disagrees with their stamps; the stamps were used.`);
  if (l.cut) out.push(`${l.cut} session(s) cross the edge of the period: only their minutes inside it are counted, and none of their cost.`);
  if (l.open) out.push(`${l.open} session(s) may still be running: counted up to their last record.`);
  if (l.unresolved) out.push(`${l.unresolved} session(s) ran in a working copy that is gone and could not be tied to this repository; they are not counted.`);
  out.push('Dates are this machine\'s local time.');
  return out.join('\n');
}

const cell = (v, f) => (v === null || v === undefined ? '?' : f(v));
export function describeSessions(sessions) {
  if (!sessions.length) return 'No session found.';
  const head = `${'session'.padEnd(14)}${'role'.padEnd(11)}${'start'.padEnd(18)}` +
    `${'clock'.padStart(7)}${'model'.padStart(7)}${'tools'.padStart(7)}${'coord'.padStart(7)}${'owner'.padStart(7)}` +
    `${'away'.padStart(7)}${'idle'.padStart(7)}${'cost'.padStart(9)}${'lines'.padStart(11)}`;
  const m = (n) => round(n).toFixed(0).padStart(7);
  const rows = sessions.map((s) =>
    `${String(s.id).slice(0, 13).padEnd(14)}${s.role.padEnd(11)}${s.startedAt.slice(0, 16).padEnd(18)}` +
    `${m(s.wallMinutes)}${m(s.modelMinutes)}${m(s.toolMinutes)}${m(s.coordinationMinutes)}${m(s.answerMinutes)}` +
    `${m(s.awayMinutes)}${m(s.idleMinutes)}` +
    `${(s.costIn === 'parent' ? 'parent' : cell(s.costUSD, (c) => `$${round(c)}`)).padStart(9)}` +
    `${(s.costIn === 'parent' ? 'parent' : s.linesAdded === null ? '?' : `+${s.linesAdded}/-${s.linesRemoved}`).padStart(11)}`);
  return [head, ...rows, '',
    'Minutes, not hours; each row adds up to its clock. The owner\'s are an estimate, the rest measured;',
    '? is a figure the session did not record, "parent" one counted in the session that started it. Local time.'].join('\n');
}

// ---- statistics -------------------------------------------------------------
//
// `stats`: what the same reading of sessions gives (`time`, `sessions`),
// laid where a person looks at it. A day as 24 hour rows, each hour a stacked
// bar by kind of activity; the longer periods as a heat map of agent-hours a
// day. Nothing is measured twice: every figure is either a ledger figure of
// the same window or a sum of the pieces of the clock the buckets are laid
// in. What the record does not carry is unknown, never zero; a session the
// window cuts has only its pieces inside it, and none of its cost.

const HOUR_MS = 3600e3;
const DAY_MS = 24 * HOUR_MS;

// The kinds of activity the day's bar stacks. The ledger's kinds fold into
// them; a kind none of them names is talking: planning, a shell run for
// neither, a reply. Waiting is what nobody did: the rest of a turn (whose
// workers' minutes are their own sessions'), and the gaps no work filled.
const STATS_GROUPS = ['develop', 'test', 'analyze', 'delegate', 'git', 'talk', 'answer', 'wait'];
const STATS_LABELS = { develop: 'develop', test: 'test', analyze: 'analyze', delegate: 'review/deleg',
  git: 'git/ci', talk: 'talking', answer: 'answered', wait: 'waiting/idle' };
// Small codes, because a row must fit beside its bar in 80 columns.
const STATS_CODES = { develop: 'dev', test: 'test', analyze: 'read', delegate: 'deleg', git: 'git',
  talk: 'talk', answer: 'you', wait: 'idle' };
const groupOf = ({ bucket, kind }) => (bucket === 'answer' ? 'answer'
  : bucket === 'coordination' || bucket === 'idle' || bucket === 'away' || kind === 'wait' ? 'wait'
    : kind === 'develop' || kind === 'build' ? 'develop'
      : kind === 'test' ? 'test'
        : kind === 'analyze' ? 'analyze'
          : kind === 'delegate' ? 'delegate'
            : kind === 'git' || kind === 'ci' ? 'git' : 'talk');

// Colour: one accent, mid-tones that read the same on a dark and on a light
// terminal, gray for what nobody did; the heat climbs from blue into green.
// Plain text where asked, and always when no terminal is on the other end.
const STATS_COLORS = { develop: 114, test: 179, analyze: 75, delegate: 176, git: 80, talk: 151,
  answer: 152, wait: 240, accent: 117, dim: 245, dimmer: 238 };
const HEAT_CHARS = [' ', '░', '▒', '▓', '█'];
const HEAT_COLORS = [null, 24, 31, 38, 44];
// Plain mode needs a shape per kind, not only a colour: the bar still says
// what filled the hour when the terminal is on paper.
const PLAIN_GLYPHS = { develop: '█', test: '▓', analyze: '▒', delegate: '▐', git: '▆',
  talk: '▄', answer: '▀', wait: '░' };
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A kind's outside name where the record's own would confuse: a tool that
// only sleeps is 'sleep', not the kind of nothing the bar uses.
const KIND_LABELS = { wait: 'sleep' };

const blankGroups = () => Object.fromEntries(STATS_GROUPS.map((g) => [g, 0]));
const addTo = (to, from) => { for (const g of STATS_GROUPS) to[g] += from[g] || 0; };
const localDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayStartOf = (day) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const pct1 = (share) => { if (!Number.isFinite(share)) return null; const r = Math.round(share * 1000) / 10; return r % 1 ? r.toFixed(1) : String(r); };

// The laid pieces of the clock, split on the local hour and the local day.
// A piece the harness's totals narrowed is split in the proportion it kept.
function hourRows(sessions, since, until) {
  const rows = new Map();
  const row = (h) => {
    let r = rows.get(h);
    if (!r) { r = { groups: blankGroups(), agentMs: 0, ivs: [] }; rows.set(h, r); }
    return r;
  };
  for (const s of sessions) {
    for (const g of s.segments || []) {
      if (!(g.ms > 0)) continue;
      const group = groupOf(g);
      let at = Math.max(g.start, since);
      const end = Math.min(g.end, until);
      if (!(end > at)) continue;
      const whole = end - at;
      while (at < end) {
        const d = new Date(at);
        const he = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
        const piece = Math.min(end, he) - at;
        row(d.getHours()).groups[group] += g.ms * (piece / whole);
        at += piece;
      }
    }
    for (const o of s.occupied || []) {
      let at = Math.max(o.start, since);
      const end = Math.min(o.end, until);
      while (at < end) {
        const d = new Date(at);
        const hs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()).getTime();
        const he = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
        const piece = Math.min(end, he) - at;
        const r = row(d.getHours());
        r.agentMs += piece;
        r.ivs.push([at, Math.min(at + piece, he)]);
        at += piece;
      }
    }
  }
  return rows;
}

// Every hour of one local day: what filled it, by kind; the agent-hours of
// the hour, where several sessions at once make more than one; and how many
// were working at the peak of that hour.
function hoursOfDay(sessions, since, until) {
  const rows = hourRows(sessions, since, until);
  const out = [];
  for (let h = 0; h < 24; h++) {
    const r = rows.get(h);
    const hour = `${String(h).padStart(2, '0')}:00`;
    if (!r) { out.push({ hour, groups: blankGroups(), agentMillis: 0, peak: 0 }); continue; }
    const edges = r.ivs.flatMap(([a, b]) => [[a, 1], [b, -1]]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    let open = 0, peak = 0;
    for (const [, delta] of edges) { open += delta; peak = Math.max(peak, open); }
    out.push({ hour, groups: r.groups, agentMillis: r.agentMs, peak });
  }
  return out;
}

// The agent-hours of every local day the period holds, as the day view
// counts them: what any session occupied, sessions counted as they overlap.
function heatDays(sessions, since, until) {
  const days = new Map();
  for (const s of sessions) for (const o of s.occupied || []) {
    if (!(o.end > o.start)) continue;
    let at = o.start;
    while (at < o.end) {
      const d = new Date(at);
      const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const de = ds + DAY_MS;
      if (o.end > ds && o.start < de) days.set(localDay(Math.max(at, ds)), (days.get(localDay(Math.max(at, ds))) || 0) + Math.min(o.end, de) - Math.max(o.start, ds));
      at = Math.min(o.end, de);
    }
  }
  const out = [];
  // The days are stepped in local arithmetic, so a DST shift moves no day
  // off its row.
  for (let at = since; at < until;) {
    const d = new Date(at);
    const key = localDay(at);
    out.push({ day: key, agentMillis: days.get(key) || 0 });
    at = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  }
  return out;
}

// Who the time was: by agent, and by model where the record names one. Cost
// is a figure of the session, never of a model; where a session carries
// both, it is divided over its models by the minutes each got - a split,
// said so where it is shown. A model no record names is "(not recorded)",
// and a session that carries a cost but names no model is counted there.
const AGENT_NAMES = { 'codex': 'Codex', 'claude-code': 'Claude Code', 'omp': 'omp',
  'prime-agent': 'Prime Agent', 'pi': 'Pi' };
function whoOf(sessions) {
  const agents = {};
  const models = {};
  let modelsWithUnknownCost = 0;
  for (const s of sessions) {
    const a = (agents[s.harness] ||= { name: AGENT_NAMES[s.harness] || s.harness, clockMillis: 0, cost: null, unknown: 0 });
    a.clockMillis += s.wallMinutes * 60e3;
    if (typeof s.costUSD === 'number' && s.costIn === 'own') a.cost = (a.cost || 0) + s.costUSD;
    else if (s.costIn !== 'parent') a.unknown++;
    const ms = Object.values(s.models || {}).reduce((x, y) => x + y, 0);
    if (!(ms > 0)) continue;
    const cost = typeof s.costUSD === 'number' && s.costIn === 'own' ? s.costUSD : null;
    if (cost === null && s.costIn !== 'parent') modelsWithUnknownCost++;
    for (const [name, mms] of Object.entries(s.models || {})) {
      const m = (models[name] ||= { millis: 0, cost: 0, costKnown: false });
      m.millis += mms * 60e3;
      if (cost !== null) { m.cost += cost * (mms / ms); m.costKnown = true; }
    }
  }
  const order = (o, key) => Object.fromEntries(Object.entries(o).sort((x, y) => y[1][key] - x[1][key]));
  return { agents: order(agents, 'clockMillis'), models: order(models, 'millis'), modelsWithUnknownCost };
}

// The figures every period shows, all read from the ledger of the window.
function statsBase(project, sessions, since, until, period) {
  const l = ledger(project, { sessions, since, until });
  const heat = heatDays(sessions, since, until);
  // The longest stretch of the agent's own work: the union of what measure
  // already calls active, which excludes the owner answering, a turn's wait
  // and nobody's gaps; sessions running end for end make one stretch.
  let longest = null;
  for (const b of union(sessions.flatMap((s) => s.active || [])))
    if (!longest || b.end - b.start > longest.ms) longest = { ...b, ms: b.end - b.start };
  const busiest = heat.reduce((a, d) => (!a || d.agentMillis > a.agentMillis ? d : a), null);
  const started = sessions.filter((s) => s.whole || s.startMs > since).length;
  const workHours = l.workHours || 0;
  // Shares come from raw minutes, never from the ledger's rounded hours:
  // two minutes of a six-minute session would round twice to a hundred
  // percent a phase.
  const workMinutes = sessions.reduce((n, s) => n + s.modelMinutes + s.toolMinutes + s.answerMinutes, 0);
  const kindMinutes = {};
  const phaseMinutes = {};
  for (const s of sessions) {
    for (const [k, m] of Object.entries(s.kinds)) kindMinutes[k] = (kindMinutes[k] || 0) + m;
    for (const [pn, v] of Object.entries(s.phases)) phaseMinutes[pn] = (phaseMinutes[pn] || 0) + v.model + v.tool + v.answer;
  }
  const share = (h, of) => (of ? pct1((h || 0) / of) : null);
  // The one split the bars show: the kinds of activity over everything the
  // records laid on the clock, waiting in. The kinds of work alone come
  // beneath as their own line, clearly labelled.
  const groupMs = blankGroups();
  for (const s of sessions) for (const g of s.segments || [])
    if (g.ms > 0) groupMs[groupOf(g)] += g.ms;
  const laidAll = STATS_GROUPS.reduce((n, g) => n + groupMs[g], 0);
  const activity = Object.fromEntries(STATS_GROUPS.map((g) =>
    [g, laidAll > 0 ? pct1(groupMs[g] / laidAll) : null]));
  const who = whoOf(sessions);
  return {
    period,
    project,
    window: { from: since === null ? null : localStamp(since), to: until === null ? null : localStamp(until) },
    found: sessions.length,
    days: heat,
    busiest: busiest && busiest.agentMillis > 0
      ? { day: busiest.day, agentMillis: busiest.agentMillis, hours: round(busiest.agentMillis / HOUR_MS) } : null,
    longest: longest ? { hours: round(longest.ms / HOUR_MS), from: localStamp(longest.start), to: localStamp(longest.end) } : null,
    concurrent: l.threads.peak,
    sessions: {
      started, inCheckout: l.inCheckout, inSideCopies: l.inSideCopies, subagents: l.subagents,
      open: l.open, cut: l.cut, unresolved: l.unresolved,
    },
    conserves: l.conserves,
    clockHours: l.clockHours,
    workHours, model: l.model, tools: l.tools, answered: l.answering, ownerMessages: l.ownerMessages,
    coordination: l.coordination, away: l.away, idle: l.idle,
    kinds: Object.entries(kindMinutes).filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1])
      .map(([name, m]) => ({ name: KIND_LABELS[name] || name, hours: round(m / 60), workShare: share(m, workMinutes) })),
    phases: PHASE_NAMES.filter((name) => (phaseMinutes[name] || 0) > 0).sort((a, b) => phaseMinutes[b] - phaseMinutes[a])
      .map((name) => ({ name, hours: round(phaseMinutes[name] / 60), workShare: share(phaseMinutes[name], workMinutes) })),
    noPhaseWorkHours: round((phaseMinutes.unattributed || 0) / 60),
    noPhaseShare: workMinutes ? share(phaseMinutes.unattributed || 0, workMinutes) : null,
    fromStamps: l.fromStamps, harnessClockDisagrees: l.harnessClockDisagrees,
    activity,
    agents: who.agents, models: who.models, modelsWithUnknownCost: who.modelsWithUnknownCost,
    costUSD: l.costUSD, costUnknown: l.costUnknown,
    linesAdded: l.linesAdded, linesRemoved: l.linesRemoved, linesUnknown: l.linesUnknown,
    tokens: l.tokens,
  };
}

export function statsDay(project, sessions, since, until) {
  const base = statsBase(project, sessions, since, until, 'day');
  base.hours = hoursOfDay(sessions, since, until);
  const barTotals = blankGroups();
  for (const r of base.hours) addTo(barTotals, r.groups);
  const whole = Object.values(barTotals).reduce((a, b) => a + b, 0);
  base.activity = Object.fromEntries(STATS_GROUPS.map((g) => [g, whole ? pct1(barTotals[g] / whole) : null]));
  return base;
}

export function statsStretch(project, sessions, since, until, period) {
  return statsBase(project, sessions, since, until, period);
}

// ---- the drawing ------------------------------------------------------------
//
// --json prints the figures above as they are; this is how they are drawn.
// One accent, a calm palette of mid-tones, blocks and shades; plain text on
// --no-color, when NO_COLOR is set, and when no terminal is on the other end.

const srow = (label, value, width = 33) => row(label, value, width);
// Long lines wrap at word boundaries, keeping their indentation; a
// continuation starts where the line did.
const wrap = (line, W) => {
  if (stripCodes(line).length <= W || !line.trim()) return [line];
  const indent = /^ */.exec(line)[0];
  const room = W - indent.length;
  const out = [];
  let cur = '';
  for (const part of line.trim().split(' · ')) {
    // A roster part turns whole: shares and names are not cut apart. A part
    // that is alone over the room wraps by words.
    const cand = cur ? `${cur} · ${part}` : part;
    if (stripCodes(cand).length > room) {
      if (cur) { out.push(indent + cur); cur = ''; }
      let w = '';
      for (const word of part.split(' ')) {
        if (w && stripCodes(w).length + 1 + stripCodes(word).length > room) { out.push(indent + w); w = word; }
        else w = w ? `${w} ${word}` : word;
      }
      cur = w;
    } else cur = cand;
  }
  if (cur) out.push(indent + cur);
  return out;
};
const paintIn = (color) => {
  const paint = (code, s) => (color && code != null ? `\x1b[38;5;${code}m${s}\x1b[0m` : s);
  paint.color = color;
  return paint;
};
// What a coloured string measures as on the terminal: without the codes.
const stripCodes = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const namedDay = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const h1 = (hours) => `${(Math.round(hours * 10) / 10).toFixed(1)} h`;
const roster = (pairs) => pairs.map(([k, text]) => `${k} ${text}`).join(' · ');
const shares = (list) => list.map(({ name, workShare }) => `${name} ${workShare}%`).join(' · ');
const shortStamp = (stamp) => `${stamp.slice(11, 16)} ${namedDay(stamp.slice(0, 10))}`;
const spanText = (w) => w.from && w.to ? `${namedDay(w.from.slice(0, 10))} → ${namedDay(localDay(dayStartOf(w.to.slice(0, 10)) - 1))}` : 'nothing on record';

function statsRows(v, p) {
  const out = [];
  out.push(srow('on the clock', `${v.clockHours} h`));
  out.push(srow('working', `${v.workHours} h (the model ${v.model}, tools ${v.tools})`));
  out.push(srow('the owner answered', `${v.answered} h over ${v.ownerMessages} message(s)`));
  out.push(srow('waiting under the hood', `${v.coordination} h`));
  out.push(srow('the owner away', `${v.away} h`));
  out.push(srow('nobody', `${v.idle} h`));
  const at = v.sessions;
  out.push(srow('sessions started', `${at.started} (in the checkout ${at.inCheckout}, other working copies ${at.inSideCopies}, subagents ${at.subagents})`));
  out.push(srow('at once, at the peak', `${v.concurrent} session(s)`));

  out.push(srow('of the work, without waiting', v.kinds.length ? shares(v.kinds) : 'nothing the records name'));
  out.push(srow('by phase', v.phases.some((f) => f.hours > 0) ? shares(v.phases) : 'nothing the records name'));
  out.push(srow('with no phase', `${v.noPhaseShare ?? '?'}% of the work, unattributed as far as the records show`));
  return out;
}

function costLines(v, p) {
  const out = [];
  const agents = Object.entries(v.agents).map(([, a]) =>
    [a.name, `${h1(a.clockMillis / HOUR_MS)}${typeof a.cost === 'number' ? ` $${round(a.cost)}` : ''}`]);
  out.push(srow('by agent', agents.length ? roster(agents) : 'nothing was run by an agent this set reads'));
  // Models with a share worth a row stand alone; the small ones fold into
  // one line, and the caveat about the split is a footnote, not a bracket.
  const allModels = Object.entries(v.models);
  const big = allModels.filter(([, m]) => m.millis >= 0.1 * HOUR_MS);
  const small = allModels.filter(([, m]) => m.millis < 0.1 * HOUR_MS);
  let modelText = null;
  if (big.length) {
    const bits = big.map(([name, m]) =>
      [name, `${h1(m.millis / HOUR_MS)}${m.costKnown && round(m.cost) > 0 ? ` $${round(m.cost)}` : ''}`]);
    if (small.length) {
      const ms = small.reduce((n, [, m]) => n + m.millis, 0);
      const cost = small.reduce((n, [, m]) => n + m.cost, 0);
      bits.push([`other ${small.length} model(s)`, `${h1(ms / HOUR_MS)}${cost >= 0.01 ? ` $${round(cost)}` : ''}`]);
    }
    modelText = roster(bits);
  } else modelText = allModels.length ? 'no share a figure of its own' : 'no record names a model for its model time';
  out.push(srow('by model', modelText));
  if (allModels.length && (Object.values(v.models).some((m) => m.costKnown) || v.modelsWithUnknownCost))
    out.push(`  ${p(STATS_COLORS.dim, `cost is split over a session's models by its minutes${v.modelsWithUnknownCost ? `, ${v.modelsWithUnknownCost} session(s) with a cost name no model` : ''}`)}`);
  out.push(srow('cost', `$${v.costUSD ?? '?'}${v.costUnknown ? ` (unknown for ${v.costUnknown} session(s), not in it)` : ''}`));
  return out;
}

const notesOf = (v) => {
  const out = [];
  if (v.sessions.cut) out.push(`${v.sessions.cut} session(s) cross the edge of the period: only their minutes inside it are counted, and none of their cost.`);
  if (v.sessions.open) out.push(`${v.sessions.open} session(s) may still be running: counted up to their last record.`);
  if (v.sessions.unresolved) out.push(`${v.sessions.unresolved} session(s) ran in a working copy that is gone and could not be tied to this repository; they are not counted.`);
  if (v.harnessClockDisagrees) out.push(`${v.harnessClockDisagrees} session(s) kept a clock of their own that disagrees with their stamps; the stamps were used.`);
  return out;
};

const tailOf = (v) => [
  ...(v.conserves ? [] : ['THESE DO NOT ADD UP TO THE CLOCK: a record could not be laid out.']),
  '', ...notesOf(v).map((note) => `· ${note}`),
  v.fromStamps.model || v.fromStamps.tool
    ? `The model's and tools' minutes of ${Math.max(v.fromStamps.model, v.fromStamps.tool)} session(s) are measured from their stamps; the rest are the harness's own totals.`
    : `Dates are this machine\'s local time.`,
];

// The stacked bar of an hour, on one scale for the whole day: the busiest
// hour fills the bar, the hour's own length follows its fill, the kinds keep
// their shares inside, and the minutes nobody fills trail behind the work in
// shades. Plain mode shapes each kind instead of colouring it.
function barOf(groups, p, width, peak) {
  if (!(peak > 0)) return p(STATS_COLORS.dimmer, '·'.repeat(width));
  const cellsOf = (ms) => Math.round((ms / peak) * width);
  const draw = (g, n) => p(STATS_COLORS[g], n > 0 ? (p.color ? '█'.repeat(n) : PLAIN_GLYPHS[g].repeat(n)) : '');
  const parts = [];
  let busySeen = 0, laidMs = 0, busyMs = 0;
  for (const g of STATS_GROUPS) {
    laidMs += groups[g] || 0;
    if (g === 'wait') continue;
    busyMs += groups[g] || 0;
    const end = cellsOf(busyMs);
    if (end > busySeen) { parts.push(draw(g, end - busySeen)); busySeen = end; }
  }
  const laidCells = cellsOf(laidMs);
  if (laidCells > busySeen)
    parts.push(p(STATS_COLORS.wait, (p.color ? '█' : '░').repeat(laidCells - busySeen)));
  const pad = width - Math.max(laidCells, busySeen);
  if (pad > 0) parts.push(p(STATS_COLORS.dimmer, '·'.repeat(pad)));
  return parts.join('');
}

const legendCell = (g, label, p) => {
  const mark = p.color ? p(STATS_COLORS[g], '▉') : p(STATS_COLORS[g], PLAIN_GLYPHS[g]);
  return `${mark} ${label}` + ' '.repeat(Math.max(1, 14 - label.length));
};

// Four levels against the busiest day of the view, as the legend promises:
// the busiest day is full, the rest are shares of it.
const heatLevel = (ms, peak) => {
  if (!(peak > 0) || !(ms > 0)) return 0;
  const part = ms / peak;
  return part < 1 / 6 ? 1 : part < 1 / 2 ? 2 : part < 9 / 10 ? 3 : 4;
};
const cellPaint = (ms, peak, p) => {
  const level = heatLevel(ms, peak);
  return HEAT_CHARS[level] === ' ' ? ' ' : p(HEAT_COLORS[level], HEAT_CHARS[level]);
};

function dayView(v, p, W) {
  const day = v.window.from.slice(0, 10);
  const dow = DAY_NAMES[(new Date(`${day}T12:00:00`).getDay() + 6) % 7];
  const out = [p(STATS_COLORS.accent, `${v.project} — ${dow} ${namedDay(day)}`),
    p(STATS_COLORS.dim, 'the day by the hour; the busiest hour is the full bar, hour shares in whole percents'),
    ''];
  const legend = [['develop', 'analyze', 'git/ci', 'answered'], ['test', 'deleg', 'talking', 'waiting/idle']];
  const keys = [['develop', 'analyze', 'git', 'answer'], ['test', 'delegate', 'talk', 'wait']];
  // The legend pads by the visible width of each label, not by a string the
  // colour codes have already widened.
  for (let i = 0; i < legend.length; i++)
    out.push(`  ${legend[i].map((label, j) => legendCell(keys[i][j], label, p)).join('   ')}`);
  // One clause where a person first meets the two names that carry a
  // meaning worth a look.
  out.push(p(STATS_COLORS.dim, '  talking: planning, shell runs for neither, replies; answered: minutes with the owner'));
  out.push('');
  if (!v.found) out.push(p(STATS_COLORS.dim, `No session of ${v.project} was found on this machine in the period.`));
  const barWidth = W - 58;
  // The busiest hour of the day is the full bar: one scale for all 24 rows.
  const peak = Math.max(...v.hours.map((r) => STATS_GROUPS.reduce((n, g) => n + r.groups[g], 0)));
  for (const r of v.hours) {
    const total = STATS_GROUPS.reduce((n, g) => n + r.groups[g], 0);
    if (!(total > 0) && !(r.agentMillis > 0)) { out.push(`${p(STATS_COLORS.dimmer, r.hour.slice(0, 2))}  ${'·'.repeat(barWidth)}`); continue; }
    const agent = r.agentMillis > 0 ? p(STATS_COLORS.accent, h1(r.agentMillis / HOUR_MS).padStart(5)) : '     ';
    const conc = r.peak > 1 ? p(STATS_COLORS.accent, `×${r.peak}`.padEnd(3)) : '   ';
    // Three kinds, whole percents: the row has to hold beside its bar in
    // both widths.
    const bits = STATS_GROUPS.map((g) => [g, r.groups[g]]).filter(([, ms]) => ms > 0)
      .sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([g, ms]) => p(STATS_COLORS[g], `${STATS_CODES[g]} ${Math.round(100 * ms / total)}%`));
    out.push(`${p(STATS_COLORS.dim, r.hour.slice(0, 2))}  ${barOf(r.groups, p, barWidth, peak)} ${agent} ${conc} ${bits.join('  ')}`);
  }
  out.push('');
  out.push(srow('by activity',
    roster(Object.entries(v.activity).filter(([, x]) => x !== null && x > 0).map(([g, x]) => [STATS_LABELS[g], `${x}%`])) || 'nothing was on the records'));
  return [...out, '', ...statsRows(v, p), '', ...costLines(v, p), '',
    srow('the longest stretch of work', v.longest ? `${v.longest.hours} h, to ${shortStamp(v.longest.to)}` : 'nothing was on the records'),
    ...tailOf(v)];
}

// The heat of the longer periods: weekday rows, calendar weeks as columns,
// like the activity picture the agents show. What is too wide for the
// terminal keeps its newest weeks and says what it left off.
function heatGrid(v, p, W) {
  if (!v.days.length) return [];
  const peak = Math.max(...v.days.map((d) => d.agentMillis));
  const days = new Map(v.days.map((d) => [d.day, d.agentMillis]));
  const noon = (key) => new Date(`${key}T12:00:00`).getTime();
  const atOf = (base, days) => { const d = new Date(base); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime(); };
  const mondayOf = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (d.getDay() + 6) % 7); };
  let base = mondayOf(noon(v.days[0].day));
  const end = noon(v.days.at(-1).day);
  const all = [];
  while (base <= end) {
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const key = localDay(atOf(base, i));
      cells.push({ key, ms: days.get(key) || 0 });
    }
    all.push(cells);
    base = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7);
  }
  const shown = all.slice(-Math.floor((W - 6) / 3));
  const out = [];
  if (all.length > shown.length) out.push(p(STATS_COLORS.dimmer, `…${all.length - shown.length} earlier week(s) left off the map; --json has every day.`));
  // The columns are calendar weeks; each is named by the day of the month
  // it begins on, two figures so the cells and the labels line up.
  const labels = shown.map((cells) => String(new Date(`${cells[0].key}T12:00:00`).getDate()).padStart(2));
  out.push(`    ${labels.join(' ')}`);
  for (let i = 0; i < 7; i++) {
    const cells = shown.map((c) => c[i]);
    out.push(`${p(STATS_COLORS.dim, WEEKDAYS[i])}  ${cells.map((c) => cellPaint(c.ms, peak, p)).join(' ')}`);
  }
  return out;
}

// A week is seven days: the heat reads as a list of its days, each with its
// own figures beside it.
function weekList(v, p) {
  const peak = Math.max(...v.days.map((d) => d.agentMillis));
  return v.days.map((d) => {
    const dt = new Date(`${d.day}T12:00:00`);
    const ms = d.agentMillis > 0 ? p(STATS_COLORS.dim, `  ${h1(d.agentMillis / HOUR_MS)}`) : '';
    const cell = d.agentMillis > 0 ? cellPaint(d.agentMillis, peak, p) : p(STATS_COLORS.dimmer, '·');
    return `  ${p(STATS_COLORS.dim, WEEKDAYS[(dt.getDay() + 6) % 7])} ${namedDay(d.day)}  ${cell}${ms}`;
  });
}

function stretchView(v, p, W) {
  const names = { week: 'the week', month: 'the month', all: 'all time' };
  const out = [p(STATS_COLORS.accent, `${v.project} — ${names[v.period]} ${spanText(v.window)}`),
    p(STATS_COLORS.dim, 'agent-hours a day, local time'),
    ''];
  out.push(...(v.period === 'week' ? weekList(v, p) : heatGrid(v, p, W)));
  out.push('');
  out.push(`  less ${HEAT_CHARS.slice(1).map((ch, i) => p(HEAT_COLORS[i + 1], ch)).join('')} more — the level of a day`);
  if (v.busiest) out.push('');
  if (v.busiest) out.push(srow('the busiest day', `${namedDay(v.busiest.day)}, ${v.busiest.hours} h`));
  if (!v.found) out.push('');
  if (!v.found) out.push(p(STATS_COLORS.dim, `No session of ${v.project} was found on this machine in the period.`));
  return [...out, '', ...statsRows(v, p), '', ...costLines(v, p), '',
    srow('the longest stretch of work', v.longest ? `${v.longest.hours} h, to ${shortStamp(v.longest.to)}` : 'nothing was on the records'),
    ...tailOf(v)];
}

export function describeStats(v, fmt = {}) {
  const color = fmt.color ?? false;
  const W = (fmt.width ?? 80) <= 90 ? 80 : 100;
  const p = paintIn(color);
  const lines = v.period === 'day' ? dayView(v, p, W) : stretchView(v, p, W);
  return lines.flatMap((line) => wrap(line.replace(/[ \t]+$/, ''), W)).join('\n');
}

// ---- command line ----------------------------------------------------------

const HELP = `ledger.mjs time [--since <date>] [--until <date>] [--project <name>] [--repo <path>] [--json]
ledger.mjs sessions [--since <date>] [--until <date>] [--project <name>] [--repo <path>] [--json]
ledger.mjs stats [--day [<date>] | --week | --month | --all] [--json] [--no-color]
ledger.mjs adapters [--json]
ledger.mjs subagents --harness <h> --session <id> [--json]
time     where this project's hours went: the model, tools, coordination, the owner, and nobody
sessions one line per session, including other working copies and subagents
stats    the same reading, drawn: a day as 24 hour rows, each hour a stacked bar
         by kind of activity, a legend, and the day's totals; the longer
         periods as a heat map of agent-hours a day, with the headlines.
         Default --day today; --day names one day.
adapters the agents this copy of the set reads, and what each cannot do here
subagents the sessions one session started, where the harness keeps them apart
--since, --until  a date is a day on this machine's clock (--until includes it); a time
         without an offset is local too. Sessions crossing the edge count only inside it.
--repo   a checkout of the project, when not run from one
--answer-minutes <n> where a gap before the owner's message, or a question waiting on him,
stops being him answering and becomes him away (${ANSWER_MINUTES} by default): the one figure
here that is a judgement rather than a measurement
Colour: --no-color for plain text, or NO_COLOR, or no terminal. The width is
         the terminal's, capped at 100 columns and no less than 80.
Sessions are read from this machine's harness records and belong to the project by its git
repository; --project defaults to the checkout's name.
Exit 0 done, 2 misuse.`;

export function run(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) throw new Usage(`unexpected ${a}`);
    const key = a.slice(2);
    // The valueless flags: `stats` names its period with one of them, and
    // every command may ask for the drawing or the json.
    if (key === 'json' || key === 'no-color' || key === 'week' || key === 'month' || key === 'all') { opts[key] = true; continue; }
    if (key === 'day') {
      const next = rest[i + 1];
      if (next !== undefined && !String(next).startsWith('--')) { opts.day = next; i++; }
      else opts.day = true;
      continue;
    }
    if (i + 1 >= rest.length) throw new Usage(`${a} needs a value`);
    opts[key] = rest[++i];
  }
  for (const key of ['since', 'until'])
    if (opts[key] !== undefined && Number.isNaN(parseWhen(opts[key]))) throw new Usage(`--${key} needs a date`);
  if (opts['answer-minutes'] !== undefined) {
    const n = Number(opts['answer-minutes']);
    if (!Number.isFinite(n) || n <= 0) throw new Usage('--answer-minutes needs minutes');
    opts['answer-minutes'] = n;
  }
  const project = command === 'adapters' || command === 'subagents' ? null : projectName(opts.project, opts.repo);
  const print = (value, text) => (opts.json ? JSON.stringify(value, null, 2) : text);
  switch (command) {
    case 'adapters':
      return print(Object.fromEntries(Object.entries(ADAPTERS).map(([harness, a]) => [harness,
        { name: a.name, env: a.env, currentSession: a.env.length > 0, subagents: a.subagentList, limits: a.limits }])),
      describeAdapters());
    case 'subagents': {
      if (!opts.harness || !opts.session) throw new Usage('--harness <h> and --session <id> are required: the set lists one session\'s subagents');
      const rows = subagents(opts.harness, opts.session);
      return print(rows, rows.length ? rows.map((r) => `${r.id ?? '(no id of its own)'}  ${r.path}`).join('\n')
        : `no subagent of ${opts.harness}:${opts.session} is on this machine`);
    }
    case 'time': {
      const l = ledger(project, opts);
      return print(l, describeLedger(l));
    }
    case 'stats': {
      const picked = ['day', 'week', 'month', 'all'].filter((k) => opts[k] !== undefined);
      if (picked.length > 1) throw new Usage('one of --day [<date>], --week, --month or --all');
      const period = picked[0] || 'day';
      const now = new Date();
      const today = localDay(Date.now());
      let since, until, day = null;
      if (period === 'day') {
        if (opts.day !== undefined && opts.day !== true) {
          if (Number.isNaN(parseWhen(opts.day))) throw new Usage('--day needs a date');
          day = opts.day;
        } else day = today;
        since = parseWhen(day);
        until = parseWhen(day, { end: true });
      } else {
        // A week is the last seven days, a month the last thirty, ending
        // today; all time opens with the first session's local day. Midnight
        // arithmetic stays local, so a DST shift does not move an edge.
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (period === 'week' ? 6 : 29));
        since = start.getTime();
        until = parseWhen(today, { end: true });
      }
      // All time reads every session this machine has; only then does it
      // know what its own window is.
      const sessions = findSessions(project, {
        since: period === 'all' ? undefined : since, until: period === 'all' ? undefined : until,
        answerMinutes: opts['answer-minutes'], repo: opts.repo,
      });
      let view;
      if (period === 'day') view = statsDay(project, sessions, since, until);
      else {
        // All time runs from the first session's local day to the last's; a
        // week and a month keep the ending period whatever the sessions did.
        if (period === 'all' && sessions.length) {
          since = dayStartOf(localDay(Math.min(...sessions.map((s) => s.startMs))));
          until = dayStartOf(localDay(Math.max(...sessions.map((s) => s.endMs)))) + DAY_MS;
        }
        view = statsStretch(project, sessions, since, until, period);
      }
      if (opts.json) return print(view, null);
      const color = !opts['no-color'] && !process.env.NO_COLOR && process.stdout.isTTY;
      const width = (process.stdout.columns || 100) >= 100 ? 100 : 80;
      return describeStats(view, { color, width });
    }
    case 'sessions': {
      const s = findSessions(project, {
        since: opts.since ? parseWhen(opts.since) : undefined,
        until: opts.until ? parseWhen(opts.until, { end: true }) : undefined,
        answerMinutes: opts['answer-minutes'], repo: opts.repo,
      });
      return print(s.map(({ active, occupied, ...rest }) => rest), describeSessions(s));
    }
    default:
      throw new Usage(`unknown command ${command ?? '(none)'}`);
  }
}

// ---- self-test -------------------------------------------------------------

// The recorded shapes, real transcripts of both harnesses stripped to their
// structure and stamps, live beside take-task's copy of this file, which owns
// it; a copy elsewhere tests without them and says so.
export function recordedShapes(expect) {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = join(here, 'fixtures', 'ledger');
  if (existsSync(dir)) return dir;
  if (basename(here) === 'take-task') expect(`the recorded shapes are beside this file (${dir})`, false);
  else console.log('SKIP  the recorded shapes live beside take-task\'s copy of this file');
  return null;
}

function selftest() {
  const home = mkdtempSync(join(tmpdir(), 'ledger-selftest-'));
  const saved = { ...process.env };
  const savedCwd = process.cwd();
  process.env.CLAUDE_CONFIG_DIR = join(home, 'claude');
  process.env.CODEX_HOME = join(home, 'codex');
  process.env.PI_CODING_AGENT_DIR = join(home, 'omp');
  delete process.env.PI_CODING_AGENT_SESSION_DIR;
  delete process.env.PI_SESSION_ID;
  // pi's and prime-agent's sessions are in their own homes, under this one.
  process.env.HOME = home;
  for (const k of ['PRIME_AGENT_SESSION_DIR', 'PRIME_AGENT_CODING_AGENT_SESSION_DIR', 'PRIME_AGENT_CODING_AGENT_DIR']) delete process.env[k];
  const failures = [];
  const expect = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failures.push(name); };
  const T = (min, sec = 0) => new Date(Date.parse('2026-01-01T10:00:00Z') + min * 60e3 + sec * 1e3).toISOString();
  const ms = (min) => min * 60e3;
  const adds = (s) => Math.abs(s.modelMinutes + s.toolMinutes + s.coordinationMinutes + s.answerMinutes
    + s.awayMinutes + s.idleMinutes - s.wallMinutes) < 1e-6;
  const sh = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  const write = (path, list) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${list.map((r) => JSON.stringify(r)).join('\n')}\n`); };
  const claudeDir = (cwd) => join(home, 'claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));

  try {
    // The project is a real repository with a working copy of its own, an
    // unrelated repository whose name begins with the project's, and a
    // working copy that no longer exists.
    const w = join(home, 'w');
    const demo = join(w, 'demo');
    mkdirSync(demo, { recursive: true });
    sh(['init', '-q', '-b', 'main'], demo);
    sh(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x'], demo);
    sh(['remote', 'add', 'origin', 'git@example.com:someone/demo.git'], demo);
    sh(['remote', 'add', 'fixture', '/srv/git/demo.git'], demo);
    const copy = join(w, 'wt-82dz');
    sh(['worktree', 'add', '-q', '-b', 'work', copy], demo);
    const other = join(w, 'demo-other');
    mkdirSync(other);
    sh(['init', '-q'], other);
    const copies = join(home, 'copies', 'demo');
    const kept = join(copies, 'kept');
    sh(['worktree', 'add', '-q', '-b', 'kept', kept], demo);
    process.chdir(demo);

    // ---- the synthetic cases: each a rule, in the smallest shape ----
    const rows1 = [
      { type: 'user', timestamp: T(0), cwd: demo, origin: { kind: 'human' }, message: { content: 'do it' } },
      { type: 'assistant', timestamp: T(2), attributionSkill: 'shady2k-skills:take-task', message: { id: 'm1', content: [{ type: 'tool_use', id: 'a', name: 'Grep', input: { pattern: 'x' } }] } },
      { type: 'user', timestamp: T(2, 30), message: { content: [{ type: 'tool_result', tool_use_id: 'a' }] } },
      { type: 'assistant', timestamp: T(6), message: { id: 'm2', content: [{ type: 'tool_use', id: 'b', name: 'Edit', input: { file_path: 'f' } }] } },
      { type: 'user', timestamp: T(6, 10), message: { content: [{ type: 'tool_result', tool_use_id: 'b' }] } },
      { type: 'assistant', timestamp: T(8), message: { id: 'm3', content: [{ type: 'tool_use', id: 'c', name: 'Bash', input: { command: 'npm test' } }] } },
      { type: 'user', timestamp: T(12), message: { content: [{ type: 'tool_result', tool_use_id: 'c' }] } },
      { type: 'assistant', timestamp: T(13), message: { id: 'm4', content: [{ type: 'tool_use', id: 'd', name: 'AskUserQuestion', input: {} }] } },
      { type: 'user', timestamp: T(16), message: { content: [{ type: 'tool_result', tool_use_id: 'd' }] } },
      { type: 'assistant', timestamp: T(16, 30), message: { id: 'm5', content: [{ type: 'text', text: 'ok' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(16, 30), durationMs: ms(16.5) },
      { type: 'user', timestamp: T(76), origin: { kind: 'human' }, message: { content: 'back' } },
      { type: 'assistant', timestamp: T(78), message: { id: 'm6', content: [{ type: 'text', text: 'done' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(78), durationMs: ms(2) },
      {
        type: 'cost-state', totalCostUSD: 12.5, totalAPIDuration: ms(6), totalToolDuration: ms(4),
        totalDuration: ms(78), totalLinesAdded: 40, totalLinesRemoved: 5, startTime: Date.parse(T(0)),
        modelUsage: { 'claude-opus-5': { inputTokens: 10, outputTokens: 900, thinkingTokens: 300, cacheReadInputTokens: 5000 } },
      },
    ];
    write(join(claudeDir(demo), 'aaaa.jsonl'), rows1);
    let s = findSessions('demo').find((x) => x.id === 'aaaa');
    expect('a session of the project is found by its repository', !!s && s.role === 'checkout');
    expect('the clock is the stamps: first record to last', s.wallMinutes === 78);
    expect('the harness\'s totals narrow what the stamps say', s.modelMinutes === 6 && s.exact.model === 'harness' && s.toolMinutes === 4);
    expect('a question put to the owner is his minutes, not the tool\'s', Math.round(s.answerMinutes) === 3 && s.phases.build.answer > 0);
    expect('an hour away is not the owner answering', Math.round(s.awayMinutes) === 60);
    expect('the buckets add up to the clock', adds(s) && s.conserves);
    expect('what the model did is named by what it went on to do', s.kinds.develop > 0 && s.kinds.analyze > 0 && s.kinds.test > 0);
    expect('cost and lines come from the harness', s.costUSD === 12.5 && s.linesAdded === 40 && s.tokens.output === 900);

    // A question that waits past the line is the owner away, like any gap;
    // and a harness tool total smaller than the question does not hold it.
    const longAsk = rows1.map((r) => (r.type === 'cost-state' ? { ...r, totalToolDuration: ms(1) } : r));
    longAsk[8] = { ...longAsk[8], timestamp: T(16) };
    const la = structuredClone(longAsk);
    la[8].timestamp = T(30);
    la[9].timestamp = T(30, 30);
    la[10] = { ...la[10], timestamp: T(30, 30), durationMs: ms(30.5) };
    write(join(claudeDir(demo), 'long.jsonl'), la);
    s = findSessions('demo').find((x) => x.id === 'long');
    expect('a question waiting past the line is the owner away', Math.round(s.awayMinutes) === 17 + 46 && Math.round(s.answerMinutes) === 0);
    expect('a tool total smaller than the question is not reduced by it', s.toolMinutes === 1);
    expect('and the buckets still add up', adds(s));

    // Nested turns: a short turn recorded inside a long one counts once.
    const nested = [
      { type: 'user', timestamp: T(0), cwd: demo, origin: { kind: 'human' }, message: { content: 'go' } },
      { type: 'assistant', timestamp: T(1), message: { id: 'n1', content: [{ type: 'text', text: 'x' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(3), durationMs: ms(1) },
      { type: 'system', subtype: 'turn_duration', timestamp: T(4), durationMs: ms(4) },
    ];
    write(join(claudeDir(demo), 'nest.jsonl'), nested);
    s = findSessions('demo').find((x) => x.id === 'nest');
    expect('nested turns are one stretch of the clock', s.wallMinutes === 4 && adds(s) && span(s.active) === ms(4));

    // A harness total larger than the stretches its stamps show is a total
    // of something else: it does not widen them.
    write(join(claudeDir(demo), 'wide.jsonl'), [
      { type: 'user', timestamp: T(500), cwd: demo, origin: { kind: 'human' }, message: { content: 'q' } },
      { type: 'assistant', timestamp: T(501), message: { id: 'v1', content: [{ type: 'text', text: 'a' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(501), durationMs: ms(1) },
      { type: 'cost-state', totalCostUSD: 1, totalAPIDuration: ms(10), totalToolDuration: 0, totalDuration: ms(1), totalLinesAdded: 0, totalLinesRemoved: 0, startTime: Date.parse(T(500)), modelUsage: {} },
    ]);
    s = findSessions('demo').find((x) => x.id === 'wide');
    expect('a harness total larger than its session\'s stamps is not used', s.modelMinutes === 1 && s.exact.model === 'stamps' && adds(s));

    // A working copy made inside the checkout, since removed, is the project's.
    const inner = join(demo, '.claude', 'worktrees', 'agent-1');
    write(join(claudeDir(inner), 'inner.jsonl'), [
      { type: 'user', timestamp: T(600), cwd: inner, origin: { kind: 'human' }, message: { content: 'x' } },
      { type: 'assistant', timestamp: T(601), message: { id: 'i1', content: [{ type: 'text', text: 'y' }] } },
    ]);
    expect('a removed working copy inside the checkout is the project\'s', findSessions('demo').some((x) => x.id === 'inner'));

    // Classification of what a shell command was for.
    const shell = (cmd) => category('Bash', { command: cmd });
    expect('a file written through the shell is development',
      shell("cat > notes.md <<'EOF'") === 'develop' && shell('sed -i s/a/b/ x.rs') === 'develop');
    expect('a file read through the shell is analysis',
      shell('sed -n 1,20p src/main.rs') === 'analyze' && shell('grep -rn foo .') === 'analyze' && shell('git log -3') === 'analyze');
    expect('the checks and the forge are told apart from each other and from git',
      shell('cargo test --all') === 'test' && shell('gh run watch 42') === 'ci' && shell('git commit -m x') === 'git');
    expect('a formatter writes, a commit is git even with a heredoc',
      shell('gofmt -w .') === 'develop' && shell("git commit -F - <<'EOF'") === 'git' && shell('npx prettier --write src') === 'develop');
    expect('a path named test is not a test run', shell('cat test/repo.mjs') === 'analyze');
    expect('a Codex program is named by what it calls',
      category('exec', 'await tools.exec_command({cmd: "npm test"})') === 'test'
      && category('exec', 'tools.apply_patch(`*** Begin Patch`)') === 'develop'
      && category('exec', 'const xs = rows.map((x) => x.name)') === 'shell');

    // Phases: from the evidence of the turn, both ways.
    const phased = [
      { type: 'user', timestamp: T(200), cwd: demo, origin: { kind: 'human' }, message: { content: 'plan it' } },
      { type: 'assistant', timestamp: T(202), attributionSkill: 'shady2k-skills:to-stages', message: { id: 'p1', content: [{ type: 'tool_use', id: 'p1', name: 'Read', input: {} }] } },
      { type: 'user', timestamp: T(202, 30), message: { content: [{ type: 'tool_result', tool_use_id: 'p1' }] } },
      { type: 'assistant', timestamp: T(205), attributionSkill: 'shady2k-skills:to-stages', message: { id: 'p2', content: [{ type: 'tool_use', id: 'p2', name: 'Bash', input: { command: 'npm test' } }] } },
      { type: 'user', timestamp: T(210), message: { content: [{ type: 'tool_result', tool_use_id: 'p2' }] } },
      { type: 'assistant', timestamp: T(212), attributionSkill: 'shady2k-skills:to-stages', message: { id: 'p3', content: [{ type: 'text', text: 'planned' }] } },
      { type: 'user', timestamp: T(215), origin: { kind: 'human' }, message: { content: 'now something else' } },
      { type: 'assistant', timestamp: T(216), message: { id: 'p4', content: [{ type: 'tool_use', id: 'p4', name: 'Read', input: {} }] } },
      { type: 'user', timestamp: T(217), message: { content: [{ type: 'tool_result', tool_use_id: 'p4' }] } },
      { type: 'assistant', timestamp: T(218), message: { id: 'p5', content: [{ type: 'tool_use', id: 'p5', name: 'Bash', input: { command: 'git commit -m x' } }] } },
      { type: 'user', timestamp: T(219), message: { content: [{ type: 'tool_result', tool_use_id: 'p5' }] } },
      { type: 'assistant', timestamp: T(220), message: { id: 'p6', content: [{ type: 'text', text: 'committed' }] } },
    ];
    write(join(claudeDir(demo), 'eeee.jsonl'), phased);
    const led = findSessions('demo').find((x) => x.id === 'eeee');
    expect('a planning skill keeps the turns it leads', led.phases.plan.kinds.analyze > 0);
    expect('running the tests is building, whatever skill led the turn', !led.phases.plan.kinds.test && led.phases.build.kinds.test > 0);
    expect('after the tests, the planning skill\'s turn is planning again', led.phases.plan.kinds.reply > 0);
    expect('a skill\'s phase does not outlive its turn', led.phases.unattributed.kinds.analyze > 0);
    expect('a commit is building, and what follows it without a skill is unattributed',
      led.phases.build.kinds.git > 0 && !led.phases.build.kinds.reply && led.phases.unattributed.kinds.reply > 0);

    // A second working copy with an opaque name, and an unrelated repository
    // whose name begins with the project's.
    write(join(claudeDir(copy), 'bbbb.jsonl'), [
      { type: 'user', timestamp: T(4), cwd: copy, origin: { kind: 'human' }, message: { content: 'brief' } },
      { type: 'assistant', timestamp: T(5), message: { id: 'w1', content: [{ type: 'tool_use', id: 'w', name: 'Write', input: {} }] } },
      { type: 'user', timestamp: T(5, 30), message: { content: [{ type: 'tool_result', tool_use_id: 'w' }] } },
      { type: 'assistant', timestamp: T(10), message: { id: 'w2', content: [{ type: 'text', text: 'done' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(10), durationMs: ms(6) },
      { type: 'cost-state', totalCostUSD: 3.5, totalAPIDuration: ms(4), totalToolDuration: ms(0.5), totalDuration: ms(6), totalLinesAdded: 600, totalLinesRemoved: 0, startTime: Date.parse(T(4)), modelUsage: {} },
    ]);
    write(join(claudeDir(other), 'cccc.jsonl'), [
      { type: 'user', timestamp: T(0), cwd: other, origin: { kind: 'human' }, message: { content: 'x' } },
      { type: 'assistant', timestamp: T(1), message: { id: 'o', content: [{ type: 'text', text: 'y' }] } },
    ]);
    // A copy that is gone: kept in a folder of this project's copies (which
    // a live copy there shows), and one gone with no trace of whose it was.
    const gone = join(copies, 'gone-1');
    write(join(claudeDir(gone), 'dddd.jsonl'), [
      { type: 'user', timestamp: T(30), cwd: gone, origin: { kind: 'human' }, message: { content: 'x' } },
      { type: 'assistant', timestamp: T(31), message: { id: 'g', content: [{ type: 'text', text: 'y' }] } },
    ]);
    const stray = join(home, 'elsewhere', 'demo-thing');
    write(join(claudeDir(stray), 'ffff.jsonl'), [
      { type: 'user', timestamp: T(30), cwd: stray, origin: { kind: 'human' }, message: { content: 'x' } },
    ]);
    let all = findSessions('demo');
    const ids = all.map((x) => x.id);
    expect('a working copy with an opaque name is the project\'s', ids.includes('bbbb') && all.find((x) => x.id === 'bbbb').role === 'side copy');
    expect('an unrelated repository named <project>-other is not', !ids.includes('cccc'));
    expect('a gone copy in a folder kept for this project\'s copies is the project\'s', ids.includes('dddd'));
    expect('a gone copy with no evidence is not counted, and is counted as unknown', !ids.includes('ffff') && all.unresolved === 1);

    // A subagent: its transcript sits under its parent's folder, its cost is
    // in the parent's record, and the parent's wait on it is coordination.
    const parent = [
      { type: 'user', timestamp: T(100), cwd: demo, sessionId: 'pppp', origin: { kind: 'human' }, message: { content: 'delegate' } },
      { type: 'assistant', timestamp: T(101), message: { id: 'q1', content: [{ type: 'tool_use', id: 'toolu_1', name: 'Agent', input: {} }] } },
      { type: 'user', timestamp: T(111), message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_1' }] } },
      { type: 'assistant', timestamp: T(112), message: { id: 'q2', content: [{ type: 'text', text: 'done' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(112), durationMs: ms(12) },
      { type: 'cost-state', totalCostUSD: 9, totalAPIDuration: ms(2), totalToolDuration: ms(10), totalDuration: ms(12), totalLinesAdded: 7, totalLinesRemoved: 1, startTime: Date.parse(T(100)), modelUsage: {} },
    ];
    write(join(claudeDir(demo), 'pppp.jsonl'), parent);
    write(join(claudeDir(demo), 'pppp', 'subagents', 'agent-x1.jsonl'), [
      { type: 'user', timestamp: T(101, 5), cwd: demo, sessionId: 'pppp', agentId: 'x1', isSidechain: true, message: { content: 'brief' } },
      { type: 'assistant', timestamp: T(103), isSidechain: true, message: { id: 'r1', content: [{ type: 'tool_use', id: 'r', name: 'Edit', input: {} }] } },
      { type: 'user', timestamp: T(104), isSidechain: true, message: { content: [{ type: 'tool_result', tool_use_id: 'r' }] } },
      { type: 'assistant', timestamp: T(110), isSidechain: true, message: { id: 'r2', content: [{ type: 'text', text: 'ok' }] } },
    ]);
    writeFileSync(join(claudeDir(demo), 'pppp', 'subagents', 'agent-x1.meta.json'), JSON.stringify({ toolUseId: 'toolu_1' }));
    all = findSessions('demo');
    const kid = all.find((x) => x.id === 'agent-x1');
    const dad = all.find((x) => x.id === 'pppp');
    expect('a subagent\'s transcript is found under its parent', !!kid && kid.role === 'subagent' && kid.parent === 'pppp');
    expect('the subagent is not the owner speaking', kid.ownerMessages === 0);
    expect('the parent\'s wait on its subagent is coordination, not tool time',
      Math.round(dad.coordinationMinutes) === 10 && dad.toolMinutes === 0 && kid.toolMinutes === 1);
    expect('the subagent\'s cost is its parent\'s, not unknown and not counted twice', kid.costIn === 'parent' && kid.costUSD === null);
    expect('a parent waiting on its subagent is not a second agent working',
      threads([dad, kid]).peak === 1);

    // A harness clock that runs past the transcript is not the clock.
    const late = [
      { type: 'user', timestamp: T(300), cwd: demo, origin: { kind: 'human' }, message: { content: 'q' } },
      { type: 'assistant', timestamp: T(305), message: { id: 'l1', content: [{ type: 'text', text: 'a' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(305), durationMs: ms(5) },
      { type: 'cost-state', totalCostUSD: 1, totalAPIDuration: ms(2), totalToolDuration: 0, totalDuration: ms(180), totalLinesAdded: 0, totalLinesRemoved: 0, startTime: Date.parse(T(300)), modelUsage: {} },
    ];
    write(join(claudeDir(demo), 'late.jsonl'), late);
    s = findSessions('demo').find((x) => x.id === 'late');
    expect('a harness clock that disagrees with the stamps is not used', s.wallMinutes === 5 && s.harnessClock === 'disagrees' && s.idleMinutes === 0);

    // A cost record followed by more work is not the session's total.
    write(join(claudeDir(demo), 'mid.jsonl'), [late[0], late[3], late[1], late[2]]);
    s = findSessions('demo').find((x) => x.id === 'mid');
    expect('a cost record written before the end is not the total', s.costUSD === null && s.exact.model === 'stamps');

    // Codex, the older shape: events.
    const codexOld = [
      { type: 'session_meta', timestamp: T(20), payload: { id: 'zzzz', cwd: copy, git: { repository_url: 'https://example.com/someone/demo' } } },
      { type: 'event_msg', timestamp: T(20), payload: { type: 'task_started' } },
      { type: 'event_msg', timestamp: T(20), payload: { type: 'user_message' } },
      { type: 'response_item', timestamp: T(21), payload: { type: 'custom_tool_call', call_id: 'k', name: 'exec', input: 'tools.exec_command({cmd: "cargo test"})' } },
      { type: 'response_item', timestamp: T(24), payload: { type: 'custom_tool_call_output', call_id: 'k' } },
      { type: 'event_msg', timestamp: T(25), payload: { type: 'agent_message' } },
      { type: 'event_msg', timestamp: T(25), payload: { type: 'task_complete' } },
      { type: 'event_msg', timestamp: T(25), payload: { type: 'token_count', info: { total_token_usage: { output_tokens: 700 } } } },
    ];
    write(join(home, 'codex', 'sessions', '2026', '01', '01', 'rollout-2026-01-01T10-20-00-zzzz.jsonl'), codexOld);
    s = findSessions('demo').find((x) => x.id === 'zzzz');
    expect('a Codex session of the older shape is read', !!s && s.schema === 'codex-events' && s.ownerMessages === 1 && Math.round(s.toolMinutes) === 3);
    expect('Codex keeps no cost and no lines: unknown, not zero', s.costUSD === null && s.linesAdded === null && s.tokens.output === 700);
    expect('a Codex minute with no evidence of a phase is unattributed... but a test run is building',
      s.phases.build.kinds.test > 0 && !s.phases.unattributed?.kinds.test);

    // Codex, the current shape: a skill read names the turn's phase, and a
    // call that waited for the owner's approval is his wait, not the tool's.
    const codexNew = [
      { type: 'session_meta', timestamp: T(400), payload: { id: 'yyyy', cwd: demo } },
      { type: 'event_msg', timestamp: T(400), payload: { type: 'task_started' } },
      { type: 'turn_context', timestamp: T(400), payload: { model: 'gpt-6.1-sol' } },
      { type: 'response_item', timestamp: T(400), payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '# AGENTS.md instructions for /w' }] } },
      { type: 'response_item', timestamp: T(400), payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'spec it' }] } },
      { type: 'event_msg', timestamp: T(400), payload: { type: 'item_completed', item: { type: 'UserMessage' } } },
      { type: 'response_item', timestamp: T(401), payload: { type: 'reasoning' } },
      { type: 'response_item', timestamp: T(402), payload: { type: 'custom_tool_call', call_id: 's', name: 'exec', input: 'tools.exec_command({cmd: "sed -n 1,80p skills/to-spec/SKILL.md"})' } },
      { type: 'response_item', timestamp: T(403), payload: { type: 'custom_tool_call_output', call_id: 's', output: 'Wall time 0.1 seconds' } },
      { type: 'response_item', timestamp: T(404), payload: { type: 'custom_tool_call', call_id: 'e', name: 'exec', input: 'tools.exec_command({cmd: "git push", sandbox_permissions: "require_escalated"})' } },
      { type: 'response_item', timestamp: T(434), payload: { type: 'custom_tool_call_output', call_id: 'e', output: 'Wall time 60 seconds' } },
      { type: 'response_item', timestamp: T(435), payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'x' }] } },
      { type: 'event_msg', timestamp: T(435), payload: { type: 'task_complete' } },
    ];
    write(join(home, 'codex', 'sessions', '2026', '01', '01', 'rollout-2026-01-01T16-40-00-yyyy.jsonl'), codexNew);
    s = findSessions('demo').find((x) => x.id === 'yyyy');
    expect('the current Codex shape: one owner message, the injected context is not his', s.schema === 'codex-items' && s.ownerMessages === 1);
    expect('a Codex turn names its model, and its minutes go to the name',
      !(MODELS_UNNAMED in s.models) && s.models['gpt-6.1-sol'] > 0
      && Math.abs(Object.values(s.models).reduce((a, b) => a + b, 0) - s.modelMinutes) < 0.02);
    expect('a Codex turn that read a skill of the set is that skill\'s phase', s.phases.plan?.kinds.analyze > 0);
    expect('a call waiting for the owner\'s approval is his wait, the rest the tool\'s',
      Math.round(s.awayMinutes) === 29 && Math.round(s.phases.build.tool) === 1 && adds(s));

    // A spawned Codex session has no owner messages to end a turn: its tasks
    // do. A skill read in the first task names nothing in the second.
    const call = (at, id, cmd) => [
      { type: 'response_item', timestamp: T(at), payload: { type: 'custom_tool_call', call_id: id, name: 'exec', input: `tools.exec_command({cmd: "${cmd}"})` } },
      { type: 'response_item', timestamp: T(at + 1), payload: { type: 'custom_tool_call_output', call_id: id, output: '' } },
    ];
    write(join(home, 'codex', 'sessions', '2026', '01', '01', 'rollout-2026-01-01T17-40-00-xxxx.jsonl'), [
      { type: 'session_meta', timestamp: T(700), payload: { id: 'xxxx', cwd: demo, source: { subagent: { thread_spawn: { parent_thread_id: 'yyyy' } } } } },
      { type: 'event_msg', timestamp: T(700), payload: { type: 'task_started' } },
      ...call(701, 'c1', 'sed -n 1,80p skills/to-spec/SKILL.md'),
      { type: 'event_msg', timestamp: T(703), payload: { type: 'task_complete' } },
      { type: 'event_msg', timestamp: T(710), payload: { type: 'task_started' } },
      ...call(711, 'c2', 'grep -n x notes.txt'),
      { type: 'event_msg', timestamp: T(713), payload: { type: 'task_complete' } },
    ]);
    s = findSessions('demo').find((x) => x.id === 'xxxx');
    expect('a Codex task\'s phase does not outlive the task', s.role === 'subagent'
      && Math.round(s.phases.plan?.kinds.analyze * 60) === 120 && Math.round(s.phases.unattributed?.kinds.analyze * 60) === 120);

    // An omp session: each model call carries its own start and end, each
    // tool its start and result; its cost is its own. A subagent in its
    // folder is its parent's, and speaks for nobody.
    const at = (min, sec = 0) => Date.parse(T(min, sec));
    const ompCall = (id, name, args, start, end) => ({ type: 'message', timestamp: T(end), message: { role: 'assistant', timestamp: at(start), completedAt: at(end),
      stopReason: name ? 'toolUse' : 'stop', usage: { input: 100, output: 10, reasoningTokens: 5, cacheRead: 0, cost: { total: 0.25 } },
      content: name ? [{ type: 'toolCall', id, name, arguments: args }] : [{ type: 'text', text: 'done' }] } });
    const ompResult = (id, name, start, end) => [
      { type: 'custom', customType: 'tool_execution_start', timestamp: T(start), data: { toolCallId: id, toolName: name, startedAt: T(start) } },
      { type: 'message', timestamp: T(end), message: { role: 'toolResult', toolCallId: id, toolName: name, timestamp: at(end), content: [] } },
    ];
    const ompDir = join(home, 'omp', 'sessions', '-w-demo');
    write(join(ompDir, '2026-01-01T13-20-00-000Z_omp1.jsonl'), [
      { type: 'session', id: 'omp1', timestamp: T(200), cwd: demo },
      { type: 'message', timestamp: T(200), message: { role: 'user', timestamp: at(200), content: [{ type: 'text', text: 'fix it' }] } },
      ompCall('r', 'read', { path: 'skills/diagnose-bug/SKILL.md' }, 200, 202),
      ...ompResult('r', 'read', 202, 203),
      ompCall('b', 'bash', { command: 'npm test' }, 203, 205),
      // The tool started a minute after the model asked for it: that minute
      // is not the tool's.
      ...ompResult('b', 'bash', 206, 215),
      ompCall(null, null, null, 215, 216),
      { type: 'custom_message', customType: 'advisor', timestamp: T(216), content: 'not the owner' },
    ]);
    write(join(ompDir, '2026-01-01T13-20-00-000Z_omp1', 'sub.jsonl'), [
      { type: 'session', id: 'omp1sub', timestamp: T(201), cwd: demo },
      { type: 'message', timestamp: T(201), message: { role: 'user', timestamp: at(201), content: [{ type: 'text', text: 'scout' }] } },
      ompCall(null, null, null, 201, 202),
    ]);
    s = findSessions('demo').find((x) => x.id === 'omp1');
    expect('an omp session: its clock, the owner once, model and tools from their own stamps', s && s.harness === 'omp' && s.ownerMessages === 1
      && Math.round(s.modelMinutes) === 5 && Math.round(s.toolMinutes) === 10 && adds(s));
    expect('an omp session: a skill read names the phase, and its cost is its own', s.phases.debug?.model > 0 && s.costUSD === 0.75 && s.costIn === 'own');
    const sub = findSessions('demo').find((x) => x.id === 'omp1sub');
    expect('an omp subagent is its parent\'s, and speaks for nobody', sub && sub.role === 'subagent' && sub.parent === 'omp1' && sub.ownerMessages === 0);

    // pi writes the same shape without omp's ends and starts: a model call
    // ends where its record is written, a tool starts where the model asked.
    const piCall = (id, name, args, start, end) => ({ type: 'message', timestamp: T(end), message: { role: 'assistant', timestamp: at(start),
      stopReason: name ? 'toolUse' : 'stop', usage: { input: 100, output: 10, reasoning: 5, cacheRead: 0, cost: { total: 0.25 } },
      content: name ? [{ type: 'toolCall', id, name, arguments: args }] : [{ type: 'text', text: 'done' }] } });
    const piResult = (id, name, end) => ({ type: 'message', timestamp: T(end), message: { role: 'toolResult', toolCallId: id, toolName: name, timestamp: at(end), content: [] } });
    write(join(home, '.pi', 'agent', 'sessions', '--w-demo--', '2026-01-01T13-50-00-000Z_pi1.jsonl'), [
      { type: 'session', version: 3, id: 'pi1', timestamp: T(230), cwd: demo },
      { type: 'message', timestamp: T(230), message: { role: 'user', timestamp: at(230), content: [{ type: 'text', text: 'fix it' }] } },
      piCall('e', 'edit', { path: 'a.txt' }, 230, 232),
      piResult('e', 'edit', 233),
      piCall('f', 'find', { pattern: '*.txt' }, 233, 234),
      piResult('f', 'find', 236),
      piCall('q', 'ask_user_question', { question: 'which?' }, 236, 237),
      piResult('q', 'ask_user_question', 240),
      piCall(null, null, null, 240, 241),
      { type: 'custom_message', customType: 'note', timestamp: T(242), content: 'not the owner' },
    ]);
    s = findSessions('demo').find((x) => x.id === 'pi1');
    expect('a pi session: its clock, the owner once, model, tools and its question from its stamps', s && s.harness === 'pi' && s.ownerMessages === 1
      && Math.round(s.modelMinutes) === 5 && Math.round(s.toolMinutes) === 3 && Math.round(s.answerMinutes) === 3 && adds(s));
    expect('a pi session: its tools read by name, its cost and thinking its own', s.kinds.develop > 0 && s.kinds.analyze > 0
      && s.costUSD === 1 && s.costIn === 'own' && s.tokens.thinking === 20);

    // prime-agent: one folder, no subfolders; every tool a Python cell, read
    // by what it runs; a subagent keeps no transcript, its parent its cost.
    const cell = (id, code, start, end) => piCall(id, 'ipython', { code }, start, end);
    write(join(home, '.prime', 'agent', 'sessions', 'pr1.jsonl'), [
      { type: 'session', version: 3, id: 'pr1', timestamp: T(260), cwd: join(home, 'gone-prime'), rlmDepth: 0, git: { repoUrl: 'https://example.com/someone/demo.git' } },
      { type: 'message', timestamp: T(260), message: { role: 'user', timestamp: at(260), content: [{ type: 'text', text: 'test it' }] } },
      cell('t', "h = await bash('npm test')\nprint(h.output)", 260, 261),
      piResult('t', 'ipython', 264),
      cell('w', "open('a.txt', 'w').write(x)", 264, 265),
      piResult('w', 'ipython', 266),
      cell('s', "h = await rlm.spawn(task, name='scout')", 266, 267),
      piResult('s', 'ipython', 268),
      { type: 'child_usage_attributed', timestamp: T(268), childUsage: { input: 50, output: 5, cacheRead: 0, cost: { total: 0.5 } } },
      { type: 'custom_message', customType: 'agent_message', timestamp: T(269), content: 'from the scout' },
      cell('r', "print(open('a.txt').read())", 269, 270),
      piResult('r', 'ipython', 271),
      piCall(null, null, null, 271, 272),
    ]);
    s = findSessions('demo').find((x) => x.id === 'pr1');
    expect('a prime-agent session in its flat folder is found, its gone copy placed by the repository it recorded',
      s && s.harness === 'prime-agent' && s.by === 'recorded repository' && s.ownerMessages === 1 && adds(s));
    expect('a prime-agent cell is read by what it runs: the tests, a write, a subagent, a read',
      s.kinds.test > 0 && s.kinds.develop > 0 && s.kinds.delegate > 0 && s.kinds.analyze > 0 && !s.kinds.shell);
    expect('a prime-agent session\'s cost holds its subagents\'', s.costUSD === 1.75 && s.tokens.input === 550);
    expect('a prime-agent session is found by its id alone', adapter('prime-agent').transcripts('pr1').length === 1
      && adapter('pi').transcripts('pi1').length === 1);

    // A prime-agent subagent's transcript is among its parent's artifacts,
    // its own subagents' one folder deeper, beside files that are not
    // transcripts; the parent already holds their cost.
    const artifacts = join(home, '.prime', 'agent', 'session-artifacts', 'pr1');
    const primeKid = (id, dir, up, start) => write(join(artifacts, ...dir, `${id}.jsonl`), [
      { type: 'session', version: 3, id, timestamp: T(start), cwd: join(home, 'gone-prime'), parentSession: up, rlmDepth: dir.length, git: { repoUrl: 'https://example.com/someone/demo.git' } },
      { type: 'message', timestamp: T(start), message: { role: 'user', timestamp: at(start), content: [{ type: 'text', text: 'scout it' }] } },
      piCall('k', 'ipython', { code: "print(open('a.txt').read())" }, start, start + 1),
      piResult('k', 'ipython', start + 2),
    ]);
    primeKid('pr2', ['sub-scout'], join(home, '.prime', 'agent', 'sessions', 'pr1.jsonl'), 266);
    primeKid('pr3', ['sub-scout', 'sub-deep'], join(artifacts, 'sub-scout', 'pr2.jsonl'), 267);
    write(join(artifacts, 'sub-scout', 'semantic-edges.jsonl'), [{ from: 'a', to: 'b', timestamp: T(266) }]);
    const primeAll = findSessions('demo');
    const scout = primeAll.find((x) => x.id === 'pr2');
    const deep = primeAll.find((x) => x.id === 'pr3');
    expect('a prime-agent subagent is found among its parent\'s artifacts, and speaks for nobody',
      scout && scout.harness === 'prime-agent' && scout.role === 'subagent' && scout.parent === 'pr1' && scout.ownerMessages === 0 && adds(scout));
    expect('and its own subagent one folder deeper, under it', deep && deep.parent === 'pr2' && adds(deep));
    expect('a prime-agent subagent\'s cost is its parent\'s, not counted twice',
      scout.costIn === 'parent' && scout.costUSD === null && scout.tokens === null && primeAll.find((x) => x.id === 'pr1').costUSD === 1.75);
    expect('a prime-agent subagent is found by its id alone, and an artifact that is no transcript is no session',
      adapter('prime-agent').transcripts('pr2').length === 1 && adapter('prime-agent').transcripts('pr3').length === 1
      && !primeAll.some((x) => x.path.endsWith('semantic-edges.jsonl')));

    // omp kept pi's variables: a folder they name is pi's only when pi runs this.
    process.env.PI_SESSION_ID = 'pi-here';
    expect('the shared variable names pi\'s folder inside pi, and omp is then in its own home',
      piSessions() === join(home, 'omp', 'sessions') && ompSessions() === join(home, '.omp', 'agent', 'sessions'));
    delete process.env.PI_SESSION_ID;
    expect('and omp\'s outside it', ompSessions() === join(home, 'omp', 'sessions') && piSessions() === join(home, '.pi', 'agent', 'sessions'));

    // Unknown figures are left out of the totals and counted.
    const l = ledger('demo');
    expect('the ledger says how many sessions carry no cost', l.costUnknown >= 1 && l.linesUnknown >= 1);
    expect('every session in the ledger adds up to its clock', l.conserves);

    // A period clips the sessions that cross it.
    const clipped = findSessions('demo', { since: Date.parse(T(50)), until: Date.parse(T(77)) }).find((x) => x.id === 'aaaa');
    expect('a period counts only what falls inside it', Math.abs(clipped.wallMinutes - 27) < 1e-9 && adds(clipped) && !clipped.whole);
    expect('and none of the cost of a session it cuts', clipped.costUSD === null);
    expect('a date alone is a local day', parseWhen('2026-01-02') === new Date(2026, 0, 2).getTime()
      && parseWhen('2026-01-02', { end: true }) === new Date(2026, 0, 3).getTime());
    expect('dates are said in local time with the offset', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [+-]\d{2}:\d{2}$/.test(localStamp(Date.now())));

    expect('where answering stops and being away begins can be moved',
      JSON.parse(run(['sessions', '--project', 'demo', '--answer-minutes', '1', '--json'])).find((x) => x.id === 'aaaa').answerMinutes === 0);


    // Statistics (skills-oeh): a day by the hour; the heat of the days. Two
    // overlapping sessions, an idle gap, an hour the owner answered, a week
    // with a second day; plain text without a terminal, and 80 columns.
    const statDayLocal = localStamp(Date.parse(T(0)), { time: false });
    const stat = JSON.parse(run(['stats', '--project', 'demo', '--day', statDayLocal, '--json']));
    expect('the day view shows every hour of the day', stat.hours.length === 24
      && stat.hours.every((r) => Object.keys(r.groups).length === 8));
    const hourOf = (t2) => new Date(T(t2)).getHours();
    expect('the hour the owner was asked into has him answering', stat.hours[hourOf(14)].groups.answer > 0);
    expect('the gaps no work filled are waiting/idle in their hour',
      stat.hours.reduce((a, r) => a + r.groups.wait, 0) > 0);
    expect('the kinds of the hour bar make up the whole', Math.abs(Object.values(stat.activity)
      .map((x) => Number(x) || 0).reduce((a, b) => a + b, 0) - 100) < 0.2);
    // Overlap: a second session working while the first still is.
    write(join(claudeDir(demo), 'over1.jsonl'), [
      { type: 'user', timestamp: T(600), cwd: demo, origin: { kind: 'human' }, message: { content: 'go' } },
      { type: 'assistant', timestamp: T(603), message: { id: 'o1', content: [{ type: 'tool_use', id: 'oa', name: 'Read', input: {} }] } },
      { type: 'user', timestamp: T(613), message: { content: [{ type: 'tool_result', tool_use_id: 'oa' }] } },
    ]);
    write(join(claudeDir(demo), 'over2.jsonl'), [
      { type: 'user', timestamp: T(604), cwd: demo, origin: { kind: 'human' }, message: { content: 'go too' } },
      { type: 'assistant', timestamp: T(607), message: { id: 'ob1', content: [{ type: 'tool_use', id: 'ob', name: 'Read', input: {} }] } },
      { type: 'user', timestamp: T(615), message: { content: [{ type: 'tool_result', tool_use_id: 'ob' }] } },
    ]);
    const overDay = JSON.parse(run(['stats', '--project', 'demo', '--day', statDayLocal, '--json']));
    expect('two sessions in one hour show as two working at once', Math.max(...overDay.hours.map((r) => r.peak)) >= 2);
    // A week: the heat holds a second day, and the longest real stretch.
    write(join(claudeDir(demo), 'next-day.jsonl'), [
      { type: 'user', timestamp: T(1500), cwd: demo, origin: { kind: 'human' }, message: { content: 'later' } },
      { type: 'assistant', timestamp: T(1502), message: { id: 'd1', content: [{ type: 'text', text: 'done' }] } },
    ]);
    const week = JSON.parse(run(['stats', '--project', 'demo', '--all', '--json']));
    expect('the heat shows the days a session worked, day by day',
      week.days.some((d) => d.agentMillis > 0)
      && new Set(week.days.filter((d) => d.agentMillis > 0).map((d) => d.day)).size >= 2);
    expect('the longest stretch of work is work, not an open window', week.longest.hours > 0);
    expect('the busiest day carries the most occupied', week.busiest.day
      && week.busiest.agentMillis >= Math.max(...week.days.map((d) => d.agentMillis)));
    // The drawing: plain where asked and where no terminal answers; the
    // 80 and the 100 both hold; colour where the terminal takes it.
    expect('plain text where asked and where no terminal answers',
      !run(['stats', '--project', 'demo', '--no-color', '--day', statDayLocal]).includes('\x1b'));


    const at80 = describeStats(week, { width: 80 }).split('\n');
    const at100 = describeStats(week, { width: 100 }).split('\n');
    const strip = (l) => l.replace(/\x1b\[[0-9;]*m/g, '');
    const statDayText = localStamp(Date.parse(T(0)), { time: false });
    const statDay = () => JSON.parse(run(['stats', '--project', 'demo', '--day', statDayText, '--json']));
    const vis = (view, W, color) => describeStats(view, { color, width: W }).split('\n')
      .map(strip).map((s) => s.replace(/[ \t]+$/, ''));
    const widths = new Set([80, 100]);
    const fitsAll = [...widths].every((W) => [true, false].every((color) =>
      [statDay(), week, JSON.parse(run(['stats', '--project', 'demo', '--all', '--json']))]
        .every((view) => vis(view, W, color).every((l) => l.length <= W))));
    expect('every row of the busy hours fits 100 columns and degrades to 80, colour and not', fitsAll);
    const dayRows = vis(statDay(), 80, true).filter((l) => /^\d\d {2}/.test(l));
    const filledOf = new Map(dayRows.map((l) => [l.slice(0, 2), (l.match(/[█▓▒░▐▆▄▀]/g) || []).length]));
    const hourData = statDay().hours.filter((r) => STATS_GROUPS.some((g) => r.groups[g] > 0));
    const filledIn = (r) => STATS_GROUPS.reduce((n, g) => n + r.groups[g], 0);
    const fullest = hourData.reduce((a, r) => (filledIn(r) > filledIn(a) ? r : a), hourData[0]);
    const quietest = hourData.reduce((a, r) => (filledIn(r) < filledIn(a) ? r : a), hourData[0]);
    expect('the busiest hour is the full bar, a quieter hour a shorter one',
      hourData.length >= 2 && filledOf.get(fullest.hour.slice(0, 2)) > filledOf.get(quietest.hour.slice(0, 2)));
    expect('plain mode keeps the kinds in the bar', vis(statDay(), 80, false).some((l) => l.includes('▓') && l.includes('│') === false)
      && vis(statDay(), 80, false).some((l) => l.includes('░')));
    expect('the two splits are told apart and both shown',
      statDayText && (() => { const s = run(['stats', '--project', 'demo', '--no-color']);
        return s.includes('by activity') && s.includes('of the work, without waiting')
          && !s.includes('by kind'); })());
    expect('a week carries its heat cell on each worked day', /[░▒▓█]/.test(describeStats(
      statsStretch('demo', findSessions('demo'), parseWhen('2026-01-01'), parseWhen('2026-01-08'), 'week'), { width: 80 })));
    expect('colour where the terminal takes it, none where it does not',
      describeStats(JSON.parse(run(['stats', '--project', 'demo', '--day', statDayLocal, '--json'])),
        { color: true, width: 80 }).includes('38;5;114m'));
    // The models: where the record names them, the minutes go to the name.
    write(join(claudeDir(demo), 'modl.jsonl'), [
      { type: 'user', timestamp: T(900), cwd: demo, origin: { kind: 'human' }, message: { content: 'go' } },
      { type: 'assistant', timestamp: T(901), message: { id: 'mm1', model: 'claude-opus-5', content: [{ type: 'text', text: 'done' }] } },
    ]);
    expect('a model name rides where the record gives it, and the minutes go with it',
      (() => { const mm = findSessions('demo').find((x) => x.id === 'modl');
        return mm.models['claude-opus-5'] === 1 && !(MODELS_UNNAMED in mm.models); })());
    expect('every session lays piecewise on its clock', findSessions('demo').every((sx) =>
      Math.abs(sx.segments.reduce((a, g) => a + g.ms, 0) - sx.wallMinutes * 60e3) < 60e3));

    const misuse = (a) => { try { run(a); return false; } catch (e) { return e instanceof Usage; } };
    expect('misuse: unknown command', misuse(['frobnicate', '--project', 'demo']));
    expect('misuse: a date that is not one', misuse(['time', '--project', 'demo', '--since', 'soon']));
    expect('misuse: a flag with no value', misuse(['time', '--project', 'demo', '--since']));
    expect('misuse: a threshold that is not minutes', misuse(['time', '--project', 'demo', '--answer-minutes', 'soon']));
    expect('misuse: a repository that is not one', misuse(['time', '--project', 'demo', '--repo', home]));
    expect('misuse: a project name and a checkout of another project', misuse(['time', '--project', 'demo', '--repo', other]));
    process.chdir(home);
    expect('--repo alone names the project after that checkout',
      JSON.parse(run(['time', '--repo', demo, '--json'])).project === 'demo'
      && JSON.parse(run(['time', '--repo', other, '--json'])).sessions === 1);
    process.chdir(demo);
    expect('the text names the buckets and says they add up',
      ['the model generating', 'tools running', 'the owner answering', 'the owner away', 'nobody', 'add up to the clock']
        .every((x) => run(['time', '--project', 'demo']).includes(x)));

    // ---- the real shapes: records copied from both harnesses, stripped to
    // their structure and stamps, and retargeted at this repository ----
    const FIX = recordedShapes(expect);
    if (FIX) {
      // What a fixture keeps is shape and stamps. Addresses, remotes, paths,
      // ids that look like hashes: the set's own privacy scanner must pass
      // every file. Costs, tokens and line counts: small synthetic values.
      const scanner = join(FIX, '..', '..', '..', '..', 'productivity', 'report-to-shady2k', 'scan.mjs');
      for (const f of readdirSync(FIX)) {
        let findings = 'the scanner is missing';
        if (existsSync(scanner)) {
          try {
            execFileSync(process.execPath, [scanner, '--draft', join(FIX, f), '--allow', 'shady2k-skills'], { cwd: FIX, stdio: 'pipe', encoding: 'utf8' });
            findings = '';
          } catch (e) { findings = String(e.stdout || e.message).trim(); }
        }
        const figures = [];
        const walk = (v, key = '') => {
          if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) walk(x, k); return; }
          if (typeof v !== 'number' || !/cost|token|lines/i.test(key)) return;
          const synthetic = /cost/i.test(key) ? v < 10 && Math.round(v * 100) === v * 100 : Number.isInteger(v) && v <= 5000 && (v < 10 || v % 10 === 0);
          if (!synthetic) figures.push(`${key}=${v}`);
        };
        if (f.endsWith('.jsonl') || f.endsWith('.json'))
          for (const line of readFileSync(join(FIX, f), 'utf8').split('\n').filter(Boolean)) walk(JSON.parse(line));
        expect(`recorded: ${f} keeps shape and stamps only${findings || figures.length ? ` (${findings} ${figures.slice(0, 3).join(' ')})` : ''}`,
          !findings && !figures.length);
      }

      const load = (name, cwd) => readFileSync(join(FIX, name), 'utf8').split('\n').filter(Boolean)
        .map((line) => JSON.parse(line.replaceAll('/fixture/cwd', cwd)));
      const fresh = () => { for (const d of ['claude', 'codex', 'omp', '.pi', '.prime']) rmSync(join(home, d), { recursive: true, force: true }); };
      fresh();

      // Codex, the current shape: owner and agent speak through items and
      // role messages, and the first user message is injected context.
      write(join(home, 'codex', 'sessions', '2026', '09', '23', 'rollout-2026-09-23T19-21-01-current.jsonl'), load('codex-current.jsonl', kept));
      s = findSessions('demo').find((x) => x.harness === 'codex');
      expect('recorded: the current Codex shape is read, its owner message counted once',
        !!s && s.schema === 'codex-items' && s.ownerMessages === 1 && s.modelMinutes > 0 && s.toolMinutes > 0);
      expect('recorded: its cost and lines are unknown, its tokens counted', s.costUSD === null && s.linesAdded === null && s.tokens.output > 0);
      expect('recorded: a Codex session adds up to its clock', adds(s));
      expect('recorded: Codex minutes with no evidence are unattributed, and only making is building',
        s.phases.unattributed?.model > 0 && Object.keys(s.phases.build?.kinds || {}).every((k) => MAKING.has(k)));
      // Its working copy is gone: the repository it recorded says whose it was.
      fresh();
      write(join(home, 'codex', 'sessions', '2026', '09', '23', 'rollout-2026-09-23T19-21-01-current.jsonl'),
        load('codex-current.jsonl', join(home, 'nowhere', 'review')));
      expect('recorded: a gone Codex copy belongs by the repository it recorded', findSessions('demo').length === 1);

      // Claude: nested turns and a coordinator with subagents, no cost record.
      fresh();
      write(join(claudeDir(demo), 'coord.jsonl'), load('claude-nested.jsonl', demo));
      for (const f of readdirSync(FIX).filter((n) => n.startsWith('claude-subagent-')))
        if (f.endsWith('.jsonl')) write(join(claudeDir(demo), 'coord', 'subagents', f.replace('claude-subagent-', '')), load(f, demo));
        else writeFileSync(join(claudeDir(demo), 'coord', 'subagents', f.replace('claude-subagent-', '')), readFileSync(join(FIX, f)));
      all = findSessions('demo');
      const coord = all.find((x) => x.id === 'coord');
      const subs = all.filter((x) => x.role === 'subagent');
      const recordedTurns = readFileSync(join(FIX, 'claude-nested.jsonl'), 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x))
        .filter((x) => x.subtype === 'turn_duration').map((x) => ({ start: Date.parse(x.timestamp) - x.durationMs, end: Date.parse(x.timestamp) }));
      expect('recorded: the coordinator\'s turns do nest', span(recordedTurns) > span(union(recordedTurns)) + ms(5));
      expect('recorded: nested turns count once, on the clock and at once', adds(coord) && threads([coord]).peak === 1);
      expect('recorded: subagents are found under the session that started them', subs.length >= 2 && subs.every((x) => x.parent === 'coord' && adds(x)));
      expect('recorded: a session with no cost record has unknown cost', coord.costUSD === null && coord.costIn === 'unknown');
      expect('recorded: the subagents\' cost is unknown with their parent\'s', subs.every((x) => x.costIn === 'unknown'));

      // Claude: a question that waited nearly fourteen minutes, and a tool
      // total that cannot hold it.
      fresh();
      write(join(claudeDir(demo), 'asked.jsonl'), load('claude-question.jsonl', demo));
      s = findSessions('demo')[0];
      // The question was put at 12:48:19.875 and answered at 13:02:13.194.
      const around = { since: Date.parse('2026-09-18T12:48:10Z'), until: Date.parse('2026-09-18T13:02:20Z') };
      const q10 = findSessions('demo', around)[0];
      const q14 = findSessions('demo', { ...around, answerMinutes: 14 })[0];
      expect('recorded: a question waiting past the line is the owner away, by the same line as any gap',
        Math.abs(q10.awayMinutes - 13.88865) < 0.001 && q10.answerMinutes === 0
        && Math.abs(q14.answerMinutes - 13.88865) < 0.001 && q14.awayMinutes === 0 && adds(q10) && adds(s));
      expect('recorded: the tool total is kept whole when it cannot hold the question', s.exact.tool === 'harness' && s.toolMinutes > 1.2 && s.toolMinutes < 1.3);

      // Claude: a cost record whose clock ran three hours past the last line.
      fresh();
      write(join(claudeDir(demo), 'long-open.jsonl'), load('claude-clock.jsonl', demo));
      s = findSessions('demo')[0];
      expect('recorded: a harness clock thirty-six times the stamps is not the clock',
        s.harnessClock === 'disagrees' && s.wallMinutes < 6 && s.costUSD > 0 && adds(s));

      // An opaque working copy, and an unrelated repository of a similar name.
      fresh();
      write(join(claudeDir(copy), 'opaque.jsonl'), load('claude-worker.jsonl', copy));
      write(join(claudeDir(other), 'unrelated.jsonl'), load('claude-worker.jsonl', other));
      all = findSessions('demo');
      expect('recorded: the opaque working copy is counted and the unrelated repository is not',
        all.length === 1 && all[0].id === 'opaque' && adds(all[0]));

      // ---- the adapters: one per harness, and what each cannot do ---------
      fresh();
      // Two sessions that each started a subagent of the same short id: the
      // parent is part of where the child is, so the two stay apart.
      for (const session of ['pp1', 'pp2']) {
        write(join(claudeDir(demo), `${session}.jsonl`), [{ type: 'user', sessionId: session, timestamp: T(0), cwd: demo, message: { content: 'go' } }]);
        write(join(claudeDir(demo), session, 'subagents', 'agent-x1.jsonl'),
          [{ type: 'user', sessionId: session, agentId: 'x1', isSidechain: true, timestamp: T(0), cwd: demo, message: { content: 'work' } }]);
        writeFileSync(join(claudeDir(demo), session, 'subagents', 'agent-x1.meta.json'), JSON.stringify({ toolUseId: 'toolu_1' }));
      }
      write(join(home, 'codex', 'sessions', '2026', '01', '01', 'rollout-2026-01-01T18-00-00-cc1.jsonl'), [
        { type: 'session_meta', timestamp: T(0), payload: { id: 'cc1', cwd: demo, source: { subagent: { thread_spawn: { parent_thread_id: 'par1' } } } } },
        { type: 'response_item', timestamp: T(1), payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'x' }] } },
      ]);
      write(join(home, 'omp', 'sessions', '-w-demo', '2026-01-01T13-20-00-000Z_oo1.jsonl'), [{ type: 'session', id: 'oo1', timestamp: T(0), cwd: demo }]);
      write(join(home, 'omp', 'sessions', '-w-demo', '2026-01-01T13-20-00-000Z_oo1', 'sub.jsonl'), [{ type: 'session', id: 'oo1sub', timestamp: T(0), cwd: demo }]);
      const art = join(home, '.prime', 'agent', 'session-artifacts', 'zz1');
      write(join(art, 'sub-a', 'zz2.jsonl'), [{ type: 'session', id: 'zz2', timestamp: T(0), cwd: demo, parentSession: join(home, '.prime', 'agent', 'sessions', 'zz1.jsonl') }]);
      write(join(art, 'sub-a', 'sub-b', 'zz3.jsonl'), [{ type: 'session', id: 'zz3', timestamp: T(0), cwd: demo, parentSession: join(art, 'sub-a', 'zz2.jsonl') }]);

      expect('the adapters: this copy reads five harnesses and no other',
        adapterNames().join(',') === 'claude-code,codex,omp,pi,prime-agent' && adapterNames().every(hasAdapter) && !hasAdapter('gemini'));
      expect('the adapters: every entry answers the same questions, and says what it cannot do',
        Object.values(ADAPTERS).every((a) => typeof a.name === 'string' && Array.isArray(a.env) && typeof a.current === 'function'
          && ['sessions', 'transcripts', 'subagents', 'read', 'location'].every((k) => typeof a[k] === 'function')
          && (a.subagentList === null || typeof a.subagentList === 'string') && (a.limits === null || typeof a.limits === 'string')));
      expect('the adapters: what is known of the agent follows from whether the harness names it',
        Object.values(ADAPTERS).every((a) => identityOf(a) === (a.agentEnv ? 'agent' : 'session'))
        && identityOf({ agentEnv: 'SOME_AGENT_ID' }) === 'agent' && identityOf(ADAPTERS['claude-code']) === 'session');
      expect('the adapters: a harness with none is refused by name, not read as a session with no time',
        (() => { try { adapter('gemini'); return false; } catch (e) { return e instanceof Unsupported && e instanceof Usage
          && /^unsupported here: no transcript adapter for gemini; this copy of the set reads /.test(e.message); } })());
      expect('the adapters: a session\'s subagents are its children, and one short id under two parents stays apart',
        subagents('claude-code', 'pp1').length === 1 && subagents('claude-code', 'pp1')[0].id === 'agent-x1'
        && subagents('claude-code', 'pp1')[0].parent === 'pp1' && subagents('claude-code', 'pp1')[0].path !== subagents('claude-code', 'pp2')[0].path
        && subagents('claude-code', 'pp2')[0].parent === 'pp2');
      write(join(home, 'codex', 'sessions', '2026', '01', '01', 'rollout-2026-01-01T18-10-00-cc10.jsonl'), [
        { type: 'session_meta', timestamp: T(2), payload: { id: 'cc10', cwd: demo } },
        { type: 'response_item', timestamp: T(3), payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'y' }] } },
      ]);
      expect('the adapters: a transcript is the one that really holds the session, not one whose name contains its id',
        adapter('codex').transcripts('cc1').length === 1 && adapter('codex').transcripts('cc1')[0].path.endsWith('-cc1.jsonl')
        && adapter('codex').transcripts('cc10').length === 1);
      // A session in pi's shape is the one its first line names, not the one
      // its file name suggests, and omp keeps a subagent's transcript in its
      // parent's folder, where only that first line names it.
      write(join(home, 'omp', 'sessions', '-w-demo', 'stamp_a.jsonl'), [{ type: 'session', id: 'bb', timestamp: T(0), cwd: demo }]);
      expect('the adapters: a session in pi\'s shape is the one its first line names, not the one its file name suggests',
        adapter('omp').transcripts('a').length === 0 && adapter('omp').transcripts('bb').length === 1
        && adapter('omp').transcripts('bb')[0].path.endsWith('stamp_a.jsonl'));
      // A child's transcript found by its id alone is read as the child, with
      // the parent the layout gave it: read without that, its parent's message
      // would be the owner's and its span a session of its own.
      write(join(home, 'omp', 'sessions', '-w-demo', '2026-01-01T13-30-00-000Z_oo2', 'kid.jsonl'), [
        { type: 'session', id: 'ookid', timestamp: T(0), cwd: join(home, 'gone-omp') },
        { type: 'message', timestamp: T(0), message: { role: 'user', timestamp: at(0), content: [{ type: 'text', text: 'demo-q7 please' }] } },
      ]);
      const kid = transcriptOf('omp:ookid', 'demo-q7');
      expect('a child\'s transcript found by its id alone keeps the parent the layout gave it',
        !!kid && kid.parent === 'oo2' && kid.owner.length === 0);
      expect('a child\'s transcript is never a session of its own to place, even where the item is not named',
        unnamedTranscripts('omp:ookid', 'demo-zz9').length === 0);
      expect('the adapters: a subagent kept in its parent\'s folder is found by its own id, the one its parent lists',
        subagents('omp', 'oo1')[0].id === 'oo1sub' && adapter('omp').transcripts('oo1sub').length === 1
        && adapter('omp').transcripts('oo1sub')[0].path.endsWith('sub.jsonl') && adapter('omp').transcripts('oo1').length === 1);
      expect('the adapters: a Codex subagent is the child of the parent its rollout names',
        subagents('codex', 'par1').length === 1 && subagents('codex', 'par1')[0].id === 'cc1' && subagents('codex', 'cc1').length === 0);
      expect('the adapters: an omp subagent is the child of the session whose folder it is in',
        subagents('omp', 'oo1').length === 1 && subagents('omp', 'oo1')[0].parent === 'oo1' && subagents('omp', 'oo1sub').length === 0);
      expect('the adapters: a Prime Agent subagent is the child of the session it names, not of the folder above it',
        subagents('prime-agent', 'zz1').length === 1 && subagents('prime-agent', 'zz1')[0].id === 'zz2'
        && subagents('prime-agent', 'zz2').length === 1 && subagents('prime-agent', 'zz2')[0].id === 'zz3');
      expect('the adapters: a harness that keeps no subagent list is refused, not answered empty',
        ADAPTERS.pi.subagentList === null
        && (() => { try { subagents('pi', 'pi1'); return false; } catch (e) { return e instanceof Unsupported && /^unsupported here: Pi keeps no list/.test(e.message); } })());
      expect('the adapters: listing the subagents of a harness with no adapter is refused, not empty',
        (() => { try { subagents('gemini', 'x'); return false; } catch (e) { return e instanceof Unsupported; } })());
      expect('the adapters: an omp subagent is listed with the id its own transcript gives it',
        subagents('omp', 'oo1')[0].id === 'oo1sub');
      expect('the adapters: naming a harness this copy cannot read is refused, so no record is written for one',
        (() => { try { current({ harness: 'gemini', session: 'gg' }); return false; } catch (e) { return e instanceof Unsupported; } })());
      expect('the adapters: the current session comes from the harness that names it, and an explicit one comes first',
        current({ env: { CLAUDE_CODE_SESSION_ID: 'c1' } }).key === 'claude-code:c1'
        && current({ env: { CODEX_THREAD_ID: 't1' } }).key === 'codex:t1'
        && current({ env: { CODEX_SESSION_ID: 's1' } }).key === 'codex:s1'
        && current({ env: { PI_SESSION_ID: 'q1' } }).key === 'pi:q1'
        && current({ env: {} }) === null
        && current({ harness: 'omp', session: 'o1' }).key === 'omp:o1'
        && current({ harness: 'omp', session: 'o1', env: { CLAUDE_CODE_SESSION_ID: 'c1' } }).key === 'omp:o1');
      expect('the adapters: a harness that names no session of its own is told with --harness and --session',
        ADAPTERS.omp.env.length === 0 && ADAPTERS['prime-agent'].env.length === 0 && sessionEnvVars().includes('PI_SESSION_ID'));
      expect('the adapters: the command says what each harness cannot do, and names every one it reads',
        adapterNames().every((h) => run(['adapters']).includes(h)) && run(['adapters']).includes(ADAPTERS.pi.limits)
        && JSON.parse(run(['adapters', '--json']))['prime-agent'].subagents === ADAPTERS['prime-agent'].subagentList);
      expect('the adapters: the command lists one session\'s subagents, and refuses a harness it cannot read',
        run(['subagents', '--harness', 'claude-code', '--session', 'pp1']).includes('agent-x1')
        && JSON.parse(run(['subagents', '--harness', 'omp', '--session', 'oo1', '--json']))[0].parent === 'oo1'
        && misuse(['subagents', '--harness', 'gemini', '--session', 'x']) && misuse(['subagents', '--harness', 'pi']));
    }
  } catch (e) {
    expect(`the self-test ran to its end (${e.message})`, false);
  } finally {
    process.chdir(savedCwd);
    process.env = saved;
    rmSync(home, { recursive: true, force: true });
  }
  console.log(failures.length ? `${failures.length} failed` : 'all passed');
  return failures.length ? 1 : 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--selftest') return selftest();
  if (!args.length || args[0] === '--help') { console.log(HELP); return args.length ? 0 : 2; }
  try {
    console.log(run(args));
    return 0;
  } catch (e) {
    if (!(e instanceof Usage)) throw e;
    console.error(`${e.message}\n\n${HELP}`);
    return 2;
  }
}

// Run when it is the command, stay a library when another file imports it.
if (process.argv[1] && fileURLToPath(import.meta.url).endsWith(basename(process.argv[1])))
  process.exitCode = main();
