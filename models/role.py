from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, String
from .base import Base


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = {"schema": "dbo"}

    role_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    Users = relationship("AuthUser", secondary="dbo.user_roles", back_populates="Roles")
