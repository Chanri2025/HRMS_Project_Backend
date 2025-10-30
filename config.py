import os
from dotenv import load_dotenv

load_dotenv()


def _to_bool(v: str | None, default: bool) -> bool:
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y"}


class Settings:
    PORT: int = int(os.getenv("PORT", "5000"))

    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "1433"))
    DB_USER: str = os.getenv("DB_USER", "")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")
    DB_NAME: str = os.getenv("DB_NAME", "")
    DB_ENCRYPT: bool = _to_bool(os.getenv("DB_ENCRYPT"), True)
    DB_TRUST_SERVER_CERT: bool = _to_bool(os.getenv("DB_TRUST_SERVER_CERT"), True)
    DB_ENABLE_LOG: bool = _to_bool(os.getenv("DB_ENABLE_LOG"), False)

    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me")
    ACCESS_MIN: int = int(os.getenv("ACCESS_MIN", "15"))
    REFRESH_DAYS: int = int(os.getenv("REFRESH_DAYS", "15"))
    USERS_ENDPOINT_ALLOWED: list[str] = [
        r.strip()
        for r in os.getenv("USERS_ENDPOINT_ALLOWED", "").split(",")
        if r.strip()
    ]
    USER_GET_ENDPOINT_ALLOWED: list[str] = [
        r.strip()
        for r in os.getenv("USER_GET_ENDPOINT_ALLOWED", "").split(",")
        if r.strip()
    ]


settings = Settings()
