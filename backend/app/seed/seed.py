"""Seed the database with a full demo catalogue.

Re-runnable: pass --reset (or set SEED_RESET=1) to drop and rebuild everything.
Without it, an already-seeded database is left untouched.
"""

import argparse
import itertools
import os
import random
import unicodedata
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import (
    Address,
    BlogPost,
    BlogPostTranslation,
    Category,
    CategoryTranslation,
    NewsletterSubscriber,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductImage,
    ProductTranslation,
    ProductVariant,
    PromoCode,
    PromoType,
    Referral,
    ReferralStatus,
    Review,
    User,
    UserRole,
)
from app.seed.catalog_data import CATALOG

# Fixed seed so re-running produces the same catalogue, which keeps demos stable.
rng = random.Random(20240613)

# Global counter behind every SKU: leaf slugs alone are not distinct in their first
# characters (muski-satovi vs muski-kaputi), which collides on a unique column.
_sku_counter = itertools.count(1)

DESCRIPTIONS = {
    "sr": [
        "{name} nastaje u maloj seriji, sa ručnom završnom obradom i pažljivo biranim materijalima.",
        "{name} spaja klasičnu formu i savremenu izradu; svaki primerak prolazi pojedinačnu kontrolu.",
        "{name} je zamišljen kao komad koji se koristi godinama, a ne jednu sezonu.",
        "{name} odlikuje uzdržan dizajn i materijali koji lepo stare uz svakodnevnu upotrebu.",
    ],
    "en": [
        "{name} is produced in a small run, hand-finished and built from carefully chosen materials.",
        "{name} pairs a classic silhouette with contemporary making; every piece is inspected individually.",
        "{name} is designed to be kept for years rather than for a single season.",
        "{name} is defined by restrained design and materials that age well with daily use.",
    ],
    "de": [
        "{name} entsteht in kleiner Serie, von Hand veredelt und aus sorgfältig gewählten Materialien.",
        "{name} verbindet klassische Form mit zeitgemäßer Fertigung; jedes Stück wird einzeln geprüft.",
        "{name} ist als Begleiter für Jahre gedacht, nicht für eine Saison.",
        "{name} überzeugt durch zurückhaltendes Design und Materialien, die schön altern.",
    ],
}

CARE = {
    "sr": "Isporuka 2-4 radna dana. Povraćaj u roku od 30 dana.",
    "en": "Delivery in 2-4 working days. Returns accepted within 30 days.",
    "de": "Lieferung in 2-4 Werktagen. Rückgabe innerhalb von 30 Tagen.",
}

BLOG_POSTS = [
    {
        "slug": "kako-birati-mehanicki-sat",
        "category": "watches",
        "sr": (
            "Kako birati mehanički sat",
            "Šta zaista razdvaja dobar mehanizam od marketinške priče.",
            "<p>Mehanički sat se bira po mehanizmu, a ne po brojčaniku. Pogledajte rezervu hoda, "
            "servisni interval i da li je kalibar u širokoj upotrebi — to određuje koliko će vas "
            "održavanje koštati kroz deceniju.</p><p>Safirno staklo i čelik 316L su minimum u ovom "
            "rangu. Sve ispod toga je ušteda koju ćete platiti kasnije.</p>",
        ),
        "en": (
            "How to choose a mechanical watch",
            "What actually separates a good movement from a marketing story.",
            "<p>A mechanical watch is chosen by its movement, not its dial. Look at power reserve, "
            "service interval and whether the calibre is widely serviced — that decides what a decade "
            "of ownership costs you.</p><p>Sapphire crystal and 316L steel are the floor in this "
            "bracket. Anything below is a saving you pay for later.</p>",
        ),
        "de": (
            "Wie man eine mechanische Uhr wählt",
            "Was ein gutes Uhrwerk wirklich von einer Marketinggeschichte trennt.",
            "<p>Eine mechanische Uhr wählt man über das Werk, nicht über das Zifferblatt. Achten Sie auf "
            "Gangreserve, Serviceintervall und ob das Kaliber verbreitet ist — das bestimmt die Kosten "
            "über ein Jahrzehnt.</p><p>Saphirglas und 316L-Stahl sind hier das Minimum.</p>",
        ),
    },
    {
        "slug": "kasmir-koji-traje",
        "category": "style",
        "sr": (
            "Kašmir koji zaista traje",
            "Dužina vlakna, broj niti i zašto cena varira deset puta.",
            "<p>Kvalitet kašmira određuje dužina vlakna. Duža vlakna manje se čupaju i drže formu "
            "godinama. Dve niti (2-ply) su standard za džempere koji se nose zimi.</p>"
            "<p>Perite ručno u hladnoj vodi i sušite ravno — mašina uništi vlakno u nekoliko pranja.</p>",
        ),
        "en": (
            "Cashmere that actually lasts",
            "Fibre length, ply count and why prices vary tenfold.",
            "<p>Cashmere quality comes down to fibre length. Longer fibres pill less and hold shape for "
            "years. Two-ply is the standard for sweaters meant for real winters.</p>"
            "<p>Hand wash cold and dry flat — a machine destroys the fibre in a few cycles.</p>",
        ),
        "de": (
            "Kaschmir, der wirklich hält",
            "Faserlänge, Zwirn und warum die Preise zehnfach schwanken.",
            "<p>Die Qualität von Kaschmir hängt an der Faserlänge. Längere Fasern pillen weniger und "
            "halten die Form über Jahre. Zweifädig ist der Standard für echte Winter.</p>"
            "<p>Kalt von Hand waschen und liegend trocknen.</p>",
        ),
    },
    {
        "slug": "goodyear-izrada-cipela",
        "category": "style",
        "sr": (
            "Goodyear izrada: zašto se isplati",
            "Cipela koja se prešiva umesto da se baca.",
            "<p>Kod Goodyear izrade gornji deo je prišiven za traku, pa se đon menja bez diranja "
            "gornjišta. Par se tako obnavlja tri do četiri puta.</p><p>Kalup je važniji od broja — "
            "isti broj kod dva kopita nosi se potpuno drugačije.</p>",
        ),
        "en": (
            "Goodyear welting: why it pays off",
            "A shoe that gets resoled instead of thrown away.",
            "<p>In a Goodyear welt the upper is stitched to a welt, so the sole is replaced without "
            "touching the upper. A pair can be renewed three or four times.</p><p>The last matters more "
            "than the size — the same size on two lasts fits completely differently.</p>",
        ),
        "de": (
            "Rahmengenäht: warum es sich lohnt",
            "Ein Schuh, der neu besohlt statt weggeworfen wird.",
            "<p>Beim Rahmen wird der Schaft an den Rahmen genäht, die Sohle lässt sich ohne Eingriff am "
            "Schaft wechseln. Ein Paar lässt sich drei- bis viermal erneuern.</p>",
        ),
    },
    {
        "slug": "slojevi-parfema",
        "category": "fragrance",
        "sr": (
            "Slojevi parfema i kako da traje duže",
            "Koncentracija, koža i mesta na koja se nanosi.",
            "<p>Extrait ima 20-30% mirisnih ulja, eau de parfum oko 15-20%. Razlika se vidi u trajanju, "
            "ne u jačini prvog utiska.</p><p>Nanosite na hidriranu kožu — suva koža ne zadržava miris.</p>",
        ),
        "en": (
            "Fragrance layers and how to make them last",
            "Concentration, skin and where to apply.",
            "<p>Extrait carries 20-30% perfume oils, eau de parfum around 15-20%. The difference shows in "
            "longevity, not in the strength of the opening.</p><p>Apply to moisturised skin — dry skin "
            "does not hold scent.</p>",
        ),
        "de": (
            "Duftschichten und längere Haltbarkeit",
            "Konzentration, Haut und die richtigen Stellen.",
            "<p>Extrait enthält 20-30% Duftöle, Eau de Parfum etwa 15-20%. Der Unterschied zeigt sich in "
            "der Haltbarkeit.</p><p>Auf gepflegte Haut auftragen — trockene Haut hält keinen Duft.</p>",
        ),
    },
    {
        "slug": "nega-kozne-galanterije",
        "category": "care",
        "sr": (
            "Nega kožne galanterije kroz godine",
            "Četiri koraka koja produžavaju vek torbe za deceniju.",
            "<p>Kožu čistite suvom krpom posle svakog nošenja, a kondicionirajte dva do tri puta "
            "godišnje. Punite torbu papirom kada se ne koristi da zadrži formu.</p>"
            "<p>Izbegavajte direktno sunce i radijatore — koža se suši i puca.</p>",
        ),
        "en": (
            "Caring for leather goods over the years",
            "Four steps that add a decade to a bag.",
            "<p>Wipe leather with a dry cloth after each use and condition it two or three times a year. "
            "Stuff a bag with paper when stored so it keeps its shape.</p><p>Keep it away from direct sun "
            "and radiators — leather dries and cracks.</p>",
        ),
        "de": (
            "Lederpflege über die Jahre",
            "Vier Schritte, die einer Tasche ein Jahrzehnt schenken.",
            "<p>Leder nach jedem Tragen trocken abwischen und zwei- bis dreimal jährlich pflegen. "
            "Beim Lagern mit Papier ausstopfen.</p><p>Direkte Sonne und Heizkörper meiden.</p>",
        ),
    },
    {
        "slug": "kako-spakovati-kofer",
        "category": "travel",
        "sr": (
            "Kako spakovati kofer za nedelju dana",
            "Sistem koji staje u kabinski prtljag.",
            "<p>Osnova je paleta od tri boje koja se međusobno kombinuje. Rolajte pletenine, slažite "
            "košulje, a cipele punite čarapama.</p><p>Teške stvari idu uz točkove — kofer tada stoji "
            "stabilno i lakše se vuče.</p>",
        ),
        "en": (
            "Packing a carry-on for a week",
            "A system that fits in cabin luggage.",
            "<p>Start from a three-colour palette that combines with itself. Roll knitwear, fold shirts "
            "and fill shoes with socks.</p><p>Heavy items go by the wheels — the case then stands "
            "steady and pulls more easily.</p>",
        ),
        "de": (
            "Handgepäck für eine Woche packen",
            "Ein System, das in die Kabine passt.",
            "<p>Beginnen Sie mit einer Drei-Farben-Palette. Strick rollen, Hemden falten, Schuhe mit "
            "Socken füllen.</p><p>Schweres kommt an die Rollen.</p>",
        ),
    },
]

REVIEW_COMMENTS = [
    (
        {
            "sr": "Izrada je zaista na nivou, stigla je brzo i upakovano besprekorno.",
            "en": "The craftsmanship is excellent; it arrived quickly and was impeccably packaged.",
            "de": "Die Verarbeitung ist ausgezeichnet; die Lieferung war schnell und die Verpackung makellos.",
        },
        5,
    ),
    (
        {
            "sr": "Kvalitet opravdava cenu. Koristim svakodnevno već mesecima.",
            "en": "The quality justifies the price. I have used it every day for months.",
            "de": "Die Qualität rechtfertigt den Preis. Ich benutze es seit Monaten täglich.",
        },
        5,
    ),
    (
        {
            "sr": "Vrlo lep komad, jedino je nijansa nešto tamnija nego na slici.",
            "en": "A beautiful piece; the shade is just a little darker than in the photo.",
            "de": "Ein sehr schönes Stück; der Farbton ist nur etwas dunkler als auf dem Foto.",
        },
        4,
    ),
    (
        {
            "sr": "Zadovoljan sam, ali isporuka je kasnila dva dana.",
            "en": "I am satisfied, although delivery was two days late.",
            "de": "Ich bin zufrieden, allerdings kam die Lieferung zwei Tage zu spät.",
        },
        4,
    ),
    (
        {
            "sr": "Solidno za tu cenu, očekivao sam malo deblji materijal.",
            "en": "Good for the price, though I expected a slightly heavier material.",
            "de": "Für den Preis solide, allerdings hatte ich etwas dickeres Material erwartet.",
        },
        3,
    ),
    (
        {
            "sr": "Odlična kupovina, već sam naručila drugi komad.",
            "en": "An excellent purchase; I have already ordered a second piece.",
            "de": "Ein ausgezeichneter Kauf; ich habe bereits ein zweites Stück bestellt.",
        },
        5,
    ),
    (
        {
            "sr": "Materijal je prijatan, veličina odgovara tabeli.",
            "en": "The material feels pleasant and the size matches the chart.",
            "de": "Das Material fühlt sich angenehm an und die Größe entspricht der Tabelle.",
        },
        4,
    ),
]

FIRST_NAMES = ["Ana", "Marko", "Jelena", "Nikola", "Milica", "Stefan", "Ivana", "Luka", "Sara", "Petar"]
LAST_NAMES = ["Kovač", "Ilić", "Jovanović", "Petrović", "Nikolić", "Marković", "Đorđević", "Stojanović"]

CITIES = [("Beograd", "11000"), ("Novi Sad", "21000"), ("Niš", "18000"), ("Kragujevac", "34000")]


def slugify(value: str) -> str:
    """ASCII slug; Serbian diacritics are folded so URLs stay clean."""
    folded = value.replace("đ", "dj").replace("Đ", "Dj")
    normalized = unicodedata.normalize("NFKD", folded).encode("ascii", "ignore").decode()
    out = "".join(char if char.isalnum() else "-" for char in normalized.lower())
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-")


def image_url(seed: str, index: int) -> str:
    """Deterministic artwork served locally, with no third-party dependency."""
    return f"/api/v1/placeholders/{seed}-{index}.svg"


def price_for(low: int, high: int, index: int, count: int) -> int:
    """Spread prices across the band so filters and sorting have something to bite on."""
    if count <= 1:
        return low
    step = (high - low) / (count - 1)
    raw = low + step * index
    return int(round(raw / 500) * 500)


def build_products(db, category: Category, leaf: dict) -> list[Product]:
    noun_sr, noun_en, noun_de = leaf["noun"]
    models = leaf["models"]
    low, high = leaf["price"]
    created: list[Product] = []

    for index, model in enumerate(models):
        names = {
            "sr": f"{model} {noun_sr}",
            "en": f"{model} {noun_en}",
            "de": f"{model} {noun_de}",
        }
        base_price = price_for(low, high, index, len(models))
        # Roughly every third product carries a visible discount.
        on_sale = index % 3 == 1
        discount_price = int(round(base_price * 0.82 / 500) * 500) if on_sale else None
        brand = leaf["brands"][index % len(leaf["brands"])]
        slug = slugify(f"{model}-{leaf['slug']}")
        stock = rng.choice([0, 3, 8, 14, 22, 35, 60])

        product = Product(
            name=names["sr"],
            slug=slug,
            description=DESCRIPTIONS["sr"][index % 4].format(name=names["sr"]) + " " + CARE["sr"],
            price=base_price,
            discount_price=discount_price,
            category_id=category.id,
            brand=brand,
            stock_quantity=stock,
            is_featured=index % 7 == 0,
            sales_count=rng.randint(0, 180),
            specs={**leaf["specs"], "Brend": brand},
            created_at=datetime.now(timezone.utc) - timedelta(days=rng.randint(0, 420)),
        )
        product.translations = [
            ProductTranslation(
                language_code=code,
                name=names[code],
                description=DESCRIPTIONS[code][index % 4].format(name=names[code]) + " " + CARE[code],
            )
            for code in ("sr", "en", "de")
        ]
        product.images = [ProductImage(image_url=image_url(slug, position), position=position) for position in range(3)]

        sizes = leaf["sizes"]
        colors = leaf["colors"]
        variants: list[ProductVariant] = []
        for size_index, size in enumerate(sizes):
            for color_index, color in enumerate(colors):
                variants.append(
                    ProductVariant(
                        size=size,
                        color=color,
                        sku=f"{leaf['slug'][:4].upper()}-{next(_sku_counter):05d}",
                        stock_quantity=0 if stock == 0 else rng.randint(0, max(2, stock // 2)),
                        # Larger sizes and premium finishes cost a little more.
                        extra_price=size_index * 500 + (1000 if color_index == len(colors) - 1 else 0),
                    )
                )
        product.variants = variants
        db.add(product)
        created.append(product)
    return created


def build_category(db, node: dict, parent: Category | None, position: int) -> list[Product]:
    sr, en, de = node["name"]
    desc = node.get("desc")
    category = Category(
        name=sr,
        slug=node["slug"],
        description=desc[0] if desc else None,
        image_url=image_url(node["slug"], 0).replace("900/1200", "1200/900"),
        position=position,
        parent_category_id=parent.id if parent else None,
    )
    category.translations = [
        CategoryTranslation(language_code="sr", name=sr, description=desc[0] if desc else None),
        CategoryTranslation(language_code="en", name=en, description=desc[1] if desc else None),
        CategoryTranslation(language_code="de", name=de, description=desc[2] if desc else None),
    ]
    db.add(category)
    db.flush()

    products: list[Product] = []
    if node.get("models"):
        products += build_products(db, category, node)
    for child_position, child in enumerate(node.get("children", [])):
        products += build_category(db, child, category, child_position)
    return products


def build_users(db) -> tuple[User, list[User]]:
    admin = User(
        email=settings.admin_email.lower(),
        hashed_password=hash_password(settings.admin_password),
        full_name="Demo Admin",
        role=UserRole.admin,
        phone="+381 11 000 000",
        referral_code="ADMINLUX",
    )
    db.add(admin)

    customers: list[User] = []
    for index in range(10):
        first = FIRST_NAMES[index % len(FIRST_NAMES)]
        last = LAST_NAMES[index % len(LAST_NAMES)]
        city, postal = CITIES[index % len(CITIES)]
        user = User(
            email=f"{slugify(first)}.{slugify(last)}@example.com",
            hashed_password=hash_password("Customer123!"),
            full_name=f"{first} {last}",
            phone=f"+381 6{index} 123 45{index}",
            referral_code=f"LUXE{index:04d}",
            created_at=datetime.now(timezone.utc) - timedelta(days=rng.randint(10, 500)),
        )
        db.add(user)
        db.flush()
        db.add(
            Address(
                user_id=user.id,
                label="Kuća",
                full_name=user.full_name,
                street=f"Ulica {index + 1}, br. {index + 3}",
                city=city,
                postal_code=postal,
                country="Srbija",
                phone=user.phone,
                is_default=True,
            )
        )
        customers.append(user)

    # One referral pair completed, one still pending, so both states are visible in the UI.
    db.flush()
    db.add(Referral(referrer_user_id=customers[0].id, referred_user_id=customers[1].id, status=ReferralStatus.completed))
    db.add(Referral(referrer_user_id=customers[0].id, referred_user_id=customers[2].id, status=ReferralStatus.pending))
    customers[1].referred_by_user_id = customers[0].id
    customers[2].referred_by_user_id = customers[0].id
    return admin, customers


def build_orders(db, customers: list[User], products: list[Product]) -> list[Order]:
    statuses = [
        OrderStatus.delivered,
        OrderStatus.delivered,
        OrderStatus.shipped,
        OrderStatus.processing,
        OrderStatus.pending,
        OrderStatus.cancelled,
    ]
    in_stock = [p for p in products if p.stock_quantity > 0]
    orders: list[Order] = []

    for index in range(24):
        customer = customers[index % len(customers)]
        status = statuses[index % len(statuses)]
        chosen = rng.sample(in_stock, rng.randint(1, 3))
        created_at = datetime.now(timezone.utc) - timedelta(days=rng.randint(0, 60), hours=rng.randint(0, 23))
        city, postal = CITIES[index % len(CITIES)]

        subtotal = 0.0
        lines = []
        for product in chosen:
            quantity = rng.randint(1, 2)
            unit_price = float(product.discount_price if product.discount_price is not None else product.price)
            line_total = round(unit_price * quantity, 2)
            subtotal += line_total
            lines.append((product, quantity, unit_price, line_total))

        shipping_method = "express" if index % 4 == 0 else "standard"
        shipping_cost = float(
            settings.express_shipping_cost if shipping_method == "express" else settings.standard_shipping_cost
        )
        discount = round(subtotal * 0.1, 2) if index % 5 == 0 else 0.0
        order = Order(
            user_id=customer.id,
            order_number=f"LC-DEMO-{index + 1:04d}",
            status=status,
            subtotal=round(subtotal, 2),
            discount_total=discount,
            shipping_cost=shipping_cost,
            total=round(subtotal - discount + shipping_cost, 2),
            shipping_address={
                "full_name": customer.full_name,
                "street": f"Ulica {index + 1}, br. {index + 3}",
                "city": city,
                "postal_code": postal,
                "country": "Srbija",
                "phone": customer.phone or "+381 60 000 000",
            },
            shipping_method=shipping_method,
            payment_method="card" if index % 3 else "cash_on_delivery",
            contact_email=customer.email,
            promo_code_used="LUXE10" if discount else None,
            created_at=created_at,
        )
        db.add(order)
        db.flush()
        for product, quantity, unit_price, line_total in lines:
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    product_name_snapshot=product.name,
                    quantity=quantity,
                    unit_price=unit_price,
                    line_total=line_total,
                )
            )
            if status != OrderStatus.cancelled:
                product.sales_count = (product.sales_count or 0) + quantity
        orders.append(order)
    return orders


def build_reviews(db, orders: list[Order]) -> None:
    """Reviews only on delivered orders, with a few left unapproved for moderation demos."""
    rated: dict[int, list[int]] = {}
    counter = 0
    for order in orders:
        if order.status != OrderStatus.delivered:
            continue
        for item in order.items:
            comments, rating = REVIEW_COMMENTS[counter % len(REVIEW_COMMENTS)]
            # Every fifth review stays pending so the admin queue is not empty.
            approved = counter % 5 != 0
            db.add(
                Review(
                    product_id=item.product_id,
                    user_id=order.user_id,
                    order_id=order.id,
                    rating=rating,
                    comment=comments["sr"],
                    comment_en=comments["en"],
                    comment_de=comments["de"],
                    is_approved=approved,
                    created_at=order.created_at + timedelta(days=3),
                )
            )
            if approved:
                rated.setdefault(item.product_id, []).append(rating)
            counter += 1

    for product_id, ratings in rated.items():
        product = db.get(Product, product_id)
        if product:
            product.average_rating = round(sum(ratings) / len(ratings), 2)
            product.review_count = len(ratings)


def build_blog(db) -> None:
    for index, post_data in enumerate(BLOG_POSTS):
        sr_title, sr_excerpt, sr_content = post_data["sr"]
        post = BlogPost(
            slug=post_data["slug"],
            title=sr_title,
            excerpt=sr_excerpt,
            content=sr_content,
            cover_image_url=image_url(post_data["slug"], 0).replace("900/1200", "1600/900"),
            category=post_data["category"],
            published_at=datetime.now(timezone.utc) - timedelta(days=index * 9),
            is_published=True,
        )
        post.translations = [
            BlogPostTranslation(
                language_code=code,
                title=post_data[code][0],
                excerpt=post_data[code][1],
                content=post_data[code][2],
            )
            for code in ("sr", "en", "de")
        ]
        db.add(post)


def build_promos(db) -> None:
    now = datetime.now(timezone.utc)
    promos = [
        ("LUXE10", 10, None, PromoType.general, now + timedelta(days=180), 500),
        ("DOBRODOSLI15", 15, None, PromoType.general, now + timedelta(days=90), 200),
        ("SEZONA20", 20, None, PromoType.general, now + timedelta(days=30), 100),
        ("POKLON3000", 0, 3000, PromoType.general, now + timedelta(days=120), 50),
        ("REFEREE10", 10, None, PromoType.referral_referee, now + timedelta(days=365), 1),
        ("REFERRER10", 10, None, PromoType.referral_referrer, now + timedelta(days=365), 1),
        # Deliberately expired, so the "invalid code" path is easy to demonstrate.
        ("ISTEKAO", 25, None, PromoType.general, now - timedelta(days=5), 100),
    ]
    for code, percent, amount, kind, expires, limit in promos:
        db.add(
            PromoCode(
                code=code,
                discount_percent=percent,
                discount_amount=amount,
                type=kind,
                expires_at=expires,
                usage_limit=limit,
                is_active=True,
            )
        )


def run(reset: bool = False) -> None:
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(User).filter_by(email=settings.admin_email.lower()).first():
            print("Database already seeded. Re-run with --reset to rebuild it.")
            return

        admin, customers = build_users(db)
        db.flush()

        products: list[Product] = []
        for position, node in enumerate(CATALOG):
            products += build_category(db, node, None, position)
        db.flush()

        orders = build_orders(db, customers, products)
        db.flush()
        build_reviews(db, orders)
        build_blog(db)
        build_promos(db)

        for index in range(6):
            db.add(NewsletterSubscriber(email=f"subscriber{index + 1}@example.com"))

        db.commit()
        print(
            f"Seeded {db.query(Category).count()} categories, "
            f"{db.query(Product).count()} products, "
            f"{db.query(ProductVariant).count()} variants, "
            f"{db.query(Order).count()} orders, "
            f"{db.query(Review).count()} reviews."
        )
        print(f"Admin login: {settings.admin_email} / {settings.admin_password}")
        print(f"Customer login: {customers[0].email} / Customer123!")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the Luxe Commerce database")
    parser.add_argument("--reset", action="store_true", help="Drop every table before seeding")
    args = parser.parse_args()
    run(reset=args.reset or os.getenv("SEED_RESET") == "1")
