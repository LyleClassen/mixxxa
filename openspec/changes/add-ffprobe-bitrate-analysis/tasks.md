## 1. Database Schema

- [ ] 1.1 Add `analyzed_bitrate INTEGER` column to the `content` table in `src/bun/db/schema.ts`
- [ ] 1.2 Add `time_bitrate_ms INTEGER` column to `content` for per-aspect timing consistency
- [ ] 1.3 Apply a runtime migration (ALTER TABLE IF NOT EXISTS pattern) so existing databases gain the new columns without a full rebuild

## 2. Types & Shared Interfaces

- [ ] 2.1 Add `"bitrate"` to the `AnalysisAspect` union type in `src/shared/types.ts`
- [ ] 2.2 Add `analyzed_bitrate` and `time_bitrate_ms` to the track result/row types used across Bun and renderer

## 3. ffprobe Bitrate Computation

- [ ] 3.1 Create `src/bun/analysis/bitrate.ts` that spawns ffprobe via `Bun.spawn()` with `-v quiet -select_streams a:0 -show_packets -show_entries packet=size,duration_time -of csv=p=0` and resolves the bundled ffprobe path the same way `decoder.ts` resolves ffmpeg
- [ ] 3.2 Parse stdout line-by-line, summing `size` fields and accumulating `duration_time` to compute `(total_bytes * 8) / duration_seconds / 1000` rounded to an integer kbps
- [ ] 3.3 Handle failure cases: non-zero exit code, empty packet output, and missing audio file — return a typed `{ ok: false, reason: string }` result

## 4. Analysis Orchestration Integration

- [ ] 4.1 In `src/bun/analysis/index.ts`, add a Bun-side branch for the `bitrate` aspect that calls the ffprobe helper directly (bypassing the renderer worker PCM path)
- [ ] 4.2 Add `"bitrate"` to the phase reporting sequence so the queue item shows a `bitrate` phase label and progress update during measurement
- [ ] 4.3 On successful bitrate result, write `analyzed_bitrate` and `time_bitrate_ms` to the database and include them in the history entry
- [ ] 4.4 On bitrate failure, mark only that aspect as failed (consistent with how individual aspect failures are handled for other aspects)

## 5. Analysis Settings

- [ ] 5.1 In `src/bun/analysis/settings.ts`, add `bitrate` to the valid aspects list with a default value of `false` (opt-in)
- [ ] 5.2 In `src/mainview/SettingsPage.tsx`, add a Bitrate checkbox in the analysis aspects section alongside Key, BPM, Energy, Mood, and Genre

## 6. Track Table

- [ ] 6.1 Add `analyzed_bitrate` as an available column in `src/mainview/TrackTable.tsx`, hidden by default, toggleable through the column manager
- [ ] 6.2 When both `bit_rate` (metadata) and `analyzed_bitrate` are present and `|analyzed_bitrate - bit_rate| > 10`, render a visual mismatch indicator on the analyzed bitrate cell (e.g., a warning icon or accent color)
