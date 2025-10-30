from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus
from config import settings


def _build_connection_url() -> str:
    driver = "ODBC Driver 18 for SQL Server"
    driver_enc = driver.replace(" ", "+")  # URL form: ODBC+Driver+18+for+SQL+Server

    user = settings.DB_USER
    pwd = quote_plus(settings.DB_PASSWORD.strip('"').strip("'"))
    host = settings.DB_HOST
    port = settings.DB_PORT
    db = settings.DB_NAME

    encrypt = "yes" if settings.DB_ENCRYPT else "no"
    trust = "yes" if settings.DB_TRUST_SERVER_CERT else "no"

    return (
        f"mssql+pyodbc://{user}:{pwd}@{host}:{port}/{db}"
        f"?driver={driver_enc}"
        f"&Encrypt={encrypt}"
        f"&TrustServerCertificate={trust}"
    )


engine = create_engine(
    _build_connection_url(),
    pool_pre_ping=True,
    pool_recycle=1800,
    echo=settings.DB_ENABLE_LOG,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ping_db() -> bool:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return True
