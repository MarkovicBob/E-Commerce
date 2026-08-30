from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.main import app
from app.models import Category, Product, User


def setup_shop():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    category = Category(name="Satovi", slug="satovi")
    user = User(email="buyer@example.com", hashed_password=hash_password("Secret123!"), full_name="Buyer", referral_code="BUYER10")
    product = Product(name="Demo Watch", slug="demo-watch", description="Demo", price=1000, category=category, brand="Demo", stock_quantity=3)
    db.add_all([category, user, product])
    db.commit()
    db.close()


def test_cart_and_order_flow():
    setup_shop()
    client = TestClient(app)
    login = client.post("/api/v1/auth/login", json={"email": "buyer@example.com", "password": "Secret123!"})
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    add = client.post("/api/v1/cart/items", json={"product_id": 1, "quantity": 1}, headers=headers)
    assert add.status_code == 200
    order = client.post(
        "/api/v1/orders",
        json={"shipping_address": {"full_name": "Buyer", "street": "Main", "city": "Belgrade", "postal_code": "11000", "country": "RS", "phone": "+381600000"}, "shipping_method": "standard", "payment_method": "card"},
        headers=headers,
    )
    assert order.status_code == 201
    assert order.json()["order_number"].startswith("LC-")


def test_referral_endpoint_requires_auth():
    setup_shop()
    client = TestClient(app)
    assert client.get("/api/v1/referrals/me").status_code == 401
