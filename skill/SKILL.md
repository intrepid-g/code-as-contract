---
name: code-as-contract
description: Draft or review business-logic code as a legal contract between its parties (people and internal system actors like the database, queue, cache, scheduler or an LLM), not instructions to a machine. Use when writing a new domain/business-rule function, untangling a conditional-heavy function that decides something (pricing, eligibility, refunds, access, payouts), reviewing code for whether a rule can be named and cited, or separating decision logic from side effects (DB writes, API calls, emails).
---

# Code as a Contract

Code is a **contract** between its parties — the customer, the business, the
next developer, the on-call engineer at 3am — that a machine happens to
execute. Draft it the way a careful lawyer drafts a contract: parties
first, then clauses stating what binds each of them, then precedents (in legal
terms: case law) that settle disputes.

## One source: modules and precedents

The code is the only source. There is no `CONTRACT.md` and no prose copy.
No rule text lives in a docstring or a comment that a test cannot check.
Everything that can be enforced is enforced by a test.

- **A party's chapter is a module:** `contract/<party>.py`. A procedure
  has one too: `contract/refund_procedure.py`. Each public function is a
  clause. A private helper (`_name`) is not.
- **Rule values are named constants** in the module that owns them
  (`RETURN_WINDOW_DAYS = 30`).
- **Claims are test names.** A claim a docstring would make becomes a
  precedent, in `precedents/test_<party>.py`.
- **The spec is the test listing:** `pytest --collect-only -q`, grouped by
  party module.
- **Structure is enforced by tests too.** Every party module has at least
  one clause. Every public clause is called by some precedent. A stdlib
  reference implementation is in [EXAMPLE.md](EXAMPLE.md).

**Prose given as input.** A business person can give you a prose contract.
Translate it into modules, constants and precedents. Do not keep the prose
beside the code as a second source.

If asked for "the contract", show the module list and the test listing.

A short, agent-ready version of this skill is in
[`code-as-contract-lean.md`](../code-as-contract-lean.md).

## The rules

1. **There are more parties than you first think.** Before any type or
   function, list every party with its duties (the promises it makes) and
   what it may rely on from the others. Explicit parties are the actors
   everyone names (user, admin, business, next dev, on-call). Implicit
   parties are the parts of the system: the frontend, the database
   (guarantees uniqueness), the payment gateway (confirms or declines
   within N seconds), the job queue (delivers at-least-once, so consumers
   must be idempotent), the cache (never more than its TTL stale), the
   scheduler (runs the reminder sweep daily), an LLM/agent (returns valid
   JSON or is retried), the audit log (records every refund), each
   subsystem. If it gates, reminds, generates, enforces or guarantees
   something, that's a duty, not infrastructure. The duty list is scratch
   work: each duty becomes a named constant, a clause and a precedent, and
   then the list is dropped. Each party must get at least one clause that binds
*it*, not just clauses that consume its output.

   Definitions (dataclasses, enums) serve the clauses: declare a type when
   a clause needs to name a party, an amount or a deadline, not as an
   opening ceremony.
2. **Every business rule has a name.** A rule that exists only as an inline
   `if` is an unwritten verbal agreement — unenforceable and disputed later.
   Rule values are named constants (`RETURN_WINDOW_DAYS = 30`).
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
   edges, after the decision. The performer may dispatch on a field of the
   decision (`if decision.approved: ...`). It never re-derives or
   re-interprets a rule.
5. **Tests are precedents.** Each pure unit test is a scenario a party could
   dispute, named as a claim, settled by a public clause — no mocks, no
   setup rituals, because the terms are pure. One file per party module:
   `precedents/test_<party>.py`.
6. **The principle applies recursively — without abuse.** Internals follow
   the same discipline one level down, but splitting stops when a function's
   body is already plainer than another name would be. A contract drowning
   in cross-references is as bad as one long run-on clause.
7. **Changes are amendments.** A behavior change must be legible as an
   amendment: the diff shows which clause changed and which precedents (tests)
   now rule differently.

For a worked example applying these rules to a refund policy — party
modules, definitions, operative clause, precedents, structural precedents
and the execution boundary — see [EXAMPLE.md](EXAMPLE.md). For a worked
example with multiple parties including a non-human obligated party and
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

So rule 6 is not abused: *does this function exist to name a rule, or
only to make a metric happy?* A helper no party would ever cite in a
dispute is not a clause — inline it.

Code that passes both tests can be reviewed clause by clause, tested claim
by claim, and amended without litigation.

## The full pattern

This skill is the working summary. The complete text ships alongside it in
`pattern/`:

- `pattern/pattern.md` — the pattern: principles, schedules, Articles (architecture law), precedents.
- `pattern/papers/schedules.html` — companion paper: schedules and the internals, worked through.
- `pattern/papers/vs-gherkin.html` — companion paper: why precedents replace a Gherkin layer.

Read the pattern (its precedent convention and worked disputes) when a clause
is contested and the summary above does not settle it.
