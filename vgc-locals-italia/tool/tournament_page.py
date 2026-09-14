"""Render a fully static per-tournament HTML page (../t/<id>.html), with the
roster content baked directly into the HTML (not fetched client-side) and
real <meta property="og:*"> tags - both needed because social link-preview
crawlers (X, WhatsApp, Telegram) don't execute JavaScript, so a client-
rendered page (the old tournament.html?id=... approach) would only ever
show them an empty shell with no per-tournament title/image.

The visual result still matches the rest of the site (same style.css
classes - .panel, .roster-card, .badge.type-*, .sprite-chip, etc. - just
generated as a Python string instead of built by submit.js/app.js in the
browser), and still gets the theme toggle since app.js/style.css are loaded
normally.
"""

import html
from pathlib import Path

SITE_BASE = "https://shairaba.github.io/vgc-locals-italia"

LIMITLESS_SPRITE_BASE = "https://r2.limitlesstcg.net/pokemon/gen9"
POKESTATS_SPRITE_BASE = "https://pokestats.top/images/pokemon/imgs"

THEME_SCRIPT = """  <script>
  (function () {
    var m = document.cookie.match(/(?:^|; )theme=(dark|light)/);
    var theme = m ? m[1] : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  })();
  </script>"""

TOPBAR = """  <header class="topbar">
    <a class="brand-group" href="../index.html">
      <img class="logo" src="../logo.svg" alt="">
      <span class="brand">VGC Locals Italia</span>
    </a>
    <div class="topbar-controls">
      <nav>
        <a href="../index.html">Tournaments</a>
        <a href="../dashboard.html">Dashboard</a>
        <a href="../submit.html">Submit results</a>
      </nav>
      <button id="theme-toggle" type="button" aria-label="Toggle dark mode">
        <span class="theme-switch-icon theme-switch-sun" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path>
          </svg>
        </span>
        <span class="theme-switch-icon theme-switch-moon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5z"></path>
          </svg>
        </span>
        <span class="theme-switch-knob"></span>
      </button>
    </div>
  </header>"""


def esc(s):
    return html.escape(str(s) if s is not None else "", quote=True)


def sprite_chip_html(species_id, name):
    primary = esc(f"{LIMITLESS_SPRITE_BASE}/{species_id}.png")
    fallback = esc(f"{POKESTATS_SPRITE_BASE}/{species_id}.png")
    return (
        f'<span class="sprite-chip"><img class="sprite" src="{primary}" '
        f'alt="{esc(name)}" title="{esc(name)}" loading="lazy" '
        f'onerror="this.onerror=null;this.src=\'{fallback}\';"></span>'
    )


def type_badge_html(tournament_type):
    slug = "cup" if tournament_type == "VG Cup" else "challenge"
    return f'<span class="badge type-{slug}">{esc(tournament_type)}</span>'


def roster_card_html(roster):
    mon_html = "".join(
        f'''
        <div class="mon-mini">
          {sprite_chip_html(mon["species_id"], mon["species_name"])}
          <span class="truncate">{esc(mon["species_name"])}</span>
        </div>'''
        for mon in roster.get("team") or []
    )
    return f'''
        <div class="roster-card">
          <div class="roster-card-head">
            <span class="roster-place">{esc(roster.get("placement") or "-")}</span>
            <span class="roster-player">{esc(roster.get("player_name") or "Anonymous")}</span>
          </div>
          <div class="mon-mini-grid">{mon_html}</div>
        </div>'''


def render_tournament_page(tournament):
    tid = tournament["id"]
    name = tournament["name"]
    winner = tournament.get("winner")
    winner_name = (winner.get("player_name") if winner else None) or "Anonymous"
    description = (
        f"Won by {winner_name} — {tournament['tournament_type']}, "
        f"{tournament['number_of_players']} players → top {tournament['top_cut_size']}."
    )
    page_url = f"{SITE_BASE}/t/{tid}.html"
    image_url = f"{SITE_BASE}/data/og/{tid}.png"

    rosters = sorted(
        tournament.get("rosters") or [],
        key=lambda r: int("".join(c for c in (r.get("placement") or "") if c.isdigit()) or 999),
    )
    roster_html = "".join(roster_card_html(r) for r in rosters) or (
        '<p class="empty-state">No teams submitted for this tournament yet.</p>'
    )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(name)} - VGC Locals Italia</title>
  <meta name="description" content="{esc(description)}">

  <meta property="og:type" content="website">
  <meta property="og:url" content="{esc(page_url)}">
  <meta property="og:title" content="{esc(name)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:image" content="{esc(image_url)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(name)}">
  <meta name="twitter:description" content="{esc(description)}">
  <meta name="twitter:image" content="{esc(image_url)}">

  <link rel="icon" href="../logo.svg" type="image/svg+xml">
{THEME_SCRIPT}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../style.css">
</head>
<body>
{TOPBAR}
  <main class="container">
    <p class="breadcrumb"><a href="../index.html">&larr; All tournaments</a></p>

    <div class="detail-title-row">
      <h1>{esc(name)}</h1>
      {type_badge_html(tournament["tournament_type"])}
    </div>
    <p class="lede">{esc(tournament["date"])} &middot; {tournament["number_of_players"]} players &rarr; top {tournament["top_cut_size"]}</p>

    <section class="panel">
      <h2>All top-cut teams</h2>
      <div class="roster-list">{roster_html}</div>
    </section>

    <p class="footnote">
      Not affiliated with The Pok&eacute;mon Company International.
    </p>
  </main>

  <script src="../app.js"></script>
</body>
</html>
"""


def write_tournament_page(tournament, output_dir):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / f"{tournament['id']}.html").write_text(
        render_tournament_page(tournament), encoding="utf-8"
    )
