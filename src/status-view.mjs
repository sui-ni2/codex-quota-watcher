import { weeklyResetAt } from "./state-machine.mjs";

function localeFor(language) {
  if (language === "zh") return "zh-CN";
  if (language === "en") return "en-US";
  return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
}

function isChinese(locale) {
  return locale.toLowerCase().startsWith("zh");
}

function dateText(epochSeconds, locale) {
  if (!epochSeconds) return isChinese(locale) ? "未知" : "Unknown";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(epochSeconds * 1000));
}

function usageText(snapshot, zh) {
  const windows = [snapshot.primary, snapshot.secondary].filter(Boolean);
  const maximum = windows.length ? Math.max(...windows.map((item) => item.usedPercent)) : null;
  const status = snapshot.status === "blocked" ? (zh ? "受限" : "Limited") : (zh ? "可用" : "Available");
  return maximum === null ? status : `${status} · ${zh ? "最高已用" : "max used"} ${maximum}%`;
}

export function renderStatus(snapshot, state, language = "auto") {
  const locale = localeFor(language);
  const zh = isChinese(locale);
  const signal = state?.officialSignal;
  const extra = signal
    ? (zh ? `可能 · ${signal.confidence === "high" ? "高" : "低"}` : `Possible · ${signal.confidence}`)
    : (zh ? "暂无可靠信号" : "No reliable signal");
  const rows = zh
    ? [["每周刷新", dateText(weeklyResetAt(snapshot), locale)], ["额外重置", extra], ["当前状态", usageText(snapshot, true)]]
    : [["Weekly refresh", dateText(weeklyResetAt(snapshot), locale)], ["Extra reset", extra], ["Current status", usageText(snapshot, false)]];
  const title = zh ? "Codex 额度" : "Codex quota";
  const output = [title, "─".repeat(28)];
  for (const [label, value] of rows) output.push(`${label.padEnd(14)}${value}`);
  return output.join("\n");
}
