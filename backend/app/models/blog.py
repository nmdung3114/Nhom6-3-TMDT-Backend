from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database import Base


class BlogPost(Base):
    __tablename__ = "blog_posts"

    post_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    title = Column(String(300), nullable=False)
    content = Column(Text, nullable=False)
    cover_image_url = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="published")  # published | hidden
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    author = relationship("User", back_populates="blog_posts", foreign_keys=[user_id])
    comments = relationship("BlogComment", back_populates="post", cascade="all, delete-orphan")


class BlogComment(Base):
    __tablename__ = "blog_comments"

    comment_id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(Integer, ForeignKey("blog_posts.post_id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="visible")  # visible | hidden
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    post = relationship("BlogPost", back_populates="comments")
    author = relationship("User", back_populates="blog_comments", foreign_keys=[user_id])
