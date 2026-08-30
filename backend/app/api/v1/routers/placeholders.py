"""Locally generated catalogue artwork.

The demo catalogue must remain usable without a third-party image service.  The
seed passed in the URL chooses a deterministic palette, so gallery images still
look distinct while every request is served by this application.
"""

import hashlib
from html import escape

from fastapi import APIRouter, Path
from fastapi.responses import Response

router = APIRouter()

PALETTES = (
    ("#171512", "#332a20", "#c7a86a", "#f3ead9"),
    ("#151a1d", "#24343a", "#83a7a3", "#e9efec"),
    ("#1d1417", "#45232c", "#c58b72", "#f4e7df"),
    ("#151622", "#282b48", "#8f91c5", "#ecebf5"),
    ("#171a16", "#2d3b2d", "#91a77d", "#edf0e7"),
)


@router.get("/{seed}.svg", response_class=Response)
def catalogue_placeholder(
    seed: str = Path(min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_-]+$")
) -> Response:
    """Return fast, cacheable artwork that never depends on an external CDN."""
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    background, surface, accent, light = PALETTES[digest[0] % len(PALETTES)]
    shift = (digest[1] % 91) - 45
    label = escape(seed.replace("-", " ").split()[0][:12].upper())
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200" role="img" aria-label="Luxe catalogue image">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="{surface}"/><stop offset="1" stop-color="{background}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="56%">
      <stop stop-color="{accent}" stop-opacity=".42"/><stop offset="1" stop-color="{accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="object" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="{light}"/><stop offset=".48" stop-color="{accent}"/><stop offset="1" stop-color="{surface}"/>
    </linearGradient>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="28"/>
    </filter>
  </defs>
  <rect width="900" height="1200" fill="url(#bg)"/>
  <rect width="900" height="1200" fill="url(#glow)"/>
  <circle cx="{450 + shift}" cy="365" r="260" fill="none" stroke="{accent}" stroke-opacity=".3" stroke-width="2"/>
  <ellipse cx="450" cy="895" rx="270" ry="64" fill="#000" opacity=".34" filter="url(#shadow)"/>
  <path d="M255 815 L318 385 Q328 320 392 320 H508 Q572 320 582 385 L645 815 Q654 875 594 875 H306 Q246 875 255 815Z" fill="url(#object)"/>
  <path d="M360 348 Q370 222 450 222 Q530 222 540 348" fill="none" stroke="{light}" stroke-opacity=".8" stroke-width="28" stroke-linecap="round"/>
  <rect x="318" y="430" width="264" height="330" rx="132" fill="{background}" opacity=".16"/>
  <circle cx="450" cy="595" r="76" fill="none" stroke="{light}" stroke-opacity=".82" stroke-width="3"/>
  <text x="450" y="613" fill="{light}" font-family="Georgia, serif" font-size="48" text-anchor="middle" letter-spacing="8">L</text>
  <text x="450" y="1040" fill="{light}" fill-opacity=".62" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" letter-spacing="8">{label}</text>
  <text x="450" y="1080" fill="{light}" fill-opacity=".4" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" letter-spacing="6">LUXE COMMERCE</text>
</svg>"""
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        },
    )
