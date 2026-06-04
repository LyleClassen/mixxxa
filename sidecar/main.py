"""
ORBIT analysis sidecar — persistent newline-delimited JSON stdio loop.

Protocol:
  Startup: prints {"ready": true} after importing orbit_dsp (librosa warmup).
  Per request: reads one JSON line {"id": "...", "filePath": "...", "maxLength": <sec>}
  Per response: writes one JSON line {"id": "...", "result": {...}} or {"id": "...", "error": "..."}

The process stays alive between requests — librosa startup cost is paid once.
"""

import sys
import json
import math
import traceback


import librosa
from orbit_dsp.audio_dsp import (
    detect_bpm,
    detect_key,
    calculate_energy,
    calculate_loudness,
    calculate_dynamic_range,
)


def _compute_danceability(bpm: float, energy: float) -> float:
    bpm_score = max(0.0, 1.0 - abs(bpm - 125.0) / 125.0)
    combined = (bpm_score + min(1.0, max(0.0, energy))) / 2.0
    return 1.0 / (1.0 + math.exp(-10.0 * (combined - 0.5)))


def analyze(file_path: str, max_length: int) -> dict:
    target_sr = 22050
    y, sr = librosa.load(file_path, sr=target_sr, mono=True)
    duration = len(y) / sr

    max_samples = int(max_length * sr)
    if len(y) > max_samples:
        y = y[:max_samples]

    bpm_result = detect_bpm(y, sr)
    key_result = detect_key(y, sr, harmonic_only=True)
    energy = calculate_energy(y)
    loudness_db = calculate_loudness(y, sr)
    dynamic_range_db = calculate_dynamic_range(y)
    danceability = _compute_danceability(float(bpm_result["value"]), energy)

    return {
        "bpm": {"value": float(bpm_result["value"])},
        "key": {"key": str(key_result["key"]), "mode": str(key_result["mode"])},
        "energy": energy,
        "loudness_db": loudness_db,
        "dynamic_range_db": dynamic_range_db,
        "danceability": danceability,
        "duration": round(duration, 2),
    }


# ── Main loop ────────────────────────────────────────────────────────────────

def main() -> None:
    # Signal readiness — Bun's supervisor waits for this before sending requests
    sys.stdout.write(json.dumps({"ready": True}) + "\n")
    sys.stdout.flush()

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        req_id = None
        try:
            req = json.loads(line)
            req_id = req["id"]
            file_path = req["filePath"]
            max_length = int(req.get("maxLength", 600))

            result = analyze(file_path, max_length)
            sys.stdout.write(json.dumps({"id": req_id, "result": result}) + "\n")
        except Exception:
            err_msg = traceback.format_exc().strip().splitlines()[-1]
            sys.stdout.write(json.dumps({"id": req_id or "", "error": err_msg}) + "\n")
        finally:
            sys.stdout.flush()


if __name__ == "__main__":
    main()
