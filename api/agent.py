from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from api.auth import get_current_user, User
from db.database import get_db
from models.agent import Agent
from services.storage_service import storage_service
from utils.logger import get_logger

router = APIRouter(prefix="/api/agent", tags=["agent"])
logger = get_logger(__name__)

class PlanInfo(BaseModel):
    id: str
    title: str
    content: str
    document_url: str

class AgentSummary(BaseModel):
    id: str
    user_id: str
    plan_id: str
    name: Optional[str]
    status: str
    plan: PlanInfo
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AgentListResponse(BaseModel):
    agents: list[AgentSummary]
    count: int

@router.get("", response_model=AgentListResponse)
async def get_user_agents(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all agents for the authenticated user with plan details.
    """
    agents = db.query(Agent).options(
        joinedload(Agent.plan)
    ).filter(Agent.user_id == UUID(user.id)).order_by(Agent.created_at.desc()).all()
    
    agent_summaries = []
    for agent in agents:
        try:
            plan_content = storage_service.download_plan_document(agent.plan.document_path)
            document_url = storage_service.get_signed_url(agent.plan.document_path)
        except Exception as e:
            logger.error(f"Failed to fetch plan document for agent {agent.id}: {e}")
            continue
        
        agent_summaries.append(
            AgentSummary(
                id=str(agent.id),
                user_id=str(agent.user_id),
                plan_id=str(agent.plan_id),
                name=agent.name,
                status=agent.status,
                created_at=agent.created_at,
                updated_at=agent.updated_at,
                plan=PlanInfo(
                    id=str(agent.plan.id),
                    title=agent.plan.title,
                    content=plan_content,
                    document_url=document_url
                )
            )
        )
    
    return AgentListResponse(
        agents=agent_summaries,
        count=len(agent_summaries)
    )

@router.get("/{agent_id}", response_model=AgentSummary)
async def get_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific agent by ID with plan details.
    Only returns the agent if it belongs to the authenticated user.
    """
    try:
        agent_uuid = UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID format")
    
    agent = db.query(Agent).options(
        joinedload(Agent.plan)
    ).filter(
        Agent.id == agent_uuid,
        Agent.user_id == UUID(user.id)
    ).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Fetch plan content and generate fresh signed URL
    try:
        plan_content = storage_service.download_plan_document(agent.plan.document_path)
        document_url = storage_service.get_signed_url(agent.plan.document_path)
    except Exception as e:
        logger.error(f"Failed to fetch plan document: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch plan document")
    
    return AgentSummary(
        id=str(agent.id),
        user_id=str(agent.user_id),
        plan_id=str(agent.plan_id),
        name=agent.name,
        status=agent.status,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        plan=PlanInfo(
            id=str(agent.plan.id),
            title=agent.plan.title,
            content=plan_content,
            document_url=document_url
        )
    )
