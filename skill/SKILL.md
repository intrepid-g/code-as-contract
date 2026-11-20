---
name: code-as-contract
description: Draft or review business-logic code as a legal contract between its parties (people and internal system actors like the database, queue, cache, scheduler or an LLM), not instructions to a machine. Use when writing a new domain/business-rule function, untangling a conditional-heavy function that decides something (pricing, eligibility, refunds, access, payouts), reviewing code for whether a rule can be named and cited, or separating decision logic from side effects (DB writes, API calls, emails).
---

# Code as a Contract

Code is a **contract** between its parties — the customer, the business, the
next developer, the on-call engineer at 3am — that a machine happens to
execute. Draft it the way a careful lawyer drafts a contract: parties
first, then clauses stating what binds each of them, then case law that
settles disputes.

## One source, two renderings

Code and prose contract are two renderings of one source. Keep only one
source. **The code is the source.** The prose is generated from it.

The source has three parts:

- **Clauses.** Each clause is a named function. Its docstring cites its
  article and clause (e.g. "Clause 2.1 — Article II §1") and states the
  clause text in plain language a non-engineer party can read.
- **Parties.** The party list, with the duties of each party.
- **Case law.** Test names, written as claims a party could dispute.

**`CONTRACT.md` is generated, never hand-edited.** It has Articles per
party (Article I — Customer, Article II — System, ...) and Articles per
procedure (e.g. "Article IV — Escalation Procedure"). No generator tool
exists yet. Render it from what exists:

- Clause docstrings give the clause text.
- `pytest --collect-only -q` over the case law, grouped by clause, gives
  the docket.

Start the file with this line: "Generated from code; edit the code, not
this file." To change the contract, change the code and generate the file
again. Never edit `CONTRACT.md` and the code in parallel. Two contracts is
how disputes start.

**Prose given as input.** A business person can give you a prose contract.
Translate it into code: parties, clauses, docstrings, case law. Then
regenerate the prose from the code. Do not keep the original prose beside
the code as a second source.

If asked only for code, still cite article and clause in each docstring.
If asked for "the contract", render `CONTRACT.md` from the code. See
[EXAMPLE.md](EXAMPLE.md) for a generated `CONTRACT.md` excerpt with its
code.

## The clauses

1. **Parties come first.** Before any type or function, list every party
   named or implied in the brief, and for each one its duties and what it
   may rely on from the others. Parties go beyond the obvious humans
   (customer, business, next dev, on-call): internal system actors are
   parties too. Examples: the database (guarantees uniqueness, never holds
   an order without a customer), the payment gateway (confirms or declines
   within N seconds), the job queue (delivers at-least-once, so consumers
   must be idempotent), the cache (may be stale up to its TTL), the
   scheduler (runs the reminder sweep daily), an LLM/agent (returns valid
   JSON or is retried), the audit log (records every refund). If it gates,
   reminds, generates, enforces or guarantees something, that's a duty,
   not infrastructure. Each party must get at least one clause that binds
   *it*, not just clauses that consume its output.

   Definitions (dataclasses, enums) serve the clauses: declare a type when
   a clause needs to name a party, an amount or a deadline, not as an
   opening ceremony.
2. **Every business rule has a name.** A rule that exists only as an inline
   `if` is an unwritten verbal agreement — unenforceable and disputed later.
   Rules come in two shapes — don't collapse one into the other:
   - **Decision clauses**: `facts in → decision out` (e.g. approve/deny,
     price, route).
   - **Obligation clauses**: `party, action, deadline/trigger → performed`
     (e.g. "the system must deliver a reminder within the configured
     window"). Failing to perform is a breach of *this* clause, not a
     missing feature. A domain with recurring duties, SLAs, or cadences
     needs obligation clauses in addition to decision clauses.
3. **The operative clause reads top-to-bottom.** The main function of an
   interaction has minimal — ideally zero — cyclomatic complexity. It barely
   does anything itself: it calls named functions that abstract the
   contract's internals. Anyone can read it aloud in a meeting.
4. **Terms are pure; execution is separate.** Deciding *what the contract
   says* is a pure function of facts in, decision out. *Performing* the
   contract (charging cards, writing rows, sending mail) happens at the
   edges, after the decision, and never re-interprets the terms.
5. **Tests are case law.** Each pure unit test is a scenario a party could
   dispute, named as a claim, settled by the top-level clause — no mocks, no
   setup rituals, because the terms are pure.
6. **The principle applies recursively — without abuse.** Internals follow
   the same discipline one level down, but splitting stops when a function's
   body is already plainer than another name would be. A contract drowning
   in cross-references is as bad as one long run-on clause.
7. **Changes are amendments.** A behavior change must be legible as an
   amendment: the diff shows which clause changed and which case law (tests)
   now rules differently.

For a worked example applying these clauses to a refund policy — decision
clauses only, definitions, operative clause, internals, case-law tests, and
the execution boundary — see [EXAMPLE.md](EXAMPLE.md). For a worked example
with multiple parties including a non-human obligated party and
obligation-shaped clauses, see the second example in the same file.

## Before presenting a draft

- **Per-party dispute test.** Run "could each party point to the clause
  that binds them?" once *per party*, including system/internal parties —
  not just once for the contract as a whole. A party with zero
  clauses-that-bind-it (only clauses that consume its output) has failed
  this test.
- **Length sanity check, per party.** If the brief gives a party N duties,
  that party should have roughly N clauses. A party that's suspiciously
  thin means clauses were collapsed or omitted — go back and find what got
  dropped, don't assume the domain was simple.

## The dispute test

Apply this when drafting new decision logic, or when judging whether
existing code already honors the contract:

- **Could each party point to the clause that binds them?** If a
  stakeholder asks "when do we charge the restocking fee?", is the answer
  one named function — or an archaeology dig through branches?
- **Could a judge rule from the document alone?** If deciding what the code
  should do requires running it against production state, terms and
  execution are entangled — split them.
- **Would an amendment be legible?** If waiving the restocking fee for
  damaged goods touches ten files, the contract was drafted badly.
- **Is a clause hiding?** An inline condition nobody can name is a term
  nobody agreed to — extract and name it.

## The counter-test

So clause 6 is not abused: *does this function exist to name a rule, or
only to make a metric happy?* A helper no party would ever cite in a
dispute is not a clause — inline it.

Code that passes both tests can be reviewed clause by clause, tested claim
by claim, and amended without litigation.

## The full pattern

This skill is the working summary. The complete text ships alongside it in
`pattern/`:

- `pattern/pattern.md` — the pattern: principles, schedules, articles, case law.
- `pattern/papers/schedules.html` — companion paper: schedules and the internals, worked through.
- `pattern/papers/vs-gherkin.html` — companion paper: why case law replaces a Gherkin layer.

Read the pattern (its case-law convention and worked disputes) when a clause
is contested and the summary above does not settle it.
