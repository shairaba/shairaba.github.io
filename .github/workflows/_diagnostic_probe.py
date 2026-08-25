"""Throwaway diagnostic: does a GitHub Actions runner's IP get past
Incapsula's JS challenge on events.pokemon.com any better/worse than a
residential IP did locally? Not part of the real scraper - delete after use.
"""

import time

from playwright.sync_api import sync_playwright

URL = (
    "https://events.pokemon.com/EventLocator/"
    "?locale=it-IT&range=150&startdate=2026-08-25&iskm=true"
    "&latitude=45.468503&longitude=9.182402699999999&filters=vg"
)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            geolocation={"latitude": 45.468503, "longitude": 9.1824027},
            permissions=["geolocation"],
        )
        page = context.new_page()
        requests = []
        page.on("request", lambda r: requests.append(r.url))
        console_msgs = []
        page.on("console", lambda m: console_msgs.append(f"[{m.type}] {m.text}"))
        page.on("pageerror", lambda e: console_msgs.append(f"[pageerror] {e}"))
        set_cookie_responses = []

        def on_response(r):
            try:
                headers = r.headers
                if "set-cookie" in headers:
                    set_cookie_responses.append((r.url, headers["set-cookie"][:200]))
            except Exception:
                pass

        page.on("response", on_response)

        page.goto(URL, wait_until="domcontentloaded", timeout=45000)
        for i in range(30):
            page.mouse.move(200 + (i % 10) * 30, 300 + (i % 10) * 15, steps=5)
            time.sleep(1)

        cookie_names = sorted(c["name"] for c in context.cookies())
        reached_real_app = any("OutSystems" in u or "moduleservices" in u for u in requests)

        js_cookie = page.evaluate("document.cookie")
        local_storage = page.evaluate(
            "JSON.stringify(Object.fromEntries(Object.entries(localStorage)))"
        )
        session_storage = page.evaluate(
            "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))"
        )

        print("=== RESULT ===")
        print(f"reached_real_app: {reached_real_app}")
        print(f"nr2Users present (context.cookies): {'nr2Users' in cookie_names}")
        print(f"cookies (context.cookies): {cookie_names}")
        print(f"document.cookie (from page JS): {js_cookie}")
        print(f"localStorage: {local_storage[:2000]}")
        print(f"sessionStorage: {session_storage[:2000]}")

        print("=== SET-COOKIE RESPONSE HEADERS ===")
        for url, sc in set_cookie_responses:
            print(f"{url[:120]} -> {sc}")

        maps_related = [u for u in requests if "maps.google" in u or "googleapis" in u]
        print(f"=== MAPS/GOOGLEAPIS REQUESTS ({len(maps_related)}) ===")
        for u in maps_related:
            print(u[:200])

        print(f"=== ALL REQUESTS ({len(requests)}) ===")
        for u in requests:
            print(u[:200])

        print(f"=== CONSOLE/PAGEERROR MESSAGES ({len(console_msgs)}) ===")
        for m in console_msgs[:60]:
            print(m[:300])

        browser.close()


if __name__ == "__main__":
    main()
