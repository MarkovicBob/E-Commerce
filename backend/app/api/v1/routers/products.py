from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.v1.deps import admin_user
from app.db.session import get_db
from app.models import Product, ProductImage, ProductStatus, ProductVariant, Review
from app.services.i18n import localized
from app.services.storage import storage

router = APIRouter()


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


class VariantIn(BaseModel):
    size: str | None = None
    color: str | None = None
    sku: str
    stock_quantity: int = 0
    extra_price: float = 0


def product_out(product: Product, lang: str = "sr") -> dict:
    data = localized(product, lang, ("name", "description"))
    return {
        "id": product.id,
        "slug": product.slug,
        "price": float(product.price),
        "discount_price": float(product.discount_price) if product.discount_price is not None else None,
        "category_id": product.category_id,
        "brand": product.brand,
        "stock_quantity": product.stock_quantity,
        "status": product.status.value,
        "average_rating": float(product.average_rating or 0),
        "images": [{"id": img.id, "image_url": img.image_url, "position": img.position} for img in sorted(product.images, key=lambda i: i.position)],
        "variants": [variant_out(v) for v in product.variants],
        **data,
    }


def variant_out(variant: ProductVariant) -> dict:
    return {
        "id": variant.id,
        "size": variant.size,
        "color": variant.color,
        "sku": variant.sku,
        "stock_quantity": variant.stock_quantity,
        "extra_price": float(variant.extra_price or 0),
    }


@router.get("")
def list_products(
    category: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    brand: str | None = None,
    size: str | None = None,
    color: str | None = None,
    min_rating: float | None = None,
    sort: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 12,
    lang: str = "sr",
    db: Session = Depends(get_db),
):
    query = db.query(Product).filter(Product.status == ProductStatus.active)
    if category:
        query = query.join(Product.category).filter_by(slug=category)
    if brand:
        query = query.filter(Product.brand == brand)
    if min_price is not None:
        query = query.filter(func.coalesce(Product.discount_price, Product.price) >= min_price)
    if max_price is not None:
        query = query.filter(func.coalesce(Product.discount_price, Product.price) <= max_price)
    if min_rating is not None:
        query = query.filter(Product.average_rating >= min_rating)
    if search:
        needle = f"%{search}%"
        query = query.filter(or_(Product.name.ilike(needle), Product.description.ilike(needle), Product.brand.ilike(needle)))
    if size or color:
        query = query.join(Product.variants)
        if size:
            query = query.filter(ProductVariant.size == size)
        if color:
            query = query.filter(ProductVariant.color == color)
    sort_map = {
        "price_asc": func.coalesce(Product.discount_price, Product.price).asc(),
        "price_desc": func.coalesce(Product.discount_price, Product.price).desc(),
        "newest": Product.created_at.desc(),
        "rating": Product.average_rating.desc(),
        "popular": Product.average_rating.desc(),
    }
    query = query.order_by(sort_map.get(sort, Product.created_at.desc()))
    total = query.distinct().count()
    items = query.distinct().offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [product_out(item, lang) for item in items], "total": total, "page": page, "page_size": page_size}


@router.get("/search-suggestions")
def search_suggestions(q: str, db: Session = Depends(get_db)):
    rows = db.query(Product.name).filter(Product.name.ilike(f"%{q}%")).limit(8).all()
    return [row[0] for row in rows]


@router.get("/brands")
def brands(db: Session = Depends(get_db)):
    return [row[0] for row in db.query(Product.brand).distinct().order_by(Product.brand).all()]


@router.get("/{slug}")
def get_product(slug: str, lang: str = "sr", db: Session = Depends(get_db)):
    product = db.query(Product).filter_by(slug=slug).first()
    if not product:
        raise HTTPException(404, "Product not found")
    return product_out(product, lang)


@router.get("/{product_id}/related")
def related(product_id: int, lang: str = "sr", db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    items = db.query(Product).filter(Product.category_id == product.category_id, Product.id != product.id).limit(8).all()
    return [product_out(item, lang) for item in items]


@router.post("", dependencies=[Depends(admin_user)])
def create_product(payload: ProductIn, db: Session = Depends(get_db)):
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product_out(product)


@router.put("/{product_id}", dependencies=[Depends(admin_user)])
def update_product(product_id: int, payload: ProductIn, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    for key, value in payload.model_dump().items():
        setattr(product, key, value)
    db.commit()
    return product_out(product)


@router.delete("/{product_id}", dependencies=[Depends(admin_user)])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")
    db.delete(product)
    db.commit()
    return {"detail": "Product deleted"}


@router.post("/{product_id}/images", dependencies=[Depends(admin_user)])
async def upload_image(product_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not db.get(Product, product_id):
        raise HTTPException(404, "Product not found")
    try:
        url = await storage.save_image(file)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    image = ProductImage(product_id=product_id, image_url=url, position=db.query(ProductImage).filter_by(product_id=product_id).count())
    db.add(image)
    db.commit()
    return {"id": image.id, "image_url": image.image_url, "position": image.position}


@router.delete("/{product_id}/images/{image_id}", dependencies=[Depends(admin_user)])
def delete_image(product_id: int, image_id: int, db: Session = Depends(get_db)):
    image = db.query(ProductImage).filter_by(id=image_id, product_id=product_id).first()
    if not image:
        raise HTTPException(404, "Image not found")
    db.delete(image)
    db.commit()
    return {"detail": "Image deleted"}


@router.post("/{product_id}/variants", dependencies=[Depends(admin_user)])
def create_variant(product_id: int, payload: VariantIn, db: Session = Depends(get_db)):
    if not db.get(Product, product_id):
        raise HTTPException(404, "Product not found")
    variant = ProductVariant(product_id=product_id, **payload.model_dump())
    db.add(variant)
    db.commit()
    return variant_out(variant)


@router.put("/{product_id}/variants/{variant_id}", dependencies=[Depends(admin_user)])
def update_variant(product_id: int, variant_id: int, payload: VariantIn, db: Session = Depends(get_db)):
    variant = db.query(ProductVariant).filter_by(id=variant_id, product_id=product_id).first()
    if not variant:
        raise HTTPException(404, "Variant not found")
    for key, value in payload.model_dump().items():
        setattr(variant, key, value)
    db.commit()
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
    rating = db.query(func.avg(Review.rating)).filter_by(product_id=product_id, is_approved=True).scalar() or 0
    product = db.get(Product, product_id)
    if product:
        product.average_rating = round(float(rating), 2)
