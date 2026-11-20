# Changelog

Versions refer to the pattern (`pattern/`). Each released version has a git tag `pattern-vX.Y.Z`. Tags before 0.2.1 are named `manifesto-vX.Y.Z` and their paths are under `manifesto/`.

## 0.2.1
Renamed "manifesto" to "pattern" (folder `manifesto/` → `pattern/`, file `manifesto.md` → `pattern.md`, tags `manifesto-v*` → `pattern-v*`, wording). No change to the principles.

## 0.3.0 — planned
Agent-native documentation: make the pattern usable as a reference by coding agents.
- An agent entry point (`/agent`) and `llms.txt` index on the site.
- Versioned, normative spec with stable requirement IDs, valid/invalid examples and conformance tests.
- A machine-readable spec and a validator, so an agent can check its own output.
- An installable skill pointing at the versioned spec.

Not released: nothing in this version is implemented yet.

## 0.2.0
Parties and case law over definitions.
- Principle 1 is now "Parties come first" (was "Definitions come first"). Definitions serve the clauses.
- Principle 5 adds: when prose and case law disagree, the case law wins.
- Intro and worked example reworded to match.
- Files renamed: `CODE_AS_A_CONTRACT.md` → `manifesto.md` (renamed to `pattern.md` in 0.2.1); `index.html` → `papers/vs-gherkin.html`;
  `internals.html` → `papers/schedules.html`. Cross-links are relative.

## 0.1.0
First published version: ten principles, case-law convention CaC/CL-1, schedules, articles.
Definitions came first.
