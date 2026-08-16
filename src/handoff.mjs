import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const HANDOFF_DIR = ".codex-handoff";
const FACTS_FILE = "FACTS.md";
const FACTS_JSON_FILE = "facts.json";
const HANDOFF_FILE = "HANDOFF.md";
const EXCLUDE_LINE = `${HANDOFF_DIR}/`;
const MAX_STATUS_LINES = 200;
const MAX_COMMITS = 5;

const SENSITIVE_PARTS = new Set([
  ".env",
  ".secrets",
  "secrets",
  "credentials",
  "cookies",
  "browser-profiles",
]);
const SENSITIVE_SUFFIXES = [".key", ".pem", ".p12", ".pfx"];

export const AGENT_BLOCK_START = "<!-- codex-quota-watcher:handoff:start -->";
export const AGENT_BLOCK_END = "<!-- codex-quota-watcher:handoff:end -->";

const AGENT_BLOCK = `${AGENT_BLOCK_START}
## Local account handoff

This profile participates in local Codex account handoff. The Git worktree is the source of truth; do not assume another ChatGPT/Codex account shares this profile's native thread history.

- At the start of work in a Git repository, if \`.codex-handoff/HANDOFF.md\` exists, read it together with \`.codex-handoff/FACTS.md\` before changing files.
- Before an explicit user-requested account switch, run \`codex-handoff checkpoint .\`, then update only these sections in \`.codex-handoff/HANDOFF.md\`: Objective, Completed, Decisions / constraints, Blockers, Next action.
- Keep the semantic handoff concise (target <= 80 lines). Never copy credentials, tokens, cookies, private chain-of-thought, full chat transcripts, or large source/diff bodies into it.
- If the prior account ended before writing semantic context, run \`codex-handoff resume .\`, reconstruct only from current Git/files, and mark any remaining context gap instead of inventing it.
- Current repository state overrides a stale handoff.
${AGENT_BLOCK_END}`;

function normalizePathForSafety(value) {
  return value.replaceAll("\\", "/").toLowerCase();
}

export function safeDisplayPath(value) {
  const raw = String(value || "").trim().replace(/^"|"$/g, "");
  const normalized = normalizePathForSafety(raw);
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => SENSITIVE_PARTS.has(part))) return "[sensitive path omitted]";
  if (SENSITIVE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return "[sensitive path omitted]";
  return raw;
}

async function git(root, ...args) {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trimEnd();
}

export async function resolveGitRoot(workspace = ".") {
  const candidate = path.resolve(workspace);
  const root = await git(candidate, "rev-parse", "--show-toplevel");
  return path.resolve(root);
}

function parseStatus(raw) {
  const items = [];
  for (const line of raw.split(/\r?\n/).filter(Boolean).slice(0, MAX_STATUS_LINES)) {
    if (line.length < 3) continue;
    const status = line.slice(0, 2);
    const rawPath = line.slice(3);
    let displayPath;
    if (rawPath.includes(" -> ")) {
      const [before, after] = rawPath.split(" -> ", 2);
      displayPath = `${safeDisplayPath(before)} -> ${safeDisplayPath(after)}`;
    } else {
      displayPath = safeDisplayPath(rawPath);
    }
    items.push({ status, path: displayPath });
  }
  return items;
}

function parseCommits(raw) {
  return raw.split(/\r?\n/).filter(Boolean).slice(0, MAX_COMMITS).map((line) => {
    const tab = line.indexOf("\t");
    if (tab === -1) return { sha: line, subject: "" };
    return { sha: line.slice(0, tab), subject: line.slice(tab + 1) };
  });
}

export function snapshotFingerprint(snapshot) {
  const stable = {
    repository: snapshot.repository,
    branch: snapshot.branch,
    head: snapshot.head,
    status: snapshot.status,
    unstagedSummary: snapshot.unstagedSummary,
    stagedSummary: snapshot.stagedSummary,
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export async function collectGitFacts(workspace = ".") {
  const root = await resolveGitRoot(workspace);
  const [branchRaw, head, statusRaw, unstagedRaw, stagedRaw, commitsRaw] = await Promise.all([
    git(root, "branch", "--show-current"),
    git(root, "rev-parse", "HEAD"),
    git(root, "status", "--porcelain=v1", "--untracked-files=all"),
    git(root, "diff", "--shortstat", "--"),
    git(root, "diff", "--cached", "--shortstat", "--"),
    git(root, "log", `-${MAX_COMMITS}`, "--pretty=format:%h%x09%s"),
  ]);

  const snapshot = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    repository: path.basename(root),
    root,
    branch: branchRaw || "(detached HEAD)",
    head,
    dirty: Boolean(statusRaw.trim()),
    status: parseStatus(statusRaw),
    unstagedSummary: unstagedRaw || "clean",
    stagedSummary: stagedRaw || "clean",
    recentCommits: parseCommits(commitsRaw),
    note: "Git facts only; no source-file contents, credentials, chat transcript, or private reasoning are captured.",
  };
  return { ...snapshot, fingerprint: snapshotFingerprint(snapshot) };
}

async function ensureLocalExclude(root) {
  const excludePath = path.join(root, ".git", "info", "exclude");
  await mkdir(path.dirname(excludePath), { recursive: true });
  let current = "";
  try {
    current = await readFile(excludePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const lines = current.split(/\r?\n/);
  if (!lines.includes(EXCLUDE_LINE)) {
    const next = `${current}${current && !current.endsWith("\n") ? "\n" : ""}${EXCLUDE_LINE}\n`;
    await writeFile(excludePath, next, "utf8");
  }
}

function renderFacts(snapshot) {
  const status = snapshot.status.length
    ? snapshot.status.map((item) => `- \`${item.status}\` \`${item.path}\``)
    : ["- Working tree clean."];
  const commits = snapshot.recentCommits.length
    ? snapshot.recentCommits.map((item) => `- \`${item.sha}\` ${item.subject}`)
    : ["- No commits found."];
  return [
    "# Codex Handoff Facts",
    "",
    `Generated: \`${snapshot.generatedAt}\``,
    `Repository: \`${snapshot.repository}\``,
    `Branch: \`${snapshot.branch}\``,
    `HEAD: \`${snapshot.head}\``,
    `Fingerprint: \`${snapshot.fingerprint}\``,
    `Unstaged: ${snapshot.unstagedSummary}`,
    `Staged: ${snapshot.stagedSummary}`,
    "",
    "## Working tree",
    ...status,
    "",
    "## Recent commits",
    ...commits,
    "",
    "> Local-only factual snapshot. No source-file contents or secrets are copied here.",
    "",
  ].join("\n");
}

function defaultHandoffTemplate() {
  return [
    "# Codex Account Handoff",
    "",
    "Keep this compact. Record only semantic context Git cannot reconstruct; never include credentials, tokens, cookies, private reasoning, or full chat transcripts.",
    "",
    "## Objective",
    "- Pending first handoff.",
    "",
    "## Completed",
    "- None recorded yet.",
    "",
    "## Decisions / constraints",
    "- None recorded yet.",
    "",
    "## Blockers",
    "- None recorded yet.",
    "",
    "## Next action",
    "- Read `FACTS.md`, inspect the current repository state, and continue from verified local evidence.",
    "",
  ].join("\n");
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function checkpointWorkspace(workspace = ".") {
  const snapshot = await collectGitFacts(workspace);
  const handoffDir = path.join(snapshot.root, HANDOFF_DIR);
  await ensureLocalExclude(snapshot.root);
  await mkdir(handoffDir, { recursive: true });
  await writeFile(path.join(handoffDir, FACTS_JSON_FILE), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await writeFile(path.join(handoffDir, FACTS_FILE), renderFacts(snapshot), "utf8");
  const handoffPath = path.join(handoffDir, HANDOFF_FILE);
  try {
    await readFile(handoffPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(handoffPath, defaultHandoffTemplate(), "utf8");
  }
  return { root: snapshot.root, handoffDir, snapshot };
}

export async function inspectHandoff(workspace = ".") {
  const current = await collectGitFacts(workspace);
  const handoffDir = path.join(current.root, HANDOFF_DIR);
  const saved = await readJsonIfExists(path.join(handoffDir, FACTS_JSON_FILE));
  let semantic = null;
  try {
    semantic = await readFile(path.join(handoffDir, HANDOFF_FILE), "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return {
    root: current.root,
    handoffDir,
    exists: Boolean(saved || semantic),
    fresh: Boolean(saved && saved.fingerprint === current.fingerprint),
    saved,
    current,
    semantic,
  };
}

export function defaultCodexHome() {
  return process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(os.homedir(), ".codex");
}

export async function installHandoffAgent(codexHome = defaultCodexHome()) {
  const home = path.resolve(codexHome);
  await mkdir(home, { recursive: true });
  const agentsPath = path.join(home, "AGENTS.md");
  let current = "";
  try {
    current = await readFile(agentsPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const start = current.indexOf(AGENT_BLOCK_START);
  const end = current.indexOf(AGENT_BLOCK_END);
  let next;
  if (start !== -1 && end !== -1 && end >= start) {
    next = `${current.slice(0, start)}${AGENT_BLOCK}${current.slice(end + AGENT_BLOCK_END.length)}`;
  } else {
    const prefix = current.trimEnd();
    next = `${prefix}${prefix ? "\n\n" : ""}${AGENT_BLOCK}\n`;
  }
  await writeFile(agentsPath, next, "utf8");
  return agentsPath;
}
