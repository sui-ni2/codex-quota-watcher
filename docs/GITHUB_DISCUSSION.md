# Codex Quota Watcher v0.1: know when your quota is back

I built a small open-source watcher for one frustrating moment: Codex has reached its limit, and you do not want to keep checking manually.

It connects to the local authenticated Codex app-server, remembers when the Codex bucket is actually blocked, and sends one notification when that bucket becomes available again. A lower usage percentage alone does not count as a reset.

The project does not read credential files, parse private logs, start model turns, consume reset credits, add advertising, or collect telemetry. V0.1 includes console, desktop, and opt-in webhook notifications.

Windows has been verified with a real authenticated quota read. macOS and Linux are covered by cross-platform code, setup documentation, and CI; real-account compatibility reports from those platforms are especially welcome.

Feedback on additional privacy-preserving notification adapters and Codex-version compatibility is welcome.
