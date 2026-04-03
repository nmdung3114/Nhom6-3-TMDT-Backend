from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.products import router as products_router
from app.routers.cart import router as cart_router
from app.routers.orders import router as orders_router
from app.routers.learning import router as learning_router
from app.routers.payment import router as payment_router
from app.routers.admin import router as admin_router

__all__ = [
    "auth_router", "users_router", "products_router", "cart_router",
    "orders_router", "learning_router", "payment_router", "admin_router",
]
