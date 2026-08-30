"""Cart pricing, stock guards, guest merge and the checkout consequences."""

from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.models import Category, Product, ProductTranslation, ProductVariant, PromoCode, User

client = TestClient(app)

ADDRESS = {
    "full_name": "Buyer",
    "street": "Knez Mihailova 1",
    "city": "Beograd",
    "postal_code": "11000",
    "country": "Srbija",
    "phone": "+381600000",
}


def build_shop() -> None:
    db = SessionLocal()
    category = Category(name="Satovi", slug="satovi")
    db.add(category)
    db.flush()

    plain = Product(
        name="Plain",
        slug="plain",
        description="No variants",
        price=1000,
        category_id=category.id,
        brand="Demo",
        stock_quantity=10,
    )
    plain.translations = [
        ProductTranslation(language_code="en", name="Plain product", description="No variants")
    ]
    varied = Product(
        name="Varied",
        slug="varied",
        description="Has variants",
        price=2000,
        discount_price=1600,
        category_id=category.id,
        brand="Demo",
        stock_quantity=6,
    )
    varied.variants = [
        ProductVariant(size="M", color="Gold", sku="V-M", stock_quantity=4, extra_price=500),
        ProductVariant(size="L", color="Black", sku="V-L", stock_quantity=1, extra_price=0),
    ]
    db.add_all([plain, varied])
    db.add(User(email="buyer@example.com", hashed_password=hash_password("Secret123!"),
                full_name="Buyer", referral_code="BUYER10"))
    db.add(PromoCode(code="TEN", discount_percent=10, is_active=True))
    db.commit()
    db.close()


def auth_headers() -> dict:
    login = client.post("/api/v1/auth/login", json={"email": "buyer@example.com", "password": "Secret123!"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def ids(slug: str) -> dict:
    return client.get(f"/api/v1/products/{slug}").json()


def test_variant_extra_price_is_charged(fresh_db):
    build_shop()
    headers = auth_headers()
    product = ids("varied")
    gold = next(v for v in product["variants"] if v["sku"] == "V-M")

    cart = client.post("/api/v1/cart/items", headers=headers,
                       json={"product_id": product["id"], "variant_id": gold["id"], "quantity": 2}).json()
    # 1600 discounted base + 500 for the variant.
    assert cart["items"][0]["unit_price"] == 2100
    assert cart["items"][0]["line_total"] == 4200


def test_cart_and_order_product_names_follow_the_requested_language(fresh_db):
    build_shop()
    headers = auth_headers()
    product = ids("plain")
    cart = client.post(
        "/api/v1/cart/items?lang=en",
        headers=headers,
        json={"product_id": product["id"], "quantity": 1},
    ).json()
    assert cart["items"][0]["name"] == "Plain product"

    order = client.post(
        "/api/v1/orders?lang=en",
        headers=headers,
        json={"shipping_address": ADDRESS, "payment_method": "card"},
    ).json()
    assert order["items"][0]["name"] == "Plain product"
    assert client.get("/api/v1/orders?lang=en", headers=headers).json()["items"][0]["items"][0]["name"] == "Plain product"


def test_product_with_variants_requires_one(fresh_db):
    build_shop()
    headers = auth_headers()
    product = ids("varied")
    response = client.post("/api/v1/cart/items", headers=headers,
                           json={"product_id": product["id"], "quantity": 1})
    assert response.status_code == 400


def test_variant_from_another_product_is_rejected(fresh_db):
    build_shop()
    headers = auth_headers()
    foreign = ids("varied")["variants"][0]["id"]
    response = client.post("/api/v1/cart/items", headers=headers,
                           json={"product_id": ids("plain")["id"], "variant_id": foreign, "quantity": 1})
    assert response.status_code == 400


def test_stock_limit_uses_the_variant(fresh_db):
    build_shop()
    headers = auth_headers()
    product = ids("varied")
    scarce = next(v for v in product["variants"] if v["sku"] == "V-L")
    # The product has 6 in stock but this variant only 1.
    over = client.post("/api/v1/cart/items", headers=headers,
                       json={"product_id": product["id"], "variant_id": scarce["id"], "quantity": 2})
    assert over.status_code == 400
    ok = client.post("/api/v1/cart/items", headers=headers,
                     json={"product_id": product["id"], "variant_id": scarce["id"], "quantity": 1})
    assert ok.status_code == 200


def test_guest_cart_merges_into_the_user_cart(fresh_db):
    build_shop()
    guest = {"X-Session-Id": "guest-abc"}
    plain = ids("plain")
    client.post("/api/v1/cart/items", headers=guest, json={"product_id": plain["id"], "quantity": 3})

    headers = auth_headers()
    merged = client.post("/api/v1/cart/merge", headers={**headers, **guest})
    assert merged.status_code == 200
    # The item survives the merge instead of being cascaded away with the guest cart.
    assert [item["quantity"] for item in merged.json()["items"]] == [3]


def test_guest_cart_needs_a_session_id(fresh_db):
    build_shop()
    assert client.get("/api/v1/cart").status_code == 400


def test_promo_applies_and_can_be_removed(fresh_db):
    build_shop()
    headers = auth_headers()
    client.post("/api/v1/cart/items", headers=headers, json={"product_id": ids("plain")["id"], "quantity": 2})

    applied = client.post("/api/v1/cart/apply-promo", headers=headers, json={"code": "TEN"}).json()
    assert applied["discount_total"] == 200
    assert applied["total"] == applied["subtotal"] - 200 + applied["shipping_cost"]

    cleared = client.delete("/api/v1/cart/promo", headers=headers).json()
    assert cleared["discount_total"] == 0
    assert client.post("/api/v1/cart/apply-promo", headers=headers, json={"code": "NOPE"}).status_code == 400


def test_checkout_decrements_stock_and_clears_the_cart(fresh_db):
    build_shop()
    headers = auth_headers()
    product = ids("varied")
    gold = next(v for v in product["variants"] if v["sku"] == "V-M")
    client.post("/api/v1/cart/items", headers=headers,
                json={"product_id": product["id"], "variant_id": gold["id"], "quantity": 2})

    order = client.post("/api/v1/orders", headers=headers, json={
        "shipping_address": ADDRESS, "shipping_method": "express", "payment_method": "card"})
    assert order.status_code == 201
    body = order.json()
    assert body["status"] == "processing"
    assert body["shipping_cost"] == 1200
    assert body["items"][0]["size"] == "M"

    after = ids("varied")
    assert after["stock_quantity"] == 4
    assert next(v for v in after["variants"] if v["sku"] == "V-M")["stock_quantity"] == 2
    assert client.get("/api/v1/cart", headers=headers).json()["items"] == []


def test_cash_on_delivery_stays_pending(fresh_db):
    build_shop()
    headers = auth_headers()
    client.post("/api/v1/cart/items", headers=headers, json={"product_id": ids("plain")["id"], "quantity": 1})
    order = client.post("/api/v1/orders", headers=headers, json={
        "shipping_address": ADDRESS, "shipping_method": "standard", "payment_method": "cash_on_delivery"})
    assert order.json()["status"] == "pending"


def test_unknown_methods_are_rejected(fresh_db):
    build_shop()
    headers = auth_headers()
    client.post("/api/v1/cart/items", headers=headers, json={"product_id": ids("plain")["id"], "quantity": 1})
    assert client.post("/api/v1/orders", headers=headers, json={
        "shipping_address": ADDRESS, "payment_method": "bitcoin"}).status_code == 400
    assert client.post("/api/v1/orders", headers=headers, json={
        "shipping_address": ADDRESS, "shipping_method": "teleport"}).status_code == 400


def test_empty_cart_cannot_be_ordered(fresh_db):
    build_shop()
    assert client.post("/api/v1/orders", headers=auth_headers(), json={
        "shipping_address": ADDRESS}).status_code == 400


def test_cancelling_an_order_restores_stock(fresh_db):
    build_shop()
    headers = auth_headers()
    client.post("/api/v1/cart/items", headers=headers, json={"product_id": ids("plain")["id"], "quantity": 3})
    order = client.post("/api/v1/orders", headers=headers, json={
        "shipping_address": ADDRESS, "payment_method": "card"}).json()
    assert ids("plain")["stock_quantity"] == 7

    cancelled = client.post(f"/api/v1/orders/{order['order_number']}/cancel", headers=headers)
    assert cancelled.json()["status"] == "cancelled"
    assert ids("plain")["stock_quantity"] == 10
    # A cancelled order cannot be cancelled twice.
    assert client.post(f"/api/v1/orders/{order['order_number']}/cancel", headers=headers).status_code == 400


def test_guest_order_needs_an_email_and_guards_the_receipt(fresh_db):
    build_shop()
    guest = {"X-Session-Id": "guest-order"}
    client.post("/api/v1/cart/items", headers=guest, json={"product_id": ids("plain")["id"], "quantity": 1})

    missing = client.post("/api/v1/orders", headers=guest, json={"shipping_address": ADDRESS})
    assert missing.status_code == 400

    client.post("/api/v1/cart/items", headers=guest, json={"product_id": ids("plain")["id"], "quantity": 1})
    order = client.post("/api/v1/orders", headers=guest, json={
        "shipping_address": ADDRESS, "contact_email": "guest@example.com"}).json()

    number = order["order_number"]
    assert client.get(f"/api/v1/orders/{number}").status_code == 403
    assert client.get(f"/api/v1/orders/{number}?email=guest@example.com").status_code == 200
