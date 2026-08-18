# PyInstaller spec for the ORBIT sidecar frozen binary.
#
# Build: cd sidecar && uv run pyinstaller build.spec
# Output: sidecar/dist/orbit-sidecar[.exe]
#
# Copy the output binary to Resources/app/bun/orbit-sidecar[.exe] for packaged builds.
#
# librosa, numba, and sklearn all miss data files when frozen without explicit
# --collect-all. This spec passes them explicitly so the frozen exe can import them.

import sys
from PyInstaller.utils.hooks import collect_all

block_cipher = None

# Collect complete packages including data files that PyInstaller misses
librosa_datas, librosa_binaries, librosa_hiddenimports = collect_all("librosa")
numba_datas, numba_binaries, numba_hiddenimports = collect_all("numba")
sklearn_datas, sklearn_binaries, sklearn_hiddenimports = collect_all("sklearn")
scipy_datas, scipy_binaries, scipy_hiddenimports = collect_all("scipy")
orbit_datas, orbit_binaries, orbit_hiddenimports = collect_all("orbit_dsp")
xgboost_datas, xgboost_binaries, xgboost_hiddenimports = collect_all("xgboost")
pandas_datas, pandas_binaries, pandas_hiddenimports = collect_all("pandas")

a = Analysis(
    ["main.py"],
    pathex=[],
    binaries=(
        librosa_binaries + numba_binaries + sklearn_binaries
        + scipy_binaries + orbit_binaries
        + xgboost_binaries + pandas_binaries
    ),
    datas=(
        librosa_datas + numba_datas + sklearn_datas
        + scipy_datas + orbit_datas
        + xgboost_datas + pandas_datas
        + [("dropdetect/model.joblib", "dropdetect")]
    ),
    hiddenimports=(
        librosa_hiddenimports + numba_hiddenimports + sklearn_hiddenimports
        + scipy_hiddenimports + orbit_hiddenimports
        + xgboost_hiddenimports + pandas_hiddenimports
        # drops.py is lazy-imported by main.py, so PyInstaller's static
        # analysis won't discover it (or the vendored dropdetect package).
        + ["drops", "dropdetect", "dropdetect.processors", "dropdetect.utilities"]
    ),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="orbit-sidecar",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
