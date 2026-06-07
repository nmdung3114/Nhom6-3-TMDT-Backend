from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from app.database import get_db
from app.models.blog import BlogPost, BlogComment
from app.models.user import User
from app.schemas.blog import (
    BlogPostCreate, BlogPostResponse, BlogPostListResponse, BlogPostListItem,
    BlogCommentCreate, BlogCommentResponse, BlogCommentListResponse,
    BlogAuthorInfo, BlogPostStatusUpdate, BlogCommentStatusUpdate,
)
from app.core.exceptions import NotFoundException, ForbiddenException, BadRequestException
from app.dependencies import get_current_user, get_current_user_optional, require_admin

router = APIRouter(tags=["blog"])

LIMIT_DEFAULT = 10


def _make_author(user: User) -> BlogAuthorInfo:
    return BlogAuthorInfo(user_id=user.user_id, name=user.name, avatar_url=user.avatar_url)


def _make_post_list_item(post: BlogPost, comment_count: int) -> BlogPostListItem:
    preview = post.content[:200] + ("..." if len(post.content) > 200 else "")
    return BlogPostListItem(
        post_id=post.post_id,
        title=post.title,
        content_preview=preview,
        status=post.status,
        created_at=post.created_at,
        author=_make_author(post.author),
        comment_count=comment_count,
    )


# ═══════════════════════════════════════════════════════════════
# PUBLIC / USER ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get("/api/blog/posts", response_model=BlogPostListResponse)
def list_posts(
    page: int = Query(1, ge=1),
    limit: int = Query(LIMIT_DEFAULT, ge=1, le=50),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Danh sách bài viết đã xuất bản (public)."""
    q = db.query(BlogPost).filter(BlogPost.status == "published")
    if search:
        q = q.filter(BlogPost.title.ilike(f"%{search}%"))
    total = q.count()
    posts = q.order_by(BlogPost.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    # Count comments per post in one query
    post_ids = [p.post_id for p in posts]
    comment_counts = {}
    if post_ids:
        rows = (
            db.query(BlogComment.post_id, func.count(BlogComment.comment_id))
            .filter(BlogComment.post_id.in_(post_ids), BlogComment.status == "visible")
            .group_by(BlogComment.post_id)
            .all()
        )
        comment_counts = {r[0]: r[1] for r in rows}

    items = [_make_post_list_item(p, comment_counts.get(p.post_id, 0)) for p in posts]
    return BlogPostListResponse(
        items=items,
        total=total,
        page=page,
        total_pages=max(1, -(-total // limit)),
    )


@router.post("/api/blog/posts", response_model=BlogPostResponse, status_code=201)
def create_post(
    data: BlogPostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo bài viết mới (yêu cầu đăng nhập)."""
    if not data.title.strip():
        raise BadRequestException("Tiêu đề không được bỏ trống")
    if not data.content.strip():
        raise BadRequestException("Nội dung không được bỏ trống")
    post = BlogPost(
        user_id=current_user.user_id,
        title=data.title.strip(),
        content=data.content.strip(),
        status="published",
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return BlogPostResponse(
        post_id=post.post_id,
        title=post.title,
        content=post.content,
        status=post.status,
        created_at=post.created_at,
        updated_at=post.updated_at,
        author=_make_author(current_user),
        comment_count=0,
    )


@router.get("/api/blog/posts/{post_id}", response_model=BlogPostResponse)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Chi tiết bài viết."""
    post = db.query(BlogPost).filter(BlogPost.post_id == post_id).first()
    if not post:
        raise NotFoundException("Bài viết không tồn tại")
    # Hidden posts: only visible to owner or admin
    if post.status == "hidden":
        if not current_user:
            raise NotFoundException("Bài viết không tồn tại")
        if current_user.user_id != post.user_id and current_user.role != "admin":
            raise NotFoundException("Bài viết không tồn tại")

    comment_count = (
        db.query(func.count(BlogComment.comment_id))
        .filter(BlogComment.post_id == post_id, BlogComment.status == "visible")
        .scalar()
    )
    return BlogPostResponse(
        post_id=post.post_id,
        title=post.title,
        content=post.content,
        status=post.status,
        created_at=post.created_at,
        updated_at=post.updated_at,
        author=_make_author(post.author),
        comment_count=comment_count,
    )


@router.delete("/api/blog/posts/{post_id}", status_code=204)
def delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa bài viết (chủ sở hữu hoặc admin)."""
    post = db.query(BlogPost).filter(BlogPost.post_id == post_id).first()
    if not post:
        raise NotFoundException("Bài viết không tồn tại")
    if post.user_id != current_user.user_id and current_user.role != "admin":
        raise ForbiddenException("Bạn không có quyền xóa bài viết này")
    db.delete(post)
    db.commit()


# ── Comments ──────────────────────────────────────────────────

@router.get("/api/blog/posts/{post_id}/comments", response_model=BlogCommentListResponse)
def list_comments(
    post_id: int,
    db: Session = Depends(get_db),
):
    """Danh sách bình luận của bài viết (public, chỉ visible)."""
    post = db.query(BlogPost).filter(BlogPost.post_id == post_id).first()
    if not post:
        raise NotFoundException("Bài viết không tồn tại")
    comments = (
        db.query(BlogComment)
        .filter(BlogComment.post_id == post_id, BlogComment.status == "visible")
        .order_by(BlogComment.created_at.asc())
        .all()
    )
    items = [
        BlogCommentResponse(
            comment_id=c.comment_id,
            post_id=c.post_id,
            content=c.content,
            status=c.status,
            created_at=c.created_at,
            author=_make_author(c.author),
        )
        for c in comments
    ]
    return BlogCommentListResponse(items=items, total=len(items))


@router.post("/api/blog/posts/{post_id}/comments", response_model=BlogCommentResponse, status_code=201)
def create_comment(
    post_id: int,
    data: BlogCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Thêm bình luận (yêu cầu đăng nhập)."""
    post = db.query(BlogPost).filter(BlogPost.post_id == post_id, BlogPost.status == "published").first()
    if not post:
        raise NotFoundException("Bài viết không tồn tại")
    if not data.content.strip():
        raise BadRequestException("Nội dung bình luận không được bỏ trống")
    comment = BlogComment(
        post_id=post_id,
        user_id=current_user.user_id,
        content=data.content.strip(),
        status="visible",
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return BlogCommentResponse(
        comment_id=comment.comment_id,
        post_id=comment.post_id,
        content=comment.content,
        status=comment.status,
        created_at=comment.created_at,
        author=_make_author(current_user),
    )


@router.delete("/api/blog/comments/{comment_id}", status_code=204)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa bình luận (chủ sở hữu hoặc admin)."""
    comment = db.query(BlogComment).filter(BlogComment.comment_id == comment_id).first()
    if not comment:
        raise NotFoundException("Bình luận không tồn tại")
    if comment.user_id != current_user.user_id and current_user.role != "admin":
        raise ForbiddenException("Bạn không có quyền xóa bình luận này")
    db.delete(comment)
    db.commit()


# ═══════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@router.get("/api/admin/blog/posts", response_model=BlogPostListResponse)
def admin_list_posts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin: xem tất cả bài viết kể cả hidden."""
    q = db.query(BlogPost)
    if status:
        q = q.filter(BlogPost.status == status)
    if search:
        q = q.filter(BlogPost.title.ilike(f"%{search}%"))
    total = q.count()
    posts = q.order_by(BlogPost.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    post_ids = [p.post_id for p in posts]
    comment_counts = {}
    if post_ids:
        rows = (
            db.query(BlogComment.post_id, func.count(BlogComment.comment_id))
            .filter(BlogComment.post_id.in_(post_ids))
            .group_by(BlogComment.post_id)
            .all()
        )
        comment_counts = {r[0]: r[1] for r in rows}

    items = [_make_post_list_item(p, comment_counts.get(p.post_id, 0)) for p in posts]
    return BlogPostListResponse(
        items=items, total=total, page=page,
        total_pages=max(1, -(-total // limit)),
    )


@router.patch("/api/admin/blog/posts/{post_id}/status")
def admin_update_post_status(
    post_id: int,
    data: BlogPostStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin: ẩn/hiện bài viết."""
    if data.status not in ("published", "hidden"):
        raise BadRequestException("Trạng thái không hợp lệ")
    post = db.query(BlogPost).filter(BlogPost.post_id == post_id).first()
    if not post:
        raise NotFoundException("Bài viết không tồn tại")
    post.status = data.status
    db.commit()
    return {"detail": "Cập nhật trạng thái thành công", "status": post.status}


@router.delete("/api/admin/blog/posts/{post_id}", status_code=204)
def admin_delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin: xóa bài viết."""
    post = db.query(BlogPost).filter(BlogPost.post_id == post_id).first()
    if not post:
        raise NotFoundException("Bài viết không tồn tại")
    db.delete(post)
    db.commit()


@router.get("/api/admin/blog/comments")
def admin_list_comments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin: xem tất cả bình luận."""
    q = db.query(BlogComment)
    if status:
        q = q.filter(BlogComment.status == status)
    total = q.count()
    comments = q.order_by(BlogComment.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    items = [
        {
            "comment_id": c.comment_id,
            "post_id": c.post_id,
            "post_title": c.post.title if c.post else "—",
            "content": c.content,
            "status": c.status,
            "created_at": c.created_at.isoformat(),
            "author": {"user_id": c.author.user_id, "name": c.author.name, "avatar_url": c.author.avatar_url},
        }
        for c in comments
    ]
    return {"items": items, "total": total, "page": page, "total_pages": max(1, -(-total // limit))}


@router.patch("/api/admin/blog/comments/{comment_id}/status")
def admin_update_comment_status(
    comment_id: int,
    data: BlogCommentStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin: ẩn/hiện bình luận."""
    if data.status not in ("visible", "hidden"):
        raise BadRequestException("Trạng thái không hợp lệ")
    comment = db.query(BlogComment).filter(BlogComment.comment_id == comment_id).first()
    if not comment:
        raise NotFoundException("Bình luận không tồn tại")
    comment.status = data.status
    db.commit()
    return {"detail": "Cập nhật thành công", "status": comment.status}


@router.delete("/api/admin/blog/comments/{comment_id}", status_code=204)
def admin_delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Admin: xóa bình luận."""
    comment = db.query(BlogComment).filter(BlogComment.comment_id == comment_id).first()
    if not comment:
        raise NotFoundException("Bình luận không tồn tại")
    db.delete(comment)
    db.commit()
