#!/usr/bin/env bash
set -euo pipefail

# Dev-only: links every skill in this repo into the local skill directories of
# the harnesses on this machine, so a `git pull` is all an update takes.
#   ~/.claude/skills   Claude Code
#   ~/.agents/skills   Codex and other Agent Skills-compatible harnesses
# Re-run after adding, removing or renaming a skill.

REPO="$(cd "$(dirname "$0")/.." && pwd)"

for DEST in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  if [ -L "$DEST" ]; then
    case "$(readlink -f "$DEST")" in
      "$REPO" | "$REPO"/*)
        echo "error: $DEST is a symlink into this repo; remove it and re-run." >&2
        exit 1
        ;;
    esac
  fi
  mkdir -p "$DEST"
  find "$REPO/skills" -name SKILL.md -print0 | while IFS= read -r -d '' skill_md; do
    src="$(dirname "$skill_md")"
    target="$DEST/$(basename "$src")"
    if [ -e "$target" ] && [ ! -L "$target" ]; then
      echo "skipped $(basename "$src"): $target exists and is not a link" >&2
      continue
    fi
    ln -sfn "$src" "$target"
    echo "linked $(basename "$src") -> $DEST"
  done
done
