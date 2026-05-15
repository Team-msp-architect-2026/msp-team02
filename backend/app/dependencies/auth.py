from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models.user import User
from backend.app.services.auth_service import (
    AuthConfigurationError,
    InvalidAuthorizationHeaderError,
    InvalidFirebaseTokenError,
    extract_bearer_token,
    upsert_firebase_user,
    verify_firebase_id_token,
)


def get_optional_current_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    db: Session = Depends(get_db),
) -> User | None:
    try:
        token = extract_bearer_token(authorization)
    except InvalidAuthorizationHeaderError as exc:
        raise _unauthorized("invalid authorization header") from exc

    if token is None:
        return None

    try:
        principal = verify_firebase_id_token(token)
        return upsert_firebase_user(db, principal)
    except InvalidFirebaseTokenError as exc:
        raise _unauthorized("invalid or expired authorization token") from exc
    except AuthConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc) or "firebase authentication is not configured",
        ) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="authentication user store is unavailable",
        ) from exc


def require_current_user(
    current_user: Annotated[User | None, Depends(get_optional_current_user)],
) -> User:
    if current_user is None:
        raise _unauthorized("authorization bearer token is required")
    return current_user


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )
