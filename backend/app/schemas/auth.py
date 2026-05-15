from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class AuthMeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    logged_in: bool
    user_id: str | None
    display_name: str | None
    email: str | None
