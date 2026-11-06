#!/usr/bin/env python3
"""Export paginated Classcard public API responses to JSON files.

The script uses only the Python standard library. The API key is requested
interactively unless CLASSCARD_API_KEY or --api-key is supplied.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import sys
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen


V2_BASE_URL = "https://api.classcardapp.com/api/v2/public"
PUBLIC_BASE_URL = "https://api.classcardapp.com/api/public"
DEFAULT_PER_PAGE = 100
MAX_PAGES = 1000
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)


ENDPOINTS: dict[str, dict[str, Any]] = {
    "students": {
        "base_url": V2_BASE_URL,
        "path": "/students",
        "params": {"show_custom_data": "1"},
    },
    "staff": {"base_url": V2_BASE_URL, "path": "/staff", "params": {}},
    "events": {"base_url": V2_BASE_URL, "path": "/events", "params": {}},
    "attendance": {"base_url": V2_BASE_URL, "path": "/attendance", "params": {}},
    "invoices": {"base_url": V2_BASE_URL, "path": "/invoices", "params": {}},
    "inventory_products": {
        "base_url": V2_BASE_URL,
        "path": "/inventory/products",
        "params": {"status": "0"},
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-key", help="Classcard API key. Omit to use CLASSCARD_API_KEY or prompt.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).with_name("output"),
        help="Directory for JSON files (default: scripts/classcard_export/output)",
    )
    parser.add_argument(
        "--per-page",
        type=int,
        default=DEFAULT_PER_PAGE,
        help="Requested page size (default: 100; Classcard may cap it).",
    )
    parser.add_argument(
        "--user-agent",
        default=os.getenv("CLASSCARD_USER_AGENT", DEFAULT_USER_AGENT),
        help="HTTP User-Agent (default: desktop Chrome signature).",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        choices=sorted(ENDPOINTS),
        help="Export only the named endpoints. By default all configured endpoints run.",
    )
    parser.add_argument("--start", help="Optional start date for events/attendance, YYYY-MM-DD.")
    parser.add_argument("--end", help="Optional end date for events/attendance, YYYY-MM-DD.")
    return parser.parse_args()


def get_api_key(cli_value: str | None) -> str:
    key = cli_value or os.getenv("CLASSCARD_API_KEY")
    if key:
        return key.strip()
    return getpass.getpass("Classcard API key (input hidden): ").strip()


def list_from_response(payload: Any) -> list[Any] | None:
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return None
    for key in ("data", "results", "items", "rows", "records", "students", "events"):
        value = payload.get(key)
        if isinstance(value, list):
            return value
    return None


def nested_dict(payload: Any, keys: tuple[str, ...]) -> dict[str, Any]:
    value: Any = payload
    for key in keys:
        if not isinstance(value, dict):
            return {}
        value = value.get(key)
    return value if isinstance(value, dict) else {}


def pagination_info(payload: Any) -> tuple[int | None, int | None, str | None]:
    """Return (current_page, last_page, next_page_url) for common API shapes."""
    candidates = [payload]
    for keys in (("pagination",), ("meta",), ("data", "pagination"), ("data", "meta")):
        candidates.append(nested_dict(payload, keys))

    current: int | None = None
    last: int | None = None
    next_url: str | None = None
    for candidate in candidates:
        if not candidate:
            continue
        current = current or as_int(candidate.get("current_page") or candidate.get("page"))
        last = last or as_int(
            candidate.get("last_page")
            or candidate.get("total_pages")
            or candidate.get("pages")
        )
        next_value = candidate.get("next_page_url") or candidate.get("next")
        if isinstance(next_value, str) and next_value:
            next_url = next_value
    return current, last, next_url


def as_int(value: Any) -> int | None:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def request_json(url: str, api_key: str, user_agent: str) -> Any:
    request = Request(
        url,
        headers={
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "User-Agent": user_agent,
            "api-key": api_key,
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8")
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        if error.code == 403 and (
            "cloudflare" in detail.lower()
            or "browser_signature_banned" in detail.lower()
            or "error 1010" in detail.lower()
        ):
            raise RuntimeError(
                "Classcard Cloudflare rejected this client signature (Error 1010). "
                "This is not a pagination or API-key error. The API provider must "
                "allowlist this client/IP if the browser-like request remains blocked. "
                f"Cloudflare response: {detail[:500]}"
            ) from error
        raise RuntimeError(f"{error.code} {error.reason}: {detail[:500]}") from error
    except URLError as error:
        raise RuntimeError(f"Network error: {error.reason}") from error
    try:
        return json.loads(body) if body else None
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Classcard returned non-JSON data: {body[:500]}") from error


def endpoint_url(endpoint: dict[str, Any], params: dict[str, str]) -> str:
    return f"{endpoint['base_url']}{endpoint['path']}?{urlencode(params)}"


def preserve_query_parameters(
    next_url: str,
    params: dict[str, str],
) -> str:
    """Keep Classcard's next-page URL while restoring omitted request options."""
    parsed = urlsplit(next_url)
    next_params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    for key, value in params.items():
        next_params.setdefault(key, value)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(next_params), ""))


def export_endpoint(
    name: str,
    endpoint: dict[str, Any],
    api_key: str,
    output_dir: Path,
    per_page: int,
    start: str | None,
    end: str | None,
    user_agent: str,
) -> int:
    combined: list[Any] = []
    page_responses: list[dict[str, Any]] = []
    page = 1
    next_url: str | None = None
    for old_page in output_dir.glob(f"{name}_page_*.json"):
        old_page.unlink()
    combined_file = output_dir / f"{name}.json"
    if combined_file.exists():
        combined_file.unlink()

    while page <= MAX_PAGES:
        params = dict(endpoint["params"])
        params.update({"page": str(page), "per_page": str(per_page)})
        if start and name in {"events", "attendance"}:
            params["start_date" if name == "attendance" else "start"] = start
        if end and name in {"events", "attendance"}:
            params["end_date" if name == "attendance" else "end"] = end

        url = preserve_query_parameters(next_url, params) if next_url else endpoint_url(endpoint, params)
        print(f"[{name}] requesting page {page}: {url}")
        payload = request_json(url, api_key, user_agent)
        rows = list_from_response(payload)
        if rows is not None:
            combined.extend(rows)
        page_file = output_dir / f"{name}_page_{page}.json"
        page_file.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        page_responses.append({"page": page, "file": page_file.name, "records": len(rows or [])})

        current, last, next_url = pagination_info(payload)
        if rows is None or not rows or (last is not None and (current or page) >= last):
            break
        if next_url:
            page += 1
            time.sleep(0.2)
            continue
        if current is not None and last is not None and current < last:
            page += 1
            time.sleep(0.2)
            continue
        if len(rows) < per_page:
            break
        page += 1
        time.sleep(0.2)
    else:
        raise RuntimeError(f"{name} exceeded the {MAX_PAGES}-page safety limit.")

    combined_file = output_dir / f"{name}.json"
    combined_file.write_text(
        json.dumps(
            {
                "endpoint": endpoint["path"],
                "exported_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "record_count": len(combined),
                "pages": page_responses,
                "records": combined,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"[{name}] saved {len(combined)} records across {len(page_responses)} page(s) to {combined_file}")
    return len(combined)


def main() -> int:
    args = parse_args()
    if args.per_page < 1:
        print("--per-page must be at least 1.", file=sys.stderr)
        return 2
    api_key = get_api_key(args.api_key)
    if not api_key:
        print("An API key is required.", file=sys.stderr)
        return 2
    args.output_dir.mkdir(parents=True, exist_ok=True)

    selected = args.only or list(ENDPOINTS)
    total = 0
    try:
        for name in selected:
            total += export_endpoint(
                name,
                ENDPOINTS[name],
                api_key,
                args.output_dir,
                args.per_page,
                args.start,
                args.end,
                args.user_agent,
            )
    except RuntimeError as error:
        print(f"Export failed: {error}", file=sys.stderr)
        return 1
    print(f"Export complete: {total} records written to {args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())