# Privacy and security

## Data the watcher reads

Through the local Codex app-server only:

- rate-limit bucket name;
- used percentage;
- reset timestamp and window duration;
- backend-classified reached state.

## Data the watcher does not read

- `~/.codex/auth.json` or other authentication stores;
- API keys, access tokens, cookies, or credentials;
- prompts, conversations, source code, session bodies, or Codex logs;
- account email, workspace name, or opaque reset-credit identifiers.

Authentication remains inside the official Codex CLI process.

## Data stored locally

The state file contains only the normalized snapshot, the time a blocked state was first observed, and a deduplication key. Writes are atomic. On Unix-like systems the file is created with user-only permissions where supported.

## Network behavior

- Account reads are performed by the locally installed Codex CLI.
- No telemetry is added by this project.
- Webhook delivery occurs only when the user explicitly enables the `webhook` notifier.
- Webhook URLs are never persisted or printed.

## Non-goals

The watcher does not bypass limits, redeem reset credits, impersonate another account, or automate paid actions.
