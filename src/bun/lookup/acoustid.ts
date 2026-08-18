/**
 * AcoustID fingerprint lookup client. Application key is a bundled constant —
 * it identifies Mixxxa, not the user, and isn't a secret (see
 * .scratch/fingerprint-lookup/issues/02-register-acoustid-key.md). Free tier
 * is non-commercial only and capped at 3 requests/second; requests are run
 * through a small serial queue that enforces that cap.
 */

const ACOUSTID_CLIENT_KEY = "4pxMQKhebq";
const ACOUSTID_URL = "https://api.acoustid.org/v2/lookup";
const MIN_INTERVAL_MS = 340; // just under 3 req/s

export interface AcoustIdRecording {
  id: string;
  title?: string;
  duration?: number;
  artists?: Array<{ id?: string; name: string }>;
  releasegroups?: Array<{ id?: string; title?: string; type?: string }>;
}

export interface AcoustIdResult {
  id: string;
  score: number;
  recordings?: AcoustIdRecording[];
}

interface AcoustIdResponse {
  status: "ok" | "error";
  results?: AcoustIdResult[];
  error?: { code: number; message: string };
}

// Serial queue shared by every caller (single-track lookups and any future
// bulk scan) so the combined request rate never exceeds AcoustID's cap.
let queueTail: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function scheduleRequest<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return fn();
  });
  queueTail = run.catch(() => undefined);
  return run;
}

export async function lookupFingerprint(fingerprint: string, durationSec: number): Promise<AcoustIdResult[]> {
  return scheduleRequest(async () => {
    const body = new URLSearchParams({
      client: ACOUSTID_CLIENT_KEY,
      duration: String(Math.round(durationSec)),
      fingerprint,
      // AcoustID's documented "recordings+releasegroups" separator is a
      // URL-encoded space — pass real spaces so URLSearchParams encodes them
      // as '+'. A literal '+' becomes %2B and the meta param is ignored,
      // returning matches with no recording metadata.
      meta: "recordings releasegroups compress",
    }).toString();
    const gzipped = Bun.gzipSync(new TextEncoder().encode(body));

    const res = await fetch(ACOUSTID_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Encoding": "gzip",
      },
      body: gzipped,
    });

    if (!res.ok) {
      throw new Error(`AcoustID request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as AcoustIdResponse;
    if (data.status !== "ok") {
      throw new Error(data.error?.message ?? "AcoustID returned an error");
    }
    return data.results ?? [];
  });
}
