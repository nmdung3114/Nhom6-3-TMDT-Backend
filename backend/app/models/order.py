from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, Boolean, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.database import Base


class Coupon(Base):
    __tablename__ = "coupons"

    code = Column(String(50), primary_key=True)
    discount = Column(Numeric(12, 2), nullable=False)
    discount_type = Column(String(20), default="fixed")  # fixed | percent
    min_order_amount = Column(Numeric(12, 2), default=0)
    expired_date = Column(DateTime, nullable=True)
    usage_limit = Column(Integer, nullable=True)
    used_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    orders = relationship("Order", back_populates="coupon")


class Order(Base):
    __tablename__ = "orders"

    order_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    coupon_code = Column(String(50), ForeignKey("coupons.code"), nullable=True)
    subtotal = Column(Numeric(12, 2), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=0)
    total_amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="orders")
    coupon = relationship("Coupon", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")
    payment = relationship("Payment", back_populates="order", uselist=False)
    access_granted = relationship("UserAccess", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Numeric(12, 2), nullable=False)

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")


class Payment(Base):
    __tablename__ = "payments"

    payment_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.order_id"), unique=True, nullable=False)
    method = Column(String(50), nullable=False, default="vnpay")
    status = Column(String(20), nullable=False, default="pending")
    transaction_id = Column(String(255), unique=True, nullable=True)
    vnpay_txn_ref = Column(String(100), nullable=True)
    paid_at = Column(DateTime, nullable=True)
    amount = Column(Numeric(12, 2), nullable=True)
    vnpay_response = Column(JSON, nullable=True)

    order = relationship("Order", back_populates="payment")


class UserAccess(Base):
    __tablename__ = "user_access"

    access_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.order_id"), nullable=False)
    granted_at = Column(DateTime, server_default=func.now())
    revoked_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="access_list")
    product = relationship("Product", back_populates="access_list")
    order = relationship("Order", back_populates="access_granted")
