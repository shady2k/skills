# Constitution

This repository holds one product's knowledge, apart from the product's
code: its documents, its intended model, its skills and its prototypes,
kept as plain files in git. A product wiki serves these files as pages, so
what is written here is what is read.

## Folders

- docs/ — the product's documents, written in Markdown and kept in git.
- model/ — the model the product is meant to have.
- skills/ — the team's own skills, written for this product; never a copy
  of the skill set's own, whose pinned version is field `skills` of the
  manifest, naming the set and its version (`shady2k: <version>`).
- prototypes/ — throwaway prototypes built to answer design questions.
- repos/ — the code repositories the product spans. Each one is a git
  repository of its own, and this repository leaves repos/ untracked.

The folders' places come with the manifest's `schemaVersion` and are never
read from the manifest, so every tool and every agent knows where things
are from the schema version alone.

## Documents

Every document is Markdown in git: a page someone writes, and what the
reader later sees. Links between documents are relative paths, so this
folder may be renamed without breaking them.

<!-- product:maintained -->
The manifest `workspace.yaml` is how a product is recognised. Its
`schemaVersion`, `id` and `name` are never renamed; anything a later
version adds grows beside them. `schemaVersion` (1 here) fixes the folder
layout above; `id` is given at creation and kept for the product's life,
whatever this folder is later called; for a draft, `name` is this folder's
name. This file is written once, and a later version updates no part of it
outside this marked section.
<!-- /product:maintained -->
