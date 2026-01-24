from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.auth import get_current_user
from services.storage_service import StorageService
from services.plan_service import PlanService
from utils.logger import get_logger

router = APIRouter(prefix="/api/plans", tags=["plans"])
logger = get_logger(__name__)

class GeneratePlanRequest(BaseModel):
    prompt: str

class GeneratePlanResponse(BaseModel):
    plan_id: str
    title: str
    document_url: str
    content: str

@router.post("/generate", response_model=GeneratePlanResponse)
async def generate_plan(
    request: GeneratePlanRequest,
    user = Depends(get_current_user)
):
    plan_service = PlanService()
    storage_service = StorageService()
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
