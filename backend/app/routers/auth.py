from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from backend.app.dependencies.auth import get_optional_current_user
from backend.app.models.user import User
from backend.app.schemas.auth import AuthMeResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.get("/me", response_model=AuthMeResponse)
def read_auth_me(
    current_user: Annotated[User | None, Depends(get_optional_current_user)],
) -> AuthMeResponse:
    if current_user is None:
        return AuthMeResponse(
            logged_in=False,
            user_id=None,
            display_name=None,
            email=None,
        )

    return AuthMeResponse(
        logged_in=True,
        user_id=current_user.id,
        display_name=current_user.display_name,
        email=current_user.email,
    )
