#!/usr/bin/env node
/**
 * The project's time ledger: every session that worked on this project, split
 * by who spent the time and on what.
 *
 * The harness already measures most of it. A Claude session's record carries
 * the wall clock, the minutes the model generated, the minutes tools ran, what
 * it cost and how many lines it wrote; every turn carries its own duration.
 * The ledger reads those back instead of guessing from the gaps between
 * messages, so the only estimate left is the owner's own minutes, and the one
 * threshold is where answering becomes being away.
 *
 * take-task owns this file; the skills that link it carry copies.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// A gap before the owner's message this long is him reading and answering;
// longer than this, he was somewhere else and the agent was simply stopped.
export const ANSWER_MINUTES = 10;

export class Usage extends Error {}

const claudeHome = () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const codexHome = () => process.env.CODEX_HOME || join(homedir(), '.codex');

export function projectName(given) {
  if (given) return given;
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return basename(dirname(common));
  } catch {
    throw new Usage('not in a git checkout: pass --project <name>');
  }
}

// A session belongs to the project when it ran in the checkout or in a second
// working copy of it: some part of its working directory is the project's
// name, or begins with that name and a dash.
export const belongs = (cwd, project) =>
  !!cwd && cwd.split(sep).some((part) => part === project || part.startsWith(`${project}-`));

const parseTime = (s) => (s ? Date.parse(s) : NaN);
const minutes = (ms) => ms / 60e3;

// ---- what a turn was spent on ----------------------------------------------

// Tools say what the agent was doing better than its prose does: a turn that
// ends in an edit was writing code, one that ends in a search was reading it.
const TOOLS = {
  develop: ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'],
  analyze: ['Read', 'Grep', 'Glob', 'ToolSearch', 'WebFetch', 'WebSearch', 'ReadMcpResourceTool', 'ListMcpResourcesTool'],
  delegate: ['Agent', 'Task', 'Workflow', 'SendMessage', 'ListAgents', 'TaskStop', 'Skill'],
  ask: ['AskUserQuestion'],
  plan: ['TodoWrite', 'ExitPlanMode', 'EnterPlanMode'],
};
// Order matters: a run of the checks is a test even when it is spelled as a
// build, and anything reaching the forge is a wait on the forge, not on git.
const SHELL = [
  ['ci', /\b(gh\s+(run|workflow)|gh\s+pr\s+checks)\b/],
  ['test', /\b(test|tests|pytest|jest|vitest|clippy|lint|typecheck|tsc|check)\b/],
  ['build', /\b(build|compile|webpack|bundle|docker)\b/],
  // Writing a file through the shell is still writing it, and reading one
  // through the shell is still reading it.
  ['develop', /<<\s*['"]?[A-Za-z_]+|>\s*[^|&\s]+\.[A-Za-z]{1,5}\b|\b(sed|perl)\s+-i\b|\bapply_patch\b/],
  ['analyze', /(^|[\s;|&(])(cat|sed|head|tail|less|ls|find|grep|rg|wc|jq|diff|tree)\s/],
  ['git', /(^|[\s;|&(])(git|gh)\s/],
];

export function category(name, input) {
  if (name === 'Bash' || name === 'exec' || name === 'shell') {
    const cmd = typeof input === 'string' ? input : String(input?.command ?? '');
    for (const [kind, re] of SHELL) if (re.test(cmd)) return kind;
    return 'shell';
  }
  for (const [kind, names] of Object.entries(TOOLS)) if (names.includes(name)) return kind;
  return name.startsWith('mcp__') ? 'analyze' : 'shell';
}

// What a turn's generation was for: the strongest thing it went on to do.
const RANK = ['develop', 'test', 'build', 'ci', 'delegate', 'analyze', 'git', 'plan', 'ask', 'shell'];
const strongest = (kinds) => RANK.find((k) => kinds.includes(k)) || 'reply';

// ---- the phases of the work ------------------------------------------------

// The harness names the skill that led a turn, and the skills are the phases.
// A skill that is not a phase of the work (a notification, a search of past
// sessions) leaves the phase where it was, rather than ending it.
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

// A skill names the phase for the turns it leads, and the work takes the name
// back when what the turn did plainly is not that phase: these four are talk
// about the product, and making or checking the product is not talk. Where
// that happens in a working copy of its own, the name does not come back
// either, because such a copy exists to build and a planning skill called
// once inside it was an errand, not the session's purpose; in the checkout,
// where talking is the session's purpose, one command in the middle of a
// conversation does not end the conversation.
const TALK = new Set(['orient', 'explore', 'plan', 'wrap']);
const MAKING = new Set(['develop', 'test', 'build', 'ci']);

// ---- reading a session -----------------------------------------------------

function lines(path) {
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch { /* a half-written line is not a fact */ }
  }
  return out;
}

const blank = () => ({ model: {}, tool: {}, owner: {} });

// Time is added to a bucket under the phase it belonged to and the thing it
// was spent on; the totals are scaled to the harness's own figures afterwards.
function add(weights, bucket, phase, kind, ms) {
  if (!(ms > 0)) return;
  const b = (weights[bucket][phase] ||= {});
  b[kind] = (b[kind] || 0) + ms;
}

const total = (bucket) => Object.values(bucket).reduce((n, kinds) => n + Object.values(kinds).reduce((m, v) => m + v, 0), 0);

function readClaude(path, id, opening = 'unattributed') {
  const rows = lines(path);
  const use = new Map();
  const turns = [];
  const owner = [];
  const gens = [];
  const pairs = [];
  let cost = null;
  let skill;
  let phase = opening;
  let previous = NaN;

  for (const d of rows) {
    if (d.type === 'cost-state') { cost = d; continue; }
    const at = parseTime(d.timestamp);
    if (!Number.isFinite(at)) continue;
    if (d.type === 'system' && d.subtype === 'turn_duration' && d.durationMs > 0) {
      turns.push({ start: at - d.durationMs, end: at, ms: d.durationMs, phase });
      continue;
    }
    if (d.isMeta) continue;
    const content = d.message?.content;
    const parts = Array.isArray(content) ? content : [];
    if (d.type === 'assistant') {
      const next = phaseOf(d.attributionSkill);
      if (next) { phase = next; skill = d.attributionSkill; }
      const calls = parts.filter((p) => p.type === 'tool_use');
      const kind = strongest(calls.map((c) => category(c.name, c.input)));
      let turnPhase = phase;
      if (TALK.has(phase) && MAKING.has(kind)) {
        turnPhase = 'build';
        if (opening === 'build') phase = 'build';
      }
      for (const c of calls) use.set(c.id, { at, name: c.name, input: c.input, phase: turnPhase });
      gens.push({ at, from: previous, kind, phase: turnPhase });
      previous = at;
      continue;
    }
    if (d.type !== 'user') continue;
    const results = parts.filter((p) => p.type === 'tool_result');
    if (results.length) {
      for (const r of results) {
        const u = use.get(r.tool_use_id);
        if (!u) continue;
        pairs.push({ ms: at - u.at, kind: category(u.name, u.input), name: u.name, phase: u.phase });
        use.delete(r.tool_use_id);
      }
      previous = at;
      continue;
    }
    // The owner's own message: anything else on the user's side is the harness
    // speaking for him, and costs him nothing.
    if (typeof content === 'string' || parts.some((p) => p.type === 'text')) {
      owner.push({ at, phase });
      previous = at;
    }
  }

  const modelUsage = cost?.modelUsage || {};
  const tokens = Object.values(modelUsage).reduce((t, m) => ({
    input: t.input + (m.inputTokens || 0),
    output: t.output + (m.outputTokens || 0),
    thinking: t.thinking + (m.thinkingTokens || 0),
    cacheRead: t.cacheRead + (m.cacheReadInputTokens || 0),
  }), { input: 0, output: 0, thinking: 0, cacheRead: 0 });

  const stamps = rows.map((d) => parseTime(d.timestamp)).filter(Number.isFinite);
  return {
    harness: 'claude-code', id, path, turns, owner, gens, pairs, skill,
    startedAt: cost?.startTime || Math.min(...stamps),
    endedAt: Math.max(...stamps),
    wallMs: cost?.totalDuration,
    modelMs: cost?.totalAPIDuration,
    toolMs: cost?.totalToolDuration,
    costUSD: cost?.totalCostUSD || 0,
    linesAdded: cost?.totalLinesAdded || 0,
    linesRemoved: cost?.totalLinesRemoved || 0,
    tokens,
  };
}

// Codex keeps no totals of its own, so its minutes are measured from the
// stamps: tool calls are paired by their call id, and what is left between
// them is the model.
function readCodex(path, id) {
  const rows = lines(path);
  const use = new Map();
  const owner = [];
  const gens = [];
  const pairs = [];
  const tokens = { input: 0, output: 0, thinking: 0, cacheRead: 0 };
  let previous = NaN;
  for (const d of rows) {
    const at = parseTime(d.timestamp);
    const p = d.payload || {};
    if (!Number.isFinite(at)) continue;
    if (p.type === 'custom_tool_call' || p.type === 'function_call') {
      const kind = category(p.name, p.input);
      use.set(p.call_id, { at, name: p.name, input: p.input, kind });
      gens.push({ at, from: previous, kind, phase: 'build' });
      previous = at;
    } else if (p.type === 'custom_tool_call_output' || p.type === 'function_call_output') {
      const u = use.get(p.call_id);
      if (u) {
        pairs.push({ ms: at - u.at, kind: u.kind, name: u.name, phase: 'build' });
        use.delete(p.call_id);
        previous = at;
      }
    } else if (p.type === 'user_message') {
      owner.push({ at, phase: 'build' });
      previous = at;
    } else if (p.type === 'agent_message') {
      gens.push({ at, from: previous, kind: 'reply', phase: 'build' });
      previous = at;
    } else if (p.type === 'token_count' && p.info?.total_token_usage) {
      const t = p.info.total_token_usage;
      tokens.input = t.input_tokens || 0;
      tokens.output = t.output_tokens || 0;
      tokens.thinking = t.reasoning_output_tokens || 0;
      tokens.cacheRead = t.cached_input_tokens || 0;
    }
  }
  const stamps = rows.map((d) => parseTime(d.timestamp)).filter(Number.isFinite);
  if (!stamps.length) return null;
  return {
    harness: 'codex', id, path, turns: [], owner, gens, pairs,
    startedAt: Math.min(...stamps), endedAt: Math.max(...stamps),
    costUSD: 0, linesAdded: 0, linesRemoved: 0, tokens,
  };
}

// ---- the four buckets ------------------------------------------------------

/**
 * One session's minutes: what the model spent, what tools spent, what the
 * owner spent answering, and what nobody spent because he was away. The
 * harness's totals are authoritative where it keeps them; the split inside a
 * bucket is by what was measured between the stamps.
 */
export function measure(raw, answerMinutes = ANSWER_MINUTES) {
  const weights = blank();
  const busyTurns = raw.turns.length ? raw.turns : null;
  const within = (at) => (busyTurns ? busyTurns.find((t) => at >= t.start && at <= t.end) : null);

  for (const g of raw.gens) {
    const ms = Number.isFinite(g.from) ? g.at - g.from : 0;
    add(weights, 'model', g.phase, g.kind, ms);
  }
  for (const p of raw.pairs) {
    // A question put to the owner is his minute, not the tool's.
    if (p.kind === 'ask') add(weights, 'owner', p.phase, 'answer', p.ms);
    else add(weights, 'tool', p.phase, p.kind, p.ms);
  }

  // Outside the agent's turns there is only the owner: a short gap before his
  // message is him answering, a long one is him away.
  let answer = 0;
  let away = 0;
  const cap = answerMinutes * 60e3;
  let mark = raw.startedAt;
  const marks = busyTurns ? [...busyTurns].sort((a, b) => a.start - b.start) : [];
  for (const m of raw.owner) {
    const lastEnd = marks.filter((t) => t.end <= m.at).map((t) => t.end).pop();
    const from = Math.max(mark, lastEnd ?? mark);
    const gap = m.at - from;
    if (gap > 0) {
      if (gap <= cap) { answer += gap; add(weights, 'owner', m.phase, 'answer', gap); }
      else { away += gap; add(weights, 'owner', m.phase, 'away', gap); }
    }
    mark = m.at;
  }

  const wallMs = raw.wallMs ?? raw.endedAt - raw.startedAt;
  const measuredModel = total(weights.model);
  const measuredTool = total(weights.tool);
  // The harness counts a question put to the owner as a tool it ran. It is his
  // minutes: taken out of the tools, it must not be taken out twice.
  const askMs = raw.pairs.filter((p) => p.kind === 'ask').reduce((n, p) => n + p.ms, 0);
  // The harness's own figures win; the measured ones only say how to divide.
  const modelMs = raw.modelMs ?? measuredModel;
  const spentOnTools = raw.toolMs ?? measuredTool + askMs;
  const toolMs = Math.max(0, spentOnTools - askMs);
  const busyMs = busyTurns ? busyTurns.reduce((n, t) => n + t.ms, 0) : modelMs + spentOnTools;
  // Inside a turn and neither the model nor a tool: hooks, permission prompts,
  // and a coordinator standing by while the workers it started do the work.
  const overheadMs = Math.max(0, busyMs - modelMs - spentOnTools);
  // Whatever is left of the clock belongs to nobody.
  const idleMs = Math.max(0, wallMs - busyMs - answer - away);

  const scale = (bucket, to) => {
    const from = total(bucket);
    const factor = from > 0 ? to / from : 0;
    const out = {};
    for (const [phase, kinds] of Object.entries(bucket)) {
      out[phase] = {};
      for (const [kind, ms] of Object.entries(kinds)) out[phase][kind] = ms * factor;
    }
    return out;
  };

  const phases = {};
  const put = (phase, bucket, kind, ms) => {
    if (!(ms > 0)) return;
    const p = (phases[phase] ||= { model: 0, tool: 0, overhead: 0, answer: 0, away: 0, idle: 0, kinds: {} });
    p[bucket] += ms;
    if (bucket === 'model' || bucket === 'tool') p.kinds[kind] = (p.kinds[kind] || 0) + ms;
  };
  for (const [phase, kinds] of Object.entries(scale(weights.model, modelMs)))
    for (const [kind, ms] of Object.entries(kinds)) put(phase, 'model', kind, ms);
  for (const [phase, kinds] of Object.entries(scale(weights.tool, toolMs)))
    for (const [kind, ms] of Object.entries(kinds)) put(phase, 'tool', kind, ms);
  for (const [phase, kinds] of Object.entries(weights.owner)) {
    put(phase, 'answer', 'answer', kinds.answer || 0);
    put(phase, 'away', 'away', kinds.away || 0);
  }
  // Overhead and the empty clock fall where the work was, by its weight.
  const byWeight = (ms, bucket) => {
    const shares = Object.entries(phases).map(([p, v]) => [p, v.model + v.tool]);
    const sum = shares.reduce((n, [, v]) => n + v, 0);
    if (!(ms > 0)) return;
    if (!sum) { put('unattributed', bucket, bucket, ms); return; }
    for (const [p, v] of shares) put(p, bucket, bucket, (ms * v) / sum);
  };
  byWeight(overheadMs, 'overhead');
  byWeight(idleMs, 'idle');

  const kinds = {};
  for (const p of Object.values(phases))
    for (const [k, ms] of Object.entries(p.kinds)) kinds[k] = (kinds[k] || 0) + ms;

  return {
    id: raw.id, harness: raw.harness, path: raw.path, cwd: raw.cwd, role: raw.role,
    startedAt: new Date(raw.startedAt).toISOString(), endedAt: new Date(raw.endedAt).toISOString(),
    exact: raw.wallMs !== undefined,
    busy: busyTurns ? busyTurns.map((t) => ({ start: t.start, end: t.end })) : [{ start: raw.startedAt, end: raw.endedAt }],
    ownerMessages: raw.owner.length,
    turns: raw.turns.length,
    wallMinutes: minutes(wallMs),
    modelMinutes: minutes(modelMs),
    toolMinutes: minutes(toolMs),
    overheadMinutes: minutes(overheadMs),
    answerMinutes: minutes(answer + askMs),
    // The owner's own absence, and a session that stayed open with nothing
    // happening in it, which is nobody's minute at all.
    awayMinutes: minutes(away),
    openMinutes: minutes(idleMs),
    kinds: Object.fromEntries(Object.entries(kinds).map(([k, ms]) => [k, minutes(ms)])),
    phases: Object.fromEntries(Object.entries(phases).map(([p, v]) => [p, {
      model: minutes(v.model), tool: minutes(v.tool), overhead: minutes(v.overhead),
      answer: minutes(v.answer), away: minutes(v.away), idle: minutes(v.idle),
      kinds: Object.fromEntries(Object.entries(v.kinds).map(([k, ms]) => [k, minutes(ms)])),
    }])),
    costUSD: raw.costUSD, linesAdded: raw.linesAdded, linesRemoved: raw.linesRemoved, tokens: raw.tokens,
  };
}

// ---- finding the sessions --------------------------------------------------

// The working directory a session ran in, from the first lines that name one.
function workingDir(path) {
  let n = 0;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || n++ > 40) break;
    try {
      const d = JSON.parse(line);
      const cwd = d.cwd || d.payload?.cwd;
      if (cwd) return cwd;
    } catch { /* keep looking */ }
  }
  return null;
}

function* files(root, depth = 4) {
  if (!existsSync(root) || depth < 0) return;
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    let st;
    try { st = statSync(path); } catch { continue; }
    if (st.isDirectory()) yield* files(path, depth - 1);
    else if (entry.endsWith('.jsonl')) yield { path, mtimeMs: st.mtimeMs, name: entry };
  }
}

/**
 * Every session of this project that either harness left on this machine.
 * A folder under the harness's projects is the working directory spelled out,
 * so the project's name narrows the search before anything is parsed.
 */
export function findSessions(project, { since, until, answerMinutes } = {}) {
  const out = [];
  const root = join(claudeHome(), 'projects');
  const candidates = [];
  if (existsSync(root))
    for (const dir of readdirSync(root)) {
      if (!dir.includes(project)) continue;
      for (const f of files(join(root, dir), 1)) candidates.push({ ...f, harness: 'claude-code' });
    }
  for (const f of files(join(codexHome(), 'sessions'))) candidates.push({ ...f, harness: 'codex' });

  for (const c of candidates) {
    if (since && c.mtimeMs < since) continue;
    let cwd;
    try { cwd = workingDir(c.path); } catch { continue; }
    if (!belongs(cwd, project)) continue;
    const id = c.name.replace(/\.jsonl$/, '').replace(/^rollout-[\dT-]+-/, '');
    // The checkout is where a run is coordinated and where the owner is
    // talked to; a second working copy of the same project is a worker's, and
    // it exists to build, so that is what its hours are until a skill says
    // otherwise.
    const role = basename(cwd) === project ? 'checkout' : 'side copy';
    const opening = role === 'checkout' ? 'unattributed' : 'build';
    let raw;
    try {
      raw = c.harness === 'codex' ? readCodex(c.path, id) : readClaude(c.path, id, opening);
    } catch { continue; }
    if (!raw || !Number.isFinite(raw.startedAt)) continue;
    if (since && raw.endedAt < since) continue;
    if (until && raw.startedAt > until) continue;
    raw.cwd = cwd;
    raw.role = role;
    out.push(measure(raw, answerMinutes ?? ANSWER_MINUTES));
  }
  return out.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

// ---- adding them up --------------------------------------------------------

const round = (n) => Math.round(n * 10) / 10;
const hours = (m) => round(m / 60);

// How many sessions were working at once: the busy stretches laid over each
// other, which is the number of agents the owner actually had running.
export function threads(sessions) {
  const edges = [];
  for (const s of sessions) for (const b of s.busy) { edges.push([b.start, 1]); edges.push([b.end, -1]); }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let open = 0;
  let peak = 0;
  let weighted = 0;
  let span = 0;
  let last = null;
  for (const [at, delta] of edges) {
    if (open > 0 && last !== null) { weighted += open * (at - last); span += at - last; }
    open += delta;
    peak = Math.max(peak, open);
    last = at;
  }
  return { peak, average: span ? round(weighted / span) : 0, busyHours: hours(minutes(span)) };
}

export function ledger(project, opts = {}) {
  const since = opts.since ? Date.parse(opts.since) : undefined;
  const until = opts.until ? Date.parse(opts.until) : undefined;
  const sessions = opts.sessions || findSessions(project, { since, until, answerMinutes: opts['answer-minutes'] });
  const sum = (f) => sessions.reduce((n, s) => n + f(s), 0);
  const kinds = {};
  const phases = {};
  for (const s of sessions) {
    for (const [k, m] of Object.entries(s.kinds)) kinds[k] = (kinds[k] || 0) + m;
    for (const [p, v] of Object.entries(s.phases)) {
      const t = (phases[p] ||= { model: 0, tool: 0, overhead: 0, answer: 0, away: 0, idle: 0, kinds: {} });
      for (const b of ['model', 'tool', 'overhead', 'answer', 'away', 'idle']) t[b] += v[b];
      for (const [k, m] of Object.entries(v.kinds)) t.kinds[k] = (t.kinds[k] || 0) + m;
    }
  }
  const work = (v) => v.model + v.tool + v.answer;
  return {
    project,
    from: sessions.length ? sessions[0].startedAt : null,
    to: sessions.length ? sessions.at(-1).endedAt : null,
    sessions: sessions.length,
    inCheckout: sessions.filter((s) => s.role === 'checkout').length,
    inSideCopies: sessions.filter((s) => s.role === 'side copy').length,
    estimated: sessions.filter((s) => !s.exact).length,
    clockHours: hours(sum((s) => s.wallMinutes)),
    workHours: hours(sum((s) => s.modelMinutes + s.toolMinutes + s.answerMinutes)),
    model: hours(sum((s) => s.modelMinutes)),
    tools: hours(sum((s) => s.toolMinutes)),
    answering: hours(sum((s) => s.answerMinutes)),
    coordination: hours(sum((s) => s.overheadMinutes)),
    away: hours(sum((s) => s.awayMinutes)),
    open: hours(sum((s) => s.openMinutes)),
    ownerMessages: sum((s) => s.ownerMessages),
    kinds: Object.fromEntries(Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, m]) => [k, hours(m)])),
    phases: Object.fromEntries(PHASE_NAMES.filter((p) => phases[p]).map((p) => [p, {
      workHours: hours(work(phases[p])),
      model: hours(phases[p].model), tools: hours(phases[p].tool),
      answering: hours(phases[p].answer), coordination: hours(phases[p].overhead),
      kinds: Object.fromEntries(Object.entries(phases[p].kinds).sort((a, b) => b[1] - a[1]).map(([k, m]) => [k, hours(m)])),
    }])),
    threads: threads(sessions),
    costUSD: round(sum((s) => s.costUSD)),
    linesAdded: sum((s) => s.linesAdded),
    linesRemoved: sum((s) => s.linesRemoved),
    tokens: {
      output: sum((s) => s.tokens.output), thinking: sum((s) => s.tokens.thinking),
      input: sum((s) => s.tokens.input), cacheRead: sum((s) => s.tokens.cacheRead),
    },
  };
}

// ---- saying it -------------------------------------------------------------

const row = (label, value, width = 26) => `  ${label.padEnd(width)}${value}`;
const named = (kinds) => Object.entries(kinds).filter(([, h]) => h >= 0.05).map(([k, h]) => `${k} ${h}`).join(', ') || 'nothing measured';

export function describeLedger(l) {
  if (!l.sessions) return `No session of ${l.project} was found on this machine.`;
  const out = [
    `${l.project}, ${l.from.slice(0, 10)} to ${l.to.slice(0, 10)}: ${l.sessions} session(s), ` +
      `${l.inCheckout} in the checkout and ${l.inSideCopies} in side copies, ${l.clockHours} h on the clock.`,
    '',
    `Worked ${l.workHours} h of it:`,
    row('the model thinking', `${l.model} h`),
    row('tools running', `${l.tools} h`),
    row('the owner answering', `${l.answering} h over ${l.ownerMessages} message(s)`),
    '',
    'Not work, and not in any estimate:',
    row('coordination and waiting', `${l.coordination} h`),
    row('nobody: the owner away', `${l.away} h`),
    row('sessions left open', `${l.open} h`),
    '',
    `What the agents did (hours): ${named(l.kinds)}`,
    '',
    'By phase, work only (hours):',
    ...Object.entries(l.phases).map(([p, v]) =>
      row(p, `${v.workHours}  (model ${v.model}, tools ${v.tools}, answering ${v.answering}) ${named(v.kinds)}`, 14)),
    '',
    `At once: ${l.threads.peak} session(s) at the peak, ${l.threads.average} on average over ${l.threads.busyHours} h of running.`,
    `Cost $${l.costUSD}, ${l.linesAdded} line(s) written and ${l.linesRemoved} removed, ` +
      `${l.tokens.output} token(s) out.`,
  ];
  if (l.estimated) out.push(`${l.estimated} session(s) kept no totals of their own: their minutes are measured from the stamps.`);
  return out.join('\n');
}

export function describeSessions(sessions) {
  if (!sessions.length) return 'No session found.';
  const head = `${'session'.padEnd(14)}${'role'.padEnd(11)}${'start'.padEnd(12)}` +
    `${'model'.padStart(7)}${'tools'.padStart(7)}${'owner'.padStart(7)}${'cost'.padStart(9)}${'lines'.padStart(9)}`;
  const rows = sessions.map((s) =>
    `${s.id.slice(0, 13).padEnd(14)}${s.role.padEnd(11)}${s.startedAt.slice(5, 16).padEnd(12)}` +
    `${round(s.modelMinutes).toFixed(0).padStart(7)}${round(s.toolMinutes).toFixed(0).padStart(7)}` +
    `${round(s.answerMinutes).toFixed(0).padStart(7)}${`$${round(s.costUSD)}`.padStart(9)}` +
    `${`+${s.linesAdded}/-${s.linesRemoved}`.padStart(9)}`);
  return [head, ...rows, '', 'Minutes, not hours; the owner\'s are an estimate and the rest are measured.'].join('\n');
}

// ---- command line ----------------------------------------------------------

const HELP = `ledger.mjs time [--since <date>] [--until <date>] [--project <name>] [--json]
ledger.mjs sessions [--since <date>] [--until <date>] [--project <name>] [--json]
time    where this project's hours went: the model, tools, the owner, and nobody
sessions one line per session, including the workers' own working copies
--answer-minutes <n> where a gap before the owner's message stops being him
answering and becomes him away (${ANSWER_MINUTES} by default): the one figure here
that is a judgement rather than a measurement
Sessions are read from this machine's harness records; --project defaults to the checkout's name.
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
    if (opts[key] !== undefined && Number.isNaN(Date.parse(opts[key]))) throw new Usage(`--${key} needs a date`);
  if (opts['answer-minutes'] !== undefined) {
    const n = Number(opts['answer-minutes']);
    if (!Number.isFinite(n) || n <= 0) throw new Usage('--answer-minutes needs minutes');
    opts['answer-minutes'] = n;
  }
  const project = projectName(opts.project);
  const print = (value, text) => (opts.json ? JSON.stringify(value, null, 2) : text);
  switch (command) {
    case 'time': {
      const l = ledger(project, opts);
      return print(l, describeLedger(l));
    }
    case 'sessions': {
      const s = findSessions(project, {
        since: opts.since ? Date.parse(opts.since) : undefined,
        until: opts.until ? Date.parse(opts.until) : undefined,
        answerMinutes: opts['answer-minutes'],
      });
      return print(s, describeSessions(s));
    }
    default:
      throw new Usage(`unknown command ${command ?? '(none)'}`);
  }
}

// ---- self-test -------------------------------------------------------------

function selftest() {
  const home = mkdtempSync(join(tmpdir(), 'ledger-selftest-'));
  const saved = { ...process.env };
  process.env.CLAUDE_CONFIG_DIR = join(home, 'claude');
  process.env.CODEX_HOME = join(home, 'codex');
  const failures = [];
  const expect = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failures.push(name); };
  const T = (min, sec = 0) => new Date(Date.parse('2026-01-01T10:00:00Z') + min * 60e3 + sec * 1e3).toISOString();
  const ms = (min) => min * 60e3;

  try {
    // One session of "demo": the owner asks, the agent reads, edits, runs the
    // tests, asks him a question, and he comes back an hour later.
    const rows = [
      { type: 'user', timestamp: T(0), cwd: '/w/demo', message: { content: 'do it' } },
      { type: 'assistant', timestamp: T(2), attributionSkill: 'shady2k-skills:take-task', message: { content: [{ type: 'tool_use', id: 'a', name: 'Grep', input: { pattern: 'x' } }] } },
      { type: 'user', timestamp: T(2, 30), message: { content: [{ type: 'tool_result', tool_use_id: 'a' }] } },
      { type: 'assistant', timestamp: T(6), message: { content: [{ type: 'tool_use', id: 'b', name: 'Edit', input: { file_path: 'f' } }] } },
      { type: 'user', timestamp: T(6, 10), message: { content: [{ type: 'tool_result', tool_use_id: 'b' }] } },
      { type: 'assistant', timestamp: T(8), message: { content: [{ type: 'tool_use', id: 'c', name: 'Bash', input: { command: 'npm test' } }] } },
      { type: 'user', timestamp: T(12), message: { content: [{ type: 'tool_result', tool_use_id: 'c' }] } },
      { type: 'assistant', timestamp: T(13), message: { content: [{ type: 'tool_use', id: 'd', name: 'AskUserQuestion', input: {} }] } },
      { type: 'user', timestamp: T(16), message: { content: [{ type: 'tool_result', tool_use_id: 'd' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(16), durationMs: ms(16) },
      { type: 'user', timestamp: T(76), message: { content: 'back' } },
      { type: 'assistant', timestamp: T(78), message: { content: [{ type: 'text', text: 'done' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(78), durationMs: ms(2) },
      {
        type: 'cost-state', totalCostUSD: 12.5, totalAPIDuration: ms(9), totalToolDuration: ms(8),
        totalDuration: ms(78), totalLinesAdded: 40, totalLinesRemoved: 5, startTime: Date.parse(T(0)),
        modelUsage: { 'claude-opus-5': { inputTokens: 10, outputTokens: 900, thinkingTokens: 300, cacheReadInputTokens: 5000 } },
      },
    ];
    mkdirSync(join(home, 'claude', 'projects', '-w-demo'), { recursive: true });
    writeFileSync(join(home, 'claude', 'projects', '-w-demo', 'aaaa.jsonl'), `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);

    const one = findSessions('demo');
    expect('a session of the project is found by its working directory', one.length === 1 && one[0].id === 'aaaa');
    const s = one[0];
    expect('the harness\'s own totals are used, not the gaps', s.modelMinutes === 9 && s.wallMinutes === 78);
    expect('an hour away is not the owner answering', Math.round(s.answerMinutes) === 3 && Math.round(s.awayMinutes) === 60);
    expect('a question put to the owner is his minutes, not the tool\'s', s.toolMinutes === 5);
    expect('the session is the checkout\'s, not a side copy\'s', s.role === 'checkout');
    expect('what the model did is named by what it went on to do',
      s.kinds.develop > 0 && s.kinds.analyze > 0 && s.kinds.test > 0);
    expect('the skill that led the turn gives the phase', Object.keys(s.phases).includes('build'));
    expect('the buckets add up to the clock',
      Math.abs(s.modelMinutes + s.toolMinutes + s.overheadMinutes + s.answerMinutes + s.awayMinutes
        + s.openMinutes - s.wallMinutes) < 0.01);
    expect('a session nobody was in has no owner away in it',
      findSessions('demo').every((x) => x.ownerMessages > 0 || x.awayMinutes === 0));

    // A second working copy of the same project, running at the same time.
    const worker = [
      { type: 'user', timestamp: T(4), cwd: '/w/demo-work-1', message: { content: 'brief' } },
      { type: 'assistant', timestamp: T(5), message: { content: [{ type: 'tool_use', id: 'w', name: 'Write', input: {} }] } },
      { type: 'user', timestamp: T(5, 30), message: { content: [{ type: 'tool_result', tool_use_id: 'w' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(10), durationMs: ms(6) },
      {
        type: 'cost-state', totalCostUSD: 3.5, totalAPIDuration: ms(4), totalToolDuration: ms(1),
        totalDuration: ms(6), totalLinesAdded: 600, totalLinesRemoved: 0, startTime: Date.parse(T(4)), modelUsage: {},
      },
    ];
    mkdirSync(join(home, 'claude', 'projects', '-w-demo-work-1'), { recursive: true });
    writeFileSync(join(home, 'claude', 'projects', '-w-demo-work-1', 'bbbb.jsonl'), `${worker.map((r) => JSON.stringify(r)).join('\n')}\n`);

    const l = ledger('demo');
    expect('a worker\'s own working copy is counted as the project\'s',
      l.sessions === 2 && l.inCheckout === 1 && l.inSideCopies === 1);
    expect('the code written is the workers\', and the cost is both', l.linesAdded === 640 && l.costUSD === 16);
    expect('two sessions running at once are seen as two', l.threads.peak === 2);
    expect('work leaves out the owner\'s absence and the coordination',
      l.workHours === hours(9 + 5 + 3 + 4 + 1) && l.away > 0);
    expect('a phase carries its own hours', l.phases.build.workHours > 0);

    // A project whose name is the start of another's is not this project.
    mkdirSync(join(home, 'claude', 'projects', '-w-demolition'), { recursive: true });
    writeFileSync(join(home, 'claude', 'projects', '-w-demolition', 'cccc.jsonl'),
      `${JSON.stringify({ type: 'user', timestamp: T(0), cwd: '/w/demolition', message: { content: 'x' } })}\n`);
    expect('another project that begins with the same word is not counted', findSessions('demo').length === 2);

    // Codex keeps no totals: its minutes come from the stamps.
    const codex = [
      { type: 'session_meta', timestamp: T(20), payload: { cwd: '/w/demo-work-2' } },
      { type: 'event_msg', timestamp: T(20), payload: { type: 'user_message' } },
      { type: 'response_item', timestamp: T(21), payload: { type: 'custom_tool_call', call_id: 'k', name: 'exec', input: '{"cmd":"cargo test"}' } },
      { type: 'response_item', timestamp: T(24), payload: { type: 'custom_tool_call_output', call_id: 'k' } },
      { type: 'event_msg', timestamp: T(25), payload: { type: 'token_count', info: { total_token_usage: { output_tokens: 700 } } } },
    ];
    mkdirSync(join(home, 'codex', 'sessions', '2026', '01', '01'), { recursive: true });
    writeFileSync(join(home, 'codex', 'sessions', '2026', '01', '01', 'rollout-2026-01-01T10-20-00-zzzz.jsonl'),
      `${codex.map((r) => JSON.stringify(r)).join('\n')}\n`);
    const withCodex = findSessions('demo');
    const c = withCodex.find((x) => x.harness === 'codex');
    expect('a session of the other harness is found and measured', !!c && Math.round(c.toolMinutes) === 3);
    expect('a session that kept no totals is marked as estimated', c.exact === false && ledger('demo').estimated === 1);
    expect('the call and the minute that led to it are both named tests',
      Math.round(c.toolMinutes) === 3 && Math.round(c.kinds.test) === 4);

    // What a shell command was for, since most of the work goes through one.
    const shell = (cmd) => category('Bash', { command: cmd });
    expect('a file written through the shell is development',
      shell("cat > notes.md <<'EOF'") === 'develop' && shell('sed -i s/a/b/ x.rs') === 'develop');
    expect('a file read through the shell is analysis',
      shell('sed -n 1,20p src/main.rs') === 'analyze' && shell('grep -rn foo .') === 'analyze');
    expect('the checks and the forge are told apart from each other and from git',
      shell('cargo test --all') === 'test' && shell('gh run watch 42') === 'ci' && shell('git commit -m x') === 'git');

    // A planning skill leads one turn; three turns later the session is
    // running the tests, which is not planning however it was opened.
    const planned = [
      { type: 'user', timestamp: T(200), cwd: '/w/demo', message: { content: 'plan it' } },
      { type: 'assistant', timestamp: T(202), attributionSkill: 'shady2k-skills:to-stages', message: { content: [{ type: 'tool_use', id: 'p1', name: 'Read', input: {} }] } },
      { type: 'user', timestamp: T(202, 30), message: { content: [{ type: 'tool_result', tool_use_id: 'p1' }] } },
      { type: 'assistant', timestamp: T(205), message: { content: [{ type: 'tool_use', id: 'p2', name: 'Bash', input: { command: 'npm test' } }] } },
      { type: 'user', timestamp: T(210), message: { content: [{ type: 'tool_result', tool_use_id: 'p2' }] } },
      { type: 'assistant', timestamp: T(212), message: { content: [{ type: 'text', text: 'done' }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(212), durationMs: ms(12) },
      { type: 'user', timestamp: T(215), message: { content: 'ok' } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(216), durationMs: ms(1) },
      {
        type: 'cost-state', startTime: Date.parse(T(200)), totalAPIDuration: ms(6), totalToolDuration: ms(5.5),
        totalDuration: ms(16), totalCostUSD: 1, totalLinesAdded: 0, totalLinesRemoved: 0, modelUsage: {},
      },
    ];
    writeFileSync(join(home, 'claude', 'projects', '-w-demo', 'eeee.jsonl'),
      `${planned.map((r) => JSON.stringify(r)).join('\n')}\n`);
    const led = findSessions('demo').find((x) => x.id === 'eeee');
    expect('a planning skill keeps the turns it leads', led.phases.plan.kinds.analyze > 0);
    expect('running the tests is not planning, whatever led the session',
      !led.phases.plan.kinds.test && led.phases.build.kinds.test > 0);
    expect('in the checkout, one command does not end the conversation',
      led.phases.plan.kinds.reply > 0 && !led.phases.build.kinds.reply);

    // The same session in a working copy of its own: there the planning skill
    // was an errand, and the work keeps the name after it.
    mkdirSync(join(home, 'claude', 'projects', '-w-demo-work-2'), { recursive: true });
    writeFileSync(join(home, 'claude', 'projects', '-w-demo-work-2', 'ffff.jsonl'),
      `${planned.map((r) => JSON.stringify(r.cwd ? { ...r, cwd: '/w/demo-work-2' } : r)).join('\n')}\n`);
    const errand = findSessions('demo').find((x) => x.id === 'ffff');
    expect('in a working copy of its own, the work takes the name back for good',
      errand.phases.plan.kinds.analyze > 0 && !errand.phases.plan.kinds.reply
      && errand.phases.build.kinds.reply > 0);

    expect('where answering stops and being away begins can be moved',
      Math.round(led.answerMinutes) === 3
      && JSON.parse(run(['sessions', '--project', 'demo', '--answer-minutes', '1', '--json']))
        .find((x) => x.id === 'eeee').awayMinutes === 3);

    const misuse = (a) => { try { run(a); return false; } catch (e) { return e instanceof Usage; } };
    expect('misuse: unknown command', misuse(['frobnicate', '--project', 'demo']));
    expect('misuse: a date that is not one', misuse(['time', '--project', 'demo', '--since', 'soon']));
    expect('misuse: a flag with no value', misuse(['time', '--project', 'demo', '--since']));
    expect('misuse: a threshold that is not minutes', misuse(['time', '--project', 'demo', '--answer-minutes', 'soon']));
    expect('the text names the four buckets', ['the model thinking', 'tools running', 'the owner answering', 'nobody']
      .every((w) => run(['time', '--project', 'demo']).includes(w)));
  } finally {
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
