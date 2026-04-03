"""
Mux Video Service + Content Signed URLs
- Video streaming via Mux with signed JWT tokens
- Ebook access via signed JWT tokens (local file serving)
"""
import time
import base64
import jwt as pyjwt
from typing import Optional, Dict, Any
from app.config import settings


def create_mux_signed_token(playback_id: str, expires_seconds: int = 3600) -> str:
    """
    Create a signed JWT token for Mux signed playback URLs.
    Requires MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY in settings.
    """
    if not settings.MUX_SIGNING_KEY_ID or not settings.MUX_SIGNING_PRIVATE_KEY:
        # Sandbox mode: return playback_id directly (public playback)
        return ""

    try:
        private_key_bytes = base64.b64decode(settings.MUX_SIGNING_PRIVATE_KEY)
        payload = {
            "sub": playback_id,
            "aud": "v",  # video audience
            "exp": int(time.time()) + expires_seconds,
            "kid": settings.MUX_SIGNING_KEY_ID,
        }
        token = pyjwt.encode(payload, private_key_bytes, algorithm="RS256")
        return token
    except Exception as e:
        print(f"[MUX] Signed token error: {e}")
        return ""


def get_mux_playback_url(playback_id: str, signed: bool = True) -> str:
    """Get Mux video stream URL."""
    if not playback_id:
        return ""
    if signed and settings.MUX_SIGNING_KEY_ID:
        token = create_mux_signed_token(playback_id)
        if token:
            return f"https://stream.mux.com/{playback_id}.m3u8?token={token}"
    # Public playback
    return f"https://stream.mux.com/{playback_id}.m3u8"


def get_mux_thumbnail_url(playback_id: str, width: int = 640, time_offset: int = 0) -> str:
    """Get Mux video thumbnail URL."""
    if not playback_id:
        return ""
    return f"https://image.mux.com/{playback_id}/thumbnail.jpg?width={width}&time={time_offset}"


def create_ebook_signed_token(product_id: int, user_id: int, expires_seconds: int = 3600) -> str:
    """Create a signed JWT token for ebook access (simulates S3 signed URL)."""
    from app.core.security import create_signed_url_token
    from datetime import timedelta
    return create_signed_url_token(
        {"product_id": product_id, "user_id": user_id, "resource": "ebook"},
        expires_minutes=expires_seconds // 60,
    )


def get_ebook_access_url(product_id: int, user_id: int) -> str:
    """Get signed ebook download URL."""
    token = create_ebook_signed_token(product_id, user_id)
    return f"/api/learning/ebook/{product_id}/download?token={token}"


async def upload_video_to_mux(file_path: str) -> Optional[Dict[str, Any]]:
    """Upload a video file to Mux (requires valid MUX credentials)."""
    if not settings.MUX_TOKEN_ID or not settings.MUX_TOKEN_SECRET:
        # Mock response for development
        return {
            "asset_id": f"mock_asset_{int(time.time())}",
            "playback_id": f"mock_playback_{int(time.time())}",
            "status": "ready",
        }
    try:
        import mux_python
        configuration = mux_python.Configuration()
        configuration.username = settings.MUX_TOKEN_ID
        configuration.password = settings.MUX_TOKEN_SECRET

        with mux_python.ApiClient(configuration) as api_client:
            assets_api = mux_python.AssetsApi(api_client)
            create_input = mux_python.CreateAssetRequest(
                input=[mux_python.InputSettings(url=file_path)],
                playback_policy=[mux_python.PlaybackPolicy.SIGNED],
            )
            result = assets_api.create_asset(create_input)
            playback_id = result.data.playback_ids[0].id if result.data.playback_ids else ""
            return {
                "asset_id": result.data.id,
                "playback_id": playback_id,
                "status": result.data.status,
            }
    except Exception as e:
        print(f"[MUX] Upload error: {e}")
        return None
