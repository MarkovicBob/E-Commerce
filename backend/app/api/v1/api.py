from fastapi import APIRouter

from app.api.v1.routers import admin, auth, blog, cart, categories, newsletter, orders, products, referrals, reviews, wishlist

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(cart.router, prefix="/cart", tags=["cart"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(wishlist.router, prefix="/wishlist", tags=["wishlist"])
api_router.include_router(reviews.router, tags=["reviews"])
api_router.include_router(referrals.router, prefix="/referrals", tags=["referrals"])
api_router.include_router(blog.router, prefix="/blog", tags=["blog"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(newsletter.router, prefix="/newsletter", tags=["newsletter"])
