"""
Drop detection task — wraps the vendored FelixMeyer6/drop-detector model
(see dropdetect/ — GPL-3.0).

Pipeline: generate_candidates -> features_batch -> XGBoost predict_proba ->
threshold filter. Optionally also computes BPM + first-beat (when the caller
has no analyzed beatgrid for the track).
"""

import sys
from pathlib import Path

# Loaded once per process; the bundle holds the classifier, its optimal
# threshold, the candidate-search config, and the feature column order.
_model_bundle = None

# Fallbacks if the bundle's config key is ever missing — mirrors upstream
# model_build.py CONF (minus training-only keys).
DEFAULT_CONF = {
    "sr": 22050,
    "min_distance": 2.0,
    "score_lookback": 30,
    "snap_window": 2.0,
    "intro_s": 20,
    "outro_s": 20,
}


def _model_path() -> Path:
    # Frozen exe: data files are unpacked under sys._MEIPASS
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).parent))
    return base / "dropdetect" / "model.joblib"


def _load_model():
    global _model_bundle
    if _model_bundle is None:
        import joblib

        _model_bundle = joblib.load(_model_path())
    return _model_bundle


def detect_drops(file_path: str, threshold=None, need_bpm=False, on_progress=None) -> dict:
    def progress(step: str, pct: float) -> None:
        if on_progress is not None:
            on_progress(step, pct)

    import pandas as pd

    from dropdetect.processors import features_batch, generate_candidates

    bundle = _load_model()
    clf = bundle.get("model")
    model_threshold = bundle.get("threshold", 0.5)
    conf = {**DEFAULT_CONF, **bundle.get("config", {})}
    required_features = bundle.get("features", [])

    cutoff = float(threshold) if threshold is not None else float(model_threshold)

    progress("candidates", 0.0)
    candidates = generate_candidates(file_path, conf)

    drops = []
    if candidates:
        for cand in candidates:
            cand["fpath"] = str(file_path)
            # Drop the heavy per-candidate arrays before building the frame
            cand.pop("y_ref", None)
            cand.pop("env", None)
            cand.pop("fps", None)
        df = pd.DataFrame(candidates)

        progress("features", 0.35)
        df = features_batch(df)

        progress("classify", 0.8)
        X = df[required_features]
        probs = clf.predict_proba(X)[:, 1]
        df["confidence"] = probs
        kept = df[df["confidence"] >= cutoff]
        drops = sorted(
            (
                {"time": float(row["time"]), "confidence": float(row["confidence"])}
                for _, row in kept.iterrows()
            ),
            key=lambda d: d["time"],
        )

    result = {"drops": drops}

    if need_bpm:
        progress("bpm", 0.85)
        import librosa
        from orbit_dsp.audio_dsp import detect_bpm

        y, sr = librosa.load(file_path, sr=22050, mono=True)
        bpm_result = detect_bpm(y, sr)
        _, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        result["bpm"] = float(bpm_result["value"])
        result["firstBeatSec"] = float(beat_times[0]) if len(beat_times) > 0 else 0.0
        result["duration"] = round(len(y) / sr, 2)

    return result
