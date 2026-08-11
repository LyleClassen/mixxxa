import { analyzeBitrate } from "../src/bun/analysis/bitrate";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: bun scripts/bitrate-analysis.ts <path-to-audio-file>");
  process.exit(1);
}

const result = await analyzeBitrate(filePath);

if (result.ok) {
  console.log(`\nResult: ${result.bitrate} kbps (${result.packetCount} packets, ${result.durationSec.toFixed(1)}s)`);
} else {
  console.error(`\nFailed: ${result.reason}`);
}
