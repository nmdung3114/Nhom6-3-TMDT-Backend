from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.notification import Notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def get_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy danh sách thông báo của user."""
    query = db.query(Notification).filter(Notification.user_id == current_user.user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)

    total = query.count()
    notifications = query.order_by(Notification.created_at.desc()) \
        .offset((page - 1) * page_size).limit(page_size).all()

    return {
        "notifications": [
            {
                "notification_id": n.notification_id,
                "type": n.type,
                "title": n.title,
                "message": n.message,
                "link": n.link,
                "is_read": n.is_read,
                "created_at": n.created_at,
            } for n in notifications
        ],
        "total": total,
        "unread_count": db.query(Notification).filter(
            Notification.user_id == current_user.user_id,
            Notification.is_read == False,
        ).count(),
    }


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = db.query(Notification).filter(
        Notification.user_id == current_user.user_id,
        Notification.is_read == False,
    ).count()
    return {"unread_count": count}


@router.put("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.notification_id == notification_id,
        Notification.user_id == current_user.user_id,
    ).first()
    if n:
        n.is_read = True
        db.commit()
    return {"message": "Đã đánh dấu đã đọc"}


@router.put("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.user_id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "Đã đánh dấu tất cả đã đọc"}
