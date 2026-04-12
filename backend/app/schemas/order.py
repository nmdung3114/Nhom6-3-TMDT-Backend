from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class OrderItemResponse(BaseModel):
    order_item_id: int
    product_id: int
    product_name: Optional[str] = None
    product_thumbnail: Optional[str] = None
    product_type: Optional[str] = None
    quantity: int
    price: Decimal

    class Config:
        from_attributes = True


class PaymentResponse(BaseModel):
    payment_id: int
    method: str
    status: str
    transaction_id: Optional[str] = None
    paid_at: Optional[datetime] = None
    amount: Optional[Decimal] = None

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    order_id: int
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    coupon_code: Optional[str] = None
    subtotal: Decimal
    discount_amount: Decimal = Decimal("0")
    total_amount: Decimal
    status: str
    created_at: Optional[datetime] = None
    items: List[OrderItemResponse] = []
    payment: Optional[PaymentResponse] = None

    class Config:
        from_attributes = True


class CreateOrderRequest(BaseModel):
    coupon_code: Optional[str] = None


class PaymentInitResponse(BaseModel):
    payment_url: str
    order_id: int
    amount: Decimal


class CouponResponse(BaseModel):
    code: str
    discount: Decimal
    discount_type: str
    expired_date: Optional[datetime] = None
    is_active: bool

    class Config:
        from_attributes = True


class CouponValidateRequest(BaseModel):
    code: str
    order_amount: Decimal


class OrdersListResponse(BaseModel):
    orders: List[OrderResponse]
    total: int
    page: int
    page_size: int


class AdminStatsResponse(BaseModel):
    total_users: int
    total_products: int
    total_orders: int
    total_revenue: Decimal
    pending_orders: int
    paid_orders: int
    new_users_today: int
    revenue_today: Decimal
