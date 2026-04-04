from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, OAuthCallbackRequest
from app.schemas.user import UserResponse
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.exceptions import ConflictException, UnauthorizedException, BadRequestException
from app.models.user import User
from app.dependencies import get_current_user
from pydantic import BaseModel
import httpx

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_CLIENT_ID = "769838445738-qbev0l32b0namp6pq4cea7d41suhsll7.apps.googleusercontent.com"



@router.post("/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise ConflictException("Email đã được sử dụng")
    if len(data.password) < 6:
        raise BadRequestException("Mật khẩu phải ít nhất 6 ký tự")
    user = User(
        email=data.email,
        password_hash=get_password_hash(data.password),
        name=data.name,
        phone=data.phone,
        role="learner",
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.user_id), "role": user.role})
    return TokenResponse(
        access_token=token, user_id=user.user_id,
        name=user.name, email=user.email, role=user.role,
    )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise UnauthorizedException("Email hoặc mật khẩu không đúng")
    if user.status != "active":
        raise UnauthorizedException("Tài khoản đã bị tạm khóa")
    token = create_access_token({"sub": str(user.user_id), "role": user.role})
    return TokenResponse(
        access_token=token, user_id=user.user_id,
        name=user.name, email=user.email, role=user.role,
        avatar_url=user.avatar_url,
    )


@router.post("/oauth/callback", response_model=TokenResponse)
def oauth_callback(data: OAuthCallbackRequest, db: Session = Depends(get_db)):
    """Mock OAuth callback — handles Google/Facebook OAuth flow."""
    user = db.query(User).filter(User.email == data.email).first()
    if user:
        # Update OAuth info
        user.oauth_provider = data.provider
        user.oauth_id = data.oauth_id
        if data.avatar_url and not user.avatar_url:
            user.avatar_url = data.avatar_url
        db.commit()
    else:
        user = User(
            email=data.email,
            name=data.name,
            oauth_provider=data.provider,
            oauth_id=data.oauth_id,
            avatar_url=data.avatar_url,
            role="learner",
            status="active",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    token = create_access_token({"sub": str(user.user_id), "role": user.role})
    return TokenResponse(
        access_token=token, user_id=user.user_id,
        name=user.name, email=user.email, role=user.role,
        avatar_url=user.avatar_url,
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# ── Real Google OAuth ───────────────────────────────────────
class GoogleTokenRequest(BaseModel):
    id_token: str

@router.post("/google", response_model=TokenResponse)
async def google_login(body: GoogleTokenRequest, db: Session = Depends(get_db)):
    """
    Verify a Google ID token from the frontend (Google Identity Services).
    Calls Google's tokeninfo endpoint to validate and extract user info.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.id_token}
        )

    if resp.status_code != 200:
        raise UnauthorizedException("Token Google không hợp lệ")

    info = resp.json()

    # Verify it was issued for our app
    if info.get("aud") != GOOGLE_CLIENT_ID:
        raise UnauthorizedException("Token không thuộc ứng dụng này")

    google_sub  = info.get("sub")          # unique Google user ID
    email       = info.get("email")
    name        = info.get("name") or email.split("@")[0]
    avatar_url  = info.get("picture")
    email_verified = info.get("email_verified") == "true"

    if not email or not email_verified:
        raise BadRequestException("Email Google chưa được xác minh")

    # Find existing user by oauth_id or email
    user = (
        db.query(User).filter(User.oauth_provider == "google", User.oauth_id == google_sub).first()
        or db.query(User).filter(User.email == email).first()
    )

    if user:
        # Update OAuth fields if not set
        user.oauth_provider = "google"
        user.oauth_id = google_sub
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        db.commit()
    else:
        # Create new user
        user = User(
            email=email,
            name=name,
            oauth_provider="google",
            oauth_id=google_sub,
            avatar_url=avatar_url,
            role="learner",
            status="active",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": str(user.user_id), "role": user.role})
    return TokenResponse(
        access_token=token,
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        role=user.role,
        avatar_url=user.avatar_url,
    )
