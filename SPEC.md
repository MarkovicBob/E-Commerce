# Codex prompt — Luksuzna multi-kategorijska e-commerce platforma (Angular + FastAPI)

> Ovo je kompletna i finalna tehnička specifikacija namenjena Codex-u (ili sličnom coding agentu).
>
> **Pravila rada:**
>
> 1. Pre nego što napišeš bilo koji kod, izloži plan implementacije po fazama (sekcija 12). Ako neka stavka iz ove specifikacije (sekcije 1-11) nije pokrivena nijednom fazom, dodaj je u plan pre nego što počneš.
> 2. Radi fazu po fazu. Nakon svake faze ukratko sumiraj šta je urađeno i koje stavke specifikacije pokriva, pa nastavi na sledeću.
> 3. Na samom kraju, prođi kroz Finalnu kontrolnu listu (sekcija 13) stavku po stavku i potvrdi da je svaka implementirana. Ako nešto nedostaje, implementiraj ga prije nego što proglasiš zadatak završenim.
> 4. Ako nešto u specifikaciji nije jasno ili je dvosmisleno, donesi razumnu odluku, primeni je konzistentno kroz ceo projekat i napiši napomenu u README-u zašto.

---

## 0. Cilj projekta

Full-stack e-commerce platforma za premium/luksuzni online shop sa više kategorija proizvoda. Frontend: Angular + TypeScript. Backend: Python + FastAPI. Baza: PostgreSQL. Modularna arhitektura, spremna za lokalno pokretanje preko Docker-a, sa migracijama, seed podacima i osnovnim testovima.

---

## 1. Tech stack

**Backend:**

- Python 3.12, FastAPI
- SQLAlchemy 2.x (ORM) + Alembic (migracije)
- PostgreSQL
- Pydantic v2 za šeme/validaciju
- Autentikacija: JWT (access + refresh token), passlib (bcrypt) za hash lozinki
- OAuth2 password flow + placeholder za Google OAuth login
- Uvicorn kao ASGI server
- Pytest za testove
- Slike: upload na lokalni `/media` folder, sa apstrakcijom (storage interfejs) da se kasnije lako zameni za S3/Cloudinary
- CORS middleware konfigurisan da dozvoljava frontend origin iz `.env`
- Logging: standardni Python `logging`, sa konfigurisanim nivoom preko `.env`

**Frontend:**

- Angular 18+ (standalone components, Angular Signals za lokalni state)
- TypeScript, striktan mod (`strict: true` u `tsconfig.json`)
- Angular Router, lazy-loaded feature rute
- Angular HttpClient + RxJS, HTTP interceptor za JWT (Authorization header + automatski refresh na 401)
- Reactive Forms (FormGroup/FormBuilder) sa validatorima za sve forme
- Tailwind CSS integrisan u Angular projekat
- `@ngx-translate/core` za višejezičnost (SR / EN / DE), runtime promena jezika
- State management: dedikovani Angular servisi sa Signals/BehaviorSubject za cart, auth, wishlist i jezik
- Angular `environment.ts` / `environment.prod.ts` za API base URL
- ESLint + Prettier konfiguracija

**Infrastruktura:**

- Docker + docker-compose (servisi: `backend`, `frontend`, `db` — Postgres)
- `.env` fajlovi za backend i frontend, sa `.env.example` predloškom za oba

---

## 2. Struktura projekta (monorepo)

```
ecommerce/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/               # config, security, dependencies, logging
│   │   ├── db/                  # session, base
│   │   ├── models/               # SQLAlchemy modeli
│   │   ├── schemas/               # Pydantic šeme
│   │   ├── crud/                   # CRUD funkcije
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── routers/        # endpoints po resursima
│   │   │       └── deps.py
│   │   ├── services/                # poslovna logika (referral, popusti, i18n, pretraga)
│   │   ├── media/                     # uploaded slike (gitignore)
│   │   └── seed/                       # seed skripta za demo podatke
│   ├── alembic/
│   ├── tests/
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/                  # auth, http interceptors, guards, services
│   │   │   ├── shared/                 # zajedničke komponente, pipes, directives
│   │   │   ├── features/
│   │   │   │   ├── home/
│   │   │   │   ├── catalog/             # category list, product list, filteri, pretraga
│   │   │   │   ├── product/              # product detail
│   │   │   │   ├── cart/
│   │   │   │   ├── checkout/
│   │   │   │   ├── account/               # dashboard, orders, wishlist, reviews, referral
│   │   │   │   ├── auth/                   # login, register, forgot/reset password
│   │   │   │   ├── blog/
│   │   │   │   └── admin/                  # admin dashboard + CRUD ekrani
│   │   │   ├── app.routes.ts
│   │   │   └── app.config.ts
│   │   ├── assets/
│   │   │   └── i18n/                       # sr.json, en.json, de.json
│   │   ├── environments/
│   │   └── styles.css                       # Tailwind imports
│   ├── angular.json
│   ├── package.json
│   ├── .env.example
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 3. Baza podataka — entiteti i ključna polja

Implementiraj sledeće tabele kao SQLAlchemy modele, sa relacijama (FK, one-to-many, many-to-many gde treba):

**users**

- id, email (unique), hashed_password, full_name, role (enum: `customer`, `admin`), phone, created_at
- referral_code (unique, generiše se automatski pri registraciji)
- referred_by_user_id (nullable FK na users.id)

**addresses**

- id, user_id (FK), full_name, street, city, postal_code, country, phone, is_default

**categories**

- id, name, slug, image_url, parent_category_id (nullable, za podkategorije)

**category_translations**

- id, category_id (FK), language_code (`sr`/`en`/`de`), name

**products**

- id, name, slug, description, price, discount_price (nullable), category_id (FK), brand, stock_quantity, status (enum: `active`, `inactive`), average_rating, created_at

**product_translations**

- id, product_id (FK), language_code (`sr`/`en`/`de`), name, description

**product_images**

- id, product_id (FK), image_url, position (redosled u galeriji)

**product_variants**

- id, product_id (FK), size, color, sku, stock_quantity, extra_price

**carts**

- id, user_id (FK, nullable za guest), session_id (za guest korpe), created_at

**cart_items**

- id, cart_id (FK), product_id (FK), variant_id (FK nullable), quantity, unit_price

**orders**

- id, user_id (FK, nullable za guest), order_number (unique), status (enum: `pending`, `processing`, `shipped`, `delivered`, `cancelled`), subtotal, discount_total, shipping_cost, total, shipping_address (JSON ili FK), payment_method, promo_code_used (nullable), created_at

**order_items**

- id, order_id (FK), product_id (FK), variant_id (FK nullable), product_name_snapshot, quantity, unit_price, line_total

**reviews**

- id, product_id (FK), user_id (FK), order_id (FK — verifikacija kupovine), rating (1-5), comment, created_at, is_approved (bool)

**wishlist_items**

- id, user_id (FK), product_id (FK), created_at

**promo_codes**

- id, code (unique), discount_percent, discount_amount (nullable), is_active, expires_at, usage_limit, times_used, type (enum: `general`, `referral_referee`, `referral_referrer`)

**referrals**

- id, referrer_user_id (FK), referred_user_id (FK), status (enum: `pending`, `completed`), referrer_reward_code_id (FK na promo_codes, nullable), created_at

**blog_posts**

- id, slug, title, excerpt, content (HTML/Markdown), cover_image_url, category, published_at, is_published

**blog_post_translations**

- id, blog_post_id (FK), language_code, title, excerpt, content

**newsletter_subscribers**

- id, email (unique), subscribed_at, is_active

---

## 4. API endpoints (FastAPI ruteri pod `/api/v1`)

**Auth** (`/auth`)

- `POST /auth/register` — prima i opcioni `referral_code`
- `POST /auth/login` — vraća access + refresh token
- `POST /auth/refresh`
- `POST /auth/google` (placeholder)
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me`

**Categories** (`/categories`)

- `GET /categories` — `lang` query parametar
- `GET /categories/{slug}`
- `POST /categories` (admin)
- `PUT /categories/{id}` (admin)
- `DELETE /categories/{id}` (admin)

**Products** (`/products`)

- `GET /products` — query parametri: `category`, `min_price`, `max_price`, `brand`, `size`, `color`, `min_rating`, `sort` (`price_asc`, `price_desc`, `newest`, `popular`, `rating`), `search`, `page` (default 1), `page_size` (default 12), `lang`
- `GET /products/{slug}`
- `GET /products/{id}/related`
- `GET /products/search-suggestions?q=` — vraća kratku listu naziva proizvoda za autocomplete (max 5-8 rezultata)
- `GET /products/brands` — lista distinct brendova za filter sidebar
- `POST /products` (admin)
- `PUT /products/{id}` (admin)
- `DELETE /products/{id}` (admin)
- `POST /products/{id}/images` (admin, multipart upload, validacija tipa i veličine fajla)
- `DELETE /products/{id}/images/{image_id}` (admin)
- `POST /products/{id}/variants` (admin)
- `PUT /products/{id}/variants/{variant_id}` (admin)
- `DELETE /products/{id}/variants/{variant_id}` (admin)

**Cart** (`/cart`)

- `GET /cart`
- `POST /cart/items`
- `PUT /cart/items/{item_id}`
- `DELETE /cart/items/{item_id}`
- `POST /cart/merge`
- `POST /cart/apply-promo`
- `DELETE /cart/promo` — uklanjanje primenjenog promo koda

**Orders / Checkout** (`/orders`)

- `POST /orders` — kreira porudžbinu iz korpe; smanjuje `stock_quantity` proizvoda/varijanti; validira da li je dovoljno na stanju
- `GET /orders`
- `GET /orders/{order_number}`
- `GET /admin/orders` (admin, filteri po statusu, paginacija)
- `PUT /admin/orders/{id}/status` (admin)

**Wishlist** (`/wishlist`)

- `GET /wishlist`
- `POST /wishlist/{product_id}`
- `DELETE /wishlist/{product_id}`

**Reviews** (`/reviews`)

- `GET /products/{product_id}/reviews` (samo `is_approved=true` za obične korisnike)
- `POST /products/{product_id}/reviews` — dozvoljeno samo ako korisnik ima `order_item` za taj proizvod
- `GET /admin/reviews` (admin, uključuje neodobrene)
- `PUT /admin/reviews/{id}/approve` (admin)
- `DELETE /admin/reviews/{id}` (admin)

**Referral program** (`/referrals`)

- `GET /referrals/me` — moj kod, broj uspešnih preporuka, dostupni kuponi

**Blog** (`/blog`)

- `GET /blog` — filter po kategoriji, `lang`, paginacija
- `GET /blog/{slug}`
- `POST /admin/blog` (admin)
- `PUT /admin/blog/{id}` (admin)
- `DELETE /admin/blog/{id}` (admin)

**Admin dashboard** (`/admin`)

- `GET /admin/stats` — broj porudžbina, prihod (ukupno + po periodu), broj korisnika, top proizvodi
- `GET /admin/users` (paginacija)
- `PUT /admin/users/{id}/role`

**Promo codes** (`/admin/promo-codes`)

- `GET /admin/promo-codes`
- `POST /admin/promo-codes`
- `PUT /admin/promo-codes/{id}`
- `DELETE /admin/promo-codes/{id}`

**Newsletter** (`/newsletter`)

- `POST /newsletter/subscribe`

**Pravila koja se primenjuju globalno:**

- Sve `/admin/*` rute i admin-only operacije zaštićene dependency-jem koji proverava `role == admin` iz JWT-a, vraća `403` ako nije admin.
- Svi GET endpoint-i koji vraćaju lokalizovani sadržaj primaju `lang` (`sr`|`en`|`de`, default `sr`), fallback na `sr`.
- Sve liste su paginirane u formatu: `{ "items": [...], "total": int, "page": int, "page_size": int }`.
- Sve greške u formatu `{ "detail": "..." }` sa odgovarajućim HTTP statusom (400/401/403/404/422).

---

## 5. Autentikacija, role i sigurnost

- JWT access token (~30 min) + refresh token (~7 dana, httpOnly cookie).
- Role: `customer`, `admin`. Prvi admin se kreira seed skriptom.
- Lozinke hash-ovane bcrypt-om, nikad u plain textu ni u logovima.
- Angular: `AuthService` čuva access token u memoriji (signal), HTTP interceptor dodaje header i radi refresh na 401.
- Route guards: `authGuard` (zahteva login) za `/account/**` i `/checkout`, `adminGuard` za `/admin/**`.
- Guest korpa: identifikovana preko `session_id` (cookie ili generisani UUID čuvan u localStorage), spaja se sa korisničkom korpom preko `POST /cart/merge` nakon login-a.

---

## 6. Frontend — Angular rute, moduli, komponente

- `/` — Home (`features/home`): HeroComponent, FeaturedProductsComponent, CategoryGridComponent, NewArrivalsComponent, BestsellersComponent, TestimonialsComponent, NewsletterSignupComponent
- `/category/:slug` i `/search` — `features/catalog`: ProductListComponent, FilterSidebarComponent (kategorija, cena - range slider, brend, veličina, boja, ocena), SortDropdownComponent, SearchBarComponent (autocomplete preko `search-suggestions`), PaginationComponent
- `/product/:slug` — `features/product`: ProductGalleryComponent (zoom + thumbnails), ProductInfoComponent (cena/popust, izbor varijante, dugmići korpa/wishlist, prikaz stanja na zalihama), ProductTabsComponent (opis, specifikacije, recenzije, dostava i povraćaj), RelatedProductsComponent, ReviewListComponent, ReviewFormComponent (vidljiv samo ulogovanim korisnicima sa verifikovanom kupovinom)
- `/cart` — `features/cart`: CartItemListComponent (izmena količine, brisanje), CartSummaryComponent (subtotal, popust, dostava, ukupno), PromoCodeFormComponent
- `/checkout` — `features/checkout`: stepper sa AddressStepComponent, ShippingMethodStepComponent, PaymentMethodStepComponent, OrderReviewStepComponent
- `/order-confirmation/:orderNumber`
- `/account` (authGuard) — `features/account`: AccountLayoutComponent + tabovi OrdersTabComponent, ProfileTabComponent, AddressesTabComponent, WishlistTabComponent, ReviewsTabComponent, ReferralTabComponent
- `/login`, `/register`, `/forgot-password`, `/reset-password` — `features/auth`
- `/blog`, `/blog/:slug` — `features/blog`: BlogListComponent, BlogPostComponent, BlogCategoryFilterComponent
- `/admin` (adminGuard) — `features/admin`: DashboardComponent (statistike + grafikoni preko ngx-charts ili Chart.js), ProductsAdminComponent (lista + forma sa upload slika i upravljanjem varijantama), CategoriesAdminComponent, OrdersAdminComponent (lista, filteri, detalji, izmena statusa), UsersAdminComponent, ReviewsAdminComponent (approve/delete), BlogAdminComponent, PromoCodesAdminComponent

**Shared** (`shared/`): HeaderComponent (nav, search, korpa/wishlist/nalog ikone, prekidač jezika SR/EN/DE), FooterComponent, ToastService + ToastComponent, SkeletonLoaderComponent, ProductCardComponent, ModalComponent, StarRatingComponent, ConfirmDialogComponent (za brisanje u admin panelu).

**Servisi** (`core/services`): `AuthService`, `CartService`, `WishlistService`, `ProductService`, `OrderService`, `ReviewService`, `ReferralService`, `BlogService`, `AdminService`, `LanguageService`, `NewsletterService`.

---

## 7. Dizajn (luksuzni stil)

- Boje (Tailwind theme extension): `charcoal` (#1A1A1A), `cream` (#F5F1EA), `gold` (#C9A876).
- Fontovi: Playfair Display (naslovi/serif) i Inter (telo teksta), učitani preko Google Fonts u `index.html`, definisani kao Tailwind `fontFamily`.
- Veliki razmaci, velike fotografije proizvoda, fade-in animacije pri učitavanju, hover zoom na slikama.
- Mobile-first responzivan dizajn.
- Dugmići: primary (gold fill/border, hover efekat) i secondary (outline) kao reusable stilovi/komponente — konzistentno kroz ceo sajt.

---

## 8. Višejezičnost (SR / EN / DE)

- Backend: `category_translations`, `product_translations`, `blog_post_translations`. Svi relevantni GET endpoint-i prihvataju `lang`, fallback na `sr`.
- Frontend: `@ngx-translate/core`, `assets/i18n/sr.json|en.json|de.json` za sve statične tekstove.
- `LanguageService`: čuva izbor u localStorage, poziva `TranslateService.use(lang)`, prosleđuje `lang` query parametar svim relevantnim API pozivima.
- Prekidač jezika u headeru (SR/EN/DE dropdown), promena bez reload-a.
- Opcionalno: prikaz cena u RSD i EUR — fiksna konfigurabilna kursna stopa u `core/config.py` (backend) ili custom Angular pipe.

---

## 9. Referral program (10% popusta)

- Pri registraciji se generiše unikatan `referral_code`.
- Novi korisnik unosi `referral_code` pri registraciji (opciono polje) ili kao promo kod u korpi → dobija promo kod `referral_referee` (10% popust na prvu porudžbinu).
- Kada referred korisnik završi prvu porudžbinu (status → `processing` ili `delivered`): backend kreira promo kod `referral_referrer` (10% popust) za referrer-a i postavlja `referrals.status = completed`.
- `ReferralTabComponent`: prikazuje lični referral link/kod sa dugmićem "Kopiraj" (Clipboard API), broj uspešnih preporuka, listu kupona sa statusom.

---

## 10. Plaćanje i dostava (checkout logika)

- Načini dostave: standardna i ekspresna, sa fiksnim cenama definisanim u konfiguraciji (npr. `core/config.py` ili tabela `shipping_methods` ako Codex proceni da je tabela bolja — u tom slučaju dodati je u sekciju 3).
- Načini plaćanja: kartica (placeholder/mock integracija — simulira uspešno plaćanje bez stvarne provider integracije), pouzeće. Arhitektura mora biti takva da se mock platni servis lako zameni za stvarnu integraciju (npr. Stripe) kasnije — koristiti interfejs/apstrakciju za `PaymentProvider`.
- Nakon uspešnog "plaćanja", porudžbina se kreira sa statusom `pending` ili `processing`, stanje zaliha se umanjuje, korpa se prazni.

---

## 11. Seed podaci

`backend/app/seed/seed.py` kreira:

- 1 admin korisnika (email/lozinka iz `.env`)
- 5 kategorija (sa prevodima SR/EN/DE)
- 8-10 proizvoda po kategoriji, sa varijantama, slikama (placeholder URL-ovi) i prevodima
- Nekoliko demo recenzija (odobrenih i neodobrenih, za testiranje moderacije)
- 3-4 blog posta (sa prevodima)
- Nekoliko promo kodova (uključujući po jedan primer `referral_referee` i `referral_referrer`)
- Nekoliko demo korisnika i porudžbina (za testiranje admin panela i statistika)

---

## 12. Plan implementacije — radi fazu po fazu, sumiraj nakon svake

1. **Faza 1 — Setup**: docker-compose (postgres, backend, frontend), FastAPI skeleton sa health-check, CORS, logging; Angular projekat (standalone, Tailwind, ngx-translate, ESLint/Prettier); Alembic init; `.env.example` za oba dela.
2. **Faza 2 — Modeli i migracije**: svi modeli iz sekcije 3, Alembic migracije, minimalna seed skripta.
3. **Faza 3 — Auth**: registracija/login/JWT/refresh/role/`auth/me`; frontend `AuthService`, login/register/forgot/reset komponente, interceptor, guards.
4. **Faza 4 — Katalog**: categories i products endpoints (filteri, sortiranje, pretraga, search-suggestions, brands, `lang`); frontend Home, Category/Search, Product Detail.
5. **Faza 5 — Korpa, checkout, plaćanje**: cart endpoints (guest/merge/promo), orders endpoints, shipping/payment logika iz sekcije 10; frontend Cart, Checkout (stepper), Order Confirmation.
6. **Faza 6 — Nalog korisnika i wishlist**: account dashboard (porudžbine, profil, adrese), wishlist endpoints i WishlistTabComponent.
7. **Faza 7 — Recenzije**: backend verifikacija kupovine + moderacija, ReviewForm/ReviewList, prosečna ocena.
8. **Faza 8 — Referral program**: logika iz sekcije 9, ReferralTabComponent.
9. **Faza 9 — Blog**: backend CRUD + frontend Blog stranice.
10. **Faza 10 — Admin panel**: sve admin rute/guard, CRUD ekrani (proizvodi sa slikama i varijantama, kategorije, porudžbine, korisnici, recenzije, blog, promo kodovi), dashboard statistike.
11. **Faza 11 — Višejezičnost**: kompletni `i18n` fajlovi, `LanguageService`, prekidač jezika, `lang` kroz sve pozive, provera fallback-a.
12. **Faza 12 — Newsletter i sitnice**: newsletter endpoint + frontend forma, finalni stilski prolaz (dizajn iz sekcije 7) kroz sve stranice.
13. **Faza 13 — Finalizacija**: kompletna seed skripta (sekcija 11), pytest testovi (auth, cart, orders, referral), osnovni Angular unit testovi (AuthService, CartService), README (pokretanje, migracije, seed, testovi, env varijable).

---

## 13. Finalna kontrolna lista (proveri pre nego što proglasiš gotovo)

- [ ] Sve tabele iz sekcije 3 postoje kao modeli sa migracijama, uključujući `category_translations`, `product_translations`, `blog_post_translations`, `newsletter_subscribers`
- [ ] Svi endpoint-i iz sekcije 4 implementirani, uključujući `search-suggestions`, `products/brands`, upload/brisanje slika i varijanti
- [ ] JWT auth sa refresh tokenom, role `customer`/`admin`, route guards na frontendu
- [ ] Guest korpa + merge nakon login-a
- [ ] Filteri (kategorija, cena, brend, veličina, boja, ocena) + sortiranje + live pretraga sa autocomplete
- [ ] Wishlist (add/remove, prikaz u account-u)
- [ ] Recenzije sa verifikacijom kupovine, prosečna ocena, admin moderacija
- [ ] Referral program — generisanje koda, popust za referee i referrer, prikaz u account-u
- [ ] Blog (lista, detalji, filter po kategoriji, prevodi)
- [ ] Admin panel — dashboard statistike + CRUD za proizvode, kategorije, porudžbine, korisnike, recenzije, blog, promo kodove
- [ ] Višejezičnost SR/EN/DE — statični tekstovi (ngx-translate) i dinamički sadržaj (lang parametar + fallback), prekidač jezika u headeru
- [ ] Checkout — dostava (standardna/ekspresna), plaćanje (mock, sa apstrakcijom za realnu integraciju), umanjenje zaliha, pražnjenje korpe
- [ ] Newsletter prijava (backend + frontend forma)
- [ ] Dizajn — paleta boja, fontovi, responzivnost, hover/fade tranzicije primenjeni konzistentno
- [ ] Seed skripta sa svim podacima iz sekcije 11
- [ ] Testovi (backend pytest + osnovni frontend testovi) prolaze
- [ ] `.env.example` fajlovi za backend i frontend, README sa kompletnim instrukcijama
- [ ] `docker-compose up` pokreće ceo projekat bez ručnih dodatnih koraka (osim eventualnog `docker-compose exec backend python -m app.seed.seed`)
