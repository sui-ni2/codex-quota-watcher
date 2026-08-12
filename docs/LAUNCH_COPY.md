# Launch copy

## Repository description

Get notified when a blocked Codex quota becomes available again — locally, privately, and without scraping the UI.

## GitHub topics

`codex` `openai` `quota` `rate-limit` `notification` `watcher` `nodejs` `developer-tools`

## GitHub Discussion

### Codex Quota Watcher v0.1: know when your quota is back

I built a small open-source watcher for one frustrating moment: Codex has reached its limit, and you do not want to keep checking manually.

It connects to the local authenticated Codex app-server, remembers when the Codex bucket is actually blocked, and sends one notification when that bucket becomes available again. A lower usage percentage alone does not count as a reset.

The project does not read credential files, parse private logs, start model turns, consume reset credits, or add telemetry. V0.1 includes console, desktop, and opt-in webhook notifications.

Feedback on additional safe notification adapters and Codex-version compatibility is welcome.

## X

Codex Quota Watcher v0.1 is open source: get a local notification when a previously blocked Codex quota becomes available again. No UI scraping, no credential-file access, no model turn, and ordinary usage decreases do not trigger false resets. [repository link]

## Reddit

### I built a local Codex quota-reset watcher that avoids false positives

The tool uses Codex's local app-server rate-limit snapshot, persists only redacted state, and notifies only after `blocked -> available`. It deliberately ignores a simple drop in usage percentage. It has no runtime npm dependencies and supports console, desktop, or opt-in webhook notifications. I would appreciate compatibility reports from other Codex plans and operating systems. [repository link]

## Hacker News

### Show HN: Codex Quota Watcher — local blocked-to-available notifications

Codex Quota Watcher is a small Node.js CLI that reads the authenticated local Codex app-server quota snapshot and emits a deduplicated notification after a blocked quota becomes available. It does not scrape UI, inspect credential files, or start model turns. The reset definition is conservative: lower usage alone is ignored. [repository link]
