# Code as a Contract (lean)

Business logic is a contract. Parties are modules. Rules are named clauses. Tests are precedents (in legal terms: case law).

## Rules
1. There are more parties than you first think. Explicit: user, admin. Implicit: frontend, DB, queue, cache, gateway, scheduler, LLM, each subsystem. Write each one's duties (promises, e.g. "cache ≤ 60 s stale") as scratch notes; turn every duty into a named constant + clause + precedent, then delete the notes. Each party gets `contract/<party>.py` with at least one clause that binds it.
2. A clause is a public pure function. Decision: facts in, decision out. Obligation: party + trigger or deadline in, "is it due" out. Pass `now` in. No I/O.
3. Every rule value is a named constant. No bare literal, no unnamed inline `if`. Helpers no party would cite are `_private`.
4. A procedure is a module: `contract/<name>_procedure.py`. Its operative function only calls clauses and returns a frozen decision.
5. The performer gathers, consults, performs. It may dispatch on one decision field. It never re-derives a rule. Needs more data? Add a field to the decision.
6. No rule text in docstrings or comments. A claim you would write there is a test name.
7. Precedents: `precedents/test_<party>.py`, one file per module. Name = full-sentence claim naming a party. Body: Facts / Claim / Ruling. Call public clauses only. No mocks. Expected values are literals.
8. Structure is tested: each party module has a clause, each public clause has a precedent. No `CONTRACT.md`: the spec is `pytest --collect-only -q`.
9. A rule change edits the clause and its precedents in one commit.

## Example
```python
# contract/customer.py
RETURN_WINDOW_DAYS = 30

def refund_window_is_open(delivered_on: date, requested_on: date) -> bool:
    return requested_on <= delivered_on + timedelta(days=RETURN_WINDOW_DAYS)

# contract/refund_procedure.py
def settle_refund(delivered_on: date, requested_on: date) -> RefundDecision:
    return RefundDecision(approved=refund_window_is_open(delivered_on, requested_on))

# performer: no rules
def handle_refund(order_id: str, requested_on: date) -> None:
    order = orders.load(order_id)                                # gather
    decision = settle_refund(order.delivered_on, requested_on)   # consult
    if decision.approved:                                        # dispatch
        payments.refund(order_id)                                # perform

# precedents/test_customer.py
def test_customer_may_request_a_refund_on_day_30():
    assert refund_window_is_open(date(2026, 7, 1), date(2026, 7, 31))

def test_customer_is_refused_a_refund_on_day_31():
    assert not refund_window_is_open(date(2026, 7, 1), date(2026, 8, 1))

# precedents/test_structure.py
def test_every_clause_is_cited_by_some_precedent():
    called = {ast.unparse(n.func).split(".")[-1]
              for p in Path("precedents").glob("test_*.py")
              for n in ast.walk(ast.parse(p.read_text())) if isinstance(n, ast.Call)}
    for info in pkgutil.iter_modules(contract.__path__):
        mod = importlib.import_module(f"contract.{info.name}")
        for name, fn in inspect.getmembers(mod, inspect.isfunction):
            if fn.__module__ == mod.__name__ and not name.startswith("_"):
                assert name in called, f"{info.name}.{name} has no precedent"
```

## Before done
- Each party has a module with a clause that binds it.
- Every public clause is called by a precedent; `pytest` is green.
- No performer re-derives a rule; no mocks in precedents.
- No literal rule values, no rule text in docstrings.
