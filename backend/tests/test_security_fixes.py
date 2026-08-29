from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import PromoCode, PromoType
from tests.test_cart_orders_referral import setup_shop

ADDRESS = {"full_name": "Buyer", "street": "Main", "city": "Belgrade", "postal_code": "11000", "country": "RS", "phone": "1"}


def login(client, email="buyer@example.com", password="Secret123!"):
    return {"Authorization": f"Bearer {client.post('/api/v1/auth/login', json={'email': email, 'password': password}).json()['access_token']}"}


def test_reset_password_requires_valid_token():
    setup_shop()
    client = TestClient(app)
    # Knowing the email alone must not be enough to take over an account.
    assert client.post("/api/v1/auth/reset-password", json={"token": "not-a-token", "new_password": "Hacked123!"}).status_code == 400
    assert client.post("/api/v1/auth/login", json={"email": "buyer@example.com", "password": "Secret123!"}).status_code == 200


def test_guest_carts_are_not_shared():
    setup_shop()
    client = TestClient(app)
    client.post("/api/v1/cart/items", json={"product_id": 1, "quantity": 1}, headers={"X-Session-Id": "guest-a"})
    other = client.get("/api/v1/cart", headers={"X-Session-Id": "guest-b"})
    assert other.json()["items"] == []
    # A guest with no session id at all is rejected rather than sharing one global cart.
    assert client.get("/api/v1/cart").status_code == 400


def test_cannot_touch_another_users_cart_item():
    setup_shop()
    client = TestClient(app)
    mine = client.post("/api/v1/cart/items", json={"product_id": 1, "quantity": 1}, headers=login(client))
    item_id = mine.json()["items"][0]["id"]
    attacker = {"X-Session-Id": "attacker"}
    assert client.put(f"/api/v1/cart/items/{item_id}", json={"quantity": 5}, headers=attacker).status_code == 404
    assert client.delete(f"/api/v1/cart/items/{item_id}", headers=attacker).status_code == 404


def test_cart_quantity_must_be_positive():
    setup_shop()
    client = TestClient(app)
    headers = login(client)
    item_id = client.post("/api/v1/cart/items", json={"product_id": 1, "quantity": 1}, headers=headers).json()["items"][0]["id"]
    assert client.put(f"/api/v1/cart/items/{item_id}", json={"quantity": -3}, headers=headers).status_code == 422


def test_promo_discount_matches_between_cart_and_order():
    setup_shop()
    db = SessionLocal()
    db.add(PromoCode(code="SAVE25", discount_percent=25, type=PromoType.general, is_active=True))
    db.commit()
    db.close()

    client = TestClient(app)
    headers = login(client)
    client.post("/api/v1/cart/items", json={"product_id": 1, "quantity": 2}, headers=headers)
    cart = client.post("/api/v1/cart/apply-promo", json={"code": "SAVE25"}, headers=headers).json()
    # The cart used to always report a 0 discount while the order silently applied 10%.
    assert cart["subtotal"] == 2000
    assert cart["discount_total"] == 500
    assert cart["total"] == 1500

    order = client.post("/api/v1/orders", json={"shipping_address": ADDRESS, "shipping_method": "standard", "payment_method": "card"}, headers=headers).json()
    assert order["discount_total"] == cart["discount_total"]
    assert order["total"] == cart["total"] + order["shipping_cost"]


def test_exhausted_promo_is_rejected():
    setup_shop()
    db = SessionLocal()
    db.add(PromoCode(code="ONCE", discount_percent=50, type=PromoType.general, is_active=True, usage_limit=1, times_used=1))
    db.commit()
    db.close()
    client = TestClient(app)
    assert client.post("/api/v1/cart/apply-promo", json={"code": "ONCE"}, headers=login(client)).status_code == 400


def test_referral_coupons_are_scoped_to_the_user():
    setup_shop()
    db = SessionLocal()
    db.add(PromoCode(code="SOMEONE-ELSES", discount_percent=90, type=PromoType.referral_referrer))
    db.commit()
    db.close()
    client = TestClient(app)
    codes = [c["code"] for c in client.get("/api/v1/referrals/me", headers=login(client)).json()["coupons"]]
    assert "SOMEONE-ELSES" not in codes


def test_malformed_token_is_unauthorized_not_a_crash():
    setup_shop()
    client = TestClient(app)
    assert client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_page_size_is_bounded():
    setup_shop()
    client = TestClient(app)
    assert client.get("/api/v1/products", params={"page_size": 100000}).status_code == 422
    assert client.get("/api/v1/products", params={"page": 0}).status_code == 422
