"""Payment Service — orchestrates VNPay flow and access granting."""
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from app.core.timezone import now_vn
from app.models.order import Order, Payment, UserAccess
from app.models.product import Product
from app.services.vnpay_service import verify_vnpay_callback
from app.core.exceptions import NotFoundException, BadRequestException


def process_vnpay_return(db: Session, params: dict) -> dict:
    """Process VNPay return callback: verify → update order → grant access."""
    result = verify_vnpay_callback(params.copy())

    if not result["is_valid"]:
        return {"success": False, "message": "Invalid signature", "order_id": result.get("order_id")}

    order_id = result["order_id"]
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        return {"success": False, "message": "Order not found", "order_id": order_id}

    if order.status == "paid":
        return {"success": True, "message": "Already paid", "order_id": order_id}

    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if not payment:
        return {"success": False, "message": "Payment record not found", "order_id": order_id}

    if result["is_success"]:
        # Update order status
        order.status = "paid"
        order.updated_at = now_vn()
        # Update payment
        payment.status = "success"
        payment.transaction_id = result["transaction_id"]
        payment.paid_at = now_vn()
        payment.amount = result["amount"]
        payment.vnpay_response = result["raw_params"]

        # Grant access to all purchased products
        _grant_access(db, order)
        db.commit()
        return {"success": True, "message": "Payment successful", "order_id": order_id}
    else:
        order.status = "cancelled"
        payment.status = "failed"
        payment.vnpay_response = result["raw_params"]
        db.commit()
        return {
            "success": False,
            "message": result["response_message"],
            "order_id": order_id,
            "code": result["response_code"],
        }


def _grant_access(db: Session, order: Order):
    """Grant content access to user for all items in order."""
    for item in order.items:
        existing = db.query(UserAccess).filter(
            UserAccess.user_id == order.user_id,
            UserAccess.product_id == item.product_id,
        ).first()
        if existing:
            existing.is_active = True
            existing.revoked_at = None
        else:
            access = UserAccess(
                user_id=order.user_id,
                product_id=item.product_id,
                order_id=order.order_id,
                is_active=True,
            )
            db.add(access)

        # Update enrollment count
        product = db.query(Product).filter(Product.product_id == item.product_id).first()
        if product:
            product.total_enrolled = (product.total_enrolled or 0) + 1


def revoke_access(db: Session, user_id: int, product_id: int):
    """Admin: revoke user access to content."""
    access = db.query(UserAccess).filter(
        UserAccess.user_id == user_id,
        UserAccess.product_id == product_id,
        UserAccess.is_active == True,
    ).first()
    if not access:
        raise NotFoundException("Access record not found")
    access.is_active = False
    access.revoked_at = now_vn()
    db.commit()


def check_user_has_access(db: Session, user_id: int, product_id: int) -> bool:
    """Check if user has active access to a product."""
    access = db.query(UserAccess).filter(
        UserAccess.user_id == user_id,
        UserAccess.product_id == product_id,
        UserAccess.is_active == True,
    ).first()
    return access is not None
