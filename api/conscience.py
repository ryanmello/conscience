import time
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.auth import get_current_user, User
from utils.logger import get_logger

logger = get_logger(__name__)
start_time = time.time()

router = APIRouter()

class AIRequest(BaseModel):
    input: str
    
class AIResponse(BaseModel):
    output: str


@router.get("/health")
async def health_check():
    """Public health check endpoint - no auth required."""
    return {"status": "healthy", "uptime": time.time() - start_time}


@router.post("/process_input", response_model=AIResponse)
async def process_input(request: AIRequest, user: User = Depends(get_current_user)):
    """Process user input - requires authentication."""
    try:
        logger.info(f"Processing request from user {user.id}: {request.input}")

        # result = await orchestrator.orchestrate(request.input)

        return AIResponse(output=request.input)
    except Exception as e:
        logger.error(e)
        raise
