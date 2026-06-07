from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class LearningProgress(Base):
    __tablename__ = "learning_progress"

    progress_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.lesson_id"), nullable=False)
    completed = Column(Boolean, default=False)
    watched_seconds = Column(Integer, default=0)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)

    __table_args__ = (UniqueConstraint("user_id", "lesson_id"),)

    user = relationship("User", back_populates="progress_list")
    lesson = relationship("Lesson", back_populates="progress_list")
