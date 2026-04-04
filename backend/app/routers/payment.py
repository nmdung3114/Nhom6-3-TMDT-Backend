from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import Optional
import logging
import unicodedata
from app.database import get_db
from app.models.order import Order, Payment
from app.models.cart import Cart, CartItem
from app.services.vnpay_service import create_payment_url
from app.services.payment_service import process_vnpay_return
from app.core.exceptions import NotFoundException, BadRequestException
from app.dependencies import get_current_user
from app.models.user import User
from decimal import Decimal

logger = logging.getLogger(__name__)


def _ascii_safe(text: str) -> str:
    """Chuyển text tiếng Việt thành ASCII để dùng trong VNPay OrderInfo."""
    nfkd = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')

router = APIRouter(prefix="/api/payment", tags=["payment"])


@router.post("/create/{order_id}")
def create_payment(
    order_id: int,
    request: Request,
    bank_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo VNPay payment URL và redirect sang cổng thanh toán."""
    order = db.query(Order).filter(
        Order.order_id == order_id,
        Order.user_id == current_user.user_id,
    ).first()
    if not order:
        raise NotFoundException("Đơn hàng không tồn tại")
    if order.status == "paid":
        raise BadRequestException("Đơn hàng đã được thanh toán")
    # Cho phép retry nếu đơn bị cancelled do thanh toán lỗi trước
    if order.status == "cancelled":
        order.status = "pending"
        db.commit()

    client_ip = request.client.host if request.client else "127.0.0.1"
    # Dùng ASCII để tránh lỗi encoding khi tính HMAC với VNPay
    safe_name = _ascii_safe(current_user.name)
    order_desc = f"Thanh toan don hang #{order_id} - {safe_name}"

    logger.info(f"Creating VNPay payment for order #{order_id}, amount={order.total_amount}")
    payment_url, txn_ref = create_payment_url(
        order_id=order_id,
        amount=float(order.total_amount),
        order_desc=order_desc,
        client_ip=client_ip,
        bank_code=bank_code or "",
    )
    logger.info(f"VNPay URL created: {payment_url[:80]}...")

    # Update payment with txn_ref
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if payment:
        payment.vnpay_txn_ref = txn_ref
        db.commit()

    # Clear cart after creating payment
    cart = db.query(Cart).filter(Cart.user_id == current_user.user_id).first()
    if cart:
        db.query(CartItem).filter(CartItem.cart_id == cart.cart_id).delete()
        db.commit()

    return {"payment_url": payment_url, "order_id": order_id}


@router.get("/vnpay-return")
def vnpay_return(request: Request, db: Session = Depends(get_db)):
    """VNPay callback — verify and update order status."""
    params = dict(request.query_params)
    logger.info(f"VNPay callback received. Params: {params}")
    result = process_vnpay_return(db, params)
    logger.info(f"VNPay result: {result}")

    order_id = result.get("order_id", 0)
    if result["success"]:
        # Tạo thông báo cho user
        try:
            from app.models.notification import Notification
            from app.models.order import Order as OrderModel
            order_obj = db.query(OrderModel).filter(OrderModel.order_id == order_id).first()
            if order_obj:
                notif = Notification(
                    user_id=order_obj.user_id,
                    type="success",
                    title="Thanh toán thành công! 🎉",
                    message=f"Đơn hàng #{order_id} đã được thanh toán. Nội dung đã được mở khóa!",
                    link=f"/orders/index.html?order_id={order_id}&status=success",
                )
                db.add(notif)
                db.commit()
        except Exception as e:
            logger.warning(f"Could not create notification: {e}")

        return RedirectResponse(
            url=f"/orders/index.html?order_id={order_id}&status=success",
            status_code=302,
        )
    else:
        code = result.get("code", "99")
        return RedirectResponse(
            url=f"/checkout/index.html?order_id={order_id}&status=failed&code={code}",
            status_code=302,
        )



@router.get("/status/{order_id}")
def get_payment_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = db.query(Payment).join(Order).filter(
        Payment.order_id == order_id,
        Order.user_id == current_user.user_id,
    ).first()
    if not payment:
        raise NotFoundException("Thông tin thanh toán không tìm thấy")
    return {
        "order_id": order_id,
        "status": payment.status,
        "method": payment.method,
        "transaction_id": payment.transaction_id,
        "paid_at": payment.paid_at,
        "amount": payment.amount,
    }
