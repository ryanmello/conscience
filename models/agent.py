from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from uuid import UUID
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base
import uuid

if TYPE_CHECKING:
    from models.plan import Plan
    from models.agent_file import AgentFile

class Agent(Base):
    __tablename__ = "agent"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    plan_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        ForeignKey("plan.id"), 
        nullable=False
    )
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="initialized")
    entry_point: Mapped[Optional[str]] = mapped_column(String(500), nullable=True, default="main.py")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now()
    )
    
    plan: Mapped["Plan"] = relationship("Plan", back_populates="agents")
    files: Mapped[List["AgentFile"]] = relationship("AgentFile", back_populates="agent", cascade="all, delete-orphan")
    
    def __repr__(self) -> str:
        return f"<Agent(id={self.id}, name='{self.name}')>"
