import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTransition, normalizeRateLimits } from "../src/state-machine.mjs";

function payload(usedPercent, rateLimitReachedType = null) {
  return {
    rateLimitsByLimitId: {
      codex: {
        limitId: "codex",
        primary: { usedPercent, resetsAt: 2_000, windowDurationMins: 300 },
        secondary: null,
        rateLimitReachedType,
      },
    },
  };
}

test("normalizes an available Codex bucket", () => {
  const snapshot = normalizeRateLimits(payload(73), "codex", new Date("2026-08-12T12:00:00Z"));
  assert.equal(snapshot.status, "available");
  assert.equal(snapshot.primary.usedPercent, 73);
});

test("normalizes backend-classified rate limit as blocked", () => {
  const snapshot = normalizeRateLimits(payload(95, "rate_limit_reached"));
  assert.equal(snapshot.status, "blocked");
});

test("treats 100 percent usage as blocked", () => {
  assert.equal(normalizeRateLimits(payload(100)).status, "blocked");
});

test("does not notify on first observation", () => {
  const current = normalizeRateLimits(payload(20));
  assert.equal(evaluateTransition(null, current).event, null);
});

test("does not treat lower usage as a reset", () => {
  const previous = { schemaVersion: 1, lastSnapshot: normalizeRateLimits(payload(80)), blockedSince: null, lastEventKey: null };
  const current = normalizeRateLimits(payload(50));
  assert.equal(evaluateTransition(previous, current).event, null);
});

test("notifies on blocked to available transition", () => {
  const blocked = normalizeRateLimits(payload(100, "rate_limit_reached"), "codex", new Date("2026-08-12T10:00:00Z"));
  const previous = { schemaVersion: 1, lastSnapshot: blocked, blockedSince: blocked.checkedAt, lastEventKey: null };
  const current = normalizeRateLimits(payload(0), "codex", new Date("2026-08-12T11:00:00Z"));
  const result = evaluateTransition(previous, current, new Date("2026-08-12T11:00:01Z"));
  assert.equal(result.event.type, "RESET_CONFIRMED");
  assert.equal(result.nextState.blockedSince, null);
});

test("does not notify when state is unknown", () => {
  const previous = { schemaVersion: 1, lastSnapshot: normalizeRateLimits(payload(100)), blockedSince: "x", lastEventKey: null };
  const current = normalizeRateLimits({});
  assert.equal(evaluateTransition(previous, current).event, null);
});

test("does not duplicate a persisted event", () => {
  const blocked = normalizeRateLimits(payload(100), "codex", new Date("2026-08-12T10:00:00Z"));
  const current = normalizeRateLimits(payload(0), "codex", new Date("2026-08-12T11:00:00Z"));
  const key = `codex:${blocked.checkedAt}:available`;
  const previous = { schemaVersion: 1, lastSnapshot: blocked, blockedSince: blocked.checkedAt, lastEventKey: key };
  assert.equal(evaluateTransition(previous, current).event, null);
});
