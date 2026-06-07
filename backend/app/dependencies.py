from fastapi import Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.core.security import decode_token
from app.core.exceptions import UnauthorizedException, ForbiddenException

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    from app.models.user import User
    if not credentials:
        raise UnauthorizedException()
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedException("Invalid token")
    user = db.query(User).filter(User.user_id == int(user_id), User.status == "active").first()
    if not user:
        raise UnauthorizedException("User not found or suspended")
    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    from app.models.user import User
    if not credentials:
        return None
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.query(User).filter(User.user_id == int(user_id), User.status == "active").first()


def require_admin(current_user=Depends(get_current_user)):
    if current_user.role != "admin":
        raise ForbiddenException("Admin access required")
    return current_user


def require_author_or_admin(current_user=Depends(get_current_user)):
    if current_user.role not in ("admin", "author"):
        raise ForbiddenException("Author or admin access required")
    return current_user
