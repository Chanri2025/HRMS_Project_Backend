# models/auth_user.py
from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import BigInteger, String, Boolean, DateTime, Integer, ForeignKey
from datetime import datetime
from .base import Base


class AuthUser(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "dbo"}

    user_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column("password", String(255), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_active: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user_role_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("dbo.role_list.role_id"), nullable=False
    )

    Role = relationship("Role", back_populates="Users", uselist=False)
    Employee = relationship("Employee", back_populates="User", uselist=False)
    RefreshTokens = relationship("RefreshToken", back_populates="User", cascade="all, delete-orphan")
