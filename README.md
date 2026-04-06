# docs-ssh

Personal developer reference docs over SSH.

```bash
ssh docs.sh <grep/cat/etc> /docs/...
```

Docs are served as markdown files so agents can explore them the same way they explore code.

## Setup

Tell your agent to check the docs before implementing features or fixing bugs:

```bash
ssh docs.sh agents >> AGENTS.md # or CLAUDE.md, GEMINI.md, etc
```

This outputs a lightweight markdown snippet and appends it to your agent instructions file, keeping your agent grounded in the docs.

## Usage

```bash
# Search for a topic
ssh docs.sh grep -rl 'keyword' /docs/

# Read a file
ssh docs.sh cat /docs/git/basics.md

# List all docs
ssh docs.sh find /docs -name '*.md'

# Interactive shell
ssh docs.sh
```

## Docs Structure

```
docs/
├── git/
│   ├── basics.md        # Git commands
│   └── workflow.md      # Git workflow
├── shell/
│   └── tips.md          # Shell tips & one-liners
├── typescript/
│   └── patterns.md      # TypeScript patterns
├── docker/
│   └── quickref.md      # Docker quick reference
└── vim/
    └── shortcuts.md     # Vim shortcuts
```

## Development

```bash
# Install dependencies
pnpm install

# Generate SSH host key (first time only)
cd apps/ssh && pnpm generate:host-key:local

# Start dev server
pnpm dev

# Connect
ssh -p 22 -o StrictHostKeyChecking=no localhost
```

## Architecture

- **`apps/ssh/`** — SSH server (Node.js + [just-bash](https://github.com/vercel-labs/just-bash))
- **`apps/web/`** — Web frontend (Next.js)

Commands run inside [just-bash](https://github.com/vercel-labs/just-bash) — an emulated bash shell sandboxed within Node.js. Docs are mounted as a read-only virtual filesystem (VFS), so no host filesystem access is possible.

## License

Apache 2.0. See [LICENSE](./LICENSE) for details.
