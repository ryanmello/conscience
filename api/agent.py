from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from api.auth import get_current_user, get_current_user_ws, User
from db.database import get_db
from models.agent import Agent
from models.agent_file import AgentFile
from services.storage_service import storage_service
from services.websocket_service import websocket_service
from services.codegen_service import codegen_service
from utils.logger import get_logger

router = APIRouter(prefix="/api/agent", tags=["agent"])
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

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
    entry_point: Optional[str] = None
    plan: PlanInfo
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class AgentListResponse(BaseModel):
    agents: list[AgentSummary]
    count: int

class FileInfo(BaseModel):
    id: str
    path: str
    language: str
    version: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FileDetail(FileInfo):
    content: str

class FileListResponse(BaseModel):
    files: list[FileDetail]
    count: int

class CreateFileRequest(BaseModel):
    path: str
    content: str = ""
    language: str = "python"

class UpdateFileRequest(BaseModel):
    content: str


# ---------------------------------------------------------------------------
# Agent endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=AgentListResponse)
async def get_user_agents(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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
                entry_point=agent.entry_point,
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
        entry_point=agent.entry_point,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        plan=PlanInfo(
            id=str(agent.plan.id),
            title=agent.plan.title,
            content=plan_content,
            document_url=document_url
        )
    )


# ---------------------------------------------------------------------------
# File CRUD endpoints
# ---------------------------------------------------------------------------

def _get_agent_for_user(db: Session, agent_id: str, user_id: str) -> Agent:
    try:
        agent_uuid = UUID(agent_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid agent ID format")

    agent = db.query(Agent).filter(
        Agent.id == agent_uuid,
        Agent.user_id == UUID(user_id)
    ).first()

    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.get("/{agent_id}/files", response_model=FileListResponse)
async def list_agent_files(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    agent = _get_agent_for_user(db, agent_id, user.id)
    files = db.query(AgentFile).filter(
        AgentFile.agent_id == agent.id
    ).order_by(AgentFile.path).all()

    return FileListResponse(
        files=[
            FileDetail(
                id=str(f.id),
                path=f.path,
                content=f.content,
                language=f.language,
                version=f.version,
                status=f.status,
                created_at=f.created_at,
                updated_at=f.updated_at
            )
            for f in files
        ],
        count=len(files)
    )


@router.get("/{agent_id}/files/{file_path:path}", response_model=FileDetail)
async def get_agent_file(
    agent_id: str,
    file_path: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    agent = _get_agent_for_user(db, agent_id, user.id)
    file = db.query(AgentFile).filter(
        AgentFile.agent_id == agent.id,
        AgentFile.path == file_path
    ).first()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    return FileDetail(
        id=str(file.id),
        path=file.path,
        content=file.content,
        language=file.language,
        version=file.version,
        status=file.status,
        created_at=file.created_at,
        updated_at=file.updated_at
    )


@router.post("/{agent_id}/files", response_model=FileDetail, status_code=201)
async def create_agent_file(
    agent_id: str,
    request: CreateFileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    agent = _get_agent_for_user(db, agent_id, user.id)

    existing = db.query(AgentFile).filter(
        AgentFile.agent_id == agent.id,
        AgentFile.path == request.path
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="File already exists at this path")

    new_file = AgentFile(
        agent_id=agent.id,
        path=request.path,
        content=request.content,
        language=request.language,
        status="generated",
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    return FileDetail(
        id=str(new_file.id),
        path=new_file.path,
        content=new_file.content,
        language=new_file.language,
        version=new_file.version,
        status=new_file.status,
        created_at=new_file.created_at,
        updated_at=new_file.updated_at
    )


@router.put("/{agent_id}/files/{file_path:path}", response_model=FileDetail)
async def update_agent_file(
    agent_id: str,
    file_path: str,
    request: UpdateFileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    agent = _get_agent_for_user(db, agent_id, user.id)
    file = db.query(AgentFile).filter(
        AgentFile.agent_id == agent.id,
        AgentFile.path == file_path
    ).first()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    file.content = request.content
    file.version += 1
    file.status = "modified"
    db.commit()
    db.refresh(file)

    return FileDetail(
        id=str(file.id),
        path=file.path,
        content=file.content,
        language=file.language,
        version=file.version,
        status=file.status,
        created_at=file.created_at,
        updated_at=file.updated_at
    )


@router.delete("/{agent_id}/files/{file_path:path}", status_code=204)
async def delete_agent_file(
    agent_id: str,
    file_path: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    agent = _get_agent_for_user(db, agent_id, user.id)
    file = db.query(AgentFile).filter(
        AgentFile.agent_id == agent.id,
        AgentFile.path == file_path
    ).first()

    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    db.delete(file)
    db.commit()


# ---------------------------------------------------------------------------
# Code generation WebSocket
# ---------------------------------------------------------------------------

@router.websocket("/ws/codegen")
async def websocket_codegen(
    websocket: WebSocket,
    user=Depends(get_current_user_ws),
):
    session_id = str(uuid4())
    await websocket_service.connect_websocket(session_id, websocket)

    db: Session = next(get_db())
    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "start_codegen":
                agent_id = data.get("agent_id")
                if not agent_id:
                    await websocket_service.send_error(session_id, "Missing agent_id")
                    continue

                try:
                    agent_uuid = UUID(agent_id)
                except ValueError:
                    await websocket_service.send_error(session_id, "Invalid agent_id")
                    continue

                agent = db.query(Agent).options(
                    joinedload(Agent.plan)
                ).filter(
                    Agent.id == agent_uuid,
                    Agent.user_id == UUID(user.id)
                ).first()

                if not agent:
                    await websocket_service.send_error(session_id, "Agent not found")
                    continue

                try:
                    plan_content = storage_service.download_plan_document(
                        agent.plan.document_path
                    )
                except Exception as e:
                    logger.error(f"Failed to load plan for agent {agent_id}: {e}")
                    await websocket_service.send_error(
                        session_id, "Failed to load plan document"
                    )
                    continue

                agent.status = "generating"
                db.commit()

                try:
                    await codegen_service.generate_code(
                        agent_id=agent_id,
                        plan_content=plan_content,
                        session_id=session_id,
                        user_id=user.id,
                        db=db,
                    )
                except Exception as e:
                    logger.error(f"Code generation failed for agent {agent_id}: {e}")

    except WebSocketDisconnect:
        await websocket_service.disconnect_websocket(session_id)
    finally:
        db.close()
