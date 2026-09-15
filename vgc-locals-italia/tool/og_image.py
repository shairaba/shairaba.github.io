"""Generate a per-tournament Open Graph preview image (1200x630 PNG) - the
picture X/WhatsApp/Telegram show when someone shares a tournament link.

Social link-preview crawlers don't execute JavaScript, so this can't reuse
the site's own CSS-driven look at request time - it has to be a real,
pre-rendered raster image sitting at a stable URL, generated here (Pillow)
as part of the same ingest run that produces everything else in data/, and
referenced via a plain <meta property="og:image"> in the static HTML
tournament_page.py generates (see that module).

Colors/proportions are a hand-matched approximation of style.css's gradient
+ badge palette, not a literal render of the CSS - Pillow has no CSS engine,
so this redraws the same visual language (gradient, pill badges, sprite
chips) with PIL's own primitives instead of trying to rasterize the site.
"""

import io
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont

from sprite_map import new_cdn_sprite_url

FONT_PATH = Path(__file__).resolve().parent / "fonts" / "Montserrat-Variable.ttf"

CANVAS_W, CANVAS_H = 1200, 630
MARGIN = 72

# Matches style.css's :root tokens (light-mode gradient, dark-mode badge
# colors - the badge colors read better against this gradient than the
# pale light-mode ones, which were designed to sit on a white panel).
BG_A = (107, 99, 230)  # #6b63e6
BG_B = (38, 36, 86)  # #262456
WHITE = (255, 255, 255)
MUTED = (214, 211, 247)  # --muted
PANEL_TRANSLUCENT = (255, 255, 255, 40)
CUP_COLOR = (240, 180, 41)  # dark-mode --cup-color
CHALLENGE_COLOR = (255, 127, 196)  # dark-mode --challenge-color

LIMITLESS_SPRITE_BASE = "https://r2.limitlesstcg.net/pokemon/gen9"
POKESTATS_SPRITE_BASE = "https://pokestats.top/images/pokemon/imgs"

_sprite_cache = {}


def _font(weight, size):
    f = ImageFont.truetype(str(FONT_PATH), size)
    f.set_variation_by_name(weight)
    return f


def _unknown_sprite():
    # Same generic "?" glyph as unknown.svg (own artwork, not a real
    # species) - drawn directly since Pillow can't open SVG, same way the
    # brand pokeball mark below is drawn rather than loaded from a file.
    size = 200
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([0, 0, size, size], fill=(226, 229, 236, 255))
    font = _font("Bold", 130)
    bbox = draw.textbbox((0, 0), "?", font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((size / 2 - w / 2 - bbox[0], size / 2 - h / 2 - bbox[1]), "?", font=font, fill=(139, 147, 163, 255))
    return img


def _fetch_sprite(species_id):
    if species_id in _sprite_cache:
        return _sprite_cache[species_id]

    if species_id == "unknown":
        img = _unknown_sprite()
        _sprite_cache[species_id] = img
        return img

    urls = []
    new_cdn = new_cdn_sprite_url(species_id)
    if new_cdn:
        urls.append(new_cdn)
    urls += [f"{LIMITLESS_SPRITE_BASE}/{species_id}.png", f"{POKESTATS_SPRITE_BASE}/{species_id}.png"]

    img = None
    for url in urls:
        try:
            resp = requests.get(url, timeout=10)
            if resp.ok and resp.content:
                img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
                break
        except requests.RequestException:
            continue
    _sprite_cache[species_id] = img
    return img


def _lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def _draw_gradient_background(draw):
    # Diagonal-ish approximation: interpolate top-to-bottom, matching
    # style.css's linear-gradient(160deg, --bg-a, --bg-b 65%) closely enough
    # for a small social-preview image.
    for y in range(CANVAS_H):
        t = min(1.0, (y / CANVAS_H) / 0.65)
        color = _lerp(BG_A, BG_B, t)
        draw.line([(0, y), (CANVAS_W, y)], fill=color)


def _draw_pill(draw, xy, text, font, fg, bg):
    x, y = xy
    pad_x, pad_y = 18, 10
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    rect = [x, y, x + w + pad_x * 2, y + h + pad_y * 2]
    draw.rounded_rectangle(rect, radius=(rect[3] - rect[1]) // 2, fill=bg)
    draw.text((x + pad_x - bbox[0], y + pad_y - bbox[1]), text, font=font, fill=fg)
    return rect[2] - rect[0]  # pill width, for laying out the next element


def _wrap_title(draw, text, font, max_width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] > max_width and current:
            lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    return lines[:2]  # never more than 2 lines - a very long name just truncates


def render_og_image(tournament, output_path):
    """tournament: the same dict build_tournament_json() produces."""
    img = Image.new("RGB", (CANVAS_W, CANVAS_H))
    draw = ImageDraw.Draw(img, "RGBA")
    _draw_gradient_background(draw)

    # Wordmark
    brand_font = _font("Bold", 26)
    draw.ellipse([MARGIN, 56, MARGIN + 34, 90], fill=WHITE)
    draw.arc([MARGIN, 56, MARGIN + 34, 90], start=180, end=360, fill=(238, 21, 21), width=17)
    draw.text((MARGIN + 48, 58), "VGC Locals Italia", font=brand_font, fill=WHITE)

    # Title (tournament name), wrapped up to 2 lines
    title_font = _font("Bold", 56)
    max_title_width = CANVAS_W - MARGIN * 2
    lines = _wrap_title(draw, tournament["name"], title_font, max_title_width)
    y = 148
    for line in lines:
        draw.text((MARGIN, y), line, font=title_font, fill=WHITE)
        y += 66

    # Badge + meta line
    badge_font = _font("Bold", 22)
    is_cup = tournament["tournament_type"] == "VG Cup"
    badge_color = CUP_COLOR if is_cup else CHALLENGE_COLOR
    badge_bg = (255, 255, 255, 40)
    pill_w = _draw_pill(draw, (MARGIN, y + 10), tournament["tournament_type"], badge_font, badge_color, badge_bg)

    meta_font = _font("SemiBold", 24)
    meta_text = f"{tournament['date']}  ·  {tournament['number_of_players']} players → top {tournament['top_cut_size']}"
    draw.text((MARGIN + pill_w + 16, y + 16), meta_text, font=meta_font, fill=MUTED)

    # Winner + team
    winner = tournament.get("winner")
    if winner:
        winner_font = _font("SemiBold", 26)
        winner_y = y + 66
        draw.text(
            (MARGIN, winner_y),
            f"Winner: {winner.get('player_name') or 'Anonymous'}",
            font=winner_font,
            fill=WHITE,
        )

        # No species-name labels under the chips (by request) - just big,
        # clean sprites. That frees up the space labels + their gap used to
        # need, so the chips can be noticeably bigger than a labeled row
        # could afford.
        chip_y = winner_y + 46
        chip_size = 155
        gap = 20
        slot = chip_size + gap
        team = winner.get("team") or []
        chip_x = MARGIN

        for mon in team[:6]:
            draw.rounded_rectangle(
                [chip_x, chip_y, chip_x + chip_size, chip_y + chip_size],
                radius=20,
                fill=(255, 255, 255, 230),
            )
            sprite = _fetch_sprite(mon["species_id"])
            if sprite:
                inner = chip_size - 24
                # Source sprites are small (~64-96px natively) - thumbnail()
                # only ever shrinks, so it left them looking tiny inside the
                # bigger chip. Scale up explicitly instead, preserving
                # aspect ratio; NEAREST keeps the pixel-art crisp rather
                # than blurring it (matches style.css's own
                # image-rendering: pixelated for these same sprites).
                scale = min(inner / sprite.width, inner / sprite.height)
                new_w, new_h = max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))
                thumb = sprite.resize((new_w, new_h), Image.NEAREST)
                px = chip_x + (chip_size - thumb.width) // 2
                py = chip_y + (chip_size - thumb.height) // 2
                img.paste(thumb, (px, py), thumb)
            chip_x += slot

    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "PNG")
