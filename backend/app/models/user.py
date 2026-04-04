from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    role = Column(String(20), nullable=False, default="learner")
    status = Column(String(20), nullable=False, default="active")
    avatar_url = Column(String(500), nullable=True)
    oauth_provider = Column(String(50), nullable=True)
    oauth_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    orders = relationship("Order", back_populates="user")
    cart = relationship("Cart", back_populates="user", uselist=False)
    reviews = relationship("Review", back_populates="user")
    access_list = relationship("UserAccess", back_populates="user")
    progress_list = relationship("LearningProgress", back_populates="user")
    products = relationship("Product", foreign_keys="Product.author_id", back_populates="author")
    wishlists = relationship("Wishlist", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
