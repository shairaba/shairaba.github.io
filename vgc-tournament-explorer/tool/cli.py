"""Single entrypoint for the extractor.

    python cli.py sync run --recent-days 90
    python cli.py sync backfill --pages 20
    python cli.py sync status
    python cli.py serve
"""

from __future__ import annotations

import sys


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in {"sync", "serve"}:
        print(__doc__)
        sys.exit(1)

    mode, rest = sys.argv[1], sys.argv[2:]

    if mode == "sync":
        from limitless_extractor.sync import main as sync_main
        sync_main(rest)
    elif mode == "serve":
        from webapp.app import app
        app.run(debug=True, port=5050)


if __name__ == "__main__":
    main()
