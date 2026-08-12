# Codex Quota Watcher

## Project purpose

Build a small, open-source watcher that detects a confirmed Codex account transition from blocked (`exhausted` or backend-classified usage limited) to available and notifies the user. V0.1 is Codex-only.

## Important commands

- Run once: `node ./src/cli.mjs --once`
- Run continuously: `node ./src/cli.mjs --interval 60`
- Run tests: `npm test`
- Syntax check: `npm run check`

## Files and directories not to touch

- Never read, print, copy, or modify `~/.codex/auth.json`, `.env`, API keys, access tokens, cookies, credentials, Codex logs, session bodies, or user prompts.
- Do not modify any Soccer, Personal AI OS, P3, P5, lottery, or unrelated Codex project.
- Do not modify Codex configuration or consume rate-limit reset credits.

## Backup rules

- Keep changes reversible through git commits.
- Before changing a persisted watcher state schema, preserve backward compatibility or add a migration test.
- Never delete watcher state automatically unless the user explicitly requests a reset.

## Test and check commands

- `node --test`
- `node --check ./src/cli.mjs`
- `node --check ./src/app-server-client.mjs`
- `node --check ./src/state-machine.mjs`
- `node --check ./src/notifiers.mjs`

## Project-specific safety rules

- Use the local `codex app-server` process for authentication; the watcher must never open credential files itself.
- `account/rateLimits/read` is read-only. Never call `account/rateLimitResetCredit/consume`.
- A lower `usedPercent` alone is not a reset. Notify only after a persisted blocked-to-available transition.
- Treat protocol errors and missing fields as `unknown`, never as `available`.
- Redact opaque identifiers and account metadata from logs and saved state.
