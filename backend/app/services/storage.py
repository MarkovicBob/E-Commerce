"""Image storage.

Deliberately a tiny interface (`save_image` / `delete_image`) so a real object
store can replace `LocalStorage` without touching any caller.
"""

from pathlib import Path
import re
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import settings

MEDIA_ROOT = Path("app/media")
MAX_IMAGE_BYTES = 5 * 1024 * 1024
CHUNK_BYTES = 64 * 1024

# The extension comes from the validated content type, never from the uploaded
# filename, so a caller cannot choose what the served file is called.
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

# Enough of each format's magic number to catch a file that lies about its type.
MAGIC_PREFIXES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],
}


class LocalStorage:
    async def save_image(self, upload: UploadFile) -> str:
        suffix = ALLOWED_IMAGE_TYPES.get((upload.content_type or "").lower())
        if not suffix:
            raise ValueError("Unsupported image type")

        MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
        name = f"{uuid4().hex}{suffix}"
        target = MEDIA_ROOT / name

        written = 0
        first_chunk = True
        try:
            with target.open("wb") as handle:
                # Stream in chunks and stop at the limit, rather than pulling a
                # file of any size into memory before deciding to reject it.
                while chunk := await upload.read(CHUNK_BYTES):
                    if first_chunk:
                        self._verify_magic(chunk, upload.content_type or "")
                        first_chunk = False
                    written += len(chunk)
                    if written > MAX_IMAGE_BYTES:
                        raise ValueError("Image is too large")
                    handle.write(chunk)
            if not written:
                raise ValueError("Image is empty")
        except Exception:
            target.unlink(missing_ok=True)
            raise

        return f"/media/{name}"

    @staticmethod
    def _verify_magic(head: bytes, content_type: str) -> None:
        prefixes = MAGIC_PREFIXES.get(content_type.lower(), [])
        if prefixes and not any(head.startswith(prefix) for prefix in prefixes):
            raise ValueError("File content does not match its declared image type")

    def delete_image(self, image_url: str) -> None:
        """Remove a previously stored file; unknown or external URLs are ignored."""
        prefix = "/media/"
        if not image_url.startswith(prefix):
            return
        name = Path(image_url[len(prefix) :]).name
        (MEDIA_ROOT / name).unlink(missing_ok=True)


storage = LocalStorage()

PICSUM_SEED = re.compile(r"^https?://(?:www\.)?picsum\.photos/seed/([^/?#]+)", re.IGNORECASE)
LEGACY_UNSPLASH_PLACEHOLDER = re.compile(
    r"^https?://images\.unsplash\.com/\d+x\d+/?\?([^#]+)$", re.IGNORECASE
)


def placeholder_url(seed: str) -> str:
    """Absolute URL for deterministic artwork served by this API."""
    safe_seed = re.sub(r"[^a-zA-Z0-9_-]+", "-", seed).strip("-")[:100] or "luxe"
    return f"{settings.api_public_url.rstrip('/')}/api/v1/placeholders/{safe_seed}.svg"


def media_url(url: str | None) -> str | None:
    """Absolute URL for a stored image.

    Paths are kept relative in the database so the data stays portable, but the
    SPA is served from another origin, where a bare "/media/..." would resolve
    against the front end and 404. External URLs (the seed uses those) pass through.
    """
    if not url:
        return url
    # Older databases contain two generations of third-party placeholder URLs.
    # Translate both at response time, so a running installation is fixed
    # without destructive reseeding. Real Unsplash photo URLs (/photo-...) pass
    # through below because they are intentionally hosted images.
    picsum = PICSUM_SEED.match(url)
    if picsum:
        return placeholder_url(picsum.group(1))
    unsplash = LEGACY_UNSPLASH_PLACEHOLDER.match(url)
    if unsplash:
        return placeholder_url(unsplash.group(1))
    if url.startswith(("http://", "https://", "//", "data:")):
        return url
    return f"{settings.api_public_url.rstrip('/')}/{url.lstrip('/')}"
