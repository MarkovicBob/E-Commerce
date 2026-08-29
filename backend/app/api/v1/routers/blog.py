from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import BlogPost
from app.services.i18n import localized

router = APIRouter()


def blog_out(post: BlogPost, lang: str = "sr") -> dict:
    data = localized(post, lang, ("title", "excerpt", "content"))
    return {
        "id": post.id,
        "slug": post.slug,
        "cover_image_url": post.cover_image_url,
        "category": post.category,
        "published_at": post.published_at,
        "is_published": post.is_published,
        **data,
    }


@router.get("")
def list_blog(category: str | None = None, lang: str = "sr", page: int = Query(default=1, ge=1), page_size: int = Query(default=12, ge=1, le=100), db: Session = Depends(get_db)):
    query = db.query(BlogPost).filter_by(is_published=True)
    if category:
        query = query.filter_by(category=category)
    total = query.count()
    items = query.order_by(BlogPost.published_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [blog_out(item, lang) for item in items], "total": total, "page": page, "page_size": page_size}


@router.get("/{slug}")
def get_blog(slug: str, lang: str = "sr", db: Session = Depends(get_db)):
    post = db.query(BlogPost).filter_by(slug=slug, is_published=True).first()
    if not post:
        raise HTTPException(404, "Blog post not found")
    return blog_out(post, lang)
