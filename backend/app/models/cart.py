from sqlalchemy import Column, Integer, Numeric, ForeignKey, UniqueConstraint, func, DateTime
from sqlalchemy.orm import relationship
from app.database import Base


class Cart(Base):
    __tablename__ = "carts"

    cart_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), unique=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="cart")
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "cart_items"

    cart_item_id = Column(Integer, primary_key=True, autoincrement=True)
    cart_id = Column(Integer, ForeignKey("carts.cart_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Numeric(12, 2), nullable=False)

    __table_args__ = (UniqueConstraint("cart_id", "product_id"),)

    cart = relationship("Cart", back_populates="items")
    product = relationship("Product", back_populates="cart_items")
