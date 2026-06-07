from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    icon = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=0)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True, autoincrement=True)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=True)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    original_price = Column(Numeric(12, 2), nullable=True)
    description = Column(Text, nullable=True)
    short_description = Column(String(500), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="active")
    product_type = Column(String(20), nullable=False)  # course | ebook
    author_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    total_enrolled = Column(Integer, default=0)
    average_rating = Column(Numeric(3, 2), default=0)
    review_count = Column(Integer, default=0)
    rejection_reason = Column(Text, nullable=True)  # Lý do Admin từ chối
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    category = relationship("Category", back_populates="products")
    author = relationship("User", foreign_keys=[author_id], back_populates="products")
    reviews = relationship("Review", back_populates="product")
    order_items = relationship("OrderItem", back_populates="product")
    cart_items = relationship("CartItem", back_populates="product")
    access_list = relationship("UserAccess", back_populates="product")

    # One-to-one
    ebook = relationship("Ebook", back_populates="product", uselist=False)
    course = relationship("Course", back_populates="product", uselist=False)
    wishlists = relationship("Wishlist", back_populates="product")


class Ebook(Base):
    __tablename__ = "ebooks"

    product_id = Column(Integer, ForeignKey("products.product_id"), primary_key=True)
    file_size = Column(Numeric(10, 2), nullable=True)
    format = Column(String(20), nullable=True)
    page_count = Column(Integer, nullable=True)
    mux_asset_id = Column(String(255), nullable=True)
    file_key = Column(String(500), nullable=True)
    preview_pages = Column(Integer, default=10)

    product = relationship("Product", back_populates="ebook")


class Course(Base):
    __tablename__ = "courses"

    product_id = Column(Integer, ForeignKey("products.product_id"), primary_key=True)
    duration = Column(Integer, default=0)
    level = Column(String(50), nullable=True)
    total_lessons = Column(Integer, default=0)
    requirements = Column(Text, nullable=True)
    what_you_learn = Column(Text, nullable=True)

    product = relationship("Product", back_populates="course")
    modules = relationship("Module", back_populates="course", order_by="Module.sort_order")


class Module(Base):
    __tablename__ = "modules"

    module_id = Column(Integer, primary_key=True, autoincrement=True)
    course_id = Column(Integer, ForeignKey("courses.product_id"), nullable=False)
    title = Column(String(255), nullable=False)
    sort_order = Column(Integer, default=0)

    course = relationship("Course", back_populates="modules")
    lessons = relationship("Lesson", back_populates="module", order_by="Lesson.sort_order")


class Lesson(Base):
    __tablename__ = "lessons"

    lesson_id = Column(Integer, primary_key=True, autoincrement=True)
    module_id = Column(Integer, ForeignKey("modules.module_id"), nullable=False)
    title = Column(String(255), nullable=False)
    mux_asset_id = Column(String(255), nullable=True)
    mux_playback_id = Column(String(255), nullable=True)
    duration = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)
    is_preview = Column(Boolean, default=False)

    module = relationship("Module", back_populates="lessons")
    progress_list = relationship("LearningProgress", back_populates="lesson")


class Review(Base):
    __tablename__ = "reviews"

    review_id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    product = relationship("Product", back_populates="reviews")
    user = relationship("User", back_populates="reviews")
