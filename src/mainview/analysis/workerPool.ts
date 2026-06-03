/**
 * WorkerPool — manages N analysis Web Workers sized by parallelism setting.
 * Relays RPC calls between workers and the Bun process.
 */

import type { AnalysisSettings } from "../../shared/types";

type RpcFn = (method: string, params?: unknown) => Promise<unknown>;

let rpcCall: RpcFn | null = null;
const workers: Worker[] = [];

function spawnWorker(): Worker {
  const worker = new Worker(
    new URL("./analysisWorker.ts", import.meta.url),
    { type: "module" },
  );

  worker.addEventListener("message", async (e: MessageEvent) => {
    const msg = e.data as { type: string; id?: number; method?: string; params?: unknown };
    if (msg.type === "rpc" && msg.id !== undefined && msg.method && rpcCall) {
      try {
        const result = await rpcCall(msg.method, msg.params);
        worker.postMessage({ type: "rpc_response", id: msg.id, result });
      } catch (err) {
        worker.postMessage({ type: "rpc_response", id: msg.id, error: String(err) });
      }
    } else if (msg.type === "ready") {
      worker.postMessage({ type: "start" });
    }
  });

  return worker;
}

export function initWorkerPool(settings: AnalysisSettings, rpc: RpcFn): void {
  rpcCall = rpc;
  setPoolSize(settings.parallelism, rpc);
}

export function setPoolSize(parallelism: number, rpc?: RpcFn): void {
  if (rpc) rpcCall = rpc;

  const target = Math.max(1, Math.min(8, parallelism));

  while (workers.length > target) {
    workers.pop()?.terminate();
  }
  while (workers.length < target) {
    workers.push(spawnWorker());
  }
}

export function terminateAll(): void {
  for (const w of workers) w.terminate();
  workers.length = 0;
}
