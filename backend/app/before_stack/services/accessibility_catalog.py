"""Structured catalog loader for before accessibility recommendations."""

from __future__ import annotations

from functools import lru_cache

import yaml

from backend.app.before_stack.core.settings import ASSETS_DIR


ACCESSIBILITY_DIR = ASSETS_DIR / "data" / "accessibility"


def _read_yaml(name: str) -> dict:
    path = ACCESSIBILITY_DIR / name
    with path.open(encoding="utf-8") as file:
        return yaml.safe_load(file) or {}


@lru_cache(maxsize=1)
def load_disability_profiles() -> dict:
    return _read_yaml("disability_profiles.yaml").get("profiles", {})


@lru_cache(maxsize=1)
def load_job_traits() -> dict:
    return _read_yaml("job_traits.yaml").get("job_traits", {})


@lru_cache(maxsize=1)
def load_accommodation_cards() -> dict:
    return _read_yaml("accommodation_catalog.yaml").get("cards", {})


@lru_cache(maxsize=1)
def load_support_program_cards() -> dict:
    return _read_yaml("support_program_catalog.yaml").get("cards", {})


@lru_cache(maxsize=1)
def load_recommendation_rules() -> dict:
    return _read_yaml("recommendation_rules.yaml").get("rules", {})
