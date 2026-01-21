from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, DateTime, Boolean, Integer, func
from sqlalchemy.orm import Mapped, mapped_column
from db.database import Base


class Environment(Base):
    """
    Environment model for organizing user work.
    """
    __tablename__ = "environment"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Add FK later when User model exists
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now()
    )
    
    def __repr__(self) -> str:
        return f"<Environment(id={self.id}, name='{self.name}')>"


