from typing import Optional
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from api.auth import get_current_user, User
from db.database import get_db
from models.agent import Agent
from utils.logger import get_logger

router = APIRouter(prefix="/api/agent", tags=["agent"])
logger = get_logger(__name__)

class AgentResponse(BaseModel):
    id: str
    user_id: str
    plan_id: str
    name: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AgentListResponse(BaseModel):
    agents: list[AgentResponse]
    count: int

@router.get("", response_model=AgentListResponse)
async def get_user_agents(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all agents for the authenticated user.
    """
    agents = db.query(Agent).filter(Agent.user_id == UUID(user.id)).order_by(Agent.created_at.desc()).all()
    
    return AgentListResponse(
        agents=[
            AgentResponse(
                id=str(agent.id),
                user_id=str(agent.user_id),
                plan_id=str(agent.plan_id),
                name=agent.name,
                status=agent.status,
                created_at=agent.created_at,
                updated_at=agent.updated_at
            )
            for agent in agents
        ],
        count=len(agents)
    )

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific agent by ID.
    Only returns the agent if it belongs to the authenticated user.
    """
    try:
        agent_uuid = UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID format")
    
    agent = db.query(Agent).filter(
        Agent.id == agent_uuid,
        Agent.user_id == UUID(user.id)
    ).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return AgentResponse(
        id=str(agent.id),
        user_id=str(agent.user_id),
        plan_id=str(agent.plan_id),
        name=agent.name,
        status=agent.status,
        created_at=agent.created_at,
        updated_at=agent.updated_at
    )
