# models/role.py
from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, String
from .base import Base


class Role(Base):
    __tablename__ = "role_list"
    __table_args__ = {"schema": "dbo"}

    role_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255))

    Users = relationship("AuthUser", back_populates="Role")
