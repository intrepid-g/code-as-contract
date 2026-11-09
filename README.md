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
| [`manifesto/manifesto.md`](manifesto/manifesto.md) | The principles behind the idea. |
| [`manifesto/papers/`](manifesto/papers) | Companion papers (HTML): [`schedules.html`](manifesto/papers/schedules.html) and [`vs-gherkin.html`](manifesto/papers/vs-gherkin.html). |

## Versions

The manifesto is versioned with [semantic-ish](https://semver.org) tags named
`manifesto-vX.Y.Z`; every change is listed in [`CHANGELOG.md`](CHANGELOG.md).
To read or restore an older version:

```sh
git tag -l 'manifesto-v*'
git show manifesto-v0.1.0:manifesto/CODE_AS_A_CONTRACT.md   # path at 0.1.0; later: manifesto/manifesto.md
git checkout manifesto-v0.1.0 -- manifesto/   # restore into your working tree
```

Bump the version line in the manifesto, add a changelog entry, and tag in the
same commit whenever the manifesto's meaning changes (not for typo fixes).

## Install

The skill lives in [`skill/`](skill). Clone the repo, then copy or symlink that
folder into your skills directory under the name `code-as-contract`:

```sh
git clone https://github.com/intrepid-g/code-as-contract.git
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
