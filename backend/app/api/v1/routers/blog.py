from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import BlogPost
from app.services.i18n import localized
from app.services.storage import media_url

router = APIRouter()


def blog_out(post: BlogPost, lang: str = "sr") -> dict:
    data = localized(post, lang, ("title", "excerpt", "content"))
    return {
        "id": post.id,
        "slug": post.slug,
        "cover_image_url": media_url(post.cover_image_url),
        "category": post.category,
        "published_at": post.published_at,
        "is_published": post.is_published,
        **data,
    }


@router.get("")
def list_blog(
    category: str | None = None,
    search: str | None = None,
    lang: str = "sr",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=9, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(BlogPost).options(selectinload(BlogPost.translations)).filter_by(is_published=True)
    if category:
        query = query.filter(BlogPost.category == category)
    if search:
        needle = f"%{search.strip()}%"
        query = query.filter(or_(BlogPost.title.ilike(needle), BlogPost.excerpt.ilike(needle)))
    total = query.count()
    items = (
        query.order_by(BlogPost.published_at.desc(), BlogPost.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [blog_out(item, lang) for item in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/categories")
def blog_categories(db: Session = Depends(get_db)):
    """Categories that actually have published posts, with counts for the filter chips."""
    rows = (
        db.query(BlogPost.category, func.count(BlogPost.id))
        .filter(BlogPost.is_published.is_(True))
        .group_by(BlogPost.category)
        .order_by(BlogPost.category)
        .all()
    )
    return [{"value": row[0], "count": int(row[1])} for row in rows]


@router.get("/{slug}")
def get_blog(slug: str, lang: str = "sr", db: Session = Depends(get_db)):
    post = (
        db.query(BlogPost)
        .options(selectinload(BlogPost.translations))
        .filter_by(slug=slug, is_published=True)
        .first()
    )
    if not post:
        raise HTTPException(404, "Blog post not found")
    related = (
        db.query(BlogPost)
        .options(selectinload(BlogPost.translations))
        .filter(BlogPost.category == post.category, BlogPost.id != post.id, BlogPost.is_published.is_(True))
        .order_by(BlogPost.published_at.desc())
        .limit(3)
        .all()
    )
    return {**blog_out(post, lang), "related": [blog_out(item, lang) for item in related]}
