from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import Optional
from app.database import get_db
from app.schemas.product import (
    ProductsListResponse, ProductDetailResponse, ProductListResponse,
    ReviewCreate, ReviewResponse, CategoryResponse
)
from app.models.product import Product, Category, Course, Review
from app.models.order import UserAccess
from app.core.exceptions import NotFoundException, ConflictException, BadRequestException
from app.dependencies import get_current_user_optional, get_current_user
from app.models.user import User
from app.utils.pagination import paginate
from decimal import Decimal
import json

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("/categories", response_model=list[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.sort_order).all()


@router.get("", response_model=ProductsListResponse)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    product_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    level: Optional[str] = None,
    sort: str = Query("newest", regex="^(newest|oldest|price_asc|price_desc|rating)$"),
    db: Session = Depends(get_db),
):
    query = db.query(Product).filter(Product.status == "active")

    if search:
        query = query.filter(Product.name.ilike(f"%{search}%"))
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if product_type:
        query = query.filter(Product.product_type == product_type)
    if min_price is not None:
        query = query.filter(Product.price >= Decimal(str(min_price)))
    if max_price is not None:
        query = query.filter(Product.price <= Decimal(str(max_price)))
    if level:
        query = query.join(Course).filter(Course.level == level)

    # Sort
    sort_map = {
        "newest": Product.created_at.desc(),
        "oldest": Product.created_at.asc(),
        "price_asc": Product.price.asc(),
        "price_desc": Product.price.desc(),
        "rating": Product.average_rating.desc(),
    }
    query = query.order_by(sort_map.get(sort, Product.created_at.desc()))
    query = query.options(joinedload(Product.category), joinedload(Product.author))

    total = query.count()
    products = query.offset((page - 1) * page_size).limit(page_size).all()

    result = []
    for p in products:
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
        result.append(item)

    return ProductsListResponse(products=result, total=total, page=page, page_size=page_size)


@router.get("/{product_id}", response_model=ProductDetailResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    p = db.query(Product).options(
        joinedload(Product.category),
        joinedload(Product.author),
        joinedload(Product.course).joinedload(Course.modules),
        joinedload(Product.ebook),
        joinedload(Product.reviews).joinedload(Review.user),
    ).filter(Product.product_id == product_id, Product.status == "active").first()

    if not p:
        raise NotFoundException("Sản phẩm không tồn tại")

    # Check user access
    has_access = False
    if current_user:
        access = db.query(UserAccess).filter(
            UserAccess.user_id == current_user.user_id,
            UserAccess.product_id == product_id,
            UserAccess.is_active == True,
        ).first()
        has_access = access is not None

    reviews = [
        ReviewResponse(
            review_id=r.review_id, user_id=r.user_id,
            user_name=r.user.name if r.user else "Ẩn danh",
            rating=r.rating, comment=r.comment, created_at=r.created_at,
        ) for r in p.reviews
    ]

    course_info = None
    ebook_info = None
    from app.schemas.product import CourseInfoResponse, EbookInfoResponse, ModuleResponse, LessonResponse

    if p.product_type == "course" and p.course:
        modules = []
        for m in (p.course.modules or []):
            lessons = [
                LessonResponse(
                    lesson_id=l.lesson_id, title=l.title,
                    duration=l.duration, sort_order=l.sort_order,
                    is_preview=l.is_preview,
                ) for l in (m.lessons or [])
            ]
            modules.append(ModuleResponse(
                module_id=m.module_id, title=m.title,
                sort_order=m.sort_order, lessons=lessons,
            ))
        course_info = CourseInfoResponse(
            duration=p.course.duration, level=p.course.level,
            total_lessons=p.course.total_lessons,
            requirements=p.course.requirements,
            what_you_learn=p.course.what_you_learn,
            modules=modules,
        )
    elif p.product_type == "ebook" and p.ebook:
        ebook_info = EbookInfoResponse(
            file_size=p.ebook.file_size, format=p.ebook.format,
            page_count=p.ebook.page_count, preview_pages=p.ebook.preview_pages,
        )

    return ProductDetailResponse(
        product_id=p.product_id, name=p.name, price=p.price,
        original_price=p.original_price, thumbnail_url=p.thumbnail_url,
        product_type=p.product_type, status=p.status,
        description=p.description, short_description=p.short_description,
        average_rating=p.average_rating, review_count=p.review_count,
        total_enrolled=p.total_enrolled, created_at=p.created_at,
        category=CategoryResponse.model_validate(p.category) if p.category else None,
        author_name=p.author.name if p.author else None,
        course=course_info, ebook=ebook_info, reviews=reviews,
        level=p.course.level if p.course else None,
        duration=p.course.duration if p.course else None,
        has_access=has_access,
    )


@router.post("/{product_id}/reviews", response_model=ReviewResponse)
def create_review(
    product_id: int,
    data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Must have purchased the product
    access = db.query(UserAccess).filter(
        UserAccess.user_id == current_user.user_id,
        UserAccess.product_id == product_id,
        UserAccess.is_active == True,
    ).first()
    if not access:
        raise BadRequestException("Bạn phải mua sản phẩm mới có thể đánh giá")
    if not (1 <= data.rating <= 5):
        raise BadRequestException("Rating phải từ 1-5")
    existing = db.query(Review).filter(
        Review.product_id == product_id, Review.user_id == current_user.user_id
    ).first()
    if existing:
        raise ConflictException("Bạn đã đánh giá sản phẩm này rồi")

    review = Review(
        product_id=product_id, user_id=current_user.user_id,
        rating=data.rating, comment=data.comment,
    )
    db.add(review)

    # Update average rating
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if product:
        all_reviews = db.query(Review).filter(Review.product_id == product_id).all()
        total = sum(r.rating for r in all_reviews) + data.rating
        count = len(all_reviews) + 1
        product.average_rating = round(total / count, 2)
        product.review_count = count

    db.commit()
    db.refresh(review)
    return ReviewResponse(
        review_id=review.review_id, user_id=review.user_id,
        user_name=current_user.name, rating=review.rating,
        comment=review.comment, created_at=review.created_at,
    )
