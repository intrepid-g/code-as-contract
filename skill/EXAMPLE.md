# Worked example: a refund policy, in Python

Each party's chapter is a module (`contract/<party>.py`). The procedure
has one too. The precedents (in legal terms: case law) mirror the modules.
There is no prose contract file. The spec you read is
`pytest --collect-only -q`.

```
contract/
  definitions.py  customer.py  merchant.py  processor.py
  refund_procedure.py
precedents/
  test_customer.py  test_merchant.py  test_processor.py
  test_refund_procedure.py
  test_structure.py
```

**Parties.** Who is bound, before any code. Each one is a module:

- **Customer** (`customer.py`) — may request a refund within the window;
  relies on the Merchant to honor it.
- **Merchant** (`merchant.py`) — owes the refund (minus restocking fee)
  unless a denial reason applies; liable for damaged-on-arrival goods.
- **Payment processor** (`processor.py`) — must have settled the order
  before any refund is issued; the refund is denied, not queued, until it
  has. Bears the cost of any refund that isn't for damaged goods.
- **The order store** (database) — its `settled` and `delivered_on` are
  the facts of record; clauses decide from them and never re-check
  elsewhere.

**Definitions.** Only the terms the clauses need to name:

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
is a named constant. No docstring repeats the rule. The claim a docstring
would make is a precedent name below.

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
are pure. One file per module:

```python
# precedents/test_customer.py
from datetime import date

from contract.customer import refund_window_is_open
from contract.definitions import Order, RefundRequest

DELIVERED = Order(total_cents=10_000, settled=True,
                  delivered_on=date(2026, 7, 1), damaged_on_arrival=False)


def test_customer_may_still_request_a_refund_on_the_last_day_of_the_window():
    assert refund_window_is_open(RefundRequest(requested_on=date(2026, 7, 15)), DELIVERED)


def test_customer_is_refused_a_refund_the_day_after_the_window_closes():
    assert not refund_window_is_open(RefundRequest(requested_on=date(2026, 7, 16)), DELIVERED)
```

```python
# precedents/test_processor.py
from datetime import date

from contract.definitions import Order
from contract.processor import order_is_refundable


def test_processor_refuses_a_refund_on_an_order_it_has_not_settled():
    unsettled = Order(total_cents=10_000, settled=False,
                      delivered_on=date(2026, 7, 1), damaged_on_arrival=False)
    assert not order_is_refundable(unsettled)
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

**Structural precedents.** These tests enforce what a document would only
state. They use `ast`, `inspect`, `importlib` and `pkgutil`. Nothing else.
Run them with `python -m pytest` from the project root, so `contract` and
`precedents` import.

```python
# precedents/test_structure.py
import ast
import importlib
import inspect
import pkgutil
from pathlib import Path

import contract

PRECEDENTS = Path(__file__).parent
CHAPTERS = [m.name for m in pkgutil.iter_modules(contract.__path__) if m.name != "definitions"]


def clauses_of(chapter: str) -> list[str]:
    """Public functions defined in contract/<chapter>.py."""
    module = importlib.import_module(f"contract.{chapter}")
    return [name for name, fn in inspect.getmembers(module, inspect.isfunction)
            if not name.startswith("_") and fn.__module__ == module.__name__]


def names_called_by_precedents() -> set[str]:
    called = set()
    for path in PRECEDENTS.glob("test_*.py"):
        if path.name == Path(__file__).name:
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Call):
                called.add(ast.unparse(node.func).split(".")[-1])
    return called


def test_every_party_module_has_at_least_one_clause():
    assert CHAPTERS, "no party modules found"
    for chapter in CHAPTERS:
        assert clauses_of(chapter), f"contract/{chapter}.py binds nobody"


def test_every_clause_is_cited_by_some_precedent():
    called = names_called_by_precedents()
    for chapter in CHAPTERS:
        for clause in clauses_of(chapter):
            assert clause in called, f"{chapter}.{clause} has no precedent"
```

Both tests fail when the rule breaks. Add `def stray(): ...` to
`contract/merchant.py` and the second one fails. Add an empty module to
`contract/` and the first one fails. A new party module needs a clause
and a precedent before the build is green.

Limit: a precedent cites a clause by function name. A same-named call to
another function can hide a gap. Upgrade path: resolve the call to its
module with `ast` imports.

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

# Worked example 2: a support-ticket SLA, with an obligated system

The refund policy above is entirely **decision-shaped** — every clause is
`facts in → decision out`. Not every domain fits that shape. This example
has three parties — **Customer**, **Agent**, **System** — and the System is
not "the interface"; the brief gives it duties: escalate stale tickets,
send a warning before breach, log every escalation for audit. Those are
**obligation clauses**: `party, action, deadline/trigger → performed`,
where failing to perform is a breach of that clause, not a missing feature.

```
contract/
  definitions.py  agent.py  system.py  sla_procedure.py
precedents/
  test_agent.py  test_system.py  test_sla_procedure.py
  test_structure.py
```

**Parties.** The Agent and the System each get a module. The System is a
party, not infrastructure. The Customer only receives the warning. It owes
nothing here, so it has no module. The audit log is a party too. It owes
a record of every escalation. This example only performs that duty at the
edge (`audit_log=True`). A full draft gives the audit log its own module
and a precedent.

**Definitions.**

```python
# contract/definitions.py
from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class Party(Enum):
    CUSTOMER = "customer"
    AGENT = "support_agent"
    SYSTEM = "escalation_system"


class Severity(Enum):
    LOW = "low"
    HIGH = "high"


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

**The Agent module** (decision-shaped: has the deadline passed?):

```python
# contract/agent.py
from datetime import datetime, timedelta

from contract.definitions import Severity, Ticket

RESPONSE_WINDOW = {Severity.LOW: timedelta(hours=24), Severity.HIGH: timedelta(hours=4)}


def response_deadline(ticket: Ticket) -> datetime:
    return ticket.opened_at + RESPONSE_WINDOW[ticket.severity]


def agent_is_in_breach(ticket: Ticket, now: datetime) -> bool:
    if ticket.first_response_at is not None:
        return False
    return now > response_deadline(ticket)
```

**The System module** (obligation-shaped: the System must *act* on a
trigger, not just classify facts — this is the clause shape the refund
example never needed):

```python
# contract/system.py
from datetime import datetime, timedelta

from contract.agent import agent_is_in_breach, response_deadline
from contract.definitions import Ticket

WARNING_LEAD_TIME = timedelta(hours=1)


def system_must_warn_customer(ticket: Ticket, now: datetime) -> bool:
    warn_from = response_deadline(ticket) - WARNING_LEAD_TIME
    return ticket.first_response_at is None and warn_from <= now <= response_deadline(ticket)


def system_must_escalate(ticket: Ticket, now: datetime) -> bool:
    return agent_is_in_breach(ticket, now) and not ticket.escalated
```

**The operative clause.** Reads top-to-bottom; combines the decision
clause (breach?) with the obligation clauses (must the System act?):

```python
# contract/sla_procedure.py
from datetime import datetime

from contract.agent import agent_is_in_breach
from contract.definitions import EscalationOutcome, Party, Ticket
from contract.system import system_must_escalate, system_must_warn_customer


def evaluate_ticket_sla(ticket: Ticket, now: datetime) -> EscalationOutcome:
    return EscalationOutcome(
        warn_customer=system_must_warn_customer(ticket, now),
        escalate_to=Party.SYSTEM if system_must_escalate(ticket, now) else None,
        breach=agent_is_in_breach(ticket, now),
    )
```

**Precedents.** One file per module, and at least one claim per party,
including the System. This is the per-party dispute test as tests:

```python
# precedents/test_agent.py
from datetime import datetime

from contract.agent import agent_is_in_breach, response_deadline
from contract.definitions import Severity, Ticket

OPENED = datetime(2026, 7, 14, 8, 0)


def a_ticket(answered_at: datetime | None) -> Ticket:
    return Ticket(Severity.HIGH, OPENED, first_response_at=answered_at, escalated=False)


def test_agent_owes_a_first_response_four_hours_after_a_high_severity_ticket_opens():
    assert response_deadline(a_ticket(None)) == datetime(2026, 7, 14, 12, 0)


def test_agent_is_in_breach_once_the_deadline_passes_unanswered():
    assert agent_is_in_breach(a_ticket(None), datetime(2026, 7, 14, 12, 1))


def test_agent_answering_in_time_is_never_in_breach():
    assert not agent_is_in_breach(a_ticket(datetime(2026, 7, 14, 9, 0)), datetime(2026, 7, 14, 13, 0))
```

```python
# precedents/test_system.py
from datetime import datetime

from contract.definitions import Severity, Ticket
from contract.system import system_must_escalate, system_must_warn_customer

UNANSWERED = Ticket(Severity.HIGH, datetime(2026, 7, 14, 8, 0), None, escalated=False)


def test_system_must_warn_customer_thirty_minutes_before_the_deadline():
    assert system_must_warn_customer(UNANSWERED, datetime(2026, 7, 14, 11, 30))


def test_system_must_escalate_the_minute_after_the_deadline_is_missed():
    assert system_must_escalate(UNANSWERED, datetime(2026, 7, 14, 12, 1))
```

```python
# precedents/test_sla_procedure.py
from datetime import datetime

from contract.definitions import Party, Severity, Ticket
from contract.sla_procedure import evaluate_ticket_sla


def test_a_missed_deadline_is_a_breach_and_the_system_escalates():
    ticket = Ticket(Severity.HIGH, datetime(2026, 7, 14, 8, 0), None, escalated=False)
    outcome = evaluate_ticket_sla(ticket, datetime(2026, 7, 14, 12, 1))
    assert outcome.breach
    assert outcome.escalate_to is Party.SYSTEM
```

The same `test_structure.py` guards this project unchanged.

**Execution of the contract.** The performer polls tickets, consults the
pure terms, then performs the System's obligations — it never re-interprets
what's due:

```python
def run_sla_sweep(now: datetime) -> None:
    for ticket in tickets_repo.due_for_sla_check():          # gather facts
        outcome = evaluate_ticket_sla(ticket, now)            # consult terms
        if outcome.warn_customer:                             # perform
            notifications.send_sla_warning(ticket.id)
        if outcome.escalate_to is Party.SYSTEM:
            escalations.escalate(ticket.id, audit_log=True)
```
