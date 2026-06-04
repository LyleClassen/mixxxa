import { analyzeBitrate } from "../src/bun/analysis/bitrate";

const filePath = "F://Music//DJ//DnB//Culture Shock - Troglodyte (Original Mix).mp3";

const result = await analyzeBitrate(filePath);

if (result.ok) {
  console.log(`\nResult: ${result.bitrate} kbps (${result.packetCount} packets, ${result.durationSec.toFixed(1)}s)`);
} else {
  console.error(`\nFailed: ${result.reason}`);
}
