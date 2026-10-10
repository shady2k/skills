#!/usr/bin/env node
/**
 * A product repository's lifecycle: the draft, the manifest, the name, the
 * remote and the bootstrap, as one program that runs without an agent.
 *
 * A product keeps its knowledge in a git repository of its own, apart from its
 * code: its documents, its intended model, its team's own skills, its
 * prototypes and the manifest naming the code repositories it spans. This
 * program is how that repository is made and changed, so the same rules hold
 * whether a person or an agent starts the product, and so a product wiki can
 * bundle one pinned release of it and let a person with no agent create a
 * product too.
 *
 * IT KNOWS NO PROJECT AND NO WIKI. It reads and writes the layout, the
 * manifest and git, and says what is wrong with what it finds, file and line,
 * in words a person who never heard of this set can act on.
 *
 * THE LAYOUT IS FIXED BY THE SCHEMA VERSION, never read from the manifest:
 *
 *   docs/        the product's documents, which a product wiki serves
 *   model/       the product's intended model
 *   skills/      the team's own skills, never a copy of the set
 *   prototypes/  throwaway prototypes built to answer design questions
 *   repos/       the code repositories the product spans, untracked by this
 *                repository's git
 *
 * `workspace.yaml` is the manifest. `schemaVersion` (1), `id` and `name` are
 * never renamed; a field this program does not know is ignored, so a manifest
 * written by a later version still opens.
 *
 * WHAT THIS READER REFUSES (each naming the file, the line where it is known,
 * and the field or the reason): a folder holding no manifest, a manifest that
 * cannot be read, and a manifest that is not the plain subset of YAML below.
 * The subset is block mappings, block sequences of mappings, plain and quoted
 * scalars and comments; an anchor, an alias, a tag, a flow collection, a
 * second document, a duplicate field and an alias standing where a field's
 * name goes are each refused, since a manifest is meant to read the same to a
 * person and to a tool. Beyond the syntax: a schema version this program does
 * not know, a missing or empty `id`, a `name` that is not a word, a `skills`
 * field that is not `<set>: <version>` lines, and a `repos` item that names no
 * folder name, no url, or a folder name another item already took.
 *
 * THE COMMANDS, and what each refuses before it changes anything:
 *
 *   new --home <folder> [--date YYYY-MM-DD]   a draft under the products home
 *   read [<folder>]                           a folder's manifest, read back
 *   rename <folder> <name>                    the product, named in place
 *   remote <folder> <url>                     `origin`, added and never pushed
 *   bootstrap <folder>                        the declared code repositories
 *   repo add <folder> <name> <url> [--branch <b>]
 *                                             a code repository, entered in
 *                                             the manifest and committed
 *   where [<folder>]                          what a folder is: a product
 *                                             repository, a code repository
 *                                             of one, or neither
 *
 * `new` takes the products home from its caller and from nowhere else: no
 * default, no environment variable. Its folder is `idea-YYYY-MM-DD`, then
 * `-2`, `-3` and so on, reserved with one non-recursive mkdir so two runs
 * cannot share a name; it is a git repository whose one commit holds the
 * constitution, the manifest and the empty folders, and `repos/` exists
 * untracked. `rename` keeps the `id` and every other byte of the manifest,
 * renames the folder within its parent and commits that alone, so relative
 * links and nothing else move. `bootstrap` clones the missing repositories
 * into `repos/<name>` and never replaces a checkout that is already there: it
 * reports it, as dirty when it has uncommitted changes, and leaves it alone.
 * Nothing any command writes holds an absolute path.
 *
 * `repo add` enters a code repository in the manifest: it appends its `name`,
 * `url` and optional `branch` to `repos`, keeping every other byte of the
 * manifest as it was written — a comment, a blank line, a quoted key, and the
 * line ending the file uses — and commits that change alone. It never clones:
 * `bootstrap` does. It refuses, before anything is written, a name that is not
 * a folder name, a name the manifest already declares, a manifest that cannot
 * be read, a folder that is no git repository of its own, and a folder holding
 * uncommitted changes, which the commit would take with it.
 *
 * `where` answers what a folder is, walking up from it: `product` with the
 * product repository, when the folder stands inside one; `code` with the
 * product repository and the name of the checkout, when it stands inside a git
 * repository directly under a product's `repos/`; `none` otherwise. All three
 * are an answer, not a failure. The walk ends where a git repository of its
 * own begins, so a folder that is another repository's working tree is neither
 * a product repository nor one of its code repositories, whatever stands above
 * it. A manifest the walk meets that cannot be read is refused: the folder it
 * stands over cannot be answered for.
 *
 * EXIT CODES. 0: done. 1: a step failed (git refused, a clone failed). 2: an
 * argument, a home or a manifest cannot be used. Every command takes `--json`,
 * for callers: one object on standard output, holding what the command did or
 * the refusal's `message`, `file` and `line`.
 *
 *   node product.mjs --help | --version | --selftest
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The schema version this program writes and reads; the folder layout is fixed by it alone. */
export const PRODUCT_SCHEMA_VERSION = 1;
/** The manifest's file, at a product folder's root. */
export const MANIFEST_FILE = 'workspace.yaml';
/**
 * The plugin version this program reports where no manifest of the set is
 * beside it, as inside a product wiki that bundled a pinned release. A test
 * keeps it equal to `.claude-plugin/plugin.json`, which wins where one is
 * found.
 */
export const PLUGIN_VERSION = '0.95.0';

const HERE = dirname(fileURLToPath(import.meta.url));

/** The subset of the environment git must not inherit from a caller. */
const GIT_LEAKS = ['GIT_DIR', 'GIT_INDEX_FILE', 'GIT_WORK_TREE'];

/** The folders the schema version fixes: every product holds them, in this layout. */
const FOLDERS = ['docs', 'model', 'skills', 'prototypes', 'repos'];
/** The folders of `FOLDERS` git does track, each kept by its `.gitkeep`. */
const TRACKED_FOLDERS = ['docs', 'model', 'skills', 'prototypes'];
const COMMITTED_FILES = ['AGENTS.md', 'CLAUDE.md', 'workspace.yaml', '.gitignore',
  'docs/.gitkeep', 'model/.gitkeep', 'skills/.gitkeep', 'prototypes/.gitkeep'];

/** The markers around the part of `AGENTS.md` this program maintains. */
const MAINTAINED_OPEN = '<!-- product:maintained -->';
const MAINTAINED_CLOSE = '<!-- /product:maintained -->';

/**
 * The constitution `new` writes: the folders and what each is for. It names no
 * project and no wiki, holds no path, and is written once — the part between
 * the markers is the only part a later version may update, so every section
 * below it, the set's own included, is left as it was.
 */
const CONSTITUTION = [
  '# Constitution',
  '',
  "This repository holds one product's knowledge, apart from the product's",
  'code: its documents, its intended model, its skills and its prototypes,',
  'kept as plain files in git. A product wiki serves these files as pages, so',
  'what is written here is what is read.',
  '',
  '## Folders',
  '',
  "- docs/ — the product's documents, written in Markdown and kept in git.",
  '- model/ — the model the product is meant to have.',
  "- skills/ — the team's own skills, written for this product; never a copy",
  "  of the skill set's own, whose pinned version is field `skills` of the",
  '  manifest, naming the set and its version (`shady2k: <version>`).',
  '- prototypes/ — throwaway prototypes built to answer design questions.',
  '- repos/ — the code repositories the product spans. Each one is a git',
  '  repository of its own, and this repository leaves repos/ untracked.',
  '',
  "The folders' places come with the manifest's `schemaVersion` and are never",
  'read from the manifest, so every tool and every agent knows where things',
  'are from the schema version alone.',
  '',
  '## Documents',
  '',
  'Every document is Markdown in git: a page someone writes, and what the',
  'reader later sees. Links between documents are relative paths, so this',
  'folder may be renamed without breaking them.',
  '',
  MAINTAINED_OPEN,
  'The manifest `workspace.yaml` is how a product is recognised. Its',
  '`schemaVersion`, `id` and `name` are never renamed; anything a later',
  'version adds grows beside them. `schemaVersion` (1 here) fixes the folder',
  "layout above; `id` is given at creation and kept for the product's life,",
  "whatever this folder is later called; for a draft, `name` is this folder's",
  'name. This file is written once, and a later version updates no part of it',
  'outside this marked section.',
  MAINTAINED_CLOSE,
  '',
].join('\n');

const USAGE = 'usage: node product.mjs <new|read|rename|remote|bootstrap|repo add|where> [options]';

const HELP = [
  USAGE,
  '',
  "A product keeps its knowledge in a git repository of its own: its",
  'documents, its intended model, its team\'s own skills, its prototypes and',
  'the manifest naming the code repositories it spans. These commands make',
  'that repository and change it.',
  '',
  'commands:',
  '  new --home <folder> [--date YYYY-MM-DD]',
  '        create a draft under the products home: `idea-YYYY-MM-DD`, then',
  '        `-2` and so on, a git repository whose one commit holds the',
  '        constitution, the manifest and the empty folders. Prints its',
  '        folder and its id. The home is named here, always: nothing else',
  '        decides it. --date fixes the day, so a test needs no clock.',
  '  read [<folder>]',
  "        read a product folder's manifest and print its folder, id, name",
  '        and schemaVersion, or the refusal with the file and the line.',
  '  rename <folder> <name>',
  '        name the product in place: the folder is renamed within its',
  '        parent and `name` is written in the manifest, its id and every',
  '        other byte kept, as one commit.',
  '  remote <folder> <url>',
  '        add `origin`. It never pushes: pushing is the person\'s decision.',
  '  bootstrap <folder>',
  '        clone the code repositories the manifest declares into',
  '        repos/<name>, one report per repository. A checkout already',
  '        there is never replaced: it is reported, as dirty when it has',
  '        uncommitted changes, and left alone.',
  '  repo add <folder> <name> <url> [--branch <b>]',
  '        enter one code repository in the manifest and commit it, keeping',
  '        every other byte as it was written. It never clones: `bootstrap`',
  '        does. A name that is not a folder name, a name already declared,',
  '        a manifest that cannot be read and uncommitted changes are each',
  '        refused before anything is written.',
  '  where [<folder>]',
  '        say what a folder is, walking up from it (the current folder by',
  '        default): `product` with the product repository, `code` with the',
  '        product repository and the checkout\'s name when the folder',
  '        stands in a git repository under a product\'s `repos/`, and',
  '        `none` otherwise. The walk ends where a git repository of its',
  '        own begins. All three exit 0.',
  '',
  'options:',
  '  --json    one object on standard output, for callers',
  '  --help    this text; --version prints the plugin version',
  '',
  'exit codes: 0 done, 1 a step failed (git refused, a clone failed),',
  '            2 an argument, a home or a manifest cannot be used.',
].join('\n');

/** An argument this program cannot use: the command line reports it and exits 2. */
class Misuse extends Error {}

// ---- reading a manifest: the plain subset of YAML --------------------------

/**
 * The line each field of a mapping, and each item of a sequence, was written
 * on: a refusal names the line, so the reader records it as it parses. Kept
 * outside the value itself, so a caller sees plain objects and arrays.
 */
const LINES = new WeakMap();

/**
 * The line a mapping's field was written on, or 1 when nothing recorded it.
 * The recording is looked for, never assumed: a refusal's line is a courtesy,
 * and a reader that threw where it meant to say "line unknown" would refuse
 * nothing at all.
 */
function lineOf(value, key) {
  const map = value !== null && typeof value === 'object' ? LINES.get(value) : undefined;
  return (map instanceof Map ? map.get(key) : undefined) ?? 1;
}

/** The line a sequence's item was written on, or 1 when nothing recorded it. */
function lineOfIndex(value, index) {
  const lines = Array.isArray(value) ? LINES.get(value) : undefined;
  return (Array.isArray(lines) ? lines[index] : undefined) ?? 1;
}

/** A refusal: the file, the line, and what is wrong with it. */
const refusal = (file, line, message) => ({ ok: false, file, line, message });

/** How a value stands in a message: as YAML would read it back. */
const shown = (value) => (value === undefined ? 'nothing' : JSON.stringify(value));

const isItemLine = (content) => /^-(\s|$)/.test(content);

/**
 * The manifest's lines, the blank ones and the comment-only ones gone: each
 * kept line with its indentation and its number. Indentation is spaces; a tab
 * in it is refused, since a tab means one thing to one reader and another to
 * the next.
 */
function readLines(text, file) {
  const kept = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    const body = lines[i].replace(/\s+$/, '');
    if (body.trim() === '') continue;
    const indentText = body.match(/^[ \t]*/)[0];
    if (indentText.includes('\t'))
      return refusal(file, line, `the manifest ${file} indents with a tab on line ${line}: a manifest is indented with spaces`);
    const content = body.slice(indentText.length);
    if (content.startsWith('#')) continue;
    if (content === '---' || content === '...' || /^(---|\.\.\.) /.test(content))
      return refusal(file, line, `the manifest ${file} opens another document on line ${line}: a manifest is one document`);
    kept.push({ indent: indentText.length, content, line });
  }
  return { ok: true, tokens: kept };
}

/**
 * The end of a scalar's text where a comment starts, or the whole of it. A
 * `#` inside a quoted value is the value's own character — a product called
 * `Draft # part` is called that — so quotes are walked, escapes and all.
 */
function cutComment(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote !== null) {
      if (quote === '"' && ch === '\\') { i++; continue; }
      if (ch === quote) {
        if (quote === "'" && text[i + 1] === "'") { i++; continue; }
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '#' && (i === 0 || /\s/.test(text[i - 1]))) return text.slice(0, i);
  }
  return text;
}

/** The `name: value` split of one line: the part before the first field colon, and after it. */
function splitPair(content) {
  let quote = null;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (quote !== null) {
      if (quote === '"' && ch === '\\') { i++; continue; }
      if (ch === quote) {
        if (quote === "'" && content[i + 1] === "'") { i++; continue; }
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === '#' && (i === 0 || /\s/.test(content[i - 1]))) return null;
    if (ch === ':' && (i + 1 === content.length || /\s/.test(content[i + 1])))
      return { key: content.slice(0, i), rest: content.slice(i + 1).trim() };
  }
  return null;
}

/**
 * A quoted scalar: single quotes with `''` for a quote, double quotes with the
 * usual escapes. What stands after the closing quote is refused rather than
 * silently dropped.
 */
function unquote(text, file, line) {
  const quote = text[0];
  let out = '';
  for (let i = 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === quote) {
      if (quote === "'" && text[i + 1] === "'") { out += "'"; i++; continue; }
      const rest = cutComment(text.slice(i + 1)).trim();
      if (rest !== '')
        return refusal(file, line, `the manifest ${file} holds "${rest}" after the quoted value on line ${line}: a quoted value ends the field`);
      return { ok: true, value: out };
    }
    if (quote === '"' && ch === '\\') {
      const next = text[i + 1];
      const escapes = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/', 0: '\0' };
      if (next === 'u') {
        const hex = text.slice(i + 2, i + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex))
          return refusal(file, line, `the manifest ${file} holds an escape on line ${line} that is not \u005cuXXXX: only the usual escapes are written`);
        out += String.fromCharCode(parseInt(hex, 16));
        i += 5;
        continue;
      }
      if (!(next in escapes))
        return refusal(file, line, `the manifest ${file} holds the escape "${'\\'}${next}" on line ${line}: only the usual escapes are written`);
      out += escapes[next];
      i++;
      continue;
    }
    out += ch;
  }
  return refusal(file, line, `the manifest ${file} opens a quote on line ${line} and never closes it: close it on the same line`);
}

/** The indicators this subset does not take, and what each is called. */
const INDICATORS = { '&': 'anchor', '*': 'alias', '!': 'tag' };

/** A scalar: plain, quoted, and nothing else this subset takes. */
function parseScalar(text, file, line) {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: null };
  const first = trimmed[0];
  if (INDICATORS[first])
    return refusal(file, line, `the manifest ${file} writes the ${INDICATORS[first]} "${trimmed}" on line ${line}: an anchor, an alias and a tag are not part of the subset this reader takes`);
  if (first === '{' || first === '[' || first === ']' || first === '}')
    return refusal(file, line, `the manifest ${file} writes the flow collection "${trimmed}" on line ${line}: fields are block mappings and block sequences of mappings, one per line`);
  if (first === "'" || first === '"') return unquote(trimmed, file, line);
  const plain = cutComment(trimmed).trim();
  // The words YAML reads as another value, in every spelling YAML reads them
  // in: `null`, `Null` and `~` are nothing, `true` and `True` are a truth.
  if (plain === '' || /^(null|~)$/i.test(plain)) return { ok: true, value: null };
  if (/^(true|false)$/i.test(plain)) return { ok: true, value: plain.toLowerCase() === 'true' };
  if (/:\s/.test(plain) || plain.endsWith(':'))
    return refusal(file, line, `the manifest ${file} holds "${plain}" on line ${line}: a value holding ": " is a mapping written on one line, and this reader takes a mapping one field per line`);
  if (/^[+-]?\d+$/.test(plain)) return { ok: true, value: Number(plain) };
  if (/^[+-]?(\d+\.\d*|\.\d+)([eE][+-]?\d+)?$/.test(plain)) return { ok: true, value: Number(plain) };
  return { ok: true, value: plain };
}

/** A field's name: a word, or a quoted one. An alias never stands in its place. */
function parseKey(text, file, line) {
  const trimmed = text.trim();
  // Nothing stands here: the field's own name is missing. The plain path below
  // refuses it too, so this reader says it once, where it reads.
  const first = trimmed[0];
  if (first === '*')
    return refusal(file, line, `the manifest ${file} stands the alias "${trimmed}" in a mapping key's place on line ${line}: a field is named by its own word, never by an alias`);
  if (INDICATORS[first])
    return refusal(file, line, `the manifest ${file} writes the ${INDICATORS[first]} "${trimmed}" where a field's name goes, on line ${line}: a field is named by its own word`);
  if (first === '{' || first === '[')
    return refusal(file, line, `the manifest ${file} writes the flow collection "${trimmed}" where a field's name goes, on line ${line}: fields are block mappings, one per line`);
  if (first === "'" || first === '"') {
    const quoted = unquote(trimmed, file, line);
    if (!quoted.ok) return quoted;
    if (typeof quoted.value !== 'string' || quoted.value === '')
      return refusal(file, line, `the manifest ${file} holds ${shown(quoted.value)} where a field's name goes, on line ${line}: a field is named by a word`);
    return { ok: true, value: quoted.value };
  }
  const plain = cutComment(trimmed).trim();
  if (plain === '')
    return refusal(file, line, `the manifest ${file} writes a field with no name on line ${line}: a field is written "name: value"`);
  return { ok: true, value: plain };
}
/** A block mapping at one indentation, its fields in the order they were written. */
function parseMapping(tokens, i, indent, file) {
  // Without a prototype: a manifest naming `__proto__` writes a field like
  // any other, and reading it never reaches an inherited `schemaVersion` or
  // `id` — an identity a manifest cannot hold is one it must not be read as.
  const value = Object.create(null);
  const positions = new Map();
  while (i < tokens.length && tokens[i].indent === indent && !isItemLine(tokens[i].content)) {
    const token = tokens[i];
    const pair = splitPair(token.content);
    if (pair === null)
      return refusal(file, token.line, `the manifest ${file} holds line ${token.line}, which is neither a field "name: value" nor a list item "- ...": a manifest is a block mapping of fields`);
    const key = parseKey(pair.key, file, token.line);
    if (!key.ok) return key;
    if (positions.has(key.value))
      return refusal(file, token.line, `the manifest ${file} names "${key.value}" twice, again on line ${token.line}: each field is given once`);
    positions.set(key.value, token.line);
    // `field: # a comment` is a field with no value on its line: what stands
    // indented under it is its block, and the comment is not the value.
    if (cutComment(pair.rest).trim() === '') {
      if (i + 1 < tokens.length && tokens[i + 1].indent > indent) {
        const sub = parseBlock(tokens, i + 1, tokens[i + 1].indent, file);
        if (!sub.ok) return sub;
        value[key.value] = sub.value;
        i = sub.i;
      } else {
        value[key.value] = null;
        i++;
      }
      continue;
    }
    const scalar = parseScalar(pair.rest, file, token.line);
    if (!scalar.ok) return scalar;
    value[key.value] = scalar.value;
    i++;
    if (i < tokens.length && tokens[i].indent > indent)
      return refusal(file, tokens[i].line, `the manifest ${file} indents line ${tokens[i].line} under "${key.value}", which already holds ${shown(scalar.value)}: a field holds one value`);
  }
  LINES.set(value, positions);
  return { ok: true, value, i };
}

/** A block sequence at one indentation: scalars, or mappings starting on the dash's own line. */
function parseSequence(tokens, i, indent, file) {
  const items = [];
  const lines = [];
  while (i < tokens.length && tokens[i].indent === indent && isItemLine(tokens[i].content)) {
    const token = tokens[i];
    const rest = token.content.replace(/^-(\s|$)/, '');
    if (rest === '') {
      if (i + 1 < tokens.length && tokens[i + 1].indent > indent) {
        const sub = parseBlock(tokens, i + 1, tokens[i + 1].indent, file);
        if (!sub.ok) return sub;
        items.push(sub.value);
        i = sub.i;
      } else {
        items.push(null);
        i++;
      }
    } else {
      const inner = indent + (token.content.length - rest.length);
      const sub = [{ indent: inner, content: rest, line: token.line }];
      let j = i + 1;
      while (j < tokens.length && tokens[j].indent > indent) { sub.push(tokens[j]); j++; }
      const parsed = parseBlock(sub, 0, inner, file);
      if (!parsed.ok) return parsed;
      if (parsed.i < sub.length)
        return refusal(file, sub[parsed.i].line, `the manifest ${file} indents line ${sub[parsed.i].line} under an item that already holds a value: a list item holds one value`);
      items.push(parsed.value);
      i = j;
    }
    lines.push(token.line);
  }
  LINES.set(items, lines);
  return { ok: true, value: items, i };
}

/** One block at one indentation: a mapping, a sequence, or a lone scalar. */
function parseBlock(tokens, i, indent, file) {
  if (isItemLine(tokens[i].content)) return parseSequence(tokens, i, indent, file);
  if (splitPair(tokens[i].content) !== null) return parseMapping(tokens, i, indent, file);
  const scalar = parseScalar(tokens[i].content, file, tokens[i].line);
  if (!scalar.ok) return scalar;
  return { ok: true, value: scalar.value, i: i + 1 };
}

/**
 * A whole manifest's text, read as the subset above: the value, or the first
 * refusal with the line it stands on.
 */
export function parseManifest(text, file) {
  const read = readLines(text, file);
  if (!read.ok) return read;
  const tokens = read.tokens;
  if (!tokens.length)
    return refusal(file, 1, `the manifest ${file} is empty: a product is recognised by its schemaVersion, its id and its name`);
  if (tokens[0].indent !== 0)
    return refusal(file, tokens[0].line, `the manifest ${file} indents its first line by ${tokens[0].indent} spaces: a manifest starts at the left margin`);
  const parsed = parseBlock(tokens, 0, 0, file);
  if (!parsed.ok) return parsed;
  if (parsed.i < tokens.length)
    return refusal(file, tokens[parsed.i].line, `the manifest ${file} holds line ${tokens[parsed.i].line} at a place of its own: a field holds one value, and a value's lines are indented under it`);
  return { ok: true, value: parsed.value };
}

/** A folder name a code repository may take: one path segment, and nothing that moves. */
function isFolderName(name) {
  return typeof name === 'string' && name !== '' && name === name.trim()
    && name !== '.' && name !== '..' && !/[/\\\u0000-\u001f]/.test(name);
}

// ---- a product, read from its manifest ------------------------------------

/**
 * Reads one product folder's manifest. Refused — never defaulted, never
 * logged — when the folder holds no manifest, the manifest cannot be read or
 * is not the subset above, names no schema version this program knows, names
 * no `id`, or names a `skills` or `repos` field this program cannot use. A
 * field this program does not know is ignored: a manifest grows by fields
 * added beside the three.
 *
 * The product it returns carries where it was read (the folder's full path),
 * the three fields that are never renamed, and the fields a caller needs to
 * work with the code repositories: `skills` and `repos`.
 */
export function readProduct(productFolder) {
  const folder = resolve(productFolder);
  const manifestFile = join(folder, MANIFEST_FILE);

  let text;
  try {
    text = readFileSync(manifestFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT')
      return refusal(manifestFile, 1, `the folder ${folder} holds no ${MANIFEST_FILE}: a product is recognised by its manifest`);
    return refusal(manifestFile, 1, `the manifest ${manifestFile} could not be read: ${error.message}`);
  }

  const parsed = parseManifest(text, manifestFile);
  if (!parsed.ok) return parsed;
  const record = parsed.value;
  if (record === null || typeof record !== 'object' || Array.isArray(record))
    return refusal(manifestFile, 1, `the manifest ${manifestFile} holds ${shown(record)}: a manifest is a mapping of fields, and this is not one`);

  if (!('schemaVersion' in record))
    return refusal(manifestFile, 1, `the manifest ${manifestFile} names no "schemaVersion": a product knows version ${PRODUCT_SCHEMA_VERSION}`);
  if (record.schemaVersion !== PRODUCT_SCHEMA_VERSION)
    return refusal(manifestFile, lineOf(record, 'schemaVersion'), `the manifest ${manifestFile} holds ${shown(record.schemaVersion)} at "schemaVersion": not a schema version this program knows; it writes ${PRODUCT_SCHEMA_VERSION}`);

  if (!('id' in record))
    return refusal(manifestFile, 1, `the manifest ${manifestFile} names no "id": a product is identified by the id it was given at creation`);
  if (typeof record.id !== 'string' || record.id.trim() === '')
    return refusal(manifestFile, lineOf(record, 'id'), `the manifest ${manifestFile} holds ${shown(record.id)} at "id": a product is identified by the id it was given at creation, and it is a word`);

  let name;
  if (record.name === undefined || record.name === '') name = basename(folder.replace(/[/\\]+$/, ''));
  else if (typeof record.name === 'string') name = record.name;
  else return refusal(manifestFile, lineOf(record, 'name'), `the manifest ${manifestFile} holds ${shown(record.name)} at "name": not a name, which is a word`);

  const skills = record.skills;
  if (skills !== undefined && skills !== null) {
    if (typeof skills !== 'object' || Array.isArray(skills))
      return refusal(manifestFile, lineOf(record, 'skills'), `the manifest ${manifestFile} holds ${shown(skills)} at "skills": the set pinned here is written as "shady2k: <version>", one line per set`);
    for (const [set, version] of Object.entries(skills)) {
      if (typeof version !== 'string' || version.trim() === '')
        return refusal(manifestFile, lineOf(skills, set), `the manifest ${manifestFile} holds ${shown(version)} at "skills", beside "${set}": the version of the set pinned here, as a word`);
    }
  }

  const repos = [];
  const declared = record.repos;
  if (declared !== undefined && declared !== null) {
    if (!Array.isArray(declared))
      return refusal(manifestFile, lineOf(record, 'repos'), `the manifest ${manifestFile} holds ${shown(declared)} at "repos": the code repositories are a list, each item "name:", "url:" and an optional "branch:"`);
    const taken = new Set();
    for (let i = 0; i < declared.length; i++) {
      const entry = declared[i];
      const at = lineOfIndex(declared, i);
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry))
        return refusal(manifestFile, at, `the manifest ${manifestFile} holds ${shown(entry)} at "repos", on line ${at}: a code repository is written as "name:", "url:" and an optional "branch:"`);
      // A field an item leaves out is reported on the item's own line: the
      // line the reader knows is the one the item starts on.
      const atName = entry.name === undefined ? at : lineOf(entry, 'name');
      const atUrl = entry.url === undefined ? at : lineOf(entry, 'url');
      const atBranch = entry.branch === undefined ? at : lineOf(entry, 'branch');
      if (!isFolderName(entry.name))
        return refusal(manifestFile, atName, `the manifest ${manifestFile} holds ${shown(entry.name)} at "repos", beside "name": a code repository is named by the folder it is cloned into, and that name is one path segment`);
      if (taken.has(entry.name))
        return refusal(manifestFile, atName, `the manifest ${manifestFile} names the code repository "${entry.name}" twice, on line ${atName}: each repository is declared once, and clones into its own folder`);
      taken.add(entry.name);
      if (typeof entry.url !== 'string' || entry.url.trim() === '')
        return refusal(manifestFile, atUrl, `the manifest ${manifestFile} holds ${shown(entry.url)} at "repos", beside "url": a code repository is cloned from the url it declares`);
      if (entry.branch !== undefined && entry.branch !== null && (typeof entry.branch !== 'string' || entry.branch.trim() === ''))
        return refusal(manifestFile, atBranch, `the manifest ${manifestFile} holds ${shown(entry.branch)} at "repos", beside "branch": the branch a clone is taken from, as a word`);
      repos.push({ name: entry.name, url: entry.url, branch: typeof entry.branch === 'string' ? entry.branch : undefined });
    }
  }

  return { ok: true, product: { folder, id: record.id, name, schemaVersion: PRODUCT_SCHEMA_VERSION, skills: skills ?? {}, repos } };
}

// ---- git, and the environment it runs in ----------------------------------

/**
 * One git invocation in a folder. The caller's loader variables (`GIT_DIR`
 * and its companions) are stripped, so a git call here never reaches into
 * another repository's worktree, and `extra` is merged over what is left,
 * which is how a test seals an identity.
 */
function runGit(folder, args, extra) {
  const env = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && !GIT_LEAKS.includes(name)) env[name] = value;
  }
  Object.assign(env, extra ?? {});
  const run = spawnSync('git', args, { cwd: folder, encoding: 'utf8', env });
  const output = `${run.stderr ?? ''}${run.stdout ?? ''}`.trim();
  if (run.error !== undefined) {
    // No run happened: git's own error — normally ENOENT under a name PATH
    // does not hold — is the only cause there is.
    return { ok: false, output: output === '' ? run.error.message : `${output}; ${run.error.message}` };
  }
  if (run.status !== 0) return { ok: false, output };
  return { ok: true, output };
}

/**
 * A word as YAML reads it back: plain where the plain spelling reads back as
 * that same word, quoted where it does not — `123`, `true` and `null` are
 * other YAML values, and a word with a space at its edge, a `:`, a `#` or a
 * leading indicator is not a plain scalar at all. A name written into a
 * manifest is a name the reader must give back, whatever it is called.
 */
const yamlWord = (word) => (/^[A-Za-z_][A-Za-z0-9 ._+-]*$/.test(word) && !/^(true|false|null)$/i.test(word)
  ? word
  : `'${word.replace(/'/g, "''")}'`);

/**
 * Whether two paths name the same folder. `git` answers with the path its own
 * working directory resolved to, which is the real one: a folder reached
 * through a symlink would otherwise be taken for another folder, and a
 * product reached through a link would answer for nothing at all. A path that
 * cannot be resolved — one of them removed mid-command — falls back to the
 * spelling itself.
 */
function sameFolder(one, other) {
  try {
    return realpathSync(one) === realpathSync(other);
  } catch {
    return resolve(one) === resolve(other);
  }
}

/**
 * Whether a folder is a git repository of its own, rather than a folder
 * standing inside one: `git` run in a folder with no repository of its own
 * answers for the repository above it, so a command that wrote there would
 * write to someone else's product.
 */
function ownRepository(folder, gitEnv) {
  const top = runGit(folder, ['rev-parse', '--show-toplevel'], gitEnv);
  return top.ok && sameFolder(top.output, folder);
}

/**
 * Why a day cannot be used, or null when it can. A draft's day is written
 * `YYYY-MM-DD` and is a day the calendar has, so a test never depends on the
 * clock and no folder is named after a day that does not exist.
 */
export function whyNotADay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'is not written YYYY-MM-DD';
  const [year, month, day] = date.split('-').map(Number);
  const asDate = new Date(Date.UTC(year, month - 1, day));
  if (asDate.getUTCFullYear() !== year || asDate.getUTCMonth() !== month - 1 || asDate.getUTCDate() !== day)
    return 'is not a day of the calendar';
  return null;
}

/** A draft's day, as `YYYY-MM-DD`, from the caller's word or the local clock. */
function dayOf(date) {
  if (typeof date === 'string') {
    const why = whyNotADay(date);
    if (why !== null) return { ok: false, message: `the day "${date}" ${why}` };
    return { ok: true, day: date };
  }
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return { ok: true, day: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` };
}

/** The manifest's text as `new` writes it: the three fields that are never renamed. */
const manifestText = (id, name) => [`schemaVersion: ${PRODUCT_SCHEMA_VERSION}`, `id: ${id}`, `name: ${yamlWord(name)}`, ''].join('\n');

/**
 * Reserves the day's folder name in the products home: one non-recursive
 * mkdir of the candidate, growing the suffix until a name this call alone
 * reserved. A recursive reservation would succeed into another run's folder,
 * and its cleanup would then delete that run's work.
 */
export function reserveDraftFolder(home, day) {
  for (let attempt = 1; ; attempt++) {
    const name = attempt === 1 ? `idea-${day}` : `idea-${day}-${attempt}`;
    const candidate = join(home, name);
    try {
      mkdirSync(candidate);
      return { folder: candidate, name };
    } catch (error) {
      if (error.code === 'EEXIST') continue;
      throw error;
    }
  }
}

/** Removes the folder this invocation itself reserved; the failure, when there is one, is the caller's to report. */
function removeDraftFolder(folder) {
  try {
    rmSync(folder, { recursive: true, force: true });
    return undefined;
  } catch (error) {
    return `the failed draft's folder ${folder} could not be removed: ${error.message}`;
  }
}

/**
 * Creates a draft product repository under the products home the caller
 * names. Nothing is refused half-done: the home is judged before any product
 * folder exists, and after the folder was created, every failure removes it
 * again — when even that removal fails, the message names the folder that was
 * left behind, so a failed run never leaves one without saying where.
 */
export function createDraft({ home, date, gitEnv } = {}) {
  if (typeof home !== 'string' || home.trim() === '')
    return { outcome: 'refused', message: 'no products home was given: a product is created under the home its caller names, and this program reads none from anywhere else' };
  const products = resolve(home.trim());

  // The day is judged before anything at all is made: a command refused for
  // its arguments leaves no folder behind, not even the home.
  const day = dayOf(date);
  if (!day.ok) return { outcome: 'refused', message: day.message };

  // A home that is not a folder is refused before anything is written: a
  // file of that name must not be replaced, and nothing must land beside it
  // by surprise.
  try {
    if (!statSync(products).isDirectory())
      return { outcome: 'refused', message: `the products home ${products} cannot be used: a file of that name is in the way, and products are written under it — point the command at another home` };
  } catch {
    // Absent: created below, as any missing products home is.
  }
  try {
    mkdirSync(products, { recursive: true });
  } catch (error) {
    return { outcome: 'refused', message: `the products home ${products} cannot be created: ${error.message}` };
  }

  let folder;
  let name;
  try {
    // The draft's name is the reserved candidate's own name, read once here
    // for the manifest and the result — never again from a slice of the path,
    // which a home of `/` would cut a letter off.
    const reserved = reserveDraftFolder(products, day.day);
    folder = reserved.folder;
    name = reserved.name;
  } catch (error) {
    if (['EACCES', 'EPERM', 'EROFS'].includes(error.code))
      return { outcome: 'refused', message: `the products home ${products} cannot be written into: ${error.message}` };
    return { outcome: 'failed', message: `the draft could not be created in ${products}: ${error.message}` };
  }

  const id = randomUUID();
  try {
    for (const folderName of FOLDERS) mkdirSync(join(folder, folderName));
    writeFileSync(join(folder, 'AGENTS.md'), CONSTITUTION);
    writeFileSync(join(folder, 'CLAUDE.md'), '@AGENTS.md\n');
    writeFileSync(join(folder, MANIFEST_FILE), manifestText(id, name));
    writeFileSync(join(folder, '.gitignore'), 'repos/\n');
    for (const folderName of TRACKED_FOLDERS) writeFileSync(join(folder, folderName, '.gitkeep'), '');

    const init = runGit(folder, ['init', '--quiet', '--initial-branch=main'], gitEnv);
    if (!init.ok) throw new Error(`git init failed in ${folder}: ${init.output}`);
    const add = runGit(folder, ['add', ...COMMITTED_FILES], gitEnv);
    if (!add.ok) throw new Error(`git add failed in ${folder}: ${add.output}`);
    const commit = runGit(folder, ['commit', '--quiet', '-m', 'Create the draft product'], gitEnv);
    if (!commit.ok) throw new Error(`git commit failed in ${folder}: ${commit.output}`);
  } catch (error) {
    const failure = error.message;
    const cleanup = removeDraftFolder(folder);
    return { outcome: 'failed', message: cleanup === undefined ? failure : `${failure}; ${cleanup}` };
  }
  return { outcome: 'created', folder, id, name };
}

// ---- the product, named, given a remote, and bootstrapped ------------------

/** Why a product may not take a folder name, or null when it may. */
function whyNotAFolderName(name) {
  if (typeof name !== 'string' || name.trim() === '') return 'a product is named by a word, and this is empty';
  if (name !== name.trim()) return 'a folder name does not begin or end with a space';
  if (name === '.' || name === '..') return 'a folder name is not "." or ".."';
  if (/[/\\]/.test(name)) return 'a folder name is one path segment, and this holds a separator';
  if (/[\u0000-\u001f]/.test(name)) return 'a folder name holds no control character';
  return null;
}

/**
 * The word a field's key spells, however it spells it: bare, single- or
 * double-quoted, with the escapes a double-quoted scalar takes. A key written
 * `"n\u0061me"` names `name`, and the field it names is that one — a rename
 * that matched the text of a key would leave the product's own field alone and
 * write a second one beside it.
 */
function decodedKeyWord(key) {
  const trimmed = key.trim();
  if (trimmed === '') return null;
  if (trimmed[0] === "'" || trimmed[0] === '"') {
    const read = unquote(trimmed, '', 1);
    return read.ok && typeof read.value === 'string' ? read.value : null;
  }
  return cutComment(trimmed).trim();
}

/**
 * The manifest's text with its `name` field written as the product's new
 * name, every other byte kept. The field is found by its own name, however
 * the manifest spells the key — bare, single- or double-quoted — and only
 * the value is replaced: a comment standing on that line stays where the
 * person wrote it.
 */
function manifestNamed(text, name) {
  const lines = text.split('\n');
  let written = false;
  const out = lines.map((line) => {
    if (written) return line;
    const cr = line.endsWith('\r') ? '\r' : '';
    const bare = cr === '' ? line : line.slice(0, -1);
    const lead = bare.match(/^[ \t]*/)[0];
    // Only the product's own field, which stands at the left margin: a
    // `name` inside `repos:` or inside any other field belongs to that field,
    // and renaming the product must never reach it.
    if (lead !== '') return line;
    const pair = splitPair(bare);
    if (pair === null || decodedKeyWord(pair.key) !== 'name') return line;
    written = true;
    // Everything else on the line stays as it was written: the key's own
    // spelling, the spacing after the colon, a comment at its end, and a
    // carriage return where the manifest has one.
    const after = bare.slice(pair.key.length + 1);
    const gap = after.match(/^[ \t]*/)[0];
    const rest = after.slice(gap.length);
    // The comment starts at its own `#`: the spaces before it were written by
    // someone, and they stay where they are.
    const comment = rest.slice(cutComment(rest).replace(/\s+$/, '').length);
    return `${pair.key}:${gap}${yamlWord(name)}${comment}${cr}`;
  });
  if (!written) {
    if (out[out.length - 1] === '') out.splice(out.length - 1, 0, `name: ${yamlWord(name)}`);
    else out.push(`name: ${yamlWord(name)}`);
  }
  return out.join('\n');
}

/** Puts a failed rename back as it was; the failure, when there is one, is the caller's to report. */
function putRenameBack(from, to, manifest, gitEnv) {
  try {
    writeFileSync(join(from, MANIFEST_FILE), manifest);
    runGit(from, ['reset', '--quiet', '--', MANIFEST_FILE], gitEnv);
    renameSync(from, to);
    return undefined;
  } catch (error) {
    return `the failed rename left the product in ${from}: ${error.message}`;
  }
}

/**
 * Names a draft in place: the folder is renamed within its parent, `name` is
 * written in the manifest, and that change is one commit. The `id` and every
 * other byte of the manifest are kept, and nothing written holds an absolute
 * path, so the links between the product's documents still reach each other.
 * Every refusal — a folder name a product cannot take, a name already taken in
 * the parent, a working tree with uncommitted changes, a manifest that cannot
 * be used — happens before anything moves.
 */
export function renameProduct({ folder: given, name, gitEnv } = {}) {
  const read = readProduct(given === undefined ? '.' : given);
  if (!read.ok) return { outcome: 'refused', message: read.message, file: read.file, line: read.line };
  const folder = read.product.folder;

  const why = whyNotAFolderName(name);
  if (why !== null) return { outcome: 'refused', message: `the name "${name}" cannot be a product's: ${why}` };

  const target = join(dirname(folder), name);
  if (target === folder)
    return { outcome: 'refused', message: `the folder ${folder} is already named "${name}": naming a product to the name it has makes no commit` };
  if (existsSync(target))
    return { outcome: 'refused', message: `the folder ${target} is in the way: a product's name is the folder it lives in, and that name is taken` };
  if (!ownRepository(folder, gitEnv))
    return { outcome: 'refused', message: `the folder ${folder} is not a git repository of its own: naming a product in place is one commit of the product's history, and a commit made here would land in the repository around it` };

  const status = runGit(folder, ['status', '--porcelain'], gitEnv);
  if (!status.ok) return { outcome: 'failed', message: `git status failed in ${folder}: ${status.output}` };
  if (status.output !== '')
    return { outcome: 'refused', message: `the folder ${folder} holds changes that are not committed: commit them first, since naming the product is a commit of its own and would take them with it` };

  const manifest = readFileSync(join(folder, MANIFEST_FILE), 'utf8');
  // The move itself is a step like the commit that follows it: a folder that
  // cannot be renamed failed, and says so with the name and the reason.
  let moved = false;
  try {
    renameSync(folder, target);
    moved = true;
    writeFileSync(join(target, MANIFEST_FILE), manifestNamed(manifest, name));
    const add = runGit(target, ['add', '--', MANIFEST_FILE], gitEnv);
    if (!add.ok) throw new Error(`git add failed in ${target}: ${add.output}`);
    const commit = runGit(target, ['commit', '--quiet', '-m', `Name the product ${name}`], gitEnv);
    if (!commit.ok) throw new Error(`git commit failed in ${target}: ${commit.output}`);
  } catch (error) {
    if (!moved) return { outcome: 'failed', message: `the folder ${folder} could not be renamed to ${target}: ${error.message}` };
    const back = putRenameBack(target, folder, manifest, gitEnv);
    return { outcome: 'failed', message: back === undefined ? error.message : `${error.message}; ${back}` };
  }
  return { outcome: 'renamed', folder: target, id: read.product.id, name };
}

/**
 * Adds `origin` to a product. It never pushes: a product's remote is where its
 * own history is kept, and pushing is the person's decision, taken with the
 * command of their git. An `origin` already there is refused rather than
 * replaced, so a remote someone set is never silently repointed.
 */
export function addRemote({ folder: given, url, gitEnv } = {}) {
  const read = readProduct(given === undefined ? '.' : given);
  if (!read.ok) return { outcome: 'refused', message: read.message, file: read.file, line: read.line };
  const folder = read.product.folder;

  const wanted = typeof url === 'string' ? url.trim() : '';
  if (wanted === '')
    return { outcome: 'refused', message: 'no url was given: a remote is added with the url the code repository lives at' };
  if (wanted.startsWith('-'))
    return { outcome: 'refused', message: `the url "${wanted}" begins with "-", which a command line reads as an option: write the url itself` };

  // The remote belongs to the product's own repository: added from a folder
  // that has none of its own, git would add it to the repository around it.
  if (!ownRepository(folder, gitEnv))
    return { outcome: 'refused', message: `the folder ${folder} is not a git repository of its own: a product's remote is added to the product's repository, and a command run here would reach the one around it` };
  const remotes = runGit(folder, ['remote'], gitEnv);
  if (!remotes.ok) return { outcome: 'failed', message: `git remote failed in ${folder}: ${remotes.output}` };
  if (remotes.output.split('\n').map((line) => line.trim()).includes('origin'))
    return { outcome: 'refused', message: `the folder ${folder} already has the remote "origin": point it at another url deliberately, or remove it first` };

  const add = runGit(folder, ['remote', 'add', 'origin', wanted], gitEnv);
  if (!add.ok) return { outcome: 'failed', message: `git remote add failed in ${folder}: ${add.output}` };
  return { outcome: 'added', folder, remote: 'origin', url: wanted };
}

/**
 * Clones the code repositories the manifest declares into `repos/<name>`. A
 * checkout already there is never replaced: it is reported, as dirty when it
 * has uncommitted changes, and left as it is — a person's work in it is not
 * this program's to discard. One report per repository, and a repository that
 * could not be cloned is reported too, so the caller sees every outcome of
 * one run.
 */
export function bootstrapProduct({ folder: given, gitEnv } = {}) {
  const read = readProduct(given === undefined ? '.' : given);
  if (!read.ok) return { outcome: 'refused', message: read.message, file: read.file, line: read.line };
  const folder = read.product.folder;
  const reposFolder = join(folder, 'repos');
  const reports = [];

  for (const repo of read.product.repos) {
    const target = join(reposFolder, repo.name);
    if (existsSync(target)) {
      if (!statSync(target).isDirectory()) {
        reports.push({ name: repo.name, url: repo.url, state: 'failed', dirty: false, message: `${target} is not a folder: a checkout is a folder, and that name is taken by something else` });
        continue;
      }
      // A checkout of its own, or nothing this program can report on: a
      // folder that is no repository would answer `git status` with the
      // repository around it, and its report would be about someone else's
      // work. It is named for what it is and left alone.
      const top = runGit(target, ['rev-parse', '--show-toplevel'], gitEnv);
      if (!top.ok || resolve(top.output) !== resolve(target)) {
        reports.push({ name: repo.name, url: repo.url, state: 'failed', dirty: false, message: `${target} is not a git checkout of its own: something else of that name is there, and this program leaves it alone` });
        continue;
      }
      const status = runGit(target, ['status', '--porcelain'], gitEnv);
      reports.push({
        name: repo.name,
        url: repo.url,
        state: 'present',
        // Unknown is not clean: a checkout whose state could not be read is
        // reported as it is found, never as one that is up to date.
        dirty: status.ok ? status.output !== '' : null,
        message: status.ok ? undefined : `left alone, and its state could not be read: ${status.output}`,
      });
      continue;
    }
    try {
      mkdirSync(reposFolder, { recursive: true });
    } catch (error) {
      reports.push({ name: repo.name, url: repo.url, state: 'failed', dirty: false, message: `the folder ${reposFolder} could not be created: ${error.message}` });
      continue;
    }
    const args = ['clone', '--quiet'];
    if (repo.branch !== undefined) args.push('--branch', repo.branch);
    args.push(repo.url, target);
    const clone = runGit(folder, args, gitEnv);
    if (!clone.ok)
      reports.push({ name: repo.name, url: repo.url, state: 'failed', dirty: false, message: `git clone failed for ${repo.url} into ${target}: ${clone.output}` });
    else reports.push({ name: repo.name, url: repo.url, state: 'cloned', dirty: false });
  }
  return { outcome: 'bootstrapped', folder, repos: reports };
}

// ---- a code repository entered, and what a folder is -----------------------

/** Why a code repository may not take a folder name, or null when it may. */
function whyNotARepositoryName(name) {
  if (typeof name !== 'string' || name.trim() === '') return 'a code repository is named by the folder it is cloned into, and this is empty';
  if (name !== name.trim()) return 'a folder name does not begin or end with a space';
  if (name === '.' || name === '..') return 'a folder name is not "." or ".."';
  if (/[/\\]/.test(name)) return 'a folder name is one path segment, and this holds a separator';
  if (/[\u0000-\u001f]/.test(name)) return 'a folder name holds no control character';
  return null;
}

/**
 * A url or a branch as the manifest writes it: plain where the reader gives
 * that same text back, quoted where it does not. The reader decides, and no
 * second rule is written beside it: a url a person reads stays unquoted — it
 * holds ":" and "/", which a plain scalar takes — and one the reader would
 * give back as a number, a truth, nothing, a mapping or a comment is quoted,
 * so what is written is what is read. A relative path a repository sits at
 * can be such a value: `.5` is the number `0.5` to a YAML reader.
 *
 * A value holding a character one line cannot carry — a newline, a tab, a
 * carriage return — is written double-quoted with the escapes the reader
 * understands, since a quoted scalar is one line and an escape is how YAML
 * writes such a character inside one. A name is not written this way: it is a
 * word by its own refusal, so `yamlWord` writes it.
 */
function yamlText(value) {
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    const escaped = value.replace(/[\u0000-\u001f\u007f"\\]/g, (ch) => {
      const named = { '"': '\\"', '\\': '\\\\', '\n': '\\n', '\t': '\\t', '\r': '\\r' };
      return named[ch] ?? `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
    });
    return `"${escaped}"`;
  }
  const read = parseScalar(value, '', 1);
  const plain = read.ok && typeof read.value === 'string' && read.value === value && value.trim() === value;
  return plain ? value : `'${value.replace(/'/g, "''")}'`;
}

/**
 * The lines of one `repos` item, at the indentation the block's items use:
 * the first field on the item's own line, the others indented under it. The
 * caller ends each line the way the file ends its own.
 */
function repoItemLines(repo, indent) {
  const field = (name, value) => `${' '.repeat(indent + 2)}${name}: ${value}`;
  const lines = [`${' '.repeat(indent)}- name: ${yamlWord(repo.name)}`, field('url', yamlText(repo.url))];
  if (repo.branch !== undefined) lines.push(field('branch', yamlText(repo.branch)));
  return lines;
}

/**
 * The manifest's text with one code repository appended to `repos`, every
 * other byte kept: the field is found by its own name, however the manifest
 * spells the key, only where it stands at the left margin, so a `repos` of
 * another field is never reached. The item is written at the end of the
 * sequence with the indentation the sequence's own items use, and every line
 * the file already holds — a comment, a blank line, the spacing someone
 * wrote, and the line ending it ends with — stays exactly as it was.
 *
 * Three readings of `repos` the reader accepts are answered for here. A line
 * that is a comment only belongs to the block it stands among, whichever
 * indentation it is written at, since the reader drops it: it never ends the
 * sequence, so an item never lands in the middle of another one. A field
 * whose value is written (`repos: null`, `repos: ~`) holds no list, and its
 * value is taken off the line — the key's own spelling and the comment after
 * it kept — before the items are written under it. A manifest naming no
 * `repos` at all gains the block at its end.
 */
function manifestWithRepo(text, repo) {
  // The lines are split on "\n" the way `manifestNamed` does, so a carriage
  // return a line ends with is the line's own last character: every line this
  // function inserts ends with the carriage return the file's lines do.
  const cr = text.includes('\r\n') ? '\r' : '';
  const lines = text.split('\n');
  const bare = (line) => (line.endsWith('\r') ? line.slice(0, -1) : line);

  let at = -1;
  for (let i = 0; i < lines.length && at === -1; i++) {
    const body = bare(lines[i]);
    if (body.match(/^[ \t]*/)[0] !== '') continue;
    const pair = splitPair(body);
    if (pair !== null && decodedKeyWord(pair.key) === 'repos') at = i;
  }
  if (at === -1) {
    const block = ['repos:', ...repoItemLines(repo, 2)].map((line) => `${line}${cr}`);
    // The blank element a manifest ending in a newline leaves behind is where
    // the block goes: the file keeps the ending it had.
    const end = lines.length && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    lines.splice(end, 0, ...block);
    return lines.join('\n');
  }

  // The block runs to the last line indented under the field; a blank line
  // and a comment-only line belong to it — the reader drops both — and a
  // field written back at the left margin ends it.
  let indent = null;
  let last = at;
  for (let i = at + 1; i < lines.length; i++) {
    const body = bare(lines[i]);
    const lead = body.match(/^[ \t]*/)[0].length;
    const content = body.slice(lead);
    if (body.trim() === '' || content.startsWith('#')) continue;
    if (lead === 0) break;
    last = i;
    if (indent === null && /^-(\s|$)/.test(content)) indent = lead;
  }

  // A value written on the field's own line is no list: it is taken off the
  // line, the key's spelling, the spacing after it and the comment kept, and
  // the items are written under it.
  const pair = splitPair(bare(lines[at]));
  const after = bare(lines[at]).slice(pair.key.length + 1);
  const gap = after.match(/^[ \t]*/)[0];
  const rest = after.slice(gap.length);
  const written = cutComment(rest).trim();
  if (written !== '') {
    // The comment stays, one space after the colon: the value that stood
    // between them is the field this command is writing.
    const comment = rest.slice(cutComment(rest).replace(/\s+$/, '').length).trim();
    const ending = lines[at].endsWith('\r') ? '\r' : '';
    lines[at] = `${pair.key}:${comment === '' ? '' : ` ${comment}`}${ending}`;
  }

  const item = repoItemLines(repo, indent === null ? 2 : indent).map((line) => `${line}${cr}`);
  lines.splice(last + 1, 0, ...item);
  return lines.join('\n');
}

/**
 * Enters one code repository in the manifest and commits it, as one commit of
 * the product's history: `name`, `url` and the optional `branch` are appended
 * to `repos` and every other byte of the manifest is kept. It never clones;
 * `bootstrap` does. Every refusal — a name that is not a folder name, a name
 * the manifest already declares, a manifest that cannot be read, a folder
 * that is no git repository of its own, and a folder holding uncommitted
 * changes — happens before anything is written, and a step that fails
 * afterwards puts the manifest back byte for byte.
 */
export function addCodeRepository({ folder: given, name, url, branch, gitEnv } = {}) {
  const read = readProduct(given === undefined ? '.' : given);
  if (!read.ok) return { outcome: 'refused', message: read.message, file: read.file, line: read.line };
  const folder = read.product.folder;
  const manifestFile = join(folder, MANIFEST_FILE);

  const why = whyNotARepositoryName(name);
  if (why !== null)
    return { outcome: 'refused', message: `the name "${name}" cannot be a code repository's: ${why}` };

  const wanted = typeof url === 'string' ? url.trim() : '';
  if (wanted === '')
    return { outcome: 'refused', message: 'no url was given: a code repository is entered with the url it is cloned from' };
  if (wanted.startsWith('-'))
    return { outcome: 'refused', message: `the url "${wanted}" begins with "-", which a command line reads as an option: write the url itself` };
  const wantedBranch = typeof branch === 'string' ? branch.trim() : undefined;
  if (wantedBranch === '')
    return { outcome: 'refused', message: 'the branch was given empty: a clone is taken from the branch it names, and the option is left out where the repository\'s own is taken' };

  const declared = read.product.repos.findIndex((repo) => repo.name === name);
  if (declared !== -1) {
    // The line the name stands on, read from the manifest the way the reader
    // reads it: a refusal about a manifest names the place in the manifest.
    const parsed = parseManifest(readFileSync(manifestFile, 'utf8'), manifestFile);
    const items = parsed.ok && Array.isArray(parsed.value.repos) ? parsed.value.repos : [];
    return {
      outcome: 'refused',
      message: `the manifest ${manifestFile} already declares the code repository "${name}": each repository is declared once, and clones into its own folder`,
      file: manifestFile,
      line: items[declared] === undefined ? lineOf(parsed.ok ? parsed.value : {}, 'repos') : lineOf(items[declared], 'name'),
    };
  }

  // The entry belongs to the product's own repository: committed from a
  // folder that has none of its own, it would land in the repository around
  // it, which is someone else's history.
  if (!ownRepository(folder, gitEnv))
    return { outcome: 'refused', message: `the folder ${folder} is not a git repository of its own: entering a code repository is one commit of the product's history, and a commit made here would land in the repository around it` };

  const status = runGit(folder, ['status', '--porcelain'], gitEnv);
  if (!status.ok) return { outcome: 'failed', message: `git status failed in ${folder}: ${status.output}` };
  if (status.output !== '')
    return { outcome: 'refused', message: `the folder ${folder} holds changes that are not committed: commit them first, since entering a code repository is a commit of its own and would take them with it` };

  const manifest = readFileSync(manifestFile, 'utf8');
  try {
    writeFileSync(manifestFile, manifestWithRepo(manifest, { name, url: wanted, branch: wantedBranch }));
    const add = runGit(folder, ['add', '--', MANIFEST_FILE], gitEnv);
    if (!add.ok) throw new Error(`git add failed in ${folder}: ${add.output}`);
    const commit = runGit(folder, ['commit', '--quiet', '-m', `Enter the code repository ${name}`], gitEnv);
    if (!commit.ok) throw new Error(`git commit failed in ${folder}: ${commit.output}`);
  } catch (error) {
    // The manifest goes back byte for byte, and out of the index: a step that
    // failed leaves the product exactly as this command found it.
    let left;
    try {
      writeFileSync(manifestFile, manifest);
      runGit(folder, ['reset', '--quiet', '--', MANIFEST_FILE], gitEnv);
    } catch (restore) {
      left = `the failed entry left the manifest written: ${restore.message}`;
    }
    return { outcome: 'failed', message: left === undefined ? error.message : `${error.message}; ${left}` };
  }
  return { outcome: 'entered', folder, name, url: wanted, branch: wantedBranch };
}

/**
 * What a folder is, walking up from it: a product repository, a code
 * repository of one, or neither.
 *
 * A product repository is a git repository of its own holding the manifest,
 * and a code repository is a git repository of its own whose parent is a
 * product's `repos/`: each answers for itself, never the repository around
 * it. The walk therefore ends where a git repository of its own begins, and a
 * folder that is another repository's working tree is neither — a manifest
 * lying inside one is not a product this program can answer for, and neither
 * is a checkout standing outside a product's `repos/`. A manifest the walk
 * meets that cannot be read is refused with its file and line, since the
 * folder it stands over is not one this program can answer for either.
 */
export function whereAmI({ folder: given, gitEnv } = {}) {
  const start = resolve(given === undefined ? '.' : given);
  let isFolder = false;
  try {
    isFolder = statSync(start).isDirectory();
  } catch {
    // Not there at all: said below, in the same words.
  }
  if (!isFolder)
    return { outcome: 'refused', message: `the folder ${start} is not a folder: where starts from a folder and walks up` };

  for (let folder = start; ; folder = dirname(folder)) {
    const owns = ownRepository(folder, gitEnv);
    if (existsSync(join(folder, MANIFEST_FILE))) {
      const read = readProduct(folder);
      if (!read.ok) return { outcome: 'refused', message: read.message, file: read.file, line: read.line };
      // A product repository is a repository of its own: a manifest standing
      // inside another repository's tree is not one, and the walk ends here.
      if (!owns) return { outcome: 'none' };
      return { outcome: 'product', product: read.product.folder };
    }
    if (owns) {
      if (basename(dirname(folder)) === 'repos') {
        const product = dirname(dirname(folder));
        if (existsSync(join(product, MANIFEST_FILE)) && ownRepository(product, gitEnv)) {
          const read = readProduct(product);
          if (!read.ok) return { outcome: 'refused', message: read.message, file: read.file, line: read.line };
          return { outcome: 'code', product: read.product.folder, repo: basename(folder) };
        }
      }
      // A repository of its own that is no product's and no product's code
      // repository: what stands above it belongs to another tree.
      return { outcome: 'none' };
    }
    if (dirname(folder) === folder) return { outcome: 'none' };
  }
}

// ---- the self-test ----------------------------------------------------------

/**
 * The manifest cases: `fixtures/workspace/cases.json` holds valid and invalid
 * manifests, each with its text and what reading it must give — the identity,
 * or the line and a phrase of the refusal. A case's `folder` names the folder
 * the text is written in, since a manifest naming no `name` is read under its
 * folder's name; `text` of null writes no manifest at all, which is a folder
 * holding none.
 */
export function selftest() {
  const casesFile = join(HERE, 'fixtures', 'workspace', 'cases.json');
  let fixtures;
  try {
    fixtures = JSON.parse(readFileSync(casesFile, 'utf8'));
  } catch (error) {
    console.log(`FAIL  workspace/cases.json cannot be read: ${error.message}`);
    return 1;
  }
  let failures = 0;
  const show = (ok, label) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (!ok) failures++;
  };
  const root = mkdtempSync(join(tmpdir(), 'workspace-cases-'));
  try {
    for (const one of fixtures.cases) {
      const folderName = one.folder ?? fixtures.folder ?? 'idea-2026-10-09';
      const folder = join(root, folderName);
      mkdirSync(folder, { recursive: true });
      if (one.text !== null && one.text !== undefined) writeFileSync(join(folder, MANIFEST_FILE), one.text);
      const read = readProduct(folder);
      if (one.ok !== undefined && one.ok !== null) {
        let same = read.ok === true
          && read.product.id === one.ok.id
          && read.product.name === one.ok.name
          && read.product.schemaVersion === one.ok.schemaVersion;
        if (same && one.ok.repos !== undefined) same = JSON.stringify(read.product.repos) === JSON.stringify(one.ok.repos);
        if (same && one.ok.skills !== undefined) same = JSON.stringify(read.product.skills) === JSON.stringify(one.ok.skills);
        show(same, `workspace/${one.name}${same ? '' : `: got ${read.ok ? JSON.stringify({ id: read.product.id, name: read.product.name, schemaVersion: read.product.schemaVersion }) : `refused at line ${read.line}: ${read.message}`}`}`);
      } else {
        const same = read.ok === false && read.line === one.line && read.message.includes(one.message);
        show(same, `workspace/${one.name}${same ? '' : `: got ${read.ok ? `read as ${JSON.stringify(read.product)}` : `line ${read.line}: ${read.message}`}`}`);
      }
      rmSync(folder, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  return failures ? 1 : 0;
}

// ---- the command line -------------------------------------------------------

/** The plugin version: the set's manifest where one stands above, else the constant. */
function pluginVersion() {
  let up = HERE;
  for (let step = 0; step < 4; step++, up = dirname(up)) {
    try {
      const manifest = JSON.parse(readFileSync(join(up, '.claude-plugin', 'plugin.json'), 'utf8'));
      if (typeof manifest.version === 'string' && manifest.version !== '') return manifest.version;
    } catch {
      // Not here: the next folder up, or the constant.
    }
  }
  return PLUGIN_VERSION;
}

/** What each command takes: its options, and how many words follow it. */
const COMMANDS = {
  new: { options: { '--home': 'a folder', '--date': 'a day, YYYY-MM-DD', '--json': false }, words: [0, 0], words_are: 'no word of its own' },
  read: { options: { '--json': false }, words: [0, 1], words_are: 'at most one folder' },
  rename: { options: { '--json': false }, words: [2, 2], words_are: 'a folder and a name' },
  remote: { options: { '--json': false }, words: [2, 2], words_are: 'a folder and a url' },
  bootstrap: { options: { '--json': false }, words: [1, 1], words_are: 'a folder' },
  repo: { options: { '--branch': 'a branch', '--json': false }, words: [4, 4], words_are: '"add" and then a folder, a name and a url' },
  where: { options: { '--json': false }, words: [0, 1], words_are: 'at most one folder' },
};

/** The options of one command, as a line a refusal can quote. */
const describeOptions = (options) => Object.entries(options)
  .map(([name, value]) => (value === false ? name : `${name} <${value}>`)).join(', ');

/** One command's words: its positionals and its options, with every misuse named. */
function parseCommand(command, args) {
  const spec = COMMANDS[command];
  const values = {};
  const words = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') { words.push(...args.slice(i + 1)); break; }
    if (!arg.startsWith('--')) { words.push(arg); continue; }
    const equals = arg.indexOf('=');
    const name = equals === -1 ? arg : arg.slice(0, equals);
    if (!(name in spec.options))
      throw new Misuse(`unknown option "${arg}": ${command} takes ${describeOptions(spec.options)}`);
    if (name in values)
      throw new Misuse(`the option "${name}" is given twice: ${command} takes ${describeOptions(spec.options)}`);
    if (spec.options[name] === false) {
      if (equals !== -1) throw new Misuse(`the option "${name}" takes no value`);
      values[name] = true;
      continue;
    }
    const inline = equals === -1 ? undefined : arg.slice(equals + 1);
    let value = inline;
    if (inline === undefined) value = args[++i];
    const trimmed = typeof value === 'string' ? value.trim() : undefined;
    if (trimmed === undefined || trimmed === '' || trimmed.startsWith('--'))
      throw new Misuse(`the option "${name}" needs ${spec.options[name]}${value === undefined || trimmed === '' ? '' : `, not "${trimmed}"`}`);
    values[name] = value;
  }
  const [least, most] = spec.words;
  if (words.length < least || words.length > most)
    throw new Misuse(`${command} takes ${spec.words_are}, and ${words.length} ${words.length === 1 ? 'word was' : 'words were'} given`);
  // A day the calendar does not have is an argument this command cannot use,
  // and it is refused as one: before anything is made, with the usage.
  if (values['--date'] !== undefined) {
    const why = whyNotADay(values['--date']);
    if (why !== null) throw new Misuse(`the option "--date" needs a day, YYYY-MM-DD, and "${values['--date']}" ${why}`);
  }
  return { values, words };
}

/** What one command did: what it printed, and the exit code its outcome carries. */
function runCommand(command, { values, words }) {
  if (command === 'new') {
    const draft = createDraft({ home: values['--home'], date: values['--date'] });
    if (draft.outcome === 'created')
      return { code: 0, lines: [`folder: ${draft.folder}`, `id: ${draft.id}`], body: { folder: draft.folder, id: draft.id, name: draft.name } };
    return { code: draft.outcome === 'refused' ? 2 : 1, error: { kind: draft.outcome, message: draft.message } };
  }
  if (command === 'read') {
    const read = readProduct(words[0] === undefined ? '.' : words[0]);
    if (read.ok) {
      const { folder, id, name, schemaVersion } = read.product;
      return { code: 0, lines: [`folder: ${folder}`, `id: ${id}`, `name: ${name}`, `schemaVersion: ${schemaVersion}`], body: { folder, id, name, schemaVersion } };
    }
    return { code: 2, error: { kind: 'refused', message: read.message, file: read.file, line: read.line } };
  }
  // A refusal that a manifest raised says where it was found, whoever asked.
  const fault = (done) => ({
    kind: done.outcome,
    message: done.message,
    ...(done.file === undefined ? {} : { file: done.file, line: done.line }),
  });

  if (command === 'rename') {
    const done = renameProduct({ folder: words[0], name: words[1] });
    if (done.outcome === 'renamed')
      return { code: 0, lines: [`folder: ${done.folder}`, `id: ${done.id}`, `name: ${done.name}`], body: { folder: done.folder, id: done.id, name: done.name } };
    return { code: done.outcome === 'refused' ? 2 : 1, error: fault(done) };
  }
  if (command === 'remote') {
    const done = addRemote({ folder: words[0], url: words[1] });
    if (done.outcome === 'added')
      return { code: 0, lines: [`folder: ${done.folder}`, `remote: ${done.remote}`, `url: ${done.url}`], body: { folder: done.folder, remote: done.remote, url: done.url } };
    return { code: done.outcome === 'refused' ? 2 : 1, error: fault(done) };
  }
  if (command === 'where') {
    const done = whereAmI({ folder: words[0] === undefined ? '.' : words[0] });
    if (done.outcome === 'refused') return { code: 2, error: fault(done) };
    // All three answers are an answer: what a folder is is not a failure.
    if (done.outcome === 'product')
      return { code: 0, lines: ['where: product', `product: ${done.product}`], body: { where: 'product', product: done.product } };
    if (done.outcome === 'code')
      return { code: 0, lines: ['where: code', `product: ${done.product}`, `repo: ${done.repo}`], body: { where: 'code', product: done.product, repo: done.repo } };
    return { code: 0, lines: ['where: none'], body: { where: 'none' } };
  }
  if (command === 'repo') {
    if (words[0] !== 'add')
      return { code: 2, error: { kind: 'misuse', message: `unknown "repo ${words[0]}": repo takes one subcommand, "add"` } };
    const done = addCodeRepository({ folder: words[1], name: words[2], url: words[3], branch: values['--branch'] });
    if (done.outcome === 'entered')
      return {
        code: 0,
        lines: [`folder: ${done.folder}`, `name: ${done.name}`, `url: ${done.url}`,
          ...(done.branch === undefined ? [] : [`branch: ${done.branch}`])],
        body: { folder: done.folder, name: done.name, url: done.url, ...(done.branch === undefined ? {} : { branch: done.branch }) },
      };
    return { code: done.outcome === 'refused' ? 2 : 1, error: fault(done) };
  }
  const done = bootstrapProduct({ folder: words[0] });
  if (done.outcome === 'refused') return { code: 2, error: fault(done) };
  const lines = [`bootstrapped: ${done.folder}`];
  for (const repo of done.repos)
    lines.push(`repo: ${repo.name} ${repo.state}${repo.dirty ? ' dirty' : ''}${repo.message === undefined ? '' : `: ${repo.message}`}`);
  // A checkout this run could not read is a step that did not finish: a
  // report that hides it would say a repository is fine when nobody looked.
  const unfinished = done.repos.filter((repo) => repo.state === 'failed' || repo.dirty === null).length;
  return { code: unfinished ? 1 : 0, lines, body: { folder: done.folder, repos: done.repos } };
}

/** One run of the command line: 0, 1 or 2, with its own stream's output printed. */
export function main(argv) {
  const args = [...argv];
  const asJson = args.includes('--json');
  const print = (code, { lines = [], error = null, body = null } = {}) => {
    if (asJson) {
      // The documented shape, and nothing else: `message`, and `file` and
      // `line` where the refusal knows them.
      const described = error === null ? (body ?? {}) : {
        error: {
          message: error.message,
          ...(error.file === undefined ? {} : { file: error.file }),
          ...(error.line === undefined ? {} : { line: error.line }),
        },
      };
      console.log(JSON.stringify(described));
      return code;
    }
    if (error !== null) {
      if (error.kind === 'misuse') {
        console.error(`product: ${error.message}`);
        console.error(`product: ${USAGE}`);
        return code;
      }
      // A refusal names where it was found, the way every check in this set
      // does; a fault with no file of its own stands as it is worded.
      console.error(error.file === undefined ? error.message : `${error.file}:${error.line}: ${error.message}`);
      return code;
    }
    for (const line of lines) console.log(line);
    return code;
  };

  if (args.length === 0)
    return print(2, { error: { kind: 'misuse', message: 'no command was given: the commands are new, read, rename, remote, bootstrap, repo and where' } });
  const [command, ...rest] = args;
  if (command === '--help' || command === '--version' || command === '--selftest') {
    if (rest.length)
      return print(2, { error: { kind: 'misuse', message: `"${command}" stands alone: it takes no other word` } });
    if (command === '--help') { console.log(HELP); return 0; }
    if (command === '--version') { console.log(pluginVersion()); return 0; }
    return selftest();
  }
  if (command.startsWith('--'))
    return print(2, { error: { kind: 'misuse', message: `unknown option "${command}" before the command: the commands are new, read, rename, remote, bootstrap, repo and where` } });
  if (!(command in COMMANDS))
    return print(2, { error: { kind: 'misuse', message: `unknown command "${command}": the commands are new, read, rename, remote, bootstrap, repo and where` } });

  let parsed;
  try {
    parsed = parseCommand(command, rest);
  } catch (error) {
    return print(2, { error: { kind: 'misuse', message: error.message } });
  }
  const result = runCommand(command, parsed);
  return print(result.code, result);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`product: ${error.message}`);
    process.exitCode = 2;
  }
}
