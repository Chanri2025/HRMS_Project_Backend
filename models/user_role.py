from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, BigInteger, ForeignKey, Table, MetaData
from .base import Base


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = {"schema": "dbo"}

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("dbo.users.user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    role_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("dbo.roles.role_id", ondelete="CASCADE"), primary_key=True
    )
