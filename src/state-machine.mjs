const BLOCKED_STATUSES = new Set([
  "rate_limit_reached",
  "workspace_owner_credits_depleted",
  "workspace_member_credits_depleted",
  "workspace_owner_usage_limit_reached",
  "workspace_member_usage_limit_reached",
]);

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function safeWindow(window) {
  if (!window || typeof window !== "object") return null;
  const usedPercent = finiteNumber(window.usedPercent);
  if (usedPercent === null) return null;
  return {
    usedPercent,
    resetsAt: finiteNumber(window.resetsAt),
    windowDurationMins: finiteNumber(window.windowDurationMins),
  };
}

export function normalizeRateLimits(payload, limitId = "codex", checkedAt = new Date()) {
  const byId = payload?.rateLimitsByLimitId;
  const raw = byId && typeof byId === "object" && byId[limitId]
    ? byId[limitId]
    : payload?.rateLimits;

  if (!raw || typeof raw !== "object") {
    return { status: "unknown", limitId, checkedAt: checkedAt.toISOString() };
  }

  const primary = safeWindow(raw.primary);
  const secondary = safeWindow(raw.secondary);
  const reachedType = typeof raw.rateLimitReachedType === "string"
    ? raw.rateLimitReachedType
    : null;
  const spendControlReached = raw.spendControlReached === true;
  const usedUp = [primary, secondary].some((window) => window?.usedPercent >= 100);
  const backendBlocked = reachedType !== null && BLOCKED_STATUSES.has(reachedType);
  const hasEvidence = primary !== null || secondary !== null || backendBlocked || spendControlReached;

  if (!hasEvidence) {
    return { status: "unknown", limitId, checkedAt: checkedAt.toISOString() };
  }

  return {
    status: backendBlocked || spendControlReached || usedUp ? "blocked" : "available",
    limitId: typeof raw.limitId === "string" ? raw.limitId : limitId,
    reachedType,
    primary,
    secondary,
    checkedAt: checkedAt.toISOString(),
  };
}

export function evaluateTransition(previousState, currentSnapshot, now = new Date()) {
  const previous = previousState?.lastSnapshot ?? null;
  const nextState = {
    schemaVersion: 1,
    lastSnapshot: currentSnapshot,
    blockedSince: previousState?.blockedSince ?? null,
    lastEventKey: previousState?.lastEventKey ?? null,
  };

  if (currentSnapshot.status === "blocked" && !nextState.blockedSince) {
    nextState.blockedSince = currentSnapshot.checkedAt;
  }

  if (currentSnapshot.status !== "available" || previous?.status !== "blocked") {
    return { event: null, nextState };
  }

  const eventKey = `${currentSnapshot.limitId}:${nextState.blockedSince ?? previous.checkedAt}:available`;
  nextState.blockedSince = null;
  nextState.lastEventKey = eventKey;

  if (previousState?.lastEventKey === eventKey) {
    return { event: null, nextState };
  }

  return {
    event: {
      type: "RESET_CONFIRMED",
      limitId: currentSnapshot.limitId,
      occurredAt: now.toISOString(),
      message: "Codex quota is available again.",
    },
    nextState,
  };
}
