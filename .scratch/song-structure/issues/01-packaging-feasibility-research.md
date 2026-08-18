# Research: all-in-one-fix packaging feasibility

Type: research
Status: open

## Question

Can all-in-one-fix ship inside Mixxxa's no-Python-for-users constraint? Investigate: full dependency tree (PyTorch, NATTEN, demucs, madmom) and its size on Windows; whether NATTEN has prebuilt Windows wheels or needs compilation; CPU-only runtime and realistic per-track analysis time; model weight downloads (size, license, can they be bundled or fetched on first use); whether the existing bundled-Python ONNX sidecar approach extends to this or a separate heavyweight sidecar/optional download is needed; license compatibility. Output: markdown summary with a recommended packaging approach.
