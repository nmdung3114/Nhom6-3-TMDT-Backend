from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.product import Product, Course, Module, Lesson
from app.models.order import UserAccess
from app.models.course import LearningProgress
from app.core.exceptions import ForbiddenException, BadRequestException, NotFoundException
import io
import os

router = APIRouter(prefix="/api/certificates", tags=["certificates"])

# Certificate template colors
BG_COLOR = (10, 10, 35)
GOLD_COLOR = (212, 175, 55)
WHITE_COLOR = (255, 255, 255)
PURPLE_COLOR = (99, 102, 241)
LIGHT_GRAY = (180, 180, 200)


def _check_completion(db: Session, user_id: int, product_id: int) -> tuple[bool, int, int]:
    """Kiểm tra người dùng đã hoàn thành 100% khóa học chưa."""
    product = db.query(Product).filter(
        Product.product_id == product_id,
        Product.product_type == "course"
    ).first()
    if not product or not product.course:
        return False, 0, 0

    total = product.course.total_lessons or 0
    if total == 0:
        return False, 0, 0

    completed = db.query(LearningProgress).join(Lesson).join(Module).filter(
        Module.course_id == product_id,
        LearningProgress.user_id == user_id,
        LearningProgress.completed == True,
    ).count()

    return completed >= total, completed, total


def _generate_certificate_image(user_name: str, course_name: str, date_str: str) -> bytes:
    """Tạo ảnh certificate bằng Pillow."""
    from PIL import Image, ImageDraw, ImageFont

    W, H = 1200, 800
    img = Image.new("RGB", (W, H), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Background gradient effect (manual)
    for y in range(H):
        ratio = y / H
        r = int(10 + ratio * 15)
        g = int(10 + ratio * 10)
        b = int(35 + ratio * 25)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Border decorative lines
    draw.rectangle([20, 20, W - 20, H - 20], outline=GOLD_COLOR, width=3)
    draw.rectangle([30, 30, W - 30, H - 30], outline=(*GOLD_COLOR[:3], 80), width=1)

    # Corner decorations
    corner_size = 40
    for cx, cy in [(50, 50), (W - 50, 50), (50, H - 50), (W - 50, H - 50)]:
        draw.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=GOLD_COLOR)

    # Try to load fonts, fallback to default
    try:
        font_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
        title_font = ImageFont.truetype(os.path.join(font_dir, "Roboto-Bold.ttf"), 52)
        subtitle_font = ImageFont.truetype(os.path.join(font_dir, "Roboto-Regular.ttf"), 28)
        name_font = ImageFont.truetype(os.path.join(font_dir, "Roboto-Bold.ttf"), 44)
        course_font = ImageFont.truetype(os.path.join(font_dir, "Roboto-Regular.ttf"), 30)
        small_font = ImageFont.truetype(os.path.join(font_dir, "Roboto-Regular.ttf"), 20)
    except Exception:
        title_font = ImageFont.load_default()
        subtitle_font = title_font
        name_font = title_font
        course_font = title_font
        small_font = title_font

    # Header - Logo area
    draw.ellipse([W // 2 - 45, 60, W // 2 + 45, 150], fill=PURPLE_COLOR)
    try:
        emoji_font = ImageFont.load_default()
        draw.text((W // 2, 105), "🎓", font=emoji_font, anchor="mm", fill=WHITE_COLOR)
    except Exception:
        pass

    # ELearnVN brand
    draw.text((W // 2, 170), "ELearnVN", font=subtitle_font, anchor="mm", fill=GOLD_COLOR)

    # Certificate title
    draw.text((W // 2, 230), "CHỨNG CHỈ HOÀN THÀNH", font=title_font, anchor="mm", fill=WHITE_COLOR)

    # Decorative line
    line_y = 280
    draw.line([(200, line_y), (W - 200, line_y)], fill=GOLD_COLOR, width=2)

    # "Trao cho" text
    draw.text((W // 2, 320), "Trao cho", font=subtitle_font, anchor="mm", fill=LIGHT_GRAY)

    # User name — highlighted
    draw.text((W // 2, 385), user_name, font=name_font, anchor="mm", fill=GOLD_COLOR)

    # Decorative line under name
    name_bbox = draw.textbbox((W // 2, 385), user_name, font=name_font, anchor="mm")
    name_width = name_bbox[2] - name_bbox[0]
    draw.line([(W // 2 - name_width // 2, 415), (W // 2 + name_width // 2, 415)], fill=GOLD_COLOR, width=1)

    # "đã hoàn thành xuất sắc khóa học"
    draw.text((W // 2, 450), "đã hoàn thành xuất sắc khóa học", font=subtitle_font, anchor="mm", fill=LIGHT_GRAY)

    # Course name
    # Wrap if too long
    max_width = 800
    words = course_name.split()
    lines_text = []
    current_line = ""
    for word in words:
        test = (current_line + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=course_font)
        if bbox[2] - bbox[0] > max_width and current_line:
            lines_text.append(current_line)
            current_line = word
        else:
            current_line = test
    if current_line:
        lines_text.append(current_line)

    course_y = 505
    for line in lines_text:
        draw.text((W // 2, course_y), f'"{line}"', font=course_font, anchor="mm", fill=WHITE_COLOR)
        course_y += 40

    # Bottom section
    draw.line([(200, H - 120), (W - 200, H - 120)], fill=GOLD_COLOR, width=1)

    # Date and signature area
    draw.text((300, H - 100), f"Ngày cấp: {date_str}", font=small_font, anchor="mm", fill=LIGHT_GRAY)
    draw.text((W // 2, H - 100), "ELearnVN Platform", font=small_font, anchor="mm", fill=LIGHT_GRAY)
    draw.text((W - 300, H - 100), "Chứng nhận hoàn thành 100%", font=small_font, anchor="mm", fill=GOLD_COLOR)

    # Save to bytes
    buf = io.BytesIO()
    img.save(buf, format="PNG", quality=95)
    buf.seek(0)
    return buf.read()


@router.get("/check/{product_id}")
def check_certificate_eligibility(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Kiểm tra xem người dùng có đủ điều kiện nhận certificate chưa."""
    # Check access
    access = db.query(UserAccess).filter(
        UserAccess.user_id == current_user.user_id,
        UserAccess.product_id == product_id,
        UserAccess.is_active == True,
    ).first()
    if not access:
        raise ForbiddenException("Bạn chưa mua khóa học này")

    is_complete, completed, total = _check_completion(db, current_user.user_id, product_id)
    return {
        "eligible": is_complete,
        "completed_lessons": completed,
        "total_lessons": total,
        "percentage": round(completed / total * 100) if total > 0 else 0,
    }


@router.get("/{product_id}")
def get_certificate(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo và trả về certificate PNG cho người dùng đã hoàn thành khóa học."""
    # Check access
    access = db.query(UserAccess).filter(
        UserAccess.user_id == current_user.user_id,
        UserAccess.product_id == product_id,
        UserAccess.is_active == True,
    ).first()
    if not access:
        raise ForbiddenException("Bạn chưa mua khóa học này")

    # Check completion
    is_complete, completed, total = _check_completion(db, current_user.user_id, product_id)
    if not is_complete:
        raise BadRequestException(
            f"Bạn mới hoàn thành {completed}/{total} bài học. Cần hoàn thành 100% để nhận chứng chỉ."
        )

    # Get course name
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise NotFoundException("Khóa học không tồn tại")

    date_str = datetime.now().strftime("%d/%m/%Y")
    image_bytes = _generate_certificate_image(
        user_name=current_user.name,
        course_name=product.name,
        date_str=date_str,
    )

    safe_name = "".join(c for c in product.name if c.isalnum() or c in (' ', '-', '_')).strip()
    filename = f"certificate_{safe_name}_{current_user.user_id}.png"

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
