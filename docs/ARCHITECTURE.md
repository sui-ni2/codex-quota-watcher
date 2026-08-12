# Architecture

```text
Codex CLI (already authenticated)
        |
        | local JSONL over stdio
        v
AppServerClient
        |
        | account/rateLimits/read
        v
Normalizer -> State machine -> Atomic state store
                               |
                               v
                 console / desktop / webhook
```

## Components

- `app-server-client.mjs`: owns the local process, handshake, requests, timeouts, and update events.
- `state-machine.mjs`: converts versioned payloads into a minimal safe snapshot and detects transitions.
- `state-store.mjs`: writes schema-versioned JSON atomically to a user-local state directory.
- `notifiers.mjs`: dispatches a small, non-sensitive event to configured channels.
- `cli.mjs`: argument parsing, polling, reconnection, and shutdown.

## State machine

```text
UNKNOWN --first valid read--> AVAILABLE or BLOCKED   (no notification)
AVAILABLE ------------------> AVAILABLE              (no notification)
AVAILABLE ------------------> BLOCKED                (remember blockedSince)
BLOCKED --------------------> BLOCKED                (no notification)
BLOCKED --------------------> AVAILABLE              (RESET_CONFIRMED once)
ANY ------------------------> UNKNOWN                (fail closed)
```

`usedPercent` decreasing is intentionally absent from the transition rules.

## Compatibility strategy

- Prefer `rateLimitsByLimitId["codex"]`.
- Fall back to the backward-compatible `rateLimits` view.
- Require a usable window or explicit backend blocking evidence.
- Treat missing or malformed data as `unknown`.
- Keep saved state independent of opaque account, workspace, or reset-credit identifiers.
