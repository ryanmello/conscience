from typing import Optional
from pydantic import BaseModel

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
    