# Luxe Commerce

Full-stack premium e-commerce monorepo built from `SPEC.md`: Angular 18 standalone frontend,
FastAPI backend, PostgreSQL, Alembic, seed data, Docker and tests.

## Screenshots

<a href="https://portfoliobob.netlify.app/projects/luxe/demo.mp4"><img src="https://portfoliobob.netlify.app/projects/luxe/poster.webp" alt="Demo video" width="100%"></a>

<sub>▶ Click the image to watch the demo video · more on <a href="https://portfoliobob.netlify.app/#projects">portfoliobob.netlify.app</a></sub>

<table>
<tr><td width="50%"><img src="https://portfoliobob.netlify.app/projects/luxe/1.webp" alt="Screenshot 1" width="100%"></td><td width="50%"><img src="https://portfoliobob.netlify.app/projects/luxe/2.webp" alt="Screenshot 2" width="100%"></td></tr>
<tr><td width="50%"><img src="https://portfoliobob.netlify.app/projects/luxe/3.webp" alt="Screenshot 3" width="100%"></td><td width="50%"><img src="https://portfoliobob.netlify.app/projects/luxe/4.webp" alt="Screenshot 4" width="100%"></td></tr>
<tr><td width="50%"><img src="https://portfoliobob.netlify.app/projects/luxe/5.webp" alt="Screenshot 5" width="100%"></td><td width="50%"><img src="https://portfoliobob.netlify.app/projects/luxe/6.webp" alt="Screenshot 6" width="100%"></td></tr>
<tr><td width="50%"><img src="https://portfoliobob.netlify.app/projects/luxe/7.webp" alt="Screenshot 7" width="100%"></td><td width="50%"><img src="https://portfoliobob.netlify.app/projects/luxe/8.webp" alt="Screenshot 8" width="100%"></td></tr>
</table>

## Run with Docker

```bash
docker-compose up --build
```

- API: `http://localhost:8000` (OpenAPI docs at `/docs`)
- Frontend: `http://localhost:4200`

The backend container runs Alembic migrations **and the seed script** on startup, so the shop is
populated the first time you bring the stack up. The seed is idempotent — it detects an
already-populated database and leaves it alone, so restarts never duplicate data.

To rebuild the catalogue from scratch:

```bash
docker-compose exec backend python -m app.seed.seed --reset
```

### Demo accounts

| Role     | Email                     | Password       |
| -------- | ------------------------- | -------------- |
| Admin    | `admin@luxecommerce.com`  | `Admin123!`    |
| Customer | `ana.kovac@example.com`   | `Customer123!` |

Nine more demo customers exist as `ime.prezime@example.com` with the same customer password.

### Demo promo codes

`LUXE10` (10%), `DOBRODOSLI15` (15%), `SEZONA20` (20%), `POKLON3000` (3000 RSD off),
and `ISTEKAO` — deliberately expired, so the rejection path is easy to demonstrate.

## Seed data

`backend/app/seed/seed.py` builds the demo shop from `backend/app/seed/catalog_data.py`:

- **12 top-level categories, 61 categories in total**, nested up to three levels deep
  (`Odeća → Muška odeća → Odela`), each with SR/EN/DE translations.
- **253 products** across 47 leaf categories — watches, jewelry, bags, clothing, footwear,
  fragrances, eyewear, home, beauty, tech, writing instruments and travel — each with three
  images, a spec sheet, translations in all three languages, and a sale price on roughly a third.
- **2505 product variants** (size × colour), with their own stock and price surcharges.
- 1 admin, 10 customers with addresses, 24 orders across every status, 13 reviews
  (some pending, for the moderation queue), 6 blog posts in three languages, 7 promo codes
  and newsletter subscribers.

Product imagery is generated deterministically by the local API as lightweight SVG artwork, so
the catalogue remains populated without shipping binary assets or depending on a third-party
image service. Existing databases that still contain old Picsum or dynamic Unsplash placeholder
URLs are translated to the local endpoint automatically when products are returned.

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows; use source .venv/bin/activate elsewhere
pip install -r requirements.txt
alembic upgrade head
python -m app.seed.seed          # add --reset to rebuild
uvicorn app.main:app --reload
pytest
```

Environment variables are documented in `backend/.env.example`. Tests always run against a
throwaway `test.db` regardless of `DATABASE_URL`.

## Frontend

```bash
cd frontend
npm install
npm start        # http://localhost:4200
npm test
npm run lint
```

`src/environments/environment.ts` holds the API base URL for development and
`environment.prod.ts` the production one.

## Decisions

- **Shipping methods** live in `backend/app/core/config.py` (`STANDARD_SHIPPING_COST`,
  `EXPRESS_SHIPPING_COST`) rather than in a table. Section 10 of the spec allowed either;
  config keeps two fixed options simpler. The cart quotes the same cost the order then charges,
  so the summary never disagrees with the invoice.
- **Payments** go through the `PaymentProvider` protocol in `backend/app/services/payment.py`.
  `MockPaymentProvider` raises `PaymentError` on refusal; swapping in Stripe means writing one
  class and rebinding `payment_provider`.
- **Product images** are stored locally through `LocalStorage` in `backend/app/services/storage.py`;
  the interface is deliberately tiny so S3/Cloudinary can replace it.
- **Deleting a product** deactivates it instead of removing the row, because order history holds
  foreign keys to it. Categories refuse deletion while they still hold products or subcategories.
- **Category filtering is subtree-wide**: `/products?category=odeca` returns everything nested
  below `odeca` at any depth, which is what a shopper expects from a top-level department.
- **Guest orders** require a contact email and the receipt is only readable with that email;
  account orders are readable by their owner (and by an admin).
- **Localisation of dynamic content** is refetched, not re-rendered: switching language in the
  header re-requests categories, products, reviews, carts, wishlists, orders and posts with the
  new `lang`, because the translated copy lives server-side. Display currency follows the selected
  language: RSD for Serbian, USD for English and EUR for German; checkout accounting stays in RSD.
- **A present-but-unusable token is a 401, not a guest.** A missing `Authorization` header means a
  guest; an expired or tampered one is rejected. Otherwise a signed-in shopper whose 30-minute
  token lapsed would silently be served an anonymous cart, and the client would never receive the
  401 it refreshes on.
- **Partial updates keep what they do not send.** `translations` is `None` by default on product,
  category and blog updates, so editing a name from the admin form cannot wipe the EN/DE rows.
  Send `[]` to clear them deliberately.
- **Uploaded images are stored as relative paths but served absolute**, prefixed with
  `API_PUBLIC_URL`. The SPA runs on another origin, where a bare `/media/...` would resolve
  against the front end and 404.
- **Checkout takes row locks** on the products, variants and promo code it is about to decrement,
  so two simultaneous orders cannot oversell the last unit or overspend a limited coupon. This is
  a no-op on SQLite, which serialises writers anyway.

## Coverage map

- **Auth**: register (with referral code), login, refresh, Google placeholder, forgot/reset
  password, `/auth/me`, profile update, password change, logout, JWT role dependencies.
- **Catalog**: nested category tree with rolled-up counts and breadcrumbs, products with
  subtree filtering, price/brand/size/colour/rating/stock/sale filters, six sort orders,
  translation-aware search, autocomplete suggestions, facets endpoint, related products,
  image upload and variant CRUD.
- **Cart/checkout**: guest session carts, merge on login, promo apply/remove, variant surcharges,
  stock guards, shipping quote, mock payment, stock decrement, cart clearing, order cancellation
  with restock.
- **Account**: orders with cancellation, profile, address book with a single enforced default,
  wishlist, referral code/link/coupons.
- **Reviews**: verified-purchase check with an eligibility endpoint, rating breakdown, cached
  average and count, admin approve/reject/delete.
- **Referral**: automatic codes at registration, referee welcome coupon, referrer reward on the
  first completed order.
- **Blog/newsletter**: localized posts with category filter and related posts, newsletter signup.
- **Admin**: dashboard statistics with a revenue series, plus CRUD for products, categories,
  orders, users, reviews, blog and promo codes. The product form also manages the gallery
  (upload and delete) and the size/colour variants with their own stock and surcharge.
- **i18n/design**: complete SR/EN/DE dictionaries, `lang` propagated through every localized
  call with SR fallback, language switcher in the header, luxury Tailwind theme.

## Tests

```bash
cd backend  && pytest                                   # 62 tests
cd frontend && npm test                                 # 28 tests
cd frontend && npm run lint
```

Backend coverage spans the category tree and localisation fallback, catalogue filters and
sorting, variant pricing and stock limits, guest-cart merging, checkout and restocking,
review moderation, the address book, admin authorisation (including the guard that stops the
last admin demoting themselves), token handling on the endpoints that serve guests and
signed-in users alike, upload validation, and the configuration safety checks.

Frontend coverage spans the cart and auth stores, the price pipe, the session id (including
origins where `crypto.randomUUID` is unavailable), and the interceptor's refresh-and-replay
behaviour on 401.

## Security notes

- `SECRET_KEY` in `backend/.env.example` is a placeholder that ships in the repository. The API
  logs a warning while it is in use and **refuses to start** once `COOKIE_SECURE=true`, which is
  the marker that the deployment is behind HTTPS. Generate a real one with
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- `EXPOSE_RESET_TOKEN` returns password-reset tokens in API responses so the flow is usable
  without a mailer. It is refused in the same production configuration.
- Image uploads are admin-only, streamed with a 5 MB cap, checked against the file's magic
  number, and stored under a generated name whose extension comes from the validated content
  type — never from the uploaded filename.
