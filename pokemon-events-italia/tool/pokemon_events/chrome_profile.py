"""Maintains a lightweight, session-relevant copy of the local machine's
real Chrome profile, used to drive `events.pokemon.com` as a genuinely
"real" browser rather than a fresh automation profile.

Why this exists: testing showed the site's WAF reliably 403s the app's own
bootstrap API call for a freshly-created automation profile - true even
when driving the actual Google Chrome binary (`channel="chrome"`), true
regardless of headed/headless, true from both a residential IP and a
GitHub Actions datacenter IP. The one thing that worked, every time, with
no flakiness: a copy of this machine's real, organically-aged Chrome
profile. A brand-new profile with zero history looks synthetic to
whatever heuristic is scoring these sessions; a real profile doesn't.

Only the files needed for session/cookie state are copied - not the full
profile (which runs several GB of cache/extensions/IndexedDB on a normal
machine) - so this stays fast and doesn't duplicate unrelated browsing
data any more than necessary.
"""

from __future__ import annotations

import shutil
from pathlib import Path

REAL_CHROME_DIR = Path.home() / "Library" / "Application Support" / "Google" / "Chrome"
REAL_PROFILE_NAME = "Default"

_FILES_TO_COPY = ["Cookies", "Cookies-journal", "Preferences", "Secure Preferences"]
_DIRS_TO_COPY = ["Local Storage"]


def refresh_profile(dest_dir: Path) -> None:
    """Copy the current session-relevant state from the real Chrome profile
    into `dest_dir`, creating or overwriting it. Chrome does not need to be
    closed - files are copied as a best-effort snapshot (including any
    -journal/-wal files alongside them), which is good enough for cookie
    state even if not perfectly transactionally consistent."""
    real_profile = REAL_CHROME_DIR / REAL_PROFILE_NAME
    if not real_profile.exists():
        raise FileNotFoundError(
            f"Real Chrome profile not found at {real_profile} - this only supports macOS Chrome "
            "with the default profile layout. Adjust chrome_profile.py if yours differs."
        )

    dest_profile = dest_dir / REAL_PROFILE_NAME
    dest_profile.mkdir(parents=True, exist_ok=True)

    local_state = real_profile.parent / "Local State"
    if local_state.exists():
        shutil.copy2(local_state, dest_dir / "Local State")

    for name in _FILES_TO_COPY:
        src = real_profile / name
        if src.exists():
            shutil.copy2(src, dest_profile / name)

    for name in _DIRS_TO_COPY:
        src = real_profile / name
        if src.exists():
            dst = dest_profile / name
            if dst.exists():
                shutil.rmtree(dst)
            shutil.copytree(src, dst)


def ensure_profile(dest_dir: Path) -> Path:
    """Refresh the profile copy only if it doesn't exist yet - call
    `refresh_profile` directly (or `cli.py refresh-profile`) to force an
    update once cookies go stale."""
    if not (dest_dir / REAL_PROFILE_NAME / "Cookies").exists():
        refresh_profile(dest_dir)
    return dest_dir
