from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, date
from typing import Optional
from decimal import Decimal
from app.database import get_db
from app.schemas.user import UserResponse, UserAdminUpdate, UserListResponse
from app.schemas.product import ProductCreate, ProductUpdate, ProductsListResponse, ProductListResponse
from app.schemas.order import OrderResponse, OrderItemResponse, PaymentResponse, OrdersListResponse, AdminStatsResponse
from app.schemas.cart import CartItemResponse
from app.models.user import User
from app.models.product import Product, Category, Course, Ebook, Module, Lesson
from app.models.order import Order, OrderItem, Payment, Coupon, UserAccess
from app.core.exceptions import NotFoundException, BadRequestException, ConflictException
from app.dependencies import require_admin
from app.services.payment_service import revoke_access

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ── Stats ──────────────────────────────────────────────────
@router.get("/stats", response_model=AdminStatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    today = datetime.combine(date.today(), datetime.min.time())
    total_users = db.query(User).count()
    total_products = db.query(Product).filter(Product.status == "active").count()
    total_orders = db.query(Order).count()
    total_revenue = db.query(func.sum(Payment.amount)).filter(Payment.status == "success").scalar() or Decimal("0")
    pending_orders = db.query(Order).filter(Order.status == "pending").count()
    paid_orders = db.query(Order).filter(Order.status == "paid").count()
    new_users_today = db.query(User).filter(User.created_at >= today).count()
    revenue_today = db.query(func.sum(Payment.amount)).filter(
        Payment.status == "success", Payment.paid_at >= today
    ).scalar() or Decimal("0")

    return AdminStatsResponse(
        total_users=total_users, total_products=total_products,
        total_orders=total_orders, total_revenue=total_revenue,
        pending_orders=pending_orders, paid_orders=paid_orders,
        new_users_today=new_users_today, revenue_today=revenue_today,
    )


@router.get("/stats/revenue-chart")
def revenue_chart(
    days: int = 7,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Doanh thu theo ngày (7 hoặc 30 ngày)."""
    from datetime import timedelta
    from app.models.order import Payment
    days = min(max(days, 7), 30)
    result = []
    for i in range(days - 1, -1, -1):
        day = date.today() - timedelta(days=i)
        start = datetime.combine(day, datetime.min.time())
        end = datetime.combine(day, datetime.max.time())
        revenue = db.query(func.sum(Payment.amount)).filter(
            Payment.status == "success",
            Payment.paid_at >= start,
            Payment.paid_at <= end,
        ).scalar() or Decimal("0")
        result.append({
            "date": day.strftime("%d/%m"),
            "revenue": float(revenue),
        })
    return result


@router.get("/stats/top-products")
def top_products(
    limit: int = 5,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Top sản phẩm theo số học viên."""
    from app.models.product import Product
    products = db.query(Product).filter(
        Product.status == "active"
    ).order_by(Product.total_enrolled.desc()).limit(limit).all()
    return [
        {
            "product_id": p.product_id,
            "name": p.name,
            "total_enrolled": p.total_enrolled or 0,
            "average_rating": float(p.average_rating or 0),
            "product_type": p.product_type,
        }
        for p in products
    ]



# ── Users ──────────────────────────────────────────────────
@router.get("/users", response_model=UserListResponse)
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(User)
    if search:
        query = query.filter((User.name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%")))
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return UserListResponse(
        users=[UserResponse.model_validate(u) for u in users],
        total=total, page=page, page_size=page_size,
    )


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserAdminUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise NotFoundException("Người dùng không tồn tại")
    if data.name:
        user.name = data.name
    if data.role:
        if data.role not in ("learner", "admin", "author"):
            raise BadRequestException("Role không hợp lệ")
        user.role = data.role
    if data.status:
        if data.status not in ("active", "suspended"):
            raise BadRequestException("Status không hợp lệ")
        user.status = data.status
    if data.phone is not None:
        user.phone = data.phone
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise NotFoundException("Người dùng không tồn tại")
    user.status = "suspended"
    db.commit()
    return {"message": "Tài khoản đã bị vô hiệu hóa"}


# ── Products ──────────────────────────────────────────────
@router.get("/products", response_model=ProductsListResponse)
def admin_list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    product_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(Product).options(joinedload(Product.category), joinedload(Product.author))
    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    if product_type:
        query = query.filter(Product.product_type == product_type)
    if status:
        query = query.filter(Product.status == status)
    total = query.count()
    products = query.order_by(Product.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for p in products:
        item = ProductListResponse(
            product_id=p.product_id, name=p.name, price=p.price,
            original_price=p.original_price, thumbnail_url=p.thumbnail_url,
            product_type=p.product_type, status=p.status,
            average_rating=p.average_rating, review_count=p.review_count,
            total_enrolled=p.total_enrolled,
            category=p.category, author_name=p.author.name if p.author else None,
        )
        result.append(item)
    return ProductsListResponse(products=result, total=total, page=page, page_size=page_size)


@router.post("/products", response_model=ProductListResponse)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if data.product_type not in ("course", "ebook"):
        raise BadRequestException("product_type phải là 'course' hoặc 'ebook'")
    product = Product(
        category_id=data.category_id, name=data.name,
        price=data.price, original_price=data.original_price,
        description=data.description, short_description=data.short_description,
        thumbnail_url=data.thumbnail_url, status=data.status,
        product_type=data.product_type, author_id=admin.user_id,
    )
    db.add(product)
    db.flush()
    if data.product_type == "course":
        course = Course(
            product_id=product.product_id, duration=data.duration or 0,
            level=data.level, requirements=data.requirements,
            what_you_learn=data.what_you_learn,
        )
        db.add(course)
    else:
        ebook = Ebook(
            product_id=product.product_id, file_size=data.file_size,
            format=data.format, page_count=data.page_count,
        )
        db.add(ebook)
    db.commit()
    db.refresh(product)
    return ProductListResponse(
        product_id=product.product_id, name=product.name,
        price=product.price, original_price=product.original_price,
        thumbnail_url=product.thumbnail_url, product_type=product.product_type,
        status=product.status, average_rating=product.average_rating,
        review_count=product.review_count, total_enrolled=product.total_enrolled,
    )


@router.put("/products/{product_id}", response_model=ProductListResponse)
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise NotFoundException("Sản phẩm không tồn tại")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return ProductListResponse(
        product_id=product.product_id, name=product.name,
        price=product.price, original_price=product.original_price,
        thumbnail_url=product.thumbnail_url, product_type=product.product_type,
        status=product.status, average_rating=product.average_rating,
        review_count=product.review_count, total_enrolled=product.total_enrolled,
    )


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise NotFoundException("Sản phẩm không tồn tại")
    product.status = "archived"
    db.commit()
    return {"message": "Sản phẩm đã được ẩn"}


# ── Orders ─────────────────────────────────────────────────
@router.get("/orders", response_model=OrdersListResponse)
def admin_list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(Order).options(
        joinedload(Order.items).joinedload(OrderItem.product),
        joinedload(Order.payment),
        joinedload(Order.user),
    )
    if status:
        query = query.filter(Order.status == status)
    if user_id:
        query = query.filter(Order.user_id == user_id)
    total = query.count()
    orders = query.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    orders_resp = []
    for o in orders:
        items_resp = [
            OrderItemResponse(
                order_item_id=i.order_item_id, product_id=i.product_id,
                product_name=i.product.name if i.product else None,
                product_thumbnail=i.product.thumbnail_url if i.product else None,
                product_type=i.product.product_type if i.product else None,
                quantity=i.quantity, price=i.price,
            ) for i in o.items
        ]
        payment_resp = PaymentResponse(
            payment_id=o.payment.payment_id, method=o.payment.method,
            status=o.payment.status, transaction_id=o.payment.transaction_id,
            paid_at=o.payment.paid_at, amount=o.payment.amount,
        ) if o.payment else None
        orders_resp.append(OrderResponse(
            order_id=o.order_id, user_id=o.user_id,
            coupon_code=o.coupon_code, subtotal=o.subtotal,
            discount_amount=o.discount_amount, total_amount=o.total_amount,
            status=o.status, created_at=o.created_at,
            items=items_resp, payment=payment_resp,
        ))
    return OrdersListResponse(orders=orders_resp, total=total, page=page, page_size=page_size)


@router.post("/orders/{order_id}/refund")
def refund_order(
    order_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise NotFoundException("Đơn hàng không tồn tại")
    if order.status != "paid":
        raise BadRequestException("Chỉ có thể hoàn tiền đơn hàng đã thanh toán")
    order.status = "refunded"
    if order.payment:
        order.payment.status = "refunded"
    # Revoke access to all products
    for item in order.items:
        access = db.query(UserAccess).filter(
            UserAccess.user_id == order.user_id,
            UserAccess.product_id == item.product_id,
        ).first()
        if access:
            access.is_active = False
            access.revoked_at = datetime.now()
    db.commit()
    return {"message": "Hoàn tiền và thu hồi quyền truy cập thành công"}


@router.post("/access/revoke/{user_id}/{product_id}")
def admin_revoke_access(
    user_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    revoke_access(db, user_id, product_id)
    return {"message": "Thu hồi quyền truy cập thành công"}


# ── Categories ─────────────────────────────────────────────
@router.post("/categories")
def create_category(
    name: str,
    description: Optional[str] = None,
    icon: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    existing = db.query(Category).filter(Category.name == name).first()
    if existing:
        raise ConflictException("Danh mục đã tồn tại")
    cat = Category(name=name, description=description, icon=icon)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# ── Coupons ────────────────────────────────────────────────
@router.get("/coupons")
def list_coupons(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(Coupon).all()


@router.post("/coupons")
def create_coupon(
    code: str, discount: float, discount_type: str = "fixed",
    expired_date: Optional[datetime] = None, usage_limit: Optional[int] = None,
    min_order_amount: float = 0,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    existing = db.query(Coupon).filter(Coupon.code == code).first()
    if existing:
        raise ConflictException("Mã coupon đã tồn tại")
    coupon = Coupon(
        code=code, discount=Decimal(str(discount)), discount_type=discount_type,
        expired_date=expired_date, usage_limit=usage_limit,
        min_order_amount=Decimal(str(min_order_amount)),
    )
    db.add(coupon)
    db.commit()
    return {"message": "Tạo coupon thành công", "code": code}
