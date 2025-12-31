from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from jwt import PyJWKClient
from pydantic import BaseModel
from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

security = HTTPBearer()
_jwks_client: Optional[PyJWKClient] = None

def get_jwks_client() -> PyJWKClient:
    """Get or create cached JWKS client for Supabase token verification."""
    global _jwks_client
    if _jwks_client is None:
        if not settings.SUPABASE_PROJECT_URL:
            raise ValueError("SUPABASE_PROJECT_URL not configured")
        jwks_url = f"{settings.SUPABASE_PROJECT_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True)
    return _jwks_client

class User(BaseModel):
    """Authenticated user from Supabase JWT."""
    id: str
    email: Optional[str] = None
    role: Optional[str] = None

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """Validate Supabase JWT and return authenticated user. Raises 401 if invalid."""
    # print("token:", credentials.credentials)

    token = credentials.credentials

    if not settings.SUPABASE_PROJECT_URL:
        logger.error("SUPABASE_PROJECT_URL not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication not configured"
        )

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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )

        return User(
            id=user_id,
            email=payload.get("email"),
            role=payload.get("role")
        )

    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"JWT InvalidTokenError: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        logger.error(f"Unexpected auth error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
