from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, update
from datetime import datetime, timezone
from typing import Optional, List

from db import get_db
from config import settings
from utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    make_refresh_token,
    refresh_exp,
    normalise_role,
)
from models import AuthUser, Role, UserRole, Employee, RefreshToken

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- Helpers to mirror JS ----------
async def get_role_by_name(db: Session, name: str) -> Optional[Role]:
    return db.scalar(select(Role).where(Role.name == name))


async def ensure_role(db: Session, name: str) -> Role:
    r = await get_role_by_name(db, name)
    if not r:
        r = Role(name=name)
        db.add(r)
        db.commit()
        db.refresh(r)
    return r


async def get_all_role_names(db: Session) -> list[str]:
    rows = db.scalars(select(Role.name)).all()
    return list(rows)


async def resolve_default_role(db: Session) -> str:
    env_default = normalise_role(settings.__dict__.get("DEFAULT_ROLE"))
    if env_default:
        if await get_role_by_name(db, env_default):
            return env_default
    all_roles = await get_all_role_names(db)
    if "EMPLOYEE" in all_roles:
        return "EMPLOYEE"
    if all_roles:
        return all_roles[0]
    r = await ensure_role(db, "EMPLOYEE")
    return r.name


def to_user_response(u: AuthUser):
    roles = [r.name for r in (u.Roles or [])]
    e = u.Employee
    return {
        "user_id": u.user_id,
        "email": u.email,
        "full_name": u.full_name,
        "profile_photo": u.profile_photo,
        "is_active": u.is_active,
        "email_verified": u.email_verified,
        "created_at": u.created_at,
        "updated_at": u.updated_at,
        "last_active": u.last_active,
        "role": roles[0] if roles else None,
        "roles": roles or None,
        "employee": (
            {
                "employee_id": e.employee_id,
                "phone": e.phone,
                "address": e.address,
                "fathers_name": e.fathers_name,
                "aadhar_no": e.aadhar_no,
                "date_of_birth": e.date_of_birth,
                "work_position": e.work_position,
                "created_at": e.created_at,
                "updated_at": e.updated_at,
            }
            if e
            else None
        ),
    }


# ---------- Auth dependencies ----------
def get_current_user(
    db: Session = Depends(get_db), authorization: str = Header(None)
) -> AuthUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:].strip()
    try:
        payload = decode_access_token(token)
        uid = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    u = db.get(AuthUser, uid)
    if not u or not u.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    # Eager-load roles + employee
    _ = u.Roles, u.Employee
    return u


def require_roles(*allowed: str):
    allowed_set = {normalise_role(r) for r in allowed}

    def inner(user: AuthUser = Depends(get_current_user)):
        user_roles = {r.name for r in (user.Roles or [])}
        if not any(r in user_roles for r in allowed_set):
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return inner


USERS_ENDPOINT_ALLOWED = [normalise_role(r) for r in settings.USERS_ENDPOINT_ALLOWED]
USER_GET_ENDPOINT_ALLOWED = [
    normalise_role(r) for r in settings.USER_GET_ENDPOINT_ALLOWED
]


# ---------- Public endpoints ----------
@router.post("/register")
def register(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    password = payload.get("password")
    full_name = payload.get("full_name")
    profile_photo = payload.get("profile_photo")
    if not (email and password and full_name):
        raise HTTPException(
            status_code=400, detail="email, password and full_name are required"
        )

    exists = db.scalar(select(AuthUser).where(AuthUser.email == email))
    if exists:
        raise HTTPException(status_code=409, detail="Email already exists")

    user = AuthUser(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        profile_photo=profile_photo,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    role_name = resolve_default_role(db)
    r = db.scalar(select(Role).where(Role.name == role_name))
    if not r:
        r = Role(name=role_name)
        db.add(r)
        db.commit()
        db.refresh(r)
    user.Roles = [r]
    db.commit()
    db.refresh(user)

    # Eager relations
    _ = user.Roles, user.Employee
    return to_user_response(user)


@router.post("/login")
def login(payload: dict, request: Request, db: Session = Depends(get_db)):
    email = payload.get("email")
    password = payload.get("password")
    if not (email and password):
        raise HTTPException(status_code=400, detail="email and password are required")

    u = db.scalar(select(AuthUser).where(AuthUser.email == email))
    if not u or not verify_password(password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    u.last_active = datetime.now(timezone.utc)
    db.commit()
    db.refresh(u)
    _ = u.Roles, u.Employee
    roles = [r.name for r in u.Roles or []]
    access_token = create_access_token(str(u.user_id), roles)

    rt_raw = make_refresh_token()
    new_rt = RefreshToken(
        user_id=u.user_id,
        token_hash=rt_raw["digest"],
        expires_at=refresh_exp(),
        user_agent=str(request.headers.get("user-agent") or "")[:255],
        ip=request.client.host if request.client else None,
    )
    db.add(new_rt)
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": rt_raw["raw"],
        "token_type": "bearer",
        "user": to_user_response(u),
    }


@router.get("/me")
def me(current: AuthUser = Depends(get_current_user)):
    return to_user_response(current)


@router.post("/refresh")
def refresh(payload: dict | None, request: Request, db: Session = Depends(get_db)):
    token = (payload or {}).get("refresh_token")
    if not token:
        # also allow via headers like your JS
        token = request.headers.get("x-refresh-token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    from hashlib import sha256

    digest = sha256(token.encode("utf-8")).hexdigest()

    rt = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == digest, RefreshToken.revoked == False
        )
    )
    if not rt or rt.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    u = db.get(AuthUser, rt.user_id)
    if not u or not u.is_active:
        raise HTTPException(status_code=401, detail="User inactive or missing")

    u.last_active = datetime.now(timezone.utc)
    db.commit()

    rt.revoked = True
    db.commit()

    new_pair = make_refresh_token()
    db.add(
        RefreshToken(
            user_id=u.user_id,
            token_hash=new_pair["digest"],
            expires_at=refresh_exp(),
            user_agent=str(request.headers.get("user-agent") or "")[:255],
            ip=request.client.host if request.client else None,
        )
    )
    db.commit()

    _ = u.Roles, u.Employee
    roles = [r.name for r in u.Roles or []]
    new_access = create_access_token(str(u.user_id), roles)

    return {
        "access_token": new_access,
        "refresh_token": new_pair["raw"],
        "token_type": "bearer",
        "user": to_user_response(u),
    }


# ---------- Admin endpoints ----------
@router.post("/users")
def create_user(
    payload: dict,
    db: Session = Depends(get_db),
    _current: AuthUser = Depends(require_roles(*USERS_ENDPOINT_ALLOWED)),
):
    required = [
        "email",
        "full_name",
        "password",
        "employee_id",
        "phone",
        "address",
        "fathers_name",
        "aadhar_no",
        "date_of_birth",
        "work_position",
    ]
    missing = [k for k in required if not payload.get(k)]
    if missing:
        raise HTTPException(
            status_code=400, detail=f"Missing fields: {', '.join(missing)}"
        )

    if db.scalar(select(AuthUser).where(AuthUser.email == payload["email"])):
        raise HTTPException(status_code=400, detail="Email already exists")
    if db.scalar(
        select(Employee).where(Employee.employee_id == payload["employee_id"])
    ):
        raise HTTPException(status_code=400, detail="employee_id already exists")
    if db.scalar(select(Employee).where(Employee.aadhar_no == payload["aadhar_no"])):
        raise HTTPException(status_code=400, detail="aadhar_no already exists")

    u = AuthUser(
        email=payload["email"],
        password_hash=hash_password(payload["password"]),
        full_name=payload["full_name"],
        profile_photo=payload.get("profile_photo"),
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    e = Employee(
        user_id=u.user_id,
        employee_id=payload["employee_id"],
        phone=payload["phone"],
        address=payload["address"],
        fathers_name=payload["fathers_name"],
        aadhar_no=payload["aadhar_no"],
        date_of_birth=payload["date_of_birth"],
        work_position=payload["work_position"],
    )
    db.add(e)

    wanted_role = normalise_role(payload.get("role")) or resolve_default_role(db)
    r = db.scalar(select(Role).where(Role.name == wanted_role))
    if not r:
        r = Role(name=wanted_role)
        db.add(r)
        db.commit()
        db.refresh(r)

    u.Roles = [r]
    db.commit()
    db.refresh(u)
    _ = u.Roles, u.Employee
    return to_user_response(u)


@router.get("/users")
def list_users(
    q: Optional[str] = None,
    employee_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _current: AuthUser = Depends(require_roles(*USERS_ENDPOINT_ALLOWED)),
):
    stmt = select(AuthUser).order_by(AuthUser.created_at.desc())
    if q:
        from sqlalchemy import or_

        stmt = stmt.where(
            or_(AuthUser.email.ilike(f"%{q}%"), AuthUser.full_name.ilike(f"%{q}%"))
        )
    rows = db.scalars(stmt).all()
    # Eager
    for u in rows:
        _ = u.Roles, u.Employee
    if employee_id:
        rows = [u for u in rows if u.Employee and u.Employee.employee_id == employee_id]
    return [to_user_response(u) for u in rows]


@router.get("/users/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _current: AuthUser = Depends(require_roles(*USER_GET_ENDPOINT_ALLOWED)),
):
    u = db.get(AuthUser, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    _ = u.Roles, u.Employee
    return to_user_response(u)


@router.patch("/me/photo")
def update_my_photo(
    payload: dict,
    current: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = (payload or {}).get("profile_photo")
    if not data:
        raise HTTPException(status_code=400, detail="profile_photo is required")
    s = str(data).strip()
    if s.startswith("data:image") and "," in s:
        s = s.split(",", 1)[1]
    current.profile_photo = s
    db.commit()
    db.refresh(current)
    _ = current.Roles, current.Employee
    return to_user_response(current)


@router.patch("/users/{user_id}")
def patch_user(
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _current: AuthUser = Depends(require_roles(*USERS_ENDPOINT_ALLOWED)),
):
    u = db.get(AuthUser, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if "full_name" in payload:
        u.full_name = str(payload["full_name"]).strip()
    if "profile_photo" in payload:
        u.profile_photo = str(payload["profile_photo"]).strip()
    if "is_active" in payload:
        u.is_active = bool(payload["is_active"])
    db.commit()
    db.refresh(u)
    _ = u.Roles, u.Employee
    return to_user_response(u)


@router.post("/assign-roles")
def assign_roles(
    payload: dict,
    db: Session = Depends(get_db),
    _current: AuthUser = Depends(require_roles("SUPER-ADMIN", "ADMIN")),
):
    user_id = payload.get("user_id")
    roles = payload.get("roles")
    if not (user_id and isinstance(roles, list) and roles):
        raise HTTPException(
            status_code=400, detail="user_id and roles (array) are required"
        )

    wanted = set()
    for r in roles:
        nr = normalise_role(r)
        if not nr:
            raise HTTPException(status_code=400, detail=f"Invalid role: {r}")
        wanted.add(nr)

    u = db.get(AuthUser, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    role_objs = []
    for r in wanted:
        obj = db.scalar(select(Role).where(Role.name == r))
        if not obj:
            obj = Role(name=r)
            db.add(obj)
            db.commit()
            db.refresh(obj)
        role_objs.append(obj)

    u.Roles = role_objs
    db.commit()
    db.refresh(u)
    _ = u.Roles, u.Employee
    return to_user_response(u)
