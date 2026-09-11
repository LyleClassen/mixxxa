# Stand-in for the structure-sidecar entrypoint, sized like the real one:
# imports the full analysis stack so PyInstaller pulls the same tree in.
import json
import sys


def main() -> None:
    import allin1_infer  # noqa: F401
    import torch  # noqa: F401

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req = json.loads(line)
        sys.stdout.write(json.dumps({"id": req.get("id"), "ok": True}) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
