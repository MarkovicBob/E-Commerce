# Luxe Commerce

Full-stack premium e-commerce monorepo built from `SPEC.md`: Angular 18 standalone frontend, FastAPI backend, PostgreSQL, Alembic, seed data, Docker and tests.

## Decisions

- Shipping methods are configured in `backend/app/core/config.py` through `STANDARD_SHIPPING_COST` and `EXPRESS_SHIPPING_COST`, not as a separate table. Section 10 allowed either approach, and config keeps the first implementation simpler.
- Payment uses `MockPaymentProvider` behind a `PaymentProvider` protocol in `backend/app/services/payment.py`, so Stripe or another provider can replace it later.
- Product images use local `/media` storage through `LocalStorage` in `backend/app/services/storage.py`; the storage interface is intentionally small so S3/Cloudinary can be added later.

## Run With Docker

```bash
docker-compose up --build
```

API: `http://localhost:8000`
Frontend: `http://localhost:4200`

The backend container runs Alembic migrations automatically on startup. Seed demo data after containers start:

```bash
docker-compose exec backend python -m app.seed.seed
```

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed.seed
uvicorn app.main:app --reload
pytest
```

Environment variables are documented in `backend/.env.example`.

## Frontend

```bash
cd frontend
npm install
npm start
npm test
```

Environment variables are documented in `frontend/.env.example`; Angular uses `src/environments/environment.ts` for the API base URL.

## Coverage Map

- Auth: register, login, refresh, Google placeholder, forgot/reset, `/auth/me`, JWT role dependencies.
- Catalog: categories, products, filters, sorting, search suggestions, brands, related products, image upload and variants.
- Cart/checkout: guest session support, merge, promo apply/remove, shipping, mock payment, stock decrement and cart clear.
- Account: orders, wishlist, referral display and copy action.
- Reviews: verified purchase check, average rating recalculation and admin moderation.
- Referral: automatic codes on registration and reward coupon on first completed order.
- Blog/newsletter: localized blog pages and newsletter subscription.
- Admin: stats, users, orders, reviews, blog and promo code endpoints, plus guarded frontend dashboard.
- i18n/design: SR/EN/DE static translations, `lang` query propagation and luxury Tailwind theme.
