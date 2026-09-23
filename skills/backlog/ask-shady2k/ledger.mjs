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
const SHELL = [
  ['ci', /\bgh\s+(run|workflow)\b|\bgh\s+pr\s+checks\b/],
  ['git', /\bgit(\s+-[cC]\s+\S+|\s+--?[\w-]+(=\S+)?)*\s+(commit|push|merge|rebase|cherry-pick|tag|am|revert|reset|switch|checkout|worktree\s+(add|remove))\b|\bgh\s+pr\s+(create|merge|edit|close)\b/],
  ['develop', /\b(gofmt\s+-w|goimports\s+-w|prettier\s+(--write|-w)|cargo\s+fmt|rustfmt|black|isort|ruff\s+format|eslint\s+[^|;&]*--fix|biome\s+(format|check)\s+[^|;&]*--write)\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(format|fmt)\b/],
  ['test', /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|check|lint|typecheck)(:\S+)?\b|\b(pytest|jest|vitest|mocha|clippy|tsc|eslint|ruff|mypy|shellcheck|golangci-lint)\b|\b(go|cargo)\s+(test|check|clippy|vet)\b|\bmake\s+(test|check|lint)\b|--selftest\b|\bnode\s+--test\b|\bplugin\s+validate\b/],
  ['build', /\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b|\b(go|cargo)\s+build\b|\b(webpack|vite\s+build|docker\s+(build|compose)|make)\b/],
  // Writing a file through the shell is still writing it, and reading one
  // through the shell is still reading it.
  ['develop', /<<-?\s*['"]?[A-Za-z_]+|(?<![=\-<>2&])>\s*[^|&\s>]+\.[A-Za-z]{1,5}\b|\b(sed|perl)\s+-i\b|\bapply_patch\b|\btee\s|\b(mv|cp|rm|mkdir|touch|chmod)\s+-?[\w./]/],
  ['analyze', new RegExp(`${Q}(cat|sed|head|tail|less|ls|find|grep|rg|wc|jq|diff|tree|git|gh|awk|stat|file|pwd|nl|sort|uniq|du)\\s`)],
];
// A Codex call is a little program; what it calls says what it was for.
const CODEX_CALLS = [
  ['ask', /\brequest_user_input/],
  ['delegate', /\b(spawn_agent|wait_agent|send_input|followup_task|list_agents|close_agent)\b/],
  ['develop', /\bapply_patch\b/],
  ['plan', /\bupdate_plan\b/],
];

export function category(name, input) {
  const text = typeof input === 'string' ? input : String(input?.command ?? input?.cmd ?? '');
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
const PHASES = {
  'ask-shady2k': 'orient',
  brainstorming: 'explore',
  'to-research': 'explore',
  'model-domain': 'explore',
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
      const g = { start: prev, end: at, mid, phase: null };
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
  const endTurn = (at) => { if (open) { turns.push({ start: open.start, end: at }); open = null; } };

  for (const d of all) {
    const at = parseTime(d.timestamp);
    const p = d.payload || {};
    if (!Number.isFinite(at)) continue;
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
      const g = { start: prev, end: at, kind, phase: phase.of(kind) };
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
      gens.push(p.type === 'reasoning' ? { start: prev, end: at, kind: null, phase: null } : { start: prev, end: at, kind: 'reply', phase: phase.now });
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
  for (const g of raw.gens) ivs.push({ start: g.start, end: g.end, label: 'model', kind: g.kind, phase: g.phase });
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
  const put = (phase, bucket, kind, ms) => {
    if (!(ms > 0)) return;
    buckets[bucket] += ms;
    const p = (phases[phase] ||= { model: 0, tool: 0, coordination: 0, answer: 0, away: 0, idle: 0, model_kinds: {}, tool_kinds: {} });
    p[bucket] += ms;
    if (bucket === 'model' || bucket === 'tool') p[`${bucket}_kinds`][kind] = (p[`${bucket}_kinds`][kind] || 0) + ms;
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
        put(phase, bucket, bucket, ms);
        if (bucket === 'answer') occupied.push(...inside);
      } else put(phase, 'idle', 'idle', ms);
      continue;
    }
    if (v.label === 'ask') {
      put(phase, v.owner, v.owner, ms);
      if (v.owner === 'answer') occupied.push(...inside);
      continue;
    }
    occupied.push(...inside);
    if (v.label !== 'wait') activeIvs.push(...inside);
    if (v.label === 'tool' || v.label === 'model') put(phase, v.label, v.kind, ms);
    else put(phase, 'coordination', v.kind || 'coordination', ms);
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

// Where a session ran, and what it recorded about its repository, from its
// first lines.
function where(harness, path) {
  const first = head(path);
  if (harness === 'codex') {
    const meta = first.find((d) => d.type === 'session_meta')?.payload || {};
    return { cwd: meta.cwd || null, hints: { remote: meta.git?.repository_url || null } };
  }
  return { cwd: first.find((d) => d.cwd)?.cwd || null, hints: {} };
}

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

/**
 * Every session of this project that either harness left on this machine,
 * read but not yet measured. Claude's subagents are read from the folder of
 * the session that started them; Codex's are sessions of their own that name
 * their parent.
 */
export function collect(project, { since, until, repo } = {}) {
  const candidates = [];
  const root = join(claudeHome(), 'projects');
  if (existsSync(root))
    for (const dir of readdirSync(root))
      for (const f of files(join(root, dir), 2)) {
        const parts = f.path.slice(join(root, dir).length + 1).split(sep);
        if (parts.length === 1) candidates.push({ ...f, harness: 'claude-code' });
        else if (parts.length === 3 && parts[1] === 'subagents') candidates.push({ ...f, harness: 'claude-code', sub: true });
      }
  for (const f of files(join(codexHome(), 'sessions'), 4)) candidates.push({ ...f, harness: 'codex' });

  const seen = [];
  for (const c of candidates) {
    if (since && c.mtimeMs < since) continue;
    try { seen.push({ ...c, ...where(c.harness, c.path) }); } catch { /* unreadable */ }
  }
  const id = identify(project, { repo, cwds: [...new Set(seen.map((c) => c.cwd).filter(Boolean))] });
  if (!id.commons.size) throw new Usage(`no repository of ${project} found: run from its checkout or pass --repo <path>`);

  // Two passes: what the evidence settles first, then the gone copies that
  // sat in a folder the first pass showed is kept for this project's copies.
  const judged = seen.map((c) => {
    let v = belongsTo(id, c.cwd, c.hints, { roots: false });
    if (!v.yes && v.unknown && c.harness === 'claude-code') {
      c.hints = { ...c.hints, ...laterHints(c.path) };
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
    try {
      if (c.harness === 'codex') raw = readCodex(c.path);
      else {
        let sub = null;
        if (c.sub) {
          sub = { agentId: basename(c.path, '.jsonl') };
          try { Object.assign(sub, JSON.parse(readFileSync(c.path.replace(/\.jsonl$/, '.meta.json'), 'utf8'))); } catch { /* no meta */ }
        }
        raw = readClaude(c.path, sub);
      }
    } catch { continue; }
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

// ---- command line ----------------------------------------------------------

const HELP = `ledger.mjs time [--since <date>] [--until <date>] [--project <name>] [--repo <path>] [--json]
ledger.mjs sessions [--since <date>] [--until <date>] [--project <name>] [--repo <path>] [--json]
time     where this project's hours went: the model, tools, coordination, the owner, and nobody
sessions one line per session, including other working copies and subagents
--since, --until  a date is a day on this machine's clock (--until includes it); a time
         without an offset is local too. Sessions crossing the edge count only inside it.
--repo   a checkout of the project, when not run from one
--answer-minutes <n> where a gap before the owner's message, or a question waiting on him,
stops being him answering and becomes him away (${ANSWER_MINUTES} by default): the one figure
here that is a judgement rather than a measurement
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
    if (key === 'json') { opts.json = true; continue; }
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
  const project = projectName(opts.project, opts.repo);
  const print = (value, text) => (opts.json ? JSON.stringify(value, null, 2) : text);
  switch (command) {
    case 'time': {
      const l = ledger(project, opts);
      return print(l, describeLedger(l));
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
      const fresh = () => { rmSync(join(home, 'claude'), { recursive: true, force: true }); rmSync(join(home, 'codex'), { recursive: true, force: true }); };
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
