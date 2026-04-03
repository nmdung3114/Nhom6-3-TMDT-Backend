"""
Database initialization & seed data script.
Run once after docker-compose up to populate test data.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, SessionLocal, Base
from app.models import *  # import all models
from app.core.security import get_password_hash
from app.models.user import User
from app.models.product import Product, Category, Course, Module, Lesson, Ebook
from app.models.order import Coupon
from decimal import Decimal
import time

print("⏳ Waiting for database...")
time.sleep(5)

print("📦 Creating tables...")
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # ── Categories ─────────────────────────────────────────
    if db.query(Category).count() == 0:
        categories = [
            Category(name="Lập trình Web", description="HTML, CSS, JavaScript, React, Django, FastAPI...", icon="💻", sort_order=1),
            Category(name="Data Science & AI", description="Machine Learning, Deep Learning, Python, TensorFlow...", icon="🤖", sort_order=2),
            Category(name="Mobile Development", description="React Native, Flutter, iOS, Android...", icon="📱", sort_order=3),
            Category(name="UI/UX Design", description="Figma, Adobe XD, Prototyping, Design Systems...", icon="🎨", sort_order=4),
            Category(name="Business & Marketing", description="Digital Marketing, SEO, Social Media, Sales...", icon="📈", sort_order=5),
            Category(name="DevOps & Cloud", description="Docker, Kubernetes, AWS, CI/CD...", icon="☁️", sort_order=6),
        ]
        db.bulk_save_objects(categories)
        db.commit()
        print("✅ Categories created")

    # ── Users ──────────────────────────────────────────────
    if db.query(User).count() == 0:
        users = [
            User(
                email="admin@elearning.vn",
                password_hash=get_password_hash("admin123"),
                name="Quản trị viên",
                role="admin",
                status="active",
                avatar_url="https://api.dicebear.com/7.x/initials/svg?seed=Admin",
            ),
            User(
                email="author@elearning.vn",
                password_hash=get_password_hash("author123"),
                name="Nguyễn Văn Tác Giả",
                role="author",
                status="active",
                avatar_url="https://api.dicebear.com/7.x/initials/svg?seed=Author",
            ),
            User(
                email="user@elearning.vn",
                password_hash=get_password_hash("user123"),
                name="Trần Thị Học Viên",
                role="learner",
                status="active",
                avatar_url="https://api.dicebear.com/7.x/initials/svg?seed=User",
            ),
        ]
        db.bulk_save_objects(users)
        db.commit()
        print("✅ Users created (admin/admin123, author/author123, user/user123)")

    # ── Products ───────────────────────────────────────────
    if db.query(Product).count() == 0:
        author = db.query(User).filter(User.role == "author").first()
        cat_web = db.query(Category).filter(Category.name == "Lập trình Web").first()
        cat_ai = db.query(Category).filter(Category.name == "Data Science & AI").first()
        cat_mobile = db.query(Category).filter(Category.name == "Mobile Development").first()
        cat_design = db.query(Category).filter(Category.name == "UI/UX Design").first()
        cat_business = db.query(Category).filter(Category.name == "Business & Marketing").first()

        products_data = [
            {
                "product": Product(
                    category_id=cat_web.category_id, name="Fullstack Web với React & FastAPI",
                    price=Decimal("799000"), original_price=Decimal("1200000"),
                    description="Khóa học toàn diện xây dựng ứng dụng web với React (frontend) và FastAPI (backend). Bạn sẽ học cách tạo REST API, quản lý state, authentication, deployment và nhiều hơn nữa.",
                    short_description="Xây dựng ứng dụng web full-stack chuyên nghiệp từ A-Z",
                    thumbnail_url="https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=640&q=80",
                    status="active", product_type="course", author_id=author.user_id if author else None,
                    total_enrolled=1234, average_rating=Decimal("4.8"), review_count=256,
                ),
                "course": Course(duration=3600, level="intermediate", total_lessons=48,
                    requirements='["Biết HTML/CSS cơ bản", "Biết Python cơ bản"]',
                    what_you_learn='["React hooks và state management", "FastAPI REST API", "Docker deployment", "Database với PostgreSQL"]'),
                "modules": [
                    {"title": "Giới thiệu & Setup môi trường", "lessons": [
                        {"title": "Giới thiệu khóa học", "duration": 300, "is_preview": True},
                        {"title": "Cài đặt Node.js và Python", "duration": 600, "is_preview": True},
                        {"title": "Tổng quan kiến trúc", "duration": 450},
                    ]},
                    {"title": "React Frontend Cơ Bản", "lessons": [
                        {"title": "Components và Props", "duration": 900},
                        {"title": "State và Event Handling", "duration": 1200},
                        {"title": "React Hooks (useState, useEffect)", "duration": 1500},
                        {"title": "React Router", "duration": 900},
                    ]},
                    {"title": "FastAPI Backend", "lessons": [
                        {"title": "FastAPI cơ bản", "duration": 1200},
                        {"title": "SQLAlchemy ORM", "duration": 1500},
                        {"title": "Authentication với JWT", "duration": 1800},
                    ]},
                ],
            },
            {
                "product": Product(
                    category_id=cat_ai.category_id, name="Machine Learning với Python từ Zero",
                    price=Decimal("599000"), original_price=Decimal("999000"),
                    description="Khóa học Machine Learning toàn diện từ cơ bản đến nâng cao. Học Numpy, Pandas, Scikit-learn, TensorFlow và deploy model lên production.",
                    short_description="Học ML/AI thực chiến với Python và TensorFlow",
                    thumbnail_url="https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=640&q=80",
                    status="active", product_type="course", author_id=author.user_id if author else None,
                    total_enrolled=2156, average_rating=Decimal("4.9"), review_count=412,
                ),
                "course": Course(duration=5400, level="beginner", total_lessons=72,
                    requirements='["Biết Python cơ bản", "Toán học cơ bản"]',
                    what_you_learn='["Numpy và Pandas", "Supervised Learning", "Neural Networks", "Model deployment"]'),
                "modules": [
                    {"title": "Python cho Data Science", "lessons": [
                        {"title": "Numpy cơ bản", "duration": 1200, "is_preview": True},
                        {"title": "Pandas DataFrame", "duration": 1500},
                        {"title": "Matplotlib và Seaborn", "duration": 900},
                    ]},
                    {"title": "Machine Learning Cơ Bản", "lessons": [
                        {"title": "Linear Regression", "duration": 1800},
                        {"title": "Classification với Logistic Regression", "duration": 1500},
                        {"title": "Decision Trees và Random Forest", "duration": 1800},
                    ]},
                ],
            },
            {
                "product": Product(
                    category_id=cat_mobile.category_id, name="Flutter App Development",
                    price=Decimal("699000"), original_price=Decimal("1100000"),
                    description="Build cross-platform mobile apps với Flutter và Dart. Từ UI components đến state management với BLoC, deploy lên App Store và Google Play.",
                    short_description="Tạo app iOS & Android với một codebase duy nhất",
                    thumbnail_url="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=640&q=80",
                    status="active", product_type="course", author_id=author.user_id if author else None,
                    total_enrolled=867, average_rating=Decimal("4.7"), review_count=134,
                ),
                "course": Course(duration=4200, level="intermediate", total_lessons=56,
                    requirements='["Biết lập trình OOP", "Kiến thức mobile app cơ bản"]',
                    what_you_learn='["Dart programming", "Flutter widgets", "BLoC state management", "Firebase integration"]'),
                "modules": [
                    {"title": "Flutter & Dart Basics", "lessons": [
                        {"title": "Giới thiệu Flutter", "duration": 600, "is_preview": True},
                        {"title": "Dart language essentials", "duration": 1800},
                        {"title": "Widget tree và layout", "duration": 1500},
                    ]},
                ],
            },
            {
                "product": Product(
                    category_id=cat_design.category_id, name="UI/UX Design Masterclass với Figma",
                    price=Decimal("499000"), original_price=Decimal("800000"),
                    description="Học thiết kế UI/UX chuyên nghiệp với Figma. Từ wireframe, prototype đến design system hoàn chỉnh. Xây dựng portfolio thu hút nhà tuyển dụng.",
                    short_description="Thiết kế UI/UX pro với Figma từ A-Z",
                    thumbnail_url="https://images.unsplash.com/photo-1561070791-2526d30994b5?w=640&q=80",
                    status="active", product_type="course", author_id=author.user_id if author else None,
                    total_enrolled=543, average_rating=Decimal("4.6"), review_count=89,
                ),
                "course": Course(duration=2700, level="beginner", total_lessons=36,
                    requirements='["Không cần kinh nghiệm trước"]',
                    what_you_learn='["UI principles", "Figma advanced", "Prototyping", "Design systems"]'),
                "modules": [
                    {"title": "Design Fundamentals", "lessons": [
                        {"title": "Nguyên tắc thiết kế UI cơ bản", "duration": 900, "is_preview": True},
                        {"title": "Color theory và Typography", "duration": 1200},
                    ]},
                ],
            },
        ]

        # Ebooks
        ebooks_data = [
            {
                "product": Product(
                    category_id=cat_web.category_id, name="Clean Code - Nghệ thuật viết code sạch",
                    price=Decimal("149000"), original_price=Decimal("250000"),
                    description="Bản dịch và chú giải cuốn sách nổi tiếng Clean Code của Robert C. Martin. Học cách viết code dễ đọc, dễ maintain và dễ test.",
                    short_description="Học cách viết code sạch, rõ ràng và dễ bảo trì",
                    thumbnail_url="https://images.unsplash.com/photo-1532012197267-da84d127e765?w=640&q=80",
                    status="active", product_type="ebook", author_id=author.user_id if author else None,
                    total_enrolled=3421, average_rating=Decimal("4.9"), review_count=678,
                ),
                "ebook": Ebook(file_size=Decimal("8.5"), format="pdf", page_count=464, preview_pages=20),
            },
            {
                "product": Product(
                    category_id=cat_ai.category_id, name="Deep Learning với Python - Hướng dẫn thực chiến",
                    price=Decimal("199000"), original_price=Decimal("350000"),
                    description="Ebook toàn diện về Deep Learning với Python và Keras/TensorFlow. Từ cơ bản đến các kiến trúc CNN, RNN, Transformer.",
                    short_description="Hướng dẫn thực chiến Deep Learning với Python",
                    thumbnail_url="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=640&q=80",
                    status="active", product_type="ebook", author_id=author.user_id if author else None,
                    total_enrolled=1876, average_rating=Decimal("4.7"), review_count=234,
                ),
                "ebook": Ebook(file_size=Decimal("12.3"), format="pdf", page_count=512, preview_pages=15),
            },
            {
                "product": Product(
                    category_id=cat_business.category_id, name="Digital Marketing 2024 - Chiến lược & Thực thi",
                    price=Decimal("129000"), original_price=Decimal("200000"),
                    description="Cẩm nang Digital Marketing đầy đủ nhất 2024. Bao gồm SEO, Google Ads, Facebook Ads, Email Marketing, Content Strategy.",
                    short_description="Cẩm nang Digital Marketing toàn diện 2024",
                    thumbnail_url="https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=640&q=80",
                    status="active", product_type="ebook", author_id=author.user_id if author else None,
                    total_enrolled=987, average_rating=Decimal("4.5"), review_count=156,
                ),
                "ebook": Ebook(file_size=Decimal("5.2"), format="pdf", page_count=280, preview_pages=12),
            },
        ]

        # Create courses
        for pd in products_data:
            p = pd["product"]
            db.add(p)
            db.flush()
            c = pd["course"]
            c.product_id = p.product_id
            db.add(c)
            db.flush()
            for idx, mod_data in enumerate(pd.get("modules", [])):
                m = Module(course_id=p.product_id, title=mod_data["title"], sort_order=idx)
                db.add(m)
                db.flush()
                for l_idx, l_data in enumerate(mod_data.get("lessons", [])):
                    l = Lesson(
                        module_id=m.module_id,
                        title=l_data["title"],
                        duration=l_data.get("duration", 600),
                        sort_order=l_idx,
                        is_preview=l_data.get("is_preview", False),
                        mux_playback_id=None,  # Will be set when video is uploaded
                    )
                    db.add(l)

        # Create ebooks
        for ed in ebooks_data:
            p = ed["product"]
            db.add(p)
            db.flush()
            e = ed["ebook"]
            e.product_id = p.product_id
            db.add(e)

        db.commit()
        print("✅ Products created (4 courses + 3 ebooks)")

    # ── Coupons ────────────────────────────────────────────
    if db.query(Coupon).count() == 0:
        coupons = [
            Coupon(code="WELCOME50", discount=Decimal("50000"), discount_type="fixed",
                   min_order_amount=Decimal("200000"), usage_limit=100, is_active=True),
            Coupon(code="SALE20", discount=Decimal("20"), discount_type="percent",
                   min_order_amount=Decimal("500000"), usage_limit=50, is_active=True),
            Coupon(code="NEWUSER", discount=Decimal("100000"), discount_type="fixed",
                   min_order_amount=Decimal("300000"), usage_limit=1000, is_active=True),
        ]
        db.bulk_save_objects(coupons)
        db.commit()
        print("✅ Coupons created (WELCOME50, SALE20, NEWUSER)")

    print("\n🎉 Database initialization complete!")
    print("=" * 50)
    print("📌 Test accounts:")
    print("   Admin:  admin@elearning.vn / admin123")
    print("   Author: author@elearning.vn / author123")
    print("   User:   user@elearning.vn / user123")
    print("📌 Test coupons: WELCOME50, SALE20, NEWUSER")
    print("=" * 50)

except Exception as e:
    print(f"❌ Error: {e}")
    db.rollback()
    raise
finally:
    db.close()
