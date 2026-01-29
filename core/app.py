import time
from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config.settings import settings
from services.websocket_service import websocket_service
from utils.logger import setup_logging, get_logger

setup_logging(level=settings.LOG_LEVEL)
logger = get_logger(__name__)

start_time = time.time()

def create_app() -> FastAPI:    
    app = FastAPI()
    
    app.add_middleware(
        CORSMiddleware,
        **settings.get_cors_config()
    )

    # app.add_event_handler("startup", startup_event)
    app.add_event_handler("shutdown", shutdown_event)

    from api import conscience, plan, agent
    app.include_router(conscience.router)
    app.include_router(plan.router)
    app.include_router(agent.router)

    return app

# async def startup_event():    
#     if not settings.OPENAI_API_KEY:
#         raise ValueError("OPENAI_API_KEY is required but not set in environment variables")
#     if not settings.SUPABASE_DATABASE_URL:
#         raise ValueError("SUPABASE_DATABASE_URL is required but not set in environment variables")

async def shutdown_event():
    for task_id in List[str](websocket_service.active_connections.keys()):
        await websocket_service.disconnect_websocket(task_id)
    logger.info("Shutdown complete")
    