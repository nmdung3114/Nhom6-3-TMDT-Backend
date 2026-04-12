from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, date
from typing import Optional
from decimal import Decimal
from app.core.timezone import now_vn
from app.database import get_db
from app.schemas.user import UserResponse, UserAdminUpdate, UserListResponse
from app.schemas.product import ProductCreate, ProductUpdate, ProductsListResponse, ProductListResponse
from app.schemas.order import OrderResponse, OrderItemResponse, PaymentResponse, OrdersListResponse, AdminStatsResponse
from app.schemas.cart import CartItemResponse
from app.models.user import User
from app.models.product import Product, Category, Course, Ebook, Module, Lesson, Review
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
    today_vn = now_vn().date()
    today = datetime.combine(today_vn, datetime.min.time())
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
    period: str = None,   # 'week' | 'month' | 'year' | None
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Doanh thu theo ngày. Hỗ trợ period=week|month|year hoặc days=N."""
    from datetime import timedelta
    from calendar import monthrange
    from app.models.order import Payment

    today = now_vn().date()
    result = []

    if period == 'week':
        # Current week (Mon – today)
        start_of_week = today - timedelta(days=today.weekday())
        num_days = (today - start_of_week).days + 1
        for i in range(num_days):
            day = start_of_week + timedelta(days=i)
            start = datetime.combine(day, datetime.min.time())
            end   = datetime.combine(day, datetime.max.time())
            revenue = db.query(func.sum(Payment.amount)).filter(
                Payment.status == "success",
                Payment.paid_at >= start,
                Payment.paid_at <= end,
            ).scalar() or Decimal("0")
            result.append({"date": day.strftime("%d/%m"), "revenue": float(revenue)})

    elif period == 'month':
        # Group by week of the current month
        first_day = today.replace(day=1)
        _, last_day_num = monthrange(today.year, today.month)
        last_day = today.replace(day=last_day_num)
        week_start = first_day
        week_num = 1
        while week_start <= today:
            week_end = min(week_start + timedelta(days=6), today)
            start = datetime.combine(week_start, datetime.min.time())
            end   = datetime.combine(week_end, datetime.max.time())
            revenue = db.query(func.sum(Payment.amount)).filter(
                Payment.status == "success",
                Payment.paid_at >= start,
                Payment.paid_at <= end,
            ).scalar() or Decimal("0")
            result.append({
                "date": f"Tuần {week_num} ({week_start.strftime('%d/%m')}–{week_end.strftime('%d/%m')})",
                "revenue": float(revenue)
            })
            week_start += timedelta(days=7)
            week_num += 1

    elif period == 'year':
        # Group by month of the current year
        for m in range(1, today.month + 1):
            _, last_d = monthrange(today.year, m)
            start = datetime.combine(date(today.year, m, 1), datetime.min.time())
            end   = datetime.combine(date(today.year, m, last_d), datetime.max.time())
            revenue = db.query(func.sum(Payment.amount)).filter(
                Payment.status == "success",
                Payment.paid_at >= start,
                Payment.paid_at <= end,
            ).scalar() or Decimal("0")
            result.append({
                "date": f"Tháng {m}/{today.year}",
                "revenue": float(revenue)
            })

    else:
        # Default: by day
        num_days = min(max(days, 7), 90)
        for i in range(num_days - 1, -1, -1):
            day = today - timedelta(days=i)
            start = datetime.combine(day, datetime.min.time())
            end   = datetime.combine(day, datetime.max.time())
            revenue = db.query(func.sum(Payment.amount)).filter(
                Payment.status == "success",
                Payment.paid_at >= start,
                Payment.paid_at <= end,
            ).scalar() or Decimal("0")
            result.append({"date": day.strftime("%d/%m"), "revenue": float(revenue)})

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
    query = db.query(Product).options(
        joinedload(Product.category), 
        joinedload(Product.author),
        joinedload(Product.course)
    )
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
        if p.product_type == "course" and p.course:
            item.level = p.course.level
            item.duration = p.course.duration
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
    product = db.query(Product).options(
        joinedload(Product.course), joinedload(Product.ebook)
    ).filter(Product.product_id == product_id).first()
    if not product:
        raise NotFoundException("Sản phẩm không tồn tại")
    
    update_data = data.model_dump(exclude_none=True)
    product_fields = ["name", "price", "original_price", "description", "short_description", "thumbnail_url", "status", "category_id"]
    course_fields = ["duration", "level", "requirements", "what_you_learn"]
    ebook_fields = ["file_size", "format", "page_count"]

    for field, value in update_data.items():
        if field in product_fields:
            setattr(product, field, value)
        elif field in course_fields and product.product_type == "course" and product.course:
            setattr(product.course, field, value)
        elif field in ebook_fields and product.product_type == "ebook" and product.ebook:
            setattr(product.ebook, field, value)

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
    return {"message": "Sản phẩm đã được ẩn (archived)"}


@router.delete("/products/{product_id}/hard")
def hard_delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    from app.models.cart import CartItem
    from app.models.wishlist import Wishlist
    
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise NotFoundException("Sản phẩm không tồn tại")
    
    # Check if there are orders
    if db.query(OrderItem).filter(OrderItem.product_id == product_id).first():
        raise BadRequestException("Không thể xóa hẳn vì sản phẩm này đã có lượt mua. Vui lòng dùng chức năng 'Ẩn'.")
        
    # Delete dependent things manually
    db.query(CartItem).filter(CartItem.product_id == product_id).delete()
    db.query(Wishlist).filter(Wishlist.product_id == product_id).delete()
    db.query(Review).filter(Review.product_id == product_id).delete()
    db.query(UserAccess).filter(UserAccess.product_id == product_id).delete()

    if product.product_type == "course":
        course = db.query(Course).filter(Course.product_id == product_id).first()
        if course:
            modules = db.query(Module).filter(Module.course_id == product_id).all()
            for m in modules:
                db.query(Lesson).filter(Lesson.module_id == m.module_id).delete()
            db.query(Module).filter(Module.course_id == product_id).delete()
            db.query(Course).filter(Course.product_id == product_id).delete()
    elif product.product_type == "ebook":
        db.query(Ebook).filter(Ebook.product_id == product_id).delete()

    db.delete(product)
    db.commit()
    return {"message": "Sản phẩm đã bị xóa vĩnh viễn khỏi hệ thống"}


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
            user_name=o.user.name if o.user else None,
            user_email=o.user.email if o.user else None,
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
            access.revoked_at = now_vn()

    # Thông báo user + admin
    from app.services.notification_service import notify_refund_completed
    notify_refund_completed(
        db,
        order_id=order_id,
        user_id=order.user_id,
        amount=float(order.total_amount),
    )

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
    coupons = db.query(Coupon).order_by(Coupon.code).all()
    result = []
    for c in coupons:
        result.append({
            "code": c.code,
            "discount": float(c.discount),
            "discount_type": c.discount_type,
            "min_order_amount": float(c.min_order_amount or 0),
            "usage_limit": c.usage_limit,
            "used_count": c.used_count or 0,
            "is_active": c.is_active,
            "expired_date": c.expired_date.isoformat() if c.expired_date else None,
        })
    return result


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


@router.delete("/coupons/{code}")
def delete_coupon(
    code: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Xóa coupon theo code (primary key natural)."""
    coupon = db.query(Coupon).filter(Coupon.code == code).first()
    if not coupon:
        raise NotFoundException("Coupon không tồn tại")
    db.delete(coupon)
    db.commit()
    return {"message": "Đã xóa coupon"}


# ── Course Content (Module + Lesson) Management ───────────
@router.get("/courses/{product_id}/content")
def get_course_content_admin(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Lấy toàn bộ nội dung khóa học (modules + lessons) cho admin."""
    from sqlalchemy.orm import joinedload
    product = db.query(Product).options(
        joinedload(Product.course).joinedload(Course.modules).joinedload(Module.lessons)
    ).filter(Product.product_id == product_id, Product.product_type == "course").first()
    if not product or not product.course:
        raise NotFoundException("Khóa học không tồn tại")

    modules = []
    for m in sorted(product.course.modules, key=lambda x: x.sort_order):
        lessons = []
        for l in sorted(m.lessons, key=lambda x: x.sort_order):
            lessons.append({
                "lesson_id": l.lesson_id,
                "title": l.title,
                "mux_playback_id": l.mux_playback_id or "",
                "mux_asset_id": l.mux_asset_id or "",
                "duration": l.duration,
                "sort_order": l.sort_order,
                "is_preview": l.is_preview,
            })
        modules.append({
            "module_id": m.module_id,
            "title": m.title,
            "sort_order": m.sort_order,
            "lessons": lessons,
        })
    return {
        "product_id": product_id,
        "name": product.name,
        "total_lessons": product.course.total_lessons or 0,
        "modules": modules,
    }


@router.post("/courses/{product_id}/modules")
def create_module(
    product_id: int,
    title: str,
    sort_order: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Tạo module mới cho khóa học."""
    course = db.query(Course).filter(Course.product_id == product_id).first()
    if not course:
        raise NotFoundException("Khóa học không tồn tại")
    module = Module(course_id=product_id, title=title, sort_order=sort_order)
    db.add(module)
    db.commit()
    db.refresh(module)
    return {"module_id": module.module_id, "title": module.title, "sort_order": module.sort_order}


@router.put("/modules/{module_id}")
def update_module(
    module_id: int,
    title: Optional[str] = None,
    sort_order: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Sửa thông tin module."""
    module = db.query(Module).filter(Module.module_id == module_id).first()
    if not module:
        raise NotFoundException("Module không tồn tại")
    if title is not None:
        module.title = title
    if sort_order is not None:
        module.sort_order = sort_order
    db.commit()
    return {"message": "Cập nhật module thành công"}


@router.delete("/modules/{module_id}")
def delete_module(
    module_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Xóa module và toàn bộ lessons trong đó."""
    module = db.query(Module).filter(Module.module_id == module_id).first()
    if not module:
        raise NotFoundException("Module không tồn tại")
    course_id = module.course_id
    # Delete lessons first (cascade)
    db.query(Lesson).filter(Lesson.module_id == module_id).delete()
    db.delete(module)
    db.commit()
    # Recalculate total_lessons
    _recalc_total_lessons(db, course_id)
    return {"message": "Đã xóa module"}


@router.post("/modules/{module_id}/lessons")
def create_lesson(
    module_id: int,
    title: str,
    mux_playback_id: str = "",
    mux_asset_id: str = "",
    duration: int = 0,
    sort_order: int = 0,
    is_preview: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Thêm bài học mới vào module (kèm Mux Playback ID)."""
    module = db.query(Module).filter(Module.module_id == module_id).first()
    if not module:
        raise NotFoundException("Module không tồn tại")
    lesson = Lesson(
        module_id=module_id, title=title,
        mux_playback_id=mux_playback_id or None,
        mux_asset_id=mux_asset_id or None,
        duration=duration, sort_order=sort_order, is_preview=is_preview,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    # Update total_lessons count
    _recalc_total_lessons(db, module.course_id)
    return {
        "lesson_id": lesson.lesson_id,
        "title": lesson.title,
        "mux_playback_id": lesson.mux_playback_id or "",
        "duration": lesson.duration,
        "sort_order": lesson.sort_order,
        "is_preview": lesson.is_preview,
    }


@router.put("/lessons/{lesson_id}")
def update_lesson(
    lesson_id: int,
    title: Optional[str] = None,
    mux_playback_id: Optional[str] = None,
    mux_asset_id: Optional[str] = None,
    duration: Optional[int] = None,
    sort_order: Optional[int] = None,
    is_preview: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Cập nhật thông tin bài học (bao gồm Mux Playback ID)."""
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if not lesson:
        raise NotFoundException("Bài học không tồn tại")
    if title is not None:
        lesson.title = title
    if mux_playback_id is not None:
        lesson.mux_playback_id = mux_playback_id or None
    if mux_asset_id is not None:
        lesson.mux_asset_id = mux_asset_id or None
    if duration is not None:
        lesson.duration = duration
    if sort_order is not None:
        lesson.sort_order = sort_order
    if is_preview is not None:
        lesson.is_preview = is_preview
    db.commit()
    return {
        "lesson_id": lesson.lesson_id,
        "title": lesson.title,
        "mux_playback_id": lesson.mux_playback_id or "",
        "duration": lesson.duration,
    }


@router.delete("/lessons/{lesson_id}")
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Xóa bài học."""
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if not lesson:
        raise NotFoundException("Bài học không tồn tại")
    module = lesson.module
    db.delete(lesson)
    db.commit()
    if module:
        _recalc_total_lessons(db, module.course_id)
    return {"message": "Đã xóa bài học"}


def _recalc_total_lessons(db: Session, course_id: int):
    """Cập nhật lại tổng số bài học của khóa học."""
    count = db.query(Lesson).join(Module).filter(Module.course_id == course_id).count()
    course = db.query(Course).filter(Course.product_id == course_id).first()
    if course:
        course.total_lessons = count
        db.commit()

