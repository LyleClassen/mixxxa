# PyInstaller spec for measuring the frozen structure-sidecar size (#31).
# onedir: a ~1 GB onefile build would re-extract to temp on every launch.

from PyInstaller.utils.hooks import collect_all

datas, binaries, hiddenimports = [], [], []
for pkg in (
    "allin1_infer",
    "demucs_infer",
    "madmom_infer",
    "torch",
    "torchaudio",
    "scipy",
    "numpy",
):
    try:
        d, b, h = collect_all(pkg)
    except Exception as exc:  # package layout differences shouldn't abort the build
        print(f"collect_all({pkg}) failed: {exc}")
        continue
    datas += d
    binaries += b
    hiddenimports += h

a = Analysis(
    ["main.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "IPython"],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="structure-sidecar",
    debug=False,
    strip=False,
    upx=False,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    name="structure-sidecar",
)
