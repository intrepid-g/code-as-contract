# Code as a Contract — a manifesto

*Version 0.2.0 — see [CHANGELOG](../CHANGELOG.md). Other versions: see the `manifesto-v*` tags (README).*

Code is not instructions to a machine that humans happen to read.
Code is a **contract between many parties** — the customer, the business,
the payment processor, the next developer, the on-call engineer at 3am —
that a machine happens to execute.

Read any well-drafted legal contract and you find the same structure good
code wants: the **parties** first, then **sections** stating each party's
obligations, responsibilities and abilities, the **business rules** and how
they are applied, the **succession of events** — what must happen, in
what order, and who has to do it — and the **case law** that settles
disputes. Definitions exist to serve those clauses, not to open the document.

We hold these principles:

1. **Parties come first.** Before any type or function, list every party —
   people, and internal system actors too (the database, queue, cache,
   scheduler, an LLM) — with its duties and what it may rely on from the
   others. Each party is bound by at least one clause. Definitions (types)
   serve the clauses: declare one when a clause needs to name a party, an
   amount or a deadline, never as an opening ceremony.
2. **Every business rule has a name.** A rule that exists only as an inline
   `if` is an unwritten verbal agreement — unenforceable and disputed later.
3. **The operative clause reads top-to-bottom.** The main function of an
   interaction has minimal — ideally zero — cyclomatic complexity. It barely
   does anything itself: it calls named functions that abstract the
   internals of the contract. Anyone can read it aloud in a meeting.
4. **Terms are pure; execution is separate.** Deciding *what the contract
   says* is a pure function of facts. *Performing* the contract (charging
   cards, writing rows, sending mail) happens at the edges, after the
   decision. You can judge the terms without a courtroom.
5. **Tests are case law.** Each pure unit test is a scenario a party could
   dispute, named as a claim, settled by the contract at the highest level.
   When prose and case law disagree, the case law wins.
6. **The principle applies recursively — without abuse.** Implementations of
   the named functions follow the same discipline, but splitting stops when
   a function's body is plainer than another name would be. A contract
   drowning in cross-references is as bad as one long run-on clause.
7. **Changes are amendments.** A behavior change must be legible as an
   amendment: the diff shows which clause changed and which case law
   (tests) now rules differently.
8. **Execution follows the succession of events.** The boundary of every
   interaction is a **performer** with near-zero branching: it *gathers*
   the facts into a frozen **evidence file** (the only place the outside
   world is translated into the Definitions), *consults* the terms, and
   *performs* the decision — citing only the decision's own fields, never
   re-interpreting the terms. If performing needs more information, the
   decision's Definition is defective; fix it there.
9. **Operational demands are schedules.** Caching, queuing, retries,
   timeouts, forms and screens — obligations about *how* performance
   happens are not scattered through the code as incantations. Each is
   declared as frozen data (a **schedule**, in the legal sense: an annex
   the clauses cite), and executed by a **generic performer that holds no
   rules of its own**. Any judgment a schedule requires — is this cached
   fact still fresh, should this delivery retry, is this field valid — is
   a pure function of the schedule and the facts, and gets case law like
   any other term.
10. **The docket is generated, never hand-written.** The human-readable
    specification is produced *from* the case law (test names, grouped by
    clause), so it can never drift from behavior. Prose spec layers that
    do not execute are a second contract over the same subject matter —
    and two contracts is how disputes start.

---

## Annex — the docket of schedules

The recurring schedules of principle 9. The membership test: *can the
obligation be stated as frozen data, and its judgment as a pure function?*

- **C · Caching** — how old gathered evidence may be and still be
  admissible: key, TTL, grace.
- **D · Deferred performance** — what is owed later, and how surely:
  queue, attempts owed, backoff, escalation deadline.
- **F · Forms & screens** — the offer a party fills in: fields, named
  validation rules, actions, explicit payload mapping.
- **P · Permissions** — which party may invoke which clause; a check
  buried in a view is a hidden clause about who is party to the contract.
- **R · Rate limits** — window, quota, scope.
- **G · Feature gates** — audience, conditions, and a mandatory sunset
  date; a flag without one is a temporary amendment made permanent by
  neglect.
- **I · Idempotency** — replay key, window, and whether a replay is
  served the prior receipt or rejected.
- **T · Retention & privacy** — what data is kept, for how long, and its
  disposition after: keep, anonymize, purge.
- **S · Recurring performance** — cadence, grace, and what a missed run
  owes.
- **O · Observability** — which events must be recorded, and the
  thresholds whose breach raises an alert.
- **L · Copy & locale** — every user-facing sentence a keyed, per-locale
  term; a missing key fails the build.
- **M · Records** — how the Definitions persist. The in-memory
  Definitions *are* the contract; their stored form (table, columns,
  indexes) is a schedule, and every migration is an amendment paired
  with the Definition diff that motivated it.

Above the schedules sit the **Articles** — architecture as governing
law: layering and who may import whom, deployable boundaries and what
crosses them, one owner per fact of state. Declared as data, checked by
pure rulings over the import graph, amended only through a recorded
rationale (the ADR, kept in the repo as the Article's amendment record).

---

## The contract, in Python

**Definitions.** The parties and terms the clauses need to name:

```python
from dataclasses import dataclass
from datetime import date, timedelta
from enum import Enum


class Party(Enum):
    CUSTOMER = "customer"
    MERCHANT = "merchant"
    PROCESSOR = "payment_processor"


class DenialReason(Enum):
    WINDOW_CLOSED = "refund window closed"
    ORDER_NOT_SETTLED = "order not yet settled"


@dataclass(frozen=True)
class Order:
    total_cents: int
    settled: bool
    delivered_on: date | None
    damaged_on_arrival: bool


@dataclass(frozen=True)
class RefundRequest:
    requested_on: date


@dataclass(frozen=True)
class RefundPolicy:
    window: timedelta = timedelta(days=14)
    restocking_fee_percent: int = 10


@dataclass(frozen=True)
class RefundDecision:
    approved: bool
    amount_cents: int = 0
    paid_by: Party | None = None
    reason: DenialReason | None = None
```

**The operative clause.** One interaction, one main function. Near-zero
cyclomatic complexity; every line is an obligation with a readable name.
It states *who owes what, when* — and nothing about *how*:

```python
def settle_refund_request(
    request: RefundRequest, order: Order, policy: RefundPolicy
) -> RefundDecision:
    """Clause 4 — Refunds. Pure: facts in, decision out."""
    if not order_is_refundable(order):
        return RefundDecision(approved=False, reason=DenialReason.ORDER_NOT_SETTLED)
    if not refund_window_is_open(request, order, policy):
        return RefundDecision(approved=False, reason=DenialReason.WINDOW_CLOSED)
    return RefundDecision(
        approved=True,
        amount_cents=refundable_amount(order, policy),
        paid_by=liable_party(order),
    )
```

**The internals.** Same principle, one level down — but not abused. These
bodies are already plainer than further names would be, so the splitting
stops here:

```python
def order_is_refundable(order: Order) -> bool:
    """Clause 4.1 — only settled, delivered orders may be refunded."""
    return order.settled and order.delivered_on is not None


def refund_window_is_open(
    request: RefundRequest, order: Order, policy: RefundPolicy
) -> bool:
    """Clause 4.2 — the window runs from delivery, not purchase."""
    return request.requested_on <= order.delivered_on + policy.window


def refundable_amount(order: Order, policy: RefundPolicy) -> int:
    """Clause 4.3 — goods damaged on arrival refund in full;
    otherwise the merchant withholds the restocking fee."""
    if order.damaged_on_arrival:
        return order.total_cents
    fee = order.total_cents * policy.restocking_fee_percent // 100
    return order.total_cents - fee


def liable_party(order: Order) -> Party:
    """Clause 4.4 — the merchant bears damage; the processor bears the rest."""
    return Party.MERCHANT if order.damaged_on_arrival else Party.PROCESSOR
```

**Case law.** Pure tests against the top-level clause. Each name is a claim
a party could bring; no mocks, no setup rituals — because the terms are
pure. These tests pin the *contract*, so the internals can be redrafted
freely as long as the rulings stand:

```python
def test_customer_may_return_damaged_goods_for_a_full_refund():
    order = Order(total_cents=10_000, settled=True,
                  delivered_on=date(2026, 7, 1), damaged_on_arrival=True)
    decision = settle_refund_request(
        RefundRequest(requested_on=date(2026, 7, 5)), order, RefundPolicy()
    )
    assert decision.approved
    assert decision.amount_cents == 10_000
    assert decision.paid_by is Party.MERCHANT


def test_undamaged_returns_bear_the_restocking_fee():
    order = Order(total_cents=10_000, settled=True,
                  delivered_on=date(2026, 7, 1), damaged_on_arrival=False)
    decision = settle_refund_request(
        RefundRequest(requested_on=date(2026, 7, 5)), order, RefundPolicy()
    )
    assert decision.approved and decision.amount_cents == 9_000


def test_the_window_runs_from_delivery_and_then_closes():
    order = Order(total_cents=10_000, settled=True,
                  delivered_on=date(2026, 7, 1), damaged_on_arrival=False)
    late = RefundRequest(requested_on=date(2026, 7, 16))
    decision = settle_refund_request(late, order, RefundPolicy())
    assert not decision.approved
    assert decision.reason is DenialReason.WINDOW_CLOSED
```

**Execution of the contract.** Side effects live at the boundary, after the
decision. The performer gathers facts (impure), consults the terms (pure),
then performs. It never re-interprets the terms:

```python
def handle_refund_endpoint(order_id: str, request: RefundRequest) -> None:
    order = orders_repo.load(order_id)                    # gather facts
    decision = settle_refund_request(request, order, current_policy())  # consult terms
    if decision.approved:                                  # perform
        payments.credit(order_id, decision.amount_cents, from_=decision.paid_by)
    notifications.send_refund_outcome(order_id, decision)
```

---

## The dispute test

When you cannot decide whether code honors this manifesto, ask the
contract questions:

- *Could each party point to the clause that binds them?* If a stakeholder
  asks "when do we charge the restocking fee?", is the answer one named
  function — or an archaeology dig through branches?
- *Could a judge rule from the document alone?* If deciding what the code
  should do requires running it against production state, terms and
  execution are entangled.
- *Would an amendment be legible?* If waiving the restocking fee for
  damaged goods touches ten files, the contract was drafted badly.
- *Is a clause hiding?* An inline condition nobody can name is a term
  nobody agreed to.

And the counter-test, so the principle is not abused: *does this function
exist to name a rule, or only to make a metric happy?* A helper that no
party would ever cite in a dispute is not a clause — inline it.

Code that passes these tests can be reviewed clause by clause, tested claim
by claim, and amended without litigation. That is the whole idea: **draft
your code the way a careful lawyer drafts a contract — so that every party,
human or machine, can rely on it.**

---

# Part II — The convention: Case-Law Testing (CaC/CL-1)

Principle 5 hardened into enforceable convention. This is also the answer
to Gherkin: the specification layer BDD tools externalize into prose is
internalized here — the operative clause is the readable spec, the case
law is the executable scenarios, and the docket is the generated
stakeholder view. Gherkin needs three artifacts per rule (.feature prose
that cannot execute, regex step glue, real code) and the prose can
silently drift; case law needs one artifact that fails the build if it
lies.

Seven rules, each mechanically checkable:

1. **One file per clause.** `case_law/test_clause_4_refunds.py` pins
   Clause 4 and nothing else. The docket mirrors the contract's table of
   contents.
2. **The test name is a claim a party could bring**, written as a full
   sentence in snake_case:
   `test_customer_may_return_damaged_goods_for_a_full_refund`. If it
   cannot be read aloud in a meeting, it fails review. (Lintable: length
   ≥ 6 words, contains a party noun.)
3. **Facts / Claim / Ruling structure**, in that order, comment-marked.
   Given/When/Then without the DSL: facts are constructed from the
   Definitions, the claim is one call to the operative clause, the ruling
   is plain asserts.
4. **Sue at the highest court.** Case law calls only top-level clauses,
   never the internals. Internals stay redraftable as long as rulings
   stand. (Lintable: an import allowlist per case-law file.)
5. **No mocks in case law.** A mock in a case-law test is proof the terms
   are not pure — fix the contract, not the test. Mocks are permitted
   only in thin execution-layer tests at the boundary.
6. **Precedent is append-mostly.** Amending a clause may change a ruling,
   and the diff must show both together: the clause edit and the case-law
   edit in one commit. Deleting a case without amending a clause is
   overruling without authority — blocked in review.
7. **The docket is the stakeholder document.** Generate the
   human-readable spec *from* the case law
   (`pytest --collect-only -q case_law/`), never the other way around.
   Gherkin's one genuine benefit, recovered at zero drift.

A case-law test, in full:

```python
# case_law/test_clause_4_refunds.py
def test_customer_may_return_damaged_goods_for_a_full_refund():
    # Facts — the Definitions, cited by type, not by regex
    order = Order(total_cents=10_000, settled=True,
                  delivered_on=date(2026, 7, 1), damaged_on_arrival=True)

    # Claim — settled by the operative clause, nothing lower
    decision = settle_refund_request(
        RefundRequest(requested_on=date(2026, 7, 5)), order, RefundPolicy())

    # Ruling
    assert decision.approved
    assert decision.amount_cents == 10_000
    assert decision.paid_by is Party.MERCHANT
```

Two more dispute-test questions, for case law:

- *Does every claim have standing?* A test no party would ever cite is
  not precedent — it is coverage theater. Delete it or promote it.
- *Could the docket brief a stakeholder?* If the printed test names, read
  as sentences, would not survive a product meeting, the naming
  discipline has lapsed.

---

# Part III — The full cycle (principle 8, worked)

The endpoint is the **performer**: gather → consult → perform, near-zero
branching. It contains no business rule — not even `if decision.approved`;
whether an approval pays out is a term of performance and lives in step 3.

```python
# app/refunds/endpoint.py — the performer. Impure, and proud of it.
@app.post("/orders/{order_id}/refund-requests")
def handle_refund_request(order_id: OrderId, body: RefundRequestBody) -> RefundOutcomeBody:
    facts = gather_refund_facts(order_id, body)             # step 1 — impure reads
    decision = settle_refund_request(                       # step 2 — pure terms
        facts.request, facts.order, facts.policy)
    receipt = perform_refund_decision(order_id, decision)   # step 3 — impure writes
    return RefundOutcomeBody.from_decision(decision, receipt)
```

Fact-gathering returns a named, frozen **evidence file**. Translation
from the outside world (HTTP body, DB row) into the contract's types
happens here and only here — the terms never see a raw dict or ORM object:

```python
# app/refunds/facts.py — evidence gathering. Impure reads, no rulings.
@dataclass(frozen=True)
class RefundFacts:
    """The evidence file: every Definition Clause 4 will cite."""
    request: RefundRequest
    order: Order
    policy: RefundPolicy


def gather_refund_facts(order_id: OrderId, body: RefundRequestBody) -> RefundFacts:
    return RefundFacts(
        request=body.as_refund_request(),      # HTTP → Definitions
        order=orders_repo.load(order_id),      # DB row → Order
        policy=policies_repo.current(),        # config → RefundPolicy
    )
```

Performance mirrors the decision it executes — it cites only the
decision's own fields and never reaches back into `Order` to re-derive
what the terms already settled. If performance needs more information,
the decision's Definition is defective:

```python
# app/refunds/perform.py — performance of the contract.
def perform_refund_decision(order_id: OrderId, decision: RefundDecision) -> Receipt:
    """Execute Clause 4's decision at the boundary."""
    if decision.approved:
        receipt = payments.credit(order_id, decision.amount_cents,
                                  from_=decision.paid_by)
    else:
        receipt = Receipt.nothing_owed(reason=decision.reason)
    notifications.send_refund_outcome(order_id, decision)
    audit_log.record(order_id, decision, receipt)
    return receipt
```

Testing policy per layer: the clause gets the full docket; gathering and
performing get thin execution-layer tests where mocks are permitted (rule
5); the endpoint needs at most one wiring test — with three lines and no
branches there is almost nothing left to get wrong.

---

# Part IV — Schedules, worked (principle 9)

Every internal concern decomposes into the same three parts:

1. **Terms** — a frozen dataclass (or `as const` object) declaring the
   obligation, living next to the Definitions, cited by name.
2. **Rulings** — every judgment the terms require is a pure function of
   the terms and the facts. This is where the case law attaches.
3. **A generic performer** — one piece of machinery per concern, written
   once, holding zero business decisions.

The test for whether you have done it right: *could you change the
obligation by editing only the schedule?* Shorten a TTL, add a retry,
make a field optional — each must be a one-line amendment to declared
data, visible in the diff as exactly that.

## Schedule C — Caching (evidence freshness)

Caching is a rule about how old evidence may be and still be admissible.

```python
@dataclass(frozen=True)
class CacheTerms:
    """How old a gathered fact may be and still be admissible."""
    key: str
    ttl: timedelta
    grace: timedelta = timedelta(0)   # stale-while-revalidate allowance

EXCHANGE_RATE = CacheTerms(key="fx:{base}:{quote}",
                           ttl=timedelta(minutes=15), grace=timedelta(minutes=2))


class Admissibility(Enum):
    FRESH = "fresh"; STALE_IN_GRACE = "grace"; EXPIRED = "expired"

def admissibility(fetched_at: datetime, now: datetime, terms: CacheTerms) -> Admissibility:
    age = now - fetched_at
    if age <= terms.ttl:               return Admissibility.FRESH
    if age <= terms.ttl + terms.grace: return Admissibility.STALE_IN_GRACE
    return Admissibility.EXPIRED


def test_a_rate_older_than_its_ttl_but_in_grace_is_served_while_refetching():
    fetched = datetime(2026, 8, 6, 12, 0)
    now = datetime(2026, 8, 6, 12, 16)   # 16 min: past TTL, inside grace
    assert admissibility(fetched, now, EXCHANGE_RATE) is Admissibility.STALE_IN_GRACE
```

The generic performer (`@cached(EXCHANGE_RATE)` wrapping a fact-gatherer)
reads the terms and consults the ruling; it holds no TTLs, no keys, no
policy. Swapping Redis for memcache touches machinery and no schedule.

## Schedule D — Deferred performance (async / queues)

A queued task is performance that need not be immediate but must be
certain. Grep `DeliveryTerms` and you hold the complete inventory of what
the system owes later.

```python
@dataclass(frozen=True)
class DeliveryTerms:
    """Performance need not be immediate, but must be certain."""
    queue: str
    attempts_owed: int
    backoff_base: timedelta
    escalate_after: timedelta       # breach: page a human

REFUND_OUTCOME_NOTICE = DeliveryTerms(queue="notifications", attempts_owed=5,
                                      backoff_base=timedelta(seconds=30),
                                      escalate_after=timedelta(hours=1))


def after_failed_attempt(attempt_no: int, first_tried: datetime,
                         now: datetime, terms: DeliveryTerms) -> Retry | Escalate | GiveUp:
    if now - first_tried >= terms.escalate_after:
        return Escalate(reason="delivery deadline breached")
    if attempt_no >= terms.attempts_owed:
        return Escalate(reason="attempts exhausted")
    return Retry(at=now + terms.backoff_base * 2 ** (attempt_no - 1))


def test_a_breached_deadline_escalates_even_with_attempts_remaining():
    first = datetime(2026, 8, 6, 12, 0)
    now = datetime(2026, 8, 6, 13, 1)     # 61 min, attempt 2 of 5
    assert isinstance(after_failed_attempt(2, first, now, REFUND_OUTCOME_NOTICE), Escalate)
```

The performer defers with one call, citing the schedule by name:
`defer(notifications.send_refund_outcome, (order_id, decision),
terms=REFUND_OUTCOME_NOTICE)`. The dispatcher consults the ruling after
every failure; it decides nothing itself.

## Schedule F — Forms & screens (frontend)

A form is **an offer**: what facts a party must tender, in what shape,
and what happens on tender. Fields, named validation rules, buttons,
endpoint and explicit payload mapping — one typed declaration. The React
component that renders it is a generic performer that can draw any form
and knows none.

```ts
// schedules/refundRequestForm.ts — Schedule F-1. The offer, declared.
export const refundRequestForm = {
  clause: "4",
  fields: [
    { name: "requestedOn", label: "Date of request", kind: "date",
      required: true, rules: [requestedOnMayNotBeInTheFuture] },
    { name: "reason", label: "Why are you returning this?", kind: "select",
      required: true, options: ["damaged_on_arrival", "changed_mind"], rules: [] },
  ],
  actions: [
    { label: "Request refund", kind: "submit",
      call: { method: "POST", endpoint: "/orders/{orderId}/refund-requests",
              payload: (v: Values) => ({
                requested_on: v.requestedOn,
                damaged_on_arrival: v.reason === "damaged_on_arrival" }) } },
    { label: "Cancel", kind: "dismiss" },
  ],
} satisfies FormTerms<Values>;

// Named, pure validation rule — case law runs in vitest with no DOM:
export function requestedOnMayNotBeInTheFuture(value: string, today: string): Grievance | null {
  return value > today
    ? { field: "requestedOn", says: "The request date cannot be in the future." }
    : null;
}

test("the form tenders exactly what Clause 4's endpoint is owed", () => {
  const body = refundRequestForm.actions[0].call.payload({
    requestedOn: "2026-08-05", reason: "damaged_on_arrival" });
  expect(body).toEqual({ requested_on: "2026-08-05", damaged_on_arrival: true });
});
```

`<ContractForm terms={refundRequestForm} />` walks the terms, runs the
rules, disables submit while grievances stand, performs the declared
call. Adding a field is a diff in Schedule F-1 only.

## Schedule P — Permissions (standing)

Which roles are party to an interaction at all. An authorization check
buried in a view is a hidden clause about who is party to the contract.

```python
@dataclass(frozen=True)
class InvocationTerms:
    clause: str
    parties: frozenset[Role]

REQUEST_REFUND = InvocationTerms(clause="4",
                                 parties=frozenset({Role.CUSTOMER, Role.SUPPORT}))

def may_invoke(actor: Actor, terms: InvocationTerms) -> Allowed | Denied:
    if actor.role in terms.parties:
        return Allowed()
    return Denied(reason=f"{actor.role.value} is not party to clause {terms.clause}")

def test_a_courier_has_no_standing_to_request_a_refund():
    assert isinstance(may_invoke(Actor(role=Role.COURIER), REQUEST_REFUND), Denied)
```

## Schedule R — Rate limits

The quota lives with the clause it protects, not in infrastructure
config where no stakeholder will find it.

```python
@dataclass(frozen=True)
class QuotaTerms:
    scope: str
    window: timedelta
    invocations_owed: int

REFUND_REQUESTS = QuotaTerms(scope="per_customer",
                             window=timedelta(days=1), invocations_owed=3)

def over_quota(history: list[datetime], now: datetime, terms: QuotaTerms) -> bool:
    return sum(1 for t in history if now - t < terms.window) >= terms.invocations_owed

def test_the_fourth_refund_request_in_a_day_is_refused():
    noon = datetime(2026, 8, 6, 12)
    assert over_quota([noon - timedelta(hours=h) for h in (1, 2, 3)], noon, REFUND_REQUESTS)
```

## Schedule G — Feature gates

Every flag carries its own funeral: the sunset date is a required term,
and a lint rule fails the build on any gate past its date — flags cannot
rot into permanent temporary amendments.

```python
@dataclass(frozen=True)
class GateTerms:
    name: str
    audience: str          # cohort that may pass while the gate stands
    sunset: date           # after this, closed — and lint flags it

INSTANT_REFUNDS = GateTerms("instant_refunds",
                            audience="beta_customers", sunset=date(2026, 10, 1))

def gate_is_open(actor: Actor, today: date, terms: GateTerms) -> bool:
    return today <= terms.sunset and terms.audience in actor.cohorts

def test_a_gate_past_its_sunset_is_closed_even_for_its_audience():
    beta = Actor(role=Role.CUSTOMER, cohorts=frozenset({"beta_customers"}))
    assert not gate_is_open(beta, date(2026, 10, 2), INSTANT_REFUNDS)
```

## Schedule I — Idempotency

Within the window, the same tender is the same tender, and it is owed the
original receipt — not a second performance.

```python
@dataclass(frozen=True)
class ReplayTerms:
    key: str
    window: timedelta

REFUND_SUBMISSION = ReplayTerms(key="refund:{order_id}", window=timedelta(hours=24))

def on_replay(prior: Receipt | None, age: timedelta,
              terms: ReplayTerms) -> ServePrior | Proceed:
    if prior is not None and age <= terms.window:
        return ServePrior(prior)
    return Proceed()

def test_resubmitting_within_the_window_returns_the_original_receipt():
    prior = Receipt(id="r-1")
    assert on_replay(prior, timedelta(minutes=5), REFUND_SUBMISSION) == ServePrior(prior)
```

## Schedule T — Retention & privacy

Declared when the data is first collected, not negotiated during the
audit. The sweeper job (Schedule S) consults this ruling; it decides
nothing itself.

```python
class Disposition(Enum):
    KEEP = "keep"; ANONYMIZE = "anonymize"; PURGE = "purge"

@dataclass(frozen=True)
class RetentionTerms:
    record: str
    keep_for: timedelta
    then: Disposition

REFUND_DECISIONS = RetentionTerms("refund_decisions",
                                  keep_for=timedelta(days=7 * 365),
                                  then=Disposition.ANONYMIZE)

def disposition(age: timedelta, terms: RetentionTerms) -> Disposition:
    return terms.then if age > terms.keep_for else Disposition.KEEP

def test_a_decision_older_than_seven_years_is_anonymized_not_purged():
    assert disposition(timedelta(days=7 * 365 + 1), REFUND_DECISIONS) is Disposition.ANONYMIZE
```

## Schedule S — Recurring performance (cron)

Cron expressions say when; they never say what lateness means. The
schedule declares the grace and the obligation a miss creates.

```python
@dataclass(frozen=True)
class CadenceTerms:
    task: str
    every: timedelta
    grace: timedelta

RECONCILE_LEDGER = CadenceTerms("reconcile_ledger",
                                every=timedelta(days=1), grace=timedelta(hours=2))

def standing(last_run: datetime, now: datetime,
             terms: CadenceTerms) -> Current | Due | Missed:
    since = now - last_run
    if since < terms.every:                return Current()
    if since < terms.every + terms.grace:  return Due()
    return Missed(overdue_by=since - terms.every)

def test_a_run_later_than_cadence_plus_grace_is_a_breach():
    last = datetime(2026, 8, 5, 3, 0)
    now = datetime(2026, 8, 6, 5, 1)     # 26h01m: past the 2h grace
    assert isinstance(standing(last, now, RECONCILE_LEDGER), Missed)
```

## Schedule O — Observability (the duty to notice)

Which measurements the program is obliged to keep, and the thresholds
whose breach must wake someone. The threshold stops living in a Grafana
panel nobody reviews.

```python
@dataclass(frozen=True)
class VigilanceTerms:
    measure: str
    threshold: float
    over: timedelta

REFUND_ESCALATIONS = VigilanceTerms(measure="refund_escalations",
                                    threshold=5, over=timedelta(hours=1))

def breach(count_in_window: int, terms: VigilanceTerms) -> Alert | None:
    if count_in_window > terms.threshold:
        return Alert(says=f"{terms.measure}: {count_in_window} in {terms.over}, "
                          f"threshold {terms.threshold}")
    return None

def test_six_escalations_in_an_hour_raises_an_alert():
    assert breach(6, REFUND_ESCALATIONS) is not None
```

## Schedule L — Copy & locale

User-facing prose is the part of the contract the customer actually
reads. The case law is exhaustive over the Definitions, so a new denial
reason without copy fails the build in every locale at once.

```python
COPY: dict[str, dict[str, str]] = {
    "refund.denied.window_closed": {
        "en": "The return window for this order has closed.",
        "es": "El plazo de devolución de este pedido ha finalizado.",
    },
    "refund.denied.order_not_settled": {
        "en": "This order has not settled yet — refunds open once it does.",
        "es": "Este pedido aún no se ha liquidado; podrás pedir el reembolso después.",
    },
}

def say(key: str, locale: str) -> str:
    return COPY[key][locale]          # a missing key raises — by design

def test_every_denial_reason_has_copy_in_every_locale():
    for reason in DenialReason:
        for locale in ("en", "es"):
            assert say(f"refund.denied.{reason.name.lower()}", locale)
```

## Schedule M — Records (data models)

The distinction that matters: the in-memory shapes (`Order`,
`RefundDecision`) are **not** a schedule — they are the **Definitions**,
the contract itself (principle 1). What *is* a schedule is how a
Definition **persists**: table, columns, indexes, and how the stored form
changes over time. Confuse the two and the ORM class becomes the
contract, coupling business terms to storage choices.

```python
@dataclass(frozen=True)
class RecordTerms:
    """Binds one Definition to one stored form. Storage words live here only."""
    definition: type
    table: str
    columns: dict[str, str]        # field → column
    indexes: tuple[str, ...]
    owner: str                     # must agree with Article III

ORDER_RECORD = RecordTerms(
    definition=Order, table="orders",
    columns={"total_cents": "total_cents", "settled": "is_settled",
             "delivered_on": "delivered_on", "damaged_on_arrival": "damaged_on_arrival"},
    indexes=("delivered_on",), owner="storefront.db")


def uncovered_fields(terms: RecordTerms) -> list[str]:
    """Every field of the Definition must map to a column."""
    return [f.name for f in fields(terms.definition) if f.name not in terms.columns]

def undeclared_drift(live: TableSchema, terms: RecordTerms) -> list[str]:
    """The database may hold nothing the schedule does not declare."""
    declared = set(terms.columns.values())
    return [col for col in live.columns if col not in declared]


def test_every_field_of_order_has_a_declared_column():
    assert uncovered_fields(ORDER_RECORD) == []

def test_the_live_orders_table_holds_nothing_undeclared():
    live = scan_schema("orders")          # gathered fact (impure, conftest)
    assert undeclared_drift(live, ORDER_RECORD) == []
```

**Migrations are three-part amendments.** A migration is never a
standalone SQL file: the diff must show the Definition amendment, the
record-terms amendment, and the migration that performs it — in one
commit, with the case law that motivated the change. CI rejects any one
without the other two.

The counter-test for models: a column whose Definition field no clause
ever cites is data collected without purpose — a term nobody agreed to.
Schedule T will ask awkward questions about it; better to strike it.

---

# Part V — Articles: architecture as governing law

Schedules govern one concern each. Architecture is the **governing-law
section** — terms that bind every clause at once: which layers exist and
who may import whom; what is synchronous and what deferred; where state
may live; what is one deployable. Under CaC these are **Articles**:
declared, enforced, amended only with a recorded rationale.

```python
# articles/governing_law.py — binds every clause in the program.
@dataclass(frozen=True)
class LayeringTerms:
    """Article I — who may cite whom. Lower layers never import upward."""
    order: tuple[str, ...]

ARTICLE_I = LayeringTerms(order=(
    "machinery",     # generic performers: cache, queue, renderer
    "schedules",     # declared operational terms
    "clauses",       # pure business terms + Definitions
    "facts",         # evidence gathering (impure reads)
    "performers",    # endpoints, jobs, handlers (impure writes)
))


@dataclass(frozen=True)
class BoundaryTerms:
    """Article II — what is one deployable, and what crosses between them."""
    deployable: str
    may_call: tuple[str, ...]        # other deployables, by contract only
    crossing: str                    # "http" | "queue" — never a shared DB

ARTICLE_II = (BoundaryTerms("storefront", may_call=("payments",), crossing="http"),
              BoundaryTerms("payments",   may_call=(),            crossing="queue"))


@dataclass(frozen=True)
class StateTerms:
    """Article III — where truth lives. One owner per fact; all else is cache."""
    fact: str
    owner: str

ARTICLE_III = (StateTerms("orders", owner="storefront.db"),
               StateTerms("ledger", owner="payments.db"))
```

Articles are enforced, not aspirational — an import graph is just data,
so the architecture check is ordinary case law run in CI (import-linter
and friends are mere machinery):

```python
def layering_violations(imports: ImportGraph, terms: LayeringTerms) -> list[Violation]:
    rank = {layer: i for i, layer in enumerate(terms.order)}
    return [Violation(edge) for edge in imports
            if rank[edge.importer_layer] < rank[edge.imported_layer]]


def test_no_clause_may_cite_a_performer():
    graph = scan_imports("src/")          # gathered fact (impure, in conftest)
    assert layering_violations(graph, ARTICLE_I) == []
```

**ADRs are amendment records** — in the repo, adjacent to the terms they
amend. The diff that changes an Article must carry its recital (why),
the operative change, and the case law it creates or overrules; CI
blocks an Article edit without one:

```
# articles/amendments/0007_payments_becomes_async.md
Amendment 7 — to Article II (boundaries)

Recital (why): synchronous capture blocked checkout for the p99 of
processor latency; the parties accept eventual receipt in exchange
for a bounded checkout time.

Operative change: storefront → payments crossing amended
"http" → "queue", under Schedule D terms CAPTURE_PAYMENT
(attempts_owed=5, escalate_after=15min).

Case law affected:
  - test_checkout_completes_without_awaiting_capture  (new)
  - test_capture_breach_pages_the_merchant            (new)
  - test_checkout_returns_the_captured_receipt        (overruled)
```

The hierarchy, top to bottom: **Articles** bind everything; **clauses**
bind one interaction; **schedules** bind one operational concern;
**machinery** binds nothing — it obeys. Anything structural you cannot
write as an Article with a pure violation check is a choice you have not
actually made yet.

---

# Part VI — Adoption order

1. Move existing pure tests into `case_law/`, one file per clause;
   rename to claim sentences.
2. Add the Facts / Claim / Ruling comments; delete any mock from a
   case-law file by purifying the term it was covering.
3. Ship the lint plugin for convention rules 1–5 and the CI diff check
   for rule 6.
4. Wire the docket command into CI output so every build prints the
   current case law — that artifact replaces any .feature file you would
   have written.
5. Extract schedules as you touch them: each scattered TTL, retry
   decorator, permission check or hand-built form becomes a declared
   term with a pure ruling. Declare the Articles last, once the layers
   are visible — then let CI enforce them.

The closing dispute test for the internals: an internal concern is
drafted correctly when the obligation is a schedule you could amend in
one line, the judgment is a pure ruling with case law, and the machinery
is a generic performer that would work unchanged for any other schedule
of its kind. If changing a TTL, a retry count, or a form field touches
machinery, the schedule has leaked; if the machinery makes a decision the
ruling should have made, a term is hiding. Same dispute test, new
territory.
