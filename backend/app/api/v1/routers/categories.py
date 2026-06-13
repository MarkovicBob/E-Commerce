from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.deps import admin_user
from app.db.session import get_db
from app.models import Category
from app.services.i18n import localized

router = APIRouter()


class CategoryIn(BaseModel):
    name: str
    slug: str
    image_url: str | None = None
    parent_category_id: int | None = None


def out(category: Category, lang: str = "sr") -> dict:
    data = localized(category, lang, ("name",))
    return {"id": category.id, "slug": category.slug, "image_url": category.image_url, "parent_category_id": category.parent_category_id, **data}


@router.get("")
def list_categories(lang: str = "sr", db: Session = Depends(get_db)):
    return [out(item, lang) for item in db.query(Category).all()]


@router.get("/{slug}")
def get_category(slug: str, lang: str = "sr", db: Session = Depends(get_db)):
    category = db.query(Category).filter_by(slug=slug).first()
    if not category:
        raise HTTPException(404, "Category not found")
    return out(category, lang)


@router.post("", dependencies=[Depends(admin_user)])
def create_category(payload: CategoryIn, db: Session = Depends(get_db)):
    category = Category(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return out(category)


@router.put("/{category_id}", dependencies=[Depends(admin_user)])
def update_category(category_id: int, payload: CategoryIn, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(404, "Category not found")
    for key, value in payload.model_dump().items():
        setattr(category, key, value)
    db.commit()
    return out(category)


@router.delete("/{category_id}", dependencies=[Depends(admin_user)])
def delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(404, "Category not found")
    db.delete(category)
    db.commit()
    return {"detail": "Category deleted"}
