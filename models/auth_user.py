from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import BigInteger, String, Boolean, DateTime, Text
from datetime import datetime
from .base import Base


class AuthUser(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "dbo"}

    user_id: Mapped[int] = mapped_column(
        BigInteger, primary_key=True, autoincrement=True
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    profile_photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_active: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    Roles = relationship("Role", secondary="dbo.user_roles", back_populates="Users")
    Employee = relationship("Employee", uselist=False, back_populates="User")
    RefreshTokens = relationship(
        "RefreshToken", back_populates="User", cascade="all, delete"
    )
