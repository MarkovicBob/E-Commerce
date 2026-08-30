"""Category tree helpers.

Categories nest arbitrarily deep, so "show me everything in Fashion" has to reach
subcategories too. These helpers resolve a category to its whole subtree once and
hand back plain id lists that the product query can filter on.
"""

from collections import defaultdict

from sqlalchemy.orm import Session

from app.models import Category


def children_map(db: Session) -> dict[int | None, list[Category]]:
    """All categories grouped by parent id, each group ordered by position then name."""
    grouped: dict[int | None, list[Category]] = defaultdict(list)
    for category in db.query(Category).order_by(Category.position, Category.name).all():
        grouped[category.parent_category_id].append(category)
    return grouped


def descendant_ids(db: Session, root_id: int) -> list[int]:
    """The category itself plus every category nested below it, at any depth."""
    grouped = children_map(db)
    collected = [root_id]
    queue = [root_id]
    while queue:
        current = queue.pop()
        for child in grouped.get(current, []):
            collected.append(child.id)
            queue.append(child.id)
    return collected


def ancestors(db: Session, category: Category) -> list[Category]:
    """Breadcrumb trail from the top-level category down to (but excluding) this one."""
    trail: list[Category] = []
    seen: set[int] = {category.id}
    parent_id = category.parent_category_id
    while parent_id and parent_id not in seen:
        parent = db.get(Category, parent_id)
        if not parent:
            break
        trail.append(parent)
        seen.add(parent.id)
        parent_id = parent.parent_category_id
    return list(reversed(trail))
