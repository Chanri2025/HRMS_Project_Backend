from __future__ import annotations
from datetime import datetime
from sqlalchemy import (
    String, Integer, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base


# ---------- Department ----------
class Department(Base):
    __tablename__ = "department_list"

    dept_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dept_name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_by: Mapped[int | None] = mapped_column(Integer)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    updated_by: Mapped[int | None] = mapped_column(Integer)

    sub_departments: Mapped[list["SubDepartment"]] = relationship(
        back_populates="department",
        cascade="all, delete-orphan",
        passive_deletes=False,  # MSSQL multi-cascade safety
    )


# ---------- Sub-Department ----------
class SubDepartment(Base):
    __tablename__ = "sub_department_list"

    sub_dept_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sub_dept_name: Mapped[str] = mapped_column(String(150), nullable=False)
    dept_id: Mapped[int] = mapped_column(
        ForeignKey("department_list.dept_id", ondelete="NO ACTION", onupdate="NO ACTION"),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_by: Mapped[int | None] = mapped_column(Integer)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    updated_by: Mapped[int | None] = mapped_column(Integer)

    department: Mapped["Department"] = relationship(back_populates="sub_departments")

    __table_args__ = (
        UniqueConstraint("dept_id", "sub_dept_name", name="uq_subdept_per_dept"),
    )


# ---------- Designation ----------
class Designation(Base):
    __tablename__ = "designation_list"

    designation_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    designation_name: Mapped[str] = mapped_column(String(150), nullable=False)
    dept_id: Mapped[int | None] = mapped_column(
        ForeignKey("department_list.dept_id", ondelete="NO ACTION", onupdate="NO ACTION"),
        nullable=True,
    )
    sub_dept_id: Mapped[int | None] = mapped_column(
        ForeignKey("sub_department_list.sub_dept_id", ondelete="NO ACTION", onupdate="NO ACTION"),
        nullable=True,
    )
    description: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_by: Mapped[int | None] = mapped_column(Integer)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime)
    updated_by: Mapped[int | None] = mapped_column(Integer)

    __table_args__ = (
        UniqueConstraint("designation_name", "dept_id", "sub_dept_id", name="uq_desig_per_scope"),
    )
