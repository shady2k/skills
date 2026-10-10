#!/usr/bin/env node
// How the work went, kept in the project's tracker and nowhere else. Every
// fact is a record on the item it is about (time-format.mjs says what a record
// is): a session's claim of an item, with the forecast and the promised time;
// the receipt that ends it, with what the session spent, measured from its
// transcript; the stops, lone decisions and CI runs inside it; a feature's
// summary when it closes; the owner's verdict; how a resumed session picked
// the work up; the voids that retire a damaged or wrong record, since a
// tracker may only append. Nothing is kept on this machine, so every machine reads the
// same history.
//
// This script never talks to the tracker. It reads the project adapter's
// export (--backlog, or - for stdin) and prints the records to post, each
// under the item it goes on, exactly as they are to be posted: the numbers are
// the script's, never typed by an agent. What it measures, it measures from
// this machine's transcripts through the ledger beside it.
// take-task owns this file; close-out and ask-shady2k carry copies of it.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import {
  Usage, adapter, adapterNames, collect, conversationOf, current, hasAdapter, localStamp, measure, parseWhen,
  projectName, recordedShapes, sessionEnvVars, span, transcriptOf, union, unnamedTranscripts,
} from './ledger.mjs';
import {
  ACCEPTED, BUCKETS, ENDS, EVENTS, GRADES, PHASES, REASONS, RESULTS, ROLES, WORK,
  formatRecord, newSpanId, parseRecord, recordsOf, roundTable, spansOf,
} from './time-format.mjs';

// Where a record cannot be written here: the transcript is on another machine.
export class NotHere extends Error {}

const nowMs = () => Date.now();
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const minutes = (ms) => ms / 60e3;
const round = (n) => Math.round(n);

// ---- reading the tracker's export --------------------------------------------

function readBacklog(path) {
  if (!path) throw new Usage('--backlog <adapter export | -> is required: the records live in the tracker');
  let text;
  try { text = readFileSync(path === '-' ? 0 : path, 'utf8'); } catch (e) { throw new Usage(`cannot read the backlog ${path}: ${e.code || e.message}`); }
  let b;
  try { b = JSON.parse(text); } catch { throw new Usage(`the backlog ${path} is not JSON`); }
  if (!b || !Array.isArray(b.issues)) throw new Usage(`the backlog ${path} has no "issues" list: it is the adapter's export (model.md)`);
  return b;
}

function view(backlog) {
  const by = new Map(backlog.issues.map((i) => [i.id, i]));
  const children = new Map();
  for (const i of backlog.issues) if (i.parent) children.set(i.parent, [...(children.get(i.parent) || []), i.id]);
  const tree = (id, seen = new Set()) => {
    if (seen.has(id)) return [];
    seen.add(id);
    return [id, ...(children.get(id) || []).flatMap((c) => tree(c, seen))];
  };
  return { backlog, by, tree, ...spansOf(backlog) };
}

const item = (v, id) => {
  if (!id) throw new Usage('--item <id> is required');
  if (!v.by.has(id)) throw new Usage(`${id} is not in the backlog`);
  return v.by.get(id);
};

// ---- who is running this ---------------------------------------------------

// Who is running this: the adapters say which harness names the session it
// runs in, and omp and Prime Agent name none, so they are told with --harness
// and --session.
function thisSession(opts, { need = true } = {}) {
  if (!opts.harness !== !opts.session) throw new Usage('--harness and --session go together');
  // An explicit --harness and --session go through the adapters too, so a
  // harness this copy cannot read is refused here rather than written into a
  // record no copy of the set will ever be able to measure.
  const me = current({ harness: opts.harness ?? null, session: opts.session ?? null });
  if (me) return me;
  if (need) throw new Usage('this harness does not say which session this is: pass --harness and --session');
  return null;
}

const quiet = (args) => { try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };

// The protocol's full name for an agent: harness and role, the person it
// works for, the machine, the branch and its session.
function agentName(s, role, opts) {
  if (opts.agent) return opts.agent;
  const person = opts.person || quiet(['config', 'user.name']) || userInfo().username;
  const branch = quiet(['rev-parse', '--abbrev-ref', 'HEAD']) || 'no-branch';
  const short = { 'claude-code': 'claude', 'prime-agent': 'prime' }[s.harness] || s.harness;
  return `${short}-${role}:${person.replace(/\s+/g, '-')}@${hostname()}:${branch}#${String(s.id).slice(0, 8)}`;
}

// ---- measuring a span from this machine's transcripts ------------------------

let rawCache = null;
function raws(opts) {
  if (!rawCache) rawCache = collect(projectName(opts.project, opts.repo), { repo: opts.repo });
  return rawCache;
}
// A session placed in the project by git, or else one whose working copy is
// gone and whose transcript names the item the record is on, or that Jev was
// sure worked on it.
const judged = new Set();
const rawOf = (opts, key, item) => raws(opts).find((r) => `${r.harness}:${r.id}` === key) || (item ? transcriptOf(key, item, { judged }) : null);

// ---- asking Jev where the text does not say ----------------------------------

/**
 * Where the project agreed to Jev (the gate config, --config) and it is
 * available here, a gone working copy's transcript that never names the item
 * its record is on is put to Jev: did this session work on this item? Only a
 * sure yes places it; a sure no and an unsure answer leave it where it was,
 * and the unsure ones are named for the agent to read. Without --config, or
 * without consent, a key or the module, nothing is asked and nothing changes:
 * the text match alone decides, as it always did.
 */
export async function askJev(argv, { ask = null } = {}) {
  const [command, ...rest] = argv;
  const opts = parseArgs(rest);
  const out = { asked: 0, placed: [], unsure: [], failed: null };
  if (!opts.config || !['claim', 'receipt', 'finish', 'gaps', 'time'].includes(command)) return out;
  if ((command === 'claim' && !opts.recovered) || opts['no-transcripts'] || opts.unknown) return out;
  let jev;
  try { jev = await import('./jev.mjs'); } catch { return out; }
  let config;
  try { config = JSON.parse(readFileSync(opts.config, 'utf8')); } catch { throw new Usage(`cannot read the gate config ${opts.config}`); }
  try { jev.settings(config); } catch (e) { if (e instanceof jev.Unavailable) return out; throw new Usage(`the gate config's jev entry: ${e.message}`); }
  let v;
  let placed;
  try {
    v = view(readBacklog(opts.backlog));
    placed = new Set(raws(opts).map((r) => `${r.harness}:${r.id}`));
  } catch { return out; }
  // Only the spans this command measures.
  let spans = [];
  if (command === 'claim') {
    if (opts.harness && opts.session && opts.item) spans = [{ session: `${opts.harness}:${opts.session}`, item: opts.item }];
  } else if (command === 'receipt') {
    try { spans = [spanOf(v, opts)]; } catch { return out; }
  } else if (command === 'finish') {
    const me = thisSession(opts, { need: false });
    spans = me && v.by.has(opts.item) ? mineOpen(v, me.key).filter((s) => v.tree(opts.item).includes(s.item)) : [];
  } else {
    spans = openSpans(v).filter((s) => command !== 'time' || !opts.item || s.item === opts.item);
  }
  // A session is placed on one item or none: asked about several, only an
  // answer that picks exactly one of them places it.
  const bySession = new Map();
  for (const s of spans) {
    if (placed.has(s.session) || !v.by.has(s.item)) continue;
    const list = bySession.get(s.session) || bySession.set(s.session, []).get(s.session);
    if (!list.includes(s.item)) list.push(s.item);
  }
  const questions = [];
  for (const [key, items] of bySession)
    for (const item of items)
      for (const tr of unnamedTranscripts(key, item)) {
        const text = conversationOf(tr.path);
        if (text.trim()) questions.push({ key, item, text });
      }
  const yes = new Map();
  try {
    for (const item of [...new Set(questions.map((q) => q.item))]) {
      const it = v.by.get(item);
      const { answers } = await (ask || jev.ask)({ config, kind: 'check',
        items: questions.filter((q) => q.item === item).map((q) => ({ id: `${q.key}\t${q.item}`, text: q.text })),
        text: 'Did this agent session work on the tracker item described in the context (take it, build, fix, review or hand it in)?',
        options: { true: 'The session worked on this item.', false: 'The session worked on something else.' },
        context: `Item ${it.id}: ${it.title}\n\n${it.body || it.description || ''}` });
      out.asked += answers.length;
      for (const a of answers) {
        const key = a.id.split('\t')[0];
        if (a.settled && a.answer === 'true') yes.set(key, [...(yes.get(key) || []), a.id]);
        else if (!a.settled) out.unsure.push(a.id);
      }
    }
  } catch (e) {
    // Jev is a help here, never a condition: whatever went wrong, the text alone decides, as before.
    out.failed = e instanceof jev.Unavailable ? e.message : 'Jev could not be asked';
    return { ...out, placed: [], unsure: [] };
  }
  for (const [, ids] of yes) {
    if (ids.length === 1) { judged.add(ids[0]); out.placed.push(ids[0]); } else out.unsure.push(...ids);
  }
  return out;
}

/** One command, as the command line runs it: Jev first where it may help, then the command. */
export async function commandLine(args, { ask = null, err = (s) => console.error(s) } = {}) {
  const j = await askJev(args, { ask });
  const text = run(args);
  if (j.failed) err(`Jev was not used (${j.failed}); a transcript that does not name its item is not placed.`);
  if (j.unsure.length) err(`Jev could not tell whether these sessions worked on these items; read them to decide:\n${j.unsure.map((u) => `  ${u.replace('\t', ' on ')}`).join('\n')}`);
  return text;
}

// Where a span ends: its receipt; else the session's next claim, which ends it
// whether or not its receipt was written; else now, or wherever the session's
// record stops.
const endOf = (s, raw, at = nowMs()) => Math.min(s.end ?? Infinity, s.next ? s.next.start : Infinity, raw ? raw.last : at, at);

/**
 * What a session spent on its span, as whole minutes by phase and by who spent
 * them, adding up to the span's own length. A stretch of the span the
 * transcript does not cover (the claim made before the session's first
 * record, say) is nobody's.
 */
function measureSpan(raw, from, to) {
  const m = to > from ? measure(raw, { windows: [{ start: from, end: to }] }) : null;
  const cells = {};
  let covered = 0;
  if (m) {
    for (const [p, v] of Object.entries(m.phases)) {
      const phase = PHASES.includes(p) ? p : 'unattributed';
      const row = (cells[phase] ||= Object.fromEntries(BUCKETS.map((b) => [b, 0])));
      row.model += v.model; row.tools += v.tool; row.coord += v.coordination;
      row.answer += v.answer; row.away += v.away; row.idle += v.idle;
    }
    covered = m.wallMinutes;
  }
  const length = minutes(Math.max(0, to - from));
  if (length - covered > 1e-6) {
    const row = (cells.unattributed ||= Object.fromEntries(BUCKETS.map((b) => [b, 0])));
    row.idle += length - covered;
  }
  return { table: roundTable(cells, length), whole: m ? m.whole : true, occupied: m ? m.occupied : [] };
}

function receiptFor(v, s, opts, { end, reason, note, recovered = false, at = nowMs() }) {
  adapter(harnessOf(s.session));
  const raw = rawOf(opts, s.session, s.item);
  if (!raw) throw new NotHere(`the transcript of ${s.session} (${s.claim.fields.agent}) is not on this machine: its receipt is written where it is, or closed with --unknown where no machine has it; never typed by hand, which the gate refuses as damaged`);
  const from = s.start;
  const to = Math.max(from, endOf(s, raw, at));
  const { table, whole } = measureSpan(raw, from, to);
  if (raw.by === 'Jev judged it the item\'s') note = [note, 'the transcript never names this item; Jev judged the session worked on it'].filter(Boolean).join('; ');
  const fields = { span: s.id, from: iso(from), to: iso(to), end, reason, note, recovered: recovered ? iso(nowMs()) : undefined, cut: whole ? undefined : 'yes' };
  return { item: s.item, body: formatRecord('receipt', fields, table) };
}

const openSpans = (v) => v.spans.filter((s) => s.claim && !s.receipt && !s.conflict.length);
const mineOpen = (v, key) => openSpans(v).filter((s) => s.session === key && !s.next);

// The harness a record's session key names, and the refusal where this copy of
// the set has no adapter for it: a session it cannot read is never quietly
// counted as a session whose time is unknown.
const harnessOf = (key) => { const k = String(key ?? ''); return k.slice(0, k.indexOf(':')); };

// ---- forecasts ---------------------------------------------------------------

function parseForecast(text) {
  const rows = {};
  for (const part of String(text).split(',').map((x) => x.trim()).filter(Boolean)) {
    const [p, n] = part.split('=').map((x) => x.trim());
    if (!PHASES.includes(p)) throw new Usage(`--forecast: "${p}" is not a phase (${PHASES.join(', ')})`);
    if (!/^\d+$/.test(n || '')) throw new Usage(`--forecast: ${p} needs whole minutes`);
    rows[p] = { forecast: Number(n) };
  }
  if (!Object.keys(rows).length) throw new Usage('--forecast needs phase=minutes, comma-separated');
  rows.total = { forecast: Object.values(rows).reduce((a, r) => a + r.forecast, 0) };
  return { columns: ['forecast'], rows };
}

const forecastOf = (claim) => (claim?.table ? Object.fromEntries(Object.entries(claim.table.rows).map(([p, r]) => [p, r.forecast])) : null);

// The feature's run: its coordinators' spans on the item itself, oldest first.
const runSpans = (v, id) => v.spans.filter((s) => s.item === id && s.claim && s.claim.fields.role === 'coordinator' && !s.conflict.length)
  .sort((a, b) => a.start - b.start);

// ---- the feature summary -----------------------------------------------------

function summaryFor(v, feature, opts, { result, pr, note, extra = [] }) {
  const ids = new Set(v.tree(feature.id));
  const spans = v.spans.filter((s) => ids.has(s.item) && s.claim && !s.conflict.length);
  const receipts = [...spans.filter((s) => s.receipt).map((s) => s.receipt), ...extra.map((e) => ({ ...parseRecord(e.body), item: e.item }))];
  const closed = new Set(receipts.map((r) => r.fields.span));
  const open = spans.filter((s) => !closed.has(s.id));
  const run = runSpans(v, feature.id);
  const first = spans.reduce((a, s) => Math.min(a, s.start), Infinity);
  if (!Number.isFinite(first)) throw new Usage(`${feature.id} has no claim: nothing was recorded as worked on it`);
  const forecast = forecastOf(run.find((s) => s.claim.table)?.claim) || {};
  const cols = ['forecast', 'work', ...BUCKETS, 'total'];
  const rows = {};
  const add = (p, c, n) => { const r = (rows[p] ||= Object.fromEntries(cols.map((k) => [k, 0]))); r[c] += n; };
  // The run's clock is its coordinator's: a worker whose time is unknown or
  // elsewhere leaves its effort by phase short, never the run incomplete.
  const worker = new Set(spans.filter((s) => s.claim.fields.role === 'worker').map((s) => s.id));
  // A harness this copy of the set cannot read is not a session whose time is
  // unknown: it is unreadable here, and the summary says so rather than
  // counting its span as one whose transcript is elsewhere.
  const unreadable = spans.filter((s) => !hasAdapter(harnessOf(s.session)));
  const unknown = receipts.filter((r) => r.fields.unknown === 'yes' && !worker.has(r.fields.span)).length;
  for (const r of receipts.filter((x) => x.table))
    for (const [p, row] of Object.entries(r.table.rows)) {
      if (p === 'total') continue;
      for (const b of BUCKETS) add(p, b, row[b]);
    }
  for (const p of Object.keys(forecast)) if (p !== 'total') add(p, 'forecast', 0);
  const haveForecast = Object.keys(forecast).length > 0;
  for (const [p, r] of Object.entries(rows)) {
    r.work = WORK.reduce((n, b) => n + r[b], 0);
    r.total = BUCKETS.reduce((n, b) => n + r[b], 0);
    r.forecast = haveForecast ? forecast[p] ?? 0 : null;
  }
  rows.total = Object.fromEntries(cols.map((c) => [c, Object.entries(rows).reduce((n, [, r]) => (r[c] === null ? null : n === null ? null : n + r[c]), 0)]));
  if (haveForecast) rows.total.forecast = Object.entries(rows).filter(([p]) => p !== 'total').reduce((n, [, r]) => n + r.forecast, 0);
  // How long the work occupied: every span's working stretches, laid over each
  // other so that parallel sessions count once. Only this machine's
  // transcripts can say it; a span whose transcript is elsewhere leaves it
  // partial, and says so.
  let missing = 0;
  const stretches = [];
  for (const s of spans) {
    if (!hasAdapter(harnessOf(s.session))) continue;
    const raw = rawOf(opts, s.session, s.item);
    if (!raw) { if (!worker.has(s.id)) missing++; continue; }
    const to = Math.max(s.start, endOf(s, raw));
    const family = raws(opts).filter((r) => r === raw || rootKey(r, opts) === s.session);
    for (const r of family) {
      const m = to > s.start ? measure(r, { windows: [{ start: s.start, end: to }] }) : null;
      if (m) stretches.push(...m.occupied);
    }
  }
  const occupied = stretches.length ? round(minutes(span(union(stretches)))) : null;
  const partial = missing || unreadable.length;
  const said = [note, unreadable.length
    ? `${unreadable.length} span(s) belong to a harness this copy of the set cannot read: unsupported here, so nothing is measured for them on this machine, and their time is not called unknown for that`
    : null].filter(Boolean).join('; ');
  const fields = {
    at: iso(nowMs()), result, started: iso(first), elapsed: round(minutes(nowMs() - first)),
    spans: spans.length, open: open.length, missing,
    occupied: occupied ?? undefined, 'occupied-partial': partial && occupied !== null ? 'yes' : undefined,
    forecast: haveForecast ? rows.total.forecast : undefined, unknown: unknown || undefined, pr, note: said || undefined,
  };
  return { item: feature.id, body: formatRecord('summary', fields, { columns: cols, rows }) };
}

// A subagent's or child thread's session answers to the one that started it.
function rootKey(r, opts) {
  let cur = r;
  const byId = new Map(raws(opts).map((x) => [x.id, x]));
  for (let i = 0; i < 5 && cur.parent && byId.get(cur.parent); i++) cur = byId.get(cur.parent);
  return cur === r && !r.parent ? null : `${cur.harness}:${cur.id}`;
}

// ---- what the records add up to ------------------------------------------------

const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};

// Finished runs: a summary on a feature, the run's claim beside it.
function finishedRuns(v) {
  return v.summaries.map((sm) => {
    const run = runSpans(v, sm.item);
    const claim = run.find((s) => s.claim.table)?.claim || run[0]?.claim || null;
    const n = (k) => (sm.fields[k] === undefined ? null : Number(sm.fields[k]));
    return {
      item: sm.item, result: sm.fields.result, occupied: n('occupied'),
      // A summary written while spans were still open, or with a transcript
      // on another machine, is an incomplete run and no reference for another.
      partial: sm.fields['occupied-partial'] === 'yes' || n('open') > 0 || n('missing') > 0 || n('unknown') > 0,
      forecast: n('forecast'), elapsed: n('elapsed'), tasks: claim?.fields.tasks ? Number(claim.fields.tasks) : null,
      table: sm.table.rows,
    };
  });
}

// A forecast is of the work: the agents working and waiting inside their
// turns, and the owner answering. His absence and nobody's gaps are not in it;
// the clock that holds them is said beside.
function pace(v, opts) {
  const done = finishedRuns(v).filter((r) => r.result === 'pull-request' && r.forecast && r.occupied !== null && !r.partial);
  const out = { runs: done.length };
  if (done.length < 3) return { ...out, enough: false };
  const tasks = opts.tasks === undefined ? null : Number(opts.tasks);
  if (tasks !== null && !(Number.isInteger(tasks) && tasks > 0)) throw new Usage('--tasks needs a whole number');
  const occupied = done.map((r) => r.occupied);
  out.enough = true;
  out.estimateRatio = +quantile(done.map((r) => r.occupied / Math.max(1, r.forecast)), 0.5).toFixed(2);
  // Whole runs' clock, for what it is: mostly the owner away and nobody's
  // gaps, which no forecast is of. Said beside, never as the promise.
  out.elapsedLow = round(quantile(done.map((r) => r.elapsed), 0.25));
  out.elapsedHigh = round(quantile(done.map((r) => r.elapsed), 0.75));
  out.gapShare = round(100 * quantile(done.filter((r) => r.elapsed > 0).map((r) => Math.max(0, r.elapsed - r.occupied) / r.elapsed), 0.5));
  const perTask = done.filter((r) => r.tasks > 0).map((r) => r.occupied / r.tasks);
  if (tasks && perTask.length >= 3) {
    out.basis = `${perTask.length} runs, per task`;
    out.low = round(quantile(perTask, 0.25) * tasks);
    out.high = round(quantile(perTask, 0.75) * tasks);
  } else {
    out.basis = `${done.length} runs, whole runs`;
    out.low = round(quantile(occupied, 0.25));
    out.high = round(quantile(occupied, 0.75));
  }
  // A starting forecast by phase: the middle of the range, split as past work
  // was split. Work no phase claimed is spread over those that did: a
  // forecast that is mostly "unattributed" says nothing of what the run is.
  const work = {};
  for (const r of done) for (const [p, row] of Object.entries(r.table)) if (p !== 'total') work[p] = (work[p] || 0) + row.work;
  if (Object.entries(work).some(([p, w]) => p !== 'unattributed' && w > 0)) delete work.unattributed;
  const all = Object.values(work).reduce((a, b) => a + b, 0);
  const mid = (out.low + out.high) / 2;
  out.proposal = all ? Object.entries(work).filter(([, w]) => w > 0).map(([p, w]) => `${p}=${Math.max(1, round((mid * w) / all))}`).join(',') : null;
  return out;
}

function describePace(p) {
  if (!p.enough) return `Too little history for a measured estimate: ${p.runs} finished run(s) with a forecast, 3 needed. Any estimate is a guess.`;
  return `Similar runs occupied ${p.low}-${p.high} minutes (${p.basis}), the waits inside their work counted: that is the forecast. ` +
    `Runs occupied ${p.estimateRatio} times their forecast (median): correct a new one by that.` +
    (p.proposal ? `\nA starting forecast by phase: --forecast ${p.proposal}` : '') +
    `\nNot a forecast: those runs lasted ${p.elapsedLow}-${p.elapsedHigh} minutes of clock (whole runs), ` +
    `${p.gapShare}% of it (median) the owner away or nobody working. The promised time adds only the absence the owner announces.`;
}

// Runs that started and never came back: a claim that promised a time, and
// no summary on its feature by then.
function stalled(v) {
  const summarized = new Set(v.summaries.map((s) => s.item));
  const out = [];
  const seen = new Set();
  for (const s of v.spans.filter((x) => x.claim?.fields.role === 'coordinator' && x.claim.fields.due && !x.conflict.length)) {
    if (summarized.has(s.item) || seen.has(s.item)) continue;
    seen.add(s.item);
    const records = v.spans.filter((x) => v.tree(s.item).includes(x.item)).flatMap((x) => [x.claim, x.receipt, ...x.events]).filter(Boolean);
    const last = Math.max(...records.map((r) => Date.parse(r.fields.to || r.fields.at)));
    const due = Date.parse(s.claim.fields.due);
    const e = v.spans.filter((x) => x.item === s.item).flatMap((x) => x.events).sort((a, b) => Date.parse(a.fields.at) - Date.parse(b.fields.at)).at(-1);
    out.push({
      item: s.item, title: v.by.get(s.item)?.title || '', startedAt: s.claim.fields.at, dueAt: iso(due),
      runningMinutes: round(minutes(nowMs() - s.start)), quietMinutes: round(minutes(nowMs() - last)),
      lastEvent: e ? `${e.fields.event}${e.fields.reason ? ` (${e.fields.reason})` : ''}` : null,
      pastForecast: nowMs() > due,
    });
  }
  return out;
}

function describeStalled(rows) {
  if (!rows.length) return 'No run is open.';
  const late = rows.filter((r) => r.pastForecast);
  const line = (r) => `${r.item}: ${r.runningMinutes} min on the clock, promised by ${localStamp(Date.parse(r.dueAt))}, ` +
    `quiet ${r.quietMinutes} min, last ${r.lastEvent || 'nothing recorded'} — ${r.title}`;
  const out = late.length ? [`${late.length} run(s) past their promised time with no summary:`, ...late.map(line)] : ['No run is past its promised time.'];
  const running = rows.filter((r) => !r.pastForecast);
  if (running.length) out.push(`${running.length} run(s) still inside their promised time.`);
  return out.join('\n');
}

function report(v) {
  const runs = finishedRuns(v);
  const verdicts = new Map(v.verdicts.map((r) => [r.item, r.fields]));
  const judged = [...verdicts.values()];
  const n = (x) => Number(x || 0);
  const sum = (f) => judged.reduce((a, x) => a + n(f(x)), 0);
  const events = v.spans.flatMap((s) => s.events);
  const stops = events.filter((e) => e.fields.event === 'stop');
  const accepted = judged.filter((x) => x.accepted !== 'abandoned');
  const measured = runs.filter((r) => r.occupied !== null);
  const complete = measured.filter((r) => !r.partial);
  const attention = runs.reduce((a, r) => a + (r.table.total?.answer || 0), 0);
  const running = new Set(v.spans.filter((s) => s.claim?.fields.role === 'coordinator').map((s) => s.item));
  for (const r of runs) running.delete(r.item);
  return {
    runs: runs.length + running.size, finished: runs.length, judged: judged.length,
    unjudged: runs.filter((r) => !verdicts.has(r.item)).length,
    acceptedAsIs: judged.filter((x) => x.accepted === 'as-is').length,
    acceptedAfterChanges: judged.filter((x) => x.accepted === 'after-changes').length,
    abandoned: judged.filter((x) => x.accepted === 'abandoned').length,
    autonomous: accepted.filter((x) => !n(x.corrections) && !n(x.rescues)).length,
    stops: { owner: stops.filter((e) => e.fields.reason === 'owner').length, missing: stops.filter((e) => e.fields.reason === 'missing').length },
    decisions: events.filter((e) => e.fields.event === 'decision').length,
    ci: events.filter((e) => e.fields.event === 'ci').length,
    avoidableQuestions: sum((x) => x.avoidable), missedEscalations: sum((x) => x.missed),
    corrections: sum((x) => x.corrections), rescues: sum((x) => x.rescues),
    recoveries: Object.fromEntries(GRADES.map((g) => [g, v.recoveries.filter((r) => r.fields.grade === g).length])),
    open: running.size,
    pastForecast: stalled(v).filter((r) => r.pastForecast).length,
    pace: pace(v, {}),
    spend: {
      runsMeasured: measured.length,
      partial: measured.filter((r) => r.partial).length,
      attentionMinutes: attention,
      acceptedPerAttentionHour: accepted.length && attention ? +(accepted.length / (attention / 60)).toFixed(2) : null,
      medianOccupiedMinutes: complete.length ? round(quantile(complete.map((r) => r.occupied), 0.5)) : null,
      medianWorkMinutes: runs.length ? round(quantile(runs.map((r) => r.table.total?.work || 0), 0.5)) : null,
    },
    damaged: v.damaged.length,
    // Tracked work whose span was never claimed, named rather than only
    // counted: a decrease of average concurrency that is really a gap.
    unclaimed: v.spans.filter((s) => s.receipt && !s.claim && !s.conflict.length)
      .map((s) => ({ item: s.item, span: s.id, from: s.receipt.fields.from, to: s.receipt.fields.to ?? null })),
  };
}

function describeReport(r) {
  const lines = [
    `Runs ${r.runs}, finished ${r.finished}, judged by the owner ${r.judged}`,
    `Accepted as is ${r.acceptedAsIs}, after changes ${r.acceptedAfterChanges}, abandoned ${r.abandoned}` +
      (r.unjudged ? `; ${r.unjudged} finished run(s) the owner never judged, so acceptance is unmeasured` : ''),
    `Delivered without corrections or rescue ${r.autonomous} of ${r.judged - r.abandoned} accepted`,
    `Stops: for the owner ${r.stops.owner}, missing information ${r.stops.missing}; decisions taken alone ${r.decisions}; CI runs ${r.ci}`,
    `Avoidable questions ${r.avoidableQuestions}, missed escalations ${r.missedEscalations}, corrections ${r.corrections}, rescues ${r.rescues}`,
    `Recoveries ${GRADES.map((g) => `${g} ${r.recoveries[g]}`).join(', ')}`,
    `Open runs ${r.open}, of them past their promised time ${r.pastForecast}`,
    describePace(r.pace),
    r.spend.runsMeasured
      ? `Measured over ${r.spend.runsMeasured} finished run(s)${r.spend.partial ? ` (${r.spend.partial} of them incomplete, left out of the median: not all their occupied time could be measured -- a span still open, a transcript on another machine, or a harness this copy cannot read)` : ''}: ` +
        `the owner ${r.spend.attentionMinutes} min answering${r.spend.acceptedPerAttentionHour ? `, ${r.spend.acceptedPerAttentionHour} feature(s) accepted per hour of it` : ''}; ` +
        `a run occupies ${r.spend.medianOccupiedMinutes} min (median), ${r.spend.medianWorkMinutes} min of work summed over its sessions`
      : 'No finished run has a measured summary yet.',
  ];
  if (r.damaged) lines.push(`${r.damaged} record(s) are damaged and not counted: the gate names them.`);
  if (r.unclaimed?.length) {
    lines.push(`Tracked work recorded with no claim on the span, in no phase and no session (${r.unclaimed.length}):`);
    for (const u of r.unclaimed) lines.push(`  ${u.item}, span ${u.span}, from ${localStamp(Date.parse(u.from))} to ${u.to ? localStamp(Date.parse(u.to)) : 'an end not dated'}`);
  }
  return lines.join('\n');
}

/**
 * Time over a period, from the records: every receipt ended in the period,
 * counted there once. This figure is the same on every machine. Beside it,
 * what is not in it: spans still open; on this machine only, what their
 * sessions have spent so far and time in sessions that claimed nothing.
 */
function timeReport(v, opts) {
  const since = opts.since ? parseWhen(opts.since) : -Infinity;
  const until = opts.until ? parseWhen(opts.until, { end: true }) : Infinity;
  if (Number.isNaN(since) || Number.isNaN(until)) throw new Usage('--since and --until need dates');
  const only = opts.item ? new Set(v.tree(item(v, opts.item).id)) : null;
  const inScope = (s) => !only || only.has(s.item);
  // A stretch counts in the period it ended in, once: periods are half-open,
  // so one ending on the stroke of midnight belongs to the day it starts.
  // One closed with its time unknown counts where it is known to have ended,
  // or else where it began.
  const inPeriod = (s) => { const at = s.end ?? s.start; return at >= since && at < until; };
  const ended = v.spans.filter((s) => s.receipt && s.claim && !s.conflict.length && inScope(s) && inPeriod(s));
  const closed = ended.filter((s) => !s.unknown);
  const unknown = ended.filter((s) => s.unknown);
  const unclaimed = v.spans.filter((s) => s.receipt && !s.claim && !s.conflict.length && inScope(s) && inPeriod(s));
  const byItem = {};
  const total = Object.fromEntries([...BUCKETS, 'total'].map((b) => [b, 0]));
  const phases = {};
  for (const s of closed) {
    const t = s.receipt.table.rows;
    const row = (byItem[s.item] ||= { title: v.by.get(s.item)?.title || '', spans: 0, work: 0, total: 0, crossesStart: 0 });
    row.spans++;
    row.work += WORK.reduce((n, b) => n + t.total[b], 0);
    row.total += t.total.total;
    if (s.start < since) row.crossesStart++;
    for (const b of [...BUCKETS, 'total']) total[b] += t.total[b];
    for (const [p, r] of Object.entries(t)) if (p !== 'total') phases[p] = (phases[p] || 0) + WORK.reduce((n, b) => n + r[b], 0);
  }
  const open = openSpans(v).filter((s) => inScope(s) && s.start <= until);
  // A record of a harness this copy of the set cannot read: its time is not
  // "unknown", it is unreadable here, and that is said rather than counted.
  // Scoped like the figures beside it: only the spans this command measures.
  // A portable receipt of such a harness is still counted -- it is on the item
  // -- so this says what is not read here, never what is left out of the total.
  const unsupportedSpans = opts['no-transcripts'] ? []
    : v.spans.filter((s) => s.claim && !s.conflict.length && inScope(s) && (s.receipt ? inPeriod(s) : s.start <= until));
  const unsupported = [...new Set(unsupportedSpans.map((s) => harnessOf(s.session)))].filter((h) => !hasAdapter(h)).sort()
    .map((harness) => ({ harness, items: [...new Set(unsupportedSpans.filter((s) => harnessOf(s.session) === harness).map((s) => s.item))] }));
  const out = {
    period: { since: Number.isFinite(since) ? localStamp(since) : null, until: Number.isFinite(until) ? localStamp(until) : null },
    receipts: closed.length, total, work: WORK.reduce((n, b) => n + total[b], 0), phases, items: byItem,
    open: open.map((s) => ({ item: s.item, span: s.id, agent: s.claim.fields.agent, harness: harnessOf(s.session), since: s.claim.fields.at })),
    unknown: unknown.map((s) => ({ item: s.item, span: s.id, agent: s.claim.fields.agent, harness: harnessOf(s.session), since: s.claim.fields.at, why: s.receipt.fields.note })),
    localRead: !opts['no-transcripts'],
    damaged: v.damaged.length, conflicted: v.spans.filter((s) => s.conflict.length).length, unclaimed: unclaimed.length,
    // Tracked work whose span was never claimed, named rather than only
    // counted: a figure that quietly writes the time off as unattributed
    // hides the gap this names.
    unclaimedList: unclaimed.map((s) => ({
      item: s.item, span: s.id, from: s.receipt.fields.from, to: s.receipt.fields.to ?? null, note: s.receipt.fields.note || null,
    })),
    unsupported,
  };
  if (!opts['no-transcripts']) {
    let rs = null;
    try { rs = raws(opts); } catch (e) { if (!(e instanceof Usage)) throw e; }
    if (rs) {
      // What the open spans' sessions have spent so far, where they ran here.
      out.localOpen = open.filter((s) => hasAdapter(harnessOf(s.session))).flatMap((s) => {
        const raw = rawOf(opts, s.session, s.item);
        if (!raw) return [];
        const to = Math.max(s.start, endOf(s, raw));
        const t = measureSpan(raw, s.start, to).table.rows.total;
        return [{ item: s.item, span: s.id, work: WORK.reduce((n, b) => n + t[b], 0), total: t.total }];
      });
      // Sessions on this machine in the period, outside every span of theirs.
      const claimed = new Map();
      for (const s of v.spans.filter((x) => x.claim && !x.conflict.length && hasAdapter(harnessOf(x.session)))) {
        const raw = rawOf(opts, s.session, s.item);
        claimed.set(s.session, [...(claimed.get(s.session) || []), { start: s.start, end: endOf(s, raw) }]);
      }
      let unassigned = 0;
      let sessions = 0;
      const named = [];
      for (const r of rs) {
        if (r.parent) continue;
        const win = [{ start: Math.max(since, r.first), end: Math.min(until, r.last) }].filter((w) => w.end > w.start);
        const free = minusAll(win, union(claimed.get(`${r.harness}:${r.id}`) || []));
        if (!free.length) continue;
        const m = measure(r, { windows: free });
        if (!m) continue;
        const w = m.modelMinutes + m.toolMinutes + m.coordinationMinutes + m.answerMinutes;
        if (w < 0.5) continue;
        unassigned += w;
        sessions++;
        named.push({ session: `${r.harness}:${r.id}`, work: round(w) });
      }
      out.unassigned = { work: round(unassigned), sessions, list: named };
    }
  }
  return out;
}

function minusAll(a, b) {
  const out = [];
  for (const x of a) {
    let pieces = [{ ...x }];
    for (const y of b) pieces = pieces.flatMap((p) => (y.end <= p.start || y.start >= p.end ? [p]
      : [{ start: p.start, end: y.start }, { start: y.end, end: p.end }].filter((q) => q.end > q.start)));
    out.push(...pieces);
  }
  return out;
}

function describeTime(t) {
  const h = (m) => `${(m / 60).toFixed(1)} h`;
  const lines = [
    `${t.period.since || 'from the start'} to ${t.period.until || 'now'}: ${t.receipts} recorded stretch(es) of work ended in the period.`,
    `Work ${h(t.work)}: the model ${h(t.total.model)}, tools ${h(t.total.tools)}, waiting inside turns ${h(t.total.coord)}, the owner answering ${h(t.total.answer)}.`,
    `Beside it: the owner away ${h(t.total.away)}, nobody ${h(t.total.idle)}.`,
    `By phase, work: ${Object.entries(t.phases).filter(([, m]) => m).map(([p, m]) => `${p} ${h(m)}`).join(', ') || 'nothing recorded'}.`,
    ...Object.entries(t.items).map(([id, r]) => `  ${id} ${r.title}: ${h(r.work)} of work in ${r.spans} stretch(es)${r.crossesStart ? `, ${r.crossesStart} of them begun before the period and counted whole` : ''}`),
  ];
  if (t.open.length) {
    lines.push(`Not in these figures: ${t.open.length} stretch(es) still open, so the figure is at least this and incomplete:`);
    for (const o of t.open) {
      const here = (t.localOpen || []).find((x) => x.span === o.span);
      const unreadable = (t.unsupported || []).some((u) => u.harness === o.harness);
      lines.push(`  ${o.item}, ${o.agent}, since ${localStamp(Date.parse(o.since))}${here ? `: so far ${h(here.work)} of work, measured on this machine only`
        : !t.localRead ? ''
        : unreadable ? ': this copy of the set cannot read that harness, so nothing is measured for it here'
        : ': its transcript is not on this machine'}`);
    }
  }
  if (t.unknown?.length) {
    lines.push(`Not in these figures either: ${t.unknown.length} stretch(es) were closed with their time unknown, so the figure is at least this:`);
    for (const u of t.unknown) lines.push(`  ${u.item}, ${u.agent}, from ${localStamp(Date.parse(u.since))}: ${u.why}`);
  }
  if (t.unsupported?.length)
    lines.push(`Unsupported here: ${t.unsupported.length} harness(es) this copy of the set cannot read; their transcripts are not read on this machine, and they are not counted with the times no machine knows:`,
      ...t.unsupported.map((u) => `  ${u.harness}, on ${u.items.join(', ')}: unsupported here: no transcript adapter for ${u.harness}; this copy reads ${adapterNames().join(', ')}`));
  if (t.unassigned?.sessions) {
    lines.push(`On this machine only: ${h(t.unassigned.work)} of work in ${t.unassigned.sessions} session(s) that claimed no item; it is on no item and no other machine sees it:`);
    for (const u of t.unassigned.list) lines.push(`  ${u.session}: ${h(u.work)}`);
  }
  if (t.damaged || t.conflicted || t.unclaimed) lines.push(`${t.damaged} damaged, ${t.conflicted} conflicting and ${t.unclaimed} unclaimed record(s) are not counted: the gate names them, and the figure is incomplete by them.`);
  if (t.unclaimedList?.length) {
    lines.push('Work recorded with no claim on the span: the time is tracked, and no phase, no session and no forecast holds it. Recover its claim on the machine that works here, or say where:');
    for (const u of t.unclaimedList) lines.push(`  ${u.item}, span ${u.span}, from ${localStamp(Date.parse(u.from))} to ${u.to ? localStamp(Date.parse(u.to)) : 'an end not dated'}${u.note ? ` (${u.note})` : ''}`);
  }
  return lines.join('\n');
}

/**
 * Every span that has ended with no receipt, and every open one whose session
 * is no longer running: recovered from this machine's transcript where it is
 * here, named where it is not.
 */
function gaps(v, opts) {
  const recover = [];
  const elsewhere = [];
  const unsupported = [];
  const at = nowMs();
  for (const s of openSpans(v)) {
    const later = v.spans.some((o) => o !== s && o.claim && o.item === s.item && o.start > s.start);
    const status = v.by.get(s.item)?.status;
    // A harness this copy cannot read is not "on another machine": it is
    // unreadable here, and its span is neither recovered nor guessed at.
    if (!hasAdapter(harnessOf(s.session))) {
      unsupported.push({ item: s.item, span: s.id, agent: s.claim.fields.agent, harness: harnessOf(s.session), since: s.claim.fields.at });
      continue;
    }
    let raw = null;
    try { raw = rawOf(opts, s.session, s.item); } catch (e) { if (!(e instanceof Usage)) throw e; }
    const stopped = raw ? at - raw.last > 15 * 60e3 : false;
    const ended = s.next || later || status !== 'active' || stopped;
    if (!ended) continue;
    if (!raw) { elsewhere.push({ item: s.item, span: s.id, agent: s.claim.fields.agent, since: s.claim.fields.at }); continue; }
    recover.push(receiptFor(v, s, opts, { end: status === 'active' && !s.next && !later ? 'stopped' : 'paused', reason: 'other', note: 'recovered: the session ended without writing its receipt', recovered: true }));
  }
  return { recover, elsewhere, unsupported };
}

/**
 * The claim a session made and never wrote, typically one that ran before the
 * set wrote claims at all: dated at the start its transcript on this machine
 * shows, and marked recovered. It carries no forecast, since one written
 * afterwards forecasts nothing; `gaps` then writes the span's receipt. Where
 * no machine has the transcript, the start is the one another record shows,
 * named in --basis (the tracker's claim of the item, the message that handed
 * it over), and the span is closed with a receipt of unknown time.
 */
function recoveredClaim(v, it, me, role, opts) {
  if (!opts.session) throw new Usage('a recovered claim is another session\'s: name it with --harness and --session');
  if (opts.forecast || opts.due !== undefined || opts.away !== undefined) throw new Usage('a recovered claim carries no forecast: one written afterwards forecasts nothing');
  const at = parseWhen(opts.at ?? '');
  if (!Number.isFinite(at)) throw new Usage('--at <time> is required: the start the transcript shows');
  const raw = rawOf(opts, me.key, it.id);
  if (!raw && !opts.basis) throw new NotHere(`the transcript of ${me.key} is not on this machine: its claim is recovered where it is, or, where no machine has it, from another record that dates it (--basis); never typed by hand, which the gate refuses as damaged`);
  if (raw && opts.basis) throw new Usage('the transcript is here: the claim is dated by it, not by another record');
  if (raw && (at < raw.first - 60e3 || at > raw.last)) throw new Usage(`--at ${localStamp(at)} is outside the session's transcript, ${localStamp(raw.first)} to ${localStamp(raw.last)}`);
  if (v.spans.some((s) => s.claim && s.session === me.key && s.item === it.id)) throw new Usage(`${me.key} already has a claim on ${it.id}`);
  const fields = { span: newSpanId(), at: iso(at), session: me.key, agent: agentName(me, role, opts), role, basis: opts.basis, note: opts.note, recovered: iso(nowMs()) };
  return { item: it.id, body: formatRecord('claim', fields, null) };
}

/**
 * A span whose transcript no machine has: closed, with its time unknown and
 * the reason said. It ends where the session's next claim began, where there
 * is one, and nowhere a figure would have to be invented.
 */
function unknownReceipt(v, s, opts, { end, reason, note }) {
  if (rawOf(opts, s.session, s.item)) throw new Usage(`the transcript of ${s.session} is here: its receipt is measured, not unknown`);
  if (!note) throw new Usage('--note says why the time is unknown: where the session ran, and why its transcript is on no machine');
  // A harness this copy cannot read is said in the record itself, so the note
  // never claims that a machine looked for the transcript and found none. The
  // span is still closable: the gate asks for a receipt on every span that
  // ended, and this is the only one a copy that cannot read it can write.
  const why = hasAdapter(harnessOf(s.session)) ? note
    : `${note}; unsupported here: no transcript adapter for ${harnessOf(s.session)}, so this copy of the set cannot measure it`;
  const fields = { span: s.id, from: iso(s.start), to: s.next ? iso(s.next.start) : undefined, end, reason, note: why, unknown: 'yes' };
  return { item: s.item, body: formatRecord('receipt', fields, null) };
}

// ---- commands ----------------------------------------------------------------

const FLAGS = ['json', 'no-transcripts', 'recovered', 'unknown'];

function parseArgs(rest) {
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) throw new Usage(`unexpected ${a}`);
    const key = a.slice(2);
    if (FLAGS.includes(key)) { opts[key] = true; continue; }
    if (i + 1 >= rest.length) throw new Usage(`${a} needs a value`);
    opts[key] = rest[++i];
  }
  return opts;
}

const need = (opts, key, list) => {
  if (!list.includes(opts[key])) throw new Usage(`--${key} is one of ${list.join(', ')}`);
  return opts[key];
};
const count = (opts, key) => {
  if (opts[key] === undefined) return undefined;
  if (!/^\d+$/.test(String(opts[key]))) throw new Usage(`--${key} needs a whole number`);
  return String(Number(opts[key]));
};

const post = (records, opts) => (opts.json ? JSON.stringify(records, null, 2)
  : records.map((r) => `== post on ${r.item}\n${r.body}`).join('\n\n'));

function spanOf(v, opts) {
  if (opts.span) {
    const s = v.spans.find((x) => x.id === opts.span);
    if (!s || !s.claim) throw new Usage(`no claim of span ${opts.span} in the backlog`);
    return s;
  }
  const me = thisSession(opts);
  const mine = mineOpen(v, me.key);
  if (mine.length !== 1) throw new Usage(mine.length ? `this session holds ${mine.length} open spans: pass --span` : `this session (${me.key}) holds no open span: pass --span`);
  return mine[0];
}

// The session a run is started in, named --claims-for <harness:session>: the
// run's own key, so its claim opens the span the run's records go into.
function separateSession(value) {
  const at = String(value ?? '').indexOf(':');
  if (at <= 0) throw new Usage('--claims-for <harness:session> names the session the run runs in, like claude-code:<session id>');
  const harness = value.slice(0, at);
  const id = value.slice(at + 1);
  if (!hasAdapter(harness)) throw new Usage(`--claims-for harness ${harness} is one this set does not read (${adapterNames().join(', ')})`);
  if (!id.trim()) throw new Usage('--claims-for needs the session id after the colon');
  return { harness, id, key: `${harness}:${id}` };
}

// What the claim promises: the forecast table, and the time its result is due.
function promiseOf(opts, at) {
  const table = opts.forecast ? parseForecast(opts.forecast) : null;
  if (opts.due !== undefined && opts.away !== undefined) throw new Usage('--due names the promised time; --away adds to the forecast: give one');
  let due;
  if (opts.due !== undefined) {
    due = parseWhen(opts.due);
    if (!Number.isFinite(due)) throw new Usage('--due needs a time');
  } else if (table) due = at + (table.rows.total.forecast + Number(count(opts, 'away') || 0)) * 60e3;
  return { table, due: due === undefined ? undefined : iso(due) };
}

export function run(argv) {
  const [command, ...rest] = argv;
  const opts = parseArgs(rest);
  const print = (value, text) => (opts.json ? JSON.stringify(value, null, 2) : text);
  const v = () => view(readBacklog(opts.backlog));

  switch (command) {
    case 'claim': {
      const b = v();
      const it = item(b, opts.item);
      const role = need(opts, 'role', ROLES);
      const out = [];
      const me = thisSession(opts);
      if (opts.recovered) return post([recoveredClaim(b, it, me, role, opts)], opts);
      if (opts.at !== undefined) throw new Usage('--at is only for a claim recovered from a transcript (--recovered): a claim made now is dated now');
      // A session that starts a run in another session records the claim for it
      // where the run cannot, by the protocol's **Whoever started a run answers
      // for it to the owner**: the span is the run's (its session key), the
      // promised time rides on the claim, and the record says which session
      // wrote it. The run's time then lands in that span's receipt; the run
      // claims nothing twice, so the started session taking up the same item
      // is told so below, not refused.
      if (opts['claims-for']) {
        const run = separateSession(opts['claims-for']);
        if (b.spans.some((s) => s.claim && s.session === run.key && s.item === it.id))
          throw new Usage(`${run.key} already has a span on ${it.id}: claim for a run made once`);
        const at = nowMs();
        const { table, due } = promiseOf(opts, at);
        const fields = {
          span: newSpanId(), at: iso(at), session: run.key, agent: agentName(run, role, opts), role, sent: me.key,
          due, away: count(opts, 'away'), tasks: count(opts, 'tasks'), stages: count(opts, 'stages'), note: opts.note,
        };
        return post([{ item: it.id, body: formatRecord('claim', fields, table) }], opts);
      }
      // An in-process worker runs in its coordinator's session and shares its
      // key: a claim of its own would end the coordinator's open span, and the
      // coordinator's next record would find none. Refused, and said plainly.
      // This is what a harness without a subagent id of its own leaves.
      if (role === 'worker') {
        const held = mineOpen(b, me.key).find((s) => s.claim.fields.role !== 'worker');
        if (held)
          throw new Usage(`this session (${me.key}) holds the open ${held.claim.fields.role} span ${held.id}, on ${held.item}: ` +
            `an in-process worker runs in its coordinator's session and claims nothing of its own, so that span is never ended by it; ` +
            `its time is the coordinator's, inside that span. Only a worker in a session of its own claims`);
      }
      for (const s of mineOpen(b, me.key)) {
        if (s.item === it.id) throw new Usage(s.claim.fields.sent
          ? `this session already holds span ${s.id} on ${it.id}: the session that started this run recorded its claim (${s.claim.fields.sent}) -- record nothing for starting; your receipt ends that span`
          : `this session already holds span ${s.id} on ${it.id}`);
        // Taking the next item ends the span on the last one: its receipt goes first.
        out.push(receiptFor(b, s, opts, { end: 'paused', note: `took ${it.id}` }));
      }
      const at = nowMs();
      const { table, due } = promiseOf(opts, at);
      const fields = {
        span: newSpanId(), at: iso(at), session: me.key, agent: agentName(me, role, opts), role,
        due, away: count(opts, 'away'),
        tasks: count(opts, 'tasks'), stages: count(opts, 'stages'), basis: opts.basis, note: opts.note,
      };
      out.push({ item: it.id, body: formatRecord('claim', fields, table) });
      return post(out, opts);
    }
    case 'receipt': {
      const b = v();
      const s = spanOf(b, opts);
      if (s.receipt) throw new Usage(`span ${s.id} already has its receipt`);
      const end = need(opts, 'end', ENDS);
      if (opts.reason !== undefined) need(opts, 'reason', REASONS);
      if (opts.unknown) return post([unknownReceipt(b, s, opts, { end, reason: opts.reason, note: opts.note })], opts);
      return post([receiptFor(b, s, opts, { end, reason: opts.reason, note: opts.note, recovered: opts.recovered })], opts);
    }
    case 'event': {
      const b = v();
      const s = spanOf(b, opts);
      const event = need(opts, 'event', EVENTS);
      if (event === 'stop') need(opts, 'reason', REASONS);
      return post([{ item: s.item, body: formatRecord('event', { span: s.id, at: iso(nowMs()), event, reason: opts.reason, note: opts.note }) }], opts);
    }
    case 'finish': {
      const b = v();
      const feature = item(b, opts.item);
      const result = need(opts, 'result', RESULTS);
      const me = thisSession(opts, { need: false });
      const out = [];
      for (const s of me ? mineOpen(b, me.key).filter((x) => b.tree(feature.id).includes(x.item)) : [])
        out.push(receiptFor(b, s, opts, { end: result === 'pull-request' ? 'finished' : 'stopped', reason: result === 'pull-request' ? undefined : 'other' }));
      out.push(summaryFor(b, feature, opts, { result, pr: opts.pr, note: opts.note, extra: out }));
      return post(out, opts);
    }
    case 'verdict': {
      const b = v();
      const it = item(b, opts.item);
      const fields = {
        at: iso(nowMs()), accepted: need(opts, 'accepted', ACCEPTED), avoidable: count(opts, 'avoidable') ?? '0',
        missed: count(opts, 'missed') ?? '0', corrections: count(opts, 'corrections') ?? '0', rescues: count(opts, 'rescues') ?? '0', note: opts.note,
      };
      return post([{ item: it.id, body: formatRecord('verdict', fields) }], opts);
    }
    case 'recovery': {
      const b = v();
      const it = item(b, opts.item);
      return post([{ item: it.id, body: formatRecord('recovery', { at: iso(nowMs()), grade: need(opts, 'grade', GRADES), from: opts.from, to: opts.to, note: opts.note }) }], opts);
    }
    case 'void': {
      const b = v();
      if (!opts.comment) throw new Usage('--comment <id> is required: the comment of the record to void');
      if (!opts.note) throw new Usage('--note <why> is required: a void says why');
      const r = recordsOf(b.backlog).find((x) => x.comment === opts.comment);
      if (!r) throw new Usage(`the comment ${opts.comment} is not a record of the set in the backlog`);
      if (r.kind === 'void') throw new Usage(`the comment ${opts.comment} is a void, and a void is not voided: post the record again instead`);
      if (b.voided.has(r.comment)) throw new Usage(`the comment ${opts.comment} is already voided`);
      return post([{ item: r.item, body: formatRecord('void', { comment: r.comment, at: iso(nowMs()), note: opts.note }) }], opts);
    }
    case 'gaps': {
      const g = gaps(v(), opts);
      if (opts.json) return JSON.stringify(g, null, 2);
      const lines = [];
      if (g.recover.length) lines.push(`${g.recover.length} span(s) ended with no receipt and are recovered from this machine's transcripts:`, '', post(g.recover, opts), '');
      if (g.elsewhere.length) lines.push(`${g.elsewhere.length} span(s) ended with no receipt, and their transcripts are not on this machine; each is written where its session ran, and until then its time is unknown:`,
        ...g.elsewhere.map((e) => `  ${e.item}: ${e.agent}, since ${localStamp(Date.parse(e.since))}`));
      if (g.unsupported.length) lines.push(`${g.unsupported.length} span(s) belong to a harness this copy of the set cannot read, so nothing is recovered from this machine, and they are not called a time no machine knows:`,
        ...g.unsupported.map((e) => `  ${e.item}: ${e.agent}, since ${localStamp(Date.parse(e.since))}: unsupported here: no transcript adapter for ${e.harness}`));
      return lines.join('\n') || 'Every span that has ended has its receipt.';
    }
    case 'time': {
      const t = timeReport(v(), opts);
      return print(t, describeTime(t));
    }
    case 'stalled': {
      const rows = stalled(v());
      return print(rows, describeStalled(rows));
    }
    case 'pace': {
      const p = pace(v(), opts);
      return print(p, describePace(p));
    }
    case 'report': {
      const r = report(v());
      return print(r, describeReport(r));
    }
    case 'list': {
      const b = v();
      const items = [...new Set(b.spans.filter((s) => s.claim?.fields.role === 'coordinator').map((s) => s.item))];
      const rows = items.map((id) => ({
        item: id, title: b.by.get(id)?.title || '', result: b.summaries.find((s) => s.item === id)?.fields.result || 'running',
        verdict: b.verdicts.find((s) => s.item === id)?.fields.accepted || null,
      }));
      return print(rows, rows.map((r) => `${r.item}  ${r.result}${r.verdict ? `, ${r.verdict}` : ''}  ${r.title}`).join('\n') || 'no runs');
    }
    default:
      throw new Usage(`unknown command ${command ?? '(none)'}`);
  }
}

const HELP = `Every command reads the adapter's export: --backlog <path | ->. Commands that write print the
records to post, each under the item it goes on; post each body exactly as printed.

runs.mjs claim --item <id> --role coordinator|worker|agent [--forecast phase=min,...] [--away <min> | --due <time>]
                [--tasks N] [--stages N] [--basis <text>] [--note <text>]
  the claim that starts a span; first, the receipt of this session's open span on another item
runs.mjs claim --recovered --item <id> --role <role> --harness <h> --session <id> --at <time> [--basis <record>] [--note <text>]
  the claim another session made and never wrote, at the start its transcript here shows; then gaps.
  Where no machine has the transcript, at the start the record named in --basis shows; then receipt --unknown
runs.mjs claim --claims-for <harness:session> --item <id> --role <role> [--forecast ...] [--away <min> | --due <time>] [--tasks N] [--stages N] [--note <text>]
  the claim for a run this session is starting in another session, which cannot claim yet: the span is the run's (its key), this
  session's key is kept in the record, and the run claims nothing again -- its receipt ends the span
runs.mjs receipt [--span <id>] --end paused|finished|handed-over|stopped [--reason owner|missing|other] [--note <text>] [--recovered]
  what the span spent, measured from this machine's transcript (exit 3 when it is not here)
runs.mjs receipt --span <id> --end ... --unknown --note <why>
  closes a span whose transcript no machine has: its time unknown, the reason said
runs.mjs event [--span <id>] --event stop|decision|ci [--reason owner|missing|other] [--note <text>]
runs.mjs finish --item <feature> --result pull-request|abandoned|stopped [--pr <url>] [--note <text>]
  this session's receipt, then the feature's summary: forecast against work by phase, occupied time
runs.mjs verdict --item <feature> --accepted as-is|after-changes|abandoned [--avoidable N] [--missed N] [--corrections N] [--rescues N] [--note <text>]
runs.mjs recovery --item <id> --grade R0|R1|R2|R3 [--from <harness>] [--to <harness>] [--note <text>]
runs.mjs void --comment <id> --note <why>
  retires a damaged or wrong record, which a tracker cannot delete; a correction then writes the right one
runs.mjs gaps      spans that ended with no receipt: recovered here, or named where they are not
runs.mjs time [--since <date>] [--until <date>] [--item <id>] [--no-transcripts]
runs.mjs stalled | pace [--tasks N] | report | list
Where the project agreed to Jev, --config <gate config> lets it place a session whose working copy is gone and whose
transcript never names the item: only a sure yes counts, and the ones it is unsure of are named on stderr.
The current session is found by itself where the harness names it (Claude Code, Codex, pi); else --harness
claude-code|codex|pi|omp|prime-agent --session <id>.
Transcripts belong to the project by its git repository: [--project <name>] [--repo <path>]. Add --json for data.
Exit 0 done, 2 misuse, 3 the transcript is on another machine.`;

// ---- self-test -----------------------------------------------------------------

async function selftest() {
  const home = mkdtempSync(join(tmpdir(), 'runs-selftest-'));
  const saved = { ...process.env };
  const savedCwd = process.cwd();
  const savedNow = Date.now;
  process.env.CLAUDE_CONFIG_DIR = join(home, 'claude');
  process.env.CODEX_HOME = join(home, 'codex');
  process.env.PI_CODING_AGENT_DIR = join(home, 'omp');
  delete process.env.PI_CODING_AGENT_SESSION_DIR;
  // pi's and prime-agent's sessions are in their own homes, under this one.
  process.env.HOME = home;
  for (const k of ['PRIME_AGENT_SESSION_DIR', 'PRIME_AGENT_CODING_AGENT_SESSION_DIR', 'PRIME_AGENT_CODING_AGENT_DIR']) delete process.env[k];
  for (const key of sessionEnvVars()) delete process.env[key];
  const failures = [];
  const expect = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failures.push(name); };
  const misuse = (a, cls = Usage) => { try { rawCache = null; run(a); return false; } catch (e) { return e instanceof cls; } };
  const sh = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  let clock = Date.parse('2026-03-02T09:00:00Z');
  Date.now = () => clock;
  try {
    const demo = join(home, 'w', 'demo');
    mkdirSync(demo, { recursive: true });
    sh(['init', '-q', '-b', 'main'], demo);
    sh(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'x'], demo);
    process.chdir(demo);
    const dirOf = (cwd) => join(home, 'claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));
    const transcript = (name, rows, cwd = demo) => {
      mkdirSync(dirOf(cwd), { recursive: true });
      writeFileSync(join(dirOf(cwd), `${name}.jsonl`), `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`);
    };
    const T = (ms) => new Date(ms).toISOString();
    // A session that works from start for min minutes: one turn, the model
    // answering, then tests running.
    const worked = (startMs, min, cwd = demo) => [
      { type: 'user', timestamp: T(startMs), cwd, origin: { kind: 'human' }, message: { content: 'go' } },
      { type: 'assistant', timestamp: T(startMs + min * 0.4 * 60e3), attributionSkill: 'shady2k-skills:take-task', message: { id: `m${startMs}`, content: [{ type: 'tool_use', id: `t${startMs}`, name: 'Bash', input: { command: 'npm test' } }] } },
      { type: 'user', timestamp: T(startMs + min * 60e3), message: { content: [{ type: 'tool_result', tool_use_id: `t${startMs}` }] } },
      { type: 'system', subtype: 'turn_duration', timestamp: T(startMs + min * 60e3), durationMs: min * 60e3 },
    ];
    // The same, with no skill claiming it and nothing that marks a phase.
    const unclaimed = (startMs, min) => worked(startMs, min).map(({ attributionSkill, ...e }) => (e.message?.content?.[0]?.name === 'Bash'
      ? { ...e, message: { ...e.message, content: [{ ...e.message.content[0], input: { command: 'ls' } }] } } : e));
    // The tracker, as the adapter exports it; posting appends a comment.
    const backlog = {
      generatedAt: T(clock), source: 'selftest',
      issues: [
        { id: 'F', title: 'Export to CSV', type: 'epic', status: 'active', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) },
        { id: 'A', title: 'Write the rows', type: 'task', status: 'active', labels: [], parent: 'F', blockedBy: [], body: '', updatedAt: T(clock) },
        { id: 'B', title: 'Quote the cells', type: 'task', status: 'open', labels: [], parent: 'F', blockedBy: [], body: '', updatedAt: T(clock) },
        { id: 'X', title: 'Elsewhere', type: 'task', status: 'active', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) },
      ],
    };
    const file = join(home, 'backlog.json');
    let posted = 0;
    const cli = (...a) => { rawCache = null; writeFileSync(file, JSON.stringify(backlog)); return run([...a, '--backlog', file, '--project', 'demo']); };
    const postAll = (records) => { for (const r of records) backlog.issues.find((i) => i.id === r.item).comments ||= []; for (const r of records) backlog.issues.find((i) => i.id === r.item).comments.push({ id: `c${++posted}`, at: T(clock), author: 'agent', body: r.body }); return records; };
    const act = (...a) => postAll(JSON.parse(cli(...a, '--json')));
    const as = (session) => ['--harness', 'claude-code', '--session', session, '--agent', `claude-x:t@m:b#${session}`];

    // The coordinator claims the feature with a forecast by phase, and the
    // owner says he will be away four hours.
    const c0 = clock;
    const claimed = act('claim', '--item', 'F', '--role', 'coordinator', '--forecast', 'plan=30,build=90', '--away', '240', '--tasks', '2', '--stages', '1', ...as('coord'));
    const claim = parseRecord(claimed[0].body);
    expect('claim: a record the gate reads clean', claimed.length === 1 && !claim.problems.length && claim.kind === 'claim');
    expect('claim: the forecast by phase, and its total', claim.table.rows.plan.forecast === 30 && claim.table.rows.total.forecast === 120);
    expect('claim: the promised time is the forecast plus the announced absence', Date.parse(claim.fields.due) - c0 === 360 * 60e3);
    transcript('coord', worked(c0, 100));
    // A worker claims A ten minutes in and works an hour beside the coordinator.
    clock = c0 + 10 * 60e3;
    act('claim', '--item', 'A', '--role', 'worker', ...as('w1'));
    transcript('w1', worked(clock, 60));
    // A worker that runs in its coordinator's session (an in-process subagent
    // is given the parent's session id) must not claim: that would end the
    // coordinator's open span. Refused, and the span is still open after it.
    expect('claim: a worker claim from its coordinator\'s session is refused',
      misuse(['claim', '--item', 'B', '--role', 'worker', '--backlog', file, '--project', 'demo', ...as('coord')]));
    expect('claim: the coordinator\'s span is still open after the refusal',
      !spansOf(backlog).spans.find((s) => s.item === 'F').receipt);
    // An hour on, it stops for the owner, then takes B: its span on A ends there.
    clock = c0 + 70 * 60e3;
    act('event', '--event', 'stop', '--reason', 'owner', '--note', 'which quoting', ...as('w1'));
    const moved = act('claim', '--item', 'B', '--role', 'worker', ...as('w1'));
    const paused = parseRecord(moved[0].body);
    expect('claiming the next item ends the span on the last: its receipt comes first', moved.length === 2 && moved[0].item === 'A'
      && paused.kind === 'receipt' && paused.fields.end === 'paused' && !paused.problems.length);
    expect('the receipt covers the span exactly, measured from the transcript', paused.table.rows.total.total === 60
      && paused.table.rows.total.tools === 36 && paused.table.rows.total.model === 24);
    // The same receipt posted twice by a retry is one record.
    postAll([moved[0]]);
    expect('a retry of the same record counts once', spansOf(backlog).spans.find((s) => s.item === 'A').conflict.length === 0);
    writeFileSync(file, JSON.stringify(backlog));
    const again = misuse(['receipt', '--span', paused.fields.span, '--end', 'paused', '--backlog', file, '--project', 'demo']);
    expect('misuse: a second receipt for a span that has one', again);

    // Gaps: the worker's span on B never got a receipt and its session is long
    // gone; the coordinator's session is on another machine.
    clock = c0 + 200 * 60e3;
    const g = JSON.parse(cli('gaps', '--json'));
    expect('gaps: a span whose session stopped is recovered from the transcript here', g.recover.length === 2
      && g.recover.every((r) => /recovered: /.test(r.body) && !parseRecord(r.body).problems.length));
    // The coordinator's own open span is also stopped (its session ended at
    // 100 minutes): recovered too. Take only the worker's.
    postAll(g.recover.filter((r) => r.item === 'B'));

    // A span on X claimed by a session whose transcript is on another machine.
    act('claim', '--item', 'X', '--role', 'agent', '--harness', 'codex', '--session', 'far', '--agent', 'codex-agent:t@other:b#far');
    backlog.issues.find((i) => i.id === 'X').status = 'open';
    const g2 = JSON.parse(cli('gaps', '--json'));
    expect('gaps: a span whose transcript is elsewhere is named, not guessed', g2.elsewhere.some((e) => e.item === 'X' && e.agent.includes('@other')));
    rawCache = null;
    expect('receipt: a transcript on another machine is exit 3, not a guess', misuse(['receipt', '--span', spansOf(backlog).spans.find((s) => s.item === 'X').id, '--end', 'paused', '--backlog', file, '--project', 'demo'], NotHere));

    // The coordinator finishes: its receipt, then the summary.
    const fin = act('finish', '--item', 'F', '--result', 'pull-request', '--pr', 'https://example.test/pr/1', ...as('coord'));
    const sum = parseRecord(fin.at(-1).body);
    expect('finish: the session\'s receipt, then a clean summary', fin.length === 2 && parseRecord(fin[0].body).kind === 'receipt' && sum.kind === 'summary' && !sum.problems.length);
    // The coordinator worked 0-100, the worker 10-70 then on B from 70 until
    // its record stopped at 70: laid over each other, 100 minutes.
    expect('finish: occupied counts parallel sessions once', sum.fields.occupied === '100' && !sum.fields['occupied-partial']);
    expect('finish: forecast against work by phase', sum.table.rows.total.forecast === 120 && sum.table.rows.total.work === 160);
    expect('finish: the summary counts every span of the feature', sum.fields.spans === '3' && sum.fields.open === '0');

    act('verdict', '--item', 'F', '--accepted', 'after-changes', '--corrections', '1');
    act('recovery', '--item', 'F', '--grade', 'R3');
    const r = JSON.parse(cli('report', '--json'));
    expect('report: verdicts, stops and recoveries from the records', r.finished === 1 && r.acceptedAfterChanges === 1 && r.corrections === 1
      && r.stops.owner === 1 && r.recoveries.R3 === 1 && r.spend.medianOccupiedMinutes === 100);
    expect('pace: too little history says so', !JSON.parse(cli('pace', '--json')).enough);

    // Time over a period: every receipt ended in it, once; the open span on X
    // is named apart, and it makes the figure incomplete.
    const t = JSON.parse(cli('time', '--json'));
    expect('time: the portable figure is the receipts, each once', t.receipts === 3 && t.total.total === sumTotals(backlog));
    expect('time: an open span is named apart, not added', t.open.length === 1 && t.open[0].item === 'X');
    expect('time: the text says the figure is incomplete', cli('time').includes('at least this and incomplete'));
    const before = JSON.parse(cli('time', '--until', '2026-03-01', '--json'));
    expect('time: a period before any receipt ended has none', before.receipts === 0);

    // A record of a harness this copy of the set has no adapter for: named as
    // unsupported, never counted as a session whose time is unknown.
    // No copy of the set writes a record naming a harness it cannot read, so
    // this one is posted the way another copy's would reach this tracker.
    const gem = postAll([{ item: 'X', body: formatRecord('claim', { span: 'gen00001', at: T(clock), session: 'gemini:gg', agent: 'gemini-agent:t@m:b#gg', role: 'agent' }) }]);
    const gt = JSON.parse(cli('time', '--json'));
    expect('time: a harness with no adapter is named, and the receipts are still counted',
      gt.unsupported.length === 1 && gt.unsupported[0].harness === 'gemini' && gt.unsupported[0].items.join() === 'X'
      && gt.total.total === t.total.total && gt.receipts === t.receipts);
    expect('time: the text says what is unsupported here, in the set\'s words',
      cli('time').includes('unsupported here: no transcript adapter for gemini'));
    expect('time: what is unsupported is scoped like the figures beside it, by the item asked for',
      JSON.parse(cli('time', '--item', 'F', '--json')).unsupported.length === 0
      && JSON.parse(cli('time', '--item', 'X', '--json')).unsupported.length === 1);
    expect('time: local reading that was deliberately skipped is not reported as an unsupported harness',
      JSON.parse(cli('time', '--no-transcripts', '--json')).unsupported.length === 0);
    expect('time: and nothing is then said about where a transcript is, which was not looked for',
      !/its transcript is not on this machine/.test(cli('time', '--no-transcripts')));
    const gapU = JSON.parse(cli('gaps', '--json'));
    expect('gaps: a harness with no adapter is named unsupported, never as a transcript on another machine',
      gapU.unsupported.some((u) => u.harness === 'gemini' && u.agent.startsWith('gemini-agent'))
      && !gapU.elsewhere.some((e) => e.agent.startsWith('gemini-agent')));
    const refused = (a) => { try { rawCache = null; run(a); return ''; } catch (e) { return `${e.constructor.name}: ${e.message}`; } };
    expect('claim: a harness this copy cannot read is refused, so no record naming one is ever written',
      refused(['claim', '--item', 'B', '--role', 'agent', '--harness', 'gemini', '--session', 'gz', '--backlog', file, '--project', 'demo'])
        .startsWith('Unsupported: unsupported here: no transcript adapter for gemini'));
    expect('claim --recovered: a harness this copy cannot read is refused, not dated from another record',
      refused(['claim', '--recovered', '--item', 'X', '--role', 'worker', '--harness', 'gemini', '--session', 'gg', '--at', T(c0), '--backlog', file, '--project', 'demo'])
        .startsWith('Unsupported: unsupported here: no transcript adapter for gemini'));
    expect('receipt: a harness with no adapter is refused as unsupported, not as a transcript on another machine',
      refused(['receipt', '--span', parseRecord(gem[0].body).fields.span, '--end', 'paused', '--backlog', file, '--project', 'demo'])
        .startsWith('Unsupported: unsupported here: no transcript adapter for gemini'));
    // Closed with an explicit receipt of unknown time, which is the only way a
    // span can be closed when this copy cannot read its harness: it is named
    // unsupported, and never also counted as a time no machine knows.
    const gu = parseRecord(act('receipt', '--span', parseRecord(gem[0].body).fields.span, '--end', 'stopped', '--reason', 'other', '--unknown',
      '--note', 'the agent ran where this copy of the set cannot read it')[0].body);
    expect('receipt --unknown: the record itself says the harness is unsupported here, never that a machine looked and found nothing',
      gu.fields.unknown === 'yes' && !gu.problems.length && /unsupported here: no transcript adapter for gemini/.test(gu.fields.note)
      && /the agent ran where this copy of the set cannot read it/.test(gu.fields.note));
    const gtu = JSON.parse(cli('time', '--json'));
    expect('time: an adapterless span closed as unknown is named unsupported, and its own record says why it is unknown',
      gtu.unsupported.length === 1 && gtu.unknown.some((u) => u.harness === 'gemini' && /unsupported here: no transcript adapter for gemini/.test(u.why))
      && !/no machine has their transcript/.test(cli('time'))
      && gtu.total.total === t.total.total);

    // Three more finished runs make a pace.
    for (const [k, occ] of [['G', 90], ['H', 120], ['I', 150]]) {
      backlog.issues.push({ id: k, title: `Feature ${k}`, type: 'epic', status: 'active', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) });
      clock += 1000 * 60e3;
      const start = clock;
      act('claim', '--item', k, '--role', 'coordinator', '--forecast', 'build=60', '--tasks', '2', ...as(`s${k}`));
      // I's work was claimed by no phase: its time is spread over those that were.
      transcript(`s${k}`, (k === 'I' ? unclaimed : worked)(start, occ));
      // Left overnight before the pull request was handed in: clock nobody worked.
      clock = start + occ * 60e3 + 600 * 60e3;
      act('finish', '--item', k, '--result', 'pull-request', ...as(`s${k}`));
    }
    const p = JSON.parse(cli('pace', '--tasks', '2', '--json'));
    const paceText = cli('pace', '--tasks', '2');
    expect('pace: measured from finished runs, their occupied time against their forecast', p.enough && p.runs === 4 && p.estimateRatio === 1.75);
    expect('pace: the clock of past runs is said as no forecast, with the share nobody worked',
      p.gapShare > 50 && paceText.startsWith(`Similar runs occupied ${p.low}-${p.high} minutes`)
      && new RegExp(`Not a forecast: those runs lasted ${p.elapsedLow}-${p.elapsedHigh} minutes of clock \\(whole runs\\), ${p.gapShare}%`).test(paceText));
    expect('pace: proposes a forecast by phase', typeof p.proposal === 'string' && !p.proposal.includes('unattributed') && /^build=\d+$/.test(p.proposal));

    // A run that promised a time and never came back.
    backlog.issues.push({ id: 'L', title: 'Late one', type: 'epic', status: 'active', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) });
    act('claim', '--item', 'L', '--role', 'coordinator', '--forecast', 'build=30', ...as('sL'));
    clock += 120 * 60e3;
    const st = JSON.parse(cli('stalled', '--json'));
    expect('stalled: a run past its promised time with no summary is found', st.some((x) => x.item === 'L' && x.pastForecast) && !st.some((x) => x.item === 'G'));

    // A retry of the summary is one run, not two.
    postAll([fin.at(-1)]);
    expect('a summary posted twice is one run', JSON.parse(cli('report', '--json')).finished === 4);
    // A summary that says spans were open is no reference for a forecast.
    const openOne = { ...backlog, issues: [...backlog.issues, { id: 'O', title: 'O', type: 'epic', status: 'closed', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock),
      comments: [{ id: 'o1', at: T(clock), author: 'x', body: fin.at(-1).body.replace('open: 0', 'open: 1') }] }] };
    expect('a summary written with a span still open is incomplete, and no pace history', finishedRuns(view(openOne)).find((x) => x.item === 'O').partial
      && !finishedRuns(view(openOne)).find((x) => x.item === 'F').partial);
    // A receipt nobody claimed is not counted, and the figure says so.
    const bare = { id: 'U', title: 'Unclaimed', type: 'task', status: 'closed', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock),
      comments: [{ id: 'u1', at: T(clock), author: 'x', body: formatRecord('receipt', { span: 'dead0000', from: T(c0), to: T(c0 + 600e3), end: 'finished' }, roundTable({ build: { model: 10 } }, 10)) }] };
    backlog.issues.push(bare);
    const tu = JSON.parse(cli('time', '--no-transcripts', '--json'));
    expect('time: a receipt with no claim is left out and named', tu.unclaimed === 1 && tu.receipts === 6);
    backlog.issues.pop();
    // A stretch ending at midnight belongs to one day only.
    const at0 = parseWhen('2026-03-03');
    const mid = { id: 'M', title: 'Midnight', type: 'task', status: 'closed', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock),
      comments: [
        { id: 'm1', at: T(at0 - 600e3), author: 'x', body: formatRecord('claim', { span: 'beef0000', at: T(at0 - 600e3), session: 'claude-code:mid', agent: 'claude-agent:t@m:b#mid', role: 'agent' }) },
        { id: 'm2', at: T(at0), author: 'x', body: formatRecord('receipt', { span: 'beef0000', from: T(at0 - 600e3), to: T(at0), end: 'finished' }, roundTable({ build: { model: 10 } }, 10)) }] };
    backlog.issues.push(mid);
    const day = (d) => JSON.parse(cli('time', '--since', d, '--until', d, '--item', 'M', '--no-transcripts', '--json')).receipts;
    expect('time: a stretch ending at midnight counts in one day, once', day('2026-03-02') === 0 && day('2026-03-03') === 1);
    backlog.issues.pop();

    // Work handed in by a session that ran before the set wrote claims: its
    // claim is recovered at the start its transcript shows, then its receipt.
    const oldStart = c0 - 3 * 86400e3;
    transcript('old', worked(oldStart, 45));
    backlog.issues.push({ id: 'P', title: 'Handed in before', type: 'task', status: 'implemented', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) });
    const oldAs = ['--harness', 'claude-code', '--session', 'old', '--agent', 'claude-worker:t@m:b#old'];
    const rc = parseRecord(act('claim', '--recovered', '--item', 'P', '--role', 'worker', '--at', T(oldStart + 60e3), ...oldAs)[0].body);
    expect('claim --recovered: dated at the transcript\'s start, not now, and marked recovered', !rc.problems.length
      && Date.parse(rc.fields.at) === oldStart + 60e3 && Date.parse(rc.fields.recovered) === clock && !rc.table);
    const rg = JSON.parse(cli('gaps', '--json')).recover.filter((x) => x.item === 'P');
    const rr = rg.length === 1 && parseRecord(rg[0].body);
    expect('claim --recovered: gaps then writes its receipt, to where the transcript stops', rr && !rr.problems.length
      && rr.fields.from === rc.fields.at && Date.parse(rr.fields.to) === oldStart + 45 * 60e3);
    postAll(rg);
    const p2 = ['--item', 'P', '--role', 'worker', '--backlog', file, '--project', 'demo'];
    expect('misuse: a claim dated in the past without --recovered', misuse(['claim', ...p2, '--at', T(oldStart), ...as('z')]));
    // On an item the session holds no claim on, so only the rule named can refuse.
    const p3 = ['--item', 'A', '--role', 'worker', '--backlog', file, '--project', 'demo'];
    expect('misuse: a recovered claim outside its transcript', misuse(['claim', '--recovered', ...p3, '--at', T(oldStart - 86400e3), ...oldAs]));
    expect('misuse: a recovered claim with a forecast', misuse(['claim', '--recovered', ...p3, '--at', T(oldStart), '--forecast', 'build=5', ...oldAs]));
    expect('misuse: a recovered claim the session already has', misuse(['claim', '--recovered', ...p2, '--at', T(oldStart), ...oldAs]));
    expect('claim --recovered: a transcript on another machine is exit 3, not a guess', misuse(['claim', '--recovered', ...p2, '--at', T(oldStart), '--harness', 'codex', '--session', 'far'], NotHere));
    // A session whose working copy was removed and pruned, in a folder that
    // also holds other repositories: git cannot place it, and its transcript
    // naming the item is what places it.
    const gone = join(home, 'w', 'wt-gone');
    const goneStart = c0 - 2 * 86400e3;
    const goneRows = (id, cwd = gone) => worked(goneStart, 30, cwd).map((r, k) => (k ? r : { ...r, message: { content: `take ${id}` } }));
    transcript('gone', goneRows('demo-q7'), gone);
    backlog.issues.push({ id: 'demo-q7', title: 'Handed in from a removed copy', type: 'task', status: 'implemented', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) });
    backlog.issues.push({ id: 'demo-q70', title: 'Named nowhere', type: 'task', status: 'implemented', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) });
    const goneAs = ['--harness', 'claude-code', '--session', 'gone', '--agent', 'claude-coordinator:t@m:b#gone'];
    const gq = parseRecord(act('claim', '--recovered', '--item', 'demo-q7', '--role', 'coordinator', '--at', T(goneStart), ...goneAs)[0].body);
    expect('claim --recovered: a removed working copy\'s transcript that names the item is found', !gq.problems.length && Date.parse(gq.fields.at) === goneStart);
    const gg = JSON.parse(cli('gaps', '--json')).recover.filter((x) => x.item === 'demo-q7');
    expect('claim --recovered: and gaps writes its receipt from it', gg.length === 1 && Date.parse(parseRecord(gg[0].body).fields.to) === goneStart + 30 * 60e3);
    postAll(gg);
    expect('claim --recovered: a removed copy\'s transcript that never names the item is not taken', misuse(['claim', '--recovered', '--item', 'demo-q70', '--role', 'coordinator', '--at', T(goneStart), ...goneAs, '--backlog', file, '--project', 'demo'], NotHere));
    // With Jev, where the project agreed to it: the same transcript, which
    // never names demo-q70, is placed on it only by a sure yes. The request
    // goes through the real module, masking and all; only the service is faked.
    const jev = await import('./jev.mjs');
    const cfg = join(home, 'gate.json');
    const seen = [];
    const service = (verdict) => async (url, init) => {
      const body = JSON.parse(init.body);
      seen.push(body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ answers: { [Object.keys(body.questions)[0]]: { type: 'noul', noul: verdict } }, usage: { cost: 0 } }) };
    };
    const viaJev = (verdict) => (a) => jev.ask({ ...a, fetchImpl: service(verdict), keyReader: () => 'k', people: [] });
    const q70 = ['claim', '--recovered', '--item', 'demo-q70', '--role', 'coordinator', '--at', T(goneStart), ...goneAs, '--backlog', file, '--project', 'demo'];
    writeFileSync(cfg, JSON.stringify({ jev: { consent: true, idPattern: 'demo-q[0-9]+' } }));
    writeFileSync(file, JSON.stringify(backlog));
    judged.clear();
    rawCache = null;
    let j = await askJev([...q70, '--config', cfg], { ask: viaJev(0.5) });
    expect('Jev: an unsure answer places nothing and is named for the agent', j.asked === 1 && !j.placed.length && j.unsure.length === 1 && misuse(q70, NotHere));
    expect('Jev: the item and the session go masked, the item described by its title', seen.length === 1
      && !JSON.stringify(seen[0]).includes('demo-q7') && JSON.stringify(seen[0]).includes('Named nowhere'));
    judged.clear();
    rawCache = null;
    j = await askJev([...q70, '--config', cfg], { ask: viaJev(0.02) });
    expect('Jev: a sure no places nothing and asks the agent nothing', j.asked === 1 && !j.placed.length && !j.unsure.length && misuse(q70, NotHere));
    judged.clear();
    rawCache = null;
    const errs = [];
    const jq = parseRecord(postAll(JSON.parse(await commandLine([...q70, '--config', cfg, '--json'], { ask: viaJev(0.99), err: (s) => errs.push(s) })))[0].body);
    expect('Jev: a sure yes places the transcript that never names the item, through the command line', !errs.length && !jq.problems.length && Date.parse(jq.fields.at) === goneStart);
    rawCache = null;
    writeFileSync(file, JSON.stringify(backlog));
    const jg = JSON.parse(run(['gaps', '--json', '--backlog', file, '--project', 'demo'])).recover.filter((x) => x.item === 'demo-q70');
    expect('Jev: its receipt says Jev placed it', jg.length === 1 && /Jev judged/.test(parseRecord(jg[0].body).fields.note || ''));
    judged.clear();
    rawCache = null;
    seen.length = 0;
    writeFileSync(cfg, JSON.stringify({ jev: { consent: false } }));
    j = await askJev(['gaps', '--backlog', file, '--project', 'demo', '--config', cfg], { ask: viaJev(0.99) });
    expect('Jev: without the project\'s consent nothing is asked, and the text alone decides', j.asked === 0 && !seen.length
      && JSON.parse(cli('gaps', '--json')).elsewhere.some((x) => x.item === 'demo-q70'));
    j = await askJev(['gaps', '--backlog', file, '--project', 'demo'], { ask: viaJev(0.99) });
    expect('Jev: without --config nothing is asked', j.asked === 0 && !seen.length);
    judged.clear();
    // A Codex session whose copy is gone, beside a file that only has its id
    // in its name; and what is read of it is the conversation, once, without
    // what the harness put on the owner's side.
    writeFileSync(cfg, JSON.stringify({ jev: { consent: true, idPattern: 'demo-q[0-9]+' } }));
    const cxGone = join(home, 'w', 'wt-cx');
    const codexDir = join(home, 'codex', 'sessions', '2026', '02', '27');
    mkdirSync(codexDir, { recursive: true });
    const cxRows = (id) => [
      { type: 'session_meta', timestamp: T(goneStart), payload: { id, cwd: cxGone } },
      { type: 'response_item', timestamp: T(goneStart + 1000), payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '# AGENTS.md instructions for this folder' }] } },
      { type: 'event_msg', timestamp: T(goneStart + 2000), payload: { type: 'user_message', message: 'make the export quote its cells' } },
      { type: 'response_item', timestamp: T(goneStart + 2000), payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'make the export quote its cells' }] } },
      { type: 'event_msg', timestamp: T(goneStart + 60000), payload: { type: 'agent_message', message: 'quoted, tests pass' } },
    ].map((r) => JSON.stringify(r)).join('\n');
    writeFileSync(join(codexDir, 'rollout-2026-02-27T10-00-00-cx1.jsonl'), cxRows('cx1'));
    writeFileSync(join(codexDir, 'rollout-2026-02-27T11-00-00-cx1-decoy.jsonl'), cxRows('cx1-decoy'));
    const un = unnamedTranscripts('codex:cx1', 'demo-q71');
    expect('Jev: only the session itself is put to it, not a file that merely has its id in its name', un.length === 1 && un[0].path.endsWith('-cx1.jsonl'));
    const said = un.length ? conversationOf(un[0].path) : '';
    expect('Jev: what is read is the conversation, once, without the harness\'s own text',
      said.split('quote its cells').length === 2 && /AGENT: quoted/.test(said) && !/AGENTS\.md/.test(said));
    const claudeSaid = join(home, 'said.jsonl');
    writeFileSync(claudeSaid, [
      { type: 'user', isMeta: true, message: { content: 'meta text' } },
      { type: 'user', message: { content: '<local-command-caveat>Caveat: generated</local-command-caveat>' } },
      { type: 'user', message: { content: 'please fix the rows' } },
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'x', name: 'Bash', input: { command: 'cat .env' } }, { type: 'text', text: 'fixed' }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'x', content: 'SECRET=1' }] } },
    ].map((r) => JSON.stringify(r)).join('\n'));
    const cs = conversationOf(claudeSaid);
    expect('Jev: from Claude, neither meta rows, the harness\'s notes nor tools go', cs === 'OWNER: please fix the rows\n\nAGENT: fixed');
    // Asked about two items for one session, a yes to both places neither.
    for (const id of ['demo-q71', 'demo-q72']) {
      backlog.issues.push({ id, title: `Twin ${id}`, type: 'task', status: 'active', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock),
        comments: [{ id: `c${++posted}`, at: T(clock), author: 'agent', body: formatRecord('claim', { span: newSpanId(), at: T(goneStart), session: 'codex:cx1', agent: 'codex-worker:t@m:b#cx1', role: 'worker' }, null) }] });
    }
    writeFileSync(file, JSON.stringify(backlog));
    judged.clear();
    rawCache = null;
    const twinErr = [];
    const twin = JSON.parse(await commandLine(['gaps', '--json', '--backlog', file, '--project', 'demo', '--config', cfg], { ask: viaJev(0.99), err: (s) => twinErr.push(s) }));
    const asked = [];
    judged.clear();
    rawCache = null;
    await askJev(['time', '--item', 'demo-q71', '--backlog', file, '--project', 'demo', '--config', cfg], { ask: async (a) => { asked.push(a.context); return { answers: [] }; } });
    expect('Jev: a command asks only about what it measures', asked.length === 1 && /Twin demo-q71/.test(asked[0]));
    expect('Jev: a session it places on two items is placed on neither, and both are named', !twin.recover.some((x) => x.item.startsWith('demo-q7') && x.item !== 'demo-q70')
      && twinErr.some((s) => /demo-q71/.test(s) && /demo-q72/.test(s)));
    judged.clear();
    rawCache = null;
    const failErr = [];
    let failed = null;
    try { await commandLine(['gaps', '--json', '--backlog', file, '--project', 'demo', '--config', cfg], { ask: async () => { throw new Error('status 422'); }, err: (s) => failErr.push(s) }); } catch (e) { failed = e; }
    expect('Jev: when asking it fails, the command still runs, as without it, and says Jev was not used', !failed && failErr.some((s) => /not used/.test(s)));
    for (const id of ['demo-q71', 'demo-q72']) backlog.issues.splice(backlog.issues.findIndex((i) => i.id === id), 1);
    writeFileSync(file, JSON.stringify(backlog));
    judged.clear();
    rawCache = null;
    // Ids that only resemble the item name another one.
    transcript('near', goneRows('demo-q70, xdemo-q7 and demo-q7.1', join(home, 'w', 'wt-near')), join(home, 'w', 'wt-near'));
    expect('claim --recovered: a transcript naming only ids that resemble the item is not taken', misuse(['claim', '--recovered', '--item', 'demo-q7', '--role', 'coordinator', '--at', T(goneStart), '--harness', 'claude-code', '--session', 'near', '--backlog', file, '--project', 'demo'], NotHere));
    // One whose working copy is on disk, in another repository, is not this project's.
    const other = join(home, 'w', 'other');
    mkdirSync(other, { recursive: true });
    sh(['init', '-q', '-b', 'main'], other);
    transcript('elsewhere', goneRows('demo-q70', other), other);
    expect('claim --recovered: a transcript from another repository is not taken, whatever it names', misuse(['claim', '--recovered', '--item', 'demo-q70', '--role', 'coordinator', '--at', T(goneStart), '--harness', 'claude-code', '--session', 'elsewhere', '--backlog', file, '--project', 'demo'], NotHere));
    // A worker whose transcript no machine has: its claim dated by the
    // record that handed it the item, its span closed with its time unknown.
    backlog.issues.push({ id: 'demo-z9', title: 'Done where nothing kept it', type: 'task', status: 'implemented', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) });
    const lostAs = ['--harness', 'omp', '--session', 'lost', '--agent', 'omp-worker:t@m:b#lost'];
    const zArgs = ['claim', '--recovered', '--item', 'demo-z9', '--role', 'worker', '--at', T(goneStart), ...lostAs];
    writeFileSync(file, JSON.stringify(backlog));
    expect('claim --recovered: no transcript and no other record to date it is exit 3', misuse([...zArgs, '--backlog', file, '--project', 'demo'], NotHere));
    const zc = parseRecord(act(...zArgs, '--basis', 'the tracker\'s claim of demo-z9, when it was handed over')[0].body);
    expect('claim --recovered --basis: dated by the record it names, and marked recovered', !zc.problems.length && Date.parse(zc.fields.at) === goneStart && /handed over/.test(zc.fields.basis) && zc.fields.recovered);
    expect('gaps: a span no machine can measure is named, not guessed', JSON.parse(cli('gaps', '--json')).elsewhere.some((e) => e.item === 'demo-z9'));
    expect('misuse: a receipt of unknown time without its reason', misuse(['receipt', '--span', zc.fields.span, '--end', 'finished', '--unknown', '--backlog', file, '--project', 'demo']));
    const zu = parseRecord(act('receipt', '--span', zc.fields.span, '--end', 'finished', '--unknown', '--note', 'the worker\'s machine was wiped')[0].body);
    expect('receipt --unknown: closes the span with no figures and its reason', !zu.problems.length && zu.fields.unknown === 'yes' && !zu.table && zu.fields.from === zc.fields.at);
    const tz = JSON.parse(cli('time', '--no-transcripts', '--json'));
    expect('time: a span of unknown time is named apart, not added', tz.unknown.some((u) => u.item === 'demo-z9') && !tz.items['demo-z9']);
    expect('time: the text says the figure is at least this', /were closed with their time unknown/.test(cli('time', '--no-transcripts')));
    expect('misuse: a claim dated by another record while the transcript is here', misuse(['claim', '--recovered', '--item', 'demo-q70', '--role', 'worker', '--at', T(oldStart), ...oldAs, '--basis', 'x', '--backlog', file, '--project', 'demo']));
    // A run is its coordinator's clock: its worker's time unknown leaves the
    // effort short, not the run incomplete, and the run still makes a pace.
    backlog.issues.push({ id: 'K', title: 'Run with a lost worker', type: 'epic', status: 'active', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) },
      { id: 'K1', title: 'Leaf', type: 'task', status: 'implemented', labels: [], parent: 'K', blockedBy: [], body: '', updatedAt: T(clock) });
    const kStart = clock;
    act('claim', '--item', 'K', '--role', 'coordinator', '--forecast', 'build=20', ...as('sK'));
    transcript('sK', worked(kStart, 30));
    clock = kStart + 60e3;
    const kw = parseRecord(act('claim', '--item', 'K1', '--role', 'worker', '--harness', 'omp', '--session', 'lost2', '--agent', 'omp-worker:t@m:b#lost2')[0].body);
    act('receipt', '--span', kw.fields.span, '--end', 'finished', '--unknown', '--note', 'its machine was wiped');
    clock = kStart + 31 * 60e3;
    const ks = parseRecord(act('finish', '--item', 'K', '--result', 'pull-request', ...as('sK')).at(-1).body);
    expect('finish: a worker whose time is unknown leaves the run whole on its coordinator\'s clock', !ks.problems.length
      && ks.fields.missing === '0' && !ks.fields.unknown && !ks.fields['occupied-partial'] && Number(ks.fields.occupied) === 30
      && !finishedRuns(view(backlog)).find((r) => r.item === 'K').partial);

    // A span whose transcript is here is measured, never closed as unknown.
    backlog.issues.push({ id: 'demo-h1', title: 'Measured', type: 'task', status: 'implemented', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) });
    transcript('here2', goneRows('demo-h1', demo), demo);
    const hc = parseRecord(act('claim', '--recovered', '--item', 'demo-h1', '--role', 'worker', '--at', T(goneStart), '--harness', 'claude-code', '--session', 'here2', '--agent', 'claude-worker:t@m:b#here2')[0].body);
    writeFileSync(file, JSON.stringify(backlog));
    expect('misuse: a receipt of unknown time for a span whose transcript is here', misuse(['receipt', '--span', hc.fields.span, '--end', 'finished', '--unknown', '--note', 'x', '--backlog', file, '--project', 'demo']));
    postAll(JSON.parse(cli('gaps', '--json')).recover.filter((x) => x.item === 'demo-h1'));

    // A tracker may only append: a damaged or wrong record is voided, never removed.
    backlog.issues.push({ id: 'demo-v1', title: 'Voided', type: 'task', status: 'active', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) });
    postAll([{ item: 'demo-v1', body: '[shady2k-time v1] claim span: 0badc0de; at: 2026-01-01T00:00:00Z; agent: x; role: worker' }]);
    const bad = `c${posted}`;
    expect('a hand-written one-line record is damaged', spansOf(backlog).damaged.some((r) => r.comment === bad));
    const vd = act('void', '--comment', bad, '--note', 'written by hand on one line');
    expect('void: retires the damaged record, and reads clean itself', vd.length === 1 && vd[0].item === 'demo-v1' && !parseRecord(vd[0].body).problems.length
      && !spansOf(backlog).damaged.length && !spansOf(backlog).idle.length);
    writeFileSync(file, JSON.stringify(backlog));
    const vargs = (...a) => ['void', ...a, '--backlog', file, '--project', 'demo'];
    expect('misuse: a void with no reason', misuse(vargs('--comment', `c${posted - 1}`)));
    expect('misuse: voiding what is already voided', misuse(vargs('--comment', bad, '--note', 'x')));
    expect('misuse: voiding a void', misuse(vargs('--comment', `c${posted}`, '--note', 'x')));
    expect('misuse: voiding a comment that is not a record', misuse(vargs('--comment', 'no-such', '--note', 'x')));
    const vc = parseRecord(act('claim', '--item', 'demo-v1', '--role', 'worker', '--harness', 'omp', '--session', 'vv', '--agent', 'omp-worker:t@m:b#vv')[0].body);
    act('receipt', '--span', vc.fields.span, '--end', 'finished', '--unknown', '--note', 'its machine was wiped');
    const wrong = `c${posted}`;
    act('void', '--comment', wrong, '--note', 'voided by mistake');
    expect('void: a voided receipt reopens its span, so its time cannot vanish quietly', !spansOf(backlog).spans.find((x) => x.id === vc.fields.span).receipt);
    act('receipt', '--span', vc.fields.span, '--end', 'finished', '--unknown', '--note', 'its machine was wiped');
    const back = spansOf(backlog).spans.find((x) => x.id === vc.fields.span);
    expect('void: a mistaken void is undone by posting the record again, a new comment', back.receipt && back.receipt.comment !== wrong && !back.conflict.length);

    const all = spansOf(backlog);
    expect('every record the script printed reads clean, and no span conflicts', !all.damaged.length && all.spans.every((x) => !x.conflict.length));

    const FIX = recordedShapes(expect);
    if (FIX) {
      // A real worker's session, stripped to its structure: a receipt over it
      // adds up to its clock.
      const worker = readFileSync(join(FIX, 'claude-worker.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l.replaceAll('/fixture/cwd', demo)));
      transcript('real', worker);
      backlog.issues.push({ id: 'R', title: 'Real', type: 'task', status: 'active', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) });
      clock = Date.parse(worker[0].timestamp);
      act('claim', '--item', 'R', '--role', 'worker', ...as('real'));
      clock = Date.parse(worker.at(-1).timestamp) + 60e3;
      const rr = parseRecord(JSON.parse(cli('receipt', '--end', 'finished', ...as('real'), '--json'))[0].body);
      expect('recorded: a receipt over a real session reads clean and adds up to its span', !rr.problems.length && rr.table.rows.total.total >= 2);
    }

    expect('misuse: no backlog', misuse(['time', '--project', 'demo']));
    expect('misuse: a claim of an item not in the backlog', misuse(['claim', '--item', 'nope', '--role', 'worker', '--backlog', file, ...as('z')]));
    expect('misuse: a forecast phase that is not one', misuse(['claim', '--item', 'A', '--role', 'worker', '--forecast', 'coding=5', '--backlog', file, ...as('z')]));
    expect('misuse: a stop without its reason', misuse(['event', '--span', claim.fields.span, '--event', 'stop', '--backlog', file]));
    expect('misuse: a verdict that is not one', misuse(['verdict', '--item', 'F', '--accepted', 'maybe', '--backlog', file]));
    expect('misuse: an unknown command', misuse(['frobnicate', '--backlog', file]));
    expect('misuse: no session given or found', misuse(['claim', '--item', 'A', '--role', 'worker', '--backlog', file]));

    // A span of a harness this copy cannot read, inside a feature that is then
    // summarised: the summary says so, and counts it neither as unknown time
    // nor as a transcript that is elsewhere. Done last, since a second summary
    // of F is a second finished run for report and pace.
    postAll([{ item: 'B', body: formatRecord('claim', { span: 'gen00002', at: T(clock), session: 'gemini:gb', agent: 'gemini-agent:t@m:b#gb', role: 'agent' }) }]);
    const fin2 = parseRecord(act('finish', '--item', 'F', '--result', 'pull-request', ...as('coord')).at(-1).body);
    expect('report: an incomplete run is explained as time that could not be measured, not only as a transcript elsewhere',
      /not all their occupied time could be measured/.test(cli('report')));
    expect('finish: a harness this copy cannot read is said in the summary, and its time is not called unknown or missing',
      fin2.kind === 'summary' && !fin2.problems.length && /unsupported here/.test(fin2.fields.note || '')
      && !fin2.fields.unknown && fin2.fields['occupied-partial'] === 'yes' && fin2.fields.missing === '0');
    // The session that starts a run in another session records the claim for it
    // where the run cannot, by **Whoever started a run answers for it to the
    // owner**: the span is the run's, the record says who wrote it, and the
    // run claims nothing again.
    // Claims that judge posted state must read it: write the export first, as
    // cli() does around every call, so the check runs against what was posted.
    const misusePosted = (a) => { try { rawCache = null; writeFileSync(file, JSON.stringify(backlog)); run([...a]); return false; } catch (e) { return e instanceof Usage; } };
    const forRun = act('claim', '--claims-for', 'claude-code:run-1', '--item', 'B', '--role', 'coordinator', '--due', T(clock + 3600e3), ...as('coord'));
    const fc = parseRecord(forRun[0].body);
    expect('claims-for: a clean record on the run session, naming the one that wrote it',
      forRun.length === 1 && !fc.problems.length && fc.fields.session === 'claude-code:run-1' && fc.fields.sent === 'claude-code:coord'
      && Date.parse(fc.fields.due) - Date.parse(fc.fields.at) === 3600e3 && fc.kind === 'claim');
    expect('claims-for: once per run', misusePosted(['claim', '--claims-for', 'claude-code:run-1', '--item', 'B', '--role', 'coordinator', '--backlog', file, ...as('coord')]));
    expect('claims-for: an unknown harness is refused', misuse(['claim', '--claims-for', 'no-such:run-2', '--item', 'B', '--role', 'coordinator', '--backlog', file, ...as('coord')]));
    expect('claims-for: a shapeless key is refused', misuse(['claim', '--claims-for', 'run-3', '--item', 'B', '--role', 'coordinator', '--backlog', file, ...as('coord')]));
    expect('claims-for: with --recovered is refused', misuse(['claim', '--claims-for', 'claude-code:run-4', '--recovered', '--item', 'B', '--role', 'coordinator', '--at', T(clock), '--backlog', file, ...as('coord')]));
    expect('the started session is told, not refused', (() => {
      try { writeFileSync(file, JSON.stringify(backlog)); run(['claim', '--item', 'B', '--role', 'coordinator', '--backlog', file, ...as('run-1')]); return false; }
      catch (e) { return e instanceof Usage && /recorded its claim/.test(e.message); }
    })());
    // Tracked work whose span was never claimed is named in time and report,
    // rather than lost in a count.
    postAll([{ item: 'X', body: formatRecord('receipt', { span: 'orphan-1', from: T(clock - 30e3), end: 'finished', unknown: 'yes', note: 'no claim was ever made' }) }]);
    const tOut = cli('time', '--project', 'demo');
    const rOut = cli('report');
    expect('time: the unclaimed span is named', /orphan-1/.test(tOut) && /Work recorded with no claim/.test(tOut));
    expect('report: the unclaimed span is named', /orphan-1/.test(rOut) && /no claim on the span/.test(rOut));
  } catch (e) {
    expect(`the self-test ran to its end (${e.stack})`, false);
  } finally {
    Date.now = savedNow;
    process.chdir(savedCwd);
    process.env = saved;
    rmSync(home, { recursive: true, force: true });
  }
  console.log(failures.length ? `${failures.length} failed` : 'all passed');
  return failures.length ? 1 : 0;
}

function sumTotals(backlog) {
  return spansOf(backlog).spans.filter((s) => s.receipt?.table).reduce((n, s) => n + s.receipt.table.rows.total.total, 0);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--selftest') return selftest();
  if (!args.length || args[0] === '--help') { console.log(HELP); return args.length ? 0 : 2; }
  try {
    console.log(await commandLine(args));
    return 0;
  } catch (e) {
    if (e instanceof NotHere) { console.error(e.message); return 3; }
    if (!(e instanceof Usage)) throw e;
    console.error(`${e.message}\n\n${HELP}`);
    return 2;
  }
}

process.exitCode = await main();
