"""Single entrypoint for the Lombardia VGC event scraper.

    python cli.py inspect
    python cli.py run
    python cli.py status
"""

from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
from pathlib import Path

from pokemon_events.browser_client import PokemonEventLocatorClient, SearchParams
from pokemon_events.sync import DEFAULT_MAX_RECORDS, DEFAULT_STORE_PATH, cmd_run, cmd_status

RAW_DUMP_DIR = Path(__file__).resolve().parent / "data" / "raw"

# The user's own captured search point (Milan) and range.
DEFAULT_LATITUDE = "45.468503"
DEFAULT_LONGITUDE = "9.182402699999999"
DEFAULT_RANGE_KM = "150"


def cmd_inspect(args: argparse.Namespace) -> None:
    from pokemon_events import api

    search = SearchParams(
        latitude=args.latitude,
        longitude=args.longitude,
        range_km=args.range_km,
        start_date=date.today().isoformat(),
    )
    payload = api.build_payload(search, max_records=args.max_records)

    print(f"Bootstrapping session (headless={args.headless})...")
    with PokemonEventLocatorClient(headless=args.headless) as client:
        client.bootstrap(search)
        print("Session ready, posting event list request...")
        response = client.post_json(payload)

    RAW_DUMP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = RAW_DUMP_DIR / f"sample_response_{timestamp}.json"
    import json

    out_path.write_text(json.dumps(response, indent=2, ensure_ascii=False))
    print(f"Wrote raw response to {out_path}")
    print(f"Top-level response keys: {sorted(response.keys())}")
    if isinstance(response.get("data"), dict):
        print(f"data keys: {sorted(response['data'].keys())}")


def _add_headless_flag(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--headless",
        action="store_true",
        help="run headless instead of the default headed mode (headless gets 403'd by the site's WAF - see tool/README.md)",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Lombardia VGC event scraper")
    sub = parser.add_subparsers(dest="command", required=True)

    p_inspect = sub.add_parser(
        "inspect",
        help="Fire one raw request and dump the response to tool/data/raw/ for manual inspection - no store writes",
    )
    p_inspect.add_argument("--latitude", default=DEFAULT_LATITUDE)
    p_inspect.add_argument("--longitude", default=DEFAULT_LONGITUDE)
    p_inspect.add_argument("--range-km", default=DEFAULT_RANGE_KM)
    p_inspect.add_argument("--max-records", type=int, default=200)
    _add_headless_flag(p_inspect)
    p_inspect.set_defaults(func=cmd_inspect)

    p_run = sub.add_parser("run", help="Fetch, filter to Lombardy, and upsert into the store (safe to re-run)")
    p_run.add_argument("--latitude", default=DEFAULT_LATITUDE)
    p_run.add_argument("--longitude", default=DEFAULT_LONGITUDE)
    p_run.add_argument("--range-km", default=DEFAULT_RANGE_KM)
    p_run.add_argument("--filters", default="vg", help="product type filter sent to the API, e.g. 'vg'")
    p_run.add_argument("--max-records", type=int, default=DEFAULT_MAX_RECORDS)
    p_run.add_argument(
        "--extra-points",
        default=None,
        help="extra 'lat,lon' search centers to merge in (by GUID), separated by ';' - "
        "for covering gaps a single radius might miss, e.g. near Sondrio/Bormio",
    )
    p_run.add_argument(
        "--force-empty",
        action="store_true",
        help="proceed even if the fetch came back suspiciously small vs. what's already in the store",
    )
    p_run.add_argument("--out", default=str(DEFAULT_STORE_PATH))
    _add_headless_flag(p_run)
    p_run.set_defaults(func=cmd_run)

    p_status = sub.add_parser("status", help="Show how many events are tracked and active in the store")
    p_status.add_argument("--out", default=str(DEFAULT_STORE_PATH))
    p_status.set_defaults(func=cmd_status)

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
