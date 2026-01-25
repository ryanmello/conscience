from typing import Optional
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.auth import get_current_user, get_current_user_ws
from services.websocket_service import websocket_service
from services.storage_service import storage_service
from services.plan_service import plan_service
from utils.logger import get_logger
from fastapi import WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/api/plans", tags=["plans"])
logger = get_logger(__name__)


# Request/Response models
class GeneratePlanRequest(BaseModel):
    prompt: str

class GeneratePlanResponse(BaseModel):
    plan_id: str
    title: str
    document_url: str
    content: str

class ApproveDocumentRequest(BaseModel):
    plan_id: str
    title: str
    content: str
    version: int

class ApprovePlanResponse(BaseModel):
    success: bool
    message: str
    document_url: Optional[str] = None

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
    user = Depends(get_current_user)
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
        
        # TODO: Add logic here for next phase
        # Examples:
        # - Save to database with "approved" status
        # - Trigger code generation service
        # - Queue background job for agent building
        # - Notify other services
        
        logger.info(f"Plan {request.plan_id} approved and saved")
        
        return ApprovePlanResponse(
            success=True,
            message="Document approved successfully",
            document_url=document_url
        )
    except Exception as e:
        logger.error(f"Failed to approve plan: {e}")
        raise HTTPException(status_code=500, detail="Failed to approve plan")
