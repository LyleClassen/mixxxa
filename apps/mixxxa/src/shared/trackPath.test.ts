import { describe, expect, test } from "bun:test";
import { applyVolumeMappings, classifyRekordboxPath, getVolumeRoot } from "./trackPath";

describe("classifyRekordboxPath", () => {
  test("POSIX path, unchanged", () => {
    expect(classifyRekordboxPath("/Volumes/External/Music/a.mp3")).toEqual({
      kind: "file",
      path: "/Volumes/External/Music/a.mp3",
    });
  });

  test("Windows path with backslashes", () => {
    expect(classifyRekordboxPath("E:\\Music\\DJ\\a.mp3")).toEqual({
      kind: "file",
      path: "E:/Music/DJ/a.mp3",
    });
  });

  test("Windows path with forward slashes, unchanged", () => {
    expect(classifyRekordboxPath("E:/Music/a.mp3")).toEqual({
      kind: "file",
      path: "E:/Music/a.mp3",
    });
  });

  test("UNC path", () => {
    expect(classifyRekordboxPath("\\\\nas\\share\\a.mp3")).toEqual({
      kind: "file",
      path: "//nas/share/a.mp3",
    });
  });

  test("file:// URL with encoded space", () => {
    expect(classifyRekordboxPath("file://localhost/Users/x/a%20b.mp3")).toEqual({
      kind: "file",
      path: "/Users/x/a b.mp3",
    });
  });

  test("file:/// URL without host", () => {
    expect(classifyRekordboxPath("file:///Volumes/External/a.mp3")).toEqual({
      kind: "file",
      path: "/Volumes/External/a.mp3",
    });
  });

  test("Spotify URI", () => {
    expect(classifyRekordboxPath("spotify:track:0JI8koDoC5crQbIjhSty59")).toEqual({
      kind: "streaming",
      service: "spotify",
    });
  });

  test("Apple Music catalog path", () => {
    expect(classifyRekordboxPath("/v4/catalog/tracks/24341612/")).toEqual({
      kind: "streaming",
      service: "applemusic",
    });
  });

  test("null", () => {
    expect(classifyRekordboxPath(null)).toEqual({ kind: "none" });
  });

  test("empty string", () => {
    expect(classifyRekordboxPath("")).toEqual({ kind: "none" });
  });

  test("whitespace only", () => {
    expect(classifyRekordboxPath("   ")).toEqual({ kind: "none" });
  });

  test("duplicate separators collapsed", () => {
    expect(classifyRekordboxPath("/Volumes/External//Music///a.mp3")).toEqual({
      kind: "file",
      path: "/Volumes/External/Music/a.mp3",
    });
  });
});

describe("applyVolumeMappings", () => {
  test("applies a single matching mapping", () => {
    const result = applyVolumeMappings("E:/Music/x.mp3", [
      { from: "E:/Music", to: "/Volumes/External/Music" },
    ]);
    expect(result).toBe("/Volumes/External/Music/x.mp3");
  });

  test("longest prefix wins when mappings overlap", () => {
    const mappings = [
      { from: "E:/", to: "/Volumes/Wrong" },
      { from: "E:/Music", to: "/Volumes/External/Music" },
    ];
    expect(applyVolumeMappings("E:/Music/x.mp3", mappings)).toBe("/Volumes/External/Music/x.mp3");
  });

  test("no match leaves the path unchanged", () => {
    expect(applyVolumeMappings("/Volumes/External/x.mp3", [{ from: "E:/Music", to: "/Volumes/External/Music" }]))
      .toBe("/Volumes/External/x.mp3");
  });

  test("drive letter is matched case-insensitively", () => {
    expect(applyVolumeMappings("e:/Music/x.mp3", [{ from: "E:/Music", to: "/Volumes/External/Music" }]))
      .toBe("/Volumes/External/Music/x.mp3");
  });
});

describe("getVolumeRoot", () => {
  test("macOS external volume", () => {
    expect(getVolumeRoot("/Volumes/External/Music/a.mp3")).toBe("/Volumes/External");
  });

  test("Windows drive", () => {
    expect(getVolumeRoot("E:/Music/a.mp3")).toBe("E:/");
  });

  test("UNC share", () => {
    expect(getVolumeRoot("//nas/share/a.mp3")).toBe("//nas/share");
  });

  test("home directory falls back to root", () => {
    expect(getVolumeRoot("/Users/me/Music/a.mp3")).toBe("/");
  });
});
