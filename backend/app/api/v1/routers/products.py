from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy import false, func, or_
from sqlalchemy.orm import Session, selectinload

from app.api.v1.deps import admin_user
from app.db.session import get_db
from app.models import (
    Category,
    Product,
    ProductImage,
    ProductStatus,
    ProductTranslation,
    ProductVariant,
    Review,
)
from app.services.catalog import descendant_ids
from app.services.i18n import SUPPORTED_LANGS, localized
from app.services.storage import media_url, placeholder_url, storage

router = APIRouter()

PLACEHOLDER_IMAGE = placeholder_url("luxe-placeholder")


class TranslationIn(BaseModel):
    language_code: str
    name: str
    description: str


class ProductIn(BaseModel):
    name: str
    slug: str
    description: str
    price: float
    discount_price: float | None = None
    category_id: int
    brand: str
    stock_quantity: int = 0
    status: ProductStatus = ProductStatus.active
    is_featured: bool = False
    specs: dict | None = None
    # None leaves existing translations untouched; [] clears them explicitly.
    translations: list[TranslationIn] | None = None


class VariantIn(BaseModel):
    size: str | None = None
    color: str | None = None
    sku: str
    stock_quantity: int = 0
    extra_price: float = 0


def variant_out(variant: ProductVariant) -> dict:
    return {
        "id": variant.id,
        "size": variant.size,
        "color": variant.color,
        "sku": variant.sku,
        "stock_quantity": variant.stock_quantity,
        "extra_price": float(variant.extra_price or 0),
    }


def product_out(product: Product, lang: str = "sr") -> dict:
    data = localized(product, lang, ("name", "description"))
    category_name = localized(product.category, lang, ("name",))["name"] if product.category else None
    images = [
        {"id": img.id, "image_url": media_url(img.image_url), "position": img.position}
        for img in sorted(product.images, key=lambda i: i.position)
    ]
    price = float(product.price)
    discount_price = float(product.discount_price) if product.discount_price is not None else None
    effective = discount_price if discount_price is not None else price
    return {
        "id": product.id,
        "slug": product.slug,
        "price": price,
        "discount_price": discount_price,
        "effective_price": effective,
        "discount_percent": round((1 - effective / price) * 100) if price and effective < price else 0,
        "category_id": product.category_id,
        "category_slug": product.category.slug if product.category else None,
        "category_name": category_name,
        "brand": product.brand,
        "stock_quantity": product.stock_quantity,
        "in_stock": product.stock_quantity > 0,
        "status": product.status.value,
        "average_rating": float(product.average_rating or 0),
        "review_count": product.review_count or 0,
        "sales_count": product.sales_count or 0,
        "is_featured": bool(product.is_featured),
        "specs": product.specs or {},
        "images": images or [{"id": 0, "image_url": PLACEHOLDER_IMAGE, "position": 0}],
        "variants": [variant_out(v) for v in product.variants],
        "created_at": product.created_at,
        **data,
    }


def base_query(db: Session):
    """Eager-load everything `product_out` touches so a page of results is a few queries, not N."""
    return db.query(Product).options(
        selectinload(Product.images),
        selectinload(Product.variants),
        selectinload(Product.translations),
        selectinload(Product.category),
    )


def apply_translations(db: Session, product: Product, translations: list[TranslationIn] | None) -> None:
    """A None payload is a no-op, so editing a product does not drop its translations."""
    if translations is None:
        return
    db.query(ProductTranslation).filter_by(product_id=product.id).delete()
    for item in translations:
        if item.language_code in SUPPORTED_LANGS:
            db.add(
                ProductTranslation(
                    product_id=product.id,
                    language_code=item.language_code,
                    name=item.name,
                    description=item.description,
                )
            )


def filtered_query(
    db: Session,
    *,
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    brand: str | None = None,
    size: str | None = None,
    color: str | None = None,
    min_rating: float | None = None,
    search: str | None = None,
    in_stock: bool | None = None,
    on_sale: bool | None = None,
    include_inactive: bool = False,
):
    """Shared filter pipeline so the list, facet and count endpoints never drift apart."""
    query = base_query(db)
    if not include_inactive:
        query = query.filter(Product.status == ProductStatus.active)
    if category:
        root = db.query(Category).filter_by(slug=category).first()
        if not root:
            # An unknown slug must yield an empty page, not the whole catalogue.
            return query.filter(false())
        query = query.filter(Product.category_id.in_(descendant_ids(db, root.id)))
    if brand:
        # Comma-separated so the sidebar can tick several brands at once.
        wanted = [value.strip() for value in brand.split(",") if value.strip()]
        if wanted:
            query = query.filter(Product.brand.in_(wanted))
    price = func.coalesce(Product.discount_price, Product.price)
    if min_price is not None:
        query = query.filter(price >= min_price)
    if max_price is not None:
        query = query.filter(price <= max_price)
    if min_rating is not None:
        query = query.filter(Product.average_rating >= min_rating)
    if in_stock:
        query = query.filter(Product.stock_quantity > 0)
    if on_sale:
        query = query.filter(Product.discount_price.isnot(None), Product.discount_price < Product.price)
    if search:
        needle = f"%{search.strip()}%"
        # Match translated names too, so an EN search finds a product named only in SR.
        translated = (
            db.query(ProductTranslation.product_id)
            .filter(or_(ProductTranslation.name.ilike(needle), ProductTranslation.description.ilike(needle)))
            .scalar_subquery()
        )
        query = query.filter(
            or_(
                Product.name.ilike(needle),
                Product.description.ilike(needle),
                Product.brand.ilike(needle),
                Product.id.in_(translated),
            )
        )
    if size or color:
        query = query.join(Product.variants)
        if size:
            query = query.filter(ProductVariant.size.in_([v.strip() for v in size.split(",") if v.strip()]))
        if color:
            query = query.filter(ProductVariant.color.in_([v.strip() for v in color.split(",") if v.strip()]))
    return query


@router.get("")
def list_products(
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    brand: str | None = None,
    size: str | None = None,
    color: str | None = None,
    min_rating: float | None = None,
    in_stock: bool | None = None,
    on_sale: bool | None = None,
    featured: bool | None = None,
    sort: str | None = None,
    search: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=100),
    lang: str = "sr",
    db: Session = Depends(get_db),
):
    query = filtered_query(
        db,
        category=category,
        min_price=min_price,
        max_price=max_price,
        brand=brand,
        size=size,
        color=color,
        min_rating=min_rating,
        search=search,
        in_stock=in_stock,
        on_sale=on_sale,
    )
    if featured:
        query = query.filter(Product.is_featured.is_(True))
    price = func.coalesce(Product.discount_price, Product.price)
    sort_map = {
        "price_asc": (price.asc(),),
        "price_desc": (price.desc(),),
        "newest": (Product.created_at.desc(), Product.id.desc()),
        "rating": (Product.average_rating.desc(), Product.review_count.desc()),
        "popular": (Product.sales_count.desc(), Product.average_rating.desc()),
        "name_asc": (Product.name.asc(),),
    }
    query = query.distinct()
    total = query.count()
    # A stable tiebreaker keeps page 2 from repeating rows shown on page 1.
    items = query.order_by(*sort_map.get(sort or "newest", sort_map["newest"]), Product.id.asc())
    items = items.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [product_out(item, lang) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/search-suggestions")
def search_suggestions(q: str, lang: str = "sr", db: Session = Depends(get_db)):
    """Short autocomplete list: name plus enough context to click through."""
    if not q.strip():
        return []
    rows = (
        base_query(db)
        .filter(Product.status == ProductStatus.active)
        .filter(or_(Product.name.ilike(f"%{q}%"), Product.brand.ilike(f"%{q}%")))
        .order_by(Product.sales_count.desc())
        .limit(8)
        .all()
    )
    return [
        {
            "name": localized(item, lang, ("name",))["name"],
            "slug": item.slug,
            "brand": item.brand,
            "image_url": (
                media_url(sorted(item.images, key=lambda i: i.position)[0].image_url)
                if item.images
                else PLACEHOLDER_IMAGE
            ),
            "price": float(item.discount_price if item.discount_price is not None else item.price),
        }
        for item in rows
    ]


@router.get("/brands")
def brands(category: str | None = None, db: Session = Depends(get_db)):
    """Distinct brands, narrowed to a category subtree when one is given."""
    query = db.query(Product.brand).filter(Product.status == ProductStatus.active)
    if category:
        root = db.query(Category).filter_by(slug=category).first()
        if not root:
            return []
        query = query.filter(Product.category_id.in_(descendant_ids(db, root.id)))
    return [row[0] for row in query.distinct().order_by(Product.brand).all()]


@router.get("/facets")
def facets(category: str | None = None, search: str | None = None, db: Session = Depends(get_db)):
    """Everything the filter sidebar needs, scoped to the current category/search."""
    query = filtered_query(db, category=category, search=search)
    ids = [row[0] for row in query.with_entities(Product.id).distinct().all()]
    if not ids:
        return {"brands": [], "sizes": [], "colors": [], "min_price": 0, "max_price": 0}
    price = func.coalesce(Product.discount_price, Product.price)
    bounds = db.query(func.min(price), func.max(price)).filter(Product.id.in_(ids)).one()
    variant_rows = db.query(ProductVariant.size, ProductVariant.color).filter(ProductVariant.product_id.in_(ids)).all()
    brand_rows = (
        db.query(Product.brand, func.count(Product.id))
        .filter(Product.id.in_(ids))
        .group_by(Product.brand)
        .order_by(Product.brand)
        .all()
    )
    return {
        "brands": [{"value": row[0], "count": int(row[1])} for row in brand_rows],
        "sizes": sorted({row[0] for row in variant_rows if row[0]}),
        "colors": sorted({row[1] for row in variant_rows if row[1]}),
        "min_price": float(bounds[0] or 0),
        "max_price": float(bounds[1] or 0),
    }


@router.get("/{slug}")
def get_product(slug: str, lang: str = "sr", db: Session = Depends(get_db)):
    product = base_query(db).filter(Product.slug == slug).first()
    if not product or product.status != ProductStatus.active:
        raise HTTPException(404, "Product not found")
    return product_out(product, lang)


@router.get("/{product_id}/related")
def related(product_id: int, lang: str = "sr", db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    items = (
        base_query(db)
        .filter(
            Product.category_id == product.category_id,
            Product.id != product.id,
            Product.status == ProductStatus.active,
        )
        .order_by(Product.sales_count.desc(), Product.id.asc())
        .limit(8)
        .all()
    )
    if len(items) < 4 and product.category:
        # A thin subcategory borrows from its siblings so the rail never looks broken.
        parent_id = product.category.parent_category_id or product.category_id
        seen = {item.id for item in items} | {product.id}
        extra = (
            base_query(db)
            .filter(
                Product.category_id.in_(descendant_ids(db, parent_id)),
                Product.id.notin_(seen),
                Product.status == ProductStatus.active,
            )
            .order_by(Product.sales_count.desc())
            .limit(8 - len(items))
            .all()
        )
        items = items + extra
    return [product_out(item, lang) for item in items]


@router.post("", dependencies=[Depends(admin_user)], status_code=201)
def create_product(payload: ProductIn, db: Session = Depends(get_db)):
    if db.query(Product).filter_by(slug=payload.slug).first():
        raise HTTPException(400, "Slug already in use")
    if not db.get(Category, payload.category_id):
        raise HTTPException(400, "Category not found")
    product = Product(**payload.model_dump(exclude={"translations"}))
    db.add(product)
    db.flush()
    apply_translations(db, product, payload.translations)
    db.commit()
    db.refresh(product)
    return product_out(product)


@router.put("/{product_id}", dependencies=[Depends(admin_user)])
def update_product(product_id: int, payload: ProductIn, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    clash = db.query(Product).filter(Product.slug == payload.slug, Product.id != product_id).first()
    if clash:
        raise HTTPException(400, "Slug already in use")
    if not db.get(Category, payload.category_id):
        raise HTTPException(400, "Category not found")
    for key, value in payload.model_dump(exclude={"translations"}).items():
        setattr(product, key, value)
    apply_translations(db, product, payload.translations)
    db.commit()
    db.refresh(product)
    return product_out(product)


@router.delete("/{product_id}", dependencies=[Depends(admin_user)])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    # Orders keep a name snapshot, but the row itself is still referenced, so retire
    # the product instead of breaking order history.
    product.status = ProductStatus.inactive
    db.commit()
    return {"detail": "Product deactivated"}


@router.post("/{product_id}/images", dependencies=[Depends(admin_user)], status_code=201)
async def upload_image(product_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not db.get(Product, product_id):
        raise HTTPException(404, "Product not found")
    try:
        url = await storage.save_image(file)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    position = db.query(func.coalesce(func.max(ProductImage.position), -1)).filter_by(product_id=product_id).scalar()
    image = ProductImage(product_id=product_id, image_url=url, position=int(position) + 1)
    db.add(image)
    db.commit()
    return {"id": image.id, "image_url": media_url(image.image_url), "position": image.position}


@router.delete("/{product_id}/images/{image_id}", dependencies=[Depends(admin_user)])
def delete_image(product_id: int, image_id: int, db: Session = Depends(get_db)):
    image = db.query(ProductImage).filter_by(id=image_id, product_id=product_id).first()
    if not image:
        raise HTTPException(404, "Image not found")
    image_url = image.image_url
    db.delete(image)
    db.commit()
    # Drop the file too, or every removed image would linger in the media folder.
    storage.delete_image(image_url)
    return {"detail": "Image deleted"}


@router.post("/{product_id}/variants", dependencies=[Depends(admin_user)], status_code=201)
def create_variant(product_id: int, payload: VariantIn, db: Session = Depends(get_db)):
    if not db.get(Product, product_id):
        raise HTTPException(404, "Product not found")
    if db.query(ProductVariant).filter_by(sku=payload.sku).first():
        raise HTTPException(400, "SKU already in use")
    variant = ProductVariant(product_id=product_id, **payload.model_dump())
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant_out(variant)


@router.put("/{product_id}/variants/{variant_id}", dependencies=[Depends(admin_user)])
def update_variant(product_id: int, variant_id: int, payload: VariantIn, db: Session = Depends(get_db)):
    variant = db.query(ProductVariant).filter_by(id=variant_id, product_id=product_id).first()
    if not variant:
        raise HTTPException(404, "Variant not found")
    clash = db.query(ProductVariant).filter(ProductVariant.sku == payload.sku, ProductVariant.id != variant_id).first()
    if clash:
        raise HTTPException(400, "SKU already in use")
    for key, value in payload.model_dump().items():
        setattr(variant, key, value)
    db.commit()
    db.refresh(variant)
    return variant_out(variant)


@router.delete("/{product_id}/variants/{variant_id}", dependencies=[Depends(admin_user)])
def delete_variant(product_id: int, variant_id: int, db: Session = Depends(get_db)):
    variant = db.query(ProductVariant).filter_by(id=variant_id, product_id=product_id).first()
    if not variant:
        raise HTTPException(404, "Variant not found")
    db.delete(variant)
    db.commit()
    return {"detail": "Variant deleted"}


def update_average_rating(db: Session, product_id: int) -> None:
    """Recompute the cached rating and review count from approved reviews only."""
    row = (
        db.query(func.avg(Review.rating), func.count(Review.id))
        .filter(Review.product_id == product_id, Review.is_approved.is_(True))
        .one()
    )
    product = db.get(Product, product_id)
    if product:
        product.average_rating = round(float(row[0] or 0), 2)
        product.review_count = int(row[1] or 0)
