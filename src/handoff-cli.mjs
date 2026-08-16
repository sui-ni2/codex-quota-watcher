#!/usr/bin/env node

import path from "node:path";
import {
  checkpointWorkspace,
  defaultCodexHome,
  inspectHandoff,
  installHandoffAgent,
} from "./handoff.mjs";

function usage() {
  console.log(`Codex local account handoff

Usage:
  codex-handoff checkpoint [WORKSPACE]
  codex-handoff resume [WORKSPACE]
  codex-handoff install-agent [--codex-home PATH]

Commands:
  checkpoint      Capture local Git facts before an explicit account switch.
  resume          Check whether the saved handoff still matches the current worktree.
  install-agent   One-time install of handoff instructions into a profile CODEX_HOME/AGENTS.md.

This tool never reads or copies auth.json, tokens, cookies, provider credentials, or native session stores.`);
}

function parseInstallArgs(args) {
  let codexHome = defaultCodexHome();
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--codex-home") codexHome = path.resolve(args[++index]);
    else throw new Error(`unknown argument: ${args[index]}`);
  }
  return codexHome;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    usage();
    return;
  }

  if (command === "checkpoint") {
    if (args.length > 1) throw new Error("checkpoint accepts at most one workspace path");
    const result = await checkpointWorkspace(args[0] || ".");
    console.log(`handoff checkpoint ready: ${result.handoffDir}`);
    console.log(`branch: ${result.snapshot.branch}`);
    console.log(`head: ${result.snapshot.head}`);
    console.log(`dirty: ${result.snapshot.dirty ? "yes" : "no"}`);
    return;
  }

  if (command === "resume") {
    if (args.length > 1) throw new Error("resume accepts at most one workspace path");
    const result = await inspectHandoff(args[0] || ".");
    if (!result.exists) {
      console.log("no handoff exists yet; reconstruct from the current repository state");
      process.exitCode = 2;
      return;
    }
    console.log(`handoff: ${result.handoffDir}`);
    console.log(`state: ${result.fresh ? "fresh" : "stale"}`);
    console.log(`current branch: ${result.current.branch}`);
    console.log(`current head: ${result.current.head}`);
    if (!result.fresh) {
      console.log("current repository state differs from the saved checkpoint; current files/Git take precedence");
    }
    return;
  }

  if (command === "install-agent") {
    const agentsPath = await installHandoffAgent(parseInstallArgs(args));
    console.log(`handoff agent installed: ${agentsPath}`);
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`codex-handoff failed: ${error.message}`);
  process.exitCode = 1;
});
