# Code as a Contract

Code is a **contract** between its parties — the customer, the business, the
payment processor, the next developer, the on-call engineer at 3am — that a
machine happens to execute. This repo is a [Claude Code](https://claude.com/claude-code)
skill that drafts and reviews business-logic code the way a careful lawyer
drafts a contract: parties first, then clauses stating what binds each of
them, then precedents (in legal terms: case law) that settle disputes.

## Contents

| Path | What it is |
|------|------------|
| [`skill/SKILL.md`](skill/SKILL.md) | The skill itself: when to use it and how to draft the code as the single source: a module per party, named constants, precedents. |
| [`code-as-contract-lean.md`](code-as-contract-lean.md) | The lean version: about 800 tokens, for agents. |
| [`skill/EXAMPLE.md`](skill/EXAMPLE.md) | A worked example: a refund policy in Python. |
| [`pattern/pattern.md`](pattern/pattern.md) | The principles behind the idea. |
| [`pattern/papers/`](pattern/papers) | Companion papers (HTML): [`schedules.html`](pattern/papers/schedules.html) and [`vs-gherkin.html`](pattern/papers/vs-gherkin.html). |

## Versions

The pattern is versioned with [semantic-ish](https://semver.org) tags named
`pattern-vX.Y.Z` (tags before 0.2.1 are named `manifesto-v*` and their paths are under `manifesto/`); every change is listed in [`CHANGELOG.md`](CHANGELOG.md).
To read or restore an older version:

```sh
git tag -l 'pattern-v*' 'manifesto-v*'
git show manifesto-v0.1.0:manifesto/CODE_AS_A_CONTRACT.md   # old tags: paths are under manifesto/
git checkout manifesto-v0.1.0 -- manifesto/   # restore into your working tree
```

Bump `pattern/VERSION`, add a changelog entry, and tag in the
same commit whenever the pattern's meaning changes (not for typo fixes).

## Install

Each skill is a directory named `code-as-contract/` that holds `SKILL.md` and
`EXAMPLE.md`. The skills directory you put it in depends on the tool:

| Tool | Personal (all projects) | Per project |
|------|-------------------------|-------------|
| Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| OpenCode | `~/.config/opencode/skills/` (also reads `~/.claude/skills/`) | `.opencode/skills/` (also reads `.claude/skills/`) |

Without cloning, using the GitHub CLI:

```sh
# Claude Code (personal). OpenCode reads this location too.
mkdir -p ~/.claude/skills/code-as-contract
gh api repos/intrepid-g/code-as-contract/tarball \
  | tar xz --strip-components=2 -C ~/.claude/skills/code-as-contract --wildcards '*/skill/*'
```

Or clone the repo and symlink the folder, so `git pull` keeps the skill up to date:

```sh
git clone https://github.com/intrepid-g/code-as-contract.git
cd code-as-contract
ln -s "$PWD/skill" ~/.claude/skills/code-as-contract                 # personal
ln -s "$PWD/skill" /path/to/project/.claude/skills/code-as-contract  # or per project
```

Claude Code and OpenCode discover the skill on their own. For OpenCode, there
is also a variant with OpenCode frontmatter at
[`opencode-commands/code-as-contract`](https://github.com/gabriels1234/aitoolkit/tree/main/opencode-commands/code-as-contract)
in aitoolkit.

## When it triggers

- Writing a new domain/business-rule function
- Untangling a conditional-heavy function that decides something (pricing, eligibility, refunds, access, payouts)
- Reviewing code for whether a rule can be named and cited
- Separating decision logic from side effects (DB writes, API calls, emails)

## License

[MIT](LICENSE).
