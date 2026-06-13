from fastapi.testclient import TestClient

from app.db.session import Base, engine
from app.main import app


def test_register_login_and_me():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    client = TestClient(app)
    payload = {"email": "test@example.com", "password": "Secret123!", "full_name": "Test User"}
    registered = client.post("/api/v1/auth/register", json=payload)
    assert registered.status_code == 200
    logged_in = client.post("/api/v1/auth/login", json={"email": payload["email"], "password": payload["password"]})
    assert logged_in.status_code == 200
    token = logged_in.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == payload["email"]
