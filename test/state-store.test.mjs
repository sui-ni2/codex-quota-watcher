import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadState, saveState } from "../src/state-store.mjs";

test("persists and reloads state atomically", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-quota-watcher-"));
  const file = path.join(directory, "nested", "state.json");
  const state = { schemaVersion: 1, lastSnapshot: { status: "available" } };
  try {
    await saveState(file, state);
    assert.deepEqual(await loadState(file), state);
    assert.match(await readFile(file, "utf8"), /"schemaVersion": 1/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
