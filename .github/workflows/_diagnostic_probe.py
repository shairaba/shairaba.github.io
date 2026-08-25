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
        page.goto(URL, wait_until="domcontentloaded", timeout=45000)
        for i in range(8):
            page.mouse.move(200 + i * 30, 300 + i * 15, steps=5)
            time.sleep(1)

        cookie_names = sorted(c["name"] for c in context.cookies())
        reached_real_app = any("OutSystems" in u or "moduleservices" in u for u in requests)

        print("=== RESULT ===")
        print(f"reached_real_app: {reached_real_app}")
        print(f"nr2Users present: {'nr2Users' in cookie_names}")
        print(f"cookies: {cookie_names}")
        print("=== REQUESTS (up to 20) ===")
        for u in requests[:20]:
            print(u[:180])

        browser.close()


if __name__ == "__main__":
    main()
