from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text

from config import settings
from db import get_db, ping_db
from routes import api_router

# Optional: include your existing routers without changing them
# You can keep adding more includes here if you already have route files.
try:
    from routes import api_router  # routes/__init__.py exposes api_router

    ROUTERS_PRESENT = True
except Exception as _:
    ROUTERS_PRESENT = False

app = FastAPI(title="FastAPI + MSSQL Boilerplate", version="0.1.0")

# CORS (open; tighten later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include all routers
app.include_router(api_router)


@app.on_event("startup")
def _startup():
    print("🚀 Starting FastAPI Server...")
    print(f"🔗 Attempting to connect to MSSQL at {settings.DB_HOST}:{settings.DB_PORT}")
    try:
        ping_db()
        print("✅ Database connection successful.")
    except SQLAlchemyError as e:
        print("❌ Database connection failed:")
        print(f"   {e}")
    if ROUTERS_PRESENT:
        print("🧩 Routers: loaded from routes/")
    else:
        print("🧩 Routers: none found (skipping include)")
    print("✅ Startup complete.\n")


# Mount your existing routers (if present)
if ROUTERS_PRESENT:
    app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/db/ping")
def db_ping():
    ping_db()
    return {"db": "up"}


@app.get("/example-now", summary="Simple sample query to prove the session works")
def example_now(db: Session = Depends(get_db)):
    # SQLAlchemy 2.x: prefer text() for raw SQL
    row = db.execute(text("SELECT SYSDATETIMEOFFSET() AS now_utc_offset")).fetchone()
    return {"now": str(row.now_utc_offset) if row else None}


@app.get("/whoami", summary="Stub endpoint—plug JWT later")
def whoami():
    return {
        "allowed_users_endpoints": settings.USERS_ENDPOINT_ALLOWED,
        "allowed_user_get_endpoints": settings.USER_GET_ENDPOINT_ALLOWED,
        "note": "JWT/roles not enforced yet.",
    }
