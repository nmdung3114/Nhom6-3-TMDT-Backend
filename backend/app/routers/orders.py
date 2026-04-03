from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from typing import Optional
from app.database import get_db
from app.schemas.order import (
    OrderResponse, OrderItemResponse, PaymentResponse,
    CreateOrderRequest, OrdersListResponse, CouponValidateRequest, CouponResponse
)
from app.models.order import Order, OrderItem, Payment, Coupon, UserAccess
from app.models.cart import Cart, CartItem
from app.models.product import Product
from app.core.exceptions import NotFoundException, BadRequestException
from app.dependencies import get_current_user
from app.models.user import User
from decimal import Decimal

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _compute_discount(coupon: Coupon, subtotal: Decimal) -> Decimal:
    if not coupon or not coupon.is_active:
        return Decimal("0")
    if coupon.expired_date and coupon.expired_date < datetime.now():
        return Decimal("0")
    if coupon.min_order_amount and subtotal < coupon.min_order_amount:
        return Decimal("0")
    if coupon.discount_type == "percent":
        return round(subtotal * coupon.discount / 100, 0)
    return min(coupon.discount, subtotal)


@router.post("/validate-coupon", response_model=dict)
def validate_coupon(
    data: CouponValidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    coupon = db.query(Coupon).filter(Coupon.code == data.code).first()
    if not coupon or not coupon.is_active:
        raise NotFoundException("Mã giảm giá không hợp lệ")
    if coupon.expired_date and coupon.expired_date < datetime.now():
        raise BadRequestException("Mã giảm giá đã hết hạn")
    if coupon.usage_limit and coupon.used_count >= coupon.usage_limit:
        raise BadRequestException("Mã giảm giá đã hết lượt sử dụng")
    if coupon.min_order_amount and data.order_amount < coupon.min_order_amount:
        raise BadRequestException(f"Đơn hàng tối thiểu {coupon.min_order_amount:,.0f}đ")
    discount = _compute_discount(coupon, data.order_amount)
    return {"valid": True, "discount": discount, "discount_type": coupon.discount_type}


@router.post("", response_model=OrderResponse)
def create_order(
    data: CreateOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cart = db.query(Cart).options(
        joinedload(Cart.items).joinedload(CartItem.product)
    ).filter(Cart.user_id == current_user.user_id).first()

    if not cart or not cart.items:
        raise BadRequestException("Giỏ hàng trống")

    subtotal = sum(item.price * item.quantity for item in cart.items)
    discount = Decimal("0")
    coupon = None

    if data.coupon_code:
        coupon = db.query(Coupon).filter(Coupon.code == data.coupon_code).first()
        if coupon:
            discount = _compute_discount(coupon, subtotal)
            coupon.used_count = (coupon.used_count or 0) + 1

    total = max(subtotal - discount, Decimal("0"))

    order = Order(
        user_id=current_user.user_id,
        coupon_code=data.coupon_code if coupon else None,
        subtotal=subtotal,
        discount_amount=discount,
        total_amount=total,
        status="pending",
    )
    db.add(order)
    db.flush()  # get order_id

    for item in cart.items:
        oi = OrderItem(
            order_id=order.order_id,
            product_id=item.product_id,
            quantity=item.quantity,
            price=item.price,
        )
        db.add(oi)

    payment = Payment(order_id=order.order_id, status="pending", amount=total)
    db.add(payment)
    db.commit()
    db.refresh(order)

    items_resp = [
        OrderItemResponse(
            order_item_id=i.order_item_id, product_id=i.product_id,
            product_name=i.product.name if i.product else None,
            product_thumbnail=i.product.thumbnail_url if i.product else None,
            product_type=i.product.product_type if i.product else None,
            quantity=i.quantity, price=i.price,
        ) for i in order.items
    ]
    return OrderResponse(
        order_id=order.order_id, user_id=order.user_id,
        coupon_code=order.coupon_code, subtotal=order.subtotal,
        discount_amount=order.discount_amount, total_amount=order.total_amount,
        status=order.status, created_at=order.created_at,
        items=items_resp, payment=PaymentResponse(
            payment_id=order.payment.payment_id, method=order.payment.method,
            status=order.payment.status, amount=order.payment.amount,
        ) if order.payment else None,
    )


@router.get("", response_model=OrdersListResponse)
def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Order).options(
        joinedload(Order.items).joinedload(OrderItem.product),
        joinedload(Order.payment),
    ).filter(Order.user_id == current_user.user_id).order_by(Order.created_at.desc())

    total = query.count()
    orders = query.offset((page - 1) * page_size).limit(page_size).all()

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
        payment_resp = None
        if o.payment:
            payment_resp = PaymentResponse(
                payment_id=o.payment.payment_id, method=o.payment.method,
                status=o.payment.status, transaction_id=o.payment.transaction_id,
                paid_at=o.payment.paid_at, amount=o.payment.amount,
            )
        orders_resp.append(OrderResponse(
            order_id=o.order_id, user_id=o.user_id,
            coupon_code=o.coupon_code, subtotal=o.subtotal,
            discount_amount=o.discount_amount, total_amount=o.total_amount,
            status=o.status, created_at=o.created_at,
            items=items_resp, payment=payment_resp,
        ))
    return OrdersListResponse(orders=orders_resp, total=total, page=page, page_size=page_size)


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).options(
        joinedload(Order.items).joinedload(OrderItem.product),
        joinedload(Order.payment),
    ).filter(Order.order_id == order_id, Order.user_id == current_user.user_id).first()
    if not order:
        raise NotFoundException("Đơn hàng không tồn tại")

    items_resp = [
        OrderItemResponse(
            order_item_id=i.order_item_id, product_id=i.product_id,
            product_name=i.product.name if i.product else None,
            product_thumbnail=i.product.thumbnail_url if i.product else None,
            product_type=i.product.product_type if i.product else None,
            quantity=i.quantity, price=i.price,
        ) for i in order.items
    ]
    payment_resp = None
    if order.payment:
        payment_resp = PaymentResponse(
            payment_id=order.payment.payment_id, method=order.payment.method,
            status=order.payment.status, transaction_id=order.payment.transaction_id,
            paid_at=order.payment.paid_at, amount=order.payment.amount,
        )
    return OrderResponse(
        order_id=order.order_id, user_id=order.user_id,
        coupon_code=order.coupon_code, subtotal=order.subtotal,
        discount_amount=order.discount_amount, total_amount=order.total_amount,
        status=order.status, created_at=order.created_at,
        items=items_resp, payment=payment_resp,
    )
