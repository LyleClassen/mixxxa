import { describe, expect, test } from "bun:test";
import type { AutoCueSettings, DropMarker } from "../../shared/types";
import { matchBeatsBefore, planAutoCues } from "./autoCue";

const SETTINGS: AutoCueSettings = {
  rules: [
    { bpmMin: 160, bpmMax: 190, beatsBefore: 64 },
    { bpmMin: 120, bpmMax: 130, beatsBefore: 16 },
  ],
  fallbackBeatsBefore: 32,
  confidenceThreshold: 0.5,
  addStartCue: false,
  addEndCue: false,
  beatsBeforeEnd: 32,
};

function drop(time: number, confidence = 0.9): DropMarker {
  return { time, confidence };
}

describe("matchBeatsBefore", () => {
  test("exact band match", () => {
    expect(matchBeatsBefore(174, SETTINGS)).toBe(64);
    expect(matchBeatsBefore(125, SETTINGS)).toBe(16);
  });

  test("half-time tag (bpm×2 hits a band) halves the beat count", () => {
    // 87-tagged DnB: 87×2 = 174 → 64/2 = 32 beats — same wall-clock lead-in
    expect(matchBeatsBefore(87, SETTINGS)).toBe(32);
  });

  test("double-time tag (bpm÷2 hits a band) doubles the beat count", () => {
    // 250 BPM tag where 125 is the real tempo → 16×2 = 32 beats
    expect(matchBeatsBefore(250, SETTINGS)).toBe(32);
  });

  test("no match falls back", () => {
    expect(matchBeatsBefore(140, SETTINGS)).toBe(32);
  });
});

describe("planAutoCues", () => {
  const BPM = 174;
  const SPB = 60 / BPM;
  const FIRST_BEAT = 0.5;

  test("snaps the drop to the beatgrid and places the lead-in beatsBefore earlier", () => {
    // Just off beat 256 — should snap onto it
    const t = FIRST_BEAT + 256 * SPB + 0.05;
    const cues = planAutoCues([drop(t, 0.91)], BPM, FIRST_BEAT, SETTINGS);

    expect(cues).toHaveLength(2);
    const [leadIn, dropCue] = cues;
    expect(leadIn.slot).toBe(1);
    expect(dropCue.slot).toBe(2);
    expect(dropCue.positionSec).toBeCloseTo(FIRST_BEAT + 256 * SPB, 6);
    expect(leadIn.positionSec).toBeCloseTo(FIRST_BEAT + (256 - 64) * SPB, 6);
    expect(leadIn.comment).toBe("Auto: 64 beats before drop");
    expect(dropCue.comment).toBe("Auto: drop (91%)");
  });

  test("clamps the lead-in to beat 0 when the drop is early", () => {
    const t = FIRST_BEAT + 32 * SPB; // only 32 beats in — lead-in would be -32
    const cues = planAutoCues([drop(t)], BPM, FIRST_BEAT, SETTINGS);

    expect(cues).toHaveLength(2);
    expect(cues[0].positionSec).toBeCloseTo(FIRST_BEAT, 6);
  });

  test("skips the lead-in when it collides with the drop beat", () => {
    const t = FIRST_BEAT; // drop on beat 0 — clamped lead-in lands on the drop
    const cues = planAutoCues([drop(t)], BPM, FIRST_BEAT, SETTINGS);

    expect(cues).toHaveLength(1);
    expect(cues[0].slot).toBe(1); // slots compact in time order — no gap left
    expect(cues[0].comment).toBe("Auto: drop (90%)");
  });

  test("dedupes drops snapping within 8 beats, keeping higher confidence", () => {
    const base = FIRST_BEAT + 256 * SPB;
    const cues = planAutoCues(
      [drop(base, 0.6), drop(base + 4 * SPB, 0.95)],
      BPM, FIRST_BEAT, SETTINGS,
    );

    // One drop survives → one lead-in + one drop cue, from the 0.95 candidate
    expect(cues).toHaveLength(2);
    expect(cues[1].comment).toBe("Auto: drop (95%)");
  });

  test("caps at 4 drops by confidence and assigns slot pairs in time order", () => {
    const at = (beats: number) => FIRST_BEAT + beats * SPB;
    const cues = planAutoCues(
      [
        drop(at(512), 0.95),
        drop(at(128), 0.9),
        drop(at(896), 0.85),
        drop(at(704), 0.8),
        drop(at(320), 0.55), // lowest confidence — dropped by the cap
      ],
      BPM, FIRST_BEAT, SETTINGS,
    );

    expect(cues).toHaveLength(8);
    expect(cues.map((c) => c.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // Drop cues (even slots) are in ascending time order
    const dropPositions = cues.filter((c) => c.slot % 2 === 0).map((c) => c.positionSec);
    expect(dropPositions).toEqual([...dropPositions].sort((a, b) => a - b));
    expect(dropPositions[0]).toBeCloseTo(at(128), 6);
    expect(dropPositions[3]).toBeCloseTo(at(896), 6);
  });

  test("returns nothing without a usable bpm or drops", () => {
    expect(planAutoCues([], BPM, FIRST_BEAT, SETTINGS)).toEqual([]);
    expect(planAutoCues([drop(60)], 0, FIRST_BEAT, SETTINGS)).toEqual([]);
    expect(planAutoCues([drop(60)], NaN, FIRST_BEAT, SETTINGS)).toEqual([]);
  });

  test("places a start cue at the very beginning of the track when enabled", () => {
    const settings = { ...SETTINGS, addStartCue: true };
    const t = FIRST_BEAT + 256 * SPB;
    const cues = planAutoCues([drop(t)], BPM, FIRST_BEAT, settings);

    const start = cues.find((c) => c.comment === "Auto: track start");
    expect(start).toBeDefined();
    expect(start!.slot).toBe(1); // earliest → slot A
    expect(start!.positionSec).toBe(0); // track start, not the first beat
  });

  test("places an end cue beatsBeforeEnd before the duration when enabled", () => {
    const settings = { ...SETTINGS, addEndCue: true, beatsBeforeEnd: 32 };
    const duration = FIRST_BEAT + 400 * SPB;
    const t = FIRST_BEAT + 256 * SPB;
    const cues = planAutoCues([drop(t)], BPM, FIRST_BEAT, settings, duration);

    const end = cues.find((c) => c.comment === "Auto: 32 beats before end");
    expect(end).toBeDefined();
    expect(end!.positionSec).toBeCloseTo(FIRST_BEAT + (400 - 32) * SPB, 6);
    expect(end!.slot).toBe(cues.length); // latest → last slot
  });

  test("skips the end cue when no duration is given", () => {
    const settings = { ...SETTINGS, addEndCue: true };
    const cues = planAutoCues([drop(FIRST_BEAT + 256 * SPB)], BPM, FIRST_BEAT, settings);
    expect(cues.some((c) => c.comment.includes("before end"))).toBe(false);
  });

  test("can plan start/end cues with no drops", () => {
    const settings = { ...SETTINGS, addStartCue: true, addEndCue: true };
    const duration = FIRST_BEAT + 400 * SPB;
    const cues = planAutoCues([], BPM, FIRST_BEAT, settings, duration);

    expect(cues.map((c) => c.comment)).toEqual([
      "Auto: track start",
      "Auto: 32 beats before end",
    ]);
    expect(cues.map((c) => c.slot)).toEqual([1, 2]);
  });

  test("reserves start/end slots so the total never exceeds 8", () => {
    const settings = { ...SETTINGS, addStartCue: true, addEndCue: true };
    const at = (beats: number) => FIRST_BEAT + beats * SPB;
    const duration = at(2000);
    const cues = planAutoCues(
      [
        drop(at(512), 0.95),
        drop(at(128), 0.9),
        drop(at(896), 0.85),
        drop(at(704), 0.8),
        drop(at(1100), 0.75),
      ],
      BPM, FIRST_BEAT, settings, duration,
    );

    // start(1) + end(1) leaves 6 slots → max 3 drops (each lead-in + drop)
    expect(cues.length).toBeLessThanOrEqual(8);
    expect(cues[0].comment).toBe("Auto: track start");
    expect(cues[cues.length - 1].comment).toBe("Auto: 32 beats before end");
    expect(cues.filter((c) => c.comment.startsWith("Auto: drop"))).toHaveLength(3);
    // Slots are contiguous and time-ordered
    expect(cues.map((c) => c.slot)).toEqual(cues.map((_, i) => i + 1));
  });
});
