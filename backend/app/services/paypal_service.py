"""
PayPal Sandbox REST API Service
Docs: https://developer.paypal.com/docs/api/orders/v2/

Flow:
  1. get_access_token()        — OAuth2 client_credentials
  2. create_paypal_order()     — Tạo Draft order, lấy approve_url
  3. capture_paypal_order()    — Sau khi user approve, capture tiền
"""

import httpx
import math
import logging
from typing import Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)


def _usd_amount(vnd: float) -> str:
    """Convert VND → USD (round up), format 2 decimal places."""
    usd = math.ceil(vnd / settings.PAYPAL_VND_RATE * 100) / 100
    return f"{usd:.2f}"


def get_access_token() -> str:
    """Lấy OAuth2 access token từ PayPal."""
    url = f"{settings.PAYPAL_BASE_URL}/v1/oauth2/token"
    resp = httpx.post(
        url,
        data={"grant_type": "client_credentials"},
        auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_CLIENT_SECRET),
        timeout=10,
    )
    resp.raise_for_status()
    token = resp.json().get("access_token")
    if not token:
        raise RuntimeError("PayPal: không lấy được access_token")
    return token


def create_paypal_order(order_id: int, amount_vnd: float) -> Dict[str, Any]:
    """
    Tạo PayPal order và trả về approve URL để redirect user.

    Returns:
        {"paypal_order_id": str, "approve_url": str}
    """
    token = get_access_token()
    usd = _usd_amount(amount_vnd)

    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": str(order_id),
                "description": f"ELearnVN - Don hang #{order_id}",
                "amount": {
                    "currency_code": "USD",
                    "value": usd,
                },
            }
        ],
        "application_context": {
            "brand_name": "ELearnVN",
            "locale": "vi-VN",
            "landing_page": "NO_PREFERENCE",
            "user_action": "PAY_NOW",
            "return_url": f"{settings.PAYPAL_RETURN_URL}?order_id={order_id}",
            "cancel_url": f"{settings.PAYPAL_CANCEL_URL}?order_id={order_id}&status=cancelled",
        },
    }

    resp = httpx.post(
        f"{settings.PAYPAL_BASE_URL}/v2/checkout/orders",
        json=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    paypal_order_id = data.get("id")
    approve_url = next(
        (link["href"] for link in data.get("links", []) if link["rel"] == "approve"),
        None,
    )

    if not paypal_order_id or not approve_url:
        raise RuntimeError(f"PayPal order tạo thất bại: {data}")

    logger.info(f"PayPal order created: {paypal_order_id} | USD={usd} | order_id={order_id}")
    return {"paypal_order_id": paypal_order_id, "approve_url": approve_url, "usd_amount": usd}


def capture_paypal_order(paypal_order_id: str) -> Dict[str, Any]:
    """
    Capture (hoàn tất) PayPal order sau khi user approve.

    Returns:
        {
            "success": bool,
            "paypal_order_id": str,
            "capture_id": str,   # dùng làm transaction_id
            "status": str,       # "COMPLETED" nếu thành công
            "usd_amount": float,
        }
    """
    token = get_access_token()

    resp = httpx.post(
        f"{settings.PAYPAL_BASE_URL}/v2/checkout/orders/{paypal_order_id}/capture",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )

    # 422 = đã capture trước đó (idempotent)
    if resp.status_code == 422:
        logger.warning(f"PayPal order {paypal_order_id} already captured")
        return {
            "success": True,
            "paypal_order_id": paypal_order_id,
            "capture_id": paypal_order_id,
            "status": "COMPLETED",
            "usd_amount": 0.0,
        }

    resp.raise_for_status()
    data = resp.json()

    status = data.get("status")  # "COMPLETED" | "APPROVED" | ...
    captures = (
        data.get("purchase_units", [{}])[0]
        .get("payments", {})
        .get("captures", [{}])
    )
    capture = captures[0] if captures else {}
    capture_id = capture.get("id", "")
    usd_amount = float(capture.get("amount", {}).get("value", 0))

    logger.info(f"PayPal capture: {capture_id} | status={status} | usd={usd_amount}")

    return {
        "success": status == "COMPLETED",
        "paypal_order_id": paypal_order_id,
        "capture_id": capture_id,
        "status": status,
        "usd_amount": usd_amount,
    }
