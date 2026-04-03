from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/ai", tags=["ai"])

class ChatRequest(BaseModel):
    message: str
    product_id: int = None
    context: str = None  # e.g., "video_timestamp: 02:30"

class ChatResponse(BaseModel):
    reply: str
    role: str = "assistant"

@router.post("/chat", response_model=ChatResponse)
def ai_tutor_chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    AI Tutor Chat endpoint.
    Ngữ cảnh: Học viên đang xem khóa học và hỏi một câu hỏi.
    Hiện tại trả về dummy data. Nếu bạn có GEMINI_API_KEY, bạn có thể gọi API thật ở đây.
    """
    user_msg = req.message.lower()
    
    # Simple rule-based dummy for now
    reply = f"Chào {current_user.name}, đây là trợ lý AI. Bạn vừa hỏi: '{req.message}'."
    
    if "api" in user_msg:
        reply = "API (Application Programming Interface) là phương thức giao tiếp giữa các phần mềm. Trong video này giảng viên đang hướng dẫn cách tạo RESTful API bằng FastAPI."
    elif "lỗi" in user_msg or "error" in user_msg:
        reply = "Nếu bạn gặp lỗi, hãy thử kiểm tra lại logs của Docker hoặc Console (F12) trên trình duyệt nhé. Bạn có muốn tôi giải thích rõ hơn đoạn code nào không?"
    elif "giá" in user_msg or "tiền" in user_msg:
        reply = "Về các vấn đề học phí, bạn có thể kiểm tra ở trang giới thiệu khóa học nhé!"
    else:
        reply = f"Ồ, câu hỏi '{req.message}' rất thú vị. Bạn có thể nói rõ hơn để tôi giải thích chi tiết không?"

    return ChatResponse(reply=reply)
