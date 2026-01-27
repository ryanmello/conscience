from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import UUID
from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.database import Base
import uuid

if TYPE_CHECKING:
    from models.agent import Agent

class Plan(Base):
    """
    Plan model - stores approved plan documents.
    """
    __tablename__ = "plan"
    
    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    document_url: Mapped[str] = mapped_column(Text, nullable=False)
    document_path: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="approved")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now()
    )
    
    # Relationship to agents
    agents: Mapped[list["Agent"]] = relationship("Agent", back_populates="plan")
    
    def __repr__(self) -> str:
        return f"<Plan(id={self.id}, title='{self.title}')>"
