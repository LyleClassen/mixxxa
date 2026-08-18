# Packaging feasibility: `all-in-one-infer` song-structure analysis

Research output for [#26](https://github.com/LyleClassen/mixxxa/issues/26) (map: [#18](https://github.com/LyleClassen/mixxxa/issues/18)).
Date: 2026-08-18. All figures measured or read from primary sources; each claim cites its source.

## TL;DR

Yes — it can ship under the no-Python-for-users constraint, but **not inside the existing
`orbit-sidecar` binary**. Recommendation: a **second frozen `structure-sidecar`** of roughly
700 MB–1 GB, kept separate from `orbit-sidecar` so the fast Key/BPM path stays light.

> **Amended 2026-08-18:** the release target is **one installable binary per OS** (`.dmg` on
> macOS, `.msi`/`.exe` on Windows). That does not change the "separate sidecar" conclusion —
> the fast path should still not carry torch — but it does mean the second sidecar most likely
> ships **inside the installer** rather than being fetched on first use. See §5, option B.

The old blockers are gone: **NATTEN is not needed on Windows**, **madmom's non-commercial
weights are never touched**, and **everything in the dependency tree is MIT/BSD with Windows
wheels**. The new blocker is **cost, not risk**: ~466 MB of PyTorch on disk and **CPU runtime
of roughly 1.5x track duration**, dominated entirely by Demucs source separation.

## 1. Dependency tree

`all-in-one-infer` 3.1.0 (released 2026-07-12, `requires_python >=3.9`), a pure-Python
`py3-none-any` wheel of 67.9 KB. Runtime deps ([PyPI JSON](https://pypi.org/pypi/all-in-one-infer/json)):

| Package | Notes |
|---|---|
| `torch>=2.0.0` | the weight of the whole tree — see §2 |
| `demucs-infer>=4.2.2` | pure-python wheel, 87 KB; pulls `torchaudio`, `einops`, `julius`, `pyyaml`, `tqdm` ([PyPI](https://pypi.org/pypi/demucs-infer/json)) |
| `madmom-infer>=0.1.0` | pure-python wheel, 80 KB; needs only numpy + scipy ([PyPI](https://pypi.org/pypi/madmom-infer/json)) |
| `librosa`, `scipy>=1.0.0`, `numpy`, `soundfile>=0.12.1` | **already in the ORBIT sidecar** |
| `hydra-core`, `omegaconf`, `huggingface_hub`, `matplotlib` | small; `matplotlib` only for `visualize()` |

**NATTEN is optional and irrelevant to us.** It lives behind the `[natten]` extra, which
additionally pins `torch<2.8` and `torchaudio<2.8`, and the README scopes it to "Linux users
with CUDA". The default path is a native-PyTorch neighborhood-attention implementation
(`src/allin1_infer/models/neighborhood_attention.py` in the sdist) — **nothing to compile on
Windows**. This retires the original gating concern recorded on the map.

**No source builds anywhere in the tree.** `all-in-one-infer`, `demucs-infer` and
`madmom-infer` all ship pure-python `py3-none-any` wheels; `torch`, `torchaudio`, `scipy`,
`numpy`, `librosa` all publish `win_amd64` wheels.

## 2. Size on Windows

Measured by reading the wheels' zip central directories over HTTP range requests:

| Wheel | Download | Uncompressed | Biggest single file |
|---|---|---|---|
| `torch-2.13.0-cp311-cp311-win_amd64.whl` | 122.0 MB | **466 MB** (12,850 files) | `torch/lib/torch_cpu.dll` — 305 MB |
| `torch-2.13.0-cp311-cp311-macosx_14_0_arm64.whl` | 111.2 MB | **471 MB** (12,710 files) | `torch/lib/libtorch_cpu.dylib` — 338 MB |

The two platforms cost the same, so neither is the cheap one to start with.

PyInstaller's [`hook-torch.py`](https://github.com/pyinstaller/pyinstaller-hooks-contrib/blob/master/_pyinstaller_hooks_contrib/stdhooks/hook-torch.py)
excludes `*.h`, `*.hpp`, `*.lib`, `*.cmake` and `*.pyi` and collects submodules + dynamic libs,
so the frozen contribution lands around **~400 MB**, plus `torchaudio` and the small
pure-python packages.

`AGENTS.md` records the current frozen `orbit-sidecar` at **~200–400 MB**. Adding this tree
gives a single binary of roughly **700 MB – 1 GB**. Note the PyPI `win_amd64` torch wheel is
CPU-only; CUDA on Windows requires the separate `download.pytorch.org` index, which would
multiply the size again.

### Model weights

| Weight | Size | Where from |
|---|---|---|
| `harmonix-fold0..7` (the `harmonix-all` ensemble) | **1.40 MB each, ~11.2 MB total** | [`taejunkim/allinone`](https://huggingface.co/taejunkim/allinone) on HF, license **MIT** (measured via the HF models API) |
| `htdemucs` (`955717e8-8726e21a.th`) | **84.1 MB** (verified `Content-Length` at `dl.fbaipublicfiles.com`) | Demucs, project released under MIT |
| madmom pretrained weights | **none — never downloaded** | see §3 |

The all-in-one checkpoints are *tiny*. The README's "several GB of cache" is torch hub +
Demucs + cached stems/spectrograms, not the structure model. Both weight sets are small enough
to **bundle inside the sidecar download** rather than fetch at runtime, which removes a
first-run network dependency. All checkpoints download to `~/.cache/torch/hub/checkpoints/`
by default; `allin1_infer` exposes `print_cache_info()` / `get_cache_size()` /
`clear_model_cache()` for managing that.

## 3. Licensing

- `all-in-one-infer`: **MIT** (PyPI classifier + `LICENSE`/`NOTICE` in the sdist; © 2023 Taejun Kim, © 2025 Bo-Yu Chen).
- `demucs-infer` / Demucs: **MIT**.
- `taejunkim/allinone` model weights: **MIT** (HF repo license field).
- `madmom-infer`: **BSD-2-Clause** for code. Its pretrained weights are **CC BY-NC-SA 4.0 (non-commercial)** — a real trap, but **we never hit it**. Grepping the sdist, `all-in-one-infer` imports only weight-free madmom pieces: `DBNDownBeatTrackingProcessor` (an HMM/Viterbi decoder over *our* activations) in `postprocessing/metrical.py`, and `audio.signal` / `audio.stft` / `audio.spectrogram` DSP in `spectrogram.py`. The source says so explicitly: *"this is NOT madmom running its own neural-network beat/downbeat [tracker] … Swapping in madmom's own pretrained activations here would be wrong."* No `RNN*`/`CNN*` processor is imported, so no CC BY-NC-SA bytes are fetched.

**Residual risk:** Meta's Demucs README states the MIT license for the project but does not
explicitly license the released `htdemucs` weights. Bundling those weights into a distributed
build should get a deliberate call; fetching them at first use from
`dl.fbaipublicfiles.com` sidesteps it.

**Attribution owed:** the Harmonix Set training data carries its own attribution requirement
(README), and the sdist ships a `NOTICE` file — both need to reach an about/credits surface.

## 4. Runtime on CPU

The published benchmark is GPU: the `harmonix-all` ensemble processed **10 songs (33 min of
audio) in 73 s** on an RTX 4090 + i9-10940X (README) — ~27x realtime. That number does not
transfer.

On CPU the cost is **almost entirely Demucs**, which runs *before* the (1.4 MB, 8-fold)
structure model. Demucs' own README: *"processing time should be roughly equal to 1.5 times
the duration of the track"* on CPU. So expect, per track, on a typical desktop CPU:

- **~6–9 minutes for a 4–6 minute track**, dominated by separation
- the structure inference itself is comparatively negligible
- memory: Demucs' HT models cap segments at 7.8 s and `--segment` trades RAM for speed

Levers, in order of value:

1. **`--skip-separation` / `PrecomputedStemProvider`** — the API accepts pre-computed stems. If Mixxxa ever separates stems for another feature, structure analysis becomes near-free.
2. **`harmonix-fold0` instead of `harmonix-all`** — one checkpoint instead of an 8-fold ensemble. Cheap accuracy/speed knob, but the ensemble is not the bottleneck, so it buys little.
3. **`AllInOneSession`** — keeps the model warm across tracks, matching the existing sidecar's persistent-process design.
4. **`--compile-model`** — README claims ~38% faster steady state for ~57 s of one-off compile cost.
5. **`device='mps'` on Apple Silicon** — torch's Metal backend is a genuine platform asymmetry: macOS gets GPU acceleration for free from the same wheel, while the Windows PyPI wheel is CPU-only. `analyze()` takes any torch device string, so this is a one-line difference. Expect macOS to be several times faster than Windows on the same track, which the queue UX has to tolerate rather than assume away.
6. **`--demucs-fp16`** — CUDA only, so not a lever on either target platform.

**These timings are cited, not measured.** A one-track wall-clock spike on the user's own
machine is the single highest-value follow-up, because it sets the queue UX ([#27](https://github.com/LyleClassen/mixxxa/issues/27)):
minutes-per-track means the on-demand context-menu action must be a *queued background job with
progress*, never a modal wait.

## 5. Packaging options

### A. Extend the existing `orbit-sidecar` — not recommended

One binary of ~700 MB–1 GB shipped to every user, including the majority who never touch
structure analysis. It also couples a heavy, slow-moving torch dependency to the fast path
(Key/BPM/energy) that today starts in ~2 s.

### B. A separate `structure-sidecar` binary — recommended

A second PyInstaller-frozen executable, same stdio newline-delimited JSON protocol as
`sidecar.ts`, kept out of `orbit-sidecar` so the fast path stays light. The repo already has
the two halves of the mechanism: `sidecar.ts` supervises a persistent frozen child with
restart-on-crash, and `binaries.ts` has the "next to the bundle → static path → PATH → common
dirs" resolution ladder a second binary slots into.

Bundle the 11 MB all-in-one checkpoints with it either way; decide separately whether
`htdemucs` (84 MB) ships alongside or is fetched on first analysis (see the license note in §3).

**How it reaches the user is the open question**, and the release target constrains it:

- **B1 — shipped inside the installer.** Matches the "one `.dmg` / one `.msi`" target with no
  new machinery. Cost: every installer carries ~700 MB–1 GB, on both platforms, for a feature
  many users won't touch. Installer compression helps (torch compresses ~4:1 in the wheel), so
  the *download* is nearer 150–250 MB than 1 GB — it's the **on-disk** footprint that stays big.
- **B2 — fetched on first use.** Keeps the base install small and makes structure analysis
  genuinely opt-in, but introduces a download/verify/resume/update path that doesn't exist
  today, and means the shipped artifact isn't self-contained.

B1 is the better fit for a single-installer release; B2 is the fallback if the installer size
turns out to be unacceptable. This is [#31](https://github.com/LyleClassen/mixxxa/issues/31)'s
decision, and it needs a real frozen-binary size measurement — the ~1 GB here is an estimate
built from wheel contents, not a `build:sidecar` run.

### C. ONNX everything — defer

Attractive on paper: an MIT-licensed [ONNX export of htdemucs](https://huggingface.co/StemSplitio/htdemucs-onnx)
exists (316 MB fp32 / 166 MB fp16-weights, max abs diff 6.6e-4 vs PyTorch, runs on onnxruntime
CPU with numpy + soundfile only), which would drop torch entirely and fit an
onnxruntime-shaped sidecar. But the all-in-one DINAT model itself would still need to be
exported and validated by us, and that export is a project in its own right. Revisit only if
the ~1 GB footprint proves unacceptable.

## 6. Bonus: outputs beyond segments

`AnalysisResult` carries `bpm`, `beats`, `beat_positions`, `downbeats` and `segments`
(`start` / `end` / `label`), with optional 100-FPS frame-level `activations` and per-stem
`embeddings` (`[4, time, 24]`). Segment labels are a closed set:
**`start`, `end`, `intro`, `outro`, `break`, `bridge`, `inst`, `solo`, `verse`, `chorus`** —
that is the taxonomy [#28](https://github.com/LyleClassen/mixxxa/issues/28) has to map to
colors, and the map already commits to storing it locally only. **Downbeats** are the sleeper
asset here: they give bar-accurate boundaries for cue snapping and mix-point suggestion
([#17](https://github.com/LyleClassen/mixxxa/issues/17)), and the BPM is a free cross-check
against ORBIT's.

## Sources

- [openmirlab/all-in-one-infer](https://github.com/openmirlab/all-in-one-infer) — README
- `all_in_one_infer-3.1.0.tar.gz` sdist (source read directly: `demix.py`, `stems.py`, `spectrogram.py`, `postprocessing/metrical.py`, `config.py`)
- [PyPI JSON: all-in-one-infer](https://pypi.org/pypi/all-in-one-infer/json), [demucs-infer](https://pypi.org/pypi/demucs-infer/json), [madmom-infer](https://pypi.org/pypi/madmom-infer/json), [torch](https://pypi.org/pypi/torch/json)
- [openmirlab/madmom-infer](https://github.com/openmirlab/madmom-infer) — README (weights vs. pure-DSP split)
- [huggingface.co/taejunkim/allinone](https://huggingface.co/taejunkim/allinone) + HF models API (file sizes, license)
- [facebookresearch/demucs](https://github.com/facebookresearch/demucs) — README (CPU speed, segment/memory, license)
- [pyinstaller-hooks-contrib `hook-torch.py`](https://github.com/pyinstaller/pyinstaller-hooks-contrib/blob/master/_pyinstaller_hooks_contrib/stdhooks/hook-torch.py)
- [StemSplitio/htdemucs-onnx](https://huggingface.co/StemSplitio/htdemucs-onnx)
- This repo: `AGENTS.md` (§"ORBIT Python sidecar"), `sidecar/build.spec`, `src/bun/analysis/binaries.ts`, `src/bun/analysis/sidecar.ts`
