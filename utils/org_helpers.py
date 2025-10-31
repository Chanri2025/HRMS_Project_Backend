from __future__ import annotations
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from models import Department, SubDepartment, Designation


def _norm(s: str) -> str:
    """Normalize names for idempotency (trim & collapse spaces; case-insensitive checks)."""
    return " ".join(s.strip().split())


def get_or_create_department(
        db: Session, name: str, description: Optional[str], created_by: Optional[int]
) -> Department:
    norm = _norm(name)
    existing = db.scalar(select(Department).where(func.lower(Department.dept_name) == norm.lower()))
    if existing:
        return existing
    d = Department(dept_name=norm, description=description, created_by=created_by)
    db.add(d)
    db.flush()
    return d


def get_or_create_subdept(
        db: Session, dept_id: int, name: str, description: Optional[str], created_by: Optional[int]
) -> SubDepartment:
    norm = _norm(name)
    dept = db.get(Department, dept_id)
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    existing = db.scalar(
        select(SubDepartment).where(
            SubDepartment.dept_id == dept_id,
            func.lower(SubDepartment.sub_dept_name) == norm.lower(),
        )
    )
    if existing:
        return existing

    sd = SubDepartment(dept_id=dept_id, sub_dept_name=norm, description=description, created_by=created_by)
    db.add(sd)
    db.flush()
    return sd


def get_or_create_designation(
        db: Session,
        name: str,
        dept_id: Optional[int],
        sub_dept_id: Optional[int],
        description: Optional[str],
        created_by: Optional[int],
) -> Designation:
    norm = _norm(name)

    if dept_id is not None and not db.get(Department, dept_id):
        raise HTTPException(status_code=404, detail="Department not found for designation")
    if sub_dept_id is not None and not db.get(SubDepartment, sub_dept_id):
        raise HTTPException(status_code=404, detail="Sub-Department not found for designation")

    # Uniqueness scoped by (name, dept_id, sub_dept_id)
    existing = db.scalar(
        select(Designation).where(
            func.lower(Designation.designation_name) == norm.lower(),
            (Designation.dept_id == dept_id) if dept_id is not None else Designation.dept_id.is_(None),
            (Designation.sub_dept_id == sub_dept_id) if sub_dept_id is not None else Designation.sub_dept_id.is_(None),
        )
    )
    if existing:
        return existing

    desig = Designation(
        designation_name=norm,
        dept_id=dept_id,
        sub_dept_id=sub_dept_id,
        description=description,
        created_by=created_by,
    )
    db.add(desig)
    db.flush()
    return desig
