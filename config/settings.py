import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "conscience"

    HOST: str = os.getenv("HOST", "::")
    PORT: int = int(os.getenv("PORT", "8000"))
    RELOAD: bool = os.getenv("RELOAD", "true").lower() == "true"
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info")

    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    BACKEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:8000")
    ALLOWED_ORIGINS: List[str] = [FRONTEND_URL, "http://localhost:3000"]

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"

    SUPABASE_DATABASE_URL: str = os.getenv("SUPABASE_DATABASE_URL", "")
    SUPABASE_PROJECT_URL: str = os.getenv("SUPABASE_PROJECT_URL", "")
    SUPABASE_SECRET_API_KEY: str = os.getenv("SUPABASE_SECRET_API_KEY", "")

    @classmethod
    def get_cors_config(cls) -> dict:
        """Get CORS configuration dictionary."""
        return {
            "allow_origins": cls.ALLOWED_ORIGINS,
            "allow_credentials": True,
            "allow_methods": ["*"],
            "allow_headers": ["*"],
        }

settings = Settings()
