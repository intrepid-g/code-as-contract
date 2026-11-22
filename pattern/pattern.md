# Code as a Contract — a pattern

Code is not instructions to a machine that humans happen to read.
Code is a **contract between many parties** — the customer, the business,
the payment processor, the next developer, the on-call engineer at 3am —
that a machine happens to execute.

Read any well-drafted legal contract and you find the same structure good
code wants: the **parties** first, then **sections** stating each party's
obligations, responsibilities and abilities, the **business rules** and how
they are applied, the **succession of events** — what must happen, in
what order, and who has to do it — and the **precedents** (in legal
terms: case law) that settle disputes. Definitions exist to serve those
clauses, not to open the document.

We hold these principles:

1. **There are more parties than you first think.** Explicit parties are
   the actors everyone names: the user, the admin. Implicit parties are the
   parts of the system that make or rely on promises: the frontend, the
   cache, the database, the queue, each subsystem. List both kinds, each
   with its duties (the promises it makes, e.g. "the cache is never more
   than 60 seconds stale"), before any code. The list is scratch work: each
   duty becomes a named constant, a clause and a precedent, then the list
   is dropped. Each party is a module, `contract/<party>.py`, with at least
   one clause that binds it. Types serve the clauses: declare one when a
   clause needs to name a party, an amount or a deadline.
2. **Every business rule has a name.** A rule that exists only as an inline
   `if` is an unwritten verbal agreement — unenforceable and disputed later.
   Rule values have names too (`RETURN_WINDOW_DAYS = 14`). A docstring does
   not carry rule text: a claim a docstring would make is a precedent name.
3. **The operative clause reads top-to-bottom.** The main function of an
   interaction has minimal — ideally zero — cyclomatic complexity. It barely
   does anything itself: it calls named functions that abstract the
   internals of the contract. Anyone can read it aloud in a meeting.
4. **Terms are pure; execution is separate.** Deciding *what the contract
   says* is a pure function of facts. *Performing* the contract (charging
   cards, writing rows, sending mail) happens at the edges, after the
   decision. You can judge the terms without a courtroom.
5. **Tests are precedents.** Each pure unit test is a scenario a party could
   dispute, named as a claim, settled by the contract at the highest level.
   When prose and precedents disagree, the precedents win.
6. **The principle applies recursively — without abuse.** Implementations of
   the named functions follow the same discipline, but splitting stops when
   a function's body is plainer than another name would be. A contract
   drowning in cross-references is as bad as one long run-on clause.
7. **Changes are amendments.** A behavior change must be legible as an
   amendment: the diff shows which clause changed and which precedents
   (tests) now rule differently.
8. **Execution follows the succession of events.** The boundary of every
   interaction is a **performer** with near-zero branching: it *gathers*
   the facts into a frozen **evidence file** (the only place the outside
   world is translated into the Definitions), *consults* the terms, and
   *performs* the decision. It may hold one dispatch `if` on a field of the
   decision (`if decision.approved: payments.refund(...)`). It never
   re-derives or re-interprets a rule. If performing needs more
   information, the decision's Definition is defective; fix it there.
9. **Operational demands are schedules.** Caching, queuing, retries,
   timeouts, forms and screens — obligations about *how* performance
   happens are not scattered through the code as incantations. Each is
   declared as frozen data (a **schedule**, in the legal sense: an annex
   the clauses cite), and executed by a **generic performer that holds no
   rules of its own**. Any judgment a schedule requires — is this cached
   fact still fresh, should this delivery retry, is this field valid — is
   a pure function of the schedule and the facts, and gets precedents like
   any other term.
10. **The docket is the test listing, never hand-written prose.** There is
    no prose contract file. The code is the source: party modules, named
    constants, and the precedents. The human-readable spec is the
    precedent listing (`pytest --collect-only -q`), grouped by party
    module. It cannot drift from behavior, because it is the behavior.
    Prose that arrives first (for example from a business person) is
    translated into modules and precedents. It is not kept beside the
    code. Prose spec layers that do not execute are a second contract over
    the same subject matter — and two contracts is how disputes start.

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

**Layout.** A party's chapter is a module: `contract/<party>.py`. A
procedure's chapter is a module too: `contract/refund_procedure.py`. The
precedents mirror the modules, one file each. Rule values are named
constants in the module that owns them.

```
contract/
  definitions.py        the terms the clauses name
  customer.py           what binds the Customer
  merchant.py           what binds the Merchant
  processor.py          what binds the payment processor
  refund_procedure.py   the operative clause
precedents/
  test_customer.py  test_merchant.py  test_processor.py
  test_refund_procedure.py
  test_structure.py     structural precedents (worked in skill/EXAMPLE.md)
```

**Definitions.** The parties and terms the clauses need to name:

```python
# contract/definitions.py
from dataclasses import dataclass
from datetime import date
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
class RefundDecision:
    approved: bool
    amount_cents: int = 0
    paid_by: Party | None = None
    reason: DenialReason | None = None
```

**The party modules.** Each public function is a clause. Each rule value
has a name (`RETURN_WINDOW_DAYS`). No docstring repeats the rule: the
name, the constant and the precedents carry it.

```python
# contract/customer.py
from datetime import timedelta

from contract.definitions import Order, RefundRequest

RETURN_WINDOW_DAYS = 14


def refund_window_is_open(request: RefundRequest, order: Order) -> bool:
    return request.requested_on <= order.delivered_on + timedelta(days=RETURN_WINDOW_DAYS)
```

```python
# contract/processor.py
from contract.definitions import Order


def order_is_refundable(order: Order) -> bool:
    return order.settled and order.delivered_on is not None
```

```python
# contract/merchant.py
from contract.definitions import Order, Party

RESTOCKING_FEE_PERCENT = 10


def refundable_amount(order: Order) -> int:
    if order.damaged_on_arrival:
        return order.total_cents
    fee = order.total_cents * RESTOCKING_FEE_PERCENT // 100
    return order.total_cents - fee


def liable_party(order: Order) -> Party:
    return Party.MERCHANT if order.damaged_on_arrival else Party.PROCESSOR
```

**The operative clause.** One interaction, one main function. Near-zero
cyclomatic complexity; every line is an obligation with a readable name.
It states *who owes what, when* — and nothing about *how*:

```python
# contract/refund_procedure.py
from contract.customer import refund_window_is_open
from contract.definitions import DenialReason, Order, RefundDecision, RefundRequest
from contract.merchant import liable_party, refundable_amount
from contract.processor import order_is_refundable


def settle_refund_request(request: RefundRequest, order: Order) -> RefundDecision:
    if not order_is_refundable(order):
        return RefundDecision(approved=False, reason=DenialReason.ORDER_NOT_SETTLED)
    if not refund_window_is_open(request, order):
        return RefundDecision(approved=False, reason=DenialReason.WINDOW_CLOSED)
    return RefundDecision(
        approved=True,
        amount_cents=refundable_amount(order),
        paid_by=liable_party(order),
    )
```

**Precedents.** Pure tests against the public clauses. Each name is a
claim a party could bring; no mocks, no setup rituals — because the terms
are pure. The `_private` helpers stay free to change. The test listing
(`pytest --collect-only -q`) reads as the contract:

```python
# precedents/test_refund_procedure.py
from datetime import date

from contract.definitions import DenialReason, Order, Party, RefundRequest
from contract.refund_procedure import settle_refund_request


def test_customer_may_return_damaged_goods_for_a_full_refund():
    # Facts
    order = Order(total_cents=10_000, settled=True,
                  delivered_on=date(2026, 7, 1), damaged_on_arrival=True)
    # Claim
    decision = settle_refund_request(RefundRequest(requested_on=date(2026, 7, 5)), order)
    # Ruling
    assert decision.approved
    assert decision.amount_cents == 10_000
    assert decision.paid_by is Party.MERCHANT


def test_a_late_request_is_denied_because_the_window_closed():
    order = Order(total_cents=10_000, settled=True,
                  delivered_on=date(2026, 7, 1), damaged_on_arrival=False)
    decision = settle_refund_request(RefundRequest(requested_on=date(2026, 7, 16)), order)
    assert not decision.approved
    assert decision.reason is DenialReason.WINDOW_CLOSED
```

```python
# precedents/test_merchant.py
from datetime import date

from contract.definitions import Order, Party
from contract.merchant import liable_party, refundable_amount


def an_order(damaged: bool) -> Order:
    return Order(total_cents=10_000, settled=True,
                 delivered_on=date(2026, 7, 1), damaged_on_arrival=damaged)


def test_merchant_withholds_the_restocking_fee_on_an_undamaged_return():
    assert refundable_amount(an_order(damaged=False)) == 9_000


def test_merchant_refunds_damaged_goods_in_full():
    assert refundable_amount(an_order(damaged=True)) == 10_000


def test_merchant_bears_damage_and_the_processor_bears_the_rest():
    assert liable_party(an_order(damaged=True)) is Party.MERCHANT
    assert liable_party(an_order(damaged=False)) is Party.PROCESSOR
```

Short files for `test_customer.py` and `test_processor.py` follow the same
shape. The structural precedents in `test_structure.py` fail the build if
a party module binds nobody, or if a clause has no precedent.

**Execution of the contract.** Side effects live at the boundary, after the
decision. The performer gathers facts (impure), consults the terms (pure),
then performs. It may dispatch on a field of the decision. It never
re-interprets the terms:

```python
def handle_refund_endpoint(order_id: str, request: RefundRequest) -> None:
    order = orders_repo.load(order_id)                    # gather facts
    decision = settle_refund_request(request, order)      # consult terms
    if decision.approved:                                 # perform
        payments.credit(order_id, decision.amount_cents, from_=decision.paid_by)
    notifications.send_refund_outcome(order_id, decision)
```

---

## The dispute test

When you cannot decide whether code honors this pattern, ask the
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

# Part II — The convention: Precedent Testing (CaC/CL-1)

Principle 5 hardened into enforceable convention. The ID stays
`CaC/CL-1`: CL stands for case law, the legal word for precedents. This is also the
answer to Gherkin: the specification layer BDD tools externalize into
prose is internalized here — the operative clause is the readable spec,
the precedents are the executable scenarios, and the docket is the
stakeholder view. Gherkin needs three artifacts per rule (.feature prose
that cannot execute, regex step glue, real code) and the prose can
silently drift; precedents need one artifact that fails the build if it
lies.

Eight rules, each mechanically checkable:

1. **One file per party or procedure.** `precedents/test_merchant.py` pins
   `contract/merchant.py` and nothing else. The docket mirrors the modules,
   so it mirrors the parties.
2. **The test name is a claim a party could bring**, written as a full
   sentence in snake_case:
   `test_customer_may_return_damaged_goods_for_a_full_refund`. If it
   cannot be read aloud in a meeting, it fails review. (Lintable: length
   ≥ 6 words, contains a party noun.)
3. **Facts / Claim / Ruling structure**, in that order, comment-marked.
   Given/When/Then without the DSL: facts are constructed from the
   Definitions, the claim is one call to a clause, the ruling is plain
   asserts.
4. **Cite public clauses, never private helpers.** Precedents call public
   functions of the contract modules. A helper with a leading underscore
   is internal and stays redraftable as long as the rulings stand.
   (Lintable: no `_name` imports in `precedents/`.)
5. **No mocks in precedents.** A mock in a precedent is proof the terms
   are not pure — fix the contract, not the test. Mocks are permitted
   only in thin execution-layer tests at the boundary.
6. **Precedent is append-mostly.** Amending a clause may change a ruling,
   and the diff must show both together: the clause edit and the precedent
   edit in one commit. Deleting a precedent without amending a clause is
   overruling without authority — blocked in review.
7. **The docket is the stakeholder document.** Generate the
   human-readable spec *from* the precedents
   (`pytest --collect-only -q precedents/`), never the other way around.
   Gherkin's one genuine benefit, recovered at zero drift.
8. **Structure is itself precedent.** What a document would only state,
   a test enforces. Every party module holds at least one clause
   (`test_every_party_module_has_at_least_one_clause`). Every clause is
   cited by some precedent (`test_every_clause_is_cited_by_some_precedent`).
   Both run on `ast`, `inspect` and `importlib` only. A reference
   implementation is in [`skill/EXAMPLE.md`](../skill/EXAMPLE.md).

A precedent, in full:

```python
# precedents/test_refund_procedure.py
def test_customer_may_return_damaged_goods_for_a_full_refund():
    # Facts — the Definitions, cited by type, not by regex
    order = Order(total_cents=10_000, settled=True,
                  delivered_on=date(2026, 7, 1), damaged_on_arrival=True)

    # Claim — settled by the operative clause, nothing lower
    decision = settle_refund_request(RefundRequest(requested_on=date(2026, 7, 5)), order)

    # Ruling
    assert decision.approved
    assert decision.amount_cents == 10_000
    assert decision.paid_by is Party.MERCHANT
```

Two more dispute-test questions, for precedents:

- *Does every claim have standing?* A test no party would ever cite is
  not precedent — it is coverage theater. Delete it or promote it.
- *Could the docket brief a stakeholder?* If the printed test names, read
  as sentences, would not survive a product meeting, the naming
  discipline has lapsed.

---

# Part III — The full cycle (principle 8, worked)

The endpoint is the **performer**: gather → consult → perform, near-zero
branching. It contains no business rule. It may dispatch on a field of the
decision: `if decision.approved: payments.credit(...)`. Whether an approval
pays out is a term of performance, and that one `if` lives in step 3. The
performer never re-derives a rule, such as the window or the fee, from the
facts.

```python
# app/refunds/endpoint.py — the performer. Impure, and proud of it.
@app.post("/orders/{order_id}/refund-requests")
def handle_refund_request(order_id: OrderId, body: RefundRequestBody) -> RefundOutcomeBody:
    facts = gather_refund_facts(order_id, body)             # step 1 — impure reads
    decision = settle_refund_request(facts.request, facts.order)  # step 2 — pure terms
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
    """The evidence file: every Definition the refund clauses will cite."""
    request: RefundRequest
    order: Order


def gather_refund_facts(order_id: OrderId, body: RefundRequestBody) -> RefundFacts:
    return RefundFacts(
        request=body.as_refund_request(),      # HTTP → Definitions
        order=orders_repo.load(order_id),      # DB row → Order
    )
```

Performance mirrors the decision it executes — it cites only the
decision's own fields and never reaches back into `Order` to re-derive
what the terms already settled. If performance needs more information,
the decision's Definition is defective:

```python
# app/refunds/perform.py — performance of the contract.
def perform_refund_decision(order_id: OrderId, decision: RefundDecision) -> Receipt:
    """Execute the refund decision at the boundary."""
    if decision.approved:
        receipt = payments.credit(order_id, decision.amount_cents,
                                  from_=decision.paid_by)
    else:
        receipt = Receipt.nothing_owed(reason=decision.reason)
    notifications.send_refund_outcome(order_id, decision)
    audit_log.record(order_id, decision, receipt)
    return receipt
```

Testing policy per layer: the clauses get the full docket; gathering and
performing get thin execution-layer tests where mocks are permitted (rule
5); the endpoint needs at most one wiring test — with three lines and no
rules there is almost nothing left to get wrong.

---

# Part IV — Schedules, worked (principle 9)

Every internal concern decomposes into the same three parts:

1. **Terms** — a frozen dataclass (or `as const` object) declaring the
   obligation, living next to the Definitions, cited by name.
2. **Rulings** — every judgment the terms require is a pure function of
   the terms and the facts. This is where the precedents attach.
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
  clause: "refund_procedure",
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

// Named, pure validation rule — precedents run in vitest with no DOM:
export function requestedOnMayNotBeInTheFuture(value: string, today: string): Grievance | null {
  return value > today
    ? { field: "requestedOn", says: "The request date cannot be in the future." }
    : null;
}

test("the form tenders exactly what the refund endpoint is owed", () => {
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

REQUEST_REFUND = InvocationTerms(clause="refund_procedure",
                                 parties=frozenset({Role.CUSTOMER, Role.SUPPORT}))

def may_invoke(actor: Actor, terms: InvocationTerms) -> Allowed | Denied:
    if actor.role in terms.parties:
        return Allowed()
    return Denied(reason=f"{actor.role.value} is not party to {terms.clause}")

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
reads. The precedents are exhaustive over the Definitions, so a new denial
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
    owner: str                     # must agree with ARTICLE_III

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
commit, with the precedents that motivated the change. CI rejects any one
without the other two.

The counter-test for models: a column whose Definition field no clause
ever cites is data collected without purpose — a term nobody agreed to.
Schedule T will ask awkward questions about it; better to strike it.

---

# Part V — Articles: architecture as governing law

Schedules govern one concern each. Architecture is the **governing-law
section** — terms that bind every clause at once: which layers exist and
who may import whom; what is synchronous and what deferred; where state
may live; what is one deployable. Under CaC these are the **Articles**. This is
the only use of the word: Articles are architecture law (layers,
boundaries, ownership). Party chapters are modules, not Articles. Articles are
declared, enforced as precedents over the import graph, and amended only
with a recorded rationale.

```python
# articles/governing_law.py — binds every clause in the program.
@dataclass(frozen=True)
class LayeringTerms:
    """Who may cite whom. Lower layers never import upward."""
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
    """What is one deployable, and what crosses between them."""
    deployable: str
    may_call: tuple[str, ...]        # other deployables, by contract only
    crossing: str                    # "http" | "queue" — never a shared DB

ARTICLE_II = (BoundaryTerms("storefront", may_call=("payments",), crossing="http"),
              BoundaryTerms("payments",   may_call=(),            crossing="queue"))


@dataclass(frozen=True)
class StateTerms:
    """Where truth lives. One owner per fact; all else is cache."""
    fact: str
    owner: str

ARTICLE_III = (StateTerms("orders", owner="storefront.db"),
               StateTerms("ledger", owner="payments.db"))
```

Articles are enforced, not aspirational — an import graph is just data,
so the architecture check is ordinary precedent run in CI (import-linter
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
the operative change, and the precedents it creates or overrules; CI
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

Precedents affected:
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

1. Move existing pure tests into `precedents/`, one file per party or
   procedure module (`precedents/test_<party>.py`); rename to claim
   sentences.
2. Add the Facts / Claim / Ruling comments; delete any mock from a
   precedent by purifying the term it was covering.
3. Add the structural precedents (convention rule 8), the lint plugin for
   rules 1–5 and the CI diff check for rule 6.
4. Wire the docket command into CI output so every build prints the
   current precedents — that artifact replaces any .feature file you would
   have written.
5. Extract schedules as you touch them: each scattered TTL, retry
   decorator, permission check or hand-built form becomes a declared
   term with a pure ruling. Declare the Articles last, once the layers
   are visible — then let CI enforce them.

The closing dispute test for the internals: an internal concern is
drafted correctly when the obligation is a schedule you could amend in
one line, the judgment is a pure ruling with precedents, and the machinery
is a generic performer that would work unchanged for any other schedule
of its kind. If changing a TTL, a retry count, or a form field touches
machinery, the schedule has leaked; if the machinery makes a decision the
ruling should have made, a term is hiding. Same dispute test, new
territory.
