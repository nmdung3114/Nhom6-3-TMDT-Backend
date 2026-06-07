"""
instructor.py
API dành riêng cho Tác giả (role='author').
Tất cả endpoints yêu cầu role author hoặc admin.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from decimal import Decimal
from app.database import get_db
from app.models.user import User
from app.models.product import Product, Course, Ebook, Module, Lesson
from app.schemas.product import (
    ProductCreate, ProductUpdate, ProductListResponse, ProductsListResponse
)
from app.core.exceptions import NotFoundException, BadRequestException, ForbiddenException
from app.dependencies import get_current_user, require_author_or_admin

router = APIRouter(prefix="/api/instructor", tags=["instructor"])

# ── Helpers ────────────────────────────────────────────────

EDITABLE_STATUSES = {"draft", "rejected"}
CONTENT_CHANGE_TRIGGERS_REVIEW = True  # Cập nhật khóa active → pending_approval


def _recalc_total_lessons(db: Session, course_id: int):
    count = db.query(Lesson).join(Module).filter(Module.course_id == course_id).count()
    course = db.query(Course).filter(Course.product_id == course_id).first()
    if course:
        course.total_lessons = count
        db.commit()


def _assert_owner(product: Product, current_user: User):
    """Chỉ tác giả sở hữu hoặc admin mới được thao tác."""
    if current_user.role == "admin":
        return
    if product.author_id != current_user.user_id:
        raise ForbiddenException("Bạn không có quyền thao tác khóa học này")


def _assert_editable(product: Product):
    """Chỉ cho sửa khi status là draft hoặc rejected."""
    if product.status not in EDITABLE_STATUSES:
        raise BadRequestException(
            f"Không thể chỉnh sửa khóa học đang ở trạng thái '{product.status}'. "
            "Hãy gửi cập nhật – hệ thống sẽ đưa về chờ duyệt."
        )


def _build_list_item(p: Product) -> ProductListResponse:
    item = ProductListResponse(
        product_id=p.product_id, name=p.name, price=p.price,
        original_price=p.original_price, thumbnail_url=p.thumbnail_url,
        product_type=p.product_type, status=p.status,
        average_rating=p.average_rating, review_count=p.review_count,
        total_enrolled=p.total_enrolled,
        category=p.category,
        author_name=p.author.name if p.author else None,
    )
    if p.product_type == "course" and p.course:
        item.level = p.course.level
        item.duration = p.course.duration
    return item


# ── Courses ────────────────────────────────────────────────

@router.get("/courses", response_model=ProductsListResponse)
def instructor_list_courses(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    """Lấy danh sách tất cả khóa học của tác giả đang đăng nhập (mọi status)."""
    query = db.query(Product).options(
        joinedload(Product.category),
        joinedload(Product.author),
        joinedload(Product.course),
    )
    # Admin thấy tất cả; Author chỉ thấy của mình
    if current_user.role == "author":
        query = query.filter(Product.author_id == current_user.user_id)
    if status:
        query = query.filter(Product.status == status)

    total = query.count()
    products = query.order_by(Product.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    return ProductsListResponse(
        products=[_build_list_item(p) for p in products],
        total=total, page=page, page_size=page_size,
    )


@router.post("/courses", response_model=ProductListResponse)
def instructor_create_course(
    data: ProductCreate,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    """Tạo khóa học mới dưới dạng Nháp (draft)."""
    if data.product_type not in ("course", "ebook"):
        raise BadRequestException("product_type phải là 'course' hoặc 'ebook'")

    product = Product(
        category_id=data.category_id, name=data.name,
        price=data.price, original_price=data.original_price,
        description=data.description, short_description=data.short_description,
        thumbnail_url=data.thumbnail_url,
        status="draft",  # Luôn tạo ở trạng thái Nháp
        product_type=data.product_type,
        author_id=current_user.user_id,
    )
    db.add(product)
    db.flush()

    if data.product_type == "course":
        db.add(Course(
            product_id=product.product_id, duration=data.duration or 0,
            level=data.level, requirements=data.requirements,
            what_you_learn=data.what_you_learn,
        ))
    else:
        db.add(Ebook(
            product_id=product.product_id, file_size=data.file_size,
            format=data.format, page_count=data.page_count,
        ))
    db.commit()
    db.refresh(product)
    return _build_list_item(product)


@router.get("/courses/{product_id}")
def instructor_get_course(
    product_id: int,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    """Lấy chi tiết khóa học kèm toàn bộ modules/lessons."""
    product = db.query(Product).options(
        joinedload(Product.category),
        joinedload(Product.author),
        joinedload(Product.course).joinedload(Course.modules).joinedload(Module.lessons),
        joinedload(Product.ebook),
    ).filter(Product.product_id == product_id).first()

    if not product:
        raise NotFoundException("Khóa học không tồn tại")
    _assert_owner(product, current_user)

    modules = []
    if product.course:
        for m in sorted(product.course.modules, key=lambda x: x.sort_order):
            lessons = [
                {
                    "lesson_id": l.lesson_id, "title": l.title,
                    "mux_playback_id": l.mux_playback_id or "",
                    "mux_asset_id": l.mux_asset_id or "",
                    "duration": l.duration, "sort_order": l.sort_order,
                    "is_preview": l.is_preview,
                }
                for l in sorted(m.lessons, key=lambda x: x.sort_order)
            ]
            modules.append({
                "module_id": m.module_id, "title": m.title,
                "sort_order": m.sort_order, "lessons": lessons,
            })

    return {
        "product_id": product.product_id,
        "name": product.name,
        "price": float(product.price),
        "original_price": float(product.original_price) if product.original_price else None,
        "description": product.description,
        "short_description": product.short_description,
        "thumbnail_url": product.thumbnail_url,
        "status": product.status,
        "rejection_reason": product.rejection_reason,
        "product_type": product.product_type,
        "category_id": product.category_id,
        "author_id": product.author_id,
        "total_enrolled": product.total_enrolled,
        "average_rating": float(product.average_rating or 0),
        "course": {
            "duration": product.course.duration,
            "level": product.course.level,
            "total_lessons": product.course.total_lessons,
            "requirements": product.course.requirements,
            "what_you_learn": product.course.what_you_learn,
            "modules": modules,
        } if product.course else None,
        "ebook": {
            "file_size": float(product.ebook.file_size) if product.ebook and product.ebook.file_size else None,
            "format": product.ebook.format if product.ebook else None,
            "page_count": product.ebook.page_count if product.ebook else None,
        } if product.ebook else None,
    }


@router.put("/courses/{product_id}", response_model=ProductListResponse)
def instructor_update_course(
    product_id: int,
    data: ProductUpdate,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    """
    Cập nhật thông tin khóa học.
    - Nếu status đang là 'active': tự động ép về 'pending_approval' (ẩn khỏi store).
    - Chỉ cho sửa khi status là draft, rejected, hoặc active (sẽ re-review).
    """
    product = db.query(Product).options(
        joinedload(Product.course), joinedload(Product.ebook),
        joinedload(Product.category), joinedload(Product.author),
    ).filter(Product.product_id == product_id).first()

    if not product:
        raise NotFoundException("Khóa học không tồn tại")
    _assert_owner(product, current_user)

    if product.status == "pending_approval":
        raise BadRequestException("Khóa học đang chờ duyệt, không thể chỉnh sửa lúc này.")

    was_active = product.status == "active"

    update_data = data.model_dump(exclude_none=True)
    product_fields = ["name", "price", "original_price", "description",
                      "short_description", "thumbnail_url", "category_id"]
    course_fields = ["duration", "level", "requirements", "what_you_learn"]
    ebook_fields = ["file_size", "format", "page_count"]

    for field, value in update_data.items():
        if field in product_fields:
            setattr(product, field, value)
        elif field in course_fields and product.product_type == "course" and product.course:
            setattr(product.course, field, value)
        elif field in ebook_fields and product.product_type == "ebook" and product.ebook:
            setattr(product.ebook, field, value)

    # Nếu đang Active → ép về Pending Approval (ẩn khỏi store, chờ duyệt lại)
    if was_active:
        product.status = "pending_approval"
        product.rejection_reason = None

    db.commit()
    db.refresh(product)
    return _build_list_item(product)


@router.post("/courses/{product_id}/submit")
def instructor_submit_course(
    product_id: int,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    """Gửi khóa học lên để Admin kiểm duyệt (draft/rejected → pending_approval)."""
    product = db.query(Product).options(
        joinedload(Product.course), joinedload(Product.author),
    ).filter(Product.product_id == product_id).first()

    if not product:
        raise NotFoundException("Khóa học không tồn tại")
    _assert_owner(product, current_user)

    if product.status not in ("draft", "rejected"):
        raise BadRequestException(
            f"Chỉ có thể gửi duyệt khóa học ở trạng thái Nháp hoặc Bị từ chối (hiện tại: {product.status})"
        )

    # Validate có ít nhất 1 bài học (nếu là course)
    if product.product_type == "course":
        lesson_count = (
            db.query(Lesson).join(Module)
            .filter(Module.course_id == product_id)
            .count()
        )
        if lesson_count == 0:
            raise BadRequestException("Khóa học phải có ít nhất 1 bài học trước khi gửi duyệt")

    product.status = "pending_approval"
    product.rejection_reason = None

    from app.services.notification_service import notify_course_submitted
    notify_course_submitted(
        db, product_id, product.name,
        product.author.name if product.author else f"User#{product.author_id}"
    )

    db.commit()
    return {"message": "Đã gửi khóa học lên kiểm duyệt thành công. Admin sẽ sớm xem xét!"}


# ── Modules ────────────────────────────────────────────────

@router.get("/courses/{product_id}/modules")
def instructor_get_modules(
    product_id: int,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    product = db.query(Product).options(
        joinedload(Product.course).joinedload(Course.modules).joinedload(Module.lessons)
    ).filter(Product.product_id == product_id).first()
    if not product or not product.course:
        raise NotFoundException("Khóa học không tồn tại")
    _assert_owner(product, current_user)

    modules = []
    for m in sorted(product.course.modules, key=lambda x: x.sort_order):
        lessons = [
            {
                "lesson_id": l.lesson_id, "title": l.title,
                "mux_playback_id": l.mux_playback_id or "",
                "mux_asset_id": l.mux_asset_id or "",
                "duration": l.duration, "sort_order": l.sort_order,
                "is_preview": l.is_preview,
            }
            for l in sorted(m.lessons, key=lambda x: x.sort_order)
        ]
        modules.append({
            "module_id": m.module_id, "title": m.title,
            "sort_order": m.sort_order, "lessons": lessons,
        })
    return modules


@router.post("/courses/{product_id}/modules")
def instructor_create_module(
    product_id: int,
    title: str,
    sort_order: int = 0,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise NotFoundException("Khóa học không tồn tại")
    _assert_owner(product, current_user)
    if product.status == "pending_approval":
        raise BadRequestException("Không thể chỉnh sửa khi đang chờ duyệt")

    course = db.query(Course).filter(Course.product_id == product_id).first()
    if not course:
        raise NotFoundException("Không tìm thấy dữ liệu khóa học")

    module = Module(course_id=product_id, title=title, sort_order=sort_order)
    db.add(module)
    db.commit()
    db.refresh(module)
    return {"module_id": module.module_id, "title": module.title, "sort_order": module.sort_order, "lessons": []}


@router.put("/modules/{module_id}")
def instructor_update_module(
    module_id: int,
    title: Optional[str] = None,
    sort_order: Optional[int] = None,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    module = db.query(Module).filter(Module.module_id == module_id).first()
    if not module:
        raise NotFoundException("Module không tồn tại")

    product = db.query(Product).filter(Product.product_id == module.course_id).first()
    _assert_owner(product, current_user)
    if product and product.status == "pending_approval":
        raise BadRequestException("Không thể chỉnh sửa khi đang chờ duyệt")

    if title is not None:
        module.title = title
    if sort_order is not None:
        module.sort_order = sort_order
    db.commit()
    return {"message": "Cập nhật module thành công"}


@router.delete("/modules/{module_id}")
def instructor_delete_module(
    module_id: int,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    module = db.query(Module).filter(Module.module_id == module_id).first()
    if not module:
        raise NotFoundException("Module không tồn tại")
    product = db.query(Product).filter(Product.product_id == module.course_id).first()
    _assert_owner(product, current_user)

    course_id = module.course_id
    db.query(Lesson).filter(Lesson.module_id == module_id).delete()
    db.delete(module)
    db.commit()
    _recalc_total_lessons(db, course_id)
    return {"message": "Đã xóa module"}


# ── Lessons ────────────────────────────────────────────────

@router.post("/modules/{module_id}/lessons")
def instructor_create_lesson(
    module_id: int,
    title: str,
    mux_playback_id: str = "",
    mux_asset_id: str = "",
    duration: int = 0,
    sort_order: int = 0,
    is_preview: bool = False,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    module = db.query(Module).filter(Module.module_id == module_id).first()
    if not module:
        raise NotFoundException("Module không tồn tại")
    product = db.query(Product).filter(Product.product_id == module.course_id).first()
    _assert_owner(product, current_user)
    if product and product.status == "pending_approval":
        raise BadRequestException("Không thể thêm bài học khi đang chờ duyệt")

    lesson = Lesson(
        module_id=module_id, title=title,
        mux_playback_id=mux_playback_id or None,
        mux_asset_id=mux_asset_id or None,
        duration=duration, sort_order=sort_order, is_preview=is_preview,
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    _recalc_total_lessons(db, module.course_id)
    return {
        "lesson_id": lesson.lesson_id, "title": lesson.title,
        "mux_playback_id": lesson.mux_playback_id or "",
        "duration": lesson.duration, "sort_order": lesson.sort_order,
        "is_preview": lesson.is_preview,
    }


@router.put("/lessons/{lesson_id}")
def instructor_update_lesson(
    lesson_id: int,
    title: Optional[str] = None,
    mux_playback_id: Optional[str] = None,
    mux_asset_id: Optional[str] = None,
    duration: Optional[int] = None,
    sort_order: Optional[int] = None,
    is_preview: Optional[bool] = None,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if not lesson:
        raise NotFoundException("Bài học không tồn tại")
    module = db.query(Module).filter(Module.module_id == lesson.module_id).first()
    product = db.query(Product).filter(Product.product_id == module.course_id).first() if module else None
    if product:
        _assert_owner(product, current_user)
        if product.status == "pending_approval":
            raise BadRequestException("Không thể chỉnh sửa khi đang chờ duyệt")

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
    return {"lesson_id": lesson.lesson_id, "title": lesson.title,
            "mux_playback_id": lesson.mux_playback_id or "", "duration": lesson.duration}


@router.delete("/lessons/{lesson_id}")
def instructor_delete_lesson(
    lesson_id: int,
    current_user: User = Depends(require_author_or_admin),
    db: Session = Depends(get_db),
):
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if not lesson:
        raise NotFoundException("Bài học không tồn tại")
    module = db.query(Module).filter(Module.module_id == lesson.module_id).first()
    product = db.query(Product).filter(Product.product_id == module.course_id).first() if module else None
    if product:
        _assert_owner(product, current_user)

    course_id = module.course_id if module else None
    db.delete(lesson)
    db.commit()
    if course_id:
        _recalc_total_lessons(db, course_id)
    return {"message": "Đã xóa bài học"}
