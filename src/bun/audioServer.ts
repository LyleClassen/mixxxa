import { getDb } from "./db/localDb";
import { getPcmBuffer } from "./analysis/index";
import { resolveTrackFile } from "./paths/resolveTrackFile";
import { trackFileErrorMessage } from "../shared/trackPath";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type",
  "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
};

let audioServer: ReturnType<typeof Bun.serve> | null = null;
let port = 0;
let _dataDir = "";

export function startAudioServer(dataDir: string): void {
  _dataDir = dataDir;
  audioServer = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(req) {
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      const url = new URL(req.url);

      // PCM endpoint for analysis workers
      const pcmMatch = url.pathname.match(/^\/pcm\/(.+)$/);
      if (pcmMatch) {
        const buf = getPcmBuffer(pcmMatch[1]);
        if (!buf) return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
        return new Response(buf, {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/octet-stream",
            "Content-Length": String(buf.byteLength),
          },
        });
      }

      const match = url.pathname.match(/^\/audio\/(.+)$/);
      if (!match) return new Response("Not Found", { status: 404 });

      const contentId = match[1];
      const db = getDb(_dataDir);
      const row = db.query<{ file_path: string | null }, [string]>(
        "SELECT file_path FROM content WHERE id = ?"
      ).get(contentId);

      const resolution = resolveTrackFile(db, row?.file_path ?? null);
      if (!resolution.ok) {
        const message = trackFileErrorMessage(resolution.reason, resolution.detail);
        return new Response(JSON.stringify({ error: resolution.reason, message }), {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const file = Bun.file(resolution.path);
      // Re-check right before use: the drive can be unmounted between
      // resolveTrackFile's existsSync and here, and Bun.file().size silently
      // returns 0 for a missing file rather than throwing.
      if (!(await file.exists())) {
        return new Response(JSON.stringify({ error: "missing", message: trackFileErrorMessage("missing") }), {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const size = file.size;
      const contentType = file.type || "application/octet-stream";

      const rangeHeader = req.headers.get("Range");
      if (rangeHeader) {
        const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : size - 1;
          return new Response(file.slice(start, end + 1), {
            status: 206,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": contentType,
              "Content-Length": `${end - start + 1}`,
              "Content-Range": `bytes ${start}-${end}/${size}`,
              "Accept-Ranges": "bytes",
            },
          });
        }
      }

      return new Response(file, {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": contentType,
          "Content-Length": `${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    },
  });
  port = audioServer.port ?? 0;
  console.log(`Audio server listening on http://127.0.0.1:${port}`);
}

export function getAudioServerPort(): number {
  return port;
}

export function stopAudioServer(): void {
  audioServer?.stop(true);
  audioServer = null;
}
