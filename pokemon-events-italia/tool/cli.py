"""Single entrypoint for the Italy-wide Pokemon event scraper.

    python cli.py inspect
    python cli.py run
    python cli.py status
    python cli.py refresh-profile
"""

from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
from pathlib import Path

from pokemon_events.browser_client import DEFAULT_PROFILE_DIR, PokemonEventLocatorClient, SearchParams
from pokemon_events.sync import DEFAULT_MAX_RECORDS, DEFAULT_STORE_PATH, GAME_FILTERS, cmd_run, cmd_status

RAW_DUMP_DIR = Path(__file__).resolve().parent / "data" / "raw"

# Milan - used only as the single-point default for `inspect`.
DEFAULT_LATITUDE = "45.4642"
DEFAULT_LONGITUDE = "9.1900"
DEFAULT_RANGE_KM = "150"


def cmd_inspect(args: argparse.Namespace) -> None:
    from pokemon_events import api

    search = SearchParams(
        latitude=args.latitude,
        longitude=args.longitude,
        range_km=args.range_km,
        start_date=date.today().isoformat(),
        filters=args.game,
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


def cmd_refresh_profile(args: argparse.Namespace) -> None:
    from pokemon_events import chrome_profile

    profile_dir = Path(args.profile_dir)
    print(f"Refreshing {profile_dir} from the real Chrome profile...")
    chrome_profile.refresh_profile(profile_dir)
    print("Done.")


def _add_headless_flag(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--headless",
        action="store_true",
        help="run headless instead of the default headed mode (never once gotten past the site's WAF in testing - see tool/README.md)",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Italy-wide Pokemon event scraper")
    sub = parser.add_subparsers(dest="command", required=True)

    p_inspect = sub.add_parser(
        "inspect",
        help="Fire one raw request (single point, single game) and dump the response to tool/data/raw/ for manual inspection - no store writes",
    )
    p_inspect.add_argument("--latitude", default=DEFAULT_LATITUDE)
    p_inspect.add_argument("--longitude", default=DEFAULT_LONGITUDE)
    p_inspect.add_argument("--range-km", default=DEFAULT_RANGE_KM)
    p_inspect.add_argument("--game", default="vg", choices=GAME_FILTERS)
    p_inspect.add_argument("--max-records", type=int, default=200)
    _add_headless_flag(p_inspect)
    p_inspect.set_defaults(func=cmd_inspect)

    p_run = sub.add_parser(
        "run",
        help="Fetch every game across nationwide anchor points, filter to Italy, and upsert into the store (safe to re-run)",
    )
    p_run.add_argument("--range-km", default=DEFAULT_RANGE_KM)
    p_run.add_argument(
        "--filters",
        default=None,
        help=f"comma-separated game filters to query, e.g. 'vg,tcg,pgo'. Defaults to all: {','.join(GAME_FILTERS)}",
    )
    p_run.add_argument("--max-records", type=int, default=DEFAULT_MAX_RECORDS)
    p_run.add_argument(
        "--points",
        default=None,
        help="override the built-in nationwide anchor points with 'lat,lon;lat,lon;...' - "
        "for a targeted re-run instead of a full nationwide sync",
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

    p_refresh = sub.add_parser(
        "refresh-profile",
        help="Re-copy session state (cookies etc.) from the real local Chrome profile - run this if `run` starts failing to bootstrap",
    )
    p_refresh.add_argument("--profile-dir", default=str(DEFAULT_PROFILE_DIR))
    p_refresh.set_defaults(func=cmd_refresh_profile)

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
