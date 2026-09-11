# Measured wall clock: `all-in-one-infer` structure analysis on CPU

Task output for [#30](https://github.com/LyleClassen/mixxxa/issues/30) (map: [#18](https://github.com/LyleClassen/mixxxa/issues/18)).
Date: 2026-08-19. Every number below was measured on the machine described in §1 —
nothing here is cited from upstream.

## TL;DR

**CPU structure analysis is ~2x faster than real time, not 1.5x slower.** A typical
4-minute track lands in **~2 minutes**, not the 6–9 minutes [#26](https://github.com/LyleClassen/mixxxa/issues/26)
projected from Demucs' README. The realtime factor is a near-constant **0.49–0.54x**
across 3 / 5.5 / 8-minute tracks.

The real constraint is **not time, it is memory**: peak RSS scales linearly with track
length and hit **9.0 GB on an 8-minute track**. That, not wall clock, is what shapes the
queue design in [#27](https://github.com/LyleClassen/mixxxa/issues/27).

Three other findings that change the spec:

1. **`torchaudio>=2.11` cannot decode mp3** without the extra `torchcodec` package, which
   dynamically links FFmpeg and failed to load out of the box on Windows. Feeding the
   sidecar a **wav** avoids the dependency entirely, costs **~0.6s/track**, and reuses the
   `ffmpeg-static` binary and decode path mixxxa already owns.
2. **`harmonix-fold0` is not worth it.** It speeds up inference 2.2x but only ~20%
   end-to-end, and its segment boundaries drift from the ensemble's badly on longer
   tracks (66% agreement, 19s max deviation on the 8-minute track). **Keep `harmonix-all`.**
3. **Ignore all-in-one's BPM.** It reported 56 BPM for a ~112 BPM amapiano track — a
   half-time error. mixxxa already has better BPM from ORBIT and rekordbox.

## 1. Test rig

| | |
|---|---|
| CPU | AMD Ryzen 5 7600X, 6 cores / 12 threads |
| RAM | 31.2 GB |
| GPU | RTX 3070 — **deliberately unused**, `device='cpu'` forced throughout |
| OS | Windows 11 Pro 26200 |
| Python | 3.12 (uv-managed), throwaway venv |
| Packages | `all-in-one-infer` 3.1.0, `torch` 2.13.0 (CPU wheel), `torchaudio` 2.11.0 |

The RTX 3070 is present but never engaged. Windows ships CPU-only per [#26](https://github.com/LyleClassen/mixxxa/issues/26),
so these are the numbers a Windows user actually gets. A machine with a weaker CPU than a
7600X will be proportionally slower — treat 0.5x realtime as a *good-desktop* figure, not a floor.

Install was clean, no compilation, matching [#26](https://github.com/LyleClassen/mixxxa/issues/26):
the resulting venv is **909 MB** (torch alone 471 MB), which corroborates that report's
~1 GB estimate. That is an unfrozen venv — the frozen size is [#31](https://github.com/LyleClassen/mixxxa/issues/31)'s to measure.

Harness: `docs/research/bench-structure-timings.py` (committed alongside this doc). It
monkeypatches `allin1_infer.analyze` to time each phase separately, and samples peak RSS
across the process tree every 250 ms.

## 2. Headline numbers — `harmonix-all` (the default, 8-fold ensemble)

| Track | Length | End-to-end | Realtime factor | Peak RSS |
|---|---|---|---|---|
| 3 min | 180 s | **97.8 s** (cold) | 0.54x | 3.9 GB |
| 5.5 min | 330 s | **165.4 s** | 0.50x | 6.9 GB |
| 8 min | 480 s | **236.5 s** | 0.49x | 9.0 GB |

Realtime factor is essentially constant, so **wall clock ≈ 0.5 × track length** is a safe
estimate for progress reporting. Against the library this was drawn from (2268 real
rekordbox tracks, median ~4 min), that predicts **~2 minutes per track**.

### Phase split (seconds)

| Phase | 3 min | 5.5 min | 8 min | Share |
|---|---|---|---|---|
| ffmpeg decode to wav | 0.68 | 0.43 | 0.56 | <1% |
| **Demucs separation** | **55.32** | **97.97** | **142.84** | **57–61%** |
| Spectrogram | 2.59 | 3.88 | 5.52 | ~2% |
| Model load | 5.24 (cold) | 1.01 | 0.97 | <1% warm |
| **Structure inference** | **34.00** | **62.13** | **86.57** | **35–37%** |

Demucs dominates exactly as [#26](https://github.com/LyleClassen/mixxxa/issues/26) predicted —
it is just far faster in absolute terms than the README figure implied.

## 3. Memory is the real constraint

Peak RSS is **linear in track length**, roughly `1.5 GB + 0.95 GB per minute of audio`:

| Track length | Peak RSS |
|---|---|
| 3 min | 3.9 GB |
| 5.5 min | 6.9 GB |
| 8 min | 9.0 GB |

Consequences for [#27](https://github.com/LyleClassen/mixxxa/issues/27) and the sidecar design:

- **Analyse strictly one track at a time.** Two concurrent 5-minute tracks would need
  ~14 GB. There is no parallelism to be had here on typical hardware.
- **Long tracks are a hazard, not just slow.** Extrapolating, a 15-minute track needs
  ~16 GB and a 60-minute DJ mix is simply not analysable on an 8–16 GB machine. The
  library sampled here contains 5 tracks over 15 minutes and 4 over 58 minutes. The spec
  needs an explicit **length cap** with a clear refusal, or a chunked strategy — not an
  out-of-memory crash.
- **8 GB machines cannot analyse a typical track at all**, and 16 GB machines will swap on
  longer ones. This is a hard system-requirement statement the feature has to make.

## 4. Cold start

First run on an empty cache paid **+4.3 s of extra model load** (5.24 s vs ~1.0 s warm)
plus weight downloads. Interpreter import of `allin1_infer` is **2.41 s**.

Weights are fetched at runtime from **two different hosts**:

| Weights | Size | Source | Cache location |
|---|---|---|---|
| `htdemucs` | 84 MB | torch hub | `~/.cache/torch/hub/checkpoints` |
| all-in-one folds | 11 MB | HuggingFace Hub | `~/.cache/huggingface` |

Both figures match [#26](https://github.com/LyleClassen/mixxxa/issues/26) exactly. **~95 MB
total, and first run requires network access.** For [#31](https://github.com/LyleClassen/mixxxa/issues/31):
bundling means pre-seeding both cache directories (or redirecting the loaders), and it is
two separate mechanisms, not one. HF Hub also emits an unauthenticated-rate-limit warning
and a Windows symlink warning — both need suppressing in a shipped app.

Warm reuse within one process is effectively free (~1 s model load, ~0.3 s for fold0), which
confirms the existing **keep-the-sidecar-warm** pattern is the right one.

## 5. `harmonix-fold0` vs `harmonix-all`

Single fold is meaningfully faster at inference but the saving is diluted by Demucs:

| Track | Inference (all) | Inference (fold0) | Speedup | End-to-end (all) | End-to-end (fold0) | Saving |
|---|---|---|---|---|---|---|
| 3 min | 34.00 s | 15.41 s | 2.2x | 97.8 s | 71.9 s | 26% |
| 5.5 min | 62.13 s | 28.66 s | 2.2x | 165.4 s | 132.9 s | 20% |
| 8 min | 86.57 s | 41.71 s | 2.1x | 236.5 s | 191.0 s | 19% |

Note the speedup is **2.2x, not 8x** — the ensemble batches its folds efficiently, so a
single fold does not cost an eighth.

Agreement with the ensemble's boundaries degrades sharply with track length:

| Track | Boundaries matched within 0.5 s | Mean deviation | Max deviation |
|---|---|---|---|
| 3 min | 88% | 0.27 s | 2.18 s |
| 5.5 min | 81% | 0.46 s | 4.82 s |
| 8 min | **66%** | 2.17 s | **19.13 s** |

On the 8-minute track fold0 also invented a different narrative — `solo`, `break`, and a
stray `intro` two-thirds of the way through — where the ensemble gave a coherent
chorus/inst/outro reading.

**Recommendation: keep the `harmonix-all` default.** A 19-second boundary error is
visible as a badly-placed line on the minimap and would poison any future mix-point
suggestion; ~20% of a 2-minute job is not worth it.

## 6. mp3 decoding: `torchaudio` no longer does it

`analyze()` on an mp3 fails outright:

```
RuntimeError: Failed to load '...mp3' via torchaudio: TorchCodec is required for
load_with_torchcodec. torchaudio>=2.11 dropped its bundled decoders (mp3 included)
in favor of the separate torchcodec package.
```

Installing `torchcodec` (24 MB) did **not** fix it — it dlopens FFmpeg shared libraries
that are not present, failing with `Could not find module 'libtorchcodec_core4.dll'`.
Bundling it would mean shipping FFmpeg DLLs inside the frozen sidecar and getting
PyInstaller to carry them.

**This is a non-issue if the sidecar is fed a wav.** `soundfile` handles wav with no extra
dependency, and mixxxa already ships `ffmpeg-static` and already decodes audio to PCM in
`src/bun/analysis/decoder.ts`. Transcoding with that binary costs **~0.6 s/track** — noise
against a 2-minute job. All numbers in this document use that path.

**Spec consequence:** the structure sidecar's protocol should take a **wav path (or PCM)**,
not an arbitrary media path, and Bun does the decode. That also removes `torchcodec`,
FFmpeg DLLs, and every codec-licensing question from the frozen sidecar.

## 7. Sanity check on the segments

3-minute track, 109 BPM — reads as plausible:

```
  0.00 -  37.39  verse      89.76 - 119.22  chorus
 37.39 -  63.58  verse     119.22 - 151.95  chorus
 63.58 -  89.76  verse     151.95 - 175.94  verse
                           175.94 - 180.55  chorus
```

Boundaries land on consistent ~17s / ~26s spans, i.e. musical phrase multiples at this
tempo, and the intro/verse/chorus/outro ordering is coherent on all three tracks.

Two render-level observations for [#28](https://github.com/LyleClassen/mixxxa/issues/28) /
[#29](https://github.com/LyleClassen/mixxxa/issues/29):

- **The model emits one segment per phrase, not per section** — the 5.5-minute track came
  back as 21 segments with runs of adjacent identical labels (`chorus, chorus`,
  `verse, verse`). The minimap lane should **merge adjacent identical labels at render
  time**, or it will draw a label every 17 seconds. This sits naturally beside the
  already-agreed 5-class merge-at-render decision.
- **Segment counts are high**: 8 / 21 / 29 segments for 3 / 5.5 / 8-minute tracks. The
  label-degradation ladder agreed in [#29](https://github.com/LyleClassen/mixxxa/issues/29)
  will be doing real work, especially before merging.

## 8. Numbers the spec can now use

- Wall clock: **0.5 × track length**, ~2 min for a median 4-minute track.
- Progress: Demucs ~60%, inference ~36% — enough for a two-stage determinate bar.
- Peak RAM: **1.5 GB + ~0.95 GB per audio minute**. One track at a time. Cap track length.
- Cold start: +4.3 s model load, ~95 MB of weights over the network from two hosts.
- Model: `harmonix-all`. Input: wav. BPM output: discard.
