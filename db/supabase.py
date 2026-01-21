from supabase import create_client, Client
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

class SupabaseService:
    client: Client | None = None

    @classmethod
    def get_client(cls) -> Client:
        if cls.client is None:
            if not settings.SUPABASE_PROJECT_URL or not settings.SUPABASE_SECRET_API_KEY:
                raise ValueError(
                    "Supabase credentials not configured. "
                    "Please set SUPABASE_PROJECT_URL and SUPABASE_SECRET_API_KEY in your .env file."
                )
            
            cls.client = create_client(
                settings.SUPABASE_PROJECT_URL,
                settings.SUPABASE_SECRET_API_KEY
            )
        
        return cls.client

    @classmethod
    def table(cls, table_name: str):
        return cls.get_client().table(table_name)

supabase = SupabaseService()
