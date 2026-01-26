from typing import Optional
from fastapi import Depends, HTTPException, status, WebSocket
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient
from pydantic import BaseModel
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

security = HTTPBearer()
jwks_client: Optional[PyJWKClient] = None

WS_CLOSE_AUTH_REQUIRED = 4001
WS_CLOSE_AUTH_FAILED = 4003

def get_jwks_client() -> PyJWKClient:
    """Get or create cached JWKS client for Supabase token verification."""
    global jwks_client
    if jwks_client is None:
        if not settings.SUPABASE_PROJECT_URL:
            raise ValueError("SUPABASE_PROJECT_URL not configured")
        jwks_url = f"{settings.SUPABASE_PROJECT_URL}/auth/v1/.well-known/jwks.json"
        jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return jwks_client

class User(BaseModel):
    """Authenticated user from Supabase JWT."""
    id: str
    email: Optional[str] = None
    role: Optional[str] = None

class AuthError(Exception):
    """Authentication error with message for both HTTP and WebSocket handlers."""
    def __init__(self, message: str, is_server_error: bool = False):
        self.message = message
        self.is_server_error = is_server_error
        super().__init__(message)

def validate_token(token: str) -> User:
    """
    Core token validation logic - used by both HTTP and WebSocket auth.
    Raises AuthError on failure.
    """
    if not settings.SUPABASE_PROJECT_URL:
        logger.error("SUPABASE_PROJECT_URL not configured")
        raise AuthError("Authentication not configured", is_server_error=True)

    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "HS256"],
            audience="authenticated"
        )

        user_id = payload.get("sub")
        if not user_id:
            raise AuthError("Invalid token: missing user ID")

        return User(
            id=user_id,
            email=payload.get("email"),
            role=payload.get("role")
        )

    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        raise AuthError("Token has expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"JWT InvalidTokenError: {type(e).__name__}: {e}")
        raise AuthError("Invalid token")
    except AuthError:
        raise
    except Exception as e:
        logger.error(f"Unexpected auth error: {type(e).__name__}: {e}")
        raise AuthError("Invalid token")

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """Validate Supabase JWT and return authenticated user. """
    try:
        return validate_token(credentials.credentials)
    except AuthError as e:
        status_code = (
            status.HTTP_500_INTERNAL_SERVER_ERROR 
            if e.is_server_error 
            else status.HTTP_401_UNAUTHORIZED
        )
        raise HTTPException(status_code=status_code, detail=e.message)

async def get_current_user_ws(websocket: WebSocket) -> User:
    """
    Validate Supabase JWT for WebSocket connections.
    Token should be passed as query parameter: ws://...?token=xxx
    """
    token = websocket.query_params.get("token")
    
    if not token:
        await websocket.close(code=WS_CLOSE_AUTH_REQUIRED, reason="Missing token")
        raise Exception("WebSocket auth failed: missing token")
    
    try:
        user = validate_token(token)
        return user
    except AuthError as e:
        await websocket.close(code=WS_CLOSE_AUTH_FAILED, reason=e.message)
        raise Exception(f"WebSocket auth failed: {e.message}")
