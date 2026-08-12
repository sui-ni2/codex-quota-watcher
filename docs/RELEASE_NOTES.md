# Codex Quota Watcher v0.1.0

Codex Quota Watcher is a small local tool that tells you when a previously blocked Codex quota is available again.

The first release uses Codex's documented local app-server method instead of scraping the UI or guessing from news. It stores only a redacted local state and will not fire just because usage percentage decreases.

Highlights:

- confirmed `blocked -> available` detection;
- duplicate prevention across restarts;
- configurable polling;
- console, desktop, and opt-in webhook notifications;
- no credential-file access;
- no model turn and no reset-credit consumption;
- zero runtime npm dependencies.

Compatibility: verified on Windows with Codex CLI 0.147.0 and Node.js 20+.
