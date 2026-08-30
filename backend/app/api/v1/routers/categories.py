from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.deps import admin_user
from app.db.session import get_db
from app.models import Category, CategoryTranslation, Product, ProductStatus
from app.services.catalog import ancestors, children_map, descendant_ids
from app.services.i18n import SUPPORTED_LANGS, localized
from app.services.storage import media_url

router = APIRouter()


class TranslationIn(BaseModel):
    language_code: str
    name: str
    description: str | None = None


class CategoryIn(BaseModel):
    name: str
    slug: str
    description: str | None = None
    image_url: str | None = None
    position: int = 0
    parent_category_id: int | None = None
    # None means "leave the existing translations alone"; an explicit [] clears them.
    # Without this distinction every admin edit would wipe the EN/DE names, since
    # the edit form does not carry the translation rows.
    translations: list[TranslationIn] | None = None


def active_product_counts(db: Session) -> dict[int, int]:
    """Active products per category, keyed by the category they sit in directly."""
    rows = (
        db.query(Product.category_id, func.count(Product.id))
        .filter(Product.status == ProductStatus.active)
        .group_by(Product.category_id)
        .all()
    )
    return {row[0]: int(row[1]) for row in rows}


def out(category: Category, lang: str = "sr") -> dict:
    data = localized(category, lang, ("name", "description"))
    return {
        "id": category.id,
        "slug": category.slug,
        "image_url": media_url(category.image_url),
        "position": category.position,
        "parent_category_id": category.parent_category_id,
        **data,
    }


def tree_out(
    category: Category,
    grouped: dict[int | None, list[Category]],
    counts: dict[int, int],
    lang: str,
) -> dict:
    """A category plus its whole subtree; `product_count` rolls the subtree up."""
    children = [tree_out(child, grouped, counts, lang) for child in grouped.get(category.id, [])]
    total = counts.get(category.id, 0) + sum(child["product_count"] for child in children)
    return {**out(category, lang), "children": children, "product_count": total}


def apply_translations(db: Session, category: Category, translations: list[TranslationIn] | None) -> None:
    """Replace the translation set, ignoring languages the app does not serve.

    A None payload is a no-op so a partial update keeps what is already stored.
    """
    if translations is None:
        return
    db.query(CategoryTranslation).filter_by(category_id=category.id).delete()
    for item in translations:
        if item.language_code in SUPPORTED_LANGS:
            db.add(
                CategoryTranslation(
                    category_id=category.id,
                    language_code=item.language_code,
                    name=item.name,
                    description=item.description,
                )
            )


@router.get("")
def list_categories(lang: str = "sr", tree: bool = False, db: Session = Depends(get_db)):
    """Flat list by default; `tree=true` returns only roots, each with nested children."""
    grouped = children_map(db)
    if tree:
        counts = active_product_counts(db)
        return [tree_out(root, grouped, counts, lang) for root in grouped.get(None, [])]
    return [out(item, lang) for group in grouped.values() for item in group]


@router.get("/{slug}")
def get_category(slug: str, lang: str = "sr", db: Session = Depends(get_db)):
    category = db.query(Category).filter_by(slug=slug).first()
    if not category:
        raise HTTPException(404, "Category not found")
    grouped = children_map(db)
    counts = active_product_counts(db)
    subtree = descendant_ids(db, category.id)
    return {
        **out(category, lang),
        "breadcrumb": [out(item, lang) for item in ancestors(db, category)],
        "children": [out(child, lang) for child in grouped.get(category.id, [])],
        "product_count": sum(counts.get(cid, 0) for cid in subtree),
    }


@router.post("", dependencies=[Depends(admin_user)], status_code=201)
def create_category(payload: CategoryIn, db: Session = Depends(get_db)):
    if db.query(Category).filter_by(slug=payload.slug).first():
        raise HTTPException(400, "Slug already in use")
    body = payload.model_dump(exclude={"translations"})
    category = Category(**body)
    db.add(category)
    db.flush()
    apply_translations(db, category, payload.translations)
    db.commit()
    db.refresh(category)
    return out(category)


@router.put("/{category_id}", dependencies=[Depends(admin_user)])
def update_category(category_id: int, payload: CategoryIn, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(404, "Category not found")
    clash = db.query(Category).filter(Category.slug == payload.slug, Category.id != category_id).first()
    if clash:
        raise HTTPException(400, "Slug already in use")
    if payload.parent_category_id is not None:
        if payload.parent_category_id == category_id:
            raise HTTPException(400, "A category cannot be its own parent")
        # Re-parenting under one of its own descendants would orphan the branch into a cycle.
        if payload.parent_category_id in descendant_ids(db, category_id):
            raise HTTPException(400, "Cannot move a category under its own descendant")
    for key, value in payload.model_dump(exclude={"translations"}).items():
        setattr(category, key, value)
    apply_translations(db, category, payload.translations)
    db.commit()
    db.refresh(category)
    return out(category)


@router.delete("/{category_id}", dependencies=[Depends(admin_user)])
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(404, "Category not found")
    if db.query(Category).filter_by(parent_category_id=category_id).count():
        raise HTTPException(400, "Move or delete the subcategories first")
    if db.query(Product).filter_by(category_id=category_id).count():
        raise HTTPException(400, "Move or delete the products in this category first")
    db.delete(category)
    db.commit()
    return {"detail": "Category deleted"}
