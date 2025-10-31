# routes/org.py
from __future__ import annotations

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from db import get_db
from models import Department, SubDepartment, Designation
from schemas.org import (
    DepartmentIn, DepartmentOut,
    SubDepartmentIn, SubDepartmentOut,
    DesignationIn, DesignationOut,
    AddAllIn, AddAllOut,
)
from utils.org_helpers import (
    get_or_create_department,
    get_or_create_subdept,
    get_or_create_designation,
)

router = APIRouter(prefix="/org", tags=["organization"])


# -----------------------------
# CREATE (existing)
# -----------------------------
@router.post("/departments", response_model=DepartmentOut)
def create_department(payload: DepartmentIn, db: Session = Depends(get_db)):
    d = get_or_create_department(db, payload.dept_name, payload.description, payload.created_by)
    db.commit()
    return d


@router.post("/sub-departments", response_model=SubDepartmentOut)
def create_sub_department(payload: SubDepartmentIn, db: Session = Depends(get_db)):
    sd = get_or_create_subdept(db, payload.dept_id, payload.sub_dept_name, payload.description, payload.created_by)
    db.commit()
    return sd


@router.post("/designations", response_model=DesignationOut)
def create_designation(payload: DesignationIn, db: Session = Depends(get_db)):
    desig = get_or_create_designation(
        db,
        payload.designation_name,
        payload.dept_id,
        payload.sub_dept_id,
        payload.description,
        payload.created_by,
    )
    db.commit()
    return desig


@router.post("/add-all", response_model=AddAllOut)
def create_all(payload: AddAllIn, db: Session = Depends(get_db)):
    with db.begin():
        dept = get_or_create_department(db, payload.dept_name, payload.dept_description, payload.created_by)
        sub_dept = get_or_create_subdept(
            db, dept.dept_id, payload.sub_dept_name, payload.sub_dept_description, payload.created_by
        )
        designation = get_or_create_designation(
            db, payload.designation_name, dept.dept_id, sub_dept.sub_dept_id, payload.designation_description,
            payload.created_by
        )
    return AddAllOut(dept=dept, sub_dept=sub_dept, designation=designation)


# -----------------------------
# GET (added)
# -----------------------------

# Lists
@router.get("/departments", response_model=List[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    rows = db.scalars(select(Department).order_by(Department.dept_name)).all()
    return rows


@router.get("/sub-departments", response_model=List[SubDepartmentOut])
def list_sub_departments(dept_id: Optional[int] = None, db: Session = Depends(get_db)):
    stmt = select(SubDepartment)
    if dept_id is not None:
        stmt = stmt.where(SubDepartment.dept_id == dept_id)
    rows = db.scalars(stmt.order_by(SubDepartment.sub_dept_name)).all()
    return rows


@router.get("/designations", response_model=List[DesignationOut])
def list_designations(
        dept_id: Optional[int] = None,
        sub_dept_id: Optional[int] = None,
        db: Session = Depends(get_db),
):
    stmt = select(Designation)
    if dept_id is not None:
        stmt = stmt.where(Designation.dept_id == dept_id)
    if sub_dept_id is not None:
        stmt = stmt.where(Designation.sub_dept_id == sub_dept_id)
    rows = db.scalars(stmt.order_by(Designation.designation_name)).all()
    return rows


# By ID
@router.get("/departments/{dept_id}", response_model=DepartmentOut)
def get_department(dept_id: int, db: Session = Depends(get_db)):
    row = db.get(Department, dept_id)
    if not row:
        raise HTTPException(status_code=404, detail="Department not found")
    return row


@router.get("/sub-departments/{sub_dept_id}", response_model=SubDepartmentOut)
def get_sub_department(sub_dept_id: int, db: Session = Depends(get_db)):
    row = db.get(SubDepartment, sub_dept_id)
    if not row:
        raise HTTPException(status_code=404, detail="Sub-Department not found")
    return row


@router.get("/designations/{designation_id}", response_model=DesignationOut)
def get_designation(designation_id: int, db: Session = Depends(get_db)):
    row = db.get(Designation, designation_id)
    if not row:
        raise HTTPException(status_code=404, detail="Designation not found")
    return row
