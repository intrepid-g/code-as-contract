# Worked example: a refund policy, in Python

**Parties.** Who is bound, before any code:

- **Customer** — may request a refund within the window; relies on the
  Merchant to honor it.
- **Merchant** — owes the refund (minus restocking fee) unless a denial
  reason applies; liable for damaged-on-arrival goods.
- **Payment processor** — must have settled the order before any refund
  is issued; the refund is denied, not queued, until it has. Bears the
  cost of any refund that isn't for damaged goods.
- **The order store** (database) — its `settled` and `delivered_on` are
  the facts of record; clauses decide from them and never re-check
  elsewhere.

**Definitions.** Only the terms the clauses need to name:

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

# Worked example 2: a support-ticket SLA, with an obligated system

The refund policy above is entirely **decision-shaped** — every clause is
`facts in → decision out`. Not every domain fits that shape. This example
has three parties — **Customer**, **Agent**, **System** — and the System is
not "the interface"; the brief gives it duties: escalate stale tickets,
send a warning before breach, log every escalation for audit. Those are
**obligation clauses**: `party, action, deadline/trigger → performed`,
where failing to perform is a breach of that clause, not a missing feature.

The code that follows is the source. The `CONTRACT.md` below is generated
from it — clause numbers match because they come from the code.

## `CONTRACT.md` (excerpt, generated)

> *Generated from code; edit the code, not this file.*
> Article and clause text come from the clause docstrings. The docket (the
> list of disputes each clause settles) comes from the test names.

> ### Article I — The Agent
> §1. The Agent owes the Customer a first response within the response
> window set by the ticket's severity (Clause 1.1). Failure to respond
> before that window closes is a breach (Clause 1.2), regardless of cause.
>
> ### Article II — The System
> §1. The System must warn the Customer once the response deadline is
> within the configured warning lead time and no response has been given
> (Clause 2.1). Silence past this point is a breach of this Article, not an
> absence of feature.
> §2. The System must escalate the ticket to a senior Agent the instant
> the Agent's response window closes without a response, and must not
> escalate the same ticket twice (Clause 2.2).
>
> ### Article III — SLA Evaluation Procedure
> On each sweep, for every open ticket: the System first checks whether
> the Agent is in breach (§ Article I.1). If the deadline is near and
> unmet, the System discharges its warning duty (Article II §1). If the
> deadline has passed and no escalation has occurred, the System discharges
> its escalation duty (Article II §2). Every escalation is logged for
> audit — the log entry is the System's proof of performance.

**Parties.** Already set by the generated articles above — Customer,
Agent, System — and the System is a party, not infrastructure. The audit
log is the System's proof of performance, so its duty (record every
escalation) is a clause too.

**Definitions.** Only the terms the clauses need to name:

```python
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum


class Party(Enum):
    CUSTOMER = "customer"
    AGENT = "support_agent"
    SYSTEM = "escalation_system"


class Severity(Enum):
    LOW = "low"
    HIGH = "high"


@dataclass(frozen=True)
class SlaPolicy:
    response_window: dict[Severity, timedelta]
    warning_lead_time: timedelta = timedelta(hours=1)


@dataclass(frozen=True)
class Ticket:
    severity: Severity
    opened_at: datetime
    first_response_at: datetime | None
    escalated: bool


@dataclass(frozen=True)
class EscalationOutcome:
    warn_customer: bool = False
    escalate_to: Party | None = None
    breach: bool = False
```

**Article I — Agent's obligation** (decision-shaped: has the deadline
passed?):

```python
def response_deadline(ticket: Ticket, policy: SlaPolicy) -> datetime:
    """Clause 1.1 — the Agent owes a first response within the severity's window."""
    return ticket.opened_at + policy.response_window[ticket.severity]


def agent_is_in_breach(ticket: Ticket, policy: SlaPolicy, now: datetime) -> bool:
    """Clause 1.2 — breach if unanswered past the deadline."""
    if ticket.first_response_at is not None:
        return False
    return now > response_deadline(ticket, policy)
```

**Article II — System's obligations** (obligation-shaped: the System must
*act* on a trigger, not just classify facts — this is the clause shape the
refund example never needed):

```python
def system_must_warn_customer(ticket: Ticket, policy: SlaPolicy, now: datetime) -> bool:
    """Clause 2.1 — the System must warn the customer once the warning
    lead time enters the response window, and before breach. Failing to
    fire this warning is a breach of clause 2.1, not a missing feature."""
    deadline = response_deadline(ticket, policy)
    warn_from = deadline - policy.warning_lead_time
    return (
        ticket.first_response_at is None
        and warn_from <= now <= deadline
    )


def system_must_escalate(ticket: Ticket, policy: SlaPolicy, now: datetime) -> bool:
    """Clause 2.2 — the System must escalate to a senior Agent the instant
    the response deadline is breached and no escalation has happened yet.
    This is a duty triggered by time, not a decision made from a request."""
    return agent_is_in_breach(ticket, policy, now) and not ticket.escalated
```

**The operative clause.** Reads top-to-bottom; states who owes what, when —
combining the decision clause (breach?) with the obligation clauses (must
the System act?):

```python
def evaluate_ticket_sla(ticket: Ticket, policy: SlaPolicy, now: datetime) -> EscalationOutcome:
    """Clause 3 — SLA evaluation. Pure: facts in, outcome out. The outcome
    tells the performer which of the System's obligations are currently due."""
    return EscalationOutcome(
        warn_customer=system_must_warn_customer(ticket, policy, now),
        escalate_to=Party.SYSTEM if system_must_escalate(ticket, policy, now) else None,
        breach=agent_is_in_breach(ticket, policy, now),
    )
```

**Case law.** One claim per party, including the System — this is the
per-party dispute test applied as tests:

```python
HIGH_SEVERITY_POLICY = SlaPolicy(response_window={Severity.HIGH: timedelta(hours=4)})


def test_system_must_warn_customer_before_the_deadline_hits():
    ticket = Ticket(
        severity=Severity.HIGH,
        opened_at=datetime(2026, 7, 14, 8, 0),
        first_response_at=None,
        escalated=False,
    )
    now = datetime(2026, 7, 14, 11, 30)  # 30 min before the 4h deadline
    outcome = evaluate_ticket_sla(ticket, HIGH_SEVERITY_POLICY, now)
    assert outcome.warn_customer
    assert not outcome.breach


def test_system_must_escalate_the_instant_the_deadline_is_missed():
    ticket = Ticket(
        severity=Severity.HIGH,
        opened_at=datetime(2026, 7, 14, 8, 0),
        first_response_at=None,
        escalated=False,
    )
    now = datetime(2026, 7, 14, 12, 1)  # 1 minute past the 4h deadline
    outcome = evaluate_ticket_sla(ticket, HIGH_SEVERITY_POLICY, now)
    assert outcome.breach
    assert outcome.escalate_to is Party.SYSTEM


def test_agent_answering_in_time_discharges_the_obligation():
    ticket = Ticket(
        severity=Severity.HIGH,
        opened_at=datetime(2026, 7, 14, 8, 0),
        first_response_at=datetime(2026, 7, 14, 9, 0),
        escalated=False,
    )
    now = datetime(2026, 7, 14, 13, 0)  # well past the original deadline
    outcome = evaluate_ticket_sla(ticket, HIGH_SEVERITY_POLICY, now)
    assert not outcome.breach
    assert not outcome.warn_customer
```

**Execution of the contract.** The performer polls tickets, consults the
pure terms, then performs the System's obligations — it never re-interprets
what's due:

```python
def run_sla_sweep(now: datetime) -> None:
    for ticket in tickets_repo.due_for_sla_check():          # gather facts
        outcome = evaluate_ticket_sla(ticket, current_sla_policy(), now)  # consult terms
        if outcome.warn_customer:                             # perform
            notifications.send_sla_warning(ticket.id)
        if outcome.escalate_to is Party.SYSTEM:
            escalations.escalate(ticket.id, audit_log=True)    # discharges clause 2.2
```
