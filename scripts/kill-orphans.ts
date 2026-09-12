#!/usr/bin/env bun
/**
 * Kill processes left behind by a previous `bun go`.
 *
 * Closing the app window exits Electrobun cleanly, and a clean exit does not
 * always take the Vite HMR server with it. The orphan keeps port 5173, so the
 * next `bun go` cannot bind it — and because the port still answers, the app
 * used to load that dead server instead of the real view.
 *
 * Targets are deliberately narrow. Nothing outside this repo is ever a
 * candidate: we match only the HMR port, executables inside the app's build
 * directory, and Vite started from this repo's node_modules.
 *
 *   bun run kill-orphans            kill them
 *   bun run kill-orphans --dry-run  list them and exit
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

const HMR_PORT = 5173;
const REPO_ROOT = path.resolve(import.meta.dir, "..");
const BUILD_DIR = path.join(REPO_ROOT, "apps", "mixxxa", "build");

const dryRun = process.argv.includes("--dry-run");
const isWindows = process.platform === "win32";

type Candidate = { pid: number; name: string; reason: string };

/** Case-insensitive on Windows, and \ and / are interchangeable there. */
const normalise = (value: string) =>
	isWindows ? value.replace(/\\/g, "/").toLowerCase() : value;

const BUILD_DIR_MATCH = normalise(BUILD_DIR);
const VITE_BIN_MATCH = normalise(path.join(REPO_ROOT, "node_modules"));

function run(file: string, args: string[]): string {
	try {
		return execFileSync(file, args, {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			// A full process enumeration on a busy machine is not instant.
			timeout: 30_000,
			windowsHide: true,
		});
	} catch {
		// No matches, or the tool is unavailable. Either way there is nothing to
		// report from this probe — other probes still run.
		return "";
	}
}

/** PIDs holding the HMR port, whoever they belong to. */
function pidsOnHmrPort(): number[] {
	const out = isWindows
		? run("powershell.exe", [
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				`Get-NetTCPConnection -LocalPort ${HMR_PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
			])
		: run("lsof", ["-ti", `tcp:${HMR_PORT}`, "-sTCP:LISTEN"]);

	return out
		.split(/\r?\n/)
		.map((line) => Number.parseInt(line.trim(), 10))
		.filter((pid) => Number.isInteger(pid) && pid > 0);
}

type ProcessRow = { pid: number; name: string; haystack: string };

/** Every running process, reduced to the fields we match on. */
function listProcesses(): ProcessRow[] {
	if (isWindows) {
		const json = run("powershell.exe", [
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			"Get-CimInstance Win32_Process | Select-Object ProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Compress",
		]);
		if (!json.trim()) return [];
		let parsed: unknown;
		try {
			parsed = JSON.parse(json);
		} catch {
			return [];
		}
		// ConvertTo-Json collapses a single result to an object, not an array.
		const rows = Array.isArray(parsed) ? parsed : [parsed];
		return rows.flatMap((row) => {
			const r = row as {
				ProcessId?: number;
				Name?: string;
				ExecutablePath?: string | null;
				CommandLine?: string | null;
			};
			if (typeof r.ProcessId !== "number") return [];
			return [
				{
					pid: r.ProcessId,
					name: r.Name ?? "?",
					haystack: normalise(
						`${r.ExecutablePath ?? ""} ${r.CommandLine ?? ""}`,
					),
				},
			];
		});
	}

	return run("ps", ["-axo", "pid=,comm=,args="])
		.split("\n")
		.flatMap((line) => {
			const match = line.trim().match(/^(\d+)\s+(\S+)\s*(.*)$/);
			if (!match) return [];
			return [
				{
					pid: Number.parseInt(match[1]!, 10),
					name: path.basename(match[2]!),
					haystack: normalise(`${match[2]} ${match[3]}`),
				},
			];
		});
}

function collect(): Candidate[] {
	const processes = listProcesses();
	const byPid = new Map(processes.map((p) => [p.pid, p]));
	const found = new Map<number, Candidate>();

	const add = (pid: number, name: string, reason: string) => {
		// Never target this script or the shell that launched it.
		if (pid === process.pid || pid === process.ppid) return;
		if (byPid.get(pid)?.haystack.includes("kill-orphans")) return;
		if (!found.has(pid)) found.set(pid, { pid, name, reason });
	};

	for (const pid of pidsOnHmrPort()) {
		add(pid, byPid.get(pid)?.name ?? "?", `listening on port ${HMR_PORT}`);
	}

	for (const proc of processes) {
		if (proc.haystack.includes(BUILD_DIR_MATCH)) {
			add(proc.pid, proc.name, "running from the app build directory");
			continue;
		}
		// A Vite launched from this repo that is not holding the port at all —
		// e.g. it bound a fallback port, or is mid-shutdown.
		if (
			proc.haystack.includes("vite") &&
			proc.haystack.includes(VITE_BIN_MATCH)
		) {
			add(proc.pid, proc.name, "vite from this repo");
		}
	}

	return [...found.values()].sort((a, b) => a.pid - b.pid);
}

function kill(pid: number): boolean {
	if (isWindows) {
		// /T takes the tree with it: launcher spawns bun, which spawns the
		// sidecar and ffmpeg.
		return run("taskkill", ["/PID", String(pid), "/T", "/F"]) !== "";
	}
	try {
		process.kill(pid, "SIGKILL");
		return true;
	} catch {
		return false;
	}
}

const candidates = collect();

if (candidates.length === 0) {
	console.log("No orphaned mixxxa processes found.");
	process.exit(0);
}

console.log(
	`Found ${candidates.length} orphaned process${candidates.length === 1 ? "" : "es"}:`,
);
for (const c of candidates) {
	console.log(`  ${c.pid}\t${c.name}\t(${c.reason})`);
}

if (dryRun) {
	console.log("\n--dry-run: nothing was killed.");
	process.exit(0);
}

let failed = 0;
for (const c of candidates) {
	// A tree kill may already have taken a later candidate with it, so a
	// failure here is usually "already gone" rather than a real problem.
	const ok = kill(c.pid);
	console.log(`${ok ? "killed  " : "skipped "} ${c.pid} ${c.name}`);
	if (!ok) failed += 1;
}

const stillHeld = pidsOnHmrPort();
if (stillHeld.length > 0) {
	console.error(
		`\nPort ${HMR_PORT} is still held by ${stillHeld.join(", ")}. Kill it manually and rerun.`,
	);
	process.exit(1);
}

console.log(
	`\nPort ${HMR_PORT} is free.${failed > 0 ? ` ${failed} process(es) were already gone.` : ""}`,
);
