from typing import Any, Dict, Optional


def format_vnd(amount: float) -> str:
    """Format amount as VND currency."""
    return f"{int(amount):,}đ".replace(",", ".")


def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def truncate_text(text: str, max_length: int = 100) -> str:
    if not text:
        return ""
    return text[:max_length] + "..." if len(text) > max_length else text
