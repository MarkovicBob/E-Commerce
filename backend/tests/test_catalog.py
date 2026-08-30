"""Catalogue behaviour: nested categories, filters, facets and localisation."""

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models import Category, CategoryTranslation, Product, ProductTranslation, ProductVariant

client = TestClient(app)


def build_tree() -> None:
    """Three levels deep, so subtree rollup is genuinely exercised."""
    db = SessionLocal()
    root = Category(name="Odeća", slug="odeca", position=0)
    root.translations = [
        CategoryTranslation(language_code="sr", name="Odeća"),
        CategoryTranslation(language_code="en", name="Clothing"),
        CategoryTranslation(language_code="de", name="Bekleidung"),
    ]
    db.add(root)
    db.flush()

    mid = Category(name="Muška odeća", slug="muska-odeca", parent_category_id=root.id)
    db.add(mid)
    db.flush()

    leaf = Category(name="Odela", slug="odela", parent_category_id=mid.id)
    leaf.translations = [CategoryTranslation(language_code="en", name="Suits")]
    other = Category(name="Satovi", slug="satovi", position=1)
    db.add_all([leaf, other])
    db.flush()

    suit = Product(
        name="Milano odelo",
        slug="milano-odelo",
        description="Vuneno odelo",
        price=100000,
        category_id=leaf.id,
        brand="Sartoria Lume",
        stock_quantity=5,
    )
    suit.translations = [
        ProductTranslation(language_code="en", name="Milano suit", description="Wool suit"),
    ]
    suit.variants = [ProductVariant(size="50", color="Tamnoplava", sku="SUIT-1", stock_quantity=4)]

    watch = Product(
        name="Meridian sat",
        slug="meridian-sat",
        description="Automatski sat",
        price=200000,
        discount_price=150000,
        category_id=other.id,
        brand="Maison Aurea",
        stock_quantity=0,
    )
    watch.variants = [ProductVariant(size="40 mm", color="Čelik", sku="WATCH-1", stock_quantity=0)]

    db.add_all([suit, watch])
    db.commit()
    db.close()


def test_category_tree_nests_and_rolls_up_counts(fresh_db):
    build_tree()
    tree = client.get("/api/v1/categories?tree=true").json()
    roots = {item["slug"]: item for item in tree}
    assert set(roots) == {"odeca", "satovi"}
    # The suit sits two levels below `odeca` and must still be counted at the root.
    assert roots["odeca"]["product_count"] == 1
    assert roots["odeca"]["children"][0]["children"][0]["slug"] == "odela"


def test_products_include_whole_subtree(fresh_db):
    build_tree()
    assert client.get("/api/v1/products?category=odeca").json()["total"] == 1
    assert client.get("/api/v1/products?category=odela").json()["total"] == 1
    assert client.get("/api/v1/products?category=nope").json()["total"] == 0


def test_category_detail_exposes_breadcrumb(fresh_db):
    build_tree()
    detail = client.get("/api/v1/categories/odela").json()
    assert [item["slug"] for item in detail["breadcrumb"]] == ["odeca", "muska-odeca"]


def test_localised_names_fall_back_to_serbian(fresh_db):
    build_tree()
    assert client.get("/api/v1/categories/odeca?lang=de").json()["name"] == "Bekleidung"
    # No French translation exists, and an unsupported code falls back to sr.
    assert client.get("/api/v1/categories/odeca?lang=fr").json()["name"] == "Odeća"
    # `muska-odeca` has no translation rows at all, so the base name is used.
    assert client.get("/api/v1/categories/muska-odeca?lang=en").json()["name"] == "Muška odeća"
    # The product breadcrumb uses the translated category name too.
    assert client.get("/api/v1/products/milano-odelo?lang=en").json()["category_name"] == "Suits"


def test_search_matches_translated_names(fresh_db):
    build_tree()
    # "suit" exists only in the English translation row.
    assert client.get("/api/v1/products?search=suit").json()["total"] == 1


def test_filters_and_sorting(fresh_db):
    build_tree()
    assert client.get("/api/v1/products?in_stock=true").json()["total"] == 1
    assert client.get("/api/v1/products?on_sale=true").json()["total"] == 1
    assert client.get("/api/v1/products?brand=Maison Aurea").json()["total"] == 1
    assert client.get("/api/v1/products?size=50").json()["total"] == 1
    assert client.get("/api/v1/products?max_price=120000").json()["total"] == 1

    # Sorting is on the effective price: the watch ranks by its 150000 discount, not 200000.
    ascending = client.get("/api/v1/products?sort=price_asc").json()["items"]
    assert [item["slug"] for item in ascending] == ["milano-odelo", "meridian-sat"]
    descending = client.get("/api/v1/products?sort=price_desc").json()["items"]
    assert [item["slug"] for item in descending] == ["meridian-sat", "milano-odelo"]


def test_facets_describe_the_current_selection(fresh_db):
    build_tree()
    facets = client.get("/api/v1/products/facets?category=odeca").json()
    assert [entry["value"] for entry in facets["brands"]] == ["Sartoria Lume"]
    assert facets["sizes"] == ["50"]
    assert facets["min_price"] == facets["max_price"] == 100000


def test_effective_price_and_discount_percent(fresh_db):
    build_tree()
    watch = client.get("/api/v1/products/meridian-sat").json()
    assert watch["effective_price"] == 150000
    assert watch["discount_percent"] == 25
    assert watch["in_stock"] is False
