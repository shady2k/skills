#!/usr/bin/env node
// The run journal: one record per feature run, kept outside the repository, so
// that time estimates and the owner's attention are measured, not guessed.
// take-task owns this file; close-out and ask-shady2k carry copies of it.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

const STOP_REASONS = ['owner', 'missing'];
const KINDS = ['stop', 'decision', 'ci'];
const RESULTS = ['pull-request', 'abandoned', 'stopped'];
const ACCEPTED = ['as-is', 'after-changes', 'abandoned'];
const GRADES = ['R0', 'R1', 'R2', 'R3'];
const IDLE = 5 * 60e3; // a gap longer than this is someone away, not someone working

class Usage extends Error {}

const stateDir = () =>
  process.env.SHADY2K_STATE_DIR ||
  join(process.env.XDG_STATE_HOME || join(homedir(), '.local/state'), 'shady2k-skills');

function projectName(given) {
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

const runsDir = (project) => join(stateDir(), 'runs', project);
const now = () => new Date().toISOString();
const minutes = (a, b) => (Date.parse(b) - Date.parse(a)) / 60e3;
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'run';

function load(project, ref) {
  const path = ref.endsWith('.json') && existsSync(ref) ? ref : join(runsDir(project), `${ref}.json`);
  if (!existsSync(path)) throw new Usage(`no run record ${ref}`);
  return { path, run: JSON.parse(readFileSync(path, 'utf8')) };
}

const save = (path, run) => writeFileSync(path, `${JSON.stringify(run, null, 2)}\n`);

function all(project) {
  const dir = runsDir(project);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

function count(opts, key) {
  if (opts[key] === undefined) return 0;
  const n = Number(opts[key]);
  if (!Number.isInteger(n) || n < 0) throw new Usage(`--${key} needs a whole number`);
  return n;
}

function oneOf(opts, key, allowed) {
  if (!allowed.includes(opts[key])) throw new Usage(`--${key} is one of ${allowed.join(', ')}`);
  return opts[key];
}

function positive(opts, key) {
  const n = Number(opts[key]);
  if (opts[key] === undefined || !Number.isFinite(n) || n < 0) throw new Usage(`--${key} needs minutes`);
  return n;
}

// The session running this command, where the harness says which it is.
const HERE = [['claude-code', 'CLAUDE_CODE_SESSION_ID'], ['codex', 'CODEX_THREAD_ID'], ['codex', 'CODEX_SESSION_ID']];

function session(opts) {
  if (!opts.harness !== !opts.session) throw new Usage('--harness and --session go together');
  if (opts.session) return [{ harness: opts.harness, id: opts.session, at: now() }];
  const [harness, key] = HERE.find(([, k]) => process.env[k]) || [];
  return harness ? [{ harness, id: process.env[key], at: now() }] : [];
}

// ---- transcripts: what the owner and the agent actually spent -------------

function findFile(root, name, depth = 6) {
  if (!existsSync(root) || depth < 0) return null;
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      const found = findFile(path, name, depth - 1);
      if (found) return found;
    } else if (entry === `${name}.jsonl` || (entry.endsWith('.jsonl') && entry.includes(name))) return path;
  }
  return null;
}

function transcript(s) {
  const lines = (path) => readFileSync(path, 'utf8').split('\n').filter(Boolean).flatMap((l) => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });
  const events = [];
  if (/claude/i.test(s.harness)) {
    const path = findFile(join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects'), s.id, 2);
    if (!path) return null;
    const seen = new Set();
    for (const d of lines(path)) {
      if (d.isSidechain || d.isMeta || !d.timestamp) continue;
      const c = d.message?.content;
      if (d.type === 'user' && (typeof c === 'string' || (Array.isArray(c) && c.some((x) => x.type === 'text'))))
        events.push({ t: d.timestamp, who: 'user' });
      else if (d.type === 'user' || d.type === 'assistant') events.push({ t: d.timestamp, who: 'agent' });
      const u = d.type === 'assistant' && d.message?.usage;
      if (u && !seen.has(d.requestId)) {
        seen.add(d.requestId);
        events.at(-1).tokens = {
          input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0),
          output: u.output_tokens || 0,
        };
      }
    }
  } else if (/codex/i.test(s.harness)) {
    const path = findFile(join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'sessions'), s.id);
    if (!path) return null;
    let last = { input: 0, output: 0 };
    for (const d of lines(path)) {
      const p = d.payload || {};
      if (d.type === 'event_msg' && p.type === 'user_message') events.push({ t: d.timestamp, who: 'user' });
      else if (d.type === 'response_item' || (d.type === 'event_msg' && p.type === 'agent_message'))
        events.push({ t: d.timestamp, who: 'agent' });
      else if (d.type === 'event_msg' && p.type === 'token_count' && p.info?.total_token_usage) {
        const total = p.info.total_token_usage;
        const next = { input: total.input_tokens || 0, output: total.output_tokens || 0 };
        events.push({ t: d.timestamp, who: 'meter', tokens: { input: next.input - last.input, output: next.output - last.output } });
        last = next;
      }
    }
  } else return null;
  return { events };
}

// Attention: each owner message costs the time since the previous event, up to
// IDLE (reading, thinking, typing). Agent time: gaps before agent events, up to IDLE.
function spend(run) {
  const from = Date.parse(run.startedAt);
  const to = Date.parse(run.finishedAt || run.verdict?.at || now());
  const out = { found: 0, missing: 0, ownerMessages: 0, attentionMinutes: 0, agentMinutes: 0, input: 0, output: 0 };
  for (const s of run.sessions || []) {
    const t = transcript(s);
    if (!t) { out.missing++; continue; }
    out.found++;
    let prev = null;
    for (const e of t.events) {
      const at = Date.parse(e.t);
      if (at < from || at > to) { prev = at; continue; }
      const gap = prev === null ? 0 : Math.min(at - prev, IDLE);
      if (e.who === 'user') { out.ownerMessages++; out.attentionMinutes += gap / 60e3; }
      else if (e.who === 'agent') out.agentMinutes += gap / 60e3;
      if (e.tokens) { out.input += e.tokens.input; out.output += e.tokens.output; }
      prev = at;
    }
  }
  return out;
}

// ---- figures ---------------------------------------------------------------

const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};
const round = (n) => Math.round(n);

function pace(project, opts) {
  const done = all(project).filter((r) => r.finishedAt && r.result === 'pull-request' && r.estimate);
  const tasks = opts.tasks === undefined ? null : count(opts, 'tasks');
  const out = { runs: done.length };
  if (done.length < 3) return { ...out, enough: false };
  const actual = done.map((r) => minutes(r.startedAt, r.finishedAt));
  const ratio = done.map((r, i) => actual[i] / Math.max(1, r.estimate.workMinutes + r.estimate.waitMinutes));
  out.enough = true;
  out.estimateRatio = +quantile(ratio, 0.5).toFixed(2);
  const perTask = done.filter((r) => r.estimate.tasks > 0).map((r) => minutes(r.startedAt, r.finishedAt) / r.estimate.tasks);
  if (tasks && perTask.length >= 3) {
    out.basis = `${perTask.length} runs, per task`;
    out.low = round(quantile(perTask, 0.25) * tasks);
    out.high = round(quantile(perTask, 0.75) * tasks);
  } else {
    out.basis = `${done.length} runs, whole runs`;
    out.low = round(quantile(actual, 0.25));
    out.high = round(quantile(actual, 0.75));
  }
  return out;
}

function report(project, opts) {
  const runs = all(project);
  const judged = runs.filter((r) => r.verdict);
  const accepted = judged.filter((r) => r.verdict.accepted !== 'abandoned');
  const autonomous = accepted.filter((r) => !r.verdict.corrections && !r.verdict.rescues);
  const sum = (rs, f) => rs.reduce((n, r) => n + f(r), 0);
  const stops = runs.flatMap((r) => (r.events || []).filter((e) => e.kind === 'stop'));
  const out = {
    runs: runs.length,
    finished: runs.filter((r) => r.finishedAt).length,
    judged: judged.length,
    acceptedAsIs: judged.filter((r) => r.verdict.accepted === 'as-is').length,
    acceptedAfterChanges: judged.filter((r) => r.verdict.accepted === 'after-changes').length,
    abandoned: judged.filter((r) => r.verdict.accepted === 'abandoned').length,
    autonomous: autonomous.length,
    stops: { owner: stops.filter((e) => e.reason === 'owner').length, missing: stops.filter((e) => e.reason === 'missing').length },
    avoidableQuestions: sum(judged, (r) => r.verdict.avoidableQuestions),
    missedEscalations: sum(judged, (r) => r.verdict.missedEscalations),
    corrections: sum(judged, (r) => r.verdict.corrections),
    rescues: sum(judged, (r) => r.verdict.rescues),
    recoveries: Object.fromEntries(GRADES.map((g) => [g, sum(runs, (r) => (r.recoveries || []).filter((x) => x.grade === g).length)])),
    pace: pace(project, {}),
    open: runs.filter((r) => !r.finishedAt).length,
    pastForecast: stalled(project).filter((r) => r.pastForecast).length,
  };
  if (!opts['no-transcripts']) {
    const spent = accepted.map(spend).filter((s) => s.found);
    const attention = sum(spent, (s) => s.attentionMinutes);
    out.spend = {
      runsMeasured: spent.length,
      attentionMinutes: round(attention),
      acceptedPerAttentionHour: spent.length && attention ? +(spent.length / (attention / 60)).toFixed(2) : null,
      medianAgentMinutes: spent.length ? round(quantile(spent.map((s) => s.agentMinutes), 0.5)) : null,
      medianTokens: spent.length ? round(quantile(spent.map((s) => s.input + s.output), 0.5)) : null,
      sessionsWithoutTranscript: sum(accepted.map(spend), (s) => s.missing),
    };
  }
  return out;
}

// One run's measured numbers, for the comment that carries them off this
// machine: the journal is local state, a tracker comment is read from anywhere.
function summary(r) {
  const stops = (r.events || []).filter((e) => e.kind === 'stop');
  const out = {
    run: r.id, feature: r.feature, startedAt: r.startedAt, finishedAt: r.finishedAt || null,
    result: r.result || 'running',
    estimatedMinutes: r.estimate.workMinutes + r.estimate.waitMinutes,
    tookMinutes: round(minutes(r.startedAt, r.finishedAt || now())),
    tasks: r.estimate.tasks, stages: r.estimate.stages,
    stops: { owner: stops.filter((e) => e.reason === 'owner').length, missing: stops.filter((e) => e.reason === 'missing').length },
    ci: (r.events || []).filter((e) => e.kind === 'ci').length,
    accepted: r.verdict ? r.verdict.accepted : null,
  };
  const s = spend(r);
  if (s.found) out.spend = {
    ownerMessages: s.ownerMessages, attentionMinutes: round(s.attentionMinutes),
    agentMinutes: round(s.agentMinutes), input: s.input, output: s.output,
  };
  return out;
}

function describeSummary(s) {
  const lines = [
    `Run ${s.run}, ${s.result}${s.accepted ? `, accepted ${s.accepted}` : ''}, ${(s.finishedAt || s.startedAt).slice(0, 10)}`,
    `Estimated ${s.estimatedMinutes} min for ${s.tasks} task(s) in ${s.stages} stage(s); took ${s.tookMinutes} min`,
    `Stops: for the owner ${s.stops.owner}, missing information ${s.stops.missing}; CI runs ${s.ci}`,
  ];
  lines.push(s.spend
    ? `Owner attention ${s.spend.attentionMinutes} min over ${s.spend.ownerMessages} message(s); ` +
      `agent ${s.spend.agentMinutes} min; tokens ${s.spend.input} in, ${s.spend.output} out`
    : 'Owner attention and agent time not measured: no transcript found');
  return lines.join('\n');
}

// Runs that started and never came back: an unattended run cannot report its
// own death, so what it leaves is a record with no end, found by whoever looks.
function stalled(project) {
  return all(project).filter((r) => !r.finishedAt).map((r) => {
    const events = r.events || [];
    const last = events.length ? events.at(-1).at : (r.sessions || []).map((x) => x.at).pop() || r.startedAt;
    const e = events.at(-1);
    return {
      run: r.id, feature: r.feature, startedAt: r.startedAt,
      estimatedMinutes: r.estimate.workMinutes + r.estimate.waitMinutes,
      runningMinutes: round(minutes(r.startedAt, now())),
      quietMinutes: round(minutes(last, now())),
      lastEvent: e ? `${e.kind}${e.reason ? ` (${e.reason})` : ''}` : null,
      pastForecast: minutes(r.startedAt, now()) > r.estimate.workMinutes + r.estimate.waitMinutes,
    };
  });
}

function describeStalled(rows) {
  if (!rows.length) return 'No run is open.';
  const late = rows.filter((r) => r.pastForecast);
  const line = (r) => `${r.run}: ${r.runningMinutes} min against a forecast of ${r.estimatedMinutes}, ` +
    `quiet ${r.quietMinutes} min, last ${r.lastEvent || 'nothing recorded'} \u2014 ${r.feature}`;
  const out = late.length
    ? [`${late.length} run(s) past their forecast with no end recorded:`, ...late.map(line)]
    : ['No run is past its forecast.'];
  const running = rows.filter((r) => !r.pastForecast);
  if (running.length) out.push(`${running.length} run(s) still inside their forecast.`);
  return out.join('\n');
}

function describePace(p) {
  if (!p.enough) return `Too little history for a measured estimate: ${p.runs} finished run(s), 3 needed. Any estimate is a guess.`;
  return `Similar work took ${p.low}-${p.high} minutes (${p.basis}). ` +
    `Runs took ${p.estimateRatio} times their estimate (median): correct a new estimate by that.`;
}

// ---- commands ----------------------------------------------------------------

function run(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const key = a.slice(2);
    if (['json', 'no-transcripts'].includes(key)) { opts[key] = true; continue; }
    if (i + 1 >= rest.length) throw new Usage(`${a} needs a value`);
    opts[key] = rest[++i];
  }
  const project = () => projectName(opts.project);
  const ref = () => {
    if (positional.length !== 1) throw new Usage(`${command} needs one run: its id or path`);
    return load(project(), positional[0]);
  };
  const print = (value, text) => (opts.json ? `${JSON.stringify(value, null, 2)}` : text);

  switch (command) {
    case 'start': {
      if (!opts.feature) throw new Usage('start needs --feature "<title>"');
      const record = {
        version: 1, project: project(), feature: opts.feature, startedAt: now(),
        estimate: {
          workMinutes: positive(opts, 'work'), waitMinutes: positive(opts, 'wait'),
          tasks: count(opts, 'tasks'), stages: count(opts, 'stages'), basis: opts.basis || null,
        },
        sessions: session(opts), events: [], recoveries: [],
      };
      const dir = runsDir(record.project);
      mkdirSync(dir, { recursive: true });
      const base = `${record.startedAt.slice(0, 10)}-${slug(opts.feature)}`;
      let id = base;
      for (let n = 2; existsSync(join(dir, `${id}.json`)); n++) id = `${base}-${n}`;
      record.id = id;
      save(join(dir, `${id}.json`), record);
      return print(record, `${id}\n${join(dir, `${id}.json`)}`);
    }
    case 'session': {
      const { path, run: r } = ref();
      const s = session(opts);
      if (!s.length) throw new Usage('this harness does not say which session this is: pass --harness and --session');
      if (!r.sessions.some((x) => x.id === s[0].id)) r.sessions.push(...s);
      save(path, r);
      return print(r, `${r.id}: ${r.sessions.length} session(s)`);
    }
    case 'event': {
      const { path, run: r } = ref();
      const e = { at: now(), kind: oneOf(opts, 'kind', KINDS), note: opts.note || null };
      if (e.kind === 'stop') e.reason = oneOf(opts, 'reason', STOP_REASONS);
      r.events.push(e);
      save(path, r);
      return print(r, `${r.id}: ${e.kind} recorded`);
    }
    case 'finish': {
      const { path, run: r } = ref();
      r.result = oneOf(opts, 'result', RESULTS);
      r.finishedAt = now();
      if (opts.pr) r.pr = opts.pr;
      save(path, r);
      const took = minutes(r.startedAt, r.finishedAt);
      const est = r.estimate.workMinutes + r.estimate.waitMinutes;
      return print(r, `${r.id}: ${r.result} after ${round(took)} min, estimated ${est} min`);
    }
    case 'verdict': {
      const { path, run: r } = ref();
      r.verdict = {
        at: now(), accepted: oneOf(opts, 'accepted', ACCEPTED),
        avoidableQuestions: count(opts, 'avoidable'), missedEscalations: count(opts, 'missed'),
        corrections: count(opts, 'corrections'), rescues: count(opts, 'rescues'), note: opts.note || null,
      };
      save(path, r);
      return print(r, `${r.id}: verdict ${r.verdict.accepted}`);
    }
    case 'recovery': {
      const { path, run: r } = ref();
      const x = { at: now(), grade: oneOf(opts, 'grade', GRADES), from: opts.from || null, to: opts.to || null, note: opts.note || null };
      r.recoveries.push(x);
      save(path, r);
      return print(r, `${r.id}: recovery ${x.grade}`);
    }
    case 'list': {
      const runs = all(project());
      return print(runs, runs.map((r) =>
        `${r.id}  ${r.result || 'running'}${r.verdict ? `, ${r.verdict.accepted}` : ''}  ${r.feature}`).join('\n') || 'no runs');
    }
    case 'stalled': {
      const rows = stalled(project());
      return print(rows, describeStalled(rows));
    }
    case 'summary': {
      const { run: r } = ref();
      const out = summary(r);
      return print(out, describeSummary(out));
    }
    case 'pace': {
      const p = pace(project(), opts);
      return print(p, describePace(p));
    }
    case 'report': {
      const r = report(project(), opts);
      const lines = [
        `Runs ${r.runs}, finished ${r.finished}, judged by the owner ${r.judged}`,
        `Accepted as is ${r.acceptedAsIs}, after changes ${r.acceptedAfterChanges}, abandoned ${r.abandoned}`,
        `Delivered without corrections or rescue ${r.autonomous} of ${r.judged - r.abandoned} accepted`,
        `Stops: for the owner ${r.stops.owner}, missing information ${r.stops.missing}`,
        `Avoidable questions ${r.avoidableQuestions}, missed escalations ${r.missedEscalations}, corrections ${r.corrections}, rescues ${r.rescues}`,
        `Recoveries ${GRADES.map((g) => `${g} ${r.recoveries[g]}`).join(', ')}`,
        `Open runs ${r.open}, of them past their forecast with no end recorded ${r.pastForecast}`,
        describePace(r.pace),
      ];
      if (r.spend) lines.push(r.spend.runsMeasured
        ? `Owner attention ${r.spend.attentionMinutes} min over ${r.spend.runsMeasured} accepted runs: ` +
          `${r.spend.acceptedPerAttentionHour} accepted features per hour of attention; ` +
          `median agent time ${r.spend.medianAgentMinutes} min, median tokens ${r.spend.medianTokens}`
        : 'No transcripts found for accepted runs: attention and cost unknown');
      return print(r, lines.join('\n'));
    }
    default:
      throw new Usage(`unknown command ${command ?? '(none)'}`);
  }
}

const HELP = `runs.mjs start --feature <title> --work <min> --wait <min> [--tasks N] [--stages N] [--basis <text>] [--harness <h> --session <id>]
runs.mjs session <run> [--harness <h> --session <id>]
start and session record the current session by themselves where the harness names it.
runs.mjs event <run> --kind stop|decision|ci [--reason owner|missing] [--note <text>]
runs.mjs finish <run> --result pull-request|abandoned|stopped [--pr <url>]
runs.mjs verdict <run> --accepted as-is|after-changes|abandoned [--avoidable N] [--missed N] [--corrections N] [--rescues N] [--note <text>]
runs.mjs recovery <run> --grade R0|R1|R2|R3 [--from <h>] [--to <h>] [--note <text>]
runs.mjs summary <run>   one run's measured numbers, for the tracker comment that carries them
runs.mjs stalled         runs that started and recorded no end, and which passed their forecast
runs.mjs list | pace [--tasks N] | report [--no-transcripts]
Every command takes [--project <name>] (default: the checkout's main folder name) and [--json].
Records live in $SHADY2K_STATE_DIR, else $XDG_STATE_HOME/shady2k-skills, else ~/.local/state/shady2k-skills.
Exit 0 done, 2 misuse.`;

function selftest() {
  const home = mkdtempSync(join(tmpdir(), 'runs-selftest-'));
  const saved = { ...process.env };
  process.env.SHADY2K_STATE_DIR = join(home, 'state');
  process.env.CLAUDE_CONFIG_DIR = join(home, 'claude');
  process.env.CODEX_HOME = join(home, 'codex');
  for (const [, key] of HERE) delete process.env[key];
  const failures = [];
  const expect = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failures.push(name); };
  const cli = (...a) => run([...a, '--project', 'demo']);
  const misuse = (a) => { try { run(a); return false; } catch (e) { return e instanceof Usage; } };
  try {
    // Four finished runs with back-dated times; the model estimated 30 minutes each.
    const took = [60, 80, 100, 120];
    const ids = took.map((m, i) => {
      const id = cli('start', '--feature', `Feature ${i}`, '--work', '20', '--wait', '10', '--tasks', '2',
        '--harness', i === 0 ? 'claude-code' : 'codex', '--session', `s${i}`).split('\n')[0];
      const path = join(process.env.SHADY2K_STATE_DIR, 'runs', 'demo', `${id}.json`);
      const r = JSON.parse(readFileSync(path, 'utf8'));
      const start = Date.parse('2026-01-01T10:00:00Z') + i * 864e5;
      r.startedAt = new Date(start).toISOString();
      r.finishedAt = new Date(start + m * 60e3).toISOString();
      r.result = 'pull-request';
      save(path, r);
      return id;
    });
    expect('start names a run after its date and feature', /^\d{4}-\d{2}-\d{2}-feature-0$/.test(ids[0]));
    const again = cli('start', '--feature', 'Feature 0', '--work', '1', '--wait', '1').split('\n')[0];
    expect('a second run of the same feature on the same day gets its own record', again.endsWith('feature-0-2'));
    process.env.CLAUDE_CODE_SESSION_ID = 'here';
    cli('session', again);
    cli('session', again);
    const here = JSON.parse(cli('session', again, '--json')).sessions;
    delete process.env.CLAUDE_CODE_SESSION_ID;
    expect('the current session is found by itself and added once', here.length === 1 && here[0].id === 'here' && here[0].harness === 'claude-code');
    cli('event', ids[0], '--kind', 'stop', '--reason', 'owner', '--note', 'logout semantics');
    cli('event', ids[1], '--kind', 'stop', '--reason', 'missing');
    cli('verdict', ids[0], '--accepted', 'as-is', '--avoidable', '1');
    cli('verdict', ids[1], '--accepted', 'after-changes', '--corrections', '1', '--missed', '1');
    cli('verdict', ids[2], '--accepted', 'abandoned', '--rescues', '1');
    cli('recovery', ids[3], '--grade', 'R3', '--from', 'claude-code', '--to', 'codex');

    const p = JSON.parse(cli('pace', '--tasks', '2', '--json'));
    expect('pace measures from four finished runs', p.enough && p.runs === 4);
    expect('pace reports how far estimates were off (median 90/30 = 3x)', p.estimateRatio === 3);
    expect('pace gives a range for the size asked', p.low === 75 && p.high === 105);

    // A Claude transcript for run 0 (10:00-11:00): the owner answers after 2
    // minutes, later returns after 36 minutes away (capped at 5); one response
    // is split over two lines of the same request; a message after the run is
    // not the run's.
    const lines = [
      ['user', '2026-01-01T10:00:00Z', 'run it'],
      ['assistant', '2026-01-01T10:04:00Z', null, 'r1'],
      ['assistant', '2026-01-01T10:08:00Z', null, 'r2'],
      ['user', '2026-01-01T10:10:00Z', 'yes'],
      ['assistant', '2026-01-01T10:14:00Z', null, 'r3'],
      ['assistant', '2026-01-01T10:14:01Z', null, 'r3'],
      ['user', '2026-01-01T10:50:00Z', 'back'],
      ['assistant', '2026-01-01T10:51:00Z', null, 'r4'],
      ['user', '2026-01-01T13:00:00Z', 'after the run'],
    ].map(([type, timestamp, text, requestId]) => JSON.stringify(type === 'user'
      ? { type, timestamp, message: { content: text } }
      : { type, timestamp, requestId, message: { content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 100, output_tokens: 10 } } }));
    mkdirSync(join(home, 'claude', 'projects', 'x'), { recursive: true });
    writeFileSync(join(home, 'claude', 'projects', 'x', 's0.jsonl'), `${lines.join('\n')}\n`);
    const r = JSON.parse(cli('report', '--json'));
    expect('report counts verdicts', r.acceptedAsIs === 1 && r.acceptedAfterChanges === 1 && r.abandoned === 1);
    expect('only a run without corrections or rescue counts as delivered alone', r.autonomous === 1);
    expect('report separates stops for the owner from missing information', r.stops.owner === 1 && r.stops.missing === 1);
    expect('report counts what the owner judged', r.avoidableQuestions === 1 && r.missedEscalations === 1 && r.corrections === 1 && r.rescues === 1);
    expect('report counts recovery grades', r.recoveries.R3 === 1 && r.recoveries.R0 === 0);
    expect('attention is the owner\'s gaps, capped at five minutes', r.spend.runsMeasured === 1 && r.spend.attentionMinutes === 7);
    expect('agent time is the gaps before agent events', r.spend.medianAgentMinutes === 13);
    expect('tokens are summed once per request', r.spend.medianTokens === 440);
    expect('a session without a transcript is counted as unmeasured', r.spend.sessionsWithoutTranscript === 1);
    expect('too little history says so', !JSON.parse(run(['pace', '--project', 'empty', '--json'])).enough);

    const open = cli('start', '--feature', 'Open run', '--work', '10', '--wait', '5').split('\n')[0];
    const openPath = join(process.env.SHADY2K_STATE_DIR, 'runs', 'demo', `${open}.json`);
    const stale = JSON.parse(readFileSync(openPath, 'utf8'));
    stale.startedAt = new Date(Date.now() - 120 * 60e3).toISOString();
    save(openPath, stale);
    const fresh = cli('start', '--feature', 'Fresh run', '--work', '60', '--wait', '30').split('\n')[0];
    const late = JSON.parse(cli('stalled', '--json'));
    expect('a run with no end recorded is found', late.some((r) => r.run === open) && late.some((r) => r.run === fresh));
    expect('only a run past its forecast is called late', late.find((r) => r.run === open).pastForecast
      && !late.find((r) => r.run === fresh).pastForecast);
    expect('a late run says how long it has been quiet', late.find((r) => r.run === open).quietMinutes >= 119);
    expect('finished runs are not open', !late.some((r) => ids.includes(r.run)));
    const withOpen = JSON.parse(cli('report', '--no-transcripts', '--json'));
    expect('the report counts open runs and late ones', withOpen.open === 3 && withOpen.pastForecast === 1);
    cli('finish', open, '--result', 'stopped');
    expect('ending the record closes the question', !JSON.parse(cli('stalled', '--json')).some((r) => r.run === open));

    const sum = JSON.parse(cli('summary', ids[0], '--json'));
    expect('summary gives one run\'s estimate against what it took', sum.estimatedMinutes === 30 && sum.tookMinutes === 60);
    expect('summary carries the stops, the verdict and the size', sum.stops.owner === 1 && sum.accepted === 'as-is' && sum.tasks === 2);
    expect('summary carries the measured attention where a transcript exists', sum.spend.attentionMinutes === 7 && sum.spend.ownerMessages === 3);
    const unmeasured = JSON.parse(cli('summary', ids[1], '--json'));
    expect('summary says nothing it did not measure', unmeasured.spend === undefined);
    expect('the text says both numbers', cli('summary', ids[0]).includes('estimated 30 min')
      || cli('summary', ids[0]).includes('Estimated 30 min'));

    expect('misuse: unknown command', misuse(['frobnicate', '--project', 'demo']));
    expect('misuse: start without estimate', misuse(['start', '--project', 'demo', '--feature', 'x']));
    expect('misuse: stop without reason', misuse(['event', ids[0], '--project', 'demo', '--kind', 'stop']));
    expect('misuse: bad verdict', misuse(['verdict', ids[0], '--project', 'demo', '--accepted', 'maybe']));
    expect('misuse: negative count', misuse(['verdict', ids[0], '--project', 'demo', '--accepted', 'as-is', '--rescues', '-1']));
    expect('misuse: harness without session', misuse(['session', ids[0], '--project', 'demo', '--harness', 'codex']));
    expect('misuse: no session given or found', misuse(['session', ids[0], '--project', 'demo']));
    expect('misuse: missing run', misuse(['finish', 'nope', '--project', 'demo', '--result', 'abandoned']));
    expect('misuse: summary without a run', misuse(['summary', '--project', 'demo']));
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

process.exitCode = main();
