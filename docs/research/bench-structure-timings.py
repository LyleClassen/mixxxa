"""Instrumented wall-clock spike for all-in-one-infer on CPU (mixxxa #30)."""
import json, os, sys, time, threading, gc
from pathlib import Path

import subprocess
import psutil

MODEL = sys.argv[1] if len(sys.argv) > 1 else "harmonix-all"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else f"results-{MODEL}.json")

TRACKS = [
    ("3min", r"F:/Music/DJ/AB - Sat End Space Church/UH.mp3", 180),
    ("5.5min", r"F:/Music/DJ/Ama Pianos/Musa Keys, Konke & Chley - M'nike (Official Audio) feat. Sayfar.mp3", 330),
    ("8min", 'F:/Music/DJ/Ama Pianos/Abuti Wadi Spvrclez, II Wise Fellas & Major Keys – Mana Kancane (feat. ChillyboyRsa, Nox Man... 🔥🔥🔥.mp3', 480),
]

# ---- peak RSS sampler (this process + children) ----
_peak = {"rss": 0}
_stop = threading.Event()
def _sample():
    me = psutil.Process()
    while not _stop.is_set():
        try:
            tot = me.memory_info().rss
            for c in me.children(recursive=True):
                try: tot += c.memory_info().rss
                except psutil.Error: pass
            _peak["rss"] = max(_peak["rss"], tot)
        except psutil.Error: pass
        _stop.wait(0.25)
threading.Thread(target=_sample, daemon=True).start()

def peak_mb(): return round(_peak["rss"] / 1024 / 1024, 1)
def reset_peak(): _peak["rss"] = 0

# ---- phase timing via monkeypatch ----
PHASES = {}
def _timed(mod, name, key):
    orig = getattr(mod, name)
    def wrapper(*a, **kw):
        t = time.perf_counter()
        try: return orig(*a, **kw)
        finally: PHASES[key] = PHASES.get(key, 0.0) + (time.perf_counter() - t)
    setattr(mod, name, wrapper)

t_import = time.perf_counter()
import importlib
import allin1_infer
A = importlib.import_module("allin1_infer.analyze")
t_import = time.perf_counter() - t_import

_timed(A, "separate_in_memory", "demucs_separation")
_timed(A, "extract_spectrograms_from_arrays", "spectrogram")
_timed(A, "extract_spectrograms", "spectrogram")
_timed(A, "load_pretrained_model", "model_load")
_timed(A, "run_inference", "structure_inference")

FFMPEG = r"c:/Users/TDK_Rage/Documents/projects/lyleclassen/mixxxa/node_modules/ffmpeg-static/ffmpeg.exe"
WAVDIR = Path("./_wav"); WAVDIR.mkdir(exist_ok=True)

cache_dir = allin1_infer.get_model_cache_dir()
print(f"model cache dir: {cache_dir}", flush=True)

ONLY = os.environ.get("ONLY")
if ONLY:
    TRACKS = [t for t in TRACKS if t[0] == ONLY]

runs = []
for i, (label, path, dur) in enumerate(TRACKS):
    if not Path(path).exists():
        print(f"MISSING: {path}", flush=True); continue
    PHASES.clear(); reset_peak(); gc.collect()
    # Production path: mixxxa already owns an ffmpeg-static binary and decodes to PCM,
    # so feed the sidecar a wav. torchaudio>=2.11 cannot decode mp3 without torchcodec
    # (which needs FFmpeg DLLs); it decodes wav via soundfile with no extra deps.
    wav = WAVDIR / (Path(path).stem + ".wav")
    t_dec = time.perf_counter()
    if not wav.exists():
        subprocess.run([FFMPEG, "-v", "error", "-y", "-i", path, "-ac", "2", "-ar", "44100", str(wav)], check=True)
    PHASES["ffmpeg_decode_to_wav"] = round(time.perf_counter() - t_dec, 2)
    path = str(wav)
    print(f"\n=== [{MODEL}] {label} ({dur}s) {'COLD' if i == 0 else 'warm'} ===", flush=True)
    t0 = time.perf_counter()
    res = A.analyze(path, model=MODEL, device="cpu", multiprocess=False,
                    demix_dir="./_demix", spec_dir="./_spec")
    total = time.perf_counter() - t0
    rec = {
        "model": MODEL, "label": label, "track_seconds": dur, "cold": i == 0,
        "analyze_s": round(total, 2),
        "end_to_end_s": round(total + PHASES["ffmpeg_decode_to_wav"], 2),
        "realtime_factor": round((total + PHASES["ffmpeg_decode_to_wav"]) / dur, 2),
        "phases_s": {k: round(v, 2) for k, v in PHASES.items()},
        "unaccounted_s": round(total - sum(v for k, v in PHASES.items() if k != "ffmpeg_decode_to_wav"), 2),
        "peak_rss_mb": peak_mb(),
        "bpm": getattr(res, "bpm", None),
        "n_segments": len(res.segments), "n_downbeats": len(res.downbeats), "n_beats": len(res.beats),
        "segments": [{"start": round(s.start, 2), "end": round(s.end, 2), "label": s.label} for s in res.segments],
    }
    runs.append(rec)
    print(json.dumps({k: v for k, v in rec.items() if k != "segments"}, indent=2), flush=True)

OUT.write_text(json.dumps({"import_s": round(t_import, 2), "cache_dir": str(cache_dir), "runs": runs}, indent=2))
print(f"\nwrote {OUT}", flush=True)
