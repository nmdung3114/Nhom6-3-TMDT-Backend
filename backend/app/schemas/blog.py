from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ── Post Schemas ──────────────────────────────────────────────

class BlogPostCreate(BaseModel):
    title: str
    content: str


class BlogAuthorInfo(BaseModel):
    user_id: int
    name: str
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class BlogPostListItem(BaseModel):
    post_id: int
    title: str
    content_preview: str          # first ~200 chars
    status: str
    created_at: datetime
    author: BlogAuthorInfo
    comment_count: int = 0

    model_config = {"from_attributes": True}


class BlogPostListResponse(BaseModel):
    items: list[BlogPostListItem]
    total: int
    page: int
    total_pages: int


class BlogPostResponse(BaseModel):
    post_id: int
    title: str
    content: str
    status: str
    created_at: datetime
    updated_at: datetime
    author: BlogAuthorInfo
    comment_count: int = 0

    model_config = {"from_attributes": True}


# ── Comment Schemas ───────────────────────────────────────────

class BlogCommentCreate(BaseModel):
    content: str


class BlogCommentResponse(BaseModel):
    comment_id: int
    post_id: int
    content: str
    status: str
    created_at: datetime
    author: BlogAuthorInfo

    model_config = {"from_attributes": True}


class BlogCommentListResponse(BaseModel):
    items: list[BlogCommentResponse]
    total: int


# ── Admin Schemas ─────────────────────────────────────────────

class BlogPostStatusUpdate(BaseModel):
    status: str   # published | hidden


class BlogCommentStatusUpdate(BaseModel):
    status: str   # visible | hidden
