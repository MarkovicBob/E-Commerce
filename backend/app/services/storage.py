from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

MEDIA_ROOT = Path("app/media")
MAX_IMAGE_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


class LocalStorage:
    async def save_image(self, upload: UploadFile) -> str:
        if upload.content_type not in ALLOWED_IMAGE_TYPES:
            raise ValueError("Unsupported image type")
        content = await upload.read()
        if len(content) > MAX_IMAGE_BYTES:
            raise ValueError("Image is too large")
        suffix = Path(upload.filename or "image").suffix or ".jpg"
        MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
        name = f"{uuid4().hex}{suffix}"
        (MEDIA_ROOT / name).write_bytes(content)
        return f"/media/{name}"


storage = LocalStorage()
