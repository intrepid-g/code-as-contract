# Code as a Contract

Code is a **contract** between its parties — the customer, the business, the
payment processor, the next developer, the on-call engineer at 3am — that a
machine happens to execute. This repo is a [Claude Code](https://claude.com/claude-code)
skill that drafts and reviews business-logic code the way a careful lawyer
drafts a contract: parties first, then clauses stating what binds each of
them, then case law that settles disputes.

## Contents

| Path | What it is |
|------|------------|
| [`skill/SKILL.md`](skill/SKILL.md) | The skill itself: when to use it and how to draft a prose `CONTRACT.md` plus matching code. |
| [`skill/EXAMPLE.md`](skill/EXAMPLE.md) | A worked example: a refund policy in Python. |
| [`manifesto/`](manifesto) | The principles behind the idea: [`CODE_AS_A_CONTRACT.md`](manifesto/CODE_AS_A_CONTRACT.md), plus HTML versions ([`index.html`](manifesto/index.html), [`internals.html`](manifesto/internals.html)). |

## Install

The skill lives in [`skill/`](skill). Clone the repo, then copy or symlink that
folder into your skills directory under the name `code-as-contract`:

```sh
git clone <this-repo-url>
cd code-as-contract

# personal (all projects)
ln -s "$PWD/skill" ~/.claude/skills/code-as-contract

# or per project
ln -s "$PWD/skill" /path/to/project/.claude/skills/code-as-contract
```

Claude Code picks it up automatically.

## When it triggers

- Writing a new domain/business-rule function
- Untangling a conditional-heavy function that decides something (pricing, eligibility, refunds, access, payouts)
- Reviewing code for whether a rule can be named and cited
- Separating decision logic from side effects (DB writes, API calls, emails)
