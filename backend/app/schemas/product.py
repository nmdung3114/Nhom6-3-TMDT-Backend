from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class CategoryResponse(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    sort_order: int = 0

    class Config:
        from_attributes = True


class LessonResponse(BaseModel):
    lesson_id: int
    title: str
    duration: int = 0
    sort_order: int = 0
    is_preview: bool = False

    class Config:
        from_attributes = True


class LessonDetailResponse(LessonResponse):
    mux_playback_id: Optional[str] = None


class ModuleResponse(BaseModel):
    module_id: int
    title: str
    sort_order: int = 0
    lessons: List[LessonResponse] = []

    class Config:
        from_attributes = True


class CourseInfoResponse(BaseModel):
    duration: int = 0
    level: Optional[str] = None
    total_lessons: int = 0
    requirements: Optional[str] = None
    what_you_learn: Optional[str] = None
    modules: List[ModuleResponse] = []

    class Config:
        from_attributes = True


class EbookInfoResponse(BaseModel):
    file_size: Optional[Decimal] = None
    format: Optional[str] = None
    page_count: Optional[int] = None
    preview_pages: int = 10

    class Config:
        from_attributes = True


class ReviewResponse(BaseModel):
    review_id: int
    user_id: int
    user_name: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    product_id: int
    name: str
    price: Decimal
    original_price: Optional[Decimal] = None
    thumbnail_url: Optional[str] = None
    product_type: str
    status: str
    average_rating: Optional[Decimal] = None
    review_count: int = 0
    total_enrolled: int = 0
    category: Optional[CategoryResponse] = None
    author_name: Optional[str] = None
    level: Optional[str] = None
    duration: Optional[int] = None

    class Config:
        from_attributes = True


class ProductDetailResponse(ProductListResponse):
    description: Optional[str] = None
    short_description: Optional[str] = None
    created_at: Optional[datetime] = None
    course: Optional[CourseInfoResponse] = None
    ebook: Optional[EbookInfoResponse] = None
    reviews: List[ReviewResponse] = []
    has_access: bool = False


class ProductCreate(BaseModel):
    name: str
    price: Decimal
    original_price: Optional[Decimal] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    status: str = "active"
    product_type: str
    category_id: Optional[int] = None
    # Course-specific
    duration: Optional[int] = None
    level: Optional[str] = None
    requirements: Optional[str] = None
    what_you_learn: Optional[str] = None
    # Ebook-specific
    file_size: Optional[Decimal] = None
    format: Optional[str] = None
    page_count: Optional[int] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[Decimal] = None
    original_price: Optional[Decimal] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    status: Optional[str] = None
    category_id: Optional[int] = None


class ReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None


class ProductsListResponse(BaseModel):
    products: List[ProductListResponse]
    total: int
    page: int
    page_size: int
