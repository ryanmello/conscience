import time
from typing import List
from fastapi import APIRouter
from utils.logger import get_logger

logger = get_logger(__name__)
start_time = time.time()

router = APIRouter(prefix="/api", tags=["conscience"])

@router.get("/health")
async def health_check():
    """Public health check endpoint - no auth required."""
    return {"status": "healthy", "uptime": time.time() - start_time}

@router.get("/models", response_model=List[str])
async def get_models():
    try:
        return ["Opus 4.5", "GPT-5.2 Codex", "Gemini 3 Flash", "Grok Code"]
    except Exception as e:
        logger.error(e)
        raise
