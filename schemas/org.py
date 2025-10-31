from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, Field


# -------- Department --------
class DepartmentIn(BaseModel):
    dept_name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    created_by: Optional[int] = None


class DepartmentOut(BaseModel):
    dept_id: int
    dept_name: str
    description: Optional[str]

    class Config:
        from_attributes = True


# -------- Sub-Department --------
class SubDepartmentIn(BaseModel):
    dept_id: int
    sub_dept_name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = Field(None, max_length=500)
    created_by: Optional[int] = None


class SubDepartmentOut(BaseModel):
    sub_dept_id: int
    dept_id: int
    sub_dept_name: str
    description: Optional[str]

    class Config:
        from_attributes = True


# -------- Designation --------
class DesignationIn(BaseModel):
    designation_name: str = Field(..., min_length=1, max_length=150)
    dept_id: Optional[int] = None
    sub_dept_id: Optional[int] = None
    description: Optional[str] = Field(None, max_length=500)
    created_by: Optional[int] = None


class DesignationOut(BaseModel):
    designation_id: int
    designation_name: str
    dept_id: Optional[int]
    sub_dept_id: Optional[int]
    description: Optional[str]

    class Config:
        from_attributes = True


# -------- Create-All (atomic) --------
class AddAllIn(BaseModel):
    dept_name: str
    sub_dept_name: str
    designation_name: str
    dept_description: Optional[str] = None
    sub_dept_description: Optional[str] = None
    designation_description: Optional[str] = None
    created_by: Optional[int] = None


class AddAllOut(BaseModel):
    dept: DepartmentOut
    sub_dept: SubDepartmentOut
    designation: DesignationOut
