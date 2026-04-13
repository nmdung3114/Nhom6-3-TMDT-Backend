# Quy định Làm việc nhóm (Team Collaboration Guidelines)

Đây là tài liệu tiêu chuẩn dành cho toàn bộ đội ngũ phát triển dự án ELearnVN. Vui lòng tuân thủ chặt chẽ các quy định dưới đây để đảm bảo chất lượng source code, hạn chế xung đột (conflict) và triển khai thuận lợi.

## 1. Cấu trúc Nhánh (Branching Strategy)
Dự án áp dụng mô hình luồng làm việc dựa trên Git Flow tiêu chuẩn:

*   **`main`**: Nhánh chứa source code ổn định nhất, sẵn sàng đưa lên môi trường Production. **Tuyệt đối không commit trực tiếp** lên nhánh này.
*   **`develop`**: Nhánh phát triển chính. Chứa code đã được review từ các nhánh `feature` và chuẩn bị cho đợt release tiếp theo. Tất cả nhánh `feature` đều tách từ đây và merge về lại đây.
*   **`feature/<tên-tính-năng>`**: Nhánh dùng để phát triển các tính năng mới hoặc sửa đổi UI. Từ khóa tên tính năng ghi bằng chữ thường, cách nhau bởi dấu gạch ngang (VD: `feature/instructor-dashboard`, `feature/payment-momo`).
*   **`bugfix/<tên-lỗi>`**: Nhánh dùng để fix các bug nhỏ lẻ phát sinh trong quá trình phát triển trên nhánh `develop`.
*   **`hotfix/<tên-lỗi>`**: Nhánh để sửa lỗi khẩn cấp trực tiếp từ nhánh `main` khi đã lên Production. Sau khi sửa xong phải merge lại vào cả `main` và `develop`.

---

## 2. Quy tắc Commit Message
Dự án sử dụng format **Conventional Commits**:

`<type>(<scope>): <subject>`

*   **type**:
    *   `feat`: Thêm tính năng mới.
    *   `fix`: Sửa lỗi (bug fix).
    *   `docs`: Cập nhật tài liệu (README, CONTRIBUTING,...).
    *   `style`: Format lại code (khoảng trắng, dấu phẩy...) không làm thay đổi logic.
    *   `refactor`: Sửa đổi cấu trúc code không thêm tính năng mới và không sửa bug.
    *   `test`: Thêm mới hoặc sửa test script.
    *   `chore`: Cập nhật cấu hình build/tools, dependencies.
*   **scope** (tùy chọn): Tên phạm vi ảnh hưởng (backend, frontend, database,...).
*   **subject**: Mô tả ngắn gọn thay đổi bằng tiếng Việt hoặc tiếng Anh, viết thường, không có dấu chấm ở cuối.

*Ví dụ:* `feat(backend): thêm API phê duyệt đơn đăng ký giảng viên`

---

## 3. Quy trình Pull Request (PR)
1. Cập nhật nhánh `develop` mới nhất về máy tính: `git checkout develop && git pull origin develop`
2. Tách nhánh mới để làm việc: `git checkout -b feature/your-feature-name`
3. Tiến hành viết code và thao tác Commit với thông điệp rõ ràng theo chuẩn.
4. Push lên repo: `git push origin feature/your-feature-name`
5. Tạo **Pull Request (PR)** trên GitHub/GitLab đưa nhánh của bạn gộp vào `develop`.
6. Yêu cầu ít nhất 1 thành viên khác **Review Code** (Approve) trước khi được merge.

---

## 4. Cài đặt Môi trường Phát triển Backend (FastAPI)
Đảm bảo bạn đã cài đặt Python 3.10+ trên máy tính trước khi bắt đầu.

### 4.1. Thiết lập môi trường ảo (Virtual Environment)
Mở terminal tại thư mục gốc của dự án (`ecommerce-learning-platform`) và chạy các lệnh sau:

**Windows (PowerShell):**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
```

**Linux/MacOS:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

### 4.2. Quản lý thư viện (Dependencies)
Install toàn bộ thư viện cần thiết cho Backend:
```bash
pip install -r requirements.txt
```

### 4.3. Cấu hình biến môi trường
Tạo file `.env` tại thư mục `backend/` dựa trên `backend/.env.example` (nếu có). Cấu hình kết nối MySQL và JWT.
```env
DATABASE_URL=mysql+pymysql://elearning:elearning123@127.0.0.1:3306/elearning
SECRET_KEY=yoursecretkeyhere
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=43200
```

### 4.4. Chạy Backend (Local)
Dùng Uvicorn Server để chạy ứng dụng (Live Reload):
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Truy cập API Docs tại: `http://localhost:8000/docs`

---

## 5. Quy định chung về Coding Convention
*   **Backend (Python)**: Tuân thủ chuẩn **PEP 8**, nên cài đặt Extension như `Black` và `Flake8` vào IDE. Sử dụng Type Hinting cho mọi Functions.
*   **Frontend (JS/HTML/CSS)**: Định dạng mã bằng `Prettier` trước khi thực hiện commit. Các Component phân tách rõ ràng; không dùng chung scope lẫn lộn.
*   Tránh viết inline CSS nếu không thật sự cần thiết (Dùng file `.css` trong thư mục `css/components`).
