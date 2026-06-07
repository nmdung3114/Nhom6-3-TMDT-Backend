from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal


class CartItemResponse(BaseModel):
    cart_item_id: int
    product_id: int
    product_name: Optional[str] = None
    product_thumbnail: Optional[str] = None
    product_type: Optional[str] = None
    quantity: int
    price: Decimal

    class Config:
        from_attributes = True


class CartResponse(BaseModel):
    cart_id: int
    items: List[CartItemResponse] = []
    subtotal: Decimal = Decimal("0")
    item_count: int = 0

    class Config:
        from_attributes = True


class AddToCartRequest(BaseModel):
    product_id: int
    quantity: int = 1


class RemoveFromCartRequest(BaseModel):
    product_id: int
