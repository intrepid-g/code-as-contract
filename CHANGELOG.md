# Changelog

Versions refer to the pattern (`pattern/`). Each released version has a git tag `pattern-vX.Y.Z`. Tags before 0.2.1 are named `manifesto-vX.Y.Z` and their paths are under `manifesto/`.

## 0.4.0 — in progress
- Principle 1 is now "There are more parties than you first think": explicit parties (user, admin) and implicit parties (frontend, cache, database, subsystems). The duty list is scratch work; each duty becomes a constant, a clause and a precedent.
Done:
- No untested text. Rule text and clause citations leave docstrings. A party's chapter is a module (`contract/<party>.py`; procedures too, e.g. `contract/refund_procedure.py`). Rule values are named constants (`RETURN_WINDOW_DAYS = 30`). Claims a docstring made are now test names.
- `CONTRACT.md` is dropped. The human-readable spec is the test listing (`pytest --collect-only -q`), grouped by party module.
- Tests are now "precedents" (in legal terms: case law). Files are `precedents/test_<party>.py` (was `case_law/test_clause_<n>_<name>.py`). The convention ID `CaC/CL-1` is unchanged (CL = case law). "Ruling" keeps its meanings (the pure function a schedule consults; the assert step).
- A performer may hold one dispatch `if` on a decision field. Principle 8 and Part III now agree with Part I.
- "Article" now means only Part V architecture law. Per-party Articles are modules.
- Structural precedents replace the prose duties: `test_every_party_module_has_at_least_one_clause` and `test_every_clause_is_cited_by_some_precedent`, with a stdlib reference implementation in `skill/EXAMPLE.md`. New convention rule 8.
- Principle 10 is now "The docket is the test listing, never hand-written prose."
- `code-as-contract-lean.md`: an agent-ready distillation of the skill (about 800 tokens).

Not done yet (agent-native documentation):
- An agent entry point (`/agent`) and `llms.txt` index on the site.
- Versioned, normative spec with stable requirement IDs, valid/invalid examples and conformance tests.
- A machine-readable spec and a validator, so an agent can check its own output.
- An installable skill pointing at the versioned spec.

Known stale (to fix before release):
- `pattern/papers/vs-gherkin.html` and `pattern/papers/schedules.html` code samples still show docstrings that cite clauses ("Clause 4 — ..."), `RefundPolicy`, and `articles/` file names. Their terminology is updated.

## 0.3.0
Superseded in 0.4.0: the idea of a generated `CONTRACT.md` is dropped. The code is still the source. The spec is now the test listing.

Code and contract are two renderings of one source.
- Principle 10 amended: the code (clauses, docstrings, case law) is the source; the prose contract is generated from it; incoming prose is translated into code, not kept beside it.
- The skill no longer asks for a hand-written `CONTRACT.md`. It asks for code, and renders `CONTRACT.md` from it, marked as generated.
- `EXAMPLE.md` shows its `CONTRACT.md` excerpt as generated output.
- No generator tool exists yet. The docket comes from `pytest --collect-only -q`; clause text comes from docstrings.

## 0.2.1
Renamed "manifesto" to "pattern" (folder `manifesto/` → `pattern/`, file `manifesto.md` → `pattern.md`, tags `manifesto-v*` → `pattern-v*`, wording). No change to the principles.

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
