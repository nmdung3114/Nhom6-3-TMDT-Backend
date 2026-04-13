"""
notification_service.py
Helper functions to create notifications for users and admins.
"""
from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.user import User


def _create(db: Session, user_id: int, type: str, title: str, message: str, link: str = None):
    """Insert a single notification row."""
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        link=link,
    )
    db.add(notif)


def _notify_all_admins(db: Session, type: str, title: str, message: str, link: str = None):
    """Send notification to every admin account."""
    admins = db.query(User).filter(User.role == "admin", User.status == "active").all()
    for admin in admins:
        _create(db, admin.user_id, type, title, message, link)


# ─────────────────────────────────────────────────────────────
# Public helpers — call these from routers, then db.commit()
# ─────────────────────────────────────────────────────────────

def notify_payment_success(db: Session, order_id: int, user_id: int, amount):
    """Thanh toán thành công → notify user + admins."""
    order_link = f"/orders/index.html?order_id={order_id}&status=success"
    admin_link = f"/admin/orders.html"

    _create(
        db, user_id, "success",
        "💳 Thanh toán thành công!",
        f"Đơn hàng #{order_id} đã được thanh toán thành công ({amount:,.0f}đ). Nội dung đã được mở khóa!",
        order_link,
    )
    _notify_all_admins(
        db, "info",
        f"💳 Đơn hàng #{order_id} đã thanh toán",
        f"Người dùng #{user_id} vừa thanh toán thành công đơn #{order_id} ({amount:,.0f}đ).",
        admin_link,
    )


def notify_order_cancelled(db: Session, order_id: int, user_id: int):
    """Hủy đơn → notify user + admins."""
    order_link = f"/orders/index.html"
    admin_link = f"/admin/orders.html"

    _create(
        db, user_id, "warning",
        "🗑 Đơn hàng đã bị hủy",
        f"Đơn hàng #{order_id} của bạn đã được hủy thành công.",
        order_link,
    )
    _notify_all_admins(
        db, "warning",
        f"🗑 Đơn hàng #{order_id} bị hủy",
        f"Người dùng #{user_id} vừa hủy đơn hàng #{order_id}.",
        admin_link,
    )


def notify_refund_requested(db: Session, order_id: int, user_id: int, amount):
    """Yêu cầu hoàn tiền → notify user + admins."""
    order_link = f"/orders/index.html"
    admin_link = f"/admin/orders.html"

    _create(
        db, user_id, "info",
        "↩ Yêu cầu hoàn tiền đã được gửi",
        f"Yêu cầu hoàn tiền cho đơn hàng #{order_id} ({amount:,.0f}đ) đã được ghi nhận. Quyền truy cập đã bị thu hồi.",
        order_link,
    )
    _notify_all_admins(
        db, "warning",
        f"⚠️ Yêu cầu hoàn tiền đơn #{order_id}",
        f"Người dùng #{user_id} vừa yêu cầu hoàn tiền đơn hàng #{order_id} ({amount:,.0f}đ). Vui lòng xử lý!",
        admin_link,
    )


def notify_refund_completed(db: Session, order_id: int, user_id: int, amount):
    """Admin xác nhận hoàn tiền → notify user + admins."""
    order_link = f"/orders/index.html"
    admin_link = f"/admin/orders.html"

    _create(
        db, user_id, "success",
        "✅ Hoàn tiền thành công",
        f"Đơn hàng #{order_id} ({amount:,.0f}đ) đã được hoàn tiền. Quyền truy cập đã bị thu hồi.",
        order_link,
    )
    _notify_all_admins(
        db, "info",
        f"✅ Hoàn tiền đơn #{order_id} hoàn tất",
        f"Đã hoàn tiền thành công cho người dùng #{user_id}, đơn hàng #{order_id} ({amount:,.0f}đ).",
        admin_link,
    )


# ─────────────────────────────────────────────────────────────
# Author / Instructor notifications
# ─────────────────────────────────────────────────────────────

def notify_author_application(db: Session, applicant_user_id: int, applicant_name: str):
    """Learner nộp đơn xin làm giảng viên → notify admins."""
    _notify_all_admins(
        db, "info",
        f"📝 Đơn xin giảng viên từ {applicant_name}",
        f"Người dùng {applicant_name} (#{applicant_user_id}) vừa gửi đơn xin trở thành Giảng viên. Vui lòng kiểm duyệt!",
        "/admin/author-applications.html",
    )


def notify_author_approved(db: Session, user_id: int):
    """Admin duyệt tài khoản giảng viên → notify user."""
    _create(
        db, user_id, "success",
        "🎉 Chúc mừng! Bạn đã trở thành Giảng viên!",
        "Tài khoản giảng viên của bạn đã được phê duyệt. Hãy vào Instructor Dashboard để tạo khóa học đầu tiên của bạn!",
        "/instructor/courses.html",
    )


def notify_author_rejected(db: Session, user_id: int):
    """Admin từ chối tài khoản giảng viên → notify user."""
    _create(
        db, user_id, "warning",
        "❌ Đơn giảng viên bị từ chối",
        "Đơn đăng ký làm giảng viên của bạn chưa được chấp thuận. Bạn có thể gửi lại sau khi cập nhật thông tin.",
        "/profile",
    )


def notify_course_submitted(db: Session, product_id: int, product_name: str, author_name: str):
    """Tác giả gửi khóa học chờ duyệt → notify admins."""
    _notify_all_admins(
        db, "info",
        f"📚 Khóa học chờ duyệt: {product_name}",
        f"Tác giả {author_name} vừa gửi khóa học “{product_name}” (#{product_id}) chờ kiểm duyệt.",
        "/admin/course-approvals.html",
    )


def notify_course_approved(db: Session, user_id: int, product_id: int, product_name: str):
    """Admin duyệt khóa học → notify tác giả."""
    _create(
        db, user_id, "success",
        f"✅ Khóa học đã được duyệt!",
        f"Khóa học “{product_name}” (#{product_id}) đã được phê duyệt và có thể bán trên hệ thống!",
        f"/instructor/courses.html",
    )


def notify_course_rejected(db: Session, user_id: int, product_id: int, product_name: str, reason: str):
    """Admin từ chối khóa học → notify tác giả."""
    _create(
        db, user_id, "error",
        f"❌ Khóa học bị từ chối",
        f"Khóa học “{product_name}” (#{product_id}) bị từ chối. Lý do: {reason}",
        f"/instructor/courses.html",
    )


