"""Review moderation, address book and admin-only access."""

from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.main import app
from app.models import Category, Order, OrderItem, OrderStatus, Product, Review, User, UserRole

client = TestClient(app)


def build() -> None:
    db = SessionLocal()
    category = Category(name="Satovi", slug="satovi")
    db.add(category)
    db.flush()
    product = Product(name="Watch", slug="watch", description="d", price=1000,
                      category_id=category.id, brand="Demo", stock_quantity=5)
    buyer = User(email="buyer@example.com", hashed_password=hash_password("Secret123!"),
                 full_name="Ana Kovac", referral_code="BUYER10")
    admin = User(email="admin@example.com", hashed_password=hash_password("Secret123!"),
                 full_name="Admin", role=UserRole.admin, referral_code="ADMIN10")
    db.add_all([product, buyer, admin])
    db.flush()
    # A delivered order is what makes the purchase reviewable.
    order = Order(user_id=buyer.id, order_number="LC-TEST-1", status=OrderStatus.delivered,
                  subtotal=1000, total=1500, shipping_cost=500,
                  shipping_address={"city": "Beograd"}, payment_method="card")
    db.add(order)
    db.flush()
    db.add(OrderItem(order_id=order.id, product_id=product.id, product_name_snapshot="Watch",
                     quantity=1, unit_price=1000, line_total=1000))
    db.commit()
    db.close()


def headers_for(email: str) -> dict:
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Secret123!"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_review_requires_a_verified_purchase(fresh_db):
    build()
    buyer = headers_for("buyer@example.com")
    eligibility = client.get("/api/v1/products/1/reviews/eligibility", headers=buyer).json()
    assert eligibility["can_review"] is True
    assert eligibility["order_ids"] == [1]

    # An order id the user does not own is refused.
    assert client.post("/api/v1/products/1/reviews", headers=buyer,
                       json={"order_id": 999, "rating": 5}).status_code == 403


def test_review_is_hidden_until_approved_then_updates_the_rating(fresh_db):
    build()
    buyer = headers_for("buyer@example.com")
    created = client.post("/api/v1/products/1/reviews", headers=buyer,
                          json={"order_id": 1, "rating": 4, "comment": "Solidno"})
    assert created.status_code == 201
    assert created.json()["is_approved"] is False
    # Reviewers are shown by first name and last initial, not in full.
    assert created.json()["author"] == "Ana K."

    public = client.get("/api/v1/products/1/reviews").json()
    assert public["total"] == 0
    assert client.get("/api/v1/products/watch").json()["average_rating"] == 0

    admin = headers_for("admin@example.com")
    assert client.get("/api/v1/admin/reviews", headers=admin).json()["pending_count"] == 1
    client.put("/api/v1/admin/reviews/1/approve", headers=admin)

    assert client.get("/api/v1/products/1/reviews").json()["total"] == 1
    product = client.get("/api/v1/products/watch").json()
    assert product["average_rating"] == 4
    assert product["review_count"] == 1

    # Rejecting rolls the cached rating back.
    client.put("/api/v1/admin/reviews/1/reject", headers=admin)
    assert client.get("/api/v1/products/watch").json()["average_rating"] == 0


def test_the_same_order_cannot_be_reviewed_twice(fresh_db):
    build()
    buyer = headers_for("buyer@example.com")
    client.post("/api/v1/products/1/reviews", headers=buyer, json={"order_id": 1, "rating": 5})
    again = client.post("/api/v1/products/1/reviews", headers=buyer, json={"order_id": 1, "rating": 3})
    assert again.status_code == 403
    assert client.get("/api/v1/products/1/reviews/eligibility", headers=buyer).json()["can_review"] is False


def test_review_comments_follow_the_requested_language(fresh_db):
    build()
    db = SessionLocal()
    db.add(
        Review(
            product_id=1,
            user_id=1,
            order_id=1,
            rating=5,
            comment="Besprekorna izrada.",
            comment_en="Flawless craftsmanship.",
            comment_de="Makellose Verarbeitung.",
            is_approved=True,
        )
    )
    db.commit()
    db.close()

    assert client.get("/api/v1/products/1/reviews?lang=sr").json()["items"][0]["comment"] == "Besprekorna izrada."
    assert client.get("/api/v1/products/1/reviews?lang=en").json()["items"][0]["comment"] == "Flawless craftsmanship."
    assert client.get("/api/v1/products/1/reviews?lang=de").json()["items"][0]["comment"] == "Makellose Verarbeitung."


def test_admin_routes_reject_customers(fresh_db):
    build()
    buyer = headers_for("buyer@example.com")
    for path in ("/api/v1/admin/stats", "/api/v1/admin/users", "/api/v1/admin/orders",
                 "/api/v1/admin/promo-codes", "/api/v1/admin/reviews"):
        assert client.get(path, headers=buyer).status_code == 403, path
    assert client.get("/api/v1/admin/stats").status_code == 401


def test_admin_cannot_remove_the_last_admin(fresh_db):
    build()
    admin = headers_for("admin@example.com")
    me = client.get("/api/v1/auth/me", headers=admin).json()
    assert client.put(f"/api/v1/admin/users/{me['id']}/role", headers=admin,
                      json={"role": "customer"}).status_code == 400


def test_admin_status_change_to_cancelled_restocks(fresh_db):
    build()
    admin = headers_for("admin@example.com")
    before = client.get("/api/v1/products/watch").json()["stock_quantity"]
    client.put("/api/v1/admin/orders/1/status", headers=admin, json={"status": "cancelled"})
    assert client.get("/api/v1/products/watch").json()["stock_quantity"] == before + 1


def test_address_book_keeps_one_default(fresh_db):
    build()
    buyer = headers_for("buyer@example.com")
    body = {"full_name": "Ana Kovac", "street": "Ulica 1", "city": "Beograd",
            "postal_code": "11000", "country": "Srbija", "phone": "+381600000"}

    first = client.post("/api/v1/addresses", headers=buyer, json={**body, "label": "Kuća"})
    assert first.json()["is_default"] is True

    second = client.post("/api/v1/addresses", headers=buyer,
                         json={**body, "label": "Posao", "is_default": True})
    listed = client.get("/api/v1/addresses", headers=buyer).json()
    assert sum(item["is_default"] for item in listed) == 1
    assert listed[0]["id"] == second.json()["id"]

    client.delete(f"/api/v1/addresses/{second.json()['id']}", headers=buyer)
    # Deleting the default promotes the remaining address.
    assert client.get("/api/v1/addresses", headers=buyer).json()[0]["is_default"] is True


def test_addresses_are_private_to_their_owner(fresh_db):
    build()
    buyer = headers_for("buyer@example.com")
    created = client.post("/api/v1/addresses", headers=buyer, json={
        "full_name": "Ana", "street": "Ulica 1", "city": "Beograd",
        "postal_code": "11000", "country": "Srbija", "phone": "+381600000"})
    admin = headers_for("admin@example.com")
    assert client.put(f"/api/v1/addresses/{created.json()['id']}", headers=admin, json={
        "full_name": "Hacker", "street": "Ulica X", "city": "Y", "postal_code": "1",
        "country": "RS", "phone": "+381600001"}).status_code == 404
