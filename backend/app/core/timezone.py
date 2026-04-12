"""
timezone.py — Timezone utilities for Vietnam (UTC+7)

Usage:
    from app.core.timezone import now_vn, VN_TZ
    
    # Instead of datetime.now() use:
    created_at = now_vn()
"""
from datetime import datetime, timedelta, timezone

# Vietnam Standard Time = UTC+7 (no DST)
VN_TZ = timezone(timedelta(hours=7))


def now_vn() -> datetime:
    """Return current datetime in Vietnam timezone (UTC+7), timezone-aware."""
    return datetime.now(VN_TZ)
