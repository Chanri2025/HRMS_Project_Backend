# models/auth_user.py
from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import BigInteger, String, Boolean, DateTime, Integer
from datetime import datetime
from .base import Base


class AuthUser(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "dbo"}

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    # DB column is named 'password'
    password_hash: Mapped[str] = mapped_column("password", String(255), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_active: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Store the role_id as an integer; DB enforces FK, ORM does not.
    user_role_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # Explicit, view-only relationship to Role without FK constraints in ORM
    Role = relationship(
        "Role",
        primaryjoin="AuthUser.user_role_id == Role.role_id",
        uselist=False,
        viewonly=True,
    )

    # One-to-one with Employee (no ORM FK on Employee side either)
    Employee = relationship("Employee", uselist=False, back_populates="User")
