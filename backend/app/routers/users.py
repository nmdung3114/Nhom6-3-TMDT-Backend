from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.auth import ChangePasswordRequest
from app.core.security import verify_password, get_password_hash
from app.core.exceptions import BadRequestException
from app.models.user import User
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=UserResponse)
def update_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.name:
        current_user.name = data.name
    if data.phone is not None:
        current_user.phone = data.phone
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.password_hash:
        raise BadRequestException("Tài khoản OAuth không thể đổi mật khẩu")
    if not verify_password(data.current_password, current_user.password_hash):
        raise BadRequestException("Mật khẩu hiện tại không đúng")
    if len(data.new_password) < 6:
        raise BadRequestException("Mật khẩu mới phải ít nhất 6 ký tự")
    current_user.password_hash = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}
