#!/usr/bin/env python3
"""
Test script to compare IO API results vs. IO web browse page for a restricted collection.

Usage:
    python scripts/test-io-restricted.py [--date YYYY-MM-DD] [--type photos|videos|both]

Requirements:
    pip install requests selenium webdriver-manager
"""

import argparse
import json
import sys
import time
from datetime import datetime, timezone

import urllib3
import requests

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

IO_KEY = "002773CC-9413-D6D4-DF25C3C2D2487A41"
IO_HOST = "https://io.jsc.nasa.gov"

# Collections to test
COLLECTIONS = {
    "ARTEMIS (public, 2346894)": 2346894,
    "Artemis (Training) - DA - EVA & Human Surface Mobility Program (2375374)": 2375374,
}

# ── helpers ──────────────────────────────────────────────────────────────────

def fmt_date(date_str: str) -> str:
    """Convert YYYY-MM-DD to MM-DD-YYYY (IO API format)."""
    y, m, d = date_str.split("-")
    return f"{m}-{d}-{y}"


def build_api_url(params: str) -> str:
    """Replicate the exact URL format used in io-api.ts."""
    # io-api.ts: `${IO_HOST}/api/search/rpp=500&${params}?key=${IO_KEY}&format=json`
    return f"{IO_HOST}/api/search/rpp=500&{params}?key={IO_KEY}&format=json"


def call_api(params: str, label: str) -> dict:
    url = build_api_url(params)
    print(f"\n  GET {url}")
    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Encoding": "gzip,deflate,br",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Origin": "https://coda.fit.nasa.gov",
    }
    resp = requests.get(url, headers=headers, timeout=30, verify=False)
    print(f"  HTTP {resp.status_code}")
    if resp.status_code != 200:
        print(f"  !! Error body: {resp.text[:500]}")
        return {}
    try:
        return resp.json()
    except Exception as e:
        print(f"  !! Failed to parse JSON: {e}")
        print(f"  Body preview: {resp.text[:500]}")
        return {}


def summarise(data: dict, label: str):
    results = data.get("results")
    if not results:
        print(f"  [{label}] No 'results' key in response — likely 0 results or auth required.")
        print(f"  Keys present: {list(data.keys())}")
        if 'error' in data:
            print(f"  Error value: {json.dumps(data['error'])[:300]}")
        return 0
    resp = results.get("response", {})
    numfound = resp.get("numfound", "?")
    docs = resp.get("docs", [])
    print(f"  [{label}] numfound={numfound}, docs returned={len(docs)}")
    for doc in docs[:5]:
        print(f"    - {doc.get('nasa_id', '?')} | {doc.get('md_title', '?')[:60]}")
    if len(docs) > 5:
        print(f"    ... ({len(docs) - 5} more)")
    return numfound


# ── browser comparison ────────────────────────────────────────────────────────

def browse_with_selenium(collection_id: int, date_str: str, media_type: str):
    """
    Open a real browser, let the user authenticate, then scrape the browse page
    to count how many assets are actually visible on the IO website.
    """
    try:
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.common.exceptions import TimeoutException
    except ImportError:
        print("\n  [browser] selenium not installed. Run: pip install selenium webdriver-manager")
        print("  Skipping browser comparison.")
        return

    try:
        from webdriver_manager.chrome import ChromeDriverManager
        from selenium.webdriver.chrome.service import Service
        options = webdriver.ChromeOptions()
        options.add_argument("--start-maximized")
        driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    except Exception:
        try:
            driver = webdriver.Chrome()
        except Exception as e:
            print(f"\n  [browser] Could not launch Chrome: {e}")
            print("  Try: pip install webdriver-manager  OR install ChromeDriver manually.")
            return

    # as=1 photo, as=2 video
    as_code = 1 if media_type == "photos" else 2

    browse_url = (
        f"{IO_HOST}/app/browse.cfm"
        f"?cid={collection_id}&as={as_code}&rpp=100"
    )

    print(f"\n  [browser] Opening: {browse_url}")
    print("  Please log in if prompted, then press Enter here to continue scraping...")
    driver.get(browse_url)

    input("  >>> Press Enter once you are logged in and can see results on the page: ")

    # Refresh to make sure we're on the right page after login
    driver.get(browse_url)
    time.sleep(3)

    # Try to read the result count from the page
    try:
        wait = WebDriverWait(driver, 15)
        # IO typically shows something like "1 - 100 of 247 results"
        count_el = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".count, .results-count, #resultCount, .pagination"))
        )
        print(f"  [browser] Count element text: {count_el.text.strip()}")
    except TimeoutException:
        print("  [browser] Could not find a count element automatically.")

    # Count visible asset tiles
    try:
        tiles = driver.find_elements(By.CSS_SELECTOR, ".asset-tile, .result-item, .browseResult, li.result")
        print(f"  [browser] Visible asset tiles on page: {len(tiles)}")
        for t in tiles[:5]:
            print(f"    - {t.text[:80].strip()}")
    except Exception as e:
        print(f"  [browser] Could not count tiles: {e}")

    # Dump the page title and URL for confirmation
    print(f"  [browser] Page title: {driver.title}")
    print(f"  [browser] Final URL:  {driver.current_url}")

    input("\n  >>> Press Enter to close the browser: ")
    driver.quit()


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Test IO API vs web browse for restricted collection")
    parser.add_argument("--date", default="2026-04-01", help="Date to query (YYYY-MM-DD, default: 2026-04-01)")
    parser.add_argument("--type", choices=["photos", "videos", "both"], default="both")
    parser.add_argument("--browser", action="store_true", help="Also open browser to compare with IO web UI")
    args = parser.parse_args()

    date_str = args.date
    io_date = fmt_date(date_str)
    # Also fetch the day before (video logic fetches t-1 to t)
    y, m, d = date_str.split("-")
    prev_day = datetime(int(y), int(m), int(d), tzinfo=timezone.utc)
    from datetime import timedelta
    prev_day_dt = prev_day - timedelta(days=1)
    prev_day_str = prev_day_dt.strftime("%Y-%m-%d")
    io_prev_date = fmt_date(prev_day_str)

    print("=" * 70)
    print(f"IO Restricted Collection Test  |  date={date_str}")
    print("=" * 70)

    for col_label, col_id in COLLECTIONS.items():
        print(f"\n{'─'*60}")
        print(f"Collection: {col_label}")
        print(f"{'─'*60}")

        if args.type in ("photos", "both"):
            print("\n  [PHOTOS]")
            params = f"s_dt={io_date}&e_dt={io_date}&as=1&so=7&cols={col_id}"
            data = call_api(params, "photos")
            count = summarise(data, f"{col_label} photos")

        if args.type in ("videos", "both"):
            print("\n  [VIDEOS]")
            # Replicate io-api.ts: fetch (date-1) to date
            params = f"s_dt={io_prev_date}&e_dt={io_date}&cols={col_id}&as=2"
            data = call_api(params, "videos")
            count = summarise(data, f"{col_label} videos")

        if args.browser:
            mt = "photos" if args.type == "photos" else "videos"
            browse_with_selenium(col_id, date_str, mt)

    print("\n" + "=" * 70)
    print("Done.")
    print()
    print("Interpretation guide:")
    print("  numfound=0 and no docs  → collection returns nothing via API key auth")
    print("  HTTP 403 / empty body   → API key has no access to this restricted collection")
    print("  numfound>0 via public   → public collection works fine; restricted one is blocked")
    print("  Browser shows items     → items EXIST but are gated behind SSO, not API key")
    print("=" * 70)


if __name__ == "__main__":
    main()
