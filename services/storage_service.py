from db.supabase import supabase
from utils.logger import get_logger

BUCKET_NAME = "plan-documents"

logger = get_logger(__name__)

class StorageService:
    def __init__(self):
        self.client = supabase.get_client()

    def upload_plan_document(self, user_id: str, plan_id: str, content: str) -> str:
        file_path = f"{user_id}/{plan_id}.txt"
        file_bytes = content.encode('utf-8')
        
        try:
            self.client.storage.from_(BUCKET_NAME).upload(
                path=file_path,
                file=file_bytes,
                file_options={"content-type": "text/plain", "upsert": "true"}
            )
            logger.info(f"Uploaded plan document to {file_path}")
        except Exception as e:
            logger.error(f"Failed to upload plan document: {e}")
            raise
        
        return file_path

    def get_signed_url(self, file_path: str, expires_in: int = 3600) -> str:
        response = self.client.storage.from_(BUCKET_NAME).create_signed_url(
            path=file_path,
            expires_in=expires_in
        )
        
        return response["signedUrl"]

    def download_plan_document(self, file_path: str) -> str:
        response = self.client.storage.from_(BUCKET_NAME).download(file_path)
        return response.decode('utf-8')
