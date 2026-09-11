import { describe, expect, test } from "bun:test";
import { rankCandidates } from "./candidates";
import type { AcoustIdResult } from "./acoustid";

describe("rankCandidates", () => {
  test("drops candidates below the 0.5 floor", () => {
    const results: AcoustIdResult[] = [
      { id: "a1", score: 0.4, recordings: [{ id: "rec-1", title: "Low score" }] },
      { id: "a2", score: 0.6, recordings: [{ id: "rec-2", title: "Kept" }] },
    ];
    const candidates = rankCandidates(results, null);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].title).toBe("Kept");
  });

  test("ignores results with no recordings array", () => {
    const results: AcoustIdResult[] = [{ id: "a1", score: 0.95 }];
    expect(rankCandidates(results, null)).toEqual([]);
  });

  test("dedupes the same recording appearing in multiple results, keeping the higher score", () => {
    const results: AcoustIdResult[] = [
      { id: "a1", score: 0.7, recordings: [{ id: "rec-1", title: "X" }] },
      { id: "a2", score: 0.95, recordings: [{ id: "rec-1", title: "X" }] },
    ];
    const candidates = rankCandidates(results, null);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].score).toBe(0.95);
    expect(candidates[0].acoustidTrackId).toBe("a2");
  });

  test("sorts by score descending", () => {
    const results: AcoustIdResult[] = [
      { id: "a1", score: 0.6, recordings: [{ id: "rec-1", title: "Lower" }] },
      { id: "a2", score: 0.9, recordings: [{ id: "rec-2", title: "Higher" }] },
    ];
    const candidates = rankCandidates(results, null);
    expect(candidates.map((c) => c.title)).toEqual(["Higher", "Lower"]);
  });

  test("tiebreaks equal scores by duration proximity to the track", () => {
    const results: AcoustIdResult[] = [
      { id: "a1", score: 0.8, recordings: [{ id: "rec-1", title: "Far", duration: 400 }] },
      { id: "a2", score: 0.8, recordings: [{ id: "rec-2", title: "Close", duration: 202 }] },
    ];
    const candidates = rankCandidates(results, 200);
    expect(candidates.map((c) => c.title)).toEqual(["Close", "Far"]);
  });

  test("joins multiple artist credits and picks the first release group as album", () => {
    const results: AcoustIdResult[] = [
      {
        id: "a1",
        score: 0.95,
        recordings: [
          {
            id: "rec-1",
            title: "Song",
            artists: [{ name: "Artist A" }, { name: "Artist B" }],
            releasegroups: [{ title: "Album One" }, { title: "Album Two" }],
          },
        ],
      },
    ];
    const [candidate] = rankCandidates(results, null);
    expect(candidate.artist).toBe("Artist A, Artist B");
    expect(candidate.album).toBe("Album One");
  });
});
