"""Upload validation, config safety checks and the JSON error contract."""

import io

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.models import Category, Product, User, UserRole
from app.services.storage import MAX_IMAGE_BYTES, MEDIA_ROOT, LocalStorage, media_url

client = TestClient(app)

PNG_HEADER = b"\x89PNG\r\n\x1a\n"
JPEG_HEADER = b"\xff\xd8\xff"


def build_admin() -> dict:
    db = SessionLocal()
    category = Category(name="Satovi", slug="satovi")
    db.add(category)
    db.flush()
    db.add(Product(name="Watch", slug="watch", description="d", price=1000,
                   category_id=category.id, brand="Demo", stock_quantity=5))
    db.add(User(email="admin@example.com", hashed_password=hash_password("Secret123!"),
                full_name="Admin", role=UserRole.admin, referral_code="ADMIN10"))
    db.commit()
    db.close()
    login = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "Secret123!"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def upload(headers: dict, content: bytes, content_type: str, filename: str = "photo.png"):
    return client.post(
        "/api/v1/products/1/images",
        headers=headers,
        files={"file": (filename, io.BytesIO(content), content_type)},
    )


def test_media_urls_are_absolute_so_the_spa_can_load_them():
    """
    The SPA runs on a different origin than the API. A bare "/media/..." would
    resolve against the front end and 404, so stored paths are served absolute.
    """
    assert media_url("/media/abc.png").startswith("http")
    assert media_url("/media/abc.png").endswith("/media/abc.png")
    # Legacy Picsum seed data is translated to our reliable local artwork.
    legacy = media_url("https://picsum.photos/seed/x/900/1200")
    assert legacy.startswith("http")
    assert legacy.endswith("/api/v1/placeholders/x.svg")
    assert "picsum.photos" not in legacy
    old_unsplash = media_url("https://images.unsplash.com/900x1200/?luxury,product,watches,8")
    assert old_unsplash.endswith("/api/v1/placeholders/luxury-product-watches-8.svg")
    assert "images.unsplash.com" not in old_unsplash
    # Other intentionally external images are still allowed.
    assert media_url("https://images.example.com/x.jpg") == "https://images.example.com/x.jpg"
    real_unsplash = "https://images.unsplash.com/photo-1234567890-abcd?w=900"
    assert media_url(real_unsplash) == real_unsplash
    assert media_url(None) is None


def test_local_catalogue_placeholder_is_an_image_and_can_be_cached():
    response = client.get("/api/v1/placeholders/test-product-0.svg")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/svg+xml")
    assert "immutable" in response.headers["cache-control"]
    assert response.content.startswith(b"<svg")


def test_uploaded_image_is_returned_as_an_absolute_url(fresh_db):
    headers = build_admin()
    url = upload(headers, PNG_HEADER + b"0" * 64, "image/png").json()["image_url"]
    assert url.startswith("http://") and "/media/" in url

    # And the same absolute form comes back when the product is read.
    gallery = client.get("/api/v1/products/watch").json()["images"]
    assert all(image["image_url"].startswith("http") for image in gallery)


def test_valid_image_is_stored_with_a_generated_name(fresh_db):
    headers = build_admin()
    response = upload(headers, PNG_HEADER + b"0" * 512, "image/png")
    assert response.status_code == 201

    url = response.json()["image_url"]
    # The served name comes from the content type, never from the uploaded filename.
    assert "/media/" in url and url.endswith(".png")
    stored = MEDIA_ROOT / url.rsplit("/media/", 1)[1]
    assert stored.exists()

    # Deleting the record removes the file rather than orphaning it on disk.
    assert client.delete(f"/api/v1/products/1/images/{response.json()['id']}", headers=headers).status_code == 200
    assert not stored.exists()


def test_a_disguised_filename_cannot_choose_the_extension(fresh_db):
    headers = build_admin()
    response = upload(headers, PNG_HEADER + b"0" * 32, "image/png", filename="../../evil.php")
    assert response.status_code == 201
    url = response.json()["image_url"]
    assert url.endswith(".png")
    assert ".." not in url


def test_content_that_lies_about_its_type_is_rejected(fresh_db):
    headers = build_admin()
    response = upload(headers, b"<?php echo 1; ?>", "image/png")
    assert response.status_code == 400
    assert "detail" in response.json()


def test_unsupported_type_and_empty_file_are_rejected(fresh_db):
    headers = build_admin()
    assert upload(headers, b"whatever", "application/pdf").status_code == 400
    assert upload(headers, b"", "image/png").status_code == 400


def test_oversized_upload_is_refused_and_leaves_nothing_behind(fresh_db):
    headers = build_admin()
    before = set(MEDIA_ROOT.iterdir()) if MEDIA_ROOT.exists() else set()

    oversized = JPEG_HEADER + b"0" * (MAX_IMAGE_BYTES + 1024)
    assert upload(headers, oversized, "image/jpeg", filename="big.jpg").status_code == 400

    after = set(MEDIA_ROOT.iterdir()) if MEDIA_ROOT.exists() else set()
    # The partial write is cleaned up rather than left as a stray file.
    assert after == before


def test_upload_requires_an_admin(fresh_db):
    build_admin()
    assert upload({}, PNG_HEADER + b"0" * 32, "image/png").status_code == 401


def test_delete_image_ignores_urls_it_does_not_own():
    # External and unknown URLs must be no-ops, not path traversal.
    storage = LocalStorage()
    storage.delete_image("https://picsum.photos/seed/x/900/1200")
    storage.delete_image("/media/../../../etc/passwd")
    storage.delete_image("")


def test_unhandled_errors_keep_the_json_error_shape(fresh_db):
    """Starlette's default 500 is plain text; the spec promises {"detail": ...}."""

    @app.get("/api/v1/_boom")
    def boom():
        raise RuntimeError("kaboom")

    with TestClient(app, raise_server_exceptions=False) as raw:
        response = raw.get("/api/v1/_boom")
    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    # The cause must not leak to the caller.
    assert "kaboom" not in response.text


def test_placeholder_secret_is_allowed_locally_but_refused_behind_https():
    # A local demo may keep the example key; it only warns.
    Settings(secret_key="dev-secret", cookie_secure=False).verify()

    # cookie_secure marks a real HTTPS deployment, where the shipped key must be gone.
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        Settings(secret_key="change-me-in-production", cookie_secure=True).verify()

    with pytest.raises(RuntimeError, match="EXPOSE_RESET_TOKEN"):
        Settings(secret_key="a-real-random-secret", cookie_secure=True, expose_reset_token=True).verify()

    # A properly configured production setup starts cleanly.
    Settings(secret_key="a-real-random-secret", cookie_secure=True).verify()
