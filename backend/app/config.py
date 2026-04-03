from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "ELearning Platform"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "change-me-in-production"

    # Database
    DATABASE_URL: str = "mysql+pymysql://elearning:elearning123@mysql:3306/elearning"

    # JWT
    JWT_SECRET_KEY: str = "jwt-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # VNPay
    VNPAY_TMN_CODE: str = ""
    VNPAY_HASH_SECRET: str = ""
    VNPAY_URL: str = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
    VNPAY_RETURN_URL: str = "http://localhost/api/payment/vnpay-return"

    # Mux
    MUX_TOKEN_ID: str = ""
    MUX_TOKEN_SECRET: str = ""
    MUX_SIGNING_KEY_ID: str = ""
    MUX_SIGNING_PRIVATE_KEY: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost,http://localhost:80,http://127.0.0.1"

    # File Upload
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE_MB: int = 50

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
