from typing import Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_current_user, get_current_user_ws
from models import Agent, Plan
from models.api import ApproveDocumentRequest, ApprovePlanResponse, GeneratePlanRequest, GeneratePlanResponse
from services.websocket_service import websocket_service
from services.storage_service import storage_service
from services.plan_service import plan_service
from utils.logger import get_logger
from fastapi import WebSocket, WebSocketDisconnect
from db.database import get_db

router = APIRouter(prefix="/api/plan", tags=["plan"])
logger = get_logger(__name__)

@router.post("/generate", response_model=GeneratePlanResponse)
async def generate_plan(
    request: GeneratePlanRequest,
    user = Depends(get_current_user)
):
    plan_id = str(uuid4())

    try:
        result = await plan_service.generate(request.prompt)
    except Exception as e:
        logger.error(f"Plan generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate plan")

    try:
        file_path = storage_service.upload_plan_document(
            user_id=str(user.id),
            plan_id=plan_id,
            content=result["content"]
        )
        document_url = storage_service.get_signed_url(file_path)
    except Exception as e:
        logger.error(f"Storage upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to store plan document")

    return GeneratePlanResponse(
        plan_id=plan_id,
        title=result["title"],
        document_url=document_url,
        content=result["content"]
    )

@router.websocket("/ws/generate")
async def websocket_generate_plan(
    websocket: WebSocket,
    user = Depends(get_current_user_ws)
):
    session_id = str(uuid4())
    await websocket_service.connect_websocket(session_id, websocket)

    try:    
        while True:
            data = await websocket.receive_json()

            if data["type"] == "start_plan":
                await plan_service.develop_plan(
                    session_id=session_id,
                    prompt=data["prompt"], 
                    user_id=str(user.id)
                )

            elif data["type"] == "user_response":
                await plan_service.update_plan(
                    session_id=session_id,
                    response=data["response"]
                )

    except WebSocketDisconnect:
        await websocket_service.disconnect_websocket(session_id)

@router.post("/approve", response_model=ApprovePlanResponse)
async def approve_plan(
    request: ApproveDocumentRequest,
    user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Approve the refined document and prepare for next phase (e.g., code generation).
    Called when user clicks "Approve" button after refining the plan.
    """
    logger.info(f"User {user.id} approving plan {request.plan_id}")
    
    try:
        # Save the final approved document to storage
        file_path = storage_service.upload_plan_document(
            user_id=str(user.id),
            plan_id=request.plan_id,
            content=request.content
        )
        document_url = storage_service.get_signed_url(file_path)
        
        plan = Plan(
            user_id=UUID(user.id),
            title=request.title,
            document_url=document_url,
            document_path=file_path,
            status="approved"
        )
        db.add(plan)
        db.flush()

        agent = Agent(
            user_id=UUID(user.id),
            plan_id=plan.id,
            name=request.title,
            status="initialized"
        )
        db.add(agent)
        db.commit()
        
        logger.info(f"Plan {plan.id} and Agent {agent.id} created for user {user.id}")
        
        return ApprovePlanResponse(
            success=True,
            message="Document approved successfully",
            document_url=document_url,
            agent_id=str(agent.id)
        )
    except Exception as e:
        logger.error(f"Failed to approve plan: {e}")
        raise HTTPException(status_code=500, detail="Failed to approve plan")
