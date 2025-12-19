import time
from fastapi import APIRouter
from pydantic import BaseModel
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
    return {"status": "healthy", "uptime": time.time() - start_time}

@router.post("/process_input", response_model=AIResponse)
async def process_input(request: AIRequest):
    try:
        logger.info(f"Processing request: {request.input}")

        # result = await orchestrator.orchestrate(request.input)

        return AIResponse(output=request.input)
    except Exception as e:
        logger.error(e)
        raise
