from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from typing import Optional
from app.database import get_db
from app.models.product import Product, Course, Module, Lesson, Ebook
from app.models.order import UserAccess
from app.models.course import LearningProgress
from app.services.mux_service import get_mux_playback_url, get_ebook_access_url
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.core.security import verify_signed_url_token
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.product import LessonDetailResponse
import os

router = APIRouter(prefix="/api/learning", tags=["learning"])


def _check_access(db: Session, user_id: int, product_id: int):
    access = db.query(UserAccess).filter(
        UserAccess.user_id == user_id,
        UserAccess.product_id == product_id,
        UserAccess.is_active == True,
    ).first()
    if not access:
        raise ForbiddenException("Bạn chưa mua sản phẩm này")
    return access


@router.get("/my-courses")
def get_my_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all products user has access to."""
    access_list = db.query(UserAccess).filter(
        UserAccess.user_id == current_user.user_id,
        UserAccess.is_active == True,
    ).all()

    results = []
    for access in access_list:
        product = db.query(Product).filter(Product.product_id == access.product_id).first()
        if product:
            # Get progress for courses
            progress = None
            if product.product_type == "course" and product.course:
                total = product.course.total_lessons or 0
                completed = db.query(LearningProgress).join(Lesson).join(Module).filter(
                    Module.course_id == product.product_id,
                    LearningProgress.user_id == current_user.user_id,
                    LearningProgress.completed == True,
                ).count()
                progress = {"completed": completed, "total": total}
            results.append({
                "product_id": product.product_id,
                "name": product.name,
                "thumbnail_url": product.thumbnail_url,
                "product_type": product.product_type,
                "granted_at": access.granted_at,
                "progress": progress,
            })
    return results


@router.get("/course/{product_id}")
def get_course_content(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full course content with signed video URLs."""
    _check_access(db, current_user.user_id, product_id)

    product = db.query(Product).options(
        joinedload(Product.course).joinedload(Course.modules).joinedload(Module.lessons)
    ).filter(Product.product_id == product_id, Product.product_type == "course").first()

    if not product:
        raise NotFoundException("Khóa học không tồn tại")

    # Get user progress
    progress_map = {}
    progress_list = db.query(LearningProgress).join(Lesson).join(Module).filter(
        Module.course_id == product_id,
        LearningProgress.user_id == current_user.user_id,
    ).all()
    for p in progress_list:
        progress_map[p.lesson_id] = {
            "completed": p.completed,
            "watched_seconds": p.watched_seconds,
        }

    modules = []
    for m in (product.course.modules if product.course else []):
        lessons = []
        for l in m.lessons:
            signed_url = get_mux_playback_url(l.mux_playback_id) if l.mux_playback_id else None
            lessons.append({
                "lesson_id": l.lesson_id,
                "title": l.title,
                "duration": l.duration,
                "sort_order": l.sort_order,
                "stream_url": signed_url,
                "progress": progress_map.get(l.lesson_id, {"completed": False, "watched_seconds": 0}),
            })
        modules.append({
            "module_id": m.module_id,
            "title": m.title,
            "sort_order": m.sort_order,
            "lessons": lessons,
        })

    return {
        "product_id": product.product_id,
        "name": product.name,
        "thumbnail_url": product.thumbnail_url,
        "modules": modules,
        "level": product.course.level if product.course else None,
    }


@router.get("/ebook/{product_id}")
def get_ebook_content(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get ebook signed access URL."""
    _check_access(db, current_user.user_id, product_id)

    product = db.query(Product).options(joinedload(Product.ebook)).filter(
        Product.product_id == product_id, Product.product_type == "ebook"
    ).first()
    if not product:
        raise NotFoundException("Ebook không tồn tại")

    download_url = get_ebook_access_url(product_id, current_user.user_id)
    return {
        "product_id": product_id,
        "name": product.name,
        "format": product.ebook.format if product.ebook else None,
        "page_count": product.ebook.page_count if product.ebook else None,
        "download_url": download_url,
    }


@router.get("/ebook/{product_id}/download")
def download_ebook(
    product_id: int,
    token: str,
    db: Session = Depends(get_db),
):
    """Serve ebook file with signed token verification."""
    payload = verify_signed_url_token(token)
    if not payload or payload.get("product_id") != product_id:
        raise ForbiddenException("Token không hợp lệ hoặc đã hết hạn")

    ebook = db.query(Ebook).filter(Ebook.product_id == product_id).first()
    if not ebook or not ebook.file_key:
        raise NotFoundException("File ebook không tìm thấy")

    from app.config import settings
    file_path = os.path.join(settings.UPLOAD_DIR, ebook.file_key)
    if not os.path.exists(file_path):
        raise NotFoundException("File không tồn tại trên server")

    def iter_file():
        with open(file_path, "rb") as f:
            yield from f

    filename = ebook.file_key.split("/")[-1]
    return StreamingResponse(
        iter_file(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/progress/{lesson_id}")
def update_progress(
    lesson_id: int,
    watched_seconds: int = 0,
    completed: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update lesson watch progress."""
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if not lesson:
        raise NotFoundException(f"Bài học {lesson_id} không tồn tại")
    progress = db.query(LearningProgress).filter(
        LearningProgress.user_id == current_user.user_id,
        LearningProgress.lesson_id == lesson_id,
    ).first()
    if progress:
        progress.watched_seconds = max(progress.watched_seconds or 0, watched_seconds)
        if completed and not progress.completed:
            progress.completed = True
            progress.completed_at = datetime.now()
        progress.updated_at = datetime.now()
    else:
        progress = LearningProgress(
            user_id=current_user.user_id,
            lesson_id=lesson_id,
            watched_seconds=watched_seconds,
            completed=completed,
            completed_at=datetime.now() if completed else None,
            updated_at=datetime.now(),
        )
        db.add(progress)
    db.commit()
    return {"lesson_id": lesson_id, "completed": progress.completed, "watched_seconds": progress.watched_seconds}
