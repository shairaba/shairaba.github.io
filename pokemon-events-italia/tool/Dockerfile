# Real Google Chrome (not Playwright's bundled Chromium) driving a copy of
# an organically-aged Chrome profile is the only combination that's gotten
# past events.pokemon.com's bot protection - see browser_client.py and
# README.md for why. Headless has never worked either, so Xvfb provides a
# virtual display for a real headed Chrome window to render into.
FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
        wget gnupg ca-certificates xvfb xauth \
    && wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y --no-install-recommends /tmp/chrome.deb \
    && rm /tmp/chrome.deb \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x entrypoint.sh

# First deploy is a single lightweight `inspect` call (no store writes) -
# proving the transplanted profile survives on Apify's infrastructure at
# all is the open question worth answering before building a daily
# `cli.py run` schedule on top of it.
ENTRYPOINT ["./entrypoint.sh"]
CMD ["python3", "cli.py", "inspect"]
