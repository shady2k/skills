#!/usr/bin/env node
/**
 * A neutral fake tracker, used by the tracker-sync proofs.
 * Store: a folder `fake/` in the worktree holding `items.jsonl`, one JSON
 * record per line: {id, title, status, holder, updated_at, comments[] with
 * {id, author, text, created_at}}. A record line may instead be a void:
 * {id, type: 'void', target, author, created_at}.
 * `fake/db.json` is the tracker's local database copy, rebuilt from the
 * state file and never committed.
 *
 * Subcommands (run with cwd = the store worktree unless noted):
 *   init --prefix <p>                 create an empty store, refuse if it exists
 *   ordinal --machine <name>          claim this machine's ordinal, print it
 *   export / import                   state file <-> local database copy
 *   export-side --out <folder>        the database's own state, for a refused flush
 *   db-write --item <i> --text <t>    a write the tracker accepted, not yet flushed
 *   where                             print the store path this checkout points at
 *   pointer-install --store <s> --checkout <c>
 *   pointer-check --checkout <c>      print the store path the checkout reaches
 *   pointer-env --store <s>           print the environment line the store implies
 *   claim --item <i> --holder <h>     write the claim; exit 3 when it is lost
 *   transition --item <i> --to <s>    move a status; exit 3 when it already moved
 *   post --item <i> --text <t>        post a record, prints the record's id
 *   void --record <id>                retire a record by naming it
 *   merge --ours --theirs --base --out --order --order-local --store
 *
 * Records get a machine-unique id `<kind>-<ordinal>-<seq>`; the ordinal comes
 * from .tracker-sync/machines.json (written by `ordinal`), so the same record
 * keeps the same id on every machine and the merge never renumbers one.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, basename, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';

const POINTERS = ['.fake-store', '.fake-tracker-pointer'];
const stateFile = () => join(process.cwd(), 'fake', 'items.jsonl');
const dbFile = () => join(process.cwd(), 'fake', 'db.json');

const out = (s) => process.stdout.write(s + '\n');
const die = (msg, code = 1) => { process.stderr.write('fake: ' + msg + '\n'); process.exit(code); };

function parseArgs(argv) {
  const flags = {}, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    let m = a.match(/^--([A-Za-z][A-Za-z-]*)=(.*)$/);
    if (m) { flags[m[1]] = m[2]; continue; }
    m = a.match(/^--([A-Za-z][A-Za-z-]*)$/);
    if (m) {
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) flags[m[1]] = argv[++i];
      else flags[m[1]] = '';
      continue;
    }
    pos.push(a);
  }
  return { flags, pos };
}

function readJsonl(p) {
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}
function writeJsonl(p, records) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''));
}
function mirrorDb() {
  const items = readJsonl(stateFile()).filter((r) => r.type !== 'void');
  mkdirSync(dirname(dbFile()), { recursive: true });
  writeFileSync(dbFile(), JSON.stringify({ records: items }, null, 1) + '\n');
}
const findItem = (items, id) => items.find((r) => r.id === id && r.type !== 'void');

function machinesPath() { return join(process.cwd(), '.tracker-sync', 'machines.json'); }

function nextSeqId(kind) {
  const machines = JSON.parse(readFileSync(machinesPath(), 'utf8'));
  const ordinal = machines.ordinals[machines.thisMachine];
  if (!ordinal) die('this machine holds no ordinal in machines.json (connect again)', 1);
  const records = readJsonl(stateFile());
  let max = 0;
  const pat = new RegExp('^' + kind + '-' + ordinal + '-(\\d+)$');
  const bump = (id) => { const m = String(id).match(pat); if (m) max = Math.max(max, Number(m[1])); };
  for (const r of records) {
    bump(r.id);
    for (const c of (r.comments || [])) bump(c.id);
  }
  return kind + '-' + ordinal + '-' + (max + 1);
}

function resolveStoreFrom(startDir) {
  let d = resolve(startDir);
  while (true) {
    for (const name of POINTERS) {
      const p = join(d, name);
      if (existsSync(p)) {
        const target = readFileSync(p, 'utf8').trim();
        if (!target) die('the store pointer at ' + p + ' is empty', 1);
        return resolve(dirname(p), target);
      }
    }
    const parent = dirname(d);
    if (parent === d) return null;
    d = parent;
  }
}

const a = parseArgs(process.argv.slice(2));
const sub = a.pos.shift();

switch (sub) {
  case 'init': {
    // the store worktree streams from the ref, so an existing state file here
    // is this same store arriving from another machine: init accepts it and
    // touches nothing. A checkout is refused: only the store may be
    // initialized, never a second tracker beside it.
    if (existsSync(stateFile()) && readFileSync(stateFile(), 'utf8').trim() && !existsSync(join(process.cwd(), '.git'))) {
      die('init ran outside the store worktree: a checkout must never initialize a tracker (' + dirname(stateFile()) + ')', 1);
    }
    mkdirSync(dirname(stateFile()), { recursive: true });
    writeJsonl(stateFile(), []);
    mirrorDb();
    out('fake store initialized' + (a.flags.prefix ? ' (id prefix ' + a.flags.prefix + ')' : ''));
    break;
  }
  case 'ordinal': {
    const machine = a.flags.machine || a.pos[0];
    if (!machine) die('ordinal needs --machine <name>', 1);
    const p = machinesPath();
    let data = { ordinals: {}, thisMachine: machine };
    if (existsSync(p)) {
      try { data = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { die('machines.json is unreadable: ' + e.message, 1); }
      data.ordinals = data.ordinals || {};
    }
    data.thisMachine = machine;
    if (data.ordinals[machine] === undefined) {
      const used = new Set(Object.values(data.ordinals));
      let n = 1;
      while (used.has(n)) n++;
      data.ordinals[machine] = n;
    }
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
    out(String(data.ordinals[machine]));
    break;
  }
  case 'export': case 'import': {
    // A tracker that refuses to flush its own database, which is what the
    // mechanism must never read as "nothing unexported". The refusal is the
    // tracker's own words, so a case can model one the recipe classifies and one
    // it does not.
    const refusal = process.env.FAKE_EXPORT_REFUSAL;
    if (sub === 'export' && refusal) {
      if (refusal === 'empty-over-filled') die('Refusing to export an empty database over a filled file; the state file is the newer one', 7);
      if (refusal === 'jsonl-changed') die('Refusing a no-op flush: the JSONL changed since its last certified sync, and the database holds what it accepted', 7);
      die('the export guard said something the recipe has never heard of', 9);
    }
    // A slow export is what makes the watcher's two loops meet: one holds the
    // store while the other wants it.
    const slow = Number(process.env.FAKE_SLOW_EXPORT || 0);
    if (sub === 'export' && slow > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, slow);
    mirrorDb();
    break;
  }
  // A write the tracker accepted and has not flushed: it is in the database and
  // not in the state file, exactly what a refused flush must not drop.
  case 'db-write': {
    const id = a.flags.item, text = a.flags.text;
    if (!id || text === undefined) die('db-write needs --item and --text', 1);
    const db = existsSync(dbFile()) ? JSON.parse(readFileSync(dbFile(), 'utf8')) : { records: [] };
    const target = (db.records || []).find((r) => r.id === id);
    if (!target) die('db-write: no record named ' + id + ' in the database', 1);
    target.comments = target.comments || [];
    target.comments.push({ id: nextSeqId('c'), author: process.env.FAKE_AUTHOR || 'local-session', text, created_at: new Date().toISOString() });
    writeFileSync(dbFile(), JSON.stringify(db, null, 1) + '\n');
    out(id);
    break;
  }
  // The database's own state in a side folder, for a flush the tracker refuses:
  // what the mechanism merges per item before anything is fast-forwarded.
  case 'export-side': {
    const dir = a.flags.out;
    if (!dir) die('export-side needs --out <folder>', 1);
    const db = existsSync(dbFile()) ? JSON.parse(readFileSync(dbFile(), 'utf8')) : { records: [] };
    writeJsonl(join(dir, 'fake', 'items.jsonl'), (db.records || []).filter((r) => r.type !== 'void'));
    out(dir);
    break;
  }
  case 'where': {
    const store = resolveStoreFrom(process.cwd());
    if (!store) die('no store pointer: neither ' + POINTERS.join(' nor ') + ' from ' + process.cwd() + ' upward', 1);
    out(store);
    break;
  }
  case 'pointer-check': {
    const start = a.flags.checkout || a.flags.dir || process.cwd();
    const store = process.env.FAKE_STORE || resolveStoreFrom(start);
    if (!store) die('no store pointer: ' + start + ' does not reach the store', 1);
    out(resolve(store));
    break;
  }
  case 'pointer-env': {
    const store = a.flags.store || a.flags.storedir || process.env.FAKE_STORE;
    if (!store) die('pointer-env needs the store path', 1);
    out('FAKE_STORE=' + (isAbsolute(store) ? store : resolve(process.cwd(), store)));
    break;
  }
  case 'pointer-install': {
    const store = a.flags.store || a.flags.storedir || process.env.FAKE_STORE || a.pos[0];
    const checkout = a.flags.checkout || a.flags.dir || a.pos[1] || process.cwd();
    if (!store) die('pointer-install needs the store path (no --store given)', 1);
    if (!existsSync(store)) die('pointer-install: the store ' + store + ' does not exist', 1);
    writeFileSync(join(resolve(checkout), POINTERS[0]), resolve(store) + '\n');
    out(resolve(store));
    break;
  }
  case 'claim': {
    const id = a.flags.item, holder = a.flags.holder;
    if (!id || !holder) die('claim needs --item and --holder', 1);
    const items = readJsonl(stateFile());
    const item = findItem(items, id);
    if (!item) die('no record named ' + id + ' to claim', 1);
    if (item.holder && item.holder !== holder) {
      die('the claim is lost: ' + id + ' is already held by ' + item.holder + ' in the merged state; read again and take other work', 3);
    }
    item.holder = holder;
    item.updated_at = new Date().toISOString();
    writeJsonl(stateFile(), items);
    mirrorDb();
    out(id);
    break;
  }
  case 'transition': {
    const id = a.flags.item, to = a.flags.to;
    if (!id || !to) die('transition needs --item and --to', 1);
    const items = readJsonl(stateFile());
    const item = findItem(items, id);
    if (!item) die('no record named ' + id + ' to move', 1);
    if (item.status === to) {
      die('the transition is lost: ' + id + ' is already ' + to + ' in the merged state; read again and take other work', 3);
    }
    item.status = to;
    item.updated_at = new Date().toISOString();
    writeJsonl(stateFile(), items);
    mirrorDb();
    out(id);
    break;
  }
  case 'post': {
    const id = a.flags.item;
    const text = a.flags.text !== undefined ? a.flags.text : a.pos[0];
    if (!id || text === undefined) die('post needs --item and --text', 1);
    const items = readJsonl(stateFile());
    const item = findItem(items, id);
    if (!item) die('no record named ' + id + ' to post onto', 1);
    const comment = {
      id: nextSeqId('c'),
      author: process.env.FAKE_AUTHOR || 'local-session',
      text,
      created_at: new Date().toISOString(),
    };
    item.comments.push(comment);
    item.updated_at = comment.created_at;
    writeJsonl(stateFile(), items);
    mirrorDb();
    out(comment.id);
    break;
  }
  case 'void': {
    const target = a.flags.record;
    if (!target) die('void needs --record <id>', 1);
    const items = readJsonl(stateFile());
    const v = {
      id: nextSeqId('v'),
      type: 'void',
      target,
      author: process.env.FAKE_AUTHOR || 'local-session',
      created_at: new Date().toISOString(),
    };
    writeJsonl(stateFile(), [...items, v]);
    mirrorDb();
    out(v.id);
    break;
  }
  case 'merge': {
    const ours = a.flags.ours, theirs = a.flags.theirs, baseF = a.flags.base,
      orderF = a.flags.order, orderLocalF = a.flags['order-local'], outFile = a.flags.out, storeDir = a.flags.store;
    for (const [k, v] of [['--ours', ours], ['--theirs', theirs], ['--base', baseF], ['--out', outFile], ['--store', storeDir]]) {
      if (!v) die('merge needs ' + k, 1);
    }
    const one = (p) => {
      const files = {}; let cur = null;
      for (const line of readFileSync(p, 'utf8').split('\n')) {
        const m = line.match(/^\s*===\s*(.+?)\s*$/);
        if (m) { cur = m[1]; files[cur] = []; }
        else if (cur) files[cur].push(line);
      }
      const key = Object.keys(files).find((k) => k.endsWith('items.jsonl'));
      return key ? files[key].filter((l) => l.trim()).map((l) => JSON.parse(l)) : [];
    };
    const oursItems = one(ours), theirsItems = one(theirs), baseItems = one(baseF);
    const orderLines = existsSync(orderF) ? readFileSync(orderF, 'utf8').split('\n').filter((l) => l.trim()) : [];
    const orderLocalLines = orderLocalF && existsSync(orderLocalF) ? readFileSync(orderLocalF, 'utf8').split('\n').filter((l) => l.trim()) : [];

    const scalars = ['title', 'status', 'holder'];
    const merged = [];
    const ids = [];
    for (const src of [baseItems, oursItems, theirsItems]) for (const it of src) {
      if (!ids.includes(it.id)) ids.push(it.id);
    }
    for (const id of ids) {
      const b = baseItems.find((x) => x.id === id) || null;
      const o = oursItems.find((x) => x.id === id) || null;
      const t = theirsItems.find((x) => x.id === id) || null;
      if ((o && o.type === 'void') || (t && t.type === 'void') || (b && b.type === 'void')) {
        // a void record is carried by id, never rewritten
        const v = o || t || b;
        if (!merged.some((m) => m.id === v.id)) merged.push(JSON.parse(JSON.stringify(v)));
        continue;
      }
      const first = b || o || t;
      const item = JSON.parse(JSON.stringify(first));
      // comments: union by id (records only append; they keep both sides)
      const comments = [], seen = new Set();
      for (const src of [b, o, t]) {
        for (const c of (src && src.comments) || []) {
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          comments.push(c);
        }
      }
      comments.sort((x, y) => (x.created_at || '').localeCompare(y.created_at || ''));
      item.comments = comments;
      // a field changed twice takes the newer value by the tracker's own
      // order (updated_at); where that does not separate the values, the
      // publication order decides: a value not on the remote yet (ours)
      // ranks as the tip being published now.
      for (const f of scalars) {
        const bv = b ? b[f] : undefined, ov = o ? o[f] : undefined, tv = t ? t[f] : undefined;
        if (ov !== bv && tv !== bv && ov !== tv) {
          const ou = (o && o.updated_at) || '', tu = (t && t.updated_at) || '';
          let winner, loserVal, loserSide;
          if (ou > tu) { winner = ov; loserVal = tv; loserSide = 'theirs'; }
          else if (tu > ou) { winner = tv; loserVal = ov; loserSide = 'ours'; }
          else { winner = ov; loserVal = tv; loserSide = 'theirs'; } // ours ranks newest
          item[f] = winner;
          if (loserVal !== undefined) {
            const h = createHash('sha256').update(id + '|' + f + '|' + JSON.stringify(loserVal)).digest('hex').slice(0, 10);
            const wcomment = {
              id: 'ow-' + h,
              author: 'sync-merge',
              text: 'overwritten ' + f + (loserSide === 'ours' ? ' (our side lost): ' : ' (their side lost): ') + JSON.stringify(loserVal),
              created_at: new Date().toISOString(),
            };
            if (!item.comments.some((c) => c.id === wcomment.id)) item.comments.push(wcomment);
          }
        } else if (tv !== bv) item[f] = tv;
        else if (ov !== bv) item[f] = ov;
      }
      item.updated_at = item.updated_at || first.updated_at || new Date().toISOString();
      merged.push(item);
    }
    // the merged store is written only to --out, in the same shape as the
    // sides, and never renumbers an existing record id
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, '=== fake/items.jsonl\n' + merged.map((r) => JSON.stringify(r)).join('\n') + (merged.length ? '\n' : ''));
    break;
  }
  default:
    die('unknown subcommand: ' + sub + '\nknown: init ordinal export import export-side db-write where pointer-install pointer-check pointer-env claim transition post void merge');
}
