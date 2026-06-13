from datetime import datetime, timezone

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import (
    BlogPost,
    BlogPostTranslation,
    Category,
    CategoryTranslation,
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

categories = [
    ("satovi", "Satovi", "Watches", "Uhren"),
    ("torbe", "Torbe", "Bags", "Taschen"),
    ("nakit", "Nakit", "Jewelry", "Schmuck"),
    ("parfemi", "Parfemi", "Fragrances", "Parfums"),
    ("dodaci", "Dodaci", "Accessories", "Accessoires"),
]


def run() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter_by(email=settings.admin_email).first():
            return
        admin = User(email=settings.admin_email, hashed_password=hash_password(settings.admin_password), full_name="Demo Admin", role=UserRole.admin, referral_code="ADMINLUX")
        ana = User(email="ana@example.com", hashed_password=hash_password("Customer123!"), full_name="Ana Kovac", referral_code="ANALUX10")
        marko = User(email="marko@example.com", hashed_password=hash_password("Customer123!"), full_name="Marko Ilic", referral_code="MARKOLUX")
        db.add_all([admin, ana, marko])
        db.flush()
        db.add(Referral(referrer_user_id=ana.id, referred_user_id=marko.id, status=ReferralStatus.completed))

        category_rows = []
        for slug, sr, en, de in categories:
            category = Category(name=sr, slug=slug, image_url=f"https://images.unsplash.com/800x900/?luxury,{slug}")
            category.translations = [
                CategoryTranslation(language_code="sr", name=sr),
                CategoryTranslation(language_code="en", name=en),
                CategoryTranslation(language_code="de", name=de),
            ]
            db.add(category)
            category_rows.append(category)
        db.flush()

        brands = ["Maison Aurea", "Velvet Row", "Noir Atelier", "Lumiere"]
        for category in category_rows:
            for idx in range(1, 9):
                base_name = f"{category.name} Signature {idx}"
                product = Product(
                    name=base_name,
                    slug=f"{category.slug}-signature-{idx}",
                    description="Premium komad iz limitirane kolekcije sa luksuznom zavrsnom obradom.",
                    price=12000 + idx * 1800,
                    discount_price=(11000 + idx * 1500) if idx % 4 == 0 else None,
                    category_id=category.id,
                    brand=brands[idx % len(brands)],
                    stock_quantity=25,
                )
                product.translations = [
                    ProductTranslation(language_code="sr", name=base_name, description=product.description),
                    ProductTranslation(language_code="en", name=f"{category.translations[1].name} Signature {idx}", description="Premium limited collection piece with refined finishing."),
                    ProductTranslation(language_code="de", name=f"{category.translations[2].name} Signature {idx}", description="Premiumstueck aus limitierter Kollektion mit feinem Finish."),
                ]
                product.images = [
                    ProductImage(image_url=f"https://images.unsplash.com/900x1200/?luxury,product,{category.slug},{idx}", position=0),
                    ProductImage(image_url=f"https://images.unsplash.com/900x1200/?fashion,{category.slug},{idx}", position=1),
                ]
                product.variants = [
                    ProductVariant(size="M", color="Gold", sku=f"{category.slug.upper()}-{idx}-GLD", stock_quantity=12),
                    ProductVariant(size="L", color="Charcoal", sku=f"{category.slug.upper()}-{idx}-CHR", stock_quantity=13, extra_price=500),
                ]
                db.add(product)
        db.flush()

        first_products = db.query(Product).limit(3).all()
        order = Order(
            user_id=ana.id,
            order_number="LC-DEMO-0001",
            status=OrderStatus.delivered,
            subtotal=30000,
            discount_total=0,
            shipping_cost=settings.standard_shipping_cost,
            total=30500,
            shipping_address={"full_name": "Ana Kovac", "street": "Knez Mihailova 1", "city": "Beograd", "postal_code": "11000", "country": "Srbija", "phone": "+381600000"},
            payment_method="card",
        )
        db.add(order)
        db.flush()
        for product in first_products:
            db.add(OrderItem(order_id=order.id, product_id=product.id, product_name_snapshot=product.name, quantity=1, unit_price=product.price, line_total=product.price))
            db.add(Review(product_id=product.id, user_id=ana.id, order_id=order.id, rating=5, comment="Besprekorna izrada.", is_approved=True))
        db.add(Review(product_id=first_products[0].id, user_id=marko.id, order_id=order.id, rating=4, comment="Ceka moderaciju.", is_approved=False))

        for code, kind in [("LUXE10", PromoType.general), ("REFEREE10", PromoType.referral_referee), ("REFERRER10", PromoType.referral_referrer)]:
            db.add(PromoCode(code=code, discount_percent=10, type=kind, usage_limit=100))

        for idx in range(1, 5):
            post = BlogPost(
                slug=f"vodic-za-luksuz-{idx}",
                title=f"Vodic za luksuz {idx}",
                excerpt="Kratak vodic za pazljiv izbor premium komada.",
                content="<p>Birajte materijale, poreklo i trajnost pre sezonskog trenda.</p>",
                cover_image_url=f"https://images.unsplash.com/1200x800/?luxury,lifestyle,{idx}",
                category="style",
                published_at=datetime.now(timezone.utc),
            )
            post.translations = [
                BlogPostTranslation(language_code="sr", title=post.title, excerpt=post.excerpt, content=post.content),
                BlogPostTranslation(language_code="en", title=f"Luxury guide {idx}", excerpt="A short guide to choosing premium pieces.", content="<p>Choose materials, origin and longevity before seasonal trends.</p>"),
                BlogPostTranslation(language_code="de", title=f"Luxusratgeber {idx}", excerpt="Ein kurzer Leitfaden fuer Premiumstuecke.", content="<p>Waehlen Sie Materialien, Herkunft und Langlebigkeit.</p>"),
            ]
            db.add(post)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    run()
