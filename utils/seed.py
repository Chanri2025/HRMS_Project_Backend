# utils/seed.py
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Dict, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from utils.security import hash_password


CORE_ROLES = ["SUPER-ADMIN", "ADMIN", "MANAGER", "EMPLOYEE"]


def _scalar_int(db: Session, sql: str, params: dict | None = None) -> Optional[int]:
    row = db.execute(text(sql), params or {}).fetchone()
    if not row:
        return None
    # return first column as int
    return int(list(row._mapping.values())[0])


def _ensure_roles_sql(db: Session) -> Dict[str, int]:
    """
    Ensure role_list has CORE_ROLES; return {role_name: role_id}.
    """
    out: Dict[str, int] = {}

    # Load existing roles
    rows = db.execute(text("SELECT role_id, role_name FROM dbo.role_list")).fetchall()
    for r in rows:
        out[r.role_name] = r.role_id

    # Insert missing
    for name in CORE_ROLES:
        if name not in out:
            db.execute(
                text(
                    "INSERT INTO dbo.role_list (role_name, description) "
                    "VALUES (:name, :desc)"
                ),
                {"name": name, "desc": f"Auto-created role {name}"},
            )
            db.commit()
            rid = _scalar_int(
                db,
                "SELECT role_id FROM dbo.role_list WHERE role_name = :n",
                {"n": name},
            )
            out[name] = rid

    return out


def _ensure_base_hr_structures_sql(db: Session) -> Dict[str, int]:
    """
    Ensure at least one Department, Sub-Department, and Designation exist; return IDs.
    """
    out: Dict[str, int] = {}

    # Department
    dept_id = _scalar_int(
        db, "SELECT TOP 1 dept_id FROM dbo.department_list ORDER BY dept_id"
    )
    if not dept_id:
        db.execute(
            text(
                "INSERT INTO dbo.department_list (dept_name, description, created_at) "
                "VALUES ('Default Department', 'Auto-created base department', SYSUTCDATETIME())"
            )
        )
        db.commit()
        dept_id = _scalar_int(
            db,
            "SELECT TOP 1 dept_id FROM dbo.department_list ORDER BY dept_id DESC",
        )
    out["dept_id"] = dept_id

    # Sub-Department
    sub_dept_id = _scalar_int(
        db,
        "SELECT TOP 1 sub_dept_id FROM dbo.sub_department_list ORDER BY sub_dept_id",
    )
    if not sub_dept_id:
        db.execute(
            text(
                "INSERT INTO dbo.sub_department_list (dept_id, sub_dept_name, description) "
                "VALUES (:dept, 'Default Sub-Dept', 'Auto-created base sub-department')"
            ),
            {"dept": dept_id},
        )
        db.commit()
        sub_dept_id = _scalar_int(
            db,
            "SELECT TOP 1 sub_dept_id FROM dbo.sub_department_list ORDER BY sub_dept_id DESC",
        )
    out["sub_dept_id"] = sub_dept_id

    # Designation
    designation_id = _scalar_int(
        db,
        "SELECT TOP 1 designation_id FROM dbo.designation_list ORDER BY designation_id",
    )
    if not designation_id:
        db.execute(
            text(
                "INSERT INTO dbo.designation_list (title, level, dept_id, description) "
                "VALUES ('Default Designation', 1, :dept, 'Auto-created base designation')"
            ),
            {"dept": dept_id},
        )
        db.commit()
        designation_id = _scalar_int(
            db,
            "SELECT TOP 1 designation_id FROM dbo.designation_list ORDER BY designation_id DESC",
        )
    out["designation_id"] = designation_id

    return out


def _get_user_by_email_sql(db: Session, email: str) -> Optional[dict]:
    row = db.execute(
        text(
            "SELECT TOP 1 user_id, email, user_role_id "
            "FROM dbo.users WHERE email = :email"
        ),
        {"email": email},
    ).fetchone()
    return dict(row._mapping) if row else None


def _get_role_name_for_user_sql(db: Session, user_id: int) -> Optional[str]:
    row = db.execute(
        text(
            "SELECT r.role_name "
            "FROM dbo.users u JOIN dbo.role_list r ON r.role_id = u.user_role_id "
            "WHERE u.user_id = :uid"
        ),
        {"uid": user_id},
    ).fetchone()
    return row.role_name if row else None


def seed_super_admin_sql(db: Session) -> dict:
    """
    Pure-SQL seeding:
     - roles / dept / sub_dept / designation
     - SUPER-ADMIN user (email + hashed password into [password])
     - employee_list row
    """
    roles = _ensure_roles_sql(db)
    base_ids = _ensure_base_hr_structures_sql(db)

    email = "ghoshaniruddha2003@gmail.com"
    full_name = "Aniruddha Ghosh"
    raw_password = "Babai@6157201"
    employee_id = "EMP2089"
    card_id = "520"
    role_id = roles["SUPER-ADMIN"]

    # Ensure user
    user = _get_user_by_email_sql(db, email)
    created_user = False

    if not user:
        pwd_hash = hash_password(raw_password)  # bcrypt_sha256 via passlib
        db.execute(
            text(
                "INSERT INTO dbo.users (email, [password], is_active, created_at, updated_at, user_role_id) "
                "VALUES (:email, :pwd, 1, SYSUTCDATETIME(), SYSUTCDATETIME(), :rid)"
            ),
            {"email": email, "pwd": pwd_hash, "rid": role_id},
        )
        db.commit()
        user = _get_user_by_email_sql(db, email)
        created_user = True
    else:
        if user["user_role_id"] != role_id:
            db.execute(
                text(
                    "UPDATE dbo.users SET user_role_id = :rid, updated_at = SYSUTCDATETIME() "
                    "WHERE user_id = :uid"
                ),
                {"rid": role_id, "uid": user["user_id"]},
            )
            db.commit()

    uid = int(user["user_id"])

    # Ensure employee row (by user_id OR employee_id)
    emp_exists = db.execute(
        text(
            "SELECT 1 FROM dbo.employee_list WHERE user_id = :uid OR employee_id = :eid"
        ),
        {"uid": uid, "eid": employee_id},
    ).fetchone()

    if not emp_exists:
        db.execute(
            text(
                """
                INSERT INTO dbo.employee_list
                  (user_id, employee_id, card_id, full_name, profile_photo, phone, address,
                   dept_id, sub_dept_id, designation_id, fathers_name, aadhar_no, date_of_birth,
                   work_position, created_at, updated_at)
                VALUES
                  (:user_id, :employee_id, :card_id, :full_name, NULL, :phone, :address,
                   :dept_id, :sub_dept_id, :designation_id, :fathers_name, :aadhar_no, :date_of_birth,
                   :work_position, SYSUTCDATETIME(), SYSUTCDATETIME())
                """
            ),
            {
                "user_id": uid,
                "employee_id": employee_id,
                "card_id": card_id,
                "full_name": full_name,
                "phone": "0000000000",
                "address": "N/A",
                "dept_id": base_ids["dept_id"],
                "sub_dept_id": base_ids["sub_dept_id"],
                "designation_id": base_ids["designation_id"],
                "fathers_name": "N/A",
                "aadhar_no": "0000-0000-0000",
                "date_of_birth": date(2000, 1, 1),
                "work_position": "SUPER-ADMIN",
            },
        )
        db.commit()

    role_name = _get_role_name_for_user_sql(db, uid)

    # Verify employee exists now
    has_employee = bool(
        db.execute(
            text("SELECT 1 FROM dbo.employee_list WHERE user_id = :uid"),
            {"uid": uid},
        ).fetchone()
    )

    return {
        "created_user": created_user,
        "user_id": uid,
        "email": email,
        "role": role_name,
        "has_employee": has_employee,
    }
