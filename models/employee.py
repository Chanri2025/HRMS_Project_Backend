from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import BigInteger, String, Date, DateTime, ForeignKey
from datetime import datetime
from .base import Base


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = {"schema": "dbo"}

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("dbo.users.user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    employee_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    fathers_name: Mapped[str] = mapped_column(String(120), nullable=False)
    aadhar_no: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    date_of_birth: Mapped[datetime] = mapped_column(Date, nullable=False)
    work_position: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    User = relationship("AuthUser", back_populates="Employee")
