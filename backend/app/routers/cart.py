from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.schemas.cart import CartResponse, AddToCartRequest, CartItemResponse
from app.models.cart import Cart, CartItem
from app.models.product import Product
from app.models.order import UserAccess
from app.core.exceptions import NotFoundException, BadRequestException, ConflictException
from app.dependencies import get_current_user
from app.models.user import User
from decimal import Decimal

router = APIRouter(prefix="/api/cart", tags=["cart"])


def _get_or_create_cart(db: Session, user_id: int) -> Cart:
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


def _build_cart_response(cart: Cart) -> CartResponse:
    items = []
    subtotal = Decimal("0")
    for item in (cart.items or []):
        p = item.product
        ci = CartItemResponse(
            cart_item_id=item.cart_item_id,
            product_id=item.product_id,
            product_name=p.name if p else None,
            product_thumbnail=p.thumbnail_url if p else None,
            product_type=p.product_type if p else None,
            quantity=item.quantity,
            price=item.price,
        )
        items.append(ci)
        subtotal += item.price * item.quantity
    return CartResponse(cart_id=cart.cart_id, items=items, subtotal=subtotal, item_count=len(items))


@router.get("", response_model=CartResponse)
def get_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cart = db.query(Cart).options(
        joinedload(Cart.items).joinedload(CartItem.product)
    ).filter(Cart.user_id == current_user.user_id).first()
    if not cart:
        return CartResponse(cart_id=0, items=[], subtotal=Decimal("0"), item_count=0)
    return _build_cart_response(cart)


@router.post("", response_model=CartResponse)
def add_to_cart(
    data: AddToCartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(
        Product.product_id == data.product_id, Product.status == "active"
    ).first()
    if not product:
        raise NotFoundException("Sản phẩm không tồn tại")

    # Check if already purchased
    existing_access = db.query(UserAccess).filter(
        UserAccess.user_id == current_user.user_id,
        UserAccess.product_id == data.product_id,
        UserAccess.is_active == True,
    ).first()
    if existing_access:
        raise ConflictException("Bạn đã sở hữu sản phẩm này rồi")

    cart = _get_or_create_cart(db, current_user.user_id)

    existing_item = db.query(CartItem).filter(
        CartItem.cart_id == cart.cart_id,
        CartItem.product_id == data.product_id,
    ).first()
    if existing_item:
        raise ConflictException("Sản phẩm đã có trong giỏ hàng")

    item = CartItem(
        cart_id=cart.cart_id,
        product_id=data.product_id,
        quantity=1,
        price=product.price,
    )
    db.add(item)
    db.commit()

    # Reload cart
    cart = db.query(Cart).options(
        joinedload(Cart.items).joinedload(CartItem.product)
    ).filter(Cart.user_id == current_user.user_id).first()
    return _build_cart_response(cart)


@router.delete("/{product_id}", response_model=CartResponse)
def remove_from_cart(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cart = db.query(Cart).filter(Cart.user_id == current_user.user_id).first()
    if not cart:
        raise NotFoundException("Giỏ hàng trống")
    item = db.query(CartItem).filter(
        CartItem.cart_id == cart.cart_id,
        CartItem.product_id == product_id,
    ).first()
    if not item:
        raise NotFoundException("Sản phẩm không có trong giỏ hàng")
    db.delete(item)
    db.commit()

    cart = db.query(Cart).options(
        joinedload(Cart.items).joinedload(CartItem.product)
    ).filter(Cart.user_id == current_user.user_id).first()
    return _build_cart_response(cart)


@router.delete("", response_model=dict)
def clear_cart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cart = db.query(Cart).filter(Cart.user_id == current_user.user_id).first()
    if cart:
        db.query(CartItem).filter(CartItem.cart_id == cart.cart_id).delete()
        db.commit()
    return {"message": "Giỏ hàng đã được xóa"}
