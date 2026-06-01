import { existsSync } from "node:fs";
import { getDb } from "./db/localDb";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range",
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
      const match = url.pathname.match(/^\/audio\/(.+)$/);
      if (!match) return new Response("Not Found", { status: 404 });

      const contentId = match[1];
      const db = getDb(_dataDir);
      const row = db.query<{ file_path: string | null }, [string]>(
        "SELECT file_path FROM content WHERE id = ?"
      ).get(contentId);

      if (!row || !row.file_path || !existsSync(row.file_path)) {
        return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
      }

      const file = Bun.file(row.file_path);
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
