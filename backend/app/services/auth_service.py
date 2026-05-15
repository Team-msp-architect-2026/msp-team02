from __future__ import annotations

import os
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.models.user import User

AUTH_PROVIDER_FIREBASE_GOOGLE = "firebase_google"

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_DIR.parent

_FIREBASE_APP_NAME = "klabor-firebase-auth"
_firebase_app: Any | None = None
_firebase_app_lock = threading.Lock()


class AuthServiceError(Exception):
    """Base class for backend auth errors."""


class AuthConfigurationError(AuthServiceError):
    """Firebase Admin verification is unavailable or misconfigured."""


class InvalidAuthorizationHeaderError(AuthServiceError):
    """Authorization header is present but not a valid Bearer header."""


class InvalidFirebaseTokenError(AuthServiceError):
    """Firebase token verification failed."""


@dataclass(frozen=True)
class FirebasePrincipal:
    uid: str
    email: str | None
    display_name: str | None


def extract_bearer_token(authorization: str | None) -> str | None:
    if authorization is None or not authorization.strip():
        return None

    scheme, separator, value = authorization.partition(" ")
    token = value.strip()
    if scheme.lower() != "bearer" or not separator or not token or " " in token:
        raise InvalidAuthorizationHeaderError("invalid authorization header")
    return token


def verify_firebase_id_token(token: str) -> FirebasePrincipal:
    # Firebase ID tokens are JWTs. Reject obviously malformed values before
    # touching Firebase Admin so invalid-token smoke tests do not need secrets.
    if token.count(".") != 2:
        raise InvalidFirebaseTokenError("invalid firebase token")

    try:
        from firebase_admin import auth as firebase_auth
    except ImportError as exc:
        raise AuthConfigurationError("firebase admin sdk is not installed") from exc

    invalid_errors: tuple[type[BaseException], ...] = (ValueError,)
    for error_name in (
        "ExpiredIdTokenError",
        "InvalidIdTokenError",
        "RevokedIdTokenError",
        "UserDisabledError",
    ):
        error_type = getattr(firebase_auth, error_name, None)
        if isinstance(error_type, type):
            invalid_errors = invalid_errors + (error_type,)

    firebase_app = get_firebase_app()

    try:
        decoded = firebase_auth.verify_id_token(
            token,
            app=firebase_app,
            check_revoked=False,
        )
    except invalid_errors as exc:
        raise InvalidFirebaseTokenError("invalid firebase token") from exc
    except Exception as exc:
        raise AuthConfigurationError("firebase token verification failed") from exc

    return _principal_from_decoded_token(decoded)


def upsert_firebase_user(db: Session, principal: FirebasePrincipal) -> User:
    now = datetime.now(timezone.utc)
    query = select(User).where(
        User.auth_provider == AUTH_PROVIDER_FIREBASE_GOOGLE,
        User.provider_subject == principal.uid,
    )

    user = db.execute(query).scalar_one_or_none()
    if user is not None:
        _apply_login_fields(user, principal, now)
        db.commit()
        db.refresh(user)
        return user

    user = User(
        id=str(uuid.uuid4()),
        auth_provider=AUTH_PROVIDER_FIREBASE_GOOGLE,
        provider_subject=principal.uid,
        display_name=principal.display_name,
        email=principal.email,
        last_login_at=now,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
        return user
    except IntegrityError:
        db.rollback()

    user = db.execute(query).scalar_one()
    _apply_login_fields(user, principal, now)
    db.commit()
    db.refresh(user)
    return user


def get_firebase_app() -> Any:
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    with _firebase_app_lock:
        if _firebase_app is not None:
            return _firebase_app

        project_id = _required_firebase_project_id()
        try:
            import firebase_admin
            from firebase_admin import credentials
        except ImportError as exc:
            raise AuthConfigurationError("firebase admin sdk is not installed") from exc

        try:
            try:
                _firebase_app = firebase_admin.get_app(_FIREBASE_APP_NAME)
            except ValueError:
                firebase_credential = _firebase_credential(credentials)
                _firebase_app = firebase_admin.initialize_app(
                    firebase_credential,
                    options={"projectId": project_id},
                    name=_FIREBASE_APP_NAME,
                )
        except AuthConfigurationError:
            raise
        except Exception as exc:
            raise AuthConfigurationError("firebase admin initialization failed") from exc

    return _firebase_app


def _required_firebase_project_id() -> str:
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "").strip()
    if not project_id:
        raise AuthConfigurationError("firebase project id is not configured")
    return project_id


def _firebase_credential(credentials_module: Any) -> Any | None:
    if _prefer_application_default_credentials():
        return None

    credential_path = os.environ.get("FIREBASE_ADMIN_CREDENTIALS", "").strip()
    if not credential_path:
        return None

    resolved_path = _resolve_configured_path(credential_path)
    if not resolved_path.is_file():
        raise AuthConfigurationError("firebase admin credentials file is unavailable")
    return credentials_module.Certificate(str(resolved_path))


def _prefer_application_default_credentials() -> bool:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return True
    if os.environ.get("K_SERVICE"):
        return True
    local_adc_path = Path.home() / ".config/gcloud/application_default_credentials.json"
    return local_adc_path.is_file()


def _resolve_configured_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser()
    if path.is_absolute():
        return path

    candidates = [
        (REPO_ROOT / path).resolve(),
        (BACKEND_DIR / path).resolve(),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def _principal_from_decoded_token(decoded: dict[str, Any]) -> FirebasePrincipal:
    uid = _clean_optional_string(decoded.get("uid") or decoded.get("user_id"))
    if uid is None:
        raise InvalidFirebaseTokenError("firebase token is missing uid")

    firebase_claims = decoded.get("firebase")
    sign_in_provider = None
    if isinstance(firebase_claims, dict):
        sign_in_provider = firebase_claims.get("sign_in_provider")
    if sign_in_provider != "google.com":
        raise InvalidFirebaseTokenError("unsupported firebase sign-in provider")

    return FirebasePrincipal(
        uid=uid,
        email=_clean_optional_string(decoded.get("email")),
        display_name=_clean_optional_string(decoded.get("name")),
    )


def _clean_optional_string(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _apply_login_fields(
    user: User,
    principal: FirebasePrincipal,
    login_time: datetime,
) -> None:
    if principal.display_name is not None:
        user.display_name = principal.display_name
    if principal.email is not None:
        user.email = principal.email
    user.last_login_at = login_time
