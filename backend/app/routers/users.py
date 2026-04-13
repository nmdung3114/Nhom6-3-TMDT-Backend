from fastapi import APIRouter, Depends, UploadFile, File
import base64
import os
import uuid
import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.user import UserResponse, UserUpdate, AuthorApplicationRequest
from app.schemas.auth import ChangePasswordRequest
from app.core.security import verify_password, get_password_hash
from app.core.exceptions import BadRequestException
from app.models.user import User
from app.dependencies import get_current_user
import base64

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


@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate file type
    allowed_types = {
        "image/jpeg": "jpeg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }
    if file.content_type not in allowed_types:
        raise BadRequestException("Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, GIF)")

    # Read and validate size (max 2MB for base64 storage)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise BadRequestException("Ảnh không được vượt quá 2MB")

    # Convert to base64 data URL
    b64 = base64.b64encode(contents).decode("utf-8")
    mime = file.content_type
    data_url = f"data:{mime};base64,{b64}"

    # Update user avatar_url with data URL
    current_user.avatar_url = data_url
    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/upload-cv")
async def upload_cv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload CV document to server."""
    allowed_types = {
        "application/pdf": ".pdf",
        "application/msword": ".doc",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx"
    }
    if file.content_type not in allowed_types:
        raise BadRequestException("Chỉ chấp nhận file định dạng PDF hoặc Word (.doc, .docx)")

    from app.config import settings
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    ext = allowed_types[file.content_type]
    filename = f"cv_{current_user.user_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise BadRequestException("Dung lượng file CV không được vượt quá 10MB")
        
    with open(filepath, "wb") as f:
        f.write(contents)
        
    return {"url": f"/uploads/{filename}"}


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


@router.post("/apply-author")
def apply_author(
    data: AuthorApplicationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Learner nộp đơn xin trở thành Giảng viên."""
    if current_user.role == "author":
        raise BadRequestException("Bạn đã là Giảng viên rồi!")
    if current_user.role == "admin":
        raise BadRequestException("Tài khoản Admin không cần đăng ký làm Giảng viên")
    if current_user.author_application_status == "pending":
        raise BadRequestException("Đơn đăng ký của bạn đang chờ xét duyệt. Vui lòng đợi!")

    current_user.author_application_status = "pending"
    
    application_data = {
        "specialization": data.specialization,
        "experience": data.experience,
        "portfolio_url": data.portfolio_url,
        "course_topic": data.course_topic,
        "cv_url": data.cv_url,
        "submitted_at": datetime.now().isoformat()
    }
    current_user.author_application_data = json.dumps(application_data)

    from app.services.notification_service import notify_author_application
    notify_author_application(db, current_user.user_id, current_user.name)

    db.commit()
    return {"message": "Đơn đăng ký làm Giảng viên đã được gửi! Admin sẽ xem xét trong thời gian sớm nhất."}


@router.get("/author-status")
def get_author_status(current_user: User = Depends(get_current_user)):
    """Trả về trạng thái đơn đăng ký giảng viên của user hiện tại."""
    return {
        "role": current_user.role,
        "author_application_status": current_user.author_application_status,
    }


