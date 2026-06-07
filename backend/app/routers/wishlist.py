from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.wishlist import Wishlist
from app.models.product import Product, Course
from app.core.exceptions import ConflictException, NotFoundException

router = APIRouter(prefix="/api/wishlist", tags=["wishlist"])


@router.get("")
def get_wishlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách yêu thích của user."""
    items = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.user_id
    ).options(
        joinedload(Wishlist.product).joinedload(Product.category),
        joinedload(Wishlist.product).joinedload(Product.author),
        joinedload(Wishlist.product).joinedload(Product.course),
    ).order_by(Wishlist.added_at.desc()).all()

    return [
        {
            "wishlist_id": w.wishlist_id,
            "product_id": w.product.product_id,
            "name": w.product.name,
            "price": float(w.product.price),
            "original_price": float(w.product.original_price) if w.product.original_price else None,
            "thumbnail_url": w.product.thumbnail_url,
            "product_type": w.product.product_type,
            "average_rating": float(w.product.average_rating or 0),
            "review_count": w.product.review_count,
            "total_enrolled": w.product.total_enrolled,
            "category": {"name": w.product.category.name, "icon": w.product.category.icon} if w.product.category else None,
            "author_name": w.product.author.name if w.product.author else None,
            "level": w.product.course.level if w.product.course else None,
            "added_at": w.added_at,
        }
        for w in items
    ]


@router.post("/{product_id}")
def add_to_wishlist(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Thêm sản phẩm vào danh sách yêu thích."""
    product = db.query(Product).filter(Product.product_id == product_id, Product.status == "active").first()
    if not product:
        raise NotFoundException("Sản phẩm không tồn tại")

    existing = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.user_id,
        Wishlist.product_id == product_id,
    ).first()
    if existing:
        raise ConflictException("Sản phẩm đã có trong danh sách yêu thích")

    wishlist = Wishlist(user_id=current_user.user_id, product_id=product_id)
    db.add(wishlist)
    db.commit()
    return {"message": "Đã thêm vào yêu thích", "wishlist_id": wishlist.wishlist_id}


@router.delete("/{product_id}")
def remove_from_wishlist(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa sản phẩm khỏi danh sách yêu thích."""
    item = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.user_id,
        Wishlist.product_id == product_id,
    ).first()
    if not item:
        raise NotFoundException("Không tìm thấy trong danh sách yêu thích")
    db.delete(item)
    db.commit()
    return {"message": "Đã xóa khỏi yêu thích"}


@router.get("/check/{product_id}")
def check_wishlist(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kiểm tra sản phẩm có trong wishlist không."""
    item = db.query(Wishlist).filter(
        Wishlist.user_id == current_user.user_id,
        Wishlist.product_id == product_id,
    ).first()
    return {"is_wishlisted": item is not None}
