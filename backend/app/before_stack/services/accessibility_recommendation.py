"""Accessibility recommendation builder for the integrated before flow."""

from __future__ import annotations

from typing import Iterable

from backend.app.before_stack.services.accessibility_catalog import (
    load_accommodation_cards,
    load_disability_profiles,
    load_recommendation_rules,
    load_support_program_cards,
)


def _normalize_disability_type(value: str) -> str:
    target = (value or "").strip().lower()
    profiles = load_disability_profiles()

    for key, profile in profiles.items():
        aliases = [alias.strip().lower() for alias in profile.get("aliases", [])]
        if target == key or target in aliases:
            return key

    raise ValueError(f"지원하지 않는 장애 유형입니다: {value}")


def _build_question_card(disability_type: str, question: str, index: int) -> dict:
    profile = load_disability_profiles()[disability_type]
    return {
        "id": f"{disability_type}-question-{index}",
        "kind": "question",
        "title": f"{profile.get('label')} 특성 기준으로 회사에 먼저 확인할 질문",
        "description": question,
        "law_refs": [
            "장애인차별금지 및 권리구제 등에 관한 법률 제11조",
        ],
    }


def build_accessibility_recommendation(
    disability_type: str,
    job_traits: Iterable[str] | None = None,
) -> dict:
    normalized_type = _normalize_disability_type(disability_type)
    profiles = load_disability_profiles()
    rules = load_recommendation_rules()
    accommodations = load_accommodation_cards()
    supports = load_support_program_cards()

    profile = profiles[normalized_type]
    rule = rules.get(normalized_type, {})

    card_ids: list[str] = list(rule.get("default_cards", []))
    for trait in job_traits or []:
        card_ids.extend(rule.get("trait_overrides", {}).get(trait, []))

    cards: list[dict] = []
    seen_card_ids: set[str] = set()

    for card_id in card_ids:
        if card_id in seen_card_ids:
            continue
        seen_card_ids.add(card_id)
        source = accommodations.get(card_id) or supports.get(card_id)
        if not source:
            continue
        cards.append(
            {
                "id": card_id,
                "kind": source["kind"],
                "title": source["title"],
                "description": source["description"],
                "law_refs": source.get("law_refs", []),
                "action_hint": source.get("action_hint"),
            }
        )

    cards.extend(
        _build_question_card(normalized_type, question, index)
        for index, question in enumerate(rule.get("questions", []), start=1)
    )

    legal_basis: list[str] = []
    for card in cards:
        for law_ref in card.get("law_refs", []):
            if law_ref not in legal_basis:
                legal_basis.append(law_ref)

    return {
        "disability_type": normalized_type,
        "disability_label": profile.get("label", normalized_type),
        "overview": profile.get("summary", ""),
        "cards": cards,
        "legal_basis": legal_basis,
    }
