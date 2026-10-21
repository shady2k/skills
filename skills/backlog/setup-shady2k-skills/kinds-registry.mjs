#!/usr/bin/env node
/**
 * The kinds registry — the set's map of the document kinds it owns, written
 * into a product repository at the product's `docs/kinds.yaml`, the place
 * the engine's published contract reads it from at its first line: the
 * registry is written at contract version 1 (`contract: 1`), and the set
 * keeps a copy of the published schema at the version it targets, validated
 * by the set's own code — no repository depends on another, so nothing here
 * checks out or runs another repository.
 *
 * Decision 0021 makes the kinds data a product holds: the wiki groups its
 * pages by kind and stage, draws its links and backlinks from the kinds'
 * own declarations and reads the "what to do next" hints from this file
 * alone, so one change of the set's vocabulary is a data change here, never
 * a change in the engine's code. Per kind the registry carries the
 * contract's own fields — `name` (the kind's word for a reader), `prefix`
 * (its documents' id prefix, one to four capitals, unique among the kinds),
 * `folder` (where the kind's documents are written, a place under docs/),
 * `stage` (the stage of the set's life cycle it belongs to) and `hint` (the
 * next step for a person mid-stage, in the set's own wording) — and may
 * declare its `statuses` (the words its documents may carry; the set's
 * practice record carries the two its check reads) and its `links`: each
 * link is the kind's field name, the kinds its targets name (by their
 * word for a reader, the way the engine's own examples write targets —
 * the reader also reads a target that names a kind by its id prefix, so
 * an older registry still reads), the backlink's word for the reader on
 * the target's page, and whether the link is required. The stages are the set's life cycle, in its own order, as
 * `id:` entries, with no fixed kinds: verify, release and operate keep
 * their records where the set records them, so they hold none of these
 * pages.
 *
 * The contract's reserved places are read as data, never refused and never
 * dropped, the way the engine reads them: a kind may carry `storage` (the
 * word `document`, the form the set's kinds are kept in, or a reserved
 * form the engine names) and, riding the `fact` form, its `evidence` field
 * names (source, ref, record); the manifest may carry the reserved
 * `goals:` section (maturity levels, the 0021 amendment). This engine
 * version serves documents only: the reader returns each reserved place it
 * read as a note that names it, and refuses an evidence shape that stands
 * without `storage: fact`, by the engine's own words.
 *
 * A product may rename the kinds or retune their hints in its own
 * language; the id prefix and the stage are the set's forms' words, and the
 * folder is the set's default: a chain document keeps its kind by its id
 * wherever under docs/ it stands, so a described repository's derived
 * documents are laid out beside the repository they describe. A link to a
 * kind no declaration names is a finding where the wiki reads it, not a
 * dropped word, and this reader says so for its own reads: a target that
 * names no prefix the registry's kinds carry is refused. Fields nobody
 * knows are refused, the way the contract's schema refuses them, and a
 * link declares a field of the kind's own: one named after a generic
 * field every document carries (id, kind, status, links) is refused at
 * the field's line, because the reader reads those fields itself. This
 * reader is a line reader: it refuses on the lines it sees (the shapes,
 * the places, the words, and the YAML features it cannot read — anchors,
 * aliases, merge keys, custom tags); what a YAML parser would see beyond
 * that is the schema copy's word, and the conformance run carries it.
 * Setup never resets a registry that stands — it verifies it and reports,
 * and writes one only where the product holds none.
 *
 * Templates: the tool answers `--template <PREFIX>` with the template's
 * words for a kind's documents, and where it came from (stderr). The order
 * is the product's own template at `templates/product/<template file>` in
 * the product's root, then the copy the project installed at
 * `<product root>/.shady2k/templates/product/<template file>`, then the
 * set's own default beside its check. An override is refused that does not
 * name the kind's prefix on its identity line: what moves with a kind is
 * its prefix, so the template's words say whose documents it shapes.
 *
 * The published example is the kind table rendered into the set's own
 * example product: `fixtures/product/good/docs/kinds.yaml`.
 *
 *   node kinds-registry.mjs [--root <product folder>] [--check] [--json]
 *   node kinds-registry.mjs --template <PREFIX> [--root <product folder>] [--json]
 *   node kinds-registry.mjs --selftest
 *
 * EXIT CODES. 0: the registry stands — written now, or verified as it was
 * — or the template resolves and prints. 1: a registry there cannot be
 * read, is out of shape, or has lost a kind or prefix the set owns — each
 * finding names the file and the line; or a product's own template is
 * refused, with the file and the line it is wrong on. 2: misuse, or a
 * product folder that cannot be used.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ValueNeeded, valueOf } from "./argv.mjs";

export const REGISTRY_FILE = "docs/kinds.yaml";

const HERE = dirname(fileURLToPath(import.meta.url));

/** An identity line the templates carry: `# <PREFIX>-<NNN> — <one line>`,
 *  with a real or placeholder number. */
const IDENTITY = /^# ([A-Z]{1,4})-(?:<NNN>|\d{3,})(?:\s|$)/;

/** The set's life cycle, in its own order: the stages hold no fixed kinds — every kind names its own. */
export const STAGES = ["idea", "requirements", "design", "build", "verify", "release", "operate"];

/** The kinds the set owns, in the order a reader meets them: the side rail from the vision to the practices. */
export const KINDS = [
  { name: "Vision", prefix: "VIS", folder: "docs/vision.md", stage: "idea", hint: "the product's direction; when it stands, the beliefs behind it are written as hypotheses and what people said is kept as sources" },
  { name: "Roadmap", prefix: "ROA", folder: "docs/roadmap.md", stage: "idea", hint: "what is near and what is far, and why in that order; the current milestone's charter narrows it" },
  { name: "Milestone", prefix: "MIL", folder: "docs/milestones", stage: "idea", hint: "the charter of one version — outcomes, observable criteria, exclusions and a budget — agreed with the owner before its work runs" },
  { name: "Source", prefix: "S", folder: "docs/sources", stage: "idea", hint: "what people actually said, kept with consent; the product's documents quote it by place" },
  { name: "Hypothesis", prefix: "H", folder: "docs/hypotheses", stage: "idea", hint: "a belief worth testing — its test, its metric, its threshold; the result is read onto the record when the test comes due",
    links: [{ field: "Grew from", targets: ["Vision", "Source", "Open question"], backlink: "Grew into", cardinality: "many", required: true }] },
  { name: "Open question", prefix: "Q", folder: "docs/questions", stage: "idea", hint: "what is not known, with who can answer and what settles it; an answer, or a not-applicable with a reason, closes it",
    links: [{ field: "Concerns", targets: ["Vision", "Practice", "Source", "Hypothesis", "User story", "Use case", "Product requirement", "Open question", "Prototype", "Result"], backlink: "Concerned by", cardinality: "many", required: true }] },
  { name: "Prototype", prefix: "P", folder: "docs/prototypes", stage: "idea", hint: "code that tests one hypothesis and is thrown away once its results are kept",
    links: [{ field: "Tests", targets: ["Hypothesis"], backlink: "Tested by", cardinality: "many", required: true }] },
  { name: "Result", prefix: "R", folder: "docs/results", stage: "idea", hint: "what was observed against the threshold — confirmed, refuted or unclear, and why",
    links: [{ field: "Of", targets: ["Prototype"], backlink: "Observed in", cardinality: "many", required: true }] },
  { name: "User story", prefix: "US", folder: "docs/stories", stage: "requirements", hint: "one slice of value for one role; it accepts through the use cases and requirements that grew from it",
    links: [{ field: "Grew from", targets: ["Vision", "Hypothesis"], backlink: "Grew into", cardinality: "many", required: true }] },
  { name: "Use case", prefix: "UC", folder: "docs/use-cases", stage: "requirements", hint: "one goal with its main success scenario; the product requirements it serves are written from it",
    links: [{ field: "Serves", targets: ["User story"], backlink: "Served by", cardinality: "many", required: true }] },
  { name: "Product requirement", prefix: "FR", folder: "docs/requirements", stage: "requirements", hint: "one thing a user can observe; the capability specs reference it by id, never restate it",
    links: [{ field: "Serves", targets: ["Use case", "User story"], backlink: "Served by", cardinality: "many", required: true }] },
  { name: "Decision", prefix: "DEC", folder: "docs/decisions", stage: "design", hint: "a consequential, hard-to-reverse choice with its reason kept where a reader needs it" },
  { name: "Design record", prefix: "DES", folder: "docs/changes", stage: "design", hint: "one change's design — drivers, options traded, the recorded decision — written before code" },
  { name: "Architecture", prefix: "ARC", folder: "docs/system/architecture.md", stage: "design", hint: "how the system does it — the parts, their zones and the boundaries, kept with the code's shape" },
  { name: "Capability", prefix: "CAP", folder: "docs/system/capabilities", stage: "design", hint: "the unit the accepted behaviour is kept by — its EARS requirements and Given/When/Then scenarios" },
  { name: "Change record", prefix: "CHG", folder: "docs/changes", stage: "build", hint: "one feature's proposal against the current specs; acceptance merges it into the capabilities it touches" },
  { name: "Exploration", prefix: "EXP", folder: "docs/explorations", stage: "idea", hint: "questions and observations kept where retention is asked for; it commits to nothing" },
  { name: "Practice", prefix: "PRA", folder: "docs/practices", stage: "operate", hint: "a class of error answered once as a rule; learned as the work went on, retired with its reason",
    statuses: ["active", "retired"] },
]
/** The fields each kind carries, as the contract names them. */
const FIELDS = ["name", "prefix", "folder", "stage", "hint"];
/** The generic fields every document carries: the reader reads those itself,
 *  so a kind's link declares a field of its own and never one of these
 *  names, however it is spelled. */
const GENERIC_DOCUMENT_FIELDS = ["id", "kind", "status", "links"];
const FIELD_WORDS = {
  name: "the word the wiki shows for the kind",
  prefix: "the kind's id prefix, one to four capitals, unique among the kinds",
  folder: "the place under docs/ the kind's documents live in",
  stage: "the stage of the registry's life cycle the kind belongs to",
  hint: "what a person mid-stage does next with the kind",
};

/** The registry rendered: the only bytes the writer writes, at contract version 1. */
export function renderRegistry() {
  const lines = [
    "contract: 1",
    "# The kinds this product keeps. Written at setup from the set's kind",
    "# table (the product-documents reference); the wiki reads this file alone",
    "# for its groups, its kind words and its next-step hints, so one change",
    "# of the set's vocabulary belongs here as data, never as engine code. The",
    "# contract: 1 on the first line is the contract version these words are",
    "# written against: the engine accepts the versions it knows, names a",
    "# version it does not support, and degrades to plain pages rather than",
    "# fail silently. A product may rename the kinds or retune the hints in",
    "# its own language; the id prefixes and the stages are the set's forms'",
    "# words, and a folder is the set's default: a chain document keeps its",
    "# kind by its id",
    "# wherever under docs/ it stands, so a described repository's derived",
    "# documents stand beside the repository they describe. The stages are",
    "# the set's life cycle; verify, release and operate keep their records",
    "# outside the kinds.",
    "",
    "stages:",
    ...STAGES.map((stage) => `  - id: ${stage}`),
    "kinds:",
  ];
  for (const kind of KINDS) {
    lines.push("  - name: " + kind.name);
    lines.push("    prefix: " + kind.prefix);
    lines.push("    folder: " + kind.folder);
    lines.push("    stage: " + kind.stage);
    lines.push("    hint: " + kind.hint);
    if (kind.statuses) {
      lines.push("    statuses:");
      for (const status of kind.statuses) lines.push(`      - ${status}`);
    }
    if (kind.links) {
      lines.push("    links:");
      for (const link of kind.links) {
        lines.push(`      - field: ${link.field}`);
        lines.push("        targets:");
        for (const target of link.targets) lines.push(`          - ${target}`);
        if (link.backlink) lines.push(`        backlink: ${link.backlink}`);
        if (link.cardinality) lines.push(`        cardinality: ${link.cardinality}`);
        if (link.required !== undefined) lines.push(`        required: ${link.required}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

/** The registry the writer writes, as the contract's schema reads it: the
 *  plain JSON the set's own validator checks against the set's copy of the
 *  published schema, at the version the writer carries (contract: 1). */
export function registryJson() {
  return {
    contract: 1,
    stages: STAGES.map((id) => ({ id })),
    kinds: KINDS.map((kind) => ({
      name: kind.name,
      prefix: kind.prefix,
      folder: kind.folder,
      stage: kind.stage,
      hint: kind.hint,
      ...(kind.statuses ? { statuses: [...kind.statuses] } : {}),
      ...(kind.links
        ? {
            links: kind.links.map((link) => ({
              field: link.field,
              targets: [...link.targets],
              ...(link.backlink !== undefined ? { backlink: link.backlink } : {}),
              ...(link.cardinality !== undefined ? { cardinality: link.cardinality } : {}),
              ...(link.required !== undefined ? { required: link.required } : {}),
            })),
          }
        : {}),
    })),
  };
}

/** A scalar read from one line: its quoted or bare self, and the line it stood on. */
function scalar(raw, line) {
  const quoted = /^"([^"]*)"$/.exec(raw) ?? /^'([^']*)'$/.exec(raw);
  return { value: quoted ? quoted[1] : raw, line };
}

/** The line the registry's `kinds:` list begins on, for a finding that names the product's kinds when no kind stands to name. */
function firstKindLine(value) {
  for (const kind of value.kinds) for (const key of FIELDS) if (kind[key]) return kind[key].line;
  return 1;
}

const fail = (file, line, message) => ({ ok: false, line, message: `${file}:${line}: ${message}` });

/**
 * A registry text, read as the contract's shape the set renders. Value
 * carries `stages` (a list of {id, name?} entries) and `kinds` (a list of
 * maps with the five fields), or the first refusal ({ ok: false, line,
 * message }), already `file:`-prefixed. Nothing else is read or carried:
 * the contract's schema refuses an unknown property at any level, and so
 * does this reader. The contract's check is the word when it stands: this
 * reader refuses what it can line by line (anchors, aliases, merge keys,
 * custom tags, the name and prefix shapes), and the conformance run
 * carries the refusals the set's reader cannot see.
 */
export function parseKinds(text, file) {
  const lines = text.split("\n");
  // What the contract's strict YAML reader refuses, refused here at the
  // line it stands on: an anchor, an alias, a merge key or a custom tag
  // carries meaning the line reader does not hold, so it may not pass as
  // words.
  // A syntax position starts a line's node or follows its `- ` or its
  // first `key:`: an anchor, alias, tag or merge key on such a place is
  // YAML's own grammar, not the reader's words. An `&` or `!` inside a
  // hint's words is text, and text is read as words.
  const strictProblemOf = (raw) => {
    const stripped = raw.replace(/(^|\s)#.*$/, "");
    if (!stripped.trim()) return undefined;
    if (/^\s*(?:-\s+)?<<:/.test(stripped)) return `a merge key (<<:) stands where a field name goes`;
    const nodeStarts = [];
    const lead = /^(\s*)(-\s+)?/.exec(stripped);
    if (lead[2]) nodeStarts.push(lead[1].length + lead[2].length);
    else nodeStarts.push(lead[1].length);
    const sliceFrom = Math.max(...nodeStarts);
    const firstPair = /:(\s+)\S/.exec(stripped.slice(sliceFrom));
    if (firstPair) nodeStarts.push(sliceFrom + firstPair.index + 1 + firstPair[1].length);
    for (const at of nodeStarts) {
      const there = stripped.slice(at);
      const seen = /^[&*][^\s]|^!/.exec(there);
      if (seen) return `${JSON.stringify(seen[0])} stands where a node of the registry begins — an anchor (&), an alias (*), or a custom tag (!) is refused: the registry is plain words`;
    }
    return undefined;
  };
  for (let x = 0; x < lines.length; x++) {
    if (lines[x].trim() === "" || lines[x].trim().startsWith("#")) continue;
    const problem = strictProblemOf(lines[x]);
    if (problem)
      return { ok: false, line: x + 1, message: `${file}:${x + 1}: ${problem} — this line reads ${JSON.stringify(lines[x].trim())}` };
  }
  const code = (l) => l.replace(/(^|\s)#.*$/, "").trimEnd();
  const trim = (l) => code(l).trim();
  const skip = (i) => {
    while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
    return i;
  };
  let i = skip(0);
  // `contract: 1` before the stages: the version the registry's words are
  // written against. A registry without it is refused at line 1, as the
  // contract's check refuses it, so the set never calls verified a file the
  // wiki will not read; a named version
  // other than 1 is refused with the version's name — the wiki names the
  // versions it supports and degrades to plain pages, and never fails
  // silently, so a reader of the set's own words says what it reads.
  let contract;


  const wordScalar = (word, what, line) => {
    const read = scalar(word, line);
    if (!/^[A-Za-z][A-Za-z0-9 _-]*$/.test(read.value))
      return fail(file, line, `the ${what} reads "${read.value}": a reader's word of letters, digits, spaces, dashes and underscores, starting with a letter`);
    return read;
  };
  /** A link's field name: a reader's word that is not one of the generic
   *  fields every document carries, which the reader reads itself. */
  const linkField = (word, line) => {
    const read = wordScalar(word, "link's field", line);
    if (read.ok === false) return read;
    if (GENERIC_DOCUMENT_FIELDS.includes(read.value.toLowerCase()))
      return fail(file, line, `a link's field reads "${read.value}": the generic fields every document carries are ${GENERIC_DOCUMENT_FIELDS.join(", ")} — a link declares a field of the kind's own, never one of these`);
    return read;
  };
  const parseGoalsFrom = (/** @type {number} */ at) => {
    // The reserved `goals:` section, where it stands (the 0021 amendment):
    // maturity levels over the graph, per perspective. The engine keeps
    // the section as data and names it reserved-but-unimplemented when it
    // renders, never refusing and never dropping it; this reader reads it
    // the same way and carries it, so the shape rules below verify it.
    const goalsLine0 = at + 1;
    let j = skip(at + 1);
    const levels = [];
    if (j >= lines.length || !/^\s*-\s/.test(lines[j]))
      return fail(file, goalsLine0, "the reserved `goals:` section holds no level — the schema reads one level or more, each as `- name: <name>` with its rules under it");
    while (j < lines.length && /^\s*-\s/.test(lines[j])) {
      const lead = lines[j].length - lines[j].trimStart().length;
      const entryLine = j + 1;
      const first = lines[j].trimStart().replace(/^-\s*/, "").trimStart();
      j++;
      const fields = [];
      if (first !== "") fields.push({ word: first, line: entryLine });
      while (j < lines.length && (lines[j].trim() === "" || lines[j].trim().startsWith("#"))) j++;
      while (j < lines.length && /^\s+\S/.test(lines[j]) && lines[j].length - lines[j].trimStart().length > lead) {
        fields.push({ word: lines[j].trim(), line: j + 1 });
        j++;
        while (j < lines.length && (lines[j].trim() === "" || lines[j].trim().startsWith("#"))) j++;
      }
      const level = Object.create(null);
      let rules;
      let x = 0;
      while (x < fields.length) {
        const field = fields[x];
        const pair = /^([a-zA-Z-]+):\s*(.*)$/.exec(field.word);
        if (!pair) return fail(file, field.line, "a goals level's line is no field and value — a level carries name, its optional perspective and its rules");
        const key = pair[1];
        if (key === "rules") {
          if (pair[2].trim() !== "")
            return fail(file, field.line, "the level's rules hold their list as lines under it, one rule on a line each — the registry is plain words");
          if (rules !== undefined) return fail(file, field.line, `the level carries "rules" on it twice — each field is given once`);
          const ruleLines = [];
          let y = x + 1;
          while (y < fields.length) {
            const raw = fields[y].word;
            if (!/^-/.test(raw)) break;
            const rule = scalar(raw.replace(/^\s*-\s*/, ""), fields[y].line);
            if (rule.value === "") return fail(file, fields[y].line, "a rule holds no words — a rule names a count, a coverage, a provenance agreement or an approval by role");
            ruleLines.push(rule);
            y++;
          }
          if (ruleLines.length === 0)
            return fail(file, field.line, "the level's rules hold no rule — the list is refused empty");
          rules = ruleLines;
          x = y;
          continue;
        }
        if (!["name", "perspective"].includes(key))
          return fail(file, field.line, `a goals level carries "${key}", which it does not know — a level carries name, its optional perspective and its rules`);
        if (key in level) return fail(file, field.line, `the level carries "${key}" on it twice — each field is given once`);
        const read = wordScalar(pair[2], `level's ${key}`, field.line);
        if (read.ok === false) return read;
        level[key] = read;
        x++;
      }
      if (!level.name) return fail(file, fields.length ? fields[0].line : entryLine, "a goals level carries no `name:`");
      if (!rules) return fail(file, entryLine, "a goals level carries no `rules:` — the rules are what the level grants");
      level.rules = rules;
      levels.push(level);
      j = skip(j);
    }
    return { goals: levels, goalsLine: goalsLine0, i: j };
  };

  while (i < lines.length && /^contract:(\s|$)/.test(code(lines[i]).trim())) {
    const hit = /\S/.exec(code(lines[i]));
    const at = hit ? hit.index + 1 : 1;
    if (contract !== undefined)
      return fail(file, at, "the contract version is given on a line again — the registry is given one contract: line");
    const raw = code(lines[i]).trim().slice("contract:".length).trim();
    const read = scalar(raw, at);
    if (read.value !== raw)
      return fail(file, at, `the contract version stands quoted (${JSON.stringify(raw)}): the schema reads a number, and a quote reads a word — write it bare (contract: 1)`);
    if (read.value !== "1")
      return fail(file, at, `the registry carries contract: ${JSON.stringify(raw)} — no reader of version ${JSON.stringify(read.value)} reads here: this reader reads version 1, the version the set's words are written against, and the wiki that serves this product names the version it supports and degrades to plain pages, so nothing fails silently`);
    contract = { value: 1, line: at };
    i = skip(i + 1);
  }
  if (i >= lines.length) return fail(file, Math.max(lines.length, 1), contract === undefined ? "the registry is empty: it carries the stages and the kinds" : "the registry ends after its contract version: it carries the stages and the kinds");
  if (contract === undefined)
    return fail(file, 1, "the registry carries no contract version — its first line is `contract: 1`, the version its words are written against");

  let goals;
  let goalsLine;
  if (i < lines.length && /^goals:\s*$/.test(trim(lines[i]))) {
    const read = parseGoalsFrom(i);
    if (read.ok === false) return read;
    goals = read.goals;
    goalsLine = read.goalsLine;
    i = read.i;
  }

  // `stages:` and its list of `{ id }` entries, each at the same leading spaces.
  // A flow map (`stages: {x: y}`) is the schema's "must be array": the same
  // refusal the engine's check carries, at the place it stands.
  if (i >= lines.length || !/^stages:/.test(trim(lines[i])))
    return fail(file, i < lines.length ? i + 1 : Math.max(lines.length, 1), "the registry begins with something other than `stages:` and the life cycle's order under it");
  if (!/^stages:\s*$/.test(trim(lines[i])))
    return fail(file, i + 1, `the stages read ${JSON.stringify(trim(lines[i]).slice("stages:".length).trim())}: a list is read here — each stage stands as "- id: <stage>" on its own line, and an inline flow shape is not read`);
  const stagesLine = i + 1;
  i = skip(i + 1);
  if (i >= lines.length || !/^\s*-\s/.test(lines[i]))
    return fail(file, stagesLine, "`stages:` holds no list — each stage stands as `- id: <stage>` on its own line");
  const stages = [];
  while (i < lines.length && /^\s*-\s/.test(lines[i])) {
    const lead = lines[i].length - lines[i].trimStart().length;
    const first = lines[i].trimStart().replace(/^-\s*/, "").trimStart();
    const fields = [];
    if (first !== "") fields.push({ word: first, line: i + 1 });
    i++;
    while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
    while (i < lines.length && /^\s+\S/.test(lines[i]) && lines[i].length - lines[i].trimStart().length > lead) {
      fields.push({ word: lines[i].trimStart(), line: i + 1 });
      i++;
      while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
    }
    const map = Object.create(null);
    for (const field of fields) {
      const pair = /^([a-zA-Z-]+):\s*(.*)$/.exec(field.word);
      if (!pair) return fail(file, field.line, `a stage entry's line is no field "id:" or name the registry names`);
      const key = pair[1];
      if (key === "id") {
        const id = scalar(pair[2].trim(), field.line);
        if (id.value === "" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(id.value))
          return fail(file, field.line, `the stage id ${JSON.stringify(id.value)} is not a stage name: letters, digits, dashes and underscores, starting with a letter`);
        if ("id" in map) return fail(file, field.line, `the stage carries "id" on it twice — each stage is given once`);
        map.id = id;
      } else if (key === "name") {
        const name = scalar(pair[2].trim(), field.line);
        if (name.value === "" || !/^[A-Za-z][A-Za-z0-9 _-]*$/.test(name.value))
          return fail(file, field.line, `the stage name "${name.value}" is not a reader's word: letters, digits, spaces, dashes and underscores`);
        if ("name" in map) return fail(file, field.line, `the stage carries "name" on it twice — each field is given once`);
        map.name = name;
      } else {
        return fail(file, field.line, `a stage entry carries "${key}", which the registry's stage list does not know — a stage carries id and its optional reader name`);
      }
    }
    if (!map.id) return fail(file, fields.length ? fields[0].line : i, "a stage entry carries no `id:`");
    stages.push(map);
    i = skip(i);
  }

  // `kinds:` and its list of items, one kind per item. A kind carries its
  // five fields, one line each, and may carry two lists under it: its
  // `statuses:` (the allowed status words) and its `links:` (the link
  // fields it declares, each naming its target kinds). Plain words: an
  // inline `[a, b]` is a shape the reader does not read, so a list stands
  // as lines under its name.
  if (i < lines.length && /^goals:\s*$/.test(trim(lines[i]))) {
    // Between the stages and the kinds: the schema reads the sections as
    // one object, in no order, so the same section is read here too.
    const readMid = parseGoalsFrom(i);
    if (readMid.ok === false) return readMid;
    if (goals !== undefined)
      return fail(file, readMid.goalsLine, "the registry carries the goals section twice — the reserved goals section is given once");
    goals = readMid.goals;
    goalsLine = readMid.goalsLine;
    i = readMid.i;
  }
  if (i >= lines.length || !/^kinds:/.test(trim(lines[i])))
    return fail(file, i < lines.length ? i + 1 : Math.max(lines.length, 1), "the stages list is not followed by `kinds:` with the product's kinds under it");
  if (!/^kinds:\s*$/.test(trim(lines[i])) && !/^kinds:\s*\[\s*\]\s*$/.test(trim(lines[i]))) {
    // A flow shape at the kinds place (`kinds: {x: y}`) is the schema's
    // "must be array": the refusal names what stands there.
    return fail(file, i + 1, `the kinds read ${JSON.stringify(trim(lines[i]).slice("kinds:".length).trim())}: a list is read here — each kind stands as a "- name: <name>" item, and an inline flow shape is not read`);
  }
  const kindsLine = i + 1;
  const kindsEmptyInline = /^kinds:\s*\[\s*\]\s*$/.test(trim(lines[i]));
  i = skip(i + 1);

  const kinds = [];
  if (kindsEmptyInline) {
    // An empty kinds list reads as the product keeping no kinds: the
    // engine reads it (0 kinds), the set's rules judge it below.
  } else if (i >= lines.length || !/^\s*-\s/.test(lines[i])) {
    return fail(file, kindsLine, "`kinds:` holds no kinds — each stands as a `- name: <name>` item with the kind's fields and lists under it, and an empty product carries `kinds: []`");
  }
  {

  while (i < lines.length && /^\s*-\s/.test(lines[i])) {
    const kindLead = lines[i].length - lines[i].trimStart().length;
    const map = Object.create(null);
    let statuses;
    let links;
    let evidence;
    const first = lines[i].trimStart().replace(/^-\s*/, "").trimStart();
    if (first !== "") {
      // The item's first field may stand on the dash's own line; it reads
      // by the words a line under the item reads by.
      const pair = /^([a-zA-Z-]+):\s*(.*)$/.exec(first);
      const at = i + 1;
      if (!pair)
        return fail(file, at, "an item of `kinds:` opens with something that is no kind field — a kind stands as `- name: <name>` with its fields under it");
      if (pair[1] === "statuses" || pair[1] === "links" || pair[1] === "evidence")
        return fail(file, at, `the kind's ${pair[1]} holds its list as lines under it — the item opens with its name, and the list stands under it`);
      if (!FIELDS.includes(pair[1]) && pair[1] !== "storage")
        return fail(file, at, `a kind field has no name the registry knows on it — a kind carries ${FIELDS.join(", ")}, its statuses, its links, its storage form and its evidence under it`);
      map[pair[1]] = scalar(pair[2], at);
      if (map[pair[1]].value === "") return fail(file, at, `the kind's "${pair[1]}" holds no value — ${FIELD_WORDS[pair[1]]}`);
      if ((pair[1] === "name" || pair[1] === "stage") && !/^[A-Za-z][A-Za-z0-9 _-]*$/.test(map[pair[1]].value))
        return fail(file, at, `the kind's "${pair[1]}" reads "${map[pair[1]].value}": a reader's word of letters, digits, spaces, dashes and underscores, starting with a letter`);
    }
    i++;
    while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
    while (i < lines.length && /^\s+\S/.test(lines[i]) && lines[i].length - lines[i].trimStart().length > kindLead) {
      const raw = lines[i];
      const line = i + 1;
      const word = code(raw).trim();
      const pair = /^([a-zA-Z-]+):\s*(.*)$/.exec(word);
      if (!pair)
        return fail(file, line, `under a kind stands a line that is no kind field and value — a kind carries ${FIELDS.join(", ")}, and its lists under it`);
      const key = pair[1];
      if (key === "evidence") {
        // The evidence shape is a map, not a list: source, and its
        // optional ref and record, each naming the document's field the
        // fact carries that provenance in. The schema requires source and
        // refuses a field it does not know.
        if ("evidence" in map) return fail(file, line, `the kind carries "${key}" on it twice — each field is given once`);
        let j = skip(i + 1);
        const fields = [];
        while (j < lines.length && /^\s+\S/.test(lines[j]) && lines[j].length - lines[j].trimStart().length > lines[line - 1].length - lines[line - 1].trimStart().length) {
          const subLine = j + 1;
          const sub = code(lines[j]).trim();
          const subPair = /^([a-zA-Z-]+):\s*(.*)$/.exec(sub);
          if (!subPair)
            return fail(file, subLine, "an evidence entry is no field and value — the evidence shape carries source, and its optional ref and record");
          if (!["source", "ref", "record"].includes(subPair[1]))
            return fail(file, subLine, `the evidence shape carries "${subPair[1]}", which it does not know — its fields are source, ref, record`);
          if (fields.some((e) => e.field === subPair[1]))
            return fail(file, subLine, `the evidence carries "${subPair[1]}" on it twice — each field is given once`);
          if (subPair[2].trim() === "")
            return fail(file, subLine, `the evidence's "${subPair[1]}" holds no value — the document's field name the fact carries it in`);
          const read = wordScalar(subPair[2], `evidence's ${subPair[1]}`, subLine);
          if (read.ok === false) return read;
          fields.push({ field: subPair[1], value: read.value, line: subLine });
          j++;
        }
        if (fields.length === 0)
          return fail(file, line, "the kind's evidence holds no field — the shape carries source, and its optional ref and record");
        if (!fields.some((e) => e.field === "source"))
          return fail(file, line, `the evidence shape carries no "source" — the schema requires it: the document's field naming the source system`);
        evidence = { key: line, fields };
        i = j;
        continue;
      }
      if (key === "statuses" || key === "links") {
        if (/^\[\s*\]\s*$/.test(pair[2].trim())) {
          // An empty inline list reads as none: the engine reads it
          // (statuses: [] is 0 statuses), the set's rules judge it below.
          if (key === "statuses") statuses = [];
          else links = [];
          i++;
          continue;
        }
        if (pair[2].trim() !== "")
          return fail(file, line, `the kind's ${key} holds its list as lines under it, one entry on a line each — an inline [a, b] is a shape this reader does not read, and the registry is plain words`);
        if (key === "statuses" && statuses !== undefined)
          return fail(file, line, `the kind carries "${key}" on it twice — each field is given once`);
        if (key === "links" && links !== undefined)
          return fail(file, line, `the kind carries "${key}" on it twice — each field is given once`);
        i = skip(i + 1);
        if (i >= lines.length || !/^\s*-\s/.test(lines[i]) || lines[i].length - lines[i].trimStart().length <= lines[line - 1].length - lines[line - 1].trimStart().length) {
          return fail(file, line, `the kind's ${key} holds no entry — the list is refused empty`);
        }
        const entries = [];
        while (i < lines.length && /^\s*-\s/.test(lines[i]) && lines[i].length - lines[i].trimStart().length > lines[line - 1].length - lines[line - 1].trimStart().length) {
          const entryLead = lines[i].length - lines[i].trimStart().length;
          const entryLine = i + 1;
          const entryWord = lines[i].trimStart().replace(/^-\s*/, "");
          if (key === "statuses") {
            const read = scalar(entryWord, entryLine);
            if (!/^[A-Za-z][A-Za-z0-9 _-]*$/.test(read.value))
              return fail(file, entryLine, `a status reads "${read.value}": a reader's word of letters, digits, spaces, dashes and underscores`);
            entries.push(read);
            i++;
          } else {
            const link = Object.create(null);
            const firstField = entryWord.trim();
            i++;
            while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
            if (firstField !== "") {
              const pair2 = /^([a-zA-Z-]+):\s*(.*)$/.exec(firstField);
              if (!pair2)
                return fail(file, entryLine, "a link stands as `- field: <the field's name>` with its fields under it");
              if (pair2[1] !== "field")
                return fail(file, entryLine, `a link carries "${pair2[1]}" first: the field's name is its first word — its other fields stand under it`);
              const firstRead = linkField(pair2[2], entryLine);
              if (firstRead.ok === false) return firstRead;
              link.field = firstRead;
              while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
            }
            while (i < lines.length && /^\s+\S/.test(lines[i]) && lines[i].length - lines[i].trimStart().length > entryLead) {
              const subWord = code(lines[i]).trim();
              const subLine = i + 1;
              const subPair = /^([a-zA-Z-]+):\s*(.*)$/.exec(subWord);
              if (!subPair)
                return fail(file, subLine, "under a link stands a line that is no link field and value — a link carries its field's name, its targets, its backlink's word, its cardinality and whether it is required");
              const subKey = subPair[1];
              if (!["field", "targets", "backlink", "cardinality", "required"].includes(subKey))
                return fail(file, subLine, `a link carries "${subKey}", which a link of the registry does not know — a link carries field, targets, backlink, cardinality, required`);
              if (subKey in link)
                return fail(file, subLine, `the link carries "${subKey}" on it twice — each field is given once`);
              if (subKey === "field") {
                if (link.field !== undefined)
                  return fail(file, subLine, `the link carries "field" on it twice — each field is given once`);
                const fieldRead = linkField(subPair[2], subLine);
                if (fieldRead.ok === false) return fieldRead;
                link.field = fieldRead;
              } else if (subKey === "targets") {
                if (subPair[2].trim() !== "")
                  return fail(file, subLine, "a link's targets hold their list as lines under it, one target on a line each — an inline [a, b] is a shape this reader does not read, and the registry is plain words");
                i = skip(i + 1);
                const targets = [];
                if (i < lines.length && /^\s*-\s/.test(lines[i]) && lines[i].length - lines[i].trimStart().length > lines[subLine - 1].length - lines[subLine - 1].trimStart().length) {
                  while (i < lines.length && /^\s*-\s/.test(lines[i]) && lines[i].length - lines[i].trimStart().length > lines[subLine - 1].length - lines[subLine - 1].trimStart().length) {
                    const targetRead = scalar(lines[i].trimStart().replace(/^-\s*/, ""), i + 1);
                    if (targetRead.value === "")
                      return fail(file, i + 1, "a link's target holds no value — a target names the kind whose documents it may reach, by the kind's id prefix");
                    targets.push(targetRead);
                    i++;
                  }
                } else {
                  return fail(file, subLine, "a link's targets hold no target — the list is refused empty: a link names the kinds its targets may be, one on a line");
                }
                link.targets = targets;
                // The target list already stands past its last line: the
                // next field is read as it is, never stepped over.
                while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
                continue;
              } else if (subKey === "backlink") {
                const read = wordScalar(subPair[2], "link's backlink", subLine);
                if (read.ok === false) return read;
                link.backlink = read;
              } else if (subKey === "cardinality") {
                const read = scalar(subPair[2], subLine);
                if (read.value !== "one" && read.value !== "many")
                  return fail(file, subLine, `a link's cardinality reads "${read.value}": it is one or many`);
                link.cardinality = read;
              } else if (subKey === "required") {
                const r = subPair[2].trim();
                if (r !== "true" && r !== "false")
                  return fail(file, subLine, `a link's required reads ${JSON.stringify(r)}: it is the word true or the word false, unquoted`);
                link.required = { value: r === "true", line: subLine };
              }
              i++;
              while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
            }
            if (link.field === undefined)
              return fail(file, entryLine, "a link stands with no field's name — a link names the field its documents carry");
            if (link.targets === undefined)
              return fail(file, entryLine, "a link stands with no targets — a link names the kinds its targets may be");
            entries.push(link);
          }
          while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
        }
        if (key === "statuses") statuses = entries;
        else links = entries;
        continue;
      }
      if (key === "storage") {
        if (pair[2].trim() === "")
          return fail(file, line, `the kind's "storage" holds no value — the word document, or a reserved form the engine names`);
        if ("storage" in map) return fail(file, line, `the kind carries "storage" on it twice — each field is given once`);
        const read = scalar(pair[2], line);
        if (!["document", "task", "model-element", "component", "fact"].includes(read.value))
          return fail(file, line, `the kind's storage reads ${JSON.stringify(read.value)}: the contract's storage forms are document, task, model-element, component, fact`);
        map.storage = read;
        i++;
        continue;
      }
      if (!FIELDS.includes(key))
        return fail(file, line, `a kind field has no name the registry knows on it — a kind carries ${FIELDS.join(", ")}, its statuses, its links, its storage form and its evidence under it`);
      if (key in map) return fail(file, line, `the kind carries "${key}" on it twice — each field is given once`);
      map[key] = scalar(pair[2], line);
      if (map[key].value === "") return fail(file, line, `the kind's "${key}" holds no value — ${FIELD_WORDS[key]}`);
      if ((key === "name" || key === "stage") && !/^[A-Za-z][A-Za-z0-9 _-]*$/.test(map[key].value))
        return fail(file, line, `the kind's "${key}" reads "${map[key].value}": a reader's word of letters, digits, spaces, dashes and underscores, starting with a letter`);
      i++;
      while (i < lines.length && (lines[i].trim() === "" || lines[i].trim().startsWith("#"))) i++;
    }
    map.statuses = statuses;
    map.links = links;
    map.evidence = evidence;
    kinds.push(map);
    i = skip(i);
  }
  }

  if (i < lines.length && /^goals:\s*$/.test(trim(lines[i]))) {
    // The engine's own example writes the goals after the kinds; the same
    // section read by the same words.
    const read = parseGoalsFrom(i);
    if (read.ok === false) return read;
    if (goals !== undefined)
      return fail(file, read.goalsLine, "the registry carries the goals section twice — the reserved goals section is given once");
    goals = read.goals;
    goalsLine = read.goalsLine;
    i = read.i;
  }
  if (i < lines.length && trim(lines[i]) !== "")
    return fail(file, i + 1, "the registry holds a line outside stages and kinds");
  return { ok: true, value: { contract, stages, kinds, goals, goalsLine } };
}

/** Where a kind's own record stands: the kind's first field's line. */
function anchorOf(kind, kindsLine) {
  for (const key of FIELDS) if (kind[key]) return kind[key].line;
  return kindsLine;
}

/**
 * The registry with the set's rules applied: { ok, findings, notes, value }.
 * A finding names the file and the line with what is wrong. A note reports a
 * choice the registry may legitimately make. The reader alone enforces what
 * the contract's check enforces (the prefix's shape, the folder under docs/,
 * the stage naming the list's stage, the hint's words, each name given
 * once), and the set's own rules beside them: one registry kind carries
 * exactly one of the set's kinds, matched by the kind's id prefix, one to
 * one — a kind the set owns that no kind of the registry carries any more
 * is a finding, because the wiki's groups and next-step hints lose the
 * set's chain without anything saying so.
 */
export function verifyRegistry(text, file) {
  const read = parseKinds(text, file);
  if (!read.ok) return { ok: false, findings: [read.message], notes: [] };
  const value = read.value;
  const findings = [];
  const notes = [];
  const out = (line, message) => `${file}:${line}: ${message}`;

  // The contract's refusal the engine keeps: an evidence shape rides the
  // fact storage form. By the engine's own words.
  (value.kinds ?? []).forEach((kind) => {
    if (kind.evidence !== undefined && (kind.storage?.value ?? 'document') !== 'fact')
      findings.push(out(kind.evidence.key, "the evidence shape rides the fact storage form: a kind carrying its evidence fields declares \"storage: fact\""));
  });

  // The reservations the engine names (the 0021 amendment): a kind stored
  // in a form this engine version does not serve, an imported fact's
  // evidence shape, the reserved goals section. Each is reported as a
  // note that names it — kept as data, never dropped, never a refusal.
  (value.kinds ?? []).forEach((kind) => {
    const form = kind.storage?.value ?? 'document';
    if (form === 'document') return;
    notes.push(out(kind.storage.line, `the kind "${kind.name?.value ?? ""}" declares the storage form "${form}"; this engine version serves documents only — the kind and its records are kept and named, never dropped`));
    if (kind.evidence !== undefined)
      notes.push(out(kind.evidence.key, `the kind "${kind.name?.value ?? ""}" carries its evidence (source, ref, record); this engine version does not read imported graphs — the shape is kept as data, never dropped`));
  });
  if (value.goals !== undefined && value.goalsLine !== undefined)
    notes.push(out(value.goalsLine, 'the manifest carries the reserved goals section; this engine version does not compute maturity levels — the section is kept as data, never dropped'));

  const stageNames = new Set(value.stages.map((s) => s.id.value));
  const seenStage = new Map();
  for (const stage of value.stages) {
    if (seenStage.has(stage.id.value))
      findings.push(out(stage.id.line, `the stage "${stage.id.value}" is named twice, first on line ${seenStage.get(stage.id.value)}: each stage is given once`));
    else seenStage.set(stage.id.value, stage.id.line);
  }

  const seenPrefix = new Map();
  for (const kind of value.kinds) {
    for (const field of FIELDS)
      if (!kind[field])
        // The schema requires all five fields (the engine's "must have
        // required properties name"): a kind missing one is refused, not
        // reported beside an otherwise green read.
        return { ok: false, findings: [out(anchorOf(kind, firstKindLine(value)), `a kind carries no "${field}" — it is ${FIELD_WORDS[field]}`)], notes: [] };
    if (kind.prefix?.value) {
      if (!/^[A-Z]{1,4}$/.test(kind.prefix.value))
        findings.push(out(kind.prefix.line, `"${kind.prefix.value}" is not an id prefix: one to four capitals (A-Z)`));
      if (seenPrefix.has(kind.prefix.value))
        findings.push(out(kind.prefix.line, `the id prefix "${kind.prefix.value}" is named twice, first on line ${seenPrefix.get(kind.prefix.value)}: each kind is given one prefix`));
      else seenPrefix.set(kind.prefix.value, kind.prefix.line);
    }
    if (kind.folder?.value) {
      if (!kind.folder.value.startsWith("docs/"))
        findings.push(out(kind.folder.line, `"${kind.folder.value}" is not a place under the documents: a kind lives inside docs/`));
      else
        for (const leg of kind.folder.value.slice("docs/".length).split("/")) {
          if (leg === "..")
            findings.push(out(kind.folder.line, `"${kind.folder.value}" climbs out of the documents: a kind lives inside docs/`));
          if (leg === "")
            findings.push(out(kind.folder.line, `"${kind.folder.value}" holds an empty segment: a kind lives inside docs/`));
        }
    }
    if (kind.stage?.value && !stageNames.has(kind.stage.value))
      findings.push(out(kind.stage.line, `"${kind.stage.value}" is not a stage of the list the registry names`));
    if (kind.hint?.value && kind.hint.value.trim() === "")
      findings.push(out(kind.hint.line, "the hint is empty: a reader stands where no word is"));
    if (kind.statuses) {
      const seenStatus = new Map();
      for (const status of kind.statuses) {
        if (seenStatus.has(status.value))
          findings.push(out(status.line, `the status "${status.value}" is named twice, first on line ${seenStatus.get(status.value)}: an allowed status is given once`));
        else seenStatus.set(status.value, status.line);
      }
    }
    if (kind.links) {
      const seenLink = new Map();
      for (const link of kind.links) {
        // The link's field name: it is the documents' field the link reads,
        // and the kind carries it once.
        if (seenLink.has(link.field.value))
          findings.push(out(link.field.line, `the link field "${link.field.value}" is declared twice, first on line ${seenLink.get(link.field.value)}: each link field is declared once`));
        else seenLink.set(link.field.value, link.field.line);
        // A target names a kind of this registry, by its id prefix: a link
        // whose target names no kind here would be a finding where the wiki
        // reads a document with it, and this read says it first.
        for (const target of link.targets) {
          // The engine matches a target against the kinds' names (its
          // refusal's own words); the set's products name the kinds by
          // their reader's word, so the prefix is read as the same
          // declaration only when no kind carries that name.
          if (value.kinds.some((other) => other.name?.value === target.value)) continue;
          if (value.kinds.some((other) => other.prefix?.value === target.value)) continue;
          findings.push(out(target.line, `the ${kind.name?.value ?? "kind"}'s link "${link.field.value}" names ${JSON.stringify(target.value)}: no kind of the registry carries that name or id prefix — a target names a kind the registry declares`));
        }
      }
    }
  }

  // The kinds the set owns, one registry kind each, matched by prefix.
  // The set's own declarations: a set kind declares links and statuses the
  // writer renders from its table; a registry that loses a set kind's
  // declarations is reported, not refused — the declarations are the
  // product's data to keep or to narrow, and the report tells what the
  // wiki reads now.
  const setDeclarations = new Map(KINDS.filter((owned) => owned.links || owned.statuses).map((owned) => [owned.prefix, owned]));
  for (const owned of setDeclarations.values()) {
    if (!value.kinds.some((kind) => kind.prefix?.value === owned.prefix)) continue;
    const here = value.kinds.find((kind) => kind.prefix?.value === owned.prefix);
    if (!here.statuses && owned.statuses)
      notes.push(out(here.prefix.line, `the set's ${owned.name} kind carries its statuses (${owned.statuses.join(", ")}) in the set's table, and this registry declares none: the wiki reads the kind as one with no allowed statuses`));
    if (!here.links && owned.links)
      for (const link of owned.links)
        notes.push(out(here.prefix.line, `the set's ${owned.name} kind declares the link "${link.field}" (to ${link.targets.join(", ")}), and this registry declares none: the wiki reads the kind as one that carries no links`));
  }

  const taken = new Set();
  for (const owned of KINDS) {
    const here = value.kinds.find((kind) => !taken.has(kind) && kind.prefix?.value === owned.prefix);
    if (!here) {
      const proof = value.kinds.length ? anchorOf(value.kinds[0], firstKindLine(value)) : firstKindLine(value);
      findings.push(out(proof, `the set's ${owned.name} kind (its ids are ${owned.prefix}-…, written at ${owned.folder}) stands in no kind of the registry — the wiki loses the ${owned.stage} stage's word without it`));
      continue;
    }
    taken.add(here);
    if (here.folder?.value !== owned.folder)
      notes.push(out(here.folder.line, `the ${owned.name} kind's documents collect at "${here.folder.value}": the set's default is ${owned.folder} — the product's own choice, named for what the wiki now reads the kind's place from`));
    if (here.stage?.value !== owned.stage)
      if (value.stages.some((seen, x) => !STAGES[x] || !seen || seen.id?.value !== STAGES[x]))
        notes.push(out(here.stage.line, `the ${owned.name} kind reads stage "${here.stage.value}": the set's life cycle words its stage ${owned.stage} — a renamed stage is this product's choice, named so the stage a person reads stays the set's word in their head`));
      else
        findings.push(out(here.stage.line, `the set's ${owned.name} kind is filed under ${here.stage.value}: its stage is ${owned.stage} of the set's life cycle`));
  }
  return findings.length ? { ok: false, findings, notes } : { ok: true, findings, notes, value };
}

/** The template's places, in the order the protocol records: the kind of
 *  root each template sits under at a product. */
const TEMPLATE_PLACES = [
  ["the product's own template", (root) => join(root, "templates")],
  ["the copy the project installed", (root) => join(root, ".shady2k", "templates")],
  ["the set's shipped default", () => join(HERE, "templates")],
];

/** The set's template per product-document kind, its prefix from the
 *  identity line it opens with. One file each; the same relative places
 *  name a product's override and an installed copy. */
function templateFiles() {
  const files = new Map();
  const dir = join(HERE, "templates", "product");
  if (!existsSync(dir))
    return { ok: false, message: `no templates under ${dir}: the set ships a template per product-document kind` };
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const first = readFileSync(join(dir, name), "utf8").split("\n")[0];
    const hit = IDENTITY.exec(first);
    if (!hit) continue;
    if (files.has(hit[1]))
      return { ok: false, message: `two product templates claim the ${hit[1]} prefix (${files.get(hit[1])}, ${name}): each kind's documents are shaped by one template` };
    files.set(hit[1], join("product", name));
  }
  const practice = join(HERE, "templates", "practice.md");
  if (existsSync(practice)) {
    if (files.has("PRA"))
      return { ok: false, message: "a product template claims the PRA prefix: the practice record's template is templates/practice.md" };
    files.set("PRA", "practice.md");
  }
  return { ok: true, files };
}

/**
 * One template resolution, in the protocol's order: the product's own
 * template at `<root>/templates/<the set's relative name>` first; the copy
 * the project installed at `<root>/.shady2k/templates/<the relative name>`
 * second; the set's shipped words beside the check last. The kind keeps
 * the set's template name, and the identity line of its template names the
 * kind's prefix: what moves with a kind is its prefix. A template of the
 * first two places that does not name the prefix is the refusal's own —
 * the resolution stops there, so a writing skill fixes what the template
 * is wrong about instead of silently starting from a default.
 */
export function resolveTemplate({ prefix, root }) {
  const files = templateFiles();
  if (!files.ok) return { ok: false, status: "misuse", message: files.message };
  if (!files.files.has(prefix))
    return { ok: false, status: "misuse", message: `no template of the set's product documents claims the prefix ${JSON.stringify(prefix)} — the set's templates answer to ${[...files.files.keys()].sort().join(", ")}` };
  const name = files.files.get(prefix);
  for (const [where, rootOf] of TEMPLATE_PLACES) {
    const path = join(rootOf(root), name);
    if (!existsSync(path)) continue;
    let text;
    try {
      text = readFileSync(path, "utf8");
    } catch (error) {
      return { ok: false, status: "findings", file: path, line: 1, message: `${path} cannot be read: ${error.message} — a template whose file cannot be read is refused as an unreadable file` };
    }
    if (where === "the set's shipped default")
      return { ok: true, status: "resolved", source: where, path, text };
    const first = text.split("\n")[0];
    const hit = IDENTITY.exec(first);
    if (!hit)
      return { ok: false, status: "refused", file: path, line: 1, message: `${path}:1: the template carries no identity line — a product's own template for a kind opens "# <PREFIX>-<NNN> — <the kind's one line>", and the prefix it names is the kind's own, so the writing skill reads whose documents the template shapes` };
    if (hit[1] !== prefix)
      return { ok: false, status: "refused", file: path, line: 1, message: `${path}:1: the template's identity line names ${JSON.stringify(hit[1])} — the kind it shapes carries the prefix ${prefix}, the prefix that moves with the kind in the registry` };
    return { ok: true, status: "resolved", source: where, path, text };
  }
  return { ok: false, status: "findings", message: `the set's template for ${prefix} stands nowhere — the set ships ${name} beside its check, and its words carry the kind's form` };
}

/** Read one product root into { ok, root, path } or the exit-2 refusal's words. */
function productRoot({ root }) {
  if (!root) root = process.cwd();
  if (!existsSync(root) || !statSync(root).isDirectory())
    return { ok: false, message: `no folder at "${root}"` };
  if (!existsSync(join(root, "workspace.yaml")))
    return { ok: false, message: `"${root}" holds no workspace.yaml: kinds-registry.mjs writes a product's kinds registry, and a product is recognised by its manifest — run it at a product's root or with --root <product folder>` };
  return { ok: true, root, path: join(root, REGISTRY_FILE) };
}

/** The templates' own walk: the resolution order is exercised on product
 *  folders the walk builds in a scratch folder it clears after — the
 *  product's own template first, the installed copy second, the shipped
 *  default last, and a product's own template that does not name the
 *  kind's prefix is the refusal's own, never fallen back from. */
export function templatesWalk(findings, words) {
  const base = mkdtempSync(join(tmpdir(), "kinds-registry-selftest-"));
  try {
    const product = (name, bytes) => {
      const root = join(base, name);
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, "workspace.yaml"), "schemaVersion: 1\nid: selftest\nname: kinds-registry selftest\n");
      if (bytes) writeFileSync(bytes.path, bytes.text);
      return root;
    };
    /** The walk's template file bytes, the kind's identity line first. */
    const evaluable = (identity, words2) => `# ${identity}\n\n${words2}\n`;

    // The product's own template goes first.
    const own = product("the-product-own");
    const ownBytes = evaluable("US-<NNN>", "<the product's own words for a story>");
    mkdirSync(join(own, "templates", "product"), { recursive: true });
    writeFileSync(join(own, "templates", "product", "user-story.md"), ownBytes);
    const runOwn = resolveTemplate({ prefix: "US", root: own });
    if (runOwn.ok !== true || runOwn.text !== ownBytes || runOwn.source !== "the product's own template")
      findings.push(`the product's own template is not the one the resolution prints: got ${JSON.stringify(runOwn.source ?? runOwn.message)}`);
    else words.push(`templates: the product's own template at ${runOwn.path} is the one the resolution prints`);

    // The installed copy is the product's template when the product holds
    // no template of its own.
    const installed = product("the-installed");
    const installedBytes = evaluable("US-<NNN>", "<the installed copy of the set's default>");
    mkdirSync(join(installed, ".shady2k", "templates", "product"), { recursive: true });
    writeFileSync(join(installed, ".shady2k", "templates", "product", "user-story.md"), installedBytes);
    writeFileSync(join(installed, "workspace.yaml"), "schemaVersion: 1\n");
    const runInstalled = resolveTemplate({ prefix: "US", root: installed });
    if (runInstalled.ok !== true || runInstalled.text !== installedBytes || runInstalled.source !== "the copy the project installed")
      findings.push(`the installed copy is not the one the resolution prints: got ${JSON.stringify(runInstalled.source ?? runInstalled.message)}`);
    else words.push(`templates: the installed copy at ${runInstalled.path} is the one the resolution prints when the product holds no template of its own`);

    // The candidates compete: the product's own template and the
    // installed copy both stand, and the product's own wins — the order
    // is proved when more than one place answers.
    const competing = product("the-competing");
    mkdirSync(join(competing, "templates", "product"), { recursive: true });
    writeFileSync(join(competing, "templates", "product", "user-story.md"), ownBytes);
    mkdirSync(join(competing, ".shady2k", "templates", "product"), { recursive: true });
    writeFileSync(join(competing, ".shady2k", "templates", "product", "user-story.md"), installedBytes);
    const runCompeting = resolveTemplate({ prefix: "US", root: competing });
    if (runCompeting.ok !== true || runCompeting.text !== ownBytes || runCompeting.source !== "the product's own template")
      findings.push(`the order is not proved when the candidates compete: got ${JSON.stringify(runCompeting.source ?? runCompeting.message)}`);
    else words.push("templates: with the product's own and the installed copy both standing, the product's own is the one the resolution prints");

    // Nothing installed, nothing held: the set's shipped words.
    const bare = product("the-bare");
    const runBare = resolveTemplate({ prefix: "US", root: bare });
    const shipped = readFileSync(join(HERE, "templates", "product", "user-story.md"), "utf8");
    if (runBare.ok !== true || runBare.text !== shipped || runBare.source !== "the set's shipped default")
      findings.push(`the set's shipped default is not the one the resolution prints: got ${JSON.stringify(runBare.source ?? runBare.message)}`);
    else words.push(`templates: the set's shipped default at ${runBare.path} is the one the resolution prints when nothing is installed`);

    // A product's own template that names another kind's prefix is the
    // refusal's own: nothing is printed, and the finding names the file
    // and the line.
    const refused = product("the-refused");
    const refusedBytes = evaluable("XR-<NNN>", "<the product's own words for a story>");
    mkdirSync(join(refused, "templates", "product"), { recursive: true });
    writeFileSync(join(refused, "templates", "product", "user-story.md"), refusedBytes);
    const runRefused = resolveTemplate({ prefix: "US", root: refused });
    if (runRefused.ok !== false || runRefused.status !== "refused" || !runRefused.message.includes(join(refused, "templates", "product", "user-story.md")) || !runRefused.message.includes("XR"))
      findings.push(`a product template that does not name the kind's prefix is not refused: got ${JSON.stringify(runRefused.ok ? `resolved from ${runRefused.source}` : runRefused.message)}`);
    else words.push("templates: the refused override is refused, with the file and the prefix it stands wrong about, and nothing is fallen back from");

    // A product's own template with no identity line is refused with the
    // file and the line, by the same words.
    const lineless = product("the-lineless");
    mkdirSync(join(lineless, "templates", "product"), { recursive: true });
    writeFileSync(join(lineless, "templates", "product", "user-story.md"), "## Story\n- a template whose first line is no identity line\n");
    const runLineless = resolveTemplate({ prefix: "US", root: lineless });
    if (runLineless.ok !== false || runLineless.status !== "refused" || !runLineless.message.includes(join(lineless, "templates", "product", "user-story.md")))
      findings.push(`a product template with no identity line is not refused: got ${JSON.stringify(runLineless.ok ? `resolved from ${runLineless.source}` : runLineless.message)}`);
    else words.push("templates: a template with no identity line is refused, with the file and the line");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

/** The selftest: the example registry is the words the set renders and
 *  verifies under the set's reader, and the templates' walk holds the
 *  order the protocol records. */
export function selftest(dir) {
  const path = join(dir, REGISTRY_FILE);
  const findings = [];
  const words = [];
  if (!existsSync(path)) {
    findings.push(`${path} stands nowhere: the published example is not there`);
    return { ok: false, findings, words: [] };
  }
  const kept = readFileSync(path, "utf8");
  if (kept !== renderRegistry())
    findings.push(`${path} differs from the set's rendered registry — the example the conformance run reads is the writer's own bytes; rerun the writer (node kinds-registry.mjs --root <a copy of the example product>) and commit what it changed, never a hand edit`);
  const verified = verifyRegistry(kept, "docs/kinds.yaml");
  if (!verified.ok) findings.push(...verified.findings);
  // The example without its contract line is refused at line 1, never
  // verified: the contract's check refuses it, and so does the set.
  const unversioned = verifyRegistry(kept.replace(/^contract: 1\n/, ""), "docs/kinds.yaml");
  if (!kept.startsWith("contract: 1\n"))
    findings.push(`${path} does not open with its contract line`);
  else if (unversioned.ok || !unversioned.findings.some((f) => f.startsWith("docs/kinds.yaml:1: the registry carries no contract version")))
    findings.push(`the example without its contract line is not refused at line 1: ${unversioned.ok ? "it verified" : unversioned.findings[0]}`);
  else words.push("kinds registry: a registry without its contract line is refused at line 1");
  templatesWalk(findings, words);
  if (verified.ok) words.unshift(`kinds registry: the example at ${path} is the writer's own bytes and verifies under the set's reader`);
  // The command line reads every option that takes a value through argv.mjs: an
  // empty, blank, missing or option-shaped word is misuse that names the option,
  // where `--root ''` once verified the current folder instead of the one asked
  // for and --root with nothing after it was only "incomplete".
  const misuse = (args, option) => {
    let said = "";
    const write = process.stderr.write.bind(process.stderr);
    process.stderr.write = (c) => { said += String(c); return true; };
    let code;
    try { code = main(args); } finally { process.stderr.write = write; }
    return code === 2 && said.includes(`"${option}"`) ? null : `exit ${code}: ${said.trim().split("\n")[0]}`;
  };
  for (const [name, args, option] of [
    ["an empty --root", ["--root", "", "--check", "--json"], "--root"],
    ["a missing --root", ["--root"], "--root"],
    ["an option instead of the --root value", ["--root", "--check"], "--root"],
    ["an empty --template", ["--template", "", "--json"], "--template"],
  ]) {
    const why = misuse(args, option);
    if (why !== null) findings.push(`kinds registry cli: ${name} is not misuse naming ${option} (${why})`);
  }
  return verified.ok ? { ok: true, findings, words } : { ok: false, findings, words: [] };
}

/** One run of the tool. Returns its exit code. */
function main(args) {
  const recognized = ["--json", "--check", "--selftest", "--template", "--root"];
  const wrong = args.filter((arg, x) => (arg.startsWith("--") && !recognized.includes(arg)) || (!arg.startsWith("--") && (x === 0 || args[x - 1] !== "--root" && args[x - 1] !== "--template")));
  const doSelftest = args.includes("--selftest");
  const templateAt = args.indexOf("--template");
  // One reader for every option that takes a value: an id prefix, an empty or
  // option-shaped one included, is read the same way here as everywhere else.
  let prefix;
  if (templateAt >= 0) {
    try { prefix = valueOf(args, templateAt, "--template", "an id prefix"); } catch (e) {
      if (!(e instanceof ValueNeeded)) throw e;
      console.error(e.message);
      console.error("usage: node kinds-registry.mjs --template <id prefix> [--root <product folder>] [--json]");
      return 2;
    }
  }
  if (doSelftest && (wrong.length || args.some((arg) => ["--check", "--template", "--root"].includes(arg)))) {
    console.error("usage: node kinds-registry.mjs --selftest | [--root <product folder>] [--template <id prefix>] [--check] [--json]");
    return 2;
  }
  if (doSelftest) {
    const dir = join(HERE, "fixtures", "product", "good");
    const run = selftest(dir);
    for (const word of run.words) console.log(word);
    if (!run.ok || run.findings.length) {
      for (const finding of run.findings) console.log(`FAIL  ${finding}`);
      return 1;
    }
    return 0;
  }
  const json = args.includes("--json");
  const check = args.includes("--check");
  if (templateAt >= 0) {
    if (prefix === undefined || (args[templateAt + 1] ?? "").startsWith("--")) {
      console.error("usage: node kinds-registry.mjs --template <id prefix> [--root <product folder>] [--json]");
      return 2;
    }
    if (check) {
      const words = "--template and --check read different things: --template prints one kind's template words, --check verifies the whole registry — give one";
      if (json) console.log(JSON.stringify({ status: "misuse", message: words }));
      else console.error(words);
      return 2;
    }
    let root;
    const rest = [];
    for (let i = 0; i < args.length; i++) {
      if (i === templateAt) { i++; continue; }
      const arg = args[i];
      if (arg === "--json") continue;
      if (arg === "--root") {
        try { root = valueOf(args, i, "--root", "the product folder"); } catch (e) {
          if (!(e instanceof ValueNeeded)) throw e;
          console.error(e.message);
          console.error("usage: node kinds-registry.mjs --template <id prefix> [--root <product folder>] [--json]");
          return 2;
        }
        i++;
        continue;
      }
      rest.push(arg);
    }
    if (rest.length) {
      console.error(`unexpected argument "${rest[0]}" — usage: node kinds-registry.mjs --template <id prefix> [--root <product folder>] [--json]`);
      return 2;
    }
    const place = productRoot({ root });
    if (!place.ok) {
      if (json) console.log(JSON.stringify({ status: "misuse", message: place.message }));
      else console.error(place.message);
      return 2;
    }
    const run = resolveTemplate({ prefix, root: place.root });
    if (!run.ok) {
      if (run.status === "findings" && run.file === undefined) {
        if (json) console.log(JSON.stringify({ status: "findings", findings: [run.message] }));
        else console.error(run.message);
        return 1;
      }
      const payload = run.status === "refused"
        ? { status: "refused", file: run.file, line: run.line, message: run.message }
        : { status: run.status, message: run.message };
      if (json) console.log(JSON.stringify(payload));
      else console.error(run.message);
      return run.status === "misuse" ? 2 : 1;
    }
    if (json) console.log(JSON.stringify({ status: "resolved", prefix, source: run.source, path: run.path, template: run.text }));
    else {
      process.stdout.write(run.text);
      console.error(`${run.path} — ${run.source}`);
    }
    return 0;
  }
  let root;
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json" || arg === "--check") continue;
    if (arg === "--root") {
      try { root = valueOf(args, i, "--root", "the product folder"); } catch (e) {
        if (!(e instanceof ValueNeeded)) throw e;
        console.error(e.message);
        console.error("usage: node kinds-registry.mjs [--root <product folder>] [--check] [--json] | --selftest");
        return 2;
      }
      i++;
      continue;
    }
    rest.push(arg);
  }
  if (rest.length) {
    console.error(`unexpected argument "${rest[0]}" — usage: node kinds-registry.mjs [--root <product folder>] [--check] [--json] | --selftest`);
    return 2;
  }
  const place = productRoot({ root });
  if (!place.ok) {
    if (json) console.log(JSON.stringify({ status: "misuse", message: place.message }));
    else console.error(place.message);
    return 2;
  }
  if (!existsSync(place.path)) {
    if (check) {
      const words = `${place.path} stands nowhere: the product keeps no kinds registry — nothing to verify; a product without one serves its plain pages, and setup writes one on its next run`;
      if (json) console.log(JSON.stringify({ status: "missing", message: words }));
      else console.log(words);
      return 0;
    }
    mkdirSync(dirname(place.path), { recursive: true });
    writeFileSync(place.path, renderRegistry());
    const words = `wrote ${place.path}: the set's kinds, each with its stage, its links and its next-step hint; the product may rename the kinds or retune the hints, and the wiki reads this file alone`;
    if (json) console.log(JSON.stringify({ status: "wrote", path: place.path }));
    else console.log(words);
    return 0;
  }
  let text;
  try {
    text = readFileSync(place.path, "utf8");
  } catch (error) {
    const words = `${place.path} cannot be read: ${error.message} — a registry whose file cannot be read is refused as one unreadable file, exit 1`;
    if (json) console.log(JSON.stringify({ status: "findings", findings: [words] }));
    else console.error(words);
    return 1;
  }
  const verified = verifyRegistry(text, "docs/kinds.yaml");
  if (!verified.ok) {
    if (json) console.log(JSON.stringify({ status: "findings", findings: verified.findings }));
    else for (const finding of verified.findings) console.error(finding);
    return 1;
  }
  for (const note of verified.notes) console.log(note);
  const words = `${place.path} stands verified: ${verified.value.kinds.length} kinds, each with its stage, its links and its next-step hint`;
  if (json) console.log(JSON.stringify({ status: "verified", path: place.path, notes: verified.notes }));
  else console.log(words);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
