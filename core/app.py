import time
from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config.settings import settings
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
    
    return app
    