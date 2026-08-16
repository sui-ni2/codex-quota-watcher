# Local Codex account handoff

This feature preserves project continuity when a user intentionally changes between user-owned Codex/ChatGPT profiles. It does not automate account rotation, bypass rate limits, copy credentials, or migrate native Codex sessions between accounts.

## Boundary

The shared unit is the local Git worktree, not the Codex account session.

A checkpoint stores only:

- repository name and root
- branch and HEAD
- staged/unstaged summaries
- changed file paths
- recent commit subjects
- a compact semantic `HANDOFF.md` written by the active Codex profile

It never reads or copies `auth.json`, OAuth tokens, API keys, cookies, native session stores, model cache databases, or source-file contents.

## One-time setup per Codex profile

After installing/linking this package, run once for each profile-specific `CODEX_HOME`:

```powershell
codex-handoff install-agent --codex-home "C:\path\to\profile\codex-home"
```

If `CODEX_HOME` is already set for the active profile:

```powershell
codex-handoff install-agent
```

The command preserves existing `AGENTS.md` content and adds one managed handoff block. Re-running it updates that block instead of duplicating it.

## Before switching accounts

From the active repository:

```powershell
codex-handoff checkpoint .
```

This creates local-only files:

```text
.codex-handoff/
  FACTS.md
  facts.json
  HANDOFF.md
```

The directory is added to `.git/info/exclude`, so it is not added to the repository's tracked `.gitignore` and is not intended for commit or upload.

The active Codex profile should then update only these semantic sections in `HANDOFF.md`:

- Objective
- Completed
- Decisions / constraints
- Blockers
- Next action

Keep it concise. The Git snapshot already carries branch, HEAD, dirty files, and recent commits.

## After switching accounts

The next profile reads `HANDOFF.md` and `FACTS.md` automatically through its one-time `CODEX_HOME/AGENTS.md` rule.

A manual consistency check is also available:

```powershell
codex-handoff resume .
```

`fresh` means the current Git worktree still matches the saved checkpoint. `stale` means the repository changed after the checkpoint; current Git/files take precedence and the handoff is advisory only.

## Crash / quota exhaustion recovery

If the prior account stops before it can update semantic context, the next account should reconstruct only from:

1. the current Git worktree;
2. the saved factual checkpoint if present;
3. project files and tests;
4. any existing semantic handoff that remains consistent with current evidence.

Unknown intent must be marked as a context gap rather than invented.

## Future profile switch integration

The handoff layer is deliberately independent of account credentials. A future A/B profile UI can call `checkpoint` immediately before routing to another profile-specific `CODEX_HOME`, then let the target profile load the same repository and local handoff. No credential data needs to pass through the handoff layer.
