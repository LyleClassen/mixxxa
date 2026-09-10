# Measured frozen size: `structure-sidecar` on Windows

Decision input for [#31](https://github.com/LyleClassen/mixxxa/issues/31) (map: [#18](https://github.com/LyleClassen/mixxxa/issues/18)).
Date: 2026-09-10. Every number below comes from a real PyInstaller build on the machine in
[`structure-analysis-timings.md`](./structure-analysis-timings.md) §1 (Ryzen 5 7600X, Windows 11
Pro 26200). Nothing here is estimated from wheel contents — that was [#26](https://github.com/LyleClassen/mixxxa/issues/26)'s
job, and this doc supersedes its ~700 MB – 1 GB guess.

Reproduce with [`structure-freeze.spec`](./structure-freeze.spec): `uv venv --python 3.12`,
`uv pip install all-in-one-infer matplotlib pyinstaller`, `pyinstaller structure-freeze.spec`.

## TL;DR

**764 MB on disk, 273 MB compressed, and it starts in ~3 s.** That lands inside [#26](https://github.com/LyleClassen/mixxxa/issues/26)'s
estimated range rather than above it, so **bundling into the installer (B1) is affordable** and
the download/verify/resume machinery of B2 is not needed.

One finding is a hard packaging constraint, not a size number:

> **`allin1_infer` cannot be frozen without matplotlib.** Its `__init__.py` imports
> `analyze`, which imports `visualize`, which imports matplotlib at module scope. A build
> that excludes matplotlib passes PyInstaller cleanly and then dies at startup with
> `ModuleNotFoundError: No module named 'matplotlib'`. The sidecar never renders a plot;
> it pays ~17 MB for an import it does not use.

## 1. Sizes

| Build | On disk | Starts? |
|---|---|---|
| Unfrozen venv (`all-in-one-infer` + deps) | 1,045 MB | — |
| Frozen, matplotlib excluded | 867 MB | **No** — `ModuleNotFoundError` at import |
| Frozen, matplotlib included | 884 MB | Yes |
| Frozen, matplotlib included, trimmed (below) | **764 MB** | Yes |

Compressed (plain zip/deflate of the trimmed tree): **273 MB**. An installer using LZMA or
zstd should beat that; the current canary release already ships `.tar.zst`.

For scale, today's whole canary Windows installer is **37 MB**.

## 2. What the 764 MB is

| File | Size |
|---|---|
| `torch/lib/torch_cpu.dll` | 292 MB |
| `llvmlite/binding/llvmlite.dll` | 115 MB |
| `structure-sidecar.exe` (bootloader + PYZ) | 57 MB |
| `numpy.libs` OpenBLAS | 20 MB |
| `torch/lib/torch_python.dll` | 19 MB |
| `scipy.libs` OpenBLAS | 19 MB |

`torch_cpu.dll` being the bulk was expected. **`llvmlite.dll` at 115 MB was not** — it arrives
transitively (numba, via the librosa/madmom side of the stack), and is the single most
promising target if the footprint ever has to come down further. Confirming whether the
analysis path actually executes any numba-jitted code is unfinished work.

## 3. Trimming

Removing runtime-dead files takes 884 MB to 764 MB (-120 MB) with the smoke test still
passing after the trim:

- `torch/include/**` (65 MB) — C++ headers, only needed to compile against libtorch
- all `*.lib` (43 MB) — MSVC import libraries, likewise build-time only
- `torch/bin/**` (3 MB) — a bundled `protoc.exe`

Compressed, the same trim is only worth ~13 MB, since headers and import libraries
compress extremely well. **The trim is about disk footprint, not download size.**

One caveat: the measured trim also dropped `hf_xet` (10 MB), and the smoke test does
**not** exercise weight downloading. `hf_xet` is `huggingface_hub`'s transfer accelerator
and the htdemucs/fold fetch path goes through HF. **Keep `hf_xet`** unless a real download
is tested without it, putting the recommended tree at ~774 MB.

## 4. Startup cost

Three consecutive runs of the frozen binary, importing `torch` and `allin1_infer` and
answering one JSON line on stdio:

| Run | Wall clock |
|---|---|
| 1 | 2.82 s |
| 2 | 2.93 s |
| 3 | 3.43 s |

**~3 s of process startup**, on top of the +4.3 s cold weight fetch measured in
[#30](https://github.com/LyleClassen/mixxxa/issues/30). This is why the build is **onedir,
not onefile**: a onefile binary re-extracts its entire payload to a temp directory on every
launch, which at this size would dominate startup completely.

## 5. What this does not cover

- **macOS.** Not measured. The mac torch wheel is 471 MB unpacked versus Windows' 466 MB,
  so the frozen tree should land within a few percent of 764 MB, but the build has never
  been run there and notarising a frozen PyInstaller tree is its own problem.
- **A real analysis run through the frozen binary.** The smoke test proves the imports
  resolve, not that segmentation produces correct output when frozen.
