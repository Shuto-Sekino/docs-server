import { resolve } from 'node:path'
import { Bash, defineCommand, OverlayFs } from 'just-bash'

import { ExtendedMountableFs } from './extended-mountable-fs.js'

const DEFAULT_DOCS_DIR = resolve(process.env.DOCS_DIR ?? './docs')

export const EXECUTION_LIMITS = {
  maxCommandCount: 1000,
  maxLoopIterations: 1000,
  maxCallDepth: 50,
  maxSubstitutionDepth: 20,
  maxSourceDepth: 10,
  maxFileDescriptors: 100,
  maxAwkIterations: 1000,
  maxSedIterations: 1000,
  maxJqIterations: 1000,
  maxGlobOperations: 10000,
  maxArrayElements: 10000,
  maxBraceExpansionResults: 1000,
  maxOutputSize: 1024 * 1024, // 1MB
  maxStringLength: 1024 * 1024, // 1MB
  maxHeredocSize: 1024 * 1024, // 1MB
}

const INSTRUCTIONS = `\`\`\`bash
# Search for a topic
ssh docs.sh grep -rl 'keyword' /docs/

# Read a specific file
ssh docs.sh cat /docs/git/basics.md

# List all docs
ssh docs.sh find /docs -name '*.md'

# Search with context
ssh docs.sh grep -r 'pattern' /docs/ --include='*.md' -l
\`\`\`

All docs live under \`/docs/\` as markdown files. You can use any standard Unix tools (grep, find, cat, etc.) to search and read them.`

const AGENTS_MD = `## Personal Docs

Before implementing features or looking up references, check my personal docs via \`ssh docs.sh <command>\`.

${INSTRUCTIONS}
`

const SKILL_MD = `---
name: personal-docs
description: Search and read personal developer reference documentation using a bash shell.
---

# Personal Docs

Search and read personal developer documentation over SSH.

## How to use

${INSTRUCTIONS}
`

const SETUP_MD = `# Personal Docs - Setup

You are helping a user set up access to personal documentation via SSH.

1. First tell them the purpose of this tool (docs over ssh/bash)
2. Ask the user which option they prefer (use AskUserQuestion or similar if available)

Options:

1. **Append to agent instructions file (recommended)** - Adds lightweight instructions to the project's agent config file.
2. **Install as a skill** - Creates a skill directory with a SKILL.md.
3. **Both** - Adds to agent instructions and installs the skill.

## Option 1: Agent instructions file

Run this command and append the output to the project's agent instructions file:

\`\`\`bash
ssh docs.sh agents >> <instructions-file>
\`\`\`

Common instructions files by tool:

| Tool | File |
|------|------|
| Claude Code | \`CLAUDE.md\` |
| GitHub Copilot | \`AGENTS.md\` |
| Codex | \`AGENTS.md\` |
| Gemini CLI | \`GEMINI.md\` |
| Cursor | \`AGENTS.md\` |
| OpenCode | \`AGENTS.md\` |
| Other | \`AGENTS.md\` |

## Option 2: Skill

\`\`\`bash
mkdir -p <skill-dir>/personal-docs
ssh docs.sh skill > <skill-dir>/personal-docs/SKILL.md
\`\`\`

## Option 3: Both

Run both sets of commands above.

After setup, confirm to the user what was written and where.
`

const sshCommand = defineCommand('ssh', async (args) => {
  const cmd = args.join(' ')
  const hint = cmd === 'docs.sh agents' ? ' >> AGENTS.md' : ''
  return {
    stdout: '',
    stderr:
      'ssh is not available from within this session.\n' +
      'Exit first, then run:\n\n' +
      `  ssh ${cmd}${hint}\n\n`,
    exitCode: 1,
  }
})

/**
 * Creates a sandboxed Bash instance.
 * @param docsDir - Path to docs directory to mount. Defaults to DOCS_DIR env or ./docs.
 */
export async function createBash(docsDir = DEFAULT_DOCS_DIR) {
  const fs = new ExtendedMountableFs({
    readOnly: true,
    initialFiles: {
      '/docs/AGENTS.md': AGENTS_MD,
      '/docs/SKILL.md': SKILL_MD,
      '/docs/SETUP.md': SETUP_MD,
    },
    mounts: [
      {
        mountPoint: '/docs',
        filesystem: new OverlayFs({ root: docsDir, mountPoint: '/', readOnly: true }),
      },
    ],
  })

  const bash = new Bash({
    fs,
    cwd: '/docs',
    env: {
      HOME: '/docs',
      BASH_ALIAS_ll: 'ls -alF',
      BASH_ALIAS_la: 'ls -a',
      BASH_ALIAS_l: 'ls -CF',
      BASH_ALIAS_agents: 'echo && cat /docs/AGENTS.md',
      BASH_ALIAS_skill: 'echo && cat /docs/SKILL.md',
      BASH_ALIAS_setup: 'cat /docs/SETUP.md',
      BASH_ALIAS_help: 'cat /docs/README.md',
    },
    customCommands: [sshCommand],
    defenseInDepth: true,
    executionLimits: EXECUTION_LIMITS,
  })

  // Enable alias expansion
  await bash.exec('shopt -s expand_aliases')

  return { bash, fs }
}
