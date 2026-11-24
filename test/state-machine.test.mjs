import assert from "node:assert/strict";
import test from "node:test";
import { evaluateTransition, normalizeRateLimits, weeklyResetAt } from "../src/state-machine.mjs";

function payload({ primaryUsed = 20, primaryReset = 2_000, primaryDuration = 300, secondaryUsed = null, secondaryReset = null, secondaryDuration = 10_080, reached = null, credits = null } = {}) {
  return {
    rateLimitsByLimitId: {
      codex: {
        limitId: "codex",
        primary: { usedPercent: primaryUsed, resetsAt: primaryReset, windowDurationMins: primaryDuration },
        secondary: secondaryUsed === null ? null : { usedPercent: secondaryUsed, resetsAt: secondaryReset, windowDurationMins: secondaryDuration },
        rateLimitReachedType: reached,
      },
    },
    rateLimitResetCredits: credits === null ? null : { availableCount: credits, credits: null },
  };
}

function state(snapshot, extra = {}) {
  return { schemaVersion: 2, lastSnapshot: snapshot, blockedSince: null, lastEventKey: null, officialSignal: null, ...extra };
}

test("normalizes account state and earned reset count without opaque credit details", () => {
  const snapshot = normalizeRateLimits(payload({ primaryUsed: 73, credits: 2 }), "codex", new Date("2026-08-12T12:00:00Z"));
  assert.equal(snapshot.status, "available");
  assert.deepEqual(snapshot.resetCredits, { availableCount: 2 });
  assert.equal(JSON.stringify(snapshot).includes("creditId"), false);
});

test("uses the weekly-sized window for the normal refresh display", () => {
  const snapshot = normalizeRateLimits(payload({ secondaryUsed: 40, secondaryReset: 9_000 }));
  assert.equal(weeklyResetAt(snapshot), 9_000);
});

test("backend classification and 100 percent usage are blocked", () => {
  assert.equal(normalizeRateLimits(payload({ primaryUsed: 95, reached: "rate_limit_reached" })).status, "blocked");
  assert.equal(normalizeRateLimits(payload({ primaryUsed: 100 })).status, "blocked");
});

test("first observation and ordinary usage decreases never produce a reset", () => {
  const current = normalizeRateLimits(payload({ primaryUsed: 20 }));
  assert.deepEqual(evaluateTransition(null, current).events, []);
  const previous = state(normalizeRateLimits(payload({ primaryUsed: 80 })));
  assert.deepEqual(evaluateTransition(previous, current).events, []);
});

test("blocked recovery near the expected timestamp is scheduled", () => {
  const expected = Date.parse("2026-08-12T11:00:00Z") / 1000;
  const blocked = normalizeRateLimits(payload({ primaryUsed: 100, primaryReset: expected }), "codex", new Date("2026-08-12T10:00:00Z"));
  const current = normalizeRateLimits(payload({ primaryUsed: 0 }), "codex", new Date("2026-08-12T11:01:00Z"));
  const result = evaluateTransition(state(blocked, { blockedSince: blocked.checkedAt }), current, new Date("2026-08-12T11:01:00Z"));
  assert.equal(result.events[0].type, "SCHEDULED_RESET_CONFIRMED");
});

test("blocked recovery well before the expected timestamp is an extra reset", () => {
  const expected = Date.parse("2026-08-12T18:00:00Z") / 1000;
  const blocked = normalizeRateLimits(payload({ primaryUsed: 100, primaryReset: expected }), "codex", new Date("2026-08-12T10:00:00Z"));
  const current = normalizeRateLimits(payload({ primaryUsed: 0 }), "codex", new Date("2026-08-12T11:00:00Z"));
  const result = evaluateTransition(state(blocked, { blockedSince: blocked.checkedAt }), current, new Date("2026-08-12T11:00:00Z"));
  assert.equal(result.events[0].type, "EXTRA_RESET_CONFIRMED");
});

test("reports a weekly refresh missed while the watcher was offline", () => {
  const oldReset = Date.parse("2026-08-12T11:00:00Z") / 1000;
  const newReset = Date.parse("2026-08-19T11:00:00Z") / 1000;
  const previous = normalizeRateLimits(payload({ secondaryUsed: 30, secondaryReset: oldReset }), "codex", new Date("2026-08-12T10:00:00Z"));
  const current = normalizeRateLimits(payload({ secondaryUsed: 4, secondaryReset: newReset }), "codex", new Date("2026-08-12T12:00:00Z"));
  const result = evaluateTransition(state(previous), current, new Date("2026-08-12T12:00:00Z"));
  assert.equal(result.events[0].type, "SCHEDULED_RESET_CONFIRMED");
});

test("does not infer a weekly refresh merely because the future timestamp moved", () => {
  const oldReset = Date.parse("2026-08-19T11:00:00Z") / 1000;
  const newReset = Date.parse("2026-08-26T11:00:00Z") / 1000;
  const previous = normalizeRateLimits(payload({ secondaryUsed: 30, secondaryReset: oldReset }));
  const current = normalizeRateLimits(payload({ secondaryUsed: 4, secondaryReset: newReset }));
  const result = evaluateTransition(state(previous), current, new Date("2026-08-12T12:00:00Z"));
  assert.deepEqual(result.events, []);
});

test("a newly granted reset credit is distinct from restored quota", () => {
  const previous = normalizeRateLimits(payload({ primaryUsed: 100, credits: 0 }));
  const current = normalizeRateLimits(payload({ primaryUsed: 100, credits: 1 }));
  const result = evaluateTransition(state(previous), current, new Date("2026-08-12T11:00:00Z"));
  assert.equal(result.events[0].type, "RESET_CREDIT_GRANTED");
  assert.match(result.events[0].message, /not been reset automatically/);
});

test("unknown responses fail closed", () => {
  const previous = state(normalizeRateLimits(payload({ primaryUsed: 100 })));
  assert.deepEqual(evaluateTransition(previous, normalizeRateLimits({})).events, []);
});

test("first observed credit balance is not a granted-credit event without a previous count", () => {
  const previous = normalizeRateLimits(payload({ primaryUsed: 100, credits: null }));
  const current = normalizeRateLimits(payload({ primaryUsed: 100, credits: 2 }));
  assert.equal(previous.resetCredits, null);
  assert.deepEqual(evaluateTransition(state(previous), current).events, []);
});

test("credit-granted alert requires a real previous numeric baseline", () => {
  const previous = normalizeRateLimits(payload({ primaryUsed: 100, credits: 0 }));
  const current = normalizeRateLimits(payload({ primaryUsed: 100, credits: 2 }));
  const result = evaluateTransition(state(previous), current);
  assert.equal(result.events.filter((event) => event.type === "RESET_CREDIT_GRANTED").length, 1);
});

test("does not fall back to a different bucket when an explicit bucket is absent", () => {
  const raw = payload().rateLimitsByLimitId.codex;
  const result = normalizeRateLimits({ rateLimitsByLimitId: { codex: raw }, rateLimits: raw }, "other");
  assert.equal(result.status, "unknown");
  assert.equal(result.limitId, "other");
  assert.equal(normalizeRateLimits({ rateLimits: raw }, "other").status, "unknown");
  assert.equal(normalizeRateLimits({ rateLimitsByLimitId: { other: raw } }, "other").status, "unknown");
});

test("accepts matching bucket identities and default legacy snapshots", () => {
  const raw = payload().rateLimitsByLimitId.codex;
  const other = { ...raw, limitId: "other" };
  assert.equal(normalizeRateLimits({ rateLimitsByLimitId: { other } }, "other").status, "available");
  assert.equal(normalizeRateLimits({ rateLimits: other }, "other").status, "available");
  const anonymous = { ...raw };
  delete anonymous.limitId;
  assert.equal(normalizeRateLimits({ rateLimits: anonymous }, "codex").status, "available");
  assert.equal(normalizeRateLimits({ rateLimits: anonymous }, "other").status, "unknown");
  assert.equal(normalizeRateLimits({ rateLimitsByLimitId: { codex: raw }, rateLimits: anonymous }, "other").status, "unknown");
  assert.equal(normalizeRateLimits({ rateLimitsByLimitId: { other: anonymous } }, "other").limitId, "other");
});

test("a different bucket establishes a new baseline without false recovery or credit events", () => {
  const previous = normalizeRateLimits(payload({ primaryUsed: 100, credits: 0 }));
  const other = { ...payload({ credits: 2 }).rateLimitsByLimitId.codex, limitId: "other" };
  const current = normalizeRateLimits({ rateLimits: other, rateLimitResetCredits: { availableCount: 2 } }, "other");
  const result = evaluateTransition(state(previous, { blockedSince: previous.checkedAt, lastEventKey: "old" }), current);
  assert.deepEqual(result.events, []);
  assert.equal(result.nextState.lastSnapshot.limitId, "other");
  assert.equal(result.nextState.blockedSince, null);
  assert.equal(result.nextState.lastEventKey, null);
});

test("a different bucket cannot prove a weekly rollover", () => {
  const previous = normalizeRateLimits(payload({ secondaryUsed: 30, secondaryReset: 2_000 }));
  const other = { ...payload({ secondaryUsed: 20, secondaryReset: 606_800 }).rateLimitsByLimitId.codex, limitId: "other" };
  const current = normalizeRateLimits({ rateLimits: other }, "other");
  assert.deepEqual(evaluateTransition(state(previous), current, new Date(2_100_000)).events, []);
});
