#!/usr/bin/env node
// How the work went, kept in the project's tracker and nowhere else. Every
// fact is a record on the item it is about (time-format.mjs says what a record
// is): a session's claim of an item, with the forecast and the promised time;
// the receipt that ends it, with what the session spent, measured from its
// transcript; the stops, lone decisions and CI runs inside it; a feature's
// summary when it closes; the owner's verdict; how a resumed session picked
// the work up. Nothing is kept on this machine, so every machine reads the
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
  Usage, collect, localStamp, measure, parseWhen, projectName, recordedShapes, span, union,
} from './ledger.mjs';
import {
  ACCEPTED, BUCKETS, ENDS, EVENTS, GRADES, PHASES, REASONS, RESULTS, ROLES, WORK,
  formatRecord, newSpanId, parseRecord, roundTable, spansOf,
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

const HERE = [['claude-code', 'CLAUDE_CODE_SESSION_ID'], ['codex', 'CODEX_THREAD_ID'], ['codex', 'CODEX_SESSION_ID']];

function thisSession(opts, { need = true } = {}) {
  if (!opts.harness !== !opts.session) throw new Usage('--harness and --session go together');
  if (opts.session) return { harness: opts.harness, id: opts.session, key: `${opts.harness}:${opts.session}` };
  const [harness, key] = HERE.find(([, k]) => process.env[k]) || [];
  if (harness) return { harness, id: process.env[key], key: `${harness}:${process.env[key]}` };
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
  const short = s.harness === 'claude-code' ? 'claude' : s.harness;
  return `${short}-${role}:${person.replace(/\s+/g, '-')}@${hostname()}:${branch}#${String(s.id).slice(0, 8)}`;
}

// ---- measuring a span from this machine's transcripts ------------------------

let rawCache = null;
function raws(opts) {
  if (!rawCache) rawCache = collect(projectName(opts.project, opts.repo), { repo: opts.repo });
  return rawCache;
}
const rawOf = (opts, key) => raws(opts).find((r) => `${r.harness}:${r.id}` === key) || null;

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
  const raw = rawOf(opts, s.session);
  if (!raw) throw new NotHere(`the transcript of ${s.session} (${s.claim.fields.agent}) is not on this machine: its receipt is written where it is`);
  const from = s.start;
  const to = Math.max(from, endOf(s, raw, at));
  const { table, whole } = measureSpan(raw, from, to);
  const fields = { span: s.id, from: iso(from), to: iso(to), end, reason, note, recovered: recovered ? iso(nowMs()) : undefined, cut: whole ? undefined : 'yes' };
  return { item: s.item, body: formatRecord('receipt', fields, table) };
}

const openSpans = (v) => v.spans.filter((s) => s.claim && !s.receipt && !s.conflict.length);
const mineOpen = (v, key) => openSpans(v).filter((s) => s.session === key && !s.next);

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
  for (const r of receipts)
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
    const raw = rawOf(opts, s.session);
    if (!raw) { missing++; continue; }
    const to = Math.max(s.start, endOf(s, raw));
    const family = raws(opts).filter((r) => r === raw || rootKey(r, opts) === s.session);
    for (const r of family) {
      const m = to > s.start ? measure(r, { windows: [{ start: s.start, end: to }] }) : null;
      if (m) stretches.push(...m.occupied);
    }
  }
  const occupied = spans.length > missing ? round(minutes(span(union(stretches)))) : null;
  const fields = {
    at: iso(nowMs()), result, started: iso(first), elapsed: round(minutes(nowMs() - first)),
    spans: spans.length, open: open.length, missing,
    occupied: occupied ?? undefined, 'occupied-partial': missing && occupied !== null ? 'yes' : undefined,
    forecast: haveForecast ? rows.total.forecast : undefined, pr, note,
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
      partial: sm.fields['occupied-partial'] === 'yes' || n('open') > 0 || n('missing') > 0,
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
  out.elapsedLow = round(quantile(done.map((r) => r.elapsed), 0.25));
  out.elapsedHigh = round(quantile(done.map((r) => r.elapsed), 0.75));
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
  // was split.
  const work = {};
  for (const r of done) for (const [p, row] of Object.entries(r.table)) if (p !== 'total') work[p] = (work[p] || 0) + row.work;
  const all = Object.values(work).reduce((a, b) => a + b, 0);
  const mid = (out.low + out.high) / 2;
  out.proposal = all ? Object.entries(work).filter(([, w]) => w > 0).map(([p, w]) => `${p}=${Math.max(1, round((mid * w) / all))}`).join(',') : null;
  return out;
}

function describePace(p) {
  if (!p.enough) return `Too little history for a measured estimate: ${p.runs} finished run(s) with a forecast, 3 needed. Any estimate is a guess.`;
  return `Similar runs occupied ${p.low}-${p.high} minutes (${p.basis}), over ${p.elapsedLow}-${p.elapsedHigh} minutes of clock. ` +
    `Runs occupied ${p.estimateRatio} times their forecast (median): correct a new one by that.` +
    (p.proposal ? `\nA starting forecast by phase: --forecast ${p.proposal}` : '');
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
      ? `Measured over ${r.spend.runsMeasured} finished run(s)${r.spend.partial ? ` (${r.spend.partial} of them incomplete, left out of the median: a span still open or a transcript on another machine)` : ''}: ` +
        `the owner ${r.spend.attentionMinutes} min answering${r.spend.acceptedPerAttentionHour ? `, ${r.spend.acceptedPerAttentionHour} feature(s) accepted per hour of it` : ''}; ` +
        `a run occupies ${r.spend.medianOccupiedMinutes} min (median), ${r.spend.medianWorkMinutes} min of work summed over its sessions`
      : 'No finished run has a measured summary yet.',
  ];
  if (r.damaged) lines.push(`${r.damaged} record(s) are damaged and not counted: the gate names them.`);
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
  const inPeriod = (s) => s.end >= since && s.end < until;
  const closed = v.spans.filter((s) => s.receipt && s.claim && !s.conflict.length && inScope(s) && inPeriod(s));
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
  const out = {
    period: { since: Number.isFinite(since) ? localStamp(since) : null, until: Number.isFinite(until) ? localStamp(until) : null },
    receipts: closed.length, total, work: WORK.reduce((n, b) => n + total[b], 0), phases, items: byItem,
    open: open.map((s) => ({ item: s.item, span: s.id, agent: s.claim.fields.agent, since: s.claim.fields.at })),
    damaged: v.damaged.length, conflicted: v.spans.filter((s) => s.conflict.length).length, unclaimed: unclaimed.length,
  };
  if (!opts['no-transcripts']) {
    let rs = null;
    try { rs = raws(opts); } catch (e) { if (!(e instanceof Usage)) throw e; }
    if (rs) {
      // What the open spans' sessions have spent so far, where they ran here.
      out.localOpen = open.flatMap((s) => {
        const raw = rawOf(opts, s.session);
        if (!raw) return [];
        const to = Math.max(s.start, endOf(s, raw));
        const t = measureSpan(raw, s.start, to).table.rows.total;
        return [{ item: s.item, span: s.id, work: WORK.reduce((n, b) => n + t[b], 0), total: t.total }];
      });
      // Sessions on this machine in the period, outside every span of theirs.
      const claimed = new Map();
      for (const s of v.spans.filter((x) => x.claim && !x.conflict.length)) {
        const raw = rawOf(opts, s.session);
        claimed.set(s.session, [...(claimed.get(s.session) || []), { start: s.start, end: endOf(s, raw) }]);
      }
      let unassigned = 0;
      let sessions = 0;
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
      }
      out.unassigned = { work: round(unassigned), sessions };
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
      lines.push(`  ${o.item}, ${o.agent}, since ${localStamp(Date.parse(o.since))}${here ? `: so far ${h(here.work)} of work, measured on this machine only` : ': its transcript is not on this machine'}`);
    }
  }
  if (t.unassigned?.sessions) lines.push(`On this machine only: ${h(t.unassigned.work)} of work in ${t.unassigned.sessions} session(s) that claimed no item; it is on no item and no other machine sees it.`);
  if (t.damaged || t.conflicted || t.unclaimed) lines.push(`${t.damaged} damaged, ${t.conflicted} conflicting and ${t.unclaimed} unclaimed record(s) are not counted: the gate names them, and the figure is incomplete by them.`);
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
  const at = nowMs();
  for (const s of openSpans(v)) {
    const later = v.spans.some((o) => o !== s && o.claim && o.item === s.item && o.start > s.start);
    const status = v.by.get(s.item)?.status;
    let raw = null;
    try { raw = rawOf(opts, s.session); } catch (e) { if (!(e instanceof Usage)) throw e; }
    const stopped = raw ? at - raw.last > 15 * 60e3 : false;
    const ended = s.next || later || status !== 'active' || stopped;
    if (!ended) continue;
    if (!raw) { elsewhere.push({ item: s.item, span: s.id, agent: s.claim.fields.agent, since: s.claim.fields.at }); continue; }
    recover.push(receiptFor(v, s, opts, { end: status === 'active' && !s.next && !later ? 'stopped' : 'paused', reason: 'other', note: 'recovered: the session ended without writing its receipt', recovered: true }));
  }
  return { recover, elsewhere };
}

/**
 * The claim a session made and never wrote, typically one that ran before the
 * set wrote claims at all: dated at the start its transcript on this machine
 * shows, and marked recovered. It carries no forecast, since one written
 * afterwards forecasts nothing; `gaps` then writes the span's receipt.
 */
function recoveredClaim(v, it, me, role, opts) {
  if (!opts.session) throw new Usage('a recovered claim is another session\'s: name it with --harness and --session');
  if (opts.forecast || opts.due !== undefined || opts.away !== undefined) throw new Usage('a recovered claim carries no forecast: one written afterwards forecasts nothing');
  const at = parseWhen(opts.at ?? '');
  if (!Number.isFinite(at)) throw new Usage('--at <time> is required: the start the transcript shows');
  const raw = rawOf(opts, me.key);
  if (!raw) throw new NotHere(`the transcript of ${me.key} is not on this machine: its claim is recovered where it is`);
  if (at < raw.first - 60e3 || at > raw.last) throw new Usage(`--at ${localStamp(at)} is outside the session's transcript, ${localStamp(raw.first)} to ${localStamp(raw.last)}`);
  if (v.spans.some((s) => s.claim && s.session === me.key && s.item === it.id)) throw new Usage(`${me.key} already has a claim on ${it.id}`);
  const fields = { span: newSpanId(), at: iso(at), session: me.key, agent: agentName(me, role, opts), role, note: opts.note, recovered: iso(nowMs()) };
  return { item: it.id, body: formatRecord('claim', fields, null) };
}

// ---- commands ----------------------------------------------------------------

const FLAGS = ['json', 'no-transcripts', 'recovered'];

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
      const me = thisSession(opts);
      const out = [];
      if (opts.recovered) return post([recoveredClaim(b, it, me, role, opts)], opts);
      if (opts.at !== undefined) throw new Usage('--at is only for a claim recovered from a transcript (--recovered): a claim made now is dated now');
      for (const s of mineOpen(b, me.key)) {
        if (s.item === it.id) throw new Usage(`this session already holds span ${s.id} on ${it.id}`);
        // Taking the next item ends the span on the last one: its receipt goes first.
        out.push(receiptFor(b, s, opts, { end: 'paused', note: `took ${it.id}` }));
      }
      const at = nowMs();
      const table = opts.forecast ? parseForecast(opts.forecast) : null;
      if (opts.due !== undefined && opts.away !== undefined) throw new Usage('--due names the promised time; --away adds to the forecast: give one');
      let due;
      if (opts.due !== undefined) {
        due = parseWhen(opts.due);
        if (!Number.isFinite(due)) throw new Usage('--due needs a time');
      } else if (table) due = at + (table.rows.total.forecast + Number(count(opts, 'away') || 0)) * 60e3;
      const fields = {
        span: newSpanId(), at: iso(at), session: me.key, agent: agentName(me, role, opts), role,
        due: due === undefined ? undefined : iso(due), away: count(opts, 'away'),
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
    case 'gaps': {
      const g = gaps(v(), opts);
      if (opts.json) return JSON.stringify(g, null, 2);
      const lines = [];
      if (g.recover.length) lines.push(`${g.recover.length} span(s) ended with no receipt and are recovered from this machine's transcripts:`, '', post(g.recover, opts), '');
      if (g.elsewhere.length) lines.push(`${g.elsewhere.length} span(s) ended with no receipt, and their transcripts are not on this machine; each is written where its session ran, and until then its time is unknown:`,
        ...g.elsewhere.map((e) => `  ${e.item}: ${e.agent}, since ${localStamp(Date.parse(e.since))}`));
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
runs.mjs claim --recovered --item <id> --role <role> --harness <h> --session <id> --at <time> [--note <text>]
  the claim another session made and never wrote, at the start its transcript here shows; then gaps
runs.mjs receipt [--span <id>] --end paused|finished|handed-over|stopped [--reason owner|missing|other] [--note <text>] [--recovered]
  what the span spent, measured from this machine's transcript (exit 3 when it is not here)
runs.mjs event [--span <id>] --event stop|decision|ci [--reason owner|missing|other] [--note <text>]
runs.mjs finish --item <feature> --result pull-request|abandoned|stopped [--pr <url>] [--note <text>]
  this session's receipt, then the feature's summary: forecast against work by phase, occupied time
runs.mjs verdict --item <feature> --accepted as-is|after-changes|abandoned [--avoidable N] [--missed N] [--corrections N] [--rescues N] [--note <text>]
runs.mjs recovery --item <id> --grade R0|R1|R2|R3 [--from <harness>] [--to <harness>] [--note <text>]
runs.mjs gaps      spans that ended with no receipt: recovered here, or named where they are not
runs.mjs time [--since <date>] [--until <date>] [--item <id>] [--no-transcripts]
runs.mjs stalled | pace [--tasks N] | report | list
The current session is found by itself where the harness names it; else --harness <h> --session <id>.
Transcripts belong to the project by its git repository: [--project <name>] [--repo <path>]. Add --json for data.
Exit 0 done, 2 misuse, 3 the transcript is on another machine.`;

// ---- self-test -----------------------------------------------------------------

function selftest() {
  const home = mkdtempSync(join(tmpdir(), 'runs-selftest-'));
  const saved = { ...process.env };
  const savedCwd = process.cwd();
  const savedNow = Date.now;
  process.env.CLAUDE_CONFIG_DIR = join(home, 'claude');
  process.env.CODEX_HOME = join(home, 'codex');
  for (const [, key] of HERE) delete process.env[key];
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

    // Three more finished runs make a pace.
    for (const [k, occ] of [['G', 90], ['H', 120], ['I', 150]]) {
      backlog.issues.push({ id: k, title: `Feature ${k}`, type: 'epic', status: 'active', labels: [], parent: null, blockedBy: [], body: '', updatedAt: T(clock) });
      clock += 1000 * 60e3;
      const start = clock;
      act('claim', '--item', k, '--role', 'coordinator', '--forecast', 'build=60', '--tasks', '2', ...as(`s${k}`));
      transcript(`s${k}`, worked(start, occ));
      clock = start + occ * 60e3 + 60e3;
      act('finish', '--item', k, '--result', 'pull-request', ...as(`s${k}`));
    }
    const p = JSON.parse(cli('pace', '--tasks', '2', '--json'));
    expect('pace: measured from finished runs, their occupied time against their forecast', p.enough && p.runs === 4 && p.estimateRatio === 1.75);
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
  return spansOf(backlog).spans.filter((s) => s.receipt).reduce((n, s) => n + s.receipt.table.rows.total.total, 0);
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--selftest') return selftest();
  if (!args.length || args[0] === '--help') { console.log(HELP); return args.length ? 0 : 2; }
  try {
    console.log(run(args));
    return 0;
  } catch (e) {
    if (e instanceof NotHere) { console.error(e.message); return 3; }
    if (!(e instanceof Usage)) throw e;
    console.error(`${e.message}\n\n${HELP}`);
    return 2;
  }
}

process.exitCode = main();
