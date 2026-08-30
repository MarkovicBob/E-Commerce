"""Token handling on endpoints that serve guests and signed-in users alike."""

from fastapi.testclient import TestClient

from app.core.security import create_token
from app.main import app

client = TestClient(app)

GUEST = {"X-Session-Id": "token-tests-guest"}


def register(email: str = "tokens@example.com") -> dict:
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Secret123", "full_name": "Token User"},
    ).json()


def test_missing_header_is_treated_as_a_guest(fresh_db):
    # No Authorization at all is the genuine guest case and must keep working.
    assert client.get("/api/v1/cart", headers=GUEST).status_code == 200


def test_expired_access_token_is_rejected_not_downgraded(fresh_db):
    """
    The regression this guards: an expired token used to fall through to the guest
    branch, so a signed-in shopper's items silently landed in an anonymous cart and
    the client never saw the 401 it refreshes on.
    """
    user = register()
    expired = create_token(str(user["user"]["id"]), "access", minutes=-1)
    headers = {"Authorization": f"Bearer {expired}", **GUEST}

    response = client.get("/api/v1/cart", headers=headers)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert "detail" in response.json()


def test_garbage_and_malformed_tokens_are_rejected(fresh_db):
    register()
    for header in ("Bearer nonsense", "Bearer ", "Token abc"):
        response = client.get("/api/v1/cart", headers={"Authorization": header, **GUEST})
        assert response.status_code == 401, header


def test_token_for_a_deleted_account_is_rejected(fresh_db):
    register()
    ghost = create_token("999999", "access", minutes=30)
    assert client.get("/api/v1/cart", headers={"Authorization": f"Bearer {ghost}", **GUEST}).status_code == 401


def test_refresh_token_cannot_be_used_as_an_access_token(fresh_db):
    tokens = register()
    headers = {"Authorization": f"Bearer {tokens['refresh_token']}", **GUEST}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert client.get("/api/v1/cart", headers=headers).status_code == 401


def test_expired_token_does_not_place_a_guest_order(fresh_db):
    """A signed-in shopper whose token lapsed must not be pushed down the guest path."""
    user = register()
    expired = create_token(str(user["user"]["id"]), "access", minutes=-1)
    response = client.post(
        "/api/v1/orders",
        headers={"Authorization": f"Bearer {expired}", **GUEST},
        json={
            "shipping_address": {
                "full_name": "Token User",
                "street": "Ulica 1",
                "city": "Beograd",
                "postal_code": "11000",
                "country": "Srbija",
                "phone": "+381600000",
            }
        },
    )
    # 401 tells the client to refresh; a 400 about a missing guest email would not.
    assert response.status_code == 401


def test_valid_token_still_resolves_the_account(fresh_db):
    tokens = register()
    headers = {"Authorization": f"Bearer {tokens['access_token']}", **GUEST}
    assert client.get("/api/v1/auth/me", headers=headers).json()["email"] == "tokens@example.com"
    # The user's own cart, not the guest one carried in X-Session-Id.
    assert client.get("/api/v1/cart", headers=headers).status_code == 200
