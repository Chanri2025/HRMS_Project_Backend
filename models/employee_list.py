from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import BigInteger, String, Date, DateTime, Integer
from datetime import datetime, date
from .base import Base


class Employee(Base):
    __tablename__ = "employee_list"
    __table_args__ = {"schema": "dbo"}

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    employee_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    card_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    profile_photo: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32))
    address: Mapped[Optional[str]] = mapped_column(String(255))

    # map as ints only; DB has the FK constraints
    dept_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sub_dept_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    designation_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    fathers_name: Mapped[Optional[str]] = mapped_column(String(120))
    aadhar_no: Mapped[Optional[str]] = mapped_column(String(32))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    work_position: Mapped[Optional[str]] = mapped_column(String(80))

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    User = relationship("AuthUser", back_populates="Employee")
