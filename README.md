# Codex Quota Watcher

Get a notification when a **blocked Codex quota becomes available again**.

Codex Quota Watcher talks to the local, authenticated `codex app-server` and reads the official `account/rateLimits/read` method. It does not scrape the UI, parse private logs, start a model turn, or read your credential files.

> Status: V0.1. The core read path has been verified on Windows with Codex CLI 0.147.0. App-server schemas are version-specific, so compatibility is tested conservatively and failures become `unknown`, never a false “available” result.

## What counts as a reset?

Only this transition:

```text
backend-blocked / 100% used  ->  available
                         => RESET_CONFIRMED
```

These do **not** trigger a notification:

- usage falling from 80% to 50%;
- the watcher starting for the first time;
- a moving `resetsAt` timestamp;
- a network or authentication error;
- an incomplete or unknown response.

This deliberately avoids claiming that ordinary rolling-window replenishment is a full quota reset.

## Requirements

- Node.js 20 or newer.
- A recent Codex CLI with `codex app-server` and `account/rateLimits/read`.
- Codex logged in with ChatGPT-backed authentication. API-key-only and Bedrock authentication do not expose this ChatGPT account endpoint.

Check your setup:

```powershell
codex --version
codex login status
```

## Install from source

```powershell
git clone https://github.com/sui-ni2/codex-quota-watcher.git
cd codex-quota-watcher
npm install
npm link
```

No runtime npm dependencies are required.

## Run

Read once and establish the initial baseline:

```powershell
codex-quota-watcher --once
```

Watch every 60 seconds:

```powershell
codex-quota-watcher --interval 60
```

Console only:

```powershell
codex-quota-watcher --interval 60 --notify console
```

Desktop plus webhook:

```powershell
$env:CODEX_QUOTA_WATCHER_WEBHOOK_URL = "https://example.com/your-private-hook"
codex-quota-watcher --notify desktop,webhook
```

The webhook URL is read from the process environment and is never written to watcher state or logs.

### Useful options

```text
--once              Read once, save the baseline, and exit
--interval SECONDS  Poll interval, minimum 15 seconds
--limit-id ID       Rate-limit bucket, default: codex
--notify CHANNELS   console, desktop, webhook
--state-file PATH   Override the local state file
--codex-bin PATH    Override the Codex executable
--json              Print the safe normalized snapshot
```

## How it works

1. Starts `codex app-server` over local stdio.
2. Completes the documented `initialize` / `initialized` handshake.
3. Calls the read-only `account/rateLimits/read` method.
4. Keeps only a redacted snapshot: status, bucket, usage percentage, window duration, and reset timestamp.
5. Persists the last state atomically.
6. Emits one notification after a confirmed `blocked -> available` transition.

The app-server can also emit `account/rateLimits/updated`; the watcher uses it as a prompt to re-read the authoritative snapshot, with polling as a fallback.

See [Architecture](docs/ARCHITECTURE.md) and [Privacy and security](docs/PRIVACY.md).
Platform-specific setup, including macOS `launchd`, is in [Platform setup](docs/PLATFORMS.md).

## Evidence levels

| Level | Signal | V0.1 use |
|---|---|---|
| A | `account/rateLimits/read` backend classification | Authoritative trigger |
| B | `usedPercent >= 100` from the Codex bucket | Blocking fallback |
| C | Client error text or logs | Not used |
| D | News or social posts about resets | Not used |

## Test

```powershell
npm test
npm run check
```

## Important limitations

- This is an independent community project, not an OpenAI product.
- The app-server protocol is versioned with the installed Codex CLI. A future Codex release can change behavior.
- The watcher confirms recovery only after it has previously observed a blocked state. It cannot reconstruct a missed transition while it was offline.
- It does not consume earned reset credits and does not attempt to increase or bypass limits.

## Platform verification

| Platform | Code and CI | Real authenticated quota read |
|---|---|---|
| Windows 11 | Yes | Verified with Codex CLI 0.147.0 |
| macOS | CI target | Community verification needed |
| Linux | CI target | Community verification needed |

## License

MIT
